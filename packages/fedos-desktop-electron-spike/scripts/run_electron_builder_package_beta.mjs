// Secure Runtime Alpha 5061-5160 -- Beta packaging safety wrapper. Identical
// discipline to `run_electron_builder_package.mjs` (Alpha 3881-3940/4021-4100,
// UNMODIFIED, still used by `npm run package` for the spike entry point) --
// snapshots and restores THIS package's own `package.json` byte-for-byte
// regardless of packaging outcome, since electron-builder's own
// `extraMetadata` override has been observed (in that Arc's own dev history)
// to mutate the on-disk `package.json` in place. A separate, additive script
// rather than parameterizing the existing one, per this Arc's own
// "adapter over replacement, minimize ripple" discipline -- the Alpha
// 3881-3940 script is an accepted, unmodified surface.
import { readFileSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const packageJsonPath = fileURLToPath(new URL("../package.json", import.meta.url));
const electronBuilderCliPath = fileURLToPath(new URL("../node_modules/electron-builder/out/cli/cli.js", import.meta.url));
const originalPackageJson = readFileSync(packageJsonPath, "utf8");

const result = spawnSync(process.execPath, [electronBuilderCliPath, "--config", "electron_builder.beta.config.json", "--dir"], { stdio: "inherit" });

writeFileSync(packageJsonPath, originalPackageJson);

process.exit(result.status ?? 1);
