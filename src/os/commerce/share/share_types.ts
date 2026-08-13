/**
 * FedOS "Buyer Discovery + Digital Content Delivery" mega-arc (Agent D) —
 * signed Product/Store Share Proof payload shapes (arc mandate item 3: "a
 * signed seller/product share artifact... a raw 64-char pubkey typed by
 * hand is NOT acceptable as the normal path").
 *
 * PURE DOMAIN TYPES ONLY — mirrors `../receipt/receipt_types.ts`'s own
 * discipline exactly: this file imports nothing from `src/os/trust`, and
 * nothing from `../order/`, `../payment/`, `../delivery/`, `../reputation/`.
 * `sellerPubkey`/`productId` are opaque, caller-supplied strings — this
 * file does not assume a specific key format beyond a bound on length.
 *
 * WHAT A ProductShareProof / StoreShareProof IS — AND, CRUCIALLY, IS NOT
 * ----------------------------------------------------------------------
 * A share artifact is a TAMPER-EVIDENT, OFFLINE-VIEWABLE POINTER + PREVIEW
 * a seller hands to a prospective buyer (QR/compact code/deep link) — it is
 * NEVER, by itself, proof that the named `sellerPubkey` is the real,
 * network-verified owner of `productId`. See
 * `commerce_trust_share_adapter.ts`'s own header for the full two-layer
 * trust model and exactly why: this payload's signature can only prove
 * "whoever crafted this exact JSON blob controlled SOME signing key at
 * issuance time" (self-consistency / anti-tamper) — establishing that the
 * claimed `sellerPubkey` is genuinely who published `productId` is the job
 * of the ALREADY-EXISTING, already-hardened
 * `CommerceNostrProductReadModel`/`verifyAndBuildInboundCommerceNostrEnvelope`
 * pipeline (`../events/commerce_nostr_event_read_model.ts`,
 * `../catalog/adapters/nostr/commerce_inbound_event_bridge.ts`), which the
 * caller MUST independently consult before treating a decoded share
 * artifact's contents as trustworthy for anything beyond an "unconfirmed
 * preview" label. This mirrors `../receipt/receipt_types.ts`'s own "what a
 * valid signature does NOT mean" discipline — restated here for a
 * different artifact type, not re-derived from scratch.
 *
 * WHY NO `relayHint` FIELD: an earlier design considered letting the
 * artifact itself name a Relay URL for the buyer's client to query. This
 * was DELIBERATELY dropped — accepting a network endpoint from an
 * untrusted, counterparty-supplied artifact before any verification has
 * happened is exactly the kind of "trust the link content itself" the arc
 * mandate forbids, and would let a malicious link steer a buyer's client
 * into contacting an attacker-chosen relay. A verifying client always
 * queries ONLY the Relay(s) the LOCAL user has themselves configured (arc
 * mandate item 1's "one network model"), never a link-supplied endpoint.
 */

/** Bound on every opaque string field below — same generous-but-bounded
 * convention as `../receipt/receipt_types.ts`'s own
 * `COMMERCE_RECEIPT_MAX_FIELD_LENGTH`. A local constant, not imported from
 * `src/os/trust/fedos_trust_limits.ts`, per this file's own
 * trust-import-free discipline. */
const COMMERCE_SHARE_MAX_FIELD_LENGTH = 512;
/** Product/store titles and labels get a slightly larger bound, mirroring
 * this app's own `MAX_PRODUCT_TITLE_CHARS`-style limits without importing
 * them (this file has zero dependency on the Electron composition root). */
const COMMERCE_SHARE_MAX_TITLE_LENGTH = 200;

export type CommerceShareProofKind = "product_share" | "store_share";

function isNonEmptyBoundedString(value: unknown, maxLength: number = COMMERCE_SHARE_MAX_FIELD_LENGTH): value is string {
  return typeof value === "string" && value.length > 0 && value.length <= maxLength;
}

function isUnixSecondsInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0;
}

function isNonNegativeInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0;
}

function hasOnlyAllowedKeys(candidate: Record<string, unknown>, allowed: ReadonlySet<string>): boolean {
  return Object.keys(candidate).every((key) => allowed.has(key));
}

/** Payload of a `ProductShareProof` — a tamper-evident preview/pointer for
 * exactly one product. */
export interface ProductShareProofPayload {
  readonly kind: "product_share";
  /** Opaque product id — mirrors `Product.id` (`../catalog/types.ts`), never imported. */
  readonly productId: string;
  readonly title: string;
  readonly priceCents: number;
  readonly currency: string;
  /** Opaque identifier of the claimed seller — mirrors `Product.creatorPubkey`.
   * See this file's header: this field is a CLAIM, not proof, until the
   * caller independently cross-checks it against the real, network-verified
   * product record. */
  readonly sellerPubkey: string;
  /** Unix seconds this share artifact was issued. */
  readonly issuedAt: number;
  readonly formatVersion: 1;
}

/** Payload of a `StoreShareProof` — a tamper-evident pointer to a seller's
 * whole store (not one specific product). */
export interface StoreShareProofPayload {
  readonly kind: "store_share";
  readonly sellerPubkey: string;
  readonly storeLabel: string;
  readonly issuedAt: number;
  readonly formatVersion: 1;
}

const PRODUCT_SHARE_ALLOWED_KEYS: ReadonlySet<string> = new Set([
  "kind",
  "productId",
  "title",
  "priceCents",
  "currency",
  "sellerPubkey",
  "issuedAt",
  "formatVersion",
]);

const STORE_SHARE_ALLOWED_KEYS: ReadonlySet<string> = new Set([
  "kind",
  "sellerPubkey",
  "storeLabel",
  "issuedAt",
  "formatVersion",
]);

/** Fails closed to `false` on any malformed input, any missing field, or
 * any UNEXPECTED extra field (mirrors `receipt_types.ts`'s allowlisted-keys
 * discipline); never throws. */
export function isWellFormedProductShareProofPayload(value: unknown): value is ProductShareProofPayload {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as Record<string, unknown>;
  if (!hasOnlyAllowedKeys(candidate, PRODUCT_SHARE_ALLOWED_KEYS)) return false;
  if (candidate.kind !== "product_share") return false;
  if (!isNonEmptyBoundedString(candidate.productId)) return false;
  if (!isNonEmptyBoundedString(candidate.title, COMMERCE_SHARE_MAX_TITLE_LENGTH)) return false;
  if (!isNonNegativeInteger(candidate.priceCents)) return false;
  if (!isNonEmptyBoundedString(candidate.currency, 16)) return false;
  if (!isNonEmptyBoundedString(candidate.sellerPubkey)) return false;
  if (!isUnixSecondsInteger(candidate.issuedAt)) return false;
  if (candidate.formatVersion !== 1) return false;
  return true;
}

/** Same discipline as `isWellFormedProductShareProofPayload`, for
 * `StoreShareProofPayload`. */
export function isWellFormedStoreShareProofPayload(value: unknown): value is StoreShareProofPayload {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as Record<string, unknown>;
  if (!hasOnlyAllowedKeys(candidate, STORE_SHARE_ALLOWED_KEYS)) return false;
  if (candidate.kind !== "store_share") return false;
  if (!isNonEmptyBoundedString(candidate.sellerPubkey)) return false;
  if (!isNonEmptyBoundedString(candidate.storeLabel, COMMERCE_SHARE_MAX_TITLE_LENGTH)) return false;
  if (!isUnixSecondsInteger(candidate.issuedAt)) return false;
  if (candidate.formatVersion !== 1) return false;
  return true;
}

function requiredStringLiteral(fieldName: string, value: string): string {
  if (!isNonEmptyBoundedString(value, Math.max(COMMERCE_SHARE_MAX_FIELD_LENGTH, COMMERCE_SHARE_MAX_TITLE_LENGTH))) {
    throw new RangeError(`commerce share proof: "${fieldName}" must be a non-empty bounded string`);
  }
  return JSON.stringify(value);
}

/**
 * Deterministic, hand-written, fixed-field-order canonicalization of a
 * `ProductShareProofPayload` — same "every domain owns its own
 * canonicalizer" convention as `receipt_types.ts`'s own
 * `canonicalizeTradeReceiptProofPayloadV1`.
 */
export function canonicalizeProductShareProofPayloadV1(payload: ProductShareProofPayload): string {
  const parts: readonly string[] = [
    `"kind":"product_share"`,
    `"productId":${requiredStringLiteral("productId", payload.productId)}`,
    `"title":${requiredStringLiteral("title", payload.title)}`,
    `"priceCents":${String(payload.priceCents)}`,
    `"currency":${requiredStringLiteral("currency", payload.currency)}`,
    `"sellerPubkey":${requiredStringLiteral("sellerPubkey", payload.sellerPubkey)}`,
    `"issuedAt":${String(payload.issuedAt)}`,
    `"formatVersion":${String(payload.formatVersion)}`,
  ];
  return `{${parts.join(",")}}`;
}

/** Same convention as `canonicalizeProductShareProofPayloadV1`, for
 * `StoreShareProofPayload`. */
export function canonicalizeStoreShareProofPayloadV1(payload: StoreShareProofPayload): string {
  const parts: readonly string[] = [
    `"kind":"store_share"`,
    `"sellerPubkey":${requiredStringLiteral("sellerPubkey", payload.sellerPubkey)}`,
    `"storeLabel":${requiredStringLiteral("storeLabel", payload.storeLabel)}`,
    `"issuedAt":${String(payload.issuedAt)}`,
    `"formatVersion":${String(payload.formatVersion)}`,
  ];
  return `{${parts.join(",")}}`;
}
