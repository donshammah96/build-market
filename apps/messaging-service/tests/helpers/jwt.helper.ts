/**
 * JWT Helper for Tests
 * Generates valid JWT tokens for testing
 */

import jwt from 'jsonwebtoken';

const TEST_SECRET = process.env.NEXTAUTH_SECRET || 'test-secret-key-for-jwt-signing-minimum-32-chars';

export interface TestUser {
  id: string;
  email?: string;
  role?: string;
}

/**
 * Generate a valid JWT token for testing
 */
export function generateTestToken(user: TestUser): string {
  return jwt.sign(
    {
      sub: user.id,
      email: user.email || `${user.id}@test.com`,
      role: user.role || 'user',
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 3600, // 1 hour
    },
    TEST_SECRET
  );
}

/**
 * Generate an expired JWT token for testing
 */
export function generateExpiredToken(user: TestUser): string {
  return jwt.sign(
    {
      sub: user.id,
      email: user.email || `${user.id}@test.com`,
      role: user.role || 'user',
      iat: Math.floor(Date.now() / 1000) - 7200,
      exp: Math.floor(Date.now() / 1000) - 3600, // Expired 1 hour ago
    },
    TEST_SECRET
  );
}

/**
 * Generate an invalid JWT token for testing
 */
export function generateInvalidToken(): string {
  return jwt.sign(
    {
      sub: 'test-user',
      email: 'test@test.com',
    },
    'wrong-secret-key'
  );
}

/**
 * Test user fixtures
 */
export const testUsers = {
  don: {
    id: 'user-don-123',
    email: 'don@test.com',
    role: 'user',
  },
  shammah: {
    id: 'user-shammah-456',
    email: 'shammah@test.com',
    role: 'user',
  },
  evans: {
    id: 'user-evans-789',
    email: 'evans@test.com',
    role: 'admin',
  },
};
