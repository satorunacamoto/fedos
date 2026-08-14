/**
 * Commerce Mainline Integration (Agent P) -- durable regression guard for
 * the exact packaging-defect class documented in
 * `docs/commerce/evidence/commerce_e2e_packaged_binary/packaged_binary_bootstrap_investigation_2026-08-12_agent_x_p1.md`
 * (sections 2 and 2b, and its own section 0c disclosure): a REAL
 * `npm run package:electron-beta` can exit `0` while the produced
 * `app.asar` (or the `extraFiles`-copied root-compiled `dist/node_modules`
 * tree) is silently missing a runtime npm dependency the compiled code
 * actually `require()`s/`import`s at module-load time -- because
 * `electron_builder.beta.config.json` sets `npmRebuild: false` and bundles
 * `node_modules/**\/*` verbatim, so packaged completeness is only as good
 * as whatever the shared, multi-worktree-mutated `node_modules` happens to
 * contain at package time, with electron-builder's own exit code blind to
 * the gap (confirmed live, this session: this exact run's own build log
 * printed `cannot find path for dependency` for `@noble/hashes`,
 * `dijkstrajs`, and `pngjs` from electron-builder's internal
 * node-modules-collector step -- yet the artifact still built successfully
 * and, independently re-verified below, DOES contain all three; this test
 * exists precisely because that kind of warning is not reliably
 * fatal-vs-cosmetic and must never be the thing standing between a real
 * gap and a green pipeline).
 *
 * Two things make this a REAL regression guard rather than a restatement
 * of the prior investigation's own conclusion:
 *
 *   1. The required dependency closure is DERIVED, not hand-copied from
 *      the investigation doc's own 5-package list --
 *      `scripts/lib/packaged_dependency_closure.mjs`'s
 *      `closureLib.deriveRuntimeDependencyClosure()` statically walks the ACTUAL
 *      compiled `dist/` require/import graph (root-compiled `dist/` +
 *      this package's own compiled `dist/`), transitively, through every
 *      resolved package's own files -- so if a future change adds or
 *      removes a real runtime dependency, this guard's own notion of
 *      "required" moves with it instead of silently rotting stale.
 *   2. `describe("...negative proof...")` below proves the guard
 *      mechanism actually fails closed: it takes the REAL, just-built
 *      `app.asar` and the REAL `extraFiles`-copied `dist/node_modules`
 *      tree, makes a scratch COPY of each with one required package's
 *      files removed, and asserts the SAME check function this test's own
 *      positive assertions use reports that package missing -- never
 *      mutates the real build output itself (copy-then-corrupt, not
 *      corrupt-then-restore, so there is no window where the real
 *      artifact is broken).
 *
 * Skips itself (mirrors `commerce_e2e_packaged_binary_real_electron.test.ts`'s
 * own `CAN_RUN_REAL` convention) if the packaged win-unpacked build is
 * absent -- run `npm run package:electron-beta` first.
 */
import { afterEach, beforeAll, describe, expect, it } from "vitest";
import { existsSync, mkdtempSync, cpSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import * as asar from "@electron/asar";
// This package's `tsconfig.json` compiles `.ts` test files as CommonJS
// (no `"type": "module"` in `package.json`), but
// `packaged_dependency_closure.mjs` is a real ESM module -- TypeScript
// itself (TS1479) requires a dynamic `import()` rather than a static
// `import` for exactly this cross-module-kind case. `typeof import(...)`
// is a pure type query (never emits a `require()` call), so it types the
// awaited dynamic import below without needing a separate `import type`
// statement (which would itself need a `resolution-mode` attribute here).
let closureLib: typeof import("../scripts/lib/packaged_dependency_closure.mjs", { with: { "resolution-mode": "import" } });
beforeAll(async () => {
  closureLib = await import("../scripts/lib/packaged_dependency_closure.mjs");
});

const repoRoot = process.cwd();
const packageDir = `${repoRoot}/packages/fedos-desktop-electron-spike`;
const winUnpackedDir = `${packageDir}/dist-package-beta/win-unpacked`;
const appAsarPath = `${winUnpackedDir}/resources/app.asar`;
const distNodeModulesDir = `${winUnpackedDir}/dist/node_modules`;
const repoRootDistDir = `${repoRoot}/dist`;
const packageDistDir = `${packageDir}/dist`;

const CAN_RUN_REAL = existsSync(appAsarPath) && existsSync(distNodeModulesDir) && existsSync(repoRootDistDir) && existsSync(packageDistDir);

const realSuite = CAN_RUN_REAL ? describe : describe.skip;
if (!CAN_RUN_REAL) {
  // eslint-disable-next-line no-console
  console.log(
    "packaged_binary_dependency_closure_guard: SKIPPED -- packaged win-unpacked build (app.asar / extraFiles dist/node_modules) or compiled dist/ trees are absent. Run `npm run build:beta-runtime && npm run build:electron-spike && npm run package:electron-beta` first.",
  );
}

const scratchDirs: string[] = [];
function scratchDir(prefix: string): string {
  const dir = mkdtempSync(join(tmpdir(), prefix));
  scratchDirs.push(dir);
  return dir;
}
afterEach(() => {
  while (scratchDirs.length > 0) {
    const dir = scratchDirs.pop()!;
    try {
      rmSync(dir, { recursive: true, force: true });
    } catch {
      /* best-effort cleanup only */
    }
  }
});

realSuite("Packaged Beta binary -- REAL runtime dependency closure guard", () => {
  let closureNames: readonly string[] = [];
  let unresolved: readonly { readonly specifier: string; readonly fromFile: string }[] = [];

  beforeAll(() => {
    const derived = closureLib.deriveRuntimeDependencyClosure({ repoRootDist: repoRootDistDir, packageDist: packageDistDir });
    closureNames = derived.names;
    unresolved = derived.unresolved;
  });

  it("derivation itself is sane: at least the three directly-declared runtime deps are found, and static resolution left nothing unresolved (an unresolved bare specifier would mean this walker -- or the actual build -- has a real gap)", () => {
    expect(unresolved, JSON.stringify(unresolved)).toEqual([]);
    expect(closureNames.length).toBeGreaterThanOrEqual(3);
    for (const mustInclude of ["@noble/curves", "@noble/hashes", "qrcode"]) {
      expect(closureNames, `derived closure: ${JSON.stringify(closureNames)}`).toContain(mustInclude);
    }
    // eslint-disable-next-line no-console
    console.log(`[packaged-dependency-closure-guard] derived REAL runtime dependency closure (${closureNames.length} packages): ${JSON.stringify(closureNames)}`);
  });

  it("every derived package is present inside the REAL, just-built app.asar (node_modules/<pkg>/package.json, listed directly via @electron/asar, never assumed from electron-builder's own exit code)", () => {
    const entries = asar.listPackage(appAsarPath, { isPack: false });
    const result = closureLib.checkClosurePresentInAsarListing(entries, closureNames);
    expect(result.missing, `packages missing from ${appAsarPath}: ${JSON.stringify(result.missing)}`).toEqual([]);
    expect(result.ok).toBe(true);
  });

  it("every derived package is present in the extraFiles-copied dist/node_modules tree (the SEPARATE bundling mechanism the root-compiled dist/ files actually resolve their own imports against -- see the investigation doc's section 2b for why this is a second, independent location that must be checked on its own)", () => {
    const result = closureLib.checkClosurePresentOnDisk(distNodeModulesDir, closureNames);
    expect(result.missing, `packages missing from ${distNodeModulesDir}: ${JSON.stringify(result.missing)}`).toEqual([]);
    expect(result.ok).toBe(true);
  });
});

realSuite("Packaged Beta binary -- REAL local sibling-file packaging closure guard (installed-startup root-cause pass)", () => {
  // Regression guard for a REAL, reproduced packaged-startup crash: the
  // packaged `FedOS Desktop Beta.exe`, launched from its own real
  // `win-unpacked` build, threw `Error: Cannot find module
  // './fedos_electron_ipc_command_registry.js'` from inside `app.asar`
  // (captured via the new early `uncaughtException` handler in
  // `fedos_electron_beta_main.cts`, to a disk log, BEFORE Electron's
  // default opaque native "Error" dialog could hide it -- see
  // `docs/commerce/PACKAGED-BINARY-STARTUP-ERROR-FINDING.md`). Root cause:
  // `electron_builder.beta.config.json`'s `files` allowlist is a
  // hand-maintained list of this package's own compiled `dist/*.js`
  // files, and three had been added to `fedos_electron_beta_main.cts`'s
  // own imports (by the Deletion Request / Identity Transition Ratchet
  // Reset arcs) without the allowlist ever being updated to match --
  // `deriveRuntimeDependencyClosure`'s existing npm-package closure guard
  // above cannot catch this class of gap: `node_modules/**/*` is bundled
  // wholesale, so it was never sensitive to a specific file being listed
  // or not; this package's OWN local `.js` siblings are exactly as
  // hand-maintained as the file that caused the real crash.
  let relativePaths: readonly string[] = [];

  beforeAll(() => {
    // Seeded ONLY from the REAL packaged entry point (`dist/fedos_electron_beta_main.cjs`,
    // the exact file `electron_builder.beta.config.json`'s `extraMetadata.main`
    // names) -- never every compiled file in `packageDistDir`, which would
    // wrongly also walk this package's OTHER, unrelated accepted electron
    // main-process entry points (unlock/badge/settings mains) and demand
    // THEIR local sibling files be packaged too. See this function's own
    // doc comment in `packaged_dependency_closure.mjs` for the full reasoning.
    relativePaths = closureLib.derivePackageLocalFileClosure({
      entryFiles: [join(packageDistDir, "fedos_electron_beta_main.cjs")],
      packageDist: packageDistDir,
    }).relativePaths;
  });

  it("derivation itself is sane: this package's own compiled entry file's real local siblings are found, including the exact three files the real crash was missing", () => {
    expect(relativePaths.length).toBeGreaterThan(0);
    for (const mustInclude of [
      "fedos_electron_ipc_command_registry.js",
      "fedos_electron_deletion_request_send_ipc.js",
      "fedos_electron_identity_transition_ratchet_reset_ipc.js",
    ]) {
      expect(relativePaths, `derived local closure: ${JSON.stringify(relativePaths)}`).toContain(mustInclude);
    }
  });

  it("every derived local sibling file is present inside the REAL, just-built app.asar as dist/<name> (listed directly via @electron/asar, never assumed from electron-builder's own exit code or from the hand-maintained allowlist text itself)", () => {
    const entries = asar.listPackage(appAsarPath, { isPack: false });
    const result = closureLib.checkLocalFileClosurePresentInAsarListing(entries, relativePaths);
    expect(result.missing, `local files missing from ${appAsarPath}: ${JSON.stringify(result.missing)}`).toEqual([]);
    expect(result.ok).toBe(true);
  });

  it("fails closed (negative proof, never mutates the real build output): repacking a COPY of the real app.asar with one required local file stripped out makes the SAME check function report exactly that file missing", async () => {
    expect(relativePaths.length, "negative-proof test needs at least one real required local file to remove").toBeGreaterThan(0);
    const targetRelativePath = relativePaths[0]!;
    const extractDir = scratchDir("fedos-asar-local-corrupt-extract-");
    asar.extractAll(appAsarPath, extractDir);

    const targetFile = join(extractDir, "dist", ...targetRelativePath.split("/"));
    expect(existsSync(targetFile), `expected ${targetFile} to exist before corruption`).toBe(true);
    rmSync(targetFile, { force: true });

    const corruptAsarPath = join(scratchDir("fedos-asar-local-corrupt-out-"), "app.asar");
    await asar.createPackage(extractDir, corruptAsarPath);

    const entries = asar.listPackage(corruptAsarPath, { isPack: false });
    const result = closureLib.checkLocalFileClosurePresentInAsarListing(entries, relativePaths);
    expect(result.ok, "the guard must report FAIL once a required local file is removed from the asar").toBe(false);
    expect(result.missing).toEqual([targetRelativePath]);

    // Sanity: the REAL, untouched app.asar still passes.
    const realEntries = asar.listPackage(appAsarPath, { isPack: false });
    const realResult = closureLib.checkLocalFileClosurePresentInAsarListing(realEntries, relativePaths);
    expect(realResult.ok, "the real, untouched app.asar must be unaffected by the scratch-copy corruption above").toBe(true);
  });
});

realSuite("Packaged Beta binary -- dependency closure guard actually fails closed (negative proof, never mutates the real build output)", () => {
  let closureNames: readonly string[] = [];

  beforeAll(() => {
    closureNames = closureLib.deriveRuntimeDependencyClosure({ repoRootDist: repoRootDistDir, packageDist: packageDistDir }).names;
    expect(closureNames.length, "negative-proof tests need at least one real required package to remove").toBeGreaterThan(0);
  });

  it("app.asar check: repacking a COPY of the real app.asar with one required package's files stripped out makes the SAME check function report exactly that package missing", async () => {
    const targetPackage = closureNames[0]!;
    const extractDir = scratchDir("fedos-asar-corrupt-extract-");
    asar.extractAll(appAsarPath, extractDir);

    const targetDir = join(extractDir, "node_modules", ...targetPackage.split("/"));
    expect(existsSync(targetDir), `expected ${targetDir} to exist before corruption`).toBe(true);
    rmSync(targetDir, { recursive: true, force: true });

    const corruptAsarPath = join(scratchDir("fedos-asar-corrupt-out-"), "app.asar");
    await asar.createPackage(extractDir, corruptAsarPath);

    const entries = asar.listPackage(corruptAsarPath, { isPack: false });
    const result = closureLib.checkClosurePresentInAsarListing(entries, closureNames);
    expect(result.ok, "the guard must report FAIL once a required package's files are removed from the asar").toBe(false);
    expect(result.missing).toEqual([targetPackage]);

    // Sanity: the REAL, untouched app.asar still passes -- proves the
    // corruption above only affected the scratch copy, never the real
    // build artifact under test.
    const realEntries = asar.listPackage(appAsarPath, { isPack: false });
    const realResult = closureLib.checkClosurePresentInAsarListing(realEntries, closureNames);
    expect(realResult.ok, "the real, untouched app.asar must be unaffected by the scratch-copy corruption above").toBe(true);
  });

  it("dist/node_modules check: a COPY of the real extraFiles tree with one required package's directory removed makes the SAME check function report exactly that package missing", () => {
    const targetPackage = closureNames[closureNames.length - 1]!;
    const copyDir = scratchDir("fedos-dist-node-modules-corrupt-");
    cpSync(distNodeModulesDir, copyDir, { recursive: true });

    const targetDir = join(copyDir, ...targetPackage.split("/"));
    expect(existsSync(targetDir), `expected ${targetDir} to exist before corruption`).toBe(true);
    rmSync(targetDir, { recursive: true, force: true });

    const result = closureLib.checkClosurePresentOnDisk(copyDir, closureNames);
    expect(result.ok, "the guard must report FAIL once a required package's directory is removed from the copy").toBe(false);
    expect(result.missing).toEqual([targetPackage]);

    // Sanity: the REAL, untouched dist/node_modules tree still passes.
    const realResult = closureLib.checkClosurePresentOnDisk(distNodeModulesDir, closureNames);
    expect(realResult.ok, "the real, untouched extraFiles dist/node_modules tree must be unaffected by the scratch-copy corruption above").toBe(true);
  });

  it("a package name that was never in the closure at all is correctly reported present-or-absent independent of the real packages -- guards against the check function trivially reporting ok:true regardless of input", () => {
    const entries = asar.listPackage(appAsarPath, { isPack: false });
    const bogusResult = closureLib.checkClosurePresentInAsarListing(entries, [...closureNames, "this-package-does-not-exist-anywhere"]);
    expect(bogusResult.ok).toBe(false);
    expect(bogusResult.missing).toEqual(["this-package-does-not-exist-anywhere"]);

    const diskBogusResult = closureLib.checkClosurePresentOnDisk(distNodeModulesDir, [...closureNames, "this-package-does-not-exist-anywhere"]);
    expect(diskBogusResult.ok).toBe(false);
    expect(diskBogusResult.missing).toEqual(["this-package-does-not-exist-anywhere"]);
  });
});
