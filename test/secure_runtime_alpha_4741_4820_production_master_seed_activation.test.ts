/**
 * Secure Runtime Alpha 4741-4820 — Production Master Seed Runtime
 * Activation and Secure Unlock acceptance + failure matrix.
 *
 * Drives the REAL, freshly-built WASM artifact
 * (`packages/fedos-core-rust/pkg/`, produced by
 * `npm run build:production-wasm`) end-to-end through the production
 * Desktop activation path — host attestation (Phase C) -> activation
 * authority (Phase B) -> pinned manifest verification (Phase D) ->
 * capability-limited facade (Phase F) -> production
 * `FedosMasterSeedAuthority` (Phase G) -> the UNCHANGED profile
 * coordinator (Phase G/H). NO development seed double is used anywhere
 * in this suite; NO dev-only NODE_ENV gate is opened.
 *
 * Skips itself with a clear message if the real `pkg/` is absent (the
 * artifact is gitignored; run the build pipeline first).
 */

import { describe, it, expect, afterEach } from "vitest";
// @ts-expect-error node:fs types
import { existsSync, readFileSync, mkdtempSync, rmSync } from "node:fs";
// @ts-expect-error node:path types
import { join } from "node:path";
// @ts-expect-error node:os types
import { tmpdir } from "node:os";

import {
  createElectronMainHostAttestation,
  isFedosProductionDesktopHostAttestation,
} from "../src/desktop/production_activation/fedos_production_desktop_host_attestation.js";
import {
  authorizeAndActivateFedosProductionDesktopMasterSeed,
  FEDOS_PRODUCTION_ARTIFACT_DIR,
} from "../src/desktop/production_activation/fedos_production_desktop_crypto_activation_authority.js";
import { activateFedosProductionProfileMasterSeed } from "../src/desktop/production_activation/fedos_production_profile_activation.js";
import { FedosProductionMasterSeedAuthority } from "../src/desktop/production_activation/fedos_production_master_seed_authority.js";
import {
  planFedosLocalProfilePaths,
  ensureFedosLocalProfileDirectories,
} from "../src/desktop/onboarding/fedos_local_profile_paths.js";
import { FileFedosLocalProfilePersistence } from "../src/desktop/onboarding/fedos_local_profile_persistence.js";
import { FileFedosSealedMasterSeedEnvelopePersistence } from "../src/runtime/master_seed/fedos_sealed_master_seed_envelope_persistence.js";
import { FedosProfileInitializationCoordinator } from "../src/desktop/onboarding/fedos_profile_initialization_coordinator.js";
import { FedosProfileUnlockSecret } from "../src/desktop/onboarding/fedos_profile_unlock_secret.js";
import { RealFedosNostrSigningAuthority } from "./support/real_fedos_nostr_signing_authority.js";

declare const process: { cwd(): string };

const PKG_DIR = join(process.cwd(), FEDOS_PRODUCTION_ARTIFACT_DIR);
const WASM_PATH = join(PKG_DIR, "fedos_core_rust_bg.wasm");
const MANIFEST_PATH = join(PKG_DIR, "fedos_wasm_artifact_manifest.v1.json");
const REAL_ARTIFACT_PRESENT = existsSync(WASM_PATH) && existsSync(MANIFEST_PATH);

const suite = REAL_ARTIFACT_PRESENT ? describe : describe.skip;

function attestation() {
  return createElectronMainHostAttestation({ appId: "com.fedos.desktop.test", appVersion: "0.0.1" })!;
}

function secretFrom(text: string) {
  return new FedosProfileUnlockSecret(new TextEncoder().encode(text));
}

const tmpRoots: string[] = [];
function makeTmpRoot(): string {
  const dir = mkdtempSync(join(tmpdir(), "fedos-prod-activation-"));
  tmpRoots.push(dir);
  return dir;
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

suite("Alpha 4741-4820 — production Master Seed activation + secure unlock (REAL WASM)", () => {
  // ---- Phase C: host attestation boundary ----
  describe("Phase C — host attestation is unforgeable", () => {
    it("a real attestation is accepted; a plain object / JSON payload is not", () => {
      const real = attestation();
      expect(isFedosProductionDesktopHostAttestation(real)).toBe(true);
      expect(isFedosProductionDesktopHostAttestation({ appId: "x", appVersion: "1" })).toBe(false);
      expect(isFedosProductionDesktopHostAttestation(JSON.parse(JSON.stringify(real)))).toBe(false);
      expect(isFedosProductionDesktopHostAttestation("com.fedos.desktop")).toBe(false);
      expect(isFedosProductionDesktopHostAttestation(null)).toBe(false);
    });
    it("rejects malformed build identity", () => {
      expect(createElectronMainHostAttestation({ appId: "", appVersion: "1" })).toBeNull();
      expect(createElectronMainHostAttestation({ appId: "a", appVersion: "" })).toBeNull();
    });
  });

  // ---- Phase B/D: activation authority closed decision vocabulary ----
  describe("Phase B/D — activation authority decisions", () => {
    it("permitted with a real attestation + real pinned artifact", async () => {
      const result = await authorizeAndActivateFedosProductionDesktopMasterSeed({ attestation: attestation() });
      expect(result.decision).toBe("permitted");
    });

    it("unsupported-host without a valid attestation", async () => {
      const result = await authorizeAndActivateFedosProductionDesktopMasterSeed({
        attestation: { appId: "x", appVersion: "1" },
      });
      expect(result.decision).toBe("unsupported-host");
    });

    it("artifact-missing when a pinned file is absent", async () => {
      const result = await authorizeAndActivateFedosProductionDesktopMasterSeed({
        attestation: attestation(),
        fileExists: (p: string) => !p.endsWith(".wasm") && existsSync(p),
      });
      expect(result.decision).toBe("artifact-missing");
    });

    it("artifact-invalid on hash mismatch (bytes tampered)", async () => {
      const result = await authorizeAndActivateFedosProductionDesktopMasterSeed({
        attestation: attestation(),
        readBytes: () => new Uint8Array([1, 2, 3, 4]), // wrong bytes -> hash mismatch
      });
      expect(result.decision).toBe("artifact-invalid");
      if (result.decision !== "permitted") expect(result.reason).toContain("hash-mismatch");
    });

    it("artifact-invalid on a malformed manifest", async () => {
      const result = await authorizeAndActivateFedosProductionDesktopMasterSeed({
        attestation: attestation(),
        readText: () => "{ not valid json",
      });
      expect(result.decision).toBe("artifact-invalid");
    });

    it("artifact-version-mismatch on incompatible compatibilityVersion", async () => {
      const real = JSON.parse(readFileSync(MANIFEST_PATH, "utf8") as string);
      const bumped = JSON.stringify({ ...real, compatibilityVersion: 999 });
      const result = await authorizeAndActivateFedosProductionDesktopMasterSeed({
        attestation: attestation(),
        readText: () => bumped,
      });
      expect(result.decision).toBe("artifact-version-mismatch");
    });

    it("capability-not-allowed on a foreign capability profile", async () => {
      const real = JSON.parse(readFileSync(MANIFEST_PATH, "utf8") as string);
      const foreign = JSON.stringify({ ...real, capabilityProfile: "arbitrary-crypto-v9" });
      const result = await authorizeAndActivateFedosProductionDesktopMasterSeed({
        attestation: attestation(),
        readText: () => foreign,
      });
      expect(result.decision).toBe("capability-not-allowed");
    });

    it("unapproved-build when the expected crate version does not match", async () => {
      const result = await authorizeAndActivateFedosProductionDesktopMasterSeed({
        attestation: attestation(),
        expectedCrate: { version: "9.9.9" },
      });
      expect(result.decision).toBe("unapproved-build");
    });

    it("initialization-failed when initSync throws despite a valid manifest+hash", async () => {
      const realBytes = readFileSync(WASM_PATH) as Uint8Array;
      const result = await authorizeAndActivateFedosProductionDesktopMasterSeed({
        attestation: attestation(),
        readBytes: () => realBytes,
        importGlue: async () => ({
          FedosMasterSeedAuthority: function FedosMasterSeedAuthority() {},
          initSync: () => {
            throw new Error("boom");
          },
        }),
      });
      expect(result.decision).toBe("initialization-failed");
    });
  });

  // ---- Phase F: capability-limited facade ----
  describe("Phase F — capability-limited facade", () => {
    it("constructs a real, empty WASM authority handle and never exposes the module", async () => {
      const result = await authorizeAndActivateFedosProductionDesktopMasterSeed({ attestation: attestation() });
      expect(result.decision).toBe("permitted");
      if (result.decision !== "permitted") return;
      const handle = result.facade.constructMasterSeedAuthority();
      expect(handle).not.toBeNull();
      expect(handle!.is_available()).toBe(false);
      expect(typeof (result.facade as Record<string, unknown>).module).toBe("undefined");
      // Secure Runtime Alpha 6921-7000 narrowly extended this SAME
      // capability-limited facade with one additional read of an
      // already-initialized module export (`constructDirectRatchetSessionModule`)
      // -- still no raw module exposure, still no second WASM
      // instantiation. The allowlist below is extended, never widened
      // past these two named, reviewed capabilities.
      expect(Object.keys(result.facade).sort()).toEqual(["constructDirectRatchetSessionModule", "constructMasterSeedAuthority"]);
    });
  });

  // ---- Phase G: real master seed lifecycle through the production authority ----
  describe("Phase G — real seed generate/seal/restore through the production authority", () => {
    it("generate -> seal -> restore round trips to the same identity; wrong passphrase fails closed", async () => {
      const activation = await activateFedosProductionProfileMasterSeed({ attestation: attestation() });
      expect(activation.outcome).toBe("activated");
      if (activation.outcome !== "activated") return;

      const authority = activation.masterSeedAuthority;
      expect(await authority.generate()).toBe(true);
      const envelope = await authority.seal(new TextEncoder().encode("correct passphrase 0123456789"));
      expect(envelope).not.toBeNull();
      expect(envelope!.json.startsWith('{"v":1,"kdf":"argon2id"')).toBe(true);

      // restore into a fresh production authority with the correct passphrase
      const again = await activateFedosProductionProfileMasterSeed({ attestation: attestation() });
      if (again.outcome !== "activated") throw new Error("re-activation failed");
      const restored = again.masterSeedAuthority;
      expect(await restored.restoreSealed(envelope!, new TextEncoder().encode("correct passphrase 0123456789"))).toBe(true);
      expect(await restored.isAvailable()).toBe(true);

      // wrong passphrase fails closed
      const third = await activateFedosProductionProfileMasterSeed({ attestation: attestation() });
      if (third.outcome !== "activated") throw new Error("re-activation failed");
      expect(await third.masterSeedAuthority.restoreSealed(envelope!, new TextEncoder().encode("WRONG passphrase"))).toBe(false);
      expect(await third.masterSeedAuthority.isAvailable()).toBe(false);
    });

    it("blocked (no fallback) when the host attestation is invalid", async () => {
      const activation = await activateFedosProductionProfileMasterSeed({ attestation: {} });
      expect(activation.outcome).toBe("blocked");
      if (activation.outcome === "blocked") expect(activation.decision).toBe("unsupported-host");
    });
  });

  // ---- Phase H: full profile create -> lock -> relaunch -> unlock through REAL WASM ----
  describe("Phase H — end-to-end profile create/unlock through the coordinator + REAL WASM", () => {
    async function productionAuthority() {
      const activation = await activateFedosProductionProfileMasterSeed({ attestation: attestation() });
      if (activation.outcome !== "activated") throw new Error(`activation blocked: ${JSON.stringify(activation)}`);
      return activation.masterSeedAuthority;
    }

    function coordinator(root: string, signer: RealFedosNostrSigningAuthority, authority: FedosProductionMasterSeedAuthority) {
      const paths = planFedosLocalProfilePaths(root)!;
      ensureFedosLocalProfileDirectories(paths);
      return new FedosProfileInitializationCoordinator({
        paths,
        profilePersistence: new FileFedosLocalProfilePersistence(paths.profileDescriptorFile),
        sealedSeedPersistence: new FileFedosSealedMasterSeedEnvelopePersistence(paths.sealedMasterSeedFile),
        masterSeedAuthority: authority,
        accountSigningAuthority: signer,
      });
    }

    it("create -> ready with REAL sealed material (no plaintext), lock, relaunch, correct unlock stable identity; wrong secret stays locked", async () => {
      const root = makeTmpRoot();
      const signer = new RealFedosNostrSigningAuthority(); // same account across relaunch (identity derived once)

      // Create
      const authA = (await productionAuthority()) as FedosProductionMasterSeedAuthority;
      const coordA = coordinator(root, signer, authA);
      const created = await coordA.createProfile({ displayLabel: "Prod Profile" }, secretFrom("a strong unlock secret!!"));
      expect(created.outcome).toBe("ok");
      if (created.outcome !== "ok") return;
      const identity = created.value.accountPublicIdentifier;

      // Sealed material on disk is REAL Argon2id ciphertext, contains no plaintext secret
      const paths = planFedosLocalProfilePaths(root)!;
      const sealedText = readFileSync(paths.sealedMasterSeedFile, "utf8") as string;
      expect(sealedText.startsWith('{"v":1,"kdf":"argon2id"')).toBe(true);
      expect(sealedText).not.toContain("a strong unlock secret!!");

      // Lock (stops runtime, clears in-memory seed)
      const locked = await coordA.lock();
      expect(locked.outcome).toBe("ok");

      // Relaunch: fresh production authority + fresh coordinator, correct secret
      const authB = (await productionAuthority()) as FedosProductionMasterSeedAuthority;
      const coordB = coordinator(root, signer, authB);
      const detect = coordB.detectProfileState();
      expect(detect.outcome).toBe("ok");
      if (detect.outcome === "ok") expect(detect.value.presence).toBe("locked");
      const unlocked = await coordB.unlockProfile(secretFrom("a strong unlock secret!!"));
      expect(unlocked.outcome).toBe("ok");
      if (unlocked.outcome === "ok") expect(unlocked.value.accountPublicIdentifier).toBe(identity);
      await coordB.lock();

      // Wrong secret stays locked, no running runtime
      const authC = (await productionAuthority()) as FedosProductionMasterSeedAuthority;
      const coordC = coordinator(root, signer, authC);
      coordC.detectProfileState();
      const wrong = await coordC.unlockProfile(secretFrom("the wrong secret here!!!"));
      expect(wrong.outcome).toBe("unlock-failed");
      expect(coordC.runningRuntime()).toBeNull();
    });
  });

  // ---- Phase N: structural guards ----
  describe("Phase N — structural guards", () => {
    it("the pinned manifest contains no secret-shaped field", () => {
      const manifest = JSON.parse(readFileSync(MANIFEST_PATH, "utf8") as string);
      const forbidden = ["seed", "passphrase", "secret", "privateKey", "nsec", "plaintext", "key"];
      for (const key of Object.keys(manifest)) {
        expect(forbidden).not.toContain(key.toLowerCase());
      }
    });
    it("clear() drops the handle so post-lock crypto cannot reach a live seed", async () => {
      const activation = await activateFedosProductionProfileMasterSeed({ attestation: attestation() });
      if (activation.outcome !== "activated") throw new Error("activation blocked");
      const authority = activation.masterSeedAuthority;
      expect(await authority.generate()).toBe(true);
      expect(await authority.isAvailable()).toBe(true);
      await authority.clear();
      expect(await authority.isCleared()).toBe(true);
      expect(await authority.isAvailable()).toBe(false);
      // A post-clear seal must fail closed (no live seed to seal).
      expect(await authority.seal(new TextEncoder().encode("whatever passphrase here"))).toBeNull();
    });
  });
});
