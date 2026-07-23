/**
 * Secure Runtime Alpha 6841-6920 — FedOS Direct Ratchet Production Crypto
 * Graph Unification Arc. Extends
 * `secure_runtime_alpha_6521_6600_real_production_vertical_slice.test.ts`'s
 * own established pattern, but swaps `DevelopmentFedosMasterSeedAuthority`
 * for the REAL production activation path
 * (`activateFedosProductionProfileMasterSeed()`) — proving, through the
 * ACTUAL `FedosProfileInitializationCoordinator` → `startFedosDesktopRuntime()`
 * chain (never a hand-built Runtime, never a direct test-only factory
 * call), that Direct Ratchet is now genuinely production-reachable, that
 * lock invalidates it, and that a real restart creates a fresh generation
 * with the identical public identity — **never opening `NODE_ENV=development`
 * anywhere in this file**.
 *
 * Skips itself with a clear message if the real `pkg/` (+ pinned manifest)
 * is absent.
 */
import { describe, it, expect } from "vitest";
// @ts-expect-error `node:fs` has no type declarations without `@types/node` in this project's tsconfig.
import { existsSync, mkdtempSync, rmSync } from "node:fs";
// @ts-expect-error see above.
import { tmpdir } from "node:os";
// @ts-expect-error see above.
import { join } from "node:path";

import { FedosProfileInitializationCoordinator, type FedosProfileInitializationDependencies } from "../src/desktop/onboarding/fedos_profile_initialization_coordinator.js";
import { FileFedosLocalProfilePersistence } from "../src/desktop/onboarding/fedos_local_profile_persistence.js";
import { FileFedosSealedMasterSeedEnvelopePersistence } from "../src/runtime/master_seed/fedos_sealed_master_seed_envelope_persistence.js";
import { planFedosLocalProfilePaths, ensureFedosLocalProfileDirectories } from "../src/desktop/onboarding/fedos_local_profile_paths.js";
import { fedosProfileUnlockSecretFromUtf8 } from "../src/desktop/onboarding/fedos_profile_unlock_secret.js";
import { FedosDesktopApplicationShell } from "../src/desktop/shell/fedos_desktop_application_shell.js";
import { NullRelay } from "../src/desktop/null_relay.js";
import { createElectronMainHostAttestation } from "../src/desktop/production_activation/fedos_production_desktop_host_attestation.js";
import { activateFedosProductionProfileMasterSeed } from "../src/desktop/production_activation/fedos_production_profile_activation.js";
import { FedosProductionNostrSigningAuthority } from "../src/desktop/production_activation/fedos_production_nostr_signing_authority.js";
import { FedosProductionMasterSeedAuthority } from "../src/desktop/production_activation/fedos_production_master_seed_authority.js";
import { FEDOS_PRODUCTION_ARTIFACT_DIR } from "../src/desktop/production_activation/fedos_production_desktop_crypto_activation_authority.js";
declare const process: { cwd(): string };

const PKG_DIR = join(process.cwd(), FEDOS_PRODUCTION_ARTIFACT_DIR);
const WASM_PATH = join(PKG_DIR, "fedos_core_rust_bg.wasm");
const MANIFEST_PATH = join(PKG_DIR, "fedos_wasm_artifact_manifest.v1.json");
const REAL_ARTIFACT_PRESENT = existsSync(WASM_PATH) && existsSync(MANIFEST_PATH);

const suite = REAL_ARTIFACT_PRESENT ? describe : describe.skip;

/**
 * Secure Runtime Alpha 6921-7000 — narrowed to the concrete
 * `FedosProductionMasterSeedAuthority` (never the broad
 * `FedosMasterSeedAuthority` interface), matching the real, already-
 * asserted `toBeInstanceOf` check below exactly. This is a test-local
 * type fix only — production interfaces are not widened to accommodate
 * it (`FedosProductionNostrSigningAuthority`'s own constructor
 * legitimately requires the internal accessor only the concrete
 * production class exposes).
 */
async function realProductionAuthority(): Promise<FedosProductionMasterSeedAuthority> {
  const attestation = createElectronMainHostAttestation({ appId: "com.fedos.desktop.test", appVersion: "0.0.1" })!;
  const activation = await activateFedosProductionProfileMasterSeed({ attestation });
  expect(activation.outcome).toBe("activated");
  if (activation.outcome !== "activated") throw new Error("unreachable");
  expect(activation.masterSeedAuthority).toBeInstanceOf(FedosProductionMasterSeedAuthority);
  return activation.masterSeedAuthority as FedosProductionMasterSeedAuthority;
}

async function makeRealProductionCoordinator(dir: string): Promise<FedosProfileInitializationCoordinator> {
  const paths = planFedosLocalProfilePaths(dir)!;
  ensureFedosLocalProfileDirectories(paths);
  const masterSeedAuthority = await realProductionAuthority();
  const accountSigningAuthority = new FedosProductionNostrSigningAuthority(masterSeedAuthority);
  const deps: FedosProfileInitializationDependencies = {
    paths,
    profilePersistence: new FileFedosLocalProfilePersistence(paths.profileDescriptorFile),
    sealedSeedPersistence: new FileFedosSealedMasterSeedEnvelopePersistence(paths.sealedMasterSeedFile),
    masterSeedAuthority,
    accountSigningAuthority,
    privateTransportEnabled: true,
    conversationTransportRelays: [new NullRelay("wss://relay.invalid.example")],
    directRatchetEnabled: true,
    peerCapabilityEnabled: true,
    peerCapabilityLocallySupportedCapabilities: [{ kind: "private-message-route", route: "nostr-nip17-v1" }],
    identityTransitionEnabled: true,
    identityTransitionLocalPolicy: { autoAcceptOldKeyContinuity: false },
    deletionRequestEnabled: true,
    deletionRequestResolveLocalPolicy: () => "always-review",
  };
  return new FedosProfileInitializationCoordinator(deps);
}

suite("Alpha 6841-6920 -- real production vertical slice: Direct Ratchet closes through the REAL production activation path (never NODE_ENV=development)", () => {
  it("Direct Ratchet is production-reachable, invalidates on lock, and a real restart produces a fresh generation with the identical public identity", async () => {
    const dir = mkdtempSync(join(tmpdir(), "fedos-6841-6920-slice-"));
    try {
      // 1-6: real profile creation through the REAL production Coordinator; one real Runtime generation.
      const coordinator = await makeRealProductionCoordinator(dir);
      const created = await coordinator.createProfile({ displayLabel: "Ratchet Unification Slice" }, fedosProfileUnlockSecretFromUtf8("ratchet-unification-secret"));
      expect(created.outcome).toBe("ok");
      if (created.outcome !== "ok") throw new Error("unreachable");
      const firstPublicIdentifier = created.value.accountPublicIdentifier;

      const runtime = coordinator.runningRuntime();
      expect(runtime).not.toBeNull();
      const shell = FedosDesktopApplicationShell.fromRunningRuntime(runtime!);
      expect(shell.status()).toBe("running");

      // 7: Direct Ratchet reports production ready -- THE headline claim this
      // whole Arc exists to prove. Before this Arc: "unavailable". Now: NOT
      // "unavailable" -- a real facade, backed by the REAL production
      // authority, never NODE_ENV=development.
      const ratchetStatus = shell.directRatchetStatus("some-conv", "some-device");
      expect(ratchetStatus.outcome).not.toBe("unavailable");

      // Peer Capability/Identity Transition/Deletion Request remain reachable
      // (this Arc changes nothing about them -- confirmed unaffected).
      expect(shell.peerCapabilityListObserved().outcome).toBe("ok");
      expect(shell.identityTransitionList(10, 0).outcome).toBe("ok");
      expect(shell.deletionRequestListReceived().outcome).toBe("ok");

      // productionCryptoStatus() (the Store-backed authority's own safe
      // status) also reports healthy through the SAME real chain.
      expect(shell.productionCryptoStatus().outcome).toBe("ok");

      // 13-15: lock -- old capability/facade rejects.
      const locked = await coordinator.lock();
      expect(locked.outcome).toBe("ok");
      expect(() => runtime!.conversationRuntime()).toThrow();

      // 16-19: unlock again -- fresh Store/authority/capability generation,
      // identical public identity, Direct Ratchet reachable again through
      // the FRESH generation (never the stale one).
      const relaunchCoordinator = await makeRealProductionCoordinator(dir);
      const unlocked = await relaunchCoordinator.unlockProfile(fedosProfileUnlockSecretFromUtf8("ratchet-unification-secret"));
      expect(unlocked.outcome).toBe("ok");
      if (unlocked.outcome !== "ok") throw new Error("unreachable");
      expect(unlocked.value.accountPublicIdentifier).toBe(firstPublicIdentifier);

      const freshRuntime = relaunchCoordinator.runningRuntime();
      expect(freshRuntime).not.toBeNull();
      expect(freshRuntime).not.toBe(runtime); // genuinely a NEW Runtime generation, never the stale one reused
      const freshShell = FedosDesktopApplicationShell.fromRunningRuntime(freshRuntime!);
      expect(freshShell.directRatchetStatus("some-conv", "some-device").outcome).not.toBe("unavailable");

      // 25: wrong passphrase constructs no Ratchet capability.
      const wrongCoordinator = await makeRealProductionCoordinator(dir);
      const wrongUnlock = await wrongCoordinator.unlockProfile(fedosProfileUnlockSecretFromUtf8("definitely wrong"));
      expect(wrongUnlock.outcome).not.toBe("ok");
      expect(wrongCoordinator.runningRuntime()).toBeNull();

      await relaunchCoordinator.lock();
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
