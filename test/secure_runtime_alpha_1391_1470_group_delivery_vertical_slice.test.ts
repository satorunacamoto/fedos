/**
 * Secure Runtime Alpha 1391–1470 — Nostr Private Direct and Pairwise
 * Fanout Delivery Arc. Phase C/D/G verification: a 3-member group (Alice
 * the sender, Bob and Carol the recipients), each with a REAL Nostr
 * keypair, delivered over the SAME Group Pairwise Fanout Planner
 * (`FedosPrivateNostrGroupDeliveryPlanner`) reusing the EXISTING, real
 * `src/conversation/group/` domain (Alpha 1321–1390, unmodified).
 *
 * Group/Membership/Direct-path establishment logs are SHARED file paths
 * (the SAME "closest honest in-process model" simplification the Direct
 * vertical slice test already documents); each participant's own
 * Envelope/Payload/private-delivery logs are SEPARATE -- Bob's and
 * Carol's own local Envelope stores start EMPTY and are populated ONLY
 * via the real signed-event wire path, independently of one another.
 */
import { describe, it, expect } from "vitest";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { schnorr } from "@noble/curves/secp256k1.js";
import { bytesToHex, hexToBytes } from "@noble/hashes/utils.js";
import { sha256 } from "@noble/hashes/sha2.js";

import { startFedosDesktopRuntime } from "../src/os/messenger/desktop/runtime/fedos_desktop_runtime.js";
import type { FedosDesktopRuntimeConfig } from "../src/os/messenger/desktop/runtime/fedos_desktop_runtime_config.js";
import { StaticFedosConversationCreatorIdentityAuthority } from "../src/os/messenger/conversations/construction/fedos_conversation_creator_identity_authority.js";
import { FedosSigningAuthorityNostrAuthorBinding } from "../src/os/messenger/board/runtime/identity/fedos_nostr_author_binding_authority.js";
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
import { validateInboundNostrEvent } from "../src/os/messenger/desktop/combined_inbound_event_validator.js";

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

class RecordingRelay implements FedosRelay {
  readonly url: string;
  #connected = true;
  #relayListener: FedosRelayMessageListener | undefined;
  readonly published: FedosEventDescriptor[] = [];
  constructor(url: string) {
    this.url = url;
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
    this.#relayListener?.({ kind: "ok", eventId: event.id, accepted: true, message: "" });
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

const ALICE_SECRET = new Uint8Array(32).fill(11);
const BOB_SECRET = new Uint8Array(32).fill(12);
const CAROL_SECRET = new Uint8Array(32).fill(13);
const ALICE_PUBKEY = bytesToHex(schnorr.getPublicKey(ALICE_SECRET));
const BOB_PUBKEY = bytesToHex(schnorr.getPublicKey(BOB_SECRET));
const CAROL_PUBKEY = bytesToHex(schnorr.getPublicKey(CAROL_SECRET));

const ALICE_PARTICIPANT: FedosConversationParticipantReference = { authority: "nostr", publicIdentifier: ALICE_PUBKEY, identityId: null };
const BOB_PARTICIPANT: FedosConversationParticipantReference = { authority: "nostr", publicIdentifier: BOB_PUBKEY, identityId: null };
const CAROL_PARTICIPANT: FedosConversationParticipantReference = { authority: "nostr", publicIdentifier: CAROL_PUBKEY, identityId: null };

interface SharedPaths {
  readonly draftLogPath: string;
  readonly membershipLogPath: string;
  readonly capabilityLogPath: string;
  readonly constructionCoordinationLogPath: string;
  readonly activationCoordinationLogPath: string;
  readonly invitationRevocationLogPath: string;
  readonly groupGenerationLogPath: string;
  readonly groupDirectPathLogPath: string;
}

function buildSharedPaths(dir: string): SharedPaths {
  return {
    draftLogPath: join(dir, "draft.log"),
    membershipLogPath: join(dir, "membership.log"),
    capabilityLogPath: join(dir, "capability.log"),
    constructionCoordinationLogPath: join(dir, "construction-coordination.log"),
    activationCoordinationLogPath: join(dir, "activation.log"),
    invitationRevocationLogPath: join(dir, "invitation-revocation.log"),
    groupGenerationLogPath: join(dir, "group-generation.log"),
    groupDirectPathLogPath: join(dir, "group-path.log"),
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
    conversationGroupGenerationLogPath: shared.groupGenerationLogPath,
    conversationGroupDirectPathLogPath: shared.groupDirectPathLogPath,
    conversationEnvelopeLogPath: join(ownDir, "envelope.log"),
    conversationPayloadLogPath: join(ownDir, "payload.log"),
    conversationEncryptionCoordinationLogPath: join(ownDir, "encryption-coordination.log"),
    conversationPayloadRetentionLogPath: join(ownDir, "retention.log"),
    conversationGroupMessageLogPath: join(ownDir, "group-message.log"),
    conversationGroupFanoutDeliveryLogPath: join(ownDir, "group-delivery.log"),
    conversationPrivateNostrDeliveryRequestLogPath: join(ownDir, "private-delivery-request.log"),
    conversationPrivateNostrImportRecordLogPath: join(ownDir, "private-import-record.log"),
    conversationPrivateNostrDeliveryObservationLogPath: join(ownDir, "private-delivery-observation.log"),
    conversationCreatorIdentityAuthority: new StaticFedosConversationCreatorIdentityAuthority(creator),
    conversationEncryptionAuthority: new FakeEncryptionAuthority(creator.publicIdentifier),
    conversationDecryptionAuthority: new FakeDecryptionAuthority(creator.publicIdentifier),
    nostrAuthorBindingAuthority: new FedosSigningAuthorityNostrAuthorBinding(signingAuthority),
    conversationPrivateNostrSigningAuthority: signingAuthority,
    conversationPrivateNostrDeliveryPublisher: new FedosRelayOkCorrelatedPrivateNostrDeliveryPublisher(relay),
    conversationPrivateNostrDefaultRelayUrls: [relay.url],
    conversationPrivateNostrDefaultMode: "mailbox",
    clock: () => 1_717_000_000,
  };
}

describe("Alpha 1391-1470 -- Group pairwise fanout private delivery vertical slice", () => {
  it("1. Alice sends a group message -> two independent recipient-specific signed events -> Bob and Carol each import independently -> no shared ciphertext -> removed member excluded from next send's delivery", async () => {
    const rootDir = mkdtempSync(join(tmpdir(), "fedos-1391-1470-group-"));
    const shared = buildSharedPaths(rootDir);
    const aliceDir = mkdtempSync(join(tmpdir(), "fedos-1391-1470-group-alice-"));
    const bobDir = mkdtempSync(join(tmpdir(), "fedos-1391-1470-group-bob-"));
    const carolDir = mkdtempSync(join(tmpdir(), "fedos-1391-1470-group-carol-"));
    const aliceRelay = new RecordingRelay("wss://alice-relay.test");
    const bobRelay = new RecordingRelay("wss://bob-relay.test");
    const carolRelay = new RecordingRelay("wss://carol-relay.test");

    const alice = await startFedosDesktopRuntime(participantConfig(aliceDir, shared, ALICE_PARTICIPANT, aliceRelay, realSigningAuthority(ALICE_SECRET)));
    const bob = await startFedosDesktopRuntime(participantConfig(bobDir, shared, BOB_PARTICIPANT, bobRelay, realSigningAuthority(BOB_SECRET)));
    const carol = await startFedosDesktopRuntime(participantConfig(carolDir, shared, CAROL_PARTICIPANT, carolRelay, realSigningAuthority(CAROL_SECRET)));

    const created = alice.conversationRuntime().createPrivateGroupDraft({});
    expect(created.outcome).toBe("draft-created");
    if (created.outcome !== "draft-created") throw new Error("expected draft-created");
    const groupId = created.draft.id;
    const gr = alice.conversationRuntime().groupRuntime();

    expect((await gr.addPrivateGroupMember(groupId, BOB_PARTICIPANT)).outcome).toBe("admitted");
    expect((await gr.addPrivateGroupMember(groupId, CAROL_PARTICIPANT)).outcome).toBe("admitted");

    const groupBody = "hello group, this is a real Nostr-signed pairwise fanout delivery";
    const sendResult = await gr.sendPrivateGroupMessage({ groupConversationId: groupId, body: groupBody, replyToGroupMessageId: null });
    expect(sendResult.outcome).toBe("stored-for-all");
    if (sendResult.outcome !== "stored-for-all") throw new Error("expected stored-for-all");
    expect(sendResult.recipientEnvelopeIds).toHaveLength(2);

    // Bob and Carol's own local Envelope stores start empty -- nothing has crossed the wire yet.
    expect(bob.conversationRuntime().listDirectMessages).toBeDefined();

    const delivery = await alice.conversationRuntime().privateNostrDelivery().deliverGroupMessage(sendResult.groupMessageId);
    expect(delivery.outcome).toBe("planned");
    if (delivery.outcome !== "planned") throw new Error("expected planned");
    expect(delivery.perRecipient).toHaveLength(2);
    for (const r of delivery.perRecipient) expect(r.result.outcome).toBe("accepted");

    // Alpha 1412 -- two independent recipient-specific wrapped events, published to the SAME sender-selected relay set (never one shared group event).
    expect(aliceRelay.published).toHaveLength(2);
    const [eventA, eventB] = aliceRelay.published;
    expect(eventA!.id).not.toBe(eventB!.id);
    // Alpha 1402 -- no shared ciphertext across recipients.
    expect(eventA!.content).not.toBe(eventB!.content);
    const recipientTags = aliceRelay.published.map((e) => e.tags.find((t) => t[0] === "p")?.[1]);
    expect(new Set(recipientTags)).toEqual(new Set([BOB_PUBKEY, CAROL_PUBKEY]));

    // "Relay hop" -- each recipient receives ONLY the event addressed to them, and reads back the exact plaintext
    // through the UNCHANGED readDirectMessage() -- Alpha 1430's own "each recipient imports independently."
    for (const event of aliceRelay.published) {
      const wireEvent = nostrWireEventFromDescriptor(event);
      const validated = validateInboundNostrEvent(wireEvent);
      expect(validated).not.toBeNull();
      const recipientTag = wireEvent.tags.find((t) => t[0] === "p")?.[1];
      const receiver = recipientTag === BOB_PUBKEY ? bob : carol;
      const other = recipientTag === BOB_PUBKEY ? carol : bob;

      const received = await receiver.conversationRuntime().privateNostrDelivery().receiveInboundEvent(validated!, aliceRelay.url);
      expect(received.outcome).toBe("imported");
      if (received.outcome !== "imported") throw new Error("expected imported");

      const read = await receiver.conversationRuntime().readDirectMessage({ conversationId: received.conversationId, envelopeId: received.envelopeId });
      expect(read).toEqual({ outcome: "decrypted", plaintext: new TextEncoder().encode(groupBody) });

      // Alpha 1430 -- the OTHER recipient never receives or imports this event addressed to someone else.
      const wrongRecipientAttempt = await other.conversationRuntime().privateNostrDelivery().receiveInboundEvent(validated!, aliceRelay.url);
      expect(wrongRecipientAttempt.outcome).toBe("not-for-local-identity");
    }

    // Alpha 1416 -- member removal: Bob is removed; the NEXT group send excludes him entirely.
    expect((await gr.removePrivateGroupMember(groupId, BOB_PARTICIPANT)).outcome).toBe("revoked");
    const secondSend = await gr.sendPrivateGroupMessage({ groupConversationId: groupId, body: "second message, Bob is gone", replyToGroupMessageId: null });
    expect(secondSend.outcome).toBe("stored-for-all");
    if (secondSend.outcome !== "stored-for-all") throw new Error("expected stored-for-all");
    expect(secondSend.recipientEnvelopeIds).toHaveLength(1); // Carol only.

    const secondDelivery = await alice.conversationRuntime().privateNostrDelivery().deliverGroupMessage(secondSend.groupMessageId);
    expect(secondDelivery.outcome).toBe("planned");
    if (secondDelivery.outcome !== "planned") throw new Error("expected planned");
    expect(secondDelivery.perRecipient).toHaveLength(1);
    expect(aliceRelay.published).toHaveLength(3); // 2 (first send) + 1 (second send, Carol only).
    const secondRecipientTag = aliceRelay.published[2]!.tags.find((t) => t[0] === "p")?.[1];
    expect(secondRecipientTag).toBe(CAROL_PUBKEY);

    await alice.stop();
    await bob.stop();
    await carol.stop();
  });
});
