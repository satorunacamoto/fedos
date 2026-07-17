/**
 * Secure Runtime Alpha 931–990 — Failure Matrix, mirroring the style of
 * `test/secure_runtime_alpha_713_failure_matrix_and_safety.test.ts`: one
 * `it()` per DISTINCT failure mode, asserting the exact coarse outcome
 * token, never a raw `Error`.
 *
 * TWO OUTCOME TOKENS ARE STRUCTURALLY UNREACHABLE from
 * `FedosConversationEncryptionCoordinator.encrypt()`'s OWN call site,
 * documented here rather than faked into a passing assertion:
 *   - `"unsupported-suite"` — `encrypt()`'s own command validation already
 *     rejects any `suite` outside `FEDOS_CONVERSATION_ENVELOPE_ENCRYPTION_SUITES`
 *     as `"invalid-command"` BEFORE `evaluateFedosConversationCryptoReadiness()`
 *     ever runs, so that function's own suite check can never fail from
 *     this call site (it remains genuinely reachable, and is genuinely
 *     tested, from ITS OWN test suite,
 *     `test/secure_runtime_alpha_866_membership_readiness.test.ts`).
 *   - `"unsupported-epoch"` — `encrypt()` always passes the ONE supported
 *     constant, `FEDOS_CONVERSATION_ENVELOPE_SUPPORTED_KEY_EPOCH` (`0`);
 *     the readiness check's own epoch mismatch can never trigger.
 * `FedosConversationDecryptionCoordinator.decrypt()`'s `"unsupported-suite"`
 * is SIMILARLY unreachable (the Envelope codec already guarantees a
 * valid suite on any Envelope that successfully deserializes) — but its
 * `"unsupported-epoch"` genuinely IS reachable and IS tested below,
 * because `keyEpoch` is a plain non-negative integer on the persisted
 * Envelope (Alpha 854's own "no real epoch-identity type exists yet"
 * decision), not narrowed to the single supported value the way `suite`
 * is.
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
import { FedosSigningAuthorityNostrAuthorBinding } from "../src/board/runtime/identity/fedos_nostr_author_binding_authority.js";
import type { FedosNostrSigningAuthority } from "../src/nostr/sign/fedos_nostr_signing_authority.js";
import type { FedosConversationEncryptionAuthority, FedosConversationEncryptionRequest, FedosConversationEncryptionResult } from "../src/conversation/encryption/fedos_conversation_encryption_authority.js";
import type { FedosConversationDecryptionAuthority, FedosConversationDecryptionRequest, FedosConversationDecryptionResult } from "../src/conversation/encryption/fedos_conversation_decryption_authority.js";
import type { FedosPersistedConversationDraftRecordV1 } from "../src/conversation/construction/fedos_persisted_conversation_draft_record_v1.js";
import type { FedosPersistedConversationMessageEnvelopeV1 } from "../src/conversation/envelope/persistence/fedos_persisted_conversation_message_envelope_v1.js";
import type { FedosConversationId } from "../src/conversation/fedos_conversation_id.js";
import type { FedosConversationParticipantReference } from "../src/conversation/membership/fedos_conversation_participant_reference.js";

const CONVERSATION_ID = "private-draft::direct::alpha-fm" as FedosConversationId;
const ALICE: FedosConversationParticipantReference = { authority: "fedos", publicIdentifier: "alice-local", identityId: null };
const ALICE_NOSTR: FedosConversationParticipantReference = { authority: "nostr", publicIdentifier: "a".repeat(64), identityId: null };
const BOB: FedosConversationParticipantReference = { authority: "nostr", publicIdentifier: "b".repeat(64), identityId: null };
const CAROL: FedosConversationParticipantReference = { authority: "nostr", publicIdentifier: "c".repeat(64), identityId: null };
const NOW = 1_700_003_000;

function fakeSigningAuthority(mapping: Record<number, string>): FedosNostrSigningAuthority {
  return {
    signEvent: async () => null,
    publicIdentityForAccount: async (accountIndex: number) => {
      const hex = mapping[accountIndex];
      return hex === undefined ? null : { accountIndex, publicKeyHex: hex };
    },
  };
}

function activeDraftRecord(id: string, creator: FedosConversationParticipantReference): FedosPersistedConversationDraftRecordV1 {
  return {
    schemaVersion: 1,
    id,
    mode: "direct",
    lifecycleState: "active",
    policyReference: "direct-draft-v1",
    creatorAuthority: creator.authority,
    creatorPublicIdentifier: creator.publicIdentifier,
    creatorIdentityId: creator.identityId,
    createdAt: NOW,
  };
}

class ScriptedEncryptionAuthority implements FedosConversationEncryptionAuthority {
  constructor(private readonly result: FedosConversationEncryptionResult) {}
  async encrypt(_request: FedosConversationEncryptionRequest): Promise<FedosConversationEncryptionResult> {
    return this.result;
  }
}

class ScriptedDecryptionAuthority implements FedosConversationDecryptionAuthority {
  constructor(private readonly result: FedosConversationDecryptionResult) {}
  async decrypt(_request: FedosConversationDecryptionRequest): Promise<FedosConversationDecryptionResult> {
    return this.result;
  }
}

class ConflictingPayloadStorage extends InMemoryFedosConversationPayloadStorage {
  override putPayload(): "conflict" {
    return "conflict";
  }
}

class ConflictingEnvelopePersistence extends InMemoryFedosConversationMessageEnvelopePersistence {
  override putEnvelope(): "conflict" {
    return "conflict";
  }
}

function buildEncryptionFixture(opts: {
  members?: readonly (FedosConversationParticipantReference | null)[];
  local?: FedosConversationParticipantReference;
  identityUnavailable?: boolean;
  nostrAuthorBindingAuthority?: FedosSigningAuthorityNostrAuthorBinding;
  encryptionAuthority?: FedosConversationEncryptionAuthority;
  payloadStorage?: InMemoryFedosConversationPayloadStorage;
  envelopePersistence?: InMemoryFedosConversationMessageEnvelopePersistence;
  noDraft?: boolean;
  draftInactive?: boolean;
}) {
  const local = opts.local ?? ALICE;
  const draftPersistence = new InMemoryFedosConversationDraftPersistence();
  if (!opts.noDraft) {
    draftPersistence.putDraft(
      opts.draftInactive
        ? { ...activeDraftRecord(CONVERSATION_ID, local), lifecycleState: "draft" }
        : activeDraftRecord(CONVERSATION_ID, local),
    );
  }
  const membershipAuthority = new InMemoryFedosConversationMembershipAuthority();
  if (opts.members) {
    for (const m of opts.members) {
      if (m !== null) membershipAuthority.admit(CONVERSATION_ID, m, m === local ? "owner" : "member", NOW);
    }
  }
  const identityResolver = opts.identityUnavailable
    ? { resolveLocalParticipant: () => ({ outcome: "unavailable" as const }) }
    : new DelegatingFedosConversationIdentityResolver(new StaticFedosConversationCreatorIdentityAuthority(local));
  const keyResolver = new FedosConversationKeyResolver({
    identityResolver,
    participantResolver: new MembershipFedosConversationParticipantResolver(membershipAuthority),
    accountIndexAuthority: new FixedFedosConversationLocalAccountIndexAuthority(0),
    nostrAuthorBindingAuthority: opts.nostrAuthorBindingAuthority,
  });
  const coordinator = new FedosConversationEncryptionCoordinator({
    draftPersistence,
    membershipAuthority,
    identityResolver,
    keyResolver,
    encryptionAuthority: opts.encryptionAuthority ?? new ScriptedEncryptionAuthority({ outcome: "encrypted", ciphertext: new Uint8Array([1]) }),
    envelopePersistence: opts.envelopePersistence ?? new InMemoryFedosConversationMessageEnvelopePersistence(),
    payloadStorage: opts.payloadStorage ?? new InMemoryFedosConversationPayloadStorage(),
    coordinationPersistence: new InMemoryFedosConversationEncryptionCoordinationPersistence(),
    envelopeIdGenerator: { generateEnvelopeId: () => "fm-envelope" },
    payloadIdGenerator: { generatePayloadId: () => "fm-payload" },
    idempotencyKeyGenerator: { generateIdempotencyKey: () => "fm-idem" },
    clock: () => NOW,
  });
  return { coordinator, draftPersistence, membershipAuthority };
}

const VALID_COMMAND = { conversationId: CONVERSATION_ID, plaintext: new TextEncoder().encode("x"), suite: "ChaCha20Poly1305" as const, replyToEnvelopeId: null };

describe("Alpha 943 -- FedosConversationEncryptionCoordinator failure matrix", () => {
  it("encrypted -- happy path", async () => {
    const { coordinator } = buildEncryptionFixture({ members: [ALICE, BOB] });
    const result = await coordinator.encrypt(VALID_COMMAND);
    expect(result.outcome).toBe("encrypted");
  });

  it("invalid-command -- malformed suite", async () => {
    const { coordinator } = buildEncryptionFixture({ members: [ALICE, BOB] });
    const result = await coordinator.encrypt({ ...VALID_COMMAND, suite: "not-a-real-suite" as any });
    expect(result).toEqual({ outcome: "invalid-command" });
  });

  it("invalid-command -- empty conversationId", async () => {
    const { coordinator } = buildEncryptionFixture({ members: [ALICE, BOB] });
    expect(await coordinator.encrypt({ ...VALID_COMMAND, conversationId: "" })).toEqual({ outcome: "invalid-command" });
  });

  it("conversation-not-found -- no persisted draft at all", async () => {
    const { coordinator } = buildEncryptionFixture({ members: [ALICE, BOB], noDraft: true });
    expect(await coordinator.encrypt(VALID_COMMAND)).toEqual({ outcome: "conversation-not-found" });
  });

  it("conversation-not-active -- a genuine, still-draft Conversation (the ONLY reachable path in production today)", async () => {
    const { coordinator } = buildEncryptionFixture({ members: [ALICE, BOB], draftInactive: true });
    expect(await coordinator.encrypt(VALID_COMMAND)).toEqual({ outcome: "conversation-not-active" });
  });

  it("identity-unavailable -- the injected identity resolver reports unavailable", async () => {
    const { coordinator } = buildEncryptionFixture({ members: [ALICE, BOB], identityUnavailable: true });
    expect(await coordinator.encrypt(VALID_COMMAND)).toEqual({ outcome: "identity-unavailable" });
  });

  it("not-member -- local participant has no active Membership on this Conversation", async () => {
    const { coordinator } = buildEncryptionFixture({ members: [BOB] });
    expect(await coordinator.encrypt(VALID_COMMAND)).toEqual({ outcome: "not-member" });
  });

  it("no-counterparty -- local is the sole active member", async () => {
    const { coordinator } = buildEncryptionFixture({ members: [ALICE] });
    expect(await coordinator.encrypt(VALID_COMMAND)).toEqual({ outcome: "no-counterparty" });
  });

  it("ambiguous-counterparty -- two other active members", async () => {
    const { coordinator } = buildEncryptionFixture({ members: [ALICE, BOB, CAROL] });
    expect(await coordinator.encrypt(VALID_COMMAND)).toEqual({ outcome: "ambiguous-counterparty" });
  });

  it("unsupported-counterparty-authority -- the counterparty is not nostr", async () => {
    const atprotoCounterparty: FedosConversationParticipantReference = { authority: "atproto", publicIdentifier: "did:plc:xyz", identityId: null };
    const { coordinator } = buildEncryptionFixture({ members: [ALICE, atprotoCounterparty] });
    expect(await coordinator.encrypt(VALID_COMMAND)).toEqual({ outcome: "unsupported-counterparty-authority" });
  });

  it("invalid-counterparty-public-key -- the counterparty is nostr but not well-formed hex", async () => {
    const malformed: FedosConversationParticipantReference = { authority: "nostr", publicIdentifier: "npub1notHex", identityId: null };
    const { coordinator } = buildEncryptionFixture({ members: [ALICE, malformed] });
    expect(await coordinator.encrypt(VALID_COMMAND)).toEqual({ outcome: "invalid-counterparty-public-key" });
  });

  it("identity-binding-unavailable -- local participant is nostr, no Binding Authority injected", async () => {
    const { coordinator } = buildEncryptionFixture({ local: ALICE_NOSTR, members: [ALICE_NOSTR, BOB] });
    expect(await coordinator.encrypt(VALID_COMMAND)).toEqual({ outcome: "identity-binding-unavailable" });
  });

  it("identity-binding-mismatch -- the REAL Nostr Identity Binding Authority rejects the configured account index", async () => {
    const bindingAuthority = new FedosSigningAuthorityNostrAuthorBinding(fakeSigningAuthority({ 0: "f".repeat(64) }));
    const { coordinator } = buildEncryptionFixture({ local: ALICE_NOSTR, members: [ALICE_NOSTR, BOB], nostrAuthorBindingAuthority: bindingAuthority });
    expect(await coordinator.encrypt(VALID_COMMAND)).toEqual({ outcome: "identity-binding-mismatch" });
  });

  it("key-unavailable -- the Encryption Authority itself resolves 'key-unavailable'", async () => {
    const { coordinator } = buildEncryptionFixture({ members: [ALICE, BOB], encryptionAuthority: new ScriptedEncryptionAuthority({ outcome: "key-unavailable" }) });
    expect(await coordinator.encrypt(VALID_COMMAND)).toEqual({ outcome: "key-unavailable" });
  });

  it("encryption-failed -- the Encryption Authority resolves 'unavailable' (the default UnavailableFedosConversationEncryptionAuthority's own outcome)", async () => {
    const { coordinator } = buildEncryptionFixture({ members: [ALICE, BOB], encryptionAuthority: new ScriptedEncryptionAuthority({ outcome: "unavailable" }) });
    expect(await coordinator.encrypt(VALID_COMMAND)).toEqual({ outcome: "encryption-failed" });
  });

  it("encryption-failed -- the Encryption Authority resolves 'failed' (an AEAD/tamper collapse, per Alpha 863)", async () => {
    const { coordinator } = buildEncryptionFixture({ members: [ALICE, BOB], encryptionAuthority: new ScriptedEncryptionAuthority({ outcome: "failed" }) });
    expect(await coordinator.encrypt(VALID_COMMAND)).toEqual({ outcome: "encryption-failed" });
  });

  it("persistence-failed -- a Payload write conflict", async () => {
    const { coordinator } = buildEncryptionFixture({ members: [ALICE, BOB], payloadStorage: new ConflictingPayloadStorage() });
    expect(await coordinator.encrypt(VALID_COMMAND)).toEqual({ outcome: "persistence-failed" });
  });

  it("persistence-failed -- an Envelope write conflict", async () => {
    const { coordinator } = buildEncryptionFixture({ members: [ALICE, BOB], envelopePersistence: new ConflictingEnvelopePersistence() });
    expect(await coordinator.encrypt(VALID_COMMAND)).toEqual({ outcome: "persistence-failed" });
  });
});

function buildDecryptionFixture(opts: {
  members?: readonly (FedosConversationParticipantReference | null)[];
  local?: FedosConversationParticipantReference;
  identityUnavailable?: boolean;
  nostrAuthorBindingAuthority?: FedosSigningAuthorityNostrAuthorBinding;
  decryptionAuthority?: FedosConversationDecryptionAuthority;
  envelope?: FedosPersistedConversationMessageEnvelopeV1 | null;
  payloadBytes?: Uint8Array | null;
  noDraft?: boolean;
  draftInactive?: boolean;
}) {
  const local = opts.local ?? ALICE;
  const draftPersistence = new InMemoryFedosConversationDraftPersistence();
  if (!opts.noDraft) {
    draftPersistence.putDraft(
      opts.draftInactive
        ? { ...activeDraftRecord(CONVERSATION_ID, local), lifecycleState: "draft" }
        : activeDraftRecord(CONVERSATION_ID, local),
    );
  }
  const membershipAuthority = new InMemoryFedosConversationMembershipAuthority();
  for (const m of opts.members ?? []) {
    if (m !== null) membershipAuthority.admit(CONVERSATION_ID, m, m === local ? "owner" : "member", NOW);
  }
  const envelopePersistence = new InMemoryFedosConversationMessageEnvelopePersistence();
  const envelope: FedosPersistedConversationMessageEnvelopeV1 =
    opts.envelope === undefined
      ? {
          schemaVersion: 1,
          id: "fm-envelope",
          conversationId: CONVERSATION_ID,
          senderMembershipId: "fm-sender",
          payloadId: "fm-payload",
          encryptionSuite: "ChaCha20Poly1305",
          keyEpoch: 0,
          createdAt: NOW,
          replyToEnvelopeId: null,
        }
      : (opts.envelope as FedosPersistedConversationMessageEnvelopeV1);
  if (opts.envelope !== null) envelopePersistence.putEnvelope(envelope);

  const payloadStorage = new InMemoryFedosConversationPayloadStorage();
  if (opts.payloadBytes !== null) {
    payloadStorage.putPayload(
      { id: "fm-payload" as any, conversationId: CONVERSATION_ID, mediaType: "application/octet-stream", byteLength: (opts.payloadBytes ?? new Uint8Array([9])).length, createdAt: NOW },
      opts.payloadBytes ?? new Uint8Array([9]),
    );
  }

  const identityResolver = opts.identityUnavailable
    ? { resolveLocalParticipant: () => ({ outcome: "unavailable" as const }) }
    : new DelegatingFedosConversationIdentityResolver(new StaticFedosConversationCreatorIdentityAuthority(local));
  const keyResolver = new FedosConversationKeyResolver({
    identityResolver,
    participantResolver: new MembershipFedosConversationParticipantResolver(membershipAuthority),
    accountIndexAuthority: new FixedFedosConversationLocalAccountIndexAuthority(0),
    nostrAuthorBindingAuthority: opts.nostrAuthorBindingAuthority,
  });
  const coordinator = new FedosConversationDecryptionCoordinator({
    draftPersistence,
    membershipAuthority,
    identityResolver,
    keyResolver,
    decryptionAuthority: opts.decryptionAuthority ?? new ScriptedDecryptionAuthority({ outcome: "decrypted", plaintext: new Uint8Array([1]) }),
    envelopePersistence,
    payloadStorage,
  });
  return { coordinator };
}

const DECRYPT_COMMAND = { conversationId: CONVERSATION_ID, envelopeId: "fm-envelope" };

describe("Alpha 946 -- FedosConversationDecryptionCoordinator failure matrix", () => {
  it("decrypted -- happy path", async () => {
    const { coordinator } = buildDecryptionFixture({ members: [ALICE, BOB], payloadBytes: new Uint8Array([9]) });
    expect((await coordinator.decrypt(DECRYPT_COMMAND)).outcome).toBe("decrypted");
  });

  it("invalid-command -- empty envelopeId", async () => {
    const { coordinator } = buildDecryptionFixture({ members: [ALICE, BOB], payloadBytes: new Uint8Array([9]) });
    expect(await coordinator.decrypt({ ...DECRYPT_COMMAND, envelopeId: "" })).toEqual({ outcome: "invalid-command" });
  });

  it("envelope-not-found -- no Envelope persisted for this id", async () => {
    const { coordinator } = buildDecryptionFixture({ members: [ALICE, BOB], envelope: null });
    expect(await coordinator.decrypt(DECRYPT_COMMAND)).toEqual({ outcome: "envelope-not-found" });
  });

  it("envelope-not-found -- the Envelope belongs to a DIFFERENT Conversation than requested", async () => {
    const { coordinator } = buildDecryptionFixture({
      members: [ALICE, BOB],
      payloadBytes: new Uint8Array([9]),
      envelope: {
        schemaVersion: 1,
        id: "fm-envelope",
        conversationId: "private-draft::direct::someone-elses" as any,
        senderMembershipId: "fm-sender",
        payloadId: "fm-payload",
        encryptionSuite: "ChaCha20Poly1305",
        keyEpoch: 0,
        createdAt: NOW,
        replyToEnvelopeId: null,
      },
    });
    expect(await coordinator.decrypt(DECRYPT_COMMAND)).toEqual({ outcome: "envelope-not-found" });
  });

  it("conversation-not-found -- no persisted draft for the Conversation the Envelope points to", async () => {
    const { coordinator } = buildDecryptionFixture({ members: [ALICE, BOB], payloadBytes: new Uint8Array([9]), noDraft: true });
    expect(await coordinator.decrypt(DECRYPT_COMMAND)).toEqual({ outcome: "conversation-not-found" });
  });

  it("conversation-not-active -- a genuine, still-draft Conversation", async () => {
    const { coordinator } = buildDecryptionFixture({ members: [ALICE, BOB], payloadBytes: new Uint8Array([9]), draftInactive: true });
    expect(await coordinator.decrypt(DECRYPT_COMMAND)).toEqual({ outcome: "conversation-not-active" });
  });

  it("identity-unavailable", async () => {
    const { coordinator } = buildDecryptionFixture({ members: [ALICE, BOB], payloadBytes: new Uint8Array([9]), identityUnavailable: true });
    expect(await coordinator.decrypt(DECRYPT_COMMAND)).toEqual({ outcome: "identity-unavailable" });
  });

  it("not-member", async () => {
    const { coordinator } = buildDecryptionFixture({ members: [BOB], payloadBytes: new Uint8Array([9]) });
    expect(await coordinator.decrypt(DECRYPT_COMMAND)).toEqual({ outcome: "not-member" });
  });

  it("unsupported-epoch -- REACHABLE here (unlike encrypt()) because a persisted Envelope's own keyEpoch is a plain non-negative integer, not narrowed to 0", async () => {
    const { coordinator } = buildDecryptionFixture({
      members: [ALICE, BOB],
      payloadBytes: new Uint8Array([9]),
      envelope: {
        schemaVersion: 1,
        id: "fm-envelope",
        conversationId: CONVERSATION_ID,
        senderMembershipId: "fm-sender",
        payloadId: "fm-payload",
        encryptionSuite: "ChaCha20Poly1305",
        keyEpoch: 5,
        createdAt: NOW,
        replyToEnvelopeId: null,
      },
    });
    expect(await coordinator.decrypt(DECRYPT_COMMAND)).toEqual({ outcome: "unsupported-epoch" });
  });

  it("no-counterparty", async () => {
    const { coordinator } = buildDecryptionFixture({ members: [ALICE], payloadBytes: new Uint8Array([9]) });
    expect(await coordinator.decrypt(DECRYPT_COMMAND)).toEqual({ outcome: "no-counterparty" });
  });

  it("ambiguous-counterparty", async () => {
    const { coordinator } = buildDecryptionFixture({ members: [ALICE, BOB, CAROL], payloadBytes: new Uint8Array([9]) });
    expect(await coordinator.decrypt(DECRYPT_COMMAND)).toEqual({ outcome: "ambiguous-counterparty" });
  });

  it("unsupported-counterparty-authority", async () => {
    const atprotoCounterparty: FedosConversationParticipantReference = { authority: "atproto", publicIdentifier: "did:plc:xyz", identityId: null };
    const { coordinator } = buildDecryptionFixture({ members: [ALICE, atprotoCounterparty], payloadBytes: new Uint8Array([9]) });
    expect(await coordinator.decrypt(DECRYPT_COMMAND)).toEqual({ outcome: "unsupported-counterparty-authority" });
  });

  it("invalid-counterparty-public-key", async () => {
    const malformed: FedosConversationParticipantReference = { authority: "nostr", publicIdentifier: "npub1notHex", identityId: null };
    const { coordinator } = buildDecryptionFixture({ members: [ALICE, malformed], payloadBytes: new Uint8Array([9]) });
    expect(await coordinator.decrypt(DECRYPT_COMMAND)).toEqual({ outcome: "invalid-counterparty-public-key" });
  });

  it("identity-binding-unavailable", async () => {
    const { coordinator } = buildDecryptionFixture({ local: ALICE_NOSTR, members: [ALICE_NOSTR, BOB], payloadBytes: new Uint8Array([9]) });
    expect(await coordinator.decrypt(DECRYPT_COMMAND)).toEqual({ outcome: "identity-binding-unavailable" });
  });

  it("identity-binding-mismatch", async () => {
    const bindingAuthority = new FedosSigningAuthorityNostrAuthorBinding(fakeSigningAuthority({ 0: "f".repeat(64) }));
    const { coordinator } = buildDecryptionFixture({
      local: ALICE_NOSTR,
      members: [ALICE_NOSTR, BOB],
      payloadBytes: new Uint8Array([9]),
      nostrAuthorBindingAuthority: bindingAuthority,
    });
    expect(await coordinator.decrypt(DECRYPT_COMMAND)).toEqual({ outcome: "identity-binding-mismatch" });
  });

  it("payload-not-found -- the Envelope exists but its referenced Payload does not", async () => {
    const { coordinator } = buildDecryptionFixture({ members: [ALICE, BOB], payloadBytes: null });
    expect(await coordinator.decrypt(DECRYPT_COMMAND)).toEqual({ outcome: "payload-not-found" });
  });

  it("key-unavailable -- the Decryption Authority itself resolves 'key-unavailable'", async () => {
    const { coordinator } = buildDecryptionFixture({
      members: [ALICE, BOB],
      payloadBytes: new Uint8Array([9]),
      decryptionAuthority: new ScriptedDecryptionAuthority({ outcome: "key-unavailable" }),
    });
    expect(await coordinator.decrypt(DECRYPT_COMMAND)).toEqual({ outcome: "key-unavailable" });
  });

  it("decryption-failed -- the Decryption Authority resolves 'failed' (tamper/AEAD collapse, per Alpha 865)", async () => {
    const { coordinator } = buildDecryptionFixture({
      members: [ALICE, BOB],
      payloadBytes: new Uint8Array([9]),
      decryptionAuthority: new ScriptedDecryptionAuthority({ outcome: "failed" }),
    });
    expect(await coordinator.decrypt(DECRYPT_COMMAND)).toEqual({ outcome: "decryption-failed" });
  });

  it("decryption-failed -- the Decryption Authority resolves 'unavailable' (the default UnavailableFedosConversationDecryptionAuthority's own outcome)", async () => {
    const { coordinator } = buildDecryptionFixture({
      members: [ALICE, BOB],
      payloadBytes: new Uint8Array([9]),
      decryptionAuthority: new ScriptedDecryptionAuthority({ outcome: "unavailable" }),
    });
    expect(await coordinator.decrypt(DECRYPT_COMMAND)).toEqual({ outcome: "decryption-failed" });
  });
});
