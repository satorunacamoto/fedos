import { describe, it, expect } from "vitest";
import { bytesToHex } from "@noble/hashes/utils.js";

import { PersonaEpochSigningKeypair } from "../src/os/commerce/reputation/persona_epoch_signing_keypair.js";
import {
  signMediaAccessGrant,
  verifyMediaAccessGrantEnvelope,
  MEDIA_ACCESS_GRANT_ENVELOPE_TYPE,
} from "../src/os/commerce/media_grant/media_access_grant_sign_verify.js";
import { isWellFormedMediaAccessGrantPayload } from "../src/os/commerce/media_grant/media_access_grant_types.js";
import type { MediaAccessGrantPayload } from "../src/os/commerce/media_grant/media_access_grant_types.js";

function validPayload(
  issuerPubkey: string,
  overrides: Partial<MediaAccessGrantPayload> = {},
): MediaAccessGrantPayload {
  return {
    formatVersion: 1,
    mediaId: "media-1",
    productId: "product-1",
    buyerPubkey: "b".repeat(64),
    orderId: "order-1",
    issuerPubkey,
    grantVersion: 1,
    revoked: false,
    validFrom: 1_000,
    validUntil: null,
    issuedAt: 1_000,
    ...overrides,
  };
}

describe("MediaAccessGrant: isWellFormedMediaAccessGrantPayload", () => {
  it("accepts a well-formed payload", () => {
    const kp = PersonaEpochSigningKeypair.generate();
    expect(isWellFormedMediaAccessGrantPayload(validPayload(kp.publicKeyHex))).toBe(true);
  });

  it("rejects an unknown extra key (never silently tolerated)", () => {
    const kp = PersonaEpochSigningKeypair.generate();
    const withExtra = { ...validPayload(kp.publicKeyHex), extraDebugField: "leak" };
    expect(isWellFormedMediaAccessGrantPayload(withExtra)).toBe(false);
  });

  it("rejects a non-hex buyerPubkey / issuerPubkey", () => {
    const kp = PersonaEpochSigningKeypair.generate();
    expect(isWellFormedMediaAccessGrantPayload(validPayload(kp.publicKeyHex, { buyerPubkey: "not-hex" }))).toBe(false);
    expect(isWellFormedMediaAccessGrantPayload(validPayload(kp.publicKeyHex, { issuerPubkey: "short" }))).toBe(false);
  });

  it("rejects grantVersion < 1, and non-integer values", () => {
    const kp = PersonaEpochSigningKeypair.generate();
    expect(isWellFormedMediaAccessGrantPayload(validPayload(kp.publicKeyHex, { grantVersion: 0 }))).toBe(false);
    expect(isWellFormedMediaAccessGrantPayload(validPayload(kp.publicKeyHex, { grantVersion: 1.5 }))).toBe(false);
  });

  it("requires validUntil to be an explicit integer or explicit null, never undefined-as-forever", () => {
    const kp = PersonaEpochSigningKeypair.generate();
    const payload = validPayload(kp.publicKeyHex);
    const { validUntil: _drop, ...withoutValidUntil } = payload;
    expect(isWellFormedMediaAccessGrantPayload(withoutValidUntil)).toBe(false);
    expect(isWellFormedMediaAccessGrantPayload({ ...payload, validUntil: 5_000 })).toBe(true);
    expect(isWellFormedMediaAccessGrantPayload({ ...payload, validUntil: null })).toBe(true);
  });
});

describe("MediaAccessGrant: sign/verify", () => {
  it("issues a well-typed envelope and verifies it VALID", () => {
    const kp = PersonaEpochSigningKeypair.generate();
    const payload = validPayload(kp.publicKeyHex);
    const envelope = signMediaAccessGrant(payload, kp, { issuer: kp.publicKeyHex, issuedAt: 1_000 });
    expect(envelope.type).toBe(MEDIA_ACCESS_GRANT_ENVELOPE_TYPE);
    const result = verifyMediaAccessGrantEnvelope(envelope);
    expect(result.status).toBe("VALID");
  });

  it("rejects a payload whose issuerPubkey does not match the signing keypair", () => {
    const kp = PersonaEpochSigningKeypair.generate();
    const other = PersonaEpochSigningKeypair.generate();
    const payload = validPayload(other.publicKeyHex);
    expect(() => signMediaAccessGrant(payload, kp, { issuer: kp.publicKeyHex, issuedAt: 1_000 })).toThrow(RangeError);
  });

  it("TAMPERED GRANT: mutating any single field after signing invalidates the signature", () => {
    const kp = PersonaEpochSigningKeypair.generate();
    const payload = validPayload(kp.publicKeyHex);
    const envelope = signMediaAccessGrant(payload, kp, { issuer: kp.publicKeyHex, issuedAt: 1_000 });

    const mediaTampered = { ...envelope, payload: { ...envelope.payload, mediaId: "media-2" } };
    expect(verifyMediaAccessGrantEnvelope(mediaTampered).status).toBe("SIGNATURE_INVALID");

    const buyerTampered = { ...envelope, payload: { ...envelope.payload, buyerPubkey: "c".repeat(64) } };
    expect(verifyMediaAccessGrantEnvelope(buyerTampered).status).toBe("SIGNATURE_INVALID");

    const revokedTampered = { ...envelope, payload: { ...envelope.payload, revoked: true } };
    expect(verifyMediaAccessGrantEnvelope(revokedTampered).status).toBe("SIGNATURE_INVALID");

    const validUntilTampered = { ...envelope, payload: { ...envelope.payload, validUntil: 999_999_999 } };
    expect(verifyMediaAccessGrantEnvelope(validUntilTampered).status).toBe("SIGNATURE_INVALID");
  });

  it("WRONG SIGNER: rejects an envelope whose signature came from a different keypair than keyId names", () => {
    const kp = PersonaEpochSigningKeypair.generate();
    const attacker = PersonaEpochSigningKeypair.generate();
    const payload = validPayload(kp.publicKeyHex);
    const envelope = signMediaAccessGrant(payload, kp, { issuer: kp.publicKeyHex, issuedAt: 1_000 });
    const forgedSignatureBytes = attacker.signBytes(new TextEncoder().encode("unrelated bytes"));
    const forged = { ...envelope, signature: bytesToHex(forgedSignatureBytes) };
    expect(verifyMediaAccessGrantEnvelope(forged).status).toBe("SIGNATURE_INVALID");
  });

  it("rejects an envelope whose keyId does not match payload.issuerPubkey", () => {
    const kp = PersonaEpochSigningKeypair.generate();
    const other = PersonaEpochSigningKeypair.generate();
    const payload = validPayload(kp.publicKeyHex);
    const envelope = signMediaAccessGrant(payload, kp, { issuer: kp.publicKeyHex, issuedAt: 1_000 });
    const swapped = { ...envelope, keyId: other.publicKeyHex };
    expect(verifyMediaAccessGrantEnvelope(swapped).status).toBe("KEY_ID_MISMATCH");
  });

  it("rejects an envelope with the wrong type literal (domain separation)", () => {
    const kp = PersonaEpochSigningKeypair.generate();
    const payload = validPayload(kp.publicKeyHex);
    const envelope = signMediaAccessGrant(payload, kp, { issuer: kp.publicKeyHex, issuedAt: 1_000 });
    const retyped = { ...envelope, type: "fedos.commerce.reputation-summary.v1" };
    expect(verifyMediaAccessGrantEnvelope(retyped).status).toBe("WRONG_TYPE");
  });

  it("rejects a malformed envelope shape without throwing", () => {
    expect(verifyMediaAccessGrantEnvelope(null).status).toBe("MALFORMED_ENVELOPE");
    expect(verifyMediaAccessGrantEnvelope({}).status).toBe("MALFORMED_ENVELOPE");
    expect(verifyMediaAccessGrantEnvelope("not an envelope").status).toBe("MALFORMED_ENVELOPE");
  });

  it("rejects a malformed payload (e.g. an unknown extra key smuggled into payload)", () => {
    const kp = PersonaEpochSigningKeypair.generate();
    const payload = validPayload(kp.publicKeyHex);
    const envelope = signMediaAccessGrant(payload, kp, { issuer: kp.publicKeyHex, issuedAt: 1_000 });
    const polluted = { ...envelope, payload: { ...envelope.payload, extra: "x" } };
    expect(verifyMediaAccessGrantEnvelope(polluted).status).toBe("MALFORMED_PAYLOAD");
  });
});
