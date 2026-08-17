/**
 * Disaster Recovery / Portable Backup Arc — the Recovery Bundle
 * container. Mirrors `../../device/transfer/fedos_device_transfer_package.ts`'s
 * own "thin binder, zero cryptography of its own" shape: this file only
 * ever moves an already-sealed Master Seed envelope string and an
 * already-sealed Data Part ciphertext around as one addressable,
 * strictly-parsed unit. See
 * `docs/reviews/fedos_disaster_recovery_portable_backup_v1/01_recovery_bundle_format.md`
 * for the full design rationale.
 *
 * `dataCiphertext`/`manifest` are a PAIRED optional — both present (a
 * full bundle) or both `null` (an Identity-only bundle, §4 of that doc:
 * valid, requires no live Master Seed unlock to produce, and restores
 * IDENTITY alone). Never one without the other.
 */

import { isWellFormedSealedMasterSeedEnvelopeV1Json } from "../../../core/vault/wasm/fedos_sealed_master_seed_envelope.js";
import type { AeadCiphertextWire } from "../../../core/vault/wasm/fedos_wasm_loader.js";
import { isWellFormedFedosRecoveryBundleManifestV1, type FedosRecoveryBundleManifestV1 } from "./fedos_recovery_bundle_manifest.js";

export const FEDOS_RECOVERY_BUNDLE_FORMAT_VERSION = 1 as const;
export const FEDOS_RECOVERY_BUNDLE_KIND = "fedos-recovery-bundle" as const;

export interface FedosRecoveryBundleV1 {
  readonly v: 1;
  readonly kind: "fedos-recovery-bundle";
  readonly createdAt: number;
  /** Verbatim `master-seed.sealed.json` contents — Argon2id + AEAD, already portable, never re-wrapped. */
  readonly sealedMasterSeedEnvelope: string;
  readonly dataCiphertext: AeadCiphertextWire | null;
  readonly manifest: FedosRecoveryBundleManifestV1 | null;
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isValidUnixSeconds(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && Number.isInteger(value) && value >= 0;
}

/** Structural validation only — does NOT decrypt or verify either ciphertext. Fails closed; never throws. */
export function isWellFormedFedosRecoveryBundleV1(candidate: unknown): candidate is FedosRecoveryBundleV1 {
  if (typeof candidate !== "object" || candidate === null) return false;
  const value = candidate as Record<string, unknown>;
  if (Object.keys(value).length !== 6) return false;
  if (value.v !== FEDOS_RECOVERY_BUNDLE_FORMAT_VERSION) return false;
  if (value.kind !== FEDOS_RECOVERY_BUNDLE_KIND) return false;
  if (!isValidUnixSeconds(value.createdAt)) return false;
  if (!isWellFormedSealedMasterSeedEnvelopeV1Json(value.sealedMasterSeedEnvelope)) return false;

  const hasDataPart = value.dataCiphertext !== null;
  const hasManifest = value.manifest !== null;
  if (hasDataPart !== hasManifest) return false; // paired optional -- never one without the other
  if (hasDataPart) {
    if (!isNonEmptyString(value.dataCiphertext)) return false;
    if (!isWellFormedFedosRecoveryBundleManifestV1(value.manifest)) return false;
  }
  return true;
}

/** Deterministic JSON encoding — a Recovery Bundle is a whole-file, at-rest-storable unit the operator chooses a destination path for. */
export function serializeFedosRecoveryBundleToBytes(bundle: FedosRecoveryBundleV1): Uint8Array {
  return new TextEncoder().encode(JSON.stringify(bundle));
}

/** `null` on ANY malformed input — unparseable JSON, wrong shape, unknown/missing/extra field at any level. Never throws. */
export function deserializeFedosRecoveryBundleFromBytes(bytes: Uint8Array): FedosRecoveryBundleV1 | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(new TextDecoder().decode(bytes));
  } catch {
    return null;
  }
  if (!isWellFormedFedosRecoveryBundleV1(parsed)) return null;
  return Object.freeze({ ...parsed });
}
