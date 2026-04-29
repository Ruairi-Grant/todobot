import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    testTimeout: 120_000, // LLM calls can be slow
    include: ["src/__tests__/**/*.test.ts"],
    fileParallelism: false, // tests share tasks.json / todos.json on disk
  },
});
