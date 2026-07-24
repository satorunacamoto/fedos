/**
 * Secure Runtime Alpha 1921–1980 ("Group Conversation Archive Integration
 * and Cross-Branch Recovery Arc") — `FedosConversationArchiveRuntime`
 * Group Section tests: export/inspect/preflight/restore with the four
 * Group-only ports wired in, resource bounds accounting for the Group
 * Section's own record counts, corruption/security matrix entries
 * specific to the Group Section, and lifecycle fail-closed behavior.
 * Mirrors `test/secure_runtime_alpha_1691_1760_archive_runtime.test.ts`'s
 * own harness/fake-crypto-boundary conventions exactly.
 *
 * As established by `test/secure_runtime_alpha_1921_1980_group_archive_collector_restore.test.ts`'s
 * own header (re-verified against real source): a real `private-group`
 * Conversation is never written into `FedosConversationPersistence` in
 * this codebase (that port/wire-shape/validator is Public-Board-only,
 * Alpha 748, unchanged, pre-dating this Arc). Every `conversationPersistence`
 * record seeded below therefore uses `mode: "public"` as the SAME
 * deliberate, documented placeholder substitution the Direct Archive
 * Foundation's own tests already established.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
// @ts-expect-error `node:fs` has no type declarations without `@types/node` in this project's tsconfig.
import { mkdtempSync, rmSync, readFileSync, writeFileSync } from "node:fs";
// @ts-expect-error see above.
import { join } from "node:path";
// @ts-expect-error see above.
import { tmpdir } from "node:os";

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
import { toFedosConversationMembershipId } from "../src/conversation/membership/fedos_conversation_membership_id.js";
import type { FedosConversationParticipantReference } from "../src/conversation/membership/fedos_conversation_participant_reference.js";
import type { FedosConversationId } from "../src/conversation/fedos_conversation_id.js";

import {
  FedosWasmConversationArchiveEncryptionAuthority,
  type FedosConversationArchiveEncryptionRuntimeBoundary,
} from "../src/conversation/archive/fedos_conversation_archive_encryption.js";
import { NodeFedosConversationArchiveFileAuthority } from "../src/conversation/archive/fs/fedos_conversation_archive_file_authority.js";
import { encodeFedosConversationArchiveFileContainer } from "../src/conversation/archive/fs/fedos_conversation_archive_file_container.js";
import { createFedosConversationArchiveRuntime, type FedosConversationArchiveRuntime } from "../src/conversation/archive/runtime/fedos_conversation_archive_runtime.js";
import { collectFedosConversationArchiveBundle } from "../src/conversation/archive/fedos_conversation_archive_collector.js";
import type { FedosMasterSeedAuthority } from "../src/runtime/master_seed/fedos_master_seed_authority.js";
import type { AeadCiphertextHandle, AeadCiphertextWire, AeadKeyHandle } from "../src/runtime/fedos_wasm_loader.js";

const GROUP_ID = "board-a::group-runtime-1" as FedosConversationId;
const CHILD_ID = "board-a::group-runtime-1-direct-bob" as FedosConversationId;
const LOCAL_PARTICIPANT: FedosConversationParticipantReference = { authority: "fedos", publicIdentifier: "alice", identityId: null };
const LOCAL_ACCOUNT_INDEX = 0;
const COUNTERPARTY_PUBLIC_KEY_HEX = "cd".repeat(32);
const LOCAL_MEMBERSHIP_ID = toFedosConversationMembershipId(GROUP_ID, LOCAL_PARTICIPANT);
const ALICE_MEMBERSHIP = `${GROUP_ID}::fedos::alice`;
const BOB_MEMBERSHIP = `${GROUP_ID}::fedos::bob`;
const GEN_0_ID = toFedosGroupGenerationId(GROUP_ID, 0);

const KEY_HANDLE: AeadKeyHandle = { kind: "AeadKeyHandle" } as AeadKeyHandle;

function fakeMasterSeedAuthority(resolveConversationKey: FedosMasterSeedAuthority["resolveConversationKey"]): FedosMasterSeedAuthority {
  return {
    isAvailable: vi.fn(async () => true),
    isCleared: vi.fn(async () => false),
    generate: vi.fn(async () => true),
    restoreSealed: vi.fn(async () => true),
    seal: vi.fn(async () => null),
    clear: vi.fn(async () => undefined),
    resolveConversationKey,
  };
}
function matchingMasterSeedAuthority(): FedosMasterSeedAuthority {
  return fakeMasterSeedAuthority(async (accountIndex, counterpartyPublicKeyHex) =>
    accountIndex === LOCAL_ACCOUNT_INDEX && counterpartyPublicKeyHex === COUNTERPARTY_PUBLIC_KEY_HEX ? KEY_HANDLE : null,
  );
}

function fakeRoundTrippingRuntimeBoundary(): FedosConversationArchiveEncryptionRuntimeBoundary {
  const byHandle = new Map<string, Uint8Array>();
  const byWire = new Map<string, string>();
  let counter = 0;
  return {
    encrypt: vi.fn(async (_key, _algorithm, _aadDomain, plaintext) => {
      counter += 1;
      const id = `handle-${counter}`;
      byHandle.set(id, plaintext);
      return { kind: "AeadCiphertextHandle", id } as unknown as AeadCiphertextHandle;
    }),
    exportCiphertext: vi.fn(async (ciphertext) => {
      const id = (ciphertext as unknown as { id: string }).id;
      const wire = `wire-${id}`;
      byWire.set(wire, id);
      return wire as unknown as AeadCiphertextWire;
    }),
    importCiphertext: vi.fn(async (wire) => {
      const id = byWire.get(wire as unknown as string);
      return id === undefined ? null : ({ kind: "AeadCiphertextHandle", id } as unknown as AeadCiphertextHandle);
    }),
    decrypt: vi.fn(async (_key, _algorithm, _aadDomain, ciphertext) => byHandle.get((ciphertext as unknown as { id: string }).id) ?? null),
  };
}

interface Harness {
  runtime: FedosConversationArchiveRuntime;
  readonly conversationPersistence: InMemoryFedosConversationPersistence;
  readonly membershipPersistence: InMemoryFedosConversationMembershipPersistence;
  readonly capabilityPersistence: InMemoryFedosConversationCapabilityPersistence;
  readonly envelopePersistence: InMemoryFedosConversationMessageEnvelopePersistence;
  readonly payloadStorage: InMemoryFedosConversationPayloadStorage;
  readonly groupGenerationPersistence: InMemoryFedosGroupGenerationPersistence;
  readonly groupDirectPathPersistence: InMemoryFedosGroupDirectPathPersistence;
  readonly groupMessagePersistence: InMemoryFedosGroupMessagePersistence;
  readonly groupFanoutDeliveryPersistence: InMemoryFedosGroupFanoutDeliveryPersistence;
  stopped: boolean;
}

function makeHarness(overrides: { masterSeedAuthority?: FedosMasterSeedAuthority; boundary?: FedosConversationArchiveEncryptionRuntimeBoundary; omitGroupPorts?: boolean } = {}): Harness {
  const harness: Harness = {
    runtime: undefined as unknown as FedosConversationArchiveRuntime,
    conversationPersistence: new InMemoryFedosConversationPersistence(),
    membershipPersistence: new InMemoryFedosConversationMembershipPersistence(),
    capabilityPersistence: new InMemoryFedosConversationCapabilityPersistence(),
    envelopePersistence: new InMemoryFedosConversationMessageEnvelopePersistence(),
    payloadStorage: new InMemoryFedosConversationPayloadStorage(),
    groupGenerationPersistence: new InMemoryFedosGroupGenerationPersistence(),
    groupDirectPathPersistence: new InMemoryFedosGroupDirectPathPersistence(),
    groupMessagePersistence: new InMemoryFedosGroupMessagePersistence(),
    groupFanoutDeliveryPersistence: new InMemoryFedosGroupFanoutDeliveryPersistence(),
    stopped: false,
  };

  const encryptionAuthority = new FedosWasmConversationArchiveEncryptionAuthority(
    overrides.masterSeedAuthority ?? matchingMasterSeedAuthority(),
    overrides.boundary ?? fakeRoundTrippingRuntimeBoundary(),
  );

  const runtime = createFedosConversationArchiveRuntime({
    conversationPersistence: harness.conversationPersistence,
    membershipPersistence: harness.membershipPersistence,
    capabilityPersistence: harness.capabilityPersistence,
    envelopePersistence: harness.envelopePersistence,
    payloadStorage: harness.payloadStorage,
    ...(overrides.omitGroupPorts
      ? {}
      : {
          groupGenerationPersistence: harness.groupGenerationPersistence,
          groupDirectPathPersistence: harness.groupDirectPathPersistence,
          groupMessagePersistence: harness.groupMessagePersistence,
          groupFanoutDeliveryPersistence: harness.groupFanoutDeliveryPersistence,
        }),
    encryptionAuthority,
    fileAuthority: new NodeFedosConversationArchiveFileAuthority(),
    clock: () => 1_700_000_999,
    isRuntimeRunning: () => !harness.stopped,
  });
  harness.runtime = runtime;
  return harness;
}

/** Seeds a real Group graph: 3-member Group (Alice sender, Bob recipient), 1 generation, 1 path, 1 child Direct Conversation (Alice<->Bob), 1 Group Message, 1 fanout delivery. */
function seedGroup(h: Harness, plaintext: Uint8Array): void {
  h.conversationPersistence.putConversation({ schemaVersion: 1, id: GROUP_ID, mode: "public", boardId: "board-a", rootThreadId: GROUP_ID, rootPostId: GROUP_ID, policyReference: "public-v1", createdAt: 1_700_000_000 });
  h.membershipPersistence.putMembership({ schemaVersion: 1, id: LOCAL_MEMBERSHIP_ID, conversationId: GROUP_ID, participantAuthority: LOCAL_PARTICIPANT.authority, participantPublicIdentifier: LOCAL_PARTICIPANT.publicIdentifier, participantIdentityId: null, role: "owner", state: "active", joinedAt: 1_700_000_000, endedAt: null });
  h.membershipPersistence.putMembership({ schemaVersion: 1, id: BOB_MEMBERSHIP, conversationId: GROUP_ID, participantAuthority: "fedos", participantPublicIdentifier: "bob", participantIdentityId: null, role: "member", state: "active", joinedAt: 1_700_000_000, endedAt: null });

  h.groupGenerationPersistence.putGeneration({ groupConversationId: GROUP_ID, generationId: GEN_0_ID, generationNumber: 0, activeMemberMembershipIds: [ALICE_MEMBERSHIP, BOB_MEMBERSHIP].sort(), createdAt: 1_700_000_000, previousGenerationId: null });
  const pathId = toFedosGroupDirectPathId(GROUP_ID, GEN_0_ID, ALICE_MEMBERSHIP, BOB_MEMBERSHIP);
  h.groupDirectPathPersistence.putPathFact({ pathId, groupConversationId: GROUP_ID, generationId: GEN_0_ID, senderMembershipId: ALICE_MEMBERSHIP, recipientMembershipId: BOB_MEMBERSHIP, directConversationId: CHILD_ID, state: "ready", createdAt: 1_700_000_000, updatedAt: 1_700_000_000 });

  h.conversationPersistence.putConversation({ schemaVersion: 1, id: CHILD_ID, mode: "public", boardId: "board-a", rootThreadId: CHILD_ID, rootPostId: CHILD_ID, policyReference: "public-v1", createdAt: 1_700_000_000 });
  h.membershipPersistence.putMembership({ schemaVersion: 1, id: `${CHILD_ID}::fedos::alice`, conversationId: CHILD_ID, participantAuthority: "fedos", participantPublicIdentifier: "alice", participantIdentityId: null, role: "owner", state: "active", joinedAt: 1_700_000_000, endedAt: null });
  h.membershipPersistence.putMembership({ schemaVersion: 1, id: `${CHILD_ID}::fedos::bob`, conversationId: CHILD_ID, participantAuthority: "fedos", participantPublicIdentifier: "bob", participantIdentityId: null, role: "member", state: "active", joinedAt: 1_700_000_000, endedAt: null });
  h.payloadStorage.putPayload({ id: "child-payload-1" as never, conversationId: CHILD_ID, mediaType: "application/octet-stream", byteLength: plaintext.length, createdAt: 1_700_000_010 }, plaintext);
  h.envelopePersistence.putEnvelope({ schemaVersion: 1, id: "child-envelope-1" as never, conversationId: CHILD_ID, senderMembershipId: `${CHILD_ID}::fedos::alice` as never, payloadId: "child-payload-1" as never, encryptionSuite: "ChaCha20Poly1305", keyEpoch: 0, createdAt: 1_700_000_010, replyToEnvelopeId: null });

  h.groupMessagePersistence.putMessageFact({ id: "group-message::m1", groupConversationId: GROUP_ID, generationId: GEN_0_ID, senderMembershipId: ALICE_MEMBERSHIP, createdAt: 1_700_000_010, replyToGroupMessageId: null, recipientCount: 1, fanoutState: "complete" });
  h.groupFanoutDeliveryPersistence.putDeliveryFact({ groupMessageId: "group-message::m1", recipientMembershipId: BOB_MEMBERSHIP, pathId, envelopeId: "child-envelope-1", state: "stored", createdAt: 1_700_000_010 });
}

let dir: string;
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "fedos-1921-1980-group-archive-runtime-"));
});
afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

const EXACT_MESSAGE = new TextEncoder().encode("Group secret payload, Bob only");

describe("Secure Runtime Alpha 1921-1980 -- Group Archive Runtime round trip", () => {
  it("1. export -> fresh Runtime -> inspect -> preflight -> restore -- Group Section (generations/paths/messages/fanout + child conversation) is recovered exactly", async () => {
    const sharedBoundary = fakeRoundTrippingRuntimeBoundary();
    const sender = makeHarness({ boundary: sharedBoundary });
    seedGroup(sender, EXACT_MESSAGE);
    const destination = join(dir, "group.archive");

    const exportResult = await sender.runtime.exportConversationArchive({
      conversationId: GROUP_ID, destinationPath: destination, localParticipant: LOCAL_PARTICIPANT,
      localAccountIndex: LOCAL_ACCOUNT_INDEX, counterpartyPublicKeyHex: COUNTERPARTY_PUBLIC_KEY_HEX, suite: "ChaCha20Poly1305",
    });
    expect(exportResult.outcome).toBe("exported");
    expect(exportResult.manifest?.groupGenerationCount).toBe(1);
    expect(exportResult.manifest?.groupPathCount).toBe(1);
    expect(exportResult.manifest?.groupMessageCount).toBe(1);
    expect(exportResult.manifest?.groupFanoutDeliveryCount).toBe(1);
    expect(exportResult.manifest?.groupChildConversationCount).toBe(1);

    sender.stopped = true;
    const receiver = makeHarness({ boundary: sharedBoundary });

    const inspection = await receiver.runtime.inspectConversationArchive(destination);
    expect(inspection.outcome).toBe("inspected");
    expect(inspection.manifest?.groupMessageCount).toBe(1);

    const preflight = await receiver.runtime.preflightRestore({ sourcePath: destination, localAccountIndex: LOCAL_ACCOUNT_INDEX, counterpartyPublicKeyHex: COUNTERPARTY_PUBLIC_KEY_HEX, suite: "ChaCha20Poly1305" });
    expect(preflight.outcome).toBe("previewed");
    expect(preflight.report?.group?.generations).toEqual({ new: 1, duplicate: 0, conflict: 0 });
    expect(preflight.report?.group?.childConversations[0]?.envelopes).toEqual({ new: 1, duplicate: 0, conflict: 0 });

    const restore = await receiver.runtime.restoreConversationArchive({ sourcePath: destination, localAccountIndex: LOCAL_ACCOUNT_INDEX, counterpartyPublicKeyHex: COUNTERPARTY_PUBLIC_KEY_HEX, suite: "ChaCha20Poly1305" });
    expect(restore.outcome).toBe("restored");
    expect(restore.details?.group?.generations).toEqual({ inserted: 1, duplicate: 0, conflict: 0, failed: 0, invalid: 0, denied: 0 });

    expect(receiver.groupGenerationPersistence.listGenerations(GROUP_ID).length).toBe(1);
    expect(receiver.groupDirectPathPersistence.listPathsForGeneration(GROUP_ID, GEN_0_ID).length).toBe(1);
    expect(receiver.groupMessagePersistence.listMessagesForGroup(GROUP_ID).length).toBe(1);
    const restoredBytes = receiver.payloadStorage.getPayload("child-payload-1" as never);
    expect(restoredBytes?.bytes).toEqual(EXACT_MESSAGE);
  });

  it("2. a receiver Runtime with NO group ports configured never restores or reports a group section -- the Direct-only base domains still restore correctly", async () => {
    const sharedBoundary = fakeRoundTrippingRuntimeBoundary();
    const sender = makeHarness({ boundary: sharedBoundary });
    seedGroup(sender, EXACT_MESSAGE);
    const destination = join(dir, "group-no-ports.archive");
    await sender.runtime.exportConversationArchive({ conversationId: GROUP_ID, destinationPath: destination, localParticipant: LOCAL_PARTICIPANT, localAccountIndex: LOCAL_ACCOUNT_INDEX, counterpartyPublicKeyHex: COUNTERPARTY_PUBLIC_KEY_HEX, suite: "ChaCha20Poly1305" });

    const receiver = makeHarness({ boundary: sharedBoundary, omitGroupPorts: true });
    const restore = await receiver.runtime.restoreConversationArchive({ sourcePath: destination, localAccountIndex: LOCAL_ACCOUNT_INDEX, counterpartyPublicKeyHex: COUNTERPARTY_PUBLIC_KEY_HEX, suite: "ChaCha20Poly1305" });
    expect(restore.outcome).toBe("restored");
    expect(restore.details?.group).toBeUndefined();
    expect(receiver.groupGenerationPersistence.listGenerations(GROUP_ID).length).toBe(0);
  });

  it("3. too-large -- a bound accounting for the Group Section's own record counts rejects an oversized Group export before any file write", async () => {
    const sender = makeHarness({ boundary: fakeRoundTrippingRuntimeBoundary() });
    seedGroup(sender, EXACT_MESSAGE);
    const runtime = createFedosConversationArchiveRuntime({
      conversationPersistence: sender.conversationPersistence, membershipPersistence: sender.membershipPersistence,
      capabilityPersistence: sender.capabilityPersistence, envelopePersistence: sender.envelopePersistence, payloadStorage: sender.payloadStorage,
      groupGenerationPersistence: sender.groupGenerationPersistence, groupDirectPathPersistence: sender.groupDirectPathPersistence,
      groupMessagePersistence: sender.groupMessagePersistence, groupFanoutDeliveryPersistence: sender.groupFanoutDeliveryPersistence,
      encryptionAuthority: new FedosWasmConversationArchiveEncryptionAuthority(matchingMasterSeedAuthority(), fakeRoundTrippingRuntimeBoundary()),
      fileAuthority: new NodeFedosConversationArchiveFileAuthority(), clock: () => 1_700_000_999, isRuntimeRunning: () => true,
      bounds: { maxArchiveFileByteLength: 64 * 1024 * 1024, maxRecordCount: 3 }, // membership(2 direct+1 child=3 excluding group) + group counts overflow 3 easily.
    });
    const result = await runtime.exportConversationArchive({ conversationId: GROUP_ID, destinationPath: join(dir, "too-big-group.archive"), localParticipant: LOCAL_PARTICIPANT, localAccountIndex: LOCAL_ACCOUNT_INDEX, counterpartyPublicKeyHex: COUNTERPARTY_PUBLIC_KEY_HEX, suite: "ChaCha20Poly1305" });
    expect(result.outcome).toBe("too-large");
  });
});

describe("Secure Runtime Alpha 1921-1980 -- Group Archive corruption/security matrix", () => {
  async function exportOnce(h: Harness, path: string): Promise<void> {
    seedGroup(h, EXACT_MESSAGE);
    const result = await h.runtime.exportConversationArchive({ conversationId: GROUP_ID, destinationPath: path, localParticipant: LOCAL_PARTICIPANT, localAccountIndex: LOCAL_ACCOUNT_INDEX, counterpartyPublicKeyHex: COUNTERPARTY_PUBLIC_KEY_HEX, suite: "ChaCha20Poly1305" });
    expect(result.outcome).toBe("exported");
  }

  it("1. a missing child Direct Conversation (a path's own directConversationId has no matching entry in childConversations) never crashes restore -- every OTHER Group record still restores, the dangling reference is simply never resolved", async () => {
    const sharedBoundary = fakeRoundTrippingRuntimeBoundary();
    const sender = makeHarness({ boundary: sharedBoundary });
    seedGroup(sender, EXACT_MESSAGE);

    const bundle = collectFedosConversationArchiveBundle(GROUP_ID, {
      conversationPersistence: sender.conversationPersistence, membershipPersistence: sender.membershipPersistence,
      capabilityPersistence: sender.capabilityPersistence, envelopePersistence: sender.envelopePersistence, payloadStorage: sender.payloadStorage,
      group: { groupGenerationPersistence: sender.groupGenerationPersistence, groupDirectPathPersistence: sender.groupDirectPathPersistence, groupMessagePersistence: sender.groupMessagePersistence, groupFanoutDeliveryPersistence: sender.groupFanoutDeliveryPersistence },
    }, 1_700_000_999)!;
    // Drop the ONE child conversation this Group's own path references -- simulates an Archive whose
    // child-conversation graph is incomplete (e.g. a future producer that failed to collect it).
    const withMissingChild = { ...bundle, group: { ...bundle.group!, childConversations: [] } };

    const exported = await new FedosWasmConversationArchiveEncryptionAuthority(matchingMasterSeedAuthority(), sharedBoundary).export({
      bundle: withMissingChild, suite: "ChaCha20Poly1305", localAccountIndex: LOCAL_ACCOUNT_INDEX, counterpartyPublicKeyHex: COUNTERPARTY_PUBLIC_KEY_HEX,
    });
    expect(exported.outcome).toBe("exported");
    if (exported.outcome !== "exported") return;
    const path = join(dir, "missing-child.archive");
    writeFileSync(path, encodeFedosConversationArchiveFileContainer(exported.manifest, exported.ciphertext));

    const receiver = makeHarness({ boundary: sharedBoundary });
    const restore = await receiver.runtime.restoreConversationArchive({ sourcePath: path, localAccountIndex: LOCAL_ACCOUNT_INDEX, counterpartyPublicKeyHex: COUNTERPARTY_PUBLIC_KEY_HEX, suite: "ChaCha20Poly1305" });
    // Never throws, never invents a placeholder child -- the generation/path/message/fanout facts
    // (which carry no cross-domain FK enforcement in this codebase, per this Arc's own re-verified
    // finding) all restore cleanly; the CHILD Direct Conversation itself is simply absent.
    expect(restore.outcome).toBe("restored");
    expect(restore.details?.group?.generations.inserted).toBe(1);
    expect(restore.details?.group?.paths.inserted).toBe(1);
    expect(restore.details?.group?.childConversations.length).toBe(0);
    expect(receiver.conversationPersistence.getConversation(CHILD_ID)).toBeNull();
  });

  it("2. a malformed (deep-invalid) generation record restores every OTHER valid Group record and reports partially-invalid", async () => {
    const sharedBoundary = fakeRoundTrippingRuntimeBoundary();
    const sender = makeHarness({ boundary: sharedBoundary });
    seedGroup(sender, EXACT_MESSAGE);
    // A second generation, added directly, that is well-formed as JSON but will need hand-corruption below.
    const path = join(dir, "invalid-generation.archive");
    const exportResult = await sender.runtime.exportConversationArchive({ conversationId: GROUP_ID, destinationPath: path, localParticipant: LOCAL_PARTICIPANT, localAccountIndex: LOCAL_ACCOUNT_INDEX, counterpartyPublicKeyHex: COUNTERPARTY_PUBLIC_KEY_HEX, suite: "ChaCha20Poly1305" });
    expect(exportResult.outcome).toBe("exported");

    // Hand-corrupt the ALREADY-EXPORTED archive: re-export via the encryption authority directly with
    // a tampered bundle (mirrors the Foundation's own "partially-invalid" reconciliation test pattern).
    const bundle = collectFedosConversationArchiveBundle(GROUP_ID, {
      conversationPersistence: sender.conversationPersistence, membershipPersistence: sender.membershipPersistence,
      capabilityPersistence: sender.capabilityPersistence, envelopePersistence: sender.envelopePersistence, payloadStorage: sender.payloadStorage,
      group: { groupGenerationPersistence: sender.groupGenerationPersistence, groupDirectPathPersistence: sender.groupDirectPathPersistence, groupMessagePersistence: sender.groupMessagePersistence, groupFanoutDeliveryPersistence: sender.groupFanoutDeliveryPersistence },
    }, 1_700_000_999)!;
    const tampered = { ...bundle, group: { ...bundle.group!, generations: [{ ...bundle.group!.generations[0]!, generationNumber: "not-a-number" as unknown as number }] } };
    const exported = await new FedosWasmConversationArchiveEncryptionAuthority(matchingMasterSeedAuthority(), sharedBoundary).export({ bundle: tampered, suite: "ChaCha20Poly1305", localAccountIndex: LOCAL_ACCOUNT_INDEX, counterpartyPublicKeyHex: COUNTERPARTY_PUBLIC_KEY_HEX });
    expect(exported.outcome).toBe("exported");
    if (exported.outcome !== "exported") return;
    writeFileSync(path, encodeFedosConversationArchiveFileContainer(exported.manifest, exported.ciphertext));

    const receiver = makeHarness({ boundary: sharedBoundary });
    const restore = await receiver.runtime.restoreConversationArchive({ sourcePath: path, localAccountIndex: LOCAL_ACCOUNT_INDEX, counterpartyPublicKeyHex: COUNTERPARTY_PUBLIC_KEY_HEX, suite: "ChaCha20Poly1305" });
    expect(restore.outcome).toBe("partially-invalid");
    expect(restore.details?.group?.generations).toEqual({ inserted: 0, duplicate: 0, conflict: 0, failed: 0, invalid: 1, denied: 0 });
    // Every OTHER valid Group record (path/message/fanout/child conversation) still restored.
    expect(restore.details?.group?.paths.inserted).toBe(1);
    expect(receiver.groupGenerationPersistence.listGenerations(GROUP_ID).length).toBe(0);
  });

  it("3. changed manifest / corrupted ciphertext bytes fail closed exactly as the Direct archive's own matrix already establishes -- nothing new is written", async () => {
    const sharedBoundary = fakeRoundTrippingRuntimeBoundary();
    const sender = makeHarness({ boundary: sharedBoundary });
    const path = join(dir, "tampered-group.archive");
    await exportOnce(sender, path);

    const bytes = readFileSync(path);
    const tampered = new Uint8Array(bytes);
    tampered[tampered.length - 1] = tampered[tampered.length - 1]! ^ 0xff;
    writeFileSync(path, tampered);

    const receiver = makeHarness({ boundary: sharedBoundary });
    const restore = await receiver.runtime.restoreConversationArchive({ sourcePath: path, localAccountIndex: LOCAL_ACCOUNT_INDEX, counterpartyPublicKeyHex: COUNTERPARTY_PUBLIC_KEY_HEX, suite: "ChaCha20Poly1305" });
    expect(["failed", "integrity-failed"]).toContain(restore.outcome);
    expect(receiver.groupGenerationPersistence.listGenerations(GROUP_ID).length).toBe(0);
  });

  it("4. unrelated destination Group state remains unchanged after restoring an UNRELATED Group's archive (two-Group isolation)", async () => {
    const sharedBoundary = fakeRoundTrippingRuntimeBoundary();
    const sender = makeHarness({ boundary: sharedBoundary });
    seedGroup(sender, EXACT_MESSAGE);
    const path = join(dir, "isolation.archive");
    await sender.runtime.exportConversationArchive({ conversationId: GROUP_ID, destinationPath: path, localParticipant: LOCAL_PARTICIPANT, localAccountIndex: LOCAL_ACCOUNT_INDEX, counterpartyPublicKeyHex: COUNTERPARTY_PUBLIC_KEY_HEX, suite: "ChaCha20Poly1305" });

    const receiver = makeHarness({ boundary: sharedBoundary });
    const UNRELATED_GROUP_ID = "board-a::unrelated-group" as FedosConversationId;
    const unrelatedGenId = toFedosGroupGenerationId(UNRELATED_GROUP_ID, 0);
    receiver.groupGenerationPersistence.putGeneration({ groupConversationId: UNRELATED_GROUP_ID, generationId: unrelatedGenId, generationNumber: 0, activeMemberMembershipIds: [`${UNRELATED_GROUP_ID}::fedos::x`, `${UNRELATED_GROUP_ID}::fedos::y`].sort(), createdAt: 1_700_000_000, previousGenerationId: null });

    await receiver.runtime.restoreConversationArchive({ sourcePath: path, localAccountIndex: LOCAL_ACCOUNT_INDEX, counterpartyPublicKeyHex: COUNTERPARTY_PUBLIC_KEY_HEX, suite: "ChaCha20Poly1305" });

    expect(receiver.groupGenerationPersistence.listGenerations(UNRELATED_GROUP_ID).length).toBe(1); // untouched.
    expect(receiver.groupGenerationPersistence.listGenerations(GROUP_ID).length).toBe(1); // the restored Group's own state.
  });

  it("5. no plaintext/raw-secret persistence -- the on-disk Group archive never contains the plaintext payload bytes as a substring", async () => {
    const h = makeHarness();
    const path = join(dir, "opaque-group.archive");
    await exportOnce(h, path);
    const raw = readFileSync(path, "latin1") as string;
    expect(raw).not.toContain("Group secret payload");
  });
});

describe("Secure Runtime Alpha 1921-1980 -- Group Archive Runtime lifecycle (fail closed after stop)", () => {
  it("1. every operation fails closed once isRuntimeRunning() reports false, even with group ports configured", async () => {
    const h = makeHarness();
    seedGroup(h, EXACT_MESSAGE);
    h.stopped = true;
    const exportResult = await h.runtime.exportConversationArchive({ conversationId: GROUP_ID, destinationPath: join(dir, "after-stop-group.archive"), localParticipant: LOCAL_PARTICIPANT, localAccountIndex: LOCAL_ACCOUNT_INDEX, counterpartyPublicKeyHex: COUNTERPARTY_PUBLIC_KEY_HEX, suite: "ChaCha20Poly1305" });
    expect(exportResult).toEqual({ outcome: "failed" });
  });
});
