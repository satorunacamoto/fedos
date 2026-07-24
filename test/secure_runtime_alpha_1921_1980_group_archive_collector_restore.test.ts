/**
 * Secure Runtime Alpha 1921–1980 ("Group Conversation Archive Integration
 * and Cross-Branch Recovery Arc") — Phase C/E/F: Group Collector, Restore,
 * and Duplicate Detection unit tests, over REAL in-memory persistence
 * ports (the same classes production code uses) seeded DIRECTLY via
 * their own `put*` methods — mirrors
 * `test/secure_runtime_alpha_1691_1760_archive_runtime.test.ts`'s own
 * documented "seed directly into persistence" convention for its Direct
 * Conversation domains, extended here to the four NEW Group domains plus
 * the Collector's own new child-conversation orchestration.
 *
 * IMPORTANT, re-verified against real source (not assumed from the Phase
 * A/B design record): a REAL `private-group`/`direct` Conversation is
 * NEVER written into `FedosConversationPersistence` in this codebase --
 * that port's `FedosPersistedConversationRecordV1` wire shape exists ONLY
 * for PUBLIC, Board-thread-anchored Conversations, and its own sole
 * validator (`validateFedosConversationRecord`, Alpha 748) hard-rejects
 * any `mode` other than `"public"`. This is a PRE-EXISTING gap in the
 * Direct Archive Foundation (Alpha 1541-1610) this Arc does not
 * introduce and, per this Arc's own "extend don't redesign" rule, does
 * not fix (that would mean redesigning Alpha 748's own frozen Public-only
 * validator, a Direct-domain concern, not a Group one). Every
 * conversationPersistence record seeded below (for the Group id itself
 * AND for each child Direct id) therefore uses `mode: "public"` as the
 * SAME deliberate, documented placeholder substitution
 * `test/secure_runtime_alpha_1691_1760_archive_runtime.test.ts` already
 * established for its own "Direct Conversation" fixtures -- this file's
 * OWN new work (Group Generation/Path/Message/FanoutDelivery collection
 * and restore, plus child-conversation orchestration) is unaffected by
 * this substitution, since none of those domains ever consult a parent
 * Conversation's own `mode` field.
 */
import { describe, it, expect } from "vitest";

import { InMemoryFedosConversationPersistence } from "../src/conversation/persistence/in_memory_fedos_conversation_persistence.js";
import { InMemoryFedosConversationMembershipPersistence } from "../src/conversation/membership/persistence/in_memory_fedos_conversation_membership_persistence.js";
import { InMemoryFedosConversationCapabilityPersistence } from "../src/conversation/capability/persistence/in_memory_fedos_conversation_capability_persistence.js";
import { InMemoryFedosConversationMessageEnvelopePersistence } from "../src/conversation/envelope/persistence/in_memory_fedos_conversation_message_envelope_persistence.js";
import { InMemoryFedosConversationPayloadStorage } from "../src/conversation/payload_storage/in_memory_fedos_conversation_payload_storage.js";
import { InMemoryFedosGroupGenerationPersistence } from "../src/conversation/group/in_memory_fedos_group_generation_persistence.js";
import { InMemoryFedosGroupDirectPathPersistence } from "../src/conversation/group/in_memory_fedos_group_direct_path_persistence.js";
import { InMemoryFedosGroupMessagePersistence } from "../src/conversation/group/in_memory_fedos_group_message_persistence.js";
import { InMemoryFedosGroupFanoutDeliveryPersistence } from "../src/conversation/group/in_memory_fedos_group_fanout_delivery_persistence.js";
import { toFedosGroupGenerationId } from "../src/conversation/group/fedos_group_generation.js";
import { toFedosGroupDirectPathId } from "../src/conversation/group/fedos_group_direct_path.js";
import type { FedosConversationId } from "../src/conversation/fedos_conversation_id.js";

import { collectFedosConversationArchiveBundle, type FedosConversationArchiveCollectorDependencies } from "../src/conversation/archive/fedos_conversation_archive_collector.js";
import { restoreFedosConversationArchiveBundle, type FedosConversationArchiveRestoreDependencies } from "../src/conversation/archive/fedos_conversation_archive_restore.js";
import { detectFedosConversationArchiveDuplicates, type FedosConversationArchiveDuplicateDetectionDependencies } from "../src/conversation/archive/fedos_conversation_archive_duplicate_detection.js";

const GROUP_ID = "board-a::group-1" as FedosConversationId;
const CHILD_BOB_ID = "board-a::group-1-direct-bob" as FedosConversationId;
const CHILD_CAROL_ID = "board-a::group-1-direct-carol" as FedosConversationId;
const ALICE_MEMBERSHIP = `${GROUP_ID}::fedos::alice`;
const BOB_MEMBERSHIP = `${GROUP_ID}::fedos::bob`;
const CAROL_MEMBERSHIP = `${GROUP_ID}::fedos::carol`;
const GEN_0_ID = toFedosGroupGenerationId(GROUP_ID, 0);
const GEN_1_ID = toFedosGroupGenerationId(GROUP_ID, 1);

interface Ports {
  readonly conversationPersistence: InMemoryFedosConversationPersistence;
  readonly membershipPersistence: InMemoryFedosConversationMembershipPersistence;
  readonly capabilityPersistence: InMemoryFedosConversationCapabilityPersistence;
  readonly envelopePersistence: InMemoryFedosConversationMessageEnvelopePersistence;
  readonly payloadStorage: InMemoryFedosConversationPayloadStorage;
  readonly groupGenerationPersistence: InMemoryFedosGroupGenerationPersistence;
  readonly groupDirectPathPersistence: InMemoryFedosGroupDirectPathPersistence;
  readonly groupMessagePersistence: InMemoryFedosGroupMessagePersistence;
  readonly groupFanoutDeliveryPersistence: InMemoryFedosGroupFanoutDeliveryPersistence;
}

function makePorts(): Ports {
  return {
    conversationPersistence: new InMemoryFedosConversationPersistence(),
    membershipPersistence: new InMemoryFedosConversationMembershipPersistence(),
    capabilityPersistence: new InMemoryFedosConversationCapabilityPersistence(),
    envelopePersistence: new InMemoryFedosConversationMessageEnvelopePersistence(),
    payloadStorage: new InMemoryFedosConversationPayloadStorage(),
    groupGenerationPersistence: new InMemoryFedosGroupGenerationPersistence(),
    groupDirectPathPersistence: new InMemoryFedosGroupDirectPathPersistence(),
    groupMessagePersistence: new InMemoryFedosGroupMessagePersistence(),
    groupFanoutDeliveryPersistence: new InMemoryFedosGroupFanoutDeliveryPersistence(),
  };
}

function collectorDeps(ports: Ports): FedosConversationArchiveCollectorDependencies {
  return {
    conversationPersistence: ports.conversationPersistence,
    membershipPersistence: ports.membershipPersistence,
    capabilityPersistence: ports.capabilityPersistence,
    envelopePersistence: ports.envelopePersistence,
    payloadStorage: ports.payloadStorage,
    group: {
      groupGenerationPersistence: ports.groupGenerationPersistence,
      groupDirectPathPersistence: ports.groupDirectPathPersistence,
      groupMessagePersistence: ports.groupMessagePersistence,
      groupFanoutDeliveryPersistence: ports.groupFanoutDeliveryPersistence,
    },
  };
}

function restoreDeps(ports: Ports): FedosConversationArchiveRestoreDependencies {
  return collectorDeps(ports);
}

function duplicateDeps(ports: Ports): FedosConversationArchiveDuplicateDetectionDependencies {
  return collectorDeps(ports);
}

function seedDirectChild(ports: Ports, conversationId: FedosConversationId, counterpartyName: string): void {
  ports.conversationPersistence.putConversation({
    schemaVersion: 1, id: conversationId, mode: "public", boardId: "board-a", rootThreadId: conversationId, rootPostId: conversationId, policyReference: "public-v1", createdAt: 1_700_000_000,
  });
  ports.membershipPersistence.putMembership({
    schemaVersion: 1, id: `${conversationId}::fedos::alice`, conversationId, participantAuthority: "fedos", participantPublicIdentifier: "alice", participantIdentityId: null, role: "owner", state: "active", joinedAt: 1_700_000_000, endedAt: null,
  });
  ports.membershipPersistence.putMembership({
    schemaVersion: 1, id: `${conversationId}::fedos::${counterpartyName}`, conversationId, participantAuthority: "fedos", participantPublicIdentifier: counterpartyName, participantIdentityId: null, role: "member", state: "active", joinedAt: 1_700_000_000, endedAt: null,
  });
  ports.payloadStorage.putPayload({ id: `${conversationId}::payload-1` as never, conversationId, mediaType: "application/octet-stream", byteLength: 3, createdAt: 1_700_000_010 }, new Uint8Array([9, 9, 9]));
  ports.envelopePersistence.putEnvelope({
    schemaVersion: 1, id: `${conversationId}::envelope-1` as never, conversationId, senderMembershipId: `${conversationId}::fedos::alice` as never, payloadId: `${conversationId}::payload-1` as never, encryptionSuite: "ChaCha20Poly1305", keyEpoch: 0, createdAt: 1_700_000_010, replyToEnvelopeId: null,
  });
}

/** Seeds a full 2-generation, 2-member-recipient Group (Alice sender, Bob+Carol recipients), 2 Group Messages, 4 fanout delivery records (2 recipients x 2 messages), and both child Direct Conversations -- mirrors the acceptance-bar shape (3-member group, >=2 generations, multiple messages). */
function seedFullGroup(ports: Ports): void {
  ports.conversationPersistence.putConversation({
    schemaVersion: 1, id: GROUP_ID, mode: "public", boardId: "board-a", rootThreadId: GROUP_ID, rootPostId: GROUP_ID, policyReference: "public-v1", createdAt: 1_700_000_000,
  });
  ports.membershipPersistence.putMembership({ schemaVersion: 1, id: ALICE_MEMBERSHIP, conversationId: GROUP_ID, participantAuthority: "fedos", participantPublicIdentifier: "alice", participantIdentityId: null, role: "owner", state: "active", joinedAt: 1_700_000_000, endedAt: null });
  ports.membershipPersistence.putMembership({ schemaVersion: 1, id: BOB_MEMBERSHIP, conversationId: GROUP_ID, participantAuthority: "fedos", participantPublicIdentifier: "bob", participantIdentityId: null, role: "member", state: "active", joinedAt: 1_700_000_000, endedAt: null });
  ports.membershipPersistence.putMembership({ schemaVersion: 1, id: CAROL_MEMBERSHIP, conversationId: GROUP_ID, participantAuthority: "fedos", participantPublicIdentifier: "carol", participantIdentityId: null, role: "member", state: "active", joinedAt: 1_700_000_000, endedAt: null });

  ports.groupGenerationPersistence.putGeneration({ groupConversationId: GROUP_ID, generationId: GEN_0_ID, generationNumber: 0, activeMemberMembershipIds: [ALICE_MEMBERSHIP, BOB_MEMBERSHIP, CAROL_MEMBERSHIP].sort(), createdAt: 1_700_000_000, previousGenerationId: null });
  ports.groupGenerationPersistence.putGeneration({ groupConversationId: GROUP_ID, generationId: GEN_1_ID, generationNumber: 1, activeMemberMembershipIds: [ALICE_MEMBERSHIP, CAROL_MEMBERSHIP].sort(), createdAt: 1_700_000_100, previousGenerationId: GEN_0_ID });

  const pathBobId = toFedosGroupDirectPathId(GROUP_ID, GEN_0_ID, ALICE_MEMBERSHIP, BOB_MEMBERSHIP);
  const pathCarolGen0Id = toFedosGroupDirectPathId(GROUP_ID, GEN_0_ID, ALICE_MEMBERSHIP, CAROL_MEMBERSHIP);
  const pathCarolGen1Id = toFedosGroupDirectPathId(GROUP_ID, GEN_1_ID, ALICE_MEMBERSHIP, CAROL_MEMBERSHIP);
  ports.groupDirectPathPersistence.putPathFact({ pathId: pathBobId, groupConversationId: GROUP_ID, generationId: GEN_0_ID, senderMembershipId: ALICE_MEMBERSHIP, recipientMembershipId: BOB_MEMBERSHIP, directConversationId: CHILD_BOB_ID, state: "ready", createdAt: 1_700_000_000, updatedAt: 1_700_000_000 });
  ports.groupDirectPathPersistence.putPathFact({ pathId: pathCarolGen0Id, groupConversationId: GROUP_ID, generationId: GEN_0_ID, senderMembershipId: ALICE_MEMBERSHIP, recipientMembershipId: CAROL_MEMBERSHIP, directConversationId: CHILD_CAROL_ID, state: "ready", createdAt: 1_700_000_000, updatedAt: 1_700_000_000 });
  // Generation 1 re-establishes the SAME Alice<->Carol pairwise Direct Conversation (Alpha 1331's own
  // "directConversationId is NOT generation-scoped" contract) -- this is the Collector's own dedup case.
  ports.groupDirectPathPersistence.putPathFact({ pathId: pathCarolGen1Id, groupConversationId: GROUP_ID, generationId: GEN_1_ID, senderMembershipId: ALICE_MEMBERSHIP, recipientMembershipId: CAROL_MEMBERSHIP, directConversationId: CHILD_CAROL_ID, state: "ready", createdAt: 1_700_000_100, updatedAt: 1_700_000_100 });

  seedDirectChild(ports, CHILD_BOB_ID, "bob");
  seedDirectChild(ports, CHILD_CAROL_ID, "carol");

  ports.groupMessagePersistence.putMessageFact({ id: "group-message::m1", groupConversationId: GROUP_ID, generationId: GEN_0_ID, senderMembershipId: ALICE_MEMBERSHIP, createdAt: 1_700_000_010, replyToGroupMessageId: null, recipientCount: 2, fanoutState: "complete" });
  ports.groupMessagePersistence.putMessageFact({ id: "group-message::m2", groupConversationId: GROUP_ID, generationId: GEN_1_ID, senderMembershipId: ALICE_MEMBERSHIP, createdAt: 1_700_000_110, replyToGroupMessageId: "group-message::m1", recipientCount: 1, fanoutState: "complete" });

  ports.groupFanoutDeliveryPersistence.putDeliveryFact({ groupMessageId: "group-message::m1", recipientMembershipId: BOB_MEMBERSHIP, pathId: pathBobId, envelopeId: `${CHILD_BOB_ID}::envelope-1`, state: "stored", createdAt: 1_700_000_010 });
  ports.groupFanoutDeliveryPersistence.putDeliveryFact({ groupMessageId: "group-message::m1", recipientMembershipId: CAROL_MEMBERSHIP, pathId: pathCarolGen0Id, envelopeId: `${CHILD_CAROL_ID}::envelope-1`, state: "stored", createdAt: 1_700_000_010 });
  ports.groupFanoutDeliveryPersistence.putDeliveryFact({ groupMessageId: "group-message::m2", recipientMembershipId: CAROL_MEMBERSHIP, pathId: pathCarolGen1Id, envelopeId: `${CHILD_CAROL_ID}::envelope-1`, state: "stored", createdAt: 1_700_000_110 });
}

describe("Secure Runtime Alpha 1921-1980 -- Group Archive Collector", () => {
  it("1. collects every generation, current path per generation, current message per id, current fanout delivery per (message,recipient), and dedups child conversations by directConversationId", () => {
    const ports = makePorts();
    seedFullGroup(ports);
    const bundle = collectFedosConversationArchiveBundle(GROUP_ID, collectorDeps(ports), 1_700_000_500);
    expect(bundle).not.toBeNull();
    expect(bundle!.group).toBeDefined();
    expect(bundle!.group!.generations.length).toBe(2);
    expect(bundle!.group!.paths.length).toBe(3); // Bob@gen0, Carol@gen0, Carol@gen1 -- all three current path facts.
    expect(bundle!.group!.messages.length).toBe(2);
    expect(bundle!.group!.fanoutDeliveries.length).toBe(3);
    // Two DISTINCT path records reference CHILD_CAROL_ID (gen0 and gen1) -- deduplicated to ONE child bundle.
    expect(bundle!.group!.childConversations.length).toBe(2);
    const childIds = bundle!.group!.childConversations.map((c) => c.conversationId).sort();
    expect(childIds).toEqual([CHILD_BOB_ID, CHILD_CAROL_ID].sort());
  });

  it("2. a plain Direct conversation never gets a group section, even if group deps were supplied", () => {
    const ports = makePorts();
    seedDirectChild(ports, CHILD_BOB_ID, "bob");
    const bundle = collectFedosConversationArchiveBundle(CHILD_BOB_ID, collectorDeps(ports), 1_700_000_500);
    expect(bundle).not.toBeNull();
    expect(bundle!.group).toBeUndefined();
  });

  it("3. omitting group deps entirely never populates group, even for a private-group conversation id", () => {
    const ports = makePorts();
    seedFullGroup(ports);
    const deps = collectorDeps(ports);
    const { group: _omit, ...withoutGroup } = deps;
    const bundle = collectFedosConversationArchiveBundle(GROUP_ID, withoutGroup, 1_700_000_500);
    expect(bundle).not.toBeNull();
    expect(bundle!.group).toBeUndefined();
  });

  it("4. a missing child Direct Conversation is simply skipped, never aborts the whole collection", () => {
    const ports = makePorts();
    seedFullGroup(ports);
    // Remove Carol's own child conversation record entirely (simulates a referenced-but-absent child).
    const bareConversationPersistence = new InMemoryFedosConversationPersistence();
    bareConversationPersistence.putConversation(ports.conversationPersistence.getConversation(GROUP_ID)!);
    bareConversationPersistence.putConversation(ports.conversationPersistence.getConversation(CHILD_BOB_ID)!);
    const bundle = collectFedosConversationArchiveBundle(GROUP_ID, { ...collectorDeps(ports), conversationPersistence: bareConversationPersistence }, 1_700_000_500);
    expect(bundle).not.toBeNull();
    expect(bundle!.group!.childConversations.length).toBe(1);
    expect(bundle!.group!.childConversations[0]!.conversationId).toBe(CHILD_BOB_ID);
  });
});

describe("Secure Runtime Alpha 1921-1980 -- Group Archive Restore", () => {
  it("1. restores generations, paths, child conversations (including their own memberships/envelopes/payloads), messages, and fanout deliveries into a fresh set of ports", () => {
    const sourcePorts = makePorts();
    seedFullGroup(sourcePorts);
    const bundle = collectFedosConversationArchiveBundle(GROUP_ID, collectorDeps(sourcePorts), 1_700_000_500)!;

    const destPorts = makePorts();
    const result = restoreFedosConversationArchiveBundle(bundle, restoreDeps(destPorts));

    expect(result.conversation).toBe("inserted");
    expect(result.group).toBeDefined();
    expect(result.group!.generations).toEqual({ inserted: 2, duplicate: 0, conflict: 0, failed: 0, invalid: 0, denied: 0 });
    expect(result.group!.paths).toEqual({ inserted: 3, duplicate: 0, conflict: 0, failed: 0, invalid: 0, denied: 0 });
    expect(result.group!.messages).toEqual({ inserted: 2, duplicate: 0, conflict: 0, failed: 0, invalid: 0, denied: 0 });
    expect(result.group!.fanoutDeliveries).toEqual({ inserted: 3, duplicate: 0, conflict: 0, failed: 0, invalid: 0, denied: 0 });
    expect(result.group!.childConversations.length).toBe(2);
    for (const child of result.group!.childConversations) {
      expect(child.conversation).toBe("inserted");
      expect(child.memberships.inserted).toBe(2);
      expect(child.envelopes.inserted).toBe(1);
      expect(child.payloads.inserted).toBe(1);
    }

    // Independently verify the destination ports themselves now hold the exact restored state.
    expect(destPorts.groupGenerationPersistence.listGenerations(GROUP_ID).length).toBe(2);
    expect(destPorts.groupDirectPathPersistence.listPathsForGeneration(GROUP_ID, GEN_1_ID).length).toBe(1);
    expect(destPorts.groupMessagePersistence.listMessagesForGroup(GROUP_ID).length).toBe(2);
    expect(destPorts.conversationPersistence.getConversation(CHILD_CAROL_ID)).not.toBeNull();
  });

  it("2. restoring the identical archive twice reports duplicate/already-present the second time -- never a duplicate record", () => {
    const sourcePorts = makePorts();
    seedFullGroup(sourcePorts);
    const bundle = collectFedosConversationArchiveBundle(GROUP_ID, collectorDeps(sourcePorts), 1_700_000_500)!;

    const destPorts = makePorts();
    restoreFedosConversationArchiveBundle(bundle, restoreDeps(destPorts));
    const second = restoreFedosConversationArchiveBundle(bundle, restoreDeps(destPorts));

    expect(second.group!.generations).toEqual({ inserted: 0, duplicate: 2, conflict: 0, failed: 0, invalid: 0, denied: 0 });
    expect(second.group!.paths).toEqual({ inserted: 0, duplicate: 3, conflict: 0, failed: 0, invalid: 0, denied: 0 });
    expect(second.group!.messages).toEqual({ inserted: 0, duplicate: 2, conflict: 0, failed: 0, invalid: 0, denied: 0 });
    expect(second.group!.fanoutDeliveries).toEqual({ inserted: 0, duplicate: 3, conflict: 0, failed: 0, invalid: 0, denied: 0 });
    expect(destPorts.groupGenerationPersistence.listGenerations(GROUP_ID).length).toBe(2); // still exactly 2, never 4.
  });

  it("3. crash/restart recovery -- a restore interrupted after generations+paths (but before messages/fanout/children) converges cleanly on a fresh retry", () => {
    const sourcePorts = makePorts();
    seedFullGroup(sourcePorts);
    const bundle = collectFedosConversationArchiveBundle(GROUP_ID, collectorDeps(sourcePorts), 1_700_000_500)!;

    const destPorts = makePorts();
    // Simulate "crashed mid-restore": generations/paths already durably written by a PRIOR
    // (interrupted) attempt, but messages/fanout/children were never reached.
    for (const g of bundle.group!.generations) destPorts.groupGenerationPersistence.putGeneration(g);
    for (const p of bundle.group!.paths) destPorts.groupDirectPathPersistence.putPathFact(p);

    const result = restoreFedosConversationArchiveBundle(bundle, restoreDeps(destPorts));
    expect(result.group!.generations).toEqual({ inserted: 0, duplicate: 2, conflict: 0, failed: 0, invalid: 0, denied: 0 });
    expect(result.group!.paths).toEqual({ inserted: 0, duplicate: 3, conflict: 0, failed: 0, invalid: 0, denied: 0 });
    expect(result.group!.messages).toEqual({ inserted: 2, duplicate: 0, conflict: 0, failed: 0, invalid: 0, denied: 0 });
    expect(result.group!.fanoutDeliveries).toEqual({ inserted: 3, duplicate: 0, conflict: 0, failed: 0, invalid: 0, denied: 0 });
    expect(result.group!.childConversations.every((c) => c.conversation === "inserted")).toBe(true);

    const secondAttempt = restoreFedosConversationArchiveBundle(bundle, restoreDeps(destPorts));
    expect(secondAttempt.group!.generations.duplicate).toBe(2);
    expect(secondAttempt.group!.paths.duplicate).toBe(3);
    expect(secondAttempt.group!.messages.duplicate).toBe(2);
    expect(secondAttempt.group!.fanoutDeliveries.duplicate).toBe(3);
  });

  it("4. a deep-invalid generation record is skipped (tallied invalid), never inserted, and never blocks the rest of the restore", () => {
    const sourcePorts = makePorts();
    seedFullGroup(sourcePorts);
    const bundle = collectFedosConversationArchiveBundle(GROUP_ID, collectorDeps(sourcePorts), 1_700_000_500)!;
    const tampered = {
      ...bundle,
      group: {
        ...bundle.group!,
        generations: [
          { ...bundle.group!.generations[0]!, activeMemberMembershipIds: 12345 as unknown as readonly string[] }, // deep-invalid: not an array.
          bundle.group!.generations[1]!,
        ],
      },
    };
    const destPorts = makePorts();
    const result = restoreFedosConversationArchiveBundle(tampered, restoreDeps(destPorts));
    expect(result.group!.generations).toEqual({ inserted: 1, duplicate: 0, conflict: 0, failed: 0, invalid: 1, denied: 0 });
    expect(destPorts.groupGenerationPersistence.listGenerations(GROUP_ID).length).toBe(1);
  });

  it("5. conflict is surfaced, not silently overwritten -- a pre-existing record at the SAME (pathId, state) key but different content is untouched", () => {
    const sourcePorts = makePorts();
    seedFullGroup(sourcePorts);
    const bundle = collectFedosConversationArchiveBundle(GROUP_ID, collectorDeps(sourcePorts), 1_700_000_500)!;

    const destPorts = makePorts();
    const originalPath = bundle.group!.paths.find((p) => p.recipientMembershipId === BOB_MEMBERSHIP)!;
    // SAME (pathId, state) composite key (Alpha 1336's own internal storage key) but a DIFFERENT
    // directConversationId -- a genuine content conflict, not merely a later state transition.
    destPorts.groupDirectPathPersistence.putPathFact({ ...originalPath, directConversationId: "board-a::some-other-conversation" });

    const result = restoreFedosConversationArchiveBundle(bundle, restoreDeps(destPorts));
    expect(result.group!.paths.conflict).toBe(1);
    expect(destPorts.groupDirectPathPersistence.getPath(originalPath.pathId)?.directConversationId).toBe("board-a::some-other-conversation"); // untouched.
  });
});

describe("Secure Runtime Alpha 1921-1980 -- Group Archive Duplicate Detection (preflight)", () => {
  it("1. reports new/duplicate/conflict per Group domain, including nested child conversations, without writing anything", () => {
    const sourcePorts = makePorts();
    seedFullGroup(sourcePorts);
    const bundle = collectFedosConversationArchiveBundle(GROUP_ID, collectorDeps(sourcePorts), 1_700_000_500)!;

    const destPorts = makePorts();
    const firstReport = detectFedosConversationArchiveDuplicates(bundle, duplicateDeps(destPorts));
    expect(firstReport.group!.generations).toEqual({ new: 2, duplicate: 0, conflict: 0 });
    expect(firstReport.group!.paths).toEqual({ new: 3, duplicate: 0, conflict: 0 });
    expect(firstReport.group!.messages).toEqual({ new: 2, duplicate: 0, conflict: 0 });
    expect(firstReport.group!.fanoutDeliveries).toEqual({ new: 3, duplicate: 0, conflict: 0 });
    expect(firstReport.group!.childConversations.length).toBe(2);
    for (const child of firstReport.group!.childConversations) expect(child.conversation).toBe("new");
    // Never writes -- confirmed nothing exists at the destination after a preflight-only call.
    expect(destPorts.groupGenerationPersistence.listGenerations(GROUP_ID).length).toBe(0);

    restoreFedosConversationArchiveBundle(bundle, restoreDeps(destPorts));
    const secondReport = detectFedosConversationArchiveDuplicates(bundle, duplicateDeps(destPorts));
    expect(secondReport.group!.generations).toEqual({ new: 0, duplicate: 2, conflict: 0 });
    expect(secondReport.group!.paths).toEqual({ new: 0, duplicate: 3, conflict: 0 });
    for (const child of secondReport.group!.childConversations) expect(child.conversation).toBe("duplicate");
  });

  it("2. detects a conflicting pre-existing Group Message record at the same id", () => {
    const sourcePorts = makePorts();
    seedFullGroup(sourcePorts);
    const bundle = collectFedosConversationArchiveBundle(GROUP_ID, collectorDeps(sourcePorts), 1_700_000_500)!;

    const destPorts = makePorts();
    const originalMessage = bundle.group!.messages.find((m) => m.id === "group-message::m1")!;
    destPorts.groupMessagePersistence.putMessageFact({ ...originalMessage, recipientCount: 999 });

    const report = detectFedosConversationArchiveDuplicates(bundle, duplicateDeps(destPorts));
    expect(report.group!.messages.conflict).toBe(1);
  });
});
