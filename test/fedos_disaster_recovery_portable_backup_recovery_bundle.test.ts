import { describe, it, expect, vi } from "vitest";
import {
  encodeFedosRecoveryBundleDataPart,
  decodeFedosRecoveryBundleDataPart,
  type FedosRecoveryBundleDataPartEntry,
} from "../src/os/messenger/desktop/recovery/fedos_recovery_bundle_data_part_codec.js";
import {
  buildFedosRecoveryBundleManifest,
  isWellFormedFedosRecoveryBundleManifestV1,
  fedosRecoveryBundleContentHashesAreEqual,
} from "../src/os/messenger/desktop/recovery/fedos_recovery_bundle_manifest.js";
import {
  encodeFedosRecoveryBundleHeader,
  fedosRecoveryBundleHeaderBytesAreEqual,
  splitFedosRecoveryBundleHeader,
} from "../src/os/messenger/desktop/recovery/fedos_recovery_bundle_header.js";
import { isWellFormedFedosRecoveryBundleV1, type FedosRecoveryBundleV1 } from "../src/os/messenger/desktop/recovery/fedos_recovery_bundle.js";
import {
  FedosRecoveryBundleEncryptionAuthority,
  type FedosRecoveryBundleEncryptionRuntimeBoundary,
} from "../src/os/messenger/desktop/recovery/fedos_recovery_bundle_encryption.js";
import {
  FEDOS_RECOVERY_BUNDLE_INCLUDED_LOGS,
  FEDOS_RECOVERY_BUNDLE_EXCLUDED_LOGS,
  fedosRecoveryBundleSourcePaths,
  fedosRecoveryBundleDestinationPathFor,
} from "../src/os/messenger/desktop/recovery/fedos_recovery_bundle_profile_selection.js";
import { planFedosLocalProfilePaths, type FedosLocalProfilePaths } from "../src/os/messenger/desktop/onboarding/fedos_local_profile_paths.js";
import type { FedosMasterSeedAuthority } from "../src/os/core/vault/wasm/fedos_master_seed_authority.js";
import type { AeadCiphertextHandle, AeadCiphertextWire, AeadKeyHandle } from "../src/runtime/fedos_wasm_loader.js";

const VALID_SEALED_ENVELOPE = '{"v":1,"kdf":"argon2id","m":19456,"t":2,"p":1,"salt":"aa","alg":"chacha20poly1305","n":"bb","ct":"cc"}';
const ACCOUNT_PUBLIC_KEY_HEX = "ab".repeat(32);
const KEY_HANDLE: AeadKeyHandle = { kind: "AeadKeyHandle" } as AeadKeyHandle;

function fakeMasterSeedAuthority(overrides: Partial<FedosMasterSeedAuthority> = {}): FedosMasterSeedAuthority {
  return {
    isAvailable: vi.fn(async () => true),
    isCleared: vi.fn(async () => false),
    generate: vi.fn(async () => true),
    restoreSealed: vi.fn(async () => true),
    seal: vi.fn(async () => null),
    clear: vi.fn(async () => undefined),
    resolveConversationKey: vi.fn(async () => KEY_HANDLE),
    ...overrides,
  };
}

/** Real (in-memory, non-cryptographic) round-trip fake — mirrors `fakeRoundTrippingRuntimeBoundary()` in `secure_runtime_alpha_3321_3400_sync_session_and_package.test.ts`. */
function fakeRoundTrippingRuntimeBoundary(
  overrides: Partial<FedosRecoveryBundleEncryptionRuntimeBoundary> = {},
): FedosRecoveryBundleEncryptionRuntimeBoundary {
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

const SUITE = "ChaCha20Poly1305" as const;

describe("Disaster Recovery Portable Backup -- Data Part codec", () => {
  it("1. encode then decode recovers identical entries, sorted by name", () => {
    const entries: FedosRecoveryBundleDataPartEntry[] = [
      { name: "conversation", bytes: new TextEncoder().encode('{"a":1}\n') },
      { name: "board", bytes: new TextEncoder().encode("") },
      { name: "outbox", bytes: new Uint8Array([1, 2, 3, 255, 0]) },
    ];
    const encoded = encodeFedosRecoveryBundleDataPart(entries);
    const decoded = decodeFedosRecoveryBundleDataPart(encoded);
    expect(decoded).not.toBeNull();
    expect(decoded!.map((e) => e.name)).toEqual(["board", "conversation", "outbox"]);
    expect(decoded!.find((e) => e.name === "outbox")!.bytes).toEqual(new Uint8Array([1, 2, 3, 255, 0]));
  });

  it("2. an empty entry list round-trips to an empty list", () => {
    const decoded = decodeFedosRecoveryBundleDataPart(encodeFedosRecoveryBundleDataPart([]));
    expect(decoded).toEqual([]);
  });

  it("3. a duplicate name keeps only the last occurrence", () => {
    const entries: FedosRecoveryBundleDataPartEntry[] = [
      { name: "board", bytes: new Uint8Array([1]) },
      { name: "board", bytes: new Uint8Array([2]) },
    ];
    const decoded = decodeFedosRecoveryBundleDataPart(encodeFedosRecoveryBundleDataPart(entries));
    expect(decoded).toHaveLength(1);
    expect(decoded![0]!.bytes).toEqual(new Uint8Array([2]));
  });

  it("4. decode fails closed on truncated bytes", () => {
    const encoded = encodeFedosRecoveryBundleDataPart([{ name: "board", bytes: new Uint8Array([1, 2, 3]) }]);
    expect(decodeFedosRecoveryBundleDataPart(encoded.slice(0, encoded.length - 1))).toBeNull();
  });

  it("5. decode fails closed on trailing garbage", () => {
    const encoded = encodeFedosRecoveryBundleDataPart([{ name: "board", bytes: new Uint8Array([1]) }]);
    const withGarbage = new Uint8Array(encoded.length + 3);
    withGarbage.set(encoded, 0);
    expect(decodeFedosRecoveryBundleDataPart(withGarbage)).toBeNull();
  });

  it("6. decode fails closed on empty input, never throws", () => {
    expect(decodeFedosRecoveryBundleDataPart(new Uint8Array())).toBeNull();
    expect(() => decodeFedosRecoveryBundleDataPart(new Uint8Array([255, 255, 255, 255]))).not.toThrow();
  });
});

describe("Disaster Recovery Portable Backup -- Manifest", () => {
  it("7. buildFedosRecoveryBundleManifest output passes its own structural validator", () => {
    const dataPartBytes = new Uint8Array([1, 2, 3]);
    const manifest = buildFedosRecoveryBundleManifest({
      createdAt: 1_700_000_000,
      accountIndex: 0,
      includedLogs: ["conversation", "board", "board"],
      dataPartBytes,
    });
    expect(manifest.includedLogs).toEqual(["board", "conversation"]); // deduped, sorted
    expect(isWellFormedFedosRecoveryBundleManifestV1(manifest)).toBe(true);
  });

  it("8. content hash changes when Data Part bytes change", () => {
    const a = buildFedosRecoveryBundleManifest({ createdAt: 0, accountIndex: 0, includedLogs: [], dataPartBytes: new Uint8Array([1]) });
    const b = buildFedosRecoveryBundleManifest({ createdAt: 0, accountIndex: 0, includedLogs: [], dataPartBytes: new Uint8Array([2]) });
    expect(fedosRecoveryBundleContentHashesAreEqual(a.contentHash, b.contentHash)).toBe(false);
  });

  it("9. structural validator rejects an extra key, a wrong schemaVersion, and an unsorted includedLogs", () => {
    const base = buildFedosRecoveryBundleManifest({ createdAt: 0, accountIndex: 0, includedLogs: ["a", "b"], dataPartBytes: new Uint8Array() });
    expect(isWellFormedFedosRecoveryBundleManifestV1({ ...base, extra: 1 })).toBe(false);
    expect(isWellFormedFedosRecoveryBundleManifestV1({ ...base, schemaVersion: 2 })).toBe(false);
    expect(isWellFormedFedosRecoveryBundleManifestV1({ ...base, includedLogs: ["b", "a"] })).toBe(false);
    expect(isWellFormedFedosRecoveryBundleManifestV1(null)).toBe(false);
    expect(isWellFormedFedosRecoveryBundleManifestV1("not an object")).toBe(false);
  });
});

describe("Disaster Recovery Portable Backup -- Header", () => {
  it("10. encode then split recovers the identical Data Part bytes and a byte-equal header", () => {
    const header = encodeFedosRecoveryBundleHeader({ accountIndex: 3, createdAt: 1_700_000_000 });
    const dataPart = new Uint8Array([9, 8, 7]);
    const sealed = new Uint8Array(header.length + dataPart.length);
    sealed.set(header, 0);
    sealed.set(dataPart, header.length);

    const split = splitFedosRecoveryBundleHeader(sealed);
    expect(split).not.toBeNull();
    expect(split!.dataPartBytes).toEqual(dataPart);
    expect(fedosRecoveryBundleHeaderBytesAreEqual(split!.header, header)).toBe(true);
  });

  it("11. a header built from a different accountIndex is byte-unequal", () => {
    const a = encodeFedosRecoveryBundleHeader({ accountIndex: 1, createdAt: 100 });
    const b = encodeFedosRecoveryBundleHeader({ accountIndex: 2, createdAt: 100 });
    expect(fedosRecoveryBundleHeaderBytesAreEqual(a, b)).toBe(false);
  });

  it("12. split fails closed on too-short or unrecognized-version input", () => {
    expect(splitFedosRecoveryBundleHeader(new Uint8Array([1, 2]))).toBeNull();
    expect(splitFedosRecoveryBundleHeader(new Uint8Array([9, 0, 0, 0, 0, 0, 0, 0, 0]))).toBeNull();
  });
});

describe("Disaster Recovery Portable Backup -- Recovery Bundle container", () => {
  const identityOnly: FedosRecoveryBundleV1 = Object.freeze({
    v: 1,
    kind: "fedos-recovery-bundle",
    createdAt: 1_700_000_000,
    sealedMasterSeedEnvelope: VALID_SEALED_ENVELOPE,
    dataCiphertext: null,
    manifest: null,
  });

  it("13. a well-formed Identity-only bundle passes structural validation", () => {
    expect(isWellFormedFedosRecoveryBundleV1(identityOnly)).toBe(true);
  });

  it("14. rejects a bundle with a dataCiphertext but no manifest, or vice versa", () => {
    expect(isWellFormedFedosRecoveryBundleV1({ ...identityOnly, dataCiphertext: "wire" })).toBe(false);
    const manifest = buildFedosRecoveryBundleManifest({ createdAt: 0, accountIndex: 0, includedLogs: [], dataPartBytes: new Uint8Array() });
    expect(isWellFormedFedosRecoveryBundleV1({ ...identityOnly, manifest })).toBe(false);
  });

  it("15. rejects a malformed sealedMasterSeedEnvelope, a wrong v, and a wrong kind", () => {
    expect(isWellFormedFedosRecoveryBundleV1({ ...identityOnly, sealedMasterSeedEnvelope: "not an envelope" })).toBe(false);
    expect(isWellFormedFedosRecoveryBundleV1({ ...identityOnly, v: 2 })).toBe(false);
    expect(isWellFormedFedosRecoveryBundleV1({ ...identityOnly, kind: "something-else" })).toBe(false);
  });

  it("16. rejects an extra top-level key", () => {
    expect(isWellFormedFedosRecoveryBundleV1({ ...identityOnly, extra: "field" })).toBe(false);
  });
});

describe("Disaster Recovery Portable Backup -- Encryption Authority build()/restoreIdentity()/restoreDataPart()", () => {
  it("17. build() with no dataPart never touches the Master Seed Authority (Identity-only needs no live unlock)", async () => {
    const masterSeed = fakeMasterSeedAuthority();
    const authority = new FedosRecoveryBundleEncryptionAuthority(masterSeed, fakeRoundTrippingRuntimeBoundary());
    const result = await authority.build({ sealedMasterSeedEnvelope: VALID_SEALED_ENVELOPE, now: 1_700_000_000 });
    expect(result.outcome).toBe("built");
    expect(masterSeed.resolveConversationKey).not.toHaveBeenCalled();
    if (result.outcome === "built") {
      expect(result.bundle.dataCiphertext).toBeNull();
      expect(isWellFormedFedosRecoveryBundleV1(result.bundle)).toBe(true);
    }
  });

  it("18. build() rejects a malformed sealedMasterSeedEnvelope before touching anything else", async () => {
    const authority = new FedosRecoveryBundleEncryptionAuthority(fakeMasterSeedAuthority());
    const result = await authority.build({ sealedMasterSeedEnvelope: "garbage", now: 0 });
    expect(result.outcome).toBe("invalid-input");
  });

  it("19. build() with a dataPart, then restoreIdentity()+restoreDataPart() on a fresh authority recovers identical entries", async () => {
    const boundary = fakeRoundTrippingRuntimeBoundary();
    const sourceMasterSeed = fakeMasterSeedAuthority();
    const buildAuthority = new FedosRecoveryBundleEncryptionAuthority(sourceMasterSeed, boundary);

    const entries: FedosRecoveryBundleDataPartEntry[] = [
      { name: "board", bytes: new TextEncoder().encode('{"kind":"post"}\n') },
      { name: "conversation", bytes: new TextEncoder().encode('{"id":"c1"}\n') },
    ];
    const buildResult = await buildAuthority.build({
      sealedMasterSeedEnvelope: VALID_SEALED_ENVELOPE,
      now: 1_700_000_000,
      dataPart: { suite: SUITE, accountIndex: 0, selfAccountPublicKeyHex: ACCOUNT_PUBLIC_KEY_HEX, entries },
    });
    expect(buildResult.outcome).toBe("built");
    if (buildResult.outcome !== "built") return;

    // A fresh authority + a fresh (but boundary-sharing) runtime, exactly as a Machine B restore would use.
    const targetMasterSeed = fakeMasterSeedAuthority();
    const restoreAuthority = new FedosRecoveryBundleEncryptionAuthority(targetMasterSeed, boundary);

    const identityOutcome = await restoreAuthority.restoreIdentity(buildResult.bundle, new TextEncoder().encode("correct horse"));
    expect(identityOutcome).toBe("restored");
    expect(targetMasterSeed.restoreSealed).toHaveBeenCalledTimes(1);

    const dataOutcome = await restoreAuthority.restoreDataPart(buildResult.bundle, { suite: SUITE, selfAccountPublicKeyHex: ACCOUNT_PUBLIC_KEY_HEX });
    expect(dataOutcome.outcome).toBe("restored");
    if (dataOutcome.outcome === "restored") {
      expect(dataOutcome.entries.map((e) => e.name)).toEqual(["board", "conversation"]);
      expect(new TextDecoder().decode(dataOutcome.entries.find((e) => e.name === "conversation")!.bytes)).toBe('{"id":"c1"}\n');
    }
  });

  it("20. restoreIdentity() reports wrong-secret, never proceeding to restoreDataPart, on a wrong passphrase", async () => {
    const masterSeed = fakeMasterSeedAuthority({ restoreSealed: vi.fn(async () => false) });
    const authority = new FedosRecoveryBundleEncryptionAuthority(masterSeed);
    const bundle: FedosRecoveryBundleV1 = { v: 1, kind: "fedos-recovery-bundle", createdAt: 0, sealedMasterSeedEnvelope: VALID_SEALED_ENVELOPE, dataCiphertext: null, manifest: null };
    const outcome = await authority.restoreIdentity(bundle, new TextEncoder().encode("wrong"));
    expect(outcome).toBe("wrong-secret");
  });

  it("21. restoreDataPart() on an Identity-only bundle reports identity-only, not failed", async () => {
    const authority = new FedosRecoveryBundleEncryptionAuthority(fakeMasterSeedAuthority());
    const bundle: FedosRecoveryBundleV1 = { v: 1, kind: "fedos-recovery-bundle", createdAt: 0, sealedMasterSeedEnvelope: VALID_SEALED_ENVELOPE, dataCiphertext: null, manifest: null };
    const outcome = await authority.restoreDataPart(bundle, { suite: SUITE, selfAccountPublicKeyHex: ACCOUNT_PUBLIC_KEY_HEX });
    expect(outcome.outcome).toBe("identity-only");
  });

  it("22. restoreDataPart() reports manifest-mismatch when the ciphertext was resealed under a different header (relocation/substitution)", async () => {
    const boundary = fakeRoundTrippingRuntimeBoundary();
    const masterSeed = fakeMasterSeedAuthority();
    const authority = new FedosRecoveryBundleEncryptionAuthority(masterSeed, boundary);

    const buildResult = await authority.build({
      sealedMasterSeedEnvelope: VALID_SEALED_ENVELOPE,
      now: 1_700_000_000,
      dataPart: { suite: SUITE, accountIndex: 0, selfAccountPublicKeyHex: ACCOUNT_PUBLIC_KEY_HEX, entries: [{ name: "board", bytes: new Uint8Array([1]) }] },
    });
    expect(buildResult.outcome).toBe("built");
    if (buildResult.outcome !== "built" || buildResult.bundle.manifest === null) return;

    // Splice in a manifest claiming a different accountIndex -- the header re-derived at restore time
    // will not match the header actually sealed inside the ciphertext.
    const tampered: FedosRecoveryBundleV1 = {
      ...buildResult.bundle,
      manifest: { ...buildResult.bundle.manifest, accountIndex: 99 },
    };
    const outcome = await authority.restoreDataPart(tampered, { suite: SUITE, selfAccountPublicKeyHex: ACCOUNT_PUBLIC_KEY_HEX });
    expect(outcome.outcome).toBe("manifest-mismatch");
  });

  it("23. restoreDataPart() reports key-unavailable when resolveConversationKey fails (e.g. Identity not actually restored)", async () => {
    const masterSeed = fakeMasterSeedAuthority({ resolveConversationKey: vi.fn(async () => null) });
    const authority = new FedosRecoveryBundleEncryptionAuthority(masterSeed);
    const manifest = buildFedosRecoveryBundleManifest({ createdAt: 0, accountIndex: 0, includedLogs: ["board"], dataPartBytes: new Uint8Array([1]) });
    const bundle: FedosRecoveryBundleV1 = { v: 1, kind: "fedos-recovery-bundle", createdAt: 0, sealedMasterSeedEnvelope: VALID_SEALED_ENVELOPE, dataCiphertext: "wire" as AeadCiphertextWire, manifest };
    const outcome = await authority.restoreDataPart(bundle, { suite: SUITE, selfAccountPublicKeyHex: ACCOUNT_PUBLIC_KEY_HEX });
    expect(outcome.outcome).toBe("key-unavailable");
  });
});

describe("Disaster Recovery Portable Backup -- Profile Selection", () => {
  // A Windows-style absolute path -- `node:path.join()` normalizes separators, so a POSIX-style
  // fixture would not byte-match its own `paths.root` prefix on win32 (this suite runs on win32).
  const paths = planFedosLocalProfilePaths("C:\\fedos-test\\some-profile-root") as FedosLocalProfilePaths;

  it("24. every included logical name resolves to a real, distinct path under the profile root", () => {
    const resolved = fedosRecoveryBundleSourcePaths(paths);
    expect(resolved.size).toBe(FEDOS_RECOVERY_BUNDLE_INCLUDED_LOGS.size);
    const seen = new Set<string>();
    for (const [name, path] of resolved) {
      expect(typeof path).toBe("string");
      expect(path.startsWith(paths.root)).toBe(true);
      expect(seen.has(path)).toBe(false);
      seen.add(path);
      expect(name).toMatch(/^[a-z0-9-]+$/);
    }
  });

  it("25. the excluded list and the included list never name the same FedosLocalProfilePaths field", () => {
    const includedFields = new Set(FEDOS_RECOVERY_BUNDLE_INCLUDED_LOGS.values());
    for (const excludedField of FEDOS_RECOVERY_BUNDLE_EXCLUDED_LOGS) {
      expect(includedFields.has(excludedField)).toBe(false);
    }
  });

  it("26. sealedMasterSeedFile is in neither list -- it is the Identity Part, never the Data Part", () => {
    const includedFields = new Set(FEDOS_RECOVERY_BUNDLE_INCLUDED_LOGS.values());
    expect(includedFields.has("sealedMasterSeedFile")).toBe(false);
    expect(FEDOS_RECOVERY_BUNDLE_EXCLUDED_LOGS.includes("sealedMasterSeedFile")).toBe(false);
  });

  it("27. every field on FedosLocalProfilePaths is accounted for by exactly one of: root, sealedMasterSeedFile, included, excluded", () => {
    const includedFields = new Set(FEDOS_RECOVERY_BUNDLE_INCLUDED_LOGS.values());
    const excludedFields = new Set(FEDOS_RECOVERY_BUNDLE_EXCLUDED_LOGS);
    const unaccounted: string[] = [];
    for (const field of Object.keys(paths) as (keyof FedosLocalProfilePaths)[]) {
      if (field === "root" || field === "sealedMasterSeedFile") continue;
      if (includedFields.has(field) || excludedFields.has(field)) continue;
      unaccounted.push(field);
    }
    expect(unaccounted).toEqual([]);
  });

  it("28. fedosRecoveryBundleDestinationPathFor rejects an unrecognized logical name -- restore never writes an arbitrary caller-supplied name", () => {
    expect(fedosRecoveryBundleDestinationPathFor("../../etc/passwd", paths)).toBeNull();
    expect(fedosRecoveryBundleDestinationPathFor("sync-journal", paths)).toBeNull(); // excluded, not just unrecognized
    expect(fedosRecoveryBundleDestinationPathFor("board", paths)).toBe(paths.boardLogFile);
  });
});
