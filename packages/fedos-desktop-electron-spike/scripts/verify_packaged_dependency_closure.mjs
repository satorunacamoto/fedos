#!/usr/bin/env node
// Commerce Mainline Integration (Agent P) -- standalone CLI form of the
// runtime dependency closure guard also exercised by
// `test/packaged_binary_dependency_closure_guard.test.ts`. Run after
// `npm run package:electron-beta` to independently re-verify the actual
// packaged artifact (`app.asar` + the `extraFiles`-copied
// `dist/node_modules` tree) really contains every npm package the compiled
// code actually requires -- catches the exact silent-omission defect class
// documented in
// `docs/commerce/evidence/commerce_e2e_packaged_binary/packaged_binary_bootstrap_investigation_2026-08-12_agent_x_p1.md`
// even when electron-builder itself exits 0.
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import * as asar from "@electron/asar";
import { checkClosurePresentInAsarListing, checkClosurePresentOnDisk, deriveRuntimeDependencyClosure } from "./lib/packaged_dependency_closure.mjs";

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const PACKAGE_ROOT = path.dirname(SCRIPT_DIR);
const REPO_ROOT = path.resolve(PACKAGE_ROOT, "..", "..");

function main() {
  const repoRootDist = path.join(REPO_ROOT, "dist");
  const packageDist = path.join(PACKAGE_ROOT, "dist");
  const winUnpackedDir = path.join(PACKAGE_ROOT, "dist-package-beta", "win-unpacked");
  const appAsarPath = path.join(winUnpackedDir, "resources", "app.asar");
  const distNodeModulesDir = path.join(winUnpackedDir, "dist", "node_modules");

  for (const [label, p] of [
    ["root-compiled dist/", repoRootDist],
    ["package-compiled dist/", packageDist],
    ["app.asar", appAsarPath],
    ["extraFiles dist/node_modules", distNodeModulesDir],
  ]) {
    if (!existsSync(p)) {
      console.error(`[packaged-dependency-closure] FAILED: ${label} not found at ${p} -- run 'npm run build:beta-runtime && npm run build:electron-spike && npm run package:electron-beta' first.`);
      process.exit(1);
    }
  }

  const { names, unresolved } = deriveRuntimeDependencyClosure({ repoRootDist, packageDist });
  if (unresolved.length > 0) {
    console.error(`[packaged-dependency-closure] FAILED: ${unresolved.length} bare import specifier(s) could not be resolved locally:`);
    for (const u of unresolved) console.error(`  ${u.specifier} (from ${u.fromFile})`);
    process.exit(1);
  }
  console.log(`[packaged-dependency-closure] derived REAL runtime dependency closure (${names.length} packages): ${JSON.stringify(names)}`);

  const asarEntries = asar.listPackage(appAsarPath, { isPack: false });
  const asarResult = checkClosurePresentInAsarListing(asarEntries, names);
  const diskResult = checkClosurePresentOnDisk(distNodeModulesDir, names);

  let ok = true;
  if (!asarResult.ok) {
    ok = false;
    console.error(`[packaged-dependency-closure] FAILED: app.asar is missing: ${JSON.stringify(asarResult.missing)}`);
  }
  if (!diskResult.ok) {
    ok = false;
    console.error(`[packaged-dependency-closure] FAILED: extraFiles dist/node_modules is missing: ${JSON.stringify(diskResult.missing)}`);
  }
  if (!ok) process.exit(1);

  console.log("[packaged-dependency-closure] OK -- every required runtime package is present in both app.asar and the extraFiles dist/node_modules copy.");
}

main();
