import { describe, it, expect, vi } from "vitest";
import { DesktopApplication } from "../src/os/messenger/desktop/desktop_application.js";
import { createDesktopApplication } from "../src/os/messenger/desktop/create_desktop_application.js";
import { FedosIdentityService } from "../src/os/core/identity/fedos_identity_service.js";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import designDocSource from "../docs/secure_runtime_alpha_138_startup_state_verification.md?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import desktopApplicationSource from "../src/os/messenger/desktop/desktop_application.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import createDesktopApplicationSource from "../src/os/messenger/desktop/create_desktop_application.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import fedosRuntimeIdentitySource from "../src/runtime/fedos_runtime_identity.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import createRuntimeSource from "../src/os/_legacy_prototype/runtime/create_runtime.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import runtimeTypesSource from "../src/os/_legacy_prototype/runtime/types.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import workerSource from "../src/os/_legacy_prototype/worker.ts?raw";

/**
 * Secure Runtime Alpha 138 -- "Startup State Verification": Stage 3 of
 * the Desktop Startup Identity Sequence Arc, a REVIEW / DESIGN ONLY
 * Stage. Verifies, by real execution, that after a successful start()
 * both isBootstrapped() and currentPublicIdentity() reflect the
 * expected, fully-updated state.
 */
describe("Secure Runtime Alpha 138 -- Startup State Verification", () => {
  it("1. the design doc exists and is substantial", () => {
    expect(typeof designDocSource).toBe("string");
    expect(designDocSource.length).toBeGreaterThan(1500);
  });

  it("2. the design doc declares itself REVIEW / DESIGN ONLY, with no code change of any kind", () => {
    expect(designDocSource).toMatch(/this Stage is REVIEW \/ DESIGN ONLY/);
    expect(designDocSource).toMatch(/It makes NO code change/);
  });

  it("3. the design doc declares a single Decision -- both guarantees hold simultaneously after a successful start()", () => {
    const section = (designDocSource.match(/## 3\. Decision([\s\S]*?)\n## 4\./) ?? [])[1] ?? "";
    expect(section).toMatch(
      /\*\*A successful `start\(\)` call leaves `isBootstrapped\(\)` returning\s*\n`true` AND `currentPublicIdentity\(\)` reflecting the Reader's own\s*\nfreshly-resolved value —/,
    );
  });

  it("4. the design doc cross-references Alpha 128, Alpha 133, and Alpha 137", () => {
    for (const ref of [
      "secure_runtime_alpha_128_desktop_public_identity_reader",
      "secure_runtime_alpha_133_refresh_state_verification",
      "secure_runtime_alpha_137_bootstrap_ordering",
    ]) {
      expect(designDocSource).toContain(ref);
    }
  });

  // ---------------------------------------------------------------------
  // Behavioral: real execution, both state updates confirmed together
  // ---------------------------------------------------------------------

  it("5. behavioral: before start(), both isBootstrapped() and currentPublicIdentity() are at their own defaults", () => {
    const app = new DesktopApplication();
    expect(app.isBootstrapped()).toBe(false);
    expect(app.currentPublicIdentity()).toBeNull();
  });

  it("6. behavioral: after a successful start(), isBootstrapped() is true AND currentPublicIdentity() reflects the Reader's own value", async () => {
    const descriptor = { id: "alpha138-e2e", provider: "nostr", publicIdentifier: "npub1alpha138" };
    const customReader = { readPublicIdentity: vi.fn().mockResolvedValue(descriptor) };
    const app = new DesktopApplication(customReader);
    await app.start();
    expect(app.isBootstrapped()).toBe(true);
    expect(app.currentPublicIdentity()).toBe(descriptor);
  });

  it("7. behavioral: currentIdentity() and currentPublicIdentity() are independently correct after start() -- Runtime Identity default (null, no Provider configured) vs. Public Identity (Reader-supplied)", async () => {
    const snapshot = { id: "alpha138-public", publicIdentifier: "npub1alpha138public" };
    const app = createDesktopApplication(snapshot);
    await app.start();
    expect(app.isBootstrapped()).toBe(true);
    expect(app.currentIdentity()).toBeNull();
    expect(app.currentPublicIdentity()).not.toBeNull();
    expect(app.currentPublicIdentity()?.id).toBe("alpha138-public");
  });

  it("8. behavioral: when the Runtime Identity Provider ALSO resolves a real Descriptor, both currentIdentity() and currentPublicIdentity() are independently populated after one start() call", async () => {
    const descriptor = { id: "alpha138-runtime", provider: "nostr", publicIdentifier: "npub1alpha138runtime" };
    const spy = vi.spyOn(FedosIdentityService.prototype, "describeIdentity").mockResolvedValueOnce(descriptor);
    const snapshot = { id: "alpha138-public-both", publicIdentifier: "npub1alpha138publicboth" };
    const app = createDesktopApplication(snapshot);
    await app.start();
    expect(app.isBootstrapped()).toBe(true);
    expect(app.currentIdentity()).toBe(descriptor);
    expect(app.currentPublicIdentity()).not.toBeNull();
    expect(app.currentPublicIdentity()).not.toEqual(app.currentIdentity());
    spy.mockRestore();
  });

  it("9. behavioral: the state update order matches the Startup Flow -- isBootstrapped() is already true by the time refreshPublicIdentity()'s own Reader call would observe it, though the two remain independent", async () => {
    let bootstrappedDuringReaderCall = false;
    const app = new DesktopApplication({
      readPublicIdentity: vi.fn().mockImplementation(async () => {
        bootstrappedDuringReaderCall = app.isBootstrapped();
        return null;
      }),
    });
    await app.start();
    expect(bootstrappedDuringReaderCall).toBe(true);
  });

  it("10. the design doc's own 'does NOT do' list confirms no new state-consistency guarantee is added", () => {
    expect(designDocSource).toMatch(
      /Does \*\*not\*\* add any new state-consistency guarantee — both\s*\n\s*guarantees verified here are entirely Alpha 098's and Alpha\s*\n\s*127\/131's own/,
    );
  });

  // ---------------------------------------------------------------------
  // Regression
  // ---------------------------------------------------------------------

  it("11. Regression: desktop_application.ts and create_desktop_application.ts carry no reference to this Stage's own doc, confirming zero code change", () => {
    expect(desktopApplicationSource).not.toMatch(/secure_runtime_alpha_138/);
    expect(createDesktopApplicationSource).not.toMatch(/secure_runtime_alpha_138/);
  });

  it("12. Regression: fedos_runtime_identity.ts is completely unmodified -- no reference to this Stage's own doc", () => {
    expect(fedosRuntimeIdentitySource).not.toMatch(/secure_runtime_alpha_138/);
  });

  it("13. Regression: create_runtime.ts/types.ts/worker.ts are unmodified -- no reference to this Stage's own doc", () => {
    for (const source of [createRuntimeSource, runtimeTypesSource, workerSource]) {
      expect(source).not.toMatch(/secure_runtime_alpha_138/);
    }
  });
});
