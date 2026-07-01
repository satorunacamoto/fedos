import { describe, it, expect } from "vitest";
import {
  NoopIdentityProvider,
  PlaceholderIdentityProvider,
} from "../src/identity/provider_boundary.js";
import {
  IDENTITY_PROVIDER_CAPABILITIES,
  type IdentityProviderRequest,
} from "../src/identity/provider_types.js";
import {
  identityProviderToPasskeyRequest,
  identityProviderToVaultRequest,
} from "../src/identity/provider_bridge.js";
// Identity provider sources as strings: prove no OAuth/JWT/WebAuthn import and
// type-only vault/passkey imports.
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import providerTypesSource from "../src/identity/provider_types.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import providerBoundarySource from "../src/identity/provider_boundary.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import providerBridgeSource from "../src/identity/provider_bridge.ts?raw";
// Runtime / Worker sources: prove the provider layer is NOT auto-wired.
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import runtimeSource from "../src/runtime/create_runtime.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import workerSource from "../src/worker.ts?raw";

const providerSources = [
  providerTypesSource,
  providerBoundarySource,
  providerBridgeSource,
].join("\n");

/**
 * Stage 37 — Identity Provider boundary tests.
 *
 * These assert the SEAM behaves as a boundary: it starts no sign-in, runs no
 * OAuth, parses/stores no JWT, calls no WebAuthn/Apple/Google API, makes no
 * seed/token/credential, never throws, never mutates input, imports no
 * OAuth/JWT/WebAuthn library, keeps vault/passkey imports type-only, and is not
 * wired into the core.
 */
describe("NoopIdentityProvider", () => {
  it("is unavailable", () => {
    expect(new NoopIdentityProvider().getStatus().status).toBe("unavailable");
  });

  it("begin starts no OAuth/JWT/WebAuthn and does not authenticate", () => {
    const report = new NoopIdentityProvider().begin({ kind: "apple" });
    expect(report.status).toBe("unavailable");
    expect(report.status).not.toBe("authenticated");
  });

  it("cancel only changes state and never throws", () => {
    const provider = new NoopIdentityProvider();
    expect(() => provider.cancel()).not.toThrow();
    expect(provider.cancel().status).toBe("unavailable");
  });

  it("advertises placeholder-or-empty capabilities only", () => {
    const caps = new NoopIdentityProvider().getCapabilities();
    for (const cap of caps) {
      expect(cap).toMatch(/_placeholder$/);
    }
    expect(caps).toEqual([]);
  });
});

describe("PlaceholderIdentityProvider", () => {
  it("constructor does nothing observable — starts idle", () => {
    expect(new PlaceholderIdentityProvider().getStatus().status).toBe("idle");
  });

  it("capabilities are all placeholders and match the declared set", () => {
    const caps = new PlaceholderIdentityProvider().getCapabilities();
    for (const cap of caps) {
      expect(cap).toMatch(/_placeholder$/);
    }
    expect(caps).toEqual(IDENTITY_PROVIDER_CAPABILITIES);
  });

  it("an Apple request creates no seed/key/token and holds no profile", () => {
    const report = new PlaceholderIdentityProvider().begin({
      kind: "apple",
      reference: "apple-handle",
    });
    for (const forbidden of [
      "seed",
      "key",
      "privateKey",
      "token",
      "jwt",
      "credential",
      "email",
      "profile",
    ]) {
      expect(report).not.toHaveProperty(forbidden);
    }
    // Only the opaque reference is echoed — never a secret.
    expect(report.reference).toBe("apple-handle");
  });

  it("a Google request creates no seed/key/token", () => {
    const report = new PlaceholderIdentityProvider().begin({ kind: "google" });
    for (const forbidden of ["seed", "key", "token", "jwt", "credential"]) {
      expect(report).not.toHaveProperty(forbidden);
    }
    expect(report.status).toBe("authenticated");
    expect(report.kind).toBe("google");
  });

  it("an External request carries the opaque reference only", () => {
    const report = new PlaceholderIdentityProvider().begin({
      kind: "external",
      reference: "opaque-ref",
    });
    // Report keys are limited to the coarse, non-sensitive snapshot fields.
    for (const key of Object.keys(report)) {
      expect(["status", "kind", "reference", "reason"]).toContain(key);
    }
    expect(report.reference).toBe("opaque-ref");
  });

  it("cancel moves to cancelled without throwing", () => {
    const provider = new PlaceholderIdentityProvider();
    provider.begin({ kind: "apple" });
    expect(() => provider.cancel()).not.toThrow();
    expect(provider.cancel().status).toBe("cancelled");
  });

  it("does not mutate the input request", () => {
    const provider = new PlaceholderIdentityProvider();
    const request: IdentityProviderRequest = { kind: "external", reference: "slot-1" };
    const snapshot = JSON.stringify(request);
    provider.begin(request);
    expect(JSON.stringify(request)).toBe(snapshot);
  });
});

describe("identity provider → passkey / vault bridges", () => {
  it("bridge to passkey request is pure and passes the opaque reference through", () => {
    const request: IdentityProviderRequest = { kind: "apple", reference: "ref-1" };
    const snapshot = JSON.stringify(request);
    expect(identityProviderToPasskeyRequest(request)).toEqual({
      kind: "apple_passkey",
      reference: "ref-1",
    });
    expect(JSON.stringify(request)).toBe(snapshot);
  });

  it("bridge to vault request is pure and passes the opaque reference through", () => {
    const request: IdentityProviderRequest = { kind: "apple", reference: "ref-1" };
    const snapshot = JSON.stringify(request);
    expect(identityProviderToVaultRequest(request)).toEqual({
      kind: "apple_id",
      reference: "ref-1",
    });
    expect(JSON.stringify(request)).toBe(snapshot);
  });

  it("maps every provider kind to a passkey and a vault factor", () => {
    expect(identityProviderToPasskeyRequest({ kind: "google" }).kind).toBe(
      "android_passkey",
    );
    expect(identityProviderToPasskeyRequest({ kind: "external" }).kind).toBe("external");
    expect(identityProviderToPasskeyRequest({ kind: "passkey" }).kind).toBe("webauthn");
    expect(identityProviderToVaultRequest({ kind: "google" }).kind).toBe("passkey");
    expect(identityProviderToVaultRequest({ kind: "external" }).kind).toBe(
      "external_signer",
    );
    expect(identityProviderToVaultRequest({ kind: "passkey" }).kind).toBe("passkey");
  });

  it("omits the reference when the input has none — derives nothing", () => {
    expect(identityProviderToPasskeyRequest({ kind: "apple" })).toEqual({
      kind: "apple_passkey",
    });
    expect(identityProviderToVaultRequest({ kind: "apple" })).toEqual({
      kind: "apple_id",
    });
  });

  it("bridges a provider report (kind carried) without throwing", () => {
    const report = new PlaceholderIdentityProvider().begin({
      kind: "external",
      reference: "r",
    });
    expect(() => identityProviderToPasskeyRequest(report)).not.toThrow();
    expect(() => identityProviderToVaultRequest(report)).not.toThrow();
    expect(identityProviderToVaultRequest(report).kind).toBe("external_signer");
  });
});

describe("src/identity provider has no key source and stays a boundary", () => {
  it("imports no OAuth / JWT / WebAuthn / crypto / auth library", () => {
    const importLines = providerSources
      .split("\n")
      .filter((line) => /^\s*import\b/.test(line));
    const denylist = [
      "../crypto/",
      "@noble",
      "node:crypto",
      "oauth",
      "openid",
      "jose",
      "jsonwebtoken",
      "jwt",
      "@simplewebauthn",
      "webauthn",
      "apple-sign",
      "google-auth",
      "googleapis",
      "passport",
    ];
    for (const line of importLines) {
      for (const pkg of denylist) {
        expect(line.toLowerCase()).not.toContain(pkg);
      }
    }
  });

  it("keeps the vault and passkey imports type-only", () => {
    const crossImportLines = providerBridgeSource
      .split("\n")
      .filter((line: string) => /^\s*import\b.*(vault\/types|\.\/types)/.test(line));
    expect(crossImportLines.length).toBeGreaterThan(0);
    for (const line of crossImportLines) {
      expect(line).toMatch(/^\s*import\s+type\b/);
    }
  });

  it("every declared placeholder capability ends in _placeholder", () => {
    for (const cap of IDENTITY_PROVIDER_CAPABILITIES) {
      expect(cap).toMatch(/_placeholder$/);
    }
  });
});

describe("identity provider layer is not auto-wired into the core", () => {
  it("Runtime source does not reference an identity provider", () => {
    expect(runtimeSource).not.toMatch(/identity|provider_boundary|IdentityProvider/i);
  });

  it("Worker source does not reference an identity provider", () => {
    expect(workerSource).not.toMatch(/identity|provider_boundary|IdentityProvider/i);
  });
});
