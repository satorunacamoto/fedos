import { describe, it, expect, vi } from "vitest";
import { DesktopApplication } from "../src/desktop/desktop_application.js";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import designDocSource from "../docs/secure_runtime_alpha_133_refresh_state_verification.md?raw";
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
 * Secure Runtime Alpha 133 -- "Refresh State Verification": Stage 3 of
 * the Desktop Public Identity Refresh Arc, a REVIEW / DESIGN ONLY
 * Stage. Verifies, by exercising real code, that
 * refreshPublicIdentity()'s own effect on currentPublicIdentity() is
 * identical to readPublicIdentity()'s own effect -- success updates
 * State, failure leaves it untouched.
 */
describe("Secure Runtime Alpha 133 -- Refresh State Verification", () => {
  it("1. the design doc exists and is substantial", () => {
    expect(typeof designDocSource).toBe("string");
    expect(designDocSource.length).toBeGreaterThan(1500);
  });

  it("2. the design doc declares itself REVIEW / DESIGN ONLY, with no code change of any kind", () => {
    expect(designDocSource).toMatch(/this Stage is REVIEW \/ DESIGN ONLY/);
    expect(designDocSource).toMatch(/It makes NO code change/);
  });

  it("3. the design doc declares a single Decision -- refreshPublicIdentity()'s own effect on State is identical to readPublicIdentity()'s own", () => {
    const section = (designDocSource.match(/## 3\. Decision([\s\S]*?)\n## 4\./) ?? [])[1] ?? "";
    expect(section).toMatch(
      /\*\*`refreshPublicIdentity\(\)`'s own effect on `currentPublicIdentity\(\)`\s*\nis IDENTICAL to `readPublicIdentity\(\)`'s own effect —/,
    );
  });

  it("4. the design doc cross-references Alpha 127, Alpha 128, and Alpha 132", () => {
    for (const ref of [
      "secure_runtime_alpha_127_reader_result_persistence",
      "secure_runtime_alpha_128_desktop_public_identity_reader",
      "secure_runtime_alpha_132_refresh_delegation",
    ]) {
      expect(designDocSource).toContain(ref);
    }
  });

  // ---------------------------------------------------------------------
  // Behavioral: real execution, both directions
  // ---------------------------------------------------------------------

  it("5. behavioral: on success, currentPublicIdentity() reflects the exact value refreshPublicIdentity() resolved, by reference", async () => {
    const descriptor = { id: "alpha133-success", provider: "nostr", publicIdentifier: "npub1alpha133success" };
    const customReader = { readPublicIdentity: vi.fn().mockResolvedValue(descriptor) };
    const app = new DesktopApplication(customReader);
    expect(app.currentPublicIdentity()).toBeNull();
    const resolved = await app.refreshPublicIdentity();
    expect(app.currentPublicIdentity()).toBe(resolved);
    expect(app.currentPublicIdentity()).toBe(descriptor);
  });

  it("6. behavioral: on failure, currentPublicIdentity() is left completely unchanged from its own prior value", async () => {
    const customReader = { readPublicIdentity: vi.fn().mockRejectedValueOnce(new Error("simulated Reader failure")) };
    const app = new DesktopApplication(customReader);
    await expect(app.refreshPublicIdentity()).rejects.toThrow("simulated Reader failure");
    expect(app.currentPublicIdentity()).toBeNull();
  });

  it("7. behavioral: on failure AFTER a prior success, currentPublicIdentity() retains the prior successful value -- not cleared, not overwritten", async () => {
    const priorDescriptor = { id: "alpha133-prior", provider: "nostr", publicIdentifier: "npub1alpha133prior" };
    const customReader = {
      readPublicIdentity: vi
        .fn()
        .mockResolvedValueOnce(priorDescriptor)
        .mockRejectedValueOnce(new Error("simulated second-refresh failure")),
    };
    const app = new DesktopApplication(customReader);
    await app.refreshPublicIdentity();
    expect(app.currentPublicIdentity()).toBe(priorDescriptor);
    await expect(app.refreshPublicIdentity()).rejects.toThrow("simulated second-refresh failure");
    expect(app.currentPublicIdentity()).toBe(priorDescriptor);
  });

  it("8. behavioral: a resolved null via refreshPublicIdentity() persists as null, exactly like readPublicIdentity()'s own contract", async () => {
    const priorDescriptor = { id: "alpha133-cleared", provider: "nostr", publicIdentifier: "npub1alpha133cleared" };
    const customReader = {
      readPublicIdentity: vi.fn().mockResolvedValueOnce(priorDescriptor).mockResolvedValueOnce(null),
    };
    const app = new DesktopApplication(customReader);
    await app.refreshPublicIdentity();
    expect(app.currentPublicIdentity()).toBe(priorDescriptor);
    await app.refreshPublicIdentity();
    expect(app.currentPublicIdentity()).toBeNull();
  });

  it("9. behavioral: multiple successive successful refreshes each update State to their own latest value", async () => {
    const first = { id: "alpha133-first", provider: "nostr", publicIdentifier: "npub1alpha133first" };
    const second = { id: "alpha133-second", provider: "nostr", publicIdentifier: "npub1alpha133second" };
    const customReader = { readPublicIdentity: vi.fn().mockResolvedValueOnce(first).mockResolvedValueOnce(second) };
    const app = new DesktopApplication(customReader);
    await app.refreshPublicIdentity();
    expect(app.currentPublicIdentity()).toBe(first);
    await app.refreshPublicIdentity();
    expect(app.currentPublicIdentity()).toBe(second);
  });

  it("10. the design doc's own 'does NOT do' list confirms no new persistence logic is added", () => {
    expect(designDocSource).toMatch(
      /Does \*\*not\*\* add any new persistence logic — the guarantee verified\s*\n\s*here is entirely Alpha 127's own/,
    );
  });

  // ---------------------------------------------------------------------
  // Regression
  // ---------------------------------------------------------------------

  it("11. Regression: desktop_application.ts and create_desktop_application.ts carry no reference to this Stage's own doc, confirming zero code change", () => {
    expect(desktopApplicationSource).not.toMatch(/secure_runtime_alpha_133/);
    expect(createDesktopApplicationSource).not.toMatch(/secure_runtime_alpha_133/);
  });

  it("12. Regression: fedos_runtime_identity.ts is completely unmodified -- no reference to this Stage's own doc", () => {
    expect(fedosRuntimeIdentitySource).not.toMatch(/secure_runtime_alpha_133/);
  });

  it("13. Regression: create_runtime.ts/types.ts/worker.ts are unmodified -- no reference to this Stage's own doc", () => {
    for (const source of [createRuntimeSource, runtimeTypesSource, workerSource]) {
      expect(source).not.toMatch(/secure_runtime_alpha_133/);
    }
  });
});
