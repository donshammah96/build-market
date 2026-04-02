import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { authConfig } from "./auth.config";
import { z } from "zod";
import type { User } from "@/app/lib/types/definitions";
import Google from "next-auth/providers/google";
import GitHub from "next-auth/providers/github";
import Facebook from "next-auth/providers/facebook";
import Azure from "next-auth/providers/azure-ad";
import { verifyScryptPassword } from "@build/auth-server/password-hash";
import { getSqlClient } from "@/app/lib/infrastructure/db";
import { env } from "@/app/lib/infrastructure/env";

async function getUser(email: string): Promise<User | undefined> {
  try {
    const sql = getSqlClient();
    const user = await sql<User[]>`SELECT * FROM users WHERE email=${email}`;
    return user[0];
  } catch (error) {
    console.error("Failed to fetch user:", error);
    throw new Error("Failed to fetch user.");
  }
}

export function checkUserRole(
  session: { user?: { role?: string | null } | null } | null | undefined,
  allowedRoles: ReadonlyArray<string>,
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
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
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
      clientId: env.auth.oauth.google.clientId,
      clientSecret: env.auth.oauth.google.clientSecret,
      authorization: {
        params: {
          prompt: "consent",
          access_type: "offline",
          response_type: "code",
        },
      },
    }),

    // GitHub OAuth Provider
    GitHub({
      clientId: env.auth.oauth.github.clientId,
      clientSecret: env.auth.oauth.github.clientSecret,
      authorization: {
        params: {
          scope: "read:user user:email",
        },
      },
    }),

    // Facebook OAuth Provider
    Facebook({
      clientId: env.auth.oauth.facebook.clientId,
      clientSecret: env.auth.oauth.facebook.clientSecret,
      authorization: {
        params: {
          scope: "email public_profile",
        },
      },
    }),

    // Microsoft Azure AD OAuth Provider
    Azure({
      clientId: env.auth.oauth.azureAd.clientId,
      clientSecret: env.auth.oauth.azureAd.clientSecret,
      issuer: `https://login.microsoftonline.com/${env.auth.oauth.azureAd.tenantId}/v2.0`,
      authorization: {
        params: {
          scope: "openid profile email User.Read",
        },
      },
    }),
  ],
});

export const handlers = nextAuth.handlers;
// eslint-disable-next-line /typescript-eslint/no-explicit-any
export const auth = nextAuth.auth as unknown as (...args: any[]) => any;
// eslint-disable-next-line /typescript-eslint/no-explicit-any
export const signIn = nextAuth.signIn as unknown as (...args: any[]) => any;
// eslint-disable-next-line /typescript-eslint/no-explicit-any
export const signOut = nextAuth.signOut as unknown as (...args: any[]) => any;
