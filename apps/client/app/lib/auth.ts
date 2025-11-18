import NextAuth from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import { authConfig } from './auth.config';
import { z } from 'zod';
import type { User } from './definitions';
import Google from 'next-auth/providers/google';
import GitHub from 'next-auth/providers/github';
import Facebook from 'next-auth/providers/facebook';
import Azure from 'next-auth/providers/azure-ad';
import { verifyScryptPassword } from './actions';
import { getSqlClient } from './db';


async function getUser(email: string): Promise<User | undefined> {
  try {
    const sql = getSqlClient();
    const user = await sql<User[]>`SELECT * FROM users WHERE email=${email}`;
    return user[0];
  } catch (error) {
    console.error('Failed to fetch user:', error);
    throw new Error('Failed to fetch user.');
  }
}


export function checkUserRole(
  session: { user?: { role?: string | null } | null } | null | undefined,
  allowedRoles: ReadonlyArray<string>
): boolean {
  if (!session?.user) return false;
  const role = session.user.role ?? null;
  if (!role) return false;
  return allowedRoles.includes(role);
}

const nextAuth = NextAuth({
  ...authConfig,
  providers: [
    // Credentials Provider
    Credentials({
      name: 'credentials',
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" }
      },
      async authorize(credentials, _request) {
        const parsed = z
          .object({ email: z.string().email(), password: z.string().min(8) })
          .safeParse(credentials);
        if (!parsed.success) return null;

        const { email, password } = parsed.data;
        const user = await getUser(email);
        if (!user) return null;

        // Verify with the same algorithm you used on signup (scrypt shown here)
        const ok = await verifyScryptPassword(password, user.password); 
        if (!ok) return null;

        // Return a User that matches your type (id, email, role at least)
        return {
          id: user.id,
          email: user.email,
          role: user.role,
          first_name: user.first_name,
          last_name: user.last_name,
          password: user.password,
          phone: user.phone,
          avatar_url: user.avatar_url,
          is_verified: user.is_verified,
          is_active: user.is_active,
          created_at: user.created_at,
          updated_at: user.updated_at,
          last_login_at: user.last_login_at,
        } as User;
      },
    }),
    
    // Google OAuth Provider
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      authorization: {
        params: {
          prompt: 'consent',
          access_type: 'offline',
          response_type: 'code',
        },
      },
    }),
    
    // GitHub OAuth Provider
    GitHub({
      clientId: process.env.GITHUB_CLIENT_ID!,
      clientSecret: process.env.GITHUB_CLIENT_SECRET!,
      authorization: {
        params: {
          scope: 'read:user user:email',
        },
      },
    }),
    
    // Facebook OAuth Provider
    Facebook({
      clientId: process.env.FACEBOOK_CLIENT_ID!,
      clientSecret: process.env.FACEBOOK_CLIENT_SECRET!,
      authorization: {
        params: {
          scope: 'email public_profile',
        },
      },
    }),
    
    // Microsoft Azure AD OAuth Provider
    Azure({
      clientId: process.env.AZURE_AD_CLIENT_ID!,
      clientSecret: process.env.AZURE_AD_CLIENT_SECRET!,
      issuer: `https://login.microsoftonline.com/${process.env.AZURE_AD_TENANT_ID || 'common'}/v2.0`,
      authorization: {
        params: {
          scope: 'openid profile email User.Read',
        },
      },
    }),
  ],
});

export const handlers = nextAuth.handlers;
export const auth = nextAuth.auth as unknown as (...args: any[]) => any;
export const signIn = nextAuth.signIn as unknown as (...args: any[]) => any;
export const signOut = nextAuth.signOut as unknown as (...args: any[]) => any;


