/**
 * Secure Runtime Alpha 8121-8200 — Reproducibility Finding 2 (external
 * clean-checkout audit `73fc0b2`, Category B / Finding T1): ~38 structural-
 * guard test files across this repository assert "no .wasm/target/
 * Cargo.lock artifact is COMMITTED to the package" but historically
 * checked raw filesystem PRESENCE via `import.meta.glob(...)`, which has
 * no awareness of `.gitignore` or git-tracking status. The moment a
 * developer runs this project's own documented `npm run build:wasm`
 * (required to exercise real cryptography), every one of these tests
 * newly reports "committed" for an artifact that was only ever
 * locally-generated and gitignored — a real test-design defect, not a
 * regression (`73fc0b2`'s own finding). This helper returns the SAME
 * kind of relative-path array `import.meta.glob(...)` (globbing the whole
 * package tree) returned (so existing suffix-pattern assertions like
 * `/\.wasm$/i.test(path)`
 * keep working unchanged) but sourced from `git ls-files` — genuine git
 * TRACKING truth, never raw disk presence. A locally-built, gitignored
 * `pkg/fedos_core_rust_bg.wasm` never appears here; a real, deliberately
 * committed fixture would.
 */
// @ts-expect-error `node:child_process` has no type declarations without `@types/node` in this project's root tsconfig (test-only usage, no new dependency) -- mirrors this repo's own established convention (e.g. `test/runtime_wasm_artifact.test.ts`).
import { execFileSync } from "node:child_process";

/**
 * Repo-root-relative paths (matching `git ls-files`'s own output format),
 * each prefixed with `../` to mirror the pre-existing `import.meta.glob`
 * relative-path shape every caller's own regex already expects. No
 * `repoRoot`/`process` parameter needed -- `execFileSync`'s own `cwd`
 * defaults to the current process's working directory (vitest's own repo
 * root), exactly like `import.meta.glob`'s relative paths were already
 * implicitly relative to.
 *
 * `subpath` narrows to a specific tracked directory (e.g. `"src/crypto"`)
 * for the few callers that previously globbed a subdirectory rather than
 * the whole package — mirrors `git ls-files <pathspec>`'s own scoping.
 */
export function fedosCoreRustGitTrackedPaths(subpath?: string): readonly string[] {
  const pathspec = subpath === undefined ? "packages/fedos-core-rust" : `packages/fedos-core-rust/${subpath}`;
  const raw = execFileSync("git", ["ls-files", pathspec], { encoding: "utf8" }) as unknown as string;
  return raw
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .map((line) => `../${line}`);
}
