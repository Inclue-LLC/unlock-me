import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    fileParallelism: false,
    testTimeout: 30000,
    env: {
      DATABASE_URL: process.env.TEST_DATABASE_URL ?? "postgres://unlockme:unlockme@localhost:5432/unlockme_test",
      PAYMENT_PROVIDER: "mock",
      MAIL_PROVIDER: "log",
      APP_URL: "http://localhost:3000",
    },
  },
  resolve: { alias: { "@": path.resolve(__dirname, "src") } },
});
