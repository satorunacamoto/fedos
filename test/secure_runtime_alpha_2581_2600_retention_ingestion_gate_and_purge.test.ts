import { describe, it, expect } from "vitest";
import { validateFedosConversationMessageEnvelope } from "../src/os/messenger/conversations/envelope/fedos_conversation_message_envelope_validator.js";
import type { FedosConversationMessageEnvelope } from "../src/os/messenger/conversations/envelope/fedos_conversation_message_envelope.js";
import { InMemoryFedosConversationMembershipAuthority } from "../src/os/messenger/conversations/membership/in_memory_fedos_conversation_membership_authority.js";
import { InMemoryFedosConversationDraftPersistence } from "../src/os/messenger/conversations/construction/in_memory_fedos_conversation_draft_persistence.js";
import type { FedosPersistedConversationDraftRecordV1 } from "../src/os/messenger/conversations/construction/fedos_persisted_conversation_draft_record_v1.js";
import {
  FedosConversationSearchIndex,
  type FedosConversationSearchIndexDependencies,
  type FedosConversationSearchRetentionAuthorityDependency,
} from "../src/os/messenger/conversations/search/fedos_conversation_search_index.js";
import type { FedosConversationId } from "../src/os/messenger/conversations/fedos_conversation_id.js";
import type { FedosConversationParticipantReference } from "../src/os/messenger/conversations/membership/fedos_conversation_participant_reference.js";
import { FedosPayloadRetentionAuthority } from "../src/os/messenger/conversations/retention/fedos_payload_retention_authority.js";
import { InMemoryFedosPayloadRetentionPersistence } from "../src/os/messenger/conversations/retention/in_memory_fedos_payload_retention_persistence.js";
import { InMemoryFedosConversationPayloadStorage } from "../src/os/messenger/conversations/payload_storage/in_memory_fedos_conversation_payload_storage.js";
import type { FedosConversationPayloadId } from "../src/os/messenger/conversations/payload_storage/fedos_conversation_payload_id.js";

/**
 * Secure Runtime Alpha 2581–2620 ("Conversation Search Retention
 * Authority and Index Purge Hardening") — ingestion-gate + purge test
 * matrix. Closes the Private Conversation Search V1 runtime audit's
 * High-severity finding (`docs/reviews/private_conversation_search_runtime_v1/11_retention_bypass_risk_realized.md`):
 * `indexEnvelope()`/`indexArchiveBundle()` now refuse anything the
 * injected `FedosPayloadRetentionAuthority` does not currently permit,
 * and `removeEnvelope()`/`reconcilePayloadRetention()` purge every
 * searchable trace once a payload is no longer permitted.
 */

const ALICE: FedosConversationParticipantReference = { authority: "fedos", publicIdentifier: "alice", identityId: null };
const BOB: FedosConversationParticipantReference = { authority: "fedos", publicIdentifier: "bob", identityId: null };

interface Environment {
  readonly draftPersistence: InMemoryFedosConversationDraftPersistence;
  readonly membershipAuthority: InMemoryFedosConversationMembershipAuthority;
  readonly payloadStorage: InMemoryFedosConversationPayloadStorage;
  readonly retentionAuthority: FedosPayloadRetentionAuthority;
}

function makeEnvironment(): Environment {
  const payloadStorage = new InMemoryFedosConversationPayloadStorage();
  return {
    draftPersistence: new InMemoryFedosConversationDraftPersistence(),
    membershipAuthority: new InMemoryFedosConversationMembershipAuthority(),
    payloadStorage,
    retentionAuthority: new FedosPayloadRetentionAuthority({
      retentionPersistence: new InMemoryFedosPayloadRetentionPersistence(),
      payloadStorage,
    }),
  };
}

function deps(env: Environment): FedosConversationSearchIndexDependencies {
  return { draftPersistence: env.draftPersistence, membershipAuthority: env.membershipAuthority, retentionAuthority: env.retentionAuthority };
}

function registerConversation(env: Environment, conversationId: FedosConversationId, mode: "direct" | "private-group"): void {
  const draft: FedosPersistedConversationDraftRecordV1 = {
    schemaVersion: 1,
    id: conversationId,
    mode,
    lifecycleState: "draft",
    policyReference: mode === "direct" ? "direct-draft-v1" : "private-group-draft-v1",
    creatorAuthority: "fedos",
    creatorPublicIdentifier: "alice",
    creatorIdentityId: null,
    createdAt: 1_700_000_000,
  };
  env.draftPersistence.putDraft(draft);
}

function admit(env: Environment, conversationId: FedosConversationId, participant: FedosConversationParticipantReference, role: "owner" | "member" = "member"): string {
  const result = env.membershipAuthority.admit(conversationId, participant, role, 1_700_000_000);
  if (result.outcome !== "admitted") throw new Error("test setup failed");
  return result.membership.id;
}

function seedPayload(env: Environment, conversationId: FedosConversationId, payloadId: string): void {
  env.payloadStorage.putPayload(
    { id: payloadId as FedosConversationPayloadId, conversationId, mediaType: "application/octet-stream", byteLength: 1, createdAt: 1_700_000_000 },
    new Uint8Array([1]),
  );
}

function buildEnvelope(overrides: Partial<Record<string, unknown>>): FedosConversationMessageEnvelope {
  const built = validateFedosConversationMessageEnvelope({
    id: "e1",
    conversationId: "private-draft::direct::conv-1" as FedosConversationId,
    senderMembershipId: "whoever",
    payloadId: "payload-1",
    encryptionSuite: "ChaCha20Poly1305",
    keyEpoch: 0,
    createdAt: 1_700_000_000,
    replyToEnvelopeId: null,
    ...overrides,
  });
  if (built === null) throw new Error("test setup: invalid envelope fixture");
  return built;
}

describe("Secure Runtime Alpha 2581-2600 -- ingestion gate: allowed / denied / tombstoned", () => {
  it("1. an allowed Envelope is indexed and found by every content query", () => {
    const env = makeEnvironment();
    const conversationId = "private-draft::direct::conv-1" as FedosConversationId;
    registerConversation(env, conversationId, "direct");
    const aliceId = admit(env, conversationId, ALICE, "owner");
    seedPayload(env, conversationId, "payload-1");
    const searchIndex = new FedosConversationSearchIndex(deps(env));
    const envelope = buildEnvelope({ conversationId, senderMembershipId: aliceId });

    expect(searchIndex.indexEnvelope({ envelope, text: "an allowed message" })).toBe("indexed");
    expect(searchIndex.searchKeyword("allowed")).toEqual([envelope.id]);
    expect(searchIndex.envelopesByParticipant(ALICE)).toEqual([envelope.id]);
    expect(searchIndex.envelopesBetween(1_699_999_999, 1_700_000_001)).toEqual([envelope.id]);
  });

  it("2. a denied Envelope (payload unknown to storage) is never indexed", () => {
    const env = makeEnvironment();
    const conversationId = "private-draft::direct::conv-1" as FedosConversationId;
    registerConversation(env, conversationId, "direct");
    const aliceId = admit(env, conversationId, ALICE, "owner");
    // Deliberately never seeded into payloadStorage.
    const searchIndex = new FedosConversationSearchIndex(deps(env));
    const envelope = buildEnvelope({ conversationId, senderMembershipId: aliceId });

    expect(searchIndex.indexEnvelope({ envelope, text: "should never be searchable" })).toBe("denied");
    expect(searchIndex.searchKeyword("never")).toEqual([]);
    expect(searchIndex.size()).toBe(0);
  });

  it("3. a tombstoned Envelope's payload is never indexed", () => {
    const env = makeEnvironment();
    const conversationId = "private-draft::direct::conv-1" as FedosConversationId;
    registerConversation(env, conversationId, "direct");
    const aliceId = admit(env, conversationId, ALICE, "owner");
    seedPayload(env, conversationId, "payload-1");
    env.retentionAuthority.tombstonePayload("payload-1" as FedosConversationPayloadId, null, "test_placeholder");
    const searchIndex = new FedosConversationSearchIndex(deps(env));
    const envelope = buildEnvelope({ conversationId, senderMembershipId: aliceId });

    expect(searchIndex.indexEnvelope({ envelope, text: "tombstoned before indexing" })).toBe("denied");
    expect(searchIndex.searchKeyword("tombstoned")).toEqual([]);
    expect(searchIndex.size()).toBe(0);
  });

  it("4. an allowed-then-tombstoned Envelope is purged from every sub-index by reconcilePayloadRetention", () => {
    const env = makeEnvironment();
    const conversationId = "private-draft::direct::conv-1" as FedosConversationId;
    registerConversation(env, conversationId, "direct");
    const aliceId = admit(env, conversationId, ALICE, "owner");
    seedPayload(env, conversationId, "payload-1");
    const searchIndex = new FedosConversationSearchIndex(deps(env));
    const envelope = buildEnvelope({ conversationId, senderMembershipId: aliceId });

    expect(searchIndex.indexEnvelope({ envelope, text: "a secret plan" })).toBe("indexed");
    expect(searchIndex.searchKeyword("secret")).toEqual([envelope.id]);

    env.retentionAuthority.tombstonePayload("payload-1" as FedosConversationPayloadId, null, "test_placeholder");
    expect(searchIndex.reconcilePayloadRetention("payload-1" as FedosConversationPayloadId)).toBe(1);

    expect(searchIndex.searchKeyword("secret")).toEqual([]);
    expect(searchIndex.envelopesBetween(0, 2_000_000_000)).toEqual([]);
    expect(searchIndex.envelopesByParticipant(ALICE)).toEqual([]);
    expect(searchIndex.size()).toBe(0);
    // A second reconcile call is a documented no-op, never an error, never a re-purge of nothing.
    expect(searchIndex.reconcilePayloadRetention("payload-1" as FedosConversationPayloadId)).toBe(0);
  });

  it("8. indexing the same allowed Envelope twice remains a duplicate no-op, never double-counted", () => {
    const env = makeEnvironment();
    const conversationId = "private-draft::direct::conv-1" as FedosConversationId;
    registerConversation(env, conversationId, "direct");
    const aliceId = admit(env, conversationId, ALICE, "owner");
    seedPayload(env, conversationId, "payload-1");
    const searchIndex = new FedosConversationSearchIndex(deps(env));
    const envelope = buildEnvelope({ conversationId, senderMembershipId: aliceId });

    expect(searchIndex.indexEnvelope({ envelope, text: "hello" })).toBe("indexed");
    expect(searchIndex.indexEnvelope({ envelope, text: "hello" })).toBe("duplicate");
    expect(searchIndex.size()).toBe(1);
  });

  it("19. removeEnvelope() removes every sub-index entry for an allowed, indexed Envelope", () => {
    const env = makeEnvironment();
    const conversationId = "private-draft::direct::conv-1" as FedosConversationId;
    registerConversation(env, conversationId, "direct");
    const aliceId = admit(env, conversationId, ALICE, "owner");
    const bobId = admit(env, conversationId, BOB, "member");
    seedPayload(env, conversationId, "payload-parent");
    seedPayload(env, conversationId, "payload-child");
    const searchIndex = new FedosConversationSearchIndex(deps(env));
    const parent = buildEnvelope({ id: "parent", conversationId, senderMembershipId: aliceId, payloadId: "payload-parent" });
    const child = buildEnvelope({ id: "child", conversationId, senderMembershipId: bobId, payloadId: "payload-child", replyToEnvelopeId: "parent", createdAt: 1_700_000_050 });
    searchIndex.indexEnvelope({ envelope: parent, text: "root text" });
    searchIndex.indexEnvelope({ envelope: child, text: "child text" });

    expect(searchIndex.removeEnvelope(parent.id)).toBe("removed");
    expect(searchIndex.searchKeyword("root")).toEqual([]);
    expect(searchIndex.envelopesBetween(1_700_000_000, 1_700_000_000)).toEqual([]);
    expect(searchIndex.envelopesByParticipant(ALICE)).toEqual([]);
    expect(searchIndex.parentOf(child.id)).toBeNull();
    expect(searchIndex.size()).toBe(1);
  });
});

describe("Secure Runtime Alpha 2581-2600 -- retention gating is mode/suite-neutral", () => {
  it("11. retention gating applies to a private-group conversation's Envelope exactly as to any other", () => {
    const env = makeEnvironment();
    const conversationId = "private-draft::private-group::conv-g1" as FedosConversationId;
    registerConversation(env, conversationId, "private-group");
    const aliceId = admit(env, conversationId, ALICE, "owner");
    seedPayload(env, conversationId, "payload-1");
    env.retentionAuthority.tombstonePayload("payload-1" as FedosConversationPayloadId, null, "test_placeholder");
    const searchIndex = new FedosConversationSearchIndex(deps(env));
    const envelope = buildEnvelope({ conversationId, senderMembershipId: aliceId });

    expect(searchIndex.indexEnvelope({ envelope, text: "group message" })).toBe("denied");
  });

  it("12. retention gating applies to a direct conversation's Envelope exactly as to any other", () => {
    const env = makeEnvironment();
    const conversationId = "private-draft::direct::conv-d1" as FedosConversationId;
    registerConversation(env, conversationId, "direct");
    const aliceId = admit(env, conversationId, ALICE, "owner");
    seedPayload(env, conversationId, "payload-1");
    env.retentionAuthority.tombstonePayload("payload-1" as FedosConversationPayloadId, null, "test_placeholder");
    const searchIndex = new FedosConversationSearchIndex(deps(env));
    const envelope = buildEnvelope({ conversationId, senderMembershipId: aliceId });

    expect(searchIndex.indexEnvelope({ envelope, text: "direct message" })).toBe("denied");
  });

  it("13. retention gating is policy-neutral across encryption suite -- Aes256Gcm is gated identically to ChaCha20Poly1305, confirming no Sender-Key/Group-aware special-casing", () => {
    const env = makeEnvironment();
    const conversationId = "private-draft::private-group::conv-g2" as FedosConversationId;
    registerConversation(env, conversationId, "private-group");
    const aliceId = admit(env, conversationId, ALICE, "owner");
    seedPayload(env, conversationId, "payload-allowed");
    // "payload-denied" is deliberately never seeded.
    const searchIndex = new FedosConversationSearchIndex(deps(env));
    const allowed = buildEnvelope({ id: "allowed", conversationId, senderMembershipId: aliceId, payloadId: "payload-allowed", encryptionSuite: "Aes256Gcm" });
    const denied = buildEnvelope({ id: "denied", conversationId, senderMembershipId: aliceId, payloadId: "payload-denied", encryptionSuite: "Aes256Gcm" });

    expect(searchIndex.indexEnvelope({ envelope: allowed, text: "aes allowed" })).toBe("indexed");
    expect(searchIndex.indexEnvelope({ envelope: denied, text: "aes denied" })).toBe("denied");
  });

  it("14. an Envelope referencing a payload id unknown to storage fails closed, never defaults to allowed", () => {
    const env = makeEnvironment();
    const conversationId = "private-draft::direct::conv-1" as FedosConversationId;
    registerConversation(env, conversationId, "direct");
    const aliceId = admit(env, conversationId, ALICE, "owner");
    seedPayload(env, conversationId, "payload-real");
    const searchIndex = new FedosConversationSearchIndex(deps(env));
    // Deliberate mismatch: the Envelope names a payload id storage has never heard of.
    const envelope = buildEnvelope({ conversationId, senderMembershipId: aliceId, payloadId: "payload-does-not-exist" });

    expect(searchIndex.indexEnvelope({ envelope, text: "wrong identity" })).toBe("denied");
    expect(searchIndex.size()).toBe(0);
  });

  it("15. an unavailable Retention Authority (evaluatePayloadAccess throws) fails closed, never defaults to allowed", () => {
    const env = makeEnvironment();
    const conversationId = "private-draft::direct::conv-1" as FedosConversationId;
    registerConversation(env, conversationId, "direct");
    const aliceId = admit(env, conversationId, ALICE, "owner");
    const throwingAuthority: FedosConversationSearchRetentionAuthorityDependency = {
      evaluatePayloadAccess: () => {
        throw new Error("retention authority unavailable");
      },
    };
    const searchIndex = new FedosConversationSearchIndex({ draftPersistence: env.draftPersistence, membershipAuthority: env.membershipAuthority, retentionAuthority: throwingAuthority });
    const envelope = buildEnvelope({ conversationId, senderMembershipId: aliceId });

    expect(() => searchIndex.indexEnvelope({ envelope, text: "should fail closed" })).not.toThrow();
    expect(searchIndex.indexEnvelope({ envelope, text: "should fail closed" })).toBe("denied");
    expect(searchIndex.size()).toBe(0);
  });

  it("16. no plaintext from a denied Envelope is ever retrievable through any query surface", () => {
    const env = makeEnvironment();
    const conversationId = "private-draft::direct::conv-1" as FedosConversationId;
    registerConversation(env, conversationId, "direct");
    const aliceId = admit(env, conversationId, ALICE, "owner");
    // Never seeded -- denied.
    const searchIndex = new FedosConversationSearchIndex(deps(env));
    const envelope = buildEnvelope({ conversationId, senderMembershipId: aliceId });

    expect(searchIndex.indexEnvelope({ envelope, text: "unleakedtoken12345" })).toBe("denied");
    expect(searchIndex.searchKeyword("unleakedtoken12345")).toEqual([]);
    expect(searchIndex.size()).toBe(0);
  });
});
