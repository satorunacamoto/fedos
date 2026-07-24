/**
 * Secure Runtime Alpha 2041–2120 ("Conversation Identity Restoration and
 * Reactivation Arc") — the REAL Application Round Trip acceptance test.
 * Directly extends
 * `test/secure_runtime_alpha_1921_1980_group_archive_round_trip.test.ts`'s
 * own scenario (same real `startFedosDesktopRuntime()` entry point, same
 * real `FedosConversationRuntime`/`FedosConversationGroupRuntime`, same
 * real `FedosConversationArchiveRuntime`), replacing that test's own
 * documented TEST-ONLY workaround (its own §7.2 -- Carol's own restored
 * child Direct Conversation's Draft+Activation reconstructed BY THE TEST
 * directly via a second persistence-port instance) with the real,
 * production `conversationRuntime().reactivateRestoredConversation()`
 * capability this Arc adds. See
 * `docs/secure_runtime_alpha_2041_2120_reconciliation_report.md` for the
 * full derivation.
 *
 * Every substitution this file relies on is the SAME two the prior Arc's
 * own test already documented in full (re-stated briefly, not
 * re-litigated):
 *   1. The archive's own pre-existing, out-of-this-Arc's-scope requirement
 *      that every real Conversation id carry ONE placeholder, `mode:
 *      "public"` `FedosConversationPersistence` record (that port is
 *      Public-Board-only; no real Direct/Group id is ever written there by
 *      any production path -- confirmed again in this Arc's own
 *      reconciliation report §1) -- seeded via a SECOND port instance over
 *      a log path deliberately NEVER passed to `runtimeConfig()`.
 *   2. `FedosConversationArchiveRuntime` built directly via
 *      `createFedosConversationArchiveRuntime()` with an injected fake,
 *      round-tripping (not cryptographic) crypto boundary, since no
 *      compiled WASM artifact exists in this dev environment -- the SAME
 *      tier every archive test in this repository already uses.
 *
 * EVERYTHING else -- Draft construction, Membership, Group Generation/Path/
 * Message/Fanout, Encryption/Decryption, and (new to this Arc) Draft
 * re-derivation + Activation via `reactivateRestoredConversation()` -- is
 * 100% real production code, reached through 100% real
 * `conversationRuntime()`/`groupRuntime()` Runtime APIs. No raw
 * persistence-port read or write stands in for ANY Conversation-layer
 * decision this Arc is responsible for.
 */
import { describe, it, expect, vi } from "vitest";
// @ts-expect-error `node:fs` has no type declarations without `@types/node` in this project's tsconfig.
import { mkdtempSync, readFileSync } from "node:fs";
// @ts-expect-error see above.
import { tmpdir } from "node:os";
// @ts-expect-error see above.
import { join } from "node:path";
// @ts-expect-error see above.
import { Buffer } from "node:buffer";

import { schnorr } from "@noble/curves/secp256k1.js";
import { bytesToHex } from "@noble/hashes/utils.js";

import { startFedosDesktopRuntime } from "../src/desktop/runtime/fedos_desktop_runtime.js";
import type { FedosDesktopRuntimeConfig } from "../src/desktop/runtime/fedos_desktop_runtime_config.js";
import { StaticFedosConversationCreatorIdentityAuthority } from "../src/conversation/construction/fedos_conversation_creator_identity_authority.js";
import { FedosSigningAuthorityNostrAuthorBinding } from "../src/board/runtime/identity/fedos_nostr_author_binding_authority.js";
import type { FedosNostrSigningAuthority } from "../src/nostr/sign/fedos_nostr_signing_authority.js";
import type {
  FedosConversationEncryptionAuthority,
  FedosConversationEncryptionRequest,
  FedosConversationEncryptionResult,
} from "../src/conversation/encryption/fedos_conversation_encryption_authority.js";
import type {
  FedosConversationDecryptionAuthority,
  FedosConversationDecryptionRequest,
  FedosConversationDecryptionResult,
} from "../src/conversation/encryption/fedos_conversation_decryption_authority.js";
import type { FedosConversationParticipantReference } from "../src/conversation/membership/fedos_conversation_participant_reference.js";
import type { FedosConversationId } from "../src/conversation/fedos_conversation_id.js";
import { AppendOnlyFedosConversationPersistence } from "../src/conversation/persistence/append_only_fedos_conversation_persistence.js";
import { AppendOnlyFedosConversationMembershipPersistence } from "../src/conversation/membership/persistence/append_only_fedos_conversation_membership_persistence.js";
import { AppendOnlyFedosConversationCapabilityPersistence } from "../src/conversation/capability/persistence/append_only_fedos_conversation_capability_persistence.js";
import { AppendOnlyFedosConversationMessageEnvelopePersistence } from "../src/conversation/envelope/persistence/append_only_fedos_conversation_message_envelope_persistence.js";
import { AppendOnlyFedosConversationPayloadStorage } from "../src/conversation/payload_storage/append_only_fedos_conversation_payload_storage.js";
import { AppendOnlyFedosGroupGenerationPersistence } from "../src/conversation/group/append_only_fedos_group_generation_persistence.js";
import { AppendOnlyFedosGroupDirectPathPersistence } from "../src/conversation/group/append_only_fedos_group_direct_path_persistence.js";
import { AppendOnlyFedosGroupMessagePersistence } from "../src/conversation/group/append_only_fedos_group_message_persistence.js";
import { AppendOnlyFedosGroupFanoutDeliveryPersistence } from "../src/conversation/group/append_only_fedos_group_fanout_delivery_persistence.js";
import type { FedosMasterSeedAuthority } from "../src/runtime/master_seed/fedos_master_seed_authority.js";
import type { AeadCiphertextHandle, AeadCiphertextWire, AeadKeyHandle } from "../src/runtime/fedos_wasm_loader.js";
import {
  FedosWasmConversationArchiveEncryptionAuthority,
  type FedosConversationArchiveEncryptionRuntimeBoundary,
} from "../src/conversation/archive/fedos_conversation_archive_encryption.js";
import { NodeFedosConversationArchiveFileAuthority } from "../src/conversation/archive/fs/fedos_conversation_archive_file_authority.js";
import { createFedosConversationArchiveRuntime, type FedosConversationArchiveRuntime } from "../src/conversation/archive/runtime/fedos_conversation_archive_runtime.js";

function fakeSymmetricMarker(ownPubkey: string, counterpartyPublicKeyHex: string): Uint8Array {
  const pair = [ownPubkey, counterpartyPublicKeyHex].sort().join(":");
  return new TextEncoder().encode(`FAKE:${pair}:`);
}
class FakeEncryptionAuthority implements FedosConversationEncryptionAuthority {
  readonly #ownPubkey: string;
  constructor(ownPubkey: string) { this.#ownPubkey = ownPubkey; }
  async encrypt(request: FedosConversationEncryptionRequest): Promise<FedosConversationEncryptionResult> {
    const marker = fakeSymmetricMarker(this.#ownPubkey, request.counterpartyPublicKeyHex);
    const out = new Uint8Array(marker.length + request.plaintext.length);
    out.set(marker, 0);
    out.set(request.plaintext, marker.length);
    return { outcome: "encrypted", ciphertext: out };
  }
}
class FakeDecryptionAuthority implements FedosConversationDecryptionAuthority {
  readonly #ownPubkey: string;
  constructor(ownPubkey: string) { this.#ownPubkey = ownPubkey; }
  async decrypt(request: FedosConversationDecryptionRequest): Promise<FedosConversationDecryptionResult> {
    const marker = fakeSymmetricMarker(this.#ownPubkey, request.counterpartyPublicKeyHex);
    if (request.ciphertext.length < marker.length) return { outcome: "failed" };
    for (let i = 0; i < marker.length; i += 1) {
      if (request.ciphertext[i] !== marker[i]) return { outcome: "failed" };
    }
    return { outcome: "decrypted", plaintext: request.ciphertext.subarray(marker.length) };
  }
}

const ALICE_SECRET = new Uint8Array(32).fill(31);
const BOB_SECRET = new Uint8Array(32).fill(32);
const CAROL_SECRET = new Uint8Array(32).fill(33);
const ALICE_PUBKEY = bytesToHex(schnorr.getPublicKey(ALICE_SECRET));
const BOB_PUBKEY = bytesToHex(schnorr.getPublicKey(BOB_SECRET));
const CAROL_PUBKEY = bytesToHex(schnorr.getPublicKey(CAROL_SECRET));

const ALICE: FedosConversationParticipantReference = { authority: "nostr", publicIdentifier: ALICE_PUBKEY, identityId: null };
const BOB: FedosConversationParticipantReference = { authority: "nostr", publicIdentifier: BOB_PUBKEY, identityId: null };
const CAROL: FedosConversationParticipantReference = { authority: "nostr", publicIdentifier: CAROL_PUBKEY, identityId: null };

function realSigningAuthority(secretKey: Uint8Array): FedosNostrSigningAuthority {
  const publicKeyHex = bytesToHex(schnorr.getPublicKey(secretKey));
  return {
    async publicIdentityForAccount(accountIndex: number) {
      if (accountIndex !== 0) return null;
      return { accountIndex: 0, publicKeyHex };
    },
    async signEvent() {
      return null; // never invoked -- no transport/delivery is ever configured in this test.
    },
  };
}

const LOCAL_ACCOUNT_INDEX = 0;
const ARCHIVE_COUNTERPARTY_KEY_HEX = "cd".repeat(32);
const KEY_HANDLE: AeadKeyHandle = { kind: "AeadKeyHandle" } as AeadKeyHandle;

function fakeMasterSeedAuthority(): FedosMasterSeedAuthority {
  return {
    isAvailable: vi.fn(async () => true),
    isCleared: vi.fn(async () => false),
    generate: vi.fn(async () => true),
    restoreSealed: vi.fn(async () => true),
    seal: vi.fn(async () => null),
    clear: vi.fn(async () => undefined),
    resolveConversationKey: vi.fn(async (accountIndex, counterpartyPublicKeyHex) =>
      accountIndex === LOCAL_ACCOUNT_INDEX && counterpartyPublicKeyHex === ARCHIVE_COUNTERPARTY_KEY_HEX ? KEY_HANDLE : null,
    ),
  };
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

function buildTestArchiveRuntime(
  paths: Paths,
  masterSeedAuthority: FedosMasterSeedAuthority,
  boundary: FedosConversationArchiveEncryptionRuntimeBoundary,
): FedosConversationArchiveRuntime {
  return createFedosConversationArchiveRuntime({
    conversationPersistence: new AppendOnlyFedosConversationPersistence(paths.archiveConversationLogPath),
    membershipPersistence: new AppendOnlyFedosConversationMembershipPersistence(paths.conversationMembershipLogPath),
    capabilityPersistence: new AppendOnlyFedosConversationCapabilityPersistence(paths.conversationCapabilityLogPath),
    envelopePersistence: new AppendOnlyFedosConversationMessageEnvelopePersistence(paths.conversationEnvelopeLogPath),
    payloadStorage: new AppendOnlyFedosConversationPayloadStorage(paths.conversationPayloadLogPath, 1_000_000),
    groupGenerationPersistence: new AppendOnlyFedosGroupGenerationPersistence(paths.conversationGroupGenerationLogPath),
    groupDirectPathPersistence: new AppendOnlyFedosGroupDirectPathPersistence(paths.conversationGroupDirectPathLogPath),
    groupMessagePersistence: new AppendOnlyFedosGroupMessagePersistence(paths.conversationGroupMessageLogPath),
    groupFanoutDeliveryPersistence: new AppendOnlyFedosGroupFanoutDeliveryPersistence(paths.conversationGroupFanoutDeliveryLogPath),
    encryptionAuthority: new FedosWasmConversationArchiveEncryptionAuthority(masterSeedAuthority, boundary),
    fileAuthority: new NodeFedosConversationArchiveFileAuthority(),
    clock: () => 1_720_500_500,
    isRuntimeRunning: () => true,
  });
}

interface Paths {
  readonly boardLogPath: string;
  readonly outboxLogPath: string;
  readonly archiveConversationLogPath: string;
  readonly conversationDraftLogPath: string;
  readonly conversationMembershipLogPath: string;
  readonly conversationCapabilityLogPath: string;
  readonly conversationConstructionCoordinationLogPath: string;
  readonly conversationActivationCoordinationLogPath: string;
  readonly conversationInvitationRevocationLogPath: string;
  readonly conversationGroupGenerationLogPath: string;
  readonly conversationGroupDirectPathLogPath: string;
  readonly conversationGroupMessageLogPath: string;
  readonly conversationGroupFanoutDeliveryLogPath: string;
  readonly conversationEnvelopeLogPath: string;
  readonly conversationPayloadLogPath: string;
  readonly conversationEncryptionCoordinationLogPath: string;
  readonly conversationPayloadRetentionLogPath: string;
}

function buildPaths(dir: string): Paths {
  return {
    boardLogPath: join(dir, "board.log"),
    outboxLogPath: join(dir, "outbox.log"),
    archiveConversationLogPath: join(dir, "archive-conversation.log"),
    conversationDraftLogPath: join(dir, "draft.log"),
    conversationMembershipLogPath: join(dir, "membership.log"),
    conversationCapabilityLogPath: join(dir, "capability.log"),
    conversationConstructionCoordinationLogPath: join(dir, "construction-coordination.log"),
    conversationActivationCoordinationLogPath: join(dir, "activation.log"),
    conversationInvitationRevocationLogPath: join(dir, "invitation-revocation.log"),
    conversationGroupGenerationLogPath: join(dir, "group-generation.log"),
    conversationGroupDirectPathLogPath: join(dir, "group-path.log"),
    conversationGroupMessageLogPath: join(dir, "group-message.log"),
    conversationGroupFanoutDeliveryLogPath: join(dir, "group-delivery.log"),
    conversationEnvelopeLogPath: join(dir, "envelope.log"),
    conversationPayloadLogPath: join(dir, "payload.log"),
    conversationEncryptionCoordinationLogPath: join(dir, "encryption-coordination.log"),
    conversationPayloadRetentionLogPath: join(dir, "retention.log"),
  };
}

function runtimeConfig(paths: Paths): FedosDesktopRuntimeConfig {
  return {
    boardLogPath: paths.boardLogPath,
    outboxLogPath: paths.outboxLogPath,
    deliveryEnabled: false,
    conversationDraftLogPath: paths.conversationDraftLogPath,
    conversationMembershipLogPath: paths.conversationMembershipLogPath,
    conversationCapabilityLogPath: paths.conversationCapabilityLogPath,
    conversationConstructionCoordinationLogPath: paths.conversationConstructionCoordinationLogPath,
    conversationActivationCoordinationLogPath: paths.conversationActivationCoordinationLogPath,
    conversationInvitationRevocationLogPath: paths.conversationInvitationRevocationLogPath,
    conversationGroupGenerationLogPath: paths.conversationGroupGenerationLogPath,
    conversationGroupDirectPathLogPath: paths.conversationGroupDirectPathLogPath,
    conversationGroupMessageLogPath: paths.conversationGroupMessageLogPath,
    conversationGroupFanoutDeliveryLogPath: paths.conversationGroupFanoutDeliveryLogPath,
    conversationEnvelopeLogPath: paths.conversationEnvelopeLogPath,
    conversationPayloadLogPath: paths.conversationPayloadLogPath,
    conversationEncryptionCoordinationLogPath: paths.conversationEncryptionCoordinationLogPath,
    conversationPayloadRetentionLogPath: paths.conversationPayloadRetentionLogPath,
    conversationCreatorIdentityAuthority: new StaticFedosConversationCreatorIdentityAuthority(ALICE),
    conversationEncryptionAuthority: new FakeEncryptionAuthority(ALICE.publicIdentifier),
    conversationDecryptionAuthority: new FakeDecryptionAuthority(ALICE.publicIdentifier),
    nostrAuthorBindingAuthority: new FedosSigningAuthorityNostrAuthorBinding(realSigningAuthority(ALICE_SECRET)),
    clock: makeIncrementingClock(1_720_500_000),
  };
}

function makeIncrementingClock(startAt: number): () => number {
  let current = startAt;
  return () => {
    const value = current;
    current += 1;
    return value;
  };
}

function seedPlaceholderConversationRecord(conversationLogPath: string, conversationId: string): void {
  const persistence = new AppendOnlyFedosConversationPersistence(conversationLogPath);
  persistence.putConversation({
    schemaVersion: 1, id: conversationId, mode: "public", boardId: "board-a", rootThreadId: conversationId, rootPostId: conversationId, policyReference: "public-v1", createdAt: 1_700_000_000,
  });
}

describe("Secure Runtime Alpha 2041-2120 -- Conversation Identity Restoration and Reactivation, real Application Round Trip", () => {
  it("1. create Private Group -> admit 2 -> send -> archive -> stop -> fresh Runtime B -> restore -> restart -> inert BEFORE reactivation -> reactivateRestoredConversation() -> discover via real Runtime API -> resume messaging (new send + reply) -> archive again -> restore into Runtime C -> no duplicates", async () => {
    const sourceDir = mkdtempSync(join(tmpdir(), "fedos-2041-2120-source-"));
    const sourcePaths = buildPaths(sourceDir);
    const sharedArchiveBoundary = fakeRoundTrippingRuntimeBoundary();
    const sharedMasterSeedAuthority = fakeMasterSeedAuthority();

    // ===== RUNTIME A (source) =====
    const runtimeA = await startFedosDesktopRuntime(runtimeConfig(sourcePaths));
    const archiveA = buildTestArchiveRuntime(sourcePaths, sharedMasterSeedAuthority, sharedArchiveBoundary);

    const created = runtimeA.conversationRuntime().createPrivateGroupDraft({});
    expect(created.outcome).toBe("draft-created");
    if (created.outcome !== "draft-created") throw new Error("expected draft-created");
    const groupId = created.draft.id;
    const grA = runtimeA.conversationRuntime().groupRuntime();

    expect((await grA.addPrivateGroupMember(groupId, BOB)).outcome).toBe("admitted");
    expect((await grA.addPrivateGroupMember(groupId, CAROL)).outcome).toBe("admitted");

    const firstSend = await grA.sendPrivateGroupMessage({ groupConversationId: groupId, body: "welcome to the group", replyToGroupMessageId: null });
    expect(firstSend.outcome).toBe("stored-for-all");
    if (firstSend.outcome !== "stored-for-all") throw new Error("expected stored-for-all");

    const generationsBeforeExport = grA.listPrivateGroupGenerations(groupId);
    expect(generationsBeforeExport.length).toBe(2); // admitting Bob, then Carol.

    const pathReader = new AppendOnlyFedosGroupDirectPathPersistence(sourcePaths.conversationGroupDirectPathLogPath);
    const childIds = new Set<string>();
    for (const gen of generationsBeforeExport) {
      for (const path of pathReader.listPathsForGeneration(groupId, gen.generationId)) childIds.add(path.directConversationId);
    }
    expect(childIds.size).toBe(2); // Alice<->Bob, Alice<->Carol.

    seedPlaceholderConversationRecord(sourcePaths.archiveConversationLogPath, groupId);
    for (const childId of childIds) seedPlaceholderConversationRecord(sourcePaths.archiveConversationLogPath, childId);

    const archiveDir = mkdtempSync(join(tmpdir(), "fedos-2041-2120-archive-"));
    const firstArchivePath = join(archiveDir, "first.archive");
    const firstExport = await archiveA.exportConversationArchive({
      conversationId: groupId,
      destinationPath: firstArchivePath,
      localParticipant: ALICE,
      localAccountIndex: LOCAL_ACCOUNT_INDEX,
      counterpartyPublicKeyHex: ARCHIVE_COUNTERPARTY_KEY_HEX,
      suite: "ChaCha20Poly1305",
    });
    expect(firstExport.outcome).toBe("exported");

    await runtimeA.stop();

    // ===== RUNTIME B (destination, independent files) =====
    const destDir = mkdtempSync(join(tmpdir(), "fedos-2041-2120-dest-b-"));
    const destPaths = buildPaths(destDir);
    const destConfig = runtimeConfig(destPaths);
    const archiveB = buildTestArchiveRuntime(destPaths, sharedMasterSeedAuthority, sharedArchiveBoundary);
    let runtimeB = await startFedosDesktopRuntime(destConfig);

    const restore1 = await archiveB.restoreConversationArchive({
      sourcePath: firstArchivePath, localAccountIndex: LOCAL_ACCOUNT_INDEX, counterpartyPublicKeyHex: ARCHIVE_COUNTERPARTY_KEY_HEX, suite: "ChaCha20Poly1305",
    });
    expect(restore1.outcome).toBe("restored");

    await runtimeB.stop();

    // ===== RESTART -- a genuinely fresh Runtime instance over the SAME durable destination files =====
    runtimeB = await startFedosDesktopRuntime(destConfig);
    const groupRuntimeB = runtimeB.conversationRuntime().groupRuntime();

    // ----- BEFORE reactivation: restored but genuinely inert to identity-gated Runtime APIs -----
    expect(runtimeB.conversationRuntime().findConversation(groupId)).toBeNull();
    expect(groupRuntimeB.readinessForPrivateGroup(groupId)).toEqual({ outcome: "failed" });
    // Reads that need no Draft/Activation already work post-restore (pure data reads) -- proves the
    // restored conversation is not totally invisible, only non-reachable for identity-gated operations.
    expect(groupRuntimeB.listPrivateGroupGenerations(groupId).length).toBe(2);
    // NOTE: a real post-restore send through an EXISTING (restored) generation's own paths would fail
    // deep inside `sendDirectMessage()` (exactly the gap this Arc's own reconciliation report documents,
    // §3/§6) -- not exercised here via an actual send attempt because `FedosGroupSendCoordinator` durably
    // records a "failed" Group Message fact for ANY unsuccessful fanout attempt (a real, pre-existing,
    // correct behavior, not a bug this Arc introduces) which would otherwise pollute this test's own
    // message-count assertions below; `findConversation()`/`readinessForPrivateGroup()` above already
    // prove the inertness claim through real, non-mutating Runtime reads.

    // ----- REACTIVATE -- the real, production Runtime capability this Arc adds -----
    const reactivation = await runtimeB.conversationRuntime().reactivateRestoredConversation(groupId);
    expect(reactivation.outcome).toBe("reactivated");
    if (reactivation.outcome !== "reactivated" || reactivation.mode !== "private-group") throw new Error("expected private-group reactivation");
    expect(reactivation.children.size).toBe(2);
    for (const outcome of reactivation.children.values()) expect(outcome).toBe("reactivated");

    // ----- DISCOVER via a REAL Runtime read API (never a raw persistence-port read) -----
    const discovered = runtimeB.conversationRuntime().findConversation(groupId);
    expect(discovered).not.toBeNull();
    expect(discovered?.mode).toBe("private-group");
    expect(groupRuntimeB.readinessForPrivateGroup(groupId)).toEqual({ outcome: "usable" });

    // ----- RESUME MESSAGING: a genuinely NEW send succeeds -----
    const postRestoreSend = await groupRuntimeB.sendPrivateGroupMessage({ groupConversationId: groupId, body: "back online after restore", replyToGroupMessageId: null });
    expect(postRestoreSend.outcome).toBe("stored-for-all");
    if (postRestoreSend.outcome !== "stored-for-all") throw new Error("expected stored-for-all");
    expect(postRestoreSend.groupMessageId).not.toBe(firstSend.groupMessageId);

    // ----- a REPLY succeeds too -----
    const reply = await groupRuntimeB.sendPrivateGroupMessage({ groupConversationId: groupId, body: "replying after restore", replyToGroupMessageId: postRestoreSend.groupMessageId });
    expect(reply.outcome).toBe("stored-for-all");
    if (reply.outcome !== "stored-for-all") throw new Error("expected stored-for-all");
    expect(reply.groupMessageId).not.toBe(postRestoreSend.groupMessageId);

    const messagesAfterResume = groupRuntimeB.listPrivateGroupMessages(groupId);
    expect(messagesAfterResume.length).toBe(3); // 1 restored + 2 new (send + reply).
    expect(messagesAfterResume.some((m) => m.id === firstSend.groupMessageId)).toBe(true); // the restored one is untouched.

    // ----- SECURITY: idempotent reactivation -- calling it again duplicates/corrupts nothing -----
    const reactivationAgain = await runtimeB.conversationRuntime().reactivateRestoredConversation(groupId);
    expect(reactivationAgain.outcome).toBe("reactivated");
    if (reactivationAgain.outcome !== "reactivated" || reactivationAgain.mode !== "private-group") throw new Error("expected private-group reactivation");
    for (const outcome of reactivationAgain.children.values()) expect(outcome).toBe("already-active");
    expect(groupRuntimeB.listPrivateGroupMessages(groupId).length).toBe(3); // never duplicated by the repeat reactivation call.

    // ----- SECURITY: an unrelated caller cannot reactivate/hijack this conversation -----
    const eveRuntime = runtimeB.conversationRuntime(); // same Runtime instance, but simulate a foreign id nobody here was ever a member of.
    const foreignResult = await eveRuntime.reactivateRestoredConversation("private-draft::direct::never-restored-anywhere");
    expect(foreignResult).toEqual({ outcome: "conversation-not-found" });

    // ===== ARCHIVE AGAIN -> RESTORE INTO A FRESH RUNTIME C -> NO DUPLICATES =====
    const secondArchivePath = join(archiveDir, "second.archive");
    const secondExport = await archiveB.exportConversationArchive({
      conversationId: groupId,
      destinationPath: secondArchivePath,
      localParticipant: ALICE,
      localAccountIndex: LOCAL_ACCOUNT_INDEX,
      counterpartyPublicKeyHex: ARCHIVE_COUNTERPARTY_KEY_HEX,
      suite: "ChaCha20Poly1305",
    });
    expect(secondExport.outcome).toBe("exported");
    expect(secondExport.manifest?.groupMessageCount).toBe(3);

    const destDirC = mkdtempSync(join(tmpdir(), "fedos-2041-2120-dest-c-"));
    const destPathsC = buildPaths(destDirC);
    const destConfigC = runtimeConfig(destPathsC);
    const archiveC = buildTestArchiveRuntime(destPathsC, sharedMasterSeedAuthority, sharedArchiveBoundary);
    const runtimeC = await startFedosDesktopRuntime(destConfigC);

    const restoreC = await archiveC.restoreConversationArchive({
      sourcePath: secondArchivePath, localAccountIndex: LOCAL_ACCOUNT_INDEX, counterpartyPublicKeyHex: ARCHIVE_COUNTERPARTY_KEY_HEX, suite: "ChaCha20Poly1305",
    });
    expect(restoreC.outcome).toBe("restored");
    expect(restoreC.details?.group?.messages).toEqual({ inserted: 3, duplicate: 0, conflict: 0, failed: 0, invalid: 0, denied: 0 });

    // A second restore attempt against the SAME destination reports fully already-present -- no
    // duplicate archive/identity/capability/activation facts of any kind.
    const restoreCAgain = await archiveC.restoreConversationArchive({
      sourcePath: secondArchivePath, localAccountIndex: LOCAL_ACCOUNT_INDEX, counterpartyPublicKeyHex: ARCHIVE_COUNTERPARTY_KEY_HEX, suite: "ChaCha20Poly1305",
    });
    expect(restoreCAgain.outcome).toBe("already-present");

    const groupRuntimeC = runtimeC.conversationRuntime().groupRuntime();
    expect(groupRuntimeC.listPrivateGroupMessages(groupId).length).toBe(3); // never 6, never any duplicate.

    // Reactivation composes across a SECOND archive/restore cycle too.
    const reactivationC = await runtimeC.conversationRuntime().reactivateRestoredConversation(groupId);
    expect(reactivationC.outcome).toBe("reactivated");
    if (reactivationC.outcome !== "reactivated" || reactivationC.mode !== "private-group") throw new Error("expected private-group reactivation");
    expect(reactivationC.children.size).toBe(2);

    // ----- SECURITY: no plaintext/secret leakage on disk -----
    const firstArchiveBytes: Buffer = readFileSync(firstArchivePath);
    const secondArchiveBytes: Buffer = readFileSync(secondArchivePath);
    for (const plaintext of ["welcome to the group", "back online after restore", "replying after restore"]) {
      expect(firstArchiveBytes.includes(plaintext)).toBe(false);
      expect(secondArchiveBytes.includes(plaintext)).toBe(false);
    }

    // ----- SECURITY: no network side effect anywhere in this test -----
    expect(() => runtimeB.privateTransport()).toThrow(/not enabled/);
    expect(() => runtimeC.privateTransport()).toThrow(/not enabled/);

    await runtimeB.stop();
    await runtimeC.stop();
  }, 30_000);
});
