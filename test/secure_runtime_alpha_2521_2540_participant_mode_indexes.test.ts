import { describe, it, expect } from "vitest";
import { InMemoryFedosConversationMembershipAuthority } from "../src/conversation/membership/in_memory_fedos_conversation_membership_authority.js";
import { InMemoryFedosConversationDraftPersistence } from "../src/conversation/construction/in_memory_fedos_conversation_draft_persistence.js";
import type { FedosPersistedConversationDraftRecordV1 } from "../src/conversation/construction/fedos_persisted_conversation_draft_record_v1.js";
import { FedosConversationSearchParticipantIndex } from "../src/conversation/search/fedos_conversation_search_participant_index.js";
import { FedosConversationSearchModeIndex } from "../src/conversation/search/fedos_conversation_search_mode_index.js";
import type { FedosConversationSearchEnvelopeDocument } from "../src/conversation/search/fedos_conversation_search_document.js";
import type { FedosConversationId } from "../src/conversation/fedos_conversation_id.js";
import type { FedosConversationEnvelopeId } from "../src/conversation/envelope/fedos_conversation_envelope_id.js";
import type { FedosConversationMembershipId } from "../src/conversation/membership/fedos_conversation_membership_id.js";
import type { FedosConversationParticipantReference } from "../src/conversation/membership/fedos_conversation_participant_reference.js";

const DIRECT_ID = "private-draft::direct::req-1" as FedosConversationId;
const GROUP_ID = "private-draft::private-group::req-2" as FedosConversationId;

const ALICE: FedosConversationParticipantReference = { authority: "fedos", publicIdentifier: "alice", identityId: null };
const BOB: FedosConversationParticipantReference = { authority: "fedos", publicIdentifier: "bob", identityId: null };

function doc(
  envelopeId: string,
  conversationId: FedosConversationId,
  senderMembershipId: string,
  overrides: Partial<FedosConversationSearchEnvelopeDocument> = {},
): FedosConversationSearchEnvelopeDocument {
  return {
    envelopeId: envelopeId as FedosConversationEnvelopeId,
    conversationId,
    senderMembershipId: senderMembershipId as FedosConversationMembershipId,
    createdAt: 1_700_000_000,
    replyToEnvelopeId: null,
    text: null,
    ...overrides,
  };
}

describe("Secure Runtime Alpha 2521-2540 -- Participant Index", () => {
  it("1. resolves senderMembershipId to a participant via the injected FedosConversationMembershipAuthority (Reuse Conversation Runtime)", () => {
    const membershipAuthority = new InMemoryFedosConversationMembershipAuthority();
    const admitted = membershipAuthority.admit(DIRECT_ID, ALICE, "owner", 1_700_000_000);
    if (admitted.outcome !== "admitted") throw new Error("setup failed");

    const index = new FedosConversationSearchParticipantIndex({ membershipAuthority });
    index.indexDocument(doc("e1", DIRECT_ID, admitted.membership.id));

    expect(index.envelopesByParticipant(ALICE)).toEqual(["e1"]);
    expect(index.conversationsByParticipant(ALICE)).toEqual([DIRECT_ID]);
    expect(index.envelopesByParticipant(BOB)).toEqual([]);
  });

  it("2. an unresolvable senderMembershipId fails closed into the unknown bucket, never throws", () => {
    const membershipAuthority = new InMemoryFedosConversationMembershipAuthority();
    const index = new FedosConversationSearchParticipantIndex({ membershipAuthority });
    expect(() => index.indexDocument(doc("e1", DIRECT_ID, "nonexistent-membership-id"))).not.toThrow();
    expect(index.envelopesByParticipant(ALICE)).toEqual([]);
  });

  it("3. removeDocument reverses indexDocument", () => {
    const membershipAuthority = new InMemoryFedosConversationMembershipAuthority();
    const admitted = membershipAuthority.admit(DIRECT_ID, ALICE, "owner", 1_700_000_000);
    if (admitted.outcome !== "admitted") throw new Error("setup failed");

    const index = new FedosConversationSearchParticipantIndex({ membershipAuthority });
    index.indexDocument(doc("e1", DIRECT_ID, admitted.membership.id));
    index.removeDocument("e1" as FedosConversationEnvelopeId);
    expect(index.envelopesByParticipant(ALICE)).toEqual([]);
  });

  it("4. distinguishes two participants sending into the same conversation", () => {
    const membershipAuthority = new InMemoryFedosConversationMembershipAuthority();
    const aliceMembership = membershipAuthority.admit(GROUP_ID, ALICE, "owner", 1_700_000_000);
    const bobMembership = membershipAuthority.admit(GROUP_ID, BOB, "member", 1_700_000_001);
    if (aliceMembership.outcome !== "admitted" || bobMembership.outcome !== "admitted") throw new Error("setup failed");

    const index = new FedosConversationSearchParticipantIndex({ membershipAuthority });
    index.indexDocument(doc("e1", GROUP_ID, aliceMembership.membership.id));
    index.indexDocument(doc("e2", GROUP_ID, bobMembership.membership.id));

    expect(index.envelopesByParticipant(ALICE)).toEqual(["e1"]);
    expect(index.envelopesByParticipant(BOB)).toEqual(["e2"]);
  });
});

function draftRecord(id: FedosConversationId, mode: "direct" | "private-group"): FedosPersistedConversationDraftRecordV1 {
  return {
    schemaVersion: 1,
    id,
    mode,
    lifecycleState: "draft",
    policyReference: mode === "direct" ? "direct-draft-v1" : "private-group-draft-v1",
    creatorAuthority: "fedos",
    creatorPublicIdentifier: "alice",
    creatorIdentityId: null,
    createdAt: 1_700_000_000,
  };
}

describe("Secure Runtime Alpha 2521-2540 -- Mode Index (group index + direct index)", () => {
  it("1. classifies a direct draft and a private-group draft correctly via one shared index (Reuse Conversation Runtime)", () => {
    const draftPersistence = new InMemoryFedosConversationDraftPersistence();
    draftPersistence.putDraft(draftRecord(DIRECT_ID, "direct"));
    draftPersistence.putDraft(draftRecord(GROUP_ID, "private-group"));

    const index = new FedosConversationSearchModeIndex({ draftPersistence });
    expect(index.indexConversation(DIRECT_ID)).toBe("direct");
    expect(index.indexConversation(GROUP_ID)).toBe("private-group");

    expect(index.directConversationIds()).toEqual([DIRECT_ID]);
    expect(index.groupConversationIds()).toEqual([GROUP_ID]);
    expect(index.modeOf(DIRECT_ID)).toBe("direct");
    expect(index.modeOf(GROUP_ID)).toBe("private-group");
  });

  it("2. a conversation id with no known draft record resolves to null, fails closed", () => {
    const draftPersistence = new InMemoryFedosConversationDraftPersistence();
    const index = new FedosConversationSearchModeIndex({ draftPersistence });
    expect(index.indexConversation("board-a::thread-1" as FedosConversationId)).toBeNull();
    expect(index.modeOf("board-a::thread-1" as FedosConversationId)).toBeNull();
    expect(index.directConversationIds()).toEqual([]);
    expect(index.groupConversationIds()).toEqual([]);
  });

  it("3. indexConversation is idempotent -- classifying twice never duplicates the entry", () => {
    const draftPersistence = new InMemoryFedosConversationDraftPersistence();
    draftPersistence.putDraft(draftRecord(DIRECT_ID, "direct"));
    const index = new FedosConversationSearchModeIndex({ draftPersistence });
    index.indexConversation(DIRECT_ID);
    index.indexConversation(DIRECT_ID);
    expect(index.directConversationIds()).toEqual([DIRECT_ID]);
  });

  it("4. removeConversation drops the classification", () => {
    const draftPersistence = new InMemoryFedosConversationDraftPersistence();
    draftPersistence.putDraft(draftRecord(DIRECT_ID, "direct"));
    const index = new FedosConversationSearchModeIndex({ draftPersistence });
    index.indexConversation(DIRECT_ID);
    index.removeConversation(DIRECT_ID);
    expect(index.modeOf(DIRECT_ID)).toBeNull();
    expect(index.directConversationIds()).toEqual([]);
  });
});
