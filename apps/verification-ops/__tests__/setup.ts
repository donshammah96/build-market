import { beforeAll, afterEach, vi } from "vitest";

// Mock server-only Next.js marker
vi.mock("server-only", () => ({}));

// Set test environment variables per .env.test specification
process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY =
  "pk_test_synthetic_key_for_vitest";
process.env.CLERK_SECRET_KEY = "sk_test_synthetic_key_for_vitest";
process.env.NEXT_PUBLIC_CLERK_SIGN_IN_URL = "/sign-in";
process.env.DATABASE_URL =
  "postgresql://test:test@localhost:5432/verification_ops_test?schema=public";
process.env.NEXT_PUBLIC_VERIFICATION_OPS_URL = "http://localhost:3501";

beforeAll(() => {
  // Setup logic
});

afterEach(() => {
  vi.clearAllMocks();
});
