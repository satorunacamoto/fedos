/**
 * Secure Runtime Alpha 3881-3940 -- narrow, hand-written ambient Node
 * declarations (Phase A retrospective finding, Phase C "spike type
 * definitions").
 *
 * REAL, DISCOVERED BLOCKER, honestly documented: this Arc's own Phase A
 * plan originally chose `@types/node` (a standard devDependency) to type
 * the two new `.cts` files' Node CJS globals. Adding it, however, broke
 * `npm run typecheck` REPOSITORY-WIDE -- hundreds of pre-existing
 * `// @ts-expect-error` suppression comments (for `node:fs`/
 * `node:child_process`/etc. imports elsewhere in this repository, which
 * intentionally have no type declarations today) became "Unused
 * '@ts-expect-error' directive" errors, because TypeScript resolves a
 * `node:*` module specifier's OWN per-module declaration file via ordinary
 * module resolution -- a mechanism entirely SEPARATE from, and NOT
 * restricted by, the root `tsconfig.json`'s own `"types": ["@cloudflare/
 * workers-types"]` restriction (which only limits AUTOMATIC GLOBAL AMBIENT
 * package inclusion, not per-import module-declaration resolution). Since
 * `node_modules` is shared repository-wide, this ripple could not be
 * contained to this Arc's own narrow tsconfig -- a real, unacceptable
 * violation of this Arc's own "minimize ripple"/"never touch unrelated
 * layers" instruction. `@types/node` was therefore REMOVED (Phase A
 * reversed, honestly, not silently).
 *
 * This file instead declares ONLY the exact, narrow surface this Arc's own
 * two `.cts` files actually use -- nothing more -- entirely self-contained,
 * zero new dependency, zero effect on any other file's own typecheck
 * behavior (this file is included ONLY by `tsconfig.electron-spike.json`).
 */

declare const __dirname: string;

declare const process: {
  readonly env: Readonly<Record<string, string | undefined>>;
  readonly platform: string;
  readonly versions: Readonly<Record<string, string | undefined>>;
};

declare module "node:path" {
  export function join(...paths: string[]): string;
}
