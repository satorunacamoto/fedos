import { defineConfig } from "vitest/config";

/**
 * Secure Runtime Alpha 4021-4100 -- a SEPARATE vitest config, scoped ONLY to
 * `packages/fedos-desktop-electron-spike/test/`. Deliberately NOT merged
 * into the main `vitest.config.ts`'s own `include` (`test/**\/*.test.ts`,
 * unchanged) -- ordinary `npm test` must never discover or launch these
 * Electron-spawning tests. Reuses this repository's own already-installed
 * `vitest` (no new dependency); only the include scope differs.
 */
export default defineConfig({
  test: {
    environment: "node",
    include: ["packages/fedos-desktop-electron-spike/test/**/*.test.ts"],
  },
});
