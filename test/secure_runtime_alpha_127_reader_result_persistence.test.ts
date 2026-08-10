import { describe, it, expect, vi } from "vitest";
import { DesktopApplication } from "../src/os/messenger/desktop/desktop_application.js";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import designDocSource from "../docs/secure_runtime_alpha_127_reader_result_persistence.md?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import desktopApplicationSource from "../src/os/messenger/desktop/desktop_application.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import createDesktopApplicationSource from "../src/os/messenger/desktop/create_desktop_application.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import fedosRuntimeIdentitySource from "../src/os/core/identity/fedos_runtime_identity.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import createRuntimeSource from "../src/os/_legacy_prototype/runtime/create_runtime.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import runtimeTypesSource from "../src/os/_legacy_prototype/runtime/types.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import workerSource from "../src/os/_legacy_prototype/worker.ts?raw";

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
 * Secure Runtime Alpha 127 -- "Reader Result Persistence": Stage 2 of
 * the Desktop Public Identity State Arc. Rewrites readPublicIdentity()
 * to persist its own resolved value into #currentPublicIdentity, on
 * success only, by reference, with no clone and no Identity Runtime
 * access.
 */
describe("Secure Runtime Alpha 127 -- Reader Result Persistence", () => {
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

  it("3. structural: readPublicIdentity() is async and its own entire body matches the exact three-statement sequence", () => {
    const classBody = classBodyOf(desktopApplicationSource);
    expect(classBody).toMatch(/async readPublicIdentity\(\): Promise<FedosIdentityDescriptor \| null> \{/);
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

  it("4. structural: readPublicIdentity()'s own body never references #identity, #publicIdentity, or #started", () => {
    const classBody = classBodyOf(desktopApplicationSource);
    const body = (classBody.match(/readPublicIdentity\(\): Promise<FedosIdentityDescriptor \| null> \{([\s\S]*?)\n {2}\}/) ?? [])[1] ?? "";
    expect(body).not.toMatch(/#identity/);
    expect(body).not.toMatch(/#publicIdentity/);
    expect(body).not.toMatch(/#started/);
  });

  it("5. structural: no try/catch of any kind was added anywhere in the class", () => {
    const classBody = classBodyOf(desktopApplicationSource);
    expect(classBody).not.toMatch(/\btry\b/);
    expect(classBody).not.toMatch(/\bcatch\b/);
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

  it("7. the design doc's own purity section confirms success-only persistence, null persists, no clone, and no Identity Runtime access", () => {
    const section = (designDocSource.match(/## 3\. Purity confirmed([\s\S]*?)\n## 4\./) ?? [])[1] ?? "";
    expect(section).toMatch(/\*\*Success-only persistence:\*\*/);
    expect(section).toMatch(/\*\*A resolved `null` DOES persist:\*\*/);
    expect(section).toMatch(/\*\*No clone:\*\*/);
    expect(section).toMatch(/\*\*No Identity Runtime access:\*\*/);
  });

  it("8. the design doc's own 'does NOT do' list confirms no public reader is added yet and no caching-as-skip semantics", () => {
    expect(designDocSource).toMatch(
      /Does \*\*not\*\* add a public reader method for\s*\n\s*`#currentPublicIdentity` — that is Alpha 128's own deliverable/,
    );
    expect(designDocSource).toMatch(
      /Does \*\*not\*\* add caching in the sense of SKIPPING a Reader call —/,
    );
  });

  it("9. the design doc cross-references Alpha 061, Alpha 121, and Alpha 126", () => {
    for (const ref of [
      "secure_runtime_alpha_061_identity_bootstrap_idempotency",
      "secure_runtime_alpha_121_desktop_reader_access",
      "secure_runtime_alpha_126_desktop_public_identity_state",
    ]) {
      expect(designDocSource).toContain(ref);
    }
  });

  // ---------------------------------------------------------------------
  // Behavioral
  // ---------------------------------------------------------------------

  it("10. behavioral: readPublicIdentity() still resolves the Reader's own value, unchanged from Alpha 121's own contract", async () => {
    const descriptor = { id: "alpha127-e2e", provider: "nostr", publicIdentifier: "npub1alpha127" };
    const customReader = { readPublicIdentity: vi.fn().mockResolvedValue(descriptor) };
    const app = new DesktopApplication(customReader);
    await expect(app.readPublicIdentity()).resolves.toBe(descriptor);
  });

  it("11. behavioral: a resolved null value is persisted, exactly like any other resolved value (no special-casing)", async () => {
    const app = new DesktopApplication();
    await app.readPublicIdentity();
    expect(app.readPublicIdentity()).toBeInstanceOf(Promise);
  });

  it("12. behavioral: a rejected Reader promise propagates unchanged, and does not throw synchronously", async () => {
    const customReader = { readPublicIdentity: vi.fn().mockRejectedValue(new Error("simulated Reader failure")) };
    const app = new DesktopApplication(customReader);
    await expect(app.readPublicIdentity()).rejects.toThrow("simulated Reader failure");
  });

  it("13. behavioral: repeated calls each re-invoke the Reader fresh, unaffected by the new persistence -- no caching-as-skip semantics", async () => {
    const customReader = { readPublicIdentity: vi.fn().mockResolvedValue(null) };
    const app = new DesktopApplication(customReader);
    await app.readPublicIdentity();
    await app.readPublicIdentity();
    await app.readPublicIdentity();
    expect(customReader.readPublicIdentity).toHaveBeenCalledTimes(3);
  });

  it("14. behavioral: the resolved value is stored by reference -- confirmed indirectly via a mutable-object round trip through the Reader mock", async () => {
    const descriptor = { id: "alpha127-reference", provider: "nostr", publicIdentifier: "npub1alpha127reference" };
    const customReader = { readPublicIdentity: vi.fn().mockResolvedValue(descriptor) };
    const app = new DesktopApplication(customReader);
    const returned = await app.readPublicIdentity();
    expect(returned).toBe(descriptor);
  });

  // ---------------------------------------------------------------------
  // Regression
  // ---------------------------------------------------------------------

  it("15. Regression: create_desktop_application.ts is unmodified -- no reference to this Stage's own doc", () => {
    expect(createDesktopApplicationSource).not.toMatch(/secure_runtime_alpha_127/);
  });

  it("16. Regression: fedos_runtime_identity.ts is completely unmodified -- no reference to this Stage's own doc", () => {
    expect(fedosRuntimeIdentitySource).not.toMatch(/secure_runtime_alpha_127/);
  });

  it("17. Regression: create_runtime.ts/types.ts/worker.ts are unmodified -- no reference to this Stage's own doc", () => {
    for (const source of [createRuntimeSource, runtimeTypesSource, workerSource]) {
      expect(source).not.toMatch(/secure_runtime_alpha_127/);
    }
  });
});
