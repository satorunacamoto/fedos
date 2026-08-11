import { describe, it, expect } from "vitest";
// @ts-expect-error `node:fs` has no type declarations without `@types/node` in this project's tsconfig.
import { mkdtempSync, rmSync } from "node:fs";
// @ts-expect-error see above.
import { tmpdir } from "node:os";
// @ts-expect-error see above.
import { join } from "node:path";
// @ts-expect-error see above.
import { Buffer } from "node:buffer";

import { InMemoryFedosDeviceRegistryPersistence } from "../src/os/messenger/device/persistence/in_memory_fedos_device_registry_persistence.js";
import type { FedosPersistedDeviceBindingEventV1 } from "../src/os/messenger/device/persistence/fedos_persisted_device_binding_event_v1.js";
import { FedosDeliveryObservationRepository } from "../src/os/messenger/board/observation/fedos_delivery_observation_repository.js";
import { InMemoryFedosDeliveryObservationPersistence } from "../src/os/messenger/board/observation/in_memory_fedos_delivery_observation_persistence.js";
import { FedosConversationRelaySet } from "../src/os/messenger/adapters/nostr/transport/relay/fedos_conversation_relay_set.js";
import { FedosDeviceRelaySyncPublisher } from "../src/os/messenger/device/relay_sync/fedos_device_relay_sync_publisher.js";
import { FedosArchiveSuppressionOutboundCoordinator } from "../src/os/messenger/device/archive_suppression_sync/fedos_archive_suppression_outbound_coordinator.js";
import { FedosArchiveSuppressionInboundHandler } from "../src/os/messenger/device/archive_suppression_sync/fedos_archive_suppression_inbound_handler.js";
import { AppendOnlyFedosArchiveSuppressionInboundDedupPersistence } from "../src/os/messenger/device/archive_suppression_sync/persistence/append_only_fedos_archive_suppression_inbound_dedup_persistence.js";
import { FedosArchiveSuppressionObservationAuthority } from "../src/os/messenger/conversations/retention/fedos_archive_suppression_observation_authority.js";
import { AppendOnlyFedosArchiveSuppressionObservationPersistence } from "../src/os/messenger/conversations/retention/append_only_fedos_archive_suppression_observation_persistence.js";
import { createAndRecordLocalArchiveSuppressionFact } from "../src/os/messenger/conversations/retention/fedos_archive_suppression_local_bridge.js";
import type { FedosArchiveSuppressionFact } from "../src/os/messenger/conversations/retention/fedos_archive_suppression_fact.js";
import { nostrWireEventToFedosEventDescriptor } from "../src/os/messenger/board/publish/nostr/fedos_nostr_wire_event_to_event_descriptor.js";
import { WebSocketRelay } from "../src/os/messenger/desktop/websocket_relay.js";
import { createNodeWebSocketRelaySocketFactory } from "../src/os/messenger/desktop/node_websocket_relay_socket_factory.js";
import {
  startFedosRealLocalWebSocketRelayServer,
  type FedosRealLocalWebSocketRelayServer,
} from "./support/fedos_real_local_websocket_relay_server.js";
import { RealFedosNostrSigningAuthority } from "./support/real_fedos_nostr_signing_authority.js";

import { InMemoryFedosConversationPersistence } from "../src/os/messenger/conversations/persistence/in_memory_fedos_conversation_persistence.js";
import { InMemoryFedosConversationMembershipPersistence } from "../src/os/messenger/conversations/membership/persistence/in_memory_fedos_conversation_membership_persistence.js";
import { InMemoryFedosConversationCapabilityPersistence } from "../src/os/messenger/conversations/capability/persistence/in_memory_fedos_conversation_capability_persistence.js";
import { InMemoryFedosConversationMessageEnvelopePersistence } from "../src/os/messenger/conversations/envelope/persistence/in_memory_fedos_conversation_message_envelope_persistence.js";
import { InMemoryFedosConversationPayloadStorage } from "../src/os/messenger/conversations/payload_storage/in_memory_fedos_conversation_payload_storage.js";
import { FEDOS_CONVERSATION_ARCHIVE_SCHEMA_VERSION } from "../src/os/messenger/conversations/archive/fedos_conversation_archive_schema_version.js";
import type { FedosConversationArchiveBundleV1 } from "../src/os/messenger/conversations/archive/fedos_conversation_archive_bundle.js";
import { restoreFedosConversationArchiveBundle } from "../src/os/messenger/conversations/archive/fedos_conversation_archive_restore.js";
import type { FedosConversationId } from "../src/os/messenger/conversations/fedos_conversation_id.js";
import type { FedosConversationPayloadId } from "../src/os/messenger/conversations/payload_storage/fedos_conversation_payload_id.js";
import type { FedosDeviceBindingAccountRef } from "../src/os/messenger/device/fedos_device_binding.js";

/**
 * Secure Runtime Alpha 7721-7800 -- Phase K: real multi-Device vertical
 * slice. Real local RFC 6455 WebSocket relay server + real production
 * `WebSocketRelay` client + real BIP-340 Schnorr signing
 * (`RealFedosNostrSigningAuthority`) + real file-backed (append-only)
 * Suppression Observation / inbound-dedup persistence, across a literal
 * object-recreation "restart."
 *
 * Three Device contexts under one account:
 *   Device A -- creates the local suppression decision, fans it out.
 *   Device B -- trusted, ONLINE during propagation: receives, persists,
 *     restarts, then attempts an Archive restore from a pre-deletion
 *     bundle -- the suppressed payload/envelope stay suppressed.
 *   Device C -- trusted but NOT YET PAIRED at the moment A fans out (the
 *     Phase B "missing Device" edge case, named and accepted, not
 *     solved): confirmed to receive nothing from that fanout and to
 *     legitimately restore the pre-deletion content, matching this
 *     Arc's own disclosed limitation precisely (no resend-on-late-pairing
 *     mechanism exists; a future Arc could add one).
 *
 * HONEST SCOPE: as established in the Phase A reconciliation report and
 * the Phase I status-aggregation file's own header, this Arc builds no
 * return-acknowledgement protocol -- "informed" here means "the real
 * local relay server accepted the publish," never "Device B's own
 * application layer confirmed receipt" beyond what this test itself
 * directly verifies by also running Device B's own real Inbound Handler
 * against the real relay-delivered event.
 */

const CONVERSATION_ID = "board-a::thread-1" as FedosConversationId;
const SUPPRESSED_PAYLOAD_ID = "payload-1" as unknown as FedosConversationPayloadId;

function registeredAndTrustedEvents(deviceId: string, accountRef: FedosDeviceBindingAccountRef, at: number): FedosPersistedDeviceBindingEventV1[] {
  return [
    {
      schemaVersion: 1,
      eventType: "registered",
      deviceId,
      accountAuthority: accountRef.authority,
      accountPublicIdentifier: accountRef.publicIdentifier,
      accountIdentityId: accountRef.identityId,
      devicePublicKeyRef: null,
      label: null,
      initialTrustState: "pending",
      registeredAt: at,
    },
    { schemaVersion: 1, eventType: "trusted", deviceId, trustedAt: at },
  ];
}

function makePreDeletionBundle(): FedosConversationArchiveBundleV1 {
  return {
    schemaVersion: FEDOS_CONVERSATION_ARCHIVE_SCHEMA_VERSION,
    conversationId: CONVERSATION_ID,
    exportedAt: 1_700_000_000, // taken BEFORE the deletion -- still carries the payload/envelope in full.
    conversation: {
      schemaVersion: 1,
      id: CONVERSATION_ID,
      mode: "public",
      boardId: "board-a",
      rootThreadId: "thread-1",
      rootPostId: "thread-1",
      policyReference: "public-v1",
      createdAt: 1_699_999_000,
    },
    memberships: [
      {
        schemaVersion: 1,
        id: `${CONVERSATION_ID}::fedos::alice`,
        conversationId: CONVERSATION_ID,
        participantAuthority: "fedos",
        participantPublicIdentifier: "alice",
        participantIdentityId: null,
        role: "owner",
        state: "active",
        joinedAt: 1_699_999_000,
        endedAt: null,
      },
    ],
    capabilityEvents: [],
    envelopes: [
      {
        schemaVersion: 1,
        id: "envelope-1",
        conversationId: CONVERSATION_ID,
        senderMembershipId: `${CONVERSATION_ID}::fedos::alice`,
        payloadId: "payload-1",
        encryptionSuite: "ChaCha20Poly1305",
        keyEpoch: 0,
        createdAt: 1_699_999_500,
        replyToEnvelopeId: null,
      },
      {
        schemaVersion: 1,
        id: "envelope-unrelated",
        conversationId: CONVERSATION_ID,
        senderMembershipId: `${CONVERSATION_ID}::fedos::alice`,
        payloadId: "payload-unrelated",
        encryptionSuite: "ChaCha20Poly1305",
        keyEpoch: 0,
        createdAt: 1_699_999_600,
        replyToEnvelopeId: null,
      },
    ],
    payloads: [
      {
        schemaVersion: 1,
        id: "payload-1",
        conversationId: CONVERSATION_ID,
        mediaType: "application/octet-stream",
        byteLength: 5,
        createdAt: 1_699_999_500,
        bytesBase64: Buffer.from([1, 2, 3, 4, 5]).toString("base64"),
      },
      {
        schemaVersion: 1,
        id: "payload-unrelated",
        conversationId: CONVERSATION_ID,
        mediaType: "application/octet-stream",
        byteLength: 3,
        createdAt: 1_699_999_600,
        bytesBase64: Buffer.from([9, 9, 9]).toString("base64"),
      },
    ],
  };
}

describe("Secure Runtime Alpha 7721-7800 -- real multi-Device vertical slice (Phase K)", () => {
  it(
    "Device A's suppression fact, sent over a real local relay, is honored by an already-paired online Device B (including across a real restart), while a Device C not yet paired at fanout time legitimately still restores the same pre-deletion content",
    async () => {
      const dir = mkdtempSync(join(tmpdir(), "fedos-7721-7800-"));
      let server: FedosRealLocalWebSocketRelayServer | null = null;
      try {
        server = await startFedosRealLocalWebSocketRelayServer();

        const signingAuthority = new RealFedosNostrSigningAuthority();
        const identity = (await signingAuthority.publicIdentityForAccount(0))!;
        const accountRef: FedosDeviceBindingAccountRef = { authority: "nostr", publicIdentifier: identity.publicKeyHex, identityId: null };

        // ---- Registry: Device A and Device B are trusted; Device C is NOT YET registered. ----
        const registryPersistence = new InMemoryFedosDeviceRegistryPersistence();
        for (const event of registeredAndTrustedEvents("device-a", accountRef, 100)) registryPersistence.putEvent(event);
        for (const event of registeredAndTrustedEvents("device-b", accountRef, 100)) registryPersistence.putEvent(event);

        // ---- Device B, ONLINE FIRST (a real relay has no durable retained log -- a subscriber must already be
        // listening to receive a live publish, exactly like a real Nostr relay's REQ/EVENT semantics): real relay
        // subscription opened BEFORE Device A ever publishes. ----
        const relayB = new WebSocketRelay(server.url, createNodeWebSocketRelaySocketFactory());
        await relayB.connect();
        const receivedByB: import("../src/desktop/fedos_event_descriptor.js").FedosEventDescriptor[] = [];
        const subscription = await relayB.subscribe([{ kinds: [1] }]);
        relayB.onSubscriptionMessage(subscription, (message) => {
          // `message.event` here is a raw `FedosNostrWireEvent` (`pubkey`/`created_at`/`sig`) as delivered by the
          // real relay wire parser, NOT a `FedosEventDescriptor` (`author`/`createdAt`/`signature`) -- the SAME
          // adapter the outbound side already uses in reverse must be applied here too.
          if (message.kind === "event") receivedByB.push(nostrWireEventToFedosEventDescriptor(message.event));
        });

        // ---- Device A: create the local suppression fact and fan it out over the REAL relay. ----
        const localAuthorityA = new FedosArchiveSuppressionObservationAuthority({
          persistence: new AppendOnlyFedosArchiveSuppressionObservationPersistence(join(dir, "suppression-a.ndjson")),
        });
        const created = createAndRecordLocalArchiveSuppressionFact(
          { accountRef, sourceDeviceId: "device-a", subjectRef: SUPPRESSED_PAYLOAD_ID, suppressionMeaning: "suppress-payload-restore", decidedAt: 1000 },
          localAuthorityA,
        );
        expect(created.outcome).toBe("recorded");
        const fact = (created as { fact: FedosArchiveSuppressionFact }).fact;

        const relayA = new WebSocketRelay(server.url, createNodeWebSocketRelaySocketFactory());
        await relayA.connect();
        const observationRepositoryA = new FedosDeliveryObservationRepository(new InMemoryFedosDeliveryObservationPersistence());
        const outbound = new FedosArchiveSuppressionOutboundCoordinator({
          registryPersistence,
          signingAuthority,
          publisher: new FedosDeviceRelaySyncPublisher(new FedosConversationRelaySet([relayA])),
          observationRepository: observationRepositoryA,
        });

        const fanoutResult = await outbound.fanOut({ fact, deviceEvidence: null, sourceDeviceId: "device-a", localAccountIndex: 0 }, 1000);
        expect(fanoutResult.outcome).toBe("fanned-out");
        // Device C is not yet a Registry member -- ONLY Device B is a fanout target.
        expect(fanoutResult.targets).toHaveLength(1);
        expect(fanoutResult.targets[0]!.targetDeviceId).toBe("device-b");
        expect(fanoutResult.targets[0]!.published).toBe(true);

        await new Promise((resolve) => setTimeout(resolve, 50));
        expect(receivedByB.length).toBeGreaterThanOrEqual(1);

        const suppressionLogPathB = join(dir, "suppression-b.ndjson");
        const dedupLogPathB = join(dir, "dedup-b.ndjson");
        const authorityB1 = new FedosArchiveSuppressionObservationAuthority({
          persistence: new AppendOnlyFedosArchiveSuppressionObservationPersistence(suppressionLogPathB),
        });
        const inboundB1 = new FedosArchiveSuppressionInboundHandler({
          registryPersistence,
          dedupPersistence: new AppendOnlyFedosArchiveSuppressionInboundDedupPersistence(dedupLogPathB),
          observationAuthority: authorityB1,
          localDeviceId: "device-b",
          localAccountRef: accountRef,
        });

        let anyRecorded = false;
        for (const descriptor of receivedByB) {
          const result = await inboundB1.handleIncomingEvent({ descriptor, now: 1000 });
          if (result.outcome === "recorded") anyRecorded = true;
        }
        expect(anyRecorded).toBe(true);
        expect(authorityB1.evaluateSuppression(SUPPRESSED_PAYLOAD_ID, "restore")).toBe("suppressed");

        // ---- Device B RESTARTS: fresh objects over the SAME on-disk files. ----
        const authorityB2 = new FedosArchiveSuppressionObservationAuthority({
          persistence: new AppendOnlyFedosArchiveSuppressionObservationPersistence(suppressionLogPathB),
        });
        expect(authorityB2.evaluateSuppression(SUPPRESSED_PAYLOAD_ID, "restore")).toBe("suppressed"); // imported fact survived restart

        // ---- Device B attempts to restore the PRE-DELETION Archive: suppressed payload/envelope stay out; the unrelated one restores fine. ----
        const restoreDeps = {
          conversationPersistence: new InMemoryFedosConversationPersistence(),
          membershipPersistence: new InMemoryFedosConversationMembershipPersistence(),
          capabilityPersistence: new InMemoryFedosConversationCapabilityPersistence(),
          envelopePersistence: new InMemoryFedosConversationMessageEnvelopePersistence(),
          payloadStorage: new InMemoryFedosConversationPayloadStorage(),
          retentionAuthority: { evaluateRetentionDecisionOnly: () => "active", evaluatePayloadAccess: () => ({ outcome: "allowed" }) } as never,
          suppressionAuthority: authorityB2,
        };
        const restoreResult = restoreFedosConversationArchiveBundle(makePreDeletionBundle(), restoreDeps);
        expect(restoreResult.envelopes.denied).toBe(1); // envelope-1 (payload-1) suppressed
        expect(restoreResult.envelopes.inserted).toBe(1); // envelope-unrelated restores fine
        expect(restoreResult.payloads.denied).toBe(1);
        expect(restoreResult.payloads.inserted).toBe(1);
        expect(restoreDeps.payloadStorage.getDescriptor(SUPPRESSED_PAYLOAD_ID)).toBeNull();

        // ---- Device C: NOT a Registry member at fanout time -- receives nothing, and (per this Arc's own
        // disclosed limitation) legitimately restores the pre-deletion content, since it has no suppression fact
        // of its own and no local retention decision either. ----
        const authorityC = new FedosArchiveSuppressionObservationAuthority({ persistence: new AppendOnlyFedosArchiveSuppressionObservationPersistence(join(dir, "suppression-c.ndjson")) });
        expect(authorityC.evaluateSuppression(SUPPRESSED_PAYLOAD_ID, "restore")).toBe("active"); // never informed
        const restoreDepsC = {
          conversationPersistence: new InMemoryFedosConversationPersistence(),
          membershipPersistence: new InMemoryFedosConversationMembershipPersistence(),
          capabilityPersistence: new InMemoryFedosConversationCapabilityPersistence(),
          envelopePersistence: new InMemoryFedosConversationMessageEnvelopePersistence(),
          payloadStorage: new InMemoryFedosConversationPayloadStorage(),
          retentionAuthority: { evaluateRetentionDecisionOnly: () => "active", evaluatePayloadAccess: () => ({ outcome: "allowed" }) } as never,
          suppressionAuthority: authorityC,
        };
        const restoreResultC = restoreFedosConversationArchiveBundle(makePreDeletionBundle(), restoreDepsC);
        expect(restoreResultC.envelopes.inserted).toBe(2); // BOTH restore -- Device C's own honest, disclosed limitation
        expect(restoreResultC.payloads.inserted).toBe(2);

        // ---- No secret/plaintext leak anywhere in what actually crossed the real relay. ----
        for (const descriptor of receivedByB) {
          expect(descriptor.content).not.toMatch(/plaintext|privateKey|masterSeed|secretKey/i);
        }

        await relayA.disconnect();
        await relayB.disconnect();
      } finally {
        if (server !== null) await server.close();
        rmSync(dir, { recursive: true, force: true });
      }
    },
    20_000,
  );
});
