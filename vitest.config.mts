import { fileURLToPath } from "node:url";
import { config } from "dotenv";
import { defineConfig } from "vitest/config";

// TEST_DATABASE_URL for the Postgres repository and account tests (see .env.test.example).
config({ path: ".env.test.local", quiet: true });

export default defineConfig({
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  test: {
    include: ["src/**/*.test.ts", "e2e/**/*.test.ts"],
    // Migrates and empties the test database once, before any test file.
    globalSetup: ["src/test/database-setup.ts"],
  },
});
