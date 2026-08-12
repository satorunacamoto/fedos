/**
 * FedOS Commerce "Real Two-Party Commerce + UX P0/P1 Closure" mega-arc,
 * Agent D — durable, sealed-at-rest custody for a MERCHANT's real
 * `MediaAccessGrant`-signing keypair (`../media_access_grant_sign_verify.ts`).
 *
 * REUSE, NOT REINVENTION: this file adds NO new sealing primitive, NO new
 * at-rest format, and NO new fail-closed discipline — it is the SAME
 * shared foundation (`../../../core/vault/wasm/fedos_sealed_signing_key_store.ts`)
 * two sibling closures already build on:
 * `../../reputation/persistence/durable_persona_epoch_signing_key_store.ts`
 * (Persona Epoch identity) and `../../../trust/issuer/
 * durable_receipt_issuer_signing_key_store.ts` (Receipt-issuer identity).
 * This module is the THIRD, thin, domain-specific translation layer on
 * top — its own `purpose` string, and how to turn sealed bytes into an
 * opaque `MediaAccessGrantSigningKeypair` (== `PersonaEpochSigningKeypair`,
 * reused directly — see `../media_access_grant_sign_verify.ts`'s own
 * header for why that reuse is safe and intentional).
 *
 * WHO IS `subjectId`: the composition root (`fedos_electron_beta_main.cts`)
 * resolves this keypair per CLAIMED real seller pubkey (`order.sellerPubkey`
 * / `product.creatorPubkey`), the SAME "mint-once, seal, reuse" convention
 * `commercePersonaEpochForPubkey()` already established for Reputation.
 *
 * *** IMPORTANT, DISCLOSED LIMITATION — READ BEFORE WIRING A NEW CALLER ***
 * `media_access_grant_policy.ts`'s `evaluateMediaAccessGrant()` requires
 * `envelope.keyId === order.sellerPubkey` LITERALLY (see that file's own
 * header, "WHO IS THE issuer" section in `../media_access_grant_sign_verify.ts`)
 * — unlike Persona Epoch's `commercePersonaEpochForPubkey()`, this is NOT a
 * free, self-issued mapping from the grant-evaluation policy's point of
 * view. A keypair THIS module mints for `subjectId = "aaaa...a"` (a claimed
 * pubkey) has its OWN, freshly-generated, cryptographically unrelated
 * public key — it can NEVER be forced to equal the literal string
 * `subjectId` (that would require solving the discrete log problem). So:
 * grant issuance only succeeds end-to-end when `order.sellerPubkey` is
 * ALREADY a real, keypair-backed pubkey (as every existing
 * `commerce_media_access_grant_*.test.ts` fixture already constructs it —
 * `SELLER = SELLER_KP.publicKeyHex`). For the shipped Commerce demo's
 * fixed, non-cryptographic actor pubkeys (`"a".repeat(64)` etc. —
 * `COMMERCE_DEMO_ACTORS`), no real private key exists ANYWHERE in this
 * system, so a minted grant-signing keypair's public key will legitimately
 * never match `order.sellerPubkey`, and `evaluateMediaAccessGrant()` will
 * correctly, safely reject with `"wrong-signer"` for any grant against
 * those orders. This is a genuine, pre-existing architectural
 * characteristic of the Commerce demo's bare-claim identity model
 * (Product/Order/seller-identity territory), not a bug in this file or a
 * bypass — see this arc's own final report for the full account and why it
 * is disclosed rather than silently worked around.
 */

import type { SealingAuthorityPort } from "../../../core/ports/sealing_authority_port.js";
import {
  DurableSealedSigningKeyStore,
  restoreLatestSealedSigningKey,
  sealAndPersistNewSigningKey,
} from "../../../core/vault/wasm/fedos_sealed_signing_key_store.js";
import { PersonaEpochSigningKeypair } from "../../reputation/persona_epoch_signing_keypair.js";
import type { MediaAccessGrantSigningKeypair } from "../media_access_grant_sign_verify.js";

/** Domain-separates this key custody from every other purpose the shared sealing primitive is reused for. */
export const COMMERCE_MEDIA_GRANT_SIGNING_KEY_PURPOSE = "commerce-media-access-grant-signing-key";
/** Fixed `keyId` — there is exactly one media-grant-signing identity per claimed `subjectId`, no rotation-by-epoch concept needed here (unlike Persona Epoch). */
export const COMMERCE_MEDIA_GRANT_SIGNING_KEY_ID = "media-grant-signer";

/** Same OPTIONAL-methods structural shape every sibling sealed-key closure declares — see `durable_persona_epoch_signing_key_store.ts`'s own identical interface for why both methods are optional. */
export interface MediaGrantSigningKeySealingAuthorityLike {
  sealDirectRatchetSecret?(
    localDeviceRef: string,
    remoteDeviceRef: string,
    conversationId: string,
    generation: number,
    secretBytes: Uint8Array,
  ): Promise<string | null>;
  restoreDirectRatchetSecret?(
    localDeviceRef: string,
    remoteDeviceRef: string,
    conversationId: string,
    generation: number,
    sealedBlob: string,
  ): Promise<Uint8Array | null>;
}

function asSealingAuthorityPort(authority: MediaGrantSigningKeySealingAuthorityLike | null): SealingAuthorityPort | null {
  if (authority === null) return null;
  if (typeof authority.sealDirectRatchetSecret !== "function") return null;
  if (typeof authority.restoreDirectRatchetSecret !== "function") return null;
  return authority as SealingAuthorityPort;
}

function publicKeyHexFromSecretKeyBytes(secretKeyBytes: Uint8Array): string {
  return PersonaEpochSigningKeypair.fromSecretKeyBytes(secretKeyBytes).publicKeyHex;
}

export type MediaGrantSigningKeyResolveResult =
  | { readonly outcome: "restored" | "created"; readonly keypair: MediaAccessGrantSigningKeypair; readonly generation: number }
  | { readonly outcome: "not-found" }
  | { readonly outcome: "sealing-unavailable" }
  | { readonly outcome: "seal-failed" }
  | { readonly outcome: "corrupted"; readonly reason: string };

/**
 * Resolves the durable media-grant-signing keypair for `subjectId` (a
 * CLAIMED real seller pubkey): restores an already-sealed key if one
 * exists; mints+seals a fresh one at generation 0 if none exists yet and
 * `createIfAbsent` is `true`. Never silently mints a replacement for an
 * ALREADY-sealed, but corrupted, identity — see this file's header and
 * every sibling closure's own identical discipline.
 */
export async function resolveCommerceMediaGrantSigningKeypair(
  masterSeedAuthority: MediaGrantSigningKeySealingAuthorityLike | null,
  store: DurableSealedSigningKeyStore,
  subjectId: string,
  createIfAbsent: boolean,
  nowUnixSeconds: number,
): Promise<MediaGrantSigningKeyResolveResult> {
  const authority = asSealingAuthorityPort(masterSeedAuthority);

  const restored = await restoreLatestSealedSigningKey(
    authority,
    store,
    COMMERCE_MEDIA_GRANT_SIGNING_KEY_PURPOSE,
    subjectId,
    publicKeyHexFromSecretKeyBytes,
  );

  if (restored.outcome === "sealing-unavailable") return { outcome: "sealing-unavailable" };
  if (restored.outcome === "corrupted") return { outcome: "corrupted", reason: restored.reason };
  if (restored.outcome === "restored") {
    const keypair = PersonaEpochSigningKeypair.fromSecretKeyBytes(restored.secretKeyBytes.slice());
    restored.secretKeyBytes.fill(0);
    return { outcome: "restored", keypair, generation: restored.generation };
  }

  if (!createIfAbsent) return { outcome: "not-found" };

  const secretKeyBytes = PersonaEpochSigningKeypair.generateSecretKeyBytesForSealedCustody();
  const keypair = PersonaEpochSigningKeypair.fromSecretKeyBytes(secretKeyBytes.slice());
  const sealResult = await sealAndPersistNewSigningKey(
    authority,
    store,
    COMMERCE_MEDIA_GRANT_SIGNING_KEY_PURPOSE,
    subjectId,
    COMMERCE_MEDIA_GRANT_SIGNING_KEY_ID,
    0,
    secretKeyBytes,
    keypair.publicKeyHex,
    nowUnixSeconds,
  );
  secretKeyBytes.fill(0);

  if (sealResult.outcome === "created") return { outcome: "created", keypair, generation: sealResult.generation };
  return sealResult.outcome === "sealing-unavailable" ? { outcome: "sealing-unavailable" } : { outcome: "seal-failed" };
}

export { DurableSealedSigningKeyStore };
