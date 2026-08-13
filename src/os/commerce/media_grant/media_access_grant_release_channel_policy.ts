/**
 * BUYER DISCOVERY + DIGITAL CONTENT DELIVERY mega-arc (Agent A) — pure
 * decision layer for the private-media-release request/response channel
 * (`../events/commerce_private_media_release_sync.ts`,
 * `../catalog/adapters/nostr/commerce_private_media_release_bridge.ts`).
 * Three independent, individually-testable decisions live here, each
 * mirroring an established discipline elsewhere in this codebase rather
 * than inventing a new one:
 *
 * 1. `evaluateInboundMediaReleaseRequestAuthorization()` — the SELLER-side
 *    pre-check on an inbound request, BEFORE `evaluateMediaAccessGrant()`
 *    (`./media_access_grant_policy.ts`) is ever consulted. Mirrors
 *    `commerce_private_delivery_apply.ts`'s own "defense in depth, re-check
 *    the REAL verified sender against the claim, never trust a decrypted
 *    payload field alone" posture: `senderPubkeyHex` here is always the
 *    cryptographically verified outer-event signer, never a claim read out
 *    of the payload body. This is the concrete mechanism behind this arc's
 *    own mandate item 3 ("wrong buyer... must be REJECTED") at the
 *    REQUEST layer — `evaluateMediaAccessGrant()` independently enforces
 *    the same thing again at the GRANT layer, so a bug in one check alone
 *    still fails closed.
 *
 * 2. `evaluateInboundMediaReleaseResponseAuthorization()` — the BUYER-side
 *    pre-check on an inbound response, before ever calling
 *    `unwrapMediaAccessGrantRelease()`. A seller's process can send
 *    whatever `PrivateMediaReleasePayload` it wants, but it can never make
 *    itself sign as a DIFFERENT seller's real key — this function is what
 *    refuses a release that claims to be for this buyer's order but did not
 *    actually arrive from that order's own real, already-locally-trusted
 *    `sellerPubkey` (mirrors `applyInboundPrivateDeliverySyncPayload()`'s
 *    own "sender is not this delivery's seller/buyer" checks exactly).
 *
 * 3. `evaluateDigitalContentDeliveryInvariantForOrderCompletion()` — THE
 *    "delivery invariant" this arc's mandate item 4 asks to be derived and
 *    enforced explicitly: an Order for a product carrying ANY
 *    `classification: "protected"` `ProductMedia` may reach `"completed"`
 *    ONLY once every one of those media items has a REAL, locally-verified
 *    release on file for this order's own buyer (never a bare "I received
 *    it" attestation — see
 *    `../../../../packages/fedos-desktop-electron-spike/src/fedos_electron_beta_main.cts`'s
 *    `handleCommerceOrderComplete()`, the ONE call site that consults this
 *    function, immediately before it ever calls
 *    `applyOrderAction(order, { type: "complete" }, ...)`). This is
 *    deliberately NOT implemented inside `../order/order_state_machine.ts`
 *    itself: that file has no knowledge of `ProductMedia`/protected
 *    classification at all (a different arc's own territory, and its own
 *    header notes it is "NOT modified" outside its owning arc), and
 *    `transitionComplete()`'s signature has no room for a media list without
 *    a wider, cross-cutting signature change touching every caller. Gating
 *    at the ONE caller-side composition-root site that already resolves
 *    Order status, buyer identity, and `ProductMedia` together achieves the
 *    exact same invariant without touching a file two other parallel agents
 *    also depend on — see `order_state_machine.ts`'s own header for its
 *    already-documented, pre-existing "no refund/failure state yet" gap
 *    this mirrors the shape of (a known, disclosed, caller-side
 *    responsibility rather than a state-machine-internal one).
 *
 *    A physical-goods Order (no protected media at all for its product) is
 *    UNAFFECTED — `satisfied: true` unconditionally when
 *    `protectedMedia.length === 0`, so this invariant never blocks a normal
 *    non-digital trade from completing. This also transitively protects
 *    `../reputation/reputation_issuance.ts`'s own `issueTradeCompletionAttestation()`
 *    Gate #1 (`order.status !== "completed"` -> reject) WITHOUT that file
 *    needing any change: since `"completed"` itself can no longer be
 *    reached for an under-delivered digital Order once this invariant is
 *    enforced at the one real transition site, a failed-content-delivery
 *    trade can never earn the SAME positive reputation outcome as a
 *    genuinely successful one — closing this arc's own mandate item 8
 *    without touching the reputation module's own, already-correct gate
 *    ordering.
 */

// ---------------------------------------------------------------------------
// 1. Inbound REQUEST authorization (seller side)
// ---------------------------------------------------------------------------

export type MediaReleaseRequestAuthorizationDenialReason =
  | "sender-mismatch"
  | "not-addressed-to-me"
  | "order-not-found"
  | "order-mismatch"
  | "media-not-found"
  | "media-not-protected";

export type MediaReleaseRequestAuthorizationDecision =
  | { readonly authorized: true }
  | { readonly authorized: false; readonly reason: MediaReleaseRequestAuthorizationDenialReason };

export interface MediaReleaseRequestPayloadLike {
  readonly orderId: string;
  readonly mediaId: string;
  readonly buyerPubkey: string;
  readonly sellerPubkey: string;
}

export interface MediaReleaseRequestOrderLike {
  readonly id: string;
  readonly productId: string;
  readonly buyerPubkey: string;
  readonly sellerPubkey: string;
}

export interface MediaReleaseRequestMediaLike {
  readonly id: string;
  readonly productId: string;
  readonly classification: "public" | "protected";
}

export interface EvaluateInboundMediaReleaseRequestAuthorizationInput {
  readonly payload: MediaReleaseRequestPayloadLike;
  /** The REAL, cryptographically verified outer-event signer — never a claim read out of the payload. */
  readonly senderPubkeyHex: string;
  /** This process's OWN real identity for the account the request arrived on. */
  readonly ownPubkeyHex: string;
  /** This process's own already-looked-up Order for `payload.orderId`, if any. */
  readonly order: MediaReleaseRequestOrderLike | undefined;
  /** This process's own already-looked-up `ProductMedia` for `payload.mediaId`, if any. */
  readonly media: MediaReleaseRequestMediaLike | undefined;
}

/**
 * Fixed check order (never reordered by a caller): sender identity ->
 * addressed-to-me -> real Order exists and matches every claimed field ->
 * real protected `ProductMedia` exists for this Order's own product. Only
 * once ALL of these pass does a caller proceed to the actual grant
 * evaluation (`evaluateMediaAccessGrant()`), which independently re-derives
 * its own ALLOW/DENY decision from the real, durably-persisted grant
 * envelope — this function never grants anything by itself.
 */
export function evaluateInboundMediaReleaseRequestAuthorization(
  input: EvaluateInboundMediaReleaseRequestAuthorizationInput,
): MediaReleaseRequestAuthorizationDecision {
  if (input.senderPubkeyHex !== input.payload.buyerPubkey) {
    return { authorized: false, reason: "sender-mismatch" };
  }
  if (input.payload.sellerPubkey !== input.ownPubkeyHex) {
    return { authorized: false, reason: "not-addressed-to-me" };
  }
  const order = input.order;
  if (order === undefined) {
    return { authorized: false, reason: "order-not-found" };
  }
  if (order.id !== input.payload.orderId || order.buyerPubkey !== input.payload.buyerPubkey || order.sellerPubkey !== input.payload.sellerPubkey) {
    return { authorized: false, reason: "order-mismatch" };
  }
  const media = input.media;
  if (media === undefined || media.id !== input.payload.mediaId || media.productId !== order.productId) {
    return { authorized: false, reason: "media-not-found" };
  }
  if (media.classification !== "protected") {
    return { authorized: false, reason: "media-not-protected" };
  }
  return { authorized: true };
}

// ---------------------------------------------------------------------------
// 2. Inbound RESPONSE authorization (buyer side)
// ---------------------------------------------------------------------------

export type MediaReleaseResponseAuthorizationDenialReason = "sender-mismatch" | "not-addressed-to-me" | "order-mismatch";

export type MediaReleaseResponseAuthorizationDecision =
  | { readonly authorized: true }
  | { readonly authorized: false; readonly reason: MediaReleaseResponseAuthorizationDenialReason };

export interface MediaReleaseResponsePayloadLike {
  readonly orderId: string;
  readonly mediaId: string;
  readonly buyerPubkey: string;
  readonly sellerPubkey: string;
}

export interface EvaluateInboundMediaReleaseResponseAuthorizationInput {
  readonly payload: MediaReleaseResponsePayloadLike;
  /** The REAL, cryptographically verified outer-event signer. */
  readonly senderPubkeyHex: string;
  /** This buyer's OWN real identity for the account the response arrived on. */
  readonly ownPubkeyHex: string;
  /** This buyer's own, already-locally-trusted Order — `order.sellerPubkey` is the ONLY seller identity this function ever trusts as the expected sender; never re-derived from the payload's own `sellerPubkey` field. */
  readonly order: { readonly id: string; readonly sellerPubkey: string };
  readonly expectedMediaId: string;
}

/**
 * A seller's process can construct a `PrivateMediaReleasePayload` claiming
 * any `buyerPubkey`/`sellerPubkey`/`orderId`/`mediaId` it likes, but it can
 * never make itself sign as a DIFFERENT real key — this is the concrete
 * enforcement that a release genuinely came from THIS order's own real
 * seller, addressed to THIS buyer, for THIS order/media pair, never a
 * cross-order/cross-media/cross-buyer replay or forgery.
 */
export function evaluateInboundMediaReleaseResponseAuthorization(
  input: EvaluateInboundMediaReleaseResponseAuthorizationInput,
): MediaReleaseResponseAuthorizationDecision {
  if (input.senderPubkeyHex !== input.order.sellerPubkey) {
    return { authorized: false, reason: "sender-mismatch" };
  }
  if (input.payload.sellerPubkey !== input.order.sellerPubkey) {
    return { authorized: false, reason: "sender-mismatch" };
  }
  if (input.payload.buyerPubkey !== input.ownPubkeyHex) {
    return { authorized: false, reason: "not-addressed-to-me" };
  }
  if (input.payload.orderId !== input.order.id || input.payload.mediaId !== input.expectedMediaId) {
    return { authorized: false, reason: "order-mismatch" };
  }
  return { authorized: true };
}

// ---------------------------------------------------------------------------
// 3. Order-completion "digital content delivery invariant"
// ---------------------------------------------------------------------------

export interface DigitalContentDeliveryInvariantMediaLike {
  readonly id: string;
  readonly productId: string;
  readonly classification: "public" | "protected";
}

export type DigitalContentDeliveryInvariantResult =
  | { readonly satisfied: true }
  | { readonly satisfied: false; readonly reason: "digital-content-not-delivered"; readonly missingMediaIds: readonly string[] };

export interface EvaluateDigitalContentDeliveryInvariantForOrderCompletionInput {
  readonly productId: string;
  /** Every `ProductMedia` record belonging to `productId` — this function filters to `classification === "protected"` itself, mirroring `issueMediaAccessGrantsForOrder()`'s own filtering convention. */
  readonly productMedia: readonly DigitalContentDeliveryInvariantMediaLike[];
  /** Caller-supplied predicate: has a REAL, verified release already been obtained for `mediaId` under this specific order/buyer? Callers get this from `DurableMediaReleaseContentCache.getRelease()` (`./persistence/durable_media_release_content_cache.ts`) — never a bare acknowledgment flag. */
  readonly hasReleasedContent: (mediaId: string) => boolean;
}

/**
 * `satisfied: true` unconditionally when the product carries no protected
 * media at all (an ordinary physical-goods/no-digital-content Order is
 * never blocked by this invariant). Otherwise `satisfied: true` only when
 * EVERY protected media item for this product has a real release on file;
 * any missing item makes this Order ineligible to reach `"completed"`,
 * naming every missing `mediaId` so the caller can surface a truthful
 * reason rather than a bare rejection.
 */
export function evaluateDigitalContentDeliveryInvariantForOrderCompletion(
  input: EvaluateDigitalContentDeliveryInvariantForOrderCompletionInput,
): DigitalContentDeliveryInvariantResult {
  const protectedMedia = input.productMedia.filter((media) => media.productId === input.productId && media.classification === "protected");
  const missingMediaIds = protectedMedia.filter((media) => !input.hasReleasedContent(media.id)).map((media) => media.id);
  if (missingMediaIds.length > 0) {
    return { satisfied: false, reason: "digital-content-not-delivered", missingMediaIds };
  }
  return { satisfied: true };
}
