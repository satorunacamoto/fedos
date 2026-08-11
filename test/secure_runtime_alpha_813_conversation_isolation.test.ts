import { describe, it, expect } from "vitest";
import { InMemoryFedosConversationPayloadStorage } from "../src/os/messenger/conversations/payload_storage/in_memory_fedos_conversation_payload_storage.js";
import type { FedosConversationPayloadDescriptor } from "../src/os/messenger/conversations/payload_storage/fedos_conversation_payload_descriptor.js";

const DESCRIPTOR_A: FedosConversationPayloadDescriptor = {
  id: "payload-1" as any,
  conversationId: "board-a::thread-1" as any,
  mediaType: "application/octet-stream",
  byteLength: 3,
  createdAt: 1_700_000_000,
};
const DESCRIPTOR_B: FedosConversationPayloadDescriptor = {
  id: "payload-2" as any,
  conversationId: "board-b::thread-2" as any,
  mediaType: "application/octet-stream",
  byteLength: 3,
  createdAt: 1_700_000_000,
};

/**
 * Secure Runtime Alpha 810 ("Storage Read Semantics") / Alpha 813
 * ("Conversation Isolation") -- Stages 20/23 of the Alpha 791-820
 * Conversation Retention & Private Payload Storage Boundary Foundation
 * Arc.
 */
describe("Secure Runtime Alpha 813 -- Conversation Isolation", () => {
  it("1. a payload for Conversation A is never listed under Conversation B", () => {
    const storage = new InMemoryFedosConversationPayloadStorage();
    storage.putPayload(DESCRIPTOR_A, new Uint8Array([1, 2, 3]));
    storage.putPayload(DESCRIPTOR_B, new Uint8Array([4, 5, 6]));
    expect(storage.listConversationPayloads(DESCRIPTOR_A.conversationId).map((d) => d.id)).toEqual([DESCRIPTOR_A.id]);
    expect(storage.listConversationPayloads(DESCRIPTOR_B.conversationId).map((d) => d.id)).toEqual([DESCRIPTOR_B.id]);
  });

  it("2. getPayload/getDescriptor require the caller to already know the exact payload id -- no 'list all bytes for a conversation' operation exists", () => {
    const storage = new InMemoryFedosConversationPayloadStorage();
    const methodNames = Object.getOwnPropertyNames(Object.getPrototypeOf(storage)).filter((n) => n !== "constructor");
    expect(methodNames.sort()).toEqual(["getDescriptor", "getPayload", "listConversationPayloads", "putPayload"].sort());
    // listConversationPayloads' own return type carries no `bytes` field --
    // confirmed structurally in alpha_807's own test 7; re-confirmed here
    // as the isolation-relevant half of that same guarantee.
    storage.putPayload(DESCRIPTOR_A, new Uint8Array([1, 2, 3]));
    const listed = storage.listConversationPayloads(DESCRIPTOR_A.conversationId);
    expect((listed[0] as any).bytes).toBeUndefined();
  });

  it("3. storage itself is not a complete authorization system -- getPayload succeeds for ANY caller who knows the id, no membership/policy check happens here", () => {
    const storage = new InMemoryFedosConversationPayloadStorage();
    storage.putPayload(DESCRIPTOR_A, new Uint8Array([1, 2, 3]));
    // No membership/policy gate exists at this layer -- confirmed by the
    // fact that a bare payload id is sufficient. A future Membership/
    // Policy gate wrapping reads is explicitly NOT this Arc's own scope
    // (Alpha 813's own instruction) -- FedosPayloadRetentionAuthority
    // (Alpha 796/811) gates on RETENTION state only, never on identity/
    // membership.
    expect(storage.getPayload(DESCRIPTOR_A.id)).not.toBeNull();
  });

  it("4. missing descriptor: getPayload/getDescriptor both return null, never throw", () => {
    const storage = new InMemoryFedosConversationPayloadStorage();
    expect(() => storage.getPayload("does-not-exist" as any)).not.toThrow();
    expect(storage.getPayload("does-not-exist" as any)).toBeNull();
    expect(storage.getDescriptor("does-not-exist" as any)).toBeNull();
  });

  it("5. listConversationPayloads for an unknown conversationId returns an empty array, never throws", () => {
    const storage = new InMemoryFedosConversationPayloadStorage();
    expect(() => storage.listConversationPayloads("does-not-exist" as any)).not.toThrow();
    expect(storage.listConversationPayloads("does-not-exist" as any)).toEqual([]);
  });
});
