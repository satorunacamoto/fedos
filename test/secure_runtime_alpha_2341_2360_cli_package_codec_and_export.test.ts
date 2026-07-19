import { describe, it, expect, vi } from "vitest";
import {
  FEDOS_CONVERSATION_ARCHIVE_CLI_PACKAGE_FORMAT_VERSION,
  type FedosConversationArchiveCliMultiPackageV1,
  type FedosConversationArchiveCliPackageV1,
} from "../src/conversation/archive_cli/fedos_conversation_archive_cli_package.js";
import {
  deserializeFedosConversationArchiveCliMultiPackageFromBytes,
  deserializeFedosConversationArchiveCliPackageFromBytes,
  serializeFedosConversationArchiveCliMultiPackageToBytes,
  serializeFedosConversationArchiveCliPackageToBytes,
} from "../src/conversation/archive_cli/fedos_conversation_archive_cli_package_codec.js";
import { exportFedosConversationArchiveCliPackage, type FedosConversationArchiveCliExportRequest } from "../src/conversation/archive_cli/fedos_conversation_archive_cli_export.js";
import { FedosWasmConversationArchiveEncryptionAuthority, type FedosConversationArchiveEncryptionRuntimeBoundary } from "../src/conversation/archive/fedos_conversation_archive_encryption.js";
import { FEDOS_CONVERSATION_ARCHIVE_SCHEMA_VERSION } from "../src/conversation/archive/fedos_conversation_archive_schema_version.js";
import { InMemoryFedosConversationPersistence } from "../src/conversation/persistence/in_memory_fedos_conversation_persistence.js";
import { InMemoryFedosConversationMembershipPersistence } from "../src/conversation/membership/persistence/in_memory_fedos_conversation_membership_persistence.js";
import { InMemoryFedosConversationCapabilityPersistence } from "../src/conversation/capability/persistence/in_memory_fedos_conversation_capability_persistence.js";
import { InMemoryFedosConversationMessageEnvelopePersistence } from "../src/conversation/envelope/persistence/in_memory_fedos_conversation_message_envelope_persistence.js";
import { InMemoryFedosConversationPayloadStorage } from "../src/conversation/payload_storage/in_memory_fedos_conversation_payload_storage.js";
import { restoreFedosConversationArchiveBundle, type FedosConversationArchiveRestoreDependencies } from "../src/conversation/archive/fedos_conversation_archive_restore.js";
import type { FedosConversationArchiveCollectorDependencies } from "../src/conversation/archive/fedos_conversation_archive_collector.js";
import type { FedosConversationArchiveBundleV1 } from "../src/conversation/archive/fedos_conversation_archive_bundle.js";
import type { FedosMasterSeedAuthority } from "../src/runtime/master_seed/fedos_master_seed_authority.js";
import type { AeadCiphertextHandle, AeadCiphertextWire, AeadKeyHandle } from "../src/runtime/fedos_wasm_loader.js";
import { toFedosConversationId } from "../src/conversation/fedos_conversation_id.js";
import { toFedosBoardId, toFedosThreadId } from "../src/board/fedos_board_identifiers.js";
import { InMemoryFedosConversationDraftPersistence } from "../src/conversation/construction/in_memory_fedos_conversation_draft_persistence.js";

const DIRECT_CONVERSATION_ID = toFedosConversationId(toFedosBoardId("board-a")!, toFedosThreadId("thread-1")!);
const GROUP_CONVERSATION_ID = toFedosConversationId(toFedosBoardId("board-a")!, toFedosThreadId("thread-2")!);

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

/** "Real Runtime" -- a structurally real (non-cryptographic) encrypt/decrypt round trip, mirrors `fakeRoundTrippingRuntimeBoundary()` in `secure_runtime_alpha_1561_1580_archive_encrypted_export_import.test.ts`. */
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

/** `FedosPersistedConversationRecordV1.mode` is structurally always `"public"` (Alpha 748's own validator rejects any other value for THIS canonical record) -- "Direct"/"Group" classification lives on an entirely separate `FedosPersistedConversationDraftRecordV1` (Alpha 894, see `putDraftClassification` below), not on this field. */
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

/** Labels `conversationId` as `"direct"`/`"private-group"` on the SEPARATE Draft port -- reuses `FedosConversationDraftPersistence` exactly as `fedos_conversation_search_mode_index.ts` (Alpha 2501-2580) already does, purely so this Arc's own "Direct"/"Group" verification exercises a conversation actually classified as one or the other, alongside (never instead of) the Archive Bundle's own always-"public" conversation record. */
function putDraftClassification(draftPersistence: InMemoryFedosConversationDraftPersistence, conversationId: string, mode: "direct" | "private-group"): void {
  draftPersistence.putDraft({
    schemaVersion: 1,
    id: conversationId,
    mode,
    lifecycleState: "active",
    policyReference: "private-v1",
    creatorAuthority: "fedos",
    creatorPublicIdentifier: "alice",
    creatorIdentityId: null,
    createdAt: 1_700_000_000,
  });
}

function makeCollectorDeps(): FedosConversationArchiveRestoreDependencies & FedosConversationArchiveCollectorDependencies {
  return {
    conversationPersistence: new InMemoryFedosConversationPersistence(),
    membershipPersistence: new InMemoryFedosConversationMembershipPersistence(),
    capabilityPersistence: new InMemoryFedosConversationCapabilityPersistence(),
    envelopePersistence: new InMemoryFedosConversationMessageEnvelopePersistence(),
    payloadStorage: new InMemoryFedosConversationPayloadStorage(),
  };
}

const BASE_REQUEST_FIELDS = { suite: "ChaCha20Poly1305" as const, localAccountIndex: 0, counterpartyPublicKeyHex: "ab".repeat(32) };

function makePackage(): FedosConversationArchiveCliPackageV1 {
  return {
    formatVersion: FEDOS_CONVERSATION_ARCHIVE_CLI_PACKAGE_FORMAT_VERSION,
    manifest: {
      schemaVersion: FEDOS_CONVERSATION_ARCHIVE_SCHEMA_VERSION,
      conversationId: DIRECT_CONVERSATION_ID,
      exportedAt: 1_700_000_500,
      membershipCount: 0,
      capabilityEventCount: 0,
      envelopeCount: 0,
      payloadCount: 0,
      contentHash: "0".repeat(64),
    },
    ciphertext: "wire-handle-1" as unknown as AeadCiphertextWire,
  };
}

describe("Secure Runtime Alpha 2341-2420 -- CLI Package Codec (single)", () => {
  it("1. round-trips a Package byte-for-byte", () => {
    const pkg = makePackage();
    const decoded = deserializeFedosConversationArchiveCliPackageFromBytes(serializeFedosConversationArchiveCliPackageToBytes(pkg));
    expect(decoded).toEqual(pkg);
  });

  it("2. rejects a mismatched formatVersion", () => {
    const bytes = new TextEncoder().encode(JSON.stringify({ ...makePackage(), formatVersion: 99 }));
    expect(deserializeFedosConversationArchiveCliPackageFromBytes(bytes)).toBeNull();
  });

  it("3. rejects an unknown top-level field", () => {
    const bytes = new TextEncoder().encode(JSON.stringify({ ...makePackage(), extra: "nope" }));
    expect(deserializeFedosConversationArchiveCliPackageFromBytes(bytes)).toBeNull();
  });

  it("4. rejects a Package whose nested manifest fails its own deep validation", () => {
    const pkg = makePackage();
    const bytes = new TextEncoder().encode(JSON.stringify({ ...pkg, manifest: { ...pkg.manifest, membershipCount: -1 } }));
    expect(deserializeFedosConversationArchiveCliPackageFromBytes(bytes)).toBeNull();
  });

  it("5. rejects malformed JSON", () => {
    expect(deserializeFedosConversationArchiveCliPackageFromBytes(new TextEncoder().encode("not json"))).toBeNull();
  });

  it("6. rejects an empty ciphertext string", () => {
    const bytes = new TextEncoder().encode(JSON.stringify({ ...makePackage(), ciphertext: "" }));
    expect(deserializeFedosConversationArchiveCliPackageFromBytes(bytes)).toBeNull();
  });
});

describe("Secure Runtime Alpha 2341-2420 -- CLI Package Codec (multiple archive bundle)", () => {
  it("1. round-trips a multi-Package bundle of several Packages", () => {
    const multi: FedosConversationArchiveCliMultiPackageV1 = {
      formatVersion: FEDOS_CONVERSATION_ARCHIVE_CLI_PACKAGE_FORMAT_VERSION,
      packages: [makePackage(), { ...makePackage(), manifest: { ...makePackage().manifest, conversationId: GROUP_CONVERSATION_ID } }],
    };
    const decoded = deserializeFedosConversationArchiveCliMultiPackageFromBytes(serializeFedosConversationArchiveCliMultiPackageToBytes(multi));
    expect(decoded).toEqual(multi);
  });

  it("2. round-trips an EMPTY multi-Package bundle", () => {
    const multi: FedosConversationArchiveCliMultiPackageV1 = { formatVersion: FEDOS_CONVERSATION_ARCHIVE_CLI_PACKAGE_FORMAT_VERSION, packages: [] };
    expect(deserializeFedosConversationArchiveCliMultiPackageFromBytes(serializeFedosConversationArchiveCliMultiPackageToBytes(multi))).toEqual(multi);
  });

  it("3. is all-or-nothing -- one corrupt nested Package fails the WHOLE bundle closed", () => {
    const good = makePackage();
    const bytes = new TextEncoder().encode(
      JSON.stringify({ formatVersion: FEDOS_CONVERSATION_ARCHIVE_CLI_PACKAGE_FORMAT_VERSION, packages: [good, { ...good, ciphertext: "" }] }),
    );
    expect(deserializeFedosConversationArchiveCliMultiPackageFromBytes(bytes)).toBeNull();
  });

  it("4. rejects a mismatched top-level formatVersion", () => {
    const bytes = new TextEncoder().encode(JSON.stringify({ formatVersion: 99, packages: [] }));
    expect(deserializeFedosConversationArchiveCliMultiPackageFromBytes(bytes)).toBeNull();
  });
});

describe("Secure Runtime Alpha 2341-2420 -- exportFedosConversationArchiveCliPackage ('archive export')", () => {
  it("1. conversation-not-found -- no conversation record exists for the requested id", async () => {
    const deps = makeCollectorDeps();
    const authority = new FedosWasmConversationArchiveEncryptionAuthority(fakeMasterSeedAuthority(vi.fn(async () => KEY_HANDLE)), fakeRoundTrippingRuntimeBoundary());
    const request: FedosConversationArchiveCliExportRequest = { conversationId: DIRECT_CONVERSATION_ID, exportedAt: 1_700_000_999, ...BASE_REQUEST_FIELDS };
    const result = await exportFedosConversationArchiveCliPackage(request, deps, authority);
    expect(result).toEqual({ outcome: "conversation-not-found" });
  });

  it("2. an Authority failure (key-unavailable) passes through verbatim, once the conversation IS found", async () => {
    const deps = makeCollectorDeps();
    restoreFedosConversationArchiveBundle(makeBundle(DIRECT_CONVERSATION_ID), deps);
    const authority = new FedosWasmConversationArchiveEncryptionAuthority(fakeMasterSeedAuthority(vi.fn(async () => null)), fakeRoundTrippingRuntimeBoundary());
    const request: FedosConversationArchiveCliExportRequest = { conversationId: DIRECT_CONVERSATION_ID, exportedAt: 1_700_000_999, ...BASE_REQUEST_FIELDS };
    const result = await exportFedosConversationArchiveCliPackage(request, deps, authority);
    expect(result).toEqual({ outcome: "key-unavailable" });
  });

  it("3. exported -- a conversation classified DIRECT on the Draft port packages into a Package whose manifest matches the collected bundle", async () => {
    const deps = makeCollectorDeps();
    const draftPersistence = new InMemoryFedosConversationDraftPersistence();
    putDraftClassification(draftPersistence, DIRECT_CONVERSATION_ID, "direct");
    const bundle = makeBundle(DIRECT_CONVERSATION_ID, {
      memberships: [
        {
          schemaVersion: 1,
          id: `${DIRECT_CONVERSATION_ID}::fedos::alice`,
          conversationId: DIRECT_CONVERSATION_ID,
          participantAuthority: "fedos",
          participantPublicIdentifier: "alice",
          participantIdentityId: null,
          role: "owner",
          state: "active",
          joinedAt: 1_700_000_000,
          endedAt: null,
        },
      ],
    });
    restoreFedosConversationArchiveBundle(bundle, deps);
    const authority = new FedosWasmConversationArchiveEncryptionAuthority(fakeMasterSeedAuthority(vi.fn(async () => KEY_HANDLE)), fakeRoundTrippingRuntimeBoundary());
    const request: FedosConversationArchiveCliExportRequest = { conversationId: DIRECT_CONVERSATION_ID, exportedAt: 1_700_000_999, ...BASE_REQUEST_FIELDS };
    const result = await exportFedosConversationArchiveCliPackage(request, deps, authority);
    expect(result.outcome).toBe("exported");
    if (result.outcome !== "exported") throw new Error("unreachable");
    expect(result.package.formatVersion).toBe(FEDOS_CONVERSATION_ARCHIVE_CLI_PACKAGE_FORMAT_VERSION);
    expect(result.package.manifest.conversationId).toBe(DIRECT_CONVERSATION_ID);
    expect(result.package.manifest.membershipCount).toBe(1);
    expect(typeof result.package.ciphertext).toBe("string");
    expect(draftPersistence.getDraft(DIRECT_CONVERSATION_ID as never)?.mode).toBe("direct");
  });

  it("4. exported -- a conversation classified GROUP (private-group) on the Draft port exports identically", async () => {
    const deps = makeCollectorDeps();
    const draftPersistence = new InMemoryFedosConversationDraftPersistence();
    putDraftClassification(draftPersistence, GROUP_CONVERSATION_ID, "private-group");
    restoreFedosConversationArchiveBundle(makeBundle(GROUP_CONVERSATION_ID), deps);
    const authority = new FedosWasmConversationArchiveEncryptionAuthority(fakeMasterSeedAuthority(vi.fn(async () => KEY_HANDLE)), fakeRoundTrippingRuntimeBoundary());
    const request: FedosConversationArchiveCliExportRequest = { conversationId: GROUP_CONVERSATION_ID, exportedAt: 1_700_000_999, ...BASE_REQUEST_FIELDS };
    const result = await exportFedosConversationArchiveCliPackage(request, deps, authority);
    expect(result.outcome).toBe("exported");
    if (result.outcome !== "exported") throw new Error("unreachable");
    expect(result.package.manifest.conversationId).toBe(GROUP_CONVERSATION_ID);
    expect(draftPersistence.getDraft(GROUP_CONVERSATION_ID as never)?.mode).toBe("private-group");
  });

  it("5. exported -- an EMPTY conversation (zero memberships/capabilityEvents/envelopes/payloads) still exports cleanly", async () => {
    const deps = makeCollectorDeps();
    restoreFedosConversationArchiveBundle(makeBundle(DIRECT_CONVERSATION_ID), deps);
    const authority = new FedosWasmConversationArchiveEncryptionAuthority(fakeMasterSeedAuthority(vi.fn(async () => KEY_HANDLE)), fakeRoundTrippingRuntimeBoundary());
    const request: FedosConversationArchiveCliExportRequest = { conversationId: DIRECT_CONVERSATION_ID, exportedAt: 1_700_000_999, ...BASE_REQUEST_FIELDS };
    const result = await exportFedosConversationArchiveCliPackage(request, deps, authority);
    expect(result.outcome).toBe("exported");
    if (result.outcome !== "exported") throw new Error("unreachable");
    expect(result.package.manifest).toEqual({
      schemaVersion: FEDOS_CONVERSATION_ARCHIVE_SCHEMA_VERSION,
      conversationId: DIRECT_CONVERSATION_ID,
      exportedAt: 1_700_000_999,
      membershipCount: 0,
      capabilityEventCount: 0,
      envelopeCount: 0,
      payloadCount: 0,
      contentHash: result.package.manifest.contentHash,
    });
  });
});
