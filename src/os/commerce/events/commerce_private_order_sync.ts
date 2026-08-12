/**
 * FedOS "Real Two-Party Commerce + UX P0/P1 Closure" mega-arc (Agent N,
 * Coordinator-directed pass) — the PRIVATE sibling of
 * `commerce_nostr_event_drafts.ts`. Where that file defines the smallest
 * bounded set of PUBLIC Commerce Nostr event drafts, this file defines the
 * ONE payload shape a private Order/status sync message may carry —
 * encrypted (NIP-44 wire, via `FedosMasterSeedAuthority.encryptNip44Wire`/
 * `decryptNip44Wire` — see `../catalog/adapters/nostr/commerce_private_order_bridge.ts`,
 * the only file allowed to touch that real crypto primitive) rather than
 * published in the open.
 *
 * WHY A SEPARATE SHAPE, NOT A NEW `CommerceNostrEventCategory`
 * ----------------------------------------------------------------------
 * `commerce_nostr_event_drafts.ts`'s six categories are ALL public-safe by
 * construction — every field in every one of them is allowlisted precisely
 * because it is meant to be readable by anyone. An Order's real economics
 * (which product, which quantity, which two real counterparties, which
 * status) are the OPPOSITE: PRIVATE by design (arc's own item #4: "Order
 * content is PRIVATE — do not publish it in the open/public event shape").
 * Reusing `CommerceNostrEventDraft`'s allowlist machinery for a shape that
 * is ENCRYPTED before it ever reaches a relay would blur two genuinely
 * different trust models under one name; this file keeps them separate on
 * purpose.
 *
 * FIELD CLASSIFICATION (read before adding a field — same "allowlist
 * everything, reject unknown keys outright" discipline as
 * `commerce_nostr_event_drafts.ts`)
 * ----------------------------------------------------------------------
 * Every field below is ENCRYPTED-NOSTR: it travels only as NIP-44 wire
 * ciphertext (`content` of the outer signed event), decryptable ONLY by
 * the two real counterparties (`buyerPubkey`/`sellerPubkey`) — see this
 * repo's own `FedosMasterSeedAuthority.encryptNip44Wire`'s doc comment.
 * `orderId`/`productId`/exact `unitPriceCents`/`currency`/`quantity` are
 * PRIVATE here (unlike `commerce_nostr_event_drafts.ts`'s own
 * `order-commitment` category, which carries a coarse SALTED DIGEST of the
 * order id and never a raw price — this shape is the opposite: the real,
 * raw values, but never exposed to a relay/observer because the whole
 * payload is encrypted before it is ever a `content` string).
 *
 * `status` is DELIBERATELY RESTRICTED to the subset of `OrderStatus`
 * values this wave's own receiving-side logic
 * (`commercePrivateOrderDiscoverAndApplyNonFatal()`,
 * `fedos_electron_beta_main.cts`) actually knows how to apply through the
 * REAL, actor-authorized `order_state_machine.ts` — see that file's own
 * header for exactly which six are safe to relay this way (`submitted`/
 * `cancelled`/`accepted`/`rejected`/`fulfilling`/`completed`) and why
 * `paid`/`delivered` are DELIBERATELY EXCLUDED here (never even
 * constructible as a well-formed payload) rather than merely "not sent
 * this pass" — see this repo's own `order_state_machine.ts` module doc on
 * why only a `payment_evidence`/`delivery_evidence` actor — ONE verified
 * call site per process — may ever cause those two transitions; accepting
 * a REMOTE peer's bare claim of "paid"/"delivered" here would let a
 * compromised or buggy counterparty falsely advance MY OWN process's
 * authoritative Order state without my own process ever having verified
 * real evidence, exactly the "never trust a bare inbound event's claimed
 * status" failure mode this arc's own trust-boundary discipline (§55)
 * prohibits. `"created"` is likewise excluded — see `order_types.ts`'s own
 * design note: a `"created"` Order is the buyer's own private draft, never
 * sent to the seller at all, public or private.
 */

const HEX_64_PATTERN = /^[0-9a-f]{64}$/;

/**
 * The subset of `order_types.ts`'s own `OrderStatus` this payload may ever
 * carry. See this file's header for exactly why `"created"`/`"paid"`/
 * `"delivered"` are excluded — this is a DELIBERATELY NARROWER mirror, not
 * a duplicate of the full `OrderStatus` union.
 */
export type PrivateOrderSyncStatus =
  | "submitted"
  | "accepted"
  | "rejected"
  | "fulfilling"
  | "completed"
  | "cancelled";

const PRIVATE_ORDER_SYNC_STATUSES: readonly PrivateOrderSyncStatus[] = [
  "submitted",
  "accepted",
  "rejected",
  "fulfilling",
  "completed",
  "cancelled",
];

export interface PrivateOrderSyncPayload {
  readonly category: "private-order-sync";
  readonly formatVersion: 1;
  readonly orderId: string;
  readonly productId: string;
  readonly buyerPubkey: string;
  readonly sellerPubkey: string;
  readonly quantity: number;
  readonly unitPriceCents: number;
  readonly currency: string;
  readonly status: PrivateOrderSyncStatus;
  /** Optional reject/cancel reason — bounded length, enforced by the
   * caller (`fedos_electron_beta_main.cts`'s own `MAX_ORDER_REJECTION_REASON_CHARS`,
   * same bound the existing local reject/cancel IPC handlers already
   * enforce) before this payload is ever constructed; this file only
   * checks "is a string", matching `ProductPublicationEventDraft.description`'s
   * own "structural check only, length policy lives at the call site"
   * convention. */
  readonly reason?: string;
  readonly at: number;
}

export const PRIVATE_ORDER_SYNC_ALLOWED_KEYS: ReadonlySet<string> = new Set([
  "category",
  "formatVersion",
  "orderId",
  "productId",
  "buyerPubkey",
  "sellerPubkey",
  "quantity",
  "unitPriceCents",
  "currency",
  "status",
  "reason",
  "at",
]);

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.length > 0;
}

function isHex64(value: unknown): value is string {
  return typeof value === "string" && HEX_64_PATTERN.test(value);
}

function isNonNegativeInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0;
}

function isUnixSecondsInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0;
}

function hasOnlyAllowedKeys(candidate: Record<string, unknown>, allowed: ReadonlySet<string>): boolean {
  return Object.keys(candidate).every((key) => allowed.has(key));
}

/**
 * The single entry point every private-order transport implementation
 * MUST call before ever handing a payload to `encryptNip44Wire` — mirrors
 * `isWellFormedCommerceNostrEventDraft()`'s own "fail closed, never
 * throws, allowlist-only" discipline exactly.
 */
export function isWellFormedPrivateOrderSyncPayload(value: unknown): value is PrivateOrderSyncPayload {
  if (typeof value !== "object" || value === null) return false;
  const c = value as Record<string, unknown>;
  if (!hasOnlyAllowedKeys(c, PRIVATE_ORDER_SYNC_ALLOWED_KEYS)) return false;
  if (c.category !== "private-order-sync") return false;
  if (c.formatVersion !== 1) return false;
  if (!isNonEmptyString(c.orderId)) return false;
  if (!isNonEmptyString(c.productId)) return false;
  if (!isHex64(c.buyerPubkey)) return false;
  if (!isHex64(c.sellerPubkey)) return false;
  if (c.buyerPubkey === c.sellerPubkey) return false; // mirrors order_state_machine.ts's own self-dealing gate
  if (typeof c.quantity !== "number" || !Number.isInteger(c.quantity) || c.quantity < 1) return false;
  if (!isNonNegativeInteger(c.unitPriceCents)) return false;
  if (!isNonEmptyString(c.currency)) return false;
  if (typeof c.status !== "string" || !PRIVATE_ORDER_SYNC_STATUSES.includes(c.status as PrivateOrderSyncStatus)) {
    return false;
  }
  if (c.reason !== undefined && typeof c.reason !== "string") return false;
  if (!isUnixSecondsInteger(c.at)) return false;
  return true;
}

/**
 * Which `order_state_machine.ts` `OrderActionType` a given
 * `PrivateOrderSyncStatus` corresponds to, and which `OrderActorKind` is
 * authorized to have produced it — the SAME lookup table
 * `commercePrivateOrderDiscoverAndApplyNonFatal()`
 * (`fedos_electron_beta_main.cts`) uses to decide what to call, kept here
 * so the mapping has ONE canonical source instead of being re-derived at
 * the call site. `"submitted"` is handled specially by the caller (it may
 * require a prior `createOrder()` if this is the first time a process
 * sees this `orderId`) — everything else assumes the order already exists
 * locally.
 */
export const PRIVATE_ORDER_SYNC_STATUS_ACTION: Readonly<Record<PrivateOrderSyncStatus, { readonly action: string; readonly actorKind: "customer" | "merchant" | "either" }>> = {
  submitted: { action: "submit", actorKind: "customer" },
  cancelled: { action: "cancel", actorKind: "customer" },
  accepted: { action: "accept", actorKind: "merchant" },
  rejected: { action: "reject", actorKind: "merchant" },
  fulfilling: { action: "fulfill", actorKind: "merchant" },
  completed: { action: "complete", actorKind: "either" },
};
