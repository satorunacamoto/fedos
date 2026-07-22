import { describe, it, expect } from "vitest";
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
import type { FedosConversationPersistence, FedosConversationPersistenceWriteResult } from "../src/conversation/persistence/fedos_conversation_persistence.js";
import type { FedosPersistedConversationRecordV1 } from "../src/conversation/persistence/fedos_persisted_conversation_record_v1.js";
import { InMemoryFedosDeviceRegistryPersistence } from "../src/device/persistence/in_memory_fedos_device_registry_persistence.js";
import {
  FedosNobleTestNostrSigningAuthority,
  fedosTestSecretKeyFromSeed,
} from "../src/conversation/deletion_request/fedos_deletion_request_signing.js";
import { InMemoryFedosDeletionRequestStatePersistence } from "../src/conversation/deletion_request/in_memory_fedos_deletion_request_state_persistence.js";
import { InMemoryFedosDeletionRecipientDecisionPersistence } from "../src/conversation/deletion_request/in_memory_fedos_deletion_recipient_decision_persistence.js";
import { InMemoryFedosDeletionAcknowledgementPersistence } from "../src/conversation/deletion_request/in_memory_fedos_deletion_acknowledgement_persistence.js";
import { InMemoryFedosDeletionExecutionPersistence } from "../src/conversation/deletion/in_memory_fedos_deletion_execution_persistence.js";
import { FedosDeletionRequestOutboundCoordinator } from "../src/conversation/deletion_request/fedos_deletion_request_outbound_coordinator.js";
import { FedosDeletionRequestInboundCoordinator } from "../src/conversation/deletion_request/fedos_deletion_request_inbound_coordinator.js";
import { FedosDeletionAcknowledgementOutboundCoordinator } from "../src/conversation/deletion_request/fedos_deletion_acknowledgement_outbound_coordinator.js";
import { FedosDeletionAcknowledgementInboundCoordinator } from "../src/conversation/deletion_request/fedos_deletion_acknowledgement_inbound_coordinator.js";

/**
 * Secure Runtime Alpha 5881-5960 (FedOS Signed Recipient Deletion
 * Request Private Transport and Local Policy Integration Arc) --
 * coordinator-level integration proof. Every dependency is REAL except
 * the network/Relay itself (a synchronous in-process "wire" function
 * standing in for `FedosPrivateTransport.sendMailboxNip17Control()`'s
 * own real delivery -- exercising this Arc's own logic end to end
 * without requiring the compiled WASM artifact this worktree does not
 * have). Real BIP-340 Schnorr signing (`FedosNobleTestNostrSigningAuthority`),
 * real `b3b3a6d` Retention execution, real durable in-memory ports.
 */

const ALICE_INDEX = 0;
const BOB_INDEX = 1;
const ALICE: FedosConversationParticipantReference = { authority: "fedos", publicIdentifier: "alice-account", identityId: null };
const BOB: FedosConversationParticipantReference = { authority: "fedos", publicIdentifier: "bob-account", identityId: null };
const CONVERSATION_ID = toFedosConversationId(toFedosBoardId("board-integration")!, toFedosThreadId("thread-1")!);

class FakeConversationPersistence implements FedosConversationPersistence {
  readonly #byId = new Map<string, FedosPersistedConversationRecordV1>();
  putConversation(record: FedosPersistedConversationRecordV1): FedosConversationPersistenceWriteResult {
    this.#byId.set(record.id, record);
    return "inserted";
  }
  getConversation(id: string): FedosPersistedConversationRecordV1 | null {
    return this.#byId.get(id) ?? null;
  }
  listConversations(): readonly FedosPersistedConversationRecordV1[] {
    return [...this.#byId.values()];
  }
}

function seedTrustedDevice(registry: InMemoryFedosDeviceRegistryPersistence, deviceId: string, at: number): void {
  registry.putEvent({ schemaVersion: 1, eventType: "registered", deviceId, accountAuthority: "fedos", accountPublicIdentifier: deviceId, accountIdentityId: null, devicePublicKeyRef: null, label: null, initialTrustState: "pending", registeredAt: at });
  registry.putEvent({ schemaVersion: 1, eventType: "trusted", deviceId, trustedAt: at });
}

interface Harness {
  readonly outbound: FedosDeletionRequestOutboundCoordinator;
  readonly inbound: FedosDeletionRequestInboundCoordinator;
  readonly ackOutbound: FedosDeletionAcknowledgementOutboundCoordinator;
  readonly ackInbound: FedosDeletionAcknowledgementInboundCoordinator;
  readonly requestStatePersistence: InMemoryFedosDeletionRequestStatePersistence;
  /** Bob's own durable copy of acknowledgements HE sent (`ackOutbound`'s own store). */
  readonly recipientOwnAckPersistence: InMemoryFedosDeletionAcknowledgementPersistence;
  /** Alice's own durable copy of acknowledgements SHE received (`ackInbound`'s own store) -- a DIFFERENT local account's own storage, never shared with Bob's. */
  readonly requesterOwnAckPersistence: InMemoryFedosDeletionAcknowledgementPersistence;
  readonly localExecutionPersistence: InMemoryFedosDeletionExecutionPersistence;
  readonly envelopeId: NonNullable<ReturnType<typeof toFedosConversationEnvelopeId>>;
  readonly payloadId: NonNullable<ReturnType<typeof toFedosConversationPayloadId>>;
  readonly conversationPersistence: FedosConversationPersistence;
  readonly envelopePersistence: InMemoryFedosConversationMessageEnvelopePersistence;
  readonly membershipAuthority: InMemoryFedosConversationMembershipAuthority;
}

function buildHarness(policy: (requesterAccountRef: string) => import("../src/conversation/deletion_request/fedos_deletion_recipient_policy.js").FedosDeletionRecipientPolicy, deliver: (controlId: string, conversationId: string, plaintext: Uint8Array, createdAt: number) => Promise<{ readonly outcome: string }>): Harness {
  const conversationPersistence = new FakeConversationPersistence();
  const membershipAuthority = new InMemoryFedosConversationMembershipAuthority();
  const envelopePersistence = new InMemoryFedosConversationMessageEnvelopePersistence();
  const payloadStorage = new InMemoryFedosConversationPayloadStorage();
  const retentionAuthority = new FedosPayloadRetentionAuthority({ retentionPersistence: new InMemoryFedosPayloadRetentionPersistence(), payloadStorage, clock: () => 1_700_000_000 });
  const deviceRegistry = new InMemoryFedosDeviceRegistryPersistence();
  seedTrustedDevice(deviceRegistry, "alice-device-a", 1_700_000_000);
  seedTrustedDevice(deviceRegistry, "bob-device-a", 1_700_000_000);

  conversationPersistence.putConversation({ schemaVersion: 1, id: CONVERSATION_ID, mode: "private", boardId: "", rootThreadId: "", rootPostId: "", policyReference: "test", createdAt: 1_700_000_000 });
  const aliceAdmission = membershipAuthority.admit(CONVERSATION_ID, ALICE, "owner", 1_700_000_000);
  const bobAdmission = membershipAuthority.admit(CONVERSATION_ID, BOB, "member", 1_700_000_000);
  if (aliceAdmission.outcome !== "admitted" || bobAdmission.outcome !== "admitted") throw new Error("harness setup failed");

  const payloadId = toFedosConversationPayloadId("payload-1")!;
  payloadStorage.putPayload({ id: payloadId, conversationId: CONVERSATION_ID, mediaType: "application/octet-stream", byteLength: 3, createdAt: 1_700_000_000 }, new Uint8Array([1, 2, 3]));
  const envelopeId = toFedosConversationEnvelopeId("envelope-1")!;
  envelopePersistence.putEnvelope({ schemaVersion: 1, id: envelopeId, conversationId: CONVERSATION_ID, senderMembershipId: aliceAdmission.membership.id, payloadId, encryptionSuite: "ChaCha20Poly1305", keyEpoch: 0, createdAt: 1_700_000_100, replyToEnvelopeId: null });

  const signingAuthority = new FedosNobleTestNostrSigningAuthority([
    { accountIndex: ALICE_INDEX, secretKey: fedosTestSecretKeyFromSeed("alice") },
    { accountIndex: BOB_INDEX, secretKey: fedosTestSecretKeyFromSeed("bob") },
  ]);

  const requestStatePersistence = new InMemoryFedosDeletionRequestStatePersistence();
  const recipientDecisionPersistence = new InMemoryFedosDeletionRecipientDecisionPersistence();
  // Two INDEPENDENT parties, two INDEPENDENT durable ack stores -- Bob's own "acks I sent"
  // store is never the same instance as Alice's own "acks I received" store.
  const recipientOwnAckPersistence = new InMemoryFedosDeletionAcknowledgementPersistence();
  const requesterOwnAckPersistence = new InMemoryFedosDeletionAcknowledgementPersistence();
  const localExecutionPersistence = new InMemoryFedosDeletionExecutionPersistence();

  let ticker = 1_700_000_200;
  const clock = () => ticker++;

  const outbound = new FedosDeletionRequestOutboundCoordinator({
    conversationPersistence,
    envelopePersistence,
    membershipAuthority,
    deviceRegistry,
    signingAuthority,
    requesterAccountIndex: ALICE_INDEX,
    localDeviceRef: "alice-device-a",
    requestStatePersistence,
    clock,
    sendMailboxNip17Control: deliver,
  });

  const inbound = new FedosDeletionRequestInboundCoordinator({
    authorization: { conversationPersistence, envelopePersistence, membershipAuthority, clock, localDeviceRef: "bob-device-a" },
    recipientDecisionPersistence,
    resolveLocalPolicy: policy,
    clock,
    retentionAuthority,
    searchIndex: { reconcilePayloadRetention: () => 0 },
    localExecutionPersistence,
    localAccountRef: "bob-account",
  });

  const ackOutbound = new FedosDeletionAcknowledgementOutboundCoordinator({
    signingAuthority,
    recipientAccountIndex: BOB_INDEX,
    acknowledgementPersistence: recipientOwnAckPersistence,
    clock,
    sendMailboxNip17Control: deliver,
  });

  const ackInbound = new FedosDeletionAcknowledgementInboundCoordinator({
    requestStatePersistence,
    acknowledgementPersistence: requesterOwnAckPersistence,
    clock,
  });

  return {
    outbound,
    inbound,
    ackOutbound,
    ackInbound,
    requestStatePersistence,
    recipientOwnAckPersistence,
    requesterOwnAckPersistence,
    localExecutionPersistence,
    envelopeId,
    payloadId,
    conversationPersistence,
    envelopePersistence,
    membershipAuthority,
  };
}

describe("Secure Runtime Alpha 5881-5960 -- outbound -> inbound -> local deletion -> acknowledgement, end to end (Phase C-J)", () => {
  it("1. a request granted by local policy is really applied through b3b3a6d and honestly acknowledged", async () => {
    let carriedContent: string | null = null;
    const deliver = async (_controlId: string, _conversationId: string, plaintext: Uint8Array) => {
      carriedContent = new TextDecoder().decode(plaintext);
      return { outcome: "delivered" };
    };
    const h = buildHarness(() => "allow-local-history-and-index", deliver);

    const published = await h.outbound.createSignPublishRequest({
      requesterAccountRef: "alice-account",
      recipientAccountRef: "bob-account",
      recipientDeviceRef: "bob-device-a",
      conversationId: CONVERSATION_ID,
      targetEnvelopeId: h.envelopeId,
      scope: "local-history-and-index",
      expiresInSeconds: 100_000,
      reasonCode: "sent-in-error",
    });
    expect(published.outcome).toBe("published");
    if (published.outcome !== "published") return;
    expect(h.requestStatePersistence.getRecord(published.requestId)?.lifecycleState).toBe("pending-delivery");
    expect(carriedContent).not.toBeNull();

    const imported = await h.inbound.importRumorContent(carriedContent!);
    expect(imported.outcome).toBe("recorded");
    if (imported.outcome !== "recorded") return;
    expect(imported.decisionState).toBe("locally-applied");
    expect(imported.grantedScope).toBe("local-history-and-index");

    // Real b3b3a6d execution really ran -- re-query independently.
    const executionRecords = h.localExecutionPersistence.listRecords();
    expect(executionRecords.length).toBe(1);
    expect(executionRecords[0]!.status).toBe("completed");

    const ackRecord = {
      schemaVersion: 1 as const,
      requestId: published.requestId,
      recipientAccountRef: "bob-account",
      recipientDeviceRef: "bob-device-a",
      outcome: "applied-local-history-and-index" as const,
      appliedScopes: ["local-history", "local-index"] as const,
      retainedScopes: [] as const,
      evidenceClass: "local-verified" as const,
      acknowledgedAt: 1_700_000_900,
      protocolVersion: 1 as const,
    };
    // `h.ackOutbound` shares the SAME `deliver` callback as `h.outbound` -- publishing the
    // acknowledgement overwrites `carriedContent` with the ack's own wire plaintext.
    const ackPublished = await h.ackOutbound.publishAcknowledgement(ackRecord, CONVERSATION_ID);
    expect(ackPublished.outcome).toBe("published");
    expect(carriedContent).not.toBeNull();

    const ackImported = await h.ackInbound.importAcknowledgementPayload(carriedContent!);
    expect(ackImported.outcome).toBe("recorded");
    if (ackImported.outcome !== "recorded") return;
    expect(ackImported.safeStatus).toBe("acknowledged-local-history-and-index");
    expect(h.requestStatePersistence.getRecord(published.requestId)?.lifecycleState).toBe("acknowledged");
  });

  it("2. a policy-denied request never touches Retention/Search and acknowledges 'rejected-policy'", async () => {
    let carried: string | null = null;
    const deliver = async (_c: string, _cv: string, plaintext: Uint8Array) => {
      carried = new TextDecoder().decode(plaintext);
      return { outcome: "delivered" };
    };
    const h = buildHarness(() => "deny", deliver);
    const published = await h.outbound.createSignPublishRequest({
      requesterAccountRef: "alice-account",
      recipientAccountRef: "bob-account",
      recipientDeviceRef: "bob-device-a",
      conversationId: CONVERSATION_ID,
      targetEnvelopeId: h.envelopeId,
      scope: "local-history-and-index",
      expiresInSeconds: 100_000,
      reasonCode: null,
    });
    expect(published.outcome).toBe("published");
    if (published.outcome !== "published") return;
    const imported = await h.inbound.importRumorContent(carried!);
    expect(imported.outcome).toBe("recorded");
    if (imported.outcome !== "recorded") return;
    expect(imported.decisionState).toBe("policy-rejected");
    expect(h.localExecutionPersistence.listRecords().length).toBe(0);
  });

  it("3. always-review stops at policy-pending until an explicit approval executes it, re-checking policy at approval time (never a bare rubber stamp)", async () => {
    let carried: string | null = null;
    const deliver = async (_c: string, _cv: string, plaintext: Uint8Array) => {
      carried = new TextDecoder().decode(plaintext);
      return { outcome: "delivered" };
    };
    // Mutable, caller-controlled "local configuration" -- flipped mid-test to simulate a human
    // reviewing and then approving, WITHOUT constructing a second, disconnected coordinator
    // (which would need its own copy of every durable store to stay consistent).
    let currentPolicy: "always-review" | "allow-local-history-and-index" = "always-review";
    const h = buildHarness(() => currentPolicy, deliver);
    const published = await h.outbound.createSignPublishRequest({
      requesterAccountRef: "alice-account",
      recipientAccountRef: "bob-account",
      recipientDeviceRef: "bob-device-a",
      conversationId: CONVERSATION_ID,
      targetEnvelopeId: h.envelopeId,
      scope: "local-history-and-index",
      expiresInSeconds: 100_000,
      reasonCode: null,
    });
    expect(published.outcome).toBe("published");
    if (published.outcome !== "published" || published.signed === undefined) return;
    const imported = await h.inbound.importRumorContent(carried!);
    expect(imported.outcome).toBe("recorded");
    if (imported.outcome !== "recorded") return;
    expect(imported.decisionState).toBe("policy-pending");
    expect(h.localExecutionPersistence.listRecords().length).toBe(0);

    // A human/caller now approves -- local policy is reconfigured to actually allow it, THEN
    // the explicit approval path re-derives the grant through that now-different policy.
    currentPolicy = "allow-local-history-and-index";
    const approved = await h.inbound.executeApprovedLocalDeletion(published.signed);
    expect(approved.outcome).toBe("recorded");
    if (approved.outcome !== "recorded") return;
    expect(approved.decisionState).toBe("locally-applied");
    expect(h.localExecutionPersistence.listRecords().length).toBe(1);
  });

  it("4. duplicate request delivery is idempotent", async () => {
    let carried: string | null = null;
    const deliver = async (_c: string, _cv: string, plaintext: Uint8Array) => {
      carried = new TextDecoder().decode(plaintext);
      return { outcome: "delivered" };
    };
    const h = buildHarness(() => "allow-local-history-and-index", deliver);
    const published = await h.outbound.createSignPublishRequest({
      requesterAccountRef: "alice-account",
      recipientAccountRef: "bob-account",
      recipientDeviceRef: "bob-device-a",
      conversationId: CONVERSATION_ID,
      targetEnvelopeId: h.envelopeId,
      scope: "local-history-and-index",
      expiresInSeconds: 100_000,
      reasonCode: null,
    });
    if (published.outcome !== "published") throw new Error("setup failed");
    const first = await h.inbound.importRumorContent(carried!);
    expect(first.outcome).toBe("recorded");
    const second = await h.inbound.importRumorContent(carried!);
    expect(second.outcome).toBe("duplicate");
    expect(h.localExecutionPersistence.listRecords().length).toBe(1);
  });

  it("5. wrong-Device denial: a request addressed to bob-device-a is refused when evaluated as bob-device-b", async () => {
    let carried: string | null = null;
    const deliver = async (_c: string, _cv: string, plaintext: Uint8Array) => {
      carried = new TextDecoder().decode(plaintext);
      return { outcome: "delivered" };
    };
    const h = buildHarness(() => "allow-local-history-and-index", deliver);
    const published = await h.outbound.createSignPublishRequest({
      requesterAccountRef: "alice-account",
      recipientAccountRef: "bob-account",
      recipientDeviceRef: "bob-device-a",
      conversationId: CONVERSATION_ID,
      targetEnvelopeId: h.envelopeId,
      scope: "local-history-and-index",
      expiresInSeconds: 100_000,
      reasonCode: null,
    });
    if (published.outcome !== "published") throw new Error("setup failed");

    // Reuses the SAME real, already-seeded Conversation/Envelope/Membership state `h` itself
    // built (a genuine second local Device evaluating the identical wire payload) -- only
    // `localDeviceRef` differs, isolating the assertion to the Device-binding check alone.
    const wrongDeviceInbound = new FedosDeletionRequestInboundCoordinator({
      authorization: {
        conversationPersistence: h.conversationPersistence,
        envelopePersistence: h.envelopePersistence,
        membershipAuthority: h.membershipAuthority,
        clock: () => 1_700_000_400,
        localDeviceRef: "bob-device-b",
      },
      recipientDecisionPersistence: new InMemoryFedosDeletionRecipientDecisionPersistence(),
      resolveLocalPolicy: () => "allow-local-history-and-index",
      clock: () => 1_700_000_400,
      retentionAuthority: new FedosPayloadRetentionAuthority({ retentionPersistence: new InMemoryFedosPayloadRetentionPersistence(), payloadStorage: new InMemoryFedosConversationPayloadStorage(), clock: () => 1_700_000_400 }),
      searchIndex: { reconcilePayloadRetention: () => 0 },
      localExecutionPersistence: new InMemoryFedosDeletionExecutionPersistence(),
      localAccountRef: "bob-account",
    });
    const imported = await wrongDeviceInbound.importRumorContent(carried!);
    expect(imported.outcome).toBe("recorded");
    if (imported.outcome !== "recorded") return;
    expect(imported.decisionState).toBe("unauthorized");
  });
});
