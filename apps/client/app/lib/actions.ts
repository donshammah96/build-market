'use server';

import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { signIn } from './auth';
import crypto from 'node:crypto';
import { AuthError } from 'next-auth';
import { Redis } from '@upstash/redis';
import { getSqlClient } from './db';
import { verifyHCaptcha } from './hcaptcha'; 
import { sendEmail } from './mailer';
import { prisma } from '@repo/db'; 

// Redis client initialization
const redis = new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL || '',
    token: process.env.UPSTASH_REDIS_REST_TOKEN || '',
  });

export async function authenticate(
    prevState: string | undefined,
    formData: FormData
  ) {
      try {
        await signIn('credentials', formData);
    } catch (error) {
      if (error instanceof AuthError) {
        switch (error.type) {
          case 'CredentialsSignin':
            return 'Invalid credentials.';
          default: 
            return 'Something went wrong.';
        }
      }
      throw error;
    }
  }

const SignUpSchema = z
  .object({
    email: z.string().email({ message: 'Please enter a valid email address.' }).max(254),
    password: z
      .string()
      .min(8, { message: 'Password must be at least 8 characters.' })
      .max(128, { message: 'Password must be at most 128 characters.' })
      .regex(/[a-z]/, { message: 'Password must include a lowercase letter.' })
      .regex(/[A-Z]/, { message: 'Password must include an uppercase letter.' })
      .regex(/\d/, { message: 'Password must include a number.' })
      .regex(/[^A-Za-z0-9]/, { message: 'Password must include a symbol.' }),
    confirmPassword: z.string().min(1, { message: 'Please confirm your password.' }),
    agreeToTerms: z.literal('true', { message: 'You must agree to the terms.' }),
  })
  .superRefine((data, ctx) => {
    if (data.password !== data.confirmPassword) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['confirmPassword'],
        message: 'Passwords do not match.',
      });
    }
  });

export type SignUpState = {
  errors?: {
    email?: string[];
    password?: string[];
    confirmPassword?: string[];
    agreeToTerms?: string[];
  };
  message?: string | null;
  success?: boolean;
};

export async function signUp(prevState: SignUpState, formData: FormData) {
  const validated = SignUpSchema.safeParse({
    email: String(formData.get('email') || ''),
    password: String(formData.get('password') || ''),
    confirmPassword: String(formData.get('confirmPassword') || ''),
    agreeToTerms: String(formData.get('agreeToTerms') || ''),
  });

  if (!validated.success) {
    return {
      errors: validated.error.flatten().fieldErrors,
      message: 'Please fix the errors and try again.',
      success: false,
    } satisfies SignUpState;
  }

  const { email, password } = validated.data;

  try {
    const sql = getSqlClient();
    // Enforce unique email
    const existing = await sql`SELECT id FROM users WHERE email = ${email} LIMIT 1`;
    if (existing?.length) {
      return { message: 'An account with this email already exists.', success: false };
    }
    // Derive password hash with scrypt and random salt
    const salt = crypto.randomBytes(16);
    const scrypt = (password: string, salt: Buffer, keylen: number) =>
      new Promise<Buffer>((resolve, reject) => {
        crypto.scrypt(password, salt, keylen, { N: 16384, r: 8, p: 1 }, (err, derivedKey) => {
          if (err) return reject(err);
          resolve(derivedKey as Buffer);
        });
      });
    const derived = await scrypt(password, salt, 64);
    const passwordHash = `scrypt$16384$8$1$${salt.toString('hex')}$${derived.toString('hex')}`;
    const result = await sql`
      INSERT INTO users (email, password_hash)
      VALUES (${email}, ${passwordHash})
      RETURNING id
    `;

    const newUserId = result?.[0]?.id as string | undefined;

    if (!newUserId) {
      return { message: 'Account creation failed. Please try again.', success: false };
    }

    // Do not auto-login here to avoid coupling with auth hash algorithm
    return { message: 'Account created successfully.', success: true };
  } catch (error) {
    return { message: 'Database Error: Failed to create account.', success: false };
  }
}
function parseScryptHash(passwordHash: string): {
  N: number;
  r: number;
  p: number;
  salt: Buffer;
  derived: Buffer;
} | null {
  const parts = passwordHash.split('$');
  if (parts.length !== 6 || parts[0] !== 'scrypt') return null;
  const N = Number(parts[1]);
  const r = Number(parts[2]);
  const p = Number(parts[3]);
  const saltHex = parts[4];
  const derivedHex = parts[5];
  if (!Number.isFinite(N) || !Number.isFinite(r) || !Number.isFinite(p)) return null;
  if (!saltHex || !derivedHex) return null;
  return {
    N,
    r,
    p,
    salt: Buffer.from(saltHex, 'hex'),
    derived: Buffer.from(derivedHex, 'hex'),
  };
}

export async function scryptAsync(password: string, salt: Buffer, keylen: number, opts: { N: number; r: number; p: number }): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    crypto.scrypt(password, salt, keylen, opts, (err, derivedKey) => {
      if (err) return reject(err);
      resolve(derivedKey as Buffer);
    });
  });
}

export async function verifyScryptPassword(password: string, passwordHash: string): Promise<boolean> {
  const parsed = parseScryptHash(passwordHash);
  if (!parsed) return false;
  const { N, r, p, salt, derived } = parsed;
  const calc = await scryptAsync(password, salt, derived.length, { N, r, p });
  return crypto.timingSafeEqual(calc, derived);
}

async function hashPasswordScrypt(password: string): Promise<string> {
  const salt = crypto.randomBytes(16);
  const N = 16384;
  const r = 8;
  const p = 1;
  const derived = await scryptAsync(password, salt, 64, { N, r, p });
  return `scrypt$${N}$${r}$${p}$${salt.toString('hex')}$${derived.toString('hex')}`;
}

function sha256Hex(input: string): string {
  return crypto.createHash('sha256').update(input, 'utf8').digest('hex');
}

// ===== AUTH: PASSWORD RECOVERY =====

const RequestResetSchema = z.object({
  email: z.string().email({ message: 'Please enter a valid email address.' }).max(254),
});

export type RequestResetState = {
  errors?: { email?: string[] };
  message?: string | null;
  success?: boolean;
};

export async function requestPasswordReset(prevState: RequestResetState, formData: FormData) {
  const validated = RequestResetSchema.safeParse({ email: String(formData.get('email') || '') });
  if (!validated.success) {
    return { errors: validated.error.flatten().fieldErrors, message: 'Please enter a valid email and try again.', success: false };
  }
  const { email } = validated.data;

  try {
    const captchaToken = String(
      formData.get('h-captcha-response') ||
      formData.get('captchaToken') ||
      formData.get('captcha') ||
      ''
    );
    if (!captchaToken) {
      return { message: 'Invalid CAPTCHA. Please try again.', success: false };
    }
    const captchaValid = await verifyHCaptcha(captchaToken);
    if (!captchaValid) {
      return { message: 'Invalid CAPTCHA. Please try again.', success: false}
    }
    // Rate-limiting with Redis
    const sql = getSqlClient();
    const rateLimitKey = `reset:${email}`;
    const count = await redis.incr(rateLimitKey);
    if (count === 1) {
      await redis.expire(rateLimitKey, 60 * 60); // Set 1-hour TTL
    }
    if (count > 3) {
      return { message: 'Too many requests. Please try again later.', success: false };
    }
    const users = await sql`SELECT id FROM users WHERE email = ${email} LIMIT 1`;
    // Always respond with a generic message to prevent account enumeration
    if (!users?.length) {
      await sql`
      INSERT INTO password_reset_requests (email, created_at)
      VALUES (${email}, CURRENT_TIMESTAMP)
      `;
      return { message: 'If the email exists, a reset link has been sent.', success: true };
    }

    const userId = (users as any)[0]?.id as string;
    const rawToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = sha256Hex(rawToken);
    const expiresAt = new Date(Date.now() + 1000 * 60 * 60); // 1 hour

    await sql`
      INSERT INTO password_reset_tokens (user_id, token_hash, expires_at)
      VALUES (${userId}, ${tokenHash}, ${expiresAt.toISOString()})
    `;
    await sql`
        INSERT INTO password_reset_requests (email, created_at)
        VALUES (${email}, CURRENT_TIMESTAMP)
      `;
      const resetUrl = `${process.env.NEXT_PUBLIC_APP_URL}/reset-password?token=${rawToken}`;
      await sendEmail({
        to: email,
        subject: 'Password Reset Request',
        html: `
          <p>You requested a password reset.</p>
          <p>Click <a href="${resetUrl}">here</a> to reset your password.</p>
          <p>This link expires in 1 hour.</p>
          <p>If you did not request this, please ignore this email.</p>
        `,
      });

    return { message: 'If the email exists, a reset link has been sent.', success: true };
  } catch (error: any) {
    if (error.message === 'Rate limit exceeded') {
      return { message: 'Too many requests. Please try again later.', success: false };
    }
    console.error('Password reset request error:', error);
    return { message: 'Unable to process request at this time.', success: false };
  }
}

const ResetPasswordSchema = z
  .object({
    token: z.string().min(1, { message: 'Missing token.' }),
    password: z
      .string()
      .min(8, { message: 'Password must be at least 8 characters.' })
      .max(128, { message: 'Password must be at most 128 characters.' })
      .regex(/[a-z]/, { message: 'Include a lowercase letter.' })
      .regex(/[A-Z]/, { message: 'Include an uppercase letter.' })
      .regex(/\d/, { message: 'Include a number.' })
      .regex(/[^A-Za-z0-9]/, { message: 'Include a symbol.' }),
    confirmPassword: z.string().min(1, { message: 'Please confirm your password.' }),
  })
  .superRefine((data, ctx) => {
    if (data.password !== data.confirmPassword) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['confirmPassword'], message: 'Passwords do not match.' });
    }
  });

export type ResetPasswordState = {
  errors?: { token?: string[]; password?: string[]; confirmPassword?: string[] };
  message?: string | null;
  success?: boolean;
};

export async function resetPassword(prevState: ResetPasswordState, formData: FormData) {
  const validated = ResetPasswordSchema.safeParse({
    token: String(formData.get('token') || ''),
    password: String(formData.get('password') || ''),
    confirmPassword: String(formData.get('confirmPassword') || ''),
  });
  if (!validated.success) {
    return { errors: validated.error.flatten().fieldErrors, message: 'Please fix the errors and try again.', success: false };
  }

  const { token, password } = validated.data;
  const tokenHash = sha256Hex(token);

  try {
    const sql = getSqlClient();
    const rows = await sql`SELECT id, user_id, expires_at, used_at FROM password_reset_tokens WHERE token_hash = ${tokenHash} LIMIT 1`;
    if (!rows?.length) return { message: 'Invalid or expired token.', success: false };
    const row = rows[0] as any;
    if (row.used_at) return { message: 'Token already used.', success: false };
    if (new Date(row.expires_at).getTime() < Date.now()) return { message: 'Token expired.', success: false };

    const newHash = await hashPasswordScrypt(password);
    await sql`UPDATE users SET password_hash = ${newHash} WHERE id = ${row.user_id}`;
    await sql`UPDATE password_reset_tokens SET used_at = CURRENT_TIMESTAMP WHERE id = ${row.id}`;

    return { message: 'Password has been reset successfully.', success: true };
  } catch (error: any) {
    if (error.message === 'Invalid or expired token') return { message: 'Invalid or expired token.', success: false };
    if (error.message === 'Token already used') return { message: 'Token already used.', success: false };
    if (error.message === 'Token expired') return { message: 'Token expired.', success: false };
    console.error('Password reset error:', error);
    return { message: 'Unable to reset password at this time.', success: false };
  }
}

// ===== AUTH: CHANGE PASSWORD (authenticated) =====

const ChangePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, { message: 'Current password is required.' }),
    newPassword: z
      .string()
      .min(8, { message: 'Password must be at least 8 characters.' })
      .max(128, { message: 'Password must be at most 128 characters.' })
      .regex(/[a-z]/, { message: 'Include a lowercase letter.' })
      .regex(/[A-Z]/, { message: 'Include an uppercase letter.' })
      .regex(/\d/, { message: 'Include a number.' })
      .regex(/[^A-Za-z0-9]/, { message: 'Include a symbol.' }),
    confirmNewPassword: z.string().min(1, { message: 'Please confirm your password.' }),
  })
  .superRefine((data, ctx) => {
    if (data.newPassword !== data.confirmNewPassword) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['confirmNewPassword'], message: 'Passwords do not match.' });
    }
  });

export type ChangePasswordState = {
  errors?: { currentPassword?: string[]; newPassword?: string[]; confirmNewPassword?: string[] };
  message?: string | null;
  success?: boolean;
};

export async function changePassword(userId: string, prevState: ChangePasswordState, formData: FormData) {
  const validated = ChangePasswordSchema.safeParse({
    currentPassword: String(formData.get('currentPassword') || ''),
    newPassword: String(formData.get('newPassword') || ''),
    confirmNewPassword: String(formData.get('confirmNewPassword') || ''),
  });
  if (!validated.success) {
    return { errors: validated.error.flatten().fieldErrors, message: 'Please fix the errors and try again.', success: false };
  }

  try {
    const sql = getSqlClient();
    const rows = await sql`SELECT password_hash FROM users WHERE id = ${userId} LIMIT 1` as any;
    if (!rows?.length) return { message: 'User not found.', success: false };
    const currentHash = (rows as any)[0]?.password_hash as string;
    const ok = await verifyScryptPassword(validated.data.currentPassword, currentHash);
    if (!ok) return { message: 'Invalid password.', success: false };

    const newHash = await hashPasswordScrypt(validated.data.newPassword);
    await sql`UPDATE users SET password_hash = ${newHash} WHERE id = ${userId}`;
    return { message: 'Password changed successfully.', success: true };
  } catch (error: any) {
    if (error.message === 'User not found') return { message: 'User not found.', success: false };
    if (error.message === 'Invalid password') return { message: 'Current password is incorrect.', success: false };
    console.error('Change password error:', error);
    return { message: 'Unable to change password at this time.', success: false };
  }
}


const FormSchema = z.object({
    id: z.string(),
    customerId: z.string({
      message: 'Please select a customer',
    }),
    amount: z.coerce.number().gt(
      0, 
      { 
        message: 'Please enter an amount greater than $0.' 
      }
    ),
    status: z.enum(['pending', 'paid'], {
      message: 'Please select an invoice status.'
    }),
    date: z.string(),
});

const CreateInvoice = FormSchema.omit({ id: true, date: true});
const UpdateInvoice = FormSchema.omit({ id: true, date: true });

export type State = {
  errors?: {
    customerId?: string[];
    amount?: string[];
    status?: string[];
  };
  message?: string | null;
};

// ===== PROFESSIONALS =====

export async function getProfessionals(limit?: number, verified?: boolean) {
  try {
    const professionals = await prisma.professionalProfile.findMany({
      where: {
        ...(verified !== undefined && { verified }),
      },
      take: limit,
      include: {
        user: {
          select: {
            firstName: true,
            lastName: true,
            email: true,
          },
        },
        reviews: {
          select: {
            rating: true,
          },
        },
        portfolios: {
          select: {
            images: true,
          },
          take: 1,
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return professionals;
  } catch (error) {
    console.error('Error fetching professionals:', error);
    return [];
  }
}

export async function getProfessionalById(userId: string) {
  try {
    const professional = await prisma.professionalProfile.findUnique({
      where: {
        userId,
      },
      include: {
        user: {
          select: {
            firstName: true,
            lastName: true,
            email: true,
            phone: true,
          },
        },
        reviews: {
          include: {
            reviewer: {
              select: {
                firstName: true,
                lastName: true,
              },
            },
          },
          orderBy: {
            createdAt: 'desc',
          },
        },
        portfolios: {
          orderBy: {
            createdAt: 'desc',
          },
        },
        projects: {
          where: {
            status: 'completed' as const,
          },
          take: 6,
          orderBy: {
            createdAt: 'desc',
          },
        },
      },
    });

    return professional;
  } catch (error) {
    console.error('Error fetching professional:', error);
    return null;
  }
}