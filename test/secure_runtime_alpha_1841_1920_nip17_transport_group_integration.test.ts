/**
 * Secure Runtime Alpha 1841–1920 ("NIP-17 Standard Transport Integration
 * and Group Pairwise Delivery Arc") — Phase I (Alpha 1891/1892) real,
 * no-fake-crypto vertical acceptance.
 *
 * Proves the Arc's own named blocker is genuinely closed: the standard
 * `nostr-nip17-v1` route is wired into LIVE outbound/inbound dispatch —
 * a caller calls `FedosConversationDirectMessagingCoordinator.sendDirectMessage()`
 * (via a real `FedosConversationRuntime`) and `FedosConversationRuntime.receiveNip17Rumor()`
 * ALONE; nothing in this file calls `FedosPrivateTransport.sendMailboxNip17()`
 * directly on the send path (only through the coordinator's own injected
 * `delivery` hook) — this is the "live dispatch, not just
 * constructor-injectable" bar Alpha 1920 names.
 *
 * Two independent real identities (Alice, Bob), each with their own
 * generated Master Seed (`FedosWasmMasterSeedAuthority`, real Rust/WASM
 * NIP-44 bridge), share the SAME durable Conversation backend set (the
 * same "closest honest in-process model of two participants" precedent
 * `test/secure_runtime_alpha_1261_1320_real_crypto_vertical_slice.test.ts`/
 * `test/secure_runtime_alpha_1761_1840_direct_real_vertical_slice.test.ts`
 * already establish) but each own a SEPARATE `FedosPrivateTransport`
 * over a SEPARATE `FedosConversationRelaySet` pointed at the SAME
 * `FakeRelayServer` (mirrors `test/secure_runtime_alpha_1471_1540_end_to_end_verification.test.ts`'s
 * own two-connections-one-server precedent) — genuinely separate wire
 * identities exchanging genuinely separate signed events.
 *
 * Requires `packages/fedos-core-rust/pkg/` to already be built
 * (`npm run build:wasm`) — this file does not build it itself.
 */
import { describe, it, expect } from "vitest";
// @ts-expect-error `node:fs` has no type declarations without `@types/node` in this project's tsconfig.
import { mkdtempSync } from "node:fs";
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
import type { FedosConversationDirectMessageDeliveryDependencies } from "../src/os/messenger/conversations/messaging/fedos_conversation_direct_messaging_coordinator.js";

import { NostrNip17V1WireAdapter } from "../src/os/messenger/adapters/nostr/conversation_delivery/nip17/fedos_nostr_nip17_v1_wire_adapter.js";
import { FedosWasmEphemeralGiftWrapSigningAuthority } from "../src/os/messenger/adapters/nostr/conversation_delivery/nip17/fedos_wasm_ephemeral_gift_wrap_signing_authority.js";
import { FedosPrivateTransport } from "../src/os/messenger/adapters/nostr/transport/fedos_private_transport.js";
import { FedosConversationRelaySet } from "../src/os/messenger/adapters/nostr/transport/relay/fedos_conversation_relay_set.js";
import { InMemoryFedosConversationTransportOutboxPersistence } from "../src/os/messenger/adapters/nostr/transport/in_memory_fedos_conversation_transport_outbox_persistence.js";
import { FedosDeliveryObservationRepository } from "../src/os/messenger/board/observation/fedos_delivery_observation_repository.js";
import { InMemoryFedosDeliveryObservationPersistence } from "../src/os/messenger/board/observation/in_memory_fedos_delivery_observation_persistence.js";

import type { FedosRelay } from "../src/os/messenger/desktop/fedos_relay.js";
import type { FedosEventDescriptor } from "../src/os/messenger/desktop/fedos_event_descriptor.js";
import type { FedosRelayMessageListener, FedosSubscriptionListener } from "../src/os/messenger/desktop/fedos_relay_listeners.js";
import type { FedosSubscription } from "../src/os/messenger/desktop/fedos_subscription.js";
import type { FedosNostrWireEvent } from "../src/os/messenger/desktop/fedos_nostr_wire_event.js";

declare const process: { env: { NODE_ENV?: string; [key: string]: string | undefined } };

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

/** Mirrors `test/secure_runtime_alpha_1761_1840_direct_real_vertical_slice.test.ts`'s own `primedLoader()` exactly -- ONE shared, already-primed loader reused across every identity's OWN `FedosWasmNostrSigningAuthority`/`NostrNip17V1WireAdapter` construction in this file (no secret material lives on the loader itself). */
async function primedLoader(): Promise<FedosWasmLoaderSkeleton> {
  const loader = new FedosWasmLoaderSkeleton();
  loader.planLoad();
  await loader.attemptDevOnlyJsGlueImport();
  await loader.attemptDevOnlyWasmInitialization();
  return loader;
}

/** Mirrors `test/secure_runtime_alpha_1471_1540_end_to_end_verification.test.ts`'s own `FakeRelayServer`/`LiveRelayConnection` pair exactly — one real relay-server double, independent per-connection sockets. */
class FakeRelayServer {
  readonly #connections: LiveRelayConnection[] = [];
  register(connection: LiveRelayConnection): void {
    this.#connections.push(connection);
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

/**
 * SHARED across participants: identity/authorization concerns only
 * (draft/membership/capability/coordination/activation/invitation-
 * revocation) — the SAME "closest honest in-process model of two
 * participants" simplification `test/secure_runtime_alpha_1261_1320_real_crypto_vertical_slice.test.ts`
 * already documents for THAT domain. UNLIKE that file, envelope/payload
 * storage is deliberately NOT shared here (see `buildRealParticipant`'s
 * own per-participant `envelopePersistence`/`payloadStorage` params) —
 * this Arc's own point is to verify a message crosses a REAL wire from
 * Alice's OWN local send into Bob's OWN, initially-EMPTY local store,
 * mirroring `test/secure_runtime_alpha_1391_1470_direct_delivery_vertical_slice.test.ts`'s
 * own identical per-participant Envelope/Payload separation.
 */
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
const clock = () => NOW;

interface RealParticipant {
  readonly runtime: FedosConversationRuntime;
  readonly participant: FedosConversationParticipantReference;
  readonly masterSeedAuthority: FedosWasmMasterSeedAuthority;
  readonly signingAuthority: FedosWasmNostrSigningAuthority;
  readonly adapter: NostrNip17V1WireAdapter;
  readonly envelopePersistence: AppendOnlyFedosConversationMessageEnvelopePersistence;
  readonly payloadStorage: AppendOnlyFedosConversationPayloadStorage;
}

/**
 * Real production crypto graph + real Conversation Runtime, over shared
 * durable backends. `directMessageDelivery` (Alpha 1843/1844) is
 * OPTIONAL, forward-declared via closure exactly like
 * `fedos_desktop_runtime.ts`'s own construction-order discipline (its
 * own `FedosPrivateTransport` does not exist yet when this Runtime is
 * built) -- the CALLER supplies a thunk reading a `let` it assigns after
 * this function returns.
 */
async function buildRealParticipant(
  seedDir: string,
  seedFileName: string,
  passphrase: string,
  shared: SharedBackends,
  ownDir: string,
  loader: FedosWasmLoaderSkeleton,
  directMessageDelivery?: FedosConversationDirectMessageDeliveryDependencies,
): Promise<RealParticipant> {
  const result = await assembleFedosConversationProductionCryptoGraph({
    enabled: true,
    sealedSeedPersistence: new FileFedosSealedMasterSeedEnvelopePersistence(join(seedDir, seedFileName)),
    passphraseProvider: new FedosFixedPassphraseProvider(new TextEncoder().encode(passphrase)),
    accountIndex: 0,
    allowSeedCreation: true,
  });
  if (result.outcome !== "available") throw new Error(`buildRealParticipant: expected "available", got "${result.outcome}"`);
  const resolution = result.graph.creatorIdentityAuthority.resolveCreator();
  if (resolution.outcome !== "resolved") throw new Error(`buildRealParticipant: expected resolved creator, got "${resolution.outcome}"`);

  // `result.graph.masterSeedAuthority` is already primed (the factory's
  // own internal loader) and safely reusable for NIP-44 -- but a FRESH
  // `FedosWasmNostrSigningAuthority`/`NostrNip17V1WireAdapter` built here
  // needs its OWN `loaderBoundary` argument (a SEPARATE field from the
  // Master Seed Authority's own internal one); the SAME shared, primed
  // `loader` is passed explicitly rather than left to default-construct
  // a second, un-primed one.
  const masterSeedAuthority = result.graph.masterSeedAuthority as unknown as FedosWasmMasterSeedAuthority;
  const signingAuthority = new FedosWasmNostrSigningAuthority(masterSeedAuthority, loader);
  const ephemeralSigningAuthority = new FedosWasmEphemeralGiftWrapSigningAuthority(loader);
  const adapter = new NostrNip17V1WireAdapter({
    localAccountIndex: 0,
    signingAuthority,
    nip44Wire: masterSeedAuthority,
    ephemeralSigningAuthority,
  });

  const envelopePersistence = new AppendOnlyFedosConversationMessageEnvelopePersistence(join(ownDir, "envelope.log"));
  const payloadStorage = new AppendOnlyFedosConversationPayloadStorage(join(ownDir, "payload.log"), 1_000_000);

  const runtime = createFedosConversationRuntime({
    draftPersistence: shared.draftPersistence,
    membershipAuthority: shared.membershipAuthority,
    capabilityIssuerAuthority: shared.capabilityAuthority,
    capabilityRedemptionAuthority: shared.capabilityAuthority,
    invitationRevocationRegistry: shared.invitationRevocationRegistry,
    invitationRevocationAuthorizationCheck: (descriptor, revoker) =>
      invitationRevocationAuthorizationCheck(descriptor, revoker, shared.membershipAuthority),
    coordinationPersistence: shared.coordinationPersistence,
    activationPersistence: shared.activationPersistence,
    // Per-participant, deliberately NOT shared -- see `SharedBackends`'s
    // own header for why.
    envelopePersistence,
    payloadStorage,
    retentionPersistence: new InMemoryFedosPayloadRetentionPersistence(),
    encryptionCoordinationPersistence: new AppendOnlyFedosConversationEncryptionCoordinationPersistence(
      join(seedDir, `${seedFileName}.enc-coord.log`),
    ),
    creatorIdentityAuthority: result.graph.creatorIdentityAuthority,
    encryptionAuthority: result.graph.encryptionAuthority,
    decryptionAuthority: result.graph.decryptionAuthority,
    accountIndexAuthority: result.graph.accountIndexAuthority,
    nostrAuthorBindingAuthority: result.graph.nostrAuthorBindingAuthority,
    encryptionReadinessAuthority: new UnavailableFedosConversationEncryptionReadinessAuthority(),
    idGenerator: new FedosSecureRandomConstructionIdGenerator(),
    clock,
    directMessageDelivery,
  });
  return { runtime, participant: resolution.creator, masterSeedAuthority, signingAuthority, adapter, envelopePersistence, payloadStorage };
}

describe("Secure Runtime Alpha 1841-1920 -- NIP-17 Standard Transport Integration real vertical acceptance", () => {
  it("1. Direct: sendDirectMessage() alone (live dispatch) prepares+queues+publishes a real Gift Wrap; receiveNip17Rumor() alone imports it; exact plaintext read; duplicate receive is a no-op", async () => {
    await withDevelopmentNodeEnv(async () => {
      const seedDir = mkdtempSync(join(tmpdir(), "fedos-1841-seeds-"));
      const backendDir = mkdtempSync(join(tmpdir(), "fedos-1841-backends-"));
      const aliceDir = mkdtempSync(join(tmpdir(), "fedos-1841-alice-"));
      const bobDir = mkdtempSync(join(tmpdir(), "fedos-1841-bob-"));
      const shared = buildSharedBackends(backendDir);
      const loader = await primedLoader();

      // Bob first (Alice needs his real identity to name him as recipient).
      let bobTransport: FedosPrivateTransport;
      const bobReceivedEnvelopeIds: string[] = [];
      const bobReceivedRumors: Array<{ readonly rumor: Parameters<FedosConversationRuntime["receiveNip17Rumor"]>[0]; readonly relaySource: string }> = [];
      const bob = await buildRealParticipant(seedDir, "bob.seed", "bob-pass", shared, bobDir, loader);

      let aliceTransport: FedosPrivateTransport;
      const alice = await buildRealParticipant(seedDir, "alice.seed", "alice-pass", shared, aliceDir, loader, {
        route: "nostr-nip17-v1",
        sendMailboxNip17: (envelopeId, conversationId, plaintext) =>
          aliceTransport.sendMailboxNip17(envelopeId as never, conversationId as never, plaintext),
      });

      const relayServer = new FakeRelayServer();
      const aliceConn = new LiveRelayConnection(relayServer, "wss://fake-relay.test");
      const bobConn = new LiveRelayConnection(relayServer, "wss://fake-relay.test");

      aliceTransport = new FedosPrivateTransport({
        relaySet: new FedosConversationRelaySet([aliceConn]),
        signingAuthority: alice.signingAuthority,
        localAccountIndex: 0,
        envelopePersistence: alice.envelopePersistence,
        payloadStorage: alice.payloadStorage,
        membershipsForConversation: (id) => alice.runtime.listMemberships(id),
        outboxPersistence: new InMemoryFedosConversationTransportOutboxPersistence(),
        observationRepository: new FedosDeliveryObservationRepository(new InMemoryFedosDeliveryObservationPersistence()),
        intervalMs: 1000,
        wireAdapter: alice.adapter,
      });
      bobTransport = new FedosPrivateTransport({
        relaySet: new FedosConversationRelaySet([bobConn]),
        signingAuthority: bob.signingAuthority,
        localAccountIndex: 0,
        envelopePersistence: bob.envelopePersistence,
        payloadStorage: bob.payloadStorage,
        membershipsForConversation: () => [],
        outboxPersistence: new InMemoryFedosConversationTransportOutboxPersistence(),
        observationRepository: new FedosDeliveryObservationRepository(new InMemoryFedosDeliveryObservationPersistence()),
        intervalMs: 1000,
        wireAdapter: bob.adapter,
        inbound: {
          filter: { kinds: [1059] },
          onEnvelope: () => undefined,
          onRumor: (rumor, relaySource) => {
            bobReceivedRumors.push({ rumor, relaySource });
            void bob.runtime.receiveNip17Rumor(rumor, relaySource).then((result) => {
              if (result.outcome === "imported") bobReceivedEnvelopeIds.push(result.envelopeId);
            });
          },
        },
      });

      await aliceTransport.start();
      await bobTransport.start();
      try {
        // Real Direct draft + Capability + redemption + real Membership -- no hand-built fixture.
        const created = alice.runtime.createDirectDraft({ recipient: bob.participant });
        expect(created.outcome).toBe("draft-created");
        if (created.outcome !== "draft-created") return;
        const conversationId = created.draft.id;
        const token = toFedosConversationInvitationToken(created.capability!.descriptor.capabilityId, created.capability!.bearerSecret);
        expect(bob.runtime.redeemInvitation(token, bob.participant).outcome).toBe("redeemed");
        expect(await alice.runtime.activateDirectConversation(conversationId)).toEqual({ outcome: "activated" });
        expect(await bob.runtime.activateDirectConversation(conversationId)).toEqual({ outcome: "already-active" });

        expect(bob.runtime.listDirectMessages(conversationId)).toHaveLength(0);

        // THE live-dispatch call -- sendDirectMessage() ALONE, nothing else.
        const plaintext = "hello bob, real NIP-17 over a real (fake-server) relay";
        const sent = await alice.runtime.sendDirectMessage({ conversationId, body: plaintext, replyToEnvelopeId: null });
        expect(sent.outcome).toBe("sent-locally");
        if (sent.outcome !== "sent-locally") return;
        expect(sent.delivery).toEqual({ outcome: "queued", envelopeId: sent.envelopeId });

        // Drive one Mailbox Delivery tick -- real sign-once-at-send-time
        // event is replayed verbatim, published, Relay-ACKed.
        const tickEntries = await aliceTransport.tick();
        expect(tickEntries).toHaveLength(1);
        expect(tickEntries[0]!.result).toEqual({ outcome: "delivered", retryPolicy: "never" });
        expect(tickEntries[0]!.intent.id).toBe(sent.envelopeId);
        expect((tickEntries[0]!.intent as { readonly schemaVersion: number }).schemaVersion).toBe(2);

        // Let the receiver's async relay->subscription path settle.
        await new Promise((resolve) => setTimeout(resolve, 20));

        expect(bobReceivedEnvelopeIds).toHaveLength(1);
        const bobRead = await bob.runtime.readDirectMessage({ conversationId, envelopeId: bobReceivedEnvelopeIds[0]! });
        expect(bobRead).toEqual({ outcome: "decrypted", plaintext: new TextEncoder().encode(plaintext) });
        expect(bob.runtime.listDirectMessages(conversationId)).toHaveLength(1);

        // Alpha 1861 -- duplicate detection: re-delivering the IDENTICAL
        // already-parsed Rumor (simulating a second Relay/reconnect
        // delivery of the same Gift Wrap, or a re-wrap of the same Rumor
        // in a different Gift Wrap) imports nothing new -- dedup is keyed
        // by the Rumor's own id, captured from the FIRST real delivery
        // above.
        expect(bobReceivedRumors).toHaveLength(1);
        const secondReceive = await bob.runtime.receiveNip17Rumor(bobReceivedRumors[0]!.rumor, bobReceivedRumors[0]!.relaySource);
        expect(secondReceive).toEqual({ outcome: "duplicate" });
        expect(bob.runtime.listDirectMessages(conversationId)).toHaveLength(1);
      } finally {
        await aliceTransport.stop();
        await bobTransport.stop();
      }
    });
  });

  it("2. Group: sendGroupMessage() fans out through the SAME enhanced sendDirectMessage() -- two recipients, two independent real Gift Wraps, no shared ciphertext, no shared ephemeral key", async () => {
    await withDevelopmentNodeEnv(async () => {
      const seedDir = mkdtempSync(join(tmpdir(), "fedos-1841-group-seeds-"));
      const backendDir = mkdtempSync(join(tmpdir(), "fedos-1841-group-backends-"));
      const aliceDir = mkdtempSync(join(tmpdir(), "fedos-1841-group-alice-"));
      const shared = buildSharedBackends(backendDir);
      const loader = await primedLoader();

      // Bob and Carol's real identities need to exist before Alice can
      // admit them -- their own Runtimes are never used in this test
      // (Alpha 1865's own "per active recipient... one recipient-specific
      // Gift Wrap" is fully observable from Alice's OWN send-side outbox
      // alone; no receiver-side import is needed to prove per-recipient
      // isolation).
      const bob = await buildRealParticipant(seedDir, "bob.seed", "bob-pass", shared, mkdtempSync(join(tmpdir(), "fedos-1841-group-bob-")), loader);
      const carol = await buildRealParticipant(
        seedDir,
        "carol.seed",
        "carol-pass",
        shared,
        mkdtempSync(join(tmpdir(), "fedos-1841-group-carol-")),
        loader,
      );

      let aliceTransport: FedosPrivateTransport;
      const aliceOutboxPersistence = new InMemoryFedosConversationTransportOutboxPersistence();
      const alice = await buildRealParticipant(seedDir, "alice.seed", "alice-pass", shared, aliceDir, loader, {
        route: "nostr-nip17-v1",
        sendMailboxNip17: (envelopeId, conversationId, plaintext) =>
          aliceTransport.sendMailboxNip17(envelopeId as never, conversationId as never, plaintext),
      });

      const relayServer = new FakeRelayServer();
      const aliceConn = new LiveRelayConnection(relayServer, "wss://fake-relay.test");
      aliceTransport = new FedosPrivateTransport({
        relaySet: new FedosConversationRelaySet([aliceConn]),
        signingAuthority: alice.signingAuthority,
        localAccountIndex: 0,
        envelopePersistence: alice.envelopePersistence,
        payloadStorage: alice.payloadStorage,
        membershipsForConversation: (id) => alice.runtime.listMemberships(id),
        outboxPersistence: aliceOutboxPersistence,
        observationRepository: new FedosDeliveryObservationRepository(new InMemoryFedosDeliveryObservationPersistence()),
        intervalMs: 1000,
        wireAdapter: alice.adapter,
      });
      await aliceTransport.start();
      try {
        const gr = alice.runtime.groupRuntime();
        const created = alice.runtime.createPrivateGroupDraft({});
        expect(created.outcome).toBe("draft-created");
        if (created.outcome !== "draft-created") return;
        const groupId = created.draft.id;

        expect(gr.addPrivateGroupMember(groupId, bob.participant).outcome).toBe("admitted");
        expect(gr.addPrivateGroupMember(groupId, carol.participant).outcome).toBe("admitted");

        const sent = await gr.sendPrivateGroupMessage({
          groupConversationId: groupId,
          body: "hello group, real per-recipient NIP-17 fanout",
          replyToGroupMessageId: null,
          idempotencyKey: "nip17-group-message-1",
        });
        expect(sent.outcome).toBe("stored-for-all");
        if (sent.outcome !== "stored-for-all") return;
        expect(sent.recipientEnvelopeIds).toHaveLength(2);
        expect(new Set(sent.recipientEnvelopeIds).size).toBe(2);

        // Alpha 1843/1850 -- each recipient's own `sendDirectMessage()`
        // call (inside the Group Send Coordinator's own per-recipient
        // fanout loop, UNCHANGED by this Arc) ALSO triggered standard
        // NIP-17 preparation+enqueue -- prove it by inspecting Alice's
        // own real Outbox: exactly two `schemaVersion: 2` records, one
        // per recipient envelope id.
        const records = sent.recipientEnvelopeIds.map((id) => aliceOutboxPersistence.getIntent(id));
        for (const record of records) {
          expect(record).not.toBeNull();
          expect((record as { readonly schemaVersion: number }).schemaVersion).toBe(2);
        }
        const v2Records = records as readonly {
          readonly schemaVersion: 2;
          readonly recipientPublicKeyHex: string;
          readonly nativeEvent: { readonly id: string; readonly pubkey: string };
        }[];

        // Alpha 1865 -- no shared ciphertext, no shared ephemeral key:
        // two STRUCTURALLY DIFFERENT native events, recipient-specific.
        expect(v2Records[0]!.nativeEvent.id).not.toBe(v2Records[1]!.nativeEvent.id);
        expect(v2Records[0]!.nativeEvent.pubkey).not.toBe(v2Records[1]!.nativeEvent.pubkey);
        expect(new Set(v2Records.map((r) => r.recipientPublicKeyHex))).toEqual(
          new Set([bob.participant.publicIdentifier, carol.participant.publicIdentifier]),
        );

        // Real fan-out publish -- two independent Relay-ACKed events.
        const tickEntries = await aliceTransport.tick();
        expect(tickEntries).toHaveLength(2);
        for (const entry of tickEntries) {
          expect(entry.result).toEqual({ outcome: "delivered", retryPolicy: "never" });
        }
      } finally {
        await aliceTransport.stop();
      }
    });
  });

  it("3. Route selection fails closed BEFORE Relay publication -- never a silent downgrade to fedos-private-v1, and an unconfigured route leaves sendDirectMessage() byte-for-byte unchanged", async () => {
    await withDevelopmentNodeEnv(async () => {
      const seedDir = mkdtempSync(join(tmpdir(), "fedos-1841-route-seeds-"));
      const backendDir = mkdtempSync(join(tmpdir(), "fedos-1841-route-backends-"));
      const aliceDir = mkdtempSync(join(tmpdir(), "fedos-1841-route-alice-"));
      const bobDir = mkdtempSync(join(tmpdir(), "fedos-1841-route-bob-"));
      const shared = buildSharedBackends(backendDir);
      const loader = await primedLoader();

      const bob = await buildRealParticipant(seedDir, "bob.seed", "bob-pass", shared, bobDir, loader);

      // Alice's own Transport is constructed WITHOUT a `wireAdapter` --
      // the standard route is "selected" (delivery hook present) but the
      // adapter itself is unavailable, exactly the "selected but
      // unavailable" case Alpha 1844 requires to fail closed rather than
      // silently fall back.
      let aliceTransportNoAdapter: FedosPrivateTransport;
      const aliceNoAdapterOutbox = new InMemoryFedosConversationTransportOutboxPersistence();
      const aliceNoAdapter = await buildRealParticipant(seedDir, "alice.seed", "alice-pass", shared, aliceDir, loader, {
        route: "nostr-nip17-v1",
        sendMailboxNip17: (envelopeId, conversationId, plaintext) =>
          aliceTransportNoAdapter.sendMailboxNip17(envelopeId as never, conversationId as never, plaintext),
      });
      const unusedRelayServer = new FakeRelayServer();
      aliceTransportNoAdapter = new FedosPrivateTransport({
        relaySet: new FedosConversationRelaySet([new LiveRelayConnection(unusedRelayServer, "wss://unused.test")]),
        signingAuthority: aliceNoAdapter.signingAuthority,
        localAccountIndex: 0,
        envelopePersistence: aliceNoAdapter.envelopePersistence,
        payloadStorage: aliceNoAdapter.payloadStorage,
        membershipsForConversation: (id) => aliceNoAdapter.runtime.listMemberships(id),
        outboxPersistence: aliceNoAdapterOutbox,
        observationRepository: new FedosDeliveryObservationRepository(new InMemoryFedosDeliveryObservationPersistence()),
        intervalMs: 1000,
        // NO wireAdapter -- the standard route is unavailable.
      });
      await aliceTransportNoAdapter.start();
      try {
        const created = aliceNoAdapter.runtime.createDirectDraft({ recipient: bob.participant });
        if (created.outcome !== "draft-created") throw new Error("expected draft-created");
        const conversationId = created.draft.id;
        const token = toFedosConversationInvitationToken(created.capability!.descriptor.capabilityId, created.capability!.bearerSecret);
        bob.runtime.redeemInvitation(token, bob.participant);
        expect(await aliceNoAdapter.runtime.activateDirectConversation(conversationId)).toEqual({ outcome: "activated" });

        const sent = await aliceNoAdapter.runtime.sendDirectMessage({ conversationId, body: "never delivered standard", replyToEnvelopeId: null });
        expect(sent.outcome).toBe("sent-locally");
        if (sent.outcome !== "sent-locally") return;
        // Fails closed BEFORE any Relay is ever reached -- never "queued", never a
        // silent downgrade to a `fedos-private-v1`-shaped record.
        expect(sent.delivery).toEqual({ outcome: "route-unavailable" });
        expect(aliceNoAdapterOutbox.listIntents()).toHaveLength(0);

        // Local storage/read is entirely unaffected -- Direct/Group
        // messaging still works with no Relay event of this kind ever
        // emitted (Alpha 1881).
        expect(aliceNoAdapter.runtime.listDirectMessages(conversationId)).toHaveLength(1);
      } finally {
        await aliceTransportNoAdapter.stop();
      }

      // A caller that never configures `directMessageDelivery` at all
      // (no route selected) sees the identical pre-Arc shape -- `delivery`
      // is not even a property on the result, matching every existing
      // test/caller of `sendDirectMessage()` byte-for-byte.
      const plainRuntime = await buildRealParticipant(
        seedDir,
        "alice-plain.seed",
        "alice-plain-pass",
        shared,
        mkdtempSync(join(tmpdir(), "fedos-1841-route-plain-")),
        loader,
      );
      const created2 = plainRuntime.runtime.createDirectDraft({ recipient: bob.participant });
      if (created2.outcome !== "draft-created") throw new Error("expected draft-created");
      const token2 = toFedosConversationInvitationToken(created2.capability!.descriptor.capabilityId, created2.capability!.bearerSecret);
      bob.runtime.redeemInvitation(token2, bob.participant);
      await plainRuntime.runtime.activateDirectConversation(created2.draft.id);
      const plainSent = await plainRuntime.runtime.sendDirectMessage({
        conversationId: created2.draft.id,
        body: "no route configured at all",
        replyToEnvelopeId: null,
      });
      expect(plainSent).toEqual({ outcome: "sent-locally", envelopeId: (plainSent as { envelopeId: string }).envelopeId });
      expect(Object.prototype.hasOwnProperty.call(plainSent, "delivery")).toBe(false);
    });
  });
});
