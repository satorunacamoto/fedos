/**
 * FedOS Commerce Purchase Completion mega-arc (Agent D) — the PRIVATE
 * sibling of `commerce_private_order_sync.ts`, but for the `Delivery`
 * domain (`../delivery/`) rather than `Order`. Closes the arc's own
 * "Cross-process delivery" requirement: today `Order`'s own private sync
 * already carries a `"fulfilling"` status update from seller to buyer
 * (`PrivateOrderSyncStatus`), but the SEPARATE `DeliveryRecord` this
 * domain owns (its own lifecycle, its own `DeliveryReceiptArtifact`, its
 * own evidence-provenance discipline — see `../delivery/delivery_types.ts`'s
 * own header for why the two are deliberately never collapsed) is NEVER
 * materialized on the buyer's own independent process, and the buyer's own
 * "I received this" acknowledgment is NEVER relayed back to the seller's
 * independent process at all — confirmed by direct reading of
 * `fedos_electron_beta_main.cts`'s `handleCommerceDeliveryAcknowledgeReceipt`
 * before this file was written: it only ever touches THIS process's own
 * `commerceState().deliveries`/`.orders`, with no transport call anywhere
 * near it. This file is the wire shape that closes that gap; the transport
 * itself lives in `../catalog/adapters/nostr/commerce_private_delivery_bridge.ts`
 * (reusing the exact same NIP-44-direct + real signing/relay primitives
 * `commerce_private_order_bridge.ts` already established — a new payload
 * category and topic tag, NOT a second transport stack).
 *
 * WHY THREE ACTIONS, AND WHY EACH ONE IS SAFE TO TRUST FROM A REMOTE PEER
 * ----------------------------------------------------------------------
 * `PrivateOrderSyncPayload`'s own header explains the general rule this
 * file inherits: a remote peer's BARE claim may only ever be trusted for a
 * transition that the real state machine ALSO treats as a bare,
 * self-asserted claim by that same actor kind — never for a transition
 * that requires independently-verified evidence. Applying that rule to
 * `../delivery/delivery_state_machine.ts`'s own three actions:
 *
 *   - `"fulfilling"` — corresponds to `start_fulfillment`, which
 *     `AUTHORIZED_ACTOR_KINDS` already permits as a bare `"merchant"`
 *     claim with ZERO evidence requirement (see that file's own header:
 *     "There is no money-moving or entitlement risk in a merchant merely
 *     CLAIMING to be working on it"). Safe to relay as-is, gated only by
 *     "the real, verified sender is this delivery's own `sellerPubkey`".
 *     This action ALSO covers the record's own creation
 *     (`../delivery/delivery_state_machine.ts`'s `createDelivery()`) when
 *     the receiving process has never seen this `deliveryId` before — the
 *     receiver materializes-then-starts in one step (see the receiving
 *     side, `commerce_private_delivery_apply.ts`), which does not lose any
 *     audit fidelity: the receiver's own local `DeliveryRecord.history`
 *     still records BOTH a `"create"` and a `"start_fulfillment"` entry
 *     either way, since it independently calls both real state-machine
 *     functions in sequence.
 *   - `"recipient_acknowledged"` — corresponds to `confirm_delivery` with
 *     `verification.source === "recipient_acknowledgment"`
 *     (`../delivery/delivery_types.ts`'s own `DeliveryEvidenceProvenance`:
 *     "the CUSTOMER explicitly confirming receipt via their own UI action
 *     ... treated as authoritative and sufficient ON ITS OWN"). This is
 *     the ONE action in this file that can reach `"delivered"`, and it is
 *     safe to relay ONLY because the receiving side (never this file)
 *     reconstructs the `DeliveryEvidence`/`verification` object itself
 *     from the message's own cryptographically-verified sender identity —
 *     this payload NEVER carries a `verification`/`authoritative` field of
 *     its own for the receiver to trust blindly (there is no such field in
 *     `PrivateDeliverySyncPayload` below — structurally impossible to
 *     construct one). The receiving side's OWN trust boundary check ("is
 *     the real, verified sender this delivery's `buyerPubkey`?") is what
 *     makes this the concrete fix for this arc's own requirement: *"Seller
 *     must NOT be able to manufacture Buyer acknowledgment"* — a seller
 *     process can send a `"recipient_acknowledged"` payload all it wants,
 *     but it can never make itself sign as the buyer's own real key, so
 *     the receiving side's sender-identity check rejects it every time.
 *   - `"completed"` — corresponds to `acknowledge`, which
 *     `AUTHORIZED_ACTOR_KINDS` already permits from EITHER a `"customer"`
 *     or `"merchant"` actor once `"delivered"` (no further risk — mirrors
 *     `PrivateOrderSyncStatus`'s own `"completed"` entry exactly, same
 *     `actorKind: "either"` shape).
 *
 * `"pending"`/`"delivered"` DeliveryStatus values are DELIBERATELY not
 * modeled as their own wire actions here — `"pending"` is subsumed into
 * `"fulfilling"` (above) and a bare `"delivered"` claim is exactly the
 * thing this file's whole design refuses to let a wire payload assert
 * directly (only `"recipient_acknowledged"`, reconstructed locally by the
 * receiver, may ever cause that transition) — mirrors
 * `PrivateOrderSyncPayload`'s own exclusion of `"paid"`/`"delivered"` from
 * `PrivateOrderSyncStatus` for the identical reason.
 */

const HEX_64_PATTERN = /^[0-9a-f]{64}$/;

/**
 * The three `../delivery/delivery_state_machine.ts` actions this payload
 * may ever request — see this file's own header for why each one is safe
 * to relay this way, and why `"delivered"` (a bare claim) can never be
 * constructed here.
 */
export type PrivateDeliverySyncAction = "fulfilling" | "recipient_acknowledged" | "completed";

const PRIVATE_DELIVERY_SYNC_ACTIONS: readonly PrivateDeliverySyncAction[] = [
  "fulfilling",
  "recipient_acknowledged",
  "completed",
];

export interface PrivateDeliverySyncPayload {
  readonly category: "private-delivery-sync";
  readonly formatVersion: 1;
  /** The seller-generated `DeliveryRecord.id` — the buyer's own process adopts this SAME id when materializing its own local record, so the two sides never diverge on identity for the same delivery. */
  readonly deliveryId: string;
  readonly orderId: string;
  readonly buyerPubkey: string;
  readonly sellerPubkey: string;
  readonly action: PrivateDeliverySyncAction;
  /** Optional note/reason — bounded length enforced by the caller (mirrors `PrivateOrderSyncPayload.reason`'s own "structural check only" convention). Never used to carry evidence/verification data — see this file's own header. */
  readonly reason?: string;
  readonly at: number;
}

export const PRIVATE_DELIVERY_SYNC_ALLOWED_KEYS: ReadonlySet<string> = new Set([
  "category",
  "formatVersion",
  "deliveryId",
  "orderId",
  "buyerPubkey",
  "sellerPubkey",
  "action",
  "reason",
  "at",
]);

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.length > 0;
}

function isHex64(value: unknown): value is string {
  return typeof value === "string" && HEX_64_PATTERN.test(value);
}

function isUnixSecondsInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0;
}

function hasOnlyAllowedKeys(candidate: Record<string, unknown>, allowed: ReadonlySet<string>): boolean {
  return Object.keys(candidate).every((key) => allowed.has(key));
}

/**
 * The single entry point every private-delivery transport implementation
 * MUST call before ever handing a payload to `encryptNip44Wire` — mirrors
 * `isWellFormedPrivateOrderSyncPayload()`'s own "fail closed, never
 * throws, allowlist-only" discipline exactly.
 */
export function isWellFormedPrivateDeliverySyncPayload(value: unknown): value is PrivateDeliverySyncPayload {
  if (typeof value !== "object" || value === null) return false;
  const c = value as Record<string, unknown>;
  if (!hasOnlyAllowedKeys(c, PRIVATE_DELIVERY_SYNC_ALLOWED_KEYS)) return false;
  if (c.category !== "private-delivery-sync") return false;
  if (c.formatVersion !== 1) return false;
  if (!isNonEmptyString(c.deliveryId)) return false;
  if (!isNonEmptyString(c.orderId)) return false;
  if (!isHex64(c.buyerPubkey)) return false;
  if (!isHex64(c.sellerPubkey)) return false;
  if (c.buyerPubkey === c.sellerPubkey) return false; // mirrors delivery_state_machine.ts's own self-dealing posture
  if (typeof c.action !== "string" || !PRIVATE_DELIVERY_SYNC_ACTIONS.includes(c.action as PrivateDeliverySyncAction)) {
    return false;
  }
  if (c.reason !== undefined && typeof c.reason !== "string") return false;
  if (!isUnixSecondsInteger(c.at)) return false;
  return true;
}

export { PRIVATE_DELIVERY_SYNC_ACTIONS };
