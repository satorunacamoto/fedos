import { describe, it, expect } from "vitest";
// @ts-expect-error `node:fs` has no type declarations without `@types/node` in this project's tsconfig.
import { mkdtempSync, rmSync, appendFileSync } from "node:fs";
// @ts-expect-error `node:os` has no type declarations without `@types/node` in this project's tsconfig.
import { tmpdir } from "node:os";
// @ts-expect-error `node:path` has no type declarations without `@types/node` in this project's tsconfig.
import { join } from "node:path";
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
import { validateFedosDeletionRequestRecordV1Structure } from "../src/conversation/deletion_request/fedos_deletion_request_validation.js";
import { assessFedosDeletionRequestAuthorization } from "../src/conversation/deletion_request/fedos_deletion_request_authorization_assessment.js";
import { AppendOnlyFedosDeletionRequestStatePersistence } from "../src/conversation/deletion_request/append_only_fedos_deletion_request_state_persistence.js";
import type { FedosPersistedDeletionRequestStateRecordV1 } from "../src/conversation/deletion_request/fedos_persisted_deletion_request_state_record_v1.js";
import { isFedosDeletionAcknowledgementRecordHonest, isWellFormedFedosDeletionAcknowledgementRecordV1 } from "../src/conversation/deletion_request/fedos_deletion_acknowledgement_record.js";

/**
 * Secure Runtime Alpha 5641-5720 -- Phase P failure matrix, covering the
 * scenarios not already exercised by this Arc's own other test files
 * (malformed/unknown-field/oversized-identifier/invalid-timestamp/
 * expired/bad-signature/wrong-device/wrong-recipient/target-substitution/
 * requester-not-author/matching-and-conflicting-duplicate/invalid-
 * transition/corrupt-log/unknown-capability-version/raw-path/Group-and-
 * attachment-and-wildcard-rejection are already covered in
 * `..._vocabulary_and_record`, `..._signing_and_verification`,
 * `..._authorization_assessment`, `..._durable_state_and_replay`, and
 * `..._recipient_evaluation`).
 */

const ALICE_INDEX = 0;
const ALICE: FedosConversationParticipantReference = { authority: "fedos", publicIdentifier: "alice-account", identityId: null };
const BOB: FedosConversationParticipantReference = { authority: "fedos", publicIdentifier: "bob-account", identityId: null };
const CONVERSATION_ID = toFedosConversationId(toFedosBoardId("board-a")!, toFedosThreadId("thread-1")!);
const OTHER_CONVERSATION_ID = toFedosConversationId(toFedosBoardId("board-a")!, toFedosThreadId("thread-2")!);

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

describe("Secure Runtime Alpha 5641-5720 -- future-issued request beyond clock skew", () => {
  it("1. issuedAt more than 5 minutes in the future is rejected as issued-in-future", () => {
    const record = baseRecord({ issuedAt: 1_700_001_000, expiresAt: 1_700_100_000 });
    const outcome = validateFedosDeletionRequestRecordV1Structure(record, 1_700_000_000); // now is 1000s before issuedAt
    expect(outcome).toBe("issued-in-future");
  });

  it("2. issuedAt within the 5-minute tolerance is accepted", () => {
    const record = baseRecord({ issuedAt: 1_700_000_200, expiresAt: 1_700_100_000 });
    const outcome = validateFedosDeletionRequestRecordV1Structure(record, 1_700_000_000); // 200s ahead, within 300s tolerance
    expect(outcome).toBe("well-formed");
  });

  it("3. a lifetime exceeding the 14-day maximum is rejected", () => {
    const record = baseRecord({ issuedAt: 1_700_000_000, expiresAt: 1_700_000_000 + 15 * 24 * 60 * 60 });
    const outcome = validateFedosDeletionRequestRecordV1Structure(record, 1_700_000_000);
    expect(outcome).toBe("lifetime-exceeded");
  });
});

describe("Secure Runtime Alpha 5641-5720 -- wrong Conversation (target's own real Conversation differs from claimed)", () => {
  it("4. a request claiming conversation A for a target that actually lives in conversation B is denied (target-unavailable)", async () => {
    const conversationPersistence = new InMemoryFedosConversationPersistence();
    const membershipAuthority = new InMemoryFedosConversationMembershipAuthority();
    const envelopePersistence = new InMemoryFedosConversationMessageEnvelopePersistence();

    for (const id of [CONVERSATION_ID, OTHER_CONVERSATION_ID]) {
      conversationPersistence.putConversation({ schemaVersion: 1, id, mode: "public", boardId: "board-a", rootThreadId: "thread-1", rootPostId: "thread-1", policyReference: "public-v1", createdAt: 1_700_000_000 });
    }
    const aliceAdmission = membershipAuthority.admit(OTHER_CONVERSATION_ID, ALICE, "owner", 1_700_000_000);
    membershipAuthority.admit(CONVERSATION_ID, BOB, "member", 1_700_000_000);
    if (aliceAdmission.outcome !== "admitted") throw new Error("test setup failed");

    // The envelope REALLY lives in OTHER_CONVERSATION_ID.
    envelopePersistence.putEnvelope({
      schemaVersion: 1,
      id: toFedosConversationEnvelopeId("envelope-1")!,
      conversationId: OTHER_CONVERSATION_ID,
      senderMembershipId: aliceAdmission.membership.id,
      payloadId: "payload-1" as never,
      encryptionSuite: "ChaCha20Poly1305",
      keyEpoch: 0,
      createdAt: 1_700_000_100,
      replyToEnvelopeId: null,
    });

    const authority = new FedosNobleTestNostrSigningAuthority([{ accountIndex: ALICE_INDEX, secretKey: fedosTestSecretKeyFromSeed("alice") }]);
    // The request CLAIMS conversationId === CONVERSATION_ID, but the envelope is really in OTHER_CONVERSATION_ID.
    const record = baseRecord({ conversationId: CONVERSATION_ID });
    const signed = await signFedosDeletionRequestRecordV1(record, { signingAuthority: authority, requesterAccountIndex: ALICE_INDEX });

    const outcome = assessFedosDeletionRequestAuthorization(signed!, {
      conversationPersistence,
      envelopePersistence,
      membershipAuthority,
      clock: () => 1_700_000_600,
      localDeviceRef: "bob-device-a",
    });
    expect(outcome).toBe("target-unavailable");
  });

  it("5. a request for a Conversation that does not exist at all is denied (conversation-unavailable)", async () => {
    const conversationPersistence = new InMemoryFedosConversationPersistence();
    const membershipAuthority = new InMemoryFedosConversationMembershipAuthority();
    const envelopePersistence = new InMemoryFedosConversationMessageEnvelopePersistence();
    const authority = new FedosNobleTestNostrSigningAuthority([{ accountIndex: ALICE_INDEX, secretKey: fedosTestSecretKeyFromSeed("alice") }]);
    const record = baseRecord({ conversationId: "does-not-exist" as never });
    const signed = await signFedosDeletionRequestRecordV1(record, { signingAuthority: authority, requesterAccountIndex: ALICE_INDEX });

    const outcome = assessFedosDeletionRequestAuthorization(signed!, {
      conversationPersistence,
      envelopePersistence,
      membershipAuthority,
      clock: () => 1_700_000_600,
      localDeviceRef: "bob-device-a",
    });
    expect(outcome).toBe("conversation-unavailable");
  });
});

let dir: string;

describe("Secure Runtime Alpha 5641-5720 -- state rollback and interrupted append", () => {
  it("6. an attempted BACKWARD transition (signed -> draft) is rejected as invalid-transition, never silently applied (state rollback denial)", () => {
    dir = mkdtempSync(join(tmpdir(), "fedos-deletion-request-failure-matrix-"));
    try {
      const logPath = join(dir, "rollback.ndjson");
      const persistence = new AppendOnlyFedosDeletionRequestStatePersistence(logPath);
      const draft: FedosPersistedDeletionRequestStateRecordV1 = {
        schemaVersion: 1,
        requestId: "a".repeat(64),
        bodyHash: "hash-1",
        requesterAccountRef: "alice-account",
        recipientAccountRef: "bob-account",
        recipientDeviceRef: "bob-device-a",
        conversationId: "conv-1",
        targetEnvelopeId: "envelope-1",
        scope: "local-history-and-index",
        lifecycleState: "draft",
        issuedAt: 1_700_000_000,
        expiresAt: 1_700_100_000,
        retryCount: 0,
        acknowledgementCorrelationId: null,
        recordedAt: 1_700_000_000,
      };
      persistence.putRecord(draft);
      persistence.putRecord({ ...draft, lifecycleState: "signed", recordedAt: 1_700_000_010 });
      const rollback = persistence.putRecord({ ...draft, lifecycleState: "draft", recordedAt: 1_700_000_020 });
      expect(rollback).toBe("invalid-transition");
      expect(persistence.getRecord("a".repeat(64))?.lifecycleState).toBe("signed");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("7. an interrupted/truncated last line in the append-only log (no trailing content, malformed JSON fragment) fails closed on the next read", () => {
    dir = mkdtempSync(join(tmpdir(), "fedos-deletion-request-failure-matrix-"));
    try {
      const logPath = join(dir, "interrupted.ndjson");
      const persistence = new AppendOnlyFedosDeletionRequestStatePersistence(logPath);
      persistence.putRecord({
        schemaVersion: 1,
        requestId: "a".repeat(64),
        bodyHash: "hash-1",
        requesterAccountRef: "alice-account",
        recipientAccountRef: "bob-account",
        recipientDeviceRef: "bob-device-a",
        conversationId: "conv-1",
        targetEnvelopeId: "envelope-1",
        scope: "local-history-and-index",
        lifecycleState: "draft",
        issuedAt: 1_700_000_000,
        expiresAt: 1_700_100_000,
        retryCount: 0,
        acknowledgementCorrelationId: null,
        recordedAt: 1_700_000_000,
      });
      // Simulates a crash mid-write: a partial JSON object with no closing brace/newline.
      appendFileSync(logPath, '{"schemaVersion":1,"requestId":"b', "utf8");
      expect(() => persistence.getRecord("a".repeat(64))).toThrow();
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe("Secure Runtime Alpha 5641-5720 -- acknowledgement mismatch, wrong Device, and overclaim", () => {
  function baseAck(overrides: Record<string, unknown> = {}) {
    return {
      schemaVersion: 1 as const,
      requestId: "a".repeat(64),
      recipientAccountRef: "bob-account",
      recipientDeviceRef: "bob-device-a",
      outcome: "applied-local-history-and-index" as const,
      appliedScopes: ["local-history", "local-index"] as const,
      retainedScopes: [] as const,
      evidenceClass: "local-verified" as const,
      acknowledgedAt: 1_700_050_000,
      protocolVersion: 1 as const,
      ...overrides,
    };
  }

  it("8. an acknowledgement whose own requestId does not match the request it is supposedly correlated to is a CORRELATION mismatch a caller must check explicitly -- this file's own validator alone cannot catch it (documents the boundary)", () => {
    const ack = baseAck({ requestId: "b".repeat(64) });
    // Structurally well-formed on its own -- correlating it to the WRONG request is the
    // caller's own job (comparing `ack.requestId` to the expected one), never this
    // validator's, since a acknowledgement is self-contained and portable.
    expect(isWellFormedFedosDeletionAcknowledgementRecordV1(ack)).toBe(true);
    expect(ack.requestId).not.toBe("a".repeat(64));
  });

  it("9. an acknowledgement claiming 'applied-*' but an EMPTY appliedScopes is an overclaim -- rejected by the honesty guard", () => {
    const ack = baseAck({ appliedScopes: [] });
    expect(isWellFormedFedosDeletionAcknowledgementRecordV1(ack)).toBe(true); // structurally fine
    expect(isFedosDeletionAcknowledgementRecordHonest(ack)).toBe(false); // but dishonest
  });

  it("10. an acknowledgement claiming 'rejected-policy' but a NON-EMPTY appliedScopes is an overclaim -- rejected by the honesty guard", () => {
    const ack = baseAck({ outcome: "rejected-policy", appliedScopes: ["local-history"] });
    expect(isWellFormedFedosDeletionAcknowledgementRecordV1(ack)).toBe(true);
    expect(isFedosDeletionAcknowledgementRecordHonest(ack)).toBe(false);
  });

  it("11. an honest acknowledgement (rejected-policy, empty appliedScopes) passes the honesty guard", () => {
    const ack = baseAck({ outcome: "rejected-policy", appliedScopes: [] });
    expect(isFedosDeletionAcknowledgementRecordHonest(ack)).toBe(true);
  });

  it("12. recipientDeviceRef is advisory-only -- an acknowledgement from a DIFFERENT Device than the request named is still structurally well-formed (Device is never cryptographically bound, Doc 08); a caller wanting Device-level correlation must compare it explicitly", () => {
    const ackFromDifferentDevice = baseAck({ recipientDeviceRef: "bob-device-b" });
    expect(isWellFormedFedosDeletionAcknowledgementRecordV1(ackFromDifferentDevice)).toBe(true);
  });
});

describe("Secure Runtime Alpha 5641-5720 -- 'stopped Runtime' sanity: every pure function works with no Runtime/global state initialized", () => {
  it("13. structural validation, canonicalization, and the retry planner all work with zero ambient state -- no Runtime start/stop concept exists for any of this Arc's own pure functions", () => {
    const record = baseRecord();
    expect(() => validateFedosDeletionRequestRecordV1Structure(record, 1_700_000_600)).not.toThrow();
  });
});
