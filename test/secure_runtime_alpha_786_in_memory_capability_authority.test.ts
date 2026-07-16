import { describe, it, expect } from "vitest";
import { InMemoryFedosConversationCapabilityAuthority } from "../src/conversation/capability/in_memory_fedos_conversation_capability_authority.js";
import { InMemoryFedosConversationMembershipAuthority } from "../src/conversation/membership/in_memory_fedos_conversation_membership_authority.js";
import { toFedosConversationCapabilityBearerSecret } from "../src/conversation/capability/fedos_conversation_capability_bearer_secret.js";
import { toFedosConversationCapabilityId } from "../src/conversation/capability/fedos_conversation_capability_id.js";
import { toFedosConversationId } from "../src/conversation/fedos_conversation_id.js";
import { toFedosBoardId, toFedosThreadId } from "../src/board/fedos_board_identifiers.js";
import { validateFedosConversationParticipantReference } from "../src/conversation/membership/fedos_conversation_participant_reference_validator.js";

const conversationId = toFedosConversationId(toFedosBoardId("board-a")!, toFedosThreadId("thread-a")!);
const issuer = validateFedosConversationParticipantReference({ authority: "nostr", publicIdentifier: "npub1owner", identityId: null })!;
const alice = validateFedosConversationParticipantReference({ authority: "nostr", publicIdentifier: "npub1alice", identityId: null })!;
const bob = validateFedosConversationParticipantReference({ authority: "nostr", publicIdentifier: "npub1bob", identityId: null })!;

function makeAuthority(existingConversationIds: Set<string> = new Set([conversationId])) {
  let secretCounter = 0;
  let idCounter = 0;
  const membershipAuthority = new InMemoryFedosConversationMembershipAuthority();
  const capabilityAuthority = new InMemoryFedosConversationCapabilityAuthority({
    idGenerator: { generateCapabilityId: () => `cap-${(idCounter += 1)}` },
    secretGenerator: { generateBearerSecret: () => toFedosConversationCapabilityBearerSecret(`secret-${(secretCounter += 1)}`)! },
    existenceCheck: (id) => existingConversationIds.has(id),
    authorizationCheck: () => true,
    membershipAuthority,
  });
  return { capabilityAuthority, membershipAuthority };
}

describe("Secure Runtime Alpha 786 -- In-Memory Capability Authority (issuance + redemption + coordination)", () => {
  it("1. issueJoinCapability -- issued, descriptor carries no secret field, bearerSecret returned separately", () => {
    const { capabilityAuthority } = makeAuthority();
    const result = capabilityAuthority.issueJoinCapability(
      { conversationId, issuer, action: "join-conversation", intendedRecipient: null, maxUses: 1, expiresAt: null },
      1_700_000_000,
    );
    expect(result.outcome).toBe("issued");
    if (result.outcome !== "issued") throw new Error("unreachable");
    expect(Object.keys(result.descriptor).sort()).toEqual(
      ["action", "capabilityId", "conversationId", "expiresAt", "intendedRecipient", "issuedAt", "issuer", "maxUses"].sort(),
    );
    expect(result.bearerSecret).toBeTruthy();
  });

  it("2. issueJoinCapability -- denied when conversation does not exist", () => {
    const { capabilityAuthority } = makeAuthority(new Set());
    const result = capabilityAuthority.issueJoinCapability(
      { conversationId, issuer, action: "join-conversation", intendedRecipient: null, maxUses: 1, expiresAt: null },
      1_700_000_000,
    );
    expect(result).toEqual({ outcome: "denied", reason: "conversation-not-found" });
  });

  it("3. issueJoinCapability -- invalid-request for a non-positive/non-integer maxUses", () => {
    const { capabilityAuthority } = makeAuthority();
    expect(
      capabilityAuthority.issueJoinCapability(
        { conversationId, issuer, action: "join-conversation", intendedRecipient: null, maxUses: 0, expiresAt: null },
        1_700_000_000,
      ).outcome,
    ).toBe("invalid-request");
  });

  it("4. redeem -- redeemed, and the redeemer becomes a real, active Membership", () => {
    const { capabilityAuthority, membershipAuthority } = makeAuthority();
    const issued = capabilityAuthority.issueJoinCapability(
      { conversationId, issuer, action: "join-conversation", intendedRecipient: null, maxUses: 1, expiresAt: null },
      1_700_000_000,
    );
    if (issued.outcome !== "issued") throw new Error("unreachable");

    const redemption = capabilityAuthority.redeem(
      { capabilityId: issued.descriptor.capabilityId, bearerSecret: issued.bearerSecret, redeemer: alice },
      1_700_000_100,
    );
    expect(redemption.outcome).toBe("redeemed");
    if (redemption.outcome !== "redeemed") throw new Error("unreachable");
    expect(redemption.membership.state).toBe("active");
    expect(membershipAuthority.findMembership(conversationId, alice)?.state).toBe("active");
  });

  it("5. redeem -- wrong bearer secret is invalid-capability, indistinguishable from an unknown capabilityId", () => {
    const { capabilityAuthority } = makeAuthority();
    const issued = capabilityAuthority.issueJoinCapability(
      { conversationId, issuer, action: "join-conversation", intendedRecipient: null, maxUses: 1, expiresAt: null },
      1_700_000_000,
    );
    if (issued.outcome !== "issued") throw new Error("unreachable");

    const wrongSecret = capabilityAuthority.redeem(
      { capabilityId: issued.descriptor.capabilityId, bearerSecret: toFedosConversationCapabilityBearerSecret("guess")!, redeemer: alice },
      1_700_000_100,
    );
    const unknownId = capabilityAuthority.redeem(
      { capabilityId: toFedosConversationCapabilityId("does-not-exist")!, bearerSecret: issued.bearerSecret, redeemer: alice },
      1_700_000_100,
    );
    expect(wrongSecret.outcome).toBe("invalid-capability");
    expect(unknownId.outcome).toBe("invalid-capability");
  });

  it("6. redeem -- duplicate redemption by the SAME redeemer is already-redeemed", () => {
    const { capabilityAuthority } = makeAuthority();
    const issued = capabilityAuthority.issueJoinCapability(
      { conversationId, issuer, action: "join-conversation", intendedRecipient: null, maxUses: 5, expiresAt: null },
      1_700_000_000,
    );
    if (issued.outcome !== "issued") throw new Error("unreachable");

    const request = { capabilityId: issued.descriptor.capabilityId, bearerSecret: issued.bearerSecret, redeemer: alice };
    capabilityAuthority.redeem(request, 1_700_000_100);
    const second = capabilityAuthority.redeem(request, 1_700_000_200);
    expect(second.outcome).toBe("already-redeemed");
  });

  it("7. redeem -- one-use capability is exhausted for a SECOND, DIFFERENT redeemer", () => {
    const { capabilityAuthority } = makeAuthority();
    const issued = capabilityAuthority.issueJoinCapability(
      { conversationId, issuer, action: "join-conversation", intendedRecipient: null, maxUses: 1, expiresAt: null },
      1_700_000_000,
    );
    if (issued.outcome !== "issued") throw new Error("unreachable");

    capabilityAuthority.redeem({ capabilityId: issued.descriptor.capabilityId, bearerSecret: issued.bearerSecret, redeemer: alice }, 1_700_000_100);
    const second = capabilityAuthority.redeem(
      { capabilityId: issued.descriptor.capabilityId, bearerSecret: issued.bearerSecret, redeemer: bob },
      1_700_000_200,
    );
    expect(second.outcome).toBe("exhausted");
  });

  it("8. redeem -- multi-use capability admits multiple distinct redeemers up to maxUses", () => {
    const { capabilityAuthority, membershipAuthority } = makeAuthority();
    const issued = capabilityAuthority.issueJoinCapability(
      { conversationId, issuer, action: "join-conversation", intendedRecipient: null, maxUses: 2, expiresAt: null },
      1_700_000_000,
    );
    if (issued.outcome !== "issued") throw new Error("unreachable");

    const first = capabilityAuthority.redeem({ capabilityId: issued.descriptor.capabilityId, bearerSecret: issued.bearerSecret, redeemer: alice }, 1_700_000_100);
    const second = capabilityAuthority.redeem({ capabilityId: issued.descriptor.capabilityId, bearerSecret: issued.bearerSecret, redeemer: bob }, 1_700_000_200);
    expect(first.outcome).toBe("redeemed");
    expect(second.outcome).toBe("redeemed");
    expect(membershipAuthority.listMemberships(conversationId)).toHaveLength(2);
  });

  it("9. redeem -- expired capability is expired, never redeemed", () => {
    const { capabilityAuthority } = makeAuthority();
    const issued = capabilityAuthority.issueJoinCapability(
      { conversationId, issuer, action: "join-conversation", intendedRecipient: null, maxUses: 1, expiresAt: 1_700_000_050 },
      1_700_000_000,
    );
    if (issued.outcome !== "issued") throw new Error("unreachable");

    const result = capabilityAuthority.redeem(
      { capabilityId: issued.descriptor.capabilityId, bearerSecret: issued.bearerSecret, redeemer: alice },
      1_700_000_100,
    );
    expect(result.outcome).toBe("expired");
  });

  it("10. redeem -- intendedRecipient mismatch is recipient-mismatch, and the capability remains usable by the correct recipient", () => {
    const { capabilityAuthority } = makeAuthority();
    const issued = capabilityAuthority.issueJoinCapability(
      { conversationId, issuer, action: "join-conversation", intendedRecipient: alice, maxUses: 1, expiresAt: null },
      1_700_000_000,
    );
    if (issued.outcome !== "issued") throw new Error("unreachable");

    const wrongRedeemer = capabilityAuthority.redeem(
      { capabilityId: issued.descriptor.capabilityId, bearerSecret: issued.bearerSecret, redeemer: bob },
      1_700_000_100,
    );
    expect(wrongRedeemer.outcome).toBe("recipient-mismatch");

    const rightRedeemer = capabilityAuthority.redeem(
      { capabilityId: issued.descriptor.capabilityId, bearerSecret: issued.bearerSecret, redeemer: alice },
      1_700_000_200,
    );
    expect(rightRedeemer.outcome).toBe("redeemed");
  });

  it("11. independent instances never share state", () => {
    const { capabilityAuthority: a } = makeAuthority();
    const { capabilityAuthority: b } = makeAuthority();
    const issued = a.issueJoinCapability(
      { conversationId, issuer, action: "join-conversation", intendedRecipient: null, maxUses: 1, expiresAt: null },
      1_700_000_000,
    );
    if (issued.outcome !== "issued") throw new Error("unreachable");
    expect(b.inspectDescriptor(issued.descriptor.capabilityId)).toBeNull();
  });

  it("12. no bearer secret ever appears on a descriptor -- inspectDescriptor never returns it", () => {
    const { capabilityAuthority } = makeAuthority();
    const issued = capabilityAuthority.issueJoinCapability(
      { conversationId, issuer, action: "join-conversation", intendedRecipient: null, maxUses: 1, expiresAt: null },
      1_700_000_000,
    );
    if (issued.outcome !== "issued") throw new Error("unreachable");
    const inspected = capabilityAuthority.inspectDescriptor(issued.descriptor.capabilityId);
    expect(JSON.stringify(inspected)).not.toContain(issued.bearerSecret as unknown as string);
  });

  it("13. remainingUses -- decreases per real redemption, never mutates after terminal exhaustion", () => {
    const { capabilityAuthority } = makeAuthority();
    const issued = capabilityAuthority.issueJoinCapability(
      { conversationId, issuer, action: "join-conversation", intendedRecipient: null, maxUses: 1, expiresAt: null },
      1_700_000_000,
    );
    if (issued.outcome !== "issued") throw new Error("unreachable");
    expect(capabilityAuthority.remainingUses(issued.descriptor.capabilityId)).toBe(1);

    capabilityAuthority.redeem({ capabilityId: issued.descriptor.capabilityId, bearerSecret: issued.bearerSecret, redeemer: alice }, 1_700_000_100);
    expect(capabilityAuthority.remainingUses(issued.descriptor.capabilityId)).toBe(0);

    // Further attempts against the exhausted capability never change remainingUses below zero.
    capabilityAuthority.redeem({ capabilityId: issued.descriptor.capabilityId, bearerSecret: issued.bearerSecret, redeemer: bob }, 1_700_000_200);
    expect(capabilityAuthority.remainingUses(issued.descriptor.capabilityId)).toBe(0);
  });
});
