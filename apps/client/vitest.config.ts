import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    setupFiles: ['./__tests__/setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        '__tests__/',
        '**/*.config.{js,ts}',
        '**/types/',
        '**/*.d.ts',
      ],
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './'),
      '@/app': path.resolve(__dirname, './app'),
      '@/components': path.resolve(__dirname, './components'),
    },
  },
  projects: [
    {
      // API tests - use node environment
      extends: true,
      test: {
        name: 'api',
        environment: 'node',
        include: ['**/__tests__/api/**/*.{test,spec}.{js,ts}'],
      },
    },
    {
      // Component and hook tests - use jsdom environment
      extends: true,
      test: {
        name: 'components',
        environment: 'jsdom',
        include: [
          '**/__tests__/components/**/*.{test,spec}.{js,ts,tsx}',
          '**/__tests__/hooks/**/*.{test,spec}.{js,ts,tsx}',
        ],
      },
    },
  ],
});

