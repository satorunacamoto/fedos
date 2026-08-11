import { describe, it, expect } from "vitest";
import { FEDOS_CONVERSATION_ROLES } from "../src/os/messenger/conversations/membership/fedos_conversation_role.js";
import { FEDOS_CONVERSATION_MEMBERSHIP_STATES } from "../src/os/messenger/conversations/membership/fedos_conversation_membership_state.js";
import { toFedosConversationMembershipId } from "../src/os/messenger/conversations/membership/fedos_conversation_membership_id.js";
import { isFedosConversationMembershipTransitionAllowed } from "../src/os/messenger/conversations/membership/fedos_conversation_membership_transition.js";
import { toFedosConversationId } from "../src/os/messenger/conversations/fedos_conversation_id.js";
import { validateFedosConversationParticipantReference } from "../src/os/messenger/conversations/membership/fedos_conversation_participant_reference_validator.js";
import { toFedosBoardId, toFedosThreadId } from "../src/os/messenger/board/fedos_board_identifiers.js";

const conversationId = toFedosConversationId(toFedosBoardId("board-a")!, toFedosThreadId("thread-a")!);
const alice = validateFedosConversationParticipantReference({ authority: "nostr", publicIdentifier: "npub1alice", identityId: null })!;
const bob = validateFedosConversationParticipantReference({ authority: "nostr", publicIdentifier: "npub1bob", identityId: null })!;

describe("Secure Runtime Alpha 764-768 -- Role, State, Record, Identity, Transition Contract", () => {
  it("1. role vocabulary is exactly member/moderator/owner", () => {
    expect([...FEDOS_CONVERSATION_ROLES].sort()).toEqual(["member", "moderator", "owner"]);
  });

  it("2. membership state vocabulary is exactly active/revoked/left -- no pending/invited value", () => {
    expect([...FEDOS_CONVERSATION_MEMBERSHIP_STATES].sort()).toEqual(["active", "left", "revoked"]);
  });

  it("3. membership id is deterministic -- same (conversationId, participant) always derives the identical id", () => {
    const idA = toFedosConversationMembershipId(conversationId, alice);
    const idB = toFedosConversationMembershipId(conversationId, alice);
    expect(idA).toBe(idB);
  });

  it("4. membership id differs across different participants in the same Conversation", () => {
    const idAlice = toFedosConversationMembershipId(conversationId, alice);
    const idBob = toFedosConversationMembershipId(conversationId, bob);
    expect(idAlice).not.toBe(idBob);
  });

  it("5. membership id differs across different Conversations for the same participant", () => {
    const otherConversationId = toFedosConversationId(toFedosBoardId("board-b")!, toFedosThreadId("thread-b")!);
    const idHere = toFedosConversationMembershipId(conversationId, alice);
    const idThere = toFedosConversationMembershipId(otherConversationId, alice);
    expect(idHere).not.toBe(idThere);
  });

  it("6. transition contract -- admit only legal from nonexistent (null)", () => {
    expect(isFedosConversationMembershipTransitionAllowed(null, "admit")).toBe(true);
    expect(isFedosConversationMembershipTransitionAllowed("active", "admit")).toBe(false);
    expect(isFedosConversationMembershipTransitionAllowed("revoked", "admit")).toBe(false);
    expect(isFedosConversationMembershipTransitionAllowed("left", "admit")).toBe(false);
  });

  it("7. transition contract -- revoke/leave only legal from active", () => {
    expect(isFedosConversationMembershipTransitionAllowed("active", "revoke")).toBe(true);
    expect(isFedosConversationMembershipTransitionAllowed("active", "leave")).toBe(true);
    expect(isFedosConversationMembershipTransitionAllowed(null, "revoke")).toBe(false);
    expect(isFedosConversationMembershipTransitionAllowed(null, "leave")).toBe(false);
  });

  it("8. transition contract -- every forbidden resurrection/cross-transition is rejected", () => {
    expect(isFedosConversationMembershipTransitionAllowed("revoked", "admit")).toBe(false); // revoked -> active
    expect(isFedosConversationMembershipTransitionAllowed("left", "admit")).toBe(false); // left -> active
    expect(isFedosConversationMembershipTransitionAllowed("revoked", "leave")).toBe(false); // revoked -> left
    expect(isFedosConversationMembershipTransitionAllowed("left", "revoke")).toBe(false); // left -> revoked
  });
});
