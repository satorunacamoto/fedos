/**
 * Secure Runtime Alpha 1391–1470 — Nostr Private Direct and Pairwise
 * Fanout Delivery Arc. Phase B/D/G verification: Alice and Bob, each a
 * real, independent `startFedosDesktopRuntime()` instance with a REAL
 * Nostr keypair (Schnorr, `@noble/curves`, mirroring
 * `test/secure_runtime_alpha_713_failure_matrix_and_safety.test.ts`'s
 * own `realSigningAuthority()` helper) and Fake Encryption/Decryption
 * Authorities (the SAME baseline verification tier every earlier Arc's
 * own default test uses).
 *
 * Membership/draft/activation logs are SHARED file paths between Alice's
 * and Bob's own runtime instances (the SAME "closest honest in-process
 * model of two participants" simplification
 * `test/secure_runtime_alpha_1261_1320_real_crypto_vertical_slice.test.ts`
 * already establishes and documents — Nostr-delivered invitation
 * transport is explicitly a separate, unbuilt concern, out of THIS Arc's
 * own scope). Envelope/payload/private-delivery logs are SEPARATE per
 * participant — this is the actual boundary this Arc's own delivery
 * layer is being verified across: Bob's local Envelope store starts
 * EMPTY and is populated ONLY via the real signed-event wire path.
 *
 * Alice sends -> real signed private event -> a Relay double that
 * auto-ACKs -> the SAME real signed event runs through the EXISTING,
 * unmodified `validateInboundNostrEvent()` -> Bob's inbound coordinator
 * unwraps/decrypts/imports -> Bob reads the exact plaintext through the
 * UNCHANGED `readDirectMessage()`. Then: restart-safe idempotency (no
 * duplicate publish, no duplicate import), tamper detection, wrong-
 * recipient denial, and public-kind isolation.
 */
import { describe, it, expect } from "vitest";
// @ts-expect-error `node:fs` has no type declarations without `@types/node` in this project's tsconfig.
import { mkdtempSync } from "node:fs";
// @ts-expect-error see above.
import { tmpdir } from "node:os";
// @ts-expect-error see above.
import { join } from "node:path";
import { schnorr } from "@noble/curves/secp256k1.js";
import { bytesToHex, hexToBytes } from "@noble/hashes/utils.js";
import { sha256 } from "@noble/hashes/sha2.js";
// @ts-expect-error see above.
import { Buffer } from "node:buffer";

import { startFedosDesktopRuntime } from "../src/os/messenger/desktop/runtime/fedos_desktop_runtime.js";
import type { FedosDesktopRuntimeConfig } from "../src/os/messenger/desktop/runtime/fedos_desktop_runtime_config.js";
import { StaticFedosConversationCreatorIdentityAuthority } from "../src/os/messenger/conversations/construction/fedos_conversation_creator_identity_authority.js";
import { toFedosConversationInvitationToken } from "../src/os/messenger/conversations/invitation/fedos_conversation_invitation_token.js";
import type {
  FedosConversationEncryptionAuthority,
  FedosConversationEncryptionRequest,
  FedosConversationEncryptionResult,
} from "../src/os/messenger/conversations/encryption/fedos_conversation_encryption_authority.js";
import type {
  FedosConversationDecryptionAuthority,
  FedosConversationDecryptionRequest,
  FedosConversationDecryptionResult,
} from "../src/os/messenger/conversations/encryption/fedos_conversation_decryption_authority.js";
import type { FedosConversationParticipantReference } from "../src/os/messenger/conversations/membership/fedos_conversation_participant_reference.js";
import type {
  FedosNostrSigningAuthority,
  FedosNostrUnsignedEventRequest,
} from "../src/os/messenger/adapters/nostr/protocol/sign/fedos_nostr_signing_authority.js";
import type { FedosNostrWireEvent } from "../src/os/messenger/desktop/fedos_nostr_wire_event.js";
import type { FedosRelay } from "../src/os/messenger/desktop/fedos_relay.js";
import type { FedosEventDescriptor } from "../src/os/messenger/desktop/fedos_event_descriptor.js";
import type { FedosRelayMessageListener, FedosSubscriptionListener } from "../src/os/messenger/desktop/fedos_relay_listeners.js";
import type { FedosSubscription } from "../src/os/messenger/desktop/fedos_subscription.js";
import type { FedosSubscriptionFilter } from "../src/os/messenger/desktop/fedos_subscription_filter.js";
import { FedosRelayOkCorrelatedPrivateNostrDeliveryPublisher } from "../src/os/messenger/adapters/nostr/conversation_delivery/fedos_private_nostr_delivery_publisher.js";
import { FedosSigningAuthorityNostrAuthorBinding } from "../src/os/messenger/board/runtime/identity/fedos_nostr_author_binding_authority.js";
import { validateInboundNostrEvent } from "../src/os/messenger/desktop/combined_inbound_event_validator.js";
import { FEDOS_PRIVATE_NOSTR_DELIVERY_KIND } from "../src/os/messenger/adapters/nostr/conversation_delivery/fedos_private_nostr_delivery_mode.js";

/**
 * Every prior Arc's own Fake Authority pair (e.g.
 * `test/secure_runtime_alpha_1321_1390_group_vertical_slice.test.ts`)
 * builds its marker from `localAccountIndex`/`counterpartyPublicKeyHex`
 * alone -- correct ONLY when encrypt and decrypt happen against the SAME
 * local runtime's own single fixed identity (every prior Arc's own test
 * shape, since none of them delivers across two independent runtimes).
 * THIS Arc is the first to decrypt on a genuinely SEPARATE participant's
 * own runtime, so the marker must be symmetric the way real ECDH is
 * (`ECDH(Alice_priv, Bob_pub) === ECDH(Bob_priv, Alice_pub)`) -- built
 * here from the SORTED pair of both real pubkeys, known to each fake
 * Authority instance via its own closure (`ownPubkey`).
 */
function fakeSymmetricMarker(ownPubkey: string, counterpartyPublicKeyHex: string): Uint8Array {
  const pair = [ownPubkey, counterpartyPublicKeyHex].sort().join(":");
  return new TextEncoder().encode(`FAKE:${pair}:`);
}
class FakeEncryptionAuthority implements FedosConversationEncryptionAuthority {
  readonly #ownPubkey: string;
  constructor(ownPubkey: string) {
    this.#ownPubkey = ownPubkey;
  }
  async encrypt(request: FedosConversationEncryptionRequest): Promise<FedosConversationEncryptionResult> {
    const marker = fakeSymmetricMarker(this.#ownPubkey, request.counterpartyPublicKeyHex);
    const out = new Uint8Array(marker.length + request.plaintext.length);
    out.set(marker, 0);
    out.set(request.plaintext, marker.length);
    return { outcome: "encrypted", ciphertext: out };
  }
}
class FakeDecryptionAuthority implements FedosConversationDecryptionAuthority {
  readonly #ownPubkey: string;
  constructor(ownPubkey: string) {
    this.#ownPubkey = ownPubkey;
  }
  async decrypt(request: FedosConversationDecryptionRequest): Promise<FedosConversationDecryptionResult> {
    const marker = fakeSymmetricMarker(this.#ownPubkey, request.counterpartyPublicKeyHex);
    if (request.ciphertext.length < marker.length) return { outcome: "failed" };
    for (let i = 0; i < marker.length; i += 1) {
      if (request.ciphertext[i] !== marker[i]) return { outcome: "failed" };
    }
    return { outcome: "decrypted", plaintext: request.ciphertext.subarray(marker.length) };
  }
}

function realSigningAuthority(secretKey: Uint8Array): FedosNostrSigningAuthority {
  const publicKeyHex = bytesToHex(schnorr.getPublicKey(secretKey));
  return {
    async publicIdentityForAccount(accountIndex: number) {
      if (accountIndex !== 0) return null;
      return { accountIndex: 0, publicKeyHex };
    },
    async signEvent(request: FedosNostrUnsignedEventRequest): Promise<FedosNostrWireEvent | null> {
      const preimage = JSON.stringify([0, publicKeyHex, request.createdAt, request.kind, request.tags, request.content]);
      const id = bytesToHex(sha256(new TextEncoder().encode(preimage)));
      const sig = bytesToHex(schnorr.sign(hexToBytes(id), secretKey));
      return Object.freeze({
        id,
        pubkey: publicKeyHex,
        created_at: request.createdAt,
        kind: request.kind,
        tags: request.tags,
        content: request.content,
        sig,
      });
    },
  };
}

/** A Relay double that auto-ACKs (or rejects, once armed) every publish and records every published event -- mirrors `test/secure_runtime_alpha_713_failure_matrix_and_safety.test.ts`'s own `RecordingRelay` exactly. */
class RecordingRelay implements FedosRelay {
  readonly url = "wss://fake-relay.test";
  #connected = true;
  #relayListener: FedosRelayMessageListener | undefined;
  readonly published: FedosEventDescriptor[] = [];
  #acceptNext = true;
  rejectNext(): void {
    this.#acceptNext = false;
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
    this.published.push(event);
    const accepted = this.#acceptNext;
    this.#acceptNext = true;
    this.#relayListener?.({ kind: "ok", eventId: event.id, accepted, message: accepted ? "" : "rejected" });
  }
  async subscribe(_filters: readonly FedosSubscriptionFilter[]): Promise<FedosSubscription> {
    throw new Error("not used");
  }
  async unsubscribe(): Promise<void> {}
  onSubscriptionMessage(_subscription: FedosSubscription, _listener: FedosSubscriptionListener): void {}
  onRelayMessage(listener: FedosRelayMessageListener): void {
    this.#relayListener = listener;
  }
}

function nostrWireEventFromDescriptor(event: FedosEventDescriptor): FedosNostrWireEvent {
  return Object.freeze({
    id: event.id,
    pubkey: event.author,
    created_at: event.createdAt,
    kind: event.kind,
    tags: event.tags,
    content: event.content,
    sig: event.signature,
  });
}

const ALICE_SECRET = new Uint8Array(32).fill(1);
const BOB_SECRET = new Uint8Array(32).fill(2);
const ALICE_PUBKEY = bytesToHex(schnorr.getPublicKey(ALICE_SECRET));
const BOB_PUBKEY = bytesToHex(schnorr.getPublicKey(BOB_SECRET));
const MALLORY_SECRET = new Uint8Array(32).fill(3);
const MALLORY_PUBKEY = bytesToHex(schnorr.getPublicKey(MALLORY_SECRET));

const ALICE_PARTICIPANT: FedosConversationParticipantReference = { authority: "nostr", publicIdentifier: ALICE_PUBKEY, identityId: null };
const BOB_PARTICIPANT: FedosConversationParticipantReference = { authority: "nostr", publicIdentifier: BOB_PUBKEY, identityId: null };

interface SharedPaths {
  readonly draftLogPath: string;
  readonly membershipLogPath: string;
  readonly capabilityLogPath: string;
  readonly constructionCoordinationLogPath: string;
  readonly activationCoordinationLogPath: string;
  readonly invitationRevocationLogPath: string;
}

function buildSharedPaths(dir: string): SharedPaths {
  return {
    draftLogPath: join(dir, "draft.log"),
    membershipLogPath: join(dir, "membership.log"),
    capabilityLogPath: join(dir, "capability.log"),
    constructionCoordinationLogPath: join(dir, "construction-coordination.log"),
    activationCoordinationLogPath: join(dir, "activation.log"),
    invitationRevocationLogPath: join(dir, "invitation-revocation.log"),
  };
}

function participantConfig(
  ownDir: string,
  shared: SharedPaths,
  creator: FedosConversationParticipantReference,
  relay: RecordingRelay,
  signingAuthority: FedosNostrSigningAuthority,
): FedosDesktopRuntimeConfig {
  return {
    boardLogPath: join(ownDir, "board.log"),
    outboxLogPath: join(ownDir, "outbox.log"),
    deliveryEnabled: false,
    conversationDraftLogPath: shared.draftLogPath,
    conversationMembershipLogPath: shared.membershipLogPath,
    conversationCapabilityLogPath: shared.capabilityLogPath,
    conversationConstructionCoordinationLogPath: shared.constructionCoordinationLogPath,
    conversationActivationCoordinationLogPath: shared.activationCoordinationLogPath,
    conversationInvitationRevocationLogPath: shared.invitationRevocationLogPath,
    conversationEnvelopeLogPath: join(ownDir, "envelope.log"),
    conversationPayloadLogPath: join(ownDir, "payload.log"),
    conversationEncryptionCoordinationLogPath: join(ownDir, "encryption-coordination.log"),
    conversationPayloadRetentionLogPath: join(ownDir, "retention.log"),
    conversationPrivateNostrDeliveryRequestLogPath: join(ownDir, "private-delivery-request.log"),
    conversationPrivateNostrImportRecordLogPath: join(ownDir, "private-import-record.log"),
    conversationPrivateNostrDeliveryObservationLogPath: join(ownDir, "private-delivery-observation.log"),
    conversationCreatorIdentityAuthority: new StaticFedosConversationCreatorIdentityAuthority(creator),
    conversationEncryptionAuthority: new FakeEncryptionAuthority(creator.publicIdentifier),
    conversationDecryptionAuthority: new FakeDecryptionAuthority(creator.publicIdentifier),
    // A "nostr"-authority local creator identity requires a real Nostr
    // Author Binding Authority to prove account-index-to-pubkey ownership
    // (Alpha 935, unmodified) -- omitted, encryption/activation would fail
    // closed to "identity-binding-unavailable".
    nostrAuthorBindingAuthority: new FedosSigningAuthorityNostrAuthorBinding(signingAuthority),
    conversationPrivateNostrSigningAuthority: signingAuthority,
    conversationPrivateNostrDeliveryPublisher: new FedosRelayOkCorrelatedPrivateNostrDeliveryPublisher(relay),
    conversationPrivateNostrDefaultRelayUrls: [relay.url],
    conversationPrivateNostrDefaultMode: "mailbox",
    clock: () => 1_716_000_000,
  };
}

describe("Alpha 1391-1470 -- Direct private delivery vertical slice", () => {
  it("1. Alice sends -> real signed event -> Relay ACK -> Bob receives/imports/decrypts -> exact plaintext -> restart-safe idempotency -> tamper/wrong-recipient/public-isolation", async () => {
    const rootDir = mkdtempSync(join(tmpdir(), "fedos-1391-1470-direct-"));
    const shared = buildSharedPaths(rootDir);
    const aliceDir = mkdtempSync(join(tmpdir(), "fedos-1391-1470-alice-"));
    const bobDir = mkdtempSync(join(tmpdir(), "fedos-1391-1470-bob-"));
    const aliceRelay = new RecordingRelay();
    const bobRelay = new RecordingRelay();

    let alice = await startFedosDesktopRuntime(participantConfig(aliceDir, shared, ALICE_PARTICIPANT, aliceRelay, realSigningAuthority(ALICE_SECRET)));
    let bob = await startFedosDesktopRuntime(participantConfig(bobDir, shared, BOB_PARTICIPANT, bobRelay, realSigningAuthority(BOB_SECRET)));

    // Real Direct draft + recipient-bound Capability, real redemption, real Membership.
    const created = alice.conversationRuntime().createDirectDraft({ recipient: BOB_PARTICIPANT });
    expect(created.outcome).toBe("draft-created");
    if (created.outcome !== "draft-created") throw new Error("expected draft-created");
    const conversationId = created.draft.id;
    expect(created.capability).toBeDefined();

    const token = toFedosConversationInvitationToken(created.capability!.descriptor.capabilityId, created.capability!.bearerSecret);
    const redemption = bob.conversationRuntime().redeemInvitation(token, BOB_PARTICIPANT);
    expect(redemption.outcome).toBe("redeemed");

    expect(await alice.conversationRuntime().activateDirectConversation(conversationId)).toEqual({ outcome: "activated" });
    expect(await bob.conversationRuntime().activateDirectConversation(conversationId)).toEqual({ outcome: "already-active" });

    const bobMembership = alice.conversationRuntime().listMemberships(conversationId).find((m) => m.participant.publicIdentifier === BOB_PUBKEY);
    expect(bobMembership).toBeDefined();

    // Bob's local Envelope store starts empty -- nothing has crossed the wire yet.
    expect(bob.conversationRuntime().listDirectMessages(conversationId)).toHaveLength(0);

    const plaintext = "hello bob, this is a real Nostr-signed private delivery";
    const sent = await alice.conversationRuntime().sendDirectMessage({ conversationId, body: plaintext, replyToEnvelopeId: null });
    expect(sent.outcome).toBe("sent-locally");
    if (sent.outcome !== "sent-locally") throw new Error("expected sent-locally");

    const delivery = await alice.conversationRuntime().privateNostrDelivery().deliverDirectMessage(conversationId, sent.envelopeId, bobMembership!.id as unknown as string);
    expect(delivery.outcome).toBe("accepted");
    expect(aliceRelay.published).toHaveLength(1);
    // Alpha 1447 -- Public Isolation: never kind-1, the public post kind.
    expect(aliceRelay.published[0]!.kind).toBe(FEDOS_PRIVATE_NOSTR_DELIVERY_KIND);
    expect(aliceRelay.published[0]!.kind).not.toBe(1);
    // No plaintext anywhere in the wire event.
    expect(JSON.stringify(aliceRelay.published[0])).not.toContain(plaintext);

    // "Relay hop" -- the SAME real signed event, run through the EXISTING, unmodified inbound validator.
    const wireEvent = nostrWireEventFromDescriptor(aliceRelay.published[0]!);
    const validated = validateInboundNostrEvent(wireEvent);
    expect(validated).not.toBeNull();

    const received = await bob.conversationRuntime().privateNostrDelivery().receiveInboundEvent(validated!, aliceRelay.url);
    expect(received.outcome).toBe("imported");
    if (received.outcome !== "imported") throw new Error("expected imported");
    expect(received.conversationId).toBe(conversationId);

    const bobRead = await bob.conversationRuntime().readDirectMessage({ conversationId, envelopeId: received.envelopeId });
    expect(bobRead).toEqual({ outcome: "decrypted", plaintext: new TextEncoder().encode(plaintext) });
    expect(bob.conversationRuntime().listDirectMessages(conversationId)).toHaveLength(1);

    // Alpha 1427 -- duplicate detection: the identical event received again imports once.
    const receivedAgain = await bob.conversationRuntime().privateNostrDelivery().receiveInboundEvent(validated!, aliceRelay.url);
    expect(receivedAgain.outcome).toBe("duplicate");
    expect(bob.conversationRuntime().listDirectMessages(conversationId)).toHaveLength(1);

    // Alpha 1406/1410 -- restart-safe idempotency: re-delivering the SAME envelope never republishes.
    const deliverAgain = await alice.conversationRuntime().privateNostrDelivery().deliverDirectMessage(conversationId, sent.envelopeId, bobMembership!.id as unknown as string);
    expect(deliverAgain.outcome).toBe("already-delivered");
    expect(aliceRelay.published).toHaveLength(1);

    await alice.stop();
    await bob.stop();

    // Restart both -- the durable Observation persists; still no duplicate publish.
    alice = await startFedosDesktopRuntime(participantConfig(aliceDir, shared, ALICE_PARTICIPANT, aliceRelay, realSigningAuthority(ALICE_SECRET)));
    bob = await startFedosDesktopRuntime(participantConfig(bobDir, shared, BOB_PARTICIPANT, bobRelay, realSigningAuthority(BOB_SECRET)));

    const deliverAfterRestart = await alice.conversationRuntime().privateNostrDelivery().deliverDirectMessage(conversationId, sent.envelopeId, bobMembership!.id as unknown as string);
    expect(deliverAfterRestart.outcome).toBe("already-delivered");
    expect(aliceRelay.published).toHaveLength(1);

    // Bob's local canonical history survived restart.
    expect(bob.conversationRuntime().listDirectMessages(conversationId)).toHaveLength(1);
    const bobReadAfterRestart = await bob.conversationRuntime().readDirectMessage({ conversationId, envelopeId: received.envelopeId });
    expect(bobReadAfterRestart).toEqual({ outcome: "decrypted", plaintext: new TextEncoder().encode(plaintext) });

    // Alpha 1455 -- tamper: flip a ciphertext byte inside the wire payload, re-sign with Alice's OWN key (a valid
    // signature proves only "Alice signed this content," never "the ciphertext inside is uncorrupted" -- that is the
    // AEAD's own, separate job). Decrypt must fail closed; nothing is imported. Flips byte 0 (inside the Fake
    // Authority's own marker-prefix range, its stand-in for AEAD tag verification) rather than the last byte, since
    // the Fake Authority -- unlike a real AEAD -- verifies only its own fixed-length prefix, never the full ciphertext.
    const wirePayloadJson = JSON.parse(Buffer.from(wireEvent.content, "base64").toString("utf8"));
    const ciphertextBytes = Buffer.from(wirePayloadJson.ciphertextBase64, "base64");
    ciphertextBytes[0] = ciphertextBytes[0]! ^ 0xff;
    const tamperedPayload = { ...wirePayloadJson, ciphertextBase64: ciphertextBytes.toString("base64") };
    const tamperedContent = Buffer.from(JSON.stringify(tamperedPayload)).toString("base64");
    const tamperPreimage = JSON.stringify([0, ALICE_PUBKEY, wireEvent.created_at + 1, wireEvent.kind, wireEvent.tags, tamperedContent]);
    const tamperedId = bytesToHex(sha256(new TextEncoder().encode(tamperPreimage)));
    const tamperedEvent: FedosNostrWireEvent = Object.freeze({
      id: tamperedId,
      pubkey: ALICE_PUBKEY,
      created_at: wireEvent.created_at + 1,
      kind: wireEvent.kind,
      tags: wireEvent.tags,
      content: tamperedContent,
      sig: bytesToHex(schnorr.sign(hexToBytes(tamperedId), ALICE_SECRET)),
    });
    const tamperedValidated = validateInboundNostrEvent(tamperedEvent);
    expect(tamperedValidated).not.toBeNull();
    const tamperedResult = await bob.conversationRuntime().privateNostrDelivery().receiveInboundEvent(tamperedValidated!, aliceRelay.url);
    expect(tamperedResult.outcome).toBe("decryption-failed");
    expect(bob.conversationRuntime().listDirectMessages(conversationId)).toHaveLength(1);

    // Alpha 1420 -- wrong recipient: an event tagged for Mallory, not Bob, is denied before any decrypt attempt.
    const wrongRecipientPreimage = JSON.stringify([0, ALICE_PUBKEY, wireEvent.created_at + 2, wireEvent.kind, [["p", MALLORY_PUBKEY]], wireEvent.content]);
    const wrongRecipientId = bytesToHex(sha256(new TextEncoder().encode(wrongRecipientPreimage)));
    const wrongRecipientEvent: FedosNostrWireEvent = Object.freeze({
      id: wrongRecipientId,
      pubkey: ALICE_PUBKEY,
      created_at: wireEvent.created_at + 2,
      kind: wireEvent.kind,
      tags: [["p", MALLORY_PUBKEY]],
      content: wireEvent.content,
      sig: bytesToHex(schnorr.sign(hexToBytes(wrongRecipientId), ALICE_SECRET)),
    });
    const wrongRecipientValidated = validateInboundNostrEvent(wrongRecipientEvent);
    expect(wrongRecipientValidated).not.toBeNull();
    const wrongRecipientResult = await bob.conversationRuntime().privateNostrDelivery().receiveInboundEvent(wrongRecipientValidated!, aliceRelay.url);
    expect(wrongRecipientResult.outcome).toBe("not-for-local-identity");

    await alice.stop();
    await bob.stop();
  });

  it("2. a genuine Relay rejection is a terminal outcome, distinct from Relay ACK acceptance -- never conflated with recipient delivery", async () => {
    const rootDir = mkdtempSync(join(tmpdir(), "fedos-1391-1470-reject-"));
    const shared = buildSharedPaths(rootDir);
    const aliceDir = mkdtempSync(join(tmpdir(), "fedos-1391-1470-reject-alice-"));
    const bobDir = mkdtempSync(join(tmpdir(), "fedos-1391-1470-reject-bob-"));
    const aliceRelay = new RecordingRelay();
    const bobRelay = new RecordingRelay();

    const alice = await startFedosDesktopRuntime(participantConfig(aliceDir, shared, ALICE_PARTICIPANT, aliceRelay, realSigningAuthority(ALICE_SECRET)));
    const bob = await startFedosDesktopRuntime(participantConfig(bobDir, shared, BOB_PARTICIPANT, bobRelay, realSigningAuthority(BOB_SECRET)));

    const created = alice.conversationRuntime().createDirectDraft({ recipient: BOB_PARTICIPANT });
    if (created.outcome !== "draft-created") throw new Error("expected draft-created");
    const conversationId = created.draft.id;
    const token = toFedosConversationInvitationToken(created.capability!.descriptor.capabilityId, created.capability!.bearerSecret);
    bob.conversationRuntime().redeemInvitation(token, BOB_PARTICIPANT);
    await alice.conversationRuntime().activateDirectConversation(conversationId);
    const bobMembership = alice.conversationRuntime().listMemberships(conversationId).find((m) => m.participant.publicIdentifier === BOB_PUBKEY)!;

    const sent = await alice.conversationRuntime().sendDirectMessage({ conversationId, body: "will be rejected", replyToEnvelopeId: null });
    if (sent.outcome !== "sent-locally") throw new Error("expected sent-locally");

    aliceRelay.rejectNext();
    const delivery = await alice.conversationRuntime().privateNostrDelivery().deliverDirectMessage(conversationId, sent.envelopeId, bobMembership.id as unknown as string);
    // Alpha 1408/1409 -- a genuine Relay rejection is its OWN distinct, terminal outcome -- never conflated with
    // "accepted" (Relay acceptance), "failed" (transient transport failure), or recipient delivery/decryption (this
    // coordinator has no visibility into either of those). This coordinator performs no automatic retry of its own
    // (Alpha 1407's own "do not modify the generic Scheduler's protocol neutrality" -- no NEW protocol-specific
    // scheduler wrapper is built here either); a caller consulting the durable Observation record decides whether to
    // re-attempt, exactly as the Board's own Scheduler already consults `retryPolicy` for the generic Outbox.
    expect(delivery.outcome).toBe("rejected");
    expect(delivery.outcome).not.toBe("accepted");
    expect(delivery.outcome).not.toBe("failed");

    await alice.stop();
    await bob.stop();
  });
});
