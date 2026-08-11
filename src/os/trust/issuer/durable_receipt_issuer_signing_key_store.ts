/**
 * FedOS Commerce FINAL P1 Closure (Agent K2) — durable sealed-at-rest
 * custody for the demo Commerce Receipt-issuer signing keypair
 * (`commerceReceiptSigningState()`,
 * `packages/fedos-desktop-electron-spike/src/fedos_electron_beta_main.cts`).
 *
 * WHAT THIS CLOSES: before this file, `commerceReceiptSigningState()`
 * generated a fresh, in-memory-only `FedosTrustSigningKeypair` (and its
 * matching single-issuer `FedosTrustPolicy`) EVERY process launch — both
 * regenerated together, in lockstep, so a receipt signed before a restart
 * could never verify against the policy built after one. This module makes
 * that ONE demo issuer identity (`COMMERCE_RECEIPT_ISSUER_ID`, there is only
 * ever one in this demo scope, unlike Persona Epoch's per-real-pubkey
 * identities) durable across restart by sealing it at rest.
 *
 * REUSE, NOT REINVENTION: this is a thin, domain-specific wiring layer over
 * the ALREADY-BUILT shared foundation,
 * `../../core/vault/wasm/fedos_sealed_signing_key_store.ts` — read that
 * file's own header first for the full sealing/at-rest-format/fail-closed
 * design rationale (this module invents none of it). The sibling closure,
 * `src/os/commerce/reputation/persistence/durable_persona_epoch_signing_key_store.ts`,
 * is the SAME pattern applied to the Persona Epoch key — the two are
 * independent (different `purpose`/`subjectId` namespace, never
 * cross-imported) but share the one underlying sealed-store primitive.
 *
 * DISTINCT FROM THE OFFLINE ISSUER CLI PATH: `fedos_trust_issuer_secret_
 * provider.ts` in this SAME directory loads an OPERATOR-SUPPLIED key from a
 * file path named by an env var, for the offline issuer CLI
 * (`fedos_trust_issuer_cli_core.ts`) — a completely different secret-loading
 * boundary for a completely different caller. This module is the ADDITIVE,
 * different path the live demo Electron app uses instead: a
 * CALLER-GENERATED, sealed-at-rest key, resolved through the Master Seed
 * Authority's own sealing primitive, never a file path from an env var,
 * never touched by the offline CLI. Do not conflate the two.
 *
 * KEY ORIGIN DECISION: the key stays CSPRNG-random and is sealed at rest —
 * it is NEVER deterministically derived from the Master Seed. This is the
 * exact same decision `fedos_sealed_signing_key_store.ts`'s own "KEY ORIGIN
 * DECISION" header section documents (which itself cites
 * `persona_epoch_signing_keypair.ts`'s header: "NEVER derived from a Master
 * Seed, Nostr identity key, or Double Ratchet chain key") — restated here by
 * the same reasoning, not re-derived from scratch: deterministic derivation
 * would make this sealed key silently re-derivable by anyone who ever
 * recovers the Master Seed alone (e.g. a backup restored to a different
 * device), which is a strictly worse, unbounded cross-device-linkability /
 * blast-radius property than sealing a genuinely independent random key
 * bound to ONE profile's ONE local sealed-storage file. Restart-durability
 * comes from SEALING the random key at rest, not from making it re-derivable.
 *
 * CROSS-DEVICE SCOPE: local-device-only, no sync of any kind — true by
 * construction (the sealed record lives in one local NDJSON file); a second
 * device profile mints and seals its own independent issuer key.
 *
 * RENDERER BOUNDARY: this module only ever moves opaque sealed-blob strings
 * and raw secret bytes between the main-process `SealingAuthorityPort` and a
 * main-process-only file, wrapping the result in the OPAQUE
 * `FedosTrustSigningKeypair` handle before returning it. It adds no IPC
 * surface of its own; the raw key never leaves the main process. Must never
 * be imported by renderer code.
 *
 * SECRET-BYTES-ALIASING NOTE (read before touching this file): unlike some
 * key classes, `FedosTrustSigningKeypair.fromSecretKeyBytes()` stores the
 * EXACT `Uint8Array` reference it is given (no internal copy) — it is the
 * class's own private secret field from that point on. Zeroing a
 * `Uint8Array` AFTER handing it to `fromSecretKeyBytes()` would therefore
 * zero the live keypair's own secret, not just a transient buffer. Every
 * call site below that needs to zero a raw secret buffer it does not intend
 * to keep passes a `.slice()` COPY into `fromSecretKeyBytes()` and zeroes
 * the ORIGINAL array afterward — the keypair keeps its own independent
 * backing buffer, and no raw secret byte outlives this function's own
 * stack frame beyond the opaque class itself.
 */

import { FedosTrustSigningKeypair } from "../envelope/fedos_trust_signing_keypair.js";
import {
  DurableSealedSigningKeyStore,
  restoreLatestSealedSigningKey,
  sealAndPersistNewSigningKey,
} from "../../core/vault/wasm/fedos_sealed_signing_key_store.js";
import type { SealingAuthorityPort } from "../../core/ports/sealing_authority_port.js";

/** Re-exported so callers (e.g. the Electron main composition root) need only this one module's surface to construct + resolve the durable store, without a second direct import of the shared foundation. */
export { DurableSealedSigningKeyStore };

/** Domain-separates this purpose from every other sealed-signing-key subject in the shared store (e.g. Persona Epoch's own, distinct `purpose`). */
export const COMMERCE_RECEIPT_ISSUER_SIGNING_KEY_PURPOSE = "commerce-receipt-issuer-signing-key";

/** Fixed, stable `keyId` — there is only ONE receipt-issuer identity in this demo scope (unlike Persona Epoch's per-pubkey `epochId`), so no per-subject key-id derivation is needed. */
export const COMMERCE_RECEIPT_ISSUER_KEY_ID = "receipt-issuer";

export type ResolveReceiptIssuerSigningKeypairOutcome =
  | { readonly outcome: "restored"; readonly keypair: FedosTrustSigningKeypair; readonly generation: number }
  | { readonly outcome: "created"; readonly keypair: FedosTrustSigningKeypair; readonly generation: number }
  | { readonly outcome: "sealing-unavailable" }
  | { readonly outcome: "corrupted"; readonly reason: string };

/**
 * Resolves the durable Receipt-issuer signing keypair for `issuerId`:
 *   1. Tries to restore the latest sealed record for `issuerId` from
 *      `store` via the shared foundation's `restoreLatestSealedSigningKey`.
 *   2. `"restored"` — wraps the restored secret bytes in a fresh
 *      `FedosTrustSigningKeypair` (via a copy, see this file's own
 *      "SECRET-BYTES-ALIASING NOTE" above) and returns it, SAME
 *      `publicKeyHex` as every prior restore/creation for this `issuerId`.
 *   3. `"not-found"` (ordinary first-use) — mints a FRESH, independent,
 *      CSPRNG-random secret via
 *      `FedosTrustSigningKeypair.generateSecretKeyBytesForSealedCustody()`
 *      (never derived from the Master Seed — see this file's own "KEY
 *      ORIGIN DECISION" header), seals + persists it at generation 0, and
 *      returns `"created"`.
 *   4. `"sealing-unavailable"` (no unlocked/sealing-capable Master Seed
 *      Authority) — propagated as-is; the CALLER (`commerceReceiptSigningState()`
 *      in the Electron main process) decides the graceful in-memory-only
 *      fallback, this module never falls back to an unsealed key itself.
 *   5. `"corrupted"` (tampered ciphertext / wrong Master Seed binding /
 *      malformed restored key material, OR a failure while sealing a
 *      brand-new key) — propagated/produced as-is; NEVER silently mints a
 *      replacement issuer identity in this case — a caller seeing
 *      `"corrupted"` must surface it explicitly, never pretend continuity.
 */
export async function resolveReceiptIssuerSigningKeypair(
  masterSeedAuthority: SealingAuthorityPort | null,
  store: DurableSealedSigningKeyStore,
  issuerId: string,
): Promise<ResolveReceiptIssuerSigningKeypairOutcome> {
  const restoreResult = await restoreLatestSealedSigningKey(
    masterSeedAuthority,
    store,
    COMMERCE_RECEIPT_ISSUER_SIGNING_KEY_PURPOSE,
    issuerId,
    (secretKeyBytes) => FedosTrustSigningKeypair.fromSecretKeyBytes(secretKeyBytes).publicKeyHex,
  );

  if (restoreResult.outcome === "sealing-unavailable") return { outcome: "sealing-unavailable" };
  if (restoreResult.outcome === "corrupted") return { outcome: "corrupted", reason: restoreResult.reason };

  if (restoreResult.outcome === "restored") {
    const keypair = FedosTrustSigningKeypair.fromSecretKeyBytes(restoreResult.secretKeyBytes.slice());
    restoreResult.secretKeyBytes.fill(0);
    return { outcome: "restored", keypair, generation: restoreResult.generation };
  }

  // "not-found" — ordinary first-use state: mint + seal a fresh key at
  // generation 0. This module never silently mints a replacement for an
  // ALREADY-sealed identity (that is exactly the "restored"/"corrupted"
  // branches above); this branch only ever runs the very first time
  // `issuerId` is ever resolved for `store`.
  const secretKeyBytes = FedosTrustSigningKeypair.generateSecretKeyBytesForSealedCustody();
  const keypair = FedosTrustSigningKeypair.fromSecretKeyBytes(secretKeyBytes.slice());
  const publicKeyHex = keypair.publicKeyHex;
  const nowUnixSeconds = Math.floor(Date.now() / 1000);
  const sealResult = await sealAndPersistNewSigningKey(
    masterSeedAuthority,
    store,
    COMMERCE_RECEIPT_ISSUER_SIGNING_KEY_PURPOSE,
    issuerId,
    COMMERCE_RECEIPT_ISSUER_KEY_ID,
    0,
    secretKeyBytes,
    publicKeyHex,
    nowUnixSeconds,
  );
  secretKeyBytes.fill(0);

  if (sealResult.outcome === "sealing-unavailable") return { outcome: "sealing-unavailable" };
  if (sealResult.outcome === "seal-failed") {
    return {
      outcome: "corrupted",
      reason: `receipt issuer signing key (subject "${issuerId}") was minted but failed to seal at rest — refusing to hand back an unpersisted identity as if it were durable.`,
    };
  }
  return { outcome: "created", keypair, generation: sealResult.generation };
}
