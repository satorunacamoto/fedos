import { describe, it, expect } from "vitest";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import designDocSource from "../docs/secure_runtime_alpha_210_event_runtime_boundary_completion.md?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import libRsSource from "../packages/fedos-core-rust/src/lib.rs?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import cargoTomlSource from "../packages/fedos-core-rust/Cargo.toml?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import packageJsonSource from "../package.json?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import desktopApplicationSource from "../src/desktop/desktop_application.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import createDesktopApplicationSource from "../src/desktop/create_desktop_application.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import createRuntimeSource from "../src/runtime/create_runtime.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import runtimeTypesSource from "../src/runtime/types.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import workerSource from "../src/worker.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import descriptorSource from "../src/desktop/fedos_event_descriptor.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import readerSource from "../src/desktop/fedos_event_reader.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import nullEventReaderSource from "../src/desktop/null_event_reader.ts?raw";

/**
 * Secure Runtime Alpha 210 -- "Event Runtime Boundary Completion":
 * Stage 10, the closing Stage, of the Nostr Event Runtime Exposure
 * Arc (Alpha 201-210). Adds no further production code. Declares the
 * Arc's own Objective confirmed complete and recommends exactly one
 * next Arc.
 */
describe("Secure Runtime Alpha 210 -- Event Runtime Boundary Completion", () => {
  it("1. the design doc exists and is substantial", () => {
    expect(typeof designDocSource).toBe("string");
    expect(designDocSource.length).toBeGreaterThan(3000);
  });

  it("2. the design doc declares itself REVIEW ONLY, with no further code change", () => {
    expect(designDocSource).toMatch(/this Stage is REVIEW ONLY/);
    expect(designDocSource).toMatch(/it makes NO further code change\s*\nof any kind/);
  });

  it("3. the design doc issues a Completion Declaration naming the Objective CONFIRMED COMPLETE", () => {
    const section = (designDocSource.match(/## 3\. Completion Declaration([\s\S]*?)\n## 4\./) ?? [])[1] ?? "";
    expect(section).toMatch(/\*\*This Arc's own Objective is CONFIRMED COMPLETE,/);
  });

  it("4. the design doc's own Completion Declaration lists all six NOT-yet-existing items", () => {
    const section = (designDocSource.match(/## 3\. Completion Declaration([\s\S]*?)\n## 4\./) ?? [])[1] ?? "";
    for (const item of [
      "**Relay networking, WebSocket, Subscription, Filters**",
      "**A real, non-empty Event data source**",
      "**A `DesktopApplication` method reading through the new boundary**",
      "**Any new `#[wasm_bindgen]` export or `pub fn`**",
      "**Any GUI, Worker integration, Storage, or Observation construct of",
      "**Session/ATProto/Wallet event or record support of any kind**",
    ]) {
      expect(section).toContain(item);
    }
  });

  it("5. the design doc names exactly one recommended next Arc: Nostr Event Wasm Export & Real Reader Implementation", () => {
    const section = (designDocSource.match(/## 3\. Completion Declaration([\s\S]*?)\n## 4\./) ?? [])[1] ?? "";
    expect(section).toMatch(
      /\*\*Nostr Event Wasm Export & Real Reader\s*\nImplementation\.\*\*/,
    );
  });

  it("6. the design doc cross-references all nine prior Stages of this Arc plus Alpha 200", () => {
    for (const ref of [
      "secure_runtime_alpha_209_end_to_end_verification",
      "secure_runtime_alpha_208_session_atproto_compatibility_review",
      "secure_runtime_alpha_207_relay_compatibility_review",
      "secure_runtime_alpha_206_runtime_boundary_review",
      "secure_runtime_alpha_205_event_immutability_review",
      "secure_runtime_alpha_204_event_ownership_review",
      "secure_runtime_alpha_203_null_event_reader_and_desktop_wiring_decision",
      "secure_runtime_alpha_202_desktop_facing_event_reader_abstraction",
      "secure_runtime_alpha_201_event_runtime_exposure_review",
      "secure_runtime_alpha_200_event_foundation_completion",
    ]) {
      expect(designDocSource).toContain(ref);
    }
  });

  // ---------------------------------------------------------------------
  // Structural
  // ---------------------------------------------------------------------

  it("7. structural: the crate's #[wasm_bindgen] count and pub fn count remain fixed at 13/36 across the whole Arc", () => {
    const wasmBindgenCount = [...libRsSource.matchAll(/^#\[wasm_bindgen\]/gm)].length;
    expect(wasmBindgenCount).toBe(19);
    const pubFnNames = [...libRsSource.matchAll(/^\s*pub\s+fn\s+([a-zA-Z0-9_]+)/gm)];
    expect(pubFnNames.length).toBe(69);  });

  it("8. structural: serde_json remains dev-dependencies-only, and package.json's dependency count is unchanged", () => {
    const devDepsSection = (cargoTomlSource.match(/^\[dev-dependencies\]$([\s\S]*)/m) ?? [])[1] ?? "";
    expect(devDepsSection).toMatch(/^serde_json = /m);
    const prodDepsSection = (cargoTomlSource.match(/^\[dependencies\]$([\s\S]*?)^\[dev-dependencies\]$/m) ?? [])[1] ?? "";
    expect(prodDepsSection).not.toMatch(/^serde/m);

    const pkg = JSON.parse(packageJsonSource);
    expect(Object.keys(pkg.dependencies ?? {}).length).toBe(2);
    expect(pkg.bin).toBeUndefined();
  });

  it("9. structural: all three new Desktop-side files exist, exporting exactly one symbol each, none referencing the pub(crate) Rust Event Foundation", () => {
    expect(descriptorSource).toMatch(/export interface FedosEventDescriptor \{/);
    expect(readerSource).toMatch(/export interface FedosEventReader \{/);
    expect(nullEventReaderSource).toMatch(/export class NullEventReader implements FedosEventReader \{/);
    for (const source of [descriptorSource, readerSource, nullEventReaderSource]) {
      const codeOnly = source
        .split("\n")
        .filter((line: string) => !line.trim().startsWith("//") && !line.trim().startsWith("*"))
        .join("\n");
      expect(codeOnly).not.toMatch(/FedosNostrEventHandle/);
    }
  });

  it("10. structural: DesktopApplication's own public method/field set is byte-for-byte unchanged from Alpha 190's own closing state", () => {
    const classBody = (desktopApplicationSource.match(/export class DesktopApplication \{([\s\S]*)\n\}/) ?? [])[1] ?? "";
    const publicMethodNames = [
      ...classBody.matchAll(/^\s{2}(?:async\s+)?(\w+)\([^)]*\)(?::\s*[^{]+)?\s*\{/gm),
    ]
      .map((m: RegExpMatchArray) => m[1] ?? "")
      .filter((name: string) => name !== "constructor");
    expect(new Set(publicMethodNames)).toEqual(
      new Set([
        "bootstrap",
        "start",
        "currentIdentity",
        "isBootstrapped",
        "readPublicIdentity",
        "currentPublicIdentity",
        "refreshPublicIdentity",
      ]),
    );
    const fieldNames = [...classBody.matchAll(/^\s{2}(?:readonly )?#(\w+)(?::|\s*=)/gm)].map((m: RegExpMatchArray) => m[1]);
    expect(fieldNames).toEqual(["identity", "reader", "publicIdentity", "started", "currentPublicIdentity"]);
  });

  // ---------------------------------------------------------------------
  // Regression: the whole Arc's own ten Stages, plus everything else
  // ---------------------------------------------------------------------

  it("11. Regression: desktop_application.ts and create_desktop_application.ts carry no reference to any of the ten Alpha 201-210 docs", () => {
    for (let stage = 201; stage <= 210; stage++) {
      expect(desktopApplicationSource).not.toMatch(new RegExp(`secure_runtime_alpha_${stage}`));
      expect(createDesktopApplicationSource).not.toMatch(new RegExp(`secure_runtime_alpha_${stage}`));
    }
  });

  it("12. Regression: create_runtime.ts/types.ts/worker.ts remain permanently untouched across the whole Arc", () => {
    for (const source of [createRuntimeSource, runtimeTypesSource, workerSource]) {
      for (let stage = 201; stage <= 210; stage++) {
        expect(source).not.toMatch(new RegExp(`secure_runtime_alpha_${stage}`));
      }
    }
  });

  it("13. Regression: package.json and Cargo.toml carry no reference to any of the ten Arc-stage docs -- confirming zero dependency change", () => {
    for (let stage = 201; stage <= 210; stage++) {
      expect(packageJsonSource).not.toMatch(new RegExp(`secure_runtime_alpha_${stage}`));
      expect(cargoTomlSource).not.toMatch(new RegExp(`secure_runtime_alpha_${stage}`));
    }
  });
});
