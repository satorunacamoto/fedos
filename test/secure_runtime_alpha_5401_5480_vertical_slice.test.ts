import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
// @ts-expect-error `node:fs` has no type declarations without `@types/node` in this project's tsconfig.
import { mkdtempSync, rmSync } from "node:fs";
// @ts-expect-error `node:os` has no type declarations without `@types/node` in this project's tsconfig.
import { tmpdir } from "node:os";
// @ts-expect-error `node:path` has no type declarations without `@types/node` in this project's tsconfig.
import { join } from "node:path";
import { toFedosConversationId } from "../src/os/messenger/conversations/fedos_conversation_id.js";
import { toFedosBoardId, toFedosThreadId } from "../src/os/messenger/board/fedos_board_identifiers.js";
import { InMemoryFedosConversationDraftPersistence } from "../src/os/messenger/conversations/construction/in_memory_fedos_conversation_draft_persistence.js";
import { InMemoryFedosConversationMembershipAuthority } from "../src/os/messenger/conversations/membership/in_memory_fedos_conversation_membership_authority.js";
import type { FedosConversationParticipantReference } from "../src/os/messenger/conversations/membership/fedos_conversation_participant_reference.js";
import { InMemoryFedosConversationPayloadStorage } from "../src/os/messenger/conversations/payload_storage/in_memory_fedos_conversation_payload_storage.js";
import { toFedosConversationPayloadId } from "../src/os/messenger/conversations/payload_storage/fedos_conversation_payload_id.js";
import { FedosPayloadRetentionAuthority } from "../src/os/messenger/conversations/retention/fedos_payload_retention_authority.js";
import { InMemoryFedosPayloadRetentionPersistence } from "../src/os/messenger/conversations/retention/in_memory_fedos_payload_retention_persistence.js";
import { FedosConversationSearchIndex, type FedosConversationSearchIndexDependencies } from "../src/os/messenger/conversations/search/fedos_conversation_search_index.js";
import { validateFedosConversationMessageEnvelope } from "../src/os/messenger/conversations/envelope/fedos_conversation_message_envelope_validator.js";
import type { FedosConversationMessageEnvelope } from "../src/os/messenger/conversations/envelope/fedos_conversation_message_envelope.js";
import { InMemoryFedosConversationPersistence } from "../src/os/messenger/conversations/persistence/in_memory_fedos_conversation_persistence.js";
import { InMemoryFedosConversationMembershipPersistence } from "../src/os/messenger/conversations/membership/persistence/in_memory_fedos_conversation_membership_persistence.js";
import { InMemoryFedosConversationCapabilityPersistence } from "../src/os/messenger/conversations/capability/persistence/in_memory_fedos_conversation_capability_persistence.js";
import { InMemoryFedosConversationMessageEnvelopePersistence } from "../src/os/messenger/conversations/envelope/persistence/in_memory_fedos_conversation_message_envelope_persistence.js";
import { restoreFedosConversationArchiveBundle, type FedosConversationArchiveRestoreDependencies } from "../src/os/messenger/conversations/archive/fedos_conversation_archive_restore.js";
import type { FedosConversationArchiveCollectorDependencies } from "../src/os/messenger/conversations/archive/fedos_conversation_archive_collector.js";
import type { FedosConversationArchiveBundleV1 } from "../src/os/messenger/conversations/archive/fedos_conversation_archive_bundle.js";
import { FEDOS_CONVERSATION_ARCHIVE_SCHEMA_VERSION } from "../src/os/messenger/conversations/archive/fedos_conversation_archive_schema_version.js";
import { exportFedosConversationArchiveCliDirectory } from "../src/os/messenger/conversations/archive_cli/fedos_conversation_archive_cli_directory.js";
import type { FedosConversationArchiveCliExportRequest } from "../src/os/messenger/conversations/archive_cli/fedos_conversation_archive_cli_export.js";
import { FedosWasmConversationArchiveEncryptionAuthority, type FedosConversationArchiveEncryptionRuntimeBoundary } from "../src/os/messenger/conversations/archive/fedos_conversation_archive_encryption.js";
import { fedosConversationArchiveCliNodeFileSystem } from "../src/os/messenger/conversations/archive_cli/fedos_conversation_archive_cli_file_system.js";
import type { FedosMasterSeedAuthority } from "../src/os/core/vault/wasm/fedos_master_seed_authority.js";
import type { AeadCiphertextHandle, AeadCiphertextWire, AeadKeyHandle } from "../src/runtime/fedos_wasm_loader.js";
import { assessFedosLocalPayloadDeletion, assessFedosLocalArchiveFileDeletion } from "../src/os/messenger/conversations/deletion/fedos_deletion_assessment.js";
import { buildFedosLocalPayloadDeletionPlan, buildFedosLocalArchiveFileRemovalPlan } from "../src/os/messenger/conversations/deletion/fedos_deletion_plan.js";
import { executeFedosLocalPayloadDeletionPlan, executeFedosLocalArchiveFileRemovalPlan } from "../src/os/messenger/conversations/deletion/fedos_deletion_execution_coordinator.js";
import { AppendOnlyFedosDeletionExecutionPersistence } from "../src/os/messenger/conversations/deletion/append_only_fedos_deletion_execution_persistence.js";
import { buildFedosDeletionExecutionSummary } from "../src/os/messenger/conversations/deletion/fedos_deletion_user_summary.js";
import { resolveFedosDeletionArchiveFileHandle } from "../src/os/messenger/conversations/deletion/fedos_deletion_archive_file_authority.js";

/**
 * Secure Runtime Alpha 5401-5480 -- Phase O REAL vertical slice. Every
 * dependency here is a REAL implementation this codebase already ships
 * (`FedosPayloadRetentionAuthority`, `FedosConversationSearchIndex`,
 * `exportFedosConversationArchiveCliDirectory`, the real Node filesystem
 * backend for Archive-file removal, and the real
 * `AppendOnlyFedosDeletionExecutionPersistence` log). The ONE fake in this
 * file is the Archive's own AEAD runtime boundary (`fakeRoundTrippingRuntimeBoundary`),
 * matching every existing Archive CLI test in this codebase (Alpha 2341-2420)
 * -- the real WASM crypto binding is out of scope for a TypeScript-level
 * test and orthogonal to what this Arc verifies.
 */

const CONVERSATION_ID = toFedosConversationId(toFedosBoardId("board-vertical")!, toFedosThreadId("thread-1")!);
const ALICE: FedosConversationParticipantReference = { authority: "fedos", publicIdentifier: "alice", identityId: null };
const PAYLOAD_ID = toFedosConversationPayloadId("payload-vertical-1")!;
const KEY_HANDLE: AeadKeyHandle = { kind: "AeadKeyHandle" } as AeadKeyHandle;

function fakeMasterSeedAuthority(): FedosMasterSeedAuthority {
  return {
    isAvailable: vi.fn(async () => true),
    isCleared: vi.fn(async () => false),
    generate: vi.fn(async () => true),
    restoreSealed: vi.fn(async () => true),
    seal: vi.fn(async () => null),
    clear: vi.fn(async () => undefined),
    resolveConversationKey: vi.fn(async () => KEY_HANDLE),
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

let archiveDir: string;

beforeEach(() => {
  archiveDir = mkdtempSync(join(tmpdir(), "fedos-deletion-vertical-slice-"));
});

afterEach(() => {
  rmSync(archiveDir, { recursive: true, force: true });
});

describe("Secure Runtime Alpha 5401-5480 -- Phase O real vertical slice", () => {
  it("runs the full local deletion flow over real Retention, Search, and Archive CLI runtimes, with a real restart", async () => {
    // 1-2. Create/open a real Direct Conversation and one real message/payload.
    const draftPersistence = new InMemoryFedosConversationDraftPersistence();
    draftPersistence.putDraft({
      schemaVersion: 1,
      id: CONVERSATION_ID,
      mode: "direct",
      lifecycleState: "active",
      policyReference: "direct-draft-v1",
      creatorAuthority: "fedos",
      creatorPublicIdentifier: "alice",
      creatorIdentityId: null,
      createdAt: 1_700_000_000,
    });
    const membershipAuthority = new InMemoryFedosConversationMembershipAuthority();
    const admission = membershipAuthority.admit(CONVERSATION_ID, ALICE, "owner", 1_700_000_000);
    if (admission.outcome !== "admitted") throw new Error("vertical slice setup failed: admission");

    const payloadStorage = new InMemoryFedosConversationPayloadStorage();
    payloadStorage.putPayload(
      { id: PAYLOAD_ID, conversationId: CONVERSATION_ID, mediaType: "application/octet-stream", byteLength: 3, createdAt: 1_700_000_000 },
      new Uint8Array([1, 2, 3]),
    );
    const retentionAuthority = new FedosPayloadRetentionAuthority({
      retentionPersistence: new InMemoryFedosPayloadRetentionPersistence(),
      payloadStorage,
      clock: () => 1_700_000_100,
    });

    // 3. Ensure it is searchable.
    const searchDeps: FedosConversationSearchIndexDependencies = { draftPersistence, membershipAuthority, retentionAuthority };
    const searchIndex = new FedosConversationSearchIndex(searchDeps);
    const envelope: FedosConversationMessageEnvelope = (() => {
      const built = validateFedosConversationMessageEnvelope({
        id: "envelope-vertical-1",
        conversationId: CONVERSATION_ID,
        senderMembershipId: admission.membership.id,
        payloadId: PAYLOAD_ID,
        encryptionSuite: "ChaCha20Poly1305",
        keyEpoch: 0,
        createdAt: 1_700_000_000,
        replyToEnvelopeId: null,
      });
      if (built === null) throw new Error("vertical slice setup failed: envelope");
      return built;
    })();
    expect(searchIndex.indexEnvelope({ envelope, text: "the real vertical slice message" })).toBe("indexed");
    expect(searchIndex.searchKeyword("vertical")).toEqual([envelope.id]);

    // 4. Create an Archive containing it.
    const archiveDeps: FedosConversationArchiveRestoreDependencies & FedosConversationArchiveCollectorDependencies = {
      conversationPersistence: new InMemoryFedosConversationPersistence(),
      membershipPersistence: new InMemoryFedosConversationMembershipPersistence(),
      capabilityPersistence: new InMemoryFedosConversationCapabilityPersistence(),
      envelopePersistence: new InMemoryFedosConversationMessageEnvelopePersistence(),
      payloadStorage: new InMemoryFedosConversationPayloadStorage(),
    };
    const bundle: FedosConversationArchiveBundleV1 = {
      schemaVersion: FEDOS_CONVERSATION_ARCHIVE_SCHEMA_VERSION,
      conversationId: CONVERSATION_ID,
      exportedAt: 1_700_000_500,
      conversation: {
        schemaVersion: 1,
        id: CONVERSATION_ID,
        mode: "public",
        boardId: "board-vertical",
        rootThreadId: "thread-1",
        rootPostId: "thread-1",
        policyReference: "public-v1",
        createdAt: 1_700_000_000,
      },
      memberships: [],
      capabilityEvents: [],
      envelopes: [],
      payloads: [],
    };
    restoreFedosConversationArchiveBundle(bundle, archiveDeps);
    const encryptionAuthority = new FedosWasmConversationArchiveEncryptionAuthority(fakeMasterSeedAuthority(), fakeRoundTrippingRuntimeBoundary());
    const exportRequest: FedosConversationArchiveCliExportRequest = {
      conversationId: CONVERSATION_ID,
      exportedAt: 1_700_000_999,
      suite: "ChaCha20Poly1305",
      localAccountIndex: 0,
      counterpartyPublicKeyHex: "ab".repeat(32),
    };
    // Real Node filesystem -- an actual file is written to a real temp directory.
    const exportResult = await exportFedosConversationArchiveCliDirectory([exportRequest], archiveDeps, encryptionAuthority, archiveDir, 1_700_001_000, fedosConversationArchiveCliNodeFileSystem);
    expect(exportResult.entries.every((entry) => entry.outcome === "exported")).toBe(true);
    expect(exportResult.directoryManifestWritten).toBe(true);

    // 5-6. Assess local deletion, confirm a plan for local payload + index removal.
    const payloadAssessment = assessFedosLocalPayloadDeletion(PAYLOAD_ID, { retentionAuthority });
    expect(payloadAssessment.blocker).toBe("none");
    expect(payloadAssessment.requiresExplicitConfirmation).toBe(true);
    const payloadPlan = buildFedosLocalPayloadDeletionPlan("plan-vertical-payload", PAYLOAD_ID, payloadAssessment);
    expect(payloadPlan.steps.map((s) => s.kind)).toEqual(["retention-transition", "purge-index"]);

    // 7-8. Execute: real Retention/tombstone transition + real Search index purge.
    const logPath = join(archiveDir, "deletion-execution.ndjson");
    const persistenceBeforeRestart = new AppendOnlyFedosDeletionExecutionPersistence(logPath);
    const executionOutcome = executeFedosLocalPayloadDeletionPlan(
      { plan: payloadPlan, requestedBy: "local-account-vertical", confirmed: true, authorityReference: "local-account-vertical", reasonCode: "user_requested_placeholder" },
      { retentionAuthority, searchIndex, persistence: persistenceBeforeRestart },
    );
    expect(executionOutcome.outcome).toBe("executed");
    if (executionOutcome.outcome !== "executed") throw new Error("unreachable");
    expect(executionOutcome.record.status).toBe("completed");

    // 9. Verify the message is unreadable/unsearchable locally per current Retention semantics.
    expect(retentionAuthority.evaluatePayloadAccess(PAYLOAD_ID).outcome).toBe("denied");
    expect(searchIndex.searchKeyword("vertical")).toEqual([]);
    expect(searchIndex.size()).toBe(0);

    // 10. Verify the Archive still exists (Archive/live separation).
    const archiveHandleAfterMessageDeletion = resolveFedosDeletionArchiveFileHandle(archiveDir, CONVERSATION_ID, fedosConversationArchiveCliNodeFileSystem);
    expect(archiveHandleAfterMessageDeletion.outcome).toBe("found");

    // 11-12. Assess Archive-file removal INDEPENDENTLY, explicitly confirm.
    const archiveAssessment = assessFedosLocalArchiveFileDeletion({ directoryPath: archiveDir, conversationId: CONVERSATION_ID, fileSystem: fedosConversationArchiveCliNodeFileSystem });
    expect(archiveAssessment.targetExists).toBe(true);
    expect(archiveAssessment.requiresExplicitConfirmation).toBe(true);
    const archivePlan = buildFedosLocalArchiveFileRemovalPlan("plan-vertical-archive", CONVERSATION_ID, {
      directoryPath: archiveDir,
      conversationId: CONVERSATION_ID,
      fileSystem: fedosConversationArchiveCliNodeFileSystem,
    });
    expect(archivePlan.requiresExplicitConfirmation).toBe(true);

    // 13. Remove EXACTLY the tracked Archive file.
    const archiveExecutionOutcome = executeFedosLocalArchiveFileRemovalPlan(
      { plan: archivePlan, requestedBy: "local-account-vertical", confirmed: true, directoryPath: archiveDir, conversationId: CONVERSATION_ID },
      { persistence: persistenceBeforeRestart, fileSystem: fedosConversationArchiveCliNodeFileSystem },
    );
    expect(archiveExecutionOutcome.outcome).toBe("executed");
    if (archiveExecutionOutcome.outcome !== "executed") throw new Error("unreachable");
    expect(archiveExecutionOutcome.record.status).toBe("completed");
    expect(resolveFedosDeletionArchiveFileHandle(archiveDir, CONVERSATION_ID, fedosConversationArchiveCliNodeFileSystem).outcome).toBe("not-tracked");

    // 14. Verify live Conversation deletion state is unchanged by Archive removal.
    expect(retentionAuthority.evaluatePayloadAccess(PAYLOAD_ID).outcome).toBe("denied");

    // 15-16. Restart: a NEW persistence instance over the SAME real log file. Both plans converge idempotently.
    const persistenceAfterRestart = new AppendOnlyFedosDeletionExecutionPersistence(logPath);
    const payloadReplay = executeFedosLocalPayloadDeletionPlan(
      { plan: payloadPlan, requestedBy: "local-account-vertical", confirmed: true, authorityReference: "local-account-vertical", reasonCode: "user_requested_placeholder" },
      { retentionAuthority, searchIndex, persistence: persistenceAfterRestart },
    );
    expect(payloadReplay.outcome).toBe("already-executed");
    if (payloadReplay.outcome !== "already-executed") throw new Error("unreachable");
    expect(payloadReplay.record).toEqual(executionOutcome.record);

    const archiveReplay = executeFedosLocalArchiveFileRemovalPlan(
      { plan: archivePlan, requestedBy: "local-account-vertical", confirmed: true, directoryPath: archiveDir, conversationId: CONVERSATION_ID },
      { persistence: persistenceAfterRestart, fileSystem: fedosConversationArchiveCliNodeFileSystem },
    );
    expect(archiveReplay.outcome).toBe("already-executed");
    if (archiveReplay.outcome !== "already-executed") throw new Error("unreachable");
    expect(archiveReplay.record).toEqual(archiveExecutionOutcome.record);

    // 17. The user summary still states the remote/backup non-guarantees, never "deleted everywhere".
    const summary = buildFedosDeletionExecutionSummary(executionOutcome.record);
    expect(summary.warnings.some((w) => /backup/i.test(w))).toBe(true);
    expect(summary.warnings.some((w) => /device/i.test(w))).toBe(true);
    expect(summary.warnings.some((w) => /relay/i.test(w))).toBe(true);
    // The honest disclaimer legitimately NAMES "deleted everywhere" in order to deny it -- never affirms it.
    expect(summary.warnings.at(-1)).toMatch(/never.*presented as "deleted everywhere"|no combination.*deleted everywhere/i);
    expect(summary.safeSummary).not.toMatch(/everywhere/i);
    expect(JSON.stringify(summary)).not.toMatch(/[A-Za-z]:\\/);
  });
});
