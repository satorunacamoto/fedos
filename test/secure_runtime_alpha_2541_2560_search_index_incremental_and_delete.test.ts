import { describe, it, expect } from "vitest";
import { validateFedosConversationMessageEnvelope } from "../src/conversation/envelope/fedos_conversation_message_envelope_validator.js";
import type { FedosConversationMessageEnvelope } from "../src/conversation/envelope/fedos_conversation_message_envelope.js";
import { InMemoryFedosConversationMembershipAuthority } from "../src/conversation/membership/in_memory_fedos_conversation_membership_authority.js";
import { InMemoryFedosConversationDraftPersistence } from "../src/conversation/construction/in_memory_fedos_conversation_draft_persistence.js";
import type { FedosPersistedConversationDraftRecordV1 } from "../src/conversation/construction/fedos_persisted_conversation_draft_record_v1.js";
import {
  FedosConversationSearchIndex,
  type FedosConversationSearchIndexDependencies,
} from "../src/conversation/search/fedos_conversation_search_index.js";
import type { FedosConversationId } from "../src/conversation/fedos_conversation_id.js";
import type { FedosConversationEnvelopeId } from "../src/conversation/envelope/fedos_conversation_envelope_id.js";
import type { FedosConversationParticipantReference } from "../src/conversation/membership/fedos_conversation_participant_reference.js";
import { FedosPayloadRetentionAuthority } from "../src/conversation/retention/fedos_payload_retention_authority.js";
import { InMemoryFedosPayloadRetentionPersistence } from "../src/conversation/retention/in_memory_fedos_payload_retention_persistence.js";
import { InMemoryFedosConversationPayloadStorage } from "../src/conversation/payload_storage/in_memory_fedos_conversation_payload_storage.js";
import type { FedosConversationPayloadId } from "../src/conversation/payload_storage/fedos_conversation_payload_id.js";

/** Registers `payloadId` as an active, retention-permitted payload so `evaluatePayloadAccess()` returns `"allowed"` -- mirrors a real caller's payload already being durably stored before Search ever sees it. */
function seedActivePayload(payloadStorage: InMemoryFedosConversationPayloadStorage, conversationId: FedosConversationId, payloadId: string): void {
  payloadStorage.putPayload(
    { id: payloadId as FedosConversationPayloadId, conversationId, mediaType: "application/octet-stream", byteLength: 1, createdAt: 1_700_000_000 },
    new Uint8Array([1]),
  );
}

const DIRECT_ID = "private-draft::direct::req-1" as FedosConversationId;

const ALICE: FedosConversationParticipantReference = { authority: "fedos", publicIdentifier: "alice", identityId: null };
const BOB: FedosConversationParticipantReference = { authority: "fedos", publicIdentifier: "bob", identityId: null };

function draftRecord(id: FedosConversationId): FedosPersistedConversationDraftRecordV1 {
  return {
    schemaVersion: 1,
    id,
    mode: "direct",
    lifecycleState: "draft",
    policyReference: "direct-draft-v1",
    creatorAuthority: "fedos",
    creatorPublicIdentifier: "alice",
    creatorIdentityId: null,
    createdAt: 1_700_000_000,
  };
}

/** Builds a valid Envelope fixture AND registers its payload as active in `payloadStorage` -- by construction, every Envelope this helper returns is retention-permitted unless a test explicitly tombstones it afterward. */
function envelope(
  payloadStorage: InMemoryFedosConversationPayloadStorage,
  id: string,
  senderMembershipId: string,
  overrides: Partial<Record<string, unknown>> = {},
): FedosConversationMessageEnvelope {
  const built = validateFedosConversationMessageEnvelope({
    id,
    conversationId: DIRECT_ID,
    senderMembershipId,
    payloadId: `payload-${id}`,
    encryptionSuite: "ChaCha20Poly1305",
    keyEpoch: 0,
    createdAt: 1_700_000_000,
    replyToEnvelopeId: null,
    ...overrides,
  });
  if (built === null) throw new Error("test setup: invalid envelope fixture");
  seedActivePayload(payloadStorage, DIRECT_ID, built.payloadId);
  return built;
}

/** Builds a fresh, independent dependency set + two admitted members, mirroring what a real caller assembles from Conversation Runtime plus the injected Retention Authority (Alpha 2581-2620). */
function setup(): {
  deps: FedosConversationSearchIndexDependencies;
  aliceMembershipId: string;
  bobMembershipId: string;
  payloadStorage: InMemoryFedosConversationPayloadStorage;
  retentionAuthority: FedosPayloadRetentionAuthority;
} {
  const draftPersistence = new InMemoryFedosConversationDraftPersistence();
  draftPersistence.putDraft(draftRecord(DIRECT_ID));

  const membershipAuthority = new InMemoryFedosConversationMembershipAuthority();
  const alice = membershipAuthority.admit(DIRECT_ID, ALICE, "owner", 1_700_000_000);
  const bob = membershipAuthority.admit(DIRECT_ID, BOB, "member", 1_700_000_001);
  if (alice.outcome !== "admitted" || bob.outcome !== "admitted") throw new Error("test setup failed");

  const payloadStorage = new InMemoryFedosConversationPayloadStorage();
  const retentionAuthority = new FedosPayloadRetentionAuthority({
    retentionPersistence: new InMemoryFedosPayloadRetentionPersistence(),
    payloadStorage,
  });

  return {
    deps: { draftPersistence, membershipAuthority, retentionAuthority },
    aliceMembershipId: alice.membership.id,
    bobMembershipId: bob.membership.id,
    payloadStorage,
    retentionAuthority,
  };
}

describe("Secure Runtime Alpha 2541-2560 -- Search Index: incremental + duplicate", () => {
  it("1. indexing a new envelope succeeds; indexing the identical id again is a duplicate no-op", () => {
    const { deps, aliceMembershipId, payloadStorage } = setup();
    const index = new FedosConversationSearchIndex(deps);
    const env = envelope(payloadStorage, "e1", aliceMembershipId);

    expect(index.indexEnvelope({ envelope: env, text: "hello world" })).toBe("indexed");
    expect(index.size()).toBe(1);
    expect(index.indexEnvelope({ envelope: env, text: "hello world" })).toBe("duplicate");
    expect(index.size()).toBe(1);
    expect(index.searchKeyword("hello")).toEqual(["e1"]);
  });

  it("2. indexEnvelopes tallies indexed vs duplicate across a batch containing a repeat", () => {
    const { deps, aliceMembershipId, payloadStorage } = setup();
    const index = new FedosConversationSearchIndex(deps);
    const e1 = envelope(payloadStorage, "e1", aliceMembershipId);
    const e2 = envelope(payloadStorage, "e2", aliceMembershipId);

    const result = index.indexEnvelopes([
      { envelope: e1, text: null },
      { envelope: e2, text: null },
      { envelope: e1, text: null },
    ]);
    expect(result).toEqual({ indexed: 2, duplicate: 1, denied: 0 });
    expect(index.size()).toBe(2);
  });
});

describe("Secure Runtime Alpha 2541-2560 -- Search Index: delete", () => {
  it("1. removeEnvelope removes it from keyword search and marks it not-found on a second removal", () => {
    const { deps, aliceMembershipId, payloadStorage } = setup();
    const index = new FedosConversationSearchIndex(deps);
    const env = envelope(payloadStorage, "e1", aliceMembershipId);
    index.indexEnvelope({ envelope: env, text: "secret plan" });

    expect(index.searchKeyword("secret")).toEqual(["e1"]);
    expect(index.removeEnvelope(env.id)).toBe("removed");
    expect(index.searchKeyword("secret")).toEqual([]);
    expect(index.size()).toBe(0);
    expect(index.removeEnvelope(env.id)).toBe("not-found");
  });

  it("2. removeEnvelope on a never-indexed id returns not-found", () => {
    const { payloadStorage } = setup();
    const env = envelope(payloadStorage, "never-indexed", "whoever");
    const { deps } = setup();
    const index = new FedosConversationSearchIndex(deps);
    expect(index.removeEnvelope(env.id)).toBe("not-found");
  });

  it("3. after removal, re-indexing the same envelope id is 'indexed' again, not 'duplicate'", () => {
    const { deps, aliceMembershipId, payloadStorage } = setup();
    const index = new FedosConversationSearchIndex(deps);
    const env = envelope(payloadStorage, "e1", aliceMembershipId);

    index.indexEnvelope({ envelope: env, text: "first version" });
    index.removeEnvelope(env.id);
    expect(index.indexEnvelope({ envelope: env, text: "second version" })).toBe("indexed");
    expect(index.searchKeyword("second")).toEqual(["e1"]);
    expect(index.searchKeyword("first")).toEqual([]);
  });

  it("4. removeEnvelope purges every content/metadata sub-index -- keyword, date, reply, participant -- for the removed id", () => {
    const { deps, aliceMembershipId, bobMembershipId, payloadStorage } = setup();
    const index = new FedosConversationSearchIndex(deps);
    const parent = envelope(payloadStorage, "e1", aliceMembershipId, { createdAt: 1_700_000_000 });
    const child = envelope(payloadStorage, "e2", bobMembershipId, { createdAt: 1_700_000_050, replyToEnvelopeId: "e1" });
    index.indexEnvelope({ envelope: parent, text: "root message" });
    index.indexEnvelope({ envelope: child, text: "child message" });

    expect(index.removeEnvelope(parent.id)).toBe("removed");
    expect(index.searchKeyword("root")).toEqual([]);
    expect(index.envelopesBetween(1_700_000_000, 1_700_000_000)).toEqual([]);
    expect(index.envelopesByParticipant(ALICE)).toEqual([]);
    // Reply Index deliberately does not cascade (pre-existing discipline) -- the child's own parentOf pointer now resolves to nothing.
    expect(index.parentOf(child.id)).toBeNull();
  });
});

describe("Secure Runtime Alpha 2541-2560 -- Search Index: restart", () => {
  it("1. two independent instances fed identical source data reproduce identical query results", () => {
    const { deps: depsA, aliceMembershipId: aliceA, bobMembershipId: bobA, payloadStorage: storageA } = setup();
    const { deps: depsB, aliceMembershipId: aliceB, bobMembershipId: bobB, payloadStorage: storageB } = setup();

    const envelopesA = [
      { envelope: envelope(storageA, "e1", aliceA), text: "hello from alice" },
      { envelope: envelope(storageA, "e2", bobA, { replyToEnvelopeId: "e1" }), text: "hello from bob" },
    ];
    const envelopesB = [
      { envelope: envelope(storageB, "e1", aliceB), text: "hello from alice" },
      { envelope: envelope(storageB, "e2", bobB, { replyToEnvelopeId: "e1" }), text: "hello from bob" },
    ];

    const before = new FedosConversationSearchIndex(depsA);
    before.indexEnvelopes(envelopesA);

    // Simulate a restart: a brand new instance, over freshly re-assembled (but data-identical) dependencies.
    const after = new FedosConversationSearchIndex(depsB);
    after.indexEnvelopes(envelopesB);

    expect(after.size()).toBe(before.size());
    expect(after.searchKeyword("hello")).toEqual(before.searchKeyword("hello"));
    expect(after.envelopesBetween(0, 2_000_000_000)).toEqual(before.envelopesBetween(0, 2_000_000_000));
    expect(after.repliesTo("e1" as FedosConversationEnvelopeId)).toEqual(before.repliesTo("e1" as FedosConversationEnvelopeId));
    expect(after.envelopesByParticipant(ALICE)).toEqual(before.envelopesByParticipant(ALICE));
    expect(after.directConversationIds()).toEqual(before.directConversationIds());
  });
});
