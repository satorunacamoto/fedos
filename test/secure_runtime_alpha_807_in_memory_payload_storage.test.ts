import { describe, it, expect } from "vitest";
import { InMemoryFedosConversationPayloadStorage } from "../src/conversation/payload_storage/in_memory_fedos_conversation_payload_storage.js";
import type { FedosConversationPayloadStorage } from "../src/conversation/payload_storage/fedos_conversation_payload_storage.js";
import type { FedosConversationPayloadDescriptor } from "../src/conversation/payload_storage/fedos_conversation_payload_descriptor.js";

const DESCRIPTOR: FedosConversationPayloadDescriptor = {
  id: "payload-1" as any,
  conversationId: "board-a::thread-1" as any,
  mediaType: "application/octet-stream",
  byteLength: 3,
  createdAt: 1_700_000_000,
};
const BYTES = new Uint8Array([1, 2, 3]);

/**
 * Secure Runtime Alpha 804 ("Storage Port") / Alpha 805 ("Opaque Byte
 * Handling") / Alpha 807 ("In-Memory Payload Storage") -- Stages 14/15/17
 * of the Alpha 791-820 Conversation Retention & Private Payload
 * Storage Boundary Foundation Arc.
 */
describe("Secure Runtime Alpha 807 -- InMemoryFedosConversationPayloadStorage", () => {
  it("1. insertion: a genuinely new payload is accepted", () => {
    const storage = new InMemoryFedosConversationPayloadStorage();
    expect(storage.putPayload(DESCRIPTOR, BYTES)).toBe("inserted");
    expect(storage.getPayload(DESCRIPTOR.id)?.bytes).toEqual(BYTES);
  });

  it("2. idempotency: identical descriptor + bytes returns already-present", () => {
    const storage = new InMemoryFedosConversationPayloadStorage();
    storage.putPayload(DESCRIPTOR, BYTES);
    expect(storage.putPayload({ ...DESCRIPTOR }, new Uint8Array(BYTES))).toBe("already-present");
  });

  it("3. conflict: same id, different bytes is rejected, original preserved", () => {
    const storage = new InMemoryFedosConversationPayloadStorage();
    storage.putPayload(DESCRIPTOR, BYTES);
    expect(storage.putPayload(DESCRIPTOR, new Uint8Array([9, 9, 9]))).toBe("conflict");
    expect(storage.getPayload(DESCRIPTOR.id)?.bytes).toEqual(BYTES);
  });

  it("4. immutable byte copies on WRITE: mutating the caller's own array after put() does not affect stored bytes", () => {
    const storage = new InMemoryFedosConversationPayloadStorage();
    const callerBytes = new Uint8Array([1, 2, 3]);
    storage.putPayload(DESCRIPTOR, callerBytes);
    callerBytes[0] = 99;
    expect(storage.getPayload(DESCRIPTOR.id)?.bytes).toEqual(new Uint8Array([1, 2, 3]));
  });

  it("5. immutable byte copies on READ: mutating the returned array does not affect the stored bytes", () => {
    const storage = new InMemoryFedosConversationPayloadStorage();
    storage.putPayload(DESCRIPTOR, BYTES);
    const first = storage.getPayload(DESCRIPTOR.id)!;
    first.bytes[0] = 42;
    const second = storage.getPayload(DESCRIPTOR.id)!;
    expect(second.bytes).toEqual(BYTES);
  });

  it("6. independent instances never share state", () => {
    const a = new InMemoryFedosConversationPayloadStorage();
    const b = new InMemoryFedosConversationPayloadStorage();
    a.putPayload(DESCRIPTOR, BYTES);
    expect(b.getPayload(DESCRIPTOR.id)).toBeNull();
  });

  it("7. list by Conversation: returns descriptors only, no bytes field", () => {
    const storage = new InMemoryFedosConversationPayloadStorage();
    storage.putPayload(DESCRIPTOR, BYTES);
    const results = storage.listConversationPayloads(DESCRIPTOR.conversationId);
    expect(results).toHaveLength(1);
    expect((results[0] as any).bytes).toBeUndefined();
  });

  it("8. no cross-conversation lookup leak", () => {
    const storage = new InMemoryFedosConversationPayloadStorage();
    storage.putPayload(DESCRIPTOR, BYTES);
    expect(storage.listConversationPayloads("board-b::thread-2" as any)).toHaveLength(0);
  });

  it("9. getDescriptor returns metadata only, matching getPayload's own descriptor", () => {
    const storage = new InMemoryFedosConversationPayloadStorage();
    storage.putPayload(DESCRIPTOR, BYTES);
    expect(storage.getDescriptor(DESCRIPTOR.id)).toEqual(DESCRIPTOR);
  });

  it("10. getPayload/getDescriptor return null for a nonexistent id", () => {
    const storage = new InMemoryFedosConversationPayloadStorage();
    expect(storage.getPayload("does-not-exist" as any)).toBeNull();
    expect(storage.getDescriptor("does-not-exist" as any)).toBeNull();
  });

  it("11. type-level: satisfies FedosConversationPayloadStorage, no delete method", () => {
    const storage: FedosConversationPayloadStorage = new InMemoryFedosConversationPayloadStorage();
    expect(typeof storage.putPayload).toBe("function");
    expect(typeof storage.getPayload).toBe("function");
    expect(typeof storage.getDescriptor).toBe("function");
    expect(typeof storage.listConversationPayloads).toBe("function");
    expect((storage as unknown as Record<string, unknown>).deletePayload).toBeUndefined();
  });

  it("12. 100 payloads: correctness holds at a modest scale", () => {
    const storage = new InMemoryFedosConversationPayloadStorage();
    for (let i = 0; i < 100; i += 1) {
      storage.putPayload(
        { ...DESCRIPTOR, id: `payload-${i}` as any, conversationId: "board-bulk::thread-1" as any },
        new Uint8Array([i]),
      );
    }
    expect(storage.listConversationPayloads("board-bulk::thread-1" as any)).toHaveLength(100);
    expect(storage.getPayload("payload-50" as any)?.bytes).toEqual(new Uint8Array([50]));
  });
});
