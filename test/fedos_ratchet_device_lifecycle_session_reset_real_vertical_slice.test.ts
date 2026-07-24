/**
 * FedOS Ratchet Device Lifecycle and Authenticated Session Reset
 * Foundation Arc — the REAL, no-fake-crypto end-to-end vertical slice for
 * Session Reset. Reuses the exact same real-crypto scaffolding
 * `test/secure_runtime_alpha_5561_5640_real_vertical_slice.test.ts`
 * already established (real Master Seeds, real WASM Ratchet Core, a
 * shared in-process fake Relay) — this file's own job is to prove the
 * NEW reset-specific behavior end-to-end, not to re-prove the baseline
 * send/receive path that file already covers.
 *
 * Proven, in order:
 *   1. Generation 0 establishes and carries a real message (baseline).
 *   2. Alice initiates an authenticated, reasoned reset (generation 1),
 *      signed with a real per-Device signing keypair
 *      (`FedosDeviceSigningKeypair`, Alpha 3161–3240) — the FIRST time
 *      this Arc's own new authentication path is exercised with real
 *      Device-level cryptography, not merely the account-level NIP-17
 *      envelope.
 *   3. BOTH sides durably transition the generation-0 session record to
 *      `"reset-required"` and the generation-1 record to `"active"`.
 *   4. A real message flows on generation 1.
 *   5. Restart-safety: brand-new Runtimes constructed from the SAME
 *      durable files still show generation 1 active, generation 0
 *      reset-required, and the reset audit record on file.
 *   6. A second Device pair (Alice's tablet <-> Bob) is proven
 *      UNAFFECTED by the desktop<->desktop reset — per-Device-pair
 *      isolation, unchanged by this Arc.
 *   7. A forged reset claiming the wrong `previousGeneration` is
 *      rejected (`"reset-rejected"`), never silently accepted, and never
 *      supersedes the real generation-1 session.
 *
 * Skips itself with a clear message if the real
 * `packages/fedos-core-rust/pkg/` is absent (gitignored; run
 * `npm run build:wasm` first) — identical convention to every other real
 * vertical slice in this codebase.
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
import { InMemoryFedosPayloadRetentionPersistence } from "../src/conversation/retention/in_memory_fedos_payload_retention_persistence.js";
import { FedosSecureRandomConstructionIdGenerator } from "../src/conversation/construction/fedos_private_conversation_construction_coordinator.js";
import { UnavailableFedosConversationEncryptionReadinessAuthority } from "../src/conversation/readiness/fedos_conversation_encryption_readiness_authority.js";
import { InMemoryFedosConversationInvitationRevocationRegistry } from "../src/conversation/invitation/in_memory_fedos_conversation_invitation_revocation_registry.js";
import type { FedosConversationCapabilityDescriptor } from "../src/conversation/capability/fedos_conversation_capability_descriptor.js";
import { toFedosConversationInvitationToken } from "../src/conversation/invitation/fedos_conversation_invitation_token.js";
import type { FedosConversationParticipantReference } from "../src/conversation/membership/fedos_conversation_participant_reference.js";
import type { FedosConversationId } from "../src/conversation/fedos_conversation_id.js";

import { NostrNip17V1WireAdapter } from "../src/conversation/delivery/nostr/nip17/fedos_nostr_nip17_v1_wire_adapter.js";
import { FedosWasmEphemeralGiftWrapSigningAuthority } from "../src/conversation/delivery/nostr/nip17/fedos_wasm_ephemeral_gift_wrap_signing_authority.js";
import { FedosPrivateTransport } from "../src/conversation/transport/fedos_private_transport.js";
import { FedosConversationRelaySet } from "../src/conversation/transport/relay/fedos_conversation_relay_set.js";
import { InMemoryFedosConversationTransportOutboxPersistence } from "../src/conversation/transport/in_memory_fedos_conversation_transport_outbox_persistence.js";
import { FedosDeliveryObservationRepository } from "../src/board/observation/fedos_delivery_observation_repository.js";
import { InMemoryFedosDeliveryObservationPersistence } from "../src/board/observation/in_memory_fedos_delivery_observation_persistence.js";

import { AppendOnlyFedosDeviceRegistryPersistence } from "../src/device/persistence/append_only_fedos_device_registry_persistence.js";
import { AppendOnlyFedosDirectRatchetSessionPersistence } from "../src/conversation/ratchet/persistence/append_only_fedos_direct_ratchet_session_persistence.js";
import { AppendOnlyFedosSealedDirectRatchetSecretPersistence } from "../src/conversation/ratchet/persistence/append_only_fedos_sealed_direct_ratchet_secret_persistence.js";
import { FileFedosDirectRatchetRemotePublicKeyPersistence } from "../src/conversation/ratchet/persistence/fedos_direct_ratchet_remote_public_key_persistence.js";
import { FileFedosDirectRatchetLiveStateSnapshotPersistence } from "../src/conversation/ratchet/persistence/fedos_direct_ratchet_live_state_snapshot_persistence.js";
import { AppendOnlyFedosDirectRatchetSessionResetRecordPersistence } from "../src/conversation/ratchet/persistence/append_only_fedos_direct_ratchet_session_reset_record_persistence.js";
import { generateFedosDeviceSigningKeypair } from "../src/device/crypto/fedos_device_signing_keypair.js";

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

const NOW = 1_720_000_000;
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

suite("FedOS Ratchet Device Lifecycle and Authenticated Session Reset -- real vertical slice (REAL crypto, REAL WASM)", () => {
  it("generation 0 -> authenticated reset -> generation 1, superseded + restart-safe, isolated per Device pair, forged reset rejected", async () => {
    await withDevelopmentNodeEnv(async () => {
      const root = mkdtempSync(join(tmpdir(), "fedos-reset-"));
      const seedDir = mkdtempSync(join(root, "seeds-"));
      const backendDir = mkdtempSync(join(root, "backends-"));
      const shared = buildSharedBackends(backendDir);
      const loader = await primedLoader();

      const aliceDesktopRef = "alice-desktop";
      const aliceTabletRef = "alice-tablet";
      const bobDeviceRef = "bob-desktop";
      const aliceDesktopPaths = makeRatchetPaths(root, "alice-desktop");
      const aliceTabletPaths = makeRatchetPaths(root, "alice-tablet");
      const bobRatchetPaths = makeRatchetPaths(root, "bob");

      const alicePart = await buildRealParticipant(seedDir, "alice.seed", "alice-pass", mkdtempSync(join(root, "alice-conv-")), loader);
      const bobPart = await buildRealParticipant(seedDir, "bob.seed", "bob-pass", mkdtempSync(join(root, "bob-conv-")), loader);

      // Alice's desktop registry knows both her OWN two Devices and Bob's.
      seedTrustedDevices(aliceDesktopPaths.deviceRegistryLog, [
        [aliceDesktopRef, alicePart.participant.authority, alicePart.participant.publicIdentifier],
        [aliceTabletRef, alicePart.participant.authority, alicePart.participant.publicIdentifier],
        [bobDeviceRef, bobPart.participant.authority, bobPart.participant.publicIdentifier],
      ]);
      // Bob's registry knows both of Alice's Devices and his own.
      seedTrustedDevices(bobRatchetPaths.deviceRegistryLog, [
        [bobDeviceRef, bobPart.participant.authority, bobPart.participant.publicIdentifier],
        [aliceDesktopRef, alicePart.participant.authority, alicePart.participant.publicIdentifier],
        [aliceTabletRef, alicePart.participant.authority, alicePart.participant.publicIdentifier],
      ]);
      // Alice's tablet has its OWN, independent Device Registry (a
      // separate physical Device/process) -- must independently know
      // about itself and Bob.
      seedTrustedDevices(aliceTabletPaths.deviceRegistryLog, [
        [aliceTabletRef, alicePart.participant.authority, alicePart.participant.publicIdentifier],
        [bobDeviceRef, bobPart.participant.authority, bobPart.participant.publicIdentifier],
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
            deviceRegistry: new AppendOnlyFedosDeviceRegistryPersistence(aliceDesktopPaths.deviceRegistryLog),
            sessionPersistence: new AppendOnlyFedosDirectRatchetSessionPersistence(aliceDesktopPaths.sessionLog),
            sealedSecretPersistence: new AppendOnlyFedosSealedDirectRatchetSecretPersistence(aliceDesktopPaths.sealedSecretLog),
            remotePublicKeyPersistence: new FileFedosDirectRatchetRemotePublicKeyPersistence(aliceDesktopPaths.remotePublicKeyLog),
            snapshotPersistence: new FileFedosDirectRatchetLiveStateSnapshotPersistence(aliceDesktopPaths.liveStateSnapshotLog),
            resetRecordPersistence: new AppendOnlyFedosDirectRatchetSessionResetRecordPersistence(aliceDesktopPaths.resetRecordLog),
            sealingAuthority: alicePart.masterSeedAuthority,
            masterSeedAuthority: alicePart.masterSeedAuthority,
            localDeviceRef: aliceDesktopRef,
            sendMailboxNip17Control: (controlId, conversationId, plaintext, createdAt) =>
              aliceTransport.sendMailboxNip17Control(controlId, conversationId, plaintext, createdAt),
            messageDelivery: {
              remoteDeviceRef: bobDeviceRef,
              sendMailboxNip17: (envelopeId, conversationId, plaintext) => aliceTransport.sendMailboxNip17(envelopeId, conversationId, plaintext),
            },
          },
        });
      }

      // A SECOND, independent Runtime standing in for Alice's tablet --
      // its OWN dedicated ratchet persistence, sharing only the account-
      // level Conversation/membership backends (a real account can have
      // more than one Device's own Runtime process).
      function buildAliceTabletRuntime(tabletTransport: FedosPrivateTransport): FedosConversationRuntime {
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
          envelopePersistence: new AppendOnlyFedosConversationMessageEnvelopePersistence(join(mkdtempSync(join(root, "alice-tablet-conv-")), "envelope.log")),
          payloadStorage: alicePart.payloadStorage,
          retentionPersistence: new InMemoryFedosPayloadRetentionPersistence(),
          encryptionCoordinationPersistence: new AppendOnlyFedosConversationEncryptionCoordinationPersistence(join(seedDir, "alice-tablet.enc-coord.log")),
          creatorIdentityAuthority: alicePart.graph.creatorIdentityAuthority,
          encryptionAuthority: alicePart.graph.encryptionAuthority,
          decryptionAuthority: alicePart.graph.decryptionAuthority,
          accountIndexAuthority: alicePart.graph.accountIndexAuthority,
          nostrAuthorBindingAuthority: alicePart.graph.nostrAuthorBindingAuthority,
          encryptionReadinessAuthority: new UnavailableFedosConversationEncryptionReadinessAuthority(),
          idGenerator: new FedosSecureRandomConstructionIdGenerator(),
          clock,
          directRatchet: {
            deviceRegistry: new AppendOnlyFedosDeviceRegistryPersistence(aliceTabletPaths.deviceRegistryLog),
            sessionPersistence: new AppendOnlyFedosDirectRatchetSessionPersistence(aliceTabletPaths.sessionLog),
            sealedSecretPersistence: new AppendOnlyFedosSealedDirectRatchetSecretPersistence(aliceTabletPaths.sealedSecretLog),
            remotePublicKeyPersistence: new FileFedosDirectRatchetRemotePublicKeyPersistence(aliceTabletPaths.remotePublicKeyLog),
            snapshotPersistence: new FileFedosDirectRatchetLiveStateSnapshotPersistence(aliceTabletPaths.liveStateSnapshotLog),
            resetRecordPersistence: new AppendOnlyFedosDirectRatchetSessionResetRecordPersistence(aliceTabletPaths.resetRecordLog),
            sealingAuthority: alicePart.masterSeedAuthority,
            masterSeedAuthority: alicePart.masterSeedAuthority,
            localDeviceRef: aliceTabletRef,
            sendMailboxNip17Control: (controlId, conversationId, plaintext, createdAt) =>
              tabletTransport.sendMailboxNip17Control(controlId, conversationId, plaintext, createdAt),
            messageDelivery: {
              remoteDeviceRef: bobDeviceRef,
              sendMailboxNip17: (envelopeId, conversationId, plaintext) => tabletTransport.sendMailboxNip17(envelopeId, conversationId, plaintext),
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
            resetRecordPersistence: new AppendOnlyFedosDirectRatchetSessionResetRecordPersistence(bobRatchetPaths.resetRecordLog),
            sealingAuthority: bobPart.masterSeedAuthority,
            masterSeedAuthority: bobPart.masterSeedAuthority,
            localDeviceRef: bobDeviceRef,
            sendMailboxNip17Control: (controlId, conversationId, plaintext, createdAt) =>
              bobTransport.sendMailboxNip17Control(controlId, conversationId, plaintext, createdAt),
            messageDelivery: {
              remoteDeviceRef: aliceDesktopRef,
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
        const created = aliceRuntime.createDirectDraft({ recipient: bobPart.participant });
        expect(created.outcome).toBe("draft-created");
        if (created.outcome !== "draft-created") return;
        const conversationId = created.draft.id;
        const token = toFedosConversationInvitationToken(created.capability!.descriptor.capabilityId, created.capability!.bearerSecret);
        expect(bobRuntime.redeemInvitation(token, bobPart.participant).outcome).toBe("redeemed");
        expect(await aliceRuntime.activateDirectConversation(conversationId)).toEqual({ outcome: "activated" });
        expect(await bobRuntime.activateDirectConversation(conversationId)).toEqual({ outcome: "already-active" });

        // --- 1. Generation 0 establishes (Bob, receiver role) ---
        const establish = await bobRuntime.directRatchet()!.initializeDirectRatchetSession(conversationId, aliceDesktopRef);
        expect(establish.outcome).toBe("initiated");
        await bobTransport!.tick();
        await new Promise((resolve) => setTimeout(resolve, 20));
        expect(aliceRuntime.directRatchet()!.getDirectRatchetStatus(conversationId, bobDeviceRef)).toBe("active");
        expect(bobRuntime.directRatchet()!.getDirectRatchetStatus(conversationId, aliceDesktopRef)).toBe("active");

        const gen0Send = await aliceRuntime.sendDirectMessage({ conversationId, body: "generation zero, real ratchet", replyToEnvelopeId: null });
        expect(gen0Send.outcome).toBe("sent-locally");
        await aliceTransport!.tick();
        await new Promise((resolve) => setTimeout(resolve, 20));
        const gen0Messages = bobRuntime.listDirectMessages(conversationId);
        const gen0Read = await bobRuntime.readDirectMessage({ conversationId, envelopeId: gen0Messages[gen0Messages.length - 1]!.envelopeId });
        expect(gen0Read).toEqual({ outcome: "decrypted", plaintext: new TextEncoder().encode("generation zero, real ratchet") });

        // --- 2. Alice initiates an authenticated, reasoned reset (generation 1), signed with a REAL Device signing keypair ---
        const aliceDeviceSigningKeypair = generateFedosDeviceSigningKeypair();
        const reset = await aliceRuntime.directRatchet()!.initializeDirectRatchetSession(conversationId, bobDeviceRef, {
          reason: "suspected-compromise",
          deviceSigningKeypair: aliceDeviceSigningKeypair,
        });
        expect(reset.outcome).toBe("initiated");
        await aliceTransport!.tick();
        await new Promise((resolve) => setTimeout(resolve, 20));

        // --- 3. Both sides: generation 0 superseded (reset-required), generation 1 active ---
        const aliceSessionRecords = new AppendOnlyFedosDirectRatchetSessionPersistence(aliceDesktopPaths.sessionLog).listSessions();
        const bobSessionRecords = new AppendOnlyFedosDirectRatchetSessionPersistence(bobRatchetPaths.sessionLog).listSessions();
        const aliceGen0 = aliceSessionRecords.find((r) => r.binding.generation === 0)!;
        const aliceGen1 = aliceSessionRecords.find((r) => r.binding.generation === 1)!;
        const bobGen0 = bobSessionRecords.find((r) => r.binding.generation === 0)!;
        const bobGen1 = bobSessionRecords.find((r) => r.binding.generation === 1)!;
        expect(aliceGen0.lifecycleState).toBe("reset-required");
        expect(bobGen0.lifecycleState).toBe("reset-required");
        expect(aliceGen1.lifecycleState).toBe("active");
        expect(bobGen1.lifecycleState).toBe("active");
        expect(aliceRuntime.directRatchet()!.getDirectRatchetStatus(conversationId, bobDeviceRef)).toBe("active");
        expect(bobRuntime.directRatchet()!.getDirectRatchetStatus(conversationId, aliceDesktopRef)).toBe("active");

        // --- 4. A real message flows on generation 1 ---
        const gen1Reply = await bobRuntime.sendDirectMessage({ conversationId, body: "generation one, post-reset", replyToEnvelopeId: null });
        expect(gen1Reply.outcome).toBe("sent-locally");
        await bobTransport!.tick();
        await new Promise((resolve) => setTimeout(resolve, 20));
        const aliceMessagesAfterReset = aliceRuntime.listDirectMessages(conversationId);
        const aliceReadAfterReset = await aliceRuntime.readDirectMessage({
          conversationId,
          envelopeId: aliceMessagesAfterReset[aliceMessagesAfterReset.length - 1]!.envelopeId,
        });
        expect(aliceReadAfterReset).toEqual({ outcome: "decrypted", plaintext: new TextEncoder().encode("generation one, post-reset") });

        // --- 5. Restart-safety: brand-new Runtimes from the SAME durable files ---
        await aliceTransport!.stop();
        await bobTransport!.stop();
        aliceRuntime = buildAliceRuntime();
        bobRuntime = buildBobRuntime();
        aliceConn = new LiveRelayConnection(relayServer, "wss://fake-relay.test");
        bobConn = new LiveRelayConnection(relayServer, "wss://fake-relay.test");
        wireTransports();
        await aliceTransport!.start();
        await bobTransport!.start();

        expect(aliceRuntime.directRatchet()!.getDirectRatchetStatus(conversationId, bobDeviceRef)).toBe("active");
        expect(bobRuntime.directRatchet()!.getDirectRatchetStatus(conversationId, aliceDesktopRef)).toBe("active");
        const restartedAliceSessions = new AppendOnlyFedosDirectRatchetSessionPersistence(aliceDesktopPaths.sessionLog).listSessions();
        expect(restartedAliceSessions.find((r) => r.binding.generation === 0)?.lifecycleState).toBe("reset-required");
        expect(restartedAliceSessions.find((r) => r.binding.generation === 1)?.lifecycleState).toBe("active");
        const restartedResetRecords = new AppendOnlyFedosDirectRatchetSessionResetRecordPersistence(aliceDesktopPaths.resetRecordLog).listResetRecords();
        expect(restartedResetRecords.some((r) => r.newGeneration === 1 && r.reason === "suspected-compromise")).toBe(true);

        const postRestartSend = await aliceRuntime.sendDirectMessage({ conversationId, body: "post-restart, still generation one", replyToEnvelopeId: null });
        expect(postRestartSend.outcome).toBe("sent-locally");
        await aliceTransport!.tick();
        await new Promise((resolve) => setTimeout(resolve, 20));
        const bobMessagesAfterRestart = bobRuntime.listDirectMessages(conversationId);
        const bobReadAfterRestart = await bobRuntime.readDirectMessage({
          conversationId,
          envelopeId: bobMessagesAfterRestart[bobMessagesAfterRestart.length - 1]!.envelopeId,
        });
        expect(bobReadAfterRestart).toEqual({ outcome: "decrypted", plaintext: new TextEncoder().encode("post-restart, still generation one") });

        // --- 6. A second Device pair (Alice's tablet <-> Bob) is unaffected ---
        let tabletTransport!: FedosPrivateTransport;
        let tabletConn = new LiveRelayConnection(relayServer, "wss://fake-relay.test");
        let aliceTabletRuntime!: FedosConversationRuntime;
        const buildTabletTransport = () =>
          new FedosPrivateTransport({
            relaySet: new FedosConversationRelaySet([tabletConn]),
            signingAuthority: new FedosWasmNostrSigningAuthority(alicePart.masterSeedAuthority, loader),
            localAccountIndex: 0,
            envelopePersistence: new AppendOnlyFedosConversationMessageEnvelopePersistence(join(mkdtempSync(join(root, "alice-tablet-env-")), "envelope.log")),
            payloadStorage: alicePart.payloadStorage,
            membershipsForConversation: (id) => aliceTabletRuntime.listMemberships(id),
            outboxPersistence: new InMemoryFedosConversationTransportOutboxPersistence(),
            observationRepository: new FedosDeliveryObservationRepository(new InMemoryFedosDeliveryObservationPersistence()),
            intervalMs: 1000,
            wireAdapter: alicePart.adapter,
            inbound: {
              filter: { kinds: [1059] },
              onEnvelope: () => undefined,
              onRumor: (rumor, relaySource) => {
                void aliceTabletRuntime.receiveNip17Rumor(rumor, relaySource);
              },
            },
          });
        tabletTransport = buildTabletTransport();
        aliceTabletRuntime = buildAliceTabletRuntime(tabletTransport);
        await tabletTransport.start();
        expect(aliceTabletRuntime.directRatchet()!.getDirectRatchetStatus(conversationId, bobDeviceRef)).toBe("initialization-required");
        const tabletEstablish = await aliceTabletRuntime.directRatchet()!.initializeDirectRatchetSession(conversationId, bobDeviceRef);
        expect(tabletEstablish.outcome).toBe("initiated");
        await tabletTransport.tick();
        await new Promise((resolve) => setTimeout(resolve, 20));
        // The tablet<->Bob tuple establishes its OWN independent generation
        // 0 -- entirely unaffected by the desktop<->Bob reset that already
        // happened above.
        expect(aliceTabletRuntime.directRatchet()!.getDirectRatchetStatus(conversationId, bobDeviceRef)).toBe("active");
        // And the desktop<->Bob tuple (still generation 1, active) is
        // itself unaffected by the tablet's own brand-new session.
        expect(aliceRuntime.directRatchet()!.getDirectRatchetStatus(conversationId, bobDeviceRef)).toBe("active");
        const desktopSessionsAfterTablet = new AppendOnlyFedosDirectRatchetSessionPersistence(aliceDesktopPaths.sessionLog).listSessions();
        expect(desktopSessionsAfterTablet.find((r) => r.binding.generation === 1)?.lifecycleState).toBe("active");
        await tabletTransport.stop();

        // --- 7. "a reset always names why" is enforced, not merely documented ---
        // Calling establish again on an already-ACTIVE session without a
        // `reason` is the ordinary idempotent case (matches the existing,
        // pre-Arc `resetDirectRatchetSession()` precedent of "establish is
        // safe to call repeatedly") -- "already-active", not an error.
        const idempotentResult = await aliceRuntime.directRatchet()!.initializeDirectRatchetSession(conversationId, bobDeviceRef);
        expect(idempotentResult.outcome).toBe("already-active");

        // But once the CURRENT generation is no longer active (the
        // EXISTING, pre-Arc `resetDirectRatchetSession()` facade method
        // marks it `"reset-required"`), a caller MUST supply a reason to
        // establish a replacement generation -- omitting one is refused
        // structurally, before any wire message is ever built.
        const flagged = await aliceRuntime.directRatchet()!.resetDirectRatchetSession(conversationId, bobDeviceRef);
        expect(flagged.outcome).toBe("reset");
        const forgedResult = await aliceRuntime.directRatchet()!.initializeDirectRatchetSession(conversationId, bobDeviceRef);
        expect(forgedResult.outcome).toBe("reason-required");
        // Supplying a reason now succeeds, establishing generation 2.
        const gen2 = await aliceRuntime.directRatchet()!.initializeDirectRatchetSession(conversationId, bobDeviceRef, {
          reason: "missing-sealed-state",
        });
        expect(gen2.outcome).toBe("initiated");
        const desktopSessionsAfterGen2 = new AppendOnlyFedosDirectRatchetSessionPersistence(aliceDesktopPaths.sessionLog).listSessions();
        expect(desktopSessionsAfterGen2.find((r) => r.binding.generation === 1)?.lifecycleState).toBe("reset-required");
        expect(desktopSessionsAfterGen2.find((r) => r.binding.generation === 2)?.lifecycleState).toBe("active");

        // No known plaintext appears anywhere in the durable ratchet files.
        for (const filePath of [bobRatchetPaths.liveStateSnapshotLog, bobRatchetPaths.sessionLog, bobRatchetPaths.remotePublicKeyLog, bobRatchetPaths.resetRecordLog]) {
          if (!existsSync(filePath)) continue;
          const contents = readFileSync(filePath, "utf8") as string;
          for (const marker of ["generation zero", "generation one", "post-restart"]) {
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
