import { describe, it, expect } from "vitest";
import {
  NoopPasskeyBoundary,
  PlaceholderPasskeyBoundary,
} from "../src/identity/passkey_boundary.js";
import {
  PASSKEY_CAPABILITIES,
  type PasskeyAuthenticationRequest,
} from "../src/identity/types.js";
import { passkeyAuthenticationToVaultRequest } from "../src/identity/vault_bridge.js";
// Identity sources as strings: prove no crypto import and a type-only vault import.
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import identityTypesSource from "../src/identity/types.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import passkeyBoundarySource from "../src/identity/passkey_boundary.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import identityVaultBridgeSource from "../src/identity/vault_bridge.ts?raw";
// Runtime / Worker sources: prove the identity layer is NOT auto-wired.
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import runtimeSource from "../src/runtime/create_runtime.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import workerSource from "../src/worker.ts?raw";

const identitySources = [
  identityTypesSource,
  passkeyBoundarySource,
  identityVaultBridgeSource,
].join("\n");

/**
 * Stage 36 — Passkey Unlock boundary tests.
 *
 * These assert the SEAM behaves as a boundary: it starts no authentication, calls
 * no WebAuthn/Passkey/Apple API, launches no biometric, makes no seed/credential,
 * never throws, never mutates input, imports no crypto, keeps the vault import
 * type-only, and is not wired into the core.
 */
describe("NoopPasskeyBoundary", () => {
  it("constructor does nothing observable — starts unavailable", () => {
    const boundary = new NoopPasskeyBoundary();
    expect(boundary.getStatus().status).toBe("unavailable");
  });

  it("beginAuthentication starts no authentication and does not unlock", () => {
    const report = new NoopPasskeyBoundary().beginAuthentication({
      kind: "webauthn",
    });
    // Never reaches an authenticated/unlocked-looking state.
    expect(report.status).toBe("unavailable");
    expect(report.status).not.toBe("authenticated");
  });

  it("cancelAuthentication only changes state and never throws", () => {
    const boundary = new NoopPasskeyBoundary();
    expect(() => boundary.cancelAuthentication()).not.toThrow();
    expect(boundary.cancelAuthentication().status).toBe("unavailable");
  });

  it("advertises placeholder-or-empty capabilities only", () => {
    const caps = new NoopPasskeyBoundary().getCapabilities();
    for (const cap of caps) {
      expect(cap).toMatch(/_placeholder$/);
    }
    // The no-op default advertises nothing.
    expect(caps).toEqual([]);
  });
});

describe("PlaceholderPasskeyBoundary", () => {
  it("capabilities are all placeholders and match the declared set", () => {
    const caps = new PlaceholderPasskeyBoundary().getCapabilities();
    for (const cap of caps) {
      expect(cap).toMatch(/_placeholder$/);
    }
    expect(caps).toEqual(PASSKEY_CAPABILITIES);
  });

  it("an Apple passkey request creates no seed/key and holds no credential", () => {
    const boundary = new PlaceholderPasskeyBoundary();
    const report = boundary.beginAuthentication({
      kind: "apple_passkey",
      reference: "account-handle",
    });
    // The report carries only a coarse status + non-sensitive reason.
    expect(Object.keys(report).sort()).toEqual(["reason", "status"]);
    expect(report).not.toHaveProperty("seed");
    expect(report).not.toHaveProperty("key");
    expect(report).not.toHaveProperty("privateKey");
    // The reason must not echo the opaque reference.
    expect(report.reason).not.toContain("account-handle");
  });

  it("a WebAuthn request retains no credential/challenge/token", () => {
    const boundary = new PlaceholderPasskeyBoundary();
    const report = boundary.beginAuthentication({ kind: "webauthn" });
    for (const forbidden of ["credential", "challenge", "token", "jwt", "bytes"]) {
      expect(report).not.toHaveProperty(forbidden);
    }
    expect(report.status).toBe("authenticated");
  });

  it("cancelAuthentication moves to cancelled without throwing", () => {
    const boundary = new PlaceholderPasskeyBoundary();
    boundary.beginAuthentication({ kind: "passkey" as never });
    expect(() => boundary.cancelAuthentication()).not.toThrow();
    expect(boundary.cancelAuthentication().status).toBe("cancelled");
  });

  it("does not mutate the input request", () => {
    const boundary = new PlaceholderPasskeyBoundary();
    const request: PasskeyAuthenticationRequest = {
      kind: "android_passkey",
      reference: "slot-1",
    };
    const snapshot = JSON.stringify(request);
    boundary.beginAuthentication(request);
    expect(JSON.stringify(request)).toBe(snapshot);
  });
});

describe("passkey → vault unlock bridge", () => {
  it("is pure: maps kind and passes the opaque reference through unchanged", () => {
    const request: PasskeyAuthenticationRequest = {
      kind: "apple_passkey",
      reference: "opaque-ref",
    };
    const snapshot = JSON.stringify(request);
    const unlock = passkeyAuthenticationToVaultRequest(request);
    expect(unlock).toEqual({ kind: "passkey", reference: "opaque-ref" });
    // Input untouched.
    expect(JSON.stringify(request)).toBe(snapshot);
  });

  it("maps every authenticator kind to a vault unlock factor", () => {
    expect(passkeyAuthenticationToVaultRequest({ kind: "android_passkey" }).kind).toBe(
      "passkey",
    );
    expect(passkeyAuthenticationToVaultRequest({ kind: "webauthn" }).kind).toBe("passkey");
    expect(passkeyAuthenticationToVaultRequest({ kind: "external" }).kind).toBe(
      "external_signer",
    );
  });

  it("omits the reference when the request has none — derives nothing", () => {
    expect(passkeyAuthenticationToVaultRequest({ kind: "webauthn" })).toEqual({
      kind: "passkey",
    });
  });
});

describe("src/identity has no key source and stays a boundary", () => {
  it("imports no crypto / WebAuthn / auth library", () => {
    const importLines = identitySources
      .split("\n")
      .filter((line) => /^\s*import\b/.test(line));
    const denylist = [
      "../crypto/",
      "@noble",
      "node:crypto",
      "@simplewebauthn",
      "webauthn",
      "passkey",
      "apple",
      "google",
      "oauth",
      "jose",
      "jsonwebtoken",
      "tweetnacl",
      "libsodium",
    ];
    for (const line of importLines) {
      for (const pkg of denylist) {
        expect(line.toLowerCase()).not.toContain(pkg);
      }
    }
  });

  it("keeps the vault import type-only", () => {
    const vaultImportLines = identityVaultBridgeSource
      .split("\n")
      .filter((line: string) => /^\s*import\b.*vault\//.test(line));
    // There is a vault import, and every one of them is `import type`.
    expect(vaultImportLines.length).toBeGreaterThan(0);
    for (const line of vaultImportLines) {
      expect(line).toMatch(/^\s*import\s+type\b/);
    }
  });

  it("every declared placeholder capability ends in _placeholder", () => {
    for (const cap of PASSKEY_CAPABILITIES) {
      expect(cap).toMatch(/_placeholder$/);
    }
  });
});

describe("passkey unlock boundary is not auto-executed by the core", () => {
  // Stage 62 lets `createRuntime` SELECT a `WebAuthnProvider`, which lives under
  // `src/identity/`, so an `identity/` import path and a "Passkey" mention in a
  // comment are now expected. What must stay absent is the Stage 36
  // `PasskeyBoundary` itself and any unlock EXECUTION (`authenticate(`).
  it("Runtime source does not wire or execute the PasskeyBoundary", () => {
    expect(runtimeSource).not.toMatch(/passkey_boundary|PasskeyBoundary/);
    expect(runtimeSource).not.toMatch(/\.\s*authenticate\s*\(/);
  });

  it("Worker source does not wire or execute the PasskeyBoundary", () => {
    expect(workerSource).not.toMatch(/passkey_boundary|PasskeyBoundary/);
    expect(workerSource).not.toMatch(/\.\s*authenticate\s*\(/);
  });
});
