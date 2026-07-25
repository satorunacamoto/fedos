import { describe, it, expect, afterEach } from "vitest";
// @ts-expect-error `node:fs`/`node:path` have no type declarations without `@types/node` in this project's root tsconfig (test-only usage, no new dependency) -- mirrors this repo's own established convention.
import { writeFileSync, unlinkSync, existsSync, mkdirSync, rmdirSync } from "node:fs";
// @ts-expect-error see above.
import { execFileSync } from "node:child_process";
import { fedosCoreRustGitTrackedPaths } from "./support/fedos_core_rust_git_tracked_paths.js";

declare const process: { cwd(): string };

/**
 * Secure Runtime Alpha 8121-8200 — Reproducibility Finding 2 (external
 * clean-checkout audit `73fc0b2`, Category B / Finding T1): proves
 * `fedosCoreRustGitTrackedPaths()` genuinely distinguishes git TRACKING
 * status from raw filesystem presence, across every state the review
 * asked for: missing, locally-generated-untracked, staged, and clean
 * after cleanup. Real, temporary, throwaway files only — created, then
 * removed from both disk and the index (`git reset` + `unlink`) in
 * `afterEach`, so this test never leaves stray state behind.
 *
 * Two distinct scratch paths are used deliberately: `scratchWasmRelPath`
 * (a real `.wasm` file, genuinely matched by this package's own
 * `.gitignore`, exactly mirroring a real locally-built artifact) for the
 * "untracked" scenario, and `scratchTextRelPath` (a plain, NOT gitignored
 * file) for the "staged" scenario — `git add` on a gitignored path
 * requires `-f` and would test a contrived case a real build artifact
 * never needs, since nothing in this repository's own tooling ever force-
 * adds a gitignored generated artifact.
 */

const scratchWasmRelPath = "packages/fedos-core-rust/.alpha_8121_8200_scratch_artifact.wasm";
const scratchWasmFullPath = `${process.cwd()}/${scratchWasmRelPath}`;
const scratchTextRelPath = "packages/fedos-core-rust/.alpha_8121_8200_scratch_artifact.txt";
const scratchTextFullPath = `${process.cwd()}/${scratchTextRelPath}`;

function cleanupScratchFiles(): void {
  for (const relPath of [scratchWasmRelPath, scratchTextRelPath]) {
    try {
      execFileSync("git", ["reset", "--", relPath], { stdio: "ignore" });
    } catch {
      /* not staged -- fine */
    }
  }
  if (existsSync(scratchWasmFullPath)) unlinkSync(scratchWasmFullPath);
  if (existsSync(scratchTextFullPath)) unlinkSync(scratchTextFullPath);
}

afterEach(() => {
  cleanupScratchFiles();
});

describe("Alpha 8121-8200 -- fedosCoreRustGitTrackedPaths() is genuine git-tracking truth, not raw filesystem presence", () => {
  it("missing: a path that does not exist on disk at all is (trivially) absent from the tracked-paths list", () => {
    const paths = fedosCoreRustGitTrackedPaths();
    expect(paths.some((p) => p.endsWith("/definitely_does_not_exist_anywhere.wasm"))).toBe(false);
  });

  it("locally generated and untracked: a real .wasm file written to disk, genuinely matched by this package's own .gitignore, never appears in the tracked-paths list -- the exact real-world shape of a locally-built pkg/*.wasm artifact", () => {
    writeFileSync(scratchWasmFullPath, "not a real wasm binary, just a throwaway test fixture");
    expect(existsSync(scratchWasmFullPath), "the scratch file must genuinely exist on disk for this test to be meaningful").toBe(true);
    // `git status --porcelain` (without `--ignored`) shows NOTHING for a
    // gitignored untracked path -- confirms this file is genuinely
    // untracked-and-ignored, not merely untracked.
    const status = execFileSync("git", ["status", "--porcelain", "--", scratchWasmRelPath], { encoding: "utf8" }) as unknown as string;
    expect(status.trim(), "a gitignored untracked file shows no porcelain status line at all").toBe("");
    const ignoredStatus = execFileSync("git", ["status", "--porcelain", "--ignored", "--", scratchWasmRelPath], { encoding: "utf8" }) as unknown as string;
    expect(ignoredStatus.trim(), "must show as ignored (!!) when --ignored is passed").toMatch(/^!!/);
    const paths = fedosCoreRustGitTrackedPaths();
    expect(paths.some((p) => p.endsWith("/.alpha_8121_8200_scratch_artifact.wasm"))).toBe(false);
  });

  it("staged: a real (non-gitignored) file, after a genuine `git add`, DOES appear in the tracked-paths list (git ls-files includes the index, not only HEAD)", () => {
    writeFileSync(scratchTextFullPath, "not a real artifact, just a throwaway staged-file test fixture");
    execFileSync("git", ["add", "--", scratchTextRelPath]);
    const status = execFileSync("git", ["status", "--porcelain", "--", scratchTextRelPath], { encoding: "utf8" }) as unknown as string;
    expect(status.trim(), "must show as staged (A )").toMatch(/^A /);
    const paths = fedosCoreRustGitTrackedPaths();
    expect(paths.some((p) => p.endsWith("/.alpha_8121_8200_scratch_artifact.txt")), "a STAGED file is genuine git-tracking-relevant state and must be visible to this check").toBe(true);
  });

  it("clean after cleanup: once unstaged and deleted, the same path disappears from the tracked-paths list again", () => {
    writeFileSync(scratchTextFullPath, "not a real artifact, just a throwaway staged-file test fixture");
    execFileSync("git", ["add", "--", scratchTextRelPath]);
    expect(fedosCoreRustGitTrackedPaths().some((p) => p.endsWith("/.alpha_8121_8200_scratch_artifact.txt"))).toBe(true);
    cleanupScratchFiles();
    expect(existsSync(scratchTextFullPath)).toBe(false);
    const paths = fedosCoreRustGitTrackedPaths();
    expect(paths.some((p) => p.endsWith("/.alpha_8121_8200_scratch_artifact.txt"))).toBe(false);
  });

  it("tracked fixture: a genuinely committed, real file (Cargo.toml, present at HEAD) always appears, regardless of any untracked artifact noise alongside it", () => {
    writeFileSync(scratchWasmFullPath, "untracked noise alongside a real tracked fixture");
    const paths = fedosCoreRustGitTrackedPaths();
    expect(paths.some((p) => p.endsWith("/Cargo.toml"))).toBe(true);
    expect(paths.some((p) => p.endsWith("/.alpha_8121_8200_scratch_artifact.wasm"))).toBe(false);
  });

  it('subpath scoping: fedosCoreRustGitTrackedPaths("src/crypto") returns only tracked paths under that subdirectory, still git-truth not raw presence', () => {
    mkdirSync(`${process.cwd()}/packages/fedos-core-rust/src/crypto/.alpha_scratch_dir`, { recursive: true });
    try {
      const scoped = fedosCoreRustGitTrackedPaths("src/crypto");
      expect(scoped.every((p) => p.includes("/src/crypto/"))).toBe(true);
      expect(scoped.length).toBeGreaterThan(0);
      expect(scoped.some((p) => p.includes(".alpha_scratch_dir"))).toBe(false);
    } finally {
      rmdirSync(`${process.cwd()}/packages/fedos-core-rust/src/crypto/.alpha_scratch_dir`);
    }
  });
});
