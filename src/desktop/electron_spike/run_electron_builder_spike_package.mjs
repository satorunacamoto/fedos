// Secure Runtime Alpha 3881-3940 -- Phase J packaging safety wrapper.
//
// REAL, OBSERVED BEHAVIOR during this Arc's own development (disclosed
// honestly in this Arc's own Phase K/completion docs, not hidden): running
// `electron-builder` directly against this project's root, with an
// `extraMetadata` override (`main`/`dependencies`) and no separate
// `directories.app` staging copy, left the REAL, on-disk root
// `package.json` mutated in place afterward (missing `scripts`/
// `devDependencies`, an injected spike-only `main` field) -- electron-builder
// did NOT correctly revert its own temporary rewrite in this exact
// version/configuration. Rather than trust that behavior, this wrapper
// explicitly snapshots `package.json` first and restores it byte-for-byte
// afterward, REGARDLESS of whether packaging succeeds or fails. Node-native
// `fs`/`child_process` only, no new dependency.
import { readFileSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const packageJsonPath = fileURLToPath(new URL("../../../package.json", import.meta.url));
const electronBuilderCliPath = fileURLToPath(new URL("../../../node_modules/electron-builder/out/cli/cli.js", import.meta.url));
const originalPackageJson = readFileSync(packageJsonPath, "utf8");

const result = spawnSync(
  process.execPath,
  [electronBuilderCliPath, "--config", "src/desktop/electron_spike/electron_builder.spike.config.json", "--dir"],
  { stdio: "inherit" },
);

writeFileSync(packageJsonPath, originalPackageJson);

process.exit(result.status ?? 1);
