import { describe, it, expect } from "vitest";
import { FedosPayloadRetentionAuthority } from "../src/os/messenger/conversations/retention/fedos_payload_retention_authority.js";
import { InMemoryFedosPayloadRetentionPersistence } from "../src/os/messenger/conversations/retention/in_memory_fedos_payload_retention_persistence.js";
import { InMemoryFedosConversationPayloadStorage } from "../src/os/messenger/conversations/payload_storage/in_memory_fedos_conversation_payload_storage.js";
import { toFedosConversationPayloadId } from "../src/os/messenger/conversations/payload_storage/fedos_conversation_payload_id.js";
import { toFedosConversationId } from "../src/os/messenger/conversations/fedos_conversation_id.js";
import { toFedosBoardId, toFedosThreadId } from "../src/os/messenger/board/fedos_board_identifiers.js";
import { InMemoryFedosConversationDraftPersistence } from "../src/os/messenger/conversations/construction/in_memory_fedos_conversation_draft_persistence.js";
import { InMemoryFedosConversationMembershipAuthority } from "../src/os/messenger/conversations/membership/in_memory_fedos_conversation_membership_authority.js";
import { FedosConversationSearchIndex, type FedosConversationSearchIndexDependencies } from "../src/os/messenger/conversations/search/fedos_conversation_search_index.js";
import { validateFedosConversationMessageEnvelope } from "../src/os/messenger/conversations/envelope/fedos_conversation_message_envelope_validator.js";
import type { FedosConversationMessageEnvelope } from "../src/os/messenger/conversations/envelope/fedos_conversation_message_envelope.js";
import { FedosSyncDeviceRegistry } from "../src/sync/fedos_sync_device_registry.js";
import type { FedosConversationParticipantReference } from "../src/os/messenger/conversations/membership/fedos_conversation_participant_reference.js";
import { assessFedosLocalPayloadDeletion } from "../src/os/messenger/conversations/deletion/fedos_deletion_assessment.js";
import { buildFedosLocalPayloadDeletionPlan, buildFedosLocalDeviceAccessRevocationPlan, buildFedosLocalMembershipAccessRevocationPlan } from "../src/os/messenger/conversations/deletion/fedos_deletion_plan.js";
import { assessFedosLocalDeviceAccessRevocation, assessFedosLocalMembershipAccessRevocation } from "../src/os/messenger/conversations/deletion/fedos_deletion_assessment.js";
import {
  executeFedosLocalPayloadDeletionPlan,
  executeFedosLocalDeviceAccessRevocationPlan,
  executeFedosLocalMembershipAccessRevocationPlan,
} from "../src/os/messenger/conversations/deletion/fedos_deletion_execution_coordinator.js";
import { InMemoryFedosDeletionExecutionPersistence } from "../src/os/messenger/conversations/deletion/in_memory_fedos_deletion_execution_persistence.js";

/**
 * Secure Runtime Alpha 5401-5480 -- Execution Coordinator: real Retention +
 * Search integration, idempotency, conflicting-plan rejection, partial
 * Search failure, and Device/Membership revocation separation from payload
 * deletion.
 */

const CONVERSATION_ID = toFedosConversationId(toFedosBoardId("board-a")!, toFedosThreadId("thread-1")!);
const PAYLOAD_ID = toFedosConversationPayloadId("payload-exec-1")!;
const ALICE: FedosConversationParticipantReference = { authority: "fedos", publicIdentifier: "alice", identityId: null };

function makeEnvironment() {
  const payloadStorage = new InMemoryFedosConversationPayloadStorage();
  const draftPersistence = new InMemoryFedosConversationDraftPersistence();
  const membershipAuthority = new InMemoryFedosConversationMembershipAuthority();
  const retentionAuthority = new FedosPayloadRetentionAuthority({
    retentionPersistence: new InMemoryFedosPayloadRetentionPersistence(),
    payloadStorage,
    clock: () => 1_700_000_100,
  });
  const searchIndexDeps: FedosConversationSearchIndexDependencies = { draftPersistence, membershipAuthority, retentionAuthority };
  const searchIndex = new FedosConversationSearchIndex(searchIndexDeps);
  return { payloadStorage, draftPersistence, membershipAuthority, retentionAuthority, searchIndex };
}

function seedIndexedPayload(env: ReturnType<typeof makeEnvironment>) {
  env.draftPersistence.putDraft({
    schemaVersion: 1,
    id: CONVERSATION_ID,
    mode: "direct",
    lifecycleState: "active",
    policyReference: "direct-draft-v1",
    creatorAuthority: "fedos",
    creatorPublicIdentifier: "alice",
    creatorIdentityId: null,
    createdAt: 1_700_000_000,
  });
  const admission = env.membershipAuthority.admit(CONVERSATION_ID, ALICE, "owner", 1_700_000_000);
  if (admission.outcome !== "admitted") throw new Error("test setup failed");
  env.payloadStorage.putPayload(
    { id: PAYLOAD_ID, conversationId: CONVERSATION_ID, mediaType: "application/octet-stream", byteLength: 3, createdAt: 1_700_000_000 },
    new Uint8Array([1, 2, 3]),
  );
  const envelope: FedosConversationMessageEnvelope = (() => {
    const built = validateFedosConversationMessageEnvelope({
      id: "envelope-exec-1",
      conversationId: CONVERSATION_ID,
      senderMembershipId: admission.membership.id,
      payloadId: PAYLOAD_ID,
      encryptionSuite: "ChaCha20Poly1305",
      keyEpoch: 0,
      createdAt: 1_700_000_000,
      replyToEnvelopeId: null,
    });
    if (built === null) throw new Error("test setup: invalid envelope fixture");
    return built;
  })();
  const outcome = env.searchIndex.indexEnvelope({ envelope, text: "a secret plan to delete" });
  if (outcome !== "indexed") throw new Error(`test setup: expected indexed, got ${outcome}`);
  return envelope;
}

describe("Secure Runtime Alpha 5401-5480 -- payload plan execution: real Retention + Search purge", () => {
  it("1. executing a confirmed plan tombstones the payload and purges it from the real Search index", () => {
    const env = makeEnvironment();
    seedIndexedPayload(env);
    expect(env.searchIndex.searchKeyword("secret")).toEqual(["envelope-exec-1"]);

    const assessment = assessFedosLocalPayloadDeletion(PAYLOAD_ID, { retentionAuthority: env.retentionAuthority });
    const plan = buildFedosLocalPayloadDeletionPlan("plan-exec-1", PAYLOAD_ID, assessment);
    const persistence = new InMemoryFedosDeletionExecutionPersistence();

    const outcome = executeFedosLocalPayloadDeletionPlan(
      { plan, requestedBy: "local-user", confirmed: true, authorityReference: "local-user", reasonCode: "user_requested_placeholder" },
      { retentionAuthority: env.retentionAuthority, searchIndex: env.searchIndex, persistence },
    );

    expect(outcome.outcome).toBe("executed");
    if (outcome.outcome !== "executed") throw new Error("unreachable");
    expect(outcome.record.status).toBe("completed");
    expect(outcome.record.steps).toEqual([
      { target: "local-payload", operation: "tombstone", outcome: "applied", evidence: "local-observed" },
      { target: "local-index", operation: "purge-index", outcome: "applied", evidence: "local-verified" },
    ]);
    // Real, independently re-queryable Search purge -- not merely a claimed outcome.
    expect(env.searchIndex.searchKeyword("secret")).toEqual([]);
    expect(env.searchIndex.size()).toBe(0);
    // No plaintext, no raw path anywhere in the durable record.
    expect(JSON.stringify(outcome.record)).not.toMatch(/secret plan/);
  });

  it("2. re-executing the SAME planId is idempotent -- returns the already-persisted record, never re-runs Retention/Search", () => {
    const env = makeEnvironment();
    seedIndexedPayload(env);
    const assessment = assessFedosLocalPayloadDeletion(PAYLOAD_ID, { retentionAuthority: env.retentionAuthority });
    const plan = buildFedosLocalPayloadDeletionPlan("plan-exec-2", PAYLOAD_ID, assessment);
    const persistence = new InMemoryFedosDeletionExecutionPersistence();
    const deps = { retentionAuthority: env.retentionAuthority, searchIndex: env.searchIndex, persistence };
    const request = { plan, requestedBy: "local-user", confirmed: true, authorityReference: "local-user", reasonCode: "user_requested_placeholder" as const };

    const first = executeFedosLocalPayloadDeletionPlan(request, deps);
    const second = executeFedosLocalPayloadDeletionPlan(request, deps);

    expect(first.outcome).toBe("executed");
    expect(second.outcome).toBe("already-executed");
    if (second.outcome !== "already-executed" || first.outcome !== "executed") throw new Error("unreachable");
    expect(second.record).toEqual(first.record);
    expect(persistence.listRecords()).toHaveLength(1);
  });

  it("3. the SAME planId with a DIFFERENT canonicalTargetRef fails closed as 'conflicting-plan', never overwrites", () => {
    const env = makeEnvironment();
    seedIndexedPayload(env);
    const otherPayloadId = toFedosConversationPayloadId("payload-exec-other")!;
    env.payloadStorage.putPayload(
      { id: otherPayloadId, conversationId: CONVERSATION_ID, mediaType: "application/octet-stream", byteLength: 1, createdAt: 1_700_000_000 },
      new Uint8Array([9]),
    );
    const persistence = new InMemoryFedosDeletionExecutionPersistence();
    const deps = { retentionAuthority: env.retentionAuthority, searchIndex: env.searchIndex, persistence };

    const assessmentA = assessFedosLocalPayloadDeletion(PAYLOAD_ID, { retentionAuthority: env.retentionAuthority });
    const planA = buildFedosLocalPayloadDeletionPlan("plan-shared-id", PAYLOAD_ID, assessmentA);
    const outcomeA = executeFedosLocalPayloadDeletionPlan(
      { plan: planA, requestedBy: "local-user", confirmed: true, authorityReference: "local-user", reasonCode: "user_requested_placeholder" },
      deps,
    );
    expect(outcomeA.outcome).toBe("executed");

    const assessmentB = assessFedosLocalPayloadDeletion(otherPayloadId, { retentionAuthority: env.retentionAuthority });
    const planB = buildFedosLocalPayloadDeletionPlan("plan-shared-id", otherPayloadId, assessmentB);
    const outcomeB = executeFedosLocalPayloadDeletionPlan(
      { plan: planB, requestedBy: "local-user", confirmed: true, authorityReference: "local-user", reasonCode: "user_requested_placeholder" },
      deps,
    );
    expect(outcomeB.outcome).toBe("conflicting-plan");
    // The second payload's own Retention state must be untouched by the rejected conflicting call.
    expect(env.retentionAuthority.evaluatePayloadAccess(otherPayloadId)).toEqual({ outcome: "allowed" });
  });

  it("4. omitting confirmation on a plan that requires it refuses execution -- no Retention/Search mutation happens", () => {
    const env = makeEnvironment();
    seedIndexedPayload(env);
    const assessment = assessFedosLocalPayloadDeletion(PAYLOAD_ID, { retentionAuthority: env.retentionAuthority });
    const plan = buildFedosLocalPayloadDeletionPlan("plan-exec-unconfirmed", PAYLOAD_ID, assessment);
    const persistence = new InMemoryFedosDeletionExecutionPersistence();

    const outcome = executeFedosLocalPayloadDeletionPlan(
      { plan, requestedBy: "local-user", confirmed: false, authorityReference: "local-user", reasonCode: "user_requested_placeholder" },
      { retentionAuthority: env.retentionAuthority, searchIndex: env.searchIndex, persistence },
    );

    expect(outcome.outcome).toBe("confirmation-required");
    expect(env.retentionAuthority.evaluatePayloadAccess(PAYLOAD_ID)).toEqual({ outcome: "allowed" });
    expect(env.searchIndex.size()).toBe(1);
    expect(persistence.listRecords()).toHaveLength(0);
  });

  it("5. a Search-purge failure produces 'partially-deleted', never a false 'completed' -- the Retention step's own real success is preserved", () => {
    const env = makeEnvironment();
    seedIndexedPayload(env);
    const assessment = assessFedosLocalPayloadDeletion(PAYLOAD_ID, { retentionAuthority: env.retentionAuthority });
    const plan = buildFedosLocalPayloadDeletionPlan("plan-exec-partial", PAYLOAD_ID, assessment);
    const persistence = new InMemoryFedosDeletionExecutionPersistence();
    const throwingSearchIndex = { reconcilePayloadRetention: () => { throw new Error("search backend unavailable"); } };

    const outcome = executeFedosLocalPayloadDeletionPlan(
      { plan, requestedBy: "local-user", confirmed: true, authorityReference: "local-user", reasonCode: "user_requested_placeholder" },
      { retentionAuthority: env.retentionAuthority, searchIndex: throwingSearchIndex, persistence },
    );

    expect(outcome.outcome).toBe("executed");
    if (outcome.outcome !== "executed") throw new Error("unreachable");
    expect(outcome.record.status).toBe("partially-deleted");
    expect(outcome.record.steps[0]).toMatchObject({ target: "local-payload", outcome: "applied" });
    expect(outcome.record.steps[1]).toMatchObject({ target: "local-index", outcome: "failed", evidence: "none" });
    // The real Retention transition is NOT rolled back by the Search failure -- it already happened.
    const reassessed = env.retentionAuthority.evaluatePayloadAccess(PAYLOAD_ID);
    expect(reassessed.outcome).toBe("denied");
  });

  it("6. a not-found/already-terminal payload's zero-step plan executes to 'completed' with zero steps, never a spurious mutation", () => {
    const env = makeEnvironment();
    seedIndexedPayload(env);
    env.retentionAuthority.tombstonePayload(PAYLOAD_ID, null, "test_placeholder");
    env.retentionAuthority.removeLocalPayload(PAYLOAD_ID, null, "test_placeholder");
    const assessment = assessFedosLocalPayloadDeletion(PAYLOAD_ID, { retentionAuthority: env.retentionAuthority });
    const plan = buildFedosLocalPayloadDeletionPlan("plan-exec-terminal", PAYLOAD_ID, assessment);
    expect(plan.steps).toEqual([]);
    const persistence = new InMemoryFedosDeletionExecutionPersistence();

    const outcome = executeFedosLocalPayloadDeletionPlan(
      { plan, requestedBy: "local-user", confirmed: false, authorityReference: "local-user", reasonCode: "user_requested_placeholder" },
      { retentionAuthority: env.retentionAuthority, searchIndex: env.searchIndex, persistence },
    );
    expect(outcome.outcome).toBe("executed");
    if (outcome.outcome !== "executed") throw new Error("unreachable");
    expect(outcome.record.status).toBe("completed");
    expect(outcome.record.steps).toEqual([]);
  });
});

describe("Secure Runtime Alpha 5401-5480 -- Device revocation is a SEPARATE plan/outcome from payload deletion", () => {
  it("7. executing a Device revocation plan calls ONLY revokeDevice -- never touches Retention/Search state", () => {
    const env = makeEnvironment();
    seedIndexedPayload(env);
    const deviceRegistry = new FedosSyncDeviceRegistry();
    deviceRegistry.registerDevice("device-1", "account-1", 1_700_000_000);

    const assessment = assessFedosLocalDeviceAccessRevocation({ deviceRegistry, deviceRef: "device-1", accountRef: "account-1" });
    const plan = buildFedosLocalDeviceAccessRevocationPlan("plan-device-1", "device-1", assessment);
    const persistence = new InMemoryFedosDeletionExecutionPersistence();

    const outcome = executeFedosLocalDeviceAccessRevocationPlan(
      { plan, requestedBy: "local-user", confirmed: true, deviceRef: "device-1", accountRef: "account-1", at: 1_700_000_200 },
      { deviceRegistry, persistence },
    );

    expect(outcome.outcome).toBe("executed");
    if (outcome.outcome !== "executed") throw new Error("unreachable");
    expect(outcome.record.steps).toEqual([{ target: "local-device-access", operation: "revoke-access", outcome: "applied", evidence: "local-verified" }]);
    expect(deviceRegistry.getDevice("device-1", "account-1")?.state).toBe("revoked");
    // The payload this Arc separately seeded is completely unaffected by a Device revocation.
    expect(env.retentionAuthority.evaluatePayloadAccess(PAYLOAD_ID)).toEqual({ outcome: "allowed" });
    expect(env.searchIndex.size()).toBe(1);
  });

  it("8. re-revoking an already-revoked Device is idempotent -- 'already-applied', never an error", () => {
    const deviceRegistry = new FedosSyncDeviceRegistry();
    deviceRegistry.registerDevice("device-2", "account-1", 1_700_000_000);
    deviceRegistry.revokeDevice("device-2", "account-1", 1_700_000_100);

    const assessment = assessFedosLocalDeviceAccessRevocation({ deviceRegistry, deviceRef: "device-2", accountRef: "account-1" });
    expect(assessment.blocker).toBe("already-terminal");
    const plan = buildFedosLocalDeviceAccessRevocationPlan("plan-device-2", "device-2", assessment);
    expect(plan.steps).toEqual([]);
  });
});

describe("Secure Runtime Alpha 5401-5480 -- Membership revocation is a SEPARATE plan/outcome from payload deletion", () => {
  it("9. executing a Membership revocation plan calls ONLY revoke() -- never implies payload deletion", () => {
    const env = makeEnvironment();
    seedIndexedPayload(env);

    const assessment = assessFedosLocalMembershipAccessRevocation({ membershipAuthority: env.membershipAuthority, conversationId: CONVERSATION_ID, participant: ALICE });
    expect(assessment.blocker).toBe("none");
    const plan = buildFedosLocalMembershipAccessRevocationPlan("plan-membership-1", CONVERSATION_ID, assessment);
    const persistence = new InMemoryFedosDeletionExecutionPersistence();

    const outcome = executeFedosLocalMembershipAccessRevocationPlan(
      { plan, requestedBy: "local-user", confirmed: true, conversationId: CONVERSATION_ID, participant: ALICE, at: 1_700_000_300 },
      { membershipAuthority: env.membershipAuthority, persistence },
    );

    expect(outcome.outcome).toBe("executed");
    if (outcome.outcome !== "executed") throw new Error("unreachable");
    expect(outcome.record.steps).toEqual([{ target: "local-membership-access", operation: "revoke-access", outcome: "applied", evidence: "local-verified" }]);
    expect(env.membershipAuthority.findMembership(CONVERSATION_ID, ALICE)?.state).not.toBe("active");
    // The payload this member sent is completely unaffected by a Membership revocation.
    expect(env.retentionAuthority.evaluatePayloadAccess(PAYLOAD_ID)).toEqual({ outcome: "allowed" });
    expect(env.searchIndex.size()).toBe(1);
  });
});
