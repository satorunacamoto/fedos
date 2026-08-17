import { describe, it, expect, vi } from "vitest";
import { mkdtempSync, rmSync, readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";

import { exportFedosRecoveryBundle } from "../src/os/messenger/desktop/recovery/fedos_recovery_bundle_export_coordinator.js";
import { restoreFedosRecoveryBundle } from "../src/os/messenger/desktop/recovery/fedos_recovery_bundle_import_coordinator.js";
import { deserializeFedosRecoveryBundleFromBytes } from "../src/os/messenger/desktop/recovery/fedos_recovery_bundle.js";
import type { FedosRecoveryBundleEncryptionRuntimeBoundary } from "../src/os/messenger/desktop/recovery/fedos_recovery_bundle_encryption.js";
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
 * still mid-flight. Found while writing this file's own tests 4-7, which
 * (unlike the sibling `_import_coordinator.test.ts` suite) do real
 * synchronous-write-then-async-read I/O against the SAME temp directory
 * across an await boundary and so are the first tests to actually expose
 * the race.
 */
async function withTempDir<T>(fn: (dir: string) => T | Promise<T>): Promise<T> {
  const dir = mkdtempSync(join(tmpdir(), "fedos-recovery-export-coordinator-"));
  try {
    return await fn(dir);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

function writeFileEnsuringDir(path: string, contents: string): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, contents);
}

describe("Disaster Recovery Portable Backup -- exportFedosRecoveryBundle (the missing symmetric half of the Import Coordinator, found during IPC-wiring)", () => {
  it("1. seed-unreadable when sealedMasterSeedFile does not exist on disk", async () => {
    await withTempDir(async (sourceRoot) => {
      const sourcePaths = planFedosLocalProfilePaths(sourceRoot)!;
      const result = await exportFedosRecoveryBundle({
        sourcePaths,
        suite: SUITE,
        accountIndex: 0,
        masterSeedAuthority: fakeMasterSeedAuthority(),
        resolveAccountPublicKeyHex: async () => ACCOUNT_PUBLIC_KEY_HEX,
        now: 1_800_000_000_000,
      });
      expect(result.outcome).toBe("seed-unreadable");
    });
  });

  it("2. account-identity-unresolved when the caller's resolver returns null -- nothing built", async () => {
    await withTempDir(async (sourceRoot) => {
      const sourcePaths = planFedosLocalProfilePaths(sourceRoot)!;
      writeFileEnsuringDir(sourcePaths.sealedMasterSeedFile, VALID_SEALED_ENVELOPE);
      const result = await exportFedosRecoveryBundle({
        sourcePaths,
        suite: SUITE,
        accountIndex: 0,
        masterSeedAuthority: fakeMasterSeedAuthority(),
        resolveAccountPublicKeyHex: async () => null,
        now: 1_800_000_000_000,
      });
      expect(result.outcome).toBe("account-identity-unresolved");
    });
  });

  it("3. the exported bundle's Identity Part is the sealedMasterSeedFile's own bytes, verbatim", async () => {
    await withTempDir(async (sourceRoot) => {
      const sourcePaths = planFedosLocalProfilePaths(sourceRoot)!;
      writeFileEnsuringDir(sourcePaths.sealedMasterSeedFile, VALID_SEALED_ENVELOPE);
      const boundary = fakeRoundTrippingRuntimeBoundary();
      const result = await exportFedosRecoveryBundle({
        sourcePaths,
        suite: SUITE,
        accountIndex: 0,
        masterSeedAuthority: fakeMasterSeedAuthority(),
        resolveAccountPublicKeyHex: async () => ACCOUNT_PUBLIC_KEY_HEX,
        now: 1_800_000_000_000,
        runtimeBoundary: boundary,
      });
      expect(result.outcome).toBe("exported");
      if (result.outcome !== "exported") return;
      const bundle = deserializeFedosRecoveryBundleFromBytes(result.bundleBytes);
      expect(bundle?.sealedMasterSeedEnvelope).toBe(VALID_SEALED_ENVELOPE);
    });
  });

  it("4. only Messenger/Commerce/settings files that actually exist on disk are included -- never a failure for a file never written yet", async () => {
    await withTempDir(async (sourceRoot) => {
      const sourcePaths = planFedosLocalProfilePaths(sourceRoot)!;
      writeFileEnsuringDir(sourcePaths.sealedMasterSeedFile, VALID_SEALED_ENVELOPE);
      writeFileEnsuringDir(sourcePaths.boardLogFile, '{"kind":"post"}\n');
      // outboxLogFile deliberately never written.
      const boundary = fakeRoundTrippingRuntimeBoundary();
      const result = await exportFedosRecoveryBundle({
        sourcePaths,
        suite: SUITE,
        accountIndex: 0,
        masterSeedAuthority: fakeMasterSeedAuthority(),
        resolveAccountPublicKeyHex: async () => ACCOUNT_PUBLIC_KEY_HEX,
        now: 1_800_000_000_000,
        runtimeBoundary: boundary,
      });
      expect(result.outcome).toBe("exported");
      if (result.outcome !== "exported") return;
      const bundle = deserializeFedosRecoveryBundleFromBytes(result.bundleBytes);
      expect(bundle?.manifest?.includedLogs).toContain("board");
      expect(bundle?.manifest?.includedLogs).not.toContain("outbox");
    });
  });

  it("5. Commerce entries are included only when sourceCommerceRoot is supplied and the file exists", async () => {
    await withTempDir(async (sourceRoot) => {
      const sourcePaths = planFedosLocalProfilePaths(sourceRoot)!;
      writeFileEnsuringDir(sourcePaths.sealedMasterSeedFile, VALID_SEALED_ENVELOPE);
      const commerceRoot = join(sourceRoot, "commerce");
      writeFileEnsuringDir(join(commerceRoot, "orders.ndjson"), '{"orderId":"o1"}\n');
      const boundary = fakeRoundTrippingRuntimeBoundary();
      const result = await exportFedosRecoveryBundle({
        sourcePaths,
        suite: SUITE,
        accountIndex: 0,
        masterSeedAuthority: fakeMasterSeedAuthority(),
        resolveAccountPublicKeyHex: async () => ACCOUNT_PUBLIC_KEY_HEX,
        now: 1_800_000_000_000,
        runtimeBoundary: boundary,
        sourceCommerceRoot: commerceRoot,
      });
      expect(result.outcome).toBe("exported");
      if (result.outcome !== "exported") return;
      const bundle = deserializeFedosRecoveryBundleFromBytes(result.bundleBytes);
      expect(bundle?.manifest?.includedLogs).toContain("commerce-orders");
    });
  });

  it("6. settings.json is included only when sourceSettingsPath is supplied and exists", async () => {
    await withTempDir(async (sourceRoot) => {
      await withTempDir(async (settingsDir) => {
        const sourcePaths = planFedosLocalProfilePaths(sourceRoot)!;
        writeFileEnsuringDir(sourcePaths.sealedMasterSeedFile, VALID_SEALED_ENVELOPE);
        const sourceSettingsPath = join(settingsDir, "settings.json");
        writeFileSync(sourceSettingsPath, encodeFedosSettingsDescriptorV1({ ...defaultFedosSettingsDescriptorV1(), theme: "dark" }));
        const boundary = fakeRoundTrippingRuntimeBoundary();
        const result = await exportFedosRecoveryBundle({
          sourcePaths,
          suite: SUITE,
          accountIndex: 0,
          masterSeedAuthority: fakeMasterSeedAuthority(),
          resolveAccountPublicKeyHex: async () => ACCOUNT_PUBLIC_KEY_HEX,
          now: 1_800_000_000_000,
          runtimeBoundary: boundary,
          sourceSettingsPath,
        });
        expect(result.outcome).toBe("exported");
        if (result.outcome !== "exported") return;
        const bundle = deserializeFedosRecoveryBundleFromBytes(result.bundleBytes);
        expect(bundle?.manifest?.includedLogs).toContain("app-settings");
      });
    });
  });
});

describe("Disaster Recovery Portable Backup -- FULL round trip: exportFedosRecoveryBundle (Machine A) -> restoreFedosRecoveryBundle (Machine B)", () => {
  it("7. a real profile with Messenger/Commerce/settings data exports and restores byte-correctly onto an independent fresh target, with every machine-specific field regenerated", async () => {
    await withTempDir(async (sourceRoot) => {
      await withTempDir(async (targetRoot) => {
        await withTempDir(async (sourceSettingsDir) => {
          await withTempDir(async (targetSettingsDir) => {
            const sourcePaths = planFedosLocalProfilePaths(sourceRoot)!;
            writeFileEnsuringDir(sourcePaths.sealedMasterSeedFile, VALID_SEALED_ENVELOPE);

            const sourceDescriptor = createFedosLocalProfileDescriptorV1({
              profileId: "a".repeat(32),
              displayLabel: "Alice's laptop",
              accountPublicIdentity: { authority: "nostr", publicKeyHex: ACCOUNT_PUBLIC_KEY_HEX },
              localDeviceId: "device-SOURCE-MACHINE-A",
              createdAt: 1_700_000_000_000,
              sealedMasterSeedRef: sourcePaths.sealedMasterSeedFile,
              dataDirectoryRoot: sourceRoot,
              initializationState: "ready",
            })!;
            writeFileEnsuringDir(sourcePaths.profileDescriptorFile, JSON.stringify(sourceDescriptor));
            writeFileEnsuringDir(sourcePaths.boardLogFile, '{"kind":"post"}\n');

            const sourceCommerceRoot = join(sourceRoot, "commerce");
            writeFileEnsuringDir(join(sourceCommerceRoot, "orders.ndjson"), '{"orderId":"o1"}\n');

            const sourceSettingsPath = join(sourceSettingsDir, "settings.json");
            writeFileSync(
              sourceSettingsPath,
              encodeFedosSettingsDescriptorV1({ ...defaultFedosSettingsDescriptorV1(), theme: "dark", language: "ja", archiveDirectory: join(sourceRoot, "archive") }),
            );

            const boundary = fakeRoundTrippingRuntimeBoundary();
            const exportResult = await exportFedosRecoveryBundle({
              sourcePaths,
              suite: SUITE,
              accountIndex: 0,
              masterSeedAuthority: fakeMasterSeedAuthority(),
              resolveAccountPublicKeyHex: async () => ACCOUNT_PUBLIC_KEY_HEX,
              now: 1_800_000_000_000,
              runtimeBoundary: boundary,
              sourceCommerceRoot,
              sourceSettingsPath,
            });
            expect(exportResult.outcome).toBe("exported");
            if (exportResult.outcome !== "exported") return;

            const targetPaths = planFedosLocalProfilePaths(targetRoot)!;
            const targetCommerceRoot = join(targetRoot, "commerce");
            const targetSettingsPath = join(targetSettingsDir, "settings.json");

            const restoreResult = await restoreFedosRecoveryBundle({
              bundleBytes: exportResult.bundleBytes,
              passphrase: new TextEncoder().encode("correct horse"),
              suite: SUITE,
              accountIndex: 0,
              masterSeedAuthority: fakeMasterSeedAuthority(),
              resolveAccountPublicKeyHex: async () => ACCOUNT_PUBLIC_KEY_HEX,
              targetPaths,
              freshLocalDeviceId: "device-TARGET-MACHINE-B",
              now: 1_900_000_000_000,
              runtimeBoundary: boundary,
              targetCommerceRoot,
              targetSettingsPath,
            });
            expect(restoreResult.outcome).toBe("restored");
            if (restoreResult.outcome !== "restored") return;

            // Identity Part -- byte-identical round trip, target never touched source's own path.
            expect(readFileSync(targetPaths.sealedMasterSeedFile, "utf8")).toBe(VALID_SEALED_ENVELOPE);
            expect(targetPaths.sealedMasterSeedFile).not.toBe(sourcePaths.sealedMasterSeedFile);

            // Messenger log -- verbatim content.
            expect(readFileSync(targetPaths.boardLogFile, "utf8")).toBe('{"kind":"post"}\n');

            // Commerce log -- verbatim content, own target commerce root.
            expect(readFileSync(join(targetCommerceRoot, "orders.ndjson"), "utf8")).toBe('{"orderId":"o1"}\n');

            // Settings -- preferences carried, machine-specific archiveDirectory reset.
            const restoredSettings = decodeFedosSettingsDescriptorV1(readFileSync(targetSettingsPath, "utf8"));
            expect(restoredSettings?.theme).toBe("dark");
            expect(restoredSettings?.language).toBe("ja");
            expect(restoredSettings?.archiveDirectory).toBe("");

            // Profile descriptor -- identity carried, every machine-specific field regenerated.
            const restoredDescriptor = JSON.parse(readFileSync(targetPaths.profileDescriptorFile, "utf8"));
            expect(restoredDescriptor.displayLabel).toBe("Alice's laptop");
            expect(restoredDescriptor.localDeviceId).toBe("device-TARGET-MACHINE-B");
            expect(restoredDescriptor.localDeviceId).not.toBe("device-SOURCE-MACHINE-A");
            expect(restoredDescriptor.dataDirectoryRoot).toBe(targetRoot);
            expect(restoredDescriptor.dataDirectoryRoot).not.toBe(sourceRoot);
          });
        });
      });
    });
  });
});
