import { describe, it, expect } from "vitest";
import {
  serializeFedosBoardOutboxIntent,
  deserializeFedosBoardOutboxIntent,
  type FedosPersistedBoardOutboxRecordV1,
} from "../src/os/messenger/board/outbox/fedos_board_outbox_codec.js";
import { createFedosBoardOutboxIntent } from "../src/os/messenger/board/outbox/fedos_board_outbox_types.js";
import { toFedosBoardPostId } from "../src/os/messenger/board/fedos_board_identifiers.js";

/**
 * Secure Runtime Alpha 416 -- "Persisted Outbox Record V1 and Codec":
 * Stage 6 of the Alpha 411-420 Canonical Board Durable Outbox
 * Foundation Arc.
 */
describe("Secure Runtime Alpha 416 -- Persisted Outbox Record V1 and Codec", () => {
  const postId = toFedosBoardPostId("post-1")!;
  const intent = createFedosBoardOutboxIntent(postId, { protocol: "nostr", destination: null }, 1_700_000_000)!;

  it("1. serialize produces schemaVersion 1 and a deep, independent copy", () => {
    const record = serializeFedosBoardOutboxIntent(intent);
    expect(record.schemaVersion).toBe(1);
    expect(record).toEqual({
      schemaVersion: 1,
      id: intent.id,
      postId: intent.postId,
      target: { protocol: "nostr", destination: null },
      createdAt: 1_700_000_000,
    });
    expect(record.target).not.toBe(intent.target);
  });

  it("2. round-trips serialize -> deserialize back to an equivalent intent", () => {
    const record = serializeFedosBoardOutboxIntent(intent);
    const roundTripped = deserializeFedosBoardOutboxIntent(record);
    expect(roundTripped).toEqual(intent);
  });

  it("3. deserialize never throws for any malformed input", () => {
    const malformed: unknown[] = [null, undefined, 42, "x", [], {}, { schemaVersion: 2 }];
    for (const value of malformed) {
      expect(() => deserializeFedosBoardOutboxIntent(value)).not.toThrow();
    }
  });

  it("4. deserialize rejects an unrecognized schemaVersion", () => {
    const record = serializeFedosBoardOutboxIntent(intent);
    expect(deserializeFedosBoardOutboxIntent({ ...record, schemaVersion: 2 })).toBeNull();
  });

  it("5. deserialize rejects an unknown top-level field", () => {
    const record = serializeFedosBoardOutboxIntent(intent) as FedosPersistedBoardOutboxRecordV1 & {
      extra?: string;
    };
    expect(deserializeFedosBoardOutboxIntent({ ...record, extra: "nope" })).toBeNull();
  });

  it("6. deserialize rejects an unknown nested target field", () => {
    const record = serializeFedosBoardOutboxIntent(intent);
    const tampered = { ...record, target: { ...record.target, secretToken: "nope" } };
    expect(deserializeFedosBoardOutboxIntent(tampered)).toBeNull();
  });

  it("7. deserialize rejects a malformed protocol", () => {
    const record = serializeFedosBoardOutboxIntent(intent);
    const tampered = { ...record, target: { ...record.target, protocol: "bluesky" } };
    expect(deserializeFedosBoardOutboxIntent(tampered)).toBeNull();
  });

  it("8. deserialize rejects a missing/blank postId", () => {
    const record = serializeFedosBoardOutboxIntent(intent);
    expect(deserializeFedosBoardOutboxIntent({ ...record, postId: "" })).toBeNull();
    expect(deserializeFedosBoardOutboxIntent({ ...record, postId: 42 })).toBeNull();
  });

  it("9. deserialize rejects an invalid timestamp", () => {
    const record = serializeFedosBoardOutboxIntent(intent);
    expect(deserializeFedosBoardOutboxIntent({ ...record, createdAt: -1 })).toBeNull();
    expect(deserializeFedosBoardOutboxIntent({ ...record, createdAt: "now" })).toBeNull();
  });

  it("10. deserialize rejects a record whose stored id no longer matches its own postId/target derivation", () => {
    const record = serializeFedosBoardOutboxIntent(intent);
    expect(deserializeFedosBoardOutboxIntent({ ...record, id: "tampered-id" })).toBeNull();
  });

  it("11. deserialize performs no implicit coercion (numeric string createdAt rejected)", () => {
    const record = serializeFedosBoardOutboxIntent(intent);
    expect(deserializeFedosBoardOutboxIntent({ ...record, createdAt: String(record.createdAt) })).toBeNull();
  });
});
