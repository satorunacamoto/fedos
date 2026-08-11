import { describe, it, expect } from "vitest";
import { InMemoryFedosBoardOutboxPersistence } from "../src/os/messenger/board/outbox/in_memory_fedos_board_outbox_persistence.js";
import { serializeFedosBoardOutboxIntent } from "../src/os/messenger/board/outbox/fedos_board_outbox_codec.js";
import { createFedosBoardOutboxIntent } from "../src/os/messenger/board/outbox/fedos_board_outbox_types.js";
import { toFedosBoardPostId } from "../src/os/messenger/board/fedos_board_identifiers.js";

/**
 * Secure Runtime Alpha 417 -- "Outbox Persistence Port and In-Memory
 * Backend": Stage 7 of the Alpha 411-420 Canonical Board Durable
 * Outbox Foundation Arc.
 */
describe("Secure Runtime Alpha 417 -- Outbox Persistence Port and In-Memory Backend", () => {
  const postId = toFedosBoardPostId("post-1")!;
  const intent = createFedosBoardOutboxIntent(postId, { protocol: "nostr", destination: null }, 1_700_000_000)!;
  const record = serializeFedosBoardOutboxIntent(intent);

  it("1. putIntent returns inserted for a genuinely new id", () => {
    const persistence = new InMemoryFedosBoardOutboxPersistence();
    expect(persistence.putIntent(record)).toBe("inserted");
  });

  it("2. putIntent returns already-present for an identical repeat write, no mutation", () => {
    const persistence = new InMemoryFedosBoardOutboxPersistence();
    persistence.putIntent(record);
    expect(persistence.putIntent(record)).toBe("already-present");
    expect(persistence.listIntents()).toHaveLength(1);
  });

  it("3. putIntent returns conflict for the same id with different content, original preserved", () => {
    const persistence = new InMemoryFedosBoardOutboxPersistence();
    persistence.putIntent(record);
    const conflicting = { ...record, createdAt: record.createdAt + 1 };
    expect(persistence.putIntent(conflicting)).toBe("conflict");
    expect(persistence.getIntent(record.id)).toEqual(record);
  });

  it("4. getIntent returns null for an unknown id", () => {
    const persistence = new InMemoryFedosBoardOutboxPersistence();
    expect(persistence.getIntent("does-not-exist")).toBeNull();
  });

  it("5. independent instances never share state", () => {
    const a = new InMemoryFedosBoardOutboxPersistence();
    const b = new InMemoryFedosBoardOutboxPersistence();
    a.putIntent(record);
    expect(b.listIntents()).toEqual([]);
  });

  it("6. listIntents returns a fresh array each call -- caller mutation cannot affect internal state", () => {
    const persistence = new InMemoryFedosBoardOutboxPersistence();
    persistence.putIntent(record);
    const first = persistence.listIntents() as unknown[];
    first.push("intruder");
    expect(persistence.listIntents()).toHaveLength(1);
  });

  it("7. exposes exactly putIntent/getIntent/listIntents -- no delete/dequeue/retry/observation method", () => {
    const persistence = new InMemoryFedosBoardOutboxPersistence();
    const publicMethods = Object.getOwnPropertyNames(Object.getPrototypeOf(persistence)).filter(
      (name) => name !== "constructor",
    );
    expect(publicMethods.sort()).toEqual(["getIntent", "listIntents", "putIntent"]);
  });
});
