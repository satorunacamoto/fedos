/**
 * Secure Runtime Alpha 5561–5640 (FedOS Direct Double Ratchet Conversation
 * Runtime and NIP-17 Integration Arc) — Phase O: the real, no-fake-crypto
 * end-to-end vertical slice.
 *
 * Two independent real identities (Alice, Bob), each with their own
 * generated Master Seed (`FedosWasmMasterSeedAuthority`, real Rust/WASM
 * bridge), each with their own real `FedosConversationRuntime` (including
 * its new, additive `directRatchet()` facade) and real `FedosPrivateTransport`
 * over a shared in-process fake Relay (mirrors
 * `test/secure_runtime_alpha_1841_1920_nip17_transport_group_integration.test.ts`'s
 * own `FakeRelayServer`/`LiveRelayConnection` pair exactly).
 *
 * Path proven: Direct Conversation plaintext -> explicit ratchet route
 * selection -> Device-pair ratchet session resolution -> real Ratchet
 * Core encrypt -> durable state commit -> real Rumor/Seal/Gift Wrap ->
 * real (fake-server) Relay publish -> inbound Gift Wrap/Seal/Rumor
 * processing -> Device-pair ratchet session resolution -> real Ratchet
 * Core decrypt -> durable state commit -> existing Conversation
 * import/read path -> restart -> continued session.
 *
 * Skips itself with a clear message if the real
 * `packages/fedos-core-rust/pkg/` is absent (gitignored; run
 * `npm run build:wasm` first).
 */
import { describe, it, expect } from "vitest";
// @ts-expect-error `node:fs` has no type declarations without `@types/node` in this project's tsconfig.
import { existsSync, mkdtempSync, readFileSync } from "node:fs";
// @ts-expect-error see above.
import { tmpdir } from "node:os";
// @ts-expect-error see above.
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
  /** A REAL Relay socket close stops delivering further events to it — this fake must too, or a stale pre-restart connection would double-deliver every post-restart event to an already-replaced Runtime instance. */
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
// Monotonically increasing (not a bare fixed constant) so envelopes sent/
// received at different real moments get distinct `createdAt` values —
// `listDirectMessages()`'s own deterministic LOCAL ordering sorts by
// `createdAt` ascending, so a truly-fixed clock would make ordering fall
// back to an unpredictable id tie-break across BOTH participants' own
// sent/received envelopes.
let ticker = NOW;
const clock = () => ticker++;

interface RatchetParticipantPaths {
  readonly deviceRegistryLog: string;
  readonly sessionLog: string;
  readonly sealedSecretLog: string;
  readonly remotePublicKeyLog: string;
  readonly liveStateSnapshotLog: string;
}

function makeRatchetPaths(rootDir: string, label: string): RatchetParticipantPaths {
  const dir = mkdtempSync(join(rootDir, `ratchet-${label}-`));
  return {
    deviceRegistryLog: join(dir, "device-registry.log"),
    sessionLog: join(dir, "session.log"),
    sealedSecretLog: join(dir, "sealed-secret.log"),
    remotePublicKeyLog: join(dir, "remote-public-key.log"),
    liveStateSnapshotLog: join(dir, "live-state-snapshot.log"),
  };
}

function seedTrustedDevicePair(
  registryLogPath: string,
  selfAuthority: string,
  selfPublicIdentifier: string,
  selfDeviceId: string,
  peerAuthority: string,
  peerPublicIdentifier: string,
  peerDeviceId: string,
): void {
  const registry = new AppendOnlyFedosDeviceRegistryPersistence(registryLogPath);
  for (const [deviceId, authority, publicIdentifier] of [
    [selfDeviceId, selfAuthority, selfPublicIdentifier],
    [peerDeviceId, peerAuthority, peerPublicIdentifier],
  ] as const) {
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

suite("Alpha 5561-5640 -- FedOS Direct Double Ratchet Conversation Runtime and NIP-17 Integration (REAL crypto, REAL WASM)", () => {
  it("full slice: session establishment, real ratchet send/receive, duplicate rejection, restart-continuation, no key fixtures at rest", async () => {
    await withDevelopmentNodeEnv(async () => {
      const root = mkdtempSync(join(tmpdir(), "fedos-5561-"));
      const seedDir = mkdtempSync(join(root, "seeds-"));
      const backendDir = mkdtempSync(join(root, "backends-"));
      const shared = buildSharedBackends(backendDir);
      const loader = await primedLoader();

      const aliceDeviceRef = "alice-desktop";
      const bobDeviceRef = "bob-desktop";
      const aliceRatchetPaths = makeRatchetPaths(root, "alice");
      const bobRatchetPaths = makeRatchetPaths(root, "bob");

      const alicePart = await buildRealParticipant(seedDir, "alice.seed", "alice-pass", mkdtempSync(join(root, "alice-conv-")), loader);
      const bobPart = await buildRealParticipant(seedDir, "bob.seed", "bob-pass", mkdtempSync(join(root, "bob-conv-")), loader);

      seedTrustedDevicePair(
        aliceRatchetPaths.deviceRegistryLog,
        alicePart.participant.authority,
        alicePart.participant.publicIdentifier,
        aliceDeviceRef,
        bobPart.participant.authority,
        bobPart.participant.publicIdentifier,
        bobDeviceRef,
      );
      seedTrustedDevicePair(
        bobRatchetPaths.deviceRegistryLog,
        bobPart.participant.authority,
        bobPart.participant.publicIdentifier,
        bobDeviceRef,
        alicePart.participant.authority,
        alicePart.participant.publicIdentifier,
        aliceDeviceRef,
      );

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
            deviceRegistry: new AppendOnlyFedosDeviceRegistryPersistence(aliceRatchetPaths.deviceRegistryLog),
            sessionPersistence: new AppendOnlyFedosDirectRatchetSessionPersistence(aliceRatchetPaths.sessionLog),
            sealedSecretPersistence: new AppendOnlyFedosSealedDirectRatchetSecretPersistence(aliceRatchetPaths.sealedSecretLog),
            remotePublicKeyPersistence: new FileFedosDirectRatchetRemotePublicKeyPersistence(aliceRatchetPaths.remotePublicKeyLog),
            snapshotPersistence: new FileFedosDirectRatchetLiveStateSnapshotPersistence(aliceRatchetPaths.liveStateSnapshotLog),
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
            deviceRegistry: new AppendOnlyFedosDeviceRegistryPersistence(bobRatchetPaths.deviceRegistryLog),
            sessionPersistence: new AppendOnlyFedosDirectRatchetSessionPersistence(bobRatchetPaths.sessionLog),
            sealedSecretPersistence: new AppendOnlyFedosSealedDirectRatchetSecretPersistence(bobRatchetPaths.sealedSecretLog),
            remotePublicKeyPersistence: new FileFedosDirectRatchetRemotePublicKeyPersistence(bobRatchetPaths.remotePublicKeyLog),
            snapshotPersistence: new FileFedosDirectRatchetLiveStateSnapshotPersistence(bobRatchetPaths.liveStateSnapshotLog),
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
      let bobReceivedRumors: Array<{ readonly rumor: Parameters<FedosConversationRuntime["receiveNip17Rumor"]>[0]; readonly relaySource: string }> = [];

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
              bobReceivedRumors.push({ rumor, relaySource });
              void bobRuntime.receiveNip17Rumor(rumor, relaySource);
            },
          },
        });
      }
      wireTransports();

      await aliceTransport!.start();
      await bobTransport!.start();
      try {
        const created = aliceRuntime.createDirectDraft({ recipient: bobPart.participant });
        expect(created.outcome).toBe("draft-created");
        if (created.outcome !== "draft-created") return;
        const conversationId = created.draft.id;
        const token = toFedosConversationInvitationToken(created.capability!.descriptor.capabilityId, created.capability!.bearerSecret);
        expect(bobRuntime.redeemInvitation(token, bobPart.participant).outcome).toBe("redeemed");
        expect(await aliceRuntime.activateDirectConversation(conversationId)).toEqual({ outcome: "activated" });
        expect(await bobRuntime.activateDirectConversation(conversationId)).toEqual({ outcome: "already-active" });

        // Bob (receiver role) establishes the ratchet session, publishing
        // his fresh ratchet public key over a real authenticated NIP-17
        // control message.
        expect(bobRuntime.directRatchet()!.getDirectRatchetStatus(conversationId, aliceDeviceRef)).toBe("initialization-required");
        const establish = await bobRuntime.directRatchet()!.initializeDirectRatchetSession(conversationId, aliceDeviceRef);
        expect(establish.outcome).toBe("initiated");

        await bobTransport!.tick();
        await new Promise((resolve) => setTimeout(resolve, 20));

        expect(aliceRuntime.directRatchet()!.getDirectRatchetStatus(conversationId, bobDeviceRef)).toBe("active");
        expect(bobRuntime.directRatchet()!.getDirectRatchetStatus(conversationId, aliceDeviceRef)).toBe("active");

        // Alice sends through the REAL Direct Conversation send entry
        // point ALONE — real Ratchet Core encrypt, durable commit, real
        // Rumor/Seal/Gift Wrap, real (fake-server) publish.
        const sent1 = await aliceRuntime.sendDirectMessage({ conversationId, body: "hello bob, real ratchet", replyToEnvelopeId: null });
        expect(sent1.outcome).toBe("sent-locally");
        if (sent1.outcome !== "sent-locally") return;
        expect(sent1.delivery).toMatchObject({ outcome: "queued" });

        await aliceTransport!.tick();
        await new Promise((resolve) => setTimeout(resolve, 20));

        const bobMessages1 = bobRuntime.listDirectMessages(conversationId);
        expect(bobMessages1.length).toBeGreaterThanOrEqual(1);
        const bobRead1 = await bobRuntime.readDirectMessage({ conversationId, envelopeId: bobMessages1[0]!.envelopeId });
        expect(bobRead1).toEqual({ outcome: "decrypted", plaintext: new TextEncoder().encode("hello bob, real ratchet") });

        // Bob replies through the SAME real path; Alice reads the exact
        // reply.
        const reply = await bobRuntime.sendDirectMessage({ conversationId, body: "reply from bob, real ratchet", replyToEnvelopeId: null });
        expect(reply.outcome).toBe("sent-locally");
        await bobTransport!.tick();
        await new Promise((resolve) => setTimeout(resolve, 20));
        const aliceMessages = aliceRuntime.listDirectMessages(conversationId);
        expect(aliceMessages.length).toBeGreaterThanOrEqual(1);
        const aliceRead = await aliceRuntime.readDirectMessage({
          conversationId,
          envelopeId: aliceMessages[aliceMessages.length - 1]!.envelopeId,
        });
        expect(aliceRead).toEqual({ outcome: "decrypted", plaintext: new TextEncoder().encode("reply from bob, real ratchet") });

        // Duplicate/replay rejects — replaying the identical, already-
        // imported Rumor a second time is a no-op.
        const beforeCount = bobRuntime.listDirectMessages(conversationId).length;
        const firstRumor = bobReceivedRumors[0]!;
        const duplicateResult = await bobRuntime.receiveNip17Rumor(firstRumor.rumor, firstRumor.relaySource);
        expect(duplicateResult).toEqual({ outcome: "duplicate" });
        expect(bobRuntime.listDirectMessages(conversationId).length).toBe(beforeCount);

        // Restart: stop both Transports, construct BRAND NEW Runtimes/
        // Transports from the SAME durable ratchet persistence files.
        await aliceTransport!.stop();
        await bobTransport!.stop();

        aliceRuntime = buildAliceRuntime();
        bobRuntime = buildBobRuntime();
        aliceConn = new LiveRelayConnection(relayServer, "wss://fake-relay.test");
        bobConn = new LiveRelayConnection(relayServer, "wss://fake-relay.test");
        bobReceivedRumors = [];
        wireTransports();
        await aliceTransport!.start();
        await bobTransport!.start();

        expect(aliceRuntime.directRatchet()!.getDirectRatchetStatus(conversationId, bobDeviceRef)).toBe("active");
        expect(bobRuntime.directRatchet()!.getDirectRatchetStatus(conversationId, aliceDeviceRef)).toBe("active");

        const postRestartSend = await aliceRuntime.sendDirectMessage({
          conversationId,
          body: "after restart, still ratchet",
          replyToEnvelopeId: null,
        });
        expect(postRestartSend.outcome).toBe("sent-locally");
        if (postRestartSend.outcome !== "sent-locally") return;
        expect(postRestartSend.delivery).toMatchObject({ outcome: "queued" });

        await aliceTransport!.tick();
        await new Promise((resolve) => setTimeout(resolve, 20));
        expect(bobReceivedRumors.length).toBeGreaterThanOrEqual(1);
        const postRestartMessages = bobRuntime.listDirectMessages(conversationId);
        const postRestartEnvelope = postRestartMessages[postRestartMessages.length - 1]!;
        const postRestartRead = await bobRuntime.readDirectMessage({ conversationId, envelopeId: postRestartEnvelope.envelopeId });
        expect(postRestartRead).toEqual({ outcome: "decrypted", plaintext: new TextEncoder().encode("after restart, still ratchet") });

        // No known plaintext/key fixture bytes appear anywhere in the
        // durable ratchet secret-checkpoint files. `sealedSecretLog` is
        // only ever CREATED once a real skipped-key event occurs (never
        // in this straightforward, fully-in-order test) — its absence is
        // itself proof no skipped-key entry was ever (incorrectly)
        // written; check it only if present.
        const filesToCheck = [bobRatchetPaths.liveStateSnapshotLog, bobRatchetPaths.sessionLog, bobRatchetPaths.remotePublicKeyLog];
        if (existsSync(bobRatchetPaths.sealedSecretLog)) filesToCheck.push(bobRatchetPaths.sealedSecretLog);
        for (const filePath of filesToCheck) {
          const contents = readFileSync(filePath, "utf8") as string;
          for (const marker of ["hello bob", "reply from bob", "after restart"]) {
            expect(contents).not.toContain(marker);
          }
        }
      } finally {
        await aliceTransport!.stop().catch(() => undefined);
        await bobTransport!.stop().catch(() => undefined);
      }
    });
  });
});
