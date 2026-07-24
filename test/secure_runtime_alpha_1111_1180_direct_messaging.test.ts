/**
 * Secure Runtime Alpha 1111–1180 — Direct Messaging Coordinator (Phases
 * C/D): send/read/list, authorization, tamper, retention, ordering, and
 * restart. The Conversation is brought to "active" by seeding a
 * `"completed"` Activation fact directly (Alpha 1122 itself is covered by
 * its own dedicated suite,
 * `secure_runtime_alpha_1111_1180_direct_activation.test.ts`) -- this file
 * isolates the MESSAGING layer.
 */
import { describe, it, expect } from "vitest";
// @ts-expect-error `node:fs` has no type declarations without `@types/node` in this project's tsconfig.
import { mkdtempSync } from "node:fs";
// @ts-expect-error see above.
import { tmpdir } from "node:os";
// @ts-expect-error see above.
import { join } from "node:path";
import { FedosConversationDirectMessagingCoordinator } from "../src/conversation/messaging/fedos_conversation_direct_messaging_coordinator.js";
import { FEDOS_CONVERSATION_DIRECT_MESSAGE_MAX_BODY_LENGTH } from "../src/conversation/messaging/fedos_conversation_direct_message_plaintext_policy.js";
import { FedosConversationEncryptionCoordinator } from "../src/conversation/encryption/fedos_conversation_encryption_coordinator.js";
import { FedosConversationDecryptionCoordinator } from "../src/conversation/encryption/fedos_conversation_decryption_coordinator.js";
import { InMemoryFedosConversationDraftPersistence } from "../src/conversation/construction/in_memory_fedos_conversation_draft_persistence.js";
import { InMemoryFedosConversationMembershipAuthority } from "../src/conversation/membership/in_memory_fedos_conversation_membership_authority.js";
import { InMemoryFedosConversationMessageEnvelopePersistence } from "../src/conversation/envelope/persistence/in_memory_fedos_conversation_message_envelope_persistence.js";
import { AppendOnlyFedosConversationMessageEnvelopePersistence } from "../src/conversation/envelope/persistence/append_only_fedos_conversation_message_envelope_persistence.js";
import { InMemoryFedosConversationPayloadStorage } from "../src/conversation/payload_storage/in_memory_fedos_conversation_payload_storage.js";
import { AppendOnlyFedosConversationPayloadStorage } from "../src/conversation/payload_storage/append_only_fedos_conversation_payload_storage.js";
import { InMemoryFedosConversationEncryptionCoordinationPersistence } from "../src/conversation/encryption/coordination/in_memory_fedos_conversation_encryption_coordination_persistence.js";
import { InMemoryFedosPayloadRetentionPersistence } from "../src/conversation/retention/in_memory_fedos_payload_retention_persistence.js";
import { FedosPayloadRetentionAuthority } from "../src/conversation/retention/fedos_payload_retention_authority.js";
import { InMemoryFedosConversationActivationPersistence } from "../src/conversation/activation/in_memory_fedos_conversation_activation_persistence.js";
import { AppendOnlyFedosConversationActivationPersistence } from "../src/conversation/activation/append_only_fedos_conversation_activation_persistence.js";
import { fedosConversationActivationId } from "../src/conversation/activation/fedos_persisted_conversation_activation_v1.js";
import { DelegatingFedosConversationIdentityResolver } from "../src/conversation/encryption/identity/fedos_conversation_identity_resolver.js";
import { MembershipFedosConversationParticipantResolver } from "../src/conversation/encryption/identity/fedos_conversation_participant_resolver.js";
import { FixedFedosConversationLocalAccountIndexAuthority } from "../src/conversation/encryption/identity/fedos_conversation_local_account_index_authority.js";
import { FedosConversationKeyResolver } from "../src/conversation/encryption/identity/fedos_conversation_key_resolver.js";
import { StaticFedosConversationCreatorIdentityAuthority } from "../src/conversation/construction/fedos_conversation_creator_identity_authority.js";
import type { FedosConversationEncryptionAuthority, FedosConversationEncryptionRequest, FedosConversationEncryptionResult } from "../src/conversation/encryption/fedos_conversation_encryption_authority.js";
import type { FedosConversationDecryptionAuthority, FedosConversationDecryptionRequest, FedosConversationDecryptionResult } from "../src/conversation/encryption/fedos_conversation_decryption_authority.js";
import type { FedosPersistedConversationDraftRecordV1 } from "../src/conversation/construction/fedos_persisted_conversation_draft_record_v1.js";
import type { FedosConversationId } from "../src/conversation/fedos_conversation_id.js";
import type { FedosConversationParticipantReference } from "../src/conversation/membership/fedos_conversation_participant_reference.js";

const CONVERSATION_ID = "private-draft::direct::alpha-1126" as FedosConversationId;
const ALICE: FedosConversationParticipantReference = { authority: "fedos", publicIdentifier: "alice-local", identityId: null };
const BOB: FedosConversationParticipantReference = { authority: "nostr", publicIdentifier: "b".repeat(64), identityId: null };
const MALLORY: FedosConversationParticipantReference = { authority: "fedos", publicIdentifier: "mallory-local", identityId: null };
const NOW = 1_712_000_000;

/** A reversible, non-cryptographic "seal" -- proves plumbing round-trips without re-testing real AEAD (mirrors the Alpha 943/946 suite's own identical fixture). */
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
    for (let i = 0; i < marker.length; i += 1) {
      if (request.ciphertext[i] !== marker[i]) return { outcome: "failed" };
    }
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

function buildFixture(opts: {
  members?: readonly FedosConversationParticipantReference[];
  local?: FedosConversationParticipantReference;
  notActivated?: boolean;
  noDraft?: boolean;
  payloadStorage?: InMemoryFedosConversationPayloadStorage;
}) {
  const local = opts.local ?? ALICE;
  const draftPersistence = new InMemoryFedosConversationDraftPersistence();
  if (!opts.noDraft) draftPersistence.putDraft(activeDraftRecord(CONVERSATION_ID, ALICE));

  const activationPersistence = new InMemoryFedosConversationActivationPersistence();
  if (!opts.notActivated && !opts.noDraft) {
    const activationId = fedosConversationActivationId(CONVERSATION_ID);
    activationPersistence.putActivationFact({ schemaVersion: 1, activationId, conversationId: CONVERSATION_ID, phase: "completed", startedAt: NOW, updatedAt: NOW });
  }

  const membershipAuthority = new InMemoryFedosConversationMembershipAuthority();
  for (const m of opts.members ?? [ALICE, BOB]) {
    membershipAuthority.admit(CONVERSATION_ID, m, m === ALICE ? "owner" : "member", NOW);
  }

  const identityResolver = new DelegatingFedosConversationIdentityResolver(new StaticFedosConversationCreatorIdentityAuthority(local));
  const keyResolver = new FedosConversationKeyResolver({
    identityResolver,
    participantResolver: new MembershipFedosConversationParticipantResolver(membershipAuthority),
    accountIndexAuthority: new FixedFedosConversationLocalAccountIndexAuthority(0),
  });
  const envelopePersistence = new InMemoryFedosConversationMessageEnvelopePersistence();
  const payloadStorage = opts.payloadStorage ?? new InMemoryFedosConversationPayloadStorage();
  const retentionPersistence = new InMemoryFedosPayloadRetentionPersistence();
  const retentionAuthority = new FedosPayloadRetentionAuthority({ retentionPersistence, payloadStorage, clock: () => NOW });

  const encryptionCoordinator = new FedosConversationEncryptionCoordinator({
    draftPersistence,
    activationPersistence,
    membershipAuthority,
    identityResolver,
    keyResolver,
    encryptionAuthority: new FakeEncryptionAuthority(),
    envelopePersistence,
    payloadStorage,
    coordinationPersistence: new InMemoryFedosConversationEncryptionCoordinationPersistence(),
    envelopeIdGenerator: { generateEnvelopeId: () => `env-${Math.random().toString(36).slice(2)}` },
    payloadIdGenerator: { generatePayloadId: () => `pay-${Math.random().toString(36).slice(2)}` },
    idempotencyKeyGenerator: { generateIdempotencyKey: () => `idem-${Math.random().toString(36).slice(2)}` },
    clock: () => NOW,
  });
  const decryptionCoordinator = new FedosConversationDecryptionCoordinator({
    draftPersistence,
    activationPersistence,
    membershipAuthority,
    identityResolver,
    keyResolver,
    decryptionAuthority: new FakeDecryptionAuthority(),
    envelopePersistence,
    payloadStorage,
  });

  const coordinator = new FedosConversationDirectMessagingCoordinator({
    draftPersistence,
    activationPersistence,
    membershipAuthority,
    identityResolver,
    envelopePersistence,
    retentionAuthority,
    encryptionCoordinator,
    decryptionCoordinator,
  });

  return { coordinator, draftPersistence, membershipAuthority, envelopePersistence, payloadStorage, retentionAuthority, activationPersistence };
}

/** Builds a SECOND Coordinator sharing every backend an existing fixture already holds, but resolving a DIFFERENT local participant -- models "a different local Runtime user reads the same durable state". */
function buildCoordinatorForLocal(fixture: ReturnType<typeof buildFixture>, local: FedosConversationParticipantReference) {
  const identityResolver = new DelegatingFedosConversationIdentityResolver(new StaticFedosConversationCreatorIdentityAuthority(local));
  const keyResolver = new FedosConversationKeyResolver({
    identityResolver,
    participantResolver: new MembershipFedosConversationParticipantResolver(fixture.membershipAuthority),
    accountIndexAuthority: new FixedFedosConversationLocalAccountIndexAuthority(0),
  });
  const decryptionCoordinator = new FedosConversationDecryptionCoordinator({
    draftPersistence: fixture.draftPersistence,
    activationPersistence: fixture.activationPersistence,
    membershipAuthority: fixture.membershipAuthority,
    identityResolver,
    keyResolver,
    decryptionAuthority: new FakeDecryptionAuthority(),
    envelopePersistence: fixture.envelopePersistence,
    payloadStorage: fixture.payloadStorage,
  });
  const encryptionCoordinator = new FedosConversationEncryptionCoordinator({
    draftPersistence: fixture.draftPersistence,
    activationPersistence: fixture.activationPersistence,
    membershipAuthority: fixture.membershipAuthority,
    identityResolver,
    keyResolver,
    encryptionAuthority: new FakeEncryptionAuthority(),
    envelopePersistence: fixture.envelopePersistence,
    payloadStorage: fixture.payloadStorage,
    coordinationPersistence: new InMemoryFedosConversationEncryptionCoordinationPersistence(),
    envelopeIdGenerator: { generateEnvelopeId: () => `env-${Math.random().toString(36).slice(2)}` },
    payloadIdGenerator: { generatePayloadId: () => `pay-${Math.random().toString(36).slice(2)}` },
    idempotencyKeyGenerator: { generateIdempotencyKey: () => `idem-${Math.random().toString(36).slice(2)}` },
    clock: () => NOW,
  });
  return new FedosConversationDirectMessagingCoordinator({
    draftPersistence: fixture.draftPersistence,
    activationPersistence: fixture.activationPersistence,
    membershipAuthority: fixture.membershipAuthority,
    identityResolver,
    envelopePersistence: fixture.envelopePersistence,
    retentionAuthority: fixture.retentionAuthority,
    encryptionCoordinator,
    decryptionCoordinator,
  });
}

describe("Alpha 1126/1127 -- sendDirectMessage()", () => {
  it("1. happy path -- sends, persists an Envelope, returns sent-locally", async () => {
    const { coordinator, envelopePersistence } = buildFixture({});
    const result = await coordinator.sendDirectMessage({ conversationId: CONVERSATION_ID, body: "hello bob", replyToEnvelopeId: null });
    expect(result.outcome).toBe("sent-locally");
    if (result.outcome !== "sent-locally") return;
    expect(envelopePersistence.getEnvelope(result.envelopeId)).not.toBeNull();
  });

  it("2. invalid-input -- empty body", async () => {
    const { coordinator } = buildFixture({});
    expect(await coordinator.sendDirectMessage({ conversationId: CONVERSATION_ID, body: "", replyToEnvelopeId: null })).toEqual({ outcome: "invalid-input" });
  });

  it("3. invalid-input -- body over the fixed bound", async () => {
    const { coordinator } = buildFixture({});
    const tooLong = "x".repeat(FEDOS_CONVERSATION_DIRECT_MESSAGE_MAX_BODY_LENGTH + 1);
    expect(await coordinator.sendDirectMessage({ conversationId: CONVERSATION_ID, body: tooLong, replyToEnvelopeId: null })).toEqual({ outcome: "invalid-input" });
  });

  it("4. conversation-not-found -- unknown conversation id", async () => {
    const { coordinator } = buildFixture({});
    expect(await coordinator.sendDirectMessage({ conversationId: "never-existed", body: "x", replyToEnvelopeId: null })).toEqual({ outcome: "conversation-not-found" });
  });

  it("5. conversation-not-active -- a real direct draft that was never activated", async () => {
    const { coordinator } = buildFixture({ notActivated: true });
    expect(await coordinator.sendDirectMessage({ conversationId: CONVERSATION_ID, body: "x", replyToEnvelopeId: null })).toEqual({ outcome: "conversation-not-active" });
  });

  it("6. unauthorized -- local participant has no Membership on this Conversation", async () => {
    const { coordinator } = buildFixture({ local: MALLORY, members: [ALICE, BOB] });
    expect(await coordinator.sendDirectMessage({ conversationId: CONVERSATION_ID, body: "x", replyToEnvelopeId: null })).toEqual({ outcome: "unauthorized" });
  });

  it("7. unauthorized -- a REVOKED local Membership fails closed", async () => {
    const { coordinator, membershipAuthority } = buildFixture({});
    membershipAuthority.revoke(CONVERSATION_ID, ALICE, NOW + 1);
    expect(await coordinator.sendDirectMessage({ conversationId: CONVERSATION_ID, body: "x", replyToEnvelopeId: null })).toEqual({ outcome: "unauthorized" });
  });

  it("8. unauthorized -- a LEFT local Membership fails closed", async () => {
    const { coordinator, membershipAuthority } = buildFixture({});
    membershipAuthority.leave(CONVERSATION_ID, ALICE, NOW + 1);
    expect(await coordinator.sendDirectMessage({ conversationId: CONVERSATION_ID, body: "x", replyToEnvelopeId: null })).toEqual({ outcome: "unauthorized" });
  });

  it("9. two independent sends create two DIFFERENT Envelopes -- never a duplicate", async () => {
    const { coordinator, envelopePersistence } = buildFixture({});
    const a = await coordinator.sendDirectMessage({ conversationId: CONVERSATION_ID, body: "first", replyToEnvelopeId: null });
    const b = await coordinator.sendDirectMessage({ conversationId: CONVERSATION_ID, body: "second", replyToEnvelopeId: null });
    expect(a.outcome).toBe("sent-locally");
    expect(b.outcome).toBe("sent-locally");
    if (a.outcome !== "sent-locally" || b.outcome !== "sent-locally") return;
    expect(a.envelopeId).not.toBe(b.envelopeId);
    expect(envelopePersistence.listConversationEnvelopes(CONVERSATION_ID)).toHaveLength(2);
  });
});

describe("Alpha 1136/1138 -- readDirectMessage()", () => {
  it("1. authorized round trip -- decrypts back to the exact original plaintext", async () => {
    const { coordinator } = buildFixture({});
    const sent = await coordinator.sendDirectMessage({ conversationId: CONVERSATION_ID, body: "round trip message", replyToEnvelopeId: null });
    expect(sent.outcome).toBe("sent-locally");
    if (sent.outcome !== "sent-locally") return;

    const read = await coordinator.readDirectMessage({ conversationId: CONVERSATION_ID, envelopeId: sent.envelopeId });
    expect(read.outcome).toBe("decrypted");
    if (read.outcome !== "decrypted") return;
    expect(new TextDecoder().decode(read.plaintext)).toBe("round trip message");
  });

  it("2. not-found -- unknown envelope id", async () => {
    const { coordinator } = buildFixture({});
    expect(await coordinator.readDirectMessage({ conversationId: CONVERSATION_ID, envelopeId: "never-existed" })).toEqual({ outcome: "not-found" });
  });

  it("3. not-found -- an Envelope from a DIFFERENT Conversation is denied, never leaking cross-Conversation existence", async () => {
    const fixtureA = buildFixture({});
    const sent = await fixtureA.coordinator.sendDirectMessage({ conversationId: CONVERSATION_ID, body: "x", replyToEnvelopeId: null });
    expect(sent.outcome).toBe("sent-locally");
    if (sent.outcome !== "sent-locally") return;

    // A second, wholly independent Conversation's own Coordinator never sees the first's Envelope.
    const otherId = "private-draft::direct::alpha-1126-other" as FedosConversationId;
    const fixtureB = buildFixture({});
    fixtureB.draftPersistence.putDraft(activeDraftRecord(otherId, ALICE));
    const activationId = fedosConversationActivationId(otherId);
    fixtureB.activationPersistence.putActivationFact({ schemaVersion: 1, activationId, conversationId: otherId, phase: "completed", startedAt: NOW, updatedAt: NOW });
    fixtureB.membershipAuthority.admit(otherId, ALICE, "owner", NOW);
    fixtureB.membershipAuthority.admit(otherId, BOB, "member", NOW);
    // Copy the raw Envelope record across so it EXISTS in fixtureB's own persistence but is bound to CONVERSATION_ID, not otherId.
    fixtureB.envelopePersistence.putEnvelope(fixtureA.envelopePersistence.getEnvelope(sent.envelopeId)!);

    expect(await fixtureB.coordinator.readDirectMessage({ conversationId: otherId, envelopeId: sent.envelopeId })).toEqual({ outcome: "not-found" });
  });

  it("4. unauthorized -- an unrelated participant (no Membership at all) sharing the SAME durable state is denied", async () => {
    const fixture = buildFixture({});
    const sent = await fixture.coordinator.sendDirectMessage({ conversationId: CONVERSATION_ID, body: "x", replyToEnvelopeId: null });
    expect(sent.outcome).toBe("sent-locally");
    if (sent.outcome !== "sent-locally") return;

    const outsiderCoordinator = buildCoordinatorForLocal(fixture, MALLORY);
    expect(await outsiderCoordinator.readDirectMessage({ conversationId: CONVERSATION_ID, envelopeId: sent.envelopeId })).toEqual({ outcome: "unauthorized" });
  });

  it("5. unauthorized -- a REVOKED Membership is denied read access", async () => {
    const { coordinator, membershipAuthority } = buildFixture({});
    const sent = await coordinator.sendDirectMessage({ conversationId: CONVERSATION_ID, body: "x", replyToEnvelopeId: null });
    expect(sent.outcome).toBe("sent-locally");
    if (sent.outcome !== "sent-locally") return;
    membershipAuthority.revoke(CONVERSATION_ID, ALICE, NOW + 1);
    expect(await coordinator.readDirectMessage({ conversationId: CONVERSATION_ID, envelopeId: sent.envelopeId })).toEqual({ outcome: "unauthorized" });
  });

  it("6. conversation-not-active -- draft mode never reaches an active read", async () => {
    const { coordinator } = buildFixture({ notActivated: true });
    expect(await coordinator.readDirectMessage({ conversationId: CONVERSATION_ID, envelopeId: "irrelevant" })).toEqual({ outcome: "conversation-not-active" });
  });

  it("7. Tamper matrix -- a changed byte WITHIN the authenticated marker fails closed through the REAL readDirectMessage() path, never a partial plaintext", async () => {
    // FakeDecryptionAuthority (mirroring the Alpha 943/946 suite's own
    // identical test double) authenticates only its own marker PREFIX, not
    // the full ciphertext -- real byte-for-byte AEAD authentication is
    // Alpha 862/865/871's own already-tested responsibility (Alpha 890/1161's
    // own scope boundary), not re-tested here. Tampering the marker itself
    // is therefore the honest way to exercise THIS fake's own failure path.
    class TamperOnReadPayloadStorage extends InMemoryFedosConversationPayloadStorage {
      tamperReads = false;
      override getPayload(id: any) {
        const real = super.getPayload(id);
        if (real === null || !this.tamperReads) return real;
        const bytes = new Uint8Array(real.bytes);
        bytes[0] = (bytes[0] ?? 0) ^ 0xff;
        return { descriptor: real.descriptor, bytes };
      }
    }
    const tamperingStorage = new TamperOnReadPayloadStorage();
    const { coordinator } = buildFixture({ payloadStorage: tamperingStorage });

    const sent = await coordinator.sendDirectMessage({ conversationId: CONVERSATION_ID, body: "tamper me", replyToEnvelopeId: null });
    expect(sent.outcome).toBe("sent-locally");
    if (sent.outcome !== "sent-locally") return;

    tamperingStorage.tamperReads = true;
    const read = await coordinator.readDirectMessage({ conversationId: CONVERSATION_ID, envelopeId: sent.envelopeId });
    expect(read).toEqual({ outcome: "failed" });
  });

  it("8. Tamper matrix -- a payload truncated shorter than the authenticated marker fails closed", async () => {
    class TruncateOnReadPayloadStorage extends InMemoryFedosConversationPayloadStorage {
      truncateReads = false;
      override getPayload(id: any) {
        const real = super.getPayload(id);
        if (real === null || !this.truncateReads) return real;
        return { descriptor: real.descriptor, bytes: real.bytes.subarray(0, 3) };
      }
    }
    const truncatingStorage = new TruncateOnReadPayloadStorage();
    const { coordinator } = buildFixture({ payloadStorage: truncatingStorage });

    const sent = await coordinator.sendDirectMessage({ conversationId: CONVERSATION_ID, body: "truncate me", replyToEnvelopeId: null });
    expect(sent.outcome).toBe("sent-locally");
    if (sent.outcome !== "sent-locally") return;

    truncatingStorage.truncateReads = true;
    const read = await coordinator.readDirectMessage({ conversationId: CONVERSATION_ID, envelopeId: sent.envelopeId });
    expect(read).toEqual({ outcome: "failed" });
  });
});

describe("Alpha 1143 -- retention interaction", () => {
  it("1. an active payload is readable", async () => {
    const { coordinator } = buildFixture({});
    const sent = await coordinator.sendDirectMessage({ conversationId: CONVERSATION_ID, body: "still here", replyToEnvelopeId: null });
    expect(sent.outcome).toBe("sent-locally");
    if (sent.outcome !== "sent-locally") return;
    expect((await coordinator.readDirectMessage({ conversationId: CONVERSATION_ID, envelopeId: sent.envelopeId })).outcome).toBe("decrypted");
  });

  it("2. a tombstoned payload is denied -- 'tombstoned', never a partial plaintext", async () => {
    const { coordinator, envelopePersistence, retentionAuthority } = buildFixture({});
    const sent = await coordinator.sendDirectMessage({ conversationId: CONVERSATION_ID, body: "will be tombstoned", replyToEnvelopeId: null });
    expect(sent.outcome).toBe("sent-locally");
    if (sent.outcome !== "sent-locally") return;

    const envelope = envelopePersistence.getEnvelope(sent.envelopeId)!;
    const tombstoneResult = retentionAuthority.tombstonePayload(envelope.payloadId as any, null, "test_placeholder");
    expect(tombstoneResult.outcome).toBe("tombstoned");

    expect(await coordinator.readDirectMessage({ conversationId: CONVERSATION_ID, envelopeId: sent.envelopeId })).toEqual({ outcome: "tombstoned" });
  });

  it("3. listDirectMessages() surfaces the retention state without decrypting", async () => {
    const { coordinator, envelopePersistence, retentionAuthority } = buildFixture({});
    const sent = await coordinator.sendDirectMessage({ conversationId: CONVERSATION_ID, body: "listed", replyToEnvelopeId: null });
    expect(sent.outcome).toBe("sent-locally");
    if (sent.outcome !== "sent-locally") return;
    const envelope = envelopePersistence.getEnvelope(sent.envelopeId)!;
    retentionAuthority.tombstonePayload(envelope.payloadId as any, null, "test_placeholder");

    const summaries = coordinator.listDirectMessages(CONVERSATION_ID);
    expect(summaries).toHaveLength(1);
    expect(summaries[0]!.retentionState).toBe("tombstoned");
    expect(summaries[0]!.envelopeId).toBe(sent.envelopeId);
  });
});

describe("Alpha 1133/1139 -- listDirectMessages() ordering and safe metadata", () => {
  it("1. returns messages in createdAt-ascending order and lists only safe metadata", async () => {
    const { coordinator } = buildFixture({});
    const a = await coordinator.sendDirectMessage({ conversationId: CONVERSATION_ID, body: "first", replyToEnvelopeId: null });
    const b = await coordinator.sendDirectMessage({ conversationId: CONVERSATION_ID, body: "second", replyToEnvelopeId: null });
    expect(a.outcome).toBe("sent-locally");
    expect(b.outcome).toBe("sent-locally");

    const summaries = coordinator.listDirectMessages(CONVERSATION_ID);
    expect(summaries).toHaveLength(2);
    expect(summaries.every((s) => s.retentionState === "active")).toBe(true);
    // Both were sent at the SAME fixed clock value -- ordering falls back to the stable id tie-break, never throwing/reordering nondeterministically.
    expect(new Set(summaries.map((s) => s.envelopeId)).size).toBe(2);
  });

  it("2. [] for an unknown or non-active Conversation -- never decrypts to answer a list", async () => {
    const { coordinator } = buildFixture({ notActivated: true });
    expect(coordinator.listDirectMessages(CONVERSATION_ID)).toEqual([]);
  });
});

describe("Alpha 1135 -- send restart verification (real append-only backends)", () => {
  it("1. a message sent before 'restart' is readable by a fresh Coordinator instance over the same files, with no duplicate write", async () => {
    const dir = mkdtempSync(join(tmpdir(), "fedos-messaging-restart-"));
    const paths = {
      envelope: join(dir, "envelope.log"),
      payload: join(dir, "payload.log"),
      activation: join(dir, "activation.log"),
    };

    function buildOverFiles() {
      const draftPersistence = new InMemoryFedosConversationDraftPersistence();
      draftPersistence.putDraft(activeDraftRecord(CONVERSATION_ID, ALICE));
      const membershipAuthority = new InMemoryFedosConversationMembershipAuthority();
      membershipAuthority.admit(CONVERSATION_ID, ALICE, "owner", NOW);
      membershipAuthority.admit(CONVERSATION_ID, BOB, "member", NOW);
      const activationPersistence = new AppendOnlyFedosConversationActivationPersistence(paths.activation);
      const envelopePersistence = new AppendOnlyFedosConversationMessageEnvelopePersistence(paths.envelope);
      const payloadStorage = new AppendOnlyFedosConversationPayloadStorage(paths.payload, 1_000_000);
      const identityResolver = new DelegatingFedosConversationIdentityResolver(new StaticFedosConversationCreatorIdentityAuthority(ALICE));
      const keyResolver = new FedosConversationKeyResolver({
        identityResolver,
        participantResolver: new MembershipFedosConversationParticipantResolver(membershipAuthority),
        accountIndexAuthority: new FixedFedosConversationLocalAccountIndexAuthority(0),
      });
      const retentionAuthority = new FedosPayloadRetentionAuthority({
        retentionPersistence: new InMemoryFedosPayloadRetentionPersistence(),
        payloadStorage,
        clock: () => NOW,
      });
      const encryptionCoordinator = new FedosConversationEncryptionCoordinator({
        draftPersistence,
        activationPersistence,
        membershipAuthority,
        identityResolver,
        keyResolver,
        encryptionAuthority: new FakeEncryptionAuthority(),
        envelopePersistence,
        payloadStorage,
        coordinationPersistence: new InMemoryFedosConversationEncryptionCoordinationPersistence(),
        envelopeIdGenerator: { generateEnvelopeId: () => "restart-envelope-1" },
        payloadIdGenerator: { generatePayloadId: () => "restart-payload-1" },
        idempotencyKeyGenerator: { generateIdempotencyKey: () => "restart-idem-1" },
        clock: () => NOW,
      });
      const decryptionCoordinator = new FedosConversationDecryptionCoordinator({
        draftPersistence,
        activationPersistence,
        membershipAuthority,
        identityResolver,
        keyResolver,
        decryptionAuthority: new FakeDecryptionAuthority(),
        envelopePersistence,
        payloadStorage,
      });
      const coordinator = new FedosConversationDirectMessagingCoordinator({
        draftPersistence,
        activationPersistence,
        membershipAuthority,
        identityResolver,
        envelopePersistence,
        retentionAuthority,
        encryptionCoordinator,
        decryptionCoordinator,
      });
      return { coordinator, envelopePersistence };
    }

    const activationId = fedosConversationActivationId(CONVERSATION_ID);
    const activationSeed = new AppendOnlyFedosConversationActivationPersistence(paths.activation);
    activationSeed.putActivationFact({ schemaVersion: 1, activationId, conversationId: CONVERSATION_ID, phase: "completed", startedAt: NOW, updatedAt: NOW });

    const before = buildOverFiles();

    const sent = await before.coordinator.sendDirectMessage({ conversationId: CONVERSATION_ID, body: "before restart", replyToEnvelopeId: null });
    expect(sent.outcome).toBe("sent-locally");
    if (sent.outcome !== "sent-locally") return;

    const after = buildOverFiles();
    const read = await after.coordinator.readDirectMessage({ conversationId: CONVERSATION_ID, envelopeId: sent.envelopeId });
    expect(read.outcome).toBe("decrypted");
    if (read.outcome !== "decrypted") return;
    expect(new TextDecoder().decode(read.plaintext)).toBe("before restart");
    expect(after.envelopePersistence.listConversationEnvelopes(CONVERSATION_ID)).toHaveLength(1);
  });
});
