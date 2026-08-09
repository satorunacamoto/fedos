import { describe, it, expect } from "vitest";
import { fedosPersistedConversationRecordsAreEqual } from "../src/os/messenger/conversations/persistence/fedos_conversation_persistence.js";
import type { FedosPersistedConversationRecordV1 } from "../src/os/messenger/conversations/persistence/fedos_persisted_conversation_record_v1.js";
import {
  serializeFedosConversationRecord,
  deserializeFedosConversationRecord,
} from "../src/os/messenger/conversations/persistence/fedos_conversation_record_codec.js";
import { validateFedosConversationRecord } from "../src/os/messenger/conversations/fedos_conversation_record_validator.js";

const RECORD: FedosPersistedConversationRecordV1 = {
  schemaVersion: 1,
  id: "board-a::thread-1",
  mode: "public",
  boardId: "board-a",
  rootThreadId: "thread-1",
  rootPostId: "thread-1",
  policyReference: "public-v1",
  createdAt: 1_700_000_000,
};

/**
 * Secure Runtime Alpha 749 ("Conversation Persistence Port") / Alpha
 * 750 ("Persisted Conversation Record V1") -- Stages 9-10 of the Alpha
 * 741-760 Canonical Conversation Identity and Record Foundation Arc.
 */
describe("Secure Runtime Alpha 749 -- Conversation Persistence Port and Codec", () => {
  it("1. fedosPersistedConversationRecordsAreEqual: identical records are equal", () => {
    expect(fedosPersistedConversationRecordsAreEqual(RECORD, { ...RECORD })).toBe(true);
  });

  it("2. fedosPersistedConversationRecordsAreEqual: any differing field makes them unequal", () => {
    expect(fedosPersistedConversationRecordsAreEqual(RECORD, { ...RECORD, createdAt: 1 })).toBe(false);
    expect(fedosPersistedConversationRecordsAreEqual(RECORD, { ...RECORD, boardId: "board-b" })).toBe(false);
  });

  it("3. round-trip: serialize then deserialize reproduces a structurally identical record", () => {
    const validated = validateFedosConversationRecord({
      id: RECORD.id,
      mode: RECORD.mode,
      boardId: RECORD.boardId,
      rootThreadId: RECORD.rootThreadId,
      rootPostId: RECORD.rootPostId,
      policyReference: RECORD.policyReference,
      createdAt: RECORD.createdAt,
    })!;
    const persisted = serializeFedosConversationRecord(validated);
    expect(persisted).toEqual(RECORD);
    const roundTripped = deserializeFedosConversationRecord(persisted);
    expect(roundTripped).toEqual(validated);
  });

  it("4. deserialize fails closed on schemaVersion !== 1 -- never guessed at or migrated", () => {
    expect(deserializeFedosConversationRecord({ ...RECORD, schemaVersion: 2 })).toBeNull();
    expect(deserializeFedosConversationRecord({ ...RECORD, schemaVersion: "1" })).toBeNull();
  });

  it("5. deserialize rejects an unknown top-level field", () => {
    expect(deserializeFedosConversationRecord({ ...RECORD, extra: "nope" })).toBeNull();
  });

  it("6. deserialize never throws for malformed/non-object input", () => {
    expect(() => deserializeFedosConversationRecord(null)).not.toThrow();
    expect(deserializeFedosConversationRecord(null)).toBeNull();
    expect(() => deserializeFedosConversationRecord("garbage")).not.toThrow();
    expect(deserializeFedosConversationRecord(42)).toBeNull();
  });

  it("7. deserialize reuses validateFedosConversationRecord -- an invalid mode still fails closed through the codec", () => {
    expect(deserializeFedosConversationRecord({ ...RECORD, mode: "direct" })).toBeNull();
  });
});
