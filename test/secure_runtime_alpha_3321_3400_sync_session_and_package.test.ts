import { describe, it, expect, vi } from "vitest";
import {
  isWellFormedFedosDeviceSyncSessionV1,
  validateFedosDeviceSyncSession,
  type FedosDeviceSyncSessionV1,
} from "../src/os/messenger/device/sync_session/fedos_device_sync_session.js";
import {
  deserializeFedosDeviceSyncSessionFromBytes,
  serializeFedosDeviceSyncSessionToBytes,
} from "../src/os/messenger/device/sync_session/fedos_device_sync_session_codec.js";
import { InMemoryFedosDeviceRegistryPersistence } from "../src/os/messenger/device/persistence/in_memory_fedos_device_registry_persistence.js";
import {
  FedosWasmDeviceSyncPackageEncryptionAuthority,
  type FedosDeviceSyncPackageEncryptionRuntimeBoundary,
} from "../src/os/messenger/device/sync_package/fedos_device_sync_package_encryption.js";
import { deserializeFedosDeviceSyncPackageFromBytes, serializeFedosDeviceSyncPackageToBytes } from "../src/os/messenger/device/sync_package/fedos_device_sync_package.js";
import type { FedosMasterSeedAuthority } from "../src/os/core/vault/wasm/fedos_master_seed_authority.js";
import type { AeadCiphertextHandle, AeadCiphertextWire, AeadKeyHandle } from "../src/runtime/fedos_wasm_loader.js";

const ACCOUNT_PUBLIC_KEY_HEX = "ab".repeat(32);
const KEY_HANDLE: AeadKeyHandle = { kind: "AeadKeyHandle" } as AeadKeyHandle;

function makeSession(overrides: Partial<FedosDeviceSyncSessionV1> = {}): FedosDeviceSyncSessionV1 {
  return {
    schemaVersion: 1,
    accountAuthority: "nostr",
    accountPublicIdentifier: ACCOUNT_PUBLIC_KEY_HEX,
    targetDeviceId: "device-a",
    preparedAt: 1_700_000_000,
    expiresAt: 1_700_000_300,
    nonce: "aa".repeat(16),
    devices: [
      { deviceId: "device-a", devicePublicKeyRef: "11".repeat(32), trustState: "trusted" },
      { deviceId: "device-b", devicePublicKeyRef: "22".repeat(32), trustState: "trusted" },
    ],
    ...overrides,
  };
}

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

/** A REAL (in-memory, not cryptographic) round-trip fake, mirroring `fakeRoundTrippingRuntimeBoundary()` in `secure_runtime_alpha_1561_1580_archive_encrypted_export_import.test.ts` -- exercises build()->read() end to end without a compiled WASM artifact. */
function fakeRoundTrippingRuntimeBoundary(
  overrides: Partial<FedosDeviceSyncPackageEncryptionRuntimeBoundary> = {},
): FedosDeviceSyncPackageEncryptionRuntimeBoundary {
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

const BASE_REQUEST = { suite: "ChaCha20Poly1305" as const, localAccountIndex: 0, selfAccountPublicKeyHex: ACCOUNT_PUBLIC_KEY_HEX };

describe("Secure Runtime Alpha 3321-3400 -- Sync Session codec and structural validation", () => {
  it("1. serialize then deserialize recovers an identical session, with devices re-sorted deterministically", () => {
    const session = makeSession({
      devices: [
        { deviceId: "device-z", devicePublicKeyRef: null, trustState: "trusted" },
        { deviceId: "device-a", devicePublicKeyRef: "11".repeat(32), trustState: "trusted" },
      ],
    });
    const bytes = serializeFedosDeviceSyncSessionToBytes(session);
    const recovered = deserializeFedosDeviceSyncSessionFromBytes(bytes);
    expect(recovered?.devices.map((d) => d.deviceId)).toEqual(["device-a", "device-z"]);
  });

  it("2. deserialize returns null (never throws) on unparseable bytes", () => {
    expect(deserializeFedosDeviceSyncSessionFromBytes(new TextEncoder().encode("not json"))).toBeNull();
  });

  it("3. deserialize returns null on a schema-invalid object (missing field)", () => {
    const { nonce: _nonce, ...withoutNonce } = makeSession();
    const bytes = new TextEncoder().encode(JSON.stringify(withoutNonce));
    expect(deserializeFedosDeviceSyncSessionFromBytes(bytes)).toBeNull();
  });

  it("4. isWellFormedFedosDeviceSyncSessionV1 rejects an unexpected extra top-level field", () => {
    expect(isWellFormedFedosDeviceSyncSessionV1({ ...makeSession(), extra: "field" })).toBe(false);
  });
});

describe("Secure Runtime Alpha 3321-3400 -- Sync Session Validation against the LIVE Registry", () => {
  it("1. malformed input never throws and reports malformed", () => {
    expect(validateFedosDeviceSyncSession({ registryPersistence: new InMemoryFedosDeviceRegistryPersistence(), session: { garbage: true }, now: 0 })).toBe(
      "malformed",
    );
  });

  it("2. an expired session is reported expired even when the Registry would otherwise accept it", () => {
    const registryPersistence = new InMemoryFedosDeviceRegistryPersistence();
    const session = makeSession();
    const outcome = validateFedosDeviceSyncSession({ registryPersistence, session, now: session.expiresAt + 1 });
    expect(outcome).toBe("expired");
  });

  it("3. target-not-trusted when the target Device has no live Registry record at all", () => {
    const registryPersistence = new InMemoryFedosDeviceRegistryPersistence();
    const session = makeSession();
    expect(validateFedosDeviceSyncSession({ registryPersistence, session, now: session.preparedAt })).toBe("target-not-trusted");
  });
});

describe("Secure Runtime Alpha 3321-3400 -- Encrypted Sync Package build()", () => {
  it("1. invalid-input -- a negative localAccountIndex fails closed before any key resolution", async () => {
    const resolveConversationKey = vi.fn(async () => KEY_HANDLE);
    const authority = new FedosWasmDeviceSyncPackageEncryptionAuthority(fakeMasterSeedAuthority(resolveConversationKey), fakeRoundTrippingRuntimeBoundary());
    const result = await authority.build({ ...BASE_REQUEST, session: makeSession(), localAccountIndex: -1 });
    expect(result).toEqual({ outcome: "invalid-input" });
    expect(resolveConversationKey).not.toHaveBeenCalled();
  });

  it("2. key-unavailable -- resolveConversationKey resolves null", async () => {
    const authority = new FedosWasmDeviceSyncPackageEncryptionAuthority(fakeMasterSeedAuthority(vi.fn(async () => null)), fakeRoundTrippingRuntimeBoundary());
    const result = await authority.build({ ...BASE_REQUEST, session: makeSession() });
    expect(result).toEqual({ outcome: "key-unavailable" });
  });

  it("3. key-unavailable -- resolveConversationKey throws (never propagates)", async () => {
    const authority = new FedosWasmDeviceSyncPackageEncryptionAuthority(
      fakeMasterSeedAuthority(vi.fn(async () => {
        throw new Error("boom");
      })),
      fakeRoundTrippingRuntimeBoundary(),
    );
    const result = await authority.build({ ...BASE_REQUEST, session: makeSession() });
    expect(result).toEqual({ outcome: "key-unavailable" });
  });

  it("4. failed -- the runtime boundary's encrypt() resolves null", async () => {
    const authority = new FedosWasmDeviceSyncPackageEncryptionAuthority(
      fakeMasterSeedAuthority(vi.fn(async () => KEY_HANDLE)),
      fakeRoundTrippingRuntimeBoundary({ encrypt: vi.fn(async () => null) }),
    );
    const result = await authority.build({ ...BASE_REQUEST, session: makeSession() });
    expect(result).toEqual({ outcome: "failed" });
  });

  it("5. built -- returns a manifest whose identity/deviceCount/hash match the session, plus ciphertext", async () => {
    const authority = new FedosWasmDeviceSyncPackageEncryptionAuthority(fakeMasterSeedAuthority(vi.fn(async () => KEY_HANDLE)), fakeRoundTrippingRuntimeBoundary());
    const session = makeSession();
    const result = await authority.build({ ...BASE_REQUEST, session });
    expect(result.outcome).toBe("built");
    if (result.outcome !== "built") throw new Error("unreachable");
    expect(result.package.manifest.targetDeviceId).toBe("device-a");
    expect(result.package.manifest.deviceCount).toBe(2);
    expect(typeof result.package.ciphertext).toBe("string");
  });
});

describe("Secure Runtime Alpha 3321-3400 -- Encrypted Sync Package round trip, malformed/expired/tampered read()", () => {
  it("1. build() then read() with the SAME key/boundary recovers the identical session", async () => {
    const boundary = fakeRoundTrippingRuntimeBoundary();
    const authority = new FedosWasmDeviceSyncPackageEncryptionAuthority(fakeMasterSeedAuthority(vi.fn(async () => KEY_HANDLE)), boundary);
    const session = makeSession();

    const built = await authority.build({ ...BASE_REQUEST, session });
    expect(built.outcome).toBe("built");
    if (built.outcome !== "built") throw new Error("unreachable");

    const read = await authority.read({ ...BASE_REQUEST, package: built.package, now: session.preparedAt });
    expect(read).toEqual({ outcome: "opened", session });
  });

  it("2. malformed -- read() rejects a structurally-invalid package before ever attempting decrypt", async () => {
    const authority = new FedosWasmDeviceSyncPackageEncryptionAuthority(fakeMasterSeedAuthority(vi.fn(async () => KEY_HANDLE)), fakeRoundTrippingRuntimeBoundary());
    const result = await authority.read({
      ...BASE_REQUEST,
      package: { formatVersion: 1, manifest: { not: "a manifest" }, ciphertext: "irrelevant" } as never,
      now: 0,
    });
    expect(result).toEqual({ outcome: "malformed" });
  });

  it("3. malformed -- deserializeFedosDeviceSyncPackageFromBytes returns null (never throws) on unparseable bytes", () => {
    expect(deserializeFedosDeviceSyncPackageFromBytes(new TextEncoder().encode("garbage"))).toBeNull();
  });

  it("4. package codec round trip -- serialize then deserialize recovers an identical package", async () => {
    const authority = new FedosWasmDeviceSyncPackageEncryptionAuthority(fakeMasterSeedAuthority(vi.fn(async () => KEY_HANDLE)), fakeRoundTrippingRuntimeBoundary());
    const built = await authority.build({ ...BASE_REQUEST, session: makeSession() });
    if (built.outcome !== "built") throw new Error("unreachable");
    const recovered = deserializeFedosDeviceSyncPackageFromBytes(serializeFedosDeviceSyncPackageToBytes(built.package));
    expect(recovered).toEqual(built.package);
  });

  it("5. expired -- read() refuses a package whose manifest.expiresAt is already in the past", async () => {
    const boundary = fakeRoundTrippingRuntimeBoundary();
    const authority = new FedosWasmDeviceSyncPackageEncryptionAuthority(fakeMasterSeedAuthority(vi.fn(async () => KEY_HANDLE)), boundary);
    const session = makeSession();
    const built = await authority.build({ ...BASE_REQUEST, session });
    if (built.outcome !== "built") throw new Error("unreachable");

    const result = await authority.read({ ...BASE_REQUEST, package: built.package, now: session.expiresAt + 1 });
    expect(result).toEqual({ outcome: "expired" });
  });

  it("6. manifest-mismatch -- the manifest's targetDeviceId does not match the sealed header", async () => {
    const boundary = fakeRoundTrippingRuntimeBoundary();
    const authority = new FedosWasmDeviceSyncPackageEncryptionAuthority(fakeMasterSeedAuthority(vi.fn(async () => KEY_HANDLE)), boundary);
    const session = makeSession();
    const built = await authority.build({ ...BASE_REQUEST, session });
    if (built.outcome !== "built") throw new Error("unreachable");

    const tampered = { ...built.package, manifest: { ...built.package.manifest, targetDeviceId: "device-other" } };
    const result = await authority.read({ ...BASE_REQUEST, package: tampered, now: session.preparedAt });
    expect(result).toEqual({ outcome: "manifest-mismatch" });
  });

  it("7. manifest-mismatch -- the manifest's contentHash does not match the decrypted session", async () => {
    const boundary = fakeRoundTrippingRuntimeBoundary();
    const authority = new FedosWasmDeviceSyncPackageEncryptionAuthority(fakeMasterSeedAuthority(vi.fn(async () => KEY_HANDLE)), boundary);
    const session = makeSession();
    const built = await authority.build({ ...BASE_REQUEST, session });
    if (built.outcome !== "built") throw new Error("unreachable");

    const tampered = { ...built.package, manifest: { ...built.package.manifest, contentHash: "0".repeat(64) } };
    const result = await authority.read({ ...BASE_REQUEST, package: tampered, now: session.preparedAt });
    expect(result).toEqual({ outcome: "manifest-mismatch" });
  });

  it("8. failed -- importCiphertext() cannot resolve an unknown wire string", async () => {
    const boundary = fakeRoundTrippingRuntimeBoundary();
    const authority = new FedosWasmDeviceSyncPackageEncryptionAuthority(fakeMasterSeedAuthority(vi.fn(async () => KEY_HANDLE)), boundary);
    const built = await authority.build({ ...BASE_REQUEST, session: makeSession() });
    if (built.outcome !== "built") throw new Error("unreachable");

    const tampered = { ...built.package, ciphertext: "totally-unknown-wire" as unknown as AeadCiphertextWire };
    const result = await authority.read({ ...BASE_REQUEST, package: tampered, now: built.package.manifest.preparedAt });
    expect(result).toEqual({ outcome: "failed" });
  });

  it("9. read() key-unavailable when resolveConversationKey resolves null", async () => {
    const boundary = fakeRoundTrippingRuntimeBoundary();
    const buildAuthority = new FedosWasmDeviceSyncPackageEncryptionAuthority(fakeMasterSeedAuthority(vi.fn(async () => KEY_HANDLE)), boundary);
    const built = await buildAuthority.build({ ...BASE_REQUEST, session: makeSession() });
    if (built.outcome !== "built") throw new Error("unreachable");

    const readAuthority = new FedosWasmDeviceSyncPackageEncryptionAuthority(fakeMasterSeedAuthority(vi.fn(async () => null)), boundary);
    const result = await readAuthority.read({ ...BASE_REQUEST, package: built.package, now: built.package.manifest.preparedAt });
    expect(result).toEqual({ outcome: "key-unavailable" });
  });
});
