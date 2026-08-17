import { describe, it, expect, vi } from "vitest";
import { mkdtempSync, rmSync, readFileSync, existsSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";

import { FedosRecoveryBundleEncryptionAuthority, type FedosRecoveryBundleEncryptionRuntimeBoundary } from "../src/os/messenger/desktop/recovery/fedos_recovery_bundle_encryption.js";
import type { FedosRecoveryBundleDataPartEntry } from "../src/os/messenger/desktop/recovery/fedos_recovery_bundle_data_part_codec.js";
import { serializeFedosRecoveryBundleToBytes } from "../src/os/messenger/desktop/recovery/fedos_recovery_bundle.js";
import { restoreFedosRecoveryBundle, inspectFedosRecoveryBundle } from "../src/os/messenger/desktop/recovery/fedos_recovery_bundle_import_coordinator.js";
import { planFedosLocalProfilePaths, type FedosLocalProfilePaths } from "../src/os/messenger/desktop/onboarding/fedos_local_profile_paths.js";
import { createFedosLocalProfileDescriptorV1 } from "../src/os/messenger/desktop/onboarding/fedos_local_profile_descriptor.js";
import type { FedosMasterSeedAuthority } from "../src/os/core/vault/wasm/fedos_master_seed_authority.js";
import type { AeadCiphertextHandle, AeadCiphertextWire, AeadKeyHandle } from "../src/runtime/fedos_wasm_loader.js";
import { encodeFedosSettingsDescriptorV1, decodeFedosSettingsDescriptorV1 } from "../src/os/core/settings/fedos_settings_codec.js";
import { defaultFedosSettingsDescriptorV1 } from "../src/os/core/settings/fedos_settings_descriptor.js";

const VALID_SEALED_ENVELOPE = '{"v":1,"kdf":"argon2id","m":19456,"t":2,"p":1,"salt":"aa","alg":"chacha20poly1305","n":"bb","ct":"cc"}';
const ACCOUNT_PUBLIC_KEY_HEX = "ab".repeat(32);
const SUITE = "ChaCha20Poly1305" as const;
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

/** Same shared-map fake as the sibling recovery_bundle.test.ts, duplicated here deliberately (this file's own boundary object must be a genuinely fresh instance per test to avoid cross-test ciphertext-id collisions). */
function fakeRoundTrippingRuntimeBoundary(): FedosRecoveryBundleEncryptionRuntimeBoundary {
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

/**
 * NOTE: `fn` must be awaited INSIDE this function, not merely returned --
 * `return fn(dir)` (without `await`) lets `finally`'s `rmSync` run
 * synchronously right after `fn(dir)` yields its first pending Promise,
 * deleting the directory while the caller's own `await`-separated body is
 * still mid-flight. This never manifested in THIS file's own tests (none
 * of them read a real file back off `sourceRoot`'s disk, and
 * `restoreFedosRecoveryBundle()`'s own `atomicWrite()` defensively
 * recreates a missing target directory on write) but is a real latent
 * landmine for any test added later that does real I/O across an await
 * boundary -- found and fixed while writing the sibling
 * `_export_coordinator.test.ts` suite, which hit it immediately.
 */
async function withTempDir<T>(fn: (dir: string) => T | Promise<T>): Promise<T> {
  const dir = mkdtempSync(join(tmpdir(), "fedos-recovery-import-coordinator-"));
  try {
    return await fn(dir);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

async function buildBundleWithDescriptorAndBoard(boundary: FedosRecoveryBundleEncryptionRuntimeBoundary, sourceRoot: string): Promise<Uint8Array> {
  const sourceDescriptor = createFedosLocalProfileDescriptorV1({
    profileId: "a".repeat(32),
    displayLabel: "Alice's laptop",
    accountPublicIdentity: { authority: "nostr", publicKeyHex: ACCOUNT_PUBLIC_KEY_HEX },
    localDeviceId: "device-SOURCE-MACHINE-A",
    createdAt: 1_700_000_000_000,
    sealedMasterSeedRef: join(sourceRoot, "master-seed.sealed.json"),
    dataDirectoryRoot: sourceRoot,
    initializationState: "ready",
  })!;

  const entries: FedosRecoveryBundleDataPartEntry[] = [
    { name: "profile-descriptor", bytes: new TextEncoder().encode(JSON.stringify(sourceDescriptor)) },
    { name: "board", bytes: new TextEncoder().encode('{"kind":"post"}\n') },
    { name: "conversation-payload-retention", bytes: new TextEncoder().encode('{"planId":"p1"}\n') },
  ];

  const buildAuthority = new FedosRecoveryBundleEncryptionAuthority(fakeMasterSeedAuthority(), boundary);
  const buildResult = await buildAuthority.build({
    sealedMasterSeedEnvelope: VALID_SEALED_ENVELOPE,
    now: 1_700_000_000,
    dataPart: { suite: SUITE, accountIndex: 0, selfAccountPublicKeyHex: ACCOUNT_PUBLIC_KEY_HEX, entries },
  });
  expect(buildResult.outcome).toBe("built");
  if (buildResult.outcome !== "built") throw new Error("unreachable");
  return serializeFedosRecoveryBundleToBytes(buildResult.bundle);
}

describe("Disaster Recovery Portable Backup -- inspectFedosRecoveryBundle (mandate §11 plan)", () => {
  it("1. malformed JSON -> malformed", () => {
    expect(inspectFedosRecoveryBundle(new TextEncoder().encode("{not json")).outcome).toBe("malformed");
  });

  it("2. wrong version -> unsupported-version, distinct from malformed", () => {
    const bytes = new TextEncoder().encode(JSON.stringify({ v: 2, kind: "fedos-recovery-bundle" }));
    const result = inspectFedosRecoveryBundle(bytes);
    expect(result.outcome).toBe("unsupported-version");
    if (result.outcome === "unsupported-version") expect(result.foundVersion).toBe(2);
  });

  it("3. a well-formed identity-only bundle inspects with hasDataPart=false and a real staleness warning string", () => {
    const bytes = new TextEncoder().encode(
      JSON.stringify({ v: 1, kind: "fedos-recovery-bundle", createdAt: 1_700_000_000, sealedMasterSeedEnvelope: VALID_SEALED_ENVELOPE, dataCiphertext: null, manifest: null }),
    );
    const result = inspectFedosRecoveryBundle(bytes);
    expect(result.outcome).toBe("ok");
    if (result.outcome !== "ok") return;
    expect(result.plan.hasDataPart).toBe(false);
    expect(result.plan.createdAt).toBe(1_700_000_000);
    expect(result.plan.stalenessWarning.length).toBeGreaterThan(0);
    expect(result.plan.deliberatelyExcludedFieldNames).toContain("deviceRegistryLogFile");
  });
});

describe("Disaster Recovery Portable Backup -- restoreFedosRecoveryBundle (mandate §9/§12 restore coordinator)", () => {
  it("4. full round trip: fresh localDeviceId/sealedMasterSeedRef/dataDirectoryRoot on the restored descriptor, never carried forward from the bundle", async () => {
    await withTempDir(async (sourceRoot) => {
      await withTempDir(async (targetRoot) => {
        const boundary = fakeRoundTrippingRuntimeBoundary();
        const bundleBytes = await buildBundleWithDescriptorAndBoard(boundary, sourceRoot);
        const targetPaths = planFedosLocalProfilePaths(targetRoot)!;

        const result = await restoreFedosRecoveryBundle({
          bundleBytes,
          passphrase: new TextEncoder().encode("correct horse"),
          suite: SUITE,
          accountIndex: 0,
          masterSeedAuthority: fakeMasterSeedAuthority(),
          resolveAccountPublicKeyHex: async () => ACCOUNT_PUBLIC_KEY_HEX,
          targetPaths,
          freshLocalDeviceId: "device-TARGET-MACHINE-B",
          now: 1_800_000_000_000,
          runtimeBoundary: boundary,
        });

        expect(result.outcome).toBe("restored");
        if (result.outcome !== "restored") return;
        expect(result.localDeviceId).toBe("device-TARGET-MACHINE-B");

        // The board entry was written verbatim to the target's own path.
        expect(existsSync(targetPaths.boardLogFile)).toBe(true);
        expect(readFileSync(targetPaths.boardLogFile, "utf8")).toBe('{"kind":"post"}\n');

        // The profile-descriptor was NOT written verbatim -- every
        // machine/device-specific field is regenerated against the TARGET.
        expect(existsSync(targetPaths.profileDescriptorFile)).toBe(true);
        const restoredDescriptor = JSON.parse(readFileSync(targetPaths.profileDescriptorFile, "utf8"));
        expect(restoredDescriptor.localDeviceId, "must never carry the source device id forward").toBe("device-TARGET-MACHINE-B");
        expect(restoredDescriptor.localDeviceId).not.toBe("device-SOURCE-MACHINE-A");
        expect(restoredDescriptor.sealedMasterSeedRef, "must point at the TARGET's own path, never the source machine's").toBe(targetPaths.sealedMasterSeedFile);
        expect(restoredDescriptor.sealedMasterSeedRef).not.toContain(sourceRoot);
        expect(restoredDescriptor.dataDirectoryRoot).toBe(targetPaths.root);
        expect(restoredDescriptor.dataDirectoryRoot).not.toBe(sourceRoot);
        // Identity/display fields ARE legitimately carried forward.
        expect(restoredDescriptor.profileId).toBe("a".repeat(32));
        expect(restoredDescriptor.displayLabel).toBe("Alice's laptop");

        // Payload-retention staleness -- never classified "recovered".
        const retentionAsset = result.assets.find((a) => a.name === "conversation-payload-retention");
        expect(retentionAsset?.classification).toBe("partial");

        // Every excluded field is classified "reestablished", never silently dropped from the report.
        const deviceRegistryAsset = result.assets.find((a) => a.name === "deviceRegistryLogFile");
        expect(deviceRegistryAsset?.classification).toBe("reestablished");
      });
    });
  });

  it("5. malformed bundle bytes -> malformed, nothing written", async () => {
    await withTempDir(async (targetRoot) => {
      const targetPaths = planFedosLocalProfilePaths(targetRoot)!;
      const result = await restoreFedosRecoveryBundle({
        bundleBytes: new TextEncoder().encode("not a bundle"),
        passphrase: new TextEncoder().encode("x"),
        suite: SUITE,
        accountIndex: 0,
        masterSeedAuthority: fakeMasterSeedAuthority(),
        resolveAccountPublicKeyHex: async () => ACCOUNT_PUBLIC_KEY_HEX,
        targetPaths,
        freshLocalDeviceId: "device-B",
        now: 0,
      });
      expect(result.outcome).toBe("malformed");
      expect(existsSync(targetPaths.profileDescriptorFile)).toBe(false);
    });
  });

  it("6. wrong passphrase -> wrong-secret, never proceeds to the Data Part, nothing written", async () => {
    await withTempDir(async (sourceRoot) => {
      await withTempDir(async (targetRoot) => {
        const boundary = fakeRoundTrippingRuntimeBoundary();
        const bundleBytes = await buildBundleWithDescriptorAndBoard(boundary, sourceRoot);
        const targetPaths = planFedosLocalProfilePaths(targetRoot)!;

        const result = await restoreFedosRecoveryBundle({
          bundleBytes,
          passphrase: new TextEncoder().encode("wrong"),
          suite: SUITE,
          accountIndex: 0,
          masterSeedAuthority: fakeMasterSeedAuthority({ restoreSealed: vi.fn(async () => false) }),
          resolveAccountPublicKeyHex: async () => ACCOUNT_PUBLIC_KEY_HEX,
          targetPaths,
          freshLocalDeviceId: "device-B",
          now: 0,
          runtimeBoundary: boundary,
        });
        expect(result.outcome).toBe("wrong-secret");
        expect(existsSync(targetPaths.boardLogFile)).toBe(false);
        expect(existsSync(targetPaths.profileDescriptorFile)).toBe(false);
      });
    });
  });

  it("7. identity-only bundle (no Data Part) restores identity alone -- outcome restored, zero Data Part files written", async () => {
    await withTempDir(async (targetRoot) => {
      const identityOnlyBundle: Uint8Array = new TextEncoder().encode(
        JSON.stringify({ v: 1, kind: "fedos-recovery-bundle", createdAt: 1_700_000_000, sealedMasterSeedEnvelope: VALID_SEALED_ENVELOPE, dataCiphertext: null, manifest: null }),
      );
      const targetPaths = planFedosLocalProfilePaths(targetRoot)!;
      const result = await restoreFedosRecoveryBundle({
        bundleBytes: identityOnlyBundle,
        passphrase: new TextEncoder().encode("correct horse"),
        suite: SUITE,
        accountIndex: 0,
        masterSeedAuthority: fakeMasterSeedAuthority(),
        resolveAccountPublicKeyHex: async () => ACCOUNT_PUBLIC_KEY_HEX,
        targetPaths,
        freshLocalDeviceId: "device-B",
        now: 0,
      });
      expect(result.outcome).toBe("restored");
      if (result.outcome !== "restored") return;
      expect(result.accountPublicKeyHex).toBe(ACCOUNT_PUBLIC_KEY_HEX);
      expect(existsSync(targetPaths.boardLogFile)).toBe(false);
      expect(existsSync(targetPaths.profileDescriptorFile)).toBe(false);
    });
  });

  it("8. account identity unresolved after a genuinely restored identity -> honest failure, not a silent empty-string identity", async () => {
    await withTempDir(async (sourceRoot) => {
      await withTempDir(async (targetRoot) => {
        const boundary = fakeRoundTrippingRuntimeBoundary();
        const bundleBytes = await buildBundleWithDescriptorAndBoard(boundary, sourceRoot);
        const targetPaths = planFedosLocalProfilePaths(targetRoot)!;
        const result = await restoreFedosRecoveryBundle({
          bundleBytes,
          passphrase: new TextEncoder().encode("correct horse"),
          suite: SUITE,
          accountIndex: 0,
          masterSeedAuthority: fakeMasterSeedAuthority(),
          resolveAccountPublicKeyHex: async () => null,
          targetPaths,
          freshLocalDeviceId: "device-B",
          now: 0,
          runtimeBoundary: boundary,
        });
        expect(result.outcome).toBe("account-identity-unresolved");
      });
    });
  });
});

describe("Disaster Recovery Portable Backup -- Commerce + settings.json extension (Lineage Reconciliation follow-up)", () => {
  it("9. a Commerce entry restores verbatim to the target's own commerce root when targetCommerceRoot is supplied", async () => {
    await withTempDir(async (sourceRoot) => {
      await withTempDir(async (targetRoot) => {
        await withTempDir(async (targetCommerceRoot) => {
          const boundary = fakeRoundTrippingRuntimeBoundary();
          const buildAuthority = new FedosRecoveryBundleEncryptionAuthority(fakeMasterSeedAuthority(), boundary);
          const entries: FedosRecoveryBundleDataPartEntry[] = [{ name: "commerce-orders", bytes: new TextEncoder().encode('{"orderId":"o1"}\n') }];
          const buildResult = await buildAuthority.build({
            sealedMasterSeedEnvelope: VALID_SEALED_ENVELOPE,
            now: 1_700_000_000,
            dataPart: { suite: SUITE, accountIndex: 0, selfAccountPublicKeyHex: ACCOUNT_PUBLIC_KEY_HEX, entries },
          });
          expect(buildResult.outcome).toBe("built");
          if (buildResult.outcome !== "built") return;

          const targetPaths = planFedosLocalProfilePaths(targetRoot)!;
          const result = await restoreFedosRecoveryBundle({
            bundleBytes: serializeFedosRecoveryBundleToBytes(buildResult.bundle),
            passphrase: new TextEncoder().encode("correct horse"),
            suite: SUITE,
            accountIndex: 0,
            masterSeedAuthority: fakeMasterSeedAuthority(),
            resolveAccountPublicKeyHex: async () => ACCOUNT_PUBLIC_KEY_HEX,
            targetPaths,
            targetCommerceRoot,
            freshLocalDeviceId: "device-B",
            now: 0,
            runtimeBoundary: boundary,
          });
          expect(result.outcome).toBe("restored");
          if (result.outcome !== "restored") return;
          const ordersAsset = result.assets.find((a) => a.name === "commerce-orders");
          expect(ordersAsset?.classification).toBe("recovered");
          expect(readFileSync(join(targetCommerceRoot, "orders.ndjson"), "utf8")).toBe('{"orderId":"o1"}\n');
        });
      });
    });
  });

  it("10. a Commerce entry is classified lost, never written anywhere, when the caller supplies no targetCommerceRoot", async () => {
    await withTempDir(async (sourceRoot) => {
      await withTempDir(async (targetRoot) => {
        const boundary = fakeRoundTrippingRuntimeBoundary();
        const buildAuthority = new FedosRecoveryBundleEncryptionAuthority(fakeMasterSeedAuthority(), boundary);
        const entries: FedosRecoveryBundleDataPartEntry[] = [{ name: "commerce-receipts", bytes: new TextEncoder().encode('{"receiptId":"r1"}\n') }];
        const buildResult = await buildAuthority.build({
          sealedMasterSeedEnvelope: VALID_SEALED_ENVELOPE,
          now: 1_700_000_000,
          dataPart: { suite: SUITE, accountIndex: 0, selfAccountPublicKeyHex: ACCOUNT_PUBLIC_KEY_HEX, entries },
        });
        expect(buildResult.outcome).toBe("built");
        if (buildResult.outcome !== "built") return;

        const targetPaths = planFedosLocalProfilePaths(targetRoot)!;
        const result = await restoreFedosRecoveryBundle({
          bundleBytes: serializeFedosRecoveryBundleToBytes(buildResult.bundle),
          passphrase: new TextEncoder().encode("correct horse"),
          suite: SUITE,
          accountIndex: 0,
          masterSeedAuthority: fakeMasterSeedAuthority(),
          resolveAccountPublicKeyHex: async () => ACCOUNT_PUBLIC_KEY_HEX,
          targetPaths,
          freshLocalDeviceId: "device-B",
          now: 0,
          runtimeBoundary: boundary,
        });
        expect(result.outcome).toBe("restored");
        if (result.outcome !== "restored") return;
        expect(result.assets.find((a) => a.name === "commerce-receipts")?.classification).toBe("lost");
      });
    });
  });

  it("11. settings.json restores preferences verbatim but resets the machine-specific archiveDirectory, never carrying the source path forward", async () => {
    await withTempDir(async (sourceRoot) => {
      await withTempDir(async (targetRoot) => {
        await withTempDir(async (targetSettingsDir) => {
          const targetSettingsPath = join(targetSettingsDir, "settings.json");
          const sourceSettings = { ...defaultFedosSettingsDescriptorV1(), theme: "dark" as const, language: "ja" as const, archiveDirectory: join(sourceRoot, "archive") };

          const boundary = fakeRoundTrippingRuntimeBoundary();
          const buildAuthority = new FedosRecoveryBundleEncryptionAuthority(fakeMasterSeedAuthority(), boundary);
          const entries: FedosRecoveryBundleDataPartEntry[] = [{ name: "app-settings", bytes: new TextEncoder().encode(encodeFedosSettingsDescriptorV1(sourceSettings)) }];
          const buildResult = await buildAuthority.build({
            sealedMasterSeedEnvelope: VALID_SEALED_ENVELOPE,
            now: 1_700_000_000,
            dataPart: { suite: SUITE, accountIndex: 0, selfAccountPublicKeyHex: ACCOUNT_PUBLIC_KEY_HEX, entries },
          });
          expect(buildResult.outcome).toBe("built");
          if (buildResult.outcome !== "built") return;

          const targetPaths = planFedosLocalProfilePaths(targetRoot)!;
          const result = await restoreFedosRecoveryBundle({
            bundleBytes: serializeFedosRecoveryBundleToBytes(buildResult.bundle),
            passphrase: new TextEncoder().encode("correct horse"),
            suite: SUITE,
            accountIndex: 0,
            masterSeedAuthority: fakeMasterSeedAuthority(),
            resolveAccountPublicKeyHex: async () => ACCOUNT_PUBLIC_KEY_HEX,
            targetPaths,
            targetSettingsPath,
            freshLocalDeviceId: "device-B",
            now: 0,
            runtimeBoundary: boundary,
          });
          expect(result.outcome).toBe("restored");
          if (result.outcome !== "restored") return;
          expect(result.assets.find((a) => a.name === "app-settings")?.classification).toBe("partial");

          const restored = decodeFedosSettingsDescriptorV1(readFileSync(targetSettingsPath, "utf8"));
          expect(restored?.theme).toBe("dark");
          expect(restored?.language).toBe("ja");
          expect(restored?.archiveDirectory, "must never carry the source machine's own path forward").toBe("");
        });
      });
    });
  });
});

describe("Disaster Recovery Portable Backup -- commerce-payment-settlements classification (self-discovered gap, closed during IPC-wiring pass)", () => {
  it("14. a commerce-payment-settlements entry restores verbatim to the target's own commerce root -- was previously unclassified in neither the included nor excluded lists", async () => {
    await withTempDir(async (targetRoot) => {
      await withTempDir(async (targetCommerceRoot) => {
        const boundary = fakeRoundTrippingRuntimeBoundary();
        const buildAuthority = new FedosRecoveryBundleEncryptionAuthority(fakeMasterSeedAuthority(), boundary);
        const entries: FedosRecoveryBundleDataPartEntry[] = [
          { name: "commerce-payment-settlements", bytes: new TextEncoder().encode('{"paymentId":"p1","status":"settled"}\n') },
        ];
        const buildResult = await buildAuthority.build({
          sealedMasterSeedEnvelope: VALID_SEALED_ENVELOPE,
          now: 1_700_000_000,
          dataPart: { suite: SUITE, accountIndex: 0, selfAccountPublicKeyHex: ACCOUNT_PUBLIC_KEY_HEX, entries },
        });
        expect(buildResult.outcome).toBe("built");
        if (buildResult.outcome !== "built") return;

        const targetPaths = planFedosLocalProfilePaths(targetRoot)!;
        const result = await restoreFedosRecoveryBundle({
          bundleBytes: serializeFedosRecoveryBundleToBytes(buildResult.bundle),
          passphrase: new TextEncoder().encode("correct horse"),
          suite: SUITE,
          accountIndex: 0,
          masterSeedAuthority: fakeMasterSeedAuthority(),
          resolveAccountPublicKeyHex: async () => ACCOUNT_PUBLIC_KEY_HEX,
          targetPaths,
          targetCommerceRoot,
          freshLocalDeviceId: "device-B",
          now: 0,
          runtimeBoundary: boundary,
        });
        expect(result.outcome).toBe("restored");
        if (result.outcome !== "restored") return;
        expect(result.assets.find((a) => a.name === "commerce-payment-settlements")?.classification).toBe("recovered");
        expect(readFileSync(join(targetCommerceRoot, "payment_settlements.ndjson"), "utf8")).toBe('{"paymentId":"p1","status":"settled"}\n');
      });
    });
  });
});

describe("Disaster Recovery Portable Backup -- sealed Master Seed durability (self-discovered gap, Lineage Reconciliation follow-up round 2)", () => {
  it("12. restore persists the bundle's own sealed Master Seed envelope verbatim to the target's sealedMasterSeedFile, not just in-memory", async () => {
    await withTempDir(async (sourceRoot) => {
      await withTempDir(async (targetRoot) => {
        const boundary = fakeRoundTrippingRuntimeBoundary();
        const bundleBytes = await buildBundleWithDescriptorAndBoard(boundary, sourceRoot);
        const targetPaths = planFedosLocalProfilePaths(targetRoot)!;

        expect(existsSync(targetPaths.sealedMasterSeedFile), "must not exist before restore").toBe(false);

        const result = await restoreFedosRecoveryBundle({
          bundleBytes,
          passphrase: new TextEncoder().encode("correct horse"),
          suite: SUITE,
          accountIndex: 0,
          masterSeedAuthority: fakeMasterSeedAuthority(),
          resolveAccountPublicKeyHex: async () => ACCOUNT_PUBLIC_KEY_HEX,
          targetPaths,
          freshLocalDeviceId: "device-TARGET-MACHINE-B",
          now: 1_800_000_000_000,
          runtimeBoundary: boundary,
        });

        expect(result.outcome).toBe("restored");
        // Without this write a restored profile would only work for the
        // remainder of this one call -- a later, ordinary unlockProfile()
        // constructs its OWN fresh masterSeedAuthority and reads this exact
        // path from disk; there would be nothing there.
        expect(existsSync(targetPaths.sealedMasterSeedFile), "the sealed Master Seed envelope must be durably persisted to the target's own path").toBe(true);
        expect(readFileSync(targetPaths.sealedMasterSeedFile, "utf8"), "must be the bundle's own envelope, verbatim").toBe(VALID_SEALED_ENVELOPE);
      });
    });
  });

  it("13. restore refuses to overwrite an already-present sealedMasterSeedFile at the target -- target-not-fresh, nothing else written", async () => {
    await withTempDir(async (sourceRoot) => {
      await withTempDir(async (targetRoot) => {
        const boundary = fakeRoundTrippingRuntimeBoundary();
        const bundleBytes = await buildBundleWithDescriptorAndBoard(boundary, sourceRoot);
        const targetPaths = planFedosLocalProfilePaths(targetRoot)!;

        // Simulate a target that is NOT actually fresh -- e.g. a live profile already exists there.
        mkdirSync(dirname(targetPaths.sealedMasterSeedFile), { recursive: true });
        writeFileSync(targetPaths.sealedMasterSeedFile, "pre-existing live profile's own sealed seed");

        const result = await restoreFedosRecoveryBundle({
          bundleBytes,
          passphrase: new TextEncoder().encode("correct horse"),
          suite: SUITE,
          accountIndex: 0,
          masterSeedAuthority: fakeMasterSeedAuthority(),
          resolveAccountPublicKeyHex: async () => ACCOUNT_PUBLIC_KEY_HEX,
          targetPaths,
          freshLocalDeviceId: "device-TARGET-MACHINE-B",
          now: 1_800_000_000_000,
          runtimeBoundary: boundary,
        });

        expect(result.outcome).toBe("target-not-fresh");
        expect(readFileSync(targetPaths.sealedMasterSeedFile, "utf8"), "the pre-existing live profile's own seed must never be clobbered").toBe(
          "pre-existing live profile's own sealed seed",
        );
        expect(existsSync(targetPaths.profileDescriptorFile), "must stop before writing anything else").toBe(false);
      });
    });
  });
});
