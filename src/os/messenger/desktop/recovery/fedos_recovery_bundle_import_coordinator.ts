/**
 * Disaster Recovery / Portable Backup Arc — the Restore/Import
 * Coordinator (mandate §9 of "FedOS DISASTER RECOVERY RECONCILIATION +
 * RESTORE COORDINATOR FINAL CLOSURE + LATEST-LINEAGE INTEGRATION").
 *
 * This is the ONE place a caller drives a Recovery Bundle restore
 * end-to-end. It composes the already-real, already-tested building
 * blocks (`fedos_recovery_bundle.ts`, `_encryption.ts`,
 * `_profile_selection.ts`) — it seals/unseals nothing itself, adds no new
 * cryptography, and never touches a live filesystem path this file did
 * not itself resolve via `fedosRecoveryBundleDestinationPathFor()`
 * (never an arbitrary caller-supplied name).
 *
 * SCOPE BOUNDARY, deliberate: this coordinator does NOT mint a fresh
 * Device signing keypair or bootstrap the Device Registry/Desktop
 * Runtime itself — those are genuinely a Host/onboarding-coordinator-
 * level concern (see `fedos_profile_initialization_coordinator.ts`'s own
 * `createProfile()`, Phase 7, for the established pattern:
 * `generateFedosDeviceSigningKeypair()` + `localDeviceId` derived from
 * the fresh public key). The caller MUST generate a fresh Device
 * identity and pass `freshLocalDeviceId` in — this coordinator's own
 * job is to guarantee that whatever it writes to the target profile's
 * `profile.json` uses exactly that value, never anything read from the
 * bundle. This mirrors `FedosRecoveryBundleEncryptionAuthority`'s own
 * "Host-wiring concern, not this Authority's" discipline for verifying
 * `masterSeedAuthority` targets a fresh profile.
 *
 * TWO REAL FRESH-PROFILE HAZARDS beyond the already-documented
 * `localDeviceId` one, found during this reconciliation and closed here
 * (not merely disclosed): the `profile-descriptor` Data Part entry also
 * carries `sealedMasterSeedRef` and `dataDirectoryRoot` — both ABSOLUTE
 * PATH STRINGS on the SOURCE machine's own filesystem
 * (`fedos_local_profile_descriptor.ts:64-67`). Writing that entry
 * verbatim to the target profile would silently point the restored
 * descriptor at Machine A's own paths, which do not exist on Machine B.
 * This coordinator NEVER writes the `profile-descriptor` entry verbatim
 * — it parses it, keeps only the fields that are genuinely safe/correct
 * to carry forward (`profileId`, `displayLabel`, `accountPublicIdentity`),
 * and regenerates every machine/device-specific field
 * (`localDeviceId`, `sealedMasterSeedRef`, `dataDirectoryRoot`,
 * `createdAt`, `lastOpenedAt`, `initializationState`) against the
 * TARGET's own real values via `createFedosLocalProfileDescriptorV1()`
 * (unmodified, already-real, already-validated).
 */

import { writeFileSync, renameSync, unlinkSync, existsSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";
import type { AeadAlgorithm } from "../../../core/vault/wasm/fedos_wasm_loader.js";
import type { FedosMasterSeedAuthority } from "../../../core/vault/wasm/fedos_master_seed_authority.js";
import {
  deserializeFedosRecoveryBundleFromBytes,
  isWellFormedFedosRecoveryBundleV1,
  FEDOS_RECOVERY_BUNDLE_FORMAT_VERSION,
  type FedosRecoveryBundleV1,
} from "./fedos_recovery_bundle.js";
import {
  FedosRecoveryBundleEncryptionAuthority,
  type FedosRecoveryBundleEncryptionRuntimeBoundary,
} from "./fedos_recovery_bundle_encryption.js";
import {
  FEDOS_RECOVERY_BUNDLE_INCLUDED_LOGS,
  FEDOS_RECOVERY_BUNDLE_EXCLUDED_LOGS,
  fedosRecoveryBundleDestinationPathFor,
} from "./fedos_recovery_bundle_profile_selection.js";
import {
  FEDOS_RECOVERY_BUNDLE_INCLUDED_COMMERCE_LOGS,
  FEDOS_RECOVERY_BUNDLE_SETTINGS_LOGICAL_NAME,
  fedosRecoveryBundleCommerceDestinationPathFor,
} from "./fedos_recovery_bundle_commerce_and_settings_selection.js";
import type { FedosLocalProfilePaths } from "../onboarding/fedos_local_profile_paths.js";
import { hasResidualFedosProfileData } from "../onboarding/fedos_local_profile_paths.js";
import {
  isWellFormedFedosLocalProfileDescriptorV1,
  createFedosLocalProfileDescriptorV1,
  type FedosLocalProfileDescriptorV1,
} from "../onboarding/fedos_local_profile_descriptor.js";
import { decodeFedosSettingsDescriptorV1, encodeFedosSettingsDescriptorV1 } from "../../../core/settings/fedos_settings_codec.js";

// ---------------------------------------------------------------------------
// Plan (mandate §11 — a validated plan the caller shows the operator BEFORE
// any mutation; pure, no I/O, no passphrase needed).
// ---------------------------------------------------------------------------

export type FedosRecoveryBundleInspectResult =
  | { readonly outcome: "ok"; readonly plan: FedosRecoveryBundleRestorePlan }
  | { readonly outcome: "malformed" }
  | { readonly outcome: "unsupported-version"; readonly foundVersion: unknown };

export interface FedosRecoveryBundleRestorePlan {
  readonly createdAt: number;
  readonly hasDataPart: boolean;
  /** Logical names the bundle's own manifest claims to carry, if it has a Data Part — NOT yet decrypted/verified; purely what the manifest asserts. */
  readonly manifestIncludedLogs: readonly string[];
  /** Every logical name this build of FedOS is CAPABLE of restoring, for the operator to compare against `manifestIncludedLogs` (an older/newer FedOS build's bundle may claim names this build doesn't know, or omit names this build expects). */
  readonly currentlySupportedLogs: readonly string[];
  /** Field names this build deliberately never includes in any bundle, for operator transparency. */
  readonly deliberatelyExcludedFieldNames: readonly string[];
  /** Mandate §22 requirement 3 — always present, always shown before commit. */
  readonly stalenessWarning: string;
}

/** Pure structural inspection — no passphrase, no decryption, no filesystem access beyond the bytes already in memory. Never throws. */
export function inspectFedosRecoveryBundle(bytes: Uint8Array): FedosRecoveryBundleInspectResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(new TextDecoder().decode(bytes));
  } catch {
    return { outcome: "malformed" };
  }
  if (typeof parsed === "object" && parsed !== null && "v" in parsed && (parsed as { v: unknown }).v !== FEDOS_RECOVERY_BUNDLE_FORMAT_VERSION) {
    return { outcome: "unsupported-version", foundVersion: (parsed as { v: unknown }).v };
  }
  if (!isWellFormedFedosRecoveryBundleV1(parsed)) return { outcome: "malformed" };
  const bundle = parsed;

  return {
    outcome: "ok",
    plan: Object.freeze({
      createdAt: bundle.createdAt,
      hasDataPart: bundle.manifest !== null,
      manifestIncludedLogs: bundle.manifest !== null ? [...bundle.manifest.includedLogs] : [],
      currentlySupportedLogs: [...FEDOS_RECOVERY_BUNDLE_INCLUDED_LOGS.keys()],
      deliberatelyExcludedFieldNames: [...FEDOS_RECOVERY_BUNDLE_EXCLUDED_LOGS],
      stalenessWarning:
        "Any deletions, identity changes, or Device revocations made after this bundle's export timestamp will NOT be reflected by this restore.",
    }),
  };
}

// ---------------------------------------------------------------------------
// Restore (mandate §9/§12 — the actual mutation, always into a fresh target).
// ---------------------------------------------------------------------------

export type FedosRecoveryAssetClassification = "recovered" | "reestablished" | "partial" | "lost";

export interface FedosRecoveryAssetOutcome {
  readonly name: string;
  readonly classification: FedosRecoveryAssetClassification;
  /** Closed-vocabulary-ish human detail, never free-form untrusted input. */
  readonly detail: string;
}

export interface FedosRecoveryBundleRestoreRequest {
  readonly bundleBytes: Uint8Array;
  readonly passphrase: Uint8Array;
  readonly suite: AeadAlgorithm;
  readonly accountIndex: number;
  /** A freshly constructed, empty authority already targeting the TARGET profile's own sealed-seed storage — this coordinator drives `restoreSealed()` on it but never verifies "empty" itself (Host-wiring concern, mirrors `FedosRecoveryBundleEncryptionAuthority.restoreIdentity()`'s own documented discipline). */
  readonly masterSeedAuthority: FedosMasterSeedAuthority;
  /** Resolves the restored identity's own public key, called AFTER `restoreIdentity()` succeeds — same "already resolved by the caller" discipline the Encryption Authority itself uses for `resolveConversationKey`. */
  readonly resolveAccountPublicKeyHex: (accountIndex: number) => Promise<string | null>;
  /** The TARGET profile's own real paths — writes only ever land on these, never on a bundle-supplied path. */
  readonly targetPaths: FedosLocalProfilePaths;
  /** Freshly minted by the caller for THIS restore — see this file's own header. Never read from the bundle. */
  readonly freshLocalDeviceId: string;
  readonly now: number;
  readonly runtimeBoundary?: FedosRecoveryBundleEncryptionRuntimeBoundary;
  /** The TARGET's own `<dataRoot>/commerce` directory — `commerceDurableFilePath()`'s own root in `fedos_electron_beta_main.cts`. Omit if the caller does not want Commerce entries restored (e.g. this build has no Commerce enabled); any Commerce entry in the bundle is then classified `lost` rather than silently written nowhere. */
  readonly targetCommerceRoot?: string;
  /** The TARGET's own `settings.json` path — a SIBLING of `targetPaths.root`, never nested inside it. Omit to skip settings restoration the same way. */
  readonly targetSettingsPath?: string;
  /**
   * Disaster Recovery Product Closure arc, Track 3 — same purpose as
   * `FedosProfileInitializationDependencies.additionalResidualPaths`
   * (`fedos_profile_initialization_coordinator.ts`): absolute paths
   * `targetPaths` cannot see because they are genuine SIBLINGS of
   * `targetPaths.root` (e.g. `navigation.log`), threaded into the
   * `target-not-fresh` freshness check below alongside `targetPaths`.
   * Omit for none — zero behavior change for every existing caller.
   */
  readonly additionalFreshnessCheckPaths?: readonly string[];
}

export type FedosRecoveryBundleRestoreResult =
  | {
      readonly outcome: "restored";
      readonly localDeviceId: string;
      readonly accountPublicKeyHex: string;
      readonly assets: readonly FedosRecoveryAssetOutcome[];
    }
  | { readonly outcome: "malformed" }
  | { readonly outcome: "wrong-secret" }
  | { readonly outcome: "identity-restore-failed"; readonly reason: string }
  | { readonly outcome: "account-identity-unresolved" }
  | { readonly outcome: "data-part-restore-failed"; readonly reason: string }
  | { readonly outcome: "descriptor-invalid" }
  | { readonly outcome: "write-failed"; readonly failedAsset: string }
  | { readonly outcome: "target-not-fresh" };

/** Atomic write (temp-file-then-rename), mirroring this codebase's own documented `docs/secure_runtime_alpha_366_compaction_architecture_review.md` convention. Creates the parent directory if needed (a fresh profile root may not have every subdirectory yet). Returns `false` on any failure, never throws. */
function atomicWrite(destinationPath: string, bytes: Uint8Array): boolean {
  const tempPath = `${destinationPath}.recovery-restore.tmp`;
  try {
    const dir = dirname(destinationPath);
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }
    writeFileSync(tempPath, bytes);
    renameSync(tempPath, destinationPath);
    return true;
  } catch {
    try {
      unlinkSync(tempPath);
    } catch {
      /* best-effort cleanup; the write's own failure is the real error */
    }
    return false;
  }
}

/** Payload-retention staleness is a real, undocumented-away limitation (mandate §16/§22 requirement 3) — never classified `recovered`. */
const PAYLOAD_RETENTION_LOGICAL_NAME = "conversation-payload-retention";

function classifyRestoredAsset(logicalName: string): FedosRecoveryAssetClassification {
  if (logicalName === PAYLOAD_RETENTION_LOGICAL_NAME) return "partial";
  return "recovered";
}

function assetDetailFor(logicalName: string, classification: FedosRecoveryAssetClassification): string {
  if (classification === "partial" && logicalName === PAYLOAD_RETENTION_LOGICAL_NAME) {
    return "Restored from the bundle's own export-time snapshot — any deletions made after that timestamp are not reflected.";
  }
  return "Restored verbatim from the bundle's Data Part.";
}

/**
 * Drives a full restore: Identity Part (mandatory, needs the passphrase),
 * then Data Part (optional, best-effort once identity is unlocked).
 * Fails closed at every stage — a wrong passphrase, a tampered/mismatched
 * manifest, or a malformed bundle all stop before anything is written to
 * disk. Never partially restores: the Identity Part restore
 * (`restoreSealed()`) is the ONE stage with real side effects before all
 * Data Part validation completes, matching
 * `FedosRecoveryBundleEncryptionAuthority`'s own two-stage design — an
 * identity-only bundle, or a Data Part that fails validation, both still
 * leave the caller with a genuinely restored, usable identity (never a
 * half-written Data Part, since every Data Part write happens only after
 * `restoreDataPart()` already returned `"restored"` with a manifest- and
 * content-hash-verified entry list).
 */
export async function restoreFedosRecoveryBundle(request: FedosRecoveryBundleRestoreRequest): Promise<FedosRecoveryBundleRestoreResult> {
  const bundle = deserializeFedosRecoveryBundleFromBytes(request.bundleBytes);
  if (bundle === null) return { outcome: "malformed" };

  const authority = new FedosRecoveryBundleEncryptionAuthority(request.masterSeedAuthority, request.runtimeBoundary);

  const identityResult = await authority.restoreIdentity(bundle, request.passphrase);
  if (identityResult === "wrong-secret") return { outcome: "wrong-secret" };
  if (identityResult === "malformed") return { outcome: "malformed" };
  if (identityResult === "failed") return { outcome: "identity-restore-failed", reason: "restoreSealed threw or returned unavailable" };

  // `authority.restoreIdentity()` above only unseals the Master Seed INTO
  // THIS PROCESS's `request.masterSeedAuthority` instance -- it never
  // touches disk (mirrors `FedosRecoveryBundleEncryptionAuthority`'s own
  // documented "drives restoreSealed(), nothing else" scope). Without this
  // write, a restored profile would work only for the remainder of this one
  // call and become permanently unrecoverable on the very next launch (a
  // plain `unlockProfile()` constructs its OWN fresh `masterSeedAuthority`
  // and reads `targetPaths.sealedMasterSeedFile` from disk -- there would be
  // nothing there). `bundle.sealedMasterSeedEnvelope` is the SAME verbatim
  // JSON string this format's own design copies out of the source
  // `master-seed.sealed.json` (`fedos_recovery_bundle.ts`'s own
  // `sealedMasterSeedEnvelope: string` field), so it round-trips into the
  // identical on-disk shape `SealedSeedPersistence` already knows how to
  // read. Never overwrites an existing file -- refusing here mirrors
  // `sealedSeedPersistence.writeIfAbsent()`'s own "already-exists" guard in
  // `createProfile()`, since a restore target must always be fresh.
  if (existsSync(request.targetPaths.sealedMasterSeedFile)) {
    return { outcome: "target-not-fresh" };
  }
  // Disaster Recovery Product Closure arc, Track 3 — CONFIRMED,
  // live-reproduced: the check above alone (mirroring
  // `createProfile()`'s own pre-fix guard) only inspects the sealed
  // Master Seed file. A prior identity's OTHER durable data (board,
  // conversations, ...) can still be present at this target root even
  // when that one file is gone -- most commonly right after Start Over,
  // which by design deletes only the profile descriptor + sealed seed.
  // Restoring on top of that residue would let the restored identity's
  // own, legitimate read APIs observe the OLD identity's private data.
  // Widen the freshness check itself (never widen deletion scope -- see
  // `hasResidualFedosProfileData()`'s own doc comment for why).
  if (hasResidualFedosProfileData(request.targetPaths, request.additionalFreshnessCheckPaths ?? [])) {
    return { outcome: "target-not-fresh" };
  }
  if (!atomicWrite(request.targetPaths.sealedMasterSeedFile, new TextEncoder().encode(bundle.sealedMasterSeedEnvelope))) {
    return { outcome: "write-failed", failedAsset: "sealed-master-seed" };
  }

  const accountPublicKeyHex = await request.resolveAccountPublicKeyHex(request.accountIndex);
  if (accountPublicKeyHex === null || accountPublicKeyHex.length === 0) {
    return { outcome: "account-identity-unresolved" };
  }

  const assets: FedosRecoveryAssetOutcome[] = [];

  // Direct Ratchet / peer-device-identity / Own-Device-Sync exclusions are
  // never attempted at all -- REESTABLISHED, not a failure, per the design
  // doc's own §5 traceability table.
  for (const field of FEDOS_RECOVERY_BUNDLE_EXCLUDED_LOGS) {
    assets.push({
      name: field,
      classification: "reestablished",
      detail: "Deliberately excluded -- device-bound or session-bound state re-establishes safely through its own existing protocol path; never restored from a bundle.",
    });
  }

  if (bundle.dataCiphertext === null || bundle.manifest === null) {
    return { outcome: "restored", localDeviceId: request.freshLocalDeviceId, accountPublicKeyHex, assets };
  }

  const dataPartResult = await authority.restoreDataPart(bundle, { suite: request.suite, selfAccountPublicKeyHex: accountPublicKeyHex, accountIndex: request.accountIndex });
  if (dataPartResult.outcome !== "restored") {
    return { outcome: "data-part-restore-failed", reason: dataPartResult.outcome };
  }

  for (const entry of dataPartResult.entries) {
    if (entry.name === "profile-descriptor") {
      const restoredDescriptor = safeParseDescriptor(entry.bytes);
      if (restoredDescriptor === null) return { outcome: "descriptor-invalid" };

      const regenerated = createFedosLocalProfileDescriptorV1({
        profileId: restoredDescriptor.profileId,
        displayLabel: restoredDescriptor.displayLabel,
        accountPublicIdentity: restoredDescriptor.accountPublicIdentity,
        localDeviceId: request.freshLocalDeviceId,
        createdAt: request.now,
        sealedMasterSeedRef: request.targetPaths.sealedMasterSeedFile,
        dataDirectoryRoot: request.targetPaths.root,
        initializationState: "ready",
      });
      if (regenerated === null) return { outcome: "descriptor-invalid" };

      const destination = fedosRecoveryBundleDestinationPathFor("profile-descriptor", request.targetPaths);
      if (destination === null || !atomicWrite(destination, new TextEncoder().encode(JSON.stringify(regenerated)))) {
        return { outcome: "write-failed", failedAsset: "profile-descriptor" };
      }
      assets.push({
        name: "profile-descriptor",
        classification: "recovered",
        detail: "Identity/display fields restored; localDeviceId, sealedMasterSeedRef, and dataDirectoryRoot were regenerated for this machine, never carried forward from the bundle.",
      });
      continue;
    }

    if (entry.name === FEDOS_RECOVERY_BUNDLE_SETTINGS_LOGICAL_NAME) {
      if (request.targetSettingsPath === undefined) {
        assets.push({ name: entry.name, classification: "lost", detail: "Caller did not supply a target settings path -- not restored." });
        continue;
      }
      const restoredSettings = decodeFedosSettingsDescriptorV1(new TextDecoder().decode(entry.bytes));
      if (restoredSettings === null) return { outcome: "descriptor-invalid" };
      // archiveDirectory is a machine-specific absolute path on the SOURCE
      // machine (same hazard class as profile-descriptor's own path
      // fields) -- reset it, never carried forward verbatim.
      const regeneratedSettings = { ...restoredSettings, archiveDirectory: "" };
      if (!atomicWrite(request.targetSettingsPath, new TextEncoder().encode(encodeFedosSettingsDescriptorV1(regeneratedSettings)))) {
        return { outcome: "write-failed", failedAsset: entry.name };
      }
      assets.push({
        name: entry.name,
        classification: "partial",
        detail: "Theme/language/relay/notification/window preferences restored; the Archive export directory (a machine-specific path) was reset and must be reconfigured on this machine.",
      });
      continue;
    }

    const destination =
      fedosRecoveryBundleDestinationPathFor(entry.name, request.targetPaths) ??
      (request.targetCommerceRoot !== undefined ? fedosRecoveryBundleCommerceDestinationPathFor(entry.name, request.targetCommerceRoot) : null);
    if (destination === null) {
      // A logical name the bundle's own manifest claims but this build's
      // profile-selection table does not recognize (older/newer FedOS), OR
      // a Commerce name the caller did not supply a target root for --
      // never written to an arbitrary path; classified LOST, not silently
      // dropped.
      assets.push({ name: entry.name, classification: "lost", detail: "Unrecognized by this build's Data Part schema, or no target root supplied -- not restored." });
      continue;
    }
    if (!atomicWrite(destination, entry.bytes)) {
      return { outcome: "write-failed", failedAsset: entry.name };
    }
    const classification = classifyRestoredAsset(entry.name);
    assets.push({ name: entry.name, classification, detail: assetDetailFor(entry.name, classification) });
  }

  // Any INCLUDED logical name the bundle simply never carried (e.g. an
  // empty/never-written source log) is honestly absent, not silently
  // implied "recovered" -- report it explicitly. Commerce/settings are
  // OPTIONAL categories (the bundle may never have carried them at all,
  // e.g. an older FedOS build) -- only reported this way if the caller
  // actually supplied a target for them, matching the "lost" branch above.
  const restoredNames = new Set(assets.map((a) => a.name));
  for (const logicalName of FEDOS_RECOVERY_BUNDLE_INCLUDED_LOGS.keys()) {
    if (!restoredNames.has(logicalName)) {
      assets.push({ name: logicalName, classification: "lost", detail: "Not present in the bundle's Data Part (the source profile had no data for this category)." });
    }
  }
  if (request.targetCommerceRoot !== undefined) {
    for (const logicalName of FEDOS_RECOVERY_BUNDLE_INCLUDED_COMMERCE_LOGS.keys()) {
      if (!restoredNames.has(logicalName)) {
        assets.push({ name: logicalName, classification: "lost", detail: "Not present in the bundle's Data Part (the source profile had no Commerce data for this category)." });
      }
    }
  }

  return { outcome: "restored", localDeviceId: request.freshLocalDeviceId, accountPublicKeyHex, assets };
}

function safeParseDescriptor(bytes: Uint8Array): FedosLocalProfileDescriptorV1 | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(new TextDecoder().decode(bytes));
  } catch {
    return null;
  }
  if (!isWellFormedFedosLocalProfileDescriptorV1(parsed)) return null;
  return parsed;
}
