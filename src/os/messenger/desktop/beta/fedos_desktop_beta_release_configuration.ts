/**
 * Secure Runtime Alpha 5061-5160 — FedOS Desktop Beta 0.1 — Phase J: the ONE
 * versioned, NON-SECRET Beta release configuration.
 *
 * Safe facts only (spec Phase J): product name, version, channel, capability
 * manifest version, schema versions, minimum supported platform, and the
 * non-secret build/WASM manifest identities. It deliberately does NOT invent
 * semantic-compatibility guarantees beyond what is tested, does NOT mark the
 * product stable, and does NOT enable auto-update (an Absolute Prohibition).
 *
 * Pure value object: no Runtime, no Electron, no persistence, no secret, no
 * network. Deep-frozen; structured-clone-safe.
 *
 * The version string is `0.1.0-beta.1`. The `channel` is `beta`. The
 * `stability` is `beta-release-candidate` — this is a RELEASE CANDIDATE
 * assessment, not a shipped stable release: the Phase A reconciliation report
 * records the release-blocking issues that keep this from a full release
 * freeze in this environment.
 */

// NOT migrated with the rest of this directory: fedos_desktop_beta_capability_manifest.ts
// has an unrelated, uncommitted, in-progress edit from a different arc on this branch
// (a Closed Pilot capability-status honesty revision) that predates this migration and
// was deliberately left untouched at its original path rather than folded into this
// commit -- see the Messenger migration Stage 6 commit message. Reconcile this import
// once that other work lands.
import {
  fedosDesktopBetaCapabilityManifestV1,
  type FedosDesktopBetaCapabilityManifestV1,
} from "../../../../desktop/beta/fedos_desktop_beta_capability_manifest.js";

export interface FedosDesktopBetaReleaseConfigurationV1 {
  readonly configVersion: 1;
  readonly productName: "FedOS Desktop";
  /** Repository-conforming Beta version string. */
  readonly version: "0.1.0-beta.1";
  readonly channel: "beta";
  /** Honest stability marker — NOT "stable". */
  readonly stability: "beta-release-candidate";
  /** The capability manifest version this release advertises. */
  readonly capabilityManifestVersion: number;
  /** Non-secret schema-version facts, matching the accepted lineage descriptors. */
  readonly schemaVersions: {
    readonly settings: 1;
    readonly profile: 1;
    readonly capabilityManifest: 1;
  };
  /** Minimum supported platform (the only packaging target in the accepted lineage). */
  readonly minimumSupportedPlatform: "windows-x64";
  /** Non-secret build identity marker (no secret, no path, no host name). */
  readonly buildIdentity: "fedos-desktop-beta-0.1.0-beta.1";
  /**
   * Whether a pinned, verified production WASM artifact manifest is present in
   * THIS build. `false` here honestly records that the compiled WASM artifact
   * is not built in this environment (a Phase R release blocker).
   */
  readonly wasmArtifactManifestPresent: boolean;
  /** Auto-update is an Absolute Prohibition — always false, stated explicitly. */
  readonly autoUpdateEnabled: false;
}

const FEDOS_DESKTOP_BETA_RELEASE_CONFIGURATION_V1: FedosDesktopBetaReleaseConfigurationV1 = Object.freeze({
  configVersion: 1,
  productName: "FedOS Desktop",
  version: "0.1.0-beta.1",
  channel: "beta",
  stability: "beta-release-candidate",
  capabilityManifestVersion: 1,
  schemaVersions: Object.freeze({
    settings: 1,
    profile: 1,
    capabilityManifest: 1,
  }),
  minimumSupportedPlatform: "windows-x64",
  buildIdentity: "fedos-desktop-beta-0.1.0-beta.1",
  wasmArtifactManifestPresent: false,
  autoUpdateEnabled: false,
});

/** Returns the ONE frozen Beta 0.1 release configuration. */
export function fedosDesktopBetaReleaseConfigurationV1(): FedosDesktopBetaReleaseConfigurationV1 {
  return FEDOS_DESKTOP_BETA_RELEASE_CONFIGURATION_V1;
}

/** The capability manifest referenced by this release configuration. */
export function fedosDesktopBetaReleaseCapabilityManifest(): FedosDesktopBetaCapabilityManifestV1 {
  return fedosDesktopBetaCapabilityManifestV1();
}
