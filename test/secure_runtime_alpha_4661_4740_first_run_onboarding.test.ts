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

// @ts-expect-error `node:fs` has no type declarations without `@types/node` in this project's tsconfig.
import { mkdtempSync, rmSync, existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
// @ts-expect-error see above.
import { join } from "node:path";
// @ts-expect-error see above.
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
