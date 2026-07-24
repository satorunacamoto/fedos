/**
 * Secure Runtime Alpha 7401-7480 (FedOS Direct Conversation Route Binding
 * and NIP-17 Inbound Isolation Arc) — Phase L: failure matrix for the
 * new route-binding domain.
 *
 * Uses the SAME real, non-mock, in-memory production port fixture style
 * `test/secure_runtime_alpha_1111_1180_direct_messaging.test.ts` already
 * established for this exact layer (a "reversible, non-cryptographic
 * seal" fake Encryption/Decryption Authority — that file's own header:
 * "proves plumbing round-trips without re-testing real AEAD"; every
 * OTHER port here is the real, production `InMemory*`/production class).
 *
 * Items proven directly here: missing binding, malformed binding,
 * unsupported version, wrong Conversation (unknown-conversation), wrong
 * Membership (membership-denied), ambiguous legacy route,
 * legacy-unambiguous acceptance, unknown sender, duplicate event.
 *
 * Items proven in OTHER files (cross-referenced, not re-proven here):
 * duplicate relay redelivery / out-of-order delivery / Relay replay —
 * `secure_runtime_alpha_7401_7480_real_vertical_slice.test.ts`; wrong
 * Device pair / wrong Ratchet generation / unknown session / revoked
 * Device / reset-required session / stale generation after restart —
 * `secure_runtime_alpha_7401_7480_ratchet_route_binding_isolation.test.ts`;
 * control payload never routed as a user message — structural guard
 * (exact, disjoint closed field sets per control-payload kind, tried in a
 * fixed dispatch order in `FedosConversationRuntime.receiveNip17Rumor()`,
 * unmodified by this Arc).
 */
import { describe, it, expect } from "vitest";

import { FedosConversationDirectMessagingCoordinator } from "../src/conversation/messaging/fedos_conversation_direct_messaging_coordinator.js";
import { InMemoryFedosConversationDraftPersistence } from "../src/conversation/construction/in_memory_fedos_conversation_draft_persistence.js";
import { InMemoryFedosConversationMembershipAuthority } from "../src/conversation/membership/in_memory_fedos_conversation_membership_authority.js";
import { InMemoryFedosConversationMessageEnvelopePersistence } from "../src/conversation/envelope/persistence/in_memory_fedos_conversation_message_envelope_persistence.js";
import { InMemoryFedosConversationPayloadStorage } from "../src/conversation/payload_storage/in_memory_fedos_conversation_payload_storage.js";
import { InMemoryFedosConversationEncryptionCoordinationPersistence } from "../src/conversation/encryption/coordination/in_memory_fedos_conversation_encryption_coordination_persistence.js";
import { InMemoryFedosPayloadRetentionPersistence } from "../src/conversation/retention/in_memory_fedos_payload_retention_persistence.js";
import { FedosPayloadRetentionAuthority } from "../src/conversation/retention/fedos_payload_retention_authority.js";
import { InMemoryFedosConversationActivationPersistence } from "../src/conversation/activation/in_memory_fedos_conversation_activation_persistence.js";
import { fedosConversationActivationId } from "../src/conversation/activation/fedos_persisted_conversation_activation_v1.js";
import { DelegatingFedosConversationIdentityResolver } from "../src/conversation/encryption/identity/fedos_conversation_identity_resolver.js";
import { MembershipFedosConversationParticipantResolver } from "../src/conversation/encryption/identity/fedos_conversation_participant_resolver.js";
import { FixedFedosConversationLocalAccountIndexAuthority } from "../src/conversation/encryption/identity/fedos_conversation_local_account_index_authority.js";
import { FedosConversationKeyResolver } from "../src/conversation/encryption/identity/fedos_conversation_key_resolver.js";
import { StaticFedosConversationCreatorIdentityAuthority } from "../src/conversation/construction/fedos_conversation_creator_identity_authority.js";
import { FedosConversationEncryptionCoordinator } from "../src/conversation/encryption/fedos_conversation_encryption_coordinator.js";
import type { FedosConversationEncryptionAuthority, FedosConversationEncryptionRequest, FedosConversationEncryptionResult } from "../src/conversation/encryption/fedos_conversation_encryption_authority.js";
import type { FedosConversationDecryptionAuthority } from "../src/conversation/encryption/fedos_conversation_decryption_authority.js";
import type { FedosPersistedConversationDraftRecordV1 } from "../src/conversation/construction/fedos_persisted_conversation_draft_record_v1.js";
import type { FedosConversationId } from "../src/conversation/fedos_conversation_id.js";
import type { FedosConversationParticipantReference } from "../src/conversation/membership/fedos_conversation_participant_reference.js";

import { FedosNip17InboundImportCoordinator } from "../src/conversation/delivery/nostr/nip17/fedos_nip17_inbound_import_coordinator.js";
import { InMemoryFedosPrivateNostrImportRecordPersistence } from "../src/conversation/delivery/nostr/in_memory_fedos_private_nostr_import_record_persistence.js";
import { encodeFedosDirectConversationPlainMessagePayload, decodeFedosDirectConversationPlainMessagePayload } from "../src/conversation/delivery/nostr/nip17/fedos_direct_conversation_plain_message_payload.js";
import {
  decodeFedosDirectRatchetNip17PayloadFromContent,
  isRecognizableFedosDirectRatchetNip17PayloadShape,
} from "../src/conversation/delivery/nostr/nip17/fedos_direct_ratchet_nip17_payload.js";
import type { FedosPrivateWireParsedRumor } from "../src/conversation/transport/fedos_private_wire_adapter.js";

const NOW = 1_720_200_000;
const ALICE: FedosConversationParticipantReference = { authority: "nostr", publicIdentifier: "a".repeat(64), identityId: null };
const BOB: FedosConversationParticipantReference = { authority: "nostr", publicIdentifier: "b".repeat(64), identityId: null };
const MALLORY: FedosConversationParticipantReference = { authority: "nostr", publicIdentifier: "c".repeat(64), identityId: null };
const CONVERSATION_A = "private-draft::direct::7401-a" as FedosConversationId;
const CONVERSATION_B = "private-draft::direct::7401-b" as FedosConversationId;
const CONVERSATION_UNKNOWN = "private-draft::direct::7401-never-created" as FedosConversationId;

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

function draftRecord(id: string, creator: FedosConversationParticipantReference): FedosPersistedConversationDraftRecordV1 {
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

/** Builds a real Alice-side inbound coordinator with TWO real, active Direct conversations with Bob (A, B) -- the same-peer ambiguity condition this Arc's own fix targets. */
function buildAliceFixture() {
  const draftPersistence = new InMemoryFedosConversationDraftPersistence();
  draftPersistence.putDraft(draftRecord(CONVERSATION_A, ALICE));
  draftPersistence.putDraft(draftRecord(CONVERSATION_B, ALICE));

  const activationPersistence = new InMemoryFedosConversationActivationPersistence();
  for (const id of [CONVERSATION_A, CONVERSATION_B]) {
    activationPersistence.putActivationFact({ schemaVersion: 1, activationId: fedosConversationActivationId(id), conversationId: id, phase: "completed", startedAt: NOW, updatedAt: NOW });
  }

  const membershipAuthority = new InMemoryFedosConversationMembershipAuthority();
  membershipAuthority.admit(CONVERSATION_A, ALICE, "owner", NOW);
  membershipAuthority.admit(CONVERSATION_A, BOB, "member", NOW);
  membershipAuthority.admit(CONVERSATION_B, ALICE, "owner", NOW);
  membershipAuthority.admit(CONVERSATION_B, BOB, "member", NOW);

  const identityResolver = new DelegatingFedosConversationIdentityResolver(new StaticFedosConversationCreatorIdentityAuthority(ALICE));
  const envelopePersistence = new InMemoryFedosConversationMessageEnvelopePersistence();
  const payloadStorage = new InMemoryFedosConversationPayloadStorage();
  const importRecordPersistence = new InMemoryFedosPrivateNostrImportRecordPersistence();

  const coordinator = new FedosNip17InboundImportCoordinator({
    draftPersistence,
    activationPersistence,
    membershipAuthority,
    identityResolver,
    localAccountIndex: 0,
    encryptionAuthority: new FakeEncryptionAuthority(),
    envelopePersistence,
    payloadStorage,
    envelopeIdGenerator: { generateEnvelopeId: () => `env-${Math.random().toString(36).slice(2)}` },
    payloadIdGenerator: { generatePayloadId: () => `pay-${Math.random().toString(36).slice(2)}` },
    importRecordPersistence,
    clock: () => NOW,
  });

  return { coordinator, draftPersistence, membershipAuthority, importRecordPersistence };
}

function rumor(overrides: Partial<FedosPrivateWireParsedRumor> & { readonly content: string }): FedosPrivateWireParsedRumor {
  return {
    envelopeId: `rumor-${Math.random().toString(36).slice(2)}`,
    senderPublicKeyHex: BOB.publicIdentifier,
    recipientPublicKeyHex: ALICE.publicIdentifier,
    createdAt: NOW,
    kind: 14,
    tags: [],
    ...overrides,
  };
}

describe("Secure Runtime Alpha 7401-7480 -- Phase L: failure matrix", () => {
  it("1. missing binding + exactly one candidate -> legacy-unambiguous, imported normally", async () => {
    const { coordinator } = buildAliceFixture();
    // Only ONE conversation exists with Mallory -- unambiguous legacy case.
    const draftPersistence = new InMemoryFedosConversationDraftPersistence();
    draftPersistence.putDraft(draftRecord("private-draft::direct::7401-mallory" as FedosConversationId, ALICE));
    const activationPersistence = new InMemoryFedosConversationActivationPersistence();
    activationPersistence.putActivationFact({
      schemaVersion: 1,
      activationId: fedosConversationActivationId("private-draft::direct::7401-mallory" as FedosConversationId),
      conversationId: "private-draft::direct::7401-mallory" as FedosConversationId,
      phase: "completed",
      startedAt: NOW,
      updatedAt: NOW,
    });
    const membershipAuthority = new InMemoryFedosConversationMembershipAuthority();
    membershipAuthority.admit("private-draft::direct::7401-mallory" as FedosConversationId, ALICE, "owner", NOW);
    membershipAuthority.admit("private-draft::direct::7401-mallory" as FedosConversationId, MALLORY, "member", NOW);
    const soloCoordinator = new FedosNip17InboundImportCoordinator({
      draftPersistence,
      activationPersistence,
      membershipAuthority,
      identityResolver: new DelegatingFedosConversationIdentityResolver(new StaticFedosConversationCreatorIdentityAuthority(ALICE)),
      localAccountIndex: 0,
      encryptionAuthority: new FakeEncryptionAuthority(),
      envelopePersistence: new InMemoryFedosConversationMessageEnvelopePersistence(),
      payloadStorage: new InMemoryFedosConversationPayloadStorage(),
      envelopeIdGenerator: { generateEnvelopeId: () => `env-${Math.random().toString(36).slice(2)}` },
      payloadIdGenerator: { generatePayloadId: () => `pay-${Math.random().toString(36).slice(2)}` },
      importRecordPersistence: new InMemoryFedosPrivateNostrImportRecordPersistence(),
      clock: () => NOW,
    });
    void coordinator;
    const result = await soloCoordinator.receiveRumor(rumor({ content: "plain legacy chat text, no binding", senderPublicKeyHex: MALLORY.publicIdentifier }), null);
    expect(result.outcome).toBe("imported");
  });

  it("2. missing binding + zero candidates -> unknown-sender", async () => {
    const { coordinator } = buildAliceFixture();
    const result = await coordinator.receiveRumor(rumor({ content: "hello from a stranger", senderPublicKeyHex: MALLORY.publicIdentifier }), null);
    expect(result.outcome).toBe("unknown-sender");
  });

  it("3. missing binding + two or more candidates -> ambiguous-legacy-route, never a first-match guess", async () => {
    const { coordinator } = buildAliceFixture();
    const result = await coordinator.receiveRumor(rumor({ content: "which conversation is this for?" }), null);
    expect(result.outcome).toBe("ambiguous-legacy-route");
  });

  it("4. malformed binding (valid JSON, wrong shape) -> malformed-binding, never falls through to legacy", async () => {
    const { coordinator } = buildAliceFixture();
    const malformed = JSON.stringify({ schemaVersion: 1, conversationId: CONVERSATION_A, body: "missing senderAccountRef/recipientAccountRef" });
    const result = await coordinator.receiveRumor(rumor({ content: malformed }), null);
    expect(result.outcome).toBe("malformed-binding");
  });

  it("5. well-formed binding naming an unknown Conversation -> unknown-conversation", async () => {
    const { coordinator } = buildAliceFixture();
    const content = encodeFedosDirectConversationPlainMessagePayload({
      schemaVersion: 1,
      conversationId: CONVERSATION_UNKNOWN,
      senderAccountRef: BOB,
      recipientAccountRef: ALICE,
      body: "for a conversation that was never created",
    });
    const result = await coordinator.receiveRumor(rumor({ content }), null);
    expect(result.outcome).toBe("unknown-conversation");
  });

  it("6. well-formed binding naming a REAL Conversation, but the sender is not a genuine active Member of it -> membership-denied", async () => {
    const { coordinator } = buildAliceFixture();
    // CONVERSATION_A's real members are Alice/Bob -- Mallory is not one.
    const content = encodeFedosDirectConversationPlainMessagePayload({
      schemaVersion: 1,
      conversationId: CONVERSATION_A,
      senderAccountRef: MALLORY,
      recipientAccountRef: ALICE,
      body: "impersonation attempt",
    });
    const result = await coordinator.receiveRumor(rumor({ content, senderPublicKeyHex: MALLORY.publicIdentifier }), null);
    expect(result.outcome).toBe("membership-denied");
  });

  it("7. a well-formed binding correctly resolves the EXACT named Conversation among two same-peer candidates -- never the other one", async () => {
    const { coordinator } = buildAliceFixture();
    const contentForB = encodeFedosDirectConversationPlainMessagePayload({
      schemaVersion: 1,
      conversationId: CONVERSATION_B,
      senderAccountRef: BOB,
      recipientAccountRef: ALICE,
      body: "correctly-routed-to-B",
    });
    const result = await coordinator.receiveRumor(rumor({ content: contentForB }), null);
    expect(result.outcome).toBe("imported");
    if (result.outcome !== "imported") throw new Error("unreachable");
    expect(result.conversationId).toBe(CONVERSATION_B);
  });

  it("8. duplicate event (same Rumor id re-delivered) is a genuine no-op, never double-imported", async () => {
    const { coordinator } = buildAliceFixture();
    const content = encodeFedosDirectConversationPlainMessagePayload({
      schemaVersion: 1,
      conversationId: CONVERSATION_A,
      senderAccountRef: BOB,
      recipientAccountRef: ALICE,
      body: "duplicate-check",
    });
    const r = rumor({ content });
    const first = await coordinator.receiveRumor(r, null);
    expect(first.outcome).toBe("imported");
    const second = await coordinator.receiveRumor(r, null);
    expect(second.outcome).toBe("duplicate");
  });

  it("9. plain-message codec: absent vs malformed are genuinely distinguishable, total, never throw", () => {
    expect(decodeFedosDirectConversationPlainMessagePayload("just some human text").outcome).toBe("absent");
    expect(decodeFedosDirectConversationPlainMessagePayload("").outcome).toBe("absent");
    expect(decodeFedosDirectConversationPlainMessagePayload("{not even valid json").outcome).toBe("absent");
    expect(decodeFedosDirectConversationPlainMessagePayload(JSON.stringify({ schemaVersion: 1 })).outcome).toBe("malformed");
    expect(decodeFedosDirectConversationPlainMessagePayload(JSON.stringify({ schemaVersion: 2, conversationId: "x", senderAccountRef: ALICE, recipientAccountRef: BOB, body: "x" })).outcome).toBe(
      "malformed",
    );
  });

  it("10. ratchet payload codec: an unrecognized schemaVersion is distinguished from 'not a ratchet payload at all' -- fails closed, never silently treated as plain chat", () => {
    const futureVersion = JSON.stringify({
      schemaVersion: 3,
      kind: "message",
      suite: "fedos-direct-ratchet-v1",
      generation: 0,
      sessionId: "s",
      messageNumber: 0,
      wireMessageBase64: "AAAA",
      conversationId: CONVERSATION_A,
    });
    expect(decodeFedosDirectRatchetNip17PayloadFromContent(futureVersion)).toBeNull();
    expect(isRecognizableFedosDirectRatchetNip17PayloadShape(futureVersion), "recognizably ratchet-shaped despite the unknown version").toBe(true);

    const genuinelyNotRatchet = "hey, how's it going?";
    expect(decodeFedosDirectRatchetNip17PayloadFromContent(genuinelyNotRatchet)).toBeNull();
    expect(isRecognizableFedosDirectRatchetNip17PayloadShape(genuinelyNotRatchet), "genuinely not ratchet-shaped -- correctly falls through to legacy").toBe(false);

    // Both schemaVersion 1 and 2 message shapes remain genuinely decodable (additive, never destructive).
    const v1 = JSON.stringify({ schemaVersion: 1, kind: "message", suite: "fedos-direct-ratchet-v1", generation: 0, sessionId: "s", messageNumber: 0, wireMessageBase64: "AAAA" });
    const v2 = JSON.stringify({
      schemaVersion: 2,
      kind: "message",
      suite: "fedos-direct-ratchet-v1",
      generation: 0,
      sessionId: "s",
      messageNumber: 0,
      wireMessageBase64: "AAAA",
      conversationId: CONVERSATION_A,
    });
    expect(decodeFedosDirectRatchetNip17PayloadFromContent(v1)).not.toBeNull();
    expect(decodeFedosDirectRatchetNip17PayloadFromContent(v2)).not.toBeNull();
  });

  it("11. a tampered/corrupted binding (truncated JSON, oversized conversationId) is rejected, never partially trusted", async () => {
    const { coordinator } = buildAliceFixture();
    const truncated = '{"schemaVersion":1,"conversationId":"' + CONVERSATION_A;
    const resultTruncated = await coordinator.receiveRumor(rumor({ content: truncated }), null);
    // Truncated JSON fails to even parse -- genuinely indistinguishable from legacy plaintext at this layer (correct: `JSON.parse` throws), so it takes the Legacy Policy path -- with 2 real candidates present, that is `"ambiguous-legacy-route"`, never a crash and never a partial/tampered accept.
    expect(resultTruncated.outcome).toBe("ambiguous-legacy-route");

    const oversizedConversationId = "x".repeat(10_000);
    const content = JSON.stringify({ schemaVersion: 1, conversationId: oversizedConversationId, senderAccountRef: BOB, recipientAccountRef: ALICE, body: "oversized id" });
    const resultOversized = await coordinator.receiveRumor(rumor({ content }), null);
    expect(resultOversized.outcome).toBe("malformed-binding");
  });
});
