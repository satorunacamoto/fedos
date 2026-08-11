/**
 * Secure Runtime Alpha 5401-5480 — Phase F: sealed ratchet-secret record
 * schema validation. Covers "no plaintext secret" at the type level plus
 * unknown-field rejection.
 */
import { describe, it, expect } from "vitest";
import {
  createFedosSealedDirectRatchetSecretRecordV1,
  isWellFormedFedosSealedDirectRatchetSecretRecordV1,
  fedosSealedDirectRatchetSecretRecordKey,
} from "../src/os/messenger/conversations/ratchet/fedos_sealed_direct_ratchet_secret_record.js";
import type { FedosDirectRatchetSessionId } from "../src/os/messenger/conversations/ratchet/fedos_direct_ratchet_session_id.js";

const SESSION_ID = "direct-ratchet-v1##a##b##c##d##e##fedos-direct-ratchet-v1##0" as FedosDirectRatchetSessionId;

function validInput() {
  return {
    sessionId: SESSION_ID,
    secretKind: "root-key" as const,
    generation: 0,
    chainCounter: null,
    sealingSuite: "direct-ratchet-sealing-v1" as const,
    suite: "fedos-direct-ratchet-v1" as const,
    sealedBlob: "aabbccdd",
    createdAt: 1000,
  };
}

describe("Alpha 5401-5480 — sealed ratchet-secret record", () => {
  it("constructs a well-formed record for a non-skipped-key kind (chainCounter null)", () => {
    const record = createFedosSealedDirectRatchetSecretRecordV1(validInput());
    expect(record).not.toBeNull();
    expect(isWellFormedFedosSealedDirectRatchetSecretRecordV1(record)).toBe(true);
  });

  it("constructs a well-formed record for skipped-message-key (chainCounter required)", () => {
    const record = createFedosSealedDirectRatchetSecretRecordV1({
      ...validInput(),
      secretKind: "skipped-message-key",
      chainCounter: 3,
    });
    expect(record).not.toBeNull();
  });

  it("rejects skipped-message-key with a null chainCounter", () => {
    expect(createFedosSealedDirectRatchetSecretRecordV1({ ...validInput(), secretKind: "skipped-message-key", chainCounter: null })).toBeNull();
  });

  it("rejects a non-skipped-key kind with a non-null chainCounter", () => {
    expect(createFedosSealedDirectRatchetSecretRecordV1({ ...validInput(), chainCounter: 5 })).toBeNull();
  });

  it("rejects an empty sealedBlob", () => {
    expect(createFedosSealedDirectRatchetSecretRecordV1({ ...validInput(), sealedBlob: "" })).toBeNull();
  });

  it("rejects a negative generation", () => {
    expect(createFedosSealedDirectRatchetSecretRecordV1({ ...validInput(), generation: -1 })).toBeNull();
  });

  it("has no field named after any secret concept -- schema-level 'no plaintext secret' guard", () => {
    const record = createFedosSealedDirectRatchetSecretRecordV1(validInput());
    const keys = Object.keys(record as object);
    for (const forbidden of ["plaintext", "passphrase", "masterSeed", "wrappingKey", "devicePrivateKey", "rootKeyBytes"]) {
      expect(keys).not.toContain(forbidden);
    }
    expect(keys.sort()).toEqual(
      [
        "schemaVersion",
        "sessionId",
        "secretKind",
        "generation",
        "chainCounter",
        "sealingSuite",
        "suite",
        "sealedBlob",
        "createdAt",
        "integrityContext",
      ].sort(),
    );
  });

  it("unknown field rejection -- strict, closed field set", () => {
    const record = createFedosSealedDirectRatchetSecretRecordV1(validInput());
    const raw = { ...record, extra: "nope" };
    expect(isWellFormedFedosSealedDirectRatchetSecretRecordV1(raw)).toBe(false);
  });

  it("unknown secretKind is rejected (closed vocabulary)", () => {
    const record = createFedosSealedDirectRatchetSecretRecordV1(validInput());
    const raw = { ...record, secretKind: "not-a-real-kind" };
    expect(isWellFormedFedosSealedDirectRatchetSecretRecordV1(raw)).toBe(false);
  });

  it("unknown sealing suite is rejected", () => {
    const record = createFedosSealedDirectRatchetSecretRecordV1(validInput());
    const raw = { ...record, sealingSuite: "not-a-real-suite" };
    expect(isWellFormedFedosSealedDirectRatchetSecretRecordV1(raw)).toBe(false);
  });

  it("the lookup key is deterministic and distinguishes secretKind/generation/chainCounter", () => {
    const a = fedosSealedDirectRatchetSecretRecordKey({ sessionId: SESSION_ID, secretKind: "root-key", generation: 0, chainCounter: null });
    const b = fedosSealedDirectRatchetSecretRecordKey({ sessionId: SESSION_ID, secretKind: "root-key", generation: 1, chainCounter: null });
    const c = fedosSealedDirectRatchetSecretRecordKey({ sessionId: SESSION_ID, secretKind: "sending-chain-key", generation: 0, chainCounter: null });
    expect(a).not.toBe(b);
    expect(a).not.toBe(c);
  });
});
