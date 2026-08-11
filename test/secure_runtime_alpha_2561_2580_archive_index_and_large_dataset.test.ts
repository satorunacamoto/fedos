import { describe, it, expect } from "vitest";
// @ts-expect-error `node:buffer` has no type declarations without `@types/node` in this project's tsconfig.
import { Buffer } from "node:buffer";
import { validateFedosConversationMessageEnvelope } from "../src/os/messenger/conversations/envelope/fedos_conversation_message_envelope_validator.js";
import { InMemoryFedosConversationPersistence } from "../src/os/messenger/conversations/persistence/in_memory_fedos_conversation_persistence.js";
import { InMemoryFedosConversationMembershipPersistence } from "../src/os/messenger/conversations/membership/persistence/in_memory_fedos_conversation_membership_persistence.js";
import { InMemoryFedosConversationCapabilityPersistence } from "../src/os/messenger/conversations/capability/persistence/in_memory_fedos_conversation_capability_persistence.js";
import { InMemoryFedosConversationMessageEnvelopePersistence } from "../src/os/messenger/conversations/envelope/persistence/in_memory_fedos_conversation_message_envelope_persistence.js";
import { InMemoryFedosConversationPayloadStorage } from "../src/os/messenger/conversations/payload_storage/in_memory_fedos_conversation_payload_storage.js";
import type { FedosConversationPayloadStorage } from "../src/os/messenger/conversations/payload_storage/fedos_conversation_payload_storage.js";
import { FEDOS_CONVERSATION_ARCHIVE_SCHEMA_VERSION } from "../src/os/messenger/conversations/archive/fedos_conversation_archive_schema_version.js";
import type { FedosConversationArchiveBundleV1 } from "../src/os/messenger/conversations/archive/fedos_conversation_archive_bundle.js";
import { restoreFedosConversationArchiveBundle, type FedosConversationArchiveRestoreDependencies } from "../src/os/messenger/conversations/archive/fedos_conversation_archive_restore.js";
import { collectFedosConversationArchiveBundle } from "../src/os/messenger/conversations/archive/fedos_conversation_archive_collector.js";
import { InMemoryFedosConversationMembershipAuthority } from "../src/os/messenger/conversations/membership/in_memory_fedos_conversation_membership_authority.js";
import { InMemoryFedosConversationDraftPersistence } from "../src/os/messenger/conversations/construction/in_memory_fedos_conversation_draft_persistence.js";
import type { FedosPersistedConversationDraftRecordV1 } from "../src/os/messenger/conversations/construction/fedos_persisted_conversation_draft_record_v1.js";
import { FedosConversationSearchIndex } from "../src/os/messenger/conversations/search/fedos_conversation_search_index.js";
import type { FedosConversationId } from "../src/os/messenger/conversations/fedos_conversation_id.js";
import type { FedosConversationParticipantReference } from "../src/os/messenger/conversations/membership/fedos_conversation_participant_reference.js";
import { FedosPayloadRetentionAuthority } from "../src/os/messenger/conversations/retention/fedos_payload_retention_authority.js";
import { InMemoryFedosPayloadRetentionPersistence } from "../src/os/messenger/conversations/retention/in_memory_fedos_payload_retention_persistence.js";
import type { FedosConversationPayloadId } from "../src/os/messenger/conversations/payload_storage/fedos_conversation_payload_id.js";

/** Registers `payloadId` as active in `payloadStorage` so the Alpha 2581-2620 ingestion gate permits it. */
function seedActivePayload(payloadStorage: FedosConversationPayloadStorage, conversationId: FedosConversationId, payloadId: string): void {
  payloadStorage.putPayload(
    { id: payloadId as FedosConversationPayloadId, conversationId, mediaType: "application/octet-stream", byteLength: 1, createdAt: 1_700_000_000 },
    new Uint8Array([1]),
  );
}

const ARCHIVE_CONVERSATION_ID = "board-a::thread-1" as FedosConversationId;

describe("Secure Runtime Alpha 2561-2580 -- Archive Index (Reuse Archive)", () => {
  it("1. indexArchiveBundle reuses the existing Archive collector/restore path and makes a restored conversation queryable + flagged as archive-sourced", () => {
    const archiveDeps: FedosConversationArchiveRestoreDependencies = {
      conversationPersistence: new InMemoryFedosConversationPersistence(),
      membershipPersistence: new InMemoryFedosConversationMembershipPersistence(),
      capabilityPersistence: new InMemoryFedosConversationCapabilityPersistence(),
      envelopePersistence: new InMemoryFedosConversationMessageEnvelopePersistence(),
      payloadStorage: new InMemoryFedosConversationPayloadStorage(),
    };

    const seedBundle: FedosConversationArchiveBundleV1 = {
      schemaVersion: FEDOS_CONVERSATION_ARCHIVE_SCHEMA_VERSION,
      conversationId: ARCHIVE_CONVERSATION_ID,
      exportedAt: 1_700_000_500,
      conversation: {
        schemaVersion: 1,
        id: ARCHIVE_CONVERSATION_ID,
        mode: "public",
        boardId: "board-a",
        rootThreadId: "thread-1",
        rootPostId: "thread-1",
        policyReference: "public-v1",
        createdAt: 1_700_000_000,
      },
      memberships: [
        {
          schemaVersion: 1,
          id: `${ARCHIVE_CONVERSATION_ID}::fedos::alice`,
          conversationId: ARCHIVE_CONVERSATION_ID,
          participantAuthority: "fedos",
          participantPublicIdentifier: "alice",
          participantIdentityId: null,
          role: "owner",
          state: "active",
          joinedAt: 1_700_000_000,
          endedAt: null,
        },
      ],
      capabilityEvents: [],
      envelopes: [
        {
          schemaVersion: 1,
          id: "envelope-1",
          conversationId: ARCHIVE_CONVERSATION_ID,
          senderMembershipId: `${ARCHIVE_CONVERSATION_ID}::fedos::alice`,
          payloadId: "payload-1",
          encryptionSuite: "ChaCha20Poly1305",
          keyEpoch: 0,
          createdAt: 1_700_000_010,
          replyToEnvelopeId: null,
        },
      ],
      payloads: [
        {
          schemaVersion: 1,
          id: "payload-1",
          conversationId: ARCHIVE_CONVERSATION_ID,
          mediaType: "application/octet-stream",
          byteLength: 5,
          createdAt: 1_700_000_010,
          bytesBase64: Buffer.from([1, 2, 3, 4, 5]).toString("base64"),
        },
      ],
    };

    // Reuses Archive verbatim: restore then re-collect, exactly like `secure_runtime_alpha_1581_1600_archive_restore_duplicate_detection.test.ts` already does.
    restoreFedosConversationArchiveBundle(seedBundle, archiveDeps);
    const bundle = collectFedosConversationArchiveBundle(ARCHIVE_CONVERSATION_ID, archiveDeps, 1_700_000_999);
    expect(bundle).not.toBeNull();
    if (bundle === null) throw new Error("unreachable");

    // The Retention Authority wraps the SAME destination payload storage Restore just wrote "payload-1" into --
    // Phase C's own "evaluate current destination Runtime retention policy" (Alpha 2581-2620), never a second store.
    const searchIndex = new FedosConversationSearchIndex({
      draftPersistence: new InMemoryFedosConversationDraftPersistence(),
      membershipAuthority: new InMemoryFedosConversationMembershipAuthority(),
      retentionAuthority: new FedosPayloadRetentionAuthority({
        retentionPersistence: new InMemoryFedosPayloadRetentionPersistence(),
        payloadStorage: archiveDeps.payloadStorage,
      }),
    });

    expect(searchIndex.isFromArchive(ARCHIVE_CONVERSATION_ID)).toBe(false);
    const outcome = searchIndex.indexArchiveBundle(bundle, new Map([["envelope-1", "hello from the archive"]]), 1_700_001_000);

    expect(outcome).toEqual({ indexed: 1, duplicate: 0, denied: 0 });
    expect(searchIndex.isFromArchive(ARCHIVE_CONVERSATION_ID)).toBe(true);
    expect(searchIndex.archivedConversationIds()).toEqual([ARCHIVE_CONVERSATION_ID]);
    expect(searchIndex.searchKeyword("archive")).toEqual(["envelope-1"]);
  });

  it("2. indexing the same Archive Bundle twice is a duplicate no-op, not double-counted", () => {
    const archiveDeps: FedosConversationArchiveRestoreDependencies = {
      conversationPersistence: new InMemoryFedosConversationPersistence(),
      membershipPersistence: new InMemoryFedosConversationMembershipPersistence(),
      capabilityPersistence: new InMemoryFedosConversationCapabilityPersistence(),
      envelopePersistence: new InMemoryFedosConversationMessageEnvelopePersistence(),
      payloadStorage: new InMemoryFedosConversationPayloadStorage(),
    };
    const bundle: FedosConversationArchiveBundleV1 = {
      schemaVersion: FEDOS_CONVERSATION_ARCHIVE_SCHEMA_VERSION,
      conversationId: ARCHIVE_CONVERSATION_ID,
      exportedAt: 1_700_000_500,
      conversation: {
        schemaVersion: 1,
        id: ARCHIVE_CONVERSATION_ID,
        mode: "public",
        boardId: "board-a",
        rootThreadId: "thread-1",
        rootPostId: "thread-1",
        policyReference: "public-v1",
        createdAt: 1_700_000_000,
      },
      memberships: [],
      capabilityEvents: [],
      envelopes: [
        {
          schemaVersion: 1,
          id: "envelope-1",
          conversationId: ARCHIVE_CONVERSATION_ID,
          senderMembershipId: `${ARCHIVE_CONVERSATION_ID}::fedos::alice`,
          payloadId: "payload-1",
          encryptionSuite: "ChaCha20Poly1305",
          keyEpoch: 0,
          createdAt: 1_700_000_010,
          replyToEnvelopeId: null,
        },
      ],
      payloads: [],
    };
    restoreFedosConversationArchiveBundle(bundle, archiveDeps);
    // This bundle's own `payloads` array is empty (Restore writes no bytes) -- seed "payload-1" directly so the
    // ingestion gate has something to evaluate; this test is about duplicate detection, not retention itself.
    seedActivePayload(archiveDeps.payloadStorage, ARCHIVE_CONVERSATION_ID, "payload-1");

    const searchIndex = new FedosConversationSearchIndex({
      draftPersistence: new InMemoryFedosConversationDraftPersistence(),
      membershipAuthority: new InMemoryFedosConversationMembershipAuthority(),
      retentionAuthority: new FedosPayloadRetentionAuthority({
        retentionPersistence: new InMemoryFedosPayloadRetentionPersistence(),
        payloadStorage: archiveDeps.payloadStorage,
      }),
    });
    searchIndex.indexArchiveBundle(bundle, new Map(), 1_700_001_000);
    const second = searchIndex.indexArchiveBundle(bundle, new Map(), 1_700_001_100);
    expect(second).toEqual({ indexed: 0, duplicate: 1, denied: 0 });
    expect(searchIndex.size()).toBe(1);
  });
});

const PARTICIPANTS: readonly FedosConversationParticipantReference[] = [
  { authority: "fedos", publicIdentifier: "alice", identityId: null },
  { authority: "fedos", publicIdentifier: "bob", identityId: null },
  { authority: "fedos", publicIdentifier: "carol", identityId: null },
];

const CONVERSATION_COUNT = 20;
const ENVELOPES_PER_CONVERSATION = 150; // 3,000 total
const TOTAL_ENVELOPES = CONVERSATION_COUNT * ENVELOPES_PER_CONVERSATION;

describe("Secure Runtime Alpha 2561-2580 -- large dataset", () => {
  it(`1. indexes ${TOTAL_ENVELOPES} envelopes across ${CONVERSATION_COUNT} conversations and answers every query correctly`, () => {
    const draftPersistence = new InMemoryFedosConversationDraftPersistence();
    const membershipAuthority = new InMemoryFedosConversationMembershipAuthority();

    const conversationIds: FedosConversationId[] = [];
    const membershipIdsByConversation = new Map<FedosConversationId, string[]>();
    let expectedDirectCount = 0;
    let expectedGroupCount = 0;

    for (let c = 0; c < CONVERSATION_COUNT; c += 1) {
      const mode = c % 2 === 0 ? "direct" : "private-group";
      const conversationId = `private-draft::${mode}::conv-${c}` as FedosConversationId;
      conversationIds.push(conversationId);
      if (mode === "direct") expectedDirectCount += 1;
      else expectedGroupCount += 1;

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
      draftPersistence.putDraft(draft);

      const membershipIds: string[] = [];
      for (const participant of PARTICIPANTS) {
        const admitted = membershipAuthority.admit(conversationId, participant, "member", 1_700_000_000);
        if (admitted.outcome !== "admitted") throw new Error("test setup failed");
        membershipIds.push(admitted.membership.id);
      }
      membershipIdsByConversation.set(conversationId, membershipIds);
    }

    const payloadStorage = new InMemoryFedosConversationPayloadStorage();
    const retentionAuthority = new FedosPayloadRetentionAuthority({
      retentionPersistence: new InMemoryFedosPayloadRetentionPersistence(),
      payloadStorage,
    });
    const searchIndex = new FedosConversationSearchIndex({ draftPersistence, membershipAuthority, retentionAuthority });
    const expectedEnvelopesByParticipantIndex = new Map<number, number>();
    let expectedNeedleCount = 0;
    let globalIndex = 0;

    const startedAt = Date.now();
    for (const conversationId of conversationIds) {
      const membershipIds = membershipIdsByConversation.get(conversationId);
      if (membershipIds === undefined) throw new Error("unreachable");
      let previousEnvelopeId: string | null = null;

      for (let n = 0; n < ENVELOPES_PER_CONVERSATION; n += 1) {
        const participantIndex = globalIndex % PARTICIPANTS.length;
        const senderMembershipId = membershipIds[participantIndex];
        if (senderMembershipId === undefined) throw new Error("unreachable");
        const envelopeId = `env-${conversationId}-${n}`;
        const isNeedle = globalIndex % 10 === 0;
        const replyToEnvelopeId = n > 0 && n % 5 === 0 ? previousEnvelopeId : null;

        const built = validateFedosConversationMessageEnvelope({
          id: envelopeId,
          conversationId,
          senderMembershipId,
          payloadId: `payload-${envelopeId}`,
          encryptionSuite: "ChaCha20Poly1305",
          keyEpoch: 0,
          createdAt: 1_700_000_000 + globalIndex,
          replyToEnvelopeId,
        });
        if (built === null) throw new Error("test setup: invalid envelope fixture");
        seedActivePayload(payloadStorage, conversationId, built.payloadId);

        const outcome = searchIndex.indexEnvelope({ envelope: built, text: isNeedle ? "needle common text" : "common text" });
        expect(outcome).toBe("indexed");

        expectedEnvelopesByParticipantIndex.set(participantIndex, (expectedEnvelopesByParticipantIndex.get(participantIndex) ?? 0) + 1);
        if (isNeedle) expectedNeedleCount += 1;
        previousEnvelopeId = envelopeId;
        globalIndex += 1;
      }
    }
    const elapsedMs = Date.now() - startedAt;

    expect(searchIndex.size()).toBe(TOTAL_ENVELOPES);
    expect(searchIndex.searchKeyword("needle").length).toBe(expectedNeedleCount);
    expect(searchIndex.searchKeyword("common text").length).toBe(TOTAL_ENVELOPES);
    expect(searchIndex.directConversationIds().length).toBe(expectedDirectCount);
    expect(searchIndex.groupConversationIds().length).toBe(expectedGroupCount);
    expect(searchIndex.envelopesBetween(1_700_000_000, 1_700_000_000 + TOTAL_ENVELOPES).length).toBe(TOTAL_ENVELOPES);

    for (const [index, participant] of PARTICIPANTS.entries()) {
      expect(searchIndex.envelopesByParticipant(participant).length).toBe(expectedEnvelopesByParticipantIndex.get(index) ?? 0);
    }

    // Informal scale sanity check only -- not a strict performance contract, just a guard against an accidental quadratic blowup.
    expect(elapsedMs).toBeLessThan(10_000);
  });
});
