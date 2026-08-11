import { describe, it, expect } from "vitest";
import {
  isWellFormedSealedMasterSeedEnvelopeV1Json,
  toSealedMasterSeedEnvelopeV1,
} from "../src/os/core/vault/wasm/fedos_sealed_master_seed_envelope.js";

const REAL_ENVELOPE_SHAPE =
  '{"v":1,"kdf":"argon2id","m":19456,"t":2,"p":1,"salt":"c2FsdA","alg":"chacha20poly1305","n":"bm9uY2U","ct":"Y2lwaGVydGV4dA"}';

describe("Secure Runtime Alpha 435 -- Sealed Master Seed Envelope V1", () => {
  it("accepts a well-formed v1/argon2id envelope prefix", () => {
    expect(isWellFormedSealedMasterSeedEnvelopeV1Json(REAL_ENVELOPE_SHAPE)).toBe(true);
  });

  it("rejects non-string candidates without throwing", () => {
    expect(isWellFormedSealedMasterSeedEnvelopeV1Json(null)).toBe(false);
    expect(isWellFormedSealedMasterSeedEnvelopeV1Json(undefined)).toBe(false);
    expect(isWellFormedSealedMasterSeedEnvelopeV1Json(42)).toBe(false);
    expect(isWellFormedSealedMasterSeedEnvelopeV1Json({})).toBe(false);
  });

  it("rejects an unrecognized schema version or KDF label", () => {
    expect(isWellFormedSealedMasterSeedEnvelopeV1Json('{"v":9,"kdf":"argon2id"...')).toBe(false);
    expect(isWellFormedSealedMasterSeedEnvelopeV1Json('{"v":1,"kdf":"pbkdf2"...')).toBe(false);
  });

  it("toSealedMasterSeedEnvelopeV1 wraps and deep-freezes a valid candidate", () => {
    const wrapped = toSealedMasterSeedEnvelopeV1(REAL_ENVELOPE_SHAPE);
    expect(wrapped).not.toBeNull();
    expect(wrapped?.json).toBe(REAL_ENVELOPE_SHAPE);
    expect(Object.isFrozen(wrapped)).toBe(true);
  });

  it("toSealedMasterSeedEnvelopeV1 returns null (never throws) for a malformed candidate", () => {
    expect(toSealedMasterSeedEnvelopeV1("not an envelope")).toBeNull();
    expect(toSealedMasterSeedEnvelopeV1(null)).toBeNull();
  });

  it("the wrapped envelope carries no plaintext seed field, only the opaque json string", () => {
    const wrapped = toSealedMasterSeedEnvelopeV1(REAL_ENVELOPE_SHAPE);
    expect(Object.keys(wrapped ?? {})).toEqual(["json"]);
  });
});
