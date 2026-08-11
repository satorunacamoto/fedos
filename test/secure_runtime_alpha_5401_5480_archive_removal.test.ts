import { describe, it, expect, vi } from "vitest";
import {
  exportFedosConversationArchiveCliDirectory,
  fedosConversationArchiveCliPackageFileName,
  listFedosConversationArchiveCliDirectory,
} from "../src/os/messenger/conversations/archive_cli/fedos_conversation_archive_cli_directory.js";
import { joinFedosConversationArchiveCliPath, type FedosConversationArchiveCliFileSystem, fedosConversationArchiveCliNodeFileSystem } from "../src/os/messenger/conversations/archive_cli/fedos_conversation_archive_cli_file_system.js";
import { exportFedosConversationArchiveCliPackage, type FedosConversationArchiveCliExportRequest } from "../src/os/messenger/conversations/archive_cli/fedos_conversation_archive_cli_export.js";
import { FedosWasmConversationArchiveEncryptionAuthority, type FedosConversationArchiveEncryptionRuntimeBoundary } from "../src/os/messenger/conversations/archive/fedos_conversation_archive_encryption.js";
import { InMemoryFedosConversationPersistence } from "../src/os/messenger/conversations/persistence/in_memory_fedos_conversation_persistence.js";
import { InMemoryFedosConversationMembershipPersistence } from "../src/os/messenger/conversations/membership/persistence/in_memory_fedos_conversation_membership_persistence.js";
import { InMemoryFedosConversationCapabilityPersistence } from "../src/os/messenger/conversations/capability/persistence/in_memory_fedos_conversation_capability_persistence.js";
import { InMemoryFedosConversationMessageEnvelopePersistence } from "../src/os/messenger/conversations/envelope/persistence/in_memory_fedos_conversation_message_envelope_persistence.js";
import { InMemoryFedosConversationPayloadStorage } from "../src/os/messenger/conversations/payload_storage/in_memory_fedos_conversation_payload_storage.js";
import { restoreFedosConversationArchiveBundle, type FedosConversationArchiveRestoreDependencies } from "../src/os/messenger/conversations/archive/fedos_conversation_archive_restore.js";
import type { FedosConversationArchiveCollectorDependencies } from "../src/os/messenger/conversations/archive/fedos_conversation_archive_collector.js";
import type { FedosConversationArchiveBundleV1 } from "../src/os/messenger/conversations/archive/fedos_conversation_archive_bundle.js";
import { FEDOS_CONVERSATION_ARCHIVE_SCHEMA_VERSION } from "../src/os/messenger/conversations/archive/fedos_conversation_archive_schema_version.js";
import type { FedosMasterSeedAuthority } from "../src/os/core/vault/wasm/fedos_master_seed_authority.js";
import type { AeadCiphertextHandle, AeadCiphertextWire, AeadKeyHandle } from "../src/runtime/fedos_wasm_loader.js";
import { toFedosConversationId, type FedosConversationId } from "../src/os/messenger/conversations/fedos_conversation_id.js";
import { toFedosBoardId, toFedosThreadId } from "../src/os/messenger/board/fedos_board_identifiers.js";
import {
  resolveFedosDeletionArchiveFileHandle,
  removeFedosDeletionArchiveFile,
} from "../src/os/messenger/conversations/deletion/fedos_deletion_archive_file_authority.js";
import { validateFedosDeletionArchiveDirectoryRoot, isFedosDeletionArchiveSingleSegmentFileName } from "../src/os/messenger/conversations/deletion/fedos_deletion_archive_path_authority.js";
import { executeFedosLocalArchiveFileRemovalPlan, executeFedosLocalPayloadDeletionPlan } from "../src/os/messenger/conversations/deletion/fedos_deletion_execution_coordinator.js";
import { assessFedosLocalArchiveFileDeletion, assessFedosLocalPayloadDeletion } from "../src/os/messenger/conversations/deletion/fedos_deletion_assessment.js";
import { buildFedosLocalArchiveFileRemovalPlan, buildFedosLocalPayloadDeletionPlan } from "../src/os/messenger/conversations/deletion/fedos_deletion_plan.js";
import { InMemoryFedosDeletionExecutionPersistence } from "../src/os/messenger/conversations/deletion/in_memory_fedos_deletion_execution_persistence.js";
import { FedosPayloadRetentionAuthority } from "../src/os/messenger/conversations/retention/fedos_payload_retention_authority.js";
import { InMemoryFedosPayloadRetentionPersistence } from "../src/os/messenger/conversations/retention/in_memory_fedos_payload_retention_persistence.js";
import { toFedosConversationPayloadId } from "../src/os/messenger/conversations/payload_storage/fedos_conversation_payload_id.js";
import { mkdtempSync, symlinkSync, writeFileSync, rmSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

/**
 * Secure Runtime Alpha 5401-5480 -- trusted Archive-file removal: canonical
 * handle resolution, traversal/path-authority denial, missing-file and
 * wrong-identity idempotency, no recursive/wildcard removal, and Archive/
 * live-history separation. Uses the SAME in-memory export fixture pattern
 * as `secure_runtime_alpha_2381_2400_cli_metadata_and_directory.test.ts`.
 */

const DIRECT_ID = toFedosConversationId(toFedosBoardId("board-a")!, toFedosThreadId("thread-1")!);
const OTHER_ID = toFedosConversationId(toFedosBoardId("board-a")!, toFedosThreadId("thread-2")!);
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

function fakeFileSystem(): FedosConversationArchiveCliFileSystem & { readonly files: Map<string, Uint8Array> } {
  const files = new Map<string, Uint8Array>();
  return {
    files,
    readFile(path: string): Uint8Array | null {
      return files.get(path) ?? null;
    },
    writeFile(path: string, bytes: Uint8Array): boolean {
      files.set(path, Uint8Array.from(bytes));
      return true;
    },
    listFiles(directoryPath: string): readonly string[] | null {
      const prefix = `${directoryPath}/`;
      return [...files.keys()].filter((key) => key.startsWith(prefix)).map((key) => key.slice(prefix.length));
    },
    deleteFile(path: string): boolean {
      if (!files.has(path)) return true;
      files.delete(path);
      return true;
    },
  };
}

type Deps = FedosConversationArchiveRestoreDependencies & FedosConversationArchiveCollectorDependencies;

function makeDeps(): Deps {
  return {
    conversationPersistence: new InMemoryFedosConversationPersistence(),
    membershipPersistence: new InMemoryFedosConversationMembershipPersistence(),
    capabilityPersistence: new InMemoryFedosConversationCapabilityPersistence(),
    envelopePersistence: new InMemoryFedosConversationMessageEnvelopePersistence(),
    payloadStorage: new InMemoryFedosConversationPayloadStorage(),
  };
}

function makeBundle(conversationId: FedosConversationId): FedosConversationArchiveBundleV1 {
  return {
    schemaVersion: FEDOS_CONVERSATION_ARCHIVE_SCHEMA_VERSION,
    conversationId,
    exportedAt: 1_700_000_500,
    conversation: {
      schemaVersion: 1,
      id: conversationId,
      mode: "public",
      boardId: "board-a",
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
}

const BASE_REQUEST_FIELDS = { suite: "ChaCha20Poly1305" as const, localAccountIndex: 0, counterpartyPublicKeyHex: "ab".repeat(32) };

async function exportOneArchive(directoryPath: string, conversationId: FedosConversationId, fileSystem: ReturnType<typeof fakeFileSystem>) {
  const deps = makeDeps();
  restoreFedosConversationArchiveBundle(makeBundle(conversationId), deps);
  const authority = new FedosWasmConversationArchiveEncryptionAuthority(fakeMasterSeedAuthority(), fakeRoundTrippingRuntimeBoundary());
  const request: FedosConversationArchiveCliExportRequest = { conversationId, exportedAt: 1_700_000_999, ...BASE_REQUEST_FIELDS };
  await exportFedosConversationArchiveCliDirectory([request], deps, authority, directoryPath, 1_700_001_000, fileSystem);
}

describe("Secure Runtime Alpha 5401-5480 -- trusted Archive-file handle resolution", () => {
  it("1. resolves a real, exported Archive Package via the directory's own index -- never a guessed path", async () => {
    const fileSystem = fakeFileSystem();
    await exportOneArchive("/exports/conv", DIRECT_ID, fileSystem);

    const resolved = resolveFedosDeletionArchiveFileHandle("/exports/conv", DIRECT_ID, fileSystem);
    expect(resolved.outcome).toBe("found");
    if (resolved.outcome !== "found") throw new Error("unreachable");
    expect(resolved.handle.fileName).toBe(fedosConversationArchiveCliPackageFileName(DIRECT_ID));
  });

  it("2. an untracked conversation id resolves 'not-tracked', never a fabricated handle", async () => {
    const fileSystem = fakeFileSystem();
    await exportOneArchive("/exports/conv", DIRECT_ID, fileSystem);
    const resolved = resolveFedosDeletionArchiveFileHandle("/exports/conv", OTHER_ID, fileSystem);
    expect(resolved.outcome).toBe("not-tracked");
  });

  it("3. a directory with no index at all resolves 'index-unavailable'", () => {
    const resolved = resolveFedosDeletionArchiveFileHandle("/nowhere", DIRECT_ID, fakeFileSystem());
    expect(resolved.outcome).toBe("index-unavailable");
  });
});

describe("Secure Runtime Alpha 5401-5480 -- path authority: traversal / arbitrary-root denial", () => {
  it("4. an empty directory path is denied", () => {
    expect(validateFedosDeletionArchiveDirectoryRoot("")).toBe("empty-path");
    expect(validateFedosDeletionArchiveDirectoryRoot("   ")).toBe("empty-path");
  });

  it("5. a bare drive/filesystem root is denied outright (no user-profile-root / no source-tree deletion class of mistake)", () => {
    expect(validateFedosDeletionArchiveDirectoryRoot("C:\\")).toBe("bare-root-denied");
    expect(validateFedosDeletionArchiveDirectoryRoot("C:")).toBe("bare-root-denied");
    expect(validateFedosDeletionArchiveDirectoryRoot("/")).toBe("bare-root-denied");
  });

  it("6. an ordinary nested directory path is allowed", () => {
    expect(validateFedosDeletionArchiveDirectoryRoot("C:\\Users\\someone\\exports\\conv")).toBe("allowed");
  });

  it("7. a traversal-shaped file name ('..', a separator, an embedded '..') is rejected as not a single path segment", () => {
    expect(isFedosDeletionArchiveSingleSegmentFileName("..")).toBe(false);
    expect(isFedosDeletionArchiveSingleSegmentFileName(".")).toBe(false);
    expect(isFedosDeletionArchiveSingleSegmentFileName("../../etc/passwd")).toBe(false);
    expect(isFedosDeletionArchiveSingleSegmentFileName("sub/dir/file.pkg")).toBe(false);
    expect(isFedosDeletionArchiveSingleSegmentFileName("sub\\dir\\file.pkg")).toBe(false);
    expect(isFedosDeletionArchiveSingleSegmentFileName("")).toBe(false);
  });

  it("8. an ordinary single-segment file name is accepted -- no wildcard/extension special-casing needed since only an exact tracked name is ever resolved", () => {
    expect(isFedosDeletionArchiveSingleSegmentFileName(fedosConversationArchiveCliPackageFileName(DIRECT_ID))).toBe(true);
  });

  it("9. removeFedosDeletionArchiveFile refuses a handle whose own directoryPath is a bare root, even if the handle was somehow constructed directly", () => {
    const fileSystem = fakeFileSystem();
    const outcome = removeFedosDeletionArchiveFile(
      { directoryPath: "C:\\", conversationId: DIRECT_ID, fileName: fedosConversationArchiveCliPackageFileName(DIRECT_ID) },
      { planId: "plan-traversal" },
      fileSystem,
    );
    expect(outcome).toBe("invalid-directory");
  });

  it("10. removeFedosDeletionArchiveFile refuses a traversal-shaped file name even if a handle were somehow constructed with one", () => {
    const fileSystem = fakeFileSystem();
    const outcome = removeFedosDeletionArchiveFile(
      { directoryPath: "/exports/conv", conversationId: DIRECT_ID, fileName: "../../etc/passwd" },
      { planId: "plan-traversal-2" },
      fileSystem,
    );
    expect(outcome).toBe("failed");
  });

  it("11. an empty confirmation planId is refused -- never removes without an explicit confirmation token", async () => {
    const fileSystem = fakeFileSystem();
    await exportOneArchive("/exports/conv", DIRECT_ID, fileSystem);
    const resolved = resolveFedosDeletionArchiveFileHandle("/exports/conv", DIRECT_ID, fileSystem);
    if (resolved.outcome !== "found") throw new Error("unreachable");
    const outcome = removeFedosDeletionArchiveFile(resolved.handle, { planId: "   " }, fileSystem);
    expect(outcome).toBe("failed");
    expect(fileSystem.files.has(joinFedosConversationArchiveCliPath("/exports/conv", resolved.handle.fileName))).toBe(true);
  });
});

describe("Secure Runtime Alpha 5401-5480 -- missing-file idempotency and wrong-identity refusal", () => {
  it("12. removing an already-removed Archive file is idempotent -- 'already-removed', never an error", async () => {
    const fileSystem = fakeFileSystem();
    await exportOneArchive("/exports/conv", DIRECT_ID, fileSystem);
    const resolved = resolveFedosDeletionArchiveFileHandle("/exports/conv", DIRECT_ID, fileSystem);
    if (resolved.outcome !== "found") throw new Error("unreachable");

    const first = removeFedosDeletionArchiveFile(resolved.handle, { planId: "plan-idem" }, fileSystem);
    expect(first).toBe("removed");
    const second = removeFedosDeletionArchiveFile(resolved.handle, { planId: "plan-idem" }, fileSystem);
    expect(second).toBe("already-removed");
  });

  it("13. removing a handle for a conversation id that no longer matches the directory's current entry fails closed as 'identity-mismatch'", async () => {
    const fileSystem = fakeFileSystem();
    await exportOneArchive("/exports/conv", DIRECT_ID, fileSystem);
    const resolved = resolveFedosDeletionArchiveFileHandle("/exports/conv", DIRECT_ID, fileSystem);
    if (resolved.outcome !== "found") throw new Error("unreachable");

    // Simulate a stale handle: the SAME file name now names a DIFFERENT conversation's manifest.
    const tamperedHandle = { ...resolved.handle, conversationId: OTHER_ID };
    const outcome = removeFedosDeletionArchiveFile(tamperedHandle, { planId: "plan-mismatch" }, fileSystem);
    expect(outcome).toBe("identity-mismatch");
    expect(fileSystem.files.has(joinFedosConversationArchiveCliPath("/exports/conv", resolved.handle.fileName))).toBe(true);
  });

  it("14. removes EXACTLY the one tracked file -- a second, unrelated conversation's own Package is left untouched", async () => {
    const fileSystem = fakeFileSystem();
    const deps = makeDeps();
    restoreFedosConversationArchiveBundle(makeBundle(DIRECT_ID), deps);
    restoreFedosConversationArchiveBundle(makeBundle(OTHER_ID), deps);
    const authority = new FedosWasmConversationArchiveEncryptionAuthority(fakeMasterSeedAuthority(), fakeRoundTrippingRuntimeBoundary());
    const requests: FedosConversationArchiveCliExportRequest[] = [DIRECT_ID, OTHER_ID].map((conversationId) => ({ conversationId, exportedAt: 1_700_000_999, ...BASE_REQUEST_FIELDS }));
    await exportFedosConversationArchiveCliDirectory(requests, deps, authority, "/exports/conv", 1_700_001_000, fileSystem);

    const resolved = resolveFedosDeletionArchiveFileHandle("/exports/conv", DIRECT_ID, fileSystem);
    if (resolved.outcome !== "found") throw new Error("unreachable");
    expect(removeFedosDeletionArchiveFile(resolved.handle, { planId: "plan-exact-one" }, fileSystem)).toBe("removed");

    const otherFileName = fedosConversationArchiveCliPackageFileName(OTHER_ID);
    expect(fileSystem.files.has(joinFedosConversationArchiveCliPath("/exports/conv", otherFileName))).toBe(true);
    const listed = listFedosConversationArchiveCliDirectory("/exports/conv", fileSystem);
    expect(listed?.length).toBe(1);
    expect(listed?.[0]?.manifest.conversationId).toBe(OTHER_ID);
  });
});

describe("Secure Runtime Alpha 5401-5480 -- no recursive/wildcard deletion; deleteFile is called with exactly one leaf file name", () => {
  it("15. the underlying fileSystem.deleteFile is invoked exactly once, with the joined single-file path, never a directory", async () => {
    const fileSystem = fakeFileSystem();
    await exportOneArchive("/exports/conv", DIRECT_ID, fileSystem);
    const resolved = resolveFedosDeletionArchiveFileHandle("/exports/conv", DIRECT_ID, fileSystem);
    if (resolved.outcome !== "found") throw new Error("unreachable");

    const deleteFileSpy = vi.spyOn(fileSystem, "deleteFile");
    removeFedosDeletionArchiveFile(resolved.handle, { planId: "plan-single-call" }, fileSystem);
    expect(deleteFileSpy).toHaveBeenCalledTimes(1);
    expect(deleteFileSpy).toHaveBeenCalledWith(joinFedosConversationArchiveCliPath("/exports/conv", resolved.handle.fileName));
  });
});

describe("Secure Runtime Alpha 5401-5480 -- symlink/reparse-point refusal (real Node fs backend)", () => {
  it("16. fedosConversationArchiveCliNodeFileSystem.deleteFile refuses a symlinked target, never follows it", () => {
    const dir = mkdtempSync(join(tmpdir(), "fedos-deletion-symlink-"));
    const realTarget = join(dir, "real-target.txt");
    const linkPath = join(dir, "link-to-target.pkg");
    writeFileSync(realTarget, "not an archive, just a canary file");
    let symlinkCreated = true;
    try {
      symlinkSync(realTarget, linkPath, "file");
    } catch {
      symlinkCreated = false;
    }
    try {
      if (!symlinkCreated) {
        // No symlink privilege in this environment (common on Windows without Developer Mode) -- cannot exercise the real-fs path here.
        expect(true).toBe(true);
        return;
      }
      const outcome = fedosConversationArchiveCliNodeFileSystem.deleteFile(linkPath);
      expect(outcome).toBe(false);
      expect(existsSync(realTarget)).toBe(true);
      expect(existsSync(linkPath)).toBe(true);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("17. fedosConversationArchiveCliNodeFileSystem.deleteFile treats a missing path as already-removed (true), never an error", () => {
    const dir = mkdtempSync(join(tmpdir(), "fedos-deletion-missing-"));
    try {
      expect(fedosConversationArchiveCliNodeFileSystem.deleteFile(join(dir, "never-existed.pkg"))).toBe(true);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe("Secure Runtime Alpha 5401-5480 -- Archive removal never touches live Conversation history, and vice versa", () => {
  it("18. executing an Archive-file removal plan does not call any Retention/Search authority -- the coordinator's own dependency set structurally excludes them", async () => {
    const fileSystem = fakeFileSystem();
    await exportOneArchive("/exports/conv", DIRECT_ID, fileSystem);
    const assessment = assessFedosLocalArchiveFileDeletion({ directoryPath: "/exports/conv", conversationId: DIRECT_ID, fileSystem });
    const plan = buildFedosLocalArchiveFileRemovalPlan("plan-archive-only", DIRECT_ID, { directoryPath: "/exports/conv", conversationId: DIRECT_ID, fileSystem });
    expect(assessment.targetExists).toBe(true);
    const persistence = new InMemoryFedosDeletionExecutionPersistence();

    const outcome = executeFedosLocalArchiveFileRemovalPlan(
      { plan, requestedBy: "local-user", confirmed: true, directoryPath: "/exports/conv", conversationId: DIRECT_ID },
      { persistence, fileSystem },
    );
    expect(outcome.outcome).toBe("executed");
    if (outcome.outcome !== "executed") throw new Error("unreachable");
    expect(outcome.record.steps).toEqual([{ target: "local-archive-file", operation: "remove-file", outcome: "applied", evidence: "local-verified" }]);
  });

  it("19. deleting live payload history (Retention tombstone + Search purge) leaves the tracked Archive file completely untouched", async () => {
    const fileSystem = fakeFileSystem();
    await exportOneArchive("/exports/conv", DIRECT_ID, fileSystem);

    const payloadStorage = new InMemoryFedosConversationPayloadStorage();
    const payloadId = toFedosConversationPayloadId("payload-archive-separation")!;
    payloadStorage.putPayload({ id: payloadId, conversationId: DIRECT_ID, mediaType: "application/octet-stream", byteLength: 1, createdAt: 1_700_000_000 }, new Uint8Array([1]));
    const retentionAuthority = new FedosPayloadRetentionAuthority({ retentionPersistence: new InMemoryFedosPayloadRetentionPersistence(), payloadStorage });
    const searchIndex = { reconcilePayloadRetention: () => 0 };
    const payloadAssessment = assessFedosLocalPayloadDeletion(payloadId, { retentionAuthority });
    const payloadPlan = buildFedosLocalPayloadDeletionPlan("plan-payload-only", payloadId, payloadAssessment);
    const payloadPersistence = new InMemoryFedosDeletionExecutionPersistence();

    executeFedosLocalPayloadDeletionPlan(
      { plan: payloadPlan, requestedBy: "local-user", confirmed: true, authorityReference: "local-user", reasonCode: "user_requested_placeholder" },
      { retentionAuthority, searchIndex, persistence: payloadPersistence },
    );

    expect(retentionAuthority.evaluatePayloadAccess(payloadId).outcome).toBe("denied");
    const archiveHandleAfterwards = resolveFedosDeletionArchiveFileHandle("/exports/conv", DIRECT_ID, fileSystem);
    expect(archiveHandleAfterwards.outcome).toBe("found");
  });
});
