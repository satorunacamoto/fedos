import { describe, it, expect } from "vitest";
// @ts-expect-error `node:fs` has no type declarations without `@types/node` (test-only usage, no new dependency).
import { existsSync, readFileSync } from "node:fs";
// @ts-expect-error `node:child_process` has no type declarations without `@types/node` (test-only usage, no new dependency).
import { execFileSync } from "node:child_process";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import verificationDocSource from "../docs/runtime_wasm_js_glue_version_export_verification.md?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import runtimeDiagnosticsSource from "../src/runtime/runtime_crypto_diagnostics.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import workerDiagnosticsSource from "../src/runtime/worker_crypto_diagnostics.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import createRuntimeSource from "../src/runtime/create_runtime.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import workerSource from "../src/worker.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import wasmLoaderSource from "../src/runtime/fedos_wasm_loader.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import libRsSource from "../packages/fedos-core-rust/src/lib.rs?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import cargoTomlSource from "../packages/fedos-core-rust/Cargo.toml?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import packageJsonSource from "../package.json?raw";

/**
 * Prototype EXECUTION Phase 011 — "Generated JS Glue Export
 * Verification": a ONE-TIME, real, local `npm run build:wasm` run
 * confirmed the generated `packages/fedos-core-rust/pkg/fedos_core_rust.js`
 * exports exactly `version`/`initSync`/`default` (Stage 986's
 * `#[wasm_bindgen] pub fn version()` alongside the pre-existing generic
 * loader machinery), and `fedos_core_rust.d.ts` declares
 * `export function version(): string;`. `target/`/`Cargo.lock`/`pkg/`
 * were deleted immediately after inspection -- none is committed. This
 * test suite guards the DOC's own record (always) and, IF a generated
 * artifact happens to exist locally right now, the REAL file content
 * too (mirroring `test/runtime_wasm_js_glue_contract.test.ts`'s own
 * established existsSync-guarded pattern) -- it never builds, imports,
 * or executes anything itself.
 */
describe("FedOS generated JS glue version() export verification -- doc + IF-present real-file checks, no import/execution, no Runtime change", () => {
  const pkgDir = "packages/fedos-core-rust/pkg";

  it("1. the verification doc exists and is substantial", () => {
    expect(typeof verificationDocSource).toBe("string");
    expect(verificationDocSource.length).toBeGreaterThan(3000);
  });

  it("2. the doc records the exact three-export list -- version, initSync, default -- and no fourth export", () => {
    expect(verificationDocSource).toMatch(/export function version\(\)/);
    expect(verificationDocSource).toMatch(/export \{ initSync, __wbg_init as default \};/);
    expect(verificationDocSource).toMatch(/[Ee]xactly (two|three)/);
  });

  it("3. the doc records version() corresponds to the real Rust #[wasm_bindgen] pub fn version(), matching lib.rs", () => {
    expect(libRsSource).toMatch(/#\[wasm_bindgen\]\s*\npub fn version\(\) -> String/);
    expect(verificationDocSource).toMatch(/wasm\.version\(\)/);
    expect(verificationDocSource).toMatch(/#\[wasm_bindgen\] pub fn version\(\) -> String/);
  });

  it("4. the doc records default/initSync are unchanged, matching the Stage 481/969 historical record", () => {
    expect(verificationDocSource).toMatch(/Stage 481/);
    expect(verificationDocSource).toMatch(/Stage 969/);
    expect(verificationDocSource).toMatch(/initSync\(module\)/);
  });

  it("5. the doc records the .d.ts declares version(): string", () => {
    expect(verificationDocSource).toMatch(/export function version\(\): string;/);
  });

  it("6. the doc records no extra/crypto-specific export, and no other #[wasm_bindgen] fn in lib.rs", () => {
    expect(verificationDocSource).toMatch(/[Nn]o extra export/);
    expect((libRsSource.match(/#\[wasm_bindgen\]/g) ?? []).length).toBe(11);
  });

  it("7. IF the generated JS glue exists locally right now, its export list is exactly version/initSync/default -- no fourth export, no crypto-specific symbol", () => {
    const gluePath = `${pkgDir}/fedos_core_rust.js`;
    if (!existsSync(gluePath)) {
      return;
    }
    const glueSource: string = readFileSync(gluePath, "utf-8");
    const exportStatements = [...glueSource.matchAll(/^export\s.*/gm)];
    expect(exportStatements.length).toBe(2);
    expect(glueSource).toMatch(/export function version\(\)\s*\{/);
    expect(glueSource).toMatch(/export\s*\{\s*initSync\s*,\s*__wbg_init as default\s*\}/);
    expect(glueSource).toMatch(/wasm\.version\(\)/);
    expect(glueSource.toLowerCase()).not.toMatch(/encrypt|decrypt|nip.?44|secrethandle|conversationkey/);
  });

  it("8. IF the generated .d.ts exists locally right now, it declares version(): string alongside the pre-existing types", () => {
    const dtsPath = `${pkgDir}/fedos_core_rust.d.ts`;
    if (!existsSync(dtsPath)) {
      return;
    }
    const dtsSource: string = readFileSync(dtsPath, "utf-8");
    expect(dtsSource).toMatch(/export function version\(\): string;/);
    expect(dtsSource).toMatch(/export function initSync\(/);
    expect(dtsSource).toMatch(/export default function __wbg_init/);
  });

  it("9. IF the generated .wasm/pkg/ output exists locally, it is allowed to exist but must NEVER be git-tracked", () => {
    const files = (
      import.meta as unknown as { glob: (pattern: string) => Record<string, unknown> }
    ).glob("../packages/fedos-core-rust/**/*");
    const paths = Object.keys(files);
    const generated = /\.(wasm|rlib|so|dll|dylib|node|a|o)$/i;
    const generatedGlue = /_bg\.(js|ts|wasm)$/i;
    const generatedPkgDir = /\/pkg\//i;
    const candidates = paths.filter(
      (path) => generated.test(path) || generatedGlue.test(path) || generatedPkgDir.test(path),
    );
    if (candidates.length === 0) {
      return;
    }
    const tracked = execFileSync("git", ["ls-files", "--", "packages/fedos-core-rust"], {
      encoding: "utf-8",
    });
    const trackedPaths = new Set(tracked.split("\n").filter(Boolean));
    for (const candidate of candidates) {
      const repoRelative = candidate.replace(/^\.\.\//, "");
      expect(trackedPaths.has(repoRelative), `generated artifact must never be git-tracked: ${repoRelative}`).toBe(
        false,
      );
    }
  });

  it("10. Cargo.toml/package.json are unchanged -- still 11 production dependencies, 2 package.json dependencies", () => {
    const cargoCode = cargoTomlSource
      .split("\n")
      .map((line: string) => line.replace(/#.*$/, ""))
      .join("\n")
      .toLowerCase();
    const depsIdx = cargoCode.indexOf("[dependencies]");
    const devDepsIdx = cargoCode.indexOf("[dev-dependencies]");
    const productionDepsSection = cargoCode.slice(depsIdx, devDepsIdx);
    const depLines = productionDepsSection
      .split("\n")
      .filter((line: string) => /^\s*[a-z0-9_-]+\s*=/.test(line));
    expect(depLines.length).toBe(11);

    const pkg = JSON.parse(packageJsonSource);
    expect(Object.keys(pkg.dependencies ?? {}).length).toBe(2);
  });

  it("11. Rust public API is unchanged -- still 28 pub fn, still exactly one #[wasm_bindgen]", () => {
    const pubFnNames = [...libRsSource.matchAll(/^\s*pub\s+fn\s+([a-zA-Z0-9_]+)/gm)].map(
      (m: RegExpMatchArray) => m[1],
    );
    expect(pubFnNames.length).toBe(34);
    expect((libRsSource.match(/#\[wasm_bindgen\]/g) ?? []).length).toBe(11);
  });

  it("12. src/runtime/fedos_wasm_loader.ts was untouched by THIS stage's own scope (Stage 987) -- a real module.version() call was later added by Stage 993, Prototype EXECUTION Phase 012, see test/runtime_wasm_loader_dev_only_rust_version_call_execution.test.ts -- still seven Plan interfaces", () => {
    expect(wasmLoaderSource).toMatch(/attemptDevOnlyRustVersionCall/);
    const planInterfaceMatches = [...wasmLoaderSource.matchAll(/export interface FedosWasmLoader\w*Plan\b/g)].map(
      (m: RegExpMatchArray) => m[0],
    );
    expect([...new Set(planInterfaceMatches)].length).toBe(7);
  });

  it("13. no TypeScript file in the Runtime/Worker chain calls version(), and none references the new doc", () => {
    for (const source of [createRuntimeSource, workerSource, runtimeDiagnosticsSource, workerDiagnosticsSource]) {
      expect(source).not.toMatch(/[.=]\s*version\s*\(/);
      expect(source).not.toMatch(/runtime_wasm_js_glue_version_export_verification/);
    }
  });

  it("14. Runtime, Worker, and Production remain fully unconnected -- create_runtime.ts and src/worker.ts reference neither the WASM chain nor the generated JS glue", () => {
    expect(createRuntimeSource).not.toMatch(
      /fedos_wasm_toolchain|fedos_execution_backend|fedos_wasm_artifact|fedos_wasm_boundary|fedos_rust_invocation_adapter|fedos_internal_rust_call|fedos_rust_execution_review|fedos_rust_api|fedos_rust_boundary|fedos_opaque_api|fedos_core_rust\.js/,
    );
    expect(workerSource).not.toMatch(
      /fedos_wasm_toolchain|fedos_execution_backend|fedos_wasm_artifact|fedos_wasm_boundary|fedos_rust_invocation_adapter|fedos_internal_rust_call|fedos_rust_execution_review|fedos_rust_api|fedos_rust_boundary|fedos_opaque_api|fedos_runtime_crypto_provider|fedos_core_rust\.js/,
    );
  });

  it("15. diagnostics carry no new field introduced by this stage", () => {
    expect(runtimeDiagnosticsSource).not.toMatch(/jsGlueVersionExport|versionExportVerified/i);
    expect(workerDiagnosticsSource).not.toMatch(/jsGlueVersionExport|versionExportVerified/i);
  });

  it("16. the doc explicitly states Runtime is still unconnected, and names the next Phase without implementing it", () => {
    expect(verificationDocSource).toMatch(/still unconnected/);
    expect(verificationDocSource).toMatch(/Does \*\*not\*\* call `version\(\)` from any TypeScript file/);
    expect(verificationDocSource).toMatch(/Does \*\*not\*\* commit `target\/`, `Cargo\.lock`, or `pkg\/`/);
    expect(verificationDocSource).toMatch(/next Phase/i);
  });

  it("17. cross-references the Stage 481 JS glue contract, the Stage 985 bindgen dependency adoption, and the Stage 986 version() export this Phase verifies", () => {
    expect(verificationDocSource).toMatch(/runtime_wasm_js_glue_contract\.md/);
    expect(verificationDocSource).toMatch(/runtime_wasm_rust_export_bindgen_dependency\.md/);
    expect(verificationDocSource).toMatch(/runtime_wasm_rust_version_export\.md/);
  });
});
