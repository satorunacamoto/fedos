/**
 * Commerce Durability + Protected-Media Entitlement + Packaged-E2E FINAL
 * Closure arc (Agent G) — `evaluateMediaAccessGrant()`: the ONE place a
 * candidate `MediaAccessGrantEnvelope` is turned into an ALLOW/DENY
 * decision. This is the concrete fix for P1's "access is not bound to any
 * specific authorized purchase" — every check below exists to close one
 * named failure mode from this arc's own brief.
 *
 * Pure function: no storage, no network, no clock of its own (`now` is
 * caller-supplied, mirroring `catalog/policy.ts`'s own pure-decision
 * style and this arc's own "injected clock... for deterministic tests"
 * convention used throughout this codebase, e.g. `fedos_nip59_seal.ts`).
 * Reads only its own arguments; never mutates any of them.
 *
 * QUALIFYING PURCHASE STATE — the exact rule, and why:
 * ----------------------------------------------------------------------
 * `Order.status` (`../order/order_types.ts`) qualifies a grant iff it is
 * one of `"paid"`, `"fulfilling"`, `"delivered"`, `"completed"` —
 * `QUALIFYING_ORDER_STATUSES` below. Reasoning, grounded in
 * `order_state_machine.ts`'s OWN documented authority discipline (read in
 * full before writing this file; that file is owned by Agent O this same
 * wave and is NOT modified here):
 *
 *   - `"paid"` is reachable ONLY via `applyOrderAction(order, { type:
 *     "confirm_payment", actor: { kind: "payment_evidence" }, evidence })`
 *     with `evidence.status === "settled"` — `order_state_machine.ts`'s own
 *     header states this is "the concrete fix for... the payment
 *     boundary's own `ingestCallback()` accepts unauthenticated callbacks,
 *     so the state machine consuming it must not trust a bare claim
 *     either." A bare customer/merchant "I paid" claim structurally cannot
 *     reach this status (`AUTHORIZED_ACTOR_KINDS.confirm_payment` is
 *     `["payment_evidence"]` only). This is exactly the "never trust a
 *     bare 'buyer says paid'/'merchant says paid'" discipline this arc's
 *     own brief requires — `evaluateMediaAccessGrant()` inherits it for
 *     free by keying off `order.status` rather than re-deriving payment
 *     truth itself.
 *   - For DOWNLOADABLE digital media specifically (what `ProductMedia`
 *     with `classification: "protected"` actually is), gating on
 *     `"delivered"` instead of `"paid"` would be circular: `deliveredStatus`
 *     is reached only via `{ type: "confirm_delivery", actor: { kind:
 *     "delivery_evidence" } }`, and Agent D's Wave B "real delivery
 *     mechanics" for a downloadable digital good ARE the buyer obtaining
 *     the decrypted content — i.e. exactly the capability THIS grant
 *     exists to authorize. Requiring delivery evidence before the grant
 *     that enables delivery would mean no digital-media grant could ever
 *     be issued. `order_state_machine.ts`'s own module doc confirms
 *     `DeliveryStatus`/`OrderDeliveryEvidence` are "a placeholder shape...
 *     no real Delivery capability exists anywhere in the repository yet" —
 *     there is no real, independent delivery-evidence source for digital
 *     media to wait on.
 *   - Once `"paid"`, the Order's own state machine has NO transition that
 *     ever reverts status away from `"paid"` (confirmed by reading every
 *     `transition*` function in `order_state_machine.ts`: `fulfilling`,
 *     `delivered`, `completed` are the only reachable next states, and
 *     none of them un-pays the order) — so treating `"fulfilling"`/
 *     `"delivered"`/`"completed"` as ALSO qualifying is not a separate
 *     policy choice, it is the same "paid" fact persisting forward through
 *     the rest of a successful lifecycle.
 *   - `"created"`/`"submitted"`/`"accepted"` never qualify — no verified
 *     payment exists yet ("unpaid Order" failure mode). `"rejected"`/
 *     `"cancelled"` never qualify — the Order never reached payment (or
 *     was abandoned before it), and both are `TERMINAL_ORDER_STATUSES`.
 *
 * REFUND / DISPUTE — explicitly an OPEN POLICY QUESTION, not silently
 * auto-revoked: `order_state_machine.ts`'s own header states plainly that
 * "`refunded`/`expired`/`error` payment evidence... are accepted as INPUT
 * ... but cause NO transition — Order has no refund/failure state yet.
 * This is a known, documented gap." Because `Order.status` itself can
 * never actually become "refunded" today (no such `OrderStatus` value
 * exists — see `order_types.ts`'s own `OrderStatus` union), there is no
 * existing, authoritative signal this function could key a revocation off
 * of without inventing new Order-domain semantics outside this arc's own
 * lane (`order_state_machine.ts`/`order_types.ts` are explicitly Agent
 * O/D's files this wave, not to be modified here). This function
 * therefore does NOT auto-revoke on refund/dispute — a merchant who wants
 * to stop future access after a refund MUST explicitly issue a revoking
 * `MediaAccessGrant` version (`revoked: true`, see
 * `./media_access_grant_types.ts`'s own header on revocation-as-new-version).
 * `order.paymentStatus === "refunded"` (the DISPLAY-only mirror field,
 * `order_types.ts`) is intentionally NOT consulted here, for the same
 * reason `order_state_machine.ts` itself never derives a transition from
 * it: it is display metadata, not an authoritative state.
 */

import type { Order, OrderStatus } from "../order/order_types.js";
import {
  verifyMediaAccessGrantEnvelope,
  type MediaAccessGrantVerifyStatus,
} from "./media_access_grant_sign_verify.js";
import type { MediaAccessGrantPayload } from "./media_access_grant_types.js";

/** See this file's own header for the full reasoning behind exactly these four statuses. */
const QUALIFYING_ORDER_STATUSES: ReadonlySet<OrderStatus> = new Set(["paid", "fulfilling", "delivered", "completed"]);

export function isQualifyingOrderStatusForMediaAccess(status: OrderStatus): boolean {
  return QUALIFYING_ORDER_STATUSES.has(status);
}

export type MediaAccessDenialReason =
  | Exclude<MediaAccessGrantVerifyStatus, "VALID">
  | "order-not-found"
  | "order-id-mismatch"
  | "media-id-mismatch"
  | "product-id-mismatch"
  | "buyer-mismatch"
  | "wrong-signer"
  | "order-not-qualifying"
  | "not-yet-valid"
  | "expired"
  | "revoked"
  | "superseded";

export type MediaAccessDecision =
  | { readonly allowed: true; readonly grant: MediaAccessGrantPayload }
  | { readonly allowed: false; readonly reason: MediaAccessDenialReason; readonly detail?: string };

export interface EvaluateMediaAccessGrantInput {
  /** The candidate grant envelope — structurally arbitrary `unknown` at this boundary, exactly like `verifyMediaAccessGrantEnvelope()`'s own input (never assume a caller already validated it). */
  readonly envelope: unknown;
  /** The media the caller is trying to access right now. */
  readonly media: { readonly id: string; readonly productId: string };
  /** The pubkey of whoever is asking for access right now — checked against `payload.buyerPubkey`, never trusted merely because it matches `payload.issuerPubkey` or anything else. */
  readonly actorPubkey: string;
  /**
   * The REAL `Order` this grant claims to be backed by, already looked up
   * by the caller via its own `OrderRepository`-shaped port (this function
   * performs no lookup of its own — same "caller resolves references,
   * this function only judges them" discipline as `catalog/policy.ts`'s
   * `canAccessAsset()` taking an already-resolved `Product`/`PurchaseGrant[]`).
   * `null` models "no Order was found for the claimed `orderId`" — the
   * concrete fix for the "no Order at all" failure mode.
   */
  readonly order: Order | null;
  /** Unix seconds "now" — caller-injected for determinism. */
  readonly now: number;
  /**
   * The highest `grantVersion` this verifier has already durably seen for
   * this `(mediaId, buyerPubkey, orderId)` triple (e.g. via
   * `./media_access_grant_persistence.ts`'s own replay). Omit (or `0`) if
   * this is the first grant version ever evaluated for the triple. A
   * candidate whose own `grantVersion` is LOWER than this is a replay of a
   * superseded (possibly since-revoked) version and is rejected regardless
   * of an otherwise-valid signature.
   */
  readonly latestKnownGrantVersion?: number;
}

/**
 * Evaluates ONE candidate grant against ONE access attempt. Fixed check
 * order (cheapest/most-structural first, cryptographic signature check
 * always before ever returning `allowed: true`):
 *   1. Envelope/payload well-formedness + domain type (delegates to
 *      `verifyMediaAccessGrantEnvelope()` for structure, but the actual
 *      signature check is deferred to step 9 below so a malformed/
 *      mismatched candidate is rejected cheaply first).
 *   2. `media.id === payload.mediaId` — "wrong media".
 *   3. `media.productId === payload.productId` — "wrong Product".
 *   4. `actorPubkey === payload.buyerPubkey` — "wrong buyer".
 *   5. `order !== null` — "no Order at all".
 *   6. `order.id === payload.orderId` — the grant's claimed Order really is
 *      the one being checked (defends against a grant for one Order being
 *      replayed against an unrelated one that happens to also involve the
 *      same buyer/media).
 *   7. `order.buyerPubkey === payload.buyerPubkey` — the Order itself
 *      really was placed by this buyer (defense in depth alongside step 4;
 *      catches a `payload.buyerPubkey` that matches the actor but not the
 *      Order it claims to be backed by).
 *   8. `order.sellerPubkey === envelope.keyId` — "wrong signer": only the
 *      Order's own seller may issue a grant against it. This is the ONE
 *      check that establishes WHO counts as "merchant authority" for this
 *      grant, without needing any separate merchant-registration concept.
 *   9. The full cryptographic verify (`verifyMediaAccessGrantEnvelope()`) —
 *      "tampered grant" (any field mutation invalidates the signature) and
 *      "replayed old/superseded grant version"'s signature half (a forged
 *      envelope can never reach this far anyway; this is the point actual
 *      forgeries are caught even if steps 2-8 happened to line up).
 *  10. `isQualifyingOrderStatusForMediaAccess(order.status)` — "unpaid
 *      Order" (see this file's own header for the exact rule + why).
 *  11. `now >= payload.validFrom` — not yet active.
 *  12. `payload.validUntil === null || now <= payload.validUntil` —
 *      "expired grant".
 *  13. `payload.revoked === false` — "revoked grant".
 *  14. `latestKnownGrantVersion` gate — "replayed old/superseded grant
 *      version".
 */
export function evaluateMediaAccessGrant(input: EvaluateMediaAccessGrantInput): MediaAccessDecision {
  const verified = verifyMediaAccessGrantEnvelope(input.envelope);
  if (verified.status !== "VALID") {
    // Structural/signature failure — still safe to report the underlying
    // reason directly, since `MediaAccessDenialReason` is a superset of
    // `MediaAccessGrantVerifyStatus`'s non-VALID members.
    return { allowed: false, reason: verified.status, detail: verified.detail };
  }
  const payload = verified.payload;
  const keyId = verified.signerPublicKeyHex;

  if (payload.mediaId !== input.media.id) {
    return { allowed: false, reason: "media-id-mismatch" };
  }
  if (payload.productId !== input.media.productId) {
    return { allowed: false, reason: "product-id-mismatch" };
  }
  if (payload.buyerPubkey !== input.actorPubkey) {
    return { allowed: false, reason: "buyer-mismatch" };
  }
  if (input.order === null) {
    return { allowed: false, reason: "order-not-found" };
  }
  const order = input.order;
  if (order.id !== payload.orderId) {
    return { allowed: false, reason: "order-id-mismatch" };
  }
  if (order.buyerPubkey !== payload.buyerPubkey) {
    return { allowed: false, reason: "buyer-mismatch" };
  }
  if (order.sellerPubkey !== keyId) {
    return { allowed: false, reason: "wrong-signer" };
  }
  if (!isQualifyingOrderStatusForMediaAccess(order.status)) {
    return { allowed: false, reason: "order-not-qualifying", detail: order.status };
  }
  if (input.now < payload.validFrom) {
    return { allowed: false, reason: "not-yet-valid" };
  }
  if (payload.validUntil !== null && input.now > payload.validUntil) {
    return { allowed: false, reason: "expired" };
  }
  if (payload.revoked) {
    return { allowed: false, reason: "revoked" };
  }
  const latestKnown = input.latestKnownGrantVersion ?? 0;
  if (payload.grantVersion < latestKnown) {
    return { allowed: false, reason: "superseded" };
  }

  return { allowed: true, grant: payload };
}
