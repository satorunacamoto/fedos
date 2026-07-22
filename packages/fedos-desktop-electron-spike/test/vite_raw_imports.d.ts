/**
 * Secure Runtime Alpha 4021-4100 -- narrow, test-only ambient declaration for
 * Vite's `?raw` asset-import suffix (used by this package's own test file
 * to read source/config files as plain text). The root project's own test
 * files instead use a per-import `@ts-expect-error` comment for this same
 * pattern (no ambient declaration exists there) -- this package, having its
 * OWN independent tsconfig, declares it once, narrowly, here instead.
 */

declare module "*?raw" {
  const content: string;
  export default content;
}
