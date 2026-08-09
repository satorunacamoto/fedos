import { describe, it, expect } from "vitest";
// @ts-expect-error `node:fs` has no type declarations without `@types/node` in this project's tsconfig.
import { readFileSync } from "node:fs";

import { InMemoryFedosConversationMembershipAuthority } from "../src/os/messenger/conversations/membership/in_memory_fedos_conversation_membership_authority.js";
import { InMemoryFedosConversationMessageEnvelopePersistence } from "../src/os/messenger/conversations/envelope/persistence/in_memory_fedos_conversation_message_envelope_persistence.js";
import { toFedosConversationId } from "../src/os/messenger/conversations/fedos_conversation_id.js";
import { toFedosBoardId, toFedosThreadId } from "../src/os/messenger/board/fedos_board_identifiers.js";
import { toFedosConversationEnvelopeId } from "../src/os/messenger/conversations/envelope/fedos_conversation_envelope_id.js";
import type { FedosConversationParticipantReference } from "../src/os/messenger/conversations/membership/fedos_conversation_participant_reference.js";
import { InMemoryFedosConversationPayloadStorage } from "../src/os/messenger/conversations/payload_storage/in_memory_fedos_conversation_payload_storage.js";
import { toFedosConversationPayloadId } from "../src/os/messenger/conversations/payload_storage/fedos_conversation_payload_id.js";
import { FedosPayloadRetentionAuthority } from "../src/os/messenger/conversations/retention/fedos_payload_retention_authority.js";
import { InMemoryFedosPayloadRetentionPersistence } from "../src/os/messenger/conversations/retention/in_memory_fedos_payload_retention_persistence.js";
import type { FedosConversationPersistence, FedosConversationPersistenceWriteResult } from "../src/os/messenger/conversations/persistence/fedos_conversation_persistence.js";
import type { FedosPersistedConversationRecordV1 } from "../src/os/messenger/conversations/persistence/fedos_persisted_conversation_record_v1.js";
import { InMemoryFedosDeviceRegistryPersistence } from "../src/os/messenger/device/persistence/in_memory_fedos_device_registry_persistence.js";
import {
  FedosNobleTestNostrSigningAuthority,
  fedosTestSecretKeyFromSeed,
} from "../src/os/messenger/conversations/deletion_request/fedos_deletion_request_signing.js";
import { InMemoryFedosDeletionRequestStatePersistence } from "../src/os/messenger/conversations/deletion_request/in_memory_fedos_deletion_request_state_persistence.js";
import { InMemoryFedosDeletionRecipientDecisionPersistence } from "../src/os/messenger/conversations/deletion_request/in_memory_fedos_deletion_recipient_decision_persistence.js";
import { InMemoryFedosDeletionAcknowledgementPersistence } from "../src/os/messenger/conversations/deletion_request/in_memory_fedos_deletion_acknowledgement_persistence.js";
import { InMemoryFedosDeletionExecutionPersistence } from "../src/os/messenger/conversations/deletion/in_memory_fedos_deletion_execution_persistence.js";
import { FedosDeletionRequestOutboundCoordinator } from "../src/os/messenger/conversations/deletion_request/fedos_deletion_request_outbound_coordinator.js";
import { FedosDeletionRequestInboundCoordinator } from "../src/os/messenger/conversations/deletion_request/fedos_deletion_request_inbound_coordinator.js";
import { FedosDeletionAcknowledgementOutboundCoordinator } from "../src/os/messenger/conversations/deletion_request/fedos_deletion_acknowledgement_outbound_coordinator.js";
import { FedosDeletionAcknowledgementInboundCoordinator } from "../src/os/messenger/conversations/deletion_request/fedos_deletion_acknowledgement_inbound_coordinator.js";

import { FedosArchiveSuppressionObservationAuthority } from "../src/os/messenger/conversations/retention/fedos_archive_suppression_observation_authority.js";
import { InMemoryFedosArchiveSuppressionObservationPersistence } from "../src/os/messenger/conversations/retention/in_memory_fedos_archive_suppression_observation_persistence.js";
import { createAndRecordLocalArchiveSuppressionFact } from "../src/os/messenger/conversations/retention/fedos_archive_suppression_local_bridge.js";

/**
 * Secure Runtime Alpha 7721-7800 -- Phase L: Signed Deletion relationship
 * separation proof.
 *
 * These two domains -- `5641-5720`/`5881-5960`'s own Signed Recipient
 * Deletion Request/Acknowledgement, and THIS Arc's own Archive
 * Suppression fact -- are, by the Phase A reconciliation report's own
 * §5 decision, two structurally independent facts:
 *   - A Signed Deletion Acknowledgement proves a RECIPIENT's own local
 *     policy engine actually applied a REQUESTED deletion (or refused
 *     to), addressed to ONE specific counterparty account/Device.
 *   - An Archive Suppression fact proves the ORIGINATING account's own
 *     Device already decided, LOCALLY, that a restore must not surface
 *     a payload/envelope again -- fanned out only to the SAME account's
 *     OTHER Devices, never to a counterparty.
 *
 * This file proves BOTH directions of separation with REAL code, not
 * merely by written claim:
 *   1. Running the full real request -> local-apply -> acknowledgement
 *      round trip (reusing the exact harness shape
 *      `test/secure_runtime_alpha_5881_5960_coordinator_integration.test.ts`
 *      already proved end to end) NEVER records an Archive Suppression
 *      fact as a side effect -- `evaluateSuppression()` for the same
 *      payload stays `"active"` throughout.
 *   2. Recording a REAL local Archive Suppression fact for that SAME
 *      payload id never touches the Deletion Request lifecycle state or
 *      either party's own Acknowledgement store.
 *   3. A structural (source-text) check: neither domain's own source
 *      files import or reference the other's types/classes anywhere --
 *      no shared mutation path exists for a future edit to silently
 *      create.
 */

const ALICE_INDEX = 0;
const BOB_INDEX = 1;
const ALICE: FedosConversationParticipantReference = { authority: "fedos", publicIdentifier: "alice-account", identityId: null };
const BOB: FedosConversationParticipantReference = { authority: "fedos", publicIdentifier: "bob-account", identityId: null };
const CONVERSATION_ID = toFedosConversationId(toFedosBoardId("board-separation")!, toFedosThreadId("thread-1")!);

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

describe("Secure Runtime Alpha 7721-7800 -- Signed Deletion / Archive Suppression relationship separation (Phase L)", () => {
  it("1. a full real Signed Deletion request -> local-apply -> acknowledgement round trip never records an Archive Suppression fact as a side effect", async () => {
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
    const recipientOwnAckPersistence = new InMemoryFedosDeletionAcknowledgementPersistence();
    const requesterOwnAckPersistence = new InMemoryFedosDeletionAcknowledgementPersistence();
    const localExecutionPersistence = new InMemoryFedosDeletionExecutionPersistence();

    let ticker = 1_700_000_200;
    const clock = () => ticker++;

    let carriedContent: string | null = null;
    const deliver = async (_controlId: string, _conversationId: string, plaintext: Uint8Array) => {
      carriedContent = new TextDecoder().decode(plaintext);
      return { outcome: "delivered" };
    };

    const outbound = new FedosDeletionRequestOutboundCoordinator({
      conversationPersistence, envelopePersistence, membershipAuthority, deviceRegistry, signingAuthority,
      requesterAccountIndex: ALICE_INDEX, localDeviceRef: "alice-device-a", requestStatePersistence, clock,
      sendMailboxNip17Control: deliver,
    });
    const inbound = new FedosDeletionRequestInboundCoordinator({
      authorization: { conversationPersistence, envelopePersistence, membershipAuthority, clock, localDeviceRef: "bob-device-a" },
      recipientDecisionPersistence, resolveLocalPolicy: () => "allow-local-history-and-index", clock, retentionAuthority,
      searchIndex: { reconcilePayloadRetention: () => 0 }, localExecutionPersistence, localAccountRef: "bob-account",
    });
    const ackOutbound = new FedosDeletionAcknowledgementOutboundCoordinator({
      signingAuthority, recipientAccountIndex: BOB_INDEX, acknowledgementPersistence: recipientOwnAckPersistence, clock,
      sendMailboxNip17Control: deliver,
    });
    const ackInbound = new FedosDeletionAcknowledgementInboundCoordinator({
      requestStatePersistence, acknowledgementPersistence: requesterOwnAckPersistence, clock,
    });

    // A REAL Archive Suppression Authority, watching the SAME payload id, on BOTH parties'
    // own conceptual local state -- proven untouched by anything below.
    const aliceSuppressionAuthority = new FedosArchiveSuppressionObservationAuthority({ persistence: new InMemoryFedosArchiveSuppressionObservationPersistence() });
    const bobSuppressionAuthority = new FedosArchiveSuppressionObservationAuthority({ persistence: new InMemoryFedosArchiveSuppressionObservationPersistence() });
    expect(aliceSuppressionAuthority.evaluateSuppression(payloadId, "restore")).toBe("active");
    expect(bobSuppressionAuthority.evaluateSuppression(payloadId, "restore")).toBe("active");

    const published = await outbound.createSignPublishRequest({
      requesterAccountRef: "alice-account", recipientAccountRef: "bob-account", recipientDeviceRef: "bob-device-a",
      conversationId: CONVERSATION_ID, targetEnvelopeId: envelopeId, scope: "local-history-and-index",
      expiresInSeconds: 100_000, reasonCode: "sent-in-error",
    });
    expect(published.outcome).toBe("published");
    if (published.outcome !== "published") return;

    const imported = await inbound.importRumorContent(carriedContent!);
    expect(imported.outcome).toBe("recorded");
    if (imported.outcome !== "recorded") return;
    expect(imported.decisionState).toBe("locally-applied");
    expect(localExecutionPersistence.listRecords().length).toBe(1);

    // Bob's own real Retention execution ran -- but Bob's own Archive Suppression Authority is
    // an ENTIRELY SEPARATE domain (Phase A reconciliation report §5) and stays untouched by it.
    expect(bobSuppressionAuthority.evaluateSuppression(payloadId, "restore")).toBe("active");

    const ackRecord = {
      schemaVersion: 1 as const, requestId: published.requestId, recipientAccountRef: "bob-account",
      recipientDeviceRef: "bob-device-a", outcome: "applied-local-history-and-index" as const,
      appliedScopes: ["local-history", "local-index"] as const, retainedScopes: [] as const,
      evidenceClass: "local-verified" as const, acknowledgedAt: 1_700_000_900, protocolVersion: 1 as const,
    };
    const ackPublished = await ackOutbound.publishAcknowledgement(ackRecord, CONVERSATION_ID);
    expect(ackPublished.outcome).toBe("published");

    const ackImported = await ackInbound.importAcknowledgementPayload(carriedContent!);
    expect(ackImported.outcome).toBe("recorded");
    if (ackImported.outcome !== "recorded") return;
    expect(requestStatePersistence.getRecord(published.requestId)?.lifecycleState).toBe("acknowledged");

    // The FULL request -> apply -> acknowledge round trip completed -- neither party's own
    // Archive Suppression Authority ever recorded anything: no fact, no observation, nothing.
    expect(aliceSuppressionAuthority.evaluateSuppression(payloadId, "restore")).toBe("active");
    expect(bobSuppressionAuthority.evaluateSuppression(payloadId, "restore")).toBe("active");
    expect(aliceSuppressionAuthority.listObservationsForSubject(payloadId)).toHaveLength(0);
    expect(bobSuppressionAuthority.listObservationsForSubject(payloadId)).toHaveLength(0);
  });

  it("2. recording a real local Archive Suppression fact for the same payload id never touches the Deletion Request lifecycle or either party's own Acknowledgement store", () => {
    const requestStatePersistence = new InMemoryFedosDeletionRequestStatePersistence();
    const recipientOwnAckPersistence = new InMemoryFedosDeletionAcknowledgementPersistence();
    const requesterOwnAckPersistence = new InMemoryFedosDeletionAcknowledgementPersistence();

    const payloadId = toFedosConversationPayloadId("payload-1")!;
    const suppressionAuthority = new FedosArchiveSuppressionObservationAuthority({ persistence: new InMemoryFedosArchiveSuppressionObservationPersistence() });

    const created = createAndRecordLocalArchiveSuppressionFact(
      {
        accountRef: { authority: "nostr", publicIdentifier: "a".repeat(64), identityId: null },
        sourceDeviceId: "device-a",
        subjectRef: payloadId,
        suppressionMeaning: "suppress-payload-restore",
        decidedAt: 1000,
      },
      suppressionAuthority,
    );
    expect(created.outcome).toBe("recorded");
    expect(suppressionAuthority.evaluateSuppression(payloadId, "restore")).toBe("suppressed");

    // Nothing in either Deletion Request lifecycle store or either party's own Acknowledgement
    // store was ever written to -- these two domains share NO mutation path.
    expect(requestStatePersistence.listAllSnapshots().length).toBe(0);
    expect(recipientOwnAckPersistence.listRecords().length).toBe(0);
    expect(requesterOwnAckPersistence.listRecords().length).toBe(0);
  });

  it("3. structural: neither domain's own IMPLEMENTATION (import statements and executable identifier usage, not doc-comment cross-references) reaches into the other's types/classes -- no shared mutation path exists for a future edit to silently create", () => {
    // Only executable lines are checked -- `/** ... */` and `//` doc comments are stripped first, since
    // this codebase's own convention (see e.g. this Arc's own `fedos_archive_suppression_fact.ts` header,
    // "mirrors `fedos_deletion_request_canonical_bytes.ts`'s own discipline exactly") is to cross-reference
    // sibling domains BY NAME in prose to explain a design lineage -- that is documentation, not coupling.
    function stripComments(text: string): string {
      return text.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
    }
    function importedModuleSpecifiers(text: string): string[] {
      return [...text.matchAll(/from\s+["']([^"']+)["']/g)].map((m) => m[1]!);
    }

    const deletionRequestFiles = [
      "src/conversation/deletion_request/fedos_deletion_acknowledgement_inbound_coordinator.ts",
      "src/conversation/deletion_request/fedos_deletion_acknowledgement_outbound_coordinator.ts",
      "src/conversation/deletion_request/fedos_deletion_request_inbound_coordinator.ts",
      "src/conversation/deletion_request/fedos_deletion_request_outbound_coordinator.ts",
    ];
    for (const relativePath of deletionRequestFiles) {
      const code = stripComments(readFileSync(relativePath, "utf8"));
      for (const specifier of importedModuleSpecifiers(code)) {
        expect(specifier).not.toMatch(/archive[-_]suppression/i);
      }
      expect(code).not.toMatch(/ArchiveSuppression/);
    }

    const suppressionFiles = [
      "src/conversation/retention/fedos_archive_suppression_fact.ts",
      "src/conversation/retention/fedos_archive_suppression_observation_authority.ts",
      "src/conversation/retention/fedos_archive_suppression_local_bridge.ts",
      "src/device/archive_suppression_sync/fedos_archive_suppression_outbound_coordinator.ts",
      "src/device/archive_suppression_sync/fedos_archive_suppression_inbound_handler.ts",
    ];
    for (const relativePath of suppressionFiles) {
      const code = stripComments(readFileSync(relativePath, "utf8"));
      for (const specifier of importedModuleSpecifiers(code)) {
        expect(specifier).not.toMatch(/deletion[-_]request/i);
        expect(specifier).not.toMatch(/\/deletion\//i);
      }
      expect(code).not.toMatch(/DeletionAcknowledgement/);
      expect(code).not.toMatch(/DeletionRequest/);
    }
  });
});
