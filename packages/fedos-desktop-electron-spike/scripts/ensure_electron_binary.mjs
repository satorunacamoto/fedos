#!/usr/bin/env node
// Secure Runtime Alpha 8121-8200 -- real, disclosed clean-checkout
// reproducibility gap found live this session: `npm install` in this
// package does NOT reliably trigger the `electron` npm package's own
// internal postinstall binary download in every environment (observed:
// silent no-op, no error, no warning -- `npm install` exits 0 with the
// real electron.exe simply absent). This script makes that step
// explicit, deterministic, and idempotent (a no-op if the real binary
// is already present) rather than relying on an implicit, sometimes-
// silently-skipped transitive postinstall hook.
import { existsSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const packageRoot = join(here, "..");
const electronExe = process.platform === "win32" ? "electron.exe" : "electron";
const electronBinPath = join(packageRoot, "node_modules", "electron", "dist", electronExe);
const installScript = join(packageRoot, "node_modules", "electron", "install.js");

if (existsSync(electronBinPath)) {
  console.log(`[ensure-electron-binary] real electron binary already present: ${electronBinPath}`);
  process.exit(0);
}

if (!existsSync(installScript)) {
  console.error("[ensure-electron-binary] node_modules/electron/install.js not found -- run `npm install` in this package first.");
  process.exit(1);
}

console.log("[ensure-electron-binary] real electron binary was NOT installed by `npm install`'s own postinstall step (a known, disclosed environment-dependent gap) -- running node_modules/electron/install.js explicitly.");
execFileSync(process.execPath, [installScript], { cwd: packageRoot, stdio: "inherit" });

if (!existsSync(electronBinPath)) {
  console.error("[ensure-electron-binary] electron/install.js completed but the real binary still is not present -- check network access and re-run.");
  process.exit(1);
}
console.log(`[ensure-electron-binary] real electron binary now present: ${electronBinPath}`);
