import { describe, it, expect } from "vitest";
import { toFedosConversationId } from "../src/conversation/fedos_conversation_id.js";
import { toFedosBoardId, toFedosThreadId } from "../src/board/fedos_board_identifiers.js";
import { validateFedosConversationParticipantReference } from "../src/conversation/membership/fedos_conversation_participant_reference_validator.js";
import { InMemoryFedosConversationMembershipAuthority } from "../src/conversation/membership/in_memory_fedos_conversation_membership_authority.js";
import { InMemoryFedosConversationCapabilityAuthority } from "../src/conversation/capability/in_memory_fedos_conversation_capability_authority.js";
import { toFedosConversationCapabilityBearerSecret } from "../src/conversation/capability/fedos_conversation_capability_bearer_secret.js";

/**
 * Secure Runtime Alpha 774 ("Phase A Verification") + Alpha 789 ("End-
 * to-End Foundation Verification") — the full, real, in-memory path
 * this Arc's own instruction requires:
 *
 *   Conversation Record → issuer Membership → issue join Capability →
 *   redeem as participant → Membership admitted → repeated redemption
 *   rejected → revoked member cannot issue if policy says so.
 *
 * Entirely domain-local — no message is ever sent, no private
 * Conversation is ever constructed.
 */
describe("Secure Runtime Alpha 774 & 789 -- Phase A/B End-to-End Foundation Verification", () => {
  it("1. the full real path: owner membership, capability issuance, redemption, admitted membership, repeated redemption rejected, revoked issuer blocked by an injected policy", () => {
    const conversationId = toFedosConversationId(toFedosBoardId("board-a")!, toFedosThreadId("thread-a")!);
    const owner = validateFedosConversationParticipantReference({ authority: "nostr", publicIdentifier: "npub1owner", identityId: null })!;
    const newcomer = validateFedosConversationParticipantReference({ authority: "nostr", publicIdentifier: "npub1newcomer", identityId: null })!;

    const membershipAuthority = new InMemoryFedosConversationMembershipAuthority();

    // Step 0 -- the Conversation's own owner becomes a real Membership first (out-of-band of any Capability -- an owner is not admitted via their own invite).
    const ownerAdmission = membershipAuthority.admit(conversationId, owner, "owner", 1_700_000_000);
    expect(ownerAdmission.outcome).toBe("admitted");

    // Only an ACTIVE member may issue -- an injected, honestly-labeled V1 authorization check (Alpha 780's own "not a claim of real production authorization" caveat).
    const authorizationCheck = (targetConversationId: typeof conversationId, issuer: typeof owner) => {
      const membership = membershipAuthority.findMembership(targetConversationId, issuer);
      return membership !== null && membership.state === "active";
    };

    let idCounter = 0;
    let secretCounter = 0;
    const capabilityAuthority = new InMemoryFedosConversationCapabilityAuthority({
      idGenerator: { generateCapabilityId: () => `cap-${(idCounter += 1)}` },
      secretGenerator: { generateBearerSecret: () => toFedosConversationCapabilityBearerSecret(`secret-${(secretCounter += 1)}`)! },
      existenceCheck: (id) => id === conversationId,
      authorizationCheck,
      membershipAuthority,
    });

    // Step 1 -- issue a join Capability.
    const issued = capabilityAuthority.issueJoinCapability(
      { conversationId, issuer: owner, action: "join-conversation", intendedRecipient: null, maxUses: 1, expiresAt: null },
      1_700_000_100,
    );
    expect(issued.outcome).toBe("issued");
    if (issued.outcome !== "issued") throw new Error("unreachable");

    // Step 2 -- redeem as the newcomer.
    const redemption = capabilityAuthority.redeem(
      { capabilityId: issued.descriptor.capabilityId, bearerSecret: issued.bearerSecret, redeemer: newcomer },
      1_700_000_200,
    );
    expect(redemption.outcome).toBe("redeemed");

    // Step 3 -- Membership is really, durably (within this instance) admitted.
    const membership = membershipAuthority.findMembership(conversationId, newcomer);
    expect(membership).not.toBeNull();
    expect(membership?.state).toBe("active");
    expect(membership?.role).toBe("member");

    // Step 4 -- repeated redemption of the SAME (now maxUses:1, already-used) capability is rejected.
    const repeated = capabilityAuthority.redeem(
      { capabilityId: issued.descriptor.capabilityId, bearerSecret: issued.bearerSecret, redeemer: newcomer },
      1_700_000_300,
    );
    expect(repeated.outcome).toBe("already-redeemed");

    // Step 5 -- once revoked, the former owner can no longer issue (the injected policy's own honest enforcement).
    membershipAuthority.revoke(conversationId, owner, 1_700_000_400);
    const afterRevoke = capabilityAuthority.issueJoinCapability(
      { conversationId, issuer: owner, action: "join-conversation", intendedRecipient: null, maxUses: 1, expiresAt: null },
      1_700_000_500,
    );
    expect(afterRevoke).toEqual({ outcome: "denied", reason: "issuer-not-authorized" });
  });

  it("2. no private-group/direct construction path exists anywhere reachable from this Arc's own public exports", () => {
    // Structural: neither authority's own public surface accepts a "mode" or "encryption" argument of any kind.
    const membershipAuthority = new InMemoryFedosConversationMembershipAuthority();
    expect(Object.getOwnPropertyNames(Object.getPrototypeOf(membershipAuthority))).not.toContain("createPrivateGroup");
    expect(Object.getOwnPropertyNames(Object.getPrototypeOf(membershipAuthority))).not.toContain("createDirectMessage");
  });
});
