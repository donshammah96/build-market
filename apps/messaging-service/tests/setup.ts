/**
 * Jest Test Setup
 * Sets up environment variables and test utilities
 */

import { config } from 'dotenv';

// Load test environment variables
config({ path: '.env.test' });

// Set default test environment variables
process.env.NEXTAUTH_SECRET = process.env.NEXTAUTH_SECRET || 'test-secret-key-for-jwt-signing-minimum-32-chars';
process.env.MESSAGE_ENCRYPTION_SECRET = process.env.MESSAGE_ENCRYPTION_SECRET || 'test-encryption-secret-key-for-message-encryption-minimum-32-chars';
process.env.DATABASE_URL = process.env.DATABASE_URL || 'mongodb://localhost:27017/messaging-test';
process.env.NODE_ENV = 'test';

// Note: Timeout is configured in jest.config.js (testTimeout: 30000)

// Suppress console logs during tests (optional)
// Comment out if you need to see console output for debugging
const originalConsole = { ...console };
global.console = {
  ...console,
  log: () => {},
  debug: () => {},
  info: () => {},
  warn: () => {},
  // Keep error for debugging test failures
  error: originalConsole.error,
};

