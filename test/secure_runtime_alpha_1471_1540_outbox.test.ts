import { describe, it, expect } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  createFedosConversationTransportOutboxIntent,
  makeFedosConversationTransportOutboxId,
} from "../src/os/messenger/adapters/nostr/transport/fedos_conversation_transport_outbox_types.js";
import {
  serializeFedosConversationTransportOutboxIntent,
  deserializeFedosConversationTransportOutboxIntent,
} from "../src/os/messenger/adapters/nostr/transport/fedos_conversation_transport_outbox_codec.js";
import { InMemoryFedosConversationTransportOutboxPersistence } from "../src/os/messenger/adapters/nostr/transport/in_memory_fedos_conversation_transport_outbox_persistence.js";
import { AppendOnlyFedosConversationTransportOutboxPersistence } from "../src/os/messenger/adapters/nostr/transport/append_only_fedos_conversation_transport_outbox_persistence.js";

const ENVELOPE_ID = "e".repeat(32) as never;
const CONVERSATION_ID = "board-1::thread-1" as never;

describe("Secure Runtime Alpha 1471-1540 -- Mailbox Delivery Outbox Types", () => {
  it("1. creates a deterministic id from the envelope id -- same envelope, same id, no randomness", () => {
    const a = createFedosConversationTransportOutboxIntent(ENVELOPE_ID, CONVERSATION_ID, 100);
    const b = createFedosConversationTransportOutboxIntent(ENVELOPE_ID, CONVERSATION_ID, 200);
    expect(a?.id).toBe(b?.id);
    expect(a?.id).toBe(makeFedosConversationTransportOutboxId(ENVELOPE_ID));
  });

  it("2. fails closed to null for a negative/non-integer createdAt", () => {
    expect(createFedosConversationTransportOutboxIntent(ENVELOPE_ID, CONVERSATION_ID, -1)).toBeNull();
    expect(createFedosConversationTransportOutboxIntent(ENVELOPE_ID, CONVERSATION_ID, 1.5)).toBeNull();
  });

  it("3. codec round-trips field-for-field", () => {
    const intent = createFedosConversationTransportOutboxIntent(ENVELOPE_ID, CONVERSATION_ID, 42)!;
    const record = serializeFedosConversationTransportOutboxIntent(intent);
    const roundTripped = deserializeFedosConversationTransportOutboxIntent(record);
    expect(roundTripped).toEqual(intent);
  });

  it("4. deserialize fails closed for an unrecognized schemaVersion", () => {
    const intent = createFedosConversationTransportOutboxIntent(ENVELOPE_ID, CONVERSATION_ID, 42)!;
    const record = { ...serializeFedosConversationTransportOutboxIntent(intent), schemaVersion: 2 };
    expect(deserializeFedosConversationTransportOutboxIntent(record)).toBeNull();
  });

  it("5. deserialize fails closed for an unknown top-level field", () => {
    const intent = createFedosConversationTransportOutboxIntent(ENVELOPE_ID, CONVERSATION_ID, 42)!;
    const record = { ...serializeFedosConversationTransportOutboxIntent(intent), extra: "nope" };
    expect(deserializeFedosConversationTransportOutboxIntent(record)).toBeNull();
  });
});

describe("Secure Runtime Alpha 1471-1540 -- Mailbox Delivery Outbox Persistence (In-Memory)", () => {
  it("1. putIntent is idempotent for the identical record, and rejects a conflicting one for the same id", () => {
    const persistence = new InMemoryFedosConversationTransportOutboxPersistence();
    const intent = createFedosConversationTransportOutboxIntent(ENVELOPE_ID, CONVERSATION_ID, 1)!;
    const record = serializeFedosConversationTransportOutboxIntent(intent);

    expect(persistence.putIntent(record)).toBe("inserted");
    expect(persistence.putIntent(record)).toBe("already-present");
    expect(persistence.putIntent({ ...record, createdAt: 999 })).toBe("conflict");
    expect(persistence.listIntents()).toHaveLength(1);
  });
});

describe("Secure Runtime Alpha 1471-1540 -- Mailbox Delivery Outbox Persistence (Append-Only)", () => {
  it("1. durably persists across a fresh instance over the same file, and fails closed on a corrupt line", () => {
    const dir = mkdtempSync(join(tmpdir(), "fedos-transport-outbox-"));
    const filePath = join(dir, "outbox.ndjson");
    try {
      const persistence1 = new AppendOnlyFedosConversationTransportOutboxPersistence(filePath);
      const intent = createFedosConversationTransportOutboxIntent(ENVELOPE_ID, CONVERSATION_ID, 1)!;
      const record = serializeFedosConversationTransportOutboxIntent(intent);
      expect(persistence1.putIntent(record)).toBe("inserted");

      const persistence2 = new AppendOnlyFedosConversationTransportOutboxPersistence(filePath);
      expect(persistence2.listIntents()).toEqual([record]);
      expect(persistence2.getIntent(record.id)).toEqual(record);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("2. a missing file reads as an empty log, not corruption", () => {
    const dir = mkdtempSync(join(tmpdir(), "fedos-transport-outbox-"));
    try {
      const persistence = new AppendOnlyFedosConversationTransportOutboxPersistence(join(dir, "does-not-exist.ndjson"));
      expect(persistence.listIntents()).toEqual([]);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
