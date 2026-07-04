import { describe, it, expect } from "vitest";
import {
  reviewEncryptedPayloadDescriptor,
  reviewPayloadPreview,
  type EncryptedPayloadDescriptor,
  type PayloadPreviewDescriptor,
} from "../src/storage/encrypted_payload.js";
// Source-level checks: prove no payload/plaintext/raw-key field and no wiring.
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import encryptedPayloadSource from "../src/storage/encrypted_payload.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import storageTypesSource from "../src/storage/types.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import noopStorageSource from "../src/storage/noop_storage.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import federationTypesSource from "../src/federation/types.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import runtimeSource from "../src/runtime/create_runtime.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import workerSource from "../src/worker.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import packageJsonSource from "../package.json?raw";

/**
 * Stage 182–185 — "Ciphertext serialization format decision + TypeScript
 * encrypted payload descriptor + NIP-44 vector readiness review."
 *
 * `src/storage/encrypted_payload.ts` (new) adds a LABEL-ONLY, METADATA-ONLY
 * `EncryptedPayloadDescriptor` boundary + a pure
 * `reviewEncryptedPayloadDescriptor` — no payload byte, ciphertext byte,
 * plaintext, or raw key field of any kind; rejects buyer/payment/
 * entitlement and chat/DM/private metadata; never mutates its input; not
 * wired to `StorageBackend`/`FederationProvider`/Runtime/Worker. This
 * stage is planning/skeleton/docs/guards ONLY — no real serialization
 * implementation, no NIP-44 implementation, no Rust↔TypeScript/WASM
 * bridge, no Storage/Federation/Nostr/Runtime/Worker connection, no
 * `package.json`/`Cargo.toml` change — every one of those is verified
 * absent below.
 */
describe("Encrypted payload descriptor boundary (Stage 182–185)", () => {
  const cleanDescriptor: EncryptedPayloadDescriptor = {
    version: "v1",
    algorithm: "chacha20poly1305",
    encoding: "canonical_json_base64url_placeholder",
    transportKind: "storage",
    idRef: "encrypted-payload-label-1",
    metadata: { note: "sample", size: "small" },
  };

  it("1. accepts a clean descriptor as accepted_placeholder", () => {
    const decision = reviewEncryptedPayloadDescriptor(cleanDescriptor);
    expect(decision.allowed).toBe(true);
    expect(decision.state).toBe("accepted_placeholder");
  });

  it("2. accepts a descriptor with no idRef/metadata at all", () => {
    const minimal: EncryptedPayloadDescriptor = {
      version: "v1",
      algorithm: "aes256gcm",
      encoding: "undecided",
      transportKind: "nostr_event",
    };
    const decision = reviewEncryptedPayloadDescriptor(minimal);
    expect(decision.allowed).toBe(true);
  });

  it("3. rejects an idRef that looks like a URL or file path", () => {
    for (const idRef of [
      "https://example.com/payload",
      "/etc/passwd",
      "C:\\Users\\me\\payload.bin",
      "https://drive.google.com/file/x",
    ]) {
      const decision = reviewEncryptedPayloadDescriptor({ ...cleanDescriptor, idRef });
      expect(decision.allowed, `expected rejection for idRef: ${idRef}`).toBe(false);
      expect(decision.state).toBe("rejected");
    }
  });

  it("4. rejects sensitive metadata (secret/key/seed/token)", () => {
    const cases: Record<string, string>[] = [
      { secretValue: "x" },
      { apiKey: "x" },
      { seedPhrase: "x" },
      { authToken: "x" },
      { note: "this contains a secret" },
    ];
    for (const metadata of cases) {
      const decision = reviewEncryptedPayloadDescriptor({ ...cleanDescriptor, metadata });
      expect(decision.allowed, `expected rejection for metadata: ${JSON.stringify(metadata)}`).toBe(
        false,
      );
    }
  });

  it("5. rejects buyer/payment/entitlement metadata", () => {
    const cases: Record<string, string>[] = [
      { buyerId: "u1" },
      { paymentRef: "p1" },
      { entitlementId: "e1" },
      { note: "buyer paid for this entitlement" },
    ];
    for (const metadata of cases) {
      const decision = reviewEncryptedPayloadDescriptor({ ...cleanDescriptor, metadata });
      expect(decision.allowed, `expected rejection for metadata: ${JSON.stringify(metadata)}`).toBe(
        false,
      );
    }
  });

  it("6. rejects chat/DM/private metadata", () => {
    const cases: Record<string, string>[] = [
      { chatRoom: "r1" },
      { dmThread: "t1" },
      { privateNote: "n1" },
      { messageBody: "hello" },
      { content: "hello" },
    ];
    for (const metadata of cases) {
      const decision = reviewEncryptedPayloadDescriptor({ ...cleanDescriptor, metadata });
      expect(decision.allowed, `expected rejection for metadata: ${JSON.stringify(metadata)}`).toBe(
        false,
      );
    }
  });

  it("7. is pure: never mutates the input descriptor", () => {
    const input: EncryptedPayloadDescriptor = {
      ...cleanDescriptor,
      metadata: { note: "sample" },
    };
    const snapshot = JSON.parse(JSON.stringify(input));
    reviewEncryptedPayloadDescriptor(input);
    expect(input).toEqual(snapshot);
  });

  it("8. never throws, even for a maximally hostile metadata object", () => {
    expect(() =>
      reviewEncryptedPayloadDescriptor({
        ...cleanDescriptor,
        idRef: "",
        metadata: {},
      }),
    ).not.toThrow();
  });

  it("9. EncryptedPayloadDescriptor has no payload byte, ciphertext byte, plaintext, or raw key field", () => {
    const interfaceMatch = encryptedPayloadSource.match(
      /interface\s+EncryptedPayloadDescriptor\s*\{([\s\S]*?)\}/,
    );
    expect(interfaceMatch, "expected to find the EncryptedPayloadDescriptor interface").not.toBeNull();
    const body = interfaceMatch![1] ?? "";
    for (const forbidden of [/\bplaintext\b/i, /\bpayload\s*:/i, /\bciphertext\b/i, /\brawKey\b/i, /\bbytes\b/i, /\bkey\s*:/i]) {
      expect(body).not.toMatch(forbidden);
    }
  });

  it("10. no Serialize/encode/decode implementation exists in this file: no JSON.stringify/atob/btoa/base64 codec", () => {
    expect(encryptedPayloadSource).not.toMatch(/\bJSON\.parse\s*\(/);
    expect(encryptedPayloadSource).not.toMatch(/\bJSON\.stringify\s*\(/);
    expect(encryptedPayloadSource).not.toMatch(/\batob\s*\(/);
    expect(encryptedPayloadSource).not.toMatch(/\bbtoa\s*\(/);
    expect(encryptedPayloadSource).not.toMatch(/base64url?Encode|encodeBase64|decodeBase64/i);
  });

  it("11. no NIP-44 implementation reference in this file", () => {
    expect(encryptedPayloadSource).not.toMatch(/\bnip.?44\b/i);
    expect(encryptedPayloadSource).not.toMatch(/conversation.key/i);
    expect(encryptedPayloadSource).not.toMatch(/secp256k1/i);
  });

  it("12. not wired to StorageBackend, FederationProvider, Runtime, or Worker in any way", () => {
    expect(encryptedPayloadSource).not.toMatch(/from\s+["']\.\/noop_storage/);
    expect(encryptedPayloadSource).not.toMatch(/from\s+["'].*federation/);
    expect(encryptedPayloadSource).not.toMatch(/from\s+["'].*runtime/);
    expect(encryptedPayloadSource).not.toMatch(/from\s+["'].*worker/);
    for (const src of [storageTypesSource, noopStorageSource, federationTypesSource, runtimeSource, workerSource]) {
      expect(src).not.toMatch(/encrypted_payload|EncryptedPayloadDescriptor|reviewEncryptedPayloadDescriptor/);
    }
  });

  it("13. package.json is unchanged — no new dependency, still 2 production dependencies, no base64/serialization library", () => {
    const pkg = JSON.parse(packageJsonSource);
    expect(Object.keys(pkg.dependencies ?? {}).length).toBe(2);
    expect(Object.keys(pkg.dependencies ?? {}).sort()).toEqual(["@noble/curves", "@noble/hashes"]);
    for (const dep of Object.keys(pkg.dependencies ?? {})) {
      expect(dep.toLowerCase()).not.toMatch(/base64|cbor|msgpack/);
    }
  });

  it("14. EncryptedPayloadEncoding/EncryptedPayloadAlgorithm/EncryptedPayloadTransportKind are exactly the expected label unions", () => {
    expect(encryptedPayloadSource).toMatch(
      /type\s+EncryptedPayloadEncoding\s*=\s*"undecided"\s*\|\s*"canonical_json_base64url_placeholder"/,
    );
    expect(encryptedPayloadSource).toMatch(
      /type\s+EncryptedPayloadAlgorithm\s*=\s*"chacha20poly1305"\s*\|\s*"aes256gcm"/,
    );
    expect(encryptedPayloadSource).toMatch(
      /type\s+EncryptedPayloadTransportKind\s*=\s*"storage"\s*\|\s*"nostr_event"/,
    );
  });
});

/**
 * Stage 189–191 — the PREVIEW/DIAGNOSTICS extension to this same boundary
 * file: `PayloadPreviewDescriptor`, `PayloadDiagnosticsDescriptor`, and a
 * pure `reviewPayloadPreview`. Neither new descriptor type carries a
 * `bytes`/`Uint8Array`/`ArrayBuffer`/ciphertext/plaintext/nonce/key/secret
 * field, or a `metadata` dictionary of any kind — there is nothing for a
 * future field to leak buyer/payment/chat/entitlement content through.
 */
describe("Payload preview/diagnostics descriptor boundary (Stage 189–191)", () => {
  const previewDescriptor: PayloadPreviewDescriptor = {
    version: "v1",
    algorithm: "chacha20poly1305",
    aadDomain: "conversation",
    encoding: "canonical_json_base64url_placeholder",
    transportKind: "storage",
    status: "valid_placeholder",
    payloadId: "payload-ref-1",
  };

  it("1. reviewPayloadPreview accepts a clean descriptor as accepted_placeholder", () => {
    const decision = reviewPayloadPreview(previewDescriptor);
    expect(decision.allowed).toBe(true);
    expect(decision.state).toBe("accepted_placeholder");
  });

  it("2. reviewPayloadPreview accepts a descriptor with no payloadId at all", () => {
    const { payloadId, ...rest } = previewDescriptor;
    const decision = reviewPayloadPreview(rest);
    expect(decision.allowed).toBe(true);
  });

  it("3. reviewPayloadPreview rejects a payloadId that looks like a URL or file path", () => {
    for (const payloadId of [
      "https://example.com/payload",
      "/etc/passwd",
      "C:\\Users\\me\\payload.bin",
    ]) {
      const decision = reviewPayloadPreview({ ...previewDescriptor, payloadId });
      expect(decision.allowed, `expected rejection for payloadId: ${payloadId}`).toBe(false);
      expect(decision.state).toBe("rejected");
    }
  });

  it("4. reviewPayloadPreview is pure: never mutates the input, never throws", () => {
    const input = { ...previewDescriptor };
    const snapshot = JSON.parse(JSON.stringify(input));
    expect(() => reviewPayloadPreview(input)).not.toThrow();
    expect(input).toEqual(snapshot);
  });

  it("5. PayloadPreviewDescriptor has no bytes/Uint8Array/ArrayBuffer/ciphertext/plaintext/nonce/key/secret field, and no metadata dictionary at all", () => {
    const interfaceMatch = encryptedPayloadSource.match(
      /interface\s+PayloadPreviewDescriptor\s*\{([\s\S]*?)\}/,
    );
    expect(interfaceMatch, "expected to find the PayloadPreviewDescriptor interface").not.toBeNull();
    const body = interfaceMatch![1] ?? "";
    for (const forbidden of [
      /\bbytes\b/i,
      /\bUint8Array\b/,
      /\bArrayBuffer\b/,
      /\bciphertext\b/i,
      /\bplaintext\b/i,
      /\bnonce\b/i,
      /\bkey\s*[?:]/i,
      /\bsecret\b/i,
      /\bmetadata\s*[?:]/i,
      /\bbuyer\b/i,
      /\bpayment\b/i,
      /\bchat\b/i,
      /\bentitlement\b/i,
    ]) {
      expect(body, `expected PayloadPreviewDescriptor to not match ${forbidden}`).not.toMatch(forbidden);
    }
  });

  it("6. PayloadDiagnosticsDescriptor has no bytes/Uint8Array/ArrayBuffer/ciphertext/plaintext/nonce/key/secret field, and no metadata dictionary at all", () => {
    const interfaceMatch = encryptedPayloadSource.match(
      /interface\s+PayloadDiagnosticsDescriptor\s*\{([\s\S]*?)\}/,
    );
    expect(interfaceMatch, "expected to find the PayloadDiagnosticsDescriptor interface").not.toBeNull();
    const body = interfaceMatch![1] ?? "";
    for (const forbidden of [
      /\bbytes\b/i,
      /\bUint8Array\b/,
      /\bArrayBuffer\b/,
      /\bciphertext\b/i,
      /\bplaintext\b/i,
      /\bnonce\b/i,
      /\bkey\s*[?:]/i,
      /\bsecret\b/i,
      /\bmetadata\s*[?:]/i,
      /\bbuyer\b/i,
      /\bpayment\b/i,
      /\bchat\b/i,
      /\bentitlement\b/i,
    ]) {
      expect(body, `expected PayloadDiagnosticsDescriptor to not match ${forbidden}`).not.toMatch(forbidden);
    }
  });

  it("7. PayloadAadDomain is exactly the expected five-label union", () => {
    expect(encryptedPayloadSource).toMatch(
      /type\s+PayloadAadDomain\s*=\s*\r?\n\s*\|\s*"root_key"\s*\r?\n\s*\|\s*"identity"\s*\r?\n\s*\|\s*"storage"\s*\r?\n\s*\|\s*"conversation"\s*\r?\n\s*\|\s*"test_only"/,
    );
  });

  it("8. PayloadPreviewStatus is exactly the expected three-label union", () => {
    expect(encryptedPayloadSource).toMatch(
      /type\s+PayloadPreviewStatus\s*=\s*"unavailable"\s*\|\s*"valid_placeholder"\s*\|\s*"invalid_placeholder"/,
    );
  });

  it("9. not wired to StorageBackend, FederationProvider, Runtime, or Worker in any way (same file, same guardrail as Stage 182–185)", () => {
    for (const src of [storageTypesSource, noopStorageSource, federationTypesSource, runtimeSource, workerSource]) {
      expect(src).not.toMatch(/PayloadPreviewDescriptor|PayloadDiagnosticsDescriptor|reviewPayloadPreview/);
    }
  });
});
