import { describe, it, expect, vi } from "vitest";
import {
  deserializeFedosConversationArchiveCliMultiPackageFromBytes,
  serializeFedosConversationArchiveCliMultiPackageToBytes,
} from "../src/os/messenger/conversations/archive_cli/fedos_conversation_archive_cli_package_codec.js";
import { FEDOS_CONVERSATION_ARCHIVE_CLI_PACKAGE_FORMAT_VERSION, type FedosConversationArchiveCliMultiPackageV1 } from "../src/os/messenger/conversations/archive_cli/fedos_conversation_archive_cli_package.js";
import { summarizeFedosConversationArchiveCliManifests } from "../src/os/messenger/conversations/archive_cli/fedos_conversation_archive_cli_metadata.js";
import { exportFedosConversationArchiveCliPackage, type FedosConversationArchiveCliExportRequest } from "../src/os/messenger/conversations/archive_cli/fedos_conversation_archive_cli_export.js";
import { importFedosConversationArchiveCliPackage } from "../src/os/messenger/conversations/archive_cli/fedos_conversation_archive_cli_import.js";
import {
  exportFedosConversationArchiveCliDirectory,
  importFedosConversationArchiveCliDirectory,
  listFedosConversationArchiveCliDirectory,
} from "../src/os/messenger/conversations/archive_cli/fedos_conversation_archive_cli_directory.js";
import type { FedosConversationArchiveCliFileSystem } from "../src/os/messenger/conversations/archive_cli/fedos_conversation_archive_cli_file_system.js";
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
import type { FedosPersistedConversationMessageEnvelopeV1 } from "../src/os/messenger/conversations/envelope/persistence/fedos_persisted_conversation_message_envelope_v1.js";
import type { FedosPersistedConversationPayloadV1 } from "../src/os/messenger/conversations/payload_storage/fedos_persisted_conversation_payload_v1.js";
import type { FedosMasterSeedAuthority } from "../src/os/core/vault/wasm/fedos_master_seed_authority.js";
import type { AeadCiphertextHandle, AeadCiphertextWire, AeadKeyHandle } from "../src/runtime/fedos_wasm_loader.js";
import { toFedosConversationId } from "../src/os/messenger/conversations/fedos_conversation_id.js";
import { toFedosBoardId, toFedosThreadId } from "../src/os/messenger/board/fedos_board_identifiers.js";
import { Buffer } from "node:buffer";

const CONVERSATION_ID = toFedosConversationId(toFedosBoardId("board-a")!, toFedosThreadId("thread-1")!);
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

function fakeFileSystem(): FedosConversationArchiveCliFileSystem & { readonly files: Map<string, Uint8Array> } {
  const files = new Map<string, Uint8Array>();
  return {
    files,
    readFile: (path) => files.get(path) ?? null,
    writeFile: (path, bytes) => {
      files.set(path, Uint8Array.from(bytes));
      return true;
    },
    listFiles: (directoryPath) => [...files.keys()].filter((key) => key.startsWith(`${directoryPath}/`)).map((key) => key.slice(directoryPath.length + 1)),
    deleteFile: (path) => {
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

const BASE_REQUEST_FIELDS = { suite: "ChaCha20Poly1305" as const, localAccountIndex: 0, counterpartyPublicKeyHex: "ab".repeat(32) };
const LARGE_ENVELOPE_COUNT = 1_000;

function makeLargeBundle(conversationId: string): FedosConversationArchiveBundleV1 {
  const envelopes: FedosPersistedConversationMessageEnvelopeV1[] = [];
  const payloads: FedosPersistedConversationPayloadV1[] = [];
  for (let i = 0; i < LARGE_ENVELOPE_COUNT; i += 1) {
    const payloadId = `payload-${i}`;
    payloads.push({
      schemaVersion: 1,
      id: payloadId,
      conversationId,
      mediaType: "application/octet-stream",
      byteLength: 3,
      createdAt: 1_700_000_000 + i,
      bytesBase64: Buffer.from([i % 256, (i + 1) % 256, (i + 2) % 256]).toString("base64"),
    });
    envelopes.push({
      schemaVersion: 1,
      id: `envelope-${i}`,
      conversationId,
      senderMembershipId: `${conversationId}::fedos::alice`,
      payloadId,
      encryptionSuite: "ChaCha20Poly1305",
      keyEpoch: 0,
      createdAt: 1_700_000_000 + i,
      replyToEnvelopeId: null,
    });
  }

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
    envelopes,
    payloads,
  };
}

describe("Secure Runtime Alpha 2341-2420 -- LARGE ARCHIVE (1,000 envelopes/payloads)", () => {
  it("1. exports, verifies, and imports a large conversation losslessly end to end", async () => {
    const sourceDeps = makeDeps();
    const bundle = makeLargeBundle(CONVERSATION_ID);
    restoreFedosConversationArchiveBundle(bundle, sourceDeps);

    const boundary = fakeRoundTrippingRuntimeBoundary();
    const authority = new FedosWasmConversationArchiveEncryptionAuthority(fakeMasterSeedAuthority(vi.fn(async () => KEY_HANDLE)), boundary);
    const request: FedosConversationArchiveCliExportRequest = { conversationId: CONVERSATION_ID, exportedAt: 1_700_000_999, ...BASE_REQUEST_FIELDS };
    const exported = await exportFedosConversationArchiveCliPackage(request, sourceDeps, authority);
    expect(exported.outcome).toBe("exported");
    if (exported.outcome !== "exported") throw new Error("unreachable");
    expect(exported.package.manifest.envelopeCount).toBe(LARGE_ENVELOPE_COUNT);
    expect(exported.package.manifest.payloadCount).toBe(LARGE_ENVELOPE_COUNT);

    const targetDeps = makeDeps();
    const imported = await importFedosConversationArchiveCliPackage({ package: exported.package, ...BASE_REQUEST_FIELDS }, authority, targetDeps);
    expect(imported.outcome).toBe("decrypted");
    if (imported.outcome !== "decrypted") throw new Error("unreachable");
    expect(imported.result.envelopes).toEqual({ inserted: LARGE_ENVELOPE_COUNT, duplicate: 0, conflict: 0, failed: 0, invalid: 0, denied: 0 });
    expect(imported.result.payloads).toEqual({ inserted: LARGE_ENVELOPE_COUNT, duplicate: 0, conflict: 0, failed: 0, invalid: 0, denied: 0 });

    const restoredPayload = targetDeps.payloadStorage.getPayload("payload-500" as never);
    expect(restoredPayload).not.toBeNull();
    expect([...(restoredPayload?.bytes ?? [])]).toEqual([500 % 256, 501 % 256, 502 % 256]);
  });

  it("2. 'directory export' + 'archive list' + 'directory import' round-trips the SAME large conversation via one file on the injected file system", async () => {
    const sourceDeps = makeDeps();
    restoreFedosConversationArchiveBundle(makeLargeBundle(CONVERSATION_ID), sourceDeps);

    const boundary = fakeRoundTrippingRuntimeBoundary();
    const authority = new FedosWasmConversationArchiveEncryptionAuthority(fakeMasterSeedAuthority(vi.fn(async () => KEY_HANDLE)), boundary);
    const fileSystem = fakeFileSystem();
    await exportFedosConversationArchiveCliDirectory(
      [{ conversationId: CONVERSATION_ID, exportedAt: 1_700_000_999, ...BASE_REQUEST_FIELDS }],
      sourceDeps,
      authority,
      "/exports/large",
      1_700_001_000,
      fileSystem,
    );

    const listed = listFedosConversationArchiveCliDirectory("/exports/large", fileSystem);
    expect(listed?.[0]?.manifest.envelopeCount).toBe(LARGE_ENVELOPE_COUNT);

    const targetDeps = makeDeps();
    const results = await importFedosConversationArchiveCliDirectory("/exports/large", BASE_REQUEST_FIELDS, authority, targetDeps, fileSystem);
    expect(results?.[0]?.outcome).toBe("decrypted");
    expect(results?.[0]?.result?.envelopes.inserted).toBe(LARGE_ENVELOPE_COUNT);
  });
});

describe("Secure Runtime Alpha 2341-2420 -- 'multiple archive bundle' packaging, end to end", () => {
  it("1. bundles several real exported Packages (large + empty) into one multi-Package unit and round-trips it byte-for-byte", async () => {
    const deps = makeDeps();
    restoreFedosConversationArchiveBundle(makeLargeBundle(CONVERSATION_ID), deps);
    const emptyId = toFedosConversationId(toFedosBoardId("board-a")!, toFedosThreadId("thread-empty")!);
    restoreFedosConversationArchiveBundle(
      {
        schemaVersion: FEDOS_CONVERSATION_ARCHIVE_SCHEMA_VERSION,
        conversationId: emptyId,
        exportedAt: 1_700_000_500,
        conversation: { schemaVersion: 1, id: emptyId, mode: "public", boardId: "board-a", rootThreadId: "thread-empty", rootPostId: "thread-empty", policyReference: "public-v1", createdAt: 1_700_000_000 },
        memberships: [],
        capabilityEvents: [],
        envelopes: [],
        payloads: [],
      },
      deps,
    );

    const boundary = fakeRoundTrippingRuntimeBoundary();
    const authority = new FedosWasmConversationArchiveEncryptionAuthority(fakeMasterSeedAuthority(vi.fn(async () => KEY_HANDLE)), boundary);
    const largeExport = await exportFedosConversationArchiveCliPackage({ conversationId: CONVERSATION_ID, exportedAt: 1_700_000_999, ...BASE_REQUEST_FIELDS }, deps, authority);
    const emptyExport = await exportFedosConversationArchiveCliPackage({ conversationId: emptyId, exportedAt: 1_700_000_999, ...BASE_REQUEST_FIELDS }, deps, authority);
    if (largeExport.outcome !== "exported" || emptyExport.outcome !== "exported") throw new Error("unreachable");

    const multi: FedosConversationArchiveCliMultiPackageV1 = {
      formatVersion: FEDOS_CONVERSATION_ARCHIVE_CLI_PACKAGE_FORMAT_VERSION,
      packages: [largeExport.package, emptyExport.package],
    };
    const decoded = deserializeFedosConversationArchiveCliMultiPackageFromBytes(serializeFedosConversationArchiveCliMultiPackageToBytes(multi));
    expect(decoded).toEqual(multi);

    const summary = summarizeFedosConversationArchiveCliManifests(decoded!.packages.map((pkg) => pkg.manifest));
    expect(summary.conversationCount).toBe(2);
    expect(summary.totalEnvelopeCount).toBe(LARGE_ENVELOPE_COUNT);
    expect(summary.totalPayloadCount).toBe(LARGE_ENVELOPE_COUNT);

    const targetDeps = makeDeps();
    for (const pkg of decoded!.packages) {
      const imported = await importFedosConversationArchiveCliPackage({ package: pkg, ...BASE_REQUEST_FIELDS }, authority, targetDeps);
      expect(imported.outcome).toBe("decrypted");
    }
    expect(targetDeps.conversationPersistence.getConversation(CONVERSATION_ID)).not.toBeNull();
    expect(targetDeps.conversationPersistence.getConversation(emptyId)).not.toBeNull();
  });
});
