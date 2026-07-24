// Secure Runtime Alpha 3881-3940/4021-4100 -- packaging safety wrapper.
//
// REAL, OBSERVED BEHAVIOR during this Arc's own development (disclosed
// honestly in this Arc's own docs, not hidden): running `electron-builder`
// directly, with an `extraMetadata` override (`main`/`dependencies`) and no
// separate `directories.app` staging copy, left the REAL, on-disk
// `package.json` it ran against mutated in place afterward (missing
// `scripts`/`devDependencies`, an injected spike-only `main` field) --
// electron-builder did NOT correctly revert its own temporary rewrite in
// this exact version/configuration. Rather than trust that behavior, this
// wrapper explicitly snapshots THIS PACKAGE's own `package.json` first and
// restores it byte-for-byte afterward, REGARDLESS of whether packaging
// succeeds or fails. Node-native `fs`/`child_process` only, no new
// dependency.
//
// This package's own `package.json` is the one at risk now (not the root
// project's) -- exactly the isolation this Arc's own architecture provides:
// even a repeat of this same electron-builder bug can never again reach the
// root project's own `package.json`.
import { readFileSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const packageJsonPath = fileURLToPath(new URL("../package.json", import.meta.url));
const electronBuilderCliPath = fileURLToPath(new URL("../node_modules/electron-builder/out/cli/cli.js", import.meta.url));
const originalPackageJson = readFileSync(packageJsonPath, "utf8");

const result = spawnSync(process.execPath, [electronBuilderCliPath, "--config", "electron_builder.config.json", "--dir"], { stdio: "inherit" });

writeFileSync(packageJsonPath, originalPackageJson);

process.exit(result.status ?? 1);
