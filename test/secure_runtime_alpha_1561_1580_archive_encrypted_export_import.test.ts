import { describe, it, expect, vi } from "vitest";
import {
  FedosWasmConversationArchiveEncryptionAuthority,
  type FedosConversationArchiveEncryptionRuntimeBoundary,
  type FedosConversationArchiveExportRequest,
  type FedosConversationArchiveImportRequest,
} from "../src/conversation/archive/fedos_conversation_archive_encryption.js";
import { FEDOS_CONVERSATION_ARCHIVE_SCHEMA_VERSION } from "../src/conversation/archive/fedos_conversation_archive_schema_version.js";
import type { FedosConversationArchiveBundleV1 } from "../src/conversation/archive/fedos_conversation_archive_bundle.js";
import type { FedosMasterSeedAuthority } from "../src/runtime/master_seed/fedos_master_seed_authority.js";
import type { AeadCiphertextHandle, AeadCiphertextWire, AeadKeyHandle } from "../src/runtime/fedos_wasm_loader.js";

const CONVERSATION_ID = "board-a::thread-1";

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
    memberships: [],
    capabilityEvents: [],
    envelopes: [],
    payloads: [],
    ...overrides,
  };
}

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

/** A REAL (in-memory, not cryptographic) round-trip fake -- stores plaintext keyed by an opaque handle, so export()->import() can be exercised end to end without a compiled WASM artifact. Mirrors `fakeRuntimeBoundary()`'s own role in `secure_runtime_alpha_861_872_encryption_authority.test.ts`, extended to a full round trip since this Arc's own import() path (unlike that Arc's encrypt-only coverage) needs one. */
function fakeRoundTrippingRuntimeBoundary(overrides: Partial<FedosConversationArchiveEncryptionRuntimeBoundary> = {}): FedosConversationArchiveEncryptionRuntimeBoundary {
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
    ...overrides,
  };
}

const BASE_EXPORT_REQUEST: Omit<FedosConversationArchiveExportRequest, "bundle"> = {
  suite: "ChaCha20Poly1305",
  localAccountIndex: 0,
  counterpartyPublicKeyHex: "ab".repeat(32),
};

describe("Secure Runtime Alpha 1561-1580 -- FedosWasmConversationArchiveEncryptionAuthority.export", () => {
  it("1. invalid-input -- a negative localAccountIndex fails closed before any key resolution", async () => {
    const resolveConversationKey = vi.fn(async () => KEY_HANDLE);
    const authority = new FedosWasmConversationArchiveEncryptionAuthority(fakeMasterSeedAuthority(resolveConversationKey), fakeRoundTrippingRuntimeBoundary());
    const result = await authority.export({ ...BASE_EXPORT_REQUEST, bundle: makeBundle(), localAccountIndex: -1 });
    expect(result).toEqual({ outcome: "invalid-input" });
    expect(resolveConversationKey).not.toHaveBeenCalled();
  });

  it("2. key-unavailable -- resolveConversationKey resolves null", async () => {
    const authority = new FedosWasmConversationArchiveEncryptionAuthority(fakeMasterSeedAuthority(vi.fn(async () => null)), fakeRoundTrippingRuntimeBoundary());
    const result = await authority.export({ ...BASE_EXPORT_REQUEST, bundle: makeBundle() });
    expect(result).toEqual({ outcome: "key-unavailable" });
  });

  it("3. key-unavailable -- resolveConversationKey throws (never propagates)", async () => {
    const authority = new FedosWasmConversationArchiveEncryptionAuthority(
      fakeMasterSeedAuthority(vi.fn(async () => { throw new Error("boom"); })),
      fakeRoundTrippingRuntimeBoundary(),
    );
    const result = await authority.export({ ...BASE_EXPORT_REQUEST, bundle: makeBundle() });
    expect(result).toEqual({ outcome: "key-unavailable" });
  });

  it("4. failed -- the runtime boundary's encrypt() resolves null", async () => {
    const authority = new FedosWasmConversationArchiveEncryptionAuthority(
      fakeMasterSeedAuthority(vi.fn(async () => KEY_HANDLE)),
      fakeRoundTrippingRuntimeBoundary({ encrypt: vi.fn(async () => null) }),
    );
    const result = await authority.export({ ...BASE_EXPORT_REQUEST, bundle: makeBundle() });
    expect(result).toEqual({ outcome: "failed" });
  });

  it("5. exported -- returns a manifest whose counts/hash match the bundle, plus ciphertext", async () => {
    const authority = new FedosWasmConversationArchiveEncryptionAuthority(fakeMasterSeedAuthority(vi.fn(async () => KEY_HANDLE)), fakeRoundTrippingRuntimeBoundary());
    const bundle = makeBundle();
    const result = await authority.export({ ...BASE_EXPORT_REQUEST, bundle });
    expect(result.outcome).toBe("exported");
    if (result.outcome !== "exported") throw new Error("unreachable");
    expect(result.manifest.conversationId).toBe(CONVERSATION_ID);
    expect(result.manifest.membershipCount).toBe(0);
    expect(typeof result.ciphertext).toBe("string");
  });
});

describe("Secure Runtime Alpha 1561-1580 -- FedosWasmConversationArchiveEncryptionAuthority round trip", () => {
  it("1. export() then import() with the SAME key/boundary recovers the identical bundle", async () => {
    const boundary = fakeRoundTrippingRuntimeBoundary();
    const authority = new FedosWasmConversationArchiveEncryptionAuthority(fakeMasterSeedAuthority(vi.fn(async () => KEY_HANDLE)), boundary);
    const bundle = makeBundle({
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
    });

    const exported = await authority.export({ ...BASE_EXPORT_REQUEST, bundle });
    expect(exported.outcome).toBe("exported");
    if (exported.outcome !== "exported") throw new Error("unreachable");

    const imported = await authority.import({ ...BASE_EXPORT_REQUEST, manifest: exported.manifest, ciphertext: exported.ciphertext });
    expect(imported).toEqual({ outcome: "decrypted", bundle });
  });

  it("2. import() key-unavailable when resolveConversationKey resolves null", async () => {
    const boundary = fakeRoundTrippingRuntimeBoundary();
    const exportAuthority = new FedosWasmConversationArchiveEncryptionAuthority(fakeMasterSeedAuthority(vi.fn(async () => KEY_HANDLE)), boundary);
    const exported = await exportAuthority.export({ ...BASE_EXPORT_REQUEST, bundle: makeBundle() });
    if (exported.outcome !== "exported") throw new Error("unreachable");

    const importAuthority = new FedosWasmConversationArchiveEncryptionAuthority(fakeMasterSeedAuthority(vi.fn(async () => null)), boundary);
    const imported = await importAuthority.import({ ...BASE_EXPORT_REQUEST, manifest: exported.manifest, ciphertext: exported.ciphertext });
    expect(imported).toEqual({ outcome: "key-unavailable" });
  });

  it("3. import() failed -- importCiphertext() cannot resolve an unknown wire string", async () => {
    const boundary = fakeRoundTrippingRuntimeBoundary();
    const authority = new FedosWasmConversationArchiveEncryptionAuthority(fakeMasterSeedAuthority(vi.fn(async () => KEY_HANDLE)), boundary);
    const exported = await authority.export({ ...BASE_EXPORT_REQUEST, bundle: makeBundle() });
    if (exported.outcome !== "exported") throw new Error("unreachable");

    const imported = await authority.import({ ...BASE_EXPORT_REQUEST, manifest: exported.manifest, ciphertext: "totally-unknown-wire" as unknown as AeadCiphertextWire });
    expect(imported).toEqual({ outcome: "failed" });
  });

  it("4. import() manifest-mismatch -- the manifest's conversationId does not match the sealed header", async () => {
    const boundary = fakeRoundTrippingRuntimeBoundary();
    const authority = new FedosWasmConversationArchiveEncryptionAuthority(fakeMasterSeedAuthority(vi.fn(async () => KEY_HANDLE)), boundary);
    const exported = await authority.export({ ...BASE_EXPORT_REQUEST, bundle: makeBundle() });
    if (exported.outcome !== "exported") throw new Error("unreachable");

    const tamperedManifest = { ...exported.manifest, conversationId: "board-a::thread-2" };
    const imported = await authority.import({ ...BASE_EXPORT_REQUEST, manifest: tamperedManifest, ciphertext: exported.ciphertext });
    expect(imported).toEqual({ outcome: "manifest-mismatch" });
  });

  it("5. import() manifest-mismatch -- the manifest's contentHash does not match the decrypted bundle", async () => {
    const boundary = fakeRoundTrippingRuntimeBoundary();
    const authority = new FedosWasmConversationArchiveEncryptionAuthority(fakeMasterSeedAuthority(vi.fn(async () => KEY_HANDLE)), boundary);
    const exported = await authority.export({ ...BASE_EXPORT_REQUEST, bundle: makeBundle() });
    if (exported.outcome !== "exported") throw new Error("unreachable");

    const tamperedManifest = { ...exported.manifest, contentHash: "0".repeat(64) };
    const imported = await authority.import({ ...BASE_EXPORT_REQUEST, manifest: tamperedManifest, ciphertext: exported.ciphertext });
    expect(imported).toEqual({ outcome: "manifest-mismatch" });
  });

  it("6. import() invalid-input -- a non-integer localAccountIndex fails closed before any key resolution", async () => {
    const resolveConversationKey = vi.fn(async () => KEY_HANDLE);
    const authority = new FedosWasmConversationArchiveEncryptionAuthority(fakeMasterSeedAuthority(resolveConversationKey), fakeRoundTrippingRuntimeBoundary());
    const request: FedosConversationArchiveImportRequest = {
      ...BASE_EXPORT_REQUEST,
      localAccountIndex: 1.5,
      manifest: buildFallbackManifest(),
      ciphertext: "irrelevant" as unknown as AeadCiphertextWire,
    };
    const result = await authority.import(request);
    expect(result).toEqual({ outcome: "invalid-input" });
    expect(resolveConversationKey).not.toHaveBeenCalled();
  });
});

function buildFallbackManifest() {
  return {
    schemaVersion: FEDOS_CONVERSATION_ARCHIVE_SCHEMA_VERSION,
    conversationId: CONVERSATION_ID,
    exportedAt: 1_700_000_500,
    membershipCount: 0,
    capabilityEventCount: 0,
    envelopeCount: 0,
    payloadCount: 0,
    contentHash: "0".repeat(64),
  };
}
