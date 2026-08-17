/**
 * Disaster Recovery / Portable Backup Arc — Lineage Reconciliation
 * follow-up. `fedos_recovery_bundle_profile_selection.ts` is entirely
 * keyed off `FedosLocalProfilePaths` — but two real, durable asset
 * categories live OUTSIDE that type entirely: Commerce (its own
 * dynamically-named files under `<profile-root>/commerce/*.ndjson`, never
 * enumerated as `FedosLocalProfilePaths` fields at all) and
 * `settings.json` (a SIBLING of the profile root, not nested inside it —
 * `settingsFilePath()` in `fedos_electron_beta_main.cts` resolves to
 * `<dataRoot>/settings.json`, one level above `dataDir()`'s own
 * `<dataRoot>/profile`). This is a SEPARATE, additive selection module
 * rather than an extension of `FedosLocalProfilePaths` itself, so that
 * type's own established, widely-consumed shape is never touched by this
 * Arc — the two module's entries are simply merged into one
 * `FedosRecoveryBundleDataPartEntry[]` list by the caller (build) /
 * resolved by the caller (restore); neither the Data Part codec, the
 * Encryption Authority, nor the container format needed any change.
 *
 * COMMERCE SIGNING-KEY FILES (`media_grant_signing_keys`,
 * `persona_epoch_signing_keys`, `receipt_issuer_signing_keys`) are
 * DELIBERATELY EXCLUDED here, even though direct source verification this
 * pass found they are sealed via `masterSeedAuthority.sealDirectRatchetSecret(
 * purpose, subjectId, keyId, generation, ...)` with NO `localDeviceRef`/
 * `remoteDeviceRef` in the tuple (`durable_media_grant_signing_key_store.ts`,
 * `durable_persona_epoch_signing_key_store.ts` — both confirmed;
 * `durable_receipt_issuer_signing_key_store.ts` assumed to follow the same
 * established "sibling sealed-key closure" convention, NOT independently
 * re-verified this pass) — meaning they are almost certainly Master-Seed-
 * derived and portable, UNLIKE Direct Ratchet's genuinely device-bound
 * secrets. This is flagged here as a real INCLUDE candidate for a future
 * pass, not decided unilaterally by a time-boxed fork: shipping actual
 * sealed private key material in a backup mechanism deserves a real
 * security sign-off, not a rushed inclusion. `media_release_content` is
 * ALSO excluded — the actual protected media bytes, potentially large
 * binary blobs, a bundle-size/practicality question distinct from
 * correctness, also deferred.
 */

import { join } from "node:path";

/** Logical Data Part entry name -> Commerce's own basename (`commerceDurableFilePath(name)` in `fedos_electron_beta_main.cts` = `<commerceRoot>/<name>.ndjson`). Every entry here is a plain append-only record/event log — NOT a signing-key store, NOT raw content bytes — same shape as the already-included Messenger logs (conversation/board/etc.), portable by construction. */
export const FEDOS_RECOVERY_BUNDLE_INCLUDED_COMMERCE_LOGS: ReadonlyMap<string, string> = new Map([
  ["commerce-products", "products"],
  ["commerce-orders", "orders"],
  ["commerce-receipts", "receipts"],
  ["commerce-deliveries", "deliveries"],
  ["commerce-trade-attestations", "trade_attestations"],
  ["commerce-persona-epochs", "persona_epochs"],
  // Self-discovered gap, closed during the IPC-wiring pass: verified via
  // `durable_payment_settlement_ledger.ts`'s own header ("WHAT IS
  // PERSISTED, AND WHY IT IS SAFE") -- the AUTHORITATIVE settlement
  // record (paymentId/orderId/productId/status/timestamps/history), NEVER
  // a raw provider callback payload or a provider secret/API key. Same
  // evidence-record shape as orders/receipts/deliveries above, not a
  // signing-key store -- belongs in this list, not the exclusion list.
  ["commerce-payment-settlements", "payment_settlements"],
  ["commerce-media-access-grants", "media_access_grants"],
  ["commerce-media-release-issuance", "media_release_issuance"],
  ["commerce-media-index", "media_index"],
  ["commerce-product-media", "product_media"],
]);

/** Named, NEVER included this pass — see this file's own header for the exact reasoning per name. */
export const FEDOS_RECOVERY_BUNDLE_EXCLUDED_COMMERCE_BASENAMES: readonly string[] = [
  "media_grant_signing_keys", // master-seed-derived, NOT device-bound (verified) -- INCLUDE candidate, deferred pending security sign-off, not a hard exclusion like Direct Ratchet
  "persona_epoch_signing_keys", // same as above (verified)
  "receipt_issuer_signing_keys", // same pattern assumed, NOT independently re-verified this pass
  "media_release_content", // potentially large raw protected-content bytes -- bundle-size/practicality question, deferred
];

/** The one settings-side logical name. `settings.json` lives at `<dataRoot>/settings.json`, a SIBLING of the profile root passed to `planFedosLocalProfilePaths()`, never nested inside it. */
export const FEDOS_RECOVERY_BUNDLE_SETTINGS_LOGICAL_NAME = "app-settings";

export function fedosRecoveryBundleCommerceSourcePaths(commerceRoot: string): ReadonlyMap<string, string> {
  const out = new Map<string, string>();
  for (const [logicalName, basename] of FEDOS_RECOVERY_BUNDLE_INCLUDED_COMMERCE_LOGS) {
    out.set(logicalName, join(commerceRoot, `${basename}.ndjson`));
  }
  return out;
}

/** `null` for an unrecognized name -- restore must never write an arbitrary caller-supplied name to disk, same discipline as `fedosRecoveryBundleDestinationPathFor()`. */
export function fedosRecoveryBundleCommerceDestinationPathFor(logicalName: string, targetCommerceRoot: string): string | null {
  const basename = FEDOS_RECOVERY_BUNDLE_INCLUDED_COMMERCE_LOGS.get(logicalName);
  if (basename === undefined) return null;
  return join(targetCommerceRoot, `${basename}.ndjson`);
}
