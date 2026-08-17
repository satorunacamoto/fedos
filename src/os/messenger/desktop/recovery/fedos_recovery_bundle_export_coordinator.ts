/**
 * Disaster Recovery / Portable Backup Arc — the Export Coordinator, the
 * missing symmetric half of `fedos_recovery_bundle_import_coordinator.ts`
 * (found during the IPC-wiring pass of the Lineage Reconciliation
 * follow-up: nothing anywhere in the repository actually BUILT a bundle
 * from a live profile before this file — `fedosRecoveryBundleSourcePaths`/
 * `fedosRecoveryBundleCommerceSourcePaths` existed as pure path resolvers,
 * but no caller ever read the files they point at and drove
 * `FedosRecoveryBundleEncryptionAuthority.build()`).
 *
 * This is the ONE place a caller drives a Recovery Bundle EXPORT
 * end-to-end from an already-unlocked, live profile. Best-effort over
 * individual Data Part files: a fresh or never-populated log (e.g. no
 * Commerce activity yet) is simply omitted from the entries list, never a
 * hard failure — mirrors `restoreFedosRecoveryBundle()`'s own "honestly
 * absent, not silently implied" reporting philosophy, just on the build
 * side instead of the restore side.
 */

import { readFileSync, existsSync } from "node:fs";
import type { AeadAlgorithm } from "../../../core/vault/wasm/fedos_wasm_loader.js";
import type { FedosMasterSeedAuthority } from "../../../core/vault/wasm/fedos_master_seed_authority.js";
import { serializeFedosRecoveryBundleToBytes } from "./fedos_recovery_bundle.js";
import {
  FedosRecoveryBundleEncryptionAuthority,
  type FedosRecoveryBundleEncryptionRuntimeBoundary,
} from "./fedos_recovery_bundle_encryption.js";
import type { FedosRecoveryBundleDataPartEntry } from "./fedos_recovery_bundle_data_part_codec.js";
import { fedosRecoveryBundleSourcePaths } from "./fedos_recovery_bundle_profile_selection.js";
import {
  FEDOS_RECOVERY_BUNDLE_SETTINGS_LOGICAL_NAME,
  fedosRecoveryBundleCommerceSourcePaths,
} from "./fedos_recovery_bundle_commerce_and_settings_selection.js";
import type { FedosLocalProfilePaths } from "../onboarding/fedos_local_profile_paths.js";

export interface FedosRecoveryBundleExportRequest {
  /** The SOURCE (currently active, unlocked) profile's own real paths. */
  readonly sourcePaths: FedosLocalProfilePaths;
  readonly suite: AeadAlgorithm;
  readonly accountIndex: number;
  /** An ALREADY-UNLOCKED authority for the live profile — this coordinator never seals/unseals anything itself, it only reads the already-sealed `sealedMasterSeedFile` bytes verbatim and asks this authority to encrypt the Data Part (same "Host already resolved identity" discipline the Import Coordinator's own `resolveAccountPublicKeyHex` uses). */
  readonly masterSeedAuthority: FedosMasterSeedAuthority;
  readonly resolveAccountPublicKeyHex: (accountIndex: number) => Promise<string | null>;
  readonly now: number;
  readonly runtimeBoundary?: FedosRecoveryBundleEncryptionRuntimeBoundary;
  /** The SOURCE's own `<dataRoot>/commerce` directory. Omit to exclude Commerce entries from the exported bundle entirely (never attempted, not merely empty). */
  readonly sourceCommerceRoot?: string;
  /** The SOURCE's own `settings.json` path — a SIBLING of `sourcePaths.root`. Omit to exclude settings from the exported bundle. */
  readonly sourceSettingsPath?: string;
}

export type FedosRecoveryBundleExportResult =
  | { readonly outcome: "exported"; readonly bundleBytes: Uint8Array }
  | { readonly outcome: "seed-unreadable" }
  | { readonly outcome: "account-identity-unresolved" }
  | { readonly outcome: "build-failed"; readonly reason: string };

function readFileIfExists(path: string): Uint8Array | null {
  try {
    if (!existsSync(path)) return null;
    return new Uint8Array(readFileSync(path));
  } catch {
    return null;
  }
}

/**
 * Builds a Recovery Bundle from the currently live, unlocked profile.
 * Never throws — every failure mode is a typed `outcome`. The Identity
 * Part is the source's own `sealedMasterSeedFile` bytes, read verbatim
 * (never re-sealed, never touches a raw Master Seed byte — this
 * coordinator itself never unseals anything). The Data Part is
 * best-effort: every included logical name (Messenger + Commerce +
 * settings, reusing the SAME selection tables the Import Coordinator's
 * own restore path already consumes) whose file exists on disk right now
 * is included; anything absent (never written yet) is simply omitted,
 * never a failure.
 */
export async function exportFedosRecoveryBundle(request: FedosRecoveryBundleExportRequest): Promise<FedosRecoveryBundleExportResult> {
  let sealedMasterSeedEnvelope: string;
  try {
    sealedMasterSeedEnvelope = readFileSync(request.sourcePaths.sealedMasterSeedFile, "utf8");
  } catch {
    return { outcome: "seed-unreadable" };
  }

  const accountPublicKeyHex = await request.resolveAccountPublicKeyHex(request.accountIndex);
  if (accountPublicKeyHex === null || accountPublicKeyHex.length === 0) {
    return { outcome: "account-identity-unresolved" };
  }

  const entries: FedosRecoveryBundleDataPartEntry[] = [];
  for (const [logicalName, filePath] of fedosRecoveryBundleSourcePaths(request.sourcePaths)) {
    const bytes = readFileIfExists(filePath);
    if (bytes !== null) entries.push({ name: logicalName, bytes });
  }
  if (request.sourceCommerceRoot !== undefined) {
    for (const [logicalName, filePath] of fedosRecoveryBundleCommerceSourcePaths(request.sourceCommerceRoot)) {
      const bytes = readFileIfExists(filePath);
      if (bytes !== null) entries.push({ name: logicalName, bytes });
    }
  }
  if (request.sourceSettingsPath !== undefined) {
    const bytes = readFileIfExists(request.sourceSettingsPath);
    if (bytes !== null) entries.push({ name: FEDOS_RECOVERY_BUNDLE_SETTINGS_LOGICAL_NAME, bytes });
  }

  const authority = new FedosRecoveryBundleEncryptionAuthority(request.masterSeedAuthority, request.runtimeBoundary);
  const buildResult = await authority.build({
    sealedMasterSeedEnvelope,
    now: request.now,
    dataPart: { suite: request.suite, accountIndex: request.accountIndex, selfAccountPublicKeyHex: accountPublicKeyHex, entries },
  });
  if (buildResult.outcome !== "built") return { outcome: "build-failed", reason: buildResult.outcome };
  return { outcome: "exported", bundleBytes: serializeFedosRecoveryBundleToBytes(buildResult.bundle) };
}
