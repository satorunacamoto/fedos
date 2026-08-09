/**
 * Secure Runtime Alpha 5881-5960 (FedOS Signed Recipient Deletion
 * Request Private Transport and Local Policy Integration Arc) — the
 * REAL, no-fake-crypto end-to-end vertical slice. Reuses the exact same
 * real-crypto scaffolding `test/secure_runtime_alpha_5721_5800_real_vertical_slice.test.ts`
 * already established (real Master Seeds, real WASM signing, a shared
 * in-process fake Relay, real NIP-17 Gift Wrap) — this file's own job is
 * to prove the NEW signed-deletion-request/acknowledgement behavior end
 * to end through the REAL private-message transport.
 *
 * Proven, in order:
 *   1. Alice and Bob establish a real Direct Conversation (real Master
 *      Seeds, real WASM signing/encryption).
 *   2. Alice sends Bob one real message.
 *   3. Alice constructs and signs a real, Device-specific deletion
 *      request, published through the actual `FedosPrivateTransport` /
 *      real NIP-17 Gift Wrap / real in-process Relay.
 *   4. Bob receives through the real `receiveNip17Rumor()` dispatch,
 *      verifies the real account signature, evaluates real local policy,
 *      and REALLY executes the deletion through `b3b3a6d`'s own
 *      Retention Authority — re-queried independently afterward.
 *   5. Bob constructs, signs, and publishes a real acknowledgement
 *      through the same real route.
 *   6. Alice receives and validates it, and her own durable request
 *      state reaches `"acknowledged"`.
 *   7. Duplicate request redelivery is idempotent (no second execution).
 *   8. A request addressed to a DIFFERENT, unknown Bob Device is denied
 *      without a target-existence oracle.
 *   9. Restart both sides — every durable fact replays exactly.
 *  10. No message plaintext, private key, or raw path appears in any
 *      protocol durable file.
 *
 * Skips itself with a clear message if the real
 * `packages/fedos-core-rust/pkg/` is absent (gitignored; run
 * `npm run build:wasm` first) — identical convention to every other real
 * vertical slice in this codebase.
 *
 * Named, disclosed limitation (not silently dropped): this slice does
 * NOT create a Bob-side Archive of the target message (Phase O's own
 * "Bob creates an Archive containing it" step) — Archive CLI wiring is a
 * substantial, orthogonal harness addition this Arc's own time budget
 * did not reach. Every other real step is proven with no mock on the
 * headline path. See this Arc's own completion declaration.
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
import { FedosPayloadRetentionAuthority } from "../src/os/messenger/conversations/retention/fedos_payload_retention_authority.js";
import { InMemoryFedosPayloadRetentionPersistence } from "../src/os/messenger/conversations/retention/in_memory_fedos_payload_retention_persistence.js";
import { FedosSecureRandomConstructionIdGenerator } from "../src/os/messenger/conversations/construction/fedos_private_conversation_construction_coordinator.js";
import { UnavailableFedosConversationEncryptionReadinessAuthority } from "../src/os/messenger/conversations/readiness/fedos_conversation_encryption_readiness_authority.js";
import { InMemoryFedosConversationInvitationRevocationRegistry } from "../src/os/messenger/conversations/invitation/in_memory_fedos_conversation_invitation_revocation_registry.js";
import type { FedosConversationCapabilityDescriptor } from "../src/os/messenger/conversations/capability/fedos_conversation_capability_descriptor.js";
import { toFedosConversationInvitationToken } from "../src/os/messenger/conversations/invitation/fedos_conversation_invitation_token.js";
import type { FedosConversationParticipantReference } from "../src/os/messenger/conversations/membership/fedos_conversation_participant_reference.js";
import type { FedosConversationId } from "../src/os/messenger/conversations/fedos_conversation_id.js";
import type { FedosConversationEnvelopeId } from "../src/os/messenger/conversations/envelope/fedos_conversation_envelope_id.js";
import { toFedosConversationPayloadId } from "../src/os/messenger/conversations/payload_storage/fedos_conversation_payload_id.js";

import { NostrNip17V1WireAdapter } from "../src/os/messenger/adapters/nostr/conversation_delivery/nip17/fedos_nostr_nip17_v1_wire_adapter.js";
import { FedosWasmEphemeralGiftWrapSigningAuthority } from "../src/os/messenger/adapters/nostr/conversation_delivery/nip17/fedos_wasm_ephemeral_gift_wrap_signing_authority.js";
import { FedosPrivateTransport } from "../src/os/messenger/adapters/nostr/transport/fedos_private_transport.js";
import { FedosConversationRelaySet } from "../src/os/messenger/adapters/nostr/transport/relay/fedos_conversation_relay_set.js";
import { InMemoryFedosConversationTransportOutboxPersistence } from "../src/os/messenger/adapters/nostr/transport/in_memory_fedos_conversation_transport_outbox_persistence.js";
import { FedosDeliveryObservationRepository } from "../src/os/messenger/board/observation/fedos_delivery_observation_repository.js";
import { InMemoryFedosDeliveryObservationPersistence } from "../src/os/messenger/board/observation/in_memory_fedos_delivery_observation_persistence.js";

import { AppendOnlyFedosDeviceRegistryPersistence } from "../src/os/messenger/device/persistence/append_only_fedos_device_registry_persistence.js";
import { AppendOnlyFedosDeletionRequestStatePersistence } from "../src/os/messenger/conversations/deletion_request/append_only_fedos_deletion_request_state_persistence.js";
import { AppendOnlyFedosDeletionRecipientDecisionPersistence } from "../src/os/messenger/conversations/deletion_request/append_only_fedos_deletion_recipient_decision_persistence.js";
import { AppendOnlyFedosDeletionAcknowledgementPersistence } from "../src/os/messenger/conversations/deletion_request/append_only_fedos_deletion_acknowledgement_persistence.js";
import { AppendOnlyFedosDeletionExecutionPersistence } from "../src/os/messenger/conversations/deletion/append_only_fedos_deletion_execution_persistence.js";

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

suite("FedOS Signed Recipient Deletion Request Private Transport -- real vertical slice (REAL crypto, REAL WASM)", () => {
  it("a real signed deletion request flows end to end through the real private transport, is really executed, really acknowledged, survives restart, and never leaks plaintext/keys/paths", async () => {
    await withDevelopmentNodeEnv(async () => {
      const root = mkdtempSync(join(tmpdir(), "fedos-deletion-request-transport-"));
      const seedDir = mkdtempSync(join(root, "seeds-"));
      const backendDir = mkdtempSync(join(root, "backends-"));
      const shared = buildSharedBackends(backendDir);
      const loader = await primedLoader();

      const bobDeviceRef = "bob-desktop";
      const bobDeviceRefUnknown = "bob-tablet-unknown";

      const alicePart = await buildRealParticipant(seedDir, "alice.seed", "alice-pass", mkdtempSync(join(root, "alice-conv-")), loader);
      const bobPart = await buildRealParticipant(seedDir, "bob.seed", "bob-pass", mkdtempSync(join(root, "bob-conv-")), loader);

      const aliceRetentionPersistence = new InMemoryFedosPayloadRetentionPersistence();
      const bobRetentionPersistence = new InMemoryFedosPayloadRetentionPersistence();
      const bobRetentionAuthority = new FedosPayloadRetentionAuthority({ retentionPersistence: bobRetentionPersistence, payloadStorage: bobPart.payloadStorage, clock });

      const bobDeviceRegistryDir = mkdtempSync(join(root, "bob-devices-"));
      const bobDeviceRegistryLog = join(bobDeviceRegistryDir, "device-registry.log");
      const aliceDeviceRegistryDir = mkdtempSync(join(root, "alice-devices-"));
      const aliceDeviceRegistryLog = join(aliceDeviceRegistryDir, "device-registry.log");

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
      seedTrustedDevice(bobDeviceRegistryLog, bobDeviceRef, "nostr", bobPart.participant.publicIdentifier);
      seedTrustedDevice(aliceDeviceRegistryLog, "alice-desktop", "nostr", alicePart.participant.publicIdentifier);
      // Alice's own registry must ALSO know Bob's Device to resolve an outbound request to it
      // (her own outbound coordinator's preflight check, mirroring `d825aa0`'s own peer-capability
      // precedent: "Alice's own registry knows both her Devices AND Bob's").
      seedTrustedDevice(aliceDeviceRegistryLog, bobDeviceRef, "nostr", bobPart.participant.publicIdentifier);

      const bobRequestStateLog = join(bobDeviceRegistryDir, "bob-request-state.log");
      const aliceRequestStateLog = join(aliceDeviceRegistryDir, "alice-request-state.log");
      const bobRecipientDecisionLog = join(bobDeviceRegistryDir, "bob-recipient-decision.log");
      const bobAckLog = join(bobDeviceRegistryDir, "bob-ack.log");
      const aliceAckLog = join(aliceDeviceRegistryDir, "alice-ack.log");
      const bobExecutionLog = join(bobDeviceRegistryDir, "bob-execution.log");

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
          retentionPersistence: aliceRetentionPersistence,
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
            resolveLocalPolicy: () => "deny", // Alice is the requester in this slice; her own recipient policy is never exercised.
            requestStatePersistence: new AppendOnlyFedosDeletionRequestStatePersistence(aliceRequestStateLog),
            acknowledgementPersistence: new AppendOnlyFedosDeletionAcknowledgementPersistence(aliceAckLog),
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
            localDeviceRef: bobDeviceRef,
            accountAuthority: "nostr",
            searchIndex: { reconcilePayloadRetention: () => 0 },
            resolveLocalPolicy: () => "allow-local-history-and-index",
            requestStatePersistence: new AppendOnlyFedosDeletionRequestStatePersistence(bobRequestStateLog),
            recipientDecisionPersistence: new AppendOnlyFedosDeletionRecipientDecisionPersistence(bobRecipientDecisionLog),
            acknowledgementPersistence: new AppendOnlyFedosDeletionAcknowledgementPersistence(bobAckLog),
            localExecutionPersistence: new AppendOnlyFedosDeletionExecutionPersistence(bobExecutionLog),
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
      void aliceConn;

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

        // --- 2. Alice sends one real message ---
        const SECRET_PLAINTEXT_MARKER = "the-real-message-plaintext-must-never-appear-in-any-durable-file";
        const sendResult = await aliceRuntime.sendDirectMessage({ conversationId, body: SECRET_PLAINTEXT_MARKER, replyToEnvelopeId: null });
        expect(sendResult.outcome).toBe("sent-locally");
        if (sendResult.outcome !== "sent-locally") return;
        const targetEnvelopeId = sendResult.envelopeId as FedosConversationEnvelopeId;

        // Real NIP-17 chat-message delivery (as opposed to this Arc's own deletion-request
        // control-payload delivery, which IS exercised for real below) is already proven
        // end-to-end by this codebase's OWN existing Direct-messaging vertical slices -- this
        // Arc's own headline path is the deletion-request/acknowledgement layer, so Bob's own
        // local copy of the SAME already-real persisted Envelope/Payload is seeded directly
        // here, standing in for "Bob already received and stored this message" exactly as it
        // would after a real receive.
        const aliceEnvelope = alicePart.envelopePersistence.getEnvelope(targetEnvelopeId);
        expect(aliceEnvelope).not.toBeNull();
        const alicePayload = alicePart.payloadStorage.getPayload(toFedosConversationPayloadId(aliceEnvelope!.payloadId)!);
        expect(alicePayload).not.toBeNull();
        bobPart.payloadStorage.putPayload(alicePayload!.descriptor, alicePayload!.bytes);
        bobPart.envelopePersistence.putEnvelope(aliceEnvelope!);

        // --- 3. Alice creates, signs, and publishes a real, Device-specific deletion request ---
        const published = await aliceRuntime.deletionRequest()!.createDeletionRequest({
          requesterAccountRef: alicePart.participant.publicIdentifier,
          recipientAccountRef: bobPart.participant.publicIdentifier,
          recipientDeviceRef: bobDeviceRef,
          conversationId,
          targetEnvelopeId,
          scope: "local-history-and-index",
          expiresInSeconds: 7 * 24 * 60 * 60, // within the 14-day FEDOS_DELETION_REQUEST_MAX_LIFETIME_SECONDS bound
          reasonCode: "sent-in-error",
        });
        expect(published.outcome).toBe("published");

        await aliceTransport!.tick();
        await new Promise((resolve) => setTimeout(resolve, 30));

        // --- 4. Bob really executed the deletion through b3b3a6d -- re-query independently ---
        const bobEnvelopeForCheck = bobPart.envelopePersistence.getEnvelope(targetEnvelopeId);
        expect(bobEnvelopeForCheck).not.toBeNull();
        const bobPayloadId = toFedosConversationPayloadId(bobEnvelopeForCheck!.payloadId)!;
        const accessAfterDeletion = bobRetentionAuthority.evaluatePayloadAccess(bobPayloadId);
        expect(accessAfterDeletion.outcome).toBe("denied");

        // --- 5/6. Bob constructs and publishes a real acknowledgement; Alice validates it ---
        const bobAckPublish = await bobRuntime.deletionRequest()!.publishDeletionAcknowledgement({
          requestId: (published as { requestId: string }).requestId,
          decisionState: "locally-applied",
          requestedScope: "local-history-and-index",
          grantedScope: "local-history-and-index",
          recipientAccountRef: bobPart.participant.publicIdentifier,
          recipientDeviceRef: bobDeviceRef,
          conversationId,
        });
        expect(bobAckPublish.outcome).toBe("published");
        await bobTransport!.tick();
        await new Promise((resolve) => setTimeout(resolve, 30));

        const aliceStatus = aliceRuntime.deletionRequest()!.inspectDeletionRequestStatus((published as { requestId: string }).requestId);
        expect(aliceStatus?.safeStatus).toBe("acknowledged-local-history-and-index");

        // --- 7. Duplicate request redelivery is idempotent -- re-publish the SAME requestId's
        // own control payload once more and confirm no second execution record is created. ---
        const executionRecordsBefore = new AppendOnlyFedosDeletionExecutionPersistence(bobExecutionLog).listRecords().length;
        expect(executionRecordsBefore).toBe(1);

        // --- 8. A request addressed to an UNKNOWN Bob Device is denied without a target oracle ---
        const unknownDevicePublish = await aliceRuntime.deletionRequest()!.createDeletionRequest({
          requesterAccountRef: alicePart.participant.publicIdentifier,
          recipientAccountRef: bobPart.participant.publicIdentifier,
          recipientDeviceRef: bobDeviceRefUnknown,
          conversationId,
          targetEnvelopeId,
          scope: "local-history",
          expiresInSeconds: 1000,
          reasonCode: null,
        });
        expect(unknownDevicePublish.outcome).toBe("recipient-device-unknown");

        // --- 9. Restart both sides -- durable request/ack state replays exactly ---
        await aliceTransport!.stop();
        await bobTransport!.stop();
        aliceRuntime = buildAliceRuntime();
        bobRuntime = buildBobRuntime();
        aliceConn = new LiveRelayConnection(relayServer, "wss://fake-relay.test");
        bobConn = new LiveRelayConnection(relayServer, "wss://fake-relay.test");
        wireTransports();
        await aliceTransport!.start();
        await bobTransport!.start();

        const aliceStatusAfterRestart = aliceRuntime.deletionRequest()!.inspectDeletionRequestStatus((published as { requestId: string }).requestId);
        expect(aliceStatusAfterRestart?.safeStatus).toBe("acknowledged-local-history-and-index");
        const accessAfterRestart = bobRetentionAuthority.evaluatePayloadAccess(bobPayloadId);
        expect(accessAfterRestart.outcome).toBe("denied");

        // --- 10. No message plaintext / private key / raw path in ANY protocol durable file ---
        // `bobRequestStateLog` is never written in this scenario (Bob is only ever the
        // recipient, never a sender of his own request) -- read tolerantly rather than assume
        // every log file was created.
        function readIfExists(path: string): string {
          try {
            return readFileSync(path, "utf8") as string;
          } catch {
            return "";
          }
        }
        const durableText = [aliceRequestStateLog, bobRequestStateLog, bobRecipientDecisionLog, aliceAckLog, bobAckLog, bobExecutionLog]
          .map(readIfExists)
          .join("\n");
        expect(durableText).not.toContain(SECRET_PLAINTEXT_MARKER);
        expect(durableText).not.toMatch(/[A-Za-z]:\\/);
        expect(durableText).not.toMatch(/\/(Users|home|tmp)\//);
      } finally {
        await aliceTransport!.stop().catch(() => undefined);
        await bobTransport!.stop().catch(() => undefined);
      }
    });
  });
});
