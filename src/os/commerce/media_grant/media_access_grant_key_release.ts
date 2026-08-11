/**
 * Commerce Durability + Protected-Media Entitlement + Packaged-E2E FINAL
 * Closure arc (Agent G) — grant-gated RELEASE: the mechanism that turns an
 * `evaluateMediaAccessGrant()` ALLOW decision into something the
 * authorized buyer's own device can actually use, without ever handing out
 * the profile-wide `CommerceMedia` key this arc's own brief identifies as
 * the root problem (`../catalog/product_media_encryption.ts`).
 *
 * ============================================================
 * WHAT THIS FILE DOES, AND — IMPORTANT — WHAT IT HONESTLY DOES NOT
 * ============================================================
 * The arc brief's ideal KEY MODEL is: a per-media symmetric content key,
 * media encrypted with it, and ONLY that key wrapped for the buyer via the
 * existing counterparty-encryption primitive. This file investigated that
 * literally and found it is NOT achievable today without inventing new
 * Rust/WASM crypto surface — reported here explicitly rather than forced
 * through, per this arc's own instruction:
 *
 *   - The ONLY primitive that actually decrypts a `CommerceMedia`-domain
 *     ciphertext blob (`../catalog/wasm_product_media_decryption.ts`) is
 *     `decrypt(key: AeadKeyHandle, ...)`
 *     (`../../core/vault/wasm/fedos_runtime_decrypt.ts`), and `key` MUST be
 *     an OPAQUE `AeadKeyHandle` resolved by
 *     `FedosMasterSeedAuthority.resolveCommerceMediaKey()`. There is no
 *     "construct an `AeadKeyHandle` from raw bytes I generated" entry
 *     point anywhere in this codebase —
 *     `../../core/vault/wasm/fedos_runtime_encrypt.ts`'s own header states
 *     this as a HARD GUARDRAIL for its sibling `encrypt()`: "There is no
 *     code path anywhere in this file that constructs a key from bytes,
 *     and no fallback that accepts one." A JS-generated random "per-media
 *     content key" therefore CANNOT be fed back into the Rust AEAD
 *     boundary to decrypt the SAME `CommerceMedia` ciphertext on a
 *     different device — it would be cryptographically inert for that
 *     purpose, a plausible-looking but non-functional artifact. Building
 *     one that worked would require a NEW Rust/WASM export accepting raw
 *     key bytes (or a raw-key-import boundary) — a cross-cutting change to
 *     `packages/fedos-core-rust/` requiring a rebuilt WASM artifact,
 *     exactly the kind of change this arc's own brief says to STOP and
 *     report rather than force through from a TypeScript-only pass.
 *   - No pure-JS cipher is an approved dependency of this repository
 *     (`../catalog/product_media_encryption.ts`'s own header re-confirms
 *     this), and `crypto.subtle`/WebCrypto is explicitly rejected there as
 *     "standing up a SECOND, unreviewed encryption code path" — so this
 *     file does not hand-roll one either.
 *
 * WHAT IS SAFELY, GENERICALLY REUSABLE: `FedosMasterSeedAuthority.
 * encryptNip44Wire()`/`decryptNip44Wire()` (`../../core/vault/wasm/fedos_master_seed_authority.ts`)
 * — VERIFIED by direct inspection of its real callers
 * (`../../messenger/adapters/nostr/conversation_delivery/nip17/fedos_nip59_seal.ts`)
 * to operate on an arbitrary `Uint8Array` plaintext (there: a Rumor's JSON
 * serialization; nothing about the method signature or its Rust
 * implementation is text-specific), producing a NIP-44 v2 wire ciphertext
 * ECDH-bound to one specific `(accountIndex, counterpartyPublicKeyHex)`
 * pair. This IS the "wrap opaque bytes for exactly one counterparty"
 * primitive the arc brief asked to investigate, and `os/commerce` is
 * architecturally ALLOWED to import it directly
 * (`../../core/vault/wasm/` is not in `test/architecture_boundary_commerce.test.ts`'s
 * `FORBIDDEN_PREFIXES`) without ever touching `os/messenger`.
 *
 * THE HONEST SUBSTITUTION THIS FILE MAKES: since no independently portable
 * "content key" can be constructed (see above), `wrapMediaAccessGrantRelease()`
 * below wraps a CALLER-SUPPLIED `releasePayload: Uint8Array` directly —
 * in practice, the ACTUAL decrypted plaintext bytes the merchant's own
 * authority already legitimately obtained via `WasmProductMediaDecryption`
 * (`../catalog/wasm_product_media_decryption.ts`), re-encrypted end-to-end
 * for the ONE grant-authorized buyer. This is NOT "wrap a small standalone
 * key the buyer's device combines with the existing ciphertext" — it is
 * "grant-gated, buyer-specific re-encryption of the release payload
 * itself," which functionally delivers the same security property this
 * arc's brief asked for (only a validly-granted buyer can ever obtain
 * usable plaintext through this path, and a revoked/expired/wrong-buyer/
 * wrong-media grant is refused before `encryptNip44Wire` is ever called)
 * using ONLY already-reviewed primitives. `MAX_MEDIA_ACCESS_GRANT_RELEASE_PAYLOAD_BYTES`
 * below bounds this to small releases (samples, thumbnails, small
 * documents) — large protected media (e.g. full video files) are OUT OF
 * SCOPE for this specific channel and this file refuses (`"payload-too-large"`)
 * rather than silently truncating or misusing NIP-44 outside its practical
 * size envelope. A genuine per-media symmetric key that scales to large
 * media remains the concrete, named follow-up (new WASM primitive), not
 * something this file pretends to already provide.
 *
 * REVOCATION SCOPE, restated: a successful release here can only ever be
 * PREVENTED going forward (a revoked/expired grant makes the NEXT call to
 * this function fail). It can never retract a release already handed out —
 * see `./media_access_grant_types.ts`'s own header.
 */

import type { FedosMasterSeedAuthority } from "../../core/vault/wasm/fedos_master_seed_authority.js";
import {
  evaluateMediaAccessGrant,
  type EvaluateMediaAccessGrantInput,
  type MediaAccessDenialReason,
} from "./media_access_grant_policy.js";
import type { MediaAccessGrantPayload } from "./media_access_grant_types.js";

/**
 * Conservative, explicitly-enforced bound on what this ECDH-wrap channel
 * will release in one call — see this file's own header ("THE HONEST
 * SUBSTITUTION") for why this is a real, disclosed limitation and not an
 * arbitrary tuning knob.
 */
export const MAX_MEDIA_ACCESS_GRANT_RELEASE_PAYLOAD_BYTES = 65_536;

export interface WrapMediaAccessGrantReleaseInput extends EvaluateMediaAccessGrantInput {
  /** The MERCHANT's own local account index — the wrap is ECDH-bound to `(merchantAccountIndex, decision.grant.buyerPubkey)`. */
  readonly merchantAccountIndex: number;
  /** The bytes to release to the buyer once the grant evaluates ALLOW — see this file's own header for what this realistically is today. Must be non-empty and no larger than `MAX_MEDIA_ACCESS_GRANT_RELEASE_PAYLOAD_BYTES`. */
  readonly releasePayload: Uint8Array;
  /** The MERCHANT's own, already-unlocked `FedosMasterSeedAuthority` — NEVER constructed fresh by this function (this file never touches a Master Seed directly; it only calls methods on an authority the caller already holds, mirroring `WasmProductMediaEncryption`'s own composition-root discipline). */
  readonly authority: FedosMasterSeedAuthority;
}

export type WrapMediaAccessGrantReleaseResult =
  | { readonly outcome: "released"; readonly wireCiphertext: string; readonly grant: MediaAccessGrantPayload }
  | { readonly outcome: "denied"; readonly reason: MediaAccessDenialReason; readonly detail?: string }
  | { readonly outcome: "payload-too-large" }
  | { readonly outcome: "wrap-unavailable" };

/**
 * Evaluates the candidate grant (`evaluateMediaAccessGrant()`, this file's
 * own imported policy layer — the ONE gate every release must pass) and,
 * ONLY on `allowed: true`, wraps `releasePayload` via
 * `authority.encryptNip44Wire(merchantAccountIndex, grant.buyerPubkey,
 * releasePayload)`. Fails closed on every other path: a denied grant never
 * reaches the wrap call at all (`encryptNip44Wire` is not even invoked),
 * an oversized/empty payload is rejected before any crypto call, and a
 * missing/`null`/throwing `encryptNip44Wire` resolves `"wrap-unavailable"`
 * — mirroring `UnavailableProductMediaEncryption`'s own "never lies about
 * success" discipline. Never throws.
 */
export async function wrapMediaAccessGrantRelease(
  input: WrapMediaAccessGrantReleaseInput,
): Promise<WrapMediaAccessGrantReleaseResult> {
  const decision = evaluateMediaAccessGrant(input);
  if (!decision.allowed) {
    return { outcome: "denied", reason: decision.reason, detail: decision.detail };
  }
  if (input.releasePayload.length === 0 || input.releasePayload.length > MAX_MEDIA_ACCESS_GRANT_RELEASE_PAYLOAD_BYTES) {
    return { outcome: "payload-too-large" };
  }
  try {
    if (typeof input.authority.encryptNip44Wire !== "function") return { outcome: "wrap-unavailable" };
    const wire = await input.authority.encryptNip44Wire(
      input.merchantAccountIndex,
      decision.grant.buyerPubkey,
      input.releasePayload,
    );
    if (wire === null) return { outcome: "wrap-unavailable" };
    return { outcome: "released", wireCiphertext: wire, grant: decision.grant };
  } catch {
    return { outcome: "wrap-unavailable" };
  }
}

export interface UnwrapMediaAccessGrantReleaseInput {
  /** The BUYER's own local account index. */
  readonly buyerAccountIndex: number;
  /** The merchant's pubkey the buyer expects this release to have come from — a real caller passes `order.sellerPubkey` here, which the buyer already independently trusts as this Order's seller (this function performs no Order lookup of its own; it is a pure crypto operation, mirroring `openFedosNip59Seal()`'s own scope). */
  readonly merchantPubkeyHex: string;
  readonly wireCiphertext: string;
  /** The BUYER's own, already-unlocked `FedosMasterSeedAuthority` — a DIFFERENT instance than the merchant's own, on a different device/profile. */
  readonly authority: FedosMasterSeedAuthority;
}

/**
 * The buyer-side counterpart: unwraps a release produced by
 * `wrapMediaAccessGrantRelease()`. `null` on ANY failure — missing/absent
 * `decryptNip44Wire`, wrong account/counterparty pairing (ECDH mismatch —
 * "wrong media key" in effect, since a release wrapped for one buyer can
 * never be unwrapped by another), a tampered `wireCiphertext`, or any
 * thrown error. Never throws, never returns a partial/best-effort
 * plaintext.
 */
export async function unwrapMediaAccessGrantRelease(
  input: UnwrapMediaAccessGrantReleaseInput,
): Promise<Uint8Array | null> {
  try {
    if (typeof input.authority.decryptNip44Wire !== "function") return null;
    return await input.authority.decryptNip44Wire(input.buyerAccountIndex, input.merchantPubkeyHex, input.wireCiphertext);
  } catch {
    return null;
  }
}
