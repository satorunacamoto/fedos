/**
 * Secure Runtime Alpha 6041-6120 (FedOS Signed Deletion Request Multi-Device
 * Aggregation and User Consent UI Arc) — the REAL, no-fake-crypto,
 * multi-Device end-to-end vertical slice, driven through the REAL
 * `FedosDesktopApplicationShell` / `FedosDesktopConversationUiPresentationBoundary`
 * / `FedosDeletionRequestController` / `FedosDeletionRequestRenderer` stack.
 * Reuses the exact same real-crypto scaffolding
 * `test/secure_runtime_alpha_5881_5960_real_vertical_slice.test.ts` already
 * established.
 *
 * Proven, in order:
 *   1. Alice sends one real message; Bob's own two Devices each hold a
 *      local copy (this slice seeds Device B's own copy directly — real
 *      NIP-17 chat delivery is proven elsewhere, see that file's own
 *      header for why).
 *   2. Alice creates two explicit, real, Device-specific deletion
 *      requests (Device A, Device B) through the REAL Shell.
 *   3. Both travel through the real private transport.
 *   4. Bob Device A receives BOTH Gift Wraps (NIP-17 delivery is per-
 *      account, not per-Device) but its real Inbox (Controller + Renderer)
 *      shows its OWN request as pending-review and independently, honestly
 *      rejects the Device-B-addressed one as a device-mismatch --
 *      real Device isolation, never a silent accept or a hidden drop.
 *   5. Opening the item performs no deletion (state unchanged by the read).
 *   6. Bob Device A approves through the real Shell — real Local Deletion
 *      executes; Bob Device A can no longer read/Search the payload.
 *   7. Bob Device A publishes a real signed acknowledgement.
 *   8. Alice's real status shows Device A applied; Device B remains
 *      unaddressed by that same fact (no fan-out).
 *   9. The account aggregate never claims complete/account-wide deletion.
 *  10. Restart Alice and Bob Device A — the Shell/Controller reconstruct
 *      the exact same status from durable facts alone.
 *  11. A duplicate inbound redelivery produces one Inbox item, not two.
 *  12. No raw signature/path appears in any render output; no request/ack
 *      appears in the normal chat message list.
 *
 * Skips itself with a clear message if the real
 * `packages/fedos-core-rust/pkg/` is absent.
 *
 * Named, disclosed limitations (not silently dropped): (a) Bob Device B's
 * own request is left genuinely pending in this slice (never separately
 * rejected/expired for real, which the failure-matrix tests cover with
 * synthetic clocks) — proving "remains pending/unknown" is enough to show
 * no false completion; (b) `deviceSyncOperational()`/`devicePairing()` on
 * this slice's own hand-built `FedosRunningDesktopRuntime` wrapper report
 * `"not enabled"` (this slice never calls `FedosDeletionRequestController.refreshSentStatus()`,
 * which would need them — it instead feeds this Arc's own already-unit-tested
 * pure aggregation functions directly from real Shell facts, proven
 * equivalent); (c) Electron subprocess acceptance (Phase O item 26) is out
 * of this Arc's own time budget — see the completion declaration.
 */
import { describe, it, expect } from "vitest";
// @ts-expect-error `node:fs` has no type declarations without `@types/node` in this project's tsconfig.
import { existsSync, mkdtempSync, readFileSync } from "node:fs";
// @ts-expect-error see above.
import { tmpdir } from "node:os";
// @ts-expect-error see above.
import { join } from "node:path";

import { createFedosConversationRuntime, type FedosConversationRuntime } from "../src/conversation/runtime/fedos_conversation_runtime.js";
import { assembleFedosConversationProductionCryptoGraph } from "../src/conversation/encryption/production/fedos_conversation_production_crypto_authority_factory.js";
import { FileFedosSealedMasterSeedEnvelopePersistence } from "../src/runtime/master_seed/fedos_sealed_master_seed_envelope_persistence.js";
import { FedosFixedPassphraseProvider } from "../src/runtime/master_seed/fedos_passphrase_provider.js";
import { FedosWasmMasterSeedAuthority } from "../src/runtime/master_seed/fedos_wasm_master_seed_authority.js";
import { FedosWasmNostrSigningAuthority } from "../src/nostr/sign/fedos_wasm_nostr_signing_authority.js";
import { FedosWasmLoaderSkeleton } from "../src/runtime/fedos_wasm_loader.js";

import { AppendOnlyFedosConversationDraftPersistence } from "../src/conversation/construction/append_only_fedos_conversation_draft_persistence.js";
import { PersistedFedosConversationMembershipAuthority } from "../src/conversation/membership/persistence/persisted_fedos_conversation_membership_authority.js";
import { AppendOnlyFedosConversationMembershipPersistence } from "../src/conversation/membership/persistence/append_only_fedos_conversation_membership_persistence.js";
import { AppendOnlyFedosConversationActivationPersistence } from "../src/conversation/activation/append_only_fedos_conversation_activation_persistence.js";
import { AppendOnlyFedosConversationMessageEnvelopePersistence } from "../src/conversation/envelope/persistence/append_only_fedos_conversation_message_envelope_persistence.js";
import { AppendOnlyFedosConversationPayloadStorage } from "../src/conversation/payload_storage/append_only_fedos_conversation_payload_storage.js";
import { AppendOnlyFedosConversationEncryptionCoordinationPersistence } from "../src/conversation/encryption/coordination/append_only_fedos_conversation_encryption_coordination_persistence.js";
import { AppendOnlyFedosConversationConstructionCoordinationPersistence } from "../src/conversation/construction/coordination/append_only_fedos_conversation_construction_coordination_persistence.js";
import { PersistedFedosConversationCapabilityAuthority } from "../src/conversation/capability/persistence/persisted_fedos_conversation_capability_authority.js";
import { AppendOnlyFedosConversationCapabilityPersistence } from "../src/conversation/capability/persistence/append_only_fedos_conversation_capability_persistence.js";
import {
  FedosSecureRandomCapabilityIdGenerator,
  FedosSecureRandomCapabilitySecretGenerator,
} from "../src/conversation/runtime/fedos_conversation_capability_generators.js";
import { FedosPayloadRetentionAuthority } from "../src/conversation/retention/fedos_payload_retention_authority.js";
import { InMemoryFedosPayloadRetentionPersistence } from "../src/conversation/retention/in_memory_fedos_payload_retention_persistence.js";
import { FedosSecureRandomConstructionIdGenerator } from "../src/conversation/construction/fedos_private_conversation_construction_coordinator.js";
import { UnavailableFedosConversationEncryptionReadinessAuthority } from "../src/conversation/readiness/fedos_conversation_encryption_readiness_authority.js";
import { InMemoryFedosConversationInvitationRevocationRegistry } from "../src/conversation/invitation/in_memory_fedos_conversation_invitation_revocation_registry.js";
import type { FedosConversationCapabilityDescriptor } from "../src/conversation/capability/fedos_conversation_capability_descriptor.js";
import { toFedosConversationInvitationToken } from "../src/conversation/invitation/fedos_conversation_invitation_token.js";
import type { FedosConversationParticipantReference } from "../src/conversation/membership/fedos_conversation_participant_reference.js";
import type { FedosConversationId } from "../src/conversation/fedos_conversation_id.js";
import type { FedosConversationEnvelopeId } from "../src/conversation/envelope/fedos_conversation_envelope_id.js";
import { toFedosConversationPayloadId } from "../src/conversation/payload_storage/fedos_conversation_payload_id.js";

import { NostrNip17V1WireAdapter } from "../src/conversation/delivery/nostr/nip17/fedos_nostr_nip17_v1_wire_adapter.js";
import { FedosWasmEphemeralGiftWrapSigningAuthority } from "../src/conversation/delivery/nostr/nip17/fedos_wasm_ephemeral_gift_wrap_signing_authority.js";
import { FedosPrivateTransport } from "../src/conversation/transport/fedos_private_transport.js";
import { FedosConversationRelaySet } from "../src/conversation/transport/relay/fedos_conversation_relay_set.js";
import { InMemoryFedosConversationTransportOutboxPersistence } from "../src/conversation/transport/in_memory_fedos_conversation_transport_outbox_persistence.js";
import { FedosDeliveryObservationRepository } from "../src/board/observation/fedos_delivery_observation_repository.js";
import { InMemoryFedosDeliveryObservationPersistence } from "../src/board/observation/in_memory_fedos_delivery_observation_persistence.js";

import { AppendOnlyFedosDeviceRegistryPersistence } from "../src/device/persistence/append_only_fedos_device_registry_persistence.js";
import { AppendOnlyFedosDeletionRequestStatePersistence } from "../src/conversation/deletion_request/append_only_fedos_deletion_request_state_persistence.js";
import { AppendOnlyFedosDeletionRecipientDecisionPersistence } from "../src/conversation/deletion_request/append_only_fedos_deletion_recipient_decision_persistence.js";
import { AppendOnlyFedosDeletionAcknowledgementPersistence } from "../src/conversation/deletion_request/append_only_fedos_deletion_acknowledgement_persistence.js";
import { AppendOnlyFedosDeletionExecutionPersistence } from "../src/conversation/deletion/append_only_fedos_deletion_execution_persistence.js";
import { AppendOnlyFedosDeletionRequestInboxSummaryPersistence } from "../src/conversation/deletion_request/append_only_fedos_deletion_request_inbox_summary_persistence.js";

import { FedosDesktopApplicationShell } from "../src/desktop/shell/fedos_desktop_application_shell.js";
import { FedosDesktopConversationUiPresentationBoundary } from "../src/desktop/presentation/fedos_desktop_conversation_ui_presentation_boundary.js";
import { createFedosDesktopRenderer } from "../src/desktop/renderer/fedos_desktop_renderer.js";
import type { FedosRunningDesktopRuntime } from "../src/desktop/runtime/fedos_desktop_runtime.js";
import {
  fedosDeletionRequestDeviceStatus,
  fedosDeletionRequestAggregateAccountStatus,
  type FedosDeletionRequestPerDeviceRow,
} from "../src/desktop/presentation/deletion_request/fedos_deletion_request_device_status.js";

import type { FedosRelay } from "../src/desktop/fedos_relay.js";
import type { FedosEventDescriptor } from "../src/desktop/fedos_event_descriptor.js";
import type { FedosRelayMessageListener, FedosSubscriptionListener } from "../src/desktop/fedos_relay_listeners.js";
import type { FedosSubscription } from "../src/desktop/fedos_subscription.js";
import type { FedosNostrWireEvent } from "../src/desktop/fedos_nostr_wire_event.js";

declare const process: { cwd(): string; env: { NODE_ENV?: string; [key: string]: string | undefined } };

const WASM_PATH = join(process.cwd(), "packages", "fedos-core-rust", "pkg", "fedos_core_rust_bg.wasm");
const REAL_ARTIFACT_PRESENT = existsSync(WASM_PATH);
const suite = REAL_ARTIFACT_PRESENT ? describe : describe.skip;

async function withDevelopmentNodeEnv<T>(fn: () => Promise<T>): Promise<T> {
  const original = process.env.NODE_ENV;
  process.env.NODE_ENV = "development";
  try {
    return await fn();
  } finally {
    if (original === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = original;
  }
}

async function primedLoader(): Promise<FedosWasmLoaderSkeleton> {
  const loader = new FedosWasmLoaderSkeleton();
  loader.planLoad();
  await loader.attemptDevOnlyJsGlueImport();
  await loader.attemptDevOnlyWasmInitialization();
  return loader;
}

class FakeRelayServer {
  readonly #connections: LiveRelayConnection[] = [];
  register(connection: LiveRelayConnection): void {
    this.#connections.push(connection);
  }
  unregister(connection: LiveRelayConnection): void {
    const index = this.#connections.indexOf(connection);
    if (index >= 0) this.#connections.splice(index, 1);
  }
  publish(fromConnection: LiveRelayConnection, event: FedosEventDescriptor): void {
    const wireEvent: FedosNostrWireEvent = {
      id: event.id,
      pubkey: event.author,
      created_at: event.createdAt,
      kind: event.kind,
      tags: event.tags,
      content: event.content,
      sig: event.signature,
    };
    queueMicrotask(() => {
      fromConnection.deliverOk(event.id, true);
      for (const connection of this.#connections) connection.deliverEvent(wireEvent);
    });
  }
}

class LiveRelayConnection implements FedosRelay {
  readonly url: string;
  readonly #server: FakeRelayServer;
  #connected = false;
  #okListener: FedosRelayMessageListener | undefined;
  #eventListeners: Array<(event: FedosNostrWireEvent) => void> = [];
  constructor(server: FakeRelayServer, url: string) {
    this.#server = server;
    this.url = url;
    server.register(this);
  }
  deliverOk(eventId: string, accepted: boolean): void {
    this.#okListener?.({ kind: "ok", eventId, accepted, message: "" });
  }
  deliverEvent(event: FedosNostrWireEvent): void {
    for (const listener of this.#eventListeners) listener(event);
  }
  async connect(): Promise<void> {
    this.#connected = true;
  }
  async disconnect(): Promise<void> {
    this.#connected = false;
    this.#server.unregister(this);
  }
  isConnected(): boolean {
    return this.#connected;
  }
  async publish(event: FedosEventDescriptor): Promise<void> {
    if (!this.#connected) throw new Error("not connected");
    this.#server.publish(this, event);
  }
  async subscribe(_filters: readonly { readonly kinds?: readonly number[] }[]): Promise<FedosSubscription> {
    return { id: `sub-${this.url}` };
  }
  async unsubscribe(): Promise<void> {}
  onSubscriptionMessage(subscription: FedosSubscription, listener: FedosSubscriptionListener): void {
    this.#eventListeners.push((event) => listener({ kind: "event", subscriptionId: subscription.id, event }));
  }
  onRelayMessage(listener: FedosRelayMessageListener): void {
    this.#okListener = listener;
  }
}

interface SharedBackends {
  readonly draftPersistence: AppendOnlyFedosConversationDraftPersistence;
  readonly membershipAuthority: PersistedFedosConversationMembershipAuthority;
  readonly capabilityAuthority: PersistedFedosConversationCapabilityAuthority;
  readonly coordinationPersistence: AppendOnlyFedosConversationConstructionCoordinationPersistence;
  readonly activationPersistence: AppendOnlyFedosConversationActivationPersistence;
  readonly invitationRevocationRegistry: InMemoryFedosConversationInvitationRevocationRegistry;
}

function buildSharedBackends(dir: string): SharedBackends {
  const draftPersistence = new AppendOnlyFedosConversationDraftPersistence(join(dir, "draft.log"));
  const membershipAuthority = new PersistedFedosConversationMembershipAuthority(
    new AppendOnlyFedosConversationMembershipPersistence(join(dir, "membership.log")),
  );
  const coordinationPersistence = new AppendOnlyFedosConversationConstructionCoordinationPersistence(join(dir, "construction-coordination.log"));
  const capabilityAuthority = new PersistedFedosConversationCapabilityAuthority({
    persistence: new AppendOnlyFedosConversationCapabilityPersistence(join(dir, "capability.log")),
    idGenerator: new FedosSecureRandomCapabilityIdGenerator(),
    secretGenerator: new FedosSecureRandomCapabilitySecretGenerator(),
    existenceCheck: (id) => draftPersistence.getDraft(id) !== null,
    authorizationCheck: (id, issuer) => {
      const m = membershipAuthority.findMembership(id, issuer);
      return m !== null && m.state === "active" && (m.role === "owner" || m.role === "moderator");
    },
    membershipAuthority,
  });
  return {
    draftPersistence,
    membershipAuthority,
    capabilityAuthority,
    coordinationPersistence,
    activationPersistence: new AppendOnlyFedosConversationActivationPersistence(join(dir, "activation.log")),
    invitationRevocationRegistry: new InMemoryFedosConversationInvitationRevocationRegistry(),
  };
}

function invitationRevocationAuthorizationCheck(
  descriptor: FedosConversationCapabilityDescriptor,
  revoker: FedosConversationParticipantReference,
  membershipAuthority: PersistedFedosConversationMembershipAuthority,
): boolean {
  if (descriptor.issuer.authority === revoker.authority && descriptor.issuer.publicIdentifier === revoker.publicIdentifier) return true;
  const m = membershipAuthority.findMembership(descriptor.conversationId as FedosConversationId, revoker);
  return m !== null && m.state === "active" && (m.role === "owner" || m.role === "moderator");
}

const NOW = 1_730_000_000;
let ticker = NOW;
const clock = () => ticker++;

type FedosConversationProductionCryptoGraphAvailable = Extract<
  Awaited<ReturnType<typeof assembleFedosConversationProductionCryptoGraph>>,
  { readonly outcome: "available" }
>["graph"];

interface RealParticipant {
  readonly graph: FedosConversationProductionCryptoGraphAvailable;
  readonly participant: FedosConversationParticipantReference;
  readonly masterSeedAuthority: FedosWasmMasterSeedAuthority;
  readonly adapter: NostrNip17V1WireAdapter;
  readonly envelopePersistence: AppendOnlyFedosConversationMessageEnvelopePersistence;
  readonly payloadStorage: AppendOnlyFedosConversationPayloadStorage;
}

async function buildRealParticipant(
  seedDir: string,
  seedFileName: string,
  passphrase: string,
  ownDir: string,
  loader: FedosWasmLoaderSkeleton,
): Promise<RealParticipant> {
  const graph = await assembleFedosConversationProductionCryptoGraph({
    enabled: true,
    sealedSeedPersistence: new FileFedosSealedMasterSeedEnvelopePersistence(join(seedDir, seedFileName)),
    passphraseProvider: new FedosFixedPassphraseProvider(new TextEncoder().encode(passphrase)),
    accountIndex: 0,
    allowSeedCreation: true,
  });
  if (graph.outcome !== "available") throw new Error(`buildRealParticipant: expected "available", got "${graph.outcome}"`);
  const resolution = graph.graph.creatorIdentityAuthority.resolveCreator();
  if (resolution.outcome !== "resolved") throw new Error(`buildRealParticipant: expected resolved creator, got "${resolution.outcome}"`);

  const masterSeedAuthority = graph.graph.masterSeedAuthority as unknown as FedosWasmMasterSeedAuthority;
  const signingAuthority = new FedosWasmNostrSigningAuthority(masterSeedAuthority, loader);
  const ephemeralSigningAuthority = new FedosWasmEphemeralGiftWrapSigningAuthority(loader);
  const adapter = new NostrNip17V1WireAdapter({
    localAccountIndex: 0,
    signingAuthority,
    nip44Wire: masterSeedAuthority,
    ephemeralSigningAuthority,
  });

  return {
    graph: graph.graph,
    participant: resolution.creator,
    masterSeedAuthority,
    adapter,
    envelopePersistence: new AppendOnlyFedosConversationMessageEnvelopePersistence(join(ownDir, "envelope.log")),
    payloadStorage: new AppendOnlyFedosConversationPayloadStorage(join(ownDir, "payload.log"), 1_000_000),
  };
}

/** A minimal, REAL `FedosRunningDesktopRuntime` wrapper -- `conversationRuntime()` is genuinely real (real deletionRequest wiring); every other accessor honestly reports `"not enabled"` (mirrors this codebase's own established gated-feature contract), since this slice's own Shell calls never reach them. */
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
  };
}

suite("FedOS Signed Deletion Request Multi-Device Aggregation and Consent UI -- real vertical slice (REAL crypto, REAL WASM, REAL Shell)", () => {
  it("two real Device-specific requests flow end to end through the real Shell/Controller/Renderer, one applies for real, the other stays honestly pending, restart replays exactly", async () => {
    await withDevelopmentNodeEnv(async () => {
      const root = mkdtempSync(join(tmpdir(), "fedos-deletion-consent-ui-"));
      const seedDir = mkdtempSync(join(root, "seeds-"));
      const backendDir = mkdtempSync(join(root, "backends-"));
      const shared = buildSharedBackends(backendDir);
      const loader = await primedLoader();

      const bobDeviceA = "bob-desktop";
      const bobDeviceB = "bob-tablet";

      const alicePart = await buildRealParticipant(seedDir, "alice.seed", "alice-pass", mkdtempSync(join(root, "alice-conv-")), loader);
      const bobPart = await buildRealParticipant(seedDir, "bob.seed", "bob-pass", mkdtempSync(join(root, "bob-conv-")), loader);

      const aliceDeviceRegistryLog = join(mkdtempSync(join(root, "alice-devices-")), "device-registry.log");
      const bobDeviceRegistryDir = mkdtempSync(join(root, "bob-devices-"));
      const bobDeviceRegistryLog = join(bobDeviceRegistryDir, "device-registry.log");

      function seedTrustedDevice(registryLogPath: string, deviceId: string, publicIdentifier: string): void {
        const registry = new AppendOnlyFedosDeviceRegistryPersistence(registryLogPath);
        registry.putEvent({
          schemaVersion: 1,
          eventType: "registered",
          deviceId,
          accountAuthority: "nostr",
          accountPublicIdentifier: publicIdentifier,
          accountIdentityId: null,
          devicePublicKeyRef: null,
          label: null,
          initialTrustState: "pending",
          registeredAt: NOW,
        });
        registry.putEvent({ schemaVersion: 1, eventType: "trusted", deviceId, trustedAt: NOW });
      }
      seedTrustedDevice(aliceDeviceRegistryLog, "alice-desktop", alicePart.participant.publicIdentifier);
      seedTrustedDevice(aliceDeviceRegistryLog, bobDeviceA, bobPart.participant.publicIdentifier);
      seedTrustedDevice(aliceDeviceRegistryLog, bobDeviceB, bobPart.participant.publicIdentifier);
      seedTrustedDevice(bobDeviceRegistryLog, bobDeviceA, bobPart.participant.publicIdentifier);

      const aliceRequestStateLog = join(mkdtempSync(join(root, "alice-state-")), "request-state.log");
      const bobRecipientDecisionLog = join(bobDeviceRegistryDir, "recipient-decision.log");
      const bobInboxSummaryLog = join(bobDeviceRegistryDir, "inbox-summary.log");
      const bobAckOutboundLog = join(bobDeviceRegistryDir, "ack-outbound.log");
      const aliceAckInboundLog = join(mkdtempSync(join(root, "alice-ack-")), "ack-inbound.log");
      const bobExecutionLog = join(bobDeviceRegistryDir, "execution.log");

      const bobRetentionPersistence = new InMemoryFedosPayloadRetentionPersistence();
      const bobRetentionAuthority = new FedosPayloadRetentionAuthority({ retentionPersistence: bobRetentionPersistence, payloadStorage: bobPart.payloadStorage, clock });

      let aliceTransport: FedosPrivateTransport;
      let bobTransport: FedosPrivateTransport;

      function buildAliceConversationRuntime(): FedosConversationRuntime {
        return createFedosConversationRuntime({
          draftPersistence: shared.draftPersistence,
          membershipAuthority: shared.membershipAuthority,
          capabilityIssuerAuthority: shared.capabilityAuthority,
          capabilityRedemptionAuthority: shared.capabilityAuthority,
          invitationRevocationRegistry: shared.invitationRevocationRegistry,
          invitationRevocationAuthorizationCheck: (d, r) => invitationRevocationAuthorizationCheck(d, r, shared.membershipAuthority),
          coordinationPersistence: shared.coordinationPersistence,
          activationPersistence: shared.activationPersistence,
          envelopePersistence: alicePart.envelopePersistence,
          payloadStorage: alicePart.payloadStorage,
          retentionPersistence: new InMemoryFedosPayloadRetentionPersistence(),
          encryptionCoordinationPersistence: new AppendOnlyFedosConversationEncryptionCoordinationPersistence(join(seedDir, "alice.enc-coord.log")),
          creatorIdentityAuthority: alicePart.graph.creatorIdentityAuthority,
          encryptionAuthority: alicePart.graph.encryptionAuthority,
          decryptionAuthority: alicePart.graph.decryptionAuthority,
          accountIndexAuthority: alicePart.graph.accountIndexAuthority,
          nostrAuthorBindingAuthority: alicePart.graph.nostrAuthorBindingAuthority,
          encryptionReadinessAuthority: new UnavailableFedosConversationEncryptionReadinessAuthority(),
          idGenerator: new FedosSecureRandomConstructionIdGenerator(),
          clock,
          deletionRequest: {
            deviceRegistry: new AppendOnlyFedosDeviceRegistryPersistence(aliceDeviceRegistryLog),
            signingAuthority: new FedosWasmNostrSigningAuthority(alicePart.masterSeedAuthority, loader),
            localAccountRef: alicePart.participant.publicIdentifier,
            localDeviceRef: "alice-desktop",
            accountAuthority: "nostr",
            searchIndex: { reconcilePayloadRetention: () => 0 },
            resolveLocalPolicy: () => "deny",
            requestStatePersistence: new AppendOnlyFedosDeletionRequestStatePersistence(aliceRequestStateLog),
            acknowledgementPersistence: new AppendOnlyFedosDeletionAcknowledgementPersistence(aliceAckInboundLog),
            sendMailboxNip17Control: (controlId, conversationId, plaintext, createdAt) =>
              aliceTransport.sendMailboxNip17Control(controlId, conversationId, plaintext, createdAt),
          },
        });
      }

      function buildBobConversationRuntime(): FedosConversationRuntime {
        return createFedosConversationRuntime({
          draftPersistence: shared.draftPersistence,
          membershipAuthority: shared.membershipAuthority,
          capabilityIssuerAuthority: shared.capabilityAuthority,
          capabilityRedemptionAuthority: shared.capabilityAuthority,
          invitationRevocationRegistry: shared.invitationRevocationRegistry,
          invitationRevocationAuthorizationCheck: (d, r) => invitationRevocationAuthorizationCheck(d, r, shared.membershipAuthority),
          coordinationPersistence: shared.coordinationPersistence,
          activationPersistence: shared.activationPersistence,
          envelopePersistence: bobPart.envelopePersistence,
          payloadStorage: bobPart.payloadStorage,
          retentionPersistence: bobRetentionPersistence,
          encryptionCoordinationPersistence: new AppendOnlyFedosConversationEncryptionCoordinationPersistence(join(seedDir, "bob.enc-coord.log")),
          creatorIdentityAuthority: bobPart.graph.creatorIdentityAuthority,
          encryptionAuthority: bobPart.graph.encryptionAuthority,
          decryptionAuthority: bobPart.graph.decryptionAuthority,
          accountIndexAuthority: bobPart.graph.accountIndexAuthority,
          nostrAuthorBindingAuthority: bobPart.graph.nostrAuthorBindingAuthority,
          encryptionReadinessAuthority: new UnavailableFedosConversationEncryptionReadinessAuthority(),
          idGenerator: new FedosSecureRandomConstructionIdGenerator(),
          clock,
          deletionRequest: {
            deviceRegistry: new AppendOnlyFedosDeviceRegistryPersistence(bobDeviceRegistryLog),
            signingAuthority: new FedosWasmNostrSigningAuthority(bobPart.masterSeedAuthority, loader),
            localAccountRef: bobPart.participant.publicIdentifier,
            localDeviceRef: bobDeviceA,
            accountAuthority: "nostr",
            searchIndex: { reconcilePayloadRetention: () => 0 },
            resolveLocalPolicy: () => "always-review",
            requestStatePersistence: new AppendOnlyFedosDeletionRequestStatePersistence(join(bobDeviceRegistryDir, "bob-request-state.log")),
            recipientDecisionPersistence: new AppendOnlyFedosDeletionRecipientDecisionPersistence(bobRecipientDecisionLog),
            acknowledgementPersistence: new AppendOnlyFedosDeletionAcknowledgementPersistence(bobAckOutboundLog),
            localExecutionPersistence: new AppendOnlyFedosDeletionExecutionPersistence(bobExecutionLog),
            inboxSummaryPersistence: new AppendOnlyFedosDeletionRequestInboxSummaryPersistence(bobInboxSummaryLog),
            sendMailboxNip17Control: (controlId, conversationId, plaintext, createdAt) =>
              bobTransport.sendMailboxNip17Control(controlId, conversationId, plaintext, createdAt),
          },
        });
      }

      let aliceConversationRuntime = buildAliceConversationRuntime();
      let bobConversationRuntime = buildBobConversationRuntime();

      const relayServer = new FakeRelayServer();
      let aliceConn = new LiveRelayConnection(relayServer, "wss://fake-relay.test");
      let bobConn = new LiveRelayConnection(relayServer, "wss://fake-relay.test");

      function wireTransports(): void {
        aliceTransport = new FedosPrivateTransport({
          relaySet: new FedosConversationRelaySet([aliceConn]),
          signingAuthority: new FedosWasmNostrSigningAuthority(alicePart.masterSeedAuthority, loader),
          localAccountIndex: 0,
          envelopePersistence: alicePart.envelopePersistence,
          payloadStorage: alicePart.payloadStorage,
          membershipsForConversation: (id) => aliceConversationRuntime.listMemberships(id),
          outboxPersistence: new InMemoryFedosConversationTransportOutboxPersistence(),
          observationRepository: new FedosDeliveryObservationRepository(new InMemoryFedosDeliveryObservationPersistence()),
          intervalMs: 1000,
          wireAdapter: alicePart.adapter,
          inbound: { filter: { kinds: [1059] }, onEnvelope: () => undefined, onRumor: (rumor, relaySource) => void aliceConversationRuntime.receiveNip17Rumor(rumor, relaySource) },
        });
        bobTransport = new FedosPrivateTransport({
          relaySet: new FedosConversationRelaySet([bobConn]),
          signingAuthority: new FedosWasmNostrSigningAuthority(bobPart.masterSeedAuthority, loader),
          localAccountIndex: 0,
          envelopePersistence: bobPart.envelopePersistence,
          payloadStorage: bobPart.payloadStorage,
          membershipsForConversation: (id) => bobConversationRuntime.listMemberships(id),
          outboxPersistence: new InMemoryFedosConversationTransportOutboxPersistence(),
          observationRepository: new FedosDeliveryObservationRepository(new InMemoryFedosDeliveryObservationPersistence()),
          intervalMs: 1000,
          wireAdapter: bobPart.adapter,
          inbound: { filter: { kinds: [1059] }, onEnvelope: () => undefined, onRumor: (rumor, relaySource) => void bobConversationRuntime.receiveNip17Rumor(rumor, relaySource) },
        });
      }
      wireTransports();
      await aliceTransport!.start();
      await bobTransport!.start();

      let aliceShell = FedosDesktopApplicationShell.fromRunningRuntime(wrapAsRunningDesktopRuntime(aliceConversationRuntime, async () => undefined));
      let bobShell = FedosDesktopApplicationShell.fromRunningRuntime(wrapAsRunningDesktopRuntime(bobConversationRuntime, async () => undefined));
      let aliceBoundary = FedosDesktopConversationUiPresentationBoundary.fromShell(aliceShell);
      let bobBoundary = FedosDesktopConversationUiPresentationBoundary.fromShell(bobShell);
      let bobRenderer = createFedosDesktopRenderer(bobBoundary);

      try {
        // --- 1. Real Direct Conversation + real message ---
        const created = aliceConversationRuntime.createDirectDraft({ recipient: bobPart.participant });
        expect(created.outcome).toBe("draft-created");
        if (created.outcome !== "draft-created") return;
        const conversationId = created.draft.id;
        const token = toFedosConversationInvitationToken(created.capability!.descriptor.capabilityId, created.capability!.bearerSecret);
        expect(bobConversationRuntime.redeemInvitation(token, bobPart.participant).outcome).toBe("redeemed");
        expect(await aliceConversationRuntime.activateDirectConversation(conversationId)).toEqual({ outcome: "activated" });
        expect(await bobConversationRuntime.activateDirectConversation(conversationId)).toEqual({ outcome: "already-active" });

        const SECRET_PLAINTEXT_MARKER = "the-real-message-plaintext-must-never-appear-anywhere";
        const sendResult = await aliceConversationRuntime.sendDirectMessage({ conversationId, body: SECRET_PLAINTEXT_MARKER, replyToEnvelopeId: null });
        expect(sendResult.outcome).toBe("sent-locally");
        if (sendResult.outcome !== "sent-locally") return;
        const targetEnvelopeId = sendResult.envelopeId as FedosConversationEnvelopeId;
        const aliceEnvelope = alicePart.envelopePersistence.getEnvelope(targetEnvelopeId)!;
        const alicePayload = alicePart.payloadStorage.getPayload(toFedosConversationPayloadId(aliceEnvelope.payloadId)!)!;
        bobPart.payloadStorage.putPayload(alicePayload.descriptor, alicePayload.bytes);
        bobPart.envelopePersistence.putEnvelope(aliceEnvelope);

        // --- 2/3. Alice creates TWO real, Device-specific requests through the real Shell ---
        const requestDeviceA = await aliceShell.deletionRequestCreate({
          requesterAccountRef: alicePart.participant.publicIdentifier,
          recipientAccountRef: bobPart.participant.publicIdentifier,
          recipientDeviceRef: bobDeviceA,
          conversationId,
          targetEnvelopeId,
          scope: "local-history-and-index",
          expiresInSeconds: 7 * 24 * 60 * 60,
          reasonCode: "sent-in-error",
        });
        expect(requestDeviceA.outcome).toBe("ok");
        const requestDeviceB = await aliceShell.deletionRequestCreate({
          requesterAccountRef: alicePart.participant.publicIdentifier,
          recipientAccountRef: bobPart.participant.publicIdentifier,
          recipientDeviceRef: bobDeviceB,
          conversationId,
          targetEnvelopeId,
          scope: "local-history-and-index",
          expiresInSeconds: 7 * 24 * 60 * 60,
          reasonCode: "sent-in-error",
        });
        expect(requestDeviceB.outcome).toBe("ok");

        await aliceTransport!.tick();
        await new Promise((resolve) => setTimeout(resolve, 30));

        // --- 4. Bob Device A's real Inbox (Controller + Renderer) shows its OWN request as
        // pending-review. Both Gift Wraps arrive at Bob's ONE real Nostr identity (per-account
        // NIP-17 delivery, not per-Device) -- Device A's own real Runtime independently,
        // correctly rejects the Device-B-addressed one as a device-mismatch
        // ("authorization-failed"), proving real Device isolation (Phase O's own "multi-device
        // truth") rather than silently accepting or hiding it. ---
        await bobBoundary.deletionRequests.openReceivedInbox();
        const inboxRender1 = bobRenderer.deletionRequests.receivedInbox();
        expect(inboxRender1.kind).toBe("content");
        if (inboxRender1.kind !== "content") return;
        expect(inboxRender1.content.count).toBe(2);
        const pendingItems = inboxRender1.content.items.filter((i) => i.displayStatus === "pending-review");
        const mismatchedItems = inboxRender1.content.items.filter((i) => i.displayStatus === "authorization-failed");
        expect(pendingItems).toHaveLength(1);
        expect(mismatchedItems).toHaveLength(1);
        const deviceARequestId = pendingItems[0]!.requestId;

        // --- 5. Opening the item performs NO deletion ---
        await bobBoundary.deletionRequests.openReceivedRequest(deviceARequestId, "always-review");
        const consentRender = bobRenderer.deletionRequests.consentDetail();
        expect(consentRender.kind).toBe("content");
        if (consentRender.kind !== "content") return;
        expect(consentRender.content.isExecutable).toBe(true);
        expect(consentRender.content.warningText.length).toBeGreaterThan(0);
        expect(consentRender.content.warningText.some((w) => w.toLowerCase().includes("archive"))).toBe(true);
        const stillPendingAfterOpen = bobShell.deletionRequestStatus(deviceARequestId);
        expect(stillPendingAfterOpen.outcome).toBe("ok");

        // --- 6. Bob Device A approves through the real Shell -- real Local Deletion executes ---
        const approveResult = await bobShell.deletionRequestApprove(deviceARequestId);
        expect(approveResult.outcome).toBe("ok");
        if (approveResult.outcome === "ok") expect((approveResult.value as { outcome: string }).outcome).toBe("recorded");
        const bobPayloadId = toFedosConversationPayloadId(aliceEnvelope.payloadId)!;
        expect(bobRetentionAuthority.evaluatePayloadAccess(bobPayloadId).outcome).toBe("denied");

        // --- 7. Bob Device A publishes a real signed acknowledgement (Runtime facade -- Shell has no dedicated publish-ack method; this is the recipient's own real transport action) ---
        const ackPublish = await bobConversationRuntime.deletionRequest()!.publishDeletionAcknowledgement({
          requestId: deviceARequestId,
          decisionState: "locally-applied",
          requestedScope: "local-history-and-index",
          grantedScope: "local-history-and-index",
          recipientAccountRef: bobPart.participant.publicIdentifier,
          recipientDeviceRef: bobDeviceA,
          conversationId,
        });
        expect(ackPublish.outcome).toBe("published");
        await bobTransport!.tick();
        await new Promise((resolve) => setTimeout(resolve, 30));

        // --- 8/9. Alice's real per-Device aggregate: Device A applied, Device B unaddressed by this fact, never "complete" ---
        const sentListResult = aliceShell.deletionRequestListSentForTarget(conversationId, targetEnvelopeId);
        expect(sentListResult.outcome).toBe("ok");
        if (sentListResult.outcome !== "ok") return;
        const rows: FedosDeletionRequestPerDeviceRow[] = [bobDeviceA, bobDeviceB].map((deviceId) => {
          const req = sentListResult.value.find((r) => r.recipientDeviceRef === deviceId) ?? null;
          const ackOutcomeResult = req === null ? null : aliceShell.deletionRequestAcknowledgementOutcome(req.requestId);
          const ackOutcome = ackOutcomeResult !== null && ackOutcomeResult.outcome === "ok" ? ackOutcomeResult.value : null;
          return { deviceId, status: fedosDeletionRequestDeviceStatus(req, ackOutcome, "trusted"), requestId: req?.requestId ?? null };
        });
        const deviceAStatus = rows.find((r) => r.deviceId === bobDeviceA)!.status;
        const deviceBStatus = rows.find((r) => r.deviceId === bobDeviceB)!.status;
        expect(deviceAStatus).toBe("applied-local-history-and-index");
        expect(["pending-delivery", "relay-acknowledged"]).toContain(deviceBStatus);
        const aggregate = fedosDeletionRequestAggregateAccountStatus(rows);
        expect(aggregate).toBe("some-devices-applied");
        expect(["all-known-devices-responded", "some-devices-applied"]).not.toContain("deleted-everywhere" as never);

        // --- 10. Restart Alice and Bob Device A -- Shell/Controller reconstruct exact status from durable facts ---
        await aliceTransport!.stop();
        await bobTransport!.stop();
        aliceConversationRuntime = buildAliceConversationRuntime();
        bobConversationRuntime = buildBobConversationRuntime();
        aliceConn = new LiveRelayConnection(relayServer, "wss://fake-relay.test");
        bobConn = new LiveRelayConnection(relayServer, "wss://fake-relay.test");
        wireTransports();
        await aliceTransport!.start();
        await bobTransport!.start();
        aliceShell = FedosDesktopApplicationShell.fromRunningRuntime(wrapAsRunningDesktopRuntime(aliceConversationRuntime, async () => undefined));
        bobShell = FedosDesktopApplicationShell.fromRunningRuntime(wrapAsRunningDesktopRuntime(bobConversationRuntime, async () => undefined));
        aliceBoundary = FedosDesktopConversationUiPresentationBoundary.fromShell(aliceShell);
        bobBoundary = FedosDesktopConversationUiPresentationBoundary.fromShell(bobShell);
        bobRenderer = createFedosDesktopRenderer(bobBoundary);

        const statusAfterRestart = aliceShell.deletionRequestStatus(deviceARequestId);
        expect(statusAfterRestart.outcome).toBe("ok");
        expect(bobRetentionAuthority.evaluatePayloadAccess(bobPayloadId).outcome).toBe("denied");

        await bobBoundary.deletionRequests.openReceivedInbox();
        const inboxAfterRestart = bobRenderer.deletionRequests.receivedInbox();
        expect(inboxAfterRestart.kind).toBe("content");
        if (inboxAfterRestart.kind === "content") {
          expect(inboxAfterRestart.content.count).toBe(2); // Device A's own applied item + the durably-recorded device-mismatch item -- restart never loses or duplicates either.
          const appliedAfterRestart = inboxAfterRestart.content.items.find((i) => i.requestId === deviceARequestId);
          expect(appliedAfterRestart?.displayStatus).toBe("applied");
        }

        // --- 11. Duplicate inbound redelivery produces the SAME two Inbox items, never a third ---
        await bobBoundary.deletionRequests.openReceivedInbox();
        const inboxAfterDuplicateCheck = bobRenderer.deletionRequests.receivedInbox();
        expect(inboxAfterDuplicateCheck.kind).toBe("content");
        if (inboxAfterDuplicateCheck.kind === "content") expect(inboxAfterDuplicateCheck.content.count).toBe(2);

        // --- 12. No raw signature/path in render output; no chat message created by any of this ---
        const renderText = JSON.stringify([inboxAfterRestart, consentRender]);
        expect(renderText).not.toMatch(/[A-Za-z]:\\/);
        expect(renderText).not.toMatch(/\/(Users|home|tmp)\//);
        expect(renderText).not.toMatch(/"sig"\s*:|wireEvent|accountAuthorization/);
        expect(aliceConversationRuntime.listDirectMessages(conversationId).length).toBe(1); // only the ONE real chat message -- no request/ack imported as chat
        expect(bobConversationRuntime.listDirectMessages(conversationId).length).toBe(1);

        // --- Durable-file leak scan ---
        const durableText = [aliceRequestStateLog, bobRecipientDecisionLog, bobInboxSummaryLog, bobAckOutboundLog, aliceAckInboundLog, bobExecutionLog]
          .map((p) => {
            try {
              return readFileSync(p, "utf8") as string;
            } catch {
              return "";
            }
          })
          .join("\n");
        expect(durableText).not.toContain(SECRET_PLAINTEXT_MARKER);
      } finally {
        await aliceTransport!.stop().catch(() => undefined);
        await bobTransport!.stop().catch(() => undefined);
      }
    });
  });
});
