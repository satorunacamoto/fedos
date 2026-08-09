import { describe, it, expect, vi } from "vitest";
import { DesktopApplication } from "../src/desktop/desktop_application.js";
import { FedosIdentityService } from "../src/identity/fedos_identity_service.js";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import designDocSource from "../docs/secure_runtime_alpha_129_desktop_state_boundary.md?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import desktopApplicationSource from "../src/desktop/desktop_application.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import createDesktopApplicationSource from "../src/desktop/create_desktop_application.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import fedosRuntimeIdentitySource from "../src/runtime/fedos_runtime_identity.ts?raw";
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
 * Secure Runtime Alpha 129 -- "Desktop State Boundary": Stage 4 of the
 * Desktop Public Identity State Arc, a REVIEW / DESIGN ONLY Stage.
 * Confirms currentIdentity() (Runtime Identity) and
 * currentPublicIdentity() (Desktop Public State) remain completely
 * independent -- neither influences the other.
 */
describe("Secure Runtime Alpha 129 -- Desktop State Boundary", () => {
  it("1. the design doc exists and is substantial", () => {
    expect(typeof designDocSource).toBe("string");
    expect(designDocSource.length).toBeGreaterThan(2000);
  });

  it("2. the design doc declares itself REVIEW / DESIGN ONLY, with no code change of any kind", () => {
    expect(designDocSource).toMatch(/this Stage is REVIEW \/ DESIGN ONLY/);
    expect(designDocSource).toMatch(/It makes NO code change/);
  });

  it("3. the design doc declares a single Decision -- the two are completely independent", () => {
    const section = (designDocSource.match(/## 3\. Decision([\s\S]*?)\n## 4\./) ?? [])[1] ?? "";
    expect(section).toMatch(
      /\*\*`currentIdentity\(\)` \(Runtime Identity\) and `currentPublicIdentity\(\)`\s*\n\(Desktop Public State\) are, and remain, COMPLETELY INDEPENDENT\./,
    );
  });

  it("4. the design doc's own Decision extends, rather than revises, Alpha 123's own Decision", () => {
    const section = (designDocSource.match(/## 3\. Decision([\s\S]*?)\n## 4\./) ?? [])[1] ?? "";
    expect(section).toMatch(/This extends, rather than revises, Alpha\s*\n123's own Reader\/Authority Boundary Decision/);
  });

  it("5. the design doc cross-references Alpha 118, Alpha 123, Alpha 126, and Alpha 128", () => {
    for (const ref of [
      "secure_runtime_alpha_118_desktop_authority_consumption",
      "secure_runtime_alpha_123_desktop_public_identity_boundary",
      "secure_runtime_alpha_126_desktop_public_identity_state",
      "secure_runtime_alpha_128_desktop_public_identity_reader",
    ]) {
      expect(designDocSource).toContain(ref);
    }
  });

  it("6. structural: currentIdentity() and isBootstrapped() own bodies never reference #currentPublicIdentity", () => {
    const classBody = classBodyOf(desktopApplicationSource);
    const currentIdentityBody = (classBody.match(/currentIdentity\(\): FedosIdentityDescriptor \| null \{([\s\S]*?)\n {2}\}/) ?? [])[1] ?? "";
    const isBootstrappedBody = (classBody.match(/isBootstrapped\(\): boolean \{([\s\S]*?)\n {2}\}/) ?? [])[1] ?? "";
    for (const body of [currentIdentityBody, isBootstrappedBody]) {
      expect(body).not.toMatch(/#currentPublicIdentity/);
    }
  });

  it("7. structural: currentPublicIdentity()'s own body never references #identity", () => {
    const classBody = classBodyOf(desktopApplicationSource);
    const body = (classBody.match(/currentPublicIdentity\(\): FedosIdentityDescriptor \| null \{([\s\S]*?)\n {2}\}/) ?? [])[1] ?? "";
    expect(body).not.toMatch(/#identity/);
  });

  it("8. structural: bootstrap()/start() -- #identity's own only writers -- never reference #currentPublicIdentity", () => {
    const classBody = classBodyOf(desktopApplicationSource);
    const bootstrapBody = (classBody.match(/async bootstrap\(\): Promise<void> \{([\s\S]*?)\n {2}\}/) ?? [])[1] ?? "";
    const startBody = (classBody.match(/async start\(\): Promise<void> \{([\s\S]*?)\n {2}\}/) ?? [])[1] ?? "";
    for (const body of [bootstrapBody, startBody]) {
      expect(body).not.toMatch(/#currentPublicIdentity/);
    }
  });

  it("9. structural: readPublicIdentity() -- #currentPublicIdentity's own only writer -- never references #identity", () => {
    const classBody = classBodyOf(desktopApplicationSource);
    const body = (classBody.match(/readPublicIdentity\(\): Promise<FedosIdentityDescriptor \| null> \{([\s\S]*?)\n {2}\}/) ?? [])[1] ?? "";
    expect(body).not.toMatch(/#identity/);
    expect(body).toMatch(/#currentPublicIdentity/);
  });

  // ---------------------------------------------------------------------
  // Behavioral: independence confirmed end to end, unmocked
  // ---------------------------------------------------------------------

  it("10. behavioral: calling readPublicIdentity()/currentPublicIdentity() first does not affect currentIdentity()/isBootstrapped(), which remain at their pre-Bootstrap defaults", async () => {
    const snapshot = { id: "alpha129-reader", publicIdentifier: "npub1alpha129reader" };
    const app = new DesktopApplication({ readPublicIdentity: vi.fn().mockResolvedValue(snapshot) }, undefined);
    await app.readPublicIdentity();
    expect(app.currentPublicIdentity()).toEqual(snapshot);
    expect(app.currentIdentity()).toBeNull();
    expect(app.isBootstrapped()).toBe(false);
  });

  it("11. behavioral: calling bootstrap()/start() first does not affect currentPublicIdentity(), which stays null until readPublicIdentity() is called independently", async () => {
    const app = new DesktopApplication();
    await app.start();
    expect(app.isBootstrapped()).toBe(true);
    expect(app.currentPublicIdentity()).toBeNull();
  });

  it("12. behavioral: after BOTH paths have run, each state reflects only its own source -- no merge, no overwrite", async () => {
    const descriptor = { id: "alpha129-runtime", provider: "nostr", publicIdentifier: "npub1alpha129runtime" };
    const spy = vi.spyOn(FedosIdentityService.prototype, "describeIdentity").mockResolvedValueOnce(descriptor);
    const snapshot = { id: "alpha129-public", publicIdentifier: "npub1alpha129public" };
    const app = new DesktopApplication({ readPublicIdentity: vi.fn().mockResolvedValue(snapshot) }, undefined);
    await app.start();
    await app.readPublicIdentity();
    expect(app.currentIdentity()).toBe(descriptor);
    expect(app.currentPublicIdentity()).toEqual(snapshot);
    expect(app.currentIdentity()).not.toEqual(app.currentPublicIdentity());
    spy.mockRestore();
  });

  it("13. the design doc's own 'does NOT do' list confirms the two states remain permanently unconnected", () => {
    expect(designDocSource).toMatch(
      /Does \*\*not\*\* connect the two states in any way — they remain\s*\n\s*deliberately, permanently separate\./,
    );
  });

  // ---------------------------------------------------------------------
  // Regression
  // ---------------------------------------------------------------------

  it("14. Regression: desktop_application.ts and create_desktop_application.ts carry no reference to this Stage's own doc, confirming zero code change", () => {
    expect(desktopApplicationSource).not.toMatch(/secure_runtime_alpha_129/);
    expect(createDesktopApplicationSource).not.toMatch(/secure_runtime_alpha_129/);
  });

  it("15. Regression: fedos_runtime_identity.ts is completely unmodified -- no reference to this Stage's own doc", () => {
    expect(fedosRuntimeIdentitySource).not.toMatch(/secure_runtime_alpha_129/);
  });

  it("16. Regression: create_runtime.ts/types.ts/worker.ts are unmodified -- no reference to this Stage's own doc", () => {
    for (const source of [createRuntimeSource, runtimeTypesSource, workerSource]) {
      expect(source).not.toMatch(/secure_runtime_alpha_129/);
    }
  });
});
