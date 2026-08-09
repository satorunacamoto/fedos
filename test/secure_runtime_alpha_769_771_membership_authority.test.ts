import { describe, it, expect } from "vitest";
import { InMemoryFedosConversationMembershipAuthority } from "../src/os/messenger/conversations/membership/in_memory_fedos_conversation_membership_authority.js";
import { toFedosConversationId } from "../src/os/messenger/conversations/fedos_conversation_id.js";
import { toFedosBoardId, toFedosThreadId } from "../src/os/messenger/board/fedos_board_identifiers.js";
import { validateFedosConversationParticipantReference } from "../src/os/messenger/conversations/membership/fedos_conversation_participant_reference_validator.js";

const conversationId = toFedosConversationId(toFedosBoardId("board-a")!, toFedosThreadId("thread-a")!);
const alice = validateFedosConversationParticipantReference({ authority: "nostr", publicIdentifier: "npub1alice", identityId: null })!;
const bob = validateFedosConversationParticipantReference({ authority: "nostr", publicIdentifier: "npub1bob", identityId: null })!;

describe("Secure Runtime Alpha 769-771 -- Membership Result Vocabulary, Authority Interface, In-Memory Implementation", () => {
  it("1. previewAdmission -- would-admit for a not-yet-existing membership", () => {
    const authority = new InMemoryFedosConversationMembershipAuthority();
    expect(authority.previewAdmission(conversationId, alice)).toEqual({ outcome: "would-admit" });
  });

  it("2. admit -- real, observable state change", () => {
    const authority = new InMemoryFedosConversationMembershipAuthority();
    const result = authority.admit(conversationId, alice, "member", 1_700_000_000);
    expect(result.outcome).toBe("admitted");
    if (result.outcome !== "admitted") throw new Error("unreachable");
    expect(result.membership.conversationId).toBe(conversationId);
    expect(result.membership.participant).toEqual(alice);
    expect(result.membership.role).toBe("member");
    expect(result.membership.state).toBe("active");
    expect(result.membership.joinedAt).toBe(1_700_000_000);
    expect(result.membership.endedAt).toBeNull();
  });

  it("3. admit -- idempotent for an identical (conversation, participant, role) triple", () => {
    const authority = new InMemoryFedosConversationMembershipAuthority();
    authority.admit(conversationId, alice, "member", 1_700_000_000);
    const second = authority.admit(conversationId, alice, "member", 1_700_000_500);
    expect(second.outcome).toBe("already-present");
  });

  it("4. admit -- conflicting role on an already-active membership is a real conflict, not silently overwritten", () => {
    const authority = new InMemoryFedosConversationMembershipAuthority();
    authority.admit(conversationId, alice, "member", 1_700_000_000);
    const conflicting = authority.admit(conversationId, alice, "owner", 1_700_000_500);
    expect(conflicting).toEqual({ outcome: "conflict" });
    // the original membership is untouched
    expect(authority.findMembership(conversationId, alice)?.role).toBe("member");
  });

  it("5. previewAdmission after admit -- already-active", () => {
    const authority = new InMemoryFedosConversationMembershipAuthority();
    authority.admit(conversationId, alice, "member", 1_700_000_000);
    expect(authority.previewAdmission(conversationId, alice)).toEqual({ outcome: "already-active" });
  });

  it("6. revoke -- transitions active to revoked", () => {
    const authority = new InMemoryFedosConversationMembershipAuthority();
    authority.admit(conversationId, alice, "member", 1_700_000_000);
    const result = authority.revoke(conversationId, alice, 1_700_001_000);
    expect(result.outcome).toBe("revoked");
    if (result.outcome !== "revoked") throw new Error("unreachable");
    expect(result.membership.state).toBe("revoked");
    expect(result.membership.endedAt).toBe(1_700_001_000);
  });

  it("7. leave -- transitions active to left", () => {
    const authority = new InMemoryFedosConversationMembershipAuthority();
    authority.admit(conversationId, alice, "member", 1_700_000_000);
    const result = authority.leave(conversationId, alice, 1_700_001_000);
    expect(result.outcome).toBe("left");
  });

  it("8. revoke on a not-found membership -- not-found, never throws", () => {
    const authority = new InMemoryFedosConversationMembershipAuthority();
    expect(authority.revoke(conversationId, alice, 1_700_000_000)).toEqual({ outcome: "not-found" });
  });

  it("9. invalid resurrection -- revoked never reactivates via admit(), revoke(), or leave()", () => {
    const authority = new InMemoryFedosConversationMembershipAuthority();
    authority.admit(conversationId, alice, "member", 1_700_000_000);
    authority.revoke(conversationId, alice, 1_700_001_000);

    expect(authority.admit(conversationId, alice, "member", 1_700_002_000)).toEqual({ outcome: "invalid-transition" });
    expect(authority.revoke(conversationId, alice, 1_700_002_000)).toEqual({ outcome: "invalid-transition" });
    expect(authority.leave(conversationId, alice, 1_700_002_000)).toEqual({ outcome: "invalid-transition" });
    expect(authority.findMembership(conversationId, alice)?.state).toBe("revoked");
  });

  it("10. invalid resurrection -- left never reactivates via admit(), revoke(), or leave()", () => {
    const authority = new InMemoryFedosConversationMembershipAuthority();
    authority.admit(conversationId, alice, "member", 1_700_000_000);
    authority.leave(conversationId, alice, 1_700_001_000);

    expect(authority.admit(conversationId, alice, "member", 1_700_002_000)).toEqual({ outcome: "invalid-transition" });
    expect(authority.revoke(conversationId, alice, 1_700_002_000)).toEqual({ outcome: "invalid-transition" });
    expect(authority.leave(conversationId, alice, 1_700_002_000)).toEqual({ outcome: "invalid-transition" });
  });

  it("11. two Conversations -- membership in one never contaminates the other", () => {
    const authority = new InMemoryFedosConversationMembershipAuthority();
    const otherConversationId = toFedosConversationId(toFedosBoardId("board-b")!, toFedosThreadId("thread-b")!);
    authority.admit(conversationId, alice, "member", 1_700_000_000);
    expect(authority.findMembership(otherConversationId, alice)).toBeNull();
    expect(authority.listMemberships(otherConversationId)).toEqual([]);
    expect(authority.listMemberships(conversationId)).toHaveLength(1);
  });

  it("12. same publicIdentifier across distinct authorities are distinct memberships", () => {
    const authority = new InMemoryFedosConversationMembershipAuthority();
    const nostrAlice = validateFedosConversationParticipantReference({ authority: "nostr", publicIdentifier: "same-id", identityId: null })!;
    const fedosAlice = validateFedosConversationParticipantReference({ authority: "fedos", publicIdentifier: "same-id", identityId: null })!;
    authority.admit(conversationId, nostrAlice, "member", 1_700_000_000);
    expect(authority.findMembership(conversationId, fedosAlice)).toBeNull();
    expect(authority.listMemberships(conversationId)).toHaveLength(1);
  });

  it("13. independent instances never share state", () => {
    const authorityA = new InMemoryFedosConversationMembershipAuthority();
    const authorityB = new InMemoryFedosConversationMembershipAuthority();
    authorityA.admit(conversationId, alice, "member", 1_700_000_000);
    expect(authorityB.findMembership(conversationId, alice)).toBeNull();
  });

  it("14. returned records are immutable -- caller mutation never affects internal state", () => {
    const authority = new InMemoryFedosConversationMembershipAuthority();
    const admitted = authority.admit(conversationId, alice, "member", 1_700_000_000);
    if (admitted.outcome !== "admitted") throw new Error("unreachable");
    expect(Object.isFrozen(admitted.membership)).toBe(true);
    expect(Object.isFrozen(admitted.membership.participant)).toBe(true);
    expect(() => {
      (admitted.membership as { role: string }).role = "owner";
    }).toThrow();
    expect(authority.findMembership(conversationId, alice)?.role).toBe("member");
  });

  it("15. listMemberships returns a NEW array every call", () => {
    const authority = new InMemoryFedosConversationMembershipAuthority();
    authority.admit(conversationId, alice, "member", 1_700_000_000);
    expect(authority.listMemberships(conversationId)).not.toBe(authority.listMemberships(conversationId));
  });

  it("16. two distinct participants in the same Conversation coexist", () => {
    const authority = new InMemoryFedosConversationMembershipAuthority();
    authority.admit(conversationId, alice, "member", 1_700_000_000);
    authority.admit(conversationId, bob, "moderator", 1_700_000_100);
    const list = authority.listMemberships(conversationId);
    expect(list).toHaveLength(2);
    expect(list.map((m) => m.role).sort()).toEqual(["member", "moderator"]);
  });
});
