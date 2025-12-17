import { beforeAll, afterEach, afterAll, vi } from 'vitest';

// Only import cleanup in jsdom environment
let cleanup: (() => void) | undefined;
if (typeof window !== 'undefined') {
  // We're in jsdom environment
  import('@testing-library/react').then((mod) => {
    cleanup = mod.cleanup;
  });
}

// Setup mocks for Next.js modules
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    prefetch: vi.fn(),
  }),
  useSearchParams: () => ({
    get: vi.fn(),
  }),
  usePathname: () => '/',
}));

// Mock environment variables
process.env.NEXT_PUBLIC_APP_URL = 'http://localhost:3000';
process.env.CLERK_WEBHOOK_SECRET = 'test_webhook_secret';
process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY = 'pk_test_123';
process.env.CLERK_SECRET_KEY = 'sk_test_123';
process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test';

// Setup and teardown
beforeAll(() => {
  // Global test setup
});

afterEach(() => {
  if (cleanup) cleanup();
  vi.clearAllMocks();
});

afterAll(() => {
  // Global test teardown
});
