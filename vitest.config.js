import { defineConfig } from "vitest/config";

// T13 QA — unit + DOM tests (happy-dom + fake-indexeddb). Tanpa jaringan: fetch di-stub gagal (mode "tanpa backend").
export default defineConfig({
  test: {
    environment: "happy-dom",
    setupFiles: ["./tests/setup.js"],
    include: ["tests/**/*.test.js"],
    globals: false,
    restoreMocks: true,
    testTimeout: 10000,
  },
});
