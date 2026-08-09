import { describe, it, expect } from "vitest";
import { validateFedosConversationMessageEnvelope } from "../src/os/messenger/conversations/envelope/fedos_conversation_message_envelope_validator.js";
import { InMemoryFedosConversationMembershipAuthority } from "../src/os/messenger/conversations/membership/in_memory_fedos_conversation_membership_authority.js";
import { InMemoryFedosConversationDraftPersistence } from "../src/os/messenger/conversations/construction/in_memory_fedos_conversation_draft_persistence.js";
import type { FedosPersistedConversationDraftRecordV1 } from "../src/os/messenger/conversations/construction/fedos_persisted_conversation_draft_record_v1.js";
import {
  FedosConversationSearchIndex,
  type FedosConversationSearchIndexDependencies,
} from "../src/os/messenger/conversations/search/fedos_conversation_search_index.js";
import type { FedosConversationId } from "../src/os/messenger/conversations/fedos_conversation_id.js";
import type { FedosConversationParticipantReference } from "../src/os/messenger/conversations/membership/fedos_conversation_participant_reference.js";
import { FedosPayloadRetentionAuthority } from "../src/os/messenger/conversations/retention/fedos_payload_retention_authority.js";
import { InMemoryFedosPayloadRetentionPersistence } from "../src/os/messenger/conversations/retention/in_memory_fedos_payload_retention_persistence.js";
import { InMemoryFedosConversationPayloadStorage } from "../src/os/messenger/conversations/payload_storage/in_memory_fedos_conversation_payload_storage.js";
import type { FedosConversationPayloadId } from "../src/os/messenger/conversations/payload_storage/fedos_conversation_payload_id.js";
import { FEDOS_CONVERSATION_ARCHIVE_SCHEMA_VERSION } from "../src/os/messenger/conversations/archive/fedos_conversation_archive_schema_version.js";
import type { FedosConversationArchiveBundleV1 } from "../src/os/messenger/conversations/archive/fedos_conversation_archive_bundle.js";

/**
 * Secure Runtime Alpha 2581–2620 ("Conversation Search Retention
 * Authority and Index Purge Hardening") — Archive-ingestion gating,
 * restart reconciliation, query-time race safety, and existing-behavior
 * compatibility test matrix (continues
 * `secure_runtime_alpha_2581_2600_retention_ingestion_gate_and_purge.test.ts`).
 */

const ALICE: FedosConversationParticipantReference = { authority: "fedos", publicIdentifier: "alice", identityId: null };
const BOB: FedosConversationParticipantReference = { authority: "fedos", publicIdentifier: "bob", identityId: null };
const ARCHIVE_CONVERSATION_ID = "board-a::thread-archive" as FedosConversationId;

interface Environment {
  readonly draftPersistence: InMemoryFedosConversationDraftPersistence;
  readonly membershipAuthority: InMemoryFedosConversationMembershipAuthority;
  readonly payloadStorage: InMemoryFedosConversationPayloadStorage;
  readonly retentionPersistence: InMemoryFedosPayloadRetentionPersistence;
  readonly retentionAuthority: FedosPayloadRetentionAuthority;
}

function makeEnvironment(): Environment {
  const payloadStorage = new InMemoryFedosConversationPayloadStorage();
  const retentionPersistence = new InMemoryFedosPayloadRetentionPersistence();
  return {
    draftPersistence: new InMemoryFedosConversationDraftPersistence(),
    membershipAuthority: new InMemoryFedosConversationMembershipAuthority(),
    payloadStorage,
    retentionPersistence,
    retentionAuthority: new FedosPayloadRetentionAuthority({ retentionPersistence, payloadStorage }),
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

function archiveBundle(envelopeIds: readonly string[], senderMembershipId: string): FedosConversationArchiveBundleV1 {
  return {
    schemaVersion: FEDOS_CONVERSATION_ARCHIVE_SCHEMA_VERSION,
    conversationId: ARCHIVE_CONVERSATION_ID,
    exportedAt: 1_700_000_500,
    conversation: {
      schemaVersion: 1,
      id: ARCHIVE_CONVERSATION_ID,
      mode: "public",
      boardId: "board-a",
      rootThreadId: "thread-archive",
      rootPostId: "thread-archive",
      policyReference: "public-v1",
      createdAt: 1_700_000_000,
    },
    memberships: [],
    capabilityEvents: [],
    envelopes: envelopeIds.map((id, index) => ({
      schemaVersion: 1,
      id,
      conversationId: ARCHIVE_CONVERSATION_ID,
      senderMembershipId,
      payloadId: `payload-${id}`,
      encryptionSuite: "ChaCha20Poly1305" as const,
      keyEpoch: 0,
      createdAt: 1_700_000_010 + index,
      replyToEnvelopeId: null,
    })),
    payloads: [],
  };
}

describe("Secure Runtime Alpha 2601-2620 -- Archive ingestion gate", () => {
  it("5. a denied Archive record (payload unknown to destination storage) is not indexed", () => {
    const env = makeEnvironment();
    const senderMembershipId = admit(env, ARCHIVE_CONVERSATION_ID, ALICE, "owner");
    const searchIndex = new FedosConversationSearchIndex(deps(env));
    const bundle = archiveBundle(["envelope-1"], senderMembershipId);
    // "payload-envelope-1" is deliberately never seeded into destination storage.

    const outcome = searchIndex.indexArchiveBundle(bundle, new Map([["envelope-1", "denied archive text"]]), 1_700_001_000);
    expect(outcome).toEqual({ indexed: 0, duplicate: 0, denied: 1 });
    expect(searchIndex.searchKeyword("denied")).toEqual([]);
    expect(searchIndex.size()).toBe(0);
  });

  it("6. a mixed Archive indexes only permitted records, honestly reporting the denied count", () => {
    const env = makeEnvironment();
    const senderMembershipId = admit(env, ARCHIVE_CONVERSATION_ID, ALICE, "owner");
    seedPayload(env, ARCHIVE_CONVERSATION_ID, "payload-envelope-allowed");
    // "payload-envelope-denied" deliberately never seeded.
    const searchIndex = new FedosConversationSearchIndex(deps(env));
    const bundle = archiveBundle(["envelope-allowed", "envelope-denied"], senderMembershipId);

    const outcome = searchIndex.indexArchiveBundle(
      bundle,
      new Map([
        ["envelope-allowed", "permitted archive text"],
        ["envelope-denied", "denied archive text"],
      ]),
      1_700_001_000,
    );
    expect(outcome).toEqual({ indexed: 1, duplicate: 0, denied: 1 });
    expect(searchIndex.searchKeyword("permitted")).toEqual(["envelope-allowed"]);
    expect(searchIndex.searchKeyword("denied")).toEqual([]);
    expect(searchIndex.size()).toBe(1);
  });

  it("7. restored plaintext does not bypass local retention -- a payload physically present in destination storage (as Archive Restore's own known bypass, per audit Review 11, could leave it) is still refused once locally tombstoned", () => {
    const env = makeEnvironment();
    const senderMembershipId = admit(env, ARCHIVE_CONVERSATION_ID, ALICE, "owner");
    // Simulates Archive Restore's own already-documented bypass: the payload bytes exist in destination
    // storage regardless of retention state (Restore writes via payloadStorage.putPayload() directly).
    seedPayload(env, ARCHIVE_CONVERSATION_ID, "payload-envelope-1");
    env.retentionAuthority.tombstonePayload("payload-envelope-1" as FedosConversationPayloadId, null, "test_placeholder");
    const searchIndex = new FedosConversationSearchIndex(deps(env));
    const bundle = archiveBundle(["envelope-1"], senderMembershipId);

    const outcome = searchIndex.indexArchiveBundle(bundle, new Map([["envelope-1", "restored plaintext"]]), 1_700_001_000);
    expect(outcome).toEqual({ indexed: 0, duplicate: 0, denied: 1 });
    expect(searchIndex.searchKeyword("restored")).toEqual([]);
    expect(searchIndex.isFromArchive(ARCHIVE_CONVERSATION_ID)).toBe(false);
  });

  it("bonus: once a conversation's only indexed Archive record is denied, its Mode/Archive classification is never left stale (closes audit's Review 03/14 dead-code finding)", () => {
    const env = makeEnvironment();
    const senderMembershipId = admit(env, ARCHIVE_CONVERSATION_ID, ALICE, "owner");
    const searchIndex = new FedosConversationSearchIndex(deps(env));
    const bundle = archiveBundle(["envelope-1"], senderMembershipId);
    searchIndex.indexArchiveBundle(bundle, new Map([["envelope-1", "denied text"]]), 1_700_001_000);
    expect(searchIndex.isFromArchive(ARCHIVE_CONVERSATION_ID)).toBe(false);
    expect(searchIndex.archivedConversationIds()).toEqual([]);
  });
});

describe("Secure Runtime Alpha 2601-2620 -- restart reconciliation", () => {
  it("9. restart does not resurrect content denied at the time of restart", () => {
    const conversationId = "private-draft::direct::conv-restart" as FedosConversationId;

    // Shared DURABLE state across the "before" and "after restart" generations: the same retention
    // decisions and the same payload storage, exactly like a real restart re-reads the same disk state.
    const payloadStorage = new InMemoryFedosConversationPayloadStorage();
    const retentionPersistence = new InMemoryFedosPayloadRetentionPersistence();
    seedPayloadInto(payloadStorage, conversationId, "payload-allowed");
    seedPayloadInto(payloadStorage, conversationId, "payload-denied");
    const sharedRetentionAuthority = new FedosPayloadRetentionAuthority({ retentionPersistence, payloadStorage });
    sharedRetentionAuthority.tombstonePayload("payload-denied" as FedosConversationPayloadId, null, "test_placeholder");

    function buildGenerationDeps(): FedosConversationSearchIndexDependencies {
      const draftPersistence = new InMemoryFedosConversationDraftPersistence();
      draftPersistence.putDraft({
        schemaVersion: 1,
        id: conversationId,
        mode: "direct",
        lifecycleState: "draft",
        policyReference: "direct-draft-v1",
        creatorAuthority: "fedos",
        creatorPublicIdentifier: "alice",
        creatorIdentityId: null,
        createdAt: 1_700_000_000,
      });
      const membershipAuthority = new InMemoryFedosConversationMembershipAuthority();
      const admitted = membershipAuthority.admit(conversationId, ALICE, "owner", 1_700_000_000);
      if (admitted.outcome !== "admitted") throw new Error("test setup failed");
      return { draftPersistence, membershipAuthority, retentionAuthority: sharedRetentionAuthority };
    }

    function feed(index: FedosConversationSearchIndex, aliceMembershipId: string): void {
      const allowed = validateFedosConversationMessageEnvelope({
        id: "e-allowed",
        conversationId,
        senderMembershipId: aliceMembershipId,
        payloadId: "payload-allowed",
        encryptionSuite: "ChaCha20Poly1305",
        keyEpoch: 0,
        createdAt: 1_700_000_000,
        replyToEnvelopeId: null,
      });
      const denied = validateFedosConversationMessageEnvelope({
        id: "e-denied",
        conversationId,
        senderMembershipId: aliceMembershipId,
        payloadId: "payload-denied",
        encryptionSuite: "ChaCha20Poly1305",
        keyEpoch: 0,
        createdAt: 1_700_000_010,
        replyToEnvelopeId: null,
      });
      if (allowed === null || denied === null) throw new Error("test setup: invalid envelope fixture");
      index.indexEnvelope({ envelope: allowed, text: "allowed across restart" });
      index.indexEnvelope({ envelope: denied, text: "denied across restart" });
    }

    const genADeps = buildGenerationDeps();
    const genA = new FedosConversationSearchIndex(genADeps);
    const aliceA = genADeps.membershipAuthority.listMemberships(conversationId)[0]?.id;
    if (aliceA === undefined) throw new Error("unreachable");
    feed(genA, aliceA);

    // Simulate a restart: a brand new instance, freshly re-assembled dependencies, SAME underlying durable state.
    const genBDeps = buildGenerationDeps();
    const genB = new FedosConversationSearchIndex(genBDeps);
    const aliceB = genBDeps.membershipAuthority.listMemberships(conversationId)[0]?.id;
    if (aliceB === undefined) throw new Error("unreachable");
    feed(genB, aliceB);

    for (const generation of [genA, genB]) {
      expect(generation.size()).toBe(1);
      expect(generation.searchKeyword("allowed")).toEqual(["e-allowed"]);
      expect(generation.searchKeyword("denied")).toEqual([]);
    }
  });
});

function seedPayloadInto(payloadStorage: InMemoryFedosConversationPayloadStorage, conversationId: FedosConversationId, payloadId: string): void {
  payloadStorage.putPayload(
    { id: payloadId as FedosConversationPayloadId, conversationId, mediaType: "application/octet-stream", byteLength: 1, createdAt: 1_700_000_000 },
    new Uint8Array([1]),
  );
}

describe("Secure Runtime Alpha 2601-2620 -- query-time race safety", () => {
  it("10. a policy change to denied, before any explicit purge, suppresses the stale result on the very next query", () => {
    const env = makeEnvironment();
    const conversationId = "private-draft::direct::conv-race" as FedosConversationId;
    const draft: FedosPersistedConversationDraftRecordV1 = {
      schemaVersion: 1,
      id: conversationId,
      mode: "direct",
      lifecycleState: "draft",
      policyReference: "direct-draft-v1",
      creatorAuthority: "fedos",
      creatorPublicIdentifier: "alice",
      creatorIdentityId: null,
      createdAt: 1_700_000_000,
    };
    env.draftPersistence.putDraft(draft);
    const aliceId = admit(env, conversationId, ALICE, "owner");
    seedPayload(env, conversationId, "payload-1");
    const searchIndex = new FedosConversationSearchIndex(deps(env));
    const envelope = validateFedosConversationMessageEnvelope({
      id: "e1",
      conversationId,
      senderMembershipId: aliceId,
      payloadId: "payload-1",
      encryptionSuite: "ChaCha20Poly1305",
      keyEpoch: 0,
      createdAt: 1_700_000_000,
      replyToEnvelopeId: null,
    });
    if (envelope === null) throw new Error("test setup: invalid envelope fixture");

    expect(searchIndex.indexEnvelope({ envelope, text: "race condition text" })).toBe("indexed");
    expect(searchIndex.searchKeyword("race")).toEqual(["e1"]);

    // Retention transitions to denied via the Authority DIRECTLY -- deliberately WITHOUT calling
    // searchIndex.reconcilePayloadRetention() at all, simulating the race window Phase F names.
    env.retentionAuthority.tombstonePayload("payload-1" as FedosConversationPayloadId, null, "test_placeholder");

    expect(searchIndex.searchKeyword("race")).toEqual([]);
    expect(searchIndex.envelopesBetween(0, 2_000_000_000)).toEqual([]);
    expect(searchIndex.envelopesByParticipant(ALICE)).toEqual([]);
    expect(searchIndex.repliesTo(envelope.id)).toEqual([]);
    // `size()` intentionally still counts it as indexed-not-removed (bookkeeping only, no content) --
    // this file's own header names this as out of the query-time gate's stated scope.
    expect(searchIndex.size()).toBe(1);
  });

  it("17. a denied ingestion attempt never throws and never surfaces the plaintext in its return value", () => {
    const env = makeEnvironment();
    const conversationId = "private-draft::direct::conv-1" as FedosConversationId;
    const draft: FedosPersistedConversationDraftRecordV1 = {
      schemaVersion: 1,
      id: conversationId,
      mode: "direct",
      lifecycleState: "draft",
      policyReference: "direct-draft-v1",
      creatorAuthority: "fedos",
      creatorPublicIdentifier: "alice",
      creatorIdentityId: null,
      createdAt: 1_700_000_000,
    };
    env.draftPersistence.putDraft(draft);
    const aliceId = admit(env, conversationId, ALICE, "owner");
    const throwingAuthority = {
      evaluatePayloadAccess: () => {
        throw new Error("retention authority unavailable");
      },
    };
    const searchIndex = new FedosConversationSearchIndex({ draftPersistence: env.draftPersistence, membershipAuthority: env.membershipAuthority, retentionAuthority: throwingAuthority });
    const envelope = validateFedosConversationMessageEnvelope({
      id: "e1",
      conversationId,
      senderMembershipId: aliceId,
      payloadId: "payload-1",
      encryptionSuite: "ChaCha20Poly1305",
      keyEpoch: 0,
      createdAt: 1_700_000_000,
      replyToEnvelopeId: null,
    });
    if (envelope === null) throw new Error("test setup: invalid envelope fixture");

    let outcome: string | undefined;
    expect(() => {
      outcome = searchIndex.indexEnvelope({ envelope, text: "top secret plaintext XYZ" });
    }).not.toThrow();
    expect(outcome).toBe("denied");
    expect(JSON.stringify(outcome)).not.toMatch(/top secret/);
  });
});

describe("Secure Runtime Alpha 2601-2620 -- unrelated content intact + existing behavior compatible", () => {
  it("18. purging one denied/tombstoned Envelope leaves unrelated allowed content fully intact", () => {
    const env = makeEnvironment();
    const conversationId = "private-draft::direct::conv-1" as FedosConversationId;
    registerConversation(env, conversationId, "direct");
    const aliceId = admit(env, conversationId, ALICE, "owner");
    seedPayload(env, conversationId, "payload-keep");
    seedPayload(env, conversationId, "payload-purge");
    const searchIndex = new FedosConversationSearchIndex(deps(env));
    const keep = validateFedosConversationMessageEnvelope({
      id: "e-keep",
      conversationId,
      senderMembershipId: aliceId,
      payloadId: "payload-keep",
      encryptionSuite: "ChaCha20Poly1305",
      keyEpoch: 0,
      createdAt: 1_700_000_000,
      replyToEnvelopeId: null,
    });
    const purge = validateFedosConversationMessageEnvelope({
      id: "e-purge",
      conversationId,
      senderMembershipId: aliceId,
      payloadId: "payload-purge",
      encryptionSuite: "ChaCha20Poly1305",
      keyEpoch: 0,
      createdAt: 1_700_000_010,
      replyToEnvelopeId: null,
    });
    if (keep === null || purge === null) throw new Error("test setup: invalid envelope fixture");

    searchIndex.indexEnvelope({ envelope: keep, text: "keep this searchable" });
    searchIndex.indexEnvelope({ envelope: purge, text: "purge this content" });
    env.retentionAuthority.tombstonePayload("payload-purge" as FedosConversationPayloadId, null, "test_placeholder");
    expect(searchIndex.reconcilePayloadRetention("payload-purge" as FedosConversationPayloadId)).toBe(1);

    expect(searchIndex.searchKeyword("keep")).toEqual(["e-keep"]);
    expect(searchIndex.searchKeyword("purge")).toEqual([]);
    expect(searchIndex.envelopesByParticipant(ALICE)).toEqual(["e-keep"]);
    expect(searchIndex.size()).toBe(1);
  });

  it("20. searchKeyword's existing deterministic sort order is unaffected by the added retention filter", () => {
    const env = makeEnvironment();
    const conversationId = "private-draft::direct::conv-1" as FedosConversationId;
    registerConversation(env, conversationId, "direct");
    const aliceId = admit(env, conversationId, ALICE, "owner");
    const searchIndex = new FedosConversationSearchIndex(deps(env));

    for (const id of ["zzz", "aaa", "mmm"]) {
      seedPayload(env, conversationId, `payload-${id}`);
      const envelope = validateFedosConversationMessageEnvelope({
        id,
        conversationId,
        senderMembershipId: aliceId,
        payloadId: `payload-${id}`,
        encryptionSuite: "ChaCha20Poly1305",
        keyEpoch: 0,
        createdAt: 1_700_000_000,
        replyToEnvelopeId: null,
      });
      if (envelope === null) throw new Error("test setup: invalid envelope fixture");
      searchIndex.indexEnvelope({ envelope, text: "shared token" });
    }

    // Pre-existing contract: results sorted by envelope id, never insertion order.
    expect(searchIndex.searchKeyword("shared")).toEqual(["aaa", "mmm", "zzz"]);
  });
});
