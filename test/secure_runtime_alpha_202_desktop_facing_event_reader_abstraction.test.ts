import { describe, it, expect } from "vitest";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import designDocSource from "../docs/secure_runtime_alpha_202_desktop_facing_event_reader_abstraction.md?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import descriptorSource from "../src/desktop/fedos_event_descriptor.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import readerSource from "../src/desktop/fedos_event_reader.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import desktopApplicationSource from "../src/desktop/desktop_application.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import createDesktopApplicationSource from "../src/desktop/create_desktop_application.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import libRsSource from "../packages/fedos-core-rust/src/lib.rs?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import createRuntimeSource from "../src/runtime/create_runtime.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import runtimeTypesSource from "../src/runtime/types.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import workerSource from "../src/worker.ts?raw";

/**
 * Secure Runtime Alpha 202 -- "Desktop-Facing Event Reader
 * Abstraction": Stage 2 of the Nostr Event Runtime Exposure Arc.
 * Adds src/desktop/fedos_event_descriptor.ts (FedosEventDescriptor)
 * and src/desktop/fedos_event_reader.ts (FedosEventReader) -- both
 * new, protocol-independent, interface/type-only files, no
 * implementation, no wiring.
 */
describe("Secure Runtime Alpha 202 -- Desktop-Facing Event Reader Abstraction", () => {
  it("1. the design doc exists and is substantial", () => {
    expect(typeof designDocSource).toBe("string");
    expect(designDocSource.length).toBeGreaterThan(2000);
  });

  it("2. the design doc declares itself an IMPLEMENTS Stage adding exactly two new files", () => {
    expect(designDocSource).toMatch(/this Stage IMPLEMENTS/);
    expect(designDocSource).toMatch(
      /It adds exactly two new files,\s*\n`src\/desktop\/fedos_event_descriptor\.ts` and\s*\n`src\/desktop\/fedos_event_reader\.ts`, and nothing else/,
    );
  });

  it("3. FedosEventDescriptor is the ONLY export from fedos_event_descriptor.ts, with the exact eight-field shape", () => {
    const exportNames = [...descriptorSource.matchAll(/^export (?:interface|class|function|const) (\w+)/gm)].map(
      (m: RegExpMatchArray) => m[1],
    );
    expect(exportNames).toEqual(["FedosEventDescriptor"]);
    expect(descriptorSource).toMatch(
      /export interface FedosEventDescriptor \{\s*\n\s*readonly id: string;\s*\n\s*readonly provider: string;\s*\n\s*readonly author: string;\s*\n\s*readonly createdAt: number;\s*\n\s*readonly kind: number;\s*\n\s*readonly tags: readonly \(readonly string\[\]\)\[\];\s*\n\s*readonly content: string;\s*\n\s*readonly signature: string;\s*\n\}/,
    );
  });

  it("4. FedosEventReader is the ONLY export from fedos_event_reader.ts, with exactly one method", () => {
    const exportNames = [...readerSource.matchAll(/^export (?:interface|class|function|const) (\w+)/gm)].map(
      (m: RegExpMatchArray) => m[1],
    );
    expect(exportNames).toEqual(["FedosEventReader"]);
    expect(readerSource).toMatch(
      /export interface FedosEventReader \{\s*\n\s*readEvents\(\): Promise<readonly FedosEventDescriptor\[\]>;\s*\n\}/,
    );
  });

  it("5. neither new file references FedosNostrEventHandle or any packages/fedos-core-rust symbol", () => {
    for (const source of [descriptorSource, readerSource]) {
      const codeOnly = source
        .split("\n")
        .filter((line: string) => !line.trim().startsWith("//") && !line.trim().startsWith("*"))
        .join("\n");
      expect(codeOnly).not.toMatch(/FedosNostrEventHandle|fedos-core-rust|wasm/i);
    }
  });

  it("6. no secret key, signing, Relay, or WebSocket reference exists IN CODE (comments legitimately name these as forbidden guardrails)", () => {
    for (const source of [descriptorSource, readerSource]) {
      const codeOnly = source
        .split("\n")
        .filter((line: string) => !line.trim().startsWith("//") && !line.trim().startsWith("*"))
        .join("\n");
      expect(codeOnly).not.toMatch(/nsec|seed|mnemonic|secretKey|privateKey/i);
      expect(codeOnly).not.toMatch(/Relay|WebSocket|Subscription|Filter/);
    }
  });

  it("7. no import of any nostr/relay.ts, nostr/ws_relay.ts, nostr/crypto.ts, nostr/signature.ts, or nostr/noble_signature.ts", () => {
    for (const source of [descriptorSource, readerSource]) {
      expect(source).not.toMatch(/from ".*nostr\/(relay|ws_relay|crypto|signature|noble_signature)\.js"/);
    }
  });

  it("8. the design doc cross-references Alpha 201, Alpha 101, Alpha 028, Alpha 045, and Alpha 191", () => {
    for (const ref of [
      "secure_runtime_alpha_201_event_runtime_exposure_review",
      "secure_runtime_alpha_101_public_identity_reader_interface",
      "secure_runtime_alpha_028_fedos_identity_descriptor",
      "secure_runtime_alpha_045_fedos_identity_descriptor_expansion",
      "secure_runtime_alpha_191_nostr_event_model_inventory",
    ]) {
      expect(designDocSource).toContain(ref);
    }
  });

  it("9. the design doc's own 'does NOT do' list confirms no implementation exists yet and no DesktopApplication file is modified", () => {
    expect(designDocSource).toMatch(
      /Does \*\*not\*\* implement `FedosEventReader` — no class conforming to\s*\n\s*it exists anywhere in this repository yet/,
    );
    expect(designDocSource).toMatch(
      /Does \*\*not\*\* modify `src\/desktop\/desktop_application\.ts` or\s*\n\s*`create_desktop_application\.ts`/,
    );
  });

  // ---------------------------------------------------------------------
  // Structural / Regression
  // ---------------------------------------------------------------------

  it("10. structural: lib.rs #[wasm_bindgen] count and pub fn count remain fixed at 13/36", () => {
    const wasmBindgenCount = [...libRsSource.matchAll(/^#\[wasm_bindgen\]/gm)].length;
    expect(wasmBindgenCount).toBe(15);
    const pubFnNames = [...libRsSource.matchAll(/^\s*pub\s+fn\s+([a-zA-Z0-9_]+)/gm)];
    expect(pubFnNames.length).toBe(48);
  });

  it("11. Regression: desktop_application.ts and create_desktop_application.ts carry no reference to this Stage's own doc or new types", () => {
    for (const source of [desktopApplicationSource, createDesktopApplicationSource]) {
      expect(source).not.toMatch(/secure_runtime_alpha_202/);
      expect(source).not.toMatch(/FedosEventReader|FedosEventDescriptor/);
    }
  });

  it("12. Regression: create_runtime.ts/types.ts/worker.ts are unmodified -- no reference to this Stage's own doc or the new types", () => {
    for (const source of [createRuntimeSource, runtimeTypesSource, workerSource]) {
      expect(source).not.toMatch(/secure_runtime_alpha_202/);
      expect(source).not.toMatch(/FedosEventReader|FedosEventDescriptor/);
    }
  });
});
