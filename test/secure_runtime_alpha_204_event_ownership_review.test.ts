import { describe, it, expect } from "vitest";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import designDocSource from "../docs/secure_runtime_alpha_204_event_ownership_review.md?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import descriptorSource from "../src/desktop/fedos_event_descriptor.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import readerSource from "../src/desktop/fedos_event_reader.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import nullEventReaderSource from "../src/desktop/null_event_reader.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import desktopApplicationSource from "../src/desktop/desktop_application.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import libRsSource from "../packages/fedos-core-rust/src/lib.rs?raw";

const NEW_FILE_SOURCES: Record<string, string> = {
  "fedos_event_descriptor.ts": descriptorSource,
  "fedos_event_reader.ts": readerSource,
  "null_event_reader.ts": nullEventReaderSource,
};

function codeOnly(source: string): string {
  return source
    .split("\n")
    .filter((line) => !line.trim().startsWith("//") && !line.trim().startsWith("*"))
    .join("\n");
}

/**
 * Secure Runtime Alpha 204 -- "Event Ownership Review": Stage 4 of the
 * Nostr Event Runtime Exposure Arc. Review only. Confirms Desktop's
 * three new Event files (fedos_event_descriptor.ts,
 * fedos_event_reader.ts, null_event_reader.ts) grant no secret key,
 * signing, or Rust-Foundation-reaching capability of any kind --
 * Desktop consumes Events, it never owns cryptographic state.
 */
describe("Secure Runtime Alpha 204 -- Event Ownership Review", () => {
  it("1. the design doc exists and is substantial", () => {
    expect(typeof designDocSource).toBe("string");
    expect(designDocSource.length).toBeGreaterThan(2000);
  });

  it("2. the design doc declares itself REVIEW ONLY, with no code change", () => {
    expect(designDocSource).toMatch(/this Stage is REVIEW ONLY/);
    expect(designDocSource).toMatch(/It makes NO code change of any\s*\nkind/);
  });

  it("3. structural: none of the three new files references a secret key, seed, mnemonic, or private-key symbol IN CODE", () => {
    for (const [name, source] of Object.entries(NEW_FILE_SOURCES)) {
      expect(codeOnly(source), name).not.toMatch(/nsec|seed|mnemonic|secretKey|privateKey|SecretHandleKind|FedosNostrSecretKeyHandle/i);
    }
  });

  it("4. structural: none of the three new files references any Rust Event Foundation symbol", () => {
    for (const [name, source] of Object.entries(NEW_FILE_SOURCES)) {
      const code = codeOnly(source);
      expect(code, name).not.toMatch(
        /FedosNostrEventHandle|new_nostr_event_internal|serialize_nostr_event_canonical_internal|derive_nostr_event_id_internal|sign_nostr_event_internal/,
      );
    }
  });

  it("5. structural: FedosEventReader.readEvents() accepts no argument", () => {
    expect(readerSource).toMatch(/readEvents\(\): Promise<readonly FedosEventDescriptor\[\]>;/);
  });

  it("6. structural: FedosEventDescriptor's own eight fields are all public data types -- string/number/readonly-array only, no opaque handle type", () => {
    const body = (descriptorSource.match(/export interface FedosEventDescriptor \{([\s\S]*?)\n\}/) ?? [])[1] ?? "";
    const fieldTypes = [...body.matchAll(/readonly \w+: ([^;]+);/g)].map((m: RegExpMatchArray) => m[1]);
    for (const type of fieldTypes) {
      expect(type).toMatch(/^(string|number|readonly \(readonly string\[\]\)\[\])$/);
    }
  });

  it("7. the design doc's own §3/§4 confirm zero secret-key and zero Rust-Foundation reference by direct inspection", () => {
    expect(designDocSource).toMatch(/Zero reference to `nsec`, `seed`, `mnemonic`/);
    expect(designDocSource).toMatch(/entirely independent TypeScript\s*\nconstructs/);
  });

  it("8. the design doc cross-references Alpha 203, Alpha 202, Alpha 197, and Alpha 198", () => {
    for (const ref of [
      "secure_runtime_alpha_203_null_event_reader_and_desktop_wiring_decision",
      "secure_runtime_alpha_202_desktop_facing_event_reader_abstraction",
      "secure_runtime_alpha_197_event_boundary_review",
      "secure_runtime_alpha_198_event_runtime_boundary_review",
    ]) {
      expect(designDocSource).toContain(ref);
    }
  });

  it("9. Regression: desktop_application.ts carries no reference to this Stage's own doc", () => {
    expect(desktopApplicationSource).not.toMatch(/secure_runtime_alpha_204/);
  });

  it("10. Regression: lib.rs #[wasm_bindgen] count and pub fn count remain fixed at 13/36", () => {
    const wasmBindgenCount = [...libRsSource.matchAll(/^#\[wasm_bindgen\]/gm)].length;
    expect(wasmBindgenCount).toBe(17);
    const pubFnNames = [...libRsSource.matchAll(/^\s*pub\s+fn\s+([a-zA-Z0-9_]+)/gm)];
    expect(pubFnNames.length).toBe(50);
  });
});
