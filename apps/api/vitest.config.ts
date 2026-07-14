import { configDefaults, defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // `pnpm build` emits compiled test files under dist. Vitest must execute
    // the TypeScript source tests once, rather than rediscovering those CJS copies.
    exclude: [...configDefaults.exclude, "dist/**"],
  },
});
