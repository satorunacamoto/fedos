import { describe, it, expect } from "vitest";
import {
  ENTITLEMENT_KINDS,
  NoopEntitlementProvider,
} from "../src/os/commerce/creator/entitlement.js";
import type {
  EntitlementCheckRequest,
  EntitlementDecision,
  EntitlementProvider,
} from "../src/os/commerce/creator/entitlement.js";
import {
  createRuntime,
  selectCreatorEntitlementProvider,
} from "../src/os/_legacy_prototype/runtime/create_runtime.js";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import entitlementSource from "../src/os/commerce/creator/entitlement.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import runtimeSource from "../src/os/_legacy_prototype/runtime/create_runtime.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import workerSource from "../src/os/_legacy_prototype/worker.ts?raw";

const cleanRequest: EntitlementCheckRequest = {
  kind: "digital_access_placeholder",
  subjectRef: "user-1",
  resourceRef: "resource-1",
};

describe("NoopEntitlementProvider", () => {
  it("1. is always unavailable and never grants access", () => {
    const provider = new NoopEntitlementProvider();
    const status = provider.status();
    expect(status.allowed).toBe(false);
    expect(status.state).toBe("unavailable");
  });

  it("2. checkPlaceholder denies for every kind", async () => {
    const provider = new NoopEntitlementProvider();
    for (const kind of ENTITLEMENT_KINDS) {
      const decision = await provider.checkPlaceholder({ kind });
      expect(decision.allowed).toBe(false);
      expect(decision.state).toBe("unavailable");
    }
  });

  it("3. never throws", async () => {
    const provider = new NoopEntitlementProvider();
    expect(() => provider.status()).not.toThrow();
    await expect(provider.checkPlaceholder(cleanRequest)).resolves.toBeDefined();
  });

  it("4. does not mutate its input", async () => {
    const provider = new NoopEntitlementProvider();
    const snapshot = JSON.stringify(cleanRequest);
    await provider.checkPlaceholder(cleanRequest);
    expect(JSON.stringify(cleanRequest)).toBe(snapshot);
  });
});

describe("EntitlementProvider labels", () => {
  it("5. every entitlement kind is a placeholder label", () => {
    for (const kind of ENTITLEMENT_KINDS) {
      expect(kind).toMatch(/_placeholder$/);
    }
  });
});

describe("Stage 111 — Creator entitlement provider runtime selection", () => {
  it("6. no overrides -> NoopEntitlementProvider", () => {
    expect(selectCreatorEntitlementProvider()).toBeInstanceOf(NoopEntitlementProvider);
    expect(createRuntime().creatorEntitlementProvider).toBeInstanceOf(NoopEntitlementProvider);
  });

  it("7. overrides.creatorEntitlementProvider wins", () => {
    const stub = new NoopEntitlementProvider();
    expect(
      selectCreatorEntitlementProvider(undefined, { creatorEntitlementProvider: stub }),
    ).toBe(stub);
    expect(
      createRuntime(undefined, { creatorEntitlementProvider: stub }).creatorEntitlementProvider,
    ).toBe(stub);
  });

  it("8. createRuntime does not call checkPlaceholder", async () => {
    let checkCalls = 0;
    const spy: EntitlementProvider = {
      status: (): EntitlementDecision => ({ allowed: false, state: "unavailable" }),
      checkPlaceholder: async (_r: EntitlementCheckRequest): Promise<EntitlementDecision> => {
        checkCalls += 1;
        return { allowed: false, state: "unavailable" };
      },
    };
    const rt = createRuntime(undefined, { creatorEntitlementProvider: spy });
    expect(rt.creatorEntitlementProvider).toBe(spy);
    expect(checkCalls).toBe(0);
  });

  it("9. Worker source does not select or call an EntitlementProvider", () => {
    expect(workerSource).not.toMatch(/EntitlementProvider/);
    expect(workerSource).not.toMatch(/NoopEntitlementProvider/);
    expect(workerSource).not.toMatch(/\.checkPlaceholder\s*\(/);
  });
});

describe("creator entitlement boundary never grants and stays decoupled", () => {
  it("10. no implementation in this stage ever returns allowed: true", async () => {
    const provider = new NoopEntitlementProvider();
    for (const kind of ENTITLEMENT_KINDS) {
      for (let i = 0; i < 3; i++) {
        const decision = await provider.checkPlaceholder({ kind, subjectRef: `s${i}` });
        expect(decision.allowed).toBe(false);
      }
    }
  });

  it("11. does not construct or reference a PurchaseGrant", () => {
    // Doc comments legitimately NAME `PurchaseGrant` when explaining that
    // this boundary does not issue one; the real invariant is no
    // import/construction.
    expect(entitlementSource).not.toMatch(/from\s+['"].*commerce\//);
    expect(entitlementSource).not.toMatch(/:\s*PurchaseGrant\b/);
    expect(entitlementSource).not.toMatch(/new\s+PurchaseGrant\b/);
  });

  it("12. does not import PaymentProvider or MarketplaceProvider", () => {
    expect(entitlementSource).not.toMatch(/from\s+['"].*payment\//);
    expect(entitlementSource).not.toMatch(/from\s+['"].*marketplace\//);
    expect(entitlementSource).not.toMatch(/:\s*(PaymentProvider|MarketplaceProvider)\b/);
  });

  it("13. does not import StorageBackend or any CryptoProvider, and issues no fetch", () => {
    expect(entitlementSource).not.toMatch(/from\s+['"].*storage\//);
    expect(entitlementSource).not.toMatch(/from\s+['"].*crypto\//);
    expect(entitlementSource).not.toMatch(/:\s*(StorageBackend|CryptoProvider)\b/);
    expect(entitlementSource).not.toMatch(/\bfetch\s*\(/);
  });

  it("14. Runtime source does not issue a grant for entitlement selection", () => {
    expect(runtimeSource).not.toMatch(/checkPlaceholder\s*\(/);
  });
});
