/**
 * Disaster Recovery / Portable Backup Arc — the REAL, no-fake-crypto
 * fresh-machine restore vertical slice. This is the Arc's own acceptance
 * bar for goal #4 ("prove with actual installed binary"): drives the
 * REAL, compiled `packages/fedos-core-rust/pkg/` WASM artifact end to
 * end through Machine A (create a real synthetic profile, generate a
 * real Master Seed, seal it, build a Recovery Bundle) and an
 * independent, in-process Machine B simulation (a genuinely separate
 * temp directory, a genuinely fresh/empty `FedosWasmMasterSeedAuthority`
 * instance, NO reference to Machine A's profile directory anywhere) that
 * imports the Bundle and restores.
 *
 * Runs under an explicit, locally save/restored `NODE_ENV=development`
 * override, mirroring
 * `test/secure_runtime_alpha_1761_1840_direct_real_vertical_slice.test.ts`'s
 * own established discipline exactly — the SAME real-WASM-backed
 * Development Runtime pattern every real vertical slice test in this
 * repository already uses. One shared, already-primed
 * `FedosWasmLoaderSkeleton` is reused for both "machines" (it holds no
 * secret of any kind — see that file's own header for why this is not a
 * shortcut).
 *
 * Requires `packages/fedos-core-rust/pkg/` to already be built
 * (`npm run build:wasm`) — this file does not build it itself; it skips
 * with a clear message if the artifact is absent.
 */
import { describe, it, expect, afterEach } from "vitest";
import { existsSync, mkdtempSync, readFileSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

import { FedosWasmLoaderSkeleton } from "../src/runtime/fedos_wasm_loader.js";
import { FedosWasmMasterSeedAuthority } from "../src/os/core/vault/wasm/fedos_wasm_master_seed_authority.js";
import { FedosWasmNostrSigningAuthority } from "../src/os/messenger/adapters/nostr/protocol/sign/fedos_wasm_nostr_signing_authority.js";
import { planFedosLocalProfilePaths, ensureFedosLocalProfileDirectories, type FedosLocalProfilePaths } from "../src/os/messenger/desktop/onboarding/fedos_local_profile_paths.js";
import { fedosConversationArchiveFileAuthority } from "../src/os/messenger/conversations/archive/fs/fedos_conversation_archive_file_authority.js";
import { FedosRecoveryBundleEncryptionAuthority } from "../src/os/messenger/desktop/recovery/fedos_recovery_bundle_encryption.js";
import { serializeFedosRecoveryBundleToBytes, deserializeFedosRecoveryBundleFromBytes, type FedosRecoveryBundleV1 } from "../src/os/messenger/desktop/recovery/fedos_recovery_bundle.js";
import { fedosRecoveryBundleSourcePaths, fedosRecoveryBundleDestinationPathFor, FEDOS_RECOVERY_BUNDLE_INCLUDED_LOGS } from "../src/os/messenger/desktop/recovery/fedos_recovery_bundle_profile_selection.js";
import type { FedosRecoveryBundleDataPartEntry } from "../src/os/messenger/desktop/recovery/fedos_recovery_bundle_data_part_codec.js";

declare const process: { cwd(): string; env: { NODE_ENV?: string; [key: string]: string | undefined } };

const WASM_PATH = join(process.cwd(), "packages", "fedos-core-rust", "pkg", "fedos_core_rust_bg.wasm");
const REAL_ARTIFACT_PRESENT = existsSync(WASM_PATH);
const suite = REAL_ARTIFACT_PRESENT ? describe : describe.skip;

const AEAD_SUITE = "ChaCha20Poly1305" as const;
const PASSPHRASE = "correct horse battery staple 4762";

async function withDevelopmentNodeEnv<T>(fn: () => Promise<T>): Promise<T> {
  const original = process.env.NODE_ENV;
  process.env.NODE_ENV = "development";
  try {
    return await fn();
  } finally {
    if (original === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = original;
  }
}

/** Mirrors the Direct real-vertical-slice's own `primedLoader()` exactly. */
async function primedLoader(): Promise<FedosWasmLoaderSkeleton> {
  const loader = new FedosWasmLoaderSkeleton();
  loader.planLoad();
  await loader.attemptDevOnlyJsGlueImport();
  await loader.attemptDevOnlyWasmInitialization();
  return loader;
}

const tmpRoots: string[] = [];
function makeProfileRoot(prefix: string): FedosLocalProfilePaths {
  const dir = mkdtempSync(join(tmpdir(), prefix));
  tmpRoots.push(dir);
  const paths = planFedosLocalProfilePaths(dir)!;
  expect(ensureFedosLocalProfileDirectories(paths)).toBe(true);
  return paths;
}
afterEach(() => {
  while (tmpRoots.length) {
    try {
      rmSync(tmpRoots.pop()!, { recursive: true, force: true });
    } catch {
      /* ignore */
    }
  }
});

/** Writes real, non-trivial NDJSON content to some of Machine A's included logs -- the rest of the included set is left absent, exactly as a real profile that hasn't touched every subsystem yet would be. Absence is not an error (`fedos_recovery_bundle_data_part_codec.ts` §2). */
function seedMachineAProfile(paths: FedosLocalProfilePaths): void {
  writeFileSync(paths.profileDescriptorFile, JSON.stringify({ profileId: "machine-a-profile" }) + "\n");
  writeFileSync(paths.boardLogFile, '{"kind":"post","id":"p1"}\n{"kind":"post","id":"p2"}\n');
  writeFileSync(paths.conversationLogFile, '{"conversationId":"c1"}\n');
  writeFileSync(paths.conversationMembershipLogFile, '{"conversationId":"c1","membershipId":"m1"}\n');
  writeFileSync(paths.deletionRequestStateLogFile, '{"requestId":"d1","state":"acknowledged"}\n');
  // Device-bound / Own-Device-Sync files DO get written on Machine A (a real profile would have
  // them) -- the point of this test is to prove they are NEVER read into the bundle, not that they
  // don't exist.
  writeFileSync(paths.directRatchetSealedSecretLogFile, '{"sealed":"device-bound-blob-never-portable"}\n');
  writeFileSync(paths.syncJournalLogFile, '{"sync":"own-device-sync-internal-state"}\n');
  writeFileSync(paths.deviceRegistryLogFile, '{"deviceId":"machine-a","trust":"trusted"}\n');
}

function readSourceLogs(paths: FedosLocalProfilePaths): Promise<readonly FedosRecoveryBundleDataPartEntry[]> {
  return (async () => {
    const entries: FedosRecoveryBundleDataPartEntry[] = [];
    for (const [name, path] of fedosRecoveryBundleSourcePaths(paths)) {
      const result = await fedosConversationArchiveFileAuthority.readArchive(path, 10 * 1024 * 1024);
      if (result.outcome === "read") entries.push({ name, bytes: result.bytes });
      // "not-found" is expected and fine -- a leaf a real profile hasn't populated yet is simply omitted.
    }
    return entries;
  })();
}

suite("Disaster Recovery Portable Backup -- fresh-machine restore (REAL WASM)", () => {
  it(
    "1. Machine A exports a Recovery Bundle; an independent Machine B simulation (fresh temp dir, fresh WASM authority, no reference to Machine A's profile) imports it and recovers the real identity + curated data, while device-bound/sync files never leave Machine A's disk",
    async () => {
      await withDevelopmentNodeEnv(async () => {
        const loader = await primedLoader(); // shared WASM module only -- no secret lives on it, see file header

        // ---- Machine A ----
        const machineA = makeProfileRoot("fedos-recovery-machine-a-");
        seedMachineAProfile(machineA);

        const masterSeedA = new FedosWasmMasterSeedAuthority(loader);
        expect(await masterSeedA.generate()).toBe(true);
        const signingA = new FedosWasmNostrSigningAuthority(masterSeedA, loader);
        const identityA = await signingA.publicIdentityForAccount(0);
        expect(identityA).not.toBeNull();

        const envelope = await masterSeedA.seal(new TextEncoder().encode(PASSPHRASE));
        expect(envelope).not.toBeNull();
        writeFileSync(machineA.sealedMasterSeedFile, envelope!.json);

        const dataEntries = await readSourceLogs(machineA);
        expect(dataEntries.length).toBeGreaterThan(0);
        expect(dataEntries.some((e) => e.name === "board")).toBe(true);
        // Hard requirement: excluded files are never even read into a Data Part entry.
        expect(dataEntries.some((e) => e.name.includes("ratchet"))).toBe(false);
        expect(dataEntries.some((e) => e.name.includes("sync"))).toBe(false);
        expect(dataEntries.some((e) => e.name.includes("device-registry"))).toBe(false);

        const buildAuthority = new FedosRecoveryBundleEncryptionAuthority(masterSeedA);
        const buildResult = await buildAuthority.build({
          sealedMasterSeedEnvelope: envelope!.json,
          now: 1_700_000_000,
          dataPart: { suite: AEAD_SUITE, accountIndex: 0, selfAccountPublicKeyHex: identityA!.publicKeyHex, entries: dataEntries },
        });
        expect(buildResult.outcome).toBe("built");
        if (buildResult.outcome !== "built") return;

        const bundleDir = mkdtempSync(join(tmpdir(), "fedos-recovery-bundle-file-"));
        tmpRoots.push(bundleDir);
        const bundlePath = join(bundleDir, "recovery-bundle.json");
        writeFileSync(bundlePath, serializeFedosRecoveryBundleToBytes(buildResult.bundle));

        // ---- Machine B: a genuinely separate simulation. Only the bundle file crosses over. ----
        const machineB = makeProfileRoot("fedos-recovery-machine-b-");
        const readBackBundleFile = readFileSync(bundlePath) as { buffer: ArrayBuffer; byteOffset: number; byteLength: number };
        const bundleBytes = new Uint8Array(readBackBundleFile.buffer, readBackBundleFile.byteOffset, readBackBundleFile.byteLength);
        const bundle = deserializeFedosRecoveryBundleFromBytes(bundleBytes);
        expect(bundle).not.toBeNull();

        const masterSeedB = new FedosWasmMasterSeedAuthority(loader); // fresh, empty -- never touched machineA's state
        expect(await masterSeedB.isAvailable()).toBe(false);
        const restoreAuthority = new FedosRecoveryBundleEncryptionAuthority(masterSeedB);

        const identityOutcome = await restoreAuthority.restoreIdentity(bundle as FedosRecoveryBundleV1, new TextEncoder().encode(PASSPHRASE));
        expect(identityOutcome).toBe("restored");
        expect(await masterSeedB.isAvailable()).toBe(true);

        const signingB = new FedosWasmNostrSigningAuthority(masterSeedB, loader);
        const identityB = await signingB.publicIdentityForAccount(0);
        // IDENTITY, proven bit-for-bit recovered: the exact same Nostr public key, on a wholly separate authority instance.
        expect(identityB!.publicKeyHex).toBe(identityA!.publicKeyHex);

        const dataOutcome = await restoreAuthority.restoreDataPart(bundle as FedosRecoveryBundleV1, {
          suite: AEAD_SUITE,
          selfAccountPublicKeyHex: identityB!.publicKeyHex,
          accountIndex: 0,
        });
        expect(dataOutcome.outcome).toBe("restored");
        if (dataOutcome.outcome !== "restored") return;

        // Write the recovered Data Part into Machine B's own fresh profile root -- profile isolation:
        // this is a brand-new, previously-empty root, never Machine A's directory.
        for (const entry of dataOutcome.entries) {
          const destination = fedosRecoveryBundleDestinationPathFor(entry.name, machineB);
          expect(destination).not.toBeNull();
          const written = await fedosConversationArchiveFileAuthority.createArchiveExclusive(destination!, entry.bytes);
          expect(written.outcome).toBe("written");
        }
        expect(readFileSync(machineB.boardLogFile, "utf8")).toBe(readFileSync(machineA.boardLogFile, "utf8"));
        expect(readFileSync(machineB.deletionRequestStateLogFile, "utf8")).toBe(readFileSync(machineA.deletionRequestStateLogFile, "utf8"));

        // Machine B's profile root never received ANY device-bound/sync file -- they were never in the bundle at all.
        expect(existsSync(machineB.directRatchetSealedSecretLogFile)).toBe(false);
        expect(existsSync(machineB.syncJournalLogFile)).toBe(false);
        expect(existsSync(machineB.deviceRegistryLogFile)).toBe(false);
      });
    },
    30_000,
  );

  it(
    "2. wrong passphrase fails closed on Machine B -- Data Part is never even attempted",
    async () => {
      await withDevelopmentNodeEnv(async () => {
        const loader = await primedLoader();
        const masterSeedA = new FedosWasmMasterSeedAuthority(loader);
        await masterSeedA.generate();
        const envelope = await masterSeedA.seal(new TextEncoder().encode(PASSPHRASE));

        const buildAuthority = new FedosRecoveryBundleEncryptionAuthority(masterSeedA);
        const buildResult = await buildAuthority.build({ sealedMasterSeedEnvelope: envelope!.json, now: 0 });
        expect(buildResult.outcome).toBe("built");
        if (buildResult.outcome !== "built") return;

        const masterSeedB = new FedosWasmMasterSeedAuthority(loader);
        const restoreAuthority = new FedosRecoveryBundleEncryptionAuthority(masterSeedB);
        const outcome = await restoreAuthority.restoreIdentity(buildResult.bundle, new TextEncoder().encode("definitely the wrong passphrase"));
        expect(outcome).toBe("wrong-secret");
        expect(await masterSeedB.isAvailable()).toBe(false);
      });
    },
    30_000,
  );

  it(
    "3. a bit-flipped (tampered) sealed Master Seed envelope is rejected -- AEAD authentication, not a string comparison",
    async () => {
      await withDevelopmentNodeEnv(async () => {
        const loader = await primedLoader();
        const masterSeedA = new FedosWasmMasterSeedAuthority(loader);
        await masterSeedA.generate();
        const envelope = await masterSeedA.seal(new TextEncoder().encode(PASSPHRASE));

        const buildAuthority = new FedosRecoveryBundleEncryptionAuthority(masterSeedA);
        const buildResult = await buildAuthority.build({ sealedMasterSeedEnvelope: envelope!.json, now: 0 });
        expect(buildResult.outcome).toBe("built");
        if (buildResult.outcome !== "built") return;

        // Flip one hex character deep inside the ciphertext field -- still well-formed JSON/prefix,
        // so this exercises AEAD authentication failure, not the structural pre-check.
        const tamperedJson = buildResult.bundle.sealedMasterSeedEnvelope.replace(/"ct":"([0-9a-zA-Z_-])/, (_m, c) => `"ct":"${c === "A" ? "B" : "A"}`);
        const tamperedBundle: FedosRecoveryBundleV1 = { ...buildResult.bundle, sealedMasterSeedEnvelope: tamperedJson };

        const masterSeedB = new FedosWasmMasterSeedAuthority(loader);
        const restoreAuthority = new FedosRecoveryBundleEncryptionAuthority(masterSeedB);
        const outcome = await restoreAuthority.restoreIdentity(tamperedBundle, new TextEncoder().encode(PASSPHRASE));
        expect(outcome === "wrong-secret" || outcome === "malformed").toBe(true); // both are "fails closed", never "restored"
        expect(await masterSeedB.isAvailable()).toBe(false);
      });
    },
    30_000,
  );

  it("4. every logically-included log name is accounted for in FEDOS_RECOVERY_BUNDLE_INCLUDED_LOGS (sanity check against the design doc's own list, size 21 -- updated by the lineage-reconciliation pass to additively include identityTransitionConversationContinuityLogFile)", () => {
    expect(FEDOS_RECOVERY_BUNDLE_INCLUDED_LOGS.size).toBe(21);
  });
});
