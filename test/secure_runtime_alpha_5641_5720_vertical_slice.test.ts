import { describe, it, expect, beforeEach, afterEach } from "vitest";
// @ts-expect-error `node:fs` has no type declarations without `@types/node` in this project's tsconfig.
import { mkdtempSync, rmSync, readFileSync } from "node:fs";
// @ts-expect-error `node:os` has no type declarations without `@types/node` in this project's tsconfig.
import { tmpdir } from "node:os";
// @ts-expect-error `node:path` has no type declarations without `@types/node` in this project's tsconfig.
import { join } from "node:path";
import { bytesToHex } from "@noble/hashes/utils.js";

import { InMemoryFedosConversationPersistence } from "../src/conversation/persistence/in_memory_fedos_conversation_persistence.js";
import { InMemoryFedosConversationMembershipAuthority } from "../src/conversation/membership/in_memory_fedos_conversation_membership_authority.js";
import { InMemoryFedosConversationMessageEnvelopePersistence } from "../src/conversation/envelope/persistence/in_memory_fedos_conversation_message_envelope_persistence.js";
import { toFedosConversationId } from "../src/conversation/fedos_conversation_id.js";
import { toFedosBoardId, toFedosThreadId } from "../src/board/fedos_board_identifiers.js";
import { toFedosConversationEnvelopeId } from "../src/conversation/envelope/fedos_conversation_envelope_id.js";
import type { FedosConversationParticipantReference } from "../src/conversation/membership/fedos_conversation_participant_reference.js";
import { InMemoryFedosConversationPayloadStorage } from "../src/conversation/payload_storage/in_memory_fedos_conversation_payload_storage.js";
import { toFedosConversationPayloadId } from "../src/conversation/payload_storage/fedos_conversation_payload_id.js";
import { FedosPayloadRetentionAuthority } from "../src/conversation/retention/fedos_payload_retention_authority.js";
import { InMemoryFedosPayloadRetentionPersistence } from "../src/conversation/retention/in_memory_fedos_payload_retention_persistence.js";
import { assessFedosLocalPayloadDeletion } from "../src/conversation/deletion/fedos_deletion_assessment.js";
import { buildFedosLocalPayloadDeletionPlan } from "../src/conversation/deletion/fedos_deletion_plan.js";
import { executeFedosLocalPayloadDeletionPlan } from "../src/conversation/deletion/fedos_deletion_execution_coordinator.js";
import { InMemoryFedosDeletionExecutionPersistence } from "../src/conversation/deletion/in_memory_fedos_deletion_execution_persistence.js";

import {
  FedosNobleTestNostrSigningAuthority,
  fedosTestSecretKeyFromSeed,
  signFedosDeletionRequestRecordV1,
  verifyFedosSignedDeletionRequestV1,
} from "../src/conversation/deletion_request/fedos_deletion_request_signing.js";
import type { FedosDeletionRequestRecordV1 } from "../src/conversation/deletion_request/fedos_deletion_request_record.js";
import { canonicalizeFedosDeletionRequestRecordV1 } from "../src/conversation/deletion_request/fedos_deletion_request_canonical_bytes.js";
import { generateFedosDeletionRequestId } from "../src/conversation/deletion_request/fedos_deletion_request_id.js";
import {
  assessFedosDeletionRequestAuthorization,
  type FedosDeletionRequestAuthorizationAssessmentDependencies,
} from "../src/conversation/deletion_request/fedos_deletion_request_authorization_assessment.js";
import { AppendOnlyFedosDeletionRequestStatePersistence } from "../src/conversation/deletion_request/append_only_fedos_deletion_request_state_persistence.js";
import { fedosDeletionRequestBodyHash, type FedosPersistedDeletionRequestStateRecordV1 } from "../src/conversation/deletion_request/fedos_persisted_deletion_request_state_record_v1.js";
import { AppendOnlyFedosDeletionRecipientDecisionPersistence } from "../src/conversation/deletion_request/append_only_fedos_deletion_recipient_decision_persistence.js";
import {
  evaluateFedosDeletionRequestForRecipient,
  markFedosDeletionRecipientLocalPlanReady,
  recordSuppliedFedosDeletionRecipientLocalOutcome,
} from "../src/conversation/deletion_request/fedos_deletion_request_recipient_evaluation.js";
import { signFedosDeletionAcknowledgementRecordV1, verifyFedosSignedDeletionAcknowledgementV1 } from "../src/conversation/deletion_request/fedos_deletion_acknowledgement_signing.js";
import type { FedosDeletionAcknowledgementRecordV1 } from "../src/conversation/deletion_request/fedos_deletion_acknowledgement_record.js";
import { AppendOnlyFedosDeletionAcknowledgementPersistence } from "../src/conversation/deletion_request/append_only_fedos_deletion_acknowledgement_persistence.js";
import type { FedosPersistedDeletionAcknowledgementRecordV1 } from "../src/conversation/deletion_request/fedos_persisted_deletion_acknowledgement_record_v1.js";

/**
 * Secure Runtime Alpha 5641-5720 -- Phase O real vertical slice. Every
 * dependency is REAL: real Conversation/Membership/Envelope/Payload
 * construction, the real `b3b3a6d` Retention Authority and execution
 * coordinator, real BIP-340 Schnorr signing/verification (via
 * `FedosNobleTestNostrSigningAuthority`, isolated from the absent WASM
 * artifact but genuinely cryptographic), and the REAL append-only
 * on-disk NDJSON persistence for all three durable domains, with a real
 * process restart (a fresh persistence instance over the same file).
 *
 * NO network. NO Relay. NO live delivery. NO automatic local deletion --
 * item 14's own outcome is produced by THIS TEST calling `b3b3a6d`'s
 * real execution coordinator directly (the test plays the role of "a
 * future transport Arc's own recipient handler"), never by any of this
 * Arc's own `deletion_request/` code.
 */

const ALICE_INDEX = 0;
const BOB_INDEX = 1;
const ALICE: FedosConversationParticipantReference = { authority: "fedos", publicIdentifier: "alice-account", identityId: null };
const BOB: FedosConversationParticipantReference = { authority: "fedos", publicIdentifier: "bob-account", identityId: null };
const CONVERSATION_ID = toFedosConversationId(toFedosBoardId("board-vertical")!, toFedosThreadId("thread-1")!);
const SECRET_PLAINTEXT_MARKER = "the-real-message-plaintext-must-never-appear-in-any-durable-file";

let dir: string;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "fedos-deletion-request-vertical-slice-"));
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

describe("Secure Runtime Alpha 5641-5720 -- Phase O real vertical slice", () => {
  it("runs the full signed deletion request flow: real Conversation, real signing, real restart, real b3b3a6d outcome, real acknowledgement, no network", async () => {
    // 1-2. Create/open a real Direct Conversation; a real message authored by Alice.
    const conversationPersistence = new InMemoryFedosConversationPersistence();
    const membershipAuthority = new InMemoryFedosConversationMembershipAuthority();
    const envelopePersistence = new InMemoryFedosConversationMessageEnvelopePersistence();
    const payloadStorage = new InMemoryFedosConversationPayloadStorage();

    conversationPersistence.putConversation({
      schemaVersion: 1,
      id: CONVERSATION_ID,
      mode: "public",
      boardId: "board-vertical",
      rootThreadId: "thread-1",
      rootPostId: "thread-1",
      policyReference: "public-v1",
      createdAt: 1_700_000_000,
    });
    const aliceAdmission = membershipAuthority.admit(CONVERSATION_ID, ALICE, "owner", 1_700_000_000);
    const bobAdmission = membershipAuthority.admit(CONVERSATION_ID, BOB, "member", 1_700_000_000);
    if (aliceAdmission.outcome !== "admitted" || bobAdmission.outcome !== "admitted") throw new Error("vertical slice setup failed");

    const payloadId = toFedosConversationPayloadId("payload-vertical-1")!;
    payloadStorage.putPayload(
      { id: payloadId, conversationId: CONVERSATION_ID, mediaType: "application/octet-stream", byteLength: SECRET_PLAINTEXT_MARKER.length, createdAt: 1_700_000_000 },
      new TextEncoder().encode(SECRET_PLAINTEXT_MARKER),
    );
    const envelopeId = toFedosConversationEnvelopeId("envelope-vertical-1")!;
    envelopePersistence.putEnvelope({
      schemaVersion: 1,
      id: envelopeId,
      conversationId: CONVERSATION_ID,
      senderMembershipId: aliceAdmission.membership.id,
      payloadId,
      encryptionSuite: "ChaCha20Poly1305",
      keyEpoch: 0,
      createdAt: 1_700_000_100,
      replyToEnvelopeId: null,
    });

    const retentionAuthority = new FedosPayloadRetentionAuthority({ retentionPersistence: new InMemoryFedosPayloadRetentionPersistence(), payloadStorage, clock: () => 1_700_000_200 });

    // 3-4. Build and canonicalize one deletion request, targeting that message, for Bob Device A.
    const requestId = generateFedosDeletionRequestId();
    const record: FedosDeletionRequestRecordV1 = {
      schemaVersion: 1,
      requestId,
      requesterAccountRef: "alice-account",
      requesterDeviceRef: null,
      recipientAccountRef: "bob-account",
      recipientDeviceRef: "bob-device-a",
      conversationId: CONVERSATION_ID,
      targetEnvelopeId: envelopeId,
      scope: "local-history-and-index",
      issuedAt: 1_700_000_300,
      expiresAt: 1_700_100_000,
      nonce: "b".repeat(32),
      capabilityVersion: 1,
      reasonCode: "sent-in-error",
    };
    const canonical = canonicalizeFedosDeletionRequestRecordV1(record);
    expect(canonical).toContain(requestId);
    expect(canonical).not.toContain(SECRET_PLAINTEXT_MARKER);

    // 5. Sign with real Alice account authority (genuine BIP-340 Schnorr, no WASM needed).
    const signingAuthority = new FedosNobleTestNostrSigningAuthority([
      { accountIndex: ALICE_INDEX, secretKey: fedosTestSecretKeyFromSeed("alice") },
      { accountIndex: BOB_INDEX, secretKey: fedosTestSecretKeyFromSeed("bob") },
    ]);
    const signed = await signFedosDeletionRequestRecordV1(record, { signingAuthority, requesterAccountIndex: ALICE_INDEX });
    expect(signed).not.toBeNull();

    // 6. Persist the outbound request -- real append-only NDJSON file, draft -> signed.
    const requestStateLogPath = join(dir, "request-state.ndjson");
    const requestStateBefore = new AppendOnlyFedosDeletionRequestStatePersistence(requestStateLogPath);
    const bodyHash = fedosDeletionRequestBodyHash(record);
    const draftSnapshot: FedosPersistedDeletionRequestStateRecordV1 = {
      schemaVersion: 1,
      requestId,
      bodyHash,
      requesterAccountRef: record.requesterAccountRef,
      recipientAccountRef: record.recipientAccountRef,
      recipientDeviceRef: record.recipientDeviceRef,
      conversationId: record.conversationId,
      targetEnvelopeId: record.targetEnvelopeId,
      scope: record.scope,
      lifecycleState: "draft",
      issuedAt: record.issuedAt,
      expiresAt: record.expiresAt,
      retryCount: 0,
      acknowledgementCorrelationId: null,
      recordedAt: record.issuedAt,
    };
    expect(requestStateBefore.putRecord(draftSnapshot)).toBe("inserted");
    const signedSnapshot: FedosPersistedDeletionRequestStateRecordV1 = { ...draftSnapshot, lifecycleState: "signed", recordedAt: record.issuedAt + 1 };
    expect(requestStateBefore.putRecord(signedSnapshot)).toBe("inserted");

    // 7-8. Stop/restart: a fresh persistence instance over the SAME log file recovers
    // identical request state.
    const requestStateAfterRestart = new AppendOnlyFedosDeletionRequestStatePersistence(requestStateLogPath);
    const recovered = requestStateAfterRestart.getRecord(requestId);
    expect(recovered).toEqual(signedSnapshot);

    // 9. Validate signature -- real, independent verification.
    expect(verifyFedosSignedDeletionRequestV1(signed!)).toBe(true);

    // 10. Evaluate authorization -- authorized (Alice really did author envelope-vertical-1).
    const authDeps: FedosDeletionRequestAuthorizationAssessmentDependencies = {
      conversationPersistence,
      envelopePersistence,
      membershipAuthority,
      clock: () => 1_700_000_400,
      localDeviceRef: "bob-device-a",
    };
    expect(assessFedosDeletionRequestAuthorization(signed!, authDeps)).toBe("authorized");

    // 11. Prove Bob Device B mismatch: the SAME signed request, evaluated as if THIS
    // instance is bob-device-b (not bob-device-a the request named), is device-mismatch.
    expect(assessFedosDeletionRequestAuthorization(signed!, { ...authDeps, localDeviceRef: "bob-device-b" })).toBe("device-mismatch");

    // 12. Prove non-author request denial: Bob signing a request claiming to be the author
    // of Alice's own message is denied.
    const nonAuthorRecord: FedosDeletionRequestRecordV1 = { ...record, requestId: generateFedosDeletionRequestId(), requesterAccountRef: "bob-account", recipientAccountRef: "alice-account" };
    const nonAuthorSigned = await signFedosDeletionRequestRecordV1(nonAuthorRecord, { signingAuthority, requesterAccountIndex: BOB_INDEX });
    expect(assessFedosDeletionRequestAuthorization(nonAuthorSigned!, { ...authDeps, localDeviceRef: "alice-device" })).toBe("requester-not-author");

    // 13. Prove target substitution denial: Alice claims authorship of an envelope she did
    // not actually author (Bob's own).
    const bobEnvelopeId = toFedosConversationEnvelopeId("envelope-vertical-bob")!;
    envelopePersistence.putEnvelope({
      schemaVersion: 1,
      id: bobEnvelopeId,
      conversationId: CONVERSATION_ID,
      senderMembershipId: bobAdmission.membership.id,
      payloadId: toFedosConversationPayloadId("payload-vertical-bob")! as never,
      encryptionSuite: "ChaCha20Poly1305",
      keyEpoch: 0,
      createdAt: 1_700_000_150,
      replyToEnvelopeId: null,
    });
    const substitutionRecord: FedosDeletionRequestRecordV1 = { ...record, requestId: generateFedosDeletionRequestId(), targetEnvelopeId: bobEnvelopeId };
    const substitutionSigned = await signFedosDeletionRequestRecordV1(substitutionRecord, { signingAuthority, requesterAccountIndex: ALICE_INDEX });
    expect(assessFedosDeletionRequestAuthorization(substitutionSigned!, authDeps)).toBe("requester-not-author");

    // Recipient-side evaluation, in-process (no network): received -> validated -> policy-pending.
    const recipientDecisionLogPath = join(dir, "recipient-decision.ndjson");
    const recipientDecisionPersistence = new AppendOnlyFedosDeletionRecipientDecisionPersistence(recipientDecisionLogPath);
    const evaluationResult = evaluateFedosDeletionRequestForRecipient(signed!, { authorization: authDeps, persistence: recipientDecisionPersistence, clock: () => 1_700_000_400 });
    expect(evaluationResult.outcome).toBe("recorded");
    if (evaluationResult.outcome !== "recorded") throw new Error("unreachable");
    expect(evaluationResult.decisionState).toBe("policy-pending");

    // 14. Record a supplied local deletion outcome from the REAL b3b3a6d Local Deletion
    // Foundation -- this TEST calls it directly (playing the role of a future recipient
    // handler); no `deletion_request/` code calls it automatically.
    const assessment = assessFedosLocalPayloadDeletion(payloadId, { retentionAuthority });
    expect(assessment.blocker).toBe("none");
    const plan = buildFedosLocalPayloadDeletionPlan(`local-plan-for-${requestId}`, payloadId, assessment);
    const localExecutionPersistence = new InMemoryFedosDeletionExecutionPersistence();
    const executionOutcome = executeFedosLocalPayloadDeletionPlan(
      { plan, requestedBy: "bob-account", confirmed: true, authorityReference: "bob-account", reasonCode: "user_requested_placeholder" },
      { retentionAuthority, searchIndex: { reconcilePayloadRetention: () => 0 }, persistence: localExecutionPersistence },
    );
    expect(executionOutcome.outcome).toBe("executed");
    if (executionOutcome.outcome !== "executed") throw new Error("unreachable");
    expect(executionOutcome.record.status).toBe("completed");

    markFedosDeletionRecipientLocalPlanReady(requestId, recipientDecisionPersistence, () => 1_700_000_500);
    const suppliedOutcomeResult = recordSuppliedFedosDeletionRecipientLocalOutcome(requestId, "completed", recipientDecisionPersistence, () => 1_700_000_600);
    expect(suppliedOutcomeResult.outcome).toBe("recorded");
    if (suppliedOutcomeResult.outcome !== "recorded") throw new Error("unreachable");
    expect(suppliedOutcomeResult.decisionState).toBe("locally-applied");

    // 15. Construct the acknowledgement record and sign it (real Bob account authority).
    const ackRecord: FedosDeletionAcknowledgementRecordV1 = {
      schemaVersion: 1,
      requestId,
      recipientAccountRef: "bob-account",
      recipientDeviceRef: "bob-device-a",
      outcome: "applied-local-history-and-index",
      appliedScopes: ["local-history", "local-index"],
      retainedScopes: [],
      evidenceClass: "local-observed",
      acknowledgedAt: 1_700_000_700,
      protocolVersion: 1,
    };
    const signedAck = await signFedosDeletionAcknowledgementRecordV1(ackRecord, { signingAuthority, recipientAccountIndex: BOB_INDEX });
    expect(signedAck).not.toBeNull();
    expect(verifyFedosSignedDeletionAcknowledgementV1(signedAck!)).toBe(true);

    // 16. Persist the acknowledgement fact and restart.
    const ackLogPath = join(dir, "acknowledgement.ndjson");
    const ackPersistenceBefore = new AppendOnlyFedosDeletionAcknowledgementPersistence(ackLogPath);
    const ackFact: FedosPersistedDeletionAcknowledgementRecordV1 = { schemaVersion: 1, requestId, acknowledgement: ackRecord, wireEventId: signedAck!.wireEvent.id, recordedAt: 1_700_000_700 };
    expect(ackPersistenceBefore.putRecord(ackFact)).toBe("inserted");
    const ackPersistenceAfterRestart = new AppendOnlyFedosDeletionAcknowledgementPersistence(ackLogPath);
    expect(ackPersistenceAfterRestart.getRecord(requestId)).toEqual(ackFact);

    // 17. Correlate the acknowledgement back to the original request state.
    const correlatedSnapshot: FedosPersistedDeletionRequestStateRecordV1 = { ...signedSnapshot, lifecycleState: "acknowledged", acknowledgementCorrelationId: signedAck!.wireEvent.id, recordedAt: 1_700_000_700 };
    expect(requestStateAfterRestart.putRecord(correlatedSnapshot)).toBe("inserted");
    expect(requestStateAfterRestart.getRecord(requestId)?.acknowledgementCorrelationId).toBe(signedAck!.wireEvent.id);

    // 18. Prove duplicate idempotency (both domains).
    expect(ackPersistenceAfterRestart.putRecord(ackFact)).toBe("already-present");
    expect(evaluateFedosDeletionRequestForRecipient(signed!, { authorization: authDeps, persistence: recipientDecisionPersistence, clock: () => 1_700_000_999 }).outcome).toBe("duplicate");

    // 19. Prove conflicting duplicate rejection (both domains).
    const conflictingAck: FedosPersistedDeletionAcknowledgementRecordV1 = { ...ackFact, acknowledgement: { ...ackRecord, outcome: "failed", appliedScopes: [] } };
    expect(ackPersistenceAfterRestart.putRecord(conflictingAck)).toBe("conflict");
    const conflictingRequestState: FedosPersistedDeletionRequestStateRecordV1 = { ...draftSnapshot, bodyHash: "a-different-body-hash", lifecycleState: "signed", recordedAt: 1_700_000_800 };
    expect(requestStateAfterRestart.putRecord(conflictingRequestState)).toBe("conflict");

    // 20. Prove no message plaintext / private key / raw path exists in ANY durable file.
    const requestStateFileContents = readFileSync(requestStateLogPath, "utf8") as string;
    const recipientDecisionFileContents = readFileSync(recipientDecisionLogPath, "utf8") as string;
    const ackFileContents = readFileSync(ackLogPath, "utf8") as string;
    const allDurableText = requestStateFileContents + recipientDecisionFileContents + ackFileContents;

    expect(allDurableText).not.toContain(SECRET_PLAINTEXT_MARKER);
    const aliceSecretKeyHex = bytesToHex(fedosTestSecretKeyFromSeed("alice"));
    const bobSecretKeyHex = bytesToHex(fedosTestSecretKeyFromSeed("bob"));
    expect(allDurableText).not.toContain(aliceSecretKeyHex);
    expect(allDurableText).not.toContain(bobSecretKeyHex);
    expect(allDurableText).not.toMatch(/[A-Za-z]:\\/);
    expect(allDurableText).not.toMatch(/\/(Users|home|tmp)\//);
  });
});
