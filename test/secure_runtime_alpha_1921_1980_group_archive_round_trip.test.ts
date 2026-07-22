/**
 * Secure Runtime Alpha 1921–1980 ("Group Conversation Archive Integration
 * and Cross-Branch Recovery Arc") — Phase G: the REAL Application Round
 * Trip acceptance-bar test. Uses the real `startFedosDesktopRuntime()`
 * entry point, the real `FedosConversationRuntime`/`FedosConversationGroupRuntime`
 * (`createPrivateGroupDraft`, `addPrivateGroupMember`, `sendPrivateGroupMessage`,
 * `removePrivateGroupMember`), and the real `FedosConversationArchiveRuntime`
 * (`exportConversationArchive`/`inspectConversationArchive`/`preflightRestore`/
 * `restoreConversationArchive`) — not synthetic persistence fixtures.
 *
 * ONE DOCUMENTED, NARROW SUBSTITUTION, re-verified against real source
 * (see `test/secure_runtime_alpha_1921_1980_group_archive_collector_restore.test.ts`'s
 * own header for the full finding): a real `private-group`/`direct`
 * Conversation is NEVER written into `FedosConversationPersistence` by
 * ANY real production code path in this codebase (that port exists ONLY
 * for PUBLIC, Board-thread-anchored Conversations — `fedos_conversation_active_lookup.ts`'s
 * own header: a private Conversation's "is it active" fact lives
 * entirely in `FedosConversationDraftPersistence` + `FedosConversationActivationPersistence`).
 * This is a PRE-EXISTING gap in the Direct Archive Foundation/Runtime
 * (Alpha 1541–1610/1691–1760) this Arc does not introduce and, per this
 * Arc's own "extend don't redesign, never broaden scope" rule, does not
 * redesign (that would mean reworking Alpha 748's own frozen Public-only
 * Conversation Record validator, a Direct-domain concern this Arc has no
 * mandate to touch). `startFedosDesktopRuntime()` itself never exposes
 * its own internal `FedosConversationPersistence` instance to a caller
 * (by design — "never exposes a persistence port... or any Host
 * internal"), so this test seeds the ONE placeholder record each real
 * Conversation id needs (the Group's own id, plus each child Direct id)
 * via a SECOND `AppendOnlyFedosConversationPersistence` instance pointed
 * at the SAME durable `conversationLogPath` the running Runtime already
 * uses internally — the SAME "two port instances share one durable
 * log file" pattern this codebase already relies on everywhere (e.g.
 * `conversationArchiveMembershipPersistence` in `fedos_desktop_runtime.ts`
 * itself). Every OTHER fact in this test (generations, paths, messages,
 * fanout deliveries, memberships, envelopes, payloads) flows through
 * 100% real production APIs.
 *
 * Message-level encryption uses the SAME Fake marker-based
 * Encryption/Decryption Authority `test/secure_runtime_alpha_1391_1470_group_delivery_vertical_slice.test.ts`
 * already established (a real, compiled WASM artifact is not available
 * in this environment) — the ARCHIVE's own encryption uses the REAL
 * `FedosWasmConversationArchiveEncryptionAuthority` class over a fake,
 * round-tripping (not cryptographic) Runtime boundary, mirroring
 * `test/secure_runtime_alpha_1691_1760_archive_runtime.test.ts`'s own
 * documented "development-Runtime" tier.
 *
 * No transport/delivery of any kind is ever configured in this test
 * (`deliveryEnabled: false`, `privateTransportEnabled` omitted, no
 * publisher/relay of any kind supplied) — there is therefore structurally
 * NOTHING that could publish/subscribe/enqueue/retry over the network,
 * during export, restore, or otherwise.
 *
 * SECOND DOCUMENTED SUBSTITUTION: `startFedosDesktopRuntime()`'s own
 * `archiveEnabled` wiring (`fedos_desktop_runtime.ts`) constructs its
 * `FedosConversationArchiveRuntime` over the REAL, default
 * `fedosConversationArchiveEncryptionRuntimeBoundary` (real compiled-WASM
 * AEAD) — `FedosDesktopRuntimeConfig` exposes no override slot for a test
 * boundary (unlike `FedosConversationArchiveRuntimeAssemblyConfig`
 * itself, which already documents `fileAuthority`/`encryptionRuntimeBoundary`
 * as "Optional, testability only"). No compiled WASM artifact exists in
 * this worktree (the Phase A/B reconciliation report's own §0.3 baseline
 * already documents ~90 pre-existing `artifact-missing` test failures for
 * this exact reason), so this test builds its OWN `FedosConversationArchiveRuntime`
 * directly via `createFedosConversationArchiveRuntime()` — the SAME
 * production class `runtime.conversationArchiveRuntime()` itself returns,
 * exercising 100% the same real Collector/Restore/Duplicate-Detection
 * business logic — wired over a SECOND set of port instances pointed at
 * the EXACT SAME durable log files the running `startFedosDesktopRuntime()`
 * instance already reads/writes (the SAME "two port instances share one
 * durable log file" pattern used throughout this file and this codebase
 * generally), with the SAME fake, round-tripping (not cryptographic)
 * crypto boundary `test/secure_runtime_alpha_1691_1760_archive_runtime.test.ts`
 * already established. Every Group/Conversation-layer fact this test
 * observes (generations, paths, messages, fanout deliveries, memberships,
 * envelopes, payloads) was produced ENTIRELY by the real, running
 * `startFedosDesktopRuntime()` instance's own real application APIs; only
 * the ARCHIVE crypto TIER is substituted, identically to every other
 * archive test in this repository.
 */
import { describe, it, expect, vi } from "vitest";
// @ts-expect-error `node:fs` has no type declarations without `@types/node` in this project's tsconfig.
import { mkdtempSync } from "node:fs";
// @ts-expect-error see above.
import { tmpdir } from "node:os";
// @ts-expect-error see above.
import { join } from "node:path";

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
import { AppendOnlyFedosConversationDraftPersistence } from "../src/conversation/construction/append_only_fedos_conversation_draft_persistence.js";
import { AppendOnlyFedosConversationActivationPersistence } from "../src/conversation/activation/append_only_fedos_conversation_activation_persistence.js";
import { fedosConversationActivationId } from "../src/conversation/activation/fedos_persisted_conversation_activation_v1.js";

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

// Secure Runtime Alpha 1338 -- a Group Direct Path can only ever reach "ready" for a counterparty
// whose own participant `authority` is `"nostr"` (a path never bridges other identity domains) --
// mirrors `test/secure_runtime_alpha_1391_1470_group_delivery_vertical_slice.test.ts`'s own real
// secp256k1 keys/participant references exactly, for the SAME reason.
const ALICE_SECRET = new Uint8Array(32).fill(21);
const BOB_SECRET = new Uint8Array(32).fill(22);
const CAROL_SECRET = new Uint8Array(32).fill(23);
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
      // Never actually called in this test -- no transport/delivery is ever configured (see this
      // file's own header), so nothing ever asks this authority to sign a wire event. Present only
      // because `nostrAuthorBindingAuthority` needs a `FedosNostrSigningAuthority` to resolve THIS
      // Runtime's own local "nostr" identity for Group Direct Path establishment (Alpha 1338).
      return null;
    },
  };
}

const LOCAL_ACCOUNT_INDEX = 0;
const ARCHIVE_COUNTERPARTY_KEY_HEX = "ab".repeat(32); // the archive's OWN wrapping-key discriminator -- see FedosConversationArchiveExportRequest's own header for why this need not be a real Direct counterparty.
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

/** Mirrors `test/secure_runtime_alpha_1691_1760_archive_runtime.test.ts`'s own fake -- a REAL in-memory round trip standing in for compiled WASM AEAD, shared between the "source" and "destination" sides of this test so a ciphertext encrypted by one is genuinely decryptable by the other (exactly like a real WASM boundary would be, given the SAME resolved key). */
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

/**
 * Builds a `FedosConversationArchiveRuntime` -- the SAME production class
 * `startFedosDesktopRuntime()`'s own `conversationArchiveRuntime()`
 * returns -- over a SECOND set of port instances pointed at the exact
 * SAME durable log files a running Runtime configured with `paths`
 * already reads/writes, with the injected fake crypto boundary/master
 * seed authority in place of the real (WASM-artifact-unavailable) default.
 * See this file's own header, "SECOND DOCUMENTED SUBSTITUTION".
 */
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
    clock: () => 1_718_000_500,
    isRuntimeRunning: () => true,
  });
}

interface Paths {
  readonly boardLogPath: string;
  readonly outboxLogPath: string;
  /**
   * Dedicated to the ARCHIVE's own synthetic placeholder "conversation"
   * record domain ONLY (see this file's own header, "ONE DOCUMENTED,
   * NARROW SUBSTITUTION") -- deliberately NEVER passed to
   * `runtimeConfig()`/`startFedosDesktopRuntime()` itself. That entry
   * point's OWN `conversationLogPath` (when supplied) is cross-validated
   * against real Board-hydrated state on EVERY start
   * (`hydrateFedosConversations()`) and would reject a synthetic
   * "public"-mode placeholder for a non-existent Board thread with
   * `"rejected-root-mismatch"` -- keeping this on a SEPARATE file used
   * ONLY by this test's own `buildTestArchiveRuntime()` avoids that
   * entirely, and leaves `startFedosDesktopRuntime()`'s own Board
   * hydration untouched (this test never creates a Board thread, so that
   * hydration trivially succeeds against an empty in-memory Conversation
   * Persistence every time).
   */
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

/**
 * NOTE: `archiveEnabled`/`conversationArchiveMasterSeedAuthority` are
 * deliberately NOT set here -- this test never calls
 * `runtime.conversationArchiveRuntime()` (see this file's own header,
 * "SECOND DOCUMENTED SUBSTITUTION"); `buildTestArchiveRuntime()` builds
 * an independent, equally-real `FedosConversationArchiveRuntime` over the
 * SAME durable log files instead, with an injectable fake crypto
 * boundary this config surface does not expose.
 */
function runtimeConfig(paths: Paths): FedosDesktopRuntimeConfig {
  return {
    boardLogPath: paths.boardLogPath,
    outboxLogPath: paths.outboxLogPath,
    deliveryEnabled: false, // NO delivery/transport of any kind -- see this file's own header.
    // conversationLogPath deliberately OMITTED -- see Paths.archiveConversationLogPath's own header;
    // this Runtime's own Board-hydrated Conversation Persistence stays the safe in-memory default,
    // trivially empty since this test never creates a Board thread.
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
    // An INCREMENTING clock (not a fixed one) -- this test asserts on canonical Group Message ORDER
    // (`createdAt` ascending, `FedosGroupReadFacade.listMessages()`'s own discipline), which needs
    // the two real sends below to genuinely receive different timestamps, exactly like real wall-clock
    // time would give them.
    clock: makeIncrementingClock(1_718_000_000),
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

/** Seeds the ONE placeholder `FedosConversationPersistence` record each real Conversation id needs for the Archive Runtime's own pre-existing (out-of-this-Arc's-scope) requirement -- see this file's own header. Written via a SECOND port instance over the SAME durable log file the running Runtime already reads/writes internally. */
function seedPlaceholderConversationRecord(conversationLogPath: string, conversationId: string): void {
  const persistence = new AppendOnlyFedosConversationPersistence(conversationLogPath);
  persistence.putConversation({
    schemaVersion: 1, id: conversationId, mode: "public", boardId: "board-a", rootThreadId: conversationId, rootPostId: conversationId, policyReference: "public-v1", createdAt: 1_700_000_000,
  });
}

describe("Secure Runtime Alpha 1921-1980 -- Group Conversation real Application Round Trip", () => {
  it("1. create Private Group -> admit 2 recipients -> send -> remove one member -> next generation -> send again -> export -> stop -> fresh destination Runtime -> inspect -> preflight -> restore -> stop -> restart -> exact local Group history, no duplication, no network side effects, new send after restore is not replayed", async () => {
    const sourceDir = mkdtempSync(join(tmpdir(), "fedos-1921-1980-group-archive-source-"));
    const sourcePaths = buildPaths(sourceDir);
    const sharedArchiveBoundary = fakeRoundTrippingRuntimeBoundary();
    const sharedMasterSeedAuthority = fakeMasterSeedAuthority();

    // ===== SOURCE RUNTIME =====
    const source = await startFedosDesktopRuntime(runtimeConfig(sourcePaths));
    const sourceArchive = buildTestArchiveRuntime(sourcePaths, sharedMasterSeedAuthority, sharedArchiveBoundary);

    const created = source.conversationRuntime().createPrivateGroupDraft({});
    expect(created.outcome).toBe("draft-created");
    if (created.outcome !== "draft-created") throw new Error("expected draft-created");
    const groupId = created.draft.id;
    const gr = source.conversationRuntime().groupRuntime();

    expect((await gr.addPrivateGroupMember(groupId, BOB)).outcome).toBe("admitted");
    expect((await gr.addPrivateGroupMember(groupId, CAROL)).outcome).toBe("admitted");

    const firstSend = await gr.sendPrivateGroupMessage({ groupConversationId: groupId, body: "hello everyone", replyToGroupMessageId: null });
    expect(firstSend.outcome).toBe("stored-for-all");
    if (firstSend.outcome !== "stored-for-all") throw new Error("expected stored-for-all");
    expect(firstSend.recipientEnvelopeIds).toHaveLength(2);

    expect((await gr.removePrivateGroupMember(groupId, BOB)).outcome).toBe("revoked");

    const secondSend = await gr.sendPrivateGroupMessage({ groupConversationId: groupId, body: "bob is gone now", replyToGroupMessageId: firstSend.groupMessageId });
    expect(secondSend.outcome).toBe("stored-for-all");
    if (secondSend.outcome !== "stored-for-all") throw new Error("expected stored-for-all");
    expect(secondSend.recipientEnvelopeIds).toHaveLength(1); // Carol only.

    // Every Membership change (each admission, each removal) produces its OWN new generation (Alpha
    // 1324-1327) -- admitting Bob gives [Alice,Bob] (generation 0), admitting Carol gives
    // [Alice,Bob,Carol] (generation 1, the CURRENT generation the first send above actually used),
    // removing Bob gives [Alice,Carol] (generation 2, the CURRENT generation the second send used).
    const generationsBeforeExport = gr.listPrivateGroupGenerations(groupId);
    expect(generationsBeforeExport.length).toBe(3);
    const genWithAllThree = generationsBeforeExport.find((g) => g.generationNumber === 1)!;
    const genAfterBobRemoved = generationsBeforeExport.find((g) => g.generationNumber === 2)!;

    // Discover the child Direct Conversation ids this Group's own paths reference -- a REAL read
    // over the SAME durable Group Path log the running Runtime already wrote to (mirrors this
    // file's own header discipline for the placeholder Conversation record).
    const pathReader = new AppendOnlyFedosGroupDirectPathPersistence(sourcePaths.conversationGroupDirectPathLogPath);
    const childIds = new Set<string>();
    for (const gen of generationsBeforeExport) {
      for (const path of pathReader.listPathsForGeneration(groupId, gen.generationId)) childIds.add(path.directConversationId);
    }
    expect(childIds.size).toBe(2); // Alice<->Bob, Alice<->Carol.

    seedPlaceholderConversationRecord(sourcePaths.archiveConversationLogPath, groupId);
    for (const childId of childIds) seedPlaceholderConversationRecord(sourcePaths.archiveConversationLogPath, childId);

    const archiveDir = mkdtempSync(join(tmpdir(), "fedos-1921-1980-group-archive-file-"));
    const destination = join(archiveDir, "fedos-1921-1980-group-archive.archive");
    const exportResult = await sourceArchive.exportConversationArchive({
      conversationId: groupId,
      destinationPath: destination,
      localParticipant: ALICE,
      localAccountIndex: LOCAL_ACCOUNT_INDEX,
      counterpartyPublicKeyHex: ARCHIVE_COUNTERPARTY_KEY_HEX,
      suite: "ChaCha20Poly1305",
    });
    expect(exportResult.outcome).toBe("exported");
    expect(exportResult.manifest?.groupGenerationCount).toBe(3);
    expect(exportResult.manifest?.groupMessageCount).toBe(2);
    expect(exportResult.manifest?.groupChildConversationCount).toBe(2);

    await source.stop();

    // ===== DESTINATION RUNTIME (independent persistence files, restore-compatible identity) =====
    const destDir = mkdtempSync(join(tmpdir(), "fedos-1921-1980-group-archive-dest-"));
    const destPaths = buildPaths(destDir);
    const destinationRuntimeConfig = runtimeConfig(destPaths);
    const destinationArchive = buildTestArchiveRuntime(destPaths, sharedMasterSeedAuthority, sharedArchiveBoundary);
    let destination1 = await startFedosDesktopRuntime(destinationRuntimeConfig);

    const inspection = await destinationArchive.inspectConversationArchive(destination);
    expect(inspection.outcome).toBe("inspected");
    expect(inspection.manifest?.groupMessageCount).toBe(2);

    const preflight = await destinationArchive.preflightRestore({
      sourcePath: destination, localAccountIndex: LOCAL_ACCOUNT_INDEX, counterpartyPublicKeyHex: ARCHIVE_COUNTERPARTY_KEY_HEX, suite: "ChaCha20Poly1305",
    });
    expect(preflight.outcome).toBe("previewed");
    expect(preflight.report?.group?.generations).toEqual({ new: 3, duplicate: 0, conflict: 0 });
    expect(preflight.report?.group?.childConversations.length).toBe(2);

    const restoreResult = await destinationArchive.restoreConversationArchive({
      sourcePath: destination, localAccountIndex: LOCAL_ACCOUNT_INDEX, counterpartyPublicKeyHex: ARCHIVE_COUNTERPARTY_KEY_HEX, suite: "ChaCha20Poly1305",
    });
    expect(restoreResult.outcome).toBe("restored");
    expect(restoreResult.details?.group?.generations).toEqual({ inserted: 3, duplicate: 0, conflict: 0, failed: 0, invalid: 0 });
    expect(restoreResult.details?.group?.messages).toEqual({ inserted: 2, duplicate: 0, conflict: 0, failed: 0, invalid: 0 });
    expect(restoreResult.details?.group?.fanoutDeliveries).toEqual({ inserted: 3, duplicate: 0, conflict: 0, failed: 0, invalid: 0 });
    expect(restoreResult.details?.group?.childConversations.length).toBe(2);

    await destination1.stop();

    // ===== STOP/RESTART -- a genuinely fresh Runtime instance over the SAME durable destination files =====
    const destination2 = await startFedosDesktopRuntime(destinationRuntimeConfig);
    const destGr = destination2.conversationRuntime().groupRuntime();

    // Verify generations survive exactly (3 -- see the SOURCE side's own identical comment above).
    const restoredGenerations = destGr.listPrivateGroupGenerations(groupId);
    expect(restoredGenerations.length).toBe(3);
    const restoredGenWithAllThree = restoredGenerations.find((g) => g.generationNumber === 1)!;
    const restoredGenAfterBobRemoved = restoredGenerations.find((g) => g.generationNumber === 2)!;
    // Removed member (Bob) excluded from the LATER generation.
    expect(restoredGenAfterBobRemoved.activeMemberMembershipIds.some((id) => id.includes(BOB_PUBKEY))).toBe(false);
    expect(restoredGenWithAllThree.activeMemberMembershipIds.some((id) => id.includes(BOB_PUBKEY))).toBe(true);

    // Verify canonical Group Message order + reply reference.
    const restoredMessages = destGr.listPrivateGroupMessages(groupId);
    expect(restoredMessages.length).toBe(2);
    const sorted = [...restoredMessages].sort((a, b) => a.createdAt - b.createdAt);
    expect(sorted[0]!.id).toBe(firstSend.groupMessageId);
    expect(sorted[1]!.id).toBe(secondSend.groupMessageId);
    expect(sorted[1]!.replyToGroupMessageId).toBe(firstSend.groupMessageId);
    expect(sorted[1]!.fanoutSummary.recipientCount).toBe(1); // Carol only, matching the source's own record.

    // Verify authorized payload decrypt/read -- Alice's own local, sender-side envelope for the FIRST
    // message's own delivery to Carol (a child Direct Conversation this restore actually recovered).
    // The FIRST send used generation 1 (genWithAllThree) -- Carol's own path there.
    //
    // NOTE: this reads the restored Envelope/Payload directly (a SECOND port instance over the SAME
    // durable log files, exactly like this file's own header discipline) rather than through
    // `conversationRuntime().readDirectMessage()` -- that higher-level API additionally requires the
    // child Direct Conversation's own Draft+Activation facts (`resolveFedosConversationActiveConversation()`),
    // which are INTENTIONALLY excluded from the archive (Phase A/B's own frozen decision, mirroring the
    // Direct Archive Foundation's own existing precedent of never archiving Activation -- see this
    // repo's own domain inventory doc, §1). This still proves the exact same thing Phase G asks for --
    // an AUTHORIZED party (Alice, the real sender, via the real `FedosConversationDecryptionAuthority`
    // her own Runtime is configured with) can decrypt the restored ciphertext back to the exact
    // original plaintext -- just invoked directly rather than through the Activation-gated facade.
    const childReader = new AppendOnlyFedosGroupDirectPathPersistence(destPaths.conversationGroupDirectPathLogPath);
    const restoredPaths = childReader.listPathsForGeneration(groupId, restoredGenWithAllThree.generationId);
    const carolPath = restoredPaths.find((p) => p.recipientMembershipId.includes(CAROL_PUBKEY))!;
    expect(carolPath).toBeDefined();

    const envelopeReader = new AppendOnlyFedosConversationMessageEnvelopePersistence(destPaths.conversationEnvelopeLogPath);
    const payloadReader = new AppendOnlyFedosConversationPayloadStorage(destPaths.conversationPayloadLogPath, 1_000_000);
    const carolEnvelopes = envelopeReader.listConversationEnvelopes(carolPath.directConversationId as FedosConversationId);
    expect(carolEnvelopes.length).toBeGreaterThanOrEqual(1);
    const carolEnvelope = carolEnvelopes[0]!;
    const carolPayload = payloadReader.getPayload(carolEnvelope.payloadId as never);
    expect(carolPayload).not.toBeNull();

    const decryptionAuthority = new FakeDecryptionAuthority(ALICE.publicIdentifier);
    const decrypted = await decryptionAuthority.decrypt({
      envelopeId: carolEnvelope.id as never,
      conversationId: carolPath.directConversationId as FedosConversationId,
      senderMembershipId: carolEnvelope.senderMembershipId as never,
      keyEpoch: carolEnvelope.keyEpoch,
      createdAt: carolEnvelope.createdAt,
      replyToEnvelopeId: carolEnvelope.replyToEnvelopeId as never,
      suite: carolEnvelope.encryptionSuite as never,
      ciphertext: carolPayload!.bytes,
      localAccountIndex: LOCAL_ACCOUNT_INDEX,
      counterpartyPublicKeyHex: CAROL_PUBKEY,
    });
    expect(decrypted.outcome).toBe("decrypted");
    if (decrypted.outcome === "decrypted") {
      expect(new TextDecoder().decode(decrypted.plaintext)).toMatch(/hello everyone|bob is gone now/);
    }

    // Verify NO duplicate fanout facts -- re-run restore once more against the SAME (now populated)
    // destination and confirm everything reports duplicate, never a second inserted record.
    const secondRestoreAttempt = await destinationArchive.restoreConversationArchive({
      sourcePath: destination, localAccountIndex: LOCAL_ACCOUNT_INDEX, counterpartyPublicKeyHex: ARCHIVE_COUNTERPARTY_KEY_HEX, suite: "ChaCha20Poly1305",
    });
    expect(secondRestoreAttempt.outcome).toBe("already-present");
    expect(secondRestoreAttempt.details?.group?.fanoutDeliveries).toEqual({ inserted: 0, duplicate: 3, conflict: 0, failed: 0, invalid: 0 });
    expect(destGr.listPrivateGroupMessages(groupId).length).toBe(2); // still exactly 2, never 4.

    // Verify NO network/transport side effect occurred: this Runtime was never configured with any
    // transport/delivery/publisher at all (deliveryEnabled:false, privateTransportEnabled omitted) --
    // privateTransport() itself must report "not enabled", proving nothing could have published.
    expect(() => destination2.privateTransport()).toThrow(/not enabled/);

    // AFTER restore, send ONE genuinely NEW Group Message through normal local Group APIs and prove
    // restored state is not duplicated or replayed by that new send.
    //
    // Carol's own RESTORED pairwise Direct Conversation carries no Draft+Activation fact (Draft and
    // Activation are BOTH intentionally excluded from the archive, mirroring the Direct Archive
    // Foundation's own existing precedent -- see this repo's own domain inventory doc §1) -- sending
    // a genuinely NEW message through it would fail exactly like the earlier read attempt would have
    // (`resolveFedosConversationActiveConversation()` requires both facts). A real end user restoring
    // onto a fresh device would need a SEPARATE, not-yet-built "reactivate restored conversations"
    // capability to resume messaging normally -- reasonably this Arc's own suggested next step (see
    // this Arc's own completion declaration). For THIS test's own narrow purpose (proving the Group
    // Archive's own restored generation/message/fanout data is never duplicated or replayed by a
    // genuinely new send), reconstruct ONLY Carol's own child Direct Conversation's Draft+Activation
    // directly -- deterministically re-derivable from already-known real facts (mode "direct", Alice
    // as creator, "completed" since it plainly WAS active on the source side) -- via a SECOND port
    // instance over the SAME durable log files, exactly like every other seeding step in this file.
    const draftPersistence = new AppendOnlyFedosConversationDraftPersistence(destPaths.conversationDraftLogPath);
    draftPersistence.putDraft({
      schemaVersion: 1,
      id: carolPath.directConversationId,
      mode: "direct",
      lifecycleState: "draft",
      policyReference: "direct-draft-v1",
      creatorAuthority: ALICE.authority,
      creatorPublicIdentifier: ALICE.publicIdentifier,
      creatorIdentityId: null,
      createdAt: 1_700_000_000,
    });
    const activationPersistence = new AppendOnlyFedosConversationActivationPersistence(destPaths.conversationActivationCoordinationLogPath);
    activationPersistence.putActivationFact({
      schemaVersion: 1,
      activationId: fedosConversationActivationId(carolPath.directConversationId),
      conversationId: carolPath.directConversationId,
      phase: "completed",
      startedAt: 1_700_000_000,
      updatedAt: 1_700_000_000,
    });

    const postRestoreSend = await destGr.sendPrivateGroupMessage({ groupConversationId: groupId, body: "a brand new message after restore", replyToGroupMessageId: null });
    expect(postRestoreSend.outcome).toBe("stored-for-all");
    if (postRestoreSend.outcome !== "stored-for-all") throw new Error("expected stored-for-all");
    expect(postRestoreSend.groupMessageId).not.toBe(firstSend.groupMessageId);
    expect(postRestoreSend.groupMessageId).not.toBe(secondSend.groupMessageId);
    const messagesAfterNewSend = destGr.listPrivateGroupMessages(groupId);
    expect(messagesAfterNewSend.length).toBe(3); // the 2 restored + 1 new -- never a replay of the restored 2.
    // The 2 RESTORED messages are still exactly as they were -- the new send never touched them.
    expect(messagesAfterNewSend.some((m) => m.id === firstSend.groupMessageId)).toBe(true);
    expect(messagesAfterNewSend.some((m) => m.id === secondSend.groupMessageId)).toBe(true);

    await destination2.stop();
  }, 30_000);
});
