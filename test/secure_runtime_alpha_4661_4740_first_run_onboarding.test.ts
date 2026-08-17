/**
 * Secure Runtime Alpha 4661-4740 — Master Seed Unlock, First-Run
 * Onboarding, and Local Profile Initialization Arc — real acceptance +
 * interruption/recovery suite (Phases B-O).
 *
 * Real production boundaries used wherever available: the REAL
 * `startFedosDesktopRuntime()` (Board/Conversation/Device runtimes, real
 * file-backed durable logs), real BIP-340 Schnorr device + account proofs
 * (`FedosDeviceSigningKeypair` + `RealFedosNostrSigningAuthority`), the real
 * file-backed sealed-envelope and profile-descriptor persistence.
 *
 * DEVELOPMENT vs PRODUCTION crypto (honest, per Phase O): the ONE real
 * `FedosMasterSeedAuthority` implementation (`FedosWasmMasterSeedAuthority`)
 * is unreachable here (no compiled WASM `pkg/`, dev-only gate closed — Phase
 * A §2). So the Master Seed generate/seal/restore steps run against the
 * DEVELOPMENT-ONLY double (`DevelopmentFedosMasterSeedAuthority`). This
 * suite therefore proves the COORDINATION/state-machine/device-bootstrap
 * logic end to end — NOT any cryptographic property of the seed. Production
 * unlock is honestly blocked and is not claimed here.
 */

import { describe, it, expect, afterEach } from "vitest";

import { mkdtempSync, rmSync, existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

import {
  createFedosLocalProfileDescriptorV1,
  decodeFedosLocalProfileDescriptorV1,
  encodeFedosLocalProfileDescriptorV1,
  isWellFormedFedosLocalProfileDescriptorV1,
  withFedosLocalProfileInitializationState,
  fedosLocalProfileDescriptorsIdentical,
} from "../src/os/messenger/desktop/onboarding/fedos_local_profile_descriptor.js";
import {
  InMemoryFedosLocalProfilePersistence,
  FileFedosLocalProfilePersistence,
  FedosLocalProfileCorruptError,
  classifyFedosLocalProfileDuplicate,
} from "../src/os/messenger/desktop/onboarding/fedos_local_profile_persistence.js";
import {
  planFedosLocalProfilePaths,
  ensureFedosLocalProfileDirectories,
  fedosLocalProfilePathsIsolated,
} from "../src/os/messenger/desktop/onboarding/fedos_local_profile_paths.js";
import {
  applyFedosProfileLifecycleTransition,
  canFedosProfileLifecycleTransition,
  fedosProfileLifecyclePermitsRuntime,
  fedosProfileLifecycleNextState,
} from "../src/os/messenger/desktop/onboarding/fedos_profile_lifecycle_state.js";
import {
  FedosProfileUnlockSecret,
  fedosProfileUnlockSecretFromUtf8,
  validateFedosUnlockSecretBytes,
  FEDOS_UNLOCK_SECRET_REDACTION,
} from "../src/os/messenger/desktop/onboarding/fedos_profile_unlock_secret.js";
import { DevelopmentFedosMasterSeedAuthority } from "../src/os/messenger/desktop/onboarding/fedos_development_master_seed_authority.js";
import { buildFedosProfileRecoveryNotice } from "../src/os/messenger/desktop/onboarding/fedos_profile_recovery_notice.js";
import {
  FedosProfileInitializationCoordinator,
  type FedosProfileInitializationDependencies,
} from "../src/os/messenger/desktop/onboarding/fedos_profile_initialization_coordinator.js";
import {
  validateFedosOnboardingCommand,
  redactFedosOnboardingCommand,
  dispatchFedosOnboardingCommand,
} from "../src/os/messenger/desktop/onboarding/fedos_onboarding_command.js";
import {
  fedosOnboardingViewForStatus,
  fedosOnboardingViewForFailure,
  fedosOnboardingReadyView,
} from "../src/os/messenger/desktop/onboarding/fedos_onboarding_presentation.js";
import { FileFedosSealedMasterSeedEnvelopePersistence } from "../src/os/core/vault/wasm/fedos_sealed_master_seed_envelope_persistence.js";
import { RealFedosNostrSigningAuthority } from "./support/real_fedos_nostr_signing_authority.js";

// ---------------------------------------------------------------------
// Helpers.
// ---------------------------------------------------------------------

const tmpDirs: string[] = [];
function makeTmpRoot(): string {
  const dir = mkdtempSync(join(tmpdir(), "fedos-onboarding-"));
  tmpDirs.push(dir);
  return dir;
}
afterEach(() => {
  while (tmpDirs.length > 0) {
    const dir = tmpDirs.pop()!;
    try {
      rmSync(dir, { recursive: true, force: true });
    } catch {
      /* best effort */
    }
  }
});

function sampleDescriptor(overrides: Partial<Parameters<typeof createFedosLocalProfileDescriptorV1>[0]> = {}) {
  return createFedosLocalProfileDescriptorV1({
    profileId: "a".repeat(32),
    displayLabel: "Alice's laptop",
    accountPublicIdentity: { authority: "nostr", publicKeyHex: "b".repeat(64) },
    localDeviceId: "device-1234",
    createdAt: 1_700_000_000_000,
    sealedMasterSeedRef: "/root/master-seed.sealed.json",
    dataDirectoryRoot: "/root",
    initializationState: "ready",
    ...overrides,
  })!;
}

/** Builds a coordinator over a real profile root with the dev seed authority + real account signing. */
function makeCoordinator(
  root: string,
  overrides: Partial<FedosProfileInitializationDependencies> = {},
): FedosProfileInitializationCoordinator {
  const paths = planFedosLocalProfilePaths(root)!;
  ensureFedosLocalProfileDirectories(paths);
  const deps: FedosProfileInitializationDependencies = {
    paths,
    profilePersistence: new FileFedosLocalProfilePersistence(paths.profileDescriptorFile),
    sealedSeedPersistence: new FileFedosSealedMasterSeedEnvelopePersistence(paths.sealedMasterSeedFile),
    masterSeedAuthority: new DevelopmentFedosMasterSeedAuthority(),
    accountSigningAuthority: new RealFedosNostrSigningAuthority(),
    ...overrides,
  };
  return new FedosProfileInitializationCoordinator(deps);
}

// ---------------------------------------------------------------------
// Phase B — profile descriptor model + codec.
// ---------------------------------------------------------------------

describe("Phase B — local profile descriptor", () => {
  it("validates, encodes deterministically, and round-trips", () => {
    const d = sampleDescriptor();
    expect(isWellFormedFedosLocalProfileDescriptorV1(d)).toBe(true);
    const encoded = encodeFedosLocalProfileDescriptorV1(d);
    expect(encodeFedosLocalProfileDescriptorV1(d)).toBe(encoded); // deterministic
    const decoded = decodeFedosLocalProfileDescriptorV1(encoded)!;
    expect(fedosLocalProfileDescriptorsIdentical(d, decoded)).toBe(true);
  });

  it("fails closed on malformed / corrupt input", () => {
    expect(decodeFedosLocalProfileDescriptorV1("{not json")).toBeNull();
    expect(decodeFedosLocalProfileDescriptorV1('{"schemaVersion":2}')).toBeNull();
    expect(decodeFedosLocalProfileDescriptorV1("")).toBeNull();
    expect(isWellFormedFedosLocalProfileDescriptorV1({ ...sampleDescriptor(), extra: 1 })).toBe(false);
  });

  it("rejects a descriptor carrying any forbidden secret-shaped key", () => {
    const withSecret = { ...sampleDescriptor(), passphrase: "hunter2" };
    expect(isWellFormedFedosLocalProfileDescriptorV1(withSecret)).toBe(false);
    const withSeed = { ...sampleDescriptor(), seed: "deadbeef" };
    expect(isWellFormedFedosLocalProfileDescriptorV1(withSeed)).toBe(false);
  });

  it("the encoded descriptor contains NO secret-shaped substring", () => {
    const encoded = encodeFedosLocalProfileDescriptorV1(sampleDescriptor());
    expect(encoded).not.toMatch(/passphrase|privateKey|nsec|"seed"|bearer/i);
  });

  it("advances initialization state without mutating the input", () => {
    const d = sampleDescriptor({ initializationState: "initializing" });
    const next = withFedosLocalProfileInitializationState(d, "ready", 1_700_000_100_000)!;
    expect(next.initializationState).toBe("ready");
    expect(d.initializationState).toBe("initializing");
    expect(next.lastOpenedAt).toBe(1_700_000_100_000);
  });
});

// ---------------------------------------------------------------------
// Phase B — persistence.
// ---------------------------------------------------------------------

describe("Phase B — profile persistence", () => {
  it("in-memory: writeIfAbsent never overwrites; update replaces; corruption fails closed", () => {
    const p = new InMemoryFedosLocalProfilePersistence();
    expect(p.read()).toBeNull();
    expect(p.writeIfAbsent(sampleDescriptor())).toBe("written");
    expect(p.writeIfAbsent(sampleDescriptor({ displayLabel: "Different" }))).toBe("already-exists");
    expect(p.read()!.displayLabel).toBe("Alice's laptop"); // not overwritten
    const advanced = withFedosLocalProfileInitializationState(p.read()!, "failed", 1_700_000_200_000)!;
    expect(p.update(advanced)).toBe("updated");
    expect(p.read()!.initializationState).toBe("failed");

    const p2 = new InMemoryFedosLocalProfilePersistence();
    p2.plantCorruptForTest("{garbage");
    expect(() => p2.read()).toThrow(FedosLocalProfileCorruptError);
  });

  it("file-backed: persists, never overwrites, fails closed on corrupt file", () => {
    const root = makeTmpRoot();
    const file = join(root, "profile.json");
    const p = new FileFedosLocalProfilePersistence(file);
    expect(p.read()).toBeNull();
    expect(p.writeIfAbsent(sampleDescriptor())).toBe("written");
    expect(existsSync(file)).toBe(true);
    expect(p.writeIfAbsent(sampleDescriptor({ displayLabel: "Other" }))).toBe("already-exists");
    writeFileSync(file, "{corrupt", "utf8");
    expect(() => p.read()).toThrow(FedosLocalProfileCorruptError);
    expect(p.update(sampleDescriptor())).toBe("updated"); // update of an existing (now-fixed) file works
    expect(p.read()!.displayLabel).toBe("Alice's laptop");
  });

  it("classifies identical vs conflicting duplicates", () => {
    const a = sampleDescriptor();
    expect(classifyFedosLocalProfileDuplicate(a, sampleDescriptor())).toBe("identical-duplicate");
    expect(classifyFedosLocalProfileDuplicate(a, sampleDescriptor({ localDeviceId: "device-999" }))).toBe(
      "conflicting-duplicate",
    );
  });

  // FedOS Peer Device Discovery Arc P0 Closure (Agent F) -- the ONE
  // narrowly-scoped delete() this Arc adds; reachable in production only
  // through the guarded coordinator method (see the Phase R suite below).
  it("delete() is idempotent and scoped to only this port's own single file", () => {
    const p = new InMemoryFedosLocalProfilePersistence();
    expect(p.delete()).toBe("deleted"); // nothing to delete yet -- still "deleted", never "failed"
    expect(p.writeIfAbsent(sampleDescriptor())).toBe("written");
    expect(p.delete()).toBe("deleted");
    expect(p.read()).toBeNull();
    expect(p.delete()).toBe("deleted"); // idempotent second call

    const root = makeTmpRoot();
    const fileA = join(root, "a.json");
    const fileB = join(root, "b.json");
    const pa = new FileFedosLocalProfilePersistence(fileA);
    const pb = new FileFedosLocalProfilePersistence(fileB);
    expect(pa.writeIfAbsent(sampleDescriptor())).toBe("written");
    expect(pb.writeIfAbsent(sampleDescriptor())).toBe("written");
    expect(pa.delete()).toBe("deleted");
    expect(existsSync(fileA)).toBe(false);
    expect(existsSync(fileB)).toBe(true); // the OTHER file is untouched
    expect(pa.delete()).toBe("deleted"); // idempotent -- file already gone
  });
});

describe("Phase B (sealed Master Seed envelope port) -- narrowly-scoped delete()", () => {
  it("delete() is idempotent and scoped to only this port's own single file", () => {
    const root = makeTmpRoot();
    const fileA = join(root, "seed-a.sealed.json");
    const fileB = join(root, "seed-b.sealed.json");
    const pa = new FileFedosSealedMasterSeedEnvelopePersistence(fileA);
    const pb = new FileFedosSealedMasterSeedEnvelopePersistence(fileB);
    expect(pa.delete()).toBe("deleted"); // nothing to delete yet -- still "deleted"
    writeFileSync(fileA, '{"v":1,"kdf":"argon2id","dev":true,"salt":"aa","verifier":"bb"}', "utf8");
    writeFileSync(fileB, '{"v":1,"kdf":"argon2id","dev":true,"salt":"cc","verifier":"dd"}', "utf8");
    expect(pa.delete()).toBe("deleted");
    expect(existsSync(fileA)).toBe(false);
    expect(existsSync(fileB)).toBe(true); // the OTHER file is untouched
    expect(pb.read()).not.toBeNull();
    expect(pa.delete()).toBe("deleted"); // idempotent -- file already gone
  });
});

// ---------------------------------------------------------------------
// Phase C — lifecycle state machine.
// ---------------------------------------------------------------------

describe("Phase C — profile lifecycle state machine", () => {
  it("permits a Runtime ONLY in ready", () => {
    for (const state of ["absent", "initializing", "locked", "unlocking", "failed", "recovery-required", "stopped"] as const) {
      expect(fedosProfileLifecyclePermitsRuntime(state)).toBe(false);
    }
    expect(fedosProfileLifecyclePermitsRuntime("ready")).toBe(true);
  });

  it("unlock failure returns to locked (never a new profile, never failed)", () => {
    expect(applyFedosProfileLifecycleTransition("locked", "begin-unlock")).toBe("unlocking");
    expect(applyFedosProfileLifecycleTransition("unlocking", "unlock-failed")).toBe("locked");
  });

  it("corruption enters recovery-required, never absent", () => {
    expect(applyFedosProfileLifecycleTransition("locked", "corruption-detected")).toBe("recovery-required");
    expect(applyFedosProfileLifecycleTransition("unlocking", "identity-mismatch")).toBe("recovery-required");
  });

  it("stop preserves the profile (ready -> stopped -> locked on relaunch)", () => {
    expect(applyFedosProfileLifecycleTransition("ready", "lock")).toBe("stopped");
    expect(applyFedosProfileLifecycleTransition("stopped", "relaunch")).toBe("locked");
  });

  it("illegal transitions are refused (state unchanged), never throw", () => {
    expect(canFedosProfileLifecycleTransition("ready", "begin-create")).toBe(false);
    expect(applyFedosProfileLifecycleTransition("ready", "begin-create")).toBe("ready");
    expect(fedosProfileLifecycleNextState("absent", "unlock-succeeded")).toBeNull();
  });

  // FedOS Peer Device Discovery Arc P0 Closure (Agent F).
  it("reset-interrupted-profile is the ONE legal exit from recovery-required, and only from there", () => {
    expect(canFedosProfileLifecycleTransition("recovery-required", "reset-interrupted-profile")).toBe(true);
    expect(applyFedosProfileLifecycleTransition("recovery-required", "reset-interrupted-profile")).toBe("absent");
    for (const state of ["absent", "initializing", "locked", "unlocking", "ready", "failed", "stopped"] as const) {
      expect(canFedosProfileLifecycleTransition(state, "reset-interrupted-profile")).toBe(false);
      expect(applyFedosProfileLifecycleTransition(state, "reset-interrupted-profile")).toBe(state);
    }
  });
});

// ---------------------------------------------------------------------
// Phase G — durable path authority.
// ---------------------------------------------------------------------

describe("Phase G — durable path authority", () => {
  it("requires an absolute root; rejects relative", () => {
    expect(planFedosLocalProfilePaths("relative/path")).toBeNull();
    expect(planFedosLocalProfilePaths("")).toBeNull();
    expect(planFedosLocalProfilePaths(makeTmpRoot())).not.toBeNull();
  });

  it("derives deterministic subpaths all beneath the root (no traversal)", () => {
    const root = makeTmpRoot();
    const paths = planFedosLocalProfilePaths(root)!;
    for (const value of Object.values(paths)) {
      expect(value.startsWith(root)).toBe(true);
      expect(value).not.toMatch(/\.\./);
    }
  });

  it("isolates independent profiles and creates directories", () => {
    const a = planFedosLocalProfilePaths(makeTmpRoot())!;
    const b = planFedosLocalProfilePaths(makeTmpRoot())!;
    expect(fedosLocalProfilePathsIsolated(a, b)).toBe(true);
    expect(fedosLocalProfilePathsIsolated(a, a)).toBe(false);
    expect(ensureFedosLocalProfileDirectories(a)).toBe(true);
    expect(existsSync(a.logsDirectory)).toBe(true);
  });

  it("supports a Japanese / OneDrive-like long path root", () => {
    const base = makeTmpRoot();
    const root = join(base, "OneDrive - 公立諏訪東京理科大学", "デスクトップ", "プロファイル");
    const paths = planFedosLocalProfilePaths(root)!;
    expect(ensureFedosLocalProfileDirectories(paths)).toBe(true);
    expect(existsSync(paths.root)).toBe(true);
  });
});

// ---------------------------------------------------------------------
// Phase D / J — unlock secret carrier.
// ---------------------------------------------------------------------

describe("Phase D/J — trusted unlock secret", () => {
  it("redacts itself from toString/toJSON", () => {
    const s = fedosProfileUnlockSecretFromUtf8("correct horse battery staple");
    expect(String(s)).toBe(FEDOS_UNLOCK_SECRET_REDACTION);
    expect(JSON.stringify({ s })).toBe(`{"s":"${FEDOS_UNLOCK_SECRET_REDACTION}"}`);
  });

  it("consumes exactly once, then zeroes and denies a second consume", async () => {
    const bytes = new TextEncoder().encode("passphrase-value");
    const s = new FedosProfileUnlockSecret(bytes);
    expect(s.byteLength).toBe(16);
    const seen = await s.consume((b) => b.length);
    expect(seen).toBe(16);
    expect(bytes.every((x) => x === 0)).toBe(true); // zeroed
    expect(s.available).toBe(false);
    expect(await s.consume((b) => b.length)).toBeNull(); // one-shot
  });

  it("validates coarse length only", () => {
    expect(validateFedosUnlockSecretBytes(new Uint8Array(0))).toBe("empty");
    expect(validateFedosUnlockSecretBytes(new Uint8Array(3))).toBe("too-short");
    expect(validateFedosUnlockSecretBytes(new Uint8Array(16))).toBe("ok");
    expect(validateFedosUnlockSecretBytes(new Uint8Array(5000))).toBe("too-long");
  });
});

// ---------------------------------------------------------------------
// Phase D — development Master Seed authority double.
// ---------------------------------------------------------------------

describe("Phase D — development Master Seed authority (NOT crypto)", () => {
  it("generate -> seal -> restore with correct passphrase; wrong passphrase fails closed", async () => {
    const auth = new DevelopmentFedosMasterSeedAuthority();
    expect(await auth.isCleared()).toBe(true);
    expect(await auth.generate()).toBe(true);
    expect(await auth.isAvailable()).toBe(true);
    const sealed = (await auth.seal(new TextEncoder().encode("right-secret")))!;
    expect(sealed).not.toBeNull();
    // Structurally valid sealed envelope, NO seed byte, marked dev.
    expect(sealed.json.startsWith('{"v":1,"kdf":"argon2id"')).toBe(true);
    expect(sealed.json).toContain('"dev":true');
    expect(sealed.json).not.toMatch(/seedMarker|plaintext/i);

    const fresh = new DevelopmentFedosMasterSeedAuthority();
    expect(await fresh.restoreSealed(sealed, new TextEncoder().encode("right-secret"))).toBe(true);
    const wrong = new DevelopmentFedosMasterSeedAuthority();
    expect(await wrong.restoreSealed(sealed, new TextEncoder().encode("wrong-secret"))).toBe(false);
  });
});

// ---------------------------------------------------------------------
// Phase I — recovery notice.
// ---------------------------------------------------------------------

describe("Phase I — recovery material notice", () => {
  it("names both required files and the forgotten-secret irrecoverability", () => {
    const paths = planFedosLocalProfilePaths(makeTmpRoot())!;
    const notice = buildFedosProfileRecoveryNotice(paths, { conversationArchiveExportAvailable: false });
    const labels = notice.backupItems.map((i) => i.label);
    expect(labels).toContain("Sealed Master Seed");
    expect(labels).toContain("Profile descriptor");
    expect(notice.forgottenSecretIsUnrecoverable).toBe(true);
    expect(notice.warnings.join(" ")).toMatch(/cannot be unlocked|no reset/i);
    // No plaintext seed / passphrase anywhere in the notice.
    expect(JSON.stringify(notice)).not.toMatch(/plaintext seed|\bnsec1/i);
  });

  it("Product Durability mega-arc: additively recommends a whole-profile-directory backup, naming the real root path, without weakening the 2-item minimum required list", () => {
    const paths = planFedosLocalProfilePaths(makeTmpRoot())!;
    const notice = buildFedosProfileRecoveryNotice(paths, { conversationArchiveExportAvailable: false });
    expect(notice.wholeProfileDirectoryRecommendation.path).toBe(paths.root);
    expect(notice.wholeProfileDirectoryRecommendation.text).toMatch(/conversations/i);
    expect(notice.wholeProfileDirectoryRecommendation.text).toMatch(/recommendation, not a requirement/i);
    // The 2-item minimum list is unchanged by this additive field.
    expect(notice.backupItems).toHaveLength(2);
    // No plaintext seed / passphrase anywhere in the notice, including the new field.
    expect(JSON.stringify(notice)).not.toMatch(/plaintext seed|\bnsec1/i);
  });
});

// ---------------------------------------------------------------------
// Phase J — onboarding commands.
// ---------------------------------------------------------------------

describe("Phase J — onboarding command vocabulary", () => {
  it("validates the closed vocabulary and rejects junk", () => {
    expect(validateFedosOnboardingCommand({ kind: "profile-status" })).not.toBeNull();
    expect(validateFedosOnboardingCommand({ kind: "profile-status", extra: 1 })).toBeNull();
    expect(validateFedosOnboardingCommand({ kind: "nope" })).toBeNull();
    expect(validateFedosOnboardingCommand({ kind: "profile-create", displayLabel: "  " })).toBeNull();
    const withSecret = {
      kind: "profile-create",
      displayLabel: "Laptop",
      secret: fedosProfileUnlockSecretFromUtf8("longenoughsecret"),
    };
    expect(validateFedosOnboardingCommand(withSecret)).not.toBeNull();
  });

  it("redacts the secret from any command diagnostic", () => {
    const cmd = validateFedosOnboardingCommand({
      kind: "profile-unlock",
      secret: fedosProfileUnlockSecretFromUtf8("supersecretvalue"),
    })!;
    const line = redactFedosOnboardingCommand(cmd);
    expect(line).toContain(FEDOS_UNLOCK_SECRET_REDACTION);
    expect(line).not.toContain("supersecretvalue");
  });
});

// ---------------------------------------------------------------------
// Phase K — presentation.
// ---------------------------------------------------------------------

describe("Phase K — onboarding presentation", () => {
  it("maps each presence/failure to the right screen", () => {
    expect(fedosOnboardingViewForStatus({ presence: "absent" } as any).screen).toBe("welcome");
    expect(fedosOnboardingViewForStatus({ presence: "locked" } as any).screen).toBe("unlock-form");
    expect(fedosOnboardingViewForStatus({ presence: "recovery-required" } as any).screen).toBe("recovery-required");
    expect(fedosOnboardingViewForFailure("unlock-failed", "x").screen).toBe("unlock-failed");
    expect(fedosOnboardingViewForFailure("identity-mismatch", "x").screen).toBe("recovery-required");
    expect(fedosOnboardingViewForFailure("seed-unavailable", "x").screen).toBe("runtime-startup-failed");
  });

  it("never carries a secret or a raw error", () => {
    const view = fedosOnboardingViewForFailure("runtime-start-failed", "stack trace here");
    expect(JSON.stringify(view)).not.toContain("stack trace here");
  });
});

// ---------------------------------------------------------------------
// Phases E/F/H/M/N/O — end-to-end coordinator against the REAL runtime.
// ---------------------------------------------------------------------

describe("Phase E/F/H — create + unlock a real profile (dev crypto)", () => {
  it("baseline: a fresh root has no profile (the first-run gap this Arc closes)", () => {
    const coordinator = makeCoordinator(makeTmpRoot());
    const detect = coordinator.detectProfileState();
    expect(detect.outcome).toBe("ok");
    if (detect.outcome === "ok") expect(detect.value.presence).toBe("absent");
    expect(coordinator.runningRuntime()).toBeNull();
  });

  it("Flow A: create a new profile reaches ready, registers the local Device with REAL proofs, seals with no plaintext seed", async () => {
    const root = makeTmpRoot();
    const coordinator = makeCoordinator(root);
    const result = await coordinator.createProfile(
      { displayLabel: "Alice's laptop" },
      fedosProfileUnlockSecretFromUtf8("correct horse battery staple"),
    );
    expect(result.outcome).toBe("ok");
    if (result.outcome !== "ok") return;
    expect(result.value.lifecycleState).toBe("ready");
    // Phase H — the local Device was registered to "trusted" through real proofs.
    expect(result.value.deviceTrustState).toBe("trusted");
    expect(coordinator.lifecycleState).toBe("ready");
    expect(coordinator.runningRuntime()).not.toBeNull();

    // Sealed file exists and contains NO plaintext seed and NO passphrase.
    const paths = planFedosLocalProfilePaths(root)!;
    expect(existsSync(paths.sealedMasterSeedFile)).toBe(true);
    const sealedBytes = readFileSync(paths.sealedMasterSeedFile, "utf8") as string;
    expect(sealedBytes).not.toContain("correct horse battery staple");
    // Descriptor is non-secret.
    const descriptorBytes = readFileSync(paths.profileDescriptorFile, "utf8") as string;
    expect(descriptorBytes).not.toContain("correct horse battery staple");
    expect(descriptorBytes).not.toMatch(/passphrase|privateKey|nsec/i);
    const descriptor = decodeFedosLocalProfileDescriptorV1(descriptorBytes)!;
    expect(descriptor.initializationState).toBe("ready");

    await coordinator.lock();
  });

  it("repeated create does NOT overwrite an existing profile", async () => {
    const root = makeTmpRoot();
    const first = makeCoordinator(root);
    const created = await first.createProfile(
      { displayLabel: "First" },
      fedosProfileUnlockSecretFromUtf8("first-secret-value"),
    );
    expect(created.outcome).toBe("ok");
    await first.lock();

    const second = makeCoordinator(root);
    const again = await second.createProfile(
      { displayLabel: "Second" },
      fedosProfileUnlockSecretFromUtf8("second-secret-value"),
    );
    expect(again.outcome).toBe("already-exists");
    // Descriptor unchanged.
    const paths = planFedosLocalProfilePaths(root)!;
    const descriptor = decodeFedosLocalProfileDescriptorV1(readFileSync(paths.profileDescriptorFile, "utf8") as string)!;
    expect(descriptor.displayLabel).toBe("First");
  });

  it("rejects an invalid label and a weak secret without creating anything", async () => {
    const root = makeTmpRoot();
    const coordinator = makeCoordinator(root);
    const badLabel = await coordinator.createProfile({ displayLabel: "   " }, fedosProfileUnlockSecretFromUtf8("longenough"));
    expect(badLabel.outcome).toBe("invalid-input");
    const weak = await coordinator.createProfile({ displayLabel: "Laptop" }, fedosProfileUnlockSecretFromUtf8("short"));
    expect(weak.outcome).toBe("weak-secret");
    const paths = planFedosLocalProfilePaths(root)!;
    expect(existsSync(paths.profileDescriptorFile)).toBe(false);
  });
});

describe("Phase F — stop, relaunch, unlock (real durable restart)", () => {
  it("correct unlock succeeds; account + device identity stable across restart", async () => {
    const root = makeTmpRoot();
    const signing = new RealFedosNostrSigningAuthority();
    const created = await makeCoordinator(root, { accountSigningAuthority: signing }).createProfile(
      { displayLabel: "Persist me" },
      fedosProfileUnlockSecretFromUtf8("the-real-unlock-secret"),
    );
    expect(created.outcome).toBe("ok");
    if (created.outcome !== "ok") return;
    const originalIdentity = created.value.accountPublicIdentifier;
    // NOTE: the coordinator does not itself stop the runtime here in Flow A;
    // lock() to stop before "relaunch".
    // (created coordinator instance is separate; re-create for unlock below.)

    // Relaunch: a brand-new coordinator over the SAME durable paths + SAME account signing authority.
    const relaunch = makeCoordinator(root, { accountSigningAuthority: signing });
    const detect = relaunch.detectProfileState();
    expect(detect.outcome === "ok" && detect.value.presence).toBe("locked");

    const unlocked = await relaunch.unlockProfile(fedosProfileUnlockSecretFromUtf8("the-real-unlock-secret"));
    expect(unlocked.outcome).toBe("ok");
    if (unlocked.outcome !== "ok") return;
    expect(unlocked.value.accountPublicIdentifier).toBe(originalIdentity); // stable identity
    await relaunch.lock();
  });

  it("wrong unlock fails and remains locked; repeated wrong stays locked; retry with correct succeeds", async () => {
    const root = makeTmpRoot();
    const signing = new RealFedosNostrSigningAuthority();
    await makeCoordinator(root, { accountSigningAuthority: signing }).createProfile(
      { displayLabel: "Guard me" },
      fedosProfileUnlockSecretFromUtf8("the-correct-secret"),
    );

    const relaunch = makeCoordinator(root, { accountSigningAuthority: signing });
    relaunch.detectProfileState();
    const wrong1 = await relaunch.unlockProfile(fedosProfileUnlockSecretFromUtf8("wrong-secret-a"));
    expect(wrong1.outcome).toBe("unlock-failed");
    expect(relaunch.lifecycleState).toBe("locked");
    expect(relaunch.runningRuntime()).toBeNull(); // no partial runtime
    const wrong2 = await relaunch.unlockProfile(fedosProfileUnlockSecretFromUtf8("wrong-secret-b"));
    expect(wrong2.outcome).toBe("unlock-failed");
    expect(relaunch.lifecycleState).toBe("locked");
    const right = await relaunch.unlockProfile(fedosProfileUnlockSecretFromUtf8("the-correct-secret"));
    expect(right.outcome).toBe("ok");
    await relaunch.lock();
  });

  it("identity mismatch enters recovery-required (a DIFFERENT account authority on unlock)", async () => {
    const root = makeTmpRoot();
    await makeCoordinator(root, { accountSigningAuthority: new RealFedosNostrSigningAuthority() }).createProfile(
      { displayLabel: "Mismatch" },
      fedosProfileUnlockSecretFromUtf8("mismatch-secret-value"),
    );
    // Relaunch with a DIFFERENT signing authority -> a different resolved pubkey.
    const relaunch = makeCoordinator(root, { accountSigningAuthority: new RealFedosNostrSigningAuthority() });
    relaunch.detectProfileState();
    const unlocked = await relaunch.unlockProfile(fedosProfileUnlockSecretFromUtf8("mismatch-secret-value"));
    expect(unlocked.outcome).toBe("identity-mismatch");
    expect(relaunch.lifecycleState).toBe("recovery-required");
    expect(relaunch.runningRuntime()).toBeNull();
  });
});

describe("Phase M — lock stops the runtime; idempotent", () => {
  it("lock stops the runtime and is idempotent", async () => {
    const root = makeTmpRoot();
    const coordinator = makeCoordinator(root);
    await coordinator.createProfile({ displayLabel: "Lock me" }, fedosProfileUnlockSecretFromUtf8("lock-me-secret"));
    expect(coordinator.runningRuntime()).not.toBeNull();
    const first = await coordinator.lock();
    expect(first.outcome).toBe("ok");
    expect(coordinator.runningRuntime()).toBeNull();
    expect(coordinator.lifecycleState).toBe("stopped");
    const second = await coordinator.lock(); // idempotent
    expect(second.outcome).toBe("ok");
  });
});

describe("Phase N — interruption / corruption recovery", () => {
  it("a descriptor stuck in 'initializing' (interrupted init) becomes recovery-required, never a silent new profile", () => {
    const root = makeTmpRoot();
    const paths = planFedosLocalProfilePaths(root)!;
    ensureFedosLocalProfileDirectories(paths);
    // Simulate an interrupted init: descriptor written as "initializing", never advanced.
    const draft = createFedosLocalProfileDescriptorV1({
      profileId: "c".repeat(32),
      displayLabel: "Interrupted",
      accountPublicIdentity: { authority: "nostr", publicKeyHex: "d".repeat(64) },
      localDeviceId: "device-x",
      createdAt: 1_700_000_000_000,
      sealedMasterSeedRef: paths.sealedMasterSeedFile,
      dataDirectoryRoot: root,
      initializationState: "initializing",
    })!;
    new FileFedosLocalProfilePersistence(paths.profileDescriptorFile).writeIfAbsent(draft);

    const coordinator = makeCoordinator(root);
    const detect = coordinator.detectProfileState();
    expect(detect.outcome === "ok" && detect.value.presence).toBe("recovery-required");
    expect(coordinator.lifecycleState).toBe("recovery-required");
  });

  it("a corrupt descriptor file becomes recovery-required (fail closed)", () => {
    const root = makeTmpRoot();
    const paths = planFedosLocalProfilePaths(root)!;
    ensureFedosLocalProfileDirectories(paths);
    writeFileSync(paths.profileDescriptorFile, "{ corrupt json", "utf8");
    const coordinator = makeCoordinator(root);
    const detect = coordinator.detectProfileState();
    expect(detect.outcome === "ok" && detect.value.presence).toBe("recovery-required");
  });

  it("sealed material present but no descriptor (interrupted after sealing) -> recovery-required", () => {
    const root = makeTmpRoot();
    const paths = planFedosLocalProfilePaths(root)!;
    ensureFedosLocalProfileDirectories(paths);
    // A structurally valid sealed file with NO descriptor.
    writeFileSync(paths.sealedMasterSeedFile, '{"v":1,"kdf":"argon2id","dev":true,"salt":"aa","verifier":"bb"}', "utf8");
    const coordinator = makeCoordinator(root);
    const detect = coordinator.detectProfileState();
    expect(detect.outcome === "ok" && detect.value.presence).toBe("recovery-required");
  });

  it("missing sealed file on unlock -> corrupt (fail closed), never a false ready", async () => {
    const root = makeTmpRoot();
    const paths = planFedosLocalProfilePaths(root)!;
    ensureFedosLocalProfileDirectories(paths);
    // A "ready" descriptor but NO sealed file (deleted material).
    const descriptor = createFedosLocalProfileDescriptorV1({
      profileId: "e".repeat(32),
      displayLabel: "No seed",
      accountPublicIdentity: { authority: "nostr", publicKeyHex: "f".repeat(64) },
      localDeviceId: "device-y",
      createdAt: 1_700_000_000_000,
      sealedMasterSeedRef: paths.sealedMasterSeedFile,
      dataDirectoryRoot: root,
      initializationState: "ready",
    })!;
    new FileFedosLocalProfilePersistence(paths.profileDescriptorFile).writeIfAbsent(descriptor);
    const coordinator = makeCoordinator(root);
    coordinator.detectProfileState();
    const unlocked = await coordinator.unlockProfile(fedosProfileUnlockSecretFromUtf8("whatever-secret"));
    expect(unlocked.outcome).toBe("corrupt");
    expect(coordinator.runningRuntime()).toBeNull();
  });
});

describe("Phase O — independent profiles isolated + command dispatch end-to-end", () => {
  it("two independent profiles have fully isolated durable state", async () => {
    const rootA = makeTmpRoot();
    const rootB = makeTmpRoot();
    const a = makeCoordinator(rootA);
    const b = makeCoordinator(rootB);
    const ra = await a.createProfile({ displayLabel: "Profile A" }, fedosProfileUnlockSecretFromUtf8("profile-a-secret"));
    const rb = await b.createProfile({ displayLabel: "Profile B" }, fedosProfileUnlockSecretFromUtf8("profile-b-secret"));
    expect(ra.outcome).toBe("ok");
    expect(rb.outcome).toBe("ok");
    if (ra.outcome === "ok" && rb.outcome === "ok") {
      expect(ra.value.accountPublicIdentifier).not.toBe(rb.value.accountPublicIdentifier);
    }
    const pathsA = planFedosLocalProfilePaths(rootA)!;
    const pathsB = planFedosLocalProfilePaths(rootB)!;
    expect(fedosLocalProfilePathsIsolated(pathsA, pathsB)).toBe(true);
    await a.lock();
    await b.lock();
  });

  it("dispatches profile-status / profile-create / profile-lock through the command boundary; never echoes the secret", async () => {
    const root = makeTmpRoot();
    const coordinator = makeCoordinator(root);
    const status = await dispatchFedosOnboardingCommand(coordinator, { kind: "profile-status" });
    expect(status.kind).toBe("status");

    const createResponse = await dispatchFedosOnboardingCommand(coordinator, {
      kind: "profile-create",
      displayLabel: "Via command",
      secret: fedosProfileUnlockSecretFromUtf8("command-path-secret"),
    });
    expect(createResponse.kind).toBe("ready");
    expect(JSON.stringify(createResponse)).not.toContain("command-path-secret");

    const lockResponse = await dispatchFedosOnboardingCommand(coordinator, { kind: "profile-lock" });
    expect(lockResponse.kind).toBe("locked");

    // A ready view renders safely.
    if (createResponse.kind === "ready") {
      const view = fedosOnboardingReadyView(createResponse.ready);
      expect(view.screen).toBe("profile-ready");
      expect(JSON.stringify(view)).not.toContain("command-path-secret");
    }
  });
});

// ---------------------------------------------------------------------
// FedOS Peer Device Discovery Arc P0 Closure (Agent F) — Flow R:
// `resetInterruptedProfile()`. See the frozen decision doc,
// `docs/reviews/fedos-peer-device-discovery-current/10_P0_CLOSURE_COORDINATOR_FREEZE.md`
// §2, for the exact contract this suite proves.
// ---------------------------------------------------------------------

describe("Phase R — resetInterruptedProfile() (Agent F)", () => {
  it("a no-op refusal on a fresh root (nothing to reset, absent stays absent)", async () => {
    const root = makeTmpRoot();
    const coordinator = makeCoordinator(root);
    coordinator.detectProfileState();
    const reset = await coordinator.resetInterruptedProfile();
    expect(reset.outcome).toBe("reset-refused");
    expect(coordinator.lifecycleState).toBe("absent");
  });

  it("REFUSES and does NOT touch a genuinely ready profile (must never reset ready)", async () => {
    const root = makeTmpRoot();
    const paths = planFedosLocalProfilePaths(root)!;
    const signing = new RealFedosNostrSigningAuthority();
    const created = await makeCoordinator(root, { accountSigningAuthority: signing }).createProfile(
      { displayLabel: "Never touch me" },
      fedosProfileUnlockSecretFromUtf8("do-not-reset-this-secret"),
    );
    expect(created.outcome).toBe("ok");

    // A brand-new coordinator over the SAME durable paths, as a fresh
    // launch would construct (the profile is "locked", NOT "recovery-required").
    const relaunch = makeCoordinator(root, { accountSigningAuthority: signing });
    const detect = relaunch.detectProfileState();
    expect(detect.outcome === "ok" && detect.value.presence).toBe("locked");

    const reset = await relaunch.resetInterruptedProfile();
    expect(reset.outcome).toBe("reset-refused");
    expect(relaunch.lifecycleState).toBe("locked");
    // Nothing was deleted.
    expect(existsSync(paths.profileDescriptorFile)).toBe(true);
    expect(existsSync(paths.sealedMasterSeedFile)).toBe(true);
    const descriptor = decodeFedosLocalProfileDescriptorV1(readFileSync(paths.profileDescriptorFile, "utf8") as string)!;
    expect(descriptor.initializationState).toBe("ready");

    // The still-real profile can still be unlocked afterward -- the refusal
    // left it completely intact.
    const unlocked = await relaunch.unlockProfile(fedosProfileUnlockSecretFromUtf8("do-not-reset-this-secret"));
    expect(unlocked.outcome).toBe("ok");
    await relaunch.lock();
  });

  it("REFUSES even when called directly against a real ready profile without ever detecting recovery-required (defense in depth)", async () => {
    const root = makeTmpRoot();
    const paths = planFedosLocalProfilePaths(root)!;
    const signing = new RealFedosNostrSigningAuthority();
    await makeCoordinator(root, { accountSigningAuthority: signing }).createProfile(
      { displayLabel: "Guarded" },
      fedosProfileUnlockSecretFromUtf8("guarded-secret-value"),
    );
    // A fresh coordinator that unlocks (reaching real "ready"), then a
    // caller mistakenly invokes resetInterruptedProfile() anyway.
    const relaunch = makeCoordinator(root, { accountSigningAuthority: signing });
    relaunch.detectProfileState();
    const unlocked = await relaunch.unlockProfile(fedosProfileUnlockSecretFromUtf8("guarded-secret-value"));
    expect(unlocked.outcome).toBe("ok");
    expect(relaunch.lifecycleState).toBe("ready");

    const reset = await relaunch.resetInterruptedProfile();
    expect(reset.outcome).toBe("reset-refused");
    expect(existsSync(paths.profileDescriptorFile)).toBe(true);
    expect(existsSync(paths.sealedMasterSeedFile)).toBe(true);
    await relaunch.lock();
  });

  it("checkpoint: descriptor stuck in 'initializing' -> reset succeeds, clears both files, returns absent, and a fresh createProfile() then succeeds", async () => {
    const root = makeTmpRoot();
    const paths = planFedosLocalProfilePaths(root)!;
    ensureFedosLocalProfileDirectories(paths);
    const draft = createFedosLocalProfileDescriptorV1({
      profileId: "f".repeat(32),
      displayLabel: "Interrupted (initializing)",
      accountPublicIdentity: { authority: "nostr", publicKeyHex: "1".repeat(64) },
      localDeviceId: "device-init",
      createdAt: 1_700_000_000_000,
      sealedMasterSeedRef: paths.sealedMasterSeedFile,
      dataDirectoryRoot: root,
      initializationState: "initializing",
    })!;
    new FileFedosLocalProfilePersistence(paths.profileDescriptorFile).writeIfAbsent(draft);
    writeFileSync(paths.sealedMasterSeedFile, '{"v":1,"kdf":"argon2id","dev":true,"salt":"aa","verifier":"bb"}', "utf8");

    const coordinator = makeCoordinator(root);
    const detect = coordinator.detectProfileState();
    expect(detect.outcome === "ok" && detect.value.presence).toBe("recovery-required");

    const reset = await coordinator.resetInterruptedProfile();
    expect(reset.outcome).toBe("ok");
    if (reset.outcome === "ok") expect(reset.value.lifecycleState).toBe("absent");
    expect(coordinator.lifecycleState).toBe("absent");
    expect(existsSync(paths.profileDescriptorFile)).toBe(false);
    expect(existsSync(paths.sealedMasterSeedFile)).toBe(false);

    // A fresh createProfile() now runs clean.
    const created = await coordinator.createProfile(
      { displayLabel: "Fresh after reset" },
      fedosProfileUnlockSecretFromUtf8("fresh-after-reset-secret"),
    );
    expect(created.outcome).toBe("ok");
    if (created.outcome === "ok") expect(created.value.lifecycleState).toBe("ready");
    await coordinator.lock();
  });

  it("checkpoint: descriptor left as 'failed' -> reset succeeds, clears both files, then a fresh createProfile() succeeds", async () => {
    const root = makeTmpRoot();
    const paths = planFedosLocalProfilePaths(root)!;
    ensureFedosLocalProfileDirectories(paths);
    const draft = createFedosLocalProfileDescriptorV1({
      profileId: "9".repeat(32),
      displayLabel: "Interrupted (failed)",
      accountPublicIdentity: { authority: "nostr", publicKeyHex: "2".repeat(64) },
      localDeviceId: "device-failed",
      createdAt: 1_700_000_000_000,
      sealedMasterSeedRef: paths.sealedMasterSeedFile,
      dataDirectoryRoot: root,
      initializationState: "failed",
    })!;
    new FileFedosLocalProfilePersistence(paths.profileDescriptorFile).writeIfAbsent(draft);
    writeFileSync(paths.sealedMasterSeedFile, '{"v":1,"kdf":"argon2id","dev":true,"salt":"cc","verifier":"dd"}', "utf8");

    const coordinator = makeCoordinator(root);
    coordinator.detectProfileState();
    expect(coordinator.lifecycleState).toBe("recovery-required");

    const reset = await coordinator.resetInterruptedProfile();
    expect(reset.outcome).toBe("ok");
    expect(existsSync(paths.profileDescriptorFile)).toBe(false);
    expect(existsSync(paths.sealedMasterSeedFile)).toBe(false);

    const created = await coordinator.createProfile(
      { displayLabel: "Fresh after failed reset" },
      fedosProfileUnlockSecretFromUtf8("fresh-after-failed-secret"),
    );
    expect(created.outcome).toBe("ok");
    await coordinator.lock();
  });

  it("checkpoint: sealed material present but NO descriptor (interrupted after sealing) -> reset succeeds, then createProfile() succeeds", async () => {
    const root = makeTmpRoot();
    const paths = planFedosLocalProfilePaths(root)!;
    ensureFedosLocalProfileDirectories(paths);
    writeFileSync(paths.sealedMasterSeedFile, '{"v":1,"kdf":"argon2id","dev":true,"salt":"ee","verifier":"ff"}', "utf8");
    expect(existsSync(paths.profileDescriptorFile)).toBe(false);

    const coordinator = makeCoordinator(root);
    coordinator.detectProfileState();
    expect(coordinator.lifecycleState).toBe("recovery-required");

    const reset = await coordinator.resetInterruptedProfile();
    expect(reset.outcome).toBe("ok");
    expect(existsSync(paths.sealedMasterSeedFile)).toBe(false);
    expect(coordinator.lifecycleState).toBe("absent");

    const created = await coordinator.createProfile(
      { displayLabel: "Fresh after sealed-only reset" },
      fedosProfileUnlockSecretFromUtf8("fresh-after-sealed-only-secret"),
    );
    expect(created.outcome).toBe("ok");
    await coordinator.lock();
  });

  it("checkpoint: a corrupt descriptor file -> reset succeeds and clears it, then createProfile() succeeds", async () => {
    const root = makeTmpRoot();
    const paths = planFedosLocalProfilePaths(root)!;
    ensureFedosLocalProfileDirectories(paths);
    writeFileSync(paths.profileDescriptorFile, "{ corrupt json", "utf8");

    const coordinator = makeCoordinator(root);
    coordinator.detectProfileState();
    expect(coordinator.lifecycleState).toBe("recovery-required");

    const reset = await coordinator.resetInterruptedProfile();
    expect(reset.outcome).toBe("ok");
    expect(existsSync(paths.profileDescriptorFile)).toBe(false);

    const created = await coordinator.createProfile(
      { displayLabel: "Fresh after corrupt-descriptor reset" },
      fedosProfileUnlockSecretFromUtf8("fresh-after-corrupt-secret"),
    );
    expect(created.outcome).toBe("ok");
    await coordinator.lock();
  });

  it("idempotent no-op: calling reset twice in a row the second time is refused (already absent, nothing to reset)", async () => {
    const root = makeTmpRoot();
    const paths = planFedosLocalProfilePaths(root)!;
    ensureFedosLocalProfileDirectories(paths);
    writeFileSync(paths.sealedMasterSeedFile, '{"v":1,"kdf":"argon2id","dev":true,"salt":"11","verifier":"22"}', "utf8");
    const coordinator = makeCoordinator(root);
    coordinator.detectProfileState();
    const first = await coordinator.resetInterruptedProfile();
    expect(first.outcome).toBe("ok");
    const second = await coordinator.resetInterruptedProfile();
    expect(second.outcome).toBe("reset-refused");
  });
});

// ---------------------------------------------------------------------
// FedOS Installed Startup Root-Cause Arc — a "ready" descriptor whose
// sealed Master Seed envelope is verifiably, STRUCTURALLY missing/corrupt.
// Previously undetectable without a live (failing) unlock attempt, and NOT
// detectable again on a fresh relaunch at all — this suite proves both the
// new `detectProfileState()`/`status()` structural check and its own
// SIBLING reset path, `resetCorruptReadyProfile()`.
// ---------------------------------------------------------------------

describe("Phase S — ready descriptor + structurally corrupt/missing sealed seed", () => {
  it("detected via a FRESH status() call (not just a live unlock attempt) when the sealed file is MISSING next to a ready descriptor", async () => {
    const root = makeTmpRoot();
    const paths = planFedosLocalProfilePaths(root)!;
    const signing = new RealFedosNostrSigningAuthority();
    const created = await makeCoordinator(root, { accountSigningAuthority: signing }).createProfile(
      { displayLabel: "Will lose its seed" },
      fedosProfileUnlockSecretFromUtf8("about-to-be-corrupted-secret"),
    );
    expect(created.outcome).toBe("ok");

    // Simulate the sealed file going missing out from under an intact,
    // "ready" descriptor -- e.g. a disk error/partial write elsewhere on
    // the device, NOT anything this Coordinator did.
    rmSync(paths.sealedMasterSeedFile, { force: true });
    expect(existsSync(paths.sealedMasterSeedFile)).toBe(false);
    expect(existsSync(paths.profileDescriptorFile)).toBe(true);

    // A brand-new coordinator, as a fresh relaunch would construct --
    // status()/detectProfileState() alone (no unlockProfile() call at all)
    // must already report the honest, distinct shape.
    const relaunch = makeCoordinator(root, { accountSigningAuthority: signing });
    const detect = relaunch.detectProfileState();
    expect(detect.outcome === "ok" && detect.value.presence).toBe("recovery-required");
    expect(detect.outcome === "ok" && detect.value.recoveryReason).toBe("corrupt");
    expect(relaunch.lifecycleState).toBe("recovery-required");

    const status = relaunch.status();
    expect(status.presence).toBe("recovery-required");
    expect(status.recoveryReason).toBe("corrupt");
  });

  it("detected via a FRESH status() call when the sealed file is structurally UNPARSEABLE (not merely missing) next to a ready descriptor", async () => {
    const root = makeTmpRoot();
    const paths = planFedosLocalProfilePaths(root)!;
    const signing = new RealFedosNostrSigningAuthority();
    const created = await makeCoordinator(root, { accountSigningAuthority: signing }).createProfile(
      { displayLabel: "Will get corrupted bytes" },
      fedosProfileUnlockSecretFromUtf8("about-to-be-mangled-secret"),
    );
    expect(created.outcome).toBe("ok");

    // Overwrite the sealed file's bytes with structurally invalid JSON --
    // never a decrypt attempt, purely a parse/shape failure.
    writeFileSync(paths.sealedMasterSeedFile, "{ not even close to well-formed", "utf8");

    const relaunch = makeCoordinator(root, { accountSigningAuthority: signing });
    const status = relaunch.status();
    // status() alone (no detectProfileState()/unlockProfile() call) must
    // already be honest, mirroring the "real production caller never calls
    // detectProfileState() separately" shape (`fedos_electron_beta_main.cts`'s
    // own `handleStatus()` does call `detectProfileState()` first when no
    // coordinator is active, exactly like this).
    relaunch.detectProfileState();
    expect(relaunch.status().presence).toBe("recovery-required");
    expect(relaunch.status().recoveryReason).toBe("corrupt");
  });

  it("does NOT trigger for a genuinely intact sealed file with merely a WRONG passphrase -- status() keeps reporting locked, unlock keeps reporting unlock-failed", async () => {
    const root = makeTmpRoot();
    const paths = planFedosLocalProfilePaths(root)!;
    const signing = new RealFedosNostrSigningAuthority();
    await makeCoordinator(root, { accountSigningAuthority: signing }).createProfile(
      { displayLabel: "Never actually corrupt" },
      fedosProfileUnlockSecretFromUtf8("the-real-secret-value"),
    );
    expect(existsSync(paths.sealedMasterSeedFile)).toBe(true);

    const relaunch = makeCoordinator(root, { accountSigningAuthority: signing });
    const detect = relaunch.detectProfileState();
    expect(detect.outcome === "ok" && detect.value.presence).toBe("locked");
    expect(detect.outcome === "ok" && detect.value.recoveryReason).toBe(null);

    const wrong = await relaunch.unlockProfile(fedosProfileUnlockSecretFromUtf8("a-completely-wrong-secret"));
    expect(wrong.outcome).toBe("unlock-failed");
    expect(relaunch.lifecycleState).toBe("locked");

    // A fresh status() read after the wrong-passphrase attempt is STILL
    // honestly "locked", never "recovery-required" -- the sealed file was
    // never touched by the wrong attempt, so the structural check keeps
    // passing.
    const status = relaunch.status();
    expect(status.presence).toBe("locked");
    expect(status.recoveryReason).toBe(null);
    expect(existsSync(paths.sealedMasterSeedFile)).toBe(true);

    // The retry-with-correct-passphrase path still works -- completely
    // unaffected by this Arc's structural check.
    const right = await relaunch.unlockProfile(fedosProfileUnlockSecretFromUtf8("the-real-secret-value"));
    expect(right.outcome).toBe("ok");
    await relaunch.lock();
  });

  it("unlockProfile() still returns the distinct 'corrupt' outcome for this shape (regression: detectProfileState() now catches it FIRST, but the outcome string is preserved)", async () => {
    const root = makeTmpRoot();
    const paths = planFedosLocalProfilePaths(root)!;
    const signing = new RealFedosNostrSigningAuthority();
    await makeCoordinator(root, { accountSigningAuthority: signing }).createProfile(
      { displayLabel: "Corrupt then unlock" },
      fedosProfileUnlockSecretFromUtf8("will-be-deleted-secret"),
    );
    rmSync(paths.sealedMasterSeedFile, { force: true });

    const relaunch = makeCoordinator(root, { accountSigningAuthority: signing });
    relaunch.detectProfileState();
    const unlocked = await relaunch.unlockProfile(fedosProfileUnlockSecretFromUtf8("any-passphrase-at-all"));
    expect(unlocked.outcome).toBe("corrupt");
    expect(relaunch.runningRuntime()).toBeNull();
  });

  it("resetCorruptReadyProfile(): a no-op refusal on a fresh root (nothing to reset, absent stays absent)", async () => {
    const root = makeTmpRoot();
    const coordinator = makeCoordinator(root);
    coordinator.detectProfileState();
    const reset = await coordinator.resetCorruptReadyProfile();
    expect(reset.outcome).toBe("reset-refused");
    expect(coordinator.lifecycleState).toBe("absent");
  });

  it("resetCorruptReadyProfile(): REFUSES a genuinely ready profile with an INTACT sealed seed (hard safety boundary -- must never turn a wrong-passphrase typo into data loss)", async () => {
    const root = makeTmpRoot();
    const paths = planFedosLocalProfilePaths(root)!;
    const signing = new RealFedosNostrSigningAuthority();
    await makeCoordinator(root, { accountSigningAuthority: signing }).createProfile(
      { displayLabel: "Do not ever reset me" },
      fedosProfileUnlockSecretFromUtf8("intact-secret-value"),
    );

    const relaunch = makeCoordinator(root, { accountSigningAuthority: signing });
    const detect = relaunch.detectProfileState();
    expect(detect.outcome === "ok" && detect.value.presence).toBe("locked");

    const reset = await relaunch.resetCorruptReadyProfile();
    expect(reset.outcome).toBe("reset-refused");
    expect(relaunch.lifecycleState).toBe("locked");
    expect(existsSync(paths.profileDescriptorFile)).toBe(true);
    expect(existsSync(paths.sealedMasterSeedFile)).toBe(true);

    // The still-real, still-intact profile unlocks fine afterward -- the
    // refusal left it completely untouched.
    const unlocked = await relaunch.unlockProfile(fedosProfileUnlockSecretFromUtf8("intact-secret-value"));
    expect(unlocked.outcome).toBe("ok");
    await relaunch.lock();
  });

  it("resetCorruptReadyProfile(): REFUSES an interrupted (never-ready) profile -- that shape belongs to resetInterruptedProfile(), not this method", async () => {
    const root = makeTmpRoot();
    const paths = planFedosLocalProfilePaths(root)!;
    ensureFedosLocalProfileDirectories(paths);
    const draft = createFedosLocalProfileDescriptorV1({
      profileId: "3".repeat(32),
      displayLabel: "Interrupted, not corrupt-ready",
      accountPublicIdentity: { authority: "nostr", publicKeyHex: "4".repeat(64) },
      localDeviceId: "device-interrupted",
      createdAt: 1_700_000_000_000,
      sealedMasterSeedRef: paths.sealedMasterSeedFile,
      dataDirectoryRoot: root,
      initializationState: "initializing",
    })!;
    new FileFedosLocalProfilePersistence(paths.profileDescriptorFile).writeIfAbsent(draft);

    const coordinator = makeCoordinator(root);
    coordinator.detectProfileState();
    expect(coordinator.lifecycleState).toBe("recovery-required");

    const reset = await coordinator.resetCorruptReadyProfile();
    expect(reset.outcome).toBe("reset-refused");
    expect(existsSync(paths.profileDescriptorFile)).toBe(true);

    // The SIBLING method still correctly handles this shape.
    const siblingReset = await coordinator.resetInterruptedProfile();
    expect(siblingReset.outcome).toBe("ok");
  });

  it("resetCorruptReadyProfile(): succeeds ONLY for the genuinely corrupt case (missing sealed file), clears both files, returns absent, and a fresh createProfile() then succeeds cleanly", async () => {
    const root = makeTmpRoot();
    const paths = planFedosLocalProfilePaths(root)!;
    const signing = new RealFedosNostrSigningAuthority();
    await makeCoordinator(root, { accountSigningAuthority: signing }).createProfile(
      { displayLabel: "Genuinely corrupt" },
      fedosProfileUnlockSecretFromUtf8("genuinely-corrupt-secret"),
    );
    rmSync(paths.sealedMasterSeedFile, { force: true });

    const relaunch = makeCoordinator(root, { accountSigningAuthority: signing });
    const detect = relaunch.detectProfileState();
    expect(detect.outcome === "ok" && detect.value.presence).toBe("recovery-required");
    expect(detect.outcome === "ok" && detect.value.recoveryReason).toBe("corrupt");

    // resetInterruptedProfile() correctly refuses this shape (the
    // descriptor DID reach ready -- that method's own guard explicitly,
    // permanently protects it).
    const wrongSiblingAttempt = await relaunch.resetInterruptedProfile();
    expect(wrongSiblingAttempt.outcome).toBe("reset-refused");
    expect(existsSync(paths.profileDescriptorFile)).toBe(true); // untouched

    const reset = await relaunch.resetCorruptReadyProfile();
    expect(reset.outcome).toBe("ok");
    if (reset.outcome === "ok") expect(reset.value.lifecycleState).toBe("absent");
    expect(relaunch.lifecycleState).toBe("absent");
    expect(existsSync(paths.profileDescriptorFile)).toBe(false);
    expect(existsSync(paths.sealedMasterSeedFile)).toBe(false);

    // A fresh createProfile() now runs clean, on the SAME coordinator
    // instance.
    const created = await relaunch.createProfile(
      { displayLabel: "Fresh after corrupt-ready reset" },
      fedosProfileUnlockSecretFromUtf8("fresh-after-corrupt-ready-secret"),
    );
    expect(created.outcome).toBe("ok");
    if (created.outcome === "ok") expect(created.value.lifecycleState).toBe("ready");
    await relaunch.lock();
  });

  it("resetCorruptReadyProfile(): succeeds for a structurally unparseable (not merely missing) sealed file too", async () => {
    const root = makeTmpRoot();
    const paths = planFedosLocalProfilePaths(root)!;
    const signing = new RealFedosNostrSigningAuthority();
    await makeCoordinator(root, { accountSigningAuthority: signing }).createProfile(
      { displayLabel: "Mangled bytes" },
      fedosProfileUnlockSecretFromUtf8("mangled-bytes-secret"),
    );
    writeFileSync(paths.sealedMasterSeedFile, "{ still not well-formed", "utf8");

    const relaunch = makeCoordinator(root, { accountSigningAuthority: signing });
    relaunch.detectProfileState();
    const reset = await relaunch.resetCorruptReadyProfile();
    expect(reset.outcome).toBe("ok");
    expect(existsSync(paths.profileDescriptorFile)).toBe(false);
    expect(existsSync(paths.sealedMasterSeedFile)).toBe(false);

    const created = await relaunch.createProfile(
      { displayLabel: "Fresh after mangled-bytes reset" },
      fedosProfileUnlockSecretFromUtf8("fresh-after-mangled-secret"),
    );
    expect(created.outcome).toBe("ok");
    await relaunch.lock();
  });

  it("idempotent no-op: calling resetCorruptReadyProfile() twice in a row -- the second time is refused (already absent)", async () => {
    const root = makeTmpRoot();
    const paths = planFedosLocalProfilePaths(root)!;
    const signing = new RealFedosNostrSigningAuthority();
    await makeCoordinator(root, { accountSigningAuthority: signing }).createProfile(
      { displayLabel: "Reset twice" },
      fedosProfileUnlockSecretFromUtf8("reset-twice-secret"),
    );
    rmSync(paths.sealedMasterSeedFile, { force: true });

    const relaunch = makeCoordinator(root, { accountSigningAuthority: signing });
    relaunch.detectProfileState();
    const first = await relaunch.resetCorruptReadyProfile();
    expect(first.outcome).toBe("ok");
    const second = await relaunch.resetCorruptReadyProfile();
    expect(second.outcome).toBe("reset-refused");
  });

  it("the lifecycle FSM: 'reset-corrupt-ready-profile' is a legal exit from recovery-required, distinct from 'reset-interrupted-profile'", () => {
    expect(canFedosProfileLifecycleTransition("recovery-required", "reset-corrupt-ready-profile")).toBe(true);
    expect(applyFedosProfileLifecycleTransition("recovery-required", "reset-corrupt-ready-profile")).toBe("absent");
    // Every other (state, event) pair involving this new event is illegal.
    for (const state of ["absent", "initializing", "locked", "unlocking", "ready", "failed", "stopped"] as const) {
      expect(canFedosProfileLifecycleTransition(state, "reset-corrupt-ready-profile")).toBe(false);
    }
  });
});

// ---------------------------------------------------------------------
// Disaster Recovery Product Closure arc, Track 3 -- CONFIRMED,
// live-reproduced identity-boundary leak: `resetCorruptReadyProfile()`/
// `resetInterruptedProfile()` delete only `profile.json` +
// `master-seed.sealed.json`. Before this arc, `createProfile()`'s
// overwrite guard trusted `detectProfileState()`, which inspects only
// those same two files -- so a NEW identity created right after Start
// Over could be silently created on top of the OLD identity's still-
// present other durable data (board, conversations, ...), and the new
// identity's own legitimate read APIs could then observe it. The fix
// widens the freshness check (`hasResidualFedosProfileData()`) rather
// than widening what reset deletes -- see
// `docs/reviews/fedos_disaster_recovery_portable_backup_v1/13_PRODUCT_CLOSURE_DECISION.md`.
// ---------------------------------------------------------------------

describe("Phase T — widened freshness check + widened reset close the Start-Over identity-boundary leak (Product Closure Track 3)", () => {
  it("resetCorruptReadyProfile() now ALSO clears residual durable leaves (e.g. a board post), so Start Over both closes the leak AND remains able to complete a genuine fresh createProfile() at the same root", async () => {
    const root = makeTmpRoot();
    const paths = planFedosLocalProfilePaths(root)!;
    const signing = new RealFedosNostrSigningAuthority();

    // Identity A: a real profile with real board data.
    const created = await makeCoordinator(root, { accountSigningAuthority: signing }).createProfile(
      { displayLabel: "Identity A" },
      fedosProfileUnlockSecretFromUtf8("identity-a-secret-value"),
    );
    expect(created.outcome).toBe("ok");
    writeFileSync(paths.boardLogFile, '{"kind":"post","body":"Identity A private board post"}\n', "utf8");
    expect(existsSync(paths.boardLogFile)).toBe(true);

    // Identity A's own sealed seed goes structurally missing (mirrors
    // Phase S's own established "corrupt-ready" reproduction) and gets
    // reset via Start Over -- exactly this arc's own live-reproduced
    // starting shape.
    rmSync(paths.sealedMasterSeedFile, { force: true });
    const relaunch = makeCoordinator(root, { accountSigningAuthority: signing });
    relaunch.detectProfileState();
    const reset = await relaunch.resetCorruptReadyProfile();
    expect(reset.outcome).toBe("ok");
    expect(existsSync(paths.profileDescriptorFile)).toBe(false);
    expect(existsSync(paths.sealedMasterSeedFile)).toBe(false);
    // Before this fix, reset deleted only the 2 identity files -- Identity
    // A's board post would have survived here. It must not any more.
    expect(existsSync(paths.boardLogFile), "Start Over must genuinely clear Identity A's own residual data, not just its 2 identity files").toBe(
      false,
    );

    // Identity B now creates a fresh profile at the SAME root -- this must
    // succeed cleanly (Start Over is still a real, usable product feature)
    // AND Identity B's own board file must contain nothing from Identity A.
    const attemptB = await relaunch.createProfile(
      { displayLabel: "Identity B" },
      fedosProfileUnlockSecretFromUtf8("identity-b-secret-value"),
    );
    expect(attemptB.outcome).toBe("ok");
    if (attemptB.outcome === "ok") expect(attemptB.value.displayLabel).toBe("Identity B");
    expect(existsSync(paths.boardLogFile) ? readFileSync(paths.boardLogFile, "utf8") : "").not.toContain("Identity A private board post");
    await relaunch.lock();
  });

  it("createProfile() still REFUSES with 'residual-data-present' when a durable leaf exists WITHOUT ever having gone through a reset -- defense in depth, independent of reset's own cleanup", async () => {
    const root = makeTmpRoot();
    const paths = planFedosLocalProfilePaths(root)!;
    const coordinator = makeCoordinator(root);
    // No profile was ever created here -- simulates a stray leftover leaf
    // reaching this root some OTHER way (a bug in reset, a manual/external
    // filesystem restore, ...), never through the normal create/reset
    // lifecycle at all.
    writeFileSync(paths.boardLogFile, '{"kind":"post","body":"stray data, never created via this coordinator"}\n', "utf8");

    const attempt = await coordinator.createProfile({ displayLabel: "Should be refused" }, fedosProfileUnlockSecretFromUtf8("refused-secret-value"));
    expect(attempt.outcome).toBe("residual-data-present");
    expect(existsSync(paths.profileDescriptorFile), "must not silently create on top of the stray residue").toBe(false);
    expect(readFileSync(paths.boardLogFile, "utf8")).toBe('{"kind":"post","body":"stray data, never created via this coordinator"}\n');

    // Once genuinely cleared, create succeeds normally -- the guard is not
    // overly strict.
    rmSync(paths.boardLogFile, { force: true });
    const retried = await coordinator.createProfile({ displayLabel: "Now clean" }, fedosProfileUnlockSecretFromUtf8("now-clean-secret-value"));
    expect(retried.outcome).toBe("ok");
    await coordinator.lock();
  });

  it("createProfile() on a genuinely fresh root (no residual data at all) is unaffected by the widened check", async () => {
    const root = makeTmpRoot();
    const coordinator = makeCoordinator(root);
    const created = await coordinator.createProfile({ displayLabel: "Truly fresh" }, fedosProfileUnlockSecretFromUtf8("truly-fresh-secret"));
    expect(created.outcome).toBe("ok");
    await coordinator.lock();
  });

  it("catches residue this planner has NO named field for -- e.g. a 'commerce/' subdirectory an Electron-main-process-level caller creates directly under the same root (self-discovered gap: the original per-leaf-name check could never see this)", async () => {
    const root = makeTmpRoot();
    const paths = planFedosLocalProfilePaths(root)!;
    const signing = new RealFedosNostrSigningAuthority();
    await makeCoordinator(root, { accountSigningAuthority: signing }).createProfile(
      { displayLabel: "Identity A with Commerce data" },
      fedosProfileUnlockSecretFromUtf8("identity-a-commerce-secret"),
    );

    // Mirrors `commerceDurableFilePath()` in fedos_electron_beta_main.cts:
    // `<dataDir()>/commerce/<name>.ndjson` -- a real subdirectory this
    // planner (`fedos_local_profile_paths.ts`) has zero named-field
    // knowledge of, created directly under the SAME profile root.
    const commerceDir = join(root, "commerce");
    mkdirSync(commerceDir, { recursive: true });
    writeFileSync(join(commerceDir, "products.ndjson"), '{"kind":"product","body":"Identity A private listing"}\n', "utf8");

    rmSync(paths.sealedMasterSeedFile, { force: true });
    const relaunch = makeCoordinator(root, { accountSigningAuthority: signing });
    relaunch.detectProfileState();
    const reset = await relaunch.resetCorruptReadyProfile();
    expect(reset.outcome).toBe("ok");
    // Start Over must genuinely clear the Commerce directory too -- not
    // just the 2 identity files or the named NDJSON leaves this planner
    // happens to know about.
    expect(existsSync(commerceDir), "Commerce data must not survive Start Over even though this planner never named it").toBe(false);

    const attemptB = await relaunch.createProfile(
      { displayLabel: "Identity B" },
      fedosProfileUnlockSecretFromUtf8("identity-b-commerce-secret"),
    );
    expect(attemptB.outcome).toBe("ok");
    await relaunch.lock();
  });

  it("createProfile() REFUSES when only an unnamed residual directory (no known leaf) exists -- proves the directory-listing check, not just the old per-leaf-name check, is what's gating this", async () => {
    const root = makeTmpRoot();
    const paths = planFedosLocalProfilePaths(root)!;
    ensureFedosLocalProfileDirectories(paths);
    const commerceDir = join(root, "commerce");
    mkdirSync(commerceDir, { recursive: true });
    writeFileSync(join(commerceDir, "orders.ndjson"), '{"kind":"order"}\n', "utf8");

    const coordinator = makeCoordinator(root);
    const attempt = await coordinator.createProfile({ displayLabel: "Should be refused" }, fedosProfileUnlockSecretFromUtf8("refused-secret-value"));
    expect(attempt.outcome).toBe("residual-data-present");
    expect(existsSync(paths.profileDescriptorFile)).toBe(false);
  });

  it("catches (and Start Over clears) residue at a SIBLING path outside paths.root entirely -- mirrors navigation.log (mini red-team R2 finding, CONFIRMED HIGH: a real, unauthenticated-beyond-'profile active' IPC channel reads it back and serves it to whichever identity is currently active)", async () => {
    // A dedicated parent (own tmpdir, own cleanup below) with `root` as a
    // "profile" subdirectory and `navigation.log` as a true sibling --
    // exactly `<userData>/profile` (= `root`) + `<userData>/navigation.log`
    // in fedos_electron_beta_main.cts. Deliberately NOT `dirname(makeTmpRoot())`,
    // which would resolve to the SHARED OS tmpdir and leak a stray file
    // outside this suite's own `afterEach` cleanup.
    const parentDir = mkdtempSync(join(tmpdir(), "fedos-navlog-sibling-"));
    tmpDirs.push(parentDir);
    const root = join(parentDir, "profile");
    const paths = planFedosLocalProfilePaths(root)!;
    const signing = new RealFedosNostrSigningAuthority();
    const navigationLog = join(parentDir, "navigation.log");

    await makeCoordinator(root, { accountSigningAuthority: signing, additionalResidualPaths: [navigationLog] }).createProfile(
      { displayLabel: "Identity A" },
      fedosProfileUnlockSecretFromUtf8("identity-a-navlog-secret"),
    );
    writeFileSync(navigationLog, '{"lastOpenedConversationId":"identity-A-conversation"}\n', "utf8");

    // Simulate the PRE-FIX reset shape directly (delete only the 2
    // identity files, exactly what `resetCorruptReadyProfile()` did
    // before this fix, leaving the sibling navigation log behind) --
    // proves the sibling ALONE, with no other residue, is what
    // `residual-data-present` is keying off, not the 2 identity files
    // still being present (which would otherwise mask this check behind
    // `already-exists`).
    rmSync(paths.profileDescriptorFile, { force: true });
    rmSync(paths.sealedMasterSeedFile, { force: true });
    const stillHasSibling = await makeCoordinator(root, { accountSigningAuthority: signing, additionalResidualPaths: [navigationLog] }).createProfile(
      { displayLabel: "Should be refused" },
      fedosProfileUnlockSecretFromUtf8("should-be-refused-secret"),
    );
    expect(stillHasSibling.outcome).toBe("residual-data-present");
    expect(existsSync(paths.profileDescriptorFile), "must not silently create on top of the sibling residue").toBe(false);

    // Clear the sibling AND paths.root entirely by hand (this is test
    // setup, not the fix under test -- Identity A's own createProfile()
    // durably wrote well beyond the 2 identity files during its own
    // Device/Runtime bootstrap step, same as Track 3's own "widen reset
    // too" discovery, so simply removing the 2 identity files above left
    // OTHER named leaves behind too) to get back to a genuinely fresh
    // root, then exercise the REAL reset path: Identity A re-created
    // fresh, sibling re-written, sealed seed structurally corrupted so
    // resetCorruptReadyProfile() has a genuine 'ready' descriptor +
    // missing sealed seed to act on.
    rmSync(navigationLog, { force: true });
    rmSync(root, { recursive: true, force: true });
    const recreated = await makeCoordinator(root, { accountSigningAuthority: signing, additionalResidualPaths: [navigationLog] }).createProfile(
      { displayLabel: "Identity A, recreated for the real reset path" },
      fedosProfileUnlockSecretFromUtf8("identity-a-navlog-secret-2"),
    );
    expect(recreated.outcome).toBe("ok");
    writeFileSync(navigationLog, '{"lastOpenedConversationId":"identity-A-conversation-2"}\n', "utf8");
    rmSync(paths.sealedMasterSeedFile, { force: true });
    const relaunch = makeCoordinator(root, { accountSigningAuthority: signing, additionalResidualPaths: [navigationLog] });
    relaunch.detectProfileState();
    const reset = await relaunch.resetCorruptReadyProfile();
    expect(reset.outcome).toBe("ok");
    // Start Over must clear the sibling path too -- not just paths.root's
    // own contents.
    expect(existsSync(navigationLog), "the sibling navigation log must not survive Start Over").toBe(false);

    const attemptB = await relaunch.createProfile(
      { displayLabel: "Identity B" },
      fedosProfileUnlockSecretFromUtf8("identity-b-navlog-secret"),
    );
    expect(attemptB.outcome).toBe("ok");
    await relaunch.lock();
  });

  it("Start Over clears the CONTENTS of logsDirectory/sessionStateDirectory (mini red-team R2 finding: logs/commerce-diagnostics.ndjson now carries real fields tied to the old identity's own Commerce catalog, not merely 'non-secret diagnostics' as an earlier review assumed) without requiring them to be empty on an ordinary fresh check", async () => {
    const root = makeTmpRoot();
    const paths = planFedosLocalProfilePaths(root)!;
    const signing = new RealFedosNostrSigningAuthority();
    await makeCoordinator(root, { accountSigningAuthority: signing }).createProfile(
      { displayLabel: "Identity A" },
      fedosProfileUnlockSecretFromUtf8("identity-a-logs-secret"),
    );
    const diagnosticsLog = join(paths.logsDirectory, "commerce-diagnostics.ndjson");
    writeFileSync(diagnosticsLog, '{"productId":"identity-A-product","outcome":"failed","error":"identity A specific error"}\n', "utf8");

    rmSync(paths.sealedMasterSeedFile, { force: true });
    const relaunch = makeCoordinator(root, { accountSigningAuthority: signing });
    relaunch.detectProfileState();
    const reset = await relaunch.resetCorruptReadyProfile();
    expect(reset.outcome).toBe("ok");
    expect(existsSync(diagnosticsLog), "logs/ contents must be cleared by a completed Start Over").toBe(false);
    expect(existsSync(paths.logsDirectory), "the logs/ directory itself must still exist").toBe(true);

    const attemptB = await relaunch.createProfile(
      { displayLabel: "Identity B" },
      fedosProfileUnlockSecretFromUtf8("identity-b-logs-secret"),
    );
    expect(attemptB.outcome).toBe("ok");
    await relaunch.lock();
  });
});
