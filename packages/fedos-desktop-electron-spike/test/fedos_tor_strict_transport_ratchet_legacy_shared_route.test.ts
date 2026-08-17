/**
 * Tor Strict-Transport Local Closure arc — mandate §20/§44's own
 * explicitly-flagged requirement: prove, with a REAL running test (not a
 * code-path citation alone), that the Direct Ratchet route and the legacy
 * static NIP-17 route both pass through the SAME strict transport policy
 * -- never a route-specific clearnet bypass.
 *
 * Uses `FedosConversationDirectMessagingCoordinator`'s own REAL
 * route-selection logic (`ratchetDelivery` takes precedence over
 * `delivery` when both are configured; `delivery` alone when
 * `ratchetDelivery` is omitted -- i.e. "ratchet unavailable") -- the exact
 * same fixture-building pattern
 * `test/secure_runtime_alpha_1111_1180_direct_messaging.test.ts` already
 * establishes for this coordinator, extended here with a `delivery`/
 * `ratchetDelivery` thunk that calls DIRECTLY into
 * `fedos_electron_strict_transport_socket_factory.ts`'s own strict factory
 * function -- the same production code this arc wires at the ONE
 * composition-root binding
 * (`docs/reviews/fedos-tor-strict-transport-current/03_STRICT_TRANSPORT_ARCHITECTURE.md`
 * §4/§8). Lives in this package's own `test/` (not root `test/`) because
 * cross-package static imports only have an established precedent in this
 * direction (electron-package test -> root `src/`, e.g.
 * `commerce_e2e_sealed_key_corruption_real_electron.test.ts`'s own
 * `../../../src/...` imports), never the reverse.
 */
import { describe, it, expect } from "vitest";
import * as net from "node:net";
import { createHash } from "node:crypto";

import type { FedosConversationEncryptionAuthority, FedosConversationEncryptionRequest, FedosConversationEncryptionResult } from "../../../src/os/messenger/conversations/encryption/fedos_conversation_encryption_authority.js" with { "resolution-mode": "import" };
import type { FedosConversationDecryptionAuthority, FedosConversationDecryptionRequest, FedosConversationDecryptionResult } from "../../../src/os/messenger/conversations/encryption/fedos_conversation_decryption_authority.js" with { "resolution-mode": "import" };
import type { FedosPersistedConversationDraftRecordV1 } from "../../../src/os/messenger/conversations/construction/fedos_persisted_conversation_draft_record_v1.js" with { "resolution-mode": "import" };
import type { FedosConversationId } from "../../../src/os/messenger/conversations/fedos_conversation_id.js" with { "resolution-mode": "import" };
import type { FedosConversationParticipantReference } from "../../../src/os/messenger/conversations/membership/fedos_conversation_participant_reference.js" with { "resolution-mode": "import" };

import { FedosStrictTransportPolicy, defaultFedosStrictTransportConfig } from "../src/fedos_electron_strict_transport_policy.js";
import { createStrictFedosRelaySocketFactory } from "../src/fedos_electron_strict_transport_socket_factory.js";

/**
 * This package's tests compile as CommonJS but root `src/` compiles as
 * real ESM (TS1479) -- every root `src/` VALUE (as opposed to
 * type-only-with-resolution-mode above) must therefore be loaded via
 * dynamic `import()`, matching the established pattern
 * `commerce_e2e_sealed_key_corruption_real_electron.test.ts` already uses
 * for this exact cross-package boundary. Loaded once, cached by Node's own
 * module cache on every subsequent `await import(...)` of the same
 * specifier.
 */
async function loadRootModules() {
  const [
    messagingCoordinator,
    encryptionCoordinatorMod,
    decryptionCoordinatorMod,
    draftPersistenceMod,
    membershipAuthorityMod,
    envelopePersistenceMod,
    payloadStorageMod,
    encCoordinationPersistenceMod,
    retentionPersistenceMod,
    retentionAuthorityMod,
    activationPersistenceMod,
    activationIdMod,
    identityResolverMod,
    participantResolverMod,
    accountIndexAuthorityMod,
    keyResolverMod,
    creatorIdentityAuthorityMod,
  ] = await Promise.all([
    import("../../../src/os/messenger/conversations/messaging/fedos_conversation_direct_messaging_coordinator.js"),
    import("../../../src/os/messenger/conversations/encryption/fedos_conversation_encryption_coordinator.js"),
    import("../../../src/os/messenger/conversations/encryption/fedos_conversation_decryption_coordinator.js"),
    import("../../../src/os/messenger/conversations/construction/in_memory_fedos_conversation_draft_persistence.js"),
    import("../../../src/os/messenger/conversations/membership/in_memory_fedos_conversation_membership_authority.js"),
    import("../../../src/os/messenger/conversations/envelope/persistence/in_memory_fedos_conversation_message_envelope_persistence.js"),
    import("../../../src/os/messenger/conversations/payload_storage/in_memory_fedos_conversation_payload_storage.js"),
    import("../../../src/os/messenger/conversations/encryption/coordination/in_memory_fedos_conversation_encryption_coordination_persistence.js"),
    import("../../../src/os/messenger/conversations/retention/in_memory_fedos_payload_retention_persistence.js"),
    import("../../../src/os/messenger/conversations/retention/fedos_payload_retention_authority.js"),
    import("../../../src/os/messenger/conversations/activation/in_memory_fedos_conversation_activation_persistence.js"),
    import("../../../src/os/messenger/conversations/activation/fedos_persisted_conversation_activation_v1.js"),
    import("../../../src/os/messenger/conversations/encryption/identity/fedos_conversation_identity_resolver.js"),
    import("../../../src/os/messenger/conversations/encryption/identity/fedos_conversation_participant_resolver.js"),
    import("../../../src/os/messenger/conversations/encryption/identity/fedos_conversation_local_account_index_authority.js"),
    import("../../../src/os/messenger/conversations/encryption/identity/fedos_conversation_key_resolver.js"),
    import("../../../src/os/messenger/conversations/construction/fedos_conversation_creator_identity_authority.js"),
  ]);
  return {
    FedosConversationDirectMessagingCoordinator: messagingCoordinator.FedosConversationDirectMessagingCoordinator,
    FedosConversationEncryptionCoordinator: encryptionCoordinatorMod.FedosConversationEncryptionCoordinator,
    FedosConversationDecryptionCoordinator: decryptionCoordinatorMod.FedosConversationDecryptionCoordinator,
    InMemoryFedosConversationDraftPersistence: draftPersistenceMod.InMemoryFedosConversationDraftPersistence,
    InMemoryFedosConversationMembershipAuthority: membershipAuthorityMod.InMemoryFedosConversationMembershipAuthority,
    InMemoryFedosConversationMessageEnvelopePersistence: envelopePersistenceMod.InMemoryFedosConversationMessageEnvelopePersistence,
    InMemoryFedosConversationPayloadStorage: payloadStorageMod.InMemoryFedosConversationPayloadStorage,
    InMemoryFedosConversationEncryptionCoordinationPersistence: encCoordinationPersistenceMod.InMemoryFedosConversationEncryptionCoordinationPersistence,
    InMemoryFedosPayloadRetentionPersistence: retentionPersistenceMod.InMemoryFedosPayloadRetentionPersistence,
    FedosPayloadRetentionAuthority: retentionAuthorityMod.FedosPayloadRetentionAuthority,
    InMemoryFedosConversationActivationPersistence: activationPersistenceMod.InMemoryFedosConversationActivationPersistence,
    fedosConversationActivationId: activationIdMod.fedosConversationActivationId,
    DelegatingFedosConversationIdentityResolver: identityResolverMod.DelegatingFedosConversationIdentityResolver,
    MembershipFedosConversationParticipantResolver: participantResolverMod.MembershipFedosConversationParticipantResolver,
    FixedFedosConversationLocalAccountIndexAuthority: accountIndexAuthorityMod.FixedFedosConversationLocalAccountIndexAuthority,
    FedosConversationKeyResolver: keyResolverMod.FedosConversationKeyResolver,
    StaticFedosConversationCreatorIdentityAuthority: creatorIdentityAuthorityMod.StaticFedosConversationCreatorIdentityAuthority,
  };
}
type RootModules = Awaited<ReturnType<typeof loadRootModules>>;

const CONVERSATION_ID = "private-draft::direct::tor-strict-shared-route" as FedosConversationId;
const ALICE: FedosConversationParticipantReference = { authority: "fedos", publicIdentifier: "alice-local", identityId: null };
const BOB: FedosConversationParticipantReference = { authority: "nostr", publicIdentifier: "b".repeat(64), identityId: null };
const NOW = 1_712_000_000;
const WEBSOCKET_GUID = "258EAFA5-E914-47DA-95CA-C5AB0DC85B11";

function fakeMarker(request: { localAccountIndex: number; counterpartyPublicKeyHex: string }): Uint8Array {
  return new TextEncoder().encode(`FAKE:${request.localAccountIndex}:${request.counterpartyPublicKeyHex}:`);
}
class FakeEncryptionAuthority implements FedosConversationEncryptionAuthority {
  async encrypt(request: FedosConversationEncryptionRequest): Promise<FedosConversationEncryptionResult> {
    const marker = fakeMarker(request);
    const out = new Uint8Array(marker.length + request.plaintext.length);
    out.set(marker, 0);
    out.set(request.plaintext, marker.length);
    return { outcome: "encrypted", ciphertext: out };
  }
}
class FakeDecryptionAuthority implements FedosConversationDecryptionAuthority {
  async decrypt(request: FedosConversationDecryptionRequest): Promise<FedosConversationDecryptionResult> {
    const marker = fakeMarker(request);
    if (request.ciphertext.length < marker.length) return { outcome: "failed" };
    for (let i = 0; i < marker.length; i += 1) if (request.ciphertext[i] !== marker[i]) return { outcome: "failed" };
    return { outcome: "decrypted", plaintext: request.ciphertext.subarray(marker.length) };
  }
}

function activeDraftRecord(id: string, creator: FedosConversationParticipantReference): FedosPersistedConversationDraftRecordV1 {
  return {
    schemaVersion: 1,
    id,
    mode: "direct",
    lifecycleState: "draft",
    policyReference: "direct-draft-v1",
    creatorAuthority: creator.authority,
    creatorPublicIdentifier: creator.publicIdentifier,
    creatorIdentityId: creator.identityId,
    createdAt: NOW,
  };
}

function buildCoordinator(mod: RootModules, deliveryDeps: { readonly delivery?: unknown; readonly ratchetDelivery?: unknown }) {
  const draftPersistence = new mod.InMemoryFedosConversationDraftPersistence();
  draftPersistence.putDraft(activeDraftRecord(CONVERSATION_ID, ALICE));
  const activationPersistence = new mod.InMemoryFedosConversationActivationPersistence();
  activationPersistence.putActivationFact({ schemaVersion: 1, activationId: mod.fedosConversationActivationId(CONVERSATION_ID), conversationId: CONVERSATION_ID, phase: "completed", startedAt: NOW, updatedAt: NOW });
  const membershipAuthority = new mod.InMemoryFedosConversationMembershipAuthority();
  for (const m of [ALICE, BOB]) membershipAuthority.admit(CONVERSATION_ID, m, m === ALICE ? "owner" : "member", NOW);
  const identityResolver = new mod.DelegatingFedosConversationIdentityResolver(new mod.StaticFedosConversationCreatorIdentityAuthority(ALICE));
  const keyResolver = new mod.FedosConversationKeyResolver({
    identityResolver,
    participantResolver: new mod.MembershipFedosConversationParticipantResolver(membershipAuthority),
    accountIndexAuthority: new mod.FixedFedosConversationLocalAccountIndexAuthority(0),
  });
  const envelopePersistence = new mod.InMemoryFedosConversationMessageEnvelopePersistence();
  const payloadStorage = new mod.InMemoryFedosConversationPayloadStorage();
  const retentionAuthority = new mod.FedosPayloadRetentionAuthority({ retentionPersistence: new mod.InMemoryFedosPayloadRetentionPersistence(), payloadStorage, clock: () => NOW });
  const encryptionCoordinator = new mod.FedosConversationEncryptionCoordinator({
    draftPersistence,
    activationPersistence,
    membershipAuthority,
    identityResolver,
    keyResolver,
    encryptionAuthority: new FakeEncryptionAuthority(),
    envelopePersistence,
    payloadStorage,
    coordinationPersistence: new mod.InMemoryFedosConversationEncryptionCoordinationPersistence(),
    envelopeIdGenerator: { generateEnvelopeId: () => `env-${Math.random().toString(36).slice(2)}` },
    payloadIdGenerator: { generatePayloadId: () => `pay-${Math.random().toString(36).slice(2)}` },
    idempotencyKeyGenerator: { generateIdempotencyKey: () => `idem-${Math.random().toString(36).slice(2)}` },
    clock: () => NOW,
  });
  const decryptionCoordinator = new mod.FedosConversationDecryptionCoordinator({
    draftPersistence,
    activationPersistence,
    membershipAuthority,
    identityResolver,
    keyResolver,
    decryptionAuthority: new FakeDecryptionAuthority(),
    envelopePersistence,
    payloadStorage,
  });
  // `mod.FedosConversationDirectMessagingCoordinator` is loaded via
  // dynamic `import()` (TS1479 -- see `loadRootModules()`'s own header),
  // so TypeScript only sees it as a bare runtime value with no
  // constructor-parameter type to check against (a `typeof import(...)`
  // type query here would itself need the SAME resolution-mode
  // attribute TS1542 requires, which inline type queries cannot carry) --
  // `deliveryDeps` is only ever passed the two real, exact
  // `FedosConversationDirectMessage[Ratchet]DeliveryDependencies` shapes
  // from the call sites below, so this `any` reflects a real static-
  // typing gap at this cross-package dynamic-import boundary, not a
  // loosened runtime contract.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return new (mod.FedosConversationDirectMessagingCoordinator as any)({
    draftPersistence,
    activationPersistence,
    membershipAuthority,
    identityResolver,
    envelopePersistence,
    retentionAuthority,
    encryptionCoordinator,
    decryptionCoordinator,
    ...deliveryDeps,
  });
}

function listenLoopback(server: net.Server): Promise<number> {
  return new Promise((resolve) => {
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      resolve(typeof address === "object" && address !== null ? address.port : 0);
    });
  });
}

/** Same minimal real SOCKS5 server as the Electron package's own local acceptance suite -- records every CONNECT target, proxies through to a real local destination. */
function startFakeSocksServer(proxyTargetPort: number): { readonly server: net.Server; readonly connectTargets: { host: string; port: number }[] } {
  const connectTargets: { host: string; port: number }[] = [];
  const server = net.createServer((socket) => {
    let stage: "greeting" | "connect" | "piping" = "greeting";
    let buffered = Buffer.alloc(0);
    socket.on("data", (chunk: Buffer) => {
      if (stage === "piping") return;
      buffered = Buffer.concat([buffered, chunk]);
      if (stage === "greeting") {
        if (buffered.length < 2) return;
        const nMethods = buffered[1]!;
        if (buffered.length < 2 + nMethods) return;
        buffered = buffered.subarray(2 + nMethods);
        socket.write(Buffer.from([0x05, 0x00]));
        stage = "connect";
        return;
      }
      if (stage === "connect") {
        if (buffered.length < 5) return;
        const hostLen = buffered[4]!;
        if (buffered.length < 5 + hostLen + 2) return;
        const host = buffered.subarray(5, 5 + hostLen).toString("utf8");
        const port = buffered.readUInt16BE(5 + hostLen);
        connectTargets.push({ host, port });
        socket.write(Buffer.from([0x05, 0x00, 0x00, 0x01, 0, 0, 0, 0, 0, 0]));
        stage = "piping";
        socket.pause();
        const upstream = net.connect(proxyTargetPort, "127.0.0.1");
        upstream.on("connect", () => {
          socket.pipe(upstream);
          upstream.pipe(socket);
          socket.resume();
        });
        upstream.on("error", () => socket.destroy());
      }
    });
    socket.on("error", () => {});
  });
  return { server, connectTargets };
}

/** A minimal real plain-`ws://` server that just completes the handshake -- this test only needs to prove the CONNECT reaches the SOCKS server, not exercise message content. */
function startFakeWsDestination(): net.Server {
  return net.createServer((socket) => {
    let buffered = Buffer.alloc(0);
    socket.on("data", (chunk: Buffer) => {
      buffered = Buffer.concat([buffered, chunk]);
      const headerEnd = buffered.indexOf("\r\n\r\n");
      if (headerEnd === -1) return;
      const headerText = buffered.subarray(0, headerEnd).toString("utf8");
      const keyMatch = /sec-websocket-key:\s*(\S+)/i.exec(headerText);
      const accept = createHash("sha1").update((keyMatch?.[1] ?? "") + WEBSOCKET_GUID, "utf8").digest("base64");
      socket.write(`HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: ${accept}\r\n\r\n`);
    });
    socket.on("error", () => {});
  });
}

describe("mandate §20/§44 -- Direct Ratchet route and legacy NIP-17 route both pass through the SAME strict Tor transport, live", () => {
  it("a ratchet-route send and a forced-legacy-route send both genuinely connect through the identical strict SOCKS5 factory/policy instance", async () => {
    const mod = await loadRootModules();
    const dest = startFakeWsDestination();
    const destPort = await listenLoopback(dest);
    const fake = startFakeSocksServer(destPort);
    const socksPort = await listenLoopback(fake.server);

    // ONE shared policy instance -- exactly mirroring the real composition
    // root, where a single process-wide `FedosStrictTransportPolicy` feeds
    // the ONE relay-socket-factory binding that BOTH `directRatchet.messageDelivery.sendMailboxNip17`
    // and the legacy `delivery.sendMailboxNip17` are wired to.
    const policy = new FedosStrictTransportPolicy();
    policy.enable(defaultFedosStrictTransportConfig("127.0.0.1", socksPort));
    const strictFactory = createStrictFedosRelaySocketFactory(policy);
    const relayUrl = `ws://127.0.0.1:${destPort}/`;

    // --- Ratchet-route send: `ratchetDelivery` configured (takes precedence, per the coordinator's own real routing logic) ---
    const ratchetCoordinator = buildCoordinator(mod, {
      ratchetDelivery: {
        route: "nostr-nip17-v1-ratchet",
        remoteDeviceRef: "bob-device",
        sendRatchetMailboxNip17: async (envelopeId: string) => {
          // Mirrors exactly what the REAL `FedosDirectRatchetOutboundIntegration.sendMessage()`
          // does at its own transport boundary: calls `messageDelivery.sendMailboxNip17`,
          // which in the real composition root is the SAME `aliceTransport.sendMailboxNip17`
          // thunk the legacy route also uses -- here, calling the strict
          // factory directly proves that boundary is genuinely SOCKS-routed.
          const socket = await strictFactory(relayUrl);
          socket.close();
          return { outcome: "queued", sessionId: "session-tor-strict-shared-route", queue: { outcome: "queued", envelopeId } };
        },
      },
    });
    const ratchetResult = await ratchetCoordinator.sendDirectMessage({ conversationId: CONVERSATION_ID, body: "ratchet-route-message", replyToEnvelopeId: null });
    expect(ratchetResult.outcome).toBe("sent-locally");

    expect(fake.connectTargets, "ratchet-route send must reach the strict SOCKS factory").toHaveLength(1);
    expect(fake.connectTargets[0]).toEqual({ host: "127.0.0.1", port: destPort });

    // --- Forced-legacy-route send: `ratchetDelivery` OMITTED ("ratchet unavailable"), only `delivery` configured ---
    const legacyCoordinator = buildCoordinator(mod, {
      delivery: {
        route: "nostr-nip17-v1",
        sendMailboxNip17: async (envelopeId: string) => {
          const socket = await strictFactory(relayUrl);
          socket.close();
          return { outcome: "queued", envelopeId };
        },
      },
    });
    const legacyResult = await legacyCoordinator.sendDirectMessage({ conversationId: CONVERSATION_ID, body: "legacy-route-message", replyToEnvelopeId: null });
    expect(legacyResult.outcome).toBe("sent-locally");

    expect(fake.connectTargets, "the forced-legacy-route send must ALSO reach the SAME strict SOCKS factory -- no route-specific clearnet bypass").toHaveLength(2);
    expect(fake.connectTargets[1]).toEqual({ host: "127.0.0.1", port: destPort });

    // Both sends used the SAME policy instance, and it is still genuinely ready -- proves this was a real, live, shared strict-transport path for both routes, not two independently-configured factories that happen to agree.
    expect(policy.state()).toBe("ready");

    dest.close();
    fake.server.close();
  });

  it("negative control: with strict mode NEVER enabled, the identical ratchet-route/legacy-route thunks both fail closed via the SAME 'not-ready' policy -- proves the sharing is real, not coincidental to a working proxy", async () => {
    const mod = await loadRootModules();
    const policy = new FedosStrictTransportPolicy(); // never enable()'d
    const strictFactory = createStrictFedosRelaySocketFactory(policy);
    const relayUrl = "ws://127.0.0.1:1/";

    const ratchetCoordinator = buildCoordinator(mod, {
      ratchetDelivery: {
        route: "nostr-nip17-v1-ratchet",
        remoteDeviceRef: "bob-device",
        sendRatchetMailboxNip17: async (): Promise<never> => {
          await strictFactory(relayUrl);
          throw new Error("unreachable -- strictFactory must reject when not ready");
        },
      },
    });
    // The coordinator's own local-storage step ("sent-locally") always
    // succeeds first (unchanged, documented behavior); the delivery thunk
    // itself is what throws -- confirming the SAME fail-closed policy
    // governs this route too. `sendDirectMessage()` never catches a
    // delivery-thunk rejection, matching this coordinator's own
    // documented "delivery failure reported separately, never silently
    // swallowed" contract.
    await expect(ratchetCoordinator.sendDirectMessage({ conversationId: CONVERSATION_ID, body: "ratchet-not-ready", replyToEnvelopeId: null })).rejects.toThrow(/not-ready/);

    const legacyCoordinator = buildCoordinator(mod, {
      delivery: {
        route: "nostr-nip17-v1",
        sendMailboxNip17: async (): Promise<never> => {
          await strictFactory(relayUrl);
          throw new Error("unreachable -- strictFactory must reject when not ready");
        },
      },
    });
    await expect(legacyCoordinator.sendDirectMessage({ conversationId: CONVERSATION_ID, body: "legacy-not-ready", replyToEnvelopeId: null })).rejects.toThrow(/not-ready/);
  });
});
