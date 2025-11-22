/**
 * Vitest Setup File
 * Global test setup and configuration
 */

import { expect, afterEach, vi } from 'vitest';
import { cleanup } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

// Cleanup after each test
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

// Mock environment variables for tests
process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'test-anon-key';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-role-key';
process.env.STRIPE_SECRET_KEY = 'sk_test_mock123';
process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY = 'pk_test_mock123';
process.env.STRIPE_WEBHOOK_SECRET = 'whsec_test_mock123';
process.env.NEXT_PUBLIC_STRIPE_BASIC_PRICE_ID = 'price_test_basic_mock';
process.env.NEXT_PUBLIC_STRIPE_PREMIUM_PRICE_ID = 'price_test_premium_mock';
process.env.NEXT_PUBLIC_APP_URL = 'http://localhost:3000';

// Extend expect matchers if needed
expect.extend({
  // Custom matchers can be added here
});

// Global mocks for Next.js
vi.mock('next/navigation', () => ({
  useRouter: vi.fn(() => ({
    push: vi.fn(),
    replace: vi.fn(),
    prefetch: vi.fn(),
    back: vi.fn(),
  })),
  usePathname: vi.fn(() => '/'),
  useSearchParams: vi.fn(() => new URLSearchParams()),
}));
