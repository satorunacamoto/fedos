import { describe, it, expect } from "vitest";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import designDocSource from "../docs/secure_runtime_alpha_201_event_runtime_exposure_review.md?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import libRsSource from "../packages/fedos-core-rust/src/lib.rs?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import cargoTomlSource from "../packages/fedos-core-rust/Cargo.toml?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import packageJsonSource from "../package.json?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import desktopApplicationSource from "../src/os/messenger/desktop/desktop_application.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import createDesktopApplicationSource from "../src/os/messenger/desktop/create_desktop_application.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import createRuntimeSource from "../src/os/_legacy_prototype/runtime/create_runtime.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import runtimeTypesSource from "../src/os/_legacy_prototype/runtime/types.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import workerSource from "../src/os/_legacy_prototype/worker.ts?raw";

/**
 * Secure Runtime Alpha 201 -- "Nostr Event Runtime Exposure Review":
 * Stage 1 of the Nostr Event Runtime Exposure Arc (Alpha 201-210).
 * Decision-only: adopts a Desktop-facing, TypeScript-only Reader
 * boundary (mirroring the Alpha 101 Public Identity Reader precedent)
 * over extending the Rust wasm surface. No code change.
 */
describe("Secure Runtime Alpha 201 -- Nostr Event Runtime Exposure Review", () => {
  it("1. the design doc exists and is substantial", () => {
    expect(typeof designDocSource).toBe("string");
    expect(designDocSource.length).toBeGreaterThan(2000);
  });

  it("2. the design doc declares itself DESIGN / DECISION ONLY, with no code change", () => {
    expect(designDocSource).toMatch(/this Stage is DESIGN \/ DECISION ONLY/);
    expect(designDocSource).toMatch(/It makes NO code\s*\nchange of any kind/);
  });

  it("3. the design doc's own Decision section names exactly three new files, all under src/desktop/", () => {
    const section = (designDocSource.match(/## 5\. Decision([\s\S]*?)\n## 6\./) ?? [])[1] ?? "";
    expect(section).toContain("`fedos_event_descriptor.ts`");
    expect(section).toContain("`fedos_event_reader.ts`");
    expect(section).toContain("`null_event_reader.ts`");
    expect(section).toMatch(/No `packages\/fedos-core-rust\/src\/lib\.rs` change/);
  });

  it("4. the design doc rejects extending the Rust wasm surface (Candidate A) and adopts a TypeScript-only boundary (Candidate B)", () => {
    expect(designDocSource).toMatch(/REJECTED\s*\n\s*for this Arc/);
    expect(designDocSource).toMatch(/ADOPTED for this Arc/);
  });

  it("5. the design doc names DesktopApplication's own frozen state since Alpha 136 and defers the wiring decision to Alpha 203", () => {
    const section = (designDocSource.match(/## 4\. Whether `DesktopApplication`([\s\S]*?)\n## 5\./) ?? [])[1] ?? "";
    expect(section).toMatch(/byte-for-byte frozen since Alpha 136/);
    expect(section).toMatch(/Alpha 203 does/);
  });

  it("6. the design doc cross-references Alpha 200, Alpha 198, Alpha 101, Alpha 104, and Alpha 136", () => {
    for (const ref of [
      "secure_runtime_alpha_200_event_foundation_completion",
      "secure_runtime_alpha_198_event_runtime_boundary_review",
      "secure_runtime_alpha_101_public_identity_reader_interface",
      "secure_runtime_alpha_104_null_reader",
      "secure_runtime_alpha_136_startup_sequence",
    ]) {
      expect(designDocSource).toContain(ref);
    }
  });

  // ---------------------------------------------------------------------
  // Structural: confirmed zero code change
  // ---------------------------------------------------------------------

  it("7. structural: no #[wasm_bindgen] export or pub fn count change -- still fixed at 13/36", () => {
    const wasmBindgenCount = [...libRsSource.matchAll(/^#\[wasm_bindgen\]/gm)].length;
    expect(wasmBindgenCount).toBe(19);
    const pubFnNames = [...libRsSource.matchAll(/^\s*pub\s+fn\s+([a-zA-Z0-9_]+)/gm)];
    expect(pubFnNames.length).toBe(69);  });

  it("8. structural: Cargo.toml carries no reference to this Stage's own doc, and dependency sets are unchanged", () => {
    expect(cargoTomlSource).not.toMatch(/secure_runtime_alpha_201/);
  });

  it("9. structural: package.json carries no reference to this Stage's own doc", () => {
    expect(packageJsonSource).not.toMatch(/secure_runtime_alpha_201/);
  });

  it("10. Regression: desktop_application.ts and create_desktop_application.ts carry no reference to this Stage's own doc", () => {
    expect(desktopApplicationSource).not.toMatch(/secure_runtime_alpha_201/);
    expect(createDesktopApplicationSource).not.toMatch(/secure_runtime_alpha_201/);
  });

  it("11. Regression: create_runtime.ts/types.ts/worker.ts carry no reference to this Stage's own doc", () => {
    for (const source of [createRuntimeSource, runtimeTypesSource, workerSource]) {
      expect(source).not.toMatch(/secure_runtime_alpha_201/);
    }
  });
});
