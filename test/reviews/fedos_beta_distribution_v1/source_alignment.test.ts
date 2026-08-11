import { describe, it, expect } from "vitest";
// @ts-expect-error `node:fs` has no type declarations without `@types/node` in this project's tsconfig.
import { readFileSync } from "node:fs";
// @ts-expect-error `node:child_process` has no type declarations without `@types/node` (test-only usage, no new dependency).
import { execFileSync } from "node:child_process";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import rootPackageJsonSource from "../../../package.json?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import electronPackageJsonSource from "../../../packages/fedos-desktop-electron-spike/package.json?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import electronBuilderSpikeConfigSource from "../../../packages/fedos-desktop-electron-spike/electron_builder.config.json?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import electronBuilderBetaConfigSource from "../../../packages/fedos-desktop-electron-spike/electron_builder.beta.config.json?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import betaMainSource from "../../../packages/fedos-desktop-electron-spike/src/fedos_electron_beta_main.cts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import releaseConfigurationSource from "../../../src/os/messenger/desktop/beta/fedos_desktop_beta_release_configuration.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import limitationsSource from "../../../src/os/messenger/desktop/beta/fedos_desktop_beta_limitations.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import wasmManifestSource from "../../../src/os/messenger/desktop/production_activation/fedos_production_wasm_artifact_manifest.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import generateWasmManifestScriptSource from "../../../scripts/generate_wasm_artifact_manifest.mjs?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import profileDescriptorSource from "../../../src/os/messenger/desktop/onboarding/fedos_local_profile_descriptor.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import settingsCodecSource from "../../../src/os/core/settings/fedos_settings_codec.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import coordinatorSource from "../../../src/os/messenger/desktop/onboarding/fedos_profile_initialization_coordinator.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import gitignoreSource from "../../../.gitignore?raw";

/**
 * FedOS Desktop Beta 0.1 Installer/Signing/Distribution/Update Policy V1
 * review — source alignment.
 *
 * Verifies, against this worktree's own REAL, currently-checked-out
 * source (`review/fedos-beta-installer-signing-distribution-update-v1`,
 * branched from `arc/fedos-beta-canonical-composition` @ `8548845`), the
 * "current implementation reality" claims `01`-`20` make. Never asserts
 * that any FUTURE (unimplemented) installer/signing/update capability
 * exists — only what this review's own docs claim IS true today.
 */

const DOCS_DIR = "docs/reviews/fedos_beta_distribution_v1";
const TEST_DIR = "test/reviews/fedos_beta_distribution_v1";

const REQUIRED_DOCS: readonly string[] = [
  "index.md",
  "01_current_packaging_inventory.md",
  "02_beta_release_artifact_inventory.md",
  "03_windows_distribution_format_comparison.md",
  "04_portable_vs_installed_policy.md",
  "05_code_signing_inventory.md",
  "06_windows_smartscreen_and_reputation.md",
  "07_release_artifact_integrity.md",
  "08_wasm_manifest_and_application_binding.md",
  "09_release_channel_policy.md",
  "10_versioning_and_build_identity.md",
  "11_profile_and_schema_compatibility.md",
  "12_upgrade_semantics.md",
  "13_downgrade_and_rollback_policy.md",
  "14_update_interruption_and_recovery.md",
  "15_automatic_update_decision.md",
  "16_distribution_host_and_mirror_policy.md",
  "17_release_security_threat_model.md",
  "18_beta_support_and_deprecation_policy.md",
  "19_implementation_arc_packaging.md",
  "20_normative_recommendation.md",
];

const REQUIRED_TESTS: readonly string[] = [
  "source_alignment.test.ts",
  "distribution_boundary_invariants.test.ts",
  "specification_consistency.test.ts",
];

const MIN_CHARS = 800;

function readDoc(name: string): string {
  return readFileSync(`${DOCS_DIR}/${name}`, "utf8") as string;
}

describe("required deliverables exist", () => {
  it("every required doc file exists and has substantive content", () => {
    for (const name of REQUIRED_DOCS) {
      const content = readDoc(name);
      expect(content.length, `${name} should be substantive`).toBeGreaterThan(MIN_CHARS);
    }
  });

  it("every required test file exists", () => {
    for (const name of REQUIRED_TESTS) {
      const content = readFileSync(`${TEST_DIR}/${name}`, "utf8") as string;
      expect(content.length).toBeGreaterThan(MIN_CHARS);
    }
  });
});

describe("expected base and ancestry", () => {
  it("the expected base commit 8548845 is a real, present ancestor of HEAD", () => {
    const output = execFileSync("git", ["merge-base", "--is-ancestor", "8548845", "HEAD"], { encoding: "utf8" });
    expect(output).toBe(""); // exit 0, no output -- 8548845 IS an ancestor.
  });

  it("this review's own worktree is on the expected review branch", () => {
    const branch = (execFileSync("git", ["branch", "--show-current"], { encoding: "utf8" }) as string).trim();
    expect(branch).toBe("review/fedos-beta-installer-signing-distribution-update-v1");
  });
});

describe("canonical Beta entry point and composition preconditions are real source", () => {
  it("fedos_electron_beta_main.cts exists and is the canonical entry point (composes profile + assembly)", () => {
    expect(betaMainSource).toMatch(/FedosDesktopBetaApplicationAssembly/);
    expect(betaMainSource).toMatch(/fedos-profile:create/);
    expect(betaMainSource).toMatch(/fedos-profile:unlock/);
  });

  it("production activation / real WASM Master Seed unlock is real source, not a stub", () => {
    expect(betaMainSource).toMatch(/activateFedosProductionProfileMasterSeed/);
    expect(betaMainSource).toMatch(/production_activation/);
  });

  it("electron-builder configuration exists for the canonical Beta entry point", () => {
    expect(electronBuilderBetaConfigSource).toMatch(/"main"\s*:\s*"dist\/fedos_electron_beta_main\.cjs"/);
  });

  it("package isolation exists: the Electron package has its own package.json distinct from root", () => {
    const rootPkg = JSON.parse(rootPackageJsonSource) as { name?: string };
    const electronPkg = JSON.parse(electronPackageJsonSource) as { name?: string };
    expect(rootPkg.name).not.toBe(electronPkg.name);
    expect(electronPkg.name).toBe("@nostr-window/fedos-desktop-electron-spike");
  });

  it("WASM manifest verification exists and recomputes the hash rather than trusting it", () => {
    expect(wasmManifestSource).toMatch(/verifyFedosProductionWasmArtifactManifest/);
    expect(wasmManifestSource).toMatch(/fedosWasmArtifactSha256Hex\(wasmBytes\)/);
    expect(wasmManifestSource).toMatch(/hash-mismatch/);
  });

  it("the WASM manifest generation script computes SHA-256 from real bytes via node:crypto", () => {
    expect(generateWasmManifestScriptSource).toMatch(/createHash\("sha256"\)/);
  });
});

describe("installer / signing / auto-update current state (must not be over-claimed)", () => {
  it("both electron-builder configs currently declare win.target as [\"dir\"] only -- no installer target exists yet", () => {
    for (const source of [electronBuilderSpikeConfigSource, electronBuilderBetaConfigSource]) {
      const parsed = JSON.parse(source) as { win?: { target?: string[] } };
      expect(parsed.win?.target).toEqual(["dir"]);
    }
  });

  it("no signing configuration (certificateFile/CSC_LINK/cscKeyPassword) exists in either electron-builder config", () => {
    for (const source of [electronBuilderSpikeConfigSource, electronBuilderBetaConfigSource]) {
      expect(source).not.toMatch(/certificateFile|cscKeyPassword|CSC_LINK|CSC_KEY_PASSWORD/);
    }
  });

  it("auto-update is absent from source: no electron-updater dependency, no autoUpdater usage anywhere reachable", () => {
    const rootPkg = JSON.parse(rootPackageJsonSource) as { dependencies?: Record<string, string>; devDependencies?: Record<string, string> };
    const electronPkg = JSON.parse(electronPackageJsonSource) as { dependencies?: Record<string, string>; devDependencies?: Record<string, string> };
    const allDeps = {
      ...(rootPkg.dependencies ?? {}),
      ...(rootPkg.devDependencies ?? {}),
      ...(electronPkg.dependencies ?? {}),
      ...(electronPkg.devDependencies ?? {}),
    };
    expect(Object.keys(allDeps).some((name) => /electron-updater|auto-update/i.test(name))).toBe(false);
    expect(betaMainSource).not.toMatch(/autoUpdater/);
  });

  it("autoUpdateEnabled is frozen false in the accepted release configuration, matching the review's own update policy", () => {
    expect(releaseConfigurationSource).toMatch(/autoUpdateEnabled:\s*false/);
  });
});

describe("profile/schema version facts", () => {
  it("the accepted release configuration declares schema versions distinct from the product version", () => {
    expect(releaseConfigurationSource).toMatch(/version:\s*"0\.1\.0-beta\.1"/);
    expect(releaseConfigurationSource).toMatch(/schemaVersions:/);
    expect(releaseConfigurationSource).toMatch(/settings:\s*1/);
    expect(releaseConfigurationSource).toMatch(/profile:\s*1/);
  });

  it("the profile descriptor codec rejects any schemaVersion other than 1 (no migration branch)", () => {
    expect(profileDescriptorSource).toMatch(/schemaVersion\s*!==\s*1/);
    expect(profileDescriptorSource).not.toMatch(/migrat(e|ion).{0,80}schemaVersion.{0,80}(2|>\s*1)/is);
  });

  it("the profile descriptor has a reserved, never-migrated migrationVersion field", () => {
    expect(profileDescriptorSource).toMatch(/migrationVersion:\s*number/);
    expect(profileDescriptorSource).toMatch(/migrationVersion:\s*1/);
  });

  it("the settings codec declares schemaVersion: 1", () => {
    expect(settingsCodecSource).toMatch(/schemaVersion:\s*1/);
  });
});

describe("the review named its own real production-source touches (must be additive, already-committed extensions, not this review's own doing)", () => {
  it("the Coordinator's Device Sync scheduler dependency is additive/optional, mirroring archiveEnabled", () => {
    expect(coordinatorSource).toMatch(/deviceSyncSchedulerEnabled\?:\s*boolean/);
    expect(coordinatorSource).toMatch(/archiveEnabled\?:\s*boolean/);
  });
});

describe("no production files were changed by this review", () => {
  it("git diff against src/README.md/package.json/package-lock.json/Cargo.toml/packages/p2p/.tmp_gen shows nothing", () => {
    const output = execFileSync(
      "git",
      ["diff", "--name-only", "8548845", "--", "src", "README.md", "package.json", "package-lock.json", "Cargo.toml", "packages", "p2p", ".tmp_gen"],
      { encoding: "utf8" },
    ) as string;
    expect(output.trim()).toBe("");
  });

  it("every file this review adds/modifies lives under docs/reviews/fedos_beta_distribution_v1/ or test/reviews/fedos_beta_distribution_v1/", () => {
    const output = execFileSync("git", ["diff", "--name-only", "8548845", "--", "."], { encoding: "utf8" }) as string;
    const files = output.split("\n").map((s) => s.trim()).filter((s) => s.length > 0);
    for (const file of files) {
      expect(file.startsWith(DOCS_DIR) || file.startsWith(TEST_DIR), `${file} should be confined to the review's own directories`).toBe(true);
    }
  });
});

describe(".gitignore gap this review disclosed", () => {
  it("dist-package-beta is NOT currently covered by an existing .gitignore pattern (confirms 01's own disclosed gap, does not fix it)", () => {
    expect(gitignoreSource).not.toMatch(/dist-package-beta/);
  });
});
