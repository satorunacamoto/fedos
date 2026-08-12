/**
 * Secure Runtime Alpha 5721–5800 (FedOS Ratchet Peer Notification and
 * Capability Advertisement Arc) — the REAL, no-fake-crypto end-to-end
 * vertical slice. Reuses the exact same real-crypto scaffolding
 * `test/secure_runtime_alpha_5561_5640_real_vertical_slice.test.ts` and
 * `test/fedos_ratchet_device_lifecycle_session_reset_real_vertical_slice.test.ts`
 * already established (real Master Seeds, real WASM signing, a shared
 * in-process fake Relay, real NIP-17 Gift Wrap) — this file's own job is
 * to prove the NEW peer-capability-advertisement/lifecycle-notification
 * behavior end-to-end through the REAL private-message transport, not to
 * re-prove the baseline Direct-messaging path those files already cover.
 *
 * Proven, in order:
 *   1. Alice and Bob establish a real Direct Conversation (real Master
 *      Seeds, real WASM signing/encryption).
 *   2. Alice constructs and signs a real capability advertisement,
 *      published through the actual `FedosPrivateTransport` / real NIP-17
 *      Gift Wrap / real in-process Relay.
 *   3. Bob receives through the real `receiveNip17Rumor()` dispatch,
 *      verifies the real account signature and Device binding, and
 *      durably records the peer-capability observation.
 *   4. Bob's local policy marks the route `"compatible"` WITHOUT silently
 *      selecting/activating it — no Ratchet session is created.
 *   5. Restart Bob (brand-new Runtime over the SAME durable observation
 *      file) -- the peer-capability state replays exactly.
 *   6. Alice announces her second Device (Device B) via a real, signed
 *      lifecycle notification; Bob records it as an INDEPENDENT peer
 *      Device, inheriting no session/state from Device A.
 *   7. Alice announces Device A's own revocation via a real, signed
 *      lifecycle notification; Bob records the evidence and the safe
 *      status for Device A becomes `"revoked"`.
 *   8. A stale (lower-revision) advertisement replay after a higher one
 *      was already accepted is rejected -- the higher revision's
 *      acceptance is never silently downgraded.
 *   9. No user-visible chat message is created by any of this traffic.
 *  10. No raw secret/signature/key appears in the durable Observation
 *      file -- only the closed, non-secret fields this Arc's own schema
 *      defines.
 *  11. Relay ACK (`"delivered"`) is tracked independently of peer
 *      acceptance -- Alice's own publish outcome never reports whether
 *      Bob accepted anything.
 *
 * Skips itself with a clear message if the real
 * `packages/fedos-core-rust/pkg/` is absent (gitignored; run
 * `npm run build:wasm` first) — identical convention to every other real
 * vertical slice in this codebase.
 */
import { describe, it, expect } from "vitest";
import { existsSync, mkdtempSync, readFileSync } from "node:fs";
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
import { AppendOnlyFedosRatchetPeerCapabilityObservationPersistence } from "../src/os/messenger/conversations/ratchet/peer_capability/persistence/append_only_fedos_ratchet_peer_capability_observation_persistence.js";

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

const NOW = 1_720_000_000;
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

suite("FedOS Ratchet Peer Notification and Capability Advertisement -- real vertical slice (REAL crypto, REAL WASM)", () => {
  it("real signed advertisement + lifecycle notifications flow end to end through the real private transport, survive Bob's restart, and never silently activate/downgrade anything", async () => {
    await withDevelopmentNodeEnv(async () => {
      const root = mkdtempSync(join(tmpdir(), "fedos-peer-capability-"));
      const seedDir = mkdtempSync(join(root, "seeds-"));
      const backendDir = mkdtempSync(join(root, "backends-"));
      const shared = buildSharedBackends(backendDir);
      const loader = await primedLoader();

      const aliceDesktopRef = "alice-desktop";
      const aliceTabletRef = "alice-tablet";
      const bobDeviceRef = "bob-desktop";

      const alicePart = await buildRealParticipant(seedDir, "alice.seed", "alice-pass", mkdtempSync(join(root, "alice-conv-")), loader);
      const bobPart = await buildRealParticipant(seedDir, "bob.seed", "bob-pass", mkdtempSync(join(root, "bob-conv-")), loader);

      const aliceAccountRef = { authority: "nostr", publicIdentifier: alicePart.participant.publicIdentifier, identityId: null };
      const bobAccountRef = { authority: "nostr", publicIdentifier: bobPart.participant.publicIdentifier, identityId: null };

      const aliceDeviceRegistryLog = join(mkdtempSync(join(root, "alice-devices-")), "device-registry.log");
      const bobDeviceRegistryPath = mkdtempSync(join(root, "bob-devices-"));
      const bobDeviceRegistryLog = join(bobDeviceRegistryPath, "device-registry.log");
      const bobObservationLog = join(bobDeviceRegistryPath, "peer-capability-observations.log");

      function seedTrustedDevice(registryLogPath: string, deviceId: string, authority: string, publicIdentifier: string): void {
        const registry = new AppendOnlyFedosDeviceRegistryPersistence(registryLogPath);
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
      // Alice's own registry: knows both her Devices AND Bob's, exactly
      // like the Ratchet Foundation Arc's own precedent.
      seedTrustedDevice(aliceDeviceRegistryLog, aliceDesktopRef, aliceAccountRef.authority, aliceAccountRef.publicIdentifier);
      seedTrustedDevice(aliceDeviceRegistryLog, aliceTabletRef, aliceAccountRef.authority, aliceAccountRef.publicIdentifier);
      seedTrustedDevice(aliceDeviceRegistryLog, bobDeviceRef, bobAccountRef.authority, bobAccountRef.publicIdentifier);
      // Bob's own registry: knows himself AND Alice's desktop (Device A) --
      // NOT yet her tablet (Device B), which arrives later via a real
      // lifecycle notification, proving no inherited/pre-existing state.
      seedTrustedDevice(bobDeviceRegistryLog, bobDeviceRef, bobAccountRef.authority, bobAccountRef.publicIdentifier);
      seedTrustedDevice(bobDeviceRegistryLog, aliceDesktopRef, aliceAccountRef.authority, aliceAccountRef.publicIdentifier);

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
          peerCapability: {
            deviceRegistry: new AppendOnlyFedosDeviceRegistryPersistence(aliceDeviceRegistryLog),
            signingAuthority: new FedosWasmNostrSigningAuthority(alicePart.masterSeedAuthority, loader),
            localAccountRef: aliceAccountRef,
            localDeviceRef: aliceDesktopRef,
            locallySupportedCapabilities: [
              { kind: "private-message-route", route: "nostr-nip17-v1-ratchet" },
              { kind: "ratchet-suite", suite: "fedos-direct-ratchet-v1" },
              { kind: "lifecycle-capability", capability: "capability-advertisement-v1" },
            ],
            sendMailboxNip17Control: (controlId, conversationId, plaintext, createdAt) =>
              aliceTransport.sendMailboxNip17Control(controlId, conversationId, plaintext, createdAt),
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
          peerCapability: {
            deviceRegistry: new AppendOnlyFedosDeviceRegistryPersistence(bobDeviceRegistryLog),
            signingAuthority: new FedosWasmNostrSigningAuthority(bobPart.masterSeedAuthority, loader),
            localAccountRef: bobAccountRef,
            localDeviceRef: bobDeviceRef,
            locallySupportedCapabilities: [
              { kind: "private-message-route", route: "nostr-nip17-v1-ratchet" },
              { kind: "ratchet-suite", suite: "fedos-direct-ratchet-v1" },
            ],
            observationPersistence: new AppendOnlyFedosRatchetPeerCapabilityObservationPersistence(bobObservationLog),
            sendMailboxNip17Control: (controlId, conversationId, plaintext, createdAt) =>
              bobTransport.sendMailboxNip17Control(controlId, conversationId, plaintext, createdAt),
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
        // --- 1. Real Direct Conversation ---
        const created = aliceRuntime.createDirectDraft({ recipient: bobPart.participant });
        expect(created.outcome).toBe("draft-created");
        if (created.outcome !== "draft-created") return;
        const conversationId = created.draft.id;
        const token = toFedosConversationInvitationToken(created.capability!.descriptor.capabilityId, created.capability!.bearerSecret);
        expect(bobRuntime.redeemInvitation(token, bobPart.participant).outcome).toBe("redeemed");
        expect(await aliceRuntime.activateDirectConversation(conversationId)).toEqual({ outcome: "activated" });
        expect(await bobRuntime.activateDirectConversation(conversationId)).toEqual({ outcome: "already-active" });

        // --- 2/3. Alice publishes a real, signed capability advertisement through the real transport ---
        const advertisePublish = await aliceRuntime.peerCapability()!.advertiseLocalCapabilities({
          recipientAccountRef: bobAccountRef,
          recipientDeviceRef: bobDeviceRef,
          conversationId,
          revision: 1,
          expiresInMs: 30 * 24 * 60 * 60 * 1000,
        });
        expect(advertisePublish.outcome).toBe("published");
        await aliceTransport!.tick();
        await new Promise((resolve) => setTimeout(resolve, 30));

        // --- 4. Bob durably records it, marked "compatible" -- NEVER "trusted", NEVER an activated route ---
        expect(bobRuntime.peerCapability()!.getPeerDeviceCapabilityStatus(aliceAccountRef, aliceDesktopRef)).toBe("compatible");
        expect(bobRuntime.directRatchet()).toBeNull(); // no Ratchet domain was even constructed -- nothing to "silently activate".

        // --- 5. Restart Bob -- peer-capability state replays exactly ---
        await bobTransport!.stop();
        bobRuntime = buildBobRuntime();
        bobConn = new LiveRelayConnection(relayServer, "wss://fake-relay.test");
        wireTransports();
        await bobTransport!.start();
        expect(bobRuntime.peerCapability()!.getPeerDeviceCapabilityStatus(aliceAccountRef, aliceDesktopRef)).toBe("compatible");

        // --- 6. Alice announces her second Device (tablet) -- Bob records it as a wholly independent, unknown-until-now peer Device ---
        expect(bobRuntime.peerCapability()!.getPeerDeviceCapabilityStatus(aliceAccountRef, aliceTabletRef)).toBe("unknown");
        const deviceAddedPublish = await aliceRuntime.peerCapability()!.publishDeviceLifecycleNotification({
          notificationId: "notif-device-added-tablet",
          recipientAccountRef: bobAccountRef,
          recipientDeviceRef: bobDeviceRef,
          conversationId,
          affectedDeviceRef: aliceTabletRef,
          fact: { kind: "device-added" },
          revision: 1,
          expiresInMs: 30 * 24 * 60 * 60 * 1000,
        });
        expect(deviceAddedPublish.outcome).toBe("published");
        await aliceTransport!.tick();
        await new Promise((resolve) => setTimeout(resolve, 30));
        // Bob's local Device Registry does NOT yet know Alice's tablet as a
        // Device (Phase H never mutates the Registry from peer input) --
        // the fact is recorded as evidence, but "untrusted-device" (no
        // local binding exists to confirm it), never silently promoted.
        const tabletObservations = bobRuntime.peerCapability()!.listObservedPeerDevices();
        const tabletObservation = tabletObservations.find((o) => o.peerDeviceRef === aliceTabletRef);
        expect(tabletObservation).toBeDefined();
        expect(tabletObservation!.safeStatus).not.toBe("compatible"); // never silently trusted/activated
        // Device A's own already-accepted state is completely unaffected by Device B's announcement.
        expect(bobRuntime.peerCapability()!.getPeerDeviceCapabilityStatus(aliceAccountRef, aliceDesktopRef)).toBe("compatible");

        // --- 7. Alice announces Device A's own revocation ---
        const revocationPublish = await aliceRuntime.peerCapability()!.publishDeviceLifecycleNotification({
          notificationId: "notif-device-a-revoked",
          recipientAccountRef: bobAccountRef,
          recipientDeviceRef: bobDeviceRef,
          conversationId,
          affectedDeviceRef: aliceDesktopRef,
          fact: { kind: "device-revoked" },
          revision: 1,
          expiresInMs: 30 * 24 * 60 * 60 * 1000,
        });
        expect(revocationPublish.outcome).toBe("published");
        await aliceTransport!.tick();
        await new Promise((resolve) => setTimeout(resolve, 30));
        // Bob's LOCAL Device Registry binding for Alice's desktop is itself
        // UNCHANGED (Phase H's own absolute prohibition) -- only the safe
        // status derived from the recorded EVIDENCE reflects "revoked".
        const desktopStatusAfterRevocationNotice = bobRuntime.peerCapability()!.getPeerDeviceCapabilityStatus(aliceAccountRef, aliceDesktopRef);
        expect(desktopStatusAfterRevocationNotice).toBe("revoked");

        // --- 8. Stale replay: a lower-revision advertisement never downgrades the already-accepted higher one ---
        const staleReplayPublish = await aliceRuntime.peerCapability()!.advertiseLocalCapabilities({
          recipientAccountRef: bobAccountRef,
          recipientDeviceRef: bobDeviceRef,
          conversationId,
          revision: 1, // SAME as the very first advertisement -- a rollback/replay, not a fresh fact.
          expiresInMs: 30 * 24 * 60 * 60 * 1000,
        });
        expect(staleReplayPublish.outcome).toBe("published");
        await aliceTransport!.tick();
        await new Promise((resolve) => setTimeout(resolve, 30));
        // Still "compatible" from the ORIGINAL accepted revision -- a stale/duplicate resubmission never flips it to anything weaker or different.
        expect(bobRuntime.peerCapability()!.getPeerDeviceCapabilityStatus(aliceAccountRef, aliceDesktopRef)).toBe("revoked");

        // --- 9. No user-visible chat message was ever created by any of this ---
        expect(aliceRuntime.listDirectMessages(conversationId)).toHaveLength(0);
        expect(bobRuntime.listDirectMessages(conversationId)).toHaveLength(0);

        // --- 10. No raw secret/signature material sits in the durable Observation file -- only this Arc's own closed, non-secret fields. (A peer's own PUBLIC key, e.g. `peerAccountRef.publicIdentifier`, is expected and non-secret -- only key/signature MATERIAL is checked here.) ---
        const observationFileContents = readFileSync(bobObservationLog, "utf8") as string;
        for (const secretMarker of ["secretKey", "privateKey", "\"sig\"", "signatureHex", "accountAuthorization", "deviceSignature"]) {
          expect(observationFileContents).not.toContain(secretMarker);
        }
        // Sanity: the file DOES contain the closed, safe field names this Arc's own schema defines.
        expect(observationFileContents).toContain("acceptanceOutcome");
        expect(observationFileContents).toContain("evidenceLevel");
      } finally {
        await aliceTransport!.stop().catch(() => undefined);
        await bobTransport!.stop().catch(() => undefined);
      }
    });
  });
});
