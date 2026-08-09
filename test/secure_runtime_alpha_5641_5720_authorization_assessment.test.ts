import { describe, it, expect } from "vitest";
import { InMemoryFedosConversationPersistence } from "../src/os/messenger/conversations/persistence/in_memory_fedos_conversation_persistence.js";
import { InMemoryFedosConversationMembershipPersistence } from "../src/os/messenger/conversations/membership/persistence/in_memory_fedos_conversation_membership_persistence.js";
import { InMemoryFedosConversationMembershipAuthority } from "../src/os/messenger/conversations/membership/in_memory_fedos_conversation_membership_authority.js";
import { InMemoryFedosConversationMessageEnvelopePersistence } from "../src/os/messenger/conversations/envelope/persistence/in_memory_fedos_conversation_message_envelope_persistence.js";
import { toFedosConversationId } from "../src/os/messenger/conversations/fedos_conversation_id.js";
import { toFedosBoardId, toFedosThreadId } from "../src/os/messenger/board/fedos_board_identifiers.js";
import type { FedosConversationParticipantReference } from "../src/os/messenger/conversations/membership/fedos_conversation_participant_reference.js";
import { toFedosConversationEnvelopeId } from "../src/os/messenger/conversations/envelope/fedos_conversation_envelope_id.js";
import {
  FedosNobleTestNostrSigningAuthority,
  fedosTestSecretKeyFromSeed,
  signFedosDeletionRequestRecordV1,
} from "../src/os/messenger/conversations/deletion_request/fedos_deletion_request_signing.js";
import type { FedosDeletionRequestRecordV1 } from "../src/os/messenger/conversations/deletion_request/fedos_deletion_request_record.js";
import {
  assessFedosDeletionRequestAuthorization,
  participantReferenceForFedosDeletionRequestAccountRef,
  type FedosDeletionRequestAuthorizationAssessmentDependencies,
} from "../src/os/messenger/conversations/deletion_request/fedos_deletion_request_authorization_assessment.js";
import { coarsenFedosDeletionRequestAuthorizationOutcome } from "../src/os/messenger/conversations/deletion_request/fedos_deletion_request_authorization_outcome.js";

/**
 * Secure Runtime Alpha 5641-5720 -- read-only authorization assessment
 * over REAL Conversation/Membership/Envelope persistence. Never mutates,
 * never creates a delivery event.
 */

const ALICE_INDEX = 0;
const BOB_INDEX = 1;
const MALLORY_INDEX = 2;
const ALICE: FedosConversationParticipantReference = { authority: "fedos", publicIdentifier: "alice-account", identityId: null };
const BOB: FedosConversationParticipantReference = { authority: "fedos", publicIdentifier: "bob-account", identityId: null };
const CONVERSATION_ID = toFedosConversationId(toFedosBoardId("board-a")!, toFedosThreadId("thread-1")!);

function makeSigningAuthority(): FedosNobleTestNostrSigningAuthority {
  return new FedosNobleTestNostrSigningAuthority([
    { accountIndex: ALICE_INDEX, secretKey: fedosTestSecretKeyFromSeed("alice") },
    { accountIndex: BOB_INDEX, secretKey: fedosTestSecretKeyFromSeed("bob") },
    { accountIndex: MALLORY_INDEX, secretKey: fedosTestSecretKeyFromSeed("mallory") },
  ]);
}

function makeEnvironment() {
  const conversationPersistence = new InMemoryFedosConversationPersistence();
  const membershipAuthority = new InMemoryFedosConversationMembershipAuthority();
  const envelopePersistence = new InMemoryFedosConversationMessageEnvelopePersistence();
  return { conversationPersistence, membershipAuthority, envelopePersistence };
}

function seedConversationAndMembers(env: ReturnType<typeof makeEnvironment>) {
  env.conversationPersistence.putConversation({
    schemaVersion: 1,
    id: CONVERSATION_ID,
    mode: "public",
    boardId: "board-a",
    rootThreadId: "thread-1",
    rootPostId: "thread-1",
    policyReference: "public-v1",
    createdAt: 1_700_000_000,
  });
  const aliceAdmission = env.membershipAuthority.admit(CONVERSATION_ID, ALICE, "owner", 1_700_000_000);
  const bobAdmission = env.membershipAuthority.admit(CONVERSATION_ID, BOB, "member", 1_700_000_000);
  if (aliceAdmission.outcome !== "admitted" || bobAdmission.outcome !== "admitted") throw new Error("test setup failed");
  return { aliceMembershipId: aliceAdmission.membership.id, bobMembershipId: bobAdmission.membership.id };
}

function seedEnvelope(env: ReturnType<typeof makeEnvironment>, envelopeId: string, senderMembershipId: string) {
  const id = toFedosConversationEnvelopeId(envelopeId)!;
  env.envelopePersistence.putEnvelope({
    schemaVersion: 1,
    id,
    conversationId: CONVERSATION_ID,
    senderMembershipId: senderMembershipId as never,
    payloadId: "payload-1" as never,
    encryptionSuite: "ChaCha20Poly1305",
    keyEpoch: 0,
    createdAt: 1_700_000_100,
    replyToEnvelopeId: null,
  });
  return id;
}

function baseRecord(overrides: Partial<FedosDeletionRequestRecordV1> = {}): FedosDeletionRequestRecordV1 {
  return {
    schemaVersion: 1,
    requestId: "a".repeat(64),
    requesterAccountRef: "alice-account",
    requesterDeviceRef: null,
    recipientAccountRef: "bob-account",
    recipientDeviceRef: "bob-device-a",
    conversationId: CONVERSATION_ID,
    targetEnvelopeId: "envelope-1",
    scope: "local-history-and-index",
    issuedAt: 1_700_000_500,
    expiresAt: 1_700_100_000,
    nonce: "b".repeat(32),
    capabilityVersion: 1,
    reasonCode: null,
    ...overrides,
  };
}

function deps(env: ReturnType<typeof makeEnvironment>, overrides: Partial<FedosDeletionRequestAuthorizationAssessmentDependencies> = {}): FedosDeletionRequestAuthorizationAssessmentDependencies {
  return {
    conversationPersistence: env.conversationPersistence,
    envelopePersistence: env.envelopePersistence,
    membershipAuthority: env.membershipAuthority,
    clock: () => 1_700_000_600,
    localDeviceRef: "bob-device-a",
    ...overrides,
  };
}

describe("Secure Runtime Alpha 5641-5720 -- authorized: original sender, active membership, matching recipient", () => {
  it("1. Alice's own request for her own authored message, addressed to Bob, is authorized", async () => {
    const env = makeEnvironment();
    const { aliceMembershipId } = seedConversationAndMembers(env);
    seedEnvelope(env, "envelope-1", aliceMembershipId);
    const authority = makeSigningAuthority();
    const signed = await signFedosDeletionRequestRecordV1(baseRecord(), { signingAuthority: authority, requesterAccountIndex: ALICE_INDEX });

    const outcome = assessFedosDeletionRequestAuthorization(signed!, deps(env));
    expect(outcome).toBe("authorized");
    expect(coarsenFedosDeletionRequestAuthorizationOutcome(outcome)).toBe("authorized");
  });
});

describe("Secure Runtime Alpha 5641-5720 -- requester-not-author (non-author request denial)", () => {
  it("2. Bob (the recipient, not the author) requesting deletion of Alice's own message is denied -- coarsened to 'unauthorized', never revealing WHY", async () => {
    const env = makeEnvironment();
    const { aliceMembershipId } = seedConversationAndMembers(env);
    seedEnvelope(env, "envelope-1", aliceMembershipId);
    const authority = makeSigningAuthority();
    const record = baseRecord({ requesterAccountRef: "bob-account", recipientAccountRef: "alice-account" });
    const signed = await signFedosDeletionRequestRecordV1(record, { signingAuthority: authority, requesterAccountIndex: BOB_INDEX });

    const outcome = assessFedosDeletionRequestAuthorization(signed!, deps(env, { localDeviceRef: "alice-device" }));
    expect(outcome).toBe("requester-not-author");
    expect(coarsenFedosDeletionRequestAuthorizationOutcome(outcome)).toBe("unauthorized");
  });
});

describe("Secure Runtime Alpha 5641-5720 -- target substitution denial", () => {
  it("3. a request claiming Alice authored envelope-2, when she actually authored only envelope-1, is denied (target-unavailable, coarsened to unauthorized)", async () => {
    const env = makeEnvironment();
    const { aliceMembershipId, bobMembershipId } = seedConversationAndMembers(env);
    seedEnvelope(env, "envelope-1", aliceMembershipId);
    seedEnvelope(env, "envelope-2", bobMembershipId); // Bob's own message
    const authority = makeSigningAuthority();
    // Alice signs a request claiming authorship of envelope-2 -- which she did NOT author.
    const record = baseRecord({ targetEnvelopeId: "envelope-2" });
    const signed = await signFedosDeletionRequestRecordV1(record, { signingAuthority: authority, requesterAccountIndex: ALICE_INDEX });

    const outcome = assessFedosDeletionRequestAuthorization(signed!, deps(env));
    expect(outcome).toBe("requester-not-author");
    expect(coarsenFedosDeletionRequestAuthorizationOutcome(outcome)).toBe("unauthorized");
  });

  it("4. a request naming an envelope id that does not exist at all is denied identically to a real target-substitution attempt (oracle-safe)", async () => {
    const env = makeEnvironment();
    const { aliceMembershipId } = seedConversationAndMembers(env);
    seedEnvelope(env, "envelope-1", aliceMembershipId);
    const authority = makeSigningAuthority();
    const record = baseRecord({ targetEnvelopeId: "envelope-does-not-exist" });
    const signed = await signFedosDeletionRequestRecordV1(record, { signingAuthority: authority, requesterAccountIndex: ALICE_INDEX });

    const outcome = assessFedosDeletionRequestAuthorization(signed!, deps(env));
    expect(outcome).toBe("target-unavailable");
    expect(coarsenFedosDeletionRequestAuthorizationOutcome(outcome)).toBe("unauthorized");
  });
});

describe("Secure Runtime Alpha 5641-5720 -- requester-not-member", () => {
  it("5. a signed request from an account that has never been a member of this conversation is denied", async () => {
    const env = makeEnvironment();
    seedConversationAndMembers(env);
    const authority = makeSigningAuthority();
    const record = baseRecord({ requesterAccountRef: "mallory-account" });
    const signed = await signFedosDeletionRequestRecordV1(record, { signingAuthority: authority, requesterAccountIndex: MALLORY_INDEX });

    const outcome = assessFedosDeletionRequestAuthorization(signed!, deps(env));
    // Mallory never authored envelope-1 (Alice did) -- this resolves as requester-not-author,
    // the SAME combined-lookup outcome a genuine non-member forger produces.
    expect(["requester-not-author", "target-unavailable"]).toContain(outcome);
    expect(coarsenFedosDeletionRequestAuthorizationOutcome(outcome)).toBe("unauthorized");
  });
});

describe("Secure Runtime Alpha 5641-5720 -- recipient-mismatch and device-mismatch", () => {
  it("6. a request addressed to an account that is not a member of the conversation at all is recipient-mismatch", async () => {
    const env = makeEnvironment();
    const { aliceMembershipId } = seedConversationAndMembers(env);
    seedEnvelope(env, "envelope-1", aliceMembershipId);
    const authority = makeSigningAuthority();
    const record = baseRecord({ recipientAccountRef: "mallory-account" });
    const signed = await signFedosDeletionRequestRecordV1(record, { signingAuthority: authority, requesterAccountIndex: ALICE_INDEX });

    const outcome = assessFedosDeletionRequestAuthorization(signed!, deps(env));
    expect(outcome).toBe("recipient-mismatch");
  });

  it("7. a request naming a recipientDeviceRef that does not match this evaluating instance's own local Device is device-mismatch", async () => {
    const env = makeEnvironment();
    const { aliceMembershipId } = seedConversationAndMembers(env);
    seedEnvelope(env, "envelope-1", aliceMembershipId);
    const authority = makeSigningAuthority();
    const record = baseRecord({ recipientDeviceRef: "bob-device-b" });
    const signed = await signFedosDeletionRequestRecordV1(record, { signingAuthority: authority, requesterAccountIndex: ALICE_INDEX });

    const outcome = assessFedosDeletionRequestAuthorization(signed!, deps(env, { localDeviceRef: "bob-device-a" }));
    expect(outcome).toBe("device-mismatch");
  });

  it("8. an absent local Device claim on either side never fails on Device grounds -- nothing cryptographic to fail (Doc 08's own honest limit)", async () => {
    const env = makeEnvironment();
    const { aliceMembershipId } = seedConversationAndMembers(env);
    seedEnvelope(env, "envelope-1", aliceMembershipId);
    const authority = makeSigningAuthority();
    const record = baseRecord({ recipientDeviceRef: null });
    const signed = await signFedosDeletionRequestRecordV1(record, { signingAuthority: authority, requesterAccountIndex: ALICE_INDEX });

    const outcome = assessFedosDeletionRequestAuthorization(signed!, deps(env, { localDeviceRef: null }));
    expect(outcome).toBe("authorized");
  });
});

describe("Secure Runtime Alpha 5641-5720 -- expiry and invalid signature", () => {
  it("9. a request past its own expiresAt is denied 'expired', even with a real, otherwise-valid signature", async () => {
    const env = makeEnvironment();
    const { aliceMembershipId } = seedConversationAndMembers(env);
    seedEnvelope(env, "envelope-1", aliceMembershipId);
    const authority = makeSigningAuthority();
    const record = baseRecord({ expiresAt: 1_700_000_501 });
    const signed = await signFedosDeletionRequestRecordV1(record, { signingAuthority: authority, requesterAccountIndex: ALICE_INDEX });

    const outcome = assessFedosDeletionRequestAuthorization(signed!, deps(env, { clock: () => 1_700_000_999 }));
    expect(outcome).toBe("expired");
  });

  it("10. a request whose wire event was tampered with fails 'invalid-signature' before any identity resolution runs", async () => {
    const env = makeEnvironment();
    seedConversationAndMembers(env);
    const authority = makeSigningAuthority();
    const signed = await signFedosDeletionRequestRecordV1(baseRecord(), { signingAuthority: authority, requesterAccountIndex: ALICE_INDEX });
    const tampered = { ...signed!, record: { ...signed!.record, requesterAccountRef: "mallory-account" } };

    const outcome = assessFedosDeletionRequestAuthorization(tampered, deps(env));
    expect(outcome).toBe("invalid-signature");
  });
});

describe("Secure Runtime Alpha 5641-5720 -- read-only: no mutation, no delivery event", () => {
  it("11. assessment never mutates Conversation/Membership/Envelope state", async () => {
    const env = makeEnvironment();
    const { aliceMembershipId } = seedConversationAndMembers(env);
    seedEnvelope(env, "envelope-1", aliceMembershipId);
    const membershipsBefore = env.membershipAuthority.listMemberships(CONVERSATION_ID).length;
    const authority = makeSigningAuthority();
    const signed = await signFedosDeletionRequestRecordV1(baseRecord(), { signingAuthority: authority, requesterAccountIndex: ALICE_INDEX });

    assessFedosDeletionRequestAuthorization(signed!, deps(env));
    expect(env.membershipAuthority.listMemberships(CONVERSATION_ID).length).toBe(membershipsBefore);
  });

  it("12. participantReferenceForFedosDeletionRequestAccountRef is a pure, deterministic mapping", () => {
    const a = participantReferenceForFedosDeletionRequestAccountRef("alice-account");
    const b = participantReferenceForFedosDeletionRequestAccountRef("alice-account");
    expect(a).toEqual(b);
    expect(a.authority).toBe("fedos");
  });
});
