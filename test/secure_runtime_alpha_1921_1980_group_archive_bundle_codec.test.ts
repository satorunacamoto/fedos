/**
 * Secure Runtime Alpha 1921–1980 ("Group Conversation Archive Integration
 * and Cross-Branch Recovery Arc") — Phase C: Group Archive Bundle/Manifest
 * Codec tests. Covers the new OPTIONAL `group` section on
 * `FedosConversationArchiveBundleV1`/`FedosConversationArchiveManifestV1`:
 * deterministic ordering (including recursive child-conversation
 * canonicalization), unknown-field fail-closed, and — the Phase I
 * compatibility regression this Arc's own spec explicitly requires — an
 * OLD, pre-this-Arc serialized Direct-only bundle still round-trips
 * byte-for-byte identically under the NEW codec.
 */
import { describe, it, expect } from "vitest";
import { Buffer } from "node:buffer";
import { FEDOS_CONVERSATION_ARCHIVE_SCHEMA_VERSION } from "../src/os/messenger/conversations/archive/fedos_conversation_archive_schema_version.js";
import type { FedosConversationArchiveBundleV1 } from "../src/os/messenger/conversations/archive/fedos_conversation_archive_bundle.js";
import type { FedosConversationArchiveGroupSectionV1 } from "../src/os/messenger/conversations/archive/fedos_conversation_archive_group_section.js";
import {
  serializeFedosConversationArchiveBundleToBytes,
  deserializeFedosConversationArchiveBundleFromBytes,
} from "../src/os/messenger/conversations/archive/fedos_conversation_archive_bundle_codec.js";
import { computeFedosConversationArchiveContentHash } from "../src/os/messenger/conversations/archive/fedos_conversation_archive_integrity.js";
import { buildFedosConversationArchiveManifest, deserializeFedosConversationArchiveManifest } from "../src/os/messenger/conversations/archive/fedos_conversation_archive_manifest_codec.js";
import { toFedosGroupGenerationId } from "../src/os/messenger/conversations/group/fedos_group_generation.js";
import { toFedosGroupDirectPathId } from "../src/os/messenger/conversations/group/fedos_group_direct_path.js";

const GROUP_CONVERSATION_ID = "board-a::group-thread-1";
const CHILD_CONVERSATION_ID_1 = "board-a::child-thread-1";
const CHILD_CONVERSATION_ID_2 = "board-a::child-thread-2";

function makeDirectBundle(conversationId: string, overrides: Partial<FedosConversationArchiveBundleV1> = {}): FedosConversationArchiveBundleV1 {
  return {
    schemaVersion: FEDOS_CONVERSATION_ARCHIVE_SCHEMA_VERSION,
    conversationId,
    exportedAt: 1_700_000_500,
    conversation: {
      schemaVersion: 1,
      id: conversationId,
      mode: "direct",
      boardId: "board-a",
      rootThreadId: conversationId,
      rootPostId: conversationId,
      policyReference: "direct-v1",
      createdAt: 1_700_000_000,
    },
    memberships: [
      {
        schemaVersion: 1,
        id: `${conversationId}::fedos::alice`,
        conversationId,
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
        id: `${conversationId}::envelope-1`,
        conversationId,
        senderMembershipId: `${conversationId}::fedos::alice`,
        payloadId: `${conversationId}::payload-1`,
        encryptionSuite: "ChaCha20Poly1305",
        keyEpoch: 0,
        createdAt: 1_700_000_010,
        replyToEnvelopeId: null,
      },
    ],
    payloads: [
      {
        schemaVersion: 1,
        id: `${conversationId}::payload-1`,
        conversationId,
        mediaType: "application/octet-stream",
        byteLength: 5,
        createdAt: 1_700_000_010,
        bytesBase64: Buffer.from([1, 2, 3, 4, 5]).toString("base64"),
      },
    ],
    ...overrides,
  };
}

const GEN_0_ID = toFedosGroupGenerationId(GROUP_CONVERSATION_ID, 0);
const GEN_1_ID = toFedosGroupGenerationId(GROUP_CONVERSATION_ID, 1);
const SENDER_MEMBERSHIP_ID = `${GROUP_CONVERSATION_ID}::fedos::alice`;
const RECIPIENT_1_MEMBERSHIP_ID = `${GROUP_CONVERSATION_ID}::fedos::bob`;
const RECIPIENT_2_MEMBERSHIP_ID = `${GROUP_CONVERSATION_ID}::fedos::carol`;

function makeGroupSection(): FedosConversationArchiveGroupSectionV1 {
  const path1Id = toFedosGroupDirectPathId(GROUP_CONVERSATION_ID, GEN_0_ID, SENDER_MEMBERSHIP_ID, RECIPIENT_1_MEMBERSHIP_ID);
  const path2Id = toFedosGroupDirectPathId(GROUP_CONVERSATION_ID, GEN_0_ID, SENDER_MEMBERSHIP_ID, RECIPIENT_2_MEMBERSHIP_ID);
  return {
    generations: [
      { groupConversationId: GROUP_CONVERSATION_ID, generationId: GEN_1_ID, generationNumber: 1, activeMemberMembershipIds: [SENDER_MEMBERSHIP_ID, RECIPIENT_1_MEMBERSHIP_ID], createdAt: 1_700_000_100, previousGenerationId: GEN_0_ID },
      { groupConversationId: GROUP_CONVERSATION_ID, generationId: GEN_0_ID, generationNumber: 0, activeMemberMembershipIds: [SENDER_MEMBERSHIP_ID, RECIPIENT_1_MEMBERSHIP_ID, RECIPIENT_2_MEMBERSHIP_ID], createdAt: 1_700_000_000, previousGenerationId: null },
    ],
    paths: [
      { pathId: path2Id, groupConversationId: GROUP_CONVERSATION_ID, generationId: GEN_0_ID, senderMembershipId: SENDER_MEMBERSHIP_ID, recipientMembershipId: RECIPIENT_2_MEMBERSHIP_ID, directConversationId: CHILD_CONVERSATION_ID_2, state: "ready", createdAt: 1_700_000_010, updatedAt: 1_700_000_010 },
      { pathId: path1Id, groupConversationId: GROUP_CONVERSATION_ID, generationId: GEN_0_ID, senderMembershipId: SENDER_MEMBERSHIP_ID, recipientMembershipId: RECIPIENT_1_MEMBERSHIP_ID, directConversationId: CHILD_CONVERSATION_ID_1, state: "ready", createdAt: 1_700_000_010, updatedAt: 1_700_000_010 },
    ],
    messages: [
      { id: "group-message::m2", groupConversationId: GROUP_CONVERSATION_ID, generationId: GEN_0_ID, senderMembershipId: SENDER_MEMBERSHIP_ID, createdAt: 1_700_000_030, replyToGroupMessageId: "group-message::m1", recipientCount: 2, fanoutState: "complete" },
      { id: "group-message::m1", groupConversationId: GROUP_CONVERSATION_ID, generationId: GEN_0_ID, senderMembershipId: SENDER_MEMBERSHIP_ID, createdAt: 1_700_000_020, replyToGroupMessageId: null, recipientCount: 2, fanoutState: "complete" },
    ],
    fanoutDeliveries: [
      { groupMessageId: "group-message::m1", recipientMembershipId: RECIPIENT_2_MEMBERSHIP_ID, pathId: path2Id, envelopeId: `${CHILD_CONVERSATION_ID_2}::envelope-1`, state: "stored", createdAt: 1_700_000_020 },
      { groupMessageId: "group-message::m1", recipientMembershipId: RECIPIENT_1_MEMBERSHIP_ID, pathId: path1Id, envelopeId: `${CHILD_CONVERSATION_ID_1}::envelope-1`, state: "stored", createdAt: 1_700_000_020 },
    ],
    childConversations: [makeDirectBundle(CHILD_CONVERSATION_ID_2), makeDirectBundle(CHILD_CONVERSATION_ID_1)],
  };
}

function makeGroupBundle(): FedosConversationArchiveBundleV1 {
  return {
    ...makeDirectBundle(GROUP_CONVERSATION_ID, {
      conversation: {
        schemaVersion: 1,
        id: GROUP_CONVERSATION_ID,
        mode: "private-group",
        boardId: "board-a",
        rootThreadId: GROUP_CONVERSATION_ID,
        rootPostId: GROUP_CONVERSATION_ID,
        policyReference: "private-group-v1",
        createdAt: 1_700_000_000,
      },
    }),
    group: makeGroupSection(),
  };
}

describe("Secure Runtime Alpha 1921-1980 -- Group Archive Bundle Codec", () => {
  it("1. round-trips a bundle carrying a group section", () => {
    const bundle = makeGroupBundle();
    const bytes = serializeFedosConversationArchiveBundleToBytes(bundle);
    const decoded = deserializeFedosConversationArchiveBundleFromBytes(bytes);
    expect(decoded).not.toBeNull();
    expect(decoded?.group?.generations.length).toBe(2);
    expect(decoded?.group?.paths.length).toBe(2);
    expect(decoded?.group?.messages.length).toBe(2);
    expect(decoded?.group?.fanoutDeliveries.length).toBe(2);
    expect(decoded?.group?.childConversations.length).toBe(2);
  });

  it("2. group section array order does not affect serialized bytes -- sorted by natural key, including recursive child conversations", () => {
    const forward = makeGroupBundle();
    const group = forward.group!;
    const reversed: FedosConversationArchiveBundleV1 = {
      ...forward,
      group: {
        generations: [...group.generations].reverse(),
        paths: [...group.paths].reverse(),
        messages: [...group.messages].reverse(),
        fanoutDeliveries: [...group.fanoutDeliveries].reverse(),
        childConversations: [...group.childConversations].reverse(),
      },
    };
    expect(serializeFedosConversationArchiveBundleToBytes(forward)).toEqual(serializeFedosConversationArchiveBundleToBytes(reversed));
  });

  it("3. contentHash changes when a nested child conversation's own content changes", () => {
    const a = makeGroupBundle();
    const b = makeGroupBundle();
    const mutatedChildren = [...b.group!.childConversations];
    mutatedChildren[0] = { ...mutatedChildren[0]!, exportedAt: mutatedChildren[0]!.exportedAt + 1 };
    const bMutated: FedosConversationArchiveBundleV1 = { ...b, group: { ...b.group!, childConversations: mutatedChildren } };
    expect(computeFedosConversationArchiveContentHash(a)).not.toBe(computeFedosConversationArchiveContentHash(bMutated));
  });

  it("4. rejects an unknown field inside the group section", () => {
    const raw = JSON.parse(new TextDecoder().decode(serializeFedosConversationArchiveBundleToBytes(makeGroupBundle())));
    raw.group.extra = "nope";
    expect(deserializeFedosConversationArchiveBundleFromBytes(new TextEncoder().encode(JSON.stringify(raw)))).toBeNull();
  });

  it("5. rejects a missing field inside the group section", () => {
    const raw = JSON.parse(new TextDecoder().decode(serializeFedosConversationArchiveBundleToBytes(makeGroupBundle())));
    delete raw.group.fanoutDeliveries;
    expect(deserializeFedosConversationArchiveBundleFromBytes(new TextEncoder().encode(JSON.stringify(raw)))).toBeNull();
  });

  it("6. rejects a non-array field inside the group section", () => {
    const raw = JSON.parse(new TextDecoder().decode(serializeFedosConversationArchiveBundleToBytes(makeGroupBundle())));
    raw.group.paths = "not-an-array";
    expect(deserializeFedosConversationArchiveBundleFromBytes(new TextEncoder().encode(JSON.stringify(raw)))).toBeNull();
  });

  it("7. rejects a malformed nested child conversation (one bad child voids the whole archive)", () => {
    const raw = JSON.parse(new TextDecoder().decode(serializeFedosConversationArchiveBundleToBytes(makeGroupBundle())));
    raw.group.childConversations[0].memberships = "not-an-array";
    expect(deserializeFedosConversationArchiveBundleFromBytes(new TextEncoder().encode(JSON.stringify(raw)))).toBeNull();
  });

  it("8. group is entirely optional -- a bundle without it behaves exactly as before", () => {
    const bundle = makeDirectBundle(CHILD_CONVERSATION_ID_1);
    const bytes = serializeFedosConversationArchiveBundleToBytes(bundle);
    const decoded = deserializeFedosConversationArchiveBundleFromBytes(bytes);
    expect(decoded?.group).toBeUndefined();
    expect(JSON.parse(new TextDecoder().decode(bytes))).not.toHaveProperty("group");
  });

  it("9. COMPATIBILITY REGRESSION -- an OLD, pre-this-Arc serialized Direct-only bundle (hand-built object literal, group field never even referenced) still round-trips byte-for-byte identically", () => {
    // This object literal is written EXACTLY as the Alpha 1541-1610 Foundation's own bundle shape --
    // no `group` field appears anywhere, mirroring a real archive file produced before this Arc existed.
    const oldBundle: FedosConversationArchiveBundleV1 = {
      schemaVersion: FEDOS_CONVERSATION_ARCHIVE_SCHEMA_VERSION,
      conversationId: "board-a::thread-1",
      exportedAt: 1_700_000_500,
      conversation: { schemaVersion: 1, id: "board-a::thread-1", mode: "public", boardId: "board-a", rootThreadId: "thread-1", rootPostId: "thread-1", policyReference: "public-v1", createdAt: 1_700_000_000 },
      memberships: [{ schemaVersion: 1, id: "board-a::thread-1::fedos::alice", conversationId: "board-a::thread-1", participantAuthority: "fedos", participantPublicIdentifier: "alice", participantIdentityId: null, role: "owner", state: "active", joinedAt: 1_700_000_000, endedAt: null }],
      capabilityEvents: [],
      envelopes: [{ schemaVersion: 1, id: "envelope-1", conversationId: "board-a::thread-1", senderMembershipId: "board-a::thread-1::fedos::alice", payloadId: "payload-1", encryptionSuite: "ChaCha20Poly1305", keyEpoch: 0, createdAt: 1_700_000_010, replyToEnvelopeId: null }],
      payloads: [{ schemaVersion: 1, id: "payload-1", conversationId: "board-a::thread-1", mediaType: "application/octet-stream", byteLength: 5, createdAt: 1_700_000_010, bytesBase64: Buffer.from([1, 2, 3, 4, 5]).toString("base64") }],
    };
    const bytes = serializeFedosConversationArchiveBundleToBytes(oldBundle);
    const parsed = JSON.parse(new TextDecoder().decode(bytes));
    // The literal on-disk JSON shape has EXACTLY the 8 original keys -- "group" never appears.
    expect(Object.keys(parsed).sort()).toEqual(["capabilityEvents", "conversation", "conversationId", "envelopes", "exportedAt", "memberships", "payloads", "schemaVersion"]);
    const decoded = deserializeFedosConversationArchiveBundleFromBytes(bytes);
    expect(decoded).toEqual(oldBundle);
    expect(decoded?.group).toBeUndefined();
  });
});

describe("Secure Runtime Alpha 1921-1980 -- Group Archive Manifest", () => {
  it("1. buildFedosConversationArchiveManifest adds group counts when a group section is present", () => {
    const bundle = makeGroupBundle();
    const manifest = buildFedosConversationArchiveManifest(bundle);
    expect(manifest.groupGenerationCount).toBe(2);
    expect(manifest.groupPathCount).toBe(2);
    expect(manifest.groupMessageCount).toBe(2);
    expect(manifest.groupFanoutDeliveryCount).toBe(2);
    expect(manifest.groupChildConversationCount).toBe(2);
    // Each child conversation bundle carries 1 membership + 0 capabilityEvents + 1 envelope + 1 payload = 3; x2 children = 6.
    expect(manifest.groupChildRecordCount).toBe(6);
  });

  it("2. omits every group field for a Direct-only bundle -- identical to every Manifest this codebase produced before this Arc", () => {
    const manifest = buildFedosConversationArchiveManifest(makeDirectBundle(CHILD_CONVERSATION_ID_1));
    expect(manifest.groupGenerationCount).toBeUndefined();
    expect(Object.keys(manifest).sort()).toEqual(["capabilityEventCount", "contentHash", "conversationId", "envelopeCount", "exportedAt", "membershipCount", "payloadCount", "schemaVersion"]);
  });

  it("3. round-trips a group-bearing manifest through the codec", () => {
    const manifest = buildFedosConversationArchiveManifest(makeGroupBundle());
    expect(deserializeFedosConversationArchiveManifest(JSON.parse(JSON.stringify(manifest)))).toEqual(manifest);
  });

  it("4. fails closed on a PARTIAL subset of the six group keys (all-or-nothing)", () => {
    const manifest = buildFedosConversationArchiveManifest(makeGroupBundle());
    const { groupChildRecordCount, ...partial } = manifest;
    expect(groupChildRecordCount).toBeDefined();
    expect(deserializeFedosConversationArchiveManifest(partial)).toBeNull();
  });

  it("5. fails closed on a negative group count", () => {
    const manifest = buildFedosConversationArchiveManifest(makeGroupBundle());
    expect(deserializeFedosConversationArchiveManifest({ ...manifest, groupPathCount: -1 })).toBeNull();
  });
});
