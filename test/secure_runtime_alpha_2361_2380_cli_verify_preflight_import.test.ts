import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  verifyFedosConversationArchiveCliPackage,
  preflightFedosConversationArchiveCliPackage,
  importFedosConversationArchiveCliPackage,
  type FedosConversationArchiveCliOpenRequest,
} from "../src/conversation/archive_cli/fedos_conversation_archive_cli_import.js";
import { exportFedosConversationArchiveCliPackage, type FedosConversationArchiveCliExportRequest } from "../src/conversation/archive_cli/fedos_conversation_archive_cli_export.js";
import type { FedosConversationArchiveCliPackageV1 } from "../src/conversation/archive_cli/fedos_conversation_archive_cli_package.js";
import { FedosWasmConversationArchiveEncryptionAuthority, type FedosConversationArchiveEncryptionRuntimeBoundary } from "../src/conversation/archive/fedos_conversation_archive_encryption.js";
import { InMemoryFedosConversationPersistence } from "../src/conversation/persistence/in_memory_fedos_conversation_persistence.js";
import { InMemoryFedosConversationMembershipPersistence } from "../src/conversation/membership/persistence/in_memory_fedos_conversation_membership_persistence.js";
import { InMemoryFedosConversationCapabilityPersistence } from "../src/conversation/capability/persistence/in_memory_fedos_conversation_capability_persistence.js";
import { InMemoryFedosConversationMessageEnvelopePersistence } from "../src/conversation/envelope/persistence/in_memory_fedos_conversation_message_envelope_persistence.js";
import { InMemoryFedosConversationPayloadStorage } from "../src/conversation/payload_storage/in_memory_fedos_conversation_payload_storage.js";
import { restoreFedosConversationArchiveBundle } from "../src/conversation/archive/fedos_conversation_archive_restore.js";
import type { FedosConversationArchiveCollectorDependencies } from "../src/conversation/archive/fedos_conversation_archive_collector.js";
import type { FedosConversationArchiveRestoreDependencies } from "../src/conversation/archive/fedos_conversation_archive_restore.js";
import type { FedosConversationArchiveDuplicateDetectionDependencies } from "../src/conversation/archive/fedos_conversation_archive_duplicate_detection.js";
import type { FedosConversationArchiveBundleV1 } from "../src/conversation/archive/fedos_conversation_archive_bundle.js";
import { FEDOS_CONVERSATION_ARCHIVE_SCHEMA_VERSION } from "../src/conversation/archive/fedos_conversation_archive_schema_version.js";
import type { FedosMasterSeedAuthority } from "../src/runtime/master_seed/fedos_master_seed_authority.js";
import type { AeadCiphertextHandle, AeadCiphertextWire, AeadKeyHandle } from "../src/runtime/fedos_wasm_loader.js";
import { toFedosConversationId } from "../src/conversation/fedos_conversation_id.js";
import { toFedosBoardId, toFedosThreadId } from "../src/board/fedos_board_identifiers.js";

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

/** "Real Runtime" -- structurally real (non-cryptographic) round trip, mirrors the prior Arc's own `fakeRoundTrippingRuntimeBoundary()`. */
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

function makeBundle(overrides: Partial<FedosConversationArchiveBundleV1> = {}): FedosConversationArchiveBundleV1 {
  return {
    schemaVersion: FEDOS_CONVERSATION_ARCHIVE_SCHEMA_VERSION,
    conversationId: CONVERSATION_ID,
    exportedAt: 1_700_000_500,
    conversation: {
      schemaVersion: 1,
      id: CONVERSATION_ID,
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
        id: `${CONVERSATION_ID}::fedos::alice`,
        conversationId: CONVERSATION_ID,
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
    envelopes: [],
    payloads: [],
    ...overrides,
  };
}

type Deps = FedosConversationArchiveRestoreDependencies & FedosConversationArchiveCollectorDependencies & FedosConversationArchiveDuplicateDetectionDependencies;

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

async function exportRealPackage(deps: Deps, boundary: FedosConversationArchiveEncryptionRuntimeBoundary): Promise<FedosConversationArchiveCliPackageV1> {
  restoreFedosConversationArchiveBundle(makeBundle(), deps);
  const authority = new FedosWasmConversationArchiveEncryptionAuthority(fakeMasterSeedAuthority(vi.fn(async () => KEY_HANDLE)), boundary);
  const request: FedosConversationArchiveCliExportRequest = { conversationId: CONVERSATION_ID, exportedAt: 1_700_000_999, ...BASE_REQUEST_FIELDS };
  const result = await exportFedosConversationArchiveCliPackage(request, deps, authority);
  if (result.outcome !== "exported") throw new Error("unreachable");
  return result.package;
}

describe("Secure Runtime Alpha 2341-2420 -- verifyFedosConversationArchiveCliPackage ('archive verify')", () => {
  it("1. decrypted -- a genuine, untampered Package verifies clean and touches no persistence", async () => {
    const exportDeps = makeDeps();
    const boundary = fakeRoundTrippingRuntimeBoundary();
    const pkg = await exportRealPackage(exportDeps, boundary);

    const importDeps = makeDeps();
    const authority = new FedosWasmConversationArchiveEncryptionAuthority(fakeMasterSeedAuthority(vi.fn(async () => KEY_HANDLE)), boundary);
    const request: FedosConversationArchiveCliOpenRequest = { package: pkg, ...BASE_REQUEST_FIELDS };
    const result = await verifyFedosConversationArchiveCliPackage(request, authority);
    expect(result.outcome).toBe("decrypted");
    expect(importDeps.conversationPersistence.listConversations().length).toBe(0);
  });

  it("2. TAMPERED ARCHIVE -- a Package whose manifest.conversationId was altered after export fails manifest-mismatch", async () => {
    const boundary = fakeRoundTrippingRuntimeBoundary();
    const pkg = await exportRealPackage(makeDeps(), boundary);
    const tampered: FedosConversationArchiveCliPackageV1 = { ...pkg, manifest: { ...pkg.manifest, conversationId: "board-a::thread-9999" } };

    const authority = new FedosWasmConversationArchiveEncryptionAuthority(fakeMasterSeedAuthority(vi.fn(async () => KEY_HANDLE)), boundary);
    const result = await verifyFedosConversationArchiveCliPackage({ package: tampered, ...BASE_REQUEST_FIELDS }, authority);
    expect(result).toEqual({ outcome: "manifest-mismatch" });
  });

  it("3. TAMPERED ARCHIVE -- a Package whose manifest.contentHash was altered after export fails manifest-mismatch", async () => {
    const boundary = fakeRoundTrippingRuntimeBoundary();
    const pkg = await exportRealPackage(makeDeps(), boundary);
    const tampered: FedosConversationArchiveCliPackageV1 = { ...pkg, manifest: { ...pkg.manifest, contentHash: "f".repeat(64) } };

    const authority = new FedosWasmConversationArchiveEncryptionAuthority(fakeMasterSeedAuthority(vi.fn(async () => KEY_HANDLE)), boundary);
    const result = await verifyFedosConversationArchiveCliPackage({ package: tampered, ...BASE_REQUEST_FIELDS }, authority);
    expect(result).toEqual({ outcome: "manifest-mismatch" });
  });

  it("4. TAMPERED ARCHIVE -- a Package whose ciphertext string was substituted for an unrelated wire fails closed (not manifest-mismatch)", async () => {
    const boundary = fakeRoundTrippingRuntimeBoundary();
    const pkg = await exportRealPackage(makeDeps(), boundary);
    const tampered: FedosConversationArchiveCliPackageV1 = { ...pkg, ciphertext: "totally-unknown-wire" as unknown as AeadCiphertextWire };

    const authority = new FedosWasmConversationArchiveEncryptionAuthority(fakeMasterSeedAuthority(vi.fn(async () => KEY_HANDLE)), boundary);
    const result = await verifyFedosConversationArchiveCliPackage({ package: tampered, ...BASE_REQUEST_FIELDS }, authority);
    expect(result).toEqual({ outcome: "failed" });
  });

  it("5. key-unavailable passes through verbatim", async () => {
    const boundary = fakeRoundTrippingRuntimeBoundary();
    const pkg = await exportRealPackage(makeDeps(), boundary);
    const authority = new FedosWasmConversationArchiveEncryptionAuthority(fakeMasterSeedAuthority(vi.fn(async () => null)), boundary);
    const result = await verifyFedosConversationArchiveCliPackage({ package: pkg, ...BASE_REQUEST_FIELDS }, authority);
    expect(result).toEqual({ outcome: "key-unavailable" });
  });
});

describe("Secure Runtime Alpha 2341-2420 -- preflightFedosConversationArchiveCliPackage ('archive preflight')", () => {
  let boundary: FedosConversationArchiveEncryptionRuntimeBoundary;
  let pkg: FedosConversationArchiveCliPackageV1;

  beforeEach(async () => {
    boundary = fakeRoundTrippingRuntimeBoundary();
    pkg = await exportRealPackage(makeDeps(), boundary);
  });

  it("1. decrypted -- reports every record as new against an empty target, and writes nothing", async () => {
    const targetDeps = makeDeps();
    const authority = new FedosWasmConversationArchiveEncryptionAuthority(fakeMasterSeedAuthority(vi.fn(async () => KEY_HANDLE)), boundary);
    const result = await preflightFedosConversationArchiveCliPackage({ package: pkg, ...BASE_REQUEST_FIELDS }, authority, targetDeps);
    expect(result.outcome).toBe("decrypted");
    if (result.outcome !== "decrypted") throw new Error("unreachable");
    expect(result.report.conversation).toBe("new");
    expect(result.report.memberships).toEqual({ new: 1, duplicate: 0, conflict: 0 });
    expect(targetDeps.conversationPersistence.listConversations().length).toBe(0);
  });

  it("2. DUPLICATE ARCHIVE -- reports duplicate once the identical bundle already exists at the target", async () => {
    const targetDeps = makeDeps();
    restoreFedosConversationArchiveBundle(makeBundle(), targetDeps);
    const authority = new FedosWasmConversationArchiveEncryptionAuthority(fakeMasterSeedAuthority(vi.fn(async () => KEY_HANDLE)), boundary);
    const result = await preflightFedosConversationArchiveCliPackage({ package: pkg, ...BASE_REQUEST_FIELDS }, authority, targetDeps);
    expect(result.outcome).toBe("decrypted");
    if (result.outcome !== "decrypted") throw new Error("unreachable");
    expect(result.report.conversation).toBe("duplicate");
    expect(result.report.memberships.duplicate).toBe(1);
  });

  it("3. a non-decrypted outcome (manifest-mismatch) passes through verbatim, never reaching duplicate detection", async () => {
    const targetDeps = makeDeps();
    const tampered: FedosConversationArchiveCliPackageV1 = { ...pkg, manifest: { ...pkg.manifest, contentHash: "f".repeat(64) } };
    const authority = new FedosWasmConversationArchiveEncryptionAuthority(fakeMasterSeedAuthority(vi.fn(async () => KEY_HANDLE)), boundary);
    const result = await preflightFedosConversationArchiveCliPackage({ package: tampered, ...BASE_REQUEST_FIELDS }, authority, targetDeps);
    expect(result).toEqual({ outcome: "manifest-mismatch" });
  });
});

describe("Secure Runtime Alpha 2341-2420 -- importFedosConversationArchiveCliPackage ('archive import')", () => {
  let boundary: FedosConversationArchiveEncryptionRuntimeBoundary;
  let pkg: FedosConversationArchiveCliPackageV1;

  beforeEach(async () => {
    boundary = fakeRoundTrippingRuntimeBoundary();
    pkg = await exportRealPackage(makeDeps(), boundary);
  });

  it("1. decrypted -- a fresh import inserts every record", async () => {
    const targetDeps = makeDeps();
    const authority = new FedosWasmConversationArchiveEncryptionAuthority(fakeMasterSeedAuthority(vi.fn(async () => KEY_HANDLE)), boundary);
    const result = await importFedosConversationArchiveCliPackage({ package: pkg, ...BASE_REQUEST_FIELDS }, authority, targetDeps);
    expect(result.outcome).toBe("decrypted");
    if (result.outcome !== "decrypted") throw new Error("unreachable");
    expect(result.result.conversation).toBe("inserted");
    expect(result.result.memberships).toEqual({ inserted: 1, duplicate: 0, conflict: 0, failed: 0, invalid: 0 });
    expect(targetDeps.conversationPersistence.getConversation(CONVERSATION_ID)).not.toBeNull();
  });

  it("2. DUPLICATE ARCHIVE -- importing the SAME Package twice reports every record duplicate the second time", async () => {
    const targetDeps = makeDeps();
    const authority = new FedosWasmConversationArchiveEncryptionAuthority(fakeMasterSeedAuthority(vi.fn(async () => KEY_HANDLE)), boundary);
    const first = await importFedosConversationArchiveCliPackage({ package: pkg, ...BASE_REQUEST_FIELDS }, authority, targetDeps);
    expect(first.outcome).toBe("decrypted");
    if (first.outcome !== "decrypted") throw new Error("unreachable");
    expect(first.result.conversation).toBe("inserted");

    const second = await importFedosConversationArchiveCliPackage({ package: pkg, ...BASE_REQUEST_FIELDS }, authority, targetDeps);
    expect(second.outcome).toBe("decrypted");
    if (second.outcome !== "decrypted") throw new Error("unreachable");
    expect(second.result.conversation).toBe("duplicate");
    expect(second.result.memberships.duplicate).toBe(1);
  });

  it("3. TAMPERED ARCHIVE -- a manifest-mismatched Package is never restored", async () => {
    const targetDeps = makeDeps();
    const tampered: FedosConversationArchiveCliPackageV1 = { ...pkg, manifest: { ...pkg.manifest, conversationId: "board-a::thread-9999" } };
    const authority = new FedosWasmConversationArchiveEncryptionAuthority(fakeMasterSeedAuthority(vi.fn(async () => KEY_HANDLE)), boundary);
    const result = await importFedosConversationArchiveCliPackage({ package: tampered, ...BASE_REQUEST_FIELDS }, authority, targetDeps);
    expect(result).toEqual({ outcome: "manifest-mismatch" });
    expect(targetDeps.conversationPersistence.listConversations().length).toBe(0);
  });

  it("4. a SAME-id, DIFFERENT-content record (conflict) is tallied, not silently overwritten", async () => {
    const targetDeps = makeDeps();
    const conflicting = makeBundle({ conversation: { ...makeBundle().conversation, createdAt: 1_700_000_001 } });
    restoreFedosConversationArchiveBundle(conflicting, targetDeps);
    const authority = new FedosWasmConversationArchiveEncryptionAuthority(fakeMasterSeedAuthority(vi.fn(async () => KEY_HANDLE)), boundary);
    const result = await importFedosConversationArchiveCliPackage({ package: pkg, ...BASE_REQUEST_FIELDS }, authority, targetDeps);
    expect(result.outcome).toBe("decrypted");
    if (result.outcome !== "decrypted") throw new Error("unreachable");
    expect(result.result.conversation).toBe("conflict");
  });
});
