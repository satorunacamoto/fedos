import { describe, it, expect, vi } from "vitest";
import {
  FEDOS_CONVERSATION_ARCHIVE_CLI_VERSION_INFO,
  describeFedosConversationArchiveCliPackage,
  fedosConversationArchiveCliContentHashMatches,
  fedosConversationArchiveCliPackageManifest,
  summarizeFedosConversationArchiveCliManifests,
} from "../src/os/messenger/conversations/archive_cli/fedos_conversation_archive_cli_metadata.js";
import {
  exportFedosConversationArchiveCliDirectory,
  fedosConversationArchiveCliPackageFileName,
  importFedosConversationArchiveCliDirectory,
  listFedosConversationArchiveCliDirectory,
  FEDOS_CONVERSATION_ARCHIVE_CLI_DIRECTORY_MANIFEST_FILE_NAME,
} from "../src/os/messenger/conversations/archive_cli/fedos_conversation_archive_cli_directory.js";
import { joinFedosConversationArchiveCliPath, type FedosConversationArchiveCliFileSystem } from "../src/os/messenger/conversations/archive_cli/fedos_conversation_archive_cli_file_system.js";
import { exportFedosConversationArchiveCliPackage, type FedosConversationArchiveCliExportRequest } from "../src/os/messenger/conversations/archive_cli/fedos_conversation_archive_cli_export.js";
import { FEDOS_CONVERSATION_ARCHIVE_CLI_PACKAGE_FORMAT_VERSION, type FedosConversationArchiveCliPackageV1 } from "../src/os/messenger/conversations/archive_cli/fedos_conversation_archive_cli_package.js";
import { FedosWasmConversationArchiveEncryptionAuthority, type FedosConversationArchiveEncryptionRuntimeBoundary } from "../src/os/messenger/conversations/archive/fedos_conversation_archive_encryption.js";
import { FEDOS_CONVERSATION_ARCHIVE_SCHEMA_VERSION } from "../src/os/messenger/conversations/archive/fedos_conversation_archive_schema_version.js";
import { InMemoryFedosConversationPersistence } from "../src/os/messenger/conversations/persistence/in_memory_fedos_conversation_persistence.js";
import { InMemoryFedosConversationMembershipPersistence } from "../src/os/messenger/conversations/membership/persistence/in_memory_fedos_conversation_membership_persistence.js";
import { InMemoryFedosConversationCapabilityPersistence } from "../src/os/messenger/conversations/capability/persistence/in_memory_fedos_conversation_capability_persistence.js";
import { InMemoryFedosConversationMessageEnvelopePersistence } from "../src/os/messenger/conversations/envelope/persistence/in_memory_fedos_conversation_message_envelope_persistence.js";
import { InMemoryFedosConversationPayloadStorage } from "../src/os/messenger/conversations/payload_storage/in_memory_fedos_conversation_payload_storage.js";
import { restoreFedosConversationArchiveBundle, type FedosConversationArchiveRestoreDependencies } from "../src/os/messenger/conversations/archive/fedos_conversation_archive_restore.js";
import type { FedosConversationArchiveCollectorDependencies } from "../src/os/messenger/conversations/archive/fedos_conversation_archive_collector.js";
import type { FedosConversationArchiveBundleV1 } from "../src/os/messenger/conversations/archive/fedos_conversation_archive_bundle.js";
import type { FedosMasterSeedAuthority } from "../src/os/core/vault/wasm/fedos_master_seed_authority.js";
import type { AeadCiphertextHandle, AeadCiphertextWire, AeadKeyHandle } from "../src/runtime/fedos_wasm_loader.js";
import { toFedosConversationId } from "../src/os/messenger/conversations/fedos_conversation_id.js";
import { toFedosBoardId, toFedosThreadId } from "../src/os/messenger/board/fedos_board_identifiers.js";
import { InMemoryFedosConversationDraftPersistence } from "../src/os/messenger/conversations/construction/in_memory_fedos_conversation_draft_persistence.js";

const DIRECT_ID = toFedosConversationId(toFedosBoardId("board-a")!, toFedosThreadId("thread-1")!);
const GROUP_ID = toFedosConversationId(toFedosBoardId("board-a")!, toFedosThreadId("thread-2")!);
const EMPTY_ID = toFedosConversationId(toFedosBoardId("board-a")!, toFedosThreadId("thread-3")!);
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
      if (id === undefined) return null;
      return { kind: "AeadCiphertextHandle", id } as unknown as AeadCiphertextHandle;
    }),
    decrypt: vi.fn(async (_key, _algorithm, _aadDomain, ciphertext) => {
      const id = (ciphertext as unknown as { id: string }).id;
      return byHandle.get(id) ?? null;
    }),
  };
}

/** An in-memory `FedosConversationArchiveCliFileSystem` fake -- Map-backed, mirrors this codebase's own `InMemory*` persistence convention. */
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

function makeBundle(conversationId: string, overrides: Partial<FedosConversationArchiveBundleV1> = {}): FedosConversationArchiveBundleV1 {
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
    ...overrides,
  };
}

const BASE_REQUEST_FIELDS = { suite: "ChaCha20Poly1305" as const, localAccountIndex: 0, counterpartyPublicKeyHex: "ab".repeat(32) };

describe("Secure Runtime Alpha 2341-2420 -- CLI metadata / inspect / summary / version / hash verification", () => {
  it("1. 'archive version display' names both this Arc's own packaging version and the unmodified Archive schema version", () => {
    expect(FEDOS_CONVERSATION_ARCHIVE_CLI_VERSION_INFO).toEqual({ packageFormatVersion: 1, archiveSchemaVersion: FEDOS_CONVERSATION_ARCHIVE_SCHEMA_VERSION });
  });

  it("2. 'archive metadata' returns exactly the Package's own cleartext manifest", () => {
    const manifest = {
      schemaVersion: FEDOS_CONVERSATION_ARCHIVE_SCHEMA_VERSION,
      conversationId: DIRECT_ID,
      exportedAt: 1_700_000_500,
      membershipCount: 2,
      capabilityEventCount: 0,
      envelopeCount: 3,
      payloadCount: 1,
      contentHash: "a".repeat(64),
    };
    const pkg: FedosConversationArchiveCliPackageV1 = { formatVersion: FEDOS_CONVERSATION_ARCHIVE_CLI_PACKAGE_FORMAT_VERSION, manifest, ciphertext: "wire" as unknown as AeadCiphertextWire };
    expect(fedosConversationArchiveCliPackageManifest(pkg)).toBe(manifest);
  });

  it("3. 'archive inspect' renders every manifest field as human-readable text", () => {
    const pkg: FedosConversationArchiveCliPackageV1 = {
      formatVersion: FEDOS_CONVERSATION_ARCHIVE_CLI_PACKAGE_FORMAT_VERSION,
      manifest: {
        schemaVersion: FEDOS_CONVERSATION_ARCHIVE_SCHEMA_VERSION,
        conversationId: DIRECT_ID,
        exportedAt: 1_700_000_500_000,
        membershipCount: 1,
        capabilityEventCount: 2,
        envelopeCount: 3,
        payloadCount: 4,
        contentHash: "deadbeef",
      },
      ciphertext: "wire" as unknown as AeadCiphertextWire,
    };
    const description = describeFedosConversationArchiveCliPackage(pkg);
    expect(description).toContain(`conversationId: ${DIRECT_ID}`);
    expect(description).toContain("memberships: 1");
    expect(description).toContain("capabilityEvents: 2");
    expect(description).toContain("envelopes: 3");
    expect(description).toContain("payloads: 4");
    expect(description).toContain("contentHash: deadbeef");
  });

  it("4. 'archive summary' aggregates counts and earliest/latest exportedAt across several manifests", () => {
    const manifests = [
      { schemaVersion: FEDOS_CONVERSATION_ARCHIVE_SCHEMA_VERSION, conversationId: "a", exportedAt: 100, membershipCount: 1, capabilityEventCount: 0, envelopeCount: 2, payloadCount: 0, contentHash: "x" },
      { schemaVersion: FEDOS_CONVERSATION_ARCHIVE_SCHEMA_VERSION, conversationId: "b", exportedAt: 300, membershipCount: 3, capabilityEventCount: 1, envelopeCount: 5, payloadCount: 2, contentHash: "y" },
      { schemaVersion: FEDOS_CONVERSATION_ARCHIVE_SCHEMA_VERSION, conversationId: "c", exportedAt: 200, membershipCount: 0, capabilityEventCount: 0, envelopeCount: 0, payloadCount: 0, contentHash: "z" },
    ];
    expect(summarizeFedosConversationArchiveCliManifests(manifests)).toEqual({
      conversationCount: 3,
      totalMembershipCount: 4,
      totalCapabilityEventCount: 1,
      totalEnvelopeCount: 7,
      totalPayloadCount: 2,
      earliestExportedAt: 100,
      latestExportedAt: 300,
    });
  });

  it("5. 'archive summary' over an EMPTY set of manifests fails closed to null earliest/latest, never a guessed sentinel", () => {
    expect(summarizeFedosConversationArchiveCliManifests([])).toEqual({
      conversationCount: 0,
      totalMembershipCount: 0,
      totalCapabilityEventCount: 0,
      totalEnvelopeCount: 0,
      totalPayloadCount: 0,
      earliestExportedAt: null,
      latestExportedAt: null,
    });
  });

  it("6. 'archive hash verification' confirms a genuine decrypted bundle against its own manifest", async () => {
    const deps = makeDeps();
    restoreFedosConversationArchiveBundle(makeBundle(DIRECT_ID), deps);
    const authority = new FedosWasmConversationArchiveEncryptionAuthority(fakeMasterSeedAuthority(vi.fn(async () => KEY_HANDLE)), fakeRoundTrippingRuntimeBoundary());
    const request: FedosConversationArchiveCliExportRequest = { conversationId: DIRECT_ID, exportedAt: 1_700_000_999, ...BASE_REQUEST_FIELDS };
    const exported = await exportFedosConversationArchiveCliPackage(request, deps, authority);
    if (exported.outcome !== "exported") throw new Error("unreachable");
    const bundle = makeBundle(DIRECT_ID, { exportedAt: 1_700_000_999 });
    expect(fedosConversationArchiveCliContentHashMatches(bundle, exported.package.manifest)).toBe(true);
  });

  it("7. 'archive hash verification' rejects a bundle that does not match a substituted manifest hash", () => {
    const bundle = makeBundle(DIRECT_ID);
    const manifest = {
      schemaVersion: FEDOS_CONVERSATION_ARCHIVE_SCHEMA_VERSION,
      conversationId: DIRECT_ID,
      exportedAt: 1_700_000_500,
      membershipCount: 0,
      capabilityEventCount: 0,
      envelopeCount: 0,
      payloadCount: 0,
      contentHash: "0".repeat(64),
    };
    expect(fedosConversationArchiveCliContentHashMatches(bundle, manifest)).toBe(false);
  });
});

describe("Secure Runtime Alpha 2341-2420 -- 'directory export' / 'archive list' / 'directory import'", () => {
  it("1. exports DIRECT, GROUP, and an EMPTY conversation into one directory, and 'archive list' names all three via the metadata manifest", async () => {
    const draftPersistence = new InMemoryFedosConversationDraftPersistence();
    draftPersistence.putDraft({ schemaVersion: 1, id: DIRECT_ID, mode: "direct", lifecycleState: "active", policyReference: "private-v1", creatorAuthority: "fedos", creatorPublicIdentifier: "alice", creatorIdentityId: null, createdAt: 1_700_000_000 });
    draftPersistence.putDraft({ schemaVersion: 1, id: GROUP_ID, mode: "private-group", lifecycleState: "active", policyReference: "private-v1", creatorAuthority: "fedos", creatorPublicIdentifier: "alice", creatorIdentityId: null, createdAt: 1_700_000_000 });

    const deps = makeDeps();
    restoreFedosConversationArchiveBundle(
      makeBundle(DIRECT_ID, {
        memberships: [
          {
            schemaVersion: 1,
            id: `${DIRECT_ID}::fedos::alice`,
            conversationId: DIRECT_ID,
            participantAuthority: "fedos",
            participantPublicIdentifier: "alice",
            participantIdentityId: null,
            role: "owner",
            state: "active",
            joinedAt: 1_700_000_000,
            endedAt: null,
          },
        ],
      }),
      deps,
    );
    restoreFedosConversationArchiveBundle(makeBundle(GROUP_ID), deps);
    restoreFedosConversationArchiveBundle(makeBundle(EMPTY_ID), deps);

    const boundary = fakeRoundTrippingRuntimeBoundary();
    const authority = new FedosWasmConversationArchiveEncryptionAuthority(fakeMasterSeedAuthority(vi.fn(async () => KEY_HANDLE)), boundary);
    const fileSystem = fakeFileSystem();
    const requests: FedosConversationArchiveCliExportRequest[] = [DIRECT_ID, GROUP_ID, EMPTY_ID].map((conversationId) => ({
      conversationId,
      exportedAt: 1_700_000_999,
      ...BASE_REQUEST_FIELDS,
    }));

    const exportResult = await exportFedosConversationArchiveCliDirectory(requests, deps, authority, "/exports/conv", 1_700_001_000, fileSystem);
    expect(exportResult.entries.every((entry) => entry.outcome === "exported")).toBe(true);
    expect(exportResult.directoryManifestWritten).toBe(true);
    expect(fileSystem.files.has(joinFedosConversationArchiveCliPath("/exports/conv", FEDOS_CONVERSATION_ARCHIVE_CLI_DIRECTORY_MANIFEST_FILE_NAME))).toBe(true);
    expect(fileSystem.files.has(joinFedosConversationArchiveCliPath("/exports/conv", fedosConversationArchiveCliPackageFileName(EMPTY_ID)))).toBe(true);

    const listed = listFedosConversationArchiveCliDirectory("/exports/conv", fileSystem);
    expect(listed).not.toBeNull();
    expect(listed?.length).toBe(3);
    const emptyEntry = listed?.find((entry) => entry.manifest.conversationId === EMPTY_ID);
    expect(emptyEntry?.manifest).toMatchObject({ membershipCount: 0, capabilityEventCount: 0, envelopeCount: 0, payloadCount: 0 });
    const directEntry = listed?.find((entry) => entry.manifest.conversationId === DIRECT_ID);
    expect(directEntry?.manifest.membershipCount).toBe(1);
  });

  it("2. 'archive list' fails closed to null when the directory's own index file is missing", () => {
    expect(listFedosConversationArchiveCliDirectory("/nowhere", fakeFileSystem())).toBeNull();
  });

  it("3. 'directory import' restores every listed Package into the target's five persistence ports", async () => {
    const sourceDeps = makeDeps();
    restoreFedosConversationArchiveBundle(makeBundle(DIRECT_ID), sourceDeps);
    restoreFedosConversationArchiveBundle(makeBundle(GROUP_ID), sourceDeps);

    const boundary = fakeRoundTrippingRuntimeBoundary();
    const authority = new FedosWasmConversationArchiveEncryptionAuthority(fakeMasterSeedAuthority(vi.fn(async () => KEY_HANDLE)), boundary);
    const fileSystem = fakeFileSystem();
    const requests: FedosConversationArchiveCliExportRequest[] = [DIRECT_ID, GROUP_ID].map((conversationId) => ({ conversationId, exportedAt: 1_700_000_999, ...BASE_REQUEST_FIELDS }));
    await exportFedosConversationArchiveCliDirectory(requests, sourceDeps, authority, "/exports/conv", 1_700_001_000, fileSystem);

    const targetDeps = makeDeps();
    const results = await importFedosConversationArchiveCliDirectory("/exports/conv", BASE_REQUEST_FIELDS, authority, targetDeps, fileSystem);
    expect(results).not.toBeNull();
    expect(results?.every((entry) => entry.outcome === "decrypted")).toBe(true);
    expect(targetDeps.conversationPersistence.getConversation(DIRECT_ID)).not.toBeNull();
    expect(targetDeps.conversationPersistence.getConversation(GROUP_ID)).not.toBeNull();
  });

  it("4. 'directory import' returns null for a directory whose own index is missing, without importing anything", async () => {
    const boundary = fakeRoundTrippingRuntimeBoundary();
    const authority = new FedosWasmConversationArchiveEncryptionAuthority(fakeMasterSeedAuthority(vi.fn(async () => KEY_HANDLE)), boundary);
    const targetDeps = makeDeps();
    const results = await importFedosConversationArchiveCliDirectory("/nowhere", BASE_REQUEST_FIELDS, authority, targetDeps, fakeFileSystem());
    expect(results).toBeNull();
    expect(targetDeps.conversationPersistence.listConversations().length).toBe(0);
  });

  it("5. 'directory import' tallies a package that fails to decode as 'invalid-package' without aborting the rest", async () => {
    const sourceDeps = makeDeps();
    restoreFedosConversationArchiveBundle(makeBundle(DIRECT_ID), sourceDeps);
    const boundary = fakeRoundTrippingRuntimeBoundary();
    const authority = new FedosWasmConversationArchiveEncryptionAuthority(fakeMasterSeedAuthority(vi.fn(async () => KEY_HANDLE)), boundary);
    const fileSystem = fakeFileSystem();
    await exportFedosConversationArchiveCliDirectory([{ conversationId: DIRECT_ID, exportedAt: 1_700_000_999, ...BASE_REQUEST_FIELDS }], sourceDeps, authority, "/exports/conv", 1_700_001_000, fileSystem);

    const fileName = fedosConversationArchiveCliPackageFileName(DIRECT_ID);
    fileSystem.files.set(joinFedosConversationArchiveCliPath("/exports/conv", fileName), new TextEncoder().encode("not a valid package"));

    const targetDeps = makeDeps();
    const results = await importFedosConversationArchiveCliDirectory("/exports/conv", BASE_REQUEST_FIELDS, authority, targetDeps, fileSystem);
    expect(results).toEqual([{ fileName, conversationId: DIRECT_ID, outcome: "invalid-package", result: null }]);
    expect(targetDeps.conversationPersistence.listConversations().length).toBe(0);
  });
});
