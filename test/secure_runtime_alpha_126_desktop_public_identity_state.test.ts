import { describe, it, expect } from "vitest";
import { DesktopApplication } from "../src/desktop/desktop_application.js";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import designDocSource from "../docs/secure_runtime_alpha_126_desktop_public_identity_state.md?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import desktopApplicationSource from "../src/desktop/desktop_application.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import createDesktopApplicationSource from "../src/desktop/create_desktop_application.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import fedosRuntimeIdentitySource from "../src/runtime/fedos_runtime_identity.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import createRuntimeSource from "../src/runtime/create_runtime.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import runtimeTypesSource from "../src/runtime/types.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import workerSource from "../src/worker.ts?raw";

function classBodyOf(source: string): string {
  const codeOnly = source
    .split("\n")
    .filter((line: string) => {
      const trimmed = line.trim();
      return !trimmed.startsWith("//") && !trimmed.startsWith("*") && !trimmed.startsWith("/*");
    })
    .join("\n");
  return (codeOnly.match(/export class DesktopApplication \{([\s\S]*)\n\}/) ?? [])[1] ?? "";
}

/**
 * Secure Runtime Alpha 126 -- "Desktop Public Identity State": Stage 1
 * of the Desktop Public Identity State Arc. Adds
 * DesktopApplication.#currentPublicIdentity, a private, initially-null
 * field -- Desktop's own FIRST genuinely computed, mutable state.
 * Inert: no method reads or writes it yet.
 */
describe("Secure Runtime Alpha 126 -- Desktop Public Identity State", () => {
  it("1. the design doc exists and is substantial", () => {
    expect(typeof designDocSource).toBe("string");
    expect(designDocSource.length).toBeGreaterThan(2000);
  });

  it("2. the design doc declares itself an IMPLEMENTS Stage modifying exactly one file", () => {
    expect(designDocSource).toMatch(/this Stage IMPLEMENTS/);
    expect(designDocSource).toMatch(
      /It modifies exactly one file,\s*\n`src\/desktop\/desktop_application\.ts`, and nothing else/,
    );
  });

  it("3. structural: #currentPublicIdentity is declared with the exact type and initial value", () => {
    const classBody = classBodyOf(desktopApplicationSource);
    expect(classBody).toMatch(/#currentPublicIdentity: FedosIdentityDescriptor \| null = null;/);
  });

  it("4. structural: #currentPublicIdentity is NOT readonly, unlike #identity/#reader/#publicIdentity", () => {
    const classBody = classBodyOf(desktopApplicationSource);
    expect(classBody).not.toMatch(/readonly #currentPublicIdentity/);
    expect(classBody).toMatch(/readonly #identity/);
    expect(classBody).toMatch(/readonly #reader/);
    expect(classBody).toMatch(/readonly #publicIdentity/);
  });

  it("5. RIPPLE (Secure Runtime Alpha 127): no method body anywhere in the class referenced #currentPublicIdentity AS OF this Stage's own scope -- it was inert; Alpha 127 legitimately wired readPublicIdentity() as its own FIRST and ONLY writer, reconfirmed here as the CURRENT state", () => {
    const classBody = classBodyOf(desktopApplicationSource);
    const constructorBody = (classBody.match(/constructor\([\s\S]*?\) \{([\s\S]*?)\n {2}\}/) ?? [])[1] ?? "";
    const bootstrapBody = (classBody.match(/async bootstrap\(\): Promise<void> \{([\s\S]*?)\n {2}\}/) ?? [])[1] ?? "";
    const startBody = (classBody.match(/async start\(\): Promise<void> \{([\s\S]*?)\n {2}\}/) ?? [])[1] ?? "";
    const currentIdentityBody = (classBody.match(/currentIdentity\(\): FedosIdentityDescriptor \| null \{([\s\S]*?)\n {2}\}/) ?? [])[1] ?? "";
    const isBootstrappedBody = (classBody.match(/isBootstrapped\(\): boolean \{([\s\S]*?)\n {2}\}/) ?? [])[1] ?? "";
    for (const body of [constructorBody, bootstrapBody, startBody, currentIdentityBody, isBootstrappedBody]) {
      expect(body).not.toMatch(/#currentPublicIdentity/);
    }
    const readPublicIdentityBody = (classBody.match(/readPublicIdentity\(\): Promise<FedosIdentityDescriptor \| null> \{([\s\S]*?)\n {2}\}/) ?? [])[1] ?? "";
    expect(readPublicIdentityBody).toMatch(/#currentPublicIdentity/);
  });

  it("6. RIPPLE (Secure Runtime Alpha 131): the class had exactly five public methods and five private fields AS OF this Stage's own scope; Alpha 128 added a SIXTH public method, currentPublicIdentity(), and Alpha 131 added a SEVENTH, refreshPublicIdentity(), reconfirmed here as the CURRENT state", () => {
    const classBody = classBodyOf(desktopApplicationSource);
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

  it("7. RIPPLE (Secure Runtime Alpha 127): readPublicIdentity()'s own body was byte-for-byte unchanged AS OF this Stage's own scope -- a single delegation to #reader.readPublicIdentity(); Alpha 127 rewrote it to also persist the resolved value, reconfirmed here as the CURRENT state", () => {
    const classBody = classBodyOf(desktopApplicationSource);
    const body = (classBody.match(/readPublicIdentity\(\): Promise<FedosIdentityDescriptor \| null> \{([\s\S]*?)\n {2}\}/) ?? [])[1] ?? "";
    const lines = body
      .split("\n")
      .map((line: string) => line.trim())
      .filter((line: string) => line.length > 0);
    expect(lines).toEqual([
      "const result = await this.#reader.readPublicIdentity();",
      "this.#currentPublicIdentity = result;",
      "return result;",
    ]);
  });

  it("8. the design doc's own purity section confirms no wiring, no derived initial value, and mutability", () => {
    const section = (designDocSource.match(/## 3\. Purity confirmed([\s\S]*?)\n## 4\./) ?? [])[1] ?? "";
    expect(section).toMatch(/\*\*No wiring:\*\*/);
    expect(section).toMatch(/\*\*No initial-value computation:\*\*/);
    expect(section).toMatch(/\*\*Not `readonly`:\*\*/);
  });

  it("9. the design doc's own 'does NOT do' list confirms wiring is Alpha 127's own deliverable and the public reader is Alpha 128's own", () => {
    expect(designDocSource).toMatch(
      /Does \*\*not\*\* wire `readPublicIdentity\(\)` to write\s*\n\s*`#currentPublicIdentity` — that is Alpha 127's own deliverable\./,
    );
    expect(designDocSource).toMatch(
      /Does \*\*not\*\* add a public reader method for\s*\n\s*`#currentPublicIdentity` — that is Alpha 128's own deliverable\s*\n\s*\(`currentPublicIdentity\(\)`\)\./,
    );
  });

  it("10. the design doc cross-references Alpha 101, Alpha 103, and Alpha 121", () => {
    for (const ref of [
      "secure_runtime_alpha_101_public_identity_reader_interface",
      "secure_runtime_alpha_103_source_injection",
      "secure_runtime_alpha_121_desktop_reader_access",
    ]) {
      expect(designDocSource).toContain(ref);
    }
  });

  // ---------------------------------------------------------------------
  // Behavioral: field is genuinely inert
  // ---------------------------------------------------------------------

  it("11. behavioral: a fresh instance's readPublicIdentity() still behaves exactly as before this Stage -- unaffected by the new, unwired field", async () => {
    const app = new DesktopApplication();
    await expect(app.readPublicIdentity()).resolves.toBeNull();
  });

  it("12. behavioral: currentIdentity()/isBootstrapped()/bootstrap()/start() all behave exactly as before this Stage", async () => {
    const app = new DesktopApplication();
    expect(app.currentIdentity()).toBeNull();
    expect(app.isBootstrapped()).toBe(false);
    await app.start();
    expect(app.isBootstrapped()).toBe(true);
  });

  // ---------------------------------------------------------------------
  // Regression
  // ---------------------------------------------------------------------

  it("13. Regression: create_desktop_application.ts is unmodified -- no reference to this Stage's own doc or to #currentPublicIdentity", () => {
    expect(createDesktopApplicationSource).not.toMatch(/secure_runtime_alpha_126/);
    expect(createDesktopApplicationSource).not.toMatch(/currentPublicIdentity/);
  });

  it("14. Regression: fedos_runtime_identity.ts is completely unmodified -- no reference to this Stage's own doc", () => {
    expect(fedosRuntimeIdentitySource).not.toMatch(/secure_runtime_alpha_126/);
  });

  it("15. Regression: create_runtime.ts/types.ts/worker.ts are unmodified -- no reference to this Stage's own doc", () => {
    for (const source of [createRuntimeSource, runtimeTypesSource, workerSource]) {
      expect(source).not.toMatch(/secure_runtime_alpha_126/);
    }
  });
});
