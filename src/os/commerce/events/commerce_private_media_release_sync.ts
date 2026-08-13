/**
 * BUYER DISCOVERY + DIGITAL CONTENT DELIVERY mega-arc (Agent A) — the
 * FOURTH private-sync wire shape, sibling of `commerce_private_order_sync.ts`,
 * `commerce_private_delivery_sync.ts` and `commerce_private_payment_evidence_sync.ts`.
 * Closes the gap `docs/commerce/PROTECTED-MEDIA-CROSS-PROCESS-REACHABILITY.md`
 * names as the smallest honest missing piece ("What the smallest honest
 * version of the missing piece would be"): a REQUEST/RESPONSE round trip so
 * a buyer's own independent process can obtain a grant-gated release of
 * protected media from the SELLER's own independent process, instead of the
 * single-process wrap/unwrap stand-in
 * `fedos_electron_beta_main.cts`'s `handleCommerceMediaGrantRedeem()`
 * previously used (see that doc's "Blocker 3").
 *
 * TWO PAYLOAD SHAPES, ONE FILE — mirrors this arc's own established
 * request/response split rather than reusing one shape for both directions:
 *
 *   `PrivateMediaReleaseRequestPayload` (buyer -> seller): "please release
 *   `mediaId` for `orderId`" — a bare, self-attested request. Carries no
 *   claim the receiver must trust; the receiver (seller's own process)
 *   independently re-derives every fact it needs (real Order lookup, real
 *   `ProductMedia` lookup, real `evaluateMediaAccessGrant()`) before ever
 *   acting on it. The ONE trust decision a receiver must make about this
 *   payload is address it correctly: `senderPubkeyHex` (the real,
 *   cryptographically verified outer-event signer — never a claim read out
 *   of the decrypted content) MUST equal `payload.buyerPubkey`, or a seller
 *   process could be tricked into releasing buyer A's content to whoever
 *   merely CLAIMS to be buyer A in the payload body.
 *
 *   `PrivateMediaReleasePayload` (seller -> buyer): the reply. A
 *   discriminated union of exactly two outcomes:
 *     - `"released"` — carries `wireCiphertext`, the OUTPUT of
 *       `wrapMediaAccessGrantRelease()` (`../media_grant/media_access_grant_key_release.ts`)
 *       — itself already ECDH-bound to `(merchantAccountIndex, buyerPubkey)`
 *       via `FedosMasterSeedAuthority.encryptNip44Wire()`. This file's own
 *       transport (`../catalog/adapters/nostr/commerce_private_media_release_bridge.ts`)
 *       ALSO NIP-44-encrypts this whole envelope to the same buyer before it
 *       ever touches a relay — so `wireCiphertext` here travels
 *       double-wrapped: once by the grant-release layer (bound to the
 *       specific grant-authorized buyer, re-verified at wrap time), once by
 *       the ordinary private-sync transport layer (bound to the same
 *       counterparty again). This is deliberate redundancy, not a design
 *       accident — it means a bug in either layer alone still fails closed.
 *     - `"denied"` — a bounded, closed-vocabulary reason (reusing
 *       `MediaAccessDenialReason`'s own string values where applicable, or
 *       one of this file's own transport-level reasons) so the buyer's UI
 *       can show a TRUTHFUL failure state instead of hanging forever or
 *       silently asking the buyer to "just attest you got it" — see this
 *       arc's own mandate item 4.
 *
 * WHY A DENIAL REPLY, WHEN THE OTHER THREE CHANNELS NEVER REPLY TO A
 * REJECTED SYNC AT ALL
 * ----------------------------------------------------------------------
 * The other three channels are ASSERTIONS about state this process already
 * committed locally — a rejected inbound assertion just means "my own
 * state doesn't allow that yet", and the sender's own UI already reflects
 * its own local state, so no reply is needed. A media-release REQUEST is
 * different: the buyer has no local state at all to reflect (they are
 * asking for something they do not yet have), so silence is
 * indistinguishable from "still pending" and "will never succeed" — exactly
 * the dishonest state this arc's mandate item 4 forbids. A bounded, reasoned
 * `"denied"` reply keeps the buyer's UI honest.
 *
 * FIELD CLASSIFICATION (minimum only, mirrors every sibling file's own
 * discipline): every field below is ENCRYPTED-NOSTR content. Deliberately
 * EXCLUDED from `PrivateMediaReleaseRequestPayload`: any claim about WHY the
 * buyer believes they are entitled (the receiver re-derives that itself).
 * Deliberately EXCLUDED from `PrivateMediaReleasePayload`: the
 * `MediaAccessGrant` envelope itself, a raw content key, or a CID/storageRef
 * — mirrors `handleCommerceMediaGrantRedeem()`'s own existing "never returns
 * the grant envelope, a content key, AEAD internals, or a storageRef"
 * discipline exactly; only opaque `wireCiphertext`/`contentType`/
 * `contentDigest` cross this boundary.
 */

const HEX_64_PATTERN = /^[0-9a-f]{64}$/;

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.length > 0;
}

function isHex64(value: unknown): value is string {
  return typeof value === "string" && HEX_64_PATTERN.test(value);
}

function isUnixSecondsInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0;
}

function isPositiveInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value > 0;
}

function hasOnlyAllowedKeys(candidate: Record<string, unknown>, allowed: ReadonlySet<string>): boolean {
  return Object.keys(candidate).every((key) => allowed.has(key));
}

// ---------------------------------------------------------------------------
// Request: buyer -> seller
// ---------------------------------------------------------------------------

export interface PrivateMediaReleaseRequestPayload {
  readonly category: "private-media-release-request";
  readonly formatVersion: 1;
  readonly orderId: string;
  readonly mediaId: string;
  /** The REQUESTING buyer's own claimed identity — the receiver MUST
   * independently re-check this equals the real, verified outer-event
   * signer before ever acting on it (never trusted from this field alone —
   * see this file's own header). */
  readonly buyerPubkey: string;
  /** Who this request believes it is addressing — the receiver re-checks
   * this equals its OWN real identity before acting (a request addressed to
   * a different seller is simply ignored, mirroring every sibling bridge's
   * own tag-based "not-mine" convention at the transport layer, re-checked
   * again here at the payload layer as defense in depth). */
  readonly sellerPubkey: string;
  readonly at: number;
}

export const PRIVATE_MEDIA_RELEASE_REQUEST_ALLOWED_KEYS: ReadonlySet<string> = new Set([
  "category",
  "formatVersion",
  "orderId",
  "mediaId",
  "buyerPubkey",
  "sellerPubkey",
  "at",
]);

/**
 * The single entry point every private-media-release-request transport
 * implementation MUST call before ever handing a payload to
 * `encryptNip44Wire`, AND every receiver MUST call before trusting a
 * decrypted payload's shape — mirrors every sibling `isWellFormedPrivate*`
 * function's own "fail closed, never throws, allowlist-only" discipline.
 */
export function isWellFormedPrivateMediaReleaseRequestPayload(value: unknown): value is PrivateMediaReleaseRequestPayload {
  if (typeof value !== "object" || value === null) return false;
  const c = value as Record<string, unknown>;
  if (!hasOnlyAllowedKeys(c, PRIVATE_MEDIA_RELEASE_REQUEST_ALLOWED_KEYS)) return false;
  if (c.category !== "private-media-release-request") return false;
  if (c.formatVersion !== 1) return false;
  if (!isNonEmptyString(c.orderId)) return false;
  if (!isNonEmptyString(c.mediaId)) return false;
  if (!isHex64(c.buyerPubkey)) return false;
  if (!isHex64(c.sellerPubkey)) return false;
  if (c.buyerPubkey === c.sellerPubkey) return false; // mirrors delivery_sync.ts's own self-dealing posture
  if (!isUnixSecondsInteger(c.at)) return false;
  return true;
}

// ---------------------------------------------------------------------------
// Response: seller -> buyer
// ---------------------------------------------------------------------------

/**
 * Generous upper bound on `wireCiphertext`'s length: the underlying
 * plaintext release is already bounded at
 * `MAX_MEDIA_ACCESS_GRANT_RELEASE_PAYLOAD_BYTES = 65_536` bytes
 * (`../media_grant/media_access_grant_key_release.ts`); NIP-44 v2's own
 * base64 framing plus this payload's one additional JSON-encryption layer
 * inflate that by roughly 4/3 twice over, so this bound is set generously
 * above that (never used to silently truncate — a payload built by
 * `buildCommercePrivateMediaReleaseUnsignedEventRequest()` from a
 * genuinely-capped `wrapMediaAccessGrantRelease()` output can never exceed
 * it; this is a fail-closed sanity bound against a malformed/hostile wire
 * value, not a tuning knob).
 */
export const MAX_MEDIA_RELEASE_WIRE_CIPHERTEXT_CHARS = 200_000;

export const PRIVATE_MEDIA_RELEASE_MAX_REASON_CHARS = 200;
/** Bound on `contentType` — mirrors `ProductMedia.contentType`'s own informal MIME-type sizing; generous, never trusted as a real sniffed type. */
const MAX_CONTENT_TYPE_CHARS = 128;

interface PrivateMediaReleaseBaseFields {
  readonly category: "private-media-release";
  readonly formatVersion: 1;
  readonly orderId: string;
  readonly mediaId: string;
  readonly buyerPubkey: string;
  readonly sellerPubkey: string;
  readonly at: number;
}

export interface PrivateMediaReleaseReleasedPayload extends PrivateMediaReleaseBaseFields {
  readonly outcome: "released";
  /** The grant version this release was issued under — lets the buyer's own
   * process record which version it holds a real release for (mirrors
   * `MediaAccessGrantPayload.grantVersion`, never imported here). */
  readonly grantVersion: number;
  readonly contentType: string;
  /** SHA-256 hex digest of the DECRYPTED plaintext release bytes, computed
   * by the seller BEFORE wrapping (`../../catalog/product_media_content_address.ts`'s
   * `computeCommerceMediaContentHash()` — the SAME already-reviewed,
   * non-secret content-hash utility `IpfsMediaStore` itself already uses for
   * tamper detection, reused here rather than a new digest scheme). The
   * buyer's own process MUST recompute this over whatever
   * `unwrapMediaAccessGrantRelease()` actually returns and refuse to treat
   * the release as successful on any mismatch — see this arc's own mandate
   * item 4 ("truthful, visible failure state" on corrupt content). This is
   * NOT a quality/authenticity claim about the underlying media — only that
   * the bytes the buyer received are the exact bytes the seller wrapped. */
  readonly contentDigest: string;
  /** Output of `wrapMediaAccessGrantRelease()` — see this file's own header for the double-wrap discussion. */
  readonly wireCiphertext: string;
}

export interface PrivateMediaReleaseDeniedPayload extends PrivateMediaReleaseBaseFields {
  readonly outcome: "denied";
  /** Closed-vocabulary-in-practice (checked only for shape/length here, not
   * against a fixed enum — the seller side may report any
   * `MediaAccessDenialReason` from `../media_grant/media_access_grant_policy.ts`
   * OR a transport-level reason such as `"content-unavailable"`/
   * `"wrap-unavailable"`; this file does not import that union to keep its
   * own "pure wire shape, no domain knowledge" discipline, mirroring every
   * sibling sync-payload file). */
  readonly reason: string;
}

export type PrivateMediaReleasePayload = PrivateMediaReleaseReleasedPayload | PrivateMediaReleaseDeniedPayload;

const PRIVATE_MEDIA_RELEASE_ALLOWED_KEYS_RELEASED: ReadonlySet<string> = new Set([
  "category",
  "formatVersion",
  "orderId",
  "mediaId",
  "buyerPubkey",
  "sellerPubkey",
  "at",
  "outcome",
  "grantVersion",
  "contentType",
  "contentDigest",
  "wireCiphertext",
]);

const PRIVATE_MEDIA_RELEASE_ALLOWED_KEYS_DENIED: ReadonlySet<string> = new Set([
  "category",
  "formatVersion",
  "orderId",
  "mediaId",
  "buyerPubkey",
  "sellerPubkey",
  "at",
  "outcome",
  "reason",
]);

function isWellFormedPrivateMediaReleaseBaseFields(c: Record<string, unknown>): boolean {
  if (c.category !== "private-media-release") return false;
  if (c.formatVersion !== 1) return false;
  if (!isNonEmptyString(c.orderId)) return false;
  if (!isNonEmptyString(c.mediaId)) return false;
  if (!isHex64(c.buyerPubkey)) return false;
  if (!isHex64(c.sellerPubkey)) return false;
  if (c.buyerPubkey === c.sellerPubkey) return false;
  if (!isUnixSecondsInteger(c.at)) return false;
  return true;
}

/**
 * The single entry point every private-media-release transport
 * implementation MUST call before ever handing a payload to
 * `encryptNip44Wire`, AND every receiver MUST call before trusting a
 * decrypted payload's shape.
 */
export function isWellFormedPrivateMediaReleasePayload(value: unknown): value is PrivateMediaReleasePayload {
  if (typeof value !== "object" || value === null) return false;
  const c = value as Record<string, unknown>;
  if (c.outcome === "released") {
    if (!hasOnlyAllowedKeys(c, PRIVATE_MEDIA_RELEASE_ALLOWED_KEYS_RELEASED)) return false;
    if (!isWellFormedPrivateMediaReleaseBaseFields(c)) return false;
    if (!isPositiveInteger(c.grantVersion)) return false;
    if (typeof c.contentType !== "string" || c.contentType.length === 0 || c.contentType.length > MAX_CONTENT_TYPE_CHARS) return false;
    if (typeof c.contentDigest !== "string" || !/^[0-9a-f]{64}$/.test(c.contentDigest)) return false;
    if (typeof c.wireCiphertext !== "string" || c.wireCiphertext.length === 0 || c.wireCiphertext.length > MAX_MEDIA_RELEASE_WIRE_CIPHERTEXT_CHARS) {
      return false;
    }
    return true;
  }
  if (c.outcome === "denied") {
    if (!hasOnlyAllowedKeys(c, PRIVATE_MEDIA_RELEASE_ALLOWED_KEYS_DENIED)) return false;
    if (!isWellFormedPrivateMediaReleaseBaseFields(c)) return false;
    if (typeof c.reason !== "string" || c.reason.length === 0 || c.reason.length > PRIVATE_MEDIA_RELEASE_MAX_REASON_CHARS) return false;
    return true;
  }
  return false;
}
