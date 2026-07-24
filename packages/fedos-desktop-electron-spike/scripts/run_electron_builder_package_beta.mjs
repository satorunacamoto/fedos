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
//
// Secure Runtime Alpha 5241-5320 -- ONE proven fix: the CLI invocation used
// to hardcode a `--dir` flag (an electron-builder CLI TARGET SHORTHAND
// meaning "build the unpacked dir target", equivalent to `--win dir`) --
// harmless while `electron_builder.beta.config.json`'s own `win.target` was
// ALSO `["dir"]` (Alpha 5061-5160/5161-5240's own accepted state), but once
// this Arc changed that config to `["nsis", "zip"]` (Phase C/D), the
// hardcoded `--dir` CLI flag silently overrode it, forcing electron-builder
// to skip both real targets with exit code 0 and no error -- reproduced
// directly this session (isolated via a temporary config + manual CLI
// invocation, see the reconciliation report's own Phase A). Fixed here by
// replacing the CLI target override with a platform-only flag (`--win`),
// letting the config file's own `win.target` be the SOLE target authority
// -- exactly what every other invocation in this package already assumes.
import { readFileSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const packageJsonPath = fileURLToPath(new URL("../package.json", import.meta.url));
const electronBuilderCliPath = fileURLToPath(new URL("../node_modules/electron-builder/out/cli/cli.js", import.meta.url));
const originalPackageJson = readFileSync(packageJsonPath, "utf8");

const result = spawnSync(process.execPath, [electronBuilderCliPath, "--config", "electron_builder.beta.config.json", "--win"], { stdio: "inherit" });

writeFileSync(packageJsonPath, originalPackageJson);

process.exit(result.status ?? 1);
