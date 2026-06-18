import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    globals: false,
    include: ['lib/**/*.test.js', 'lib/**/*.spec.js'],
    // سرّ ثابت للاختبارات حتى لا يفشل lib/auth/jwt عند التحميل (يتطلب JWT_SECRET ≥ 16)
    env: {
      JWT_SECRET: process.env.JWT_SECRET || 'test_jwt_secret_value_at_least_32_chars_long',
    },
  },
});
