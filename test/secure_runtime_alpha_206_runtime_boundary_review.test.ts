import { describe, it, expect } from "vitest";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import designDocSource from "../docs/secure_runtime_alpha_206_runtime_boundary_review.md?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import createRuntimeSource from "../src/runtime/create_runtime.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import runtimeTypesSource from "../src/runtime/types.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import workerSource from "../src/worker.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import desktopApplicationSource from "../src/desktop/desktop_application.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import createDesktopApplicationSource from "../src/desktop/create_desktop_application.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import descriptorSource from "../src/desktop/fedos_event_descriptor.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import readerSource from "../src/desktop/fedos_event_reader.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import nullEventReaderSource from "../src/desktop/null_event_reader.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import libRsSource from "../packages/fedos-core-rust/src/lib.rs?raw";

const NEW_SYMBOLS = ["FedosEventReader", "FedosEventDescriptor", "NullEventReader"];
const RUNTIME_WORKER_FILES: Record<string, string> = {
  "create_runtime.ts": createRuntimeSource,
  "types.ts": runtimeTypesSource,
  "worker.ts": workerSource,
  "desktop_application.ts": desktopApplicationSource,
  "create_desktop_application.ts": createDesktopApplicationSource,
};

/**
 * Secure Runtime Alpha 206 -- "Runtime Boundary Review": Stage 6 of
 * the Nostr Event Runtime Exposure Arc. Review only. Confirms
 * AppRuntime/create_runtime.ts/types.ts/worker.ts and Desktop's own
 * pre-existing files carry zero reference to this Arc's own three new
 * symbols -- the Worker/Desktop separation is unchanged because
 * nothing new crosses it.
 */
describe("Secure Runtime Alpha 206 -- Runtime Boundary Review", () => {
  it("1. the design doc exists and is substantial", () => {
    expect(typeof designDocSource).toBe("string");
    expect(designDocSource.length).toBeGreaterThan(2000);
  });

  it("2. the design doc declares itself REVIEW ONLY, with no code change", () => {
    expect(designDocSource).toMatch(/this Stage is REVIEW ONLY/);
    expect(designDocSource).toMatch(/It makes NO code change of any\s*\nkind/);
  });

  it("3. structural: zero reference to any of this Arc's own three new symbols across all five Runtime/Worker/Desktop files", () => {
    for (const [name, source] of Object.entries(RUNTIME_WORKER_FILES)) {
      for (const symbol of NEW_SYMBOLS) {
        expect(source, `${name} should not reference ${symbol}`).not.toMatch(new RegExp(symbol));
      }
    }
  });

  it("4. structural: none of the three new files imports desktop_application.ts or create_desktop_application.ts", () => {
    for (const source of [descriptorSource, readerSource, nullEventReaderSource]) {
      expect(source).not.toMatch(/desktop_application|create_desktop_application/);
    }
  });

  it("5. structural: lib.rs #[wasm_bindgen] count and pub fn count remain fixed at 13/36", () => {
    const wasmBindgenCount = [...libRsSource.matchAll(/^#\[wasm_bindgen\]/gm)].length;
    expect(wasmBindgenCount).toBe(15);
    const pubFnNames = [...libRsSource.matchAll(/^\s*pub\s+fn\s+([a-zA-Z0-9_]+)/gm)];
    expect(pubFnNames.length).toBe(45);
  });

  it("6. the design doc's own §5 records the five-file/three-symbol grep with zero matches", () => {
    const section = (designDocSource.match(/## 5\. Structural confirmation[\s\S]*?\n\n([\s\S]*?)\n## 6\./) ?? [])[1] ?? "";
    expect(designDocSource).toMatch(/zero matches, all three\s*\n\s*symbols, all five files/);
  });

  it("7. the design doc cross-references Alpha 205, Alpha 198, and Alpha 089", () => {
    for (const ref of [
      "secure_runtime_alpha_205_event_immutability_review",
      "secure_runtime_alpha_198_event_runtime_boundary_review",
      "secure_runtime_alpha_089_desktop_runtime_separation_review",
    ]) {
      expect(designDocSource).toContain(ref);
    }
  });

  it("8. Regression: none of the five Runtime/Worker/Desktop files carries a reference to this Stage's own doc", () => {
    for (const source of Object.values(RUNTIME_WORKER_FILES)) {
      expect(source).not.toMatch(/secure_runtime_alpha_206/);
    }
  });
});
