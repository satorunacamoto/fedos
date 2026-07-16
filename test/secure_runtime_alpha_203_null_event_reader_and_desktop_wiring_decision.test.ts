import { describe, it, expect } from "vitest";
import { NullEventReader } from "../src/desktop/null_event_reader.js";
import { createDesktopApplication } from "../src/desktop/create_desktop_application.js";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import designDocSource from "../docs/secure_runtime_alpha_203_null_event_reader_and_desktop_wiring_decision.md?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import nullEventReaderSource from "../src/desktop/null_event_reader.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import desktopApplicationSource from "../src/desktop/desktop_application.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import createDesktopApplicationSource from "../src/desktop/create_desktop_application.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import nullPublicIdentityReaderSource from "../src/desktop/null_public_identity_reader.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import libRsSource from "../packages/fedos-core-rust/src/lib.rs?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import createRuntimeSource from "../src/runtime/create_runtime.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import runtimeTypesSource from "../src/runtime/types.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import workerSource from "../src/worker.ts?raw";

/**
 * Secure Runtime Alpha 203 -- "Null Event Reader & Desktop Wiring
 * Decision": Stage 3 of the Nostr Event Runtime Exposure Arc. Adds
 * src/desktop/null_event_reader.ts (NullEventReader), a
 * dependency-free, always-empty FedosEventReader implementation, and
 * DECIDES that wiring it into DesktopApplication is not required this
 * Arc (no real Event source exists yet, and DesktopApplication has
 * been frozen since Alpha 136).
 */
describe("Secure Runtime Alpha 203 -- Null Event Reader & Desktop Wiring Decision", () => {
  it("1. the design doc exists and is substantial", () => {
    expect(typeof designDocSource).toBe("string");
    expect(designDocSource.length).toBeGreaterThan(2000);
  });

  it("2. the design doc declares itself an IMPLEMENTS Stage adding exactly one new, unwired file", () => {
    expect(designDocSource).toMatch(/this Stage IMPLEMENTS/);
    expect(designDocSource).toMatch(
      /It adds exactly one new file,\s*\n`src\/desktop\/null_event_reader\.ts`, and nothing else — no existing\s*\nfile is modified, and this new file is wired into nothing/,
    );
  });

  it("3. NullEventReader is the ONLY export from null_event_reader.ts", () => {
    const exportNames = [...nullEventReaderSource.matchAll(/^export (?:class|function|const) (\w+)/gm)].map(
      (m: RegExpMatchArray) => m[1],
    );
    expect(exportNames).toEqual(["NullEventReader"]);
  });

  it("4. NullEventReader's own class body has NO constructor, NO field, and readEvents()'s own entire body is a single return [] statement", () => {
    const codeOnly = nullEventReaderSource
      .split("\n")
      .filter((line: string) => !line.trim().startsWith("//") && !line.trim().startsWith("*"))
      .join("\n");
    const classBody = (codeOnly.match(/export class NullEventReader[^{]*\{([\s\S]*)\n\}/) ?? [])[1] ?? "";
    expect(classBody).not.toMatch(/constructor/);
    expect(classBody).not.toMatch(/#\w+/);
    const body = (classBody.match(/async readEvents\(\): Promise<readonly FedosEventDescriptor\[\]> \{([\s\S]*?)\n {2}\}/) ?? [])[1] ?? "";
    const lines = body
      .split("\n")
      .map((line: string) => line.trim())
      .filter((line: string) => line.length > 0);
    expect(lines).toEqual(["return [];"]);
  });

  it("5. the design doc's own Decision section states DesktopApplication is NOT modified this Arc", () => {
    const section = (designDocSource.match(/## 3\. The DesktopApplication wiring decision[\s\S]*?\n\n([\s\S]*?)\n## 4\./) ?? [])[1] ?? "";
    expect(designDocSource).toMatch(
      /\*\*Decision: `desktop_application\.ts` and `create_desktop_application\.ts`\s*\nare NOT modified by this Arc\.\*\*/,
    );
    expect(section.length).toBeGreaterThan(0);
  });

  it("6. the design doc's own 'does NOT do' list confirms NullEventReader is not wired into DesktopApplication and no field/method is added", () => {
    expect(designDocSource).toMatch(
      /Does \*\*not\*\* wire `NullEventReader` into `createDesktopApplication\(\)`/,
    );
    expect(designDocSource).toMatch(
      /Does \*\*not\*\* add any method, field, or constructor parameter to/,
    );
  });

  it("7. the design doc cross-references Alpha 202, Alpha 201, Alpha 104, Alpha 109, and Alpha 200", () => {
    for (const ref of [
      "secure_runtime_alpha_202_desktop_facing_event_reader_abstraction",
      "secure_runtime_alpha_201_event_runtime_exposure_review",
      "secure_runtime_alpha_104_null_reader",
      "secure_runtime_alpha_109_desktop_wiring",
      "secure_runtime_alpha_200_event_foundation_completion",
    ]) {
      expect(designDocSource).toContain(ref);
    }
  });

  it("8. structural: desktop_application.ts and create_desktop_application.ts are completely unmodified -- no reference to this Stage's own doc or to NullEventReader", () => {
    for (const source of [desktopApplicationSource, createDesktopApplicationSource]) {
      expect(source).not.toMatch(/secure_runtime_alpha_203/);
      expect(source).not.toMatch(/NullEventReader|FedosEventReader|FedosEventDescriptor/);
    }
  });

  it("9. structural: DesktopApplication's own public method/field set remains byte-for-byte identical to Alpha 190's own closing state", () => {
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

  it("10. structural: NoopFedosIdentityProvider's sibling, NullPublicIdentityReader, is confirmed unaffected by this Stage", () => {
    expect(nullPublicIdentityReaderSource).not.toMatch(/secure_runtime_alpha_203/);
  });

  it("11. structural: lib.rs #[wasm_bindgen] count and pub fn count remain fixed at 13/36 -- no new Rust export was added to justify wiring", () => {
    const wasmBindgenCount = [...libRsSource.matchAll(/^#\[wasm_bindgen\]/gm)].length;
    expect(wasmBindgenCount).toBe(15);
    const pubFnNames = [...libRsSource.matchAll(/^\s*pub\s+fn\s+([a-zA-Z0-9_]+)/gm)];
    expect(pubFnNames.length).toBe(45);
  });

  // ---------------------------------------------------------------------
  // Behavioral
  // ---------------------------------------------------------------------

  it("12. behavioral: NullEventReader.readEvents() always resolves an empty array, confirmed by direct construction and call", async () => {
    const reader = new NullEventReader();
    await expect(reader.readEvents()).resolves.toEqual([]);
  });

  it("13. behavioral: repeated calls on the same instance always resolve an empty array, confirming no hidden state", async () => {
    const reader = new NullEventReader();
    for (let i = 0; i < 5; i += 1) {
      await expect(reader.readEvents()).resolves.toEqual([]);
    }
  });

  it("14. behavioral: constructing NullEventReader accepts no argument and throws nothing", () => {
    expect(() => new NullEventReader()).not.toThrow();
  });

  it("15. RIPPLE: createDesktopApplication() continues to construct successfully and carries no FedosEventReader-shaped API of any kind", () => {
    const app = createDesktopApplication();
    expect(app).not.toHaveProperty("readEvents");
    expect(() => createDesktopApplication()).not.toThrow();
  });

  // ---------------------------------------------------------------------
  // Regression
  // ---------------------------------------------------------------------

  it("16. Regression: create_runtime.ts/types.ts/worker.ts are unmodified -- no reference to this Stage's own doc or to NullEventReader", () => {
    for (const source of [createRuntimeSource, runtimeTypesSource, workerSource]) {
      expect(source).not.toMatch(/secure_runtime_alpha_203/);
      expect(source).not.toMatch(/NullEventReader/);
    }
  });
});
