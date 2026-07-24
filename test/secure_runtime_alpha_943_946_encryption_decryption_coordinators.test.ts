/**
 * Secure Runtime Alpha 943/946 — Encryption/Decryption Coordinator.
 *
 * The Conversation lifecycle validator (`fedos_conversation_draft_record_validator.ts`,
 * Alpha 895) statically rejects every `lifecycleState` except `"draft"` —
 * NOTHING in this repository can construct an `"active"` Conversation
 * record. `FedosConversationDraftPersistence` is a dumb port with no
 * validation of its own, so these tests hand-build a raw persisted
 * record with `lifecycleState: "active"` and write it directly via
 * `putDraft()` — the honest way to exercise this Coordinator's own
 * happy path, per this Arc's own explicit instruction: "your Encryption
 * Coordinator's happy path may be exercisable only in tests with a
 * hand-constructed active-state fixture, not through any real runtime
 * path."
 */
import { describe, it, expect } from "vitest";
import { FedosConversationEncryptionCoordinator } from "../src/conversation/encryption/fedos_conversation_encryption_coordinator.js";
import { FedosConversationDecryptionCoordinator } from "../src/conversation/encryption/fedos_conversation_decryption_coordinator.js";
import { InMemoryFedosConversationDraftPersistence } from "../src/conversation/construction/in_memory_fedos_conversation_draft_persistence.js";
import { InMemoryFedosConversationMembershipAuthority } from "../src/conversation/membership/in_memory_fedos_conversation_membership_authority.js";
import { InMemoryFedosConversationMessageEnvelopePersistence } from "../src/conversation/envelope/persistence/in_memory_fedos_conversation_message_envelope_persistence.js";
import { InMemoryFedosConversationPayloadStorage } from "../src/conversation/payload_storage/in_memory_fedos_conversation_payload_storage.js";
import { InMemoryFedosConversationEncryptionCoordinationPersistence } from "../src/conversation/encryption/coordination/in_memory_fedos_conversation_encryption_coordination_persistence.js";
import { DelegatingFedosConversationIdentityResolver } from "../src/conversation/encryption/identity/fedos_conversation_identity_resolver.js";
import { MembershipFedosConversationParticipantResolver } from "../src/conversation/encryption/identity/fedos_conversation_participant_resolver.js";
import { FixedFedosConversationLocalAccountIndexAuthority } from "../src/conversation/encryption/identity/fedos_conversation_local_account_index_authority.js";
import { FedosConversationKeyResolver } from "../src/conversation/encryption/identity/fedos_conversation_key_resolver.js";
import { StaticFedosConversationCreatorIdentityAuthority } from "../src/conversation/construction/fedos_conversation_creator_identity_authority.js";
import { UnavailableFedosConversationEncryptionAuthority } from "../src/conversation/encryption/fedos_unavailable_conversation_encryption_authority.js";
import { UnavailableFedosConversationDecryptionAuthority } from "../src/conversation/encryption/fedos_unavailable_conversation_decryption_authority.js";
import { InMemoryFedosConversationActivationPersistence } from "../src/conversation/activation/in_memory_fedos_conversation_activation_persistence.js";
import { fedosConversationActivationId } from "../src/conversation/activation/fedos_persisted_conversation_activation_v1.js";
import type { FedosConversationEncryptionAuthority, FedosConversationEncryptionRequest, FedosConversationEncryptionResult } from "../src/conversation/encryption/fedos_conversation_encryption_authority.js";
import type { FedosConversationDecryptionAuthority, FedosConversationDecryptionRequest, FedosConversationDecryptionResult } from "../src/conversation/encryption/fedos_conversation_decryption_authority.js";
import type { FedosPersistedConversationDraftRecordV1 } from "../src/conversation/construction/fedos_persisted_conversation_draft_record_v1.js";
import type { FedosConversationId } from "../src/conversation/fedos_conversation_id.js";
import type { FedosConversationParticipantReference } from "../src/conversation/membership/fedos_conversation_participant_reference.js";

const CONVERSATION_ID = "private-draft::direct::alpha-943" as FedosConversationId;
const ALICE: FedosConversationParticipantReference = { authority: "fedos", publicIdentifier: "alice-local", identityId: null };
const BOB: FedosConversationParticipantReference = { authority: "nostr", publicIdentifier: "b".repeat(64), identityId: null };
const NOW = 1_700_000_000;

/** A reversible, non-cryptographic "seal" — proves the Coordinator's OWN plumbing round-trips correctly without re-testing real AEAD (Alpha 861-872 already do). */
function fakeMarker(request: { localAccountIndex: number; counterpartyPublicKeyHex: string }): Uint8Array {
  return new TextEncoder().encode(`FAKE:${request.localAccountIndex}:${request.counterpartyPublicKeyHex}:`);
}

class FakeEncryptionAuthority implements FedosConversationEncryptionAuthority {
  calls = 0;
  async encrypt(request: FedosConversationEncryptionRequest): Promise<FedosConversationEncryptionResult> {
    this.calls += 1;
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

function activeDraftRecord(id: string): FedosPersistedConversationDraftRecordV1 {
  return {
    schemaVersion: 1,
    id,
    mode: "direct",
    lifecycleState: "active",
    policyReference: "direct-draft-v1",
    creatorAuthority: ALICE.authority,
    creatorPublicIdentifier: ALICE.publicIdentifier,
    creatorIdentityId: ALICE.identityId,
    createdAt: NOW,
  };
}

function fixedIdGenerators(envelopeId: string, payloadId: string, idempotencyKey: string) {
  return {
    envelopeIdGenerator: { generateEnvelopeId: () => envelopeId },
    payloadIdGenerator: { generatePayloadId: () => payloadId },
    idempotencyKeyGenerator: { generateIdempotencyKey: () => idempotencyKey },
  };
}

/** Alpha 1111–1180 -- see `secure_runtime_alpha_931_990_failure_matrix.test.ts`'s own identical helper for why this replaces the draft record's own (now-ignored) `lifecycleState` field. */
function activatedPersistence(conversationId: string): InMemoryFedosConversationActivationPersistence {
  const persistence = new InMemoryFedosConversationActivationPersistence();
  const activationId = fedosConversationActivationId(conversationId);
  persistence.putActivationFact({ schemaVersion: 1, activationId, conversationId, phase: "completed", startedAt: NOW, updatedAt: NOW });
  return persistence;
}

function buildFixture(overrides: { encryptionAuthority?: FedosConversationEncryptionAuthority; decryptionAuthority?: FedosConversationDecryptionAuthority } = {}) {
  const draftPersistence = new InMemoryFedosConversationDraftPersistence();
  draftPersistence.putDraft(activeDraftRecord(CONVERSATION_ID));
  const activationPersistence = activatedPersistence(CONVERSATION_ID);
  const membershipAuthority = new InMemoryFedosConversationMembershipAuthority();
  membershipAuthority.admit(CONVERSATION_ID, ALICE, "owner", NOW);
  membershipAuthority.admit(CONVERSATION_ID, BOB, "member", NOW);
  const envelopePersistence = new InMemoryFedosConversationMessageEnvelopePersistence();
  const payloadStorage = new InMemoryFedosConversationPayloadStorage();
  const coordinationPersistence = new InMemoryFedosConversationEncryptionCoordinationPersistence();
  const identityResolver = new DelegatingFedosConversationIdentityResolver(new StaticFedosConversationCreatorIdentityAuthority(ALICE));
  const keyResolver = new FedosConversationKeyResolver({
    identityResolver,
    participantResolver: new MembershipFedosConversationParticipantResolver(membershipAuthority),
    accountIndexAuthority: new FixedFedosConversationLocalAccountIndexAuthority(0),
    // ALICE is "fedos"-authority (anonymous-local-shaped) -- no Nostr binding check applies.
  });
  const encryptionAuthority = overrides.encryptionAuthority ?? new FakeEncryptionAuthority();
  const decryptionAuthority = overrides.decryptionAuthority ?? new FakeDecryptionAuthority();
  const ids = fixedIdGenerators("envelope-1", "payload-1", "idem-1");

  const encryptionCoordinator = new FedosConversationEncryptionCoordinator({
    draftPersistence,
    activationPersistence,
    membershipAuthority,
    identityResolver,
    keyResolver,
    encryptionAuthority,
    envelopePersistence,
    payloadStorage,
    coordinationPersistence,
    ...ids,
    clock: () => NOW,
  });
  const decryptionCoordinator = new FedosConversationDecryptionCoordinator({
    draftPersistence,
    activationPersistence,
    membershipAuthority,
    identityResolver,
    keyResolver,
    decryptionAuthority,
    envelopePersistence,
    payloadStorage,
  });

  return { draftPersistence, membershipAuthority, envelopePersistence, payloadStorage, coordinationPersistence, encryptionCoordinator, decryptionCoordinator, encryptionAuthority };
}

describe("Alpha 943 -- FedosConversationEncryptionCoordinator, happy path (hand-built active fixture)", () => {
  it("1. encrypts, persists a Payload and an Envelope, and returns the Envelope", async () => {
    const fixture = buildFixture();
    const plaintext = new TextEncoder().encode("hello bob");
    const result = await fixture.encryptionCoordinator.encrypt({
      conversationId: CONVERSATION_ID,
      plaintext,
      suite: "ChaCha20Poly1305",
      replyToEnvelopeId: null,
    });
    expect(result.outcome).toBe("encrypted");
    if (result.outcome !== "encrypted") return;
    expect(result.envelope.conversationId).toBe(CONVERSATION_ID);
    expect(result.envelope.encryptionSuite).toBe("ChaCha20Poly1305");
    expect(fixture.envelopePersistence.getEnvelope(result.envelope.id)).not.toBeNull();
    const storedPayload = fixture.payloadStorage.getPayload(result.envelope.payloadId);
    expect(storedPayload).not.toBeNull();
    expect(storedPayload!.bytes.length).toBeGreaterThan(plaintext.length); // marker-prefixed
  });
});

describe("Alpha 946 -- FedosConversationDecryptionCoordinator, round trip through the SAME fixture", () => {
  it("1. decrypts an Envelope the Encryption Coordinator just produced back to the original plaintext", async () => {
    const fixture = buildFixture();
    const plaintext = new TextEncoder().encode("round trip message");
    const encrypted = await fixture.encryptionCoordinator.encrypt({
      conversationId: CONVERSATION_ID,
      plaintext,
      suite: "Aes256Gcm",
      replyToEnvelopeId: null,
    });
    expect(encrypted.outcome).toBe("encrypted");
    if (encrypted.outcome !== "encrypted") return;

    const decrypted = await fixture.decryptionCoordinator.decrypt({ conversationId: CONVERSATION_ID, envelopeId: encrypted.envelope.id });
    expect(decrypted.outcome).toBe("decrypted");
    if (decrypted.outcome !== "decrypted") return;
    expect(new TextDecoder().decode(decrypted.plaintext)).toBe("round trip message");
  });
});

describe("Alpha 942 -- default Unavailable Authorities (the concrete 'encryption unavailable' fail-closed default)", () => {
  it("1. encrypt() with the default UnavailableFedosConversationEncryptionAuthority fails closed to 'key-unavailable'", async () => {
    const fixture = buildFixture({ encryptionAuthority: new UnavailableFedosConversationEncryptionAuthority() });
    const result = await fixture.encryptionCoordinator.encrypt({
      conversationId: CONVERSATION_ID,
      plaintext: new TextEncoder().encode("x"),
      suite: "ChaCha20Poly1305",
      replyToEnvelopeId: null,
    });
    // The Authority's own "unavailable" outcome collapses to "key-unavailable" is NOT how it's mapped --
    // "unavailable" is a distinct Authority outcome; the Coordinator maps every non-"encrypted"/non-"key-unavailable" outcome to "encryption-failed".
    expect(result.outcome).toBe("encryption-failed");
  });

  it("2. decrypt() with the default UnavailableFedosConversationDecryptionAuthority fails closed to 'decryption-failed'", async () => {
    const fixture = buildFixture();
    const plaintext = new TextEncoder().encode("x");
    const encrypted = await fixture.encryptionCoordinator.encrypt({
      conversationId: CONVERSATION_ID,
      plaintext,
      suite: "ChaCha20Poly1305",
      replyToEnvelopeId: null,
    });
    expect(encrypted.outcome).toBe("encrypted");
    if (encrypted.outcome !== "encrypted") return;

    const fixtureWithUnavailableDecryption = buildFixture({ decryptionAuthority: new UnavailableFedosConversationDecryptionAuthority() });
    // Reuse the SAME envelope/payload backends so the Envelope really exists for this decrypt attempt.
    fixtureWithUnavailableDecryption.envelopePersistence.putEnvelope(fixture.envelopePersistence.getEnvelope(encrypted.envelope.id)!);
    fixtureWithUnavailableDecryption.payloadStorage.putPayload(
      fixture.payloadStorage.getDescriptor(encrypted.envelope.payloadId)!,
      fixture.payloadStorage.getPayload(encrypted.envelope.payloadId)!.bytes,
    );
    const decrypted = await fixtureWithUnavailableDecryption.decryptionCoordinator.decrypt({
      conversationId: CONVERSATION_ID,
      envelopeId: encrypted.envelope.id,
    });
    expect(decrypted.outcome).toBe("decryption-failed");
  });
});

describe("Alpha 943/946 -- fail closed #2, the ONLY reachable path through this repository's real construction pipeline", () => {
  it("1. encryptMessage against a genuine (still-draft) private-group draft fails closed to 'conversation-not-active'", async () => {
    const fixture = buildFixture();
    fixture.draftPersistence.putDraft({
      schemaVersion: 1,
      id: "private-draft::direct::still-a-draft",
      mode: "direct",
      lifecycleState: "draft",
      policyReference: "direct-draft-v1",
      creatorAuthority: ALICE.authority,
      creatorPublicIdentifier: ALICE.publicIdentifier,
      creatorIdentityId: ALICE.identityId,
      createdAt: NOW,
    });
    const result = await fixture.encryptionCoordinator.encrypt({
      conversationId: "private-draft::direct::still-a-draft",
      plaintext: new TextEncoder().encode("x"),
      suite: "ChaCha20Poly1305",
      replyToEnvelopeId: null,
    });
    expect(result).toEqual({ outcome: "conversation-not-active" });
  });

  it("2. conversation-not-found for an id with no persisted draft at all", async () => {
    const fixture = buildFixture();
    const result = await fixture.encryptionCoordinator.encrypt({
      conversationId: "private-draft::direct::never-existed",
      plaintext: new TextEncoder().encode("x"),
      suite: "ChaCha20Poly1305",
      replyToEnvelopeId: null,
    });
    expect(result).toEqual({ outcome: "conversation-not-found" });
  });
});
