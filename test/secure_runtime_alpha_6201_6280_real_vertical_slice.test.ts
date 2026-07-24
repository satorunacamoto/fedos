/**
 * Secure Runtime Alpha 6201-6280 (FedOS Desktop Beta Privacy Controls and
 * Safety Center Arc) — Phase O: the real, no-fake-business-Runtime
 * vertical slice, in two parts:
 *
 * PART 1 — the actual real bug this Arc's own Phase D closed: a
 * coordinator-level proof (mirrors
 * `secure_runtime_alpha_5881_5960_coordinator_integration.test.ts`'s own
 * established real-crypto, no-WASM-needed harness exactly) that a
 * `"policy-pending"` request's real signed body survives a full process
 * restart via the new `AppendOnlyFedosDeletionRequestPendingReviewPersistence`
 * — before this Arc, `executeApprovedLocalDeletionById()` would honestly
 * return `"unknown-request"` after a restart; this proves it now succeeds.
 *
 * PART 2 — the Safety Center's own real aggregation, driven through the
 * REAL `FedosConversationRuntime` / `FedosDesktopApplicationShell` /
 * `FedosDesktopConversationUiPresentationBoundary` / `FedosSafetyCenterController`
 * / `FedosSafetyCenterRenderer` stack, built via
 * `assembleFedosConversationRuntimeDependencies()` (the SAME production
 * wiring helper the real Desktop Runtime itself calls) plus this Arc's own
 * lineage's `identityTransition` config — reusing the exact real BIP-340
 * Schnorr crypto and `fromRunningRuntime()`/`fromShell()` seams
 * `secure_runtime_alpha_6121_6200_real_vertical_slice.test.ts` already
 * proved out. Device Trust/Sync are honestly left unconfigured on this
 * Runtime (mirroring `directRatchet`'s own established "optional
 * integration this slice doesn't need" precedent) — this Arc's own Shell
 * accessors already fail closed to `"unsupported"`/`"unavailable"` for
 * that case (proven directly here), never a crash, never a fabricated
 * count.
 */
import { describe, it, expect } from "vitest";
// @ts-expect-error `node:fs` has no type declarations without `@types/node` in this project's tsconfig.
import { mkdtempSync, rmSync, readFileSync } from "node:fs";
// @ts-expect-error see above.
import { tmpdir } from "node:os";
// @ts-expect-error see above.
import { join } from "node:path";
import { schnorr } from "@noble/curves/secp256k1.js";
import { bytesToHex } from "@noble/hashes/utils.js";

// ---- PART 1 imports ----
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
import { FedosNobleTestNostrSigningAuthority, fedosTestSecretKeyFromSeed } from "../src/conversation/deletion_request/fedos_deletion_request_signing.js";
import { InMemoryFedosDeletionRequestStatePersistence } from "../src/conversation/deletion_request/in_memory_fedos_deletion_request_state_persistence.js";
import { InMemoryFedosDeletionRecipientDecisionPersistence } from "../src/conversation/deletion_request/in_memory_fedos_deletion_recipient_decision_persistence.js";
import { InMemoryFedosDeletionExecutionPersistence } from "../src/conversation/deletion/in_memory_fedos_deletion_execution_persistence.js";
import { FedosDeletionRequestOutboundCoordinator } from "../src/conversation/deletion_request/fedos_deletion_request_outbound_coordinator.js";
import { FedosDeletionRequestInboundCoordinator } from "../src/conversation/deletion_request/fedos_deletion_request_inbound_coordinator.js";
import { AppendOnlyFedosDeletionRequestPendingReviewPersistence } from "../src/conversation/deletion_request/append_only_fedos_deletion_request_pending_review_persistence.js";

// ---- PART 2 imports ----
import { createFedosConversationRuntime, type FedosConversationRuntime } from "../src/conversation/runtime/fedos_conversation_runtime.js";
import { assembleFedosConversationRuntimeDependencies } from "../src/conversation/runtime/fedos_conversation_runtime_assembly.js";
import type { FedosRunningDesktopRuntime } from "../src/desktop/runtime/fedos_desktop_runtime.js";
import { FedosDesktopApplicationShell } from "../src/desktop/shell/fedos_desktop_application_shell.js";
import { FedosDesktopConversationUiPresentationBoundary } from "../src/desktop/presentation/fedos_desktop_conversation_ui_presentation_boundary.js";
import { FedosDesktopRenderer } from "../src/desktop/renderer/fedos_desktop_renderer.js";
import { RealFedosNostrSigningAuthority } from "./support/real_fedos_nostr_signing_authority.js";
import { AppendOnlyFedosDeviceRegistryPersistence } from "../src/device/persistence/append_only_fedos_device_registry_persistence.js";
import { AppendOnlyFedosIdentityTransitionPeerObservationPersistence } from "../src/conversation/identity_transition/peer_integration/persistence/append_only_fedos_identity_transition_peer_observation_persistence.js";
import { InMemoryFedosIdentityTransitionRatchetResetLinkPersistence } from "../src/conversation/identity_transition/peer_integration/fedos_identity_transition_ratchet_reset_link.js";
import { InMemoryFedosIdentityTransitionManualVerificationPersistence } from "../src/conversation/identity_transition/peer_integration/fedos_identity_transition_manual_verification.js";
import { InMemoryFedosIdentityTransitionConversationContinuityPersistence } from "../src/conversation/identity_transition/peer_integration/fedos_identity_transition_conversation_continuity.js";
import { AppendOnlyFedosIdentityTransitionLocalDecisionPersistence } from "../src/conversation/identity_transition/peer_integration/persistence/append_only_fedos_identity_transition_local_decision_persistence.js";
import { FedosIdentityTransitionOutboundNotificationCoordinator } from "../src/conversation/identity_transition/peer_integration/fedos_identity_transition_outbound_notification_coordinator.js";
import { createFedosIdentityTransitionRecordV1 } from "../src/conversation/identity_transition/fedos_identity_transition_record.js";
import { generateFedosIdentityTransitionId } from "../src/conversation/identity_transition/fedos_identity_transition_id.js";
import {
  fedosIdentityTransitionBodyHash,
  fedosIdentityTransitionNewKeyProofDigest,
  fedosIdentityTransitionContinuityProofDigest,
} from "../src/conversation/identity_transition/fedos_identity_transition_canonical.js";
import { encodeFedosRatchetPeerCapabilityControlPayload } from "../src/conversation/ratchet/peer_capability/fedos_ratchet_peer_capability_control_payload.js";
import type { FedosDeviceBindingAccountRef } from "../src/device/fedos_device_binding.js";
import type { FedosConversationId } from "../src/conversation/fedos_conversation_id.js";

const ALICE_INDEX = 0;
const BOB_INDEX = 1;
const ALICE: FedosConversationParticipantReference = { authority: "fedos", publicIdentifier: "alice-account", identityId: null };
const BOB: FedosConversationParticipantReference = { authority: "fedos", publicIdentifier: "bob-account", identityId: null };
const CONVERSATION_ID_1 = toFedosConversationId(toFedosBoardId("safety-center-slice")!, toFedosThreadId("thread-1")!);

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

describe("Secure Runtime Alpha 6201-6280 — Part 1: pending-review durability closure (real crypto, real restart, no WASM needed)", () => {
  it("a `policy-pending` request's real signed body survives a full process restart and can then be approved -- the exact gap this Arc's own Phase D closed", async () => {
    const dir = mkdtempSync(join(tmpdir(), "fedos-safety-center-pending-review-"));
    try {
      const pendingReviewLog = join(dir, "pending-review.ndjson");

      const conversationPersistence = new FakeConversationPersistence();
      const membershipAuthority = new InMemoryFedosConversationMembershipAuthority();
      const envelopePersistence = new InMemoryFedosConversationMessageEnvelopePersistence();
      const payloadStorage = new InMemoryFedosConversationPayloadStorage();
      const retentionAuthority = new FedosPayloadRetentionAuthority({ retentionPersistence: new InMemoryFedosPayloadRetentionPersistence(), payloadStorage, clock: () => 1_700_000_000 });
      const deviceRegistry = new InMemoryFedosDeviceRegistryPersistence();
      seedTrustedDevice(deviceRegistry, "alice-device-a", 1_700_000_000);
      seedTrustedDevice(deviceRegistry, "bob-device-a", 1_700_000_000);

      conversationPersistence.putConversation({ schemaVersion: 1, id: CONVERSATION_ID_1, mode: "private", boardId: "", rootThreadId: "", rootPostId: "", policyReference: "test", createdAt: 1_700_000_000 });
      const aliceAdmission = membershipAuthority.admit(CONVERSATION_ID_1, ALICE, "owner", 1_700_000_000);
      const bobAdmission = membershipAuthority.admit(CONVERSATION_ID_1, BOB, "member", 1_700_000_000);
      if (aliceAdmission.outcome !== "admitted" || bobAdmission.outcome !== "admitted") throw new Error("harness setup failed");

      const payloadId = toFedosConversationPayloadId("payload-1")!;
      payloadStorage.putPayload({ id: payloadId, conversationId: CONVERSATION_ID_1, mediaType: "application/octet-stream", byteLength: 3, createdAt: 1_700_000_000 }, new Uint8Array([1, 2, 3]));
      const envelopeId = toFedosConversationEnvelopeId("envelope-1")!;
      envelopePersistence.putEnvelope({ schemaVersion: 1, id: envelopeId, conversationId: CONVERSATION_ID_1, senderMembershipId: aliceAdmission.membership.id, payloadId, encryptionSuite: "ChaCha20Poly1305", keyEpoch: 0, createdAt: 1_700_000_100, replyToEnvelopeId: null });

      const signingAuthority = new FedosNobleTestNostrSigningAuthority([
        { accountIndex: ALICE_INDEX, secretKey: fedosTestSecretKeyFromSeed("alice") },
        { accountIndex: BOB_INDEX, secretKey: fedosTestSecretKeyFromSeed("bob") },
      ]);

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
        requestStatePersistence: new InMemoryFedosDeletionRequestStatePersistence(),
        clock,
        sendMailboxNip17Control: async () => ({ outcome: "delivered" }),
      });

      let carriedContent: string | null = null;
      const published = await outbound.createSignPublishRequest({
        requesterAccountRef: "alice-account",
        recipientAccountRef: "bob-account",
        recipientDeviceRef: "bob-device-a",
        conversationId: CONVERSATION_ID_1,
        targetEnvelopeId: envelopeId,
        scope: "local-history-and-index",
        expiresInSeconds: 100_000,
        reasonCode: "sent-in-error",
      });
      // Re-derive the real carried content the SAME way `sendMailboxNip17Control` above would have
      // received it, by re-publishing through a coordinator that captures it -- avoids depending on
      // `sendMailboxNip17Control`'s own return-value plumbing for this harness's own test purpose.
      const capturingOutbound = new FedosDeletionRequestOutboundCoordinator({
        conversationPersistence,
        envelopePersistence,
        membershipAuthority,
        deviceRegistry,
        signingAuthority,
        requesterAccountIndex: ALICE_INDEX,
        localDeviceRef: "alice-device-a",
        requestStatePersistence: new InMemoryFedosDeletionRequestStatePersistence(),
        clock,
        sendMailboxNip17Control: async (_id: string, _conv: string, plaintext: Uint8Array) => {
          carriedContent = new TextDecoder().decode(plaintext);
          return { outcome: "delivered" };
        },
      });
      const published2 = await capturingOutbound.createSignPublishRequest({
        requesterAccountRef: "alice-account",
        recipientAccountRef: "bob-account",
        recipientDeviceRef: "bob-device-a",
        conversationId: CONVERSATION_ID_1,
        targetEnvelopeId: envelopeId,
        scope: "local-history-and-index",
        expiresInSeconds: 100_000,
        reasonCode: "sent-in-error",
      });
      expect(published.outcome).toBe("published");
      expect(published2.outcome).toBe("published");
      expect(carriedContent).not.toBeNull();

      // Bob's own durable stores -- the ONE that matters for this Arc's own fix is `pendingReviewPersistence`, append-only.
      const recipientDecisionPersistence = new InMemoryFedosDeletionRecipientDecisionPersistence();
      const localExecutionPersistence = new InMemoryFedosDeletionExecutionPersistence();

      function buildBobInbound(): FedosDeletionRequestInboundCoordinator {
        return new FedosDeletionRequestInboundCoordinator({
          authorization: { conversationPersistence, envelopePersistence, membershipAuthority, clock, localDeviceRef: "bob-device-a" },
          recipientDecisionPersistence,
          resolveLocalPolicy: () => "always-review",
          clock,
          retentionAuthority,
          searchIndex: { reconcilePayloadRetention: () => 0 },
          localExecutionPersistence,
          localAccountRef: "bob-account",
          pendingReviewPersistence: new AppendOnlyFedosDeletionRequestPendingReviewPersistence(pendingReviewLog),
        });
      }

      let bobInbound = buildBobInbound();
      const imported = await bobInbound.importRumorContent(carriedContent!);
      expect(imported.outcome).toBe("recorded");
      if (imported.outcome !== "recorded") return;
      expect(imported.decisionState).toBe("policy-pending");

      // Restart Bob -- a FRESH FedosDeletionRequestInboundCoordinator instance, same append-only
      // pending-review log file. BEFORE this Arc, the in-memory `#pendingReviewCache` alone would
      // have been empty here, and `executeApprovedLocalDeletionById()` would have returned
      // "unknown-request" -- this is the exact gap this Arc's own Phase D closed.
      bobInbound = buildBobInbound();
      const approved = await bobInbound.executeApprovedLocalDeletionById(imported.requestId);
      expect(approved.outcome).not.toBe("unknown-request");
      expect((approved as { decisionState?: string }).decisionState).toBe("locally-applied");

      // Real b3b3a6d execution really ran.
      expect(localExecutionPersistence.listRecords().length).toBe(1);

      // Consumed exactly once -- a second approval attempt for the SAME requestId now correctly reports "unknown-request" (tombstoned).
      const secondAttempt = await bobInbound.executeApprovedLocalDeletionById(imported.requestId);
      expect(secondAttempt.outcome).toBe("unknown-request");

      // No secret in the durable pending-review log file itself.
      const rawLog = readFileSync(pendingReviewLog, "utf8") as string;
      expect(rawLog).not.toMatch(/privatekey|secretkey/i);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

// ---- PART 2 fixtures (mirrors secure_runtime_alpha_6121_6200_real_vertical_slice.test.ts) ----

const NOW = 1_700_000_000;
const clock2 = () => NOW;

function accountRef(pubkey: string): FedosDeviceBindingAccountRef {
  return { authority: "nostr", publicIdentifier: pubkey, identityId: null };
}

const CONVERSATION_ID_2 = "alice-bob-direct-safety-center" as unknown as FedosConversationId;

function wrapAsRunningDesktopRuntime(conversationRuntime: FedosConversationRuntime, onStop: () => Promise<void>): FedosRunningDesktopRuntime {
  let stopped = false;
  const notEnabled = (name: string) => () => {
    throw new Error(`${name}: not enabled in this real vertical slice's own minimal runtime wrapper`);
  };
  return {
    host: {} as never,
    boardRuntime: notEnabled("boardRuntime"),
    conversationRuntime: () => {
      if (stopped) throw new Error("inaccessible after stop");
      return conversationRuntime;
    },
    privateTransport: notEnabled("privateTransport"),
    conversationArchiveRuntime: notEnabled("conversationArchiveRuntime"),
    conversationContentAccessor: notEnabled("conversationContentAccessor"),
    conversationProductionCryptoCapability: () => "disabled",
    deviceTrust: notEnabled("deviceTrust"),
    deviceSyncOperational: notEnabled("deviceSyncOperational"),
    devicePairing: notEnabled("devicePairing"),
    stop: async () => {
      stopped = true;
      await onStop();
    },
  } as unknown as FedosRunningDesktopRuntime;
}

describe("Secure Runtime Alpha 6201-6280 — Part 2: Safety Center real aggregation (real Schnorr crypto, real Shell/Presentation/Renderer)", () => {
  it("aggregates real Identity Replacement facts honestly, degrades unconfigured sections without crashing, survives restart, and leaks no secret", async () => {
    const dir = mkdtempSync(join(tmpdir(), "fedos-safety-center-slice-"));
    try {
      const observationLog = join(dir, "observations.ndjson");
      const decisionLog = join(dir, "decisions.ndjson");

      const oldKey = schnorr.utils.randomSecretKey();
      const newKey = schnorr.utils.randomSecretKey();
      const oldPub = bytesToHex(schnorr.getPublicKey(oldKey));
      const newPub = bytesToHex(schnorr.getPublicKey(newKey));
      const record = createFedosIdentityTransitionRecordV1({
        transitionId: generateFedosIdentityTransitionId(),
        transitionType: "identity-replacement",
        oldAccountIdentity: accountRef(oldPub),
        newAccountIdentity: accountRef(newPub),
        oldNostrIdentity: oldPub,
        newNostrIdentity: newPub,
        reasonCategory: "user-initiated-replacement",
        issuedAt: NOW,
        expiresAt: NOW + 1_000_000,
        revision: 0,
        previousTransitionId: null,
      });
      const bodyHash = fedosIdentityTransitionBodyHash(record);
      const newKeyDigest = fedosIdentityTransitionNewKeyProofDigest({ transitionId: record.transitionId, revision: 0, bodyHash, oldNostrIdentity: oldPub, newNostrIdentity: newPub, issuedAt: record.issuedAt, expiresAt: record.expiresAt });
      const continuityDigest = fedosIdentityTransitionContinuityProofDigest({ transitionId: record.transitionId, revision: 0, bodyHash, oldNostrIdentity: oldPub, newNostrIdentity: newPub, issuedAt: record.issuedAt, expiresAt: record.expiresAt });

      const signingAuthority = new RealFedosNostrSigningAuthority();
      const aliceIdentity = await signingAuthority.publicIdentityForAccount(0);
      const aliceAccount = accountRef(aliceIdentity!.publicKeyHex);
      const bobAccount = accountRef("d".repeat(64));

      const bobDeviceRegistryLog = join(dir, "bob-device-registry.ndjson");
      const bobDeviceRegistry = new AppendOnlyFedosDeviceRegistryPersistence(bobDeviceRegistryLog);
      bobDeviceRegistry.putEvent({ schemaVersion: 1, eventType: "registered", deviceId: "bob-desktop", accountAuthority: "nostr", accountPublicIdentifier: bobAccount.publicIdentifier, accountIdentityId: null, devicePublicKeyRef: null, label: null, initialTrustState: "pending", registeredAt: 0 });
      bobDeviceRegistry.putEvent({ schemaVersion: 1, eventType: "trusted", deviceId: "bob-desktop", trustedAt: 1 });

      const outbound = new FedosIdentityTransitionOutboundNotificationCoordinator({
        deviceRegistry: bobDeviceRegistry,
        signingAuthority,
        accountIndex: 0,
        localAccountRef: aliceAccount,
        localDeviceRef: "alice-old-desktop",
        clock: clock2,
        nonceGenerator: () => "1".repeat(32),
        sendMailboxNip17Control: async () => ({ outcome: "delivered" }),
      });
      const published = await outbound.publishTransitionNotification({
        notificationId: "identity-transition-notif-1",
        transitionRecord: record,
        newKeyProof: { schemaVersion: 1, transitionId: record.transitionId, revision: 0, bodyHash, newNostrIdentity: newPub, issuedAt: record.issuedAt, expiresAt: record.expiresAt, signatureHex: bytesToHex(schnorr.sign(newKeyDigest, newKey)) },
        continuityEvidence: { schemaVersion: 1, transitionId: record.transitionId, revision: 0, bodyHash, oldNostrIdentity: oldPub, newNostrIdentity: newPub, issuedAt: record.issuedAt, expiresAt: record.expiresAt, signatureHex: bytesToHex(schnorr.sign(continuityDigest, oldKey)) },
        deviceCorroborations: [],
        recipientAccountRef: bobAccount,
        recipientDeviceRef: "bob-desktop",
        conversationId: CONVERSATION_ID_2,
      });
      expect(published.outcome).toBe("published");
      if (published.outcome !== "published") throw new Error("unreachable");
      const wireContent = new TextDecoder().decode(encodeFedosRatchetPeerCapabilityControlPayload({ schemaVersion: 1, kind: "identity-transition-notification", notification: published.notification }));

      function buildBobConversationRuntime(): FedosConversationRuntime {
        return createFedosConversationRuntime({
          ...assembleFedosConversationRuntimeDependencies({ clock: clock2 }),
          identityTransition: {
            deviceRegistry: new AppendOnlyFedosDeviceRegistryPersistence(bobDeviceRegistryLog),
            signingAuthority: new RealFedosNostrSigningAuthority(),
            localAccountRef: bobAccount,
            localDeviceRef: "bob-desktop",
            sendMailboxNip17Control: async () => ({ outcome: "queued", envelopeId: "identity-transition-notif-1" }),
            observationPersistence: new AppendOnlyFedosIdentityTransitionPeerObservationPersistence(observationLog),
            resetLinkPersistence: new InMemoryFedosIdentityTransitionRatchetResetLinkPersistence(),
            manualVerificationPersistence: new InMemoryFedosIdentityTransitionManualVerificationPersistence(),
            continuityPersistence: new InMemoryFedosIdentityTransitionConversationContinuityPersistence(),
            localDecisionPersistence: new AppendOnlyFedosIdentityTransitionLocalDecisionPersistence(decisionLog),
            localPolicy: { autoAcceptOldKeyContinuity: false },
          },
        });
      }

      let bobConversationRuntime = buildBobConversationRuntime();
      let bobShell = FedosDesktopApplicationShell.fromRunningRuntime(wrapAsRunningDesktopRuntime(bobConversationRuntime, async () => undefined));
      let bobBoundary = FedosDesktopConversationUiPresentationBoundary.fromShell(bobShell);
      let bobRenderer = new FedosDesktopRenderer(bobBoundary);

      const imported = await bobConversationRuntime.receiveNip17Rumor(
        { envelopeId: "e1", senderPublicKeyHex: aliceAccount.publicIdentifier, recipientPublicKeyHex: bobAccount.publicIdentifier, createdAt: NOW, kind: 14, tags: [], content: wireContent },
        null,
      );
      expect((imported as { outcome: string }).outcome).toBe("recorded");

      // 1: honest devices/sync "unavailable" (Device Trust/Sync unconfigured on this slice's own Runtime) -- never a crash, never a fabricated count.
      const devicesResult = bobShell.devicesList();
      expect(devicesResult.outcome).not.toBe("ok");
      const syncResult = bobShell.deviceSyncStatus();
      expect(syncResult.outcome).not.toBe("ok");

      // 2: real Safety Center overview -- one pending Identity Replacement review, deletion-request Runtime honestly not configured.
      await bobBoundary.safetyCenter.refreshOverview([]);
      let overviewState = bobBoundary.safetyCenter.overviewState;
      expect(overviewState.status).toBe("loaded");
      if (overviewState.status !== "loaded") throw new Error("unreachable");
      expect(overviewState.data.summary.pendingIdentityReplacementCount).toBe(1);
      const deletionSection = overviewState.data.summary.sections.find((s) => s.section === "deletion-requests");
      expect(deletionSection?.state).toBe("unavailable");
      const identitySection = overviewState.data.summary.sections.find((s) => s.section === "identity-replacement");
      expect(identitySection?.state).toBe("attention");

      // 3: standing warnings are always present -- never omitted, never claimed as fixed.
      expect(overviewState.data.standingWarnings.length).toBeGreaterThan(0);
      const overviewRender = bobRenderer.safetyCenter.overview();
      expect(overviewRender.kind).toBe("content");

      // 4: Bob explicitly accepts the transition -- a SEPARATE, real Controller action.
      await bobBoundary.identityTransitions.openTransition(aliceAccount, "alice-old-desktop", record.transitionId);
      await bobBoundary.identityTransitions.acceptSelected();
      await bobBoundary.safetyCenter.refreshOverview([]);
      overviewState = bobBoundary.safetyCenter.overviewState;
      expect(overviewState.status).toBe("loaded");
      if (overviewState.status !== "loaded") throw new Error("unreachable");
      expect(overviewState.data.summary.pendingIdentityReplacementCount).toBe(0);

      // 5: real bounded event timeline includes this acceptance.
      await bobBoundary.safetyCenter.refreshEvents();
      const eventsState = bobBoundary.safetyCenter.eventsState;
      expect(eventsState.status).toBe("loaded");
      if (eventsState.status !== "loaded") throw new Error("unreachable");
      expect(eventsState.data.some((e) => e.category === "identity-replacement-accepted" && e.subjectRef === record.transitionId)).toBe(true);

      // 6: Safety Confirmation Dialog -- request then cancel never mutates anything.
      bobBoundary.safetyCenter.requestRevokeDeviceConfirmation("some-device", "aa".repeat(32));
      expect(bobBoundary.safetyCenter.confirmationState.status).toBe("loaded");
      bobBoundary.safetyCenter.cancelPendingConfirmation();
      expect(bobBoundary.safetyCenter.confirmationState.status).toBe("idle");
      expect(bobBoundary.safetyCenter.navigation.pendingConfirmation).toBeNull();

      // 7: restart Bob -- fresh Runtime/Shell/Boundary/Renderer, SAME append-only logs -- overview reconstructs the accepted state exactly.
      bobConversationRuntime = buildBobConversationRuntime();
      bobShell = FedosDesktopApplicationShell.fromRunningRuntime(wrapAsRunningDesktopRuntime(bobConversationRuntime, async () => undefined));
      bobBoundary = FedosDesktopConversationUiPresentationBoundary.fromShell(bobShell);
      bobRenderer = new FedosDesktopRenderer(bobBoundary);
      await bobBoundary.safetyCenter.refreshOverview([]);
      const restartedOverviewState = bobBoundary.safetyCenter.overviewState;
      expect(restartedOverviewState.status).toBe("loaded");
      if (restartedOverviewState.status !== "loaded") throw new Error("unreachable");
      expect(restartedOverviewState.data.summary.pendingIdentityReplacementCount).toBe(0);

      // 8: no raw signature/key/path appears in any render output.
      const overviewJson = JSON.stringify(bobRenderer.safetyCenter.overview());
      expect(overviewJson).not.toContain(bytesToHex(oldKey));
      expect(overviewJson).not.toContain(bytesToHex(newKey));
      expect(overviewJson).not.toContain("signatureHex");
      expect(overviewJson).not.toContain(dir.replace(/\\/g, "\\\\"));
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
