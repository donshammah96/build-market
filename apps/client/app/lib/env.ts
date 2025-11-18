import { z } from 'zod';

/**
 * Environment variable schema validation
 * This ensures all required env vars are present at build/runtime
 */
const envSchema = z.object({
  // Clerk
  CLERK_WEBHOOK_SECRET: z.string().min(1, 'CLERK_WEBHOOK_SECRET is required'),
  NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: z.string().min(1),
  CLERK_SECRET_KEY: z.string().min(1),

  // Database
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),

  // App URLs
  NEXT_PUBLIC_APP_URL: z.string().url('Invalid NEXT_PUBLIC_APP_URL'),

  // Optional services
  MESSAGING_SERVICE_URL: z.string().url().optional(),
  
  // Node environment
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
});

/**
 * Validated and type-safe environment variables
 * @throws {ZodError} if validation fails
 */
function validateEnv() {
  try {
    return envSchema.parse({
      CLERK_WEBHOOK_SECRET: process.env.CLERK_WEBHOOK_SECRET,
      NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY,
      CLERK_SECRET_KEY: process.env.CLERK_SECRET_KEY,
      DATABASE_URL: process.env.DATABASE_URL,
      NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
      MESSAGING_SERVICE_URL: process.env.MESSAGING_SERVICE_URL,
      NODE_ENV: process.env.NODE_ENV,
    });
  } catch (error) {
    console.error('❌ Invalid environment variables:');
    console.error(error);
    throw new Error('Environment validation failed. Check your .env file.');
  }
}

export const env = validateEnv();

export type Env = z.infer<typeof envSchema>;

