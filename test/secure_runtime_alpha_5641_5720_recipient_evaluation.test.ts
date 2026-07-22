import { describe, it, expect } from "vitest";
import { InMemoryFedosConversationPersistence } from "../src/conversation/persistence/in_memory_fedos_conversation_persistence.js";
import { InMemoryFedosConversationMembershipAuthority } from "../src/conversation/membership/in_memory_fedos_conversation_membership_authority.js";
import { InMemoryFedosConversationMessageEnvelopePersistence } from "../src/conversation/envelope/persistence/in_memory_fedos_conversation_message_envelope_persistence.js";
import { toFedosConversationId } from "../src/conversation/fedos_conversation_id.js";
import { toFedosBoardId, toFedosThreadId } from "../src/board/fedos_board_identifiers.js";
import { toFedosConversationEnvelopeId } from "../src/conversation/envelope/fedos_conversation_envelope_id.js";
import type { FedosConversationParticipantReference } from "../src/conversation/membership/fedos_conversation_participant_reference.js";
import {
  FedosNobleTestNostrSigningAuthority,
  fedosTestSecretKeyFromSeed,
  signFedosDeletionRequestRecordV1,
} from "../src/conversation/deletion_request/fedos_deletion_request_signing.js";
import type { FedosDeletionRequestRecordV1 } from "../src/conversation/deletion_request/fedos_deletion_request_record.js";
import { InMemoryFedosDeletionRecipientDecisionPersistence } from "../src/conversation/deletion_request/in_memory_fedos_deletion_recipient_decision_persistence.js";
import {
  evaluateFedosDeletionRequestForRecipient,
  markFedosDeletionRecipientLocalPlanReady,
  recordSuppliedFedosDeletionRecipientLocalOutcome,
} from "../src/conversation/deletion_request/fedos_deletion_request_recipient_evaluation.js";

/**
 * Secure Runtime Alpha 5641-5720 -- the real, in-process recipient
 * evaluation pipeline. NEVER receives anything over a network -- every
 * "signed request" here is handed directly in-process, exactly as a
 * future transport Arc's own inbound handler would after it decrypts
 * one. NEVER calls b3b3a6d's execution coordinator.
 */

const ALICE_INDEX = 0;
const ALICE: FedosConversationParticipantReference = { authority: "fedos", publicIdentifier: "alice-account", identityId: null };
const BOB: FedosConversationParticipantReference = { authority: "fedos", publicIdentifier: "bob-account", identityId: null };
const CONVERSATION_ID = toFedosConversationId(toFedosBoardId("board-a")!, toFedosThreadId("thread-1")!);

function makeEnvironment() {
  const conversationPersistence = new InMemoryFedosConversationPersistence();
  const membershipAuthority = new InMemoryFedosConversationMembershipAuthority();
  const envelopePersistence = new InMemoryFedosConversationMessageEnvelopePersistence();
  const recipientDecisionPersistence = new InMemoryFedosDeletionRecipientDecisionPersistence();

  conversationPersistence.putConversation({
    schemaVersion: 1,
    id: CONVERSATION_ID,
    mode: "public",
    boardId: "board-a",
    rootThreadId: "thread-1",
    rootPostId: "thread-1",
    policyReference: "public-v1",
    createdAt: 1_700_000_000,
  });
  const aliceAdmission = membershipAuthority.admit(CONVERSATION_ID, ALICE, "owner", 1_700_000_000);
  membershipAuthority.admit(CONVERSATION_ID, BOB, "member", 1_700_000_000);
  if (aliceAdmission.outcome !== "admitted") throw new Error("test setup failed");

  const envelopeId = toFedosConversationEnvelopeId("envelope-1")!;
  envelopePersistence.putEnvelope({
    schemaVersion: 1,
    id: envelopeId,
    conversationId: CONVERSATION_ID,
    senderMembershipId: aliceAdmission.membership.id,
    payloadId: "payload-1" as never,
    encryptionSuite: "ChaCha20Poly1305",
    keyEpoch: 0,
    createdAt: 1_700_000_100,
    replyToEnvelopeId: null,
  });

  return { conversationPersistence, membershipAuthority, envelopePersistence, recipientDecisionPersistence };
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

function makeDeps(env: ReturnType<typeof makeEnvironment>, now = 1_700_000_600) {
  return {
    authorization: {
      conversationPersistence: env.conversationPersistence,
      envelopePersistence: env.envelopePersistence,
      membershipAuthority: env.membershipAuthority,
      clock: () => now,
      localDeviceRef: "bob-device-a",
    },
    persistence: env.recipientDecisionPersistence,
    clock: () => now,
  };
}

describe("Secure Runtime Alpha 5641-5720 -- recipient evaluation pipeline: authorized path", () => {
  it("1. an authorized request records received -> validated -> policy-pending, in order, never executing anything", async () => {
    const env = makeEnvironment();
    const authority = new FedosNobleTestNostrSigningAuthority([{ accountIndex: ALICE_INDEX, secretKey: fedosTestSecretKeyFromSeed("alice") }]);
    const signed = await signFedosDeletionRequestRecordV1(baseRecord(), { signingAuthority: authority, requesterAccountIndex: ALICE_INDEX });

    const result = evaluateFedosDeletionRequestForRecipient(signed!, makeDeps(env));
    expect(result.outcome).toBe("recorded");
    if (result.outcome !== "recorded") throw new Error("unreachable");
    expect(result.decisionState).toBe("policy-pending");
    expect(env.recipientDecisionPersistence.listAllSnapshots().map((s) => s.decisionState)).toEqual(["received", "validated", "policy-pending"]);
  });

  it("2. re-evaluating the SAME signed request is idempotent -- duplicate, never a re-run", async () => {
    const env = makeEnvironment();
    const authority = new FedosNobleTestNostrSigningAuthority([{ accountIndex: ALICE_INDEX, secretKey: fedosTestSecretKeyFromSeed("alice") }]);
    const signed = await signFedosDeletionRequestRecordV1(baseRecord(), { signingAuthority: authority, requesterAccountIndex: ALICE_INDEX });
    const deps = makeDeps(env);

    evaluateFedosDeletionRequestForRecipient(signed!, deps);
    const snapshotCountAfterFirst = env.recipientDecisionPersistence.listAllSnapshots().length;
    const second = evaluateFedosDeletionRequestForRecipient(signed!, deps);
    expect(second.outcome).toBe("duplicate");
    expect(env.recipientDecisionPersistence.listAllSnapshots()).toHaveLength(snapshotCountAfterFirst);
  });
});

describe("Secure Runtime Alpha 5641-5720 -- recipient evaluation pipeline: denied paths", () => {
  it("3. an unauthorized (non-author) request records received -> validated -> unauthorized", async () => {
    const env = makeEnvironment();
    const bobIndex = 1;
    const authority = new FedosNobleTestNostrSigningAuthority([
      { accountIndex: ALICE_INDEX, secretKey: fedosTestSecretKeyFromSeed("alice") },
      { accountIndex: bobIndex, secretKey: fedosTestSecretKeyFromSeed("bob") },
    ]);
    const record = baseRecord({ requestId: "b".repeat(64), requesterAccountRef: "bob-account", recipientAccountRef: "alice-account" });
    const signed = await signFedosDeletionRequestRecordV1(record, { signingAuthority: authority, requesterAccountIndex: bobIndex });

    const result = evaluateFedosDeletionRequestForRecipient(signed!, makeDeps(env));
    expect(result.outcome).toBe("recorded");
    if (result.outcome !== "recorded") throw new Error("unreachable");
    expect(result.decisionState).toBe("unauthorized");
  });

  it("4. an expired request records received -> validated -> expired", async () => {
    const env = makeEnvironment();
    const authority = new FedosNobleTestNostrSigningAuthority([{ accountIndex: ALICE_INDEX, secretKey: fedosTestSecretKeyFromSeed("alice") }]);
    const record = baseRecord({ requestId: "c".repeat(64), expiresAt: 1_700_000_501 });
    const signed = await signFedosDeletionRequestRecordV1(record, { signingAuthority: authority, requesterAccountIndex: ALICE_INDEX });

    const result = evaluateFedosDeletionRequestForRecipient(signed!, makeDeps(env, 1_700_000_999));
    expect(result.outcome).toBe("recorded");
    if (result.outcome !== "recorded") throw new Error("unreachable");
    expect(result.decisionState).toBe("expired");
  });

  it("5. a request tampered after signing is STRUCTURALLY well-formed (same shape, different content) -- it passes the cheap structural check, records 'validated', and only THEN fails the real cryptographic signature check, recording 'unauthorized'", async () => {
    const env = makeEnvironment();
    const authority = new FedosNobleTestNostrSigningAuthority([{ accountIndex: ALICE_INDEX, secretKey: fedosTestSecretKeyFromSeed("alice") }]);
    const record = baseRecord({ requestId: "d".repeat(64) });
    const signed = await signFedosDeletionRequestRecordV1(record, { signingAuthority: authority, requesterAccountIndex: ALICE_INDEX });
    // Tampering the record after signing breaks the SIGNATURE binding (Doc 08's own
    // content-match check), not the SCHEMA shape -- the pipeline's own structural check
    // (cheap, local, no crypto) correctly passes it through to "validated" before the
    // real signature verification (inside authorization assessment) catches it.
    const tampered = { ...signed!, record: { ...signed!.record, requesterAccountRef: "mallory-account" } };

    const result = evaluateFedosDeletionRequestForRecipient(tampered, makeDeps(env));
    expect(result.outcome).toBe("recorded");
    if (result.outcome !== "recorded") throw new Error("unreachable");
    expect(result.decisionState).toBe("unauthorized");
    expect(env.recipientDecisionPersistence.listAllSnapshots().map((s) => s.decisionState)).toEqual(["received", "validated", "unauthorized"]);
  });

  it("5b. a request malformed at the SCHEMA level (unknown field) records received -> unauthorized directly, never reaching 'validated'", async () => {
    const env = makeEnvironment();
    const authority = new FedosNobleTestNostrSigningAuthority([{ accountIndex: ALICE_INDEX, secretKey: fedosTestSecretKeyFromSeed("alice") }]);
    const record = baseRecord({ requestId: "d1".padEnd(64, "0") });
    const signed = await signFedosDeletionRequestRecordV1(record, { signingAuthority: authority, requesterAccountIndex: ALICE_INDEX });
    const malformed = { ...signed!, record: { ...signed!.record, extraField: "not allowed" } as never };

    const result = evaluateFedosDeletionRequestForRecipient(malformed, makeDeps(env));
    expect(result.outcome).toBe("recorded");
    if (result.outcome !== "recorded") throw new Error("unreachable");
    // A schema-shape failure fails signature verification first too (verifyFedosSignedDeletionRequestV1
    // itself re-validates shape before comparing content) -- so this ALSO resolves via the
    // signature-boundary path, landing on "unauthorized" after "validated" is attempted... but
    // structural validation runs FIRST in this pipeline and rejects the extra field immediately.
    expect(env.recipientDecisionPersistence.listAllSnapshots().map((s) => s.decisionState)).toEqual(["received", "unauthorized"]);
  });
});

describe("Secure Runtime Alpha 5641-5720 -- test-only supplied local outcome recording never executes anything itself", () => {
  it("6. markFedosDeletionRecipientLocalPlanReady + recordSuppliedFedosDeletionRecipientLocalOutcome record the CALLER's own already-produced fact, never invoking b3b3a6d themselves", async () => {
    const env = makeEnvironment();
    const authority = new FedosNobleTestNostrSigningAuthority([{ accountIndex: ALICE_INDEX, secretKey: fedosTestSecretKeyFromSeed("alice") }]);
    const record = baseRecord({ requestId: "e".repeat(64) });
    const signed = await signFedosDeletionRequestRecordV1(record, { signingAuthority: authority, requesterAccountIndex: ALICE_INDEX });
    const deps = makeDeps(env);

    evaluateFedosDeletionRequestForRecipient(signed!, deps); // -> policy-pending
    const planReady = markFedosDeletionRecipientLocalPlanReady("e".repeat(64), env.recipientDecisionPersistence, () => 1_700_000_700);
    expect(planReady.outcome).toBe("recorded");

    // The TEST itself supplies an already-produced outcome -- this function does not compute one.
    const applied = recordSuppliedFedosDeletionRecipientLocalOutcome("e".repeat(64), "completed", env.recipientDecisionPersistence, () => 1_700_000_800);
    expect(applied.outcome).toBe("recorded");
    if (applied.outcome !== "recorded") throw new Error("unreachable");
    expect(applied.decisionState).toBe("locally-applied");
    expect(applied.record.suppliedLocalOutcome).toBe("completed");
  });

  it("7. a 'partially-deleted' supplied outcome records 'partially-applied', never a false 'locally-applied'", () => {
    const env = makeEnvironment();
    env.recipientDecisionPersistence.putRecord({ schemaVersion: 1, requestId: "f".repeat(64), decisionState: "received", suppliedLocalOutcome: null, recordedAt: 1 });
    env.recipientDecisionPersistence.putRecord({ schemaVersion: 1, requestId: "f".repeat(64), decisionState: "validated", suppliedLocalOutcome: null, recordedAt: 2 });
    env.recipientDecisionPersistence.putRecord({ schemaVersion: 1, requestId: "f".repeat(64), decisionState: "policy-pending", suppliedLocalOutcome: null, recordedAt: 3 });
    markFedosDeletionRecipientLocalPlanReady("f".repeat(64), env.recipientDecisionPersistence, () => 4);
    const result = recordSuppliedFedosDeletionRecipientLocalOutcome("f".repeat(64), "partially-deleted", env.recipientDecisionPersistence, () => 5);
    expect(result.outcome).toBe("recorded");
    if (result.outcome !== "recorded") throw new Error("unreachable");
    expect(result.decisionState).toBe("partially-applied");
  });
});
