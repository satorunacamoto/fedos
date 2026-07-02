import { describe, it, expect } from "vitest";
import {
  NoopWebAuthnProvider,
  PlaceholderWebAuthnProvider,
  WEBAUTHN_ADAPTER_CAPABILITIES,
  webauthnReportToPasskeyRequest,
  type WebAuthnAdapterRequest,
} from "../src/identity/webauthn_adapter.js";
// Adapter source as a string: prove no browser-credential API / crypto import.
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import webauthnAdapterSource from "../src/identity/webauthn_adapter.ts?raw";
// Runtime / Worker sources: prove the WebAuthn adapter is NOT auto-wired.
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import runtimeSource from "../src/runtime/create_runtime.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import workerSource from "../src/worker.ts?raw";

/**
 * Stage 60 — WebAuthn / Passkey provider adapter skeleton tests.
 *
 * These assert the SEAM behaves as a boundary: it calls no browser credential
 * API, launches no biometric, stores no challenge/credential, never throws,
 * never mutates input, imports no crypto/WebAuthn library, bridges purely to a
 * Passkey request, and is not wired into the core.
 */
describe("NoopWebAuthnProvider", () => {
  it("1. is permanently unavailable and advertises nothing", () => {
    const provider = new NoopWebAuthnProvider();
    expect(provider.getStatus().status).toBe("unavailable");
    expect(provider.getCapabilities()).toEqual([]);
    // Begin never reaches an authenticated-looking state.
    const report = provider.begin({ kind: "get" });
    expect(report.status).toBe("unavailable");
    expect(report.status).not.toBe("authenticated_placeholder");
  });
});

describe("PlaceholderWebAuthnProvider", () => {
  it("2. constructor does nothing observable — starts idle", () => {
    const provider = new PlaceholderWebAuthnProvider();
    expect(provider.getStatus().status).toBe("idle");
    const caps = provider.getCapabilities();
    for (const cap of caps) expect(cap).toMatch(/_placeholder$/);
    expect(caps).toEqual(WEBAUTHN_ADAPTER_CAPABILITIES);
  });

  it("3. begin does not call a browser credential API (no throw in node, no navigator use)", () => {
    // In the node test env there is no `navigator`; if begin touched a browser
    // credential API it would throw. It does not — proving no API call.
    const provider = new PlaceholderWebAuthnProvider();
    expect(() => provider.begin({ kind: "get" })).not.toThrow();
    expect(() => provider.begin({ kind: "create" })).not.toThrow();
    // Source-level proof: the adapter never names the browser credential API.
    expect(webauthnAdapterSource).not.toContain("navigator.credentials");
    expect(webauthnAdapterSource).not.toMatch(/navigator\s*\.\s*credentials/);
  });

  it("4. a create request stores no challenge / attestation", () => {
    const provider = new PlaceholderWebAuthnProvider();
    const report = provider.begin({
      kind: "create",
      reference: "slot-1",
      rpIdRef: "rp-label",
      userRef: "user-label",
    });
    expect(Object.keys(report).sort()).toEqual(["reason", "status"]);
    for (const forbidden of [
      "challenge",
      "attestation",
      "response",
      "rawId",
      "credential",
      "publicKey",
      "bytes",
    ]) {
      expect(report).not.toHaveProperty(forbidden);
    }
    expect(report.status).toBe("authenticated_placeholder");
    // The reason must not echo any opaque label.
    expect(report.reason).not.toContain("slot-1");
    expect(report.reason).not.toContain("rp-label");
    expect(report.reason).not.toContain("user-label");
  });

  it("5. a get request stores no credential id / assertion", () => {
    const provider = new PlaceholderWebAuthnProvider();
    const report = provider.begin({ kind: "get", reference: "cred-slot" });
    for (const forbidden of [
      "credentialId",
      "credential",
      "assertion",
      "rawId",
      "response",
      "signature",
      "token",
    ]) {
      expect(report).not.toHaveProperty(forbidden);
    }
    expect(report.reason).not.toContain("cred-slot");
  });

  it("6. cancel changes state only and never throws", () => {
    const provider = new PlaceholderWebAuthnProvider();
    provider.begin({ kind: "get" });
    expect(() => provider.cancel()).not.toThrow();
    const report = provider.cancel();
    expect(report.status).toBe("cancelled");
    expect(Object.keys(report).sort()).toEqual(["reason", "status"]);
  });

  it("9. no method throws", () => {
    const provider = new PlaceholderWebAuthnProvider();
    expect(() => provider.getStatus()).not.toThrow();
    expect(() => provider.getCapabilities()).not.toThrow();
    expect(() => provider.begin({ kind: "create" })).not.toThrow();
    expect(() => provider.cancel()).not.toThrow();
  });
});

describe("webauthnReportToPasskeyRequest bridge", () => {
  it("7. is pure: maps to the webauthn unlock trigger, passing the opaque reference through", () => {
    const request: WebAuthnAdapterRequest = {
      kind: "get",
      reference: "opaque-ref",
      rpIdRef: "rp-label",
      userRef: "user-label",
    };
    const snapshot = JSON.stringify(request);
    const passkeyRequest = webauthnReportToPasskeyRequest(request);
    // WebAuthn is an unlock TRIGGER, never a key source; kind is webauthn.
    expect(passkeyRequest.kind).toBe("webauthn");
    // Only the opaque reference crosses over; rpIdRef/userRef are not forwarded.
    expect(passkeyRequest).toEqual({ kind: "webauthn", reference: "opaque-ref" });
    // Input untouched.
    expect(JSON.stringify(request)).toBe(snapshot);
  });

  it("both get and create map to the webauthn trigger; reference omitted when absent", () => {
    expect(webauthnReportToPasskeyRequest({ kind: "create" })).toEqual({
      kind: "webauthn",
    });
    expect(webauthnReportToPasskeyRequest({ kind: "get" })).toEqual({
      kind: "webauthn",
    });
  });

  it("produces only the webauthn/external triggers, never a platform passkey", () => {
    const kind = webauthnReportToPasskeyRequest({ kind: "get" }).kind;
    expect(["webauthn", "external"]).toContain(kind);
    expect(kind).not.toBe("apple_passkey");
    expect(kind).not.toBe("android_passkey");
  });
});

describe("WebAuthn adapter input is never mutated", () => {
  it("8. begin and the bridge leave the request untouched", () => {
    const provider = new PlaceholderWebAuthnProvider();
    const request: WebAuthnAdapterRequest = {
      kind: "create",
      reference: "slot",
      rpIdRef: "rp",
      userRef: "user",
    };
    const snapshot = JSON.stringify(request);
    provider.begin(request);
    webauthnReportToPasskeyRequest(request);
    expect(JSON.stringify(request)).toBe(snapshot);
  });
});

describe("WebAuthn adapter stays a boundary (no key source, no API)", () => {
  it("12. does not use a browser credential API", () => {
    expect(webauthnAdapterSource).not.toContain("navigator.credentials");
    expect(webauthnAdapterSource).not.toMatch(/navigator\s*\.\s*credentials/);
    expect(webauthnAdapterSource).not.toContain("PublicKeyCredential");
    expect(webauthnAdapterSource).not.toContain("getPublicKey");
  });

  it("13. imports no WebAuthn / credential library", () => {
    const importLines = webauthnAdapterSource
      .split("\n")
      .filter((line: string) => /^\s*import\b/.test(line));
    const denylist = [
      "@simplewebauthn",
      "webauthn",
      "fido",
      "passkey",
      "jose",
      "jsonwebtoken",
      "oauth",
      "apple",
      "google",
    ];
    for (const line of importLines) {
      for (const pkg of denylist) {
        expect(line.toLowerCase(), `import must not pull in ${pkg}`).not.toContain(
          pkg,
        );
      }
    }
  });

  it("14. imports no crypto library", () => {
    const importLines = webauthnAdapterSource
      .split("\n")
      .filter((line: string) => /^\s*import\b/.test(line));
    const denylist = [
      "../crypto/",
      "@noble",
      "node:crypto",
      "tweetnacl",
      "libsodium",
      "chacha20poly1305",
    ];
    for (const line of importLines) {
      for (const pkg of denylist) {
        expect(line.toLowerCase()).not.toContain(pkg);
      }
    }
    // The only import is the type-only Passkey types dependency.
    expect(webauthnAdapterSource).toMatch(
      /import\s+type\s*\{[\s\S]*?\}\s*from\s*["']\.\/types\.js["']/,
    );
    // No value (non-type) import from the passkey types module.
    expect(webauthnAdapterSource).not.toMatch(
      /import\s*\{[\s\S]*?\}\s*from\s*["']\.\/types\.js["']/,
    );
  });
});

describe("WebAuthn adapter is SELECTED but never executed by the core", () => {
  // Stage 62 lets `createRuntime` SELECT a `WebAuthnProvider` from env — so the
  // Runtime/Worker sources now legitimately reference WebAuthn. What must stay
  // absent is any EXECUTION: no `begin`/`cancel` auto-call and no browser
  // credential API. (See `test/runtime_webauthn_env.test.ts` for the full
  // selection-boundary coverage.)
  it("10. Runtime source selects a WebAuthn provider but never begins/cancels one", () => {
    expect(runtimeSource).not.toMatch(/\.\s*begin\s*\(/);
    expect(runtimeSource).not.toMatch(/webAuthnProvider\s*\.\s*cancel\s*\(/);
    expect(runtimeSource).not.toContain("navigator.credentials");
    expect(runtimeSource).not.toMatch(/navigator\s*\.\s*credentials/);
  });

  it("11. Worker source never begins/cancels a WebAuthn provider or calls a browser credential API", () => {
    expect(workerSource).not.toMatch(/webAuthnProvider\s*\.\s*begin\s*\(/);
    expect(workerSource).not.toMatch(/webAuthnProvider\s*\.\s*cancel\s*\(/);
    expect(workerSource).not.toMatch(/new\s+PlaceholderWebAuthnProvider/);
    expect(workerSource).not.toContain("navigator.credentials");
    expect(workerSource).not.toMatch(/navigator\s*\.\s*credentials/);
  });
});
