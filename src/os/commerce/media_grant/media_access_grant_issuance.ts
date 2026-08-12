/**
 * FedOS Commerce "Real Two-Party Commerce + UX P0/P1 Closure" mega-arc,
 * Agent D — merchant-side ISSUANCE orchestration for `MediaAccessGrant`
 * (arc §35-37). This is the production caller `../../../../docs/commerce/
 * COMMERCE-E2E-COMPLETION-FINAL-REPORT.md` disclosed as missing: "a
 * complete, tested, signed protected-media entitlement system exists with
 * ZERO production callers."
 *
 * PURE ORCHESTRATION, testable in isolation: this file imports only
 * already-real, already-tested domain functions
 * (`./media_access_grant_policy.js`'s `isQualifyingOrderStatusForMediaAccess`,
 * `./media_access_grant_sign_verify.js`'s `signMediaAccessGrant`) — it
 * performs no I/O, no persistence, no key sealing itself (the caller,
 * `fedos_electron_beta_main.cts`, resolves the signing keypair via
 * `./persistence/durable_media_grant_signing_key_store.js` and passes it
 * in already-resolved, mirroring `wrapMediaAccessGrantRelease`'s own
 * "caller resolves references, this function only judges/acts on them"
 * discipline).
 *
 * THE BYPASS THIS FUNCTION REFUSES, STRUCTURALLY (arc §37): a grant is
 * issued ONLY when (a) `order.status` is qualifying
 * (`isQualifyingOrderStatusForMediaAccess`) — never for a bare
 * Order-creation or Product-Detail-access alone — and (b) the resolved
 * signing keypair's OWN public key equals `order.sellerPubkey` LITERALLY
 * — never a self-issued/free mapping (see
 * `./persistence/durable_media_grant_signing_key_store.ts`'s own header
 * for the full account of why this second check is a REAL, sometimes
 * unsatisfiable, gate — not a formality). There is no parameter on this
 * function that lets a caller skip either check.
 */

import { isQualifyingOrderStatusForMediaAccess } from "./media_access_grant_policy.js";
import { signMediaAccessGrant, type MediaAccessGrantSigningKeypair } from "./media_access_grant_sign_verify.js";
import { mediaAccessGrantKey, type MediaAccessGrantEnvelope, type MediaAccessGrantPayload } from "./media_access_grant_types.js";

/** Structural mirror of the real `Order` shape (`../order/order_types.js`) — only the fields this function actually reads, matching this codebase's own "structural, not imported" convention at composition-root boundaries. */
export interface IssueMediaAccessGrantsForOrderOrderLike {
  readonly id: string;
  readonly productId: string;
  readonly buyerPubkey: string;
  readonly sellerPubkey: string;
  readonly status: string;
}

/** Structural mirror of the real `ProductMedia` shape (`../catalog/product_media_types.js`) — only the fields this function actually reads. */
export interface IssueMediaAccessGrantsForOrderMediaLike {
  readonly id: string;
  readonly productId: string;
  readonly classification: "public" | "protected";
}

export interface IssueMediaAccessGrantsForOrderInput {
  readonly order: IssueMediaAccessGrantsForOrderOrderLike;
  /** Every `ProductMedia` record belonging to `order.productId` — this function filters to `classification === "protected"` itself; passing public media is harmless (they are simply skipped, never granted — public media needs no grant). */
  readonly candidateMedia: readonly IssueMediaAccessGrantsForOrderMediaLike[];
  /** The seller's REAL, resolved media-grant-signing keypair (see this file's own header for why its public key must equal `order.sellerPubkey` for issuance to actually succeed). */
  readonly sellerSigningKeypair: MediaAccessGrantSigningKeypair;
  /** The highest `grantVersion` already durably seen for `(mediaId, order.buyerPubkey, order.id)`, if any — `0` for "never granted before". Callers get this from `latestGrantVersion()` (`./media_access_grant_persistence.js`) over their own already-loaded persistence. */
  readonly latestKnownGrantVersionFor: (mediaId: string) => number;
  readonly now: number;
}

export type IssueMediaAccessGrantsForOrderOutcome =
  /** At least one protected media item existed for this product, the Order qualifies, and the signer is grant-capable — `envelopes` holds one freshly-signed envelope per protected media item. */
  | { readonly outcome: "issued"; readonly envelopes: readonly MediaAccessGrantEnvelope[] }
  /** No protected media exists for this product at all — nothing to grant; not an error. */
  | { readonly outcome: "no-protected-media" }
  /** `order.status` is not one of `isQualifyingOrderStatusForMediaAccess()`'s allowed statuses — refused, never issued early. */
  | { readonly outcome: "order-not-qualifying" }
  /**
   * The resolved signing keypair's public key does NOT equal
   * `order.sellerPubkey` — the seller identity this process could resolve
   * a real key for is not (yet) cryptographically capable of proving it
   * is really this Order's own seller. See this file's own header —
   * this is the disclosed, structural limitation for the shipped Commerce
   * demo's fixed, non-cryptographic actor pubkeys.
   */
  | { readonly outcome: "seller-not-grant-capable" };

/**
 * Issues one `MediaAccessGrant` (grantVersion = previous known + 1, never
 * `revoked`, `validFrom = now`, no expiry) per protected `ProductMedia`
 * item belonging to `input.order.productId`, addressed to
 * `input.order.buyerPubkey`. Never persists anything itself — the caller
 * (composition root) is responsible for durably storing every returned
 * envelope via `AppendOnlyMediaAccessGrantPersistence.putGrant()`.
 */
export function issueMediaAccessGrantsForOrder(input: IssueMediaAccessGrantsForOrderInput): IssueMediaAccessGrantsForOrderOutcome {
  const protectedMedia = input.candidateMedia.filter(
    (media) => media.productId === input.order.productId && media.classification === "protected",
  );
  if (protectedMedia.length === 0) return { outcome: "no-protected-media" };

  if (!isQualifyingOrderStatusForMediaAccess(input.order.status as never)) {
    return { outcome: "order-not-qualifying" };
  }

  if (input.sellerSigningKeypair.publicKeyHex !== input.order.sellerPubkey) {
    return { outcome: "seller-not-grant-capable" };
  }

  const envelopes: MediaAccessGrantEnvelope[] = protectedMedia.map((media) => {
    const grantVersion = input.latestKnownGrantVersionFor(media.id) + 1;
    const payload: MediaAccessGrantPayload = {
      formatVersion: 1,
      mediaId: media.id,
      productId: media.productId,
      buyerPubkey: input.order.buyerPubkey,
      orderId: input.order.id,
      issuerPubkey: input.sellerSigningKeypair.publicKeyHex,
      grantVersion,
      revoked: false,
      validFrom: input.now,
      validUntil: null,
      issuedAt: input.now,
    };
    return signMediaAccessGrant(payload, input.sellerSigningKeypair, {
      issuer: input.sellerSigningKeypair.publicKeyHex,
      issuedAt: input.now,
    });
  });

  return { outcome: "issued", envelopes };
}

// Re-exported purely so `mediaAccessGrantKey()` remains reachable from this
// one orchestration module without a second import path — used by callers
// building `latestKnownGrantVersionFor` over a persistence store.
export { mediaAccessGrantKey };
