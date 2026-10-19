import { defineConfig } from "vitest/config";

// Runs only the Firestore rules tests; needs the emulator (see `npm run test:rules`).
export default defineConfig({
  test: {
    include: ["rules-tests/**/*.test.ts"],
    environment: "node",
    fileParallelism: false,
  },
});
