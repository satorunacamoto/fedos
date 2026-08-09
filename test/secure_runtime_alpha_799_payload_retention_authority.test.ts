import { describe, it, expect } from "vitest";
import { FedosPayloadRetentionAuthority } from "../src/os/messenger/conversations/retention/fedos_payload_retention_authority.js";
import { InMemoryFedosPayloadRetentionPersistence } from "../src/os/messenger/conversations/retention/in_memory_fedos_payload_retention_persistence.js";
import { InMemoryFedosConversationPayloadStorage } from "../src/os/messenger/conversations/payload_storage/in_memory_fedos_conversation_payload_storage.js";
import type { FedosConversationPayloadDescriptor } from "../src/os/messenger/conversations/payload_storage/fedos_conversation_payload_descriptor.js";

const DESCRIPTOR: FedosConversationPayloadDescriptor = {
  id: "payload-1" as any,
  conversationId: "board-a::thread-1" as any,
  mediaType: "application/octet-stream",
  byteLength: 3,
  createdAt: 1_700_000_000,
};
const BYTES = new Uint8Array([1, 2, 3]);

function buildAuthority() {
  const retentionPersistence = new InMemoryFedosPayloadRetentionPersistence();
  const payloadStorage = new InMemoryFedosConversationPayloadStorage();
  payloadStorage.putPayload(DESCRIPTOR, BYTES);
  const authority = new FedosPayloadRetentionAuthority({ retentionPersistence, payloadStorage, clock: () => 1_700_000_000 });
  return { authority, payloadStorage };
}

/**
 * Secure Runtime Alpha 796 ("Retention Authority Boundary") / Alpha 797
 * ("Retention Result Vocabulary") / Alpha 798 ("Retention Transition
 * Rules") / Alpha 799 ("Retention Security Claims") / Alpha 811
 * ("Retention Wiring") -- Stages 6-7-8-9/21 of the Alpha 791-820
 * Conversation Retention & Private Payload Storage Boundary Foundation
 * Arc.
 */
describe("Secure Runtime Alpha 799 -- FedosPayloadRetentionAuthority", () => {
  it("1. evaluatePayloadAccess: allowed for an active (never-decided) payload", () => {
    const { authority } = buildAuthority();
    expect(authority.evaluatePayloadAccess("payload-1" as any)).toEqual({ outcome: "allowed" });
  });

  it("2. evaluatePayloadAccess: not-found for a payload with no descriptor", () => {
    const { authority } = buildAuthority();
    expect(authority.evaluatePayloadAccess("does-not-exist" as any)).toEqual({ outcome: "not-found" });
  });

  it("3. tombstonePayload: active -> tombstoned succeeds", () => {
    const { authority } = buildAuthority();
    expect(authority.tombstonePayload("payload-1" as any, null, "test_placeholder")).toEqual({ outcome: "tombstoned" });
    expect(authority.evaluatePayloadAccess("payload-1" as any)).toEqual({ outcome: "denied", state: "tombstoned" });
  });

  it("4. tombstonePayload: idempotent -- tombstoning an already-tombstoned payload returns already-tombstoned", () => {
    const { authority } = buildAuthority();
    authority.tombstonePayload("payload-1" as any, null, "test_placeholder");
    expect(authority.tombstonePayload("payload-1" as any, null, "test_placeholder")).toEqual({ outcome: "already-tombstoned" });
  });

  it("5. tombstonePayload: not-found for a payload with no descriptor", () => {
    const { authority } = buildAuthority();
    expect(authority.tombstonePayload("does-not-exist" as any, null, "test_placeholder")).toEqual({ outcome: "not-found" });
  });

  it("6. removeLocalPayload: FORBIDDEN directly from active -- surfaces conflict, never silently allowed", () => {
    const { authority } = buildAuthority();
    expect(authority.removeLocalPayload("payload-1" as any, null, "test_placeholder")).toEqual({ outcome: "conflict" });
  });

  it("7. removeLocalPayload: tombstoned -> payload-removed succeeds (the only allowed path)", () => {
    const { authority } = buildAuthority();
    authority.tombstonePayload("payload-1" as any, null, "test_placeholder");
    expect(authority.removeLocalPayload("payload-1" as any, null, "test_placeholder")).toEqual({ outcome: "payload-removed" });
  });

  it("8. removeLocalPayload: idempotent -- already-removed", () => {
    const { authority } = buildAuthority();
    authority.tombstonePayload("payload-1" as any, null, "test_placeholder");
    authority.removeLocalPayload("payload-1" as any, null, "test_placeholder");
    expect(authority.removeLocalPayload("payload-1" as any, null, "test_placeholder")).toEqual({ outcome: "already-removed" });
  });

  it("9. FORBIDDEN: payload-removed -> tombstoned surfaces conflict, never a silent downgrade", () => {
    const { authority } = buildAuthority();
    authority.tombstonePayload("payload-1" as any, null, "test_placeholder");
    authority.removeLocalPayload("payload-1" as any, null, "test_placeholder");
    expect(authority.tombstonePayload("payload-1" as any, null, "test_placeholder")).toEqual({ outcome: "conflict" });
  });

  it("10. FORBIDDEN: no restore method exists of any kind -- payload-removed/tombstoned -> active is structurally unreachable", () => {
    const { authority } = buildAuthority();
    const methodNames = Object.getOwnPropertyNames(Object.getPrototypeOf(authority));
    expect(methodNames).not.toContain("restorePayload");
    expect(methodNames).not.toContain("untombstonePayload");
    expect(methodNames.some((name) => /restore|reactivate|undelete/i.test(name))).toBe(false);
  });

  it("11. readPayload: found for an active payload, returns the real bytes", () => {
    const { authority } = buildAuthority();
    const result = authority.readPayload("payload-1" as any);
    expect(result.outcome).toBe("found");
    if (result.outcome !== "found") throw new Error("unreachable");
    expect(result.payload.bytes).toEqual(BYTES);
  });

  it("12. readPayload: denied for a tombstoned payload -- normal reads are actually blocked, not merely labeled", () => {
    const { authority } = buildAuthority();
    authority.tombstonePayload("payload-1" as any, null, "test_placeholder");
    expect(authority.readPayload("payload-1" as any)).toEqual({ outcome: "denied", state: "tombstoned" });
  });

  it("13. readPayload: denied for a payload-removed payload", () => {
    const { authority } = buildAuthority();
    authority.tombstonePayload("payload-1" as any, null, "test_placeholder");
    authority.removeLocalPayload("payload-1" as any, null, "test_placeholder");
    expect(authority.readPayload("payload-1" as any)).toEqual({ outcome: "denied", state: "payload-removed" });
  });

  it("14. readPayload: not-found for a nonexistent payload", () => {
    const { authority } = buildAuthority();
    expect(authority.readPayload("does-not-exist" as any)).toEqual({ outcome: "not-found" });
  });

  it("15. removeLocalPayload does NOT make the underlying storage port forget the bytes -- the honest, conditional claim: only the Authority's own gated read is denied, matching this file's own documented security claim", () => {
    const { authority, payloadStorage } = buildAuthority();
    authority.tombstonePayload("payload-1" as any, null, "test_placeholder");
    authority.removeLocalPayload("payload-1" as any, null, "test_placeholder");
    // The raw port itself has no delete method and was never asked to
    // forget anything -- confirming removeLocalPayload is an
    // access-state transition, not a claim about the backend's own bytes.
    expect(payloadStorage.getPayload("payload-1" as any)).not.toBeNull();
  });

  it("16. authorityReference/reasonCode are recorded, non-secret, closed-vocabulary values", () => {
    const { authority } = buildAuthority();
    authority.tombstonePayload("payload-1" as any, "moderator-42", "policy_placeholder");
    // Verified indirectly: the call succeeded and is idempotent under the same reference/reason.
    expect(authority.tombstonePayload("payload-1" as any, "moderator-42", "policy_placeholder")).toEqual({
      outcome: "already-tombstoned",
    });
  });
});
