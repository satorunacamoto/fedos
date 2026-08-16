/**
 * Secure Runtime Alpha 7401-7480 (FedOS Direct Conversation Route Binding
 * and NIP-17 Inbound Isolation Arc) — Phase J/K: real Ratchet-route
 * same-peer, two-Conversation isolation, Session Reset isolation, and
 * Device-revocation proofs.
 *
 * Reuses the exact real-crypto harness
 * `test/fedos_ratchet_device_lifecycle_session_reset_real_vertical_slice.test.ts`
 * already establishes (real Master Seeds, real WASM Ratchet Core, a
 * shared in-process real relay, a real, directly-seeded Device Registry)
 * — this file's own job is to prove what THIS Arc's own fix newly makes
 * possible: TWO independent Direct Conversations between the SAME two
 * accounts, each with its OWN independent Ratchet session over the SAME
 * Device pair, correctly isolated by this Arc's own route binding.
 *
 * Before this Arc's own fix (Finding 2, see the Defect Reproduction
 * Report): establishing a SECOND Ratchet session-init with an
 * already-conversing peer deterministically failed closed as
 * `"wrong-conversation"`, because `resolveFedosPrivateNostrInboundDirectConversation()`
 * always resolved to the FIRST (already-active) conversation, never the
 * one the session-init actually named. Proven below: BOTH session-inits
 * now succeed, both Conversations' messages route correctly and only to
 * themselves, a Session Reset on Conversation A's own session leaves
 * Conversation B's own session completely unaffected, restart survives,
 * and Device revocation (Device-pair-scoped, by design — see
 * `FedosDirectRatchetInboundIntegration.applyDeviceRevocationToSessions()`'s
 * own header) correctly stops BOTH Conversations sharing that Device pair
 * — never silently narrower or wider than the Device pair itself.
 *
 * Skips itself with a clear message if the real
 * `packages/fedos-core-rust/pkg/` is absent (gitignored).
 */
import { describe, it, expect } from "vitest";
import { existsSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { createFedosConversationRuntime, type FedosConversationRuntime } from "../src/os/messenger/conversations/runtime/fedos_conversation_runtime.js";
import { assembleFedosConversationProductionCryptoGraph } from "../src/os/messenger/conversations/encryption/production/fedos_conversation_production_crypto_authority_factory.js";
import { FileFedosSealedMasterSeedEnvelopePersistence } from "../src/os/core/vault/wasm/fedos_sealed_master_seed_envelope_persistence.js";
import { FedosFixedPassphraseProvider } from "../src/os/core/vault/wasm/fedos_passphrase_provider.js";
import { FedosWasmMasterSeedAuthority } from "../src/os/core/vault/wasm/fedos_wasm_master_seed_authority.js";
import { FedosWasmNostrSigningAuthority } from "../src/os/messenger/adapters/nostr/protocol/sign/fedos_wasm_nostr_signing_authority.js";
import { FedosWasmLoaderSkeleton } from "../src/runtime/fedos_wasm_loader.js";

import { AppendOnlyFedosConversationDraftPersistence } from "../src/os/messenger/conversations/construction/append_only_fedos_conversation_draft_persistence.js";
import { PersistedFedosConversationMembershipAuthority } from "../src/os/messenger/conversations/membership/persistence/persisted_fedos_conversation_membership_authority.js";
import { AppendOnlyFedosConversationMembershipPersistence } from "../src/os/messenger/conversations/membership/persistence/append_only_fedos_conversation_membership_persistence.js";
import { AppendOnlyFedosConversationActivationPersistence } from "../src/os/messenger/conversations/activation/append_only_fedos_conversation_activation_persistence.js";
import { AppendOnlyFedosConversationMessageEnvelopePersistence } from "../src/os/messenger/conversations/envelope/persistence/append_only_fedos_conversation_message_envelope_persistence.js";
import { AppendOnlyFedosConversationPayloadStorage } from "../src/os/messenger/conversations/payload_storage/append_only_fedos_conversation_payload_storage.js";
import { AppendOnlyFedosConversationEncryptionCoordinationPersistence } from "../src/os/messenger/conversations/encryption/coordination/append_only_fedos_conversation_encryption_coordination_persistence.js";
import { AppendOnlyFedosConversationConstructionCoordinationPersistence } from "../src/os/messenger/conversations/construction/coordination/append_only_fedos_conversation_construction_coordination_persistence.js";
import { PersistedFedosConversationCapabilityAuthority } from "../src/os/messenger/conversations/capability/persistence/persisted_fedos_conversation_capability_authority.js";
import { AppendOnlyFedosConversationCapabilityPersistence } from "../src/os/messenger/conversations/capability/persistence/append_only_fedos_conversation_capability_persistence.js";
import {
  FedosSecureRandomCapabilityIdGenerator,
  FedosSecureRandomCapabilitySecretGenerator,
} from "../src/os/messenger/conversations/runtime/fedos_conversation_capability_generators.js";
import { InMemoryFedosPayloadRetentionPersistence } from "../src/os/messenger/conversations/retention/in_memory_fedos_payload_retention_persistence.js";
import { FedosSecureRandomConstructionIdGenerator } from "../src/os/messenger/conversations/construction/fedos_private_conversation_construction_coordinator.js";
import { UnavailableFedosConversationEncryptionReadinessAuthority } from "../src/os/messenger/conversations/readiness/fedos_conversation_encryption_readiness_authority.js";
import { InMemoryFedosConversationInvitationRevocationRegistry } from "../src/os/messenger/conversations/invitation/in_memory_fedos_conversation_invitation_revocation_registry.js";
import type { FedosConversationCapabilityDescriptor } from "../src/os/messenger/conversations/capability/fedos_conversation_capability_descriptor.js";
import { toFedosConversationInvitationToken } from "../src/os/messenger/conversations/invitation/fedos_conversation_invitation_token.js";
import type { FedosConversationParticipantReference } from "../src/os/messenger/conversations/membership/fedos_conversation_participant_reference.js";
import type { FedosConversationId } from "../src/os/messenger/conversations/fedos_conversation_id.js";

import { NostrNip17V1WireAdapter } from "../src/os/messenger/adapters/nostr/conversation_delivery/nip17/fedos_nostr_nip17_v1_wire_adapter.js";
import { FedosWasmEphemeralGiftWrapSigningAuthority } from "../src/os/messenger/adapters/nostr/conversation_delivery/nip17/fedos_wasm_ephemeral_gift_wrap_signing_authority.js";
import { FedosPrivateTransport } from "../src/os/messenger/adapters/nostr/transport/fedos_private_transport.js";
import { FedosConversationRelaySet } from "../src/os/messenger/adapters/nostr/transport/relay/fedos_conversation_relay_set.js";
import { InMemoryFedosConversationTransportOutboxPersistence } from "../src/os/messenger/adapters/nostr/transport/in_memory_fedos_conversation_transport_outbox_persistence.js";
import { FedosDeliveryObservationRepository } from "../src/os/messenger/board/observation/fedos_delivery_observation_repository.js";
import { InMemoryFedosDeliveryObservationPersistence } from "../src/os/messenger/board/observation/in_memory_fedos_delivery_observation_persistence.js";

import { AppendOnlyFedosDeviceRegistryPersistence } from "../src/os/messenger/device/persistence/append_only_fedos_device_registry_persistence.js";
import { AppendOnlyFedosDirectRatchetSessionPersistence } from "../src/os/messenger/conversations/ratchet/persistence/append_only_fedos_direct_ratchet_session_persistence.js";
import { AppendOnlyFedosSealedDirectRatchetSecretPersistence } from "../src/os/messenger/conversations/ratchet/persistence/append_only_fedos_sealed_direct_ratchet_secret_persistence.js";
import { FileFedosDirectRatchetRemotePublicKeyPersistence } from "../src/os/messenger/conversations/ratchet/persistence/fedos_direct_ratchet_remote_public_key_persistence.js";
import { FileFedosDirectRatchetLiveStateSnapshotPersistence } from "../src/os/messenger/conversations/ratchet/persistence/fedos_direct_ratchet_live_state_snapshot_persistence.js";
import { AppendOnlyFedosDirectRatchetSessionResetRecordPersistence } from "../src/os/messenger/conversations/ratchet/persistence/append_only_fedos_direct_ratchet_session_reset_record_persistence.js";

import type { FedosRelay } from "../src/os/messenger/desktop/fedos_relay.js";
import type { FedosEventDescriptor } from "../src/os/messenger/desktop/fedos_event_descriptor.js";
import type { FedosRelayMessageListener, FedosSubscriptionListener } from "../src/os/messenger/desktop/fedos_relay_listeners.js";
import type { FedosSubscription } from "../src/os/messenger/desktop/fedos_subscription.js";
import type { FedosNostrWireEvent } from "../src/os/messenger/desktop/fedos_nostr_wire_event.js";

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

const NOW = 1_720_100_000;
let ticker = NOW;
const clock = () => ticker++;

interface RatchetParticipantPaths {
  readonly deviceRegistryLog: string;
  readonly sessionLog: string;
  readonly sealedSecretLog: string;
  readonly remotePublicKeyLog: string;
  readonly liveStateSnapshotLog: string;
  readonly resetRecordLog: string;
}

function makeRatchetPaths(rootDir: string, label: string): RatchetParticipantPaths {
  const dir = mkdtempSync(join(rootDir, `ratchet-${label}-`));
  return {
    deviceRegistryLog: join(dir, "device-registry.log"),
    sessionLog: join(dir, "session.log"),
    sealedSecretLog: join(dir, "sealed-secret.log"),
    remotePublicKeyLog: join(dir, "remote-public-key.log"),
    liveStateSnapshotLog: join(dir, "live-state-snapshot.log"),
    resetRecordLog: join(dir, "reset-record.log"),
  };
}

function seedTrustedDevices(registryLogPath: string, devices: ReadonlyArray<readonly [string, string, string]>): void {
  const registry = new AppendOnlyFedosDeviceRegistryPersistence(registryLogPath);
  for (const [deviceId, authority, publicIdentifier] of devices) {
    registry.putEvent({
      schemaVersion: 1,
      eventType: "registered",
      deviceId,
      accountAuthority: authority,
      accountPublicIdentifier: publicIdentifier,
      accountIdentityId: null,
      devicePublicKeyRef: null,
      label: null,
      initialTrustState: "pending",
      registeredAt: NOW,
    });
    registry.putEvent({ schemaVersion: 1, eventType: "trusted", deviceId, trustedAt: NOW });
  }
}

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

suite("Alpha 7401-7480 -- real Ratchet-route same-peer two-Conversation isolation (Phase J/K)", () => {
  it("two independent Direct Conversations with the SAME peer, over the SAME Device pair, each establish and route their OWN Ratchet session correctly -- Session Reset on one never touches the other, restart survives, Device revocation stops both", async () => {
    await withDevelopmentNodeEnv(async () => {
      const root = mkdtempSync(join(tmpdir(), "fedos-7401-ratchet-isolation-"));
      const seedDir = mkdtempSync(join(root, "seeds-"));
      const backendDir = mkdtempSync(join(root, "backends-"));
      const shared = buildSharedBackends(backendDir);
      const loader = await primedLoader();

      const aliceDeviceRef = "alice-desktop";
      const bobDeviceRef = "bob-desktop";
      const alicePaths = makeRatchetPaths(root, "alice");
      const bobPaths = makeRatchetPaths(root, "bob");

      const alicePart = await buildRealParticipant(seedDir, "alice.seed", "alice-pass-7401", mkdtempSync(join(root, "alice-conv-")), loader);
      const bobPart = await buildRealParticipant(seedDir, "bob.seed", "bob-pass-7401", mkdtempSync(join(root, "bob-conv-")), loader);

      seedTrustedDevices(alicePaths.deviceRegistryLog, [
        [aliceDeviceRef, alicePart.participant.authority, alicePart.participant.publicIdentifier],
        [bobDeviceRef, bobPart.participant.authority, bobPart.participant.publicIdentifier],
      ]);
      seedTrustedDevices(bobPaths.deviceRegistryLog, [
        [bobDeviceRef, bobPart.participant.authority, bobPart.participant.publicIdentifier],
        [aliceDeviceRef, alicePart.participant.authority, alicePart.participant.publicIdentifier],
      ]);

      let aliceTransport: FedosPrivateTransport;
      let bobTransport: FedosPrivateTransport;

      function buildAliceRuntime(): FedosConversationRuntime {
        return createFedosConversationRuntime({
          draftPersistence: shared.draftPersistence,
          membershipAuthority: shared.membershipAuthority,
          capabilityIssuerAuthority: shared.capabilityAuthority,
          capabilityRedemptionAuthority: shared.capabilityAuthority,
          invitationRevocationRegistry: shared.invitationRevocationRegistry,
          invitationRevocationAuthorizationCheck: (descriptor, revoker) =>
            invitationRevocationAuthorizationCheck(descriptor, revoker, shared.membershipAuthority),
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
          directRatchet: {
            deviceRegistry: new AppendOnlyFedosDeviceRegistryPersistence(alicePaths.deviceRegistryLog),
            sessionPersistence: new AppendOnlyFedosDirectRatchetSessionPersistence(alicePaths.sessionLog),
            sealedSecretPersistence: new AppendOnlyFedosSealedDirectRatchetSecretPersistence(alicePaths.sealedSecretLog),
            remotePublicKeyPersistence: new FileFedosDirectRatchetRemotePublicKeyPersistence(alicePaths.remotePublicKeyLog),
            snapshotPersistence: new FileFedosDirectRatchetLiveStateSnapshotPersistence(alicePaths.liveStateSnapshotLog),
            resetRecordPersistence: new AppendOnlyFedosDirectRatchetSessionResetRecordPersistence(alicePaths.resetRecordLog),
            sealingAuthority: alicePart.masterSeedAuthority,
            masterSeedAuthority: alicePart.masterSeedAuthority,
            localDeviceRef: aliceDeviceRef,
            sendMailboxNip17Control: (controlId, conversationId, plaintext, createdAt) =>
              aliceTransport.sendMailboxNip17Control(controlId, conversationId, plaintext, createdAt),
            messageDelivery: {
              remoteDeviceRef: bobDeviceRef,
              sendMailboxNip17: (envelopeId, conversationId, plaintext) => aliceTransport.sendMailboxNip17(envelopeId, conversationId, plaintext),
            },
          },
        });
      }

      function buildBobRuntime(): FedosConversationRuntime {
        return createFedosConversationRuntime({
          draftPersistence: shared.draftPersistence,
          membershipAuthority: shared.membershipAuthority,
          capabilityIssuerAuthority: shared.capabilityAuthority,
          capabilityRedemptionAuthority: shared.capabilityAuthority,
          invitationRevocationRegistry: shared.invitationRevocationRegistry,
          invitationRevocationAuthorizationCheck: (descriptor, revoker) =>
            invitationRevocationAuthorizationCheck(descriptor, revoker, shared.membershipAuthority),
          coordinationPersistence: shared.coordinationPersistence,
          activationPersistence: shared.activationPersistence,
          envelopePersistence: bobPart.envelopePersistence,
          payloadStorage: bobPart.payloadStorage,
          retentionPersistence: new InMemoryFedosPayloadRetentionPersistence(),
          encryptionCoordinationPersistence: new AppendOnlyFedosConversationEncryptionCoordinationPersistence(join(seedDir, "bob.enc-coord.log")),
          creatorIdentityAuthority: bobPart.graph.creatorIdentityAuthority,
          encryptionAuthority: bobPart.graph.encryptionAuthority,
          decryptionAuthority: bobPart.graph.decryptionAuthority,
          accountIndexAuthority: bobPart.graph.accountIndexAuthority,
          nostrAuthorBindingAuthority: bobPart.graph.nostrAuthorBindingAuthority,
          encryptionReadinessAuthority: new UnavailableFedosConversationEncryptionReadinessAuthority(),
          idGenerator: new FedosSecureRandomConstructionIdGenerator(),
          clock,
          directRatchet: {
            deviceRegistry: new AppendOnlyFedosDeviceRegistryPersistence(bobPaths.deviceRegistryLog),
            sessionPersistence: new AppendOnlyFedosDirectRatchetSessionPersistence(bobPaths.sessionLog),
            sealedSecretPersistence: new AppendOnlyFedosSealedDirectRatchetSecretPersistence(bobPaths.sealedSecretLog),
            remotePublicKeyPersistence: new FileFedosDirectRatchetRemotePublicKeyPersistence(bobPaths.remotePublicKeyLog),
            snapshotPersistence: new FileFedosDirectRatchetLiveStateSnapshotPersistence(bobPaths.liveStateSnapshotLog),
            resetRecordPersistence: new AppendOnlyFedosDirectRatchetSessionResetRecordPersistence(bobPaths.resetRecordLog),
            sealingAuthority: bobPart.masterSeedAuthority,
            masterSeedAuthority: bobPart.masterSeedAuthority,
            localDeviceRef: bobDeviceRef,
            sendMailboxNip17Control: (controlId, conversationId, plaintext, createdAt) =>
              bobTransport.sendMailboxNip17Control(controlId, conversationId, plaintext, createdAt),
            messageDelivery: {
              remoteDeviceRef: aliceDeviceRef,
              sendMailboxNip17: (envelopeId, conversationId, plaintext) => bobTransport.sendMailboxNip17(envelopeId, conversationId, plaintext),
            },
          },
        });
      }

      let aliceRuntime = buildAliceRuntime();
      let bobRuntime = buildBobRuntime();

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
          membershipsForConversation: (id) => aliceRuntime.listMemberships(id),
          outboxPersistence: new InMemoryFedosConversationTransportOutboxPersistence(),
          observationRepository: new FedosDeliveryObservationRepository(new InMemoryFedosDeliveryObservationPersistence()),
          intervalMs: 1000,
          wireAdapter: alicePart.adapter,
          inbound: {
            filter: { kinds: [1059] },
            onEnvelope: () => undefined,
            onRumor: (rumor, relaySource) => {
              void aliceRuntime.receiveNip17Rumor(rumor, relaySource);
            },
          },
        });
        bobTransport = new FedosPrivateTransport({
          relaySet: new FedosConversationRelaySet([bobConn]),
          signingAuthority: new FedosWasmNostrSigningAuthority(bobPart.masterSeedAuthority, loader),
          localAccountIndex: 0,
          envelopePersistence: bobPart.envelopePersistence,
          payloadStorage: bobPart.payloadStorage,
          membershipsForConversation: (id) => bobRuntime.listMemberships(id),
          outboxPersistence: new InMemoryFedosConversationTransportOutboxPersistence(),
          observationRepository: new FedosDeliveryObservationRepository(new InMemoryFedosDeliveryObservationPersistence()),
          intervalMs: 1000,
          wireAdapter: bobPart.adapter,
          inbound: {
            filter: { kinds: [1059] },
            onEnvelope: () => undefined,
            onRumor: (rumor, relaySource) => {
              void bobRuntime.receiveNip17Rumor(rumor, relaySource);
            },
          },
        });
      }
      wireTransports();

      await aliceTransport!.start();
      await bobTransport!.start();
      try {
        async function createAndActivate(): Promise<string> {
          const created = aliceRuntime.createDirectDraft({ recipient: bobPart.participant });
          expect(created.outcome).toBe("draft-created");
          if (created.outcome !== "draft-created") throw new Error("unreachable");
          const conversationId = created.draft.id;
          const token = toFedosConversationInvitationToken(created.capability!.descriptor.capabilityId, created.capability!.bearerSecret);
          expect(bobRuntime.redeemInvitation(token, bobPart.participant).outcome).toBe("redeemed");
          expect(await aliceRuntime.activateDirectConversation(conversationId)).toEqual({ outcome: "activated" });
          expect(await bobRuntime.activateDirectConversation(conversationId)).toEqual({ outcome: "already-active" });
          return conversationId;
        }

        // --- Two independent real Direct Conversations with the SAME peer, over the SAME Device pair ---
        const conversationA = await createAndActivate();
        const conversationB = await createAndActivate();
        expect(conversationA).not.toBe(conversationB);

        // --- BOTH session-inits succeed -- BEFORE this Arc's fix, the SECOND would deterministically fail "wrong-conversation" ---
        const establishA = await bobRuntime.directRatchet()!.initializeDirectRatchetSession(conversationA, aliceDeviceRef);
        expect(establishA.outcome).toBe("initiated");
        await bobTransport!.tick();
        await new Promise((resolve) => setTimeout(resolve, 20));
        expect(aliceRuntime.directRatchet()!.getDirectRatchetStatus(conversationA, bobDeviceRef)).toBe("active");
        expect(bobRuntime.directRatchet()!.getDirectRatchetStatus(conversationA, aliceDeviceRef)).toBe("active");

        const establishB = await bobRuntime.directRatchet()!.initializeDirectRatchetSession(conversationB, aliceDeviceRef);
        expect(establishB.outcome, "FIXED: the SECOND session-init with the same peer now succeeds instead of deterministically failing wrong-conversation").toBe("initiated");
        await bobTransport!.tick();
        await new Promise((resolve) => setTimeout(resolve, 20));
        expect(aliceRuntime.directRatchet()!.getDirectRatchetStatus(conversationB, bobDeviceRef)).toBe("active");
        expect(bobRuntime.directRatchet()!.getDirectRatchetStatus(conversationB, aliceDeviceRef)).toBe("active");
        // Conversation A's own session remains active and untouched by B's establishment.
        expect(aliceRuntime.directRatchet()!.getDirectRatchetStatus(conversationA, bobDeviceRef)).toBe("active");

        // --- A-message-1: only A receives it ---
        const toA = await aliceRuntime.sendDirectMessage({ conversationId: conversationA, body: "message-for-A-only", replyToEnvelopeId: null });
        expect(toA.outcome).toBe("sent-locally");
        await aliceTransport!.tick();
        await new Promise((resolve) => setTimeout(resolve, 20));
        const bobListA = bobRuntime.listDirectMessages(conversationA);
        expect(bobListA).toHaveLength(1);
        const bobReadA = await bobRuntime.readDirectMessage({ conversationId: conversationA, envelopeId: bobListA[0]!.envelopeId });
        expect(bobReadA).toEqual({ outcome: "decrypted", plaintext: new TextEncoder().encode("message-for-A-only") });
        expect(bobRuntime.listDirectMessages(conversationB), "conversation B must remain empty after an A-only message").toHaveLength(0);

        // --- B-message-1: only B receives it ---
        const toB = await aliceRuntime.sendDirectMessage({ conversationId: conversationB, body: "message-for-B-only", replyToEnvelopeId: null });
        expect(toB.outcome).toBe("sent-locally");
        await aliceTransport!.tick();
        await new Promise((resolve) => setTimeout(resolve, 20));
        const bobListB = bobRuntime.listDirectMessages(conversationB);
        expect(bobListB).toHaveLength(1);
        const bobReadB = await bobRuntime.readDirectMessage({ conversationId: conversationB, envelopeId: bobListB[0]!.envelopeId });
        expect(bobReadB).toEqual({ outcome: "decrypted", plaintext: new TextEncoder().encode("message-for-B-only") });
        expect(bobRuntime.listDirectMessages(conversationA), "conversation A must still have exactly 1 message after a B-only message").toHaveLength(1);

        // --- Interleaved sends both directions ---
        const replyFromBobA = await bobRuntime.sendDirectMessage({ conversationId: conversationA, body: "reply-in-A", replyToEnvelopeId: null });
        expect(replyFromBobA.outcome).toBe("sent-locally");
        const replyFromBobB = await bobRuntime.sendDirectMessage({ conversationId: conversationB, body: "reply-in-B", replyToEnvelopeId: null });
        expect(replyFromBobB.outcome).toBe("sent-locally");
        await bobTransport!.tick();
        await new Promise((resolve) => setTimeout(resolve, 20));
        expect(aliceRuntime.listDirectMessages(conversationA)).toHaveLength(2);
        expect(aliceRuntime.listDirectMessages(conversationB)).toHaveLength(2);

        // --- Session Reset on Conversation A's session ONLY -- B must be completely unaffected ---
        const resetA = await aliceRuntime.directRatchet()!.resetDirectRatchetSession(conversationA, bobDeviceRef);
        expect(resetA.outcome).toBe("reset");
        expect(aliceRuntime.directRatchet()!.getDirectRatchetStatus(conversationA, bobDeviceRef)).toBe("reset-required");
        expect(
          aliceRuntime.directRatchet()!.getDirectRatchetStatus(conversationB, bobDeviceRef),
          "Session Reset scoped to Conversation A's own session must never affect Conversation B's own session",
        ).toBe("active");
        const reestablishA = await aliceRuntime.directRatchet()!.initializeDirectRatchetSession(conversationA, bobDeviceRef, { reason: "suspected-compromise" });
        expect(reestablishA.outcome).toBe("initiated");
        await aliceTransport!.tick();
        await new Promise((resolve) => setTimeout(resolve, 20));
        expect(bobRuntime.directRatchet()!.getDirectRatchetStatus(conversationA, aliceDeviceRef)).toBe("active");
        // A real message on A's NEW generation still works (Bob sends first,
        // mirroring the established, proven-working direction from
        // `fedos_ratchet_device_lifecycle_session_reset_real_vertical_slice.test.ts`'s
        // own generation-0-to-1 reset proof); B's own generation-0 session
        // is untouched throughout.
        const postResetA = await bobRuntime.sendDirectMessage({ conversationId: conversationA, body: "post-reset-in-A", replyToEnvelopeId: null });
        expect(postResetA.outcome).toBe("sent-locally");
        await bobTransport!.tick();
        await new Promise((resolve) => setTimeout(resolve, 20));
        expect(aliceRuntime.listDirectMessages(conversationA)).toHaveLength(3);
        expect(aliceRuntime.listDirectMessages(conversationB), "Conversation B must remain at its own prior message count, untouched by A's reset+resend").toHaveLength(2);
        expect(aliceRuntime.directRatchet()!.getDirectRatchetStatus(conversationB, bobDeviceRef)).toBe("active");

        // Direct Ratchet Live-State Durability arc -- BEFORE restart, both
        // Conversations' sessions are genuinely live in this process (real
        // messages were just sent/received on both above).
        expect(aliceRuntime.directRatchet()!.getDirectRatchetLiveVerification(conversationA, bobDeviceRef)).toBe("live-confirmed-this-process");
        expect(aliceRuntime.directRatchet()!.getDirectRatchetLiveVerification(conversationB, bobDeviceRef)).toBe("live-confirmed-this-process");

        // --- Restart both sides: both Conversations' Ratchet sessions survive independently ---
        await aliceTransport!.stop();
        await bobTransport!.stop();
        aliceRuntime = buildAliceRuntime();
        bobRuntime = buildBobRuntime();
        aliceConn = new LiveRelayConnection(relayServer, "wss://fake-relay.test");
        bobConn = new LiveRelayConnection(relayServer, "wss://fake-relay.test");
        wireTransports();
        await aliceTransport!.start();
        await bobTransport!.start();

        expect(aliceRuntime.directRatchet()!.getDirectRatchetStatus(conversationA, bobDeviceRef)).toBe("active");
        expect(aliceRuntime.directRatchet()!.getDirectRatchetStatus(conversationB, bobDeviceRef)).toBe("active");
        // THE CORE FIX THIS ARC EXISTS FOR: immediately after a fresh
        // process restart, and BEFORE any real restore has been attempted,
        // `lifecycleState === "active"` metadata alone (just asserted
        // above via `getDirectRatchetStatus`) must NEVER read as a
        // confirmed live session -- that is exactly the post-restart
        // Forward-Secrecy false-green this whole arc closes. A fresh,
        // never-stale durable snapshot genuinely exists from the pre-
        // restart checkpoints above, so the honest reading is
        // "restorable-not-yet-confirmed", never "live-confirmed-this-process".
        expect(
          aliceRuntime.directRatchet()!.getDirectRatchetLiveVerification(conversationA, bobDeviceRef),
          "restart must never silently present stale-restart-surviving metadata as a confirmed live session",
        ).toBe("restorable-not-yet-confirmed");
        expect(aliceRuntime.directRatchet()!.getDirectRatchetLiveVerification(conversationB, bobDeviceRef)).toBe("restorable-not-yet-confirmed");

        const postRestartA = await aliceRuntime.sendDirectMessage({ conversationId: conversationA, body: "post-restart-in-A", replyToEnvelopeId: null });
        expect(postRestartA.outcome).toBe("sent-locally");
        // A genuine restore was just attempted (and succeeded) as part of
        // that send -- NOW, and only now, live verification may honestly
        // read confirmed for Conversation A. Conversation B's own session
        // is untouched so far and must still read as merely restorable.
        expect(aliceRuntime.directRatchet()!.getDirectRatchetLiveVerification(conversationA, bobDeviceRef)).toBe("live-confirmed-this-process");
        expect(aliceRuntime.directRatchet()!.getDirectRatchetLiveVerification(conversationB, bobDeviceRef)).toBe("restorable-not-yet-confirmed");

        const postRestartB = await aliceRuntime.sendDirectMessage({ conversationId: conversationB, body: "post-restart-in-B", replyToEnvelopeId: null });
        expect(postRestartB.outcome).toBe("sent-locally");
        expect(aliceRuntime.directRatchet()!.getDirectRatchetLiveVerification(conversationB, bobDeviceRef)).toBe("live-confirmed-this-process");
        await aliceTransport!.tick();
        await new Promise((resolve) => setTimeout(resolve, 20));
        expect(bobRuntime.listDirectMessages(conversationA)).toHaveLength(4);
        expect(bobRuntime.listDirectMessages(conversationB)).toHaveLength(3);

        // --- Device revocation: Device-pair-scoped, by design -- stops BOTH Conversations sharing that Device pair, never silently narrower/wider ---
        const revoked = aliceRuntime.directRatchet()!.applyDeviceRevocationToSessions(bobDeviceRef);
        expect(revoked.length, "revocation must transition every session for the revoked Device -- both Conversation A's and Conversation B's").toBeGreaterThanOrEqual(2);
        expect(aliceRuntime.directRatchet()!.getDirectRatchetStatus(conversationA, bobDeviceRef)).toBe("revoked");
        expect(aliceRuntime.directRatchet()!.getDirectRatchetStatus(conversationB, bobDeviceRef)).toBe("revoked");
      } finally {
        await aliceTransport!.stop().catch(() => undefined);
        await bobTransport!.stop().catch(() => undefined);
      }
    });
  });
});
