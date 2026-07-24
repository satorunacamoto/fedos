/**
 * Secure Runtime Alpha 5401-5480 — Phase D/E. Covers test requirements 4
 * (strict codec), 5 (unknown field rejection), 11 (skipped-key bound),
 * 12 (skipped-key expiry), 13 (duplicate insert), plus malformed
 * counter / excessive chain gap / overflow rejection (Phase K).
 */
import { describe, it, expect } from "vitest";
import {
  decodeFedosDirectRatchetSessionRecordV1,
  encodeFedosDirectRatchetSessionRecordV1,
  isWellFormedFedosDirectRatchetSessionRecordV1,
  type FedosDirectRatchetSessionRecordV1,
} from "../src/conversation/ratchet/fedos_direct_ratchet_session_record.js";
import { FEDOS_DIRECT_RATCHET_INITIAL_COUNTERS } from "../src/conversation/ratchet/fedos_direct_ratchet_counters.js";
import { FedosDirectRatchetSkippedKeyIndex } from "../src/conversation/ratchet/fedos_direct_ratchet_skipped_key_index.js";
import { FEDOS_DIRECT_RATCHET_LIMITS } from "../src/conversation/ratchet/fedos_direct_ratchet_limits.js";
import type { FedosConversationId } from "../src/conversation/fedos_conversation_id.js";

function validRecord(overrides: Partial<FedosDirectRatchetSessionRecordV1> = {}): FedosDirectRatchetSessionRecordV1 {
  return {
    schemaVersion: 1,
    revision: 0,
    binding: {
      sessionId: "direct-ratchet-v1##alice##alice-device-1##bob##bob-device-1##conv-1##fedos-direct-ratchet-v1##0" as never,
      localAccountRef: { authority: "fedos", publicIdentifier: "alice", identityId: null },
      localDeviceRef: "alice-device-1",
      remoteAccountRef: { authority: "fedos", publicIdentifier: "bob", identityId: null },
      remoteDeviceRef: "bob-device-1",
      conversationId: "conv-1" as FedosConversationId,
      suite: "fedos-direct-ratchet-v1",
      generation: 0,
    },
    lifecycleState: "initialized",
    counters: FEDOS_DIRECT_RATCHET_INITIAL_COUNTERS,
    createdAt: 1000,
    lastActivityAt: 1000,
    skippedKeyReferences: [],
    sealedSecretRecordIds: [],
    ...overrides,
  };
}

describe("Alpha 5401-5480 — strict codec", () => {
  it("4. round-trips a well-formed record through encode/decode", () => {
    const record = validRecord();
    const decoded = decodeFedosDirectRatchetSessionRecordV1(encodeFedosDirectRatchetSessionRecordV1(record));
    expect(decoded).toEqual(record);
  });

  it("4. rejects malformed JSON", () => {
    expect(decodeFedosDirectRatchetSessionRecordV1("not json{{{")).toBeNull();
  });

  it("5. unknown field rejection -- an extra top-level field voids the record", () => {
    const raw = { ...validRecord(), extraField: "nope" };
    expect(isWellFormedFedosDirectRatchetSessionRecordV1(raw)).toBe(false);
  });

  it("5. unknown field rejection -- an extra binding field voids the record", () => {
    const record = validRecord();
    const raw = { ...record, binding: { ...record.binding, extra: "nope" } };
    expect(isWellFormedFedosDirectRatchetSessionRecordV1(raw)).toBe(false);
  });

  it("5. unknown field rejection -- an extra account-ref field voids the record", () => {
    const record = validRecord();
    const raw = { ...record, binding: { ...record.binding, localAccountRef: { ...record.binding.localAccountRef, extra: 1 } } };
    expect(isWellFormedFedosDirectRatchetSessionRecordV1(raw)).toBe(false);
  });

  it("unknown schema version is rejected", () => {
    const raw = { ...validRecord(), schemaVersion: 2 };
    expect(isWellFormedFedosDirectRatchetSessionRecordV1(raw)).toBe(false);
  });

  it("unknown suite is rejected via the binding's own well-formed suite check", () => {
    // suite is a plain, non-empty string check at the record-codec layer
    // (the closed-literal check lives in session-id construction) --
    // an EMPTY suite string must still be rejected here.
    const record = validRecord();
    const raw = { ...record, binding: { ...record.binding, suite: "" } };
    expect(isWellFormedFedosDirectRatchetSessionRecordV1(raw)).toBe(false);
  });

  it("unrecognized lifecycle state string is rejected (closed vocabulary only)", () => {
    const raw = { ...validRecord(), lifecycleState: "not-a-real-state" };
    expect(isWellFormedFedosDirectRatchetSessionRecordV1(raw)).toBe(false);
  });

  it("negative revision is rejected", () => {
    const raw = { ...validRecord(), revision: -1 };
    expect(isWellFormedFedosDirectRatchetSessionRecordV1(raw)).toBe(false);
  });
});

describe("Alpha 5401-5480 — bounded skipped-key index", () => {
  it("11. skipped-key bound -- inserting beyond the cap evicts the oldest reference", () => {
    const index = new FedosDirectRatchetSkippedKeyIndex();
    for (let i = 0; i < FEDOS_DIRECT_RATCHET_LIMITS.maxSkippedKeysPerChain; i++) {
      const outcome = index.insert({ chainCounter: i, sealedRecordId: `record-${i}`, createdAt: i });
      expect(outcome.outcome).toBe("inserted");
    }
    expect(index.size()).toBe(FEDOS_DIRECT_RATCHET_LIMITS.maxSkippedKeysPerChain);

    const overflowOutcome = index.insert({
      chainCounter: FEDOS_DIRECT_RATCHET_LIMITS.maxSkippedKeysPerChain,
      sealedRecordId: "record-overflow",
      createdAt: FEDOS_DIRECT_RATCHET_LIMITS.maxSkippedKeysPerChain,
    });
    expect(overflowOutcome.outcome).toBe("inserted");
    expect(index.size()).toBe(FEDOS_DIRECT_RATCHET_LIMITS.maxSkippedKeysPerChain);
    expect(index.get(0)).toBeNull(); // oldest (createdAt 0) was evicted
    expect(index.get(FEDOS_DIRECT_RATCHET_LIMITS.maxSkippedKeysPerChain)).not.toBeNull();
  });

  it("11. never an unbounded map -- size never exceeds the cap regardless of insert count", () => {
    const index = new FedosDirectRatchetSkippedKeyIndex();
    for (let i = 0; i < FEDOS_DIRECT_RATCHET_LIMITS.maxSkippedKeysPerChain + 500; i++) {
      index.insert({ chainCounter: i, sealedRecordId: `record-${i}`, createdAt: i });
    }
    expect(index.size()).toBeLessThanOrEqual(FEDOS_DIRECT_RATCHET_LIMITS.maxSkippedKeysPerChain);
  });

  it("12. skipped-key expiry -- evictExpired() removes references older than the retention window", () => {
    const index = new FedosDirectRatchetSkippedKeyIndex();
    index.insert({ chainCounter: 0, sealedRecordId: "old", createdAt: 0 });
    index.insert({ chainCounter: 1, sealedRecordId: "new", createdAt: FEDOS_DIRECT_RATCHET_LIMITS.skippedKeyRetentionMs });
    const now = FEDOS_DIRECT_RATCHET_LIMITS.skippedKeyRetentionMs + 1000;
    const expired = index.evictExpired(now);
    expect(expired.map((r) => r.sealedRecordId)).toEqual(["old"]);
    expect(index.get(0)).toBeNull();
    expect(index.get(1)).not.toBeNull();
  });

  it("13. duplicate insert -- the same chainCounter is rejected, never silently re-derived", () => {
    const index = new FedosDirectRatchetSkippedKeyIndex();
    expect(index.insert({ chainCounter: 5, sealedRecordId: "a", createdAt: 0 }).outcome).toBe("inserted");
    const duplicate = index.insert({ chainCounter: 5, sealedRecordId: "b", createdAt: 1 });
    expect(duplicate).toEqual({ outcome: "rejected", reason: "duplicate-counter" });
  });

  it("malformed counter rejection -- negative or non-integer chainCounter is rejected", () => {
    const index = new FedosDirectRatchetSkippedKeyIndex();
    expect(index.insert({ chainCounter: -1, sealedRecordId: "a", createdAt: 0 }).outcome).toBe("rejected");
    expect(index.insert({ chainCounter: 1.5, sealedRecordId: "a", createdAt: 0 }).outcome).toBe("rejected");
  });

  it("excessive chain gap -- a counter far beyond the base is rejected", () => {
    const index = new FedosDirectRatchetSkippedKeyIndex(0);
    const outcome = index.insert({
      chainCounter: FEDOS_DIRECT_RATCHET_LIMITS.maxChainGap + 1,
      sealedRecordId: "a",
      createdAt: 0,
    });
    expect(outcome).toEqual({ outcome: "rejected", reason: "chain-gap-exceeded" });
  });

  it("chain/session isolation -- two independent indexes never share state", () => {
    const a = new FedosDirectRatchetSkippedKeyIndex();
    const b = new FedosDirectRatchetSkippedKeyIndex();
    a.insert({ chainCounter: 0, sealedRecordId: "a-record", createdAt: 0 });
    expect(b.size()).toBe(0);
    expect(b.get(0)).toBeNull();
  });
});
