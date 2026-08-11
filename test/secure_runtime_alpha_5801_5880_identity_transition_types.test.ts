import { describe, expect, it } from "vitest";
import {
  isKnownFedosIdentityTransitionType,
  isKnownFedosIdentityTransitionReasonCategory,
  isKnownFedosIdentityTransitionEvidenceKind,
  isKnownFedosIdentityTransitionEvidenceStatus,
  isFedosIdentityTransitionCompromiseReason,
} from "../src/os/messenger/conversations/identity_transition/fedos_identity_transition_vocabulary.js";
import {
  createFedosIdentityTransitionRecordV1,
  isWellFormedFedosIdentityTransitionRecordV1,
  checkFedosIdentityTransitionTimestamps,
  encodeFedosIdentityTransitionRecordV1,
  decodeFedosIdentityTransitionRecordV1,
} from "../src/os/messenger/conversations/identity_transition/fedos_identity_transition_record.js";
import { generateFedosIdentityTransitionId, isWellFormedFedosIdentityTransitionId } from "../src/os/messenger/conversations/identity_transition/fedos_identity_transition_id.js";
import { fedosIdentityTransitionBodyHash, fedosIdentityTransitionCanonicalBody } from "../src/os/messenger/conversations/identity_transition/fedos_identity_transition_canonical.js";
import type { FedosDeviceBindingAccountRef } from "../src/os/messenger/device/fedos_device_binding.js";

const OLD_PUBKEY = "a".repeat(64);
const NEW_PUBKEY = "b".repeat(64);

function accountRef(pubkey: string): FedosDeviceBindingAccountRef {
  return { authority: "nostr", publicIdentifier: pubkey, identityId: null };
}

function baseRecord(overrides: Partial<Parameters<typeof createFedosIdentityTransitionRecordV1>[0]> = {}) {
  return createFedosIdentityTransitionRecordV1({
    transitionId: generateFedosIdentityTransitionId(),
    transitionType: "identity-replacement",
    oldAccountIdentity: accountRef(OLD_PUBKEY),
    newAccountIdentity: accountRef(NEW_PUBKEY),
    oldNostrIdentity: OLD_PUBKEY,
    newNostrIdentity: NEW_PUBKEY,
    reasonCategory: "user-initiated-replacement",
    issuedAt: 1_000,
    expiresAt: 2_000,
    revision: 0,
    previousTransitionId: null,
    ...overrides,
  });
}

describe("closed vocabularies fail closed on unknown values", () => {
  it("transition type", () => {
    expect(isKnownFedosIdentityTransitionType("identity-replacement")).toBe(true);
    expect(isKnownFedosIdentityTransitionType("continuity-claim")).toBe(true);
    expect(isKnownFedosIdentityTransitionType("account-rotation")).toBe(false);
    expect(isKnownFedosIdentityTransitionType(123)).toBe(false);
  });

  it("reason category, with compromise-reason predicate", () => {
    expect(isKnownFedosIdentityTransitionReasonCategory("key-compromise-confirmed")).toBe(true);
    expect(isKnownFedosIdentityTransitionReasonCategory("my custom reason")).toBe(false);
    expect(isFedosIdentityTransitionCompromiseReason("key-compromise-suspected")).toBe(true);
    expect(isFedosIdentityTransitionCompromiseReason("key-compromise-confirmed")).toBe(true);
    expect(isFedosIdentityTransitionCompromiseReason("user-initiated-replacement")).toBe(false);
  });

  it("evidence kind and status", () => {
    expect(isKnownFedosIdentityTransitionEvidenceKind("old-identity-signature")).toBe(true);
    expect(isKnownFedosIdentityTransitionEvidenceKind("free-form-vouching")).toBe(false);
    expect(isKnownFedosIdentityTransitionEvidenceStatus("cryptographically-valid")).toBe(true);
    expect(isKnownFedosIdentityTransitionEvidenceStatus("trusted")).toBe(false);
  });
});

describe("transition id", () => {
  it("generates a well-formed, sufficiently random id every call", () => {
    const a = generateFedosIdentityTransitionId();
    const b = generateFedosIdentityTransitionId();
    expect(isWellFormedFedosIdentityTransitionId(a)).toBe(true);
    expect(a).not.toBe(b);
  });

  it("rejects malformed ids", () => {
    expect(isWellFormedFedosIdentityTransitionId("not-a-real-id")).toBe(false);
    expect(isWellFormedFedosIdentityTransitionId("")).toBe(false);
    expect(isWellFormedFedosIdentityTransitionId(42)).toBe(false);
  });
});

describe("FedosIdentityTransitionRecordV1 structural validation", () => {
  it("accepts a well-formed fresh (revision 0) record", () => {
    const record = baseRecord();
    expect(isWellFormedFedosIdentityTransitionRecordV1(record)).toBe(true);
  });

  it("rejects an unknown extra field", () => {
    const record = { ...baseRecord(), extra: "field" };
    expect(isWellFormedFedosIdentityTransitionRecordV1(record)).toBe(false);
  });

  it("rejects a missing field", () => {
    const { reasonCategory, ...withoutReasonCategory } = baseRecord() as any;
    void reasonCategory;
    expect(isWellFormedFedosIdentityTransitionRecordV1(withoutReasonCategory)).toBe(false);
  });

  it("rejects revision 0 with a non-null previousTransitionId", () => {
    const record = { ...baseRecord(), previousTransitionId: generateFedosIdentityTransitionId() };
    expect(isWellFormedFedosIdentityTransitionRecordV1(record)).toBe(false);
  });

  it("rejects revision > 0 with a null previousTransitionId", () => {
    const record = { ...baseRecord(), revision: 1 };
    expect(isWellFormedFedosIdentityTransitionRecordV1(record)).toBe(false);
  });

  it("rejects a transition naming itself as its own predecessor", () => {
    const record = baseRecord();
    const selfReferential = { ...record, revision: 1, previousTransitionId: record.transitionId };
    expect(isWellFormedFedosIdentityTransitionRecordV1(selfReferential)).toBe(false);
  });

  it("rejects old and new account identity being equal", () => {
    const record = baseRecord({ newAccountIdentity: accountRef(OLD_PUBKEY), newNostrIdentity: OLD_PUBKEY });
    expect(isWellFormedFedosIdentityTransitionRecordV1(record)).toBe(false);
  });

  it("rejects a nostr-authority account ref whose publicIdentifier disagrees with the nostr identity field (unsupported mapping)", () => {
    const record = baseRecord({ oldNostrIdentity: "c".repeat(64) });
    expect(isWellFormedFedosIdentityTransitionRecordV1(record)).toBe(false);
  });

  it("rejects non-integer or out-of-order timestamps", () => {
    expect(isWellFormedFedosIdentityTransitionRecordV1(baseRecord({ issuedAt: 1.5 }))).toBe(false);
    expect(isWellFormedFedosIdentityTransitionRecordV1(baseRecord({ issuedAt: 2000, expiresAt: 1000 }))).toBe(false);
  });

  it("rejects a malformed Nostr pubkey", () => {
    expect(isWellFormedFedosIdentityTransitionRecordV1(baseRecord({ newNostrIdentity: "not-hex" }))).toBe(false);
  });

  it("timestamp check: ok / expired / future-issued-beyond-skew are distinct", () => {
    const record = baseRecord({ issuedAt: 1_000, expiresAt: 2_000 });
    expect(checkFedosIdentityTransitionTimestamps(record, 1_500)).toBe("ok");
    expect(checkFedosIdentityTransitionTimestamps(record, 2_500)).toBe("expired");
    const futureRecord = baseRecord({ issuedAt: 10_000, expiresAt: 20_000 });
    expect(checkFedosIdentityTransitionTimestamps(futureRecord, 100)).toBe("future-issued-beyond-skew");
  });

  it("round-trips through encode/decode", () => {
    const record = baseRecord();
    const decoded = decodeFedosIdentityTransitionRecordV1(encodeFedosIdentityTransitionRecordV1(record));
    expect(decoded).toEqual(record);
  });

  it("decode fails closed on malformed JSON and malformed records", () => {
    expect(decodeFedosIdentityTransitionRecordV1("{not json")).toBeNull();
    expect(decodeFedosIdentityTransitionRecordV1(JSON.stringify({ foo: "bar" }))).toBeNull();
  });
});

describe("canonical serialization (Phase D)", () => {
  it("is deterministic for the same record", () => {
    const record = baseRecord();
    expect(fedosIdentityTransitionCanonicalBody(record)).toBe(fedosIdentityTransitionCanonicalBody(record));
    expect(fedosIdentityTransitionBodyHash(record)).toBe(fedosIdentityTransitionBodyHash(record));
  });

  it("any body field mutation changes the body hash", () => {
    const record = baseRecord();
    const hash = fedosIdentityTransitionBodyHash(record);
    const mutated = { ...record, reasonCategory: "identity-lost" as const };
    expect(fedosIdentityTransitionBodyHash(mutated)).not.toBe(hash);
  });

  it("does not depend on object property insertion order", () => {
    const record = baseRecord();
    const reorderedObject: Record<string, unknown> = {};
    for (const key of Object.keys(record).reverse()) {
      reorderedObject[key] = (record as unknown as Record<string, unknown>)[key];
    }
    expect(fedosIdentityTransitionBodyHash(reorderedObject as any)).toBe(fedosIdentityTransitionBodyHash(record));
  });
});
