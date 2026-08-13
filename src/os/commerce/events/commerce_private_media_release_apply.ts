/**
 * BUYER DISCOVERY + DIGITAL CONTENT DELIVERY mega-arc (Agent A) — the pure
 * ORCHESTRATION layer for the private-media-release request/response
 * channel, mirroring `../media_grant/media_access_grant_issuance.ts`'s own
 * "pure orchestration, testable in isolation... no I/O of its own, the
 * caller resolves references and passes them in already-resolved"
 * discipline. Both directions live here, one per real production caller:
 *
 *   `buildOutboundPrivateMediaReleaseResponse()` — the SELLER-side decision
 *   `fedos_electron_beta_main.cts`'s inbound-request handler calls for
 *   every genuine `PrivateMediaReleaseRequestPayload` it receives. Fixed
 *   gate order, identical in spirit to `handleCommerceMediaGrantRedeem()`'s
 *   own documented gate order (that function's header, read in full before
 *   writing this one):
 *     1. `evaluateInboundMediaReleaseRequestAuthorization()` — sender
 *        identity, addressed-to-me, real Order/media match (this arc's own
 *        `../media_grant/media_access_grant_release_channel_policy.ts`).
 *     2. `evaluateMediaAccessGrant()` — the REAL grant decision (signature,
 *        Order-status, expiry/revocation/version, wrong-buyer/wrong-media/
 *        wrong-signer) against the caller-supplied candidate envelope.
 *     3. Commerce Product-Media Sync + Truthful Completion mega-arc (Agent
 *        C) — CONTENT-IDENTITY verification, `"content-checksum-mismatch"`:
 *        before this function ever spends a decrypt on `media.storageRef`,
 *        it re-checks that the bytes ACTUALLY STORED under that
 *        `storageRef` still hash to `media.checksum` — the SAME checksum
 *        this product's own `ProductMedia` record declared at attach time
 *        (`../catalog/product_media_types.ts`'s `checksumSubject:
 *        "ciphertext"` rule for protected media, so this compares
 *        ciphertext-to-ciphertext, never plaintext-to-ciphertext). This is
 *        THE concrete enforcement of this arc's mandate item 2 ("the content
 *        identity matches the purchased ProductMedia declaration
 *        (checksum/commitment match)") — it catches a `storageRef` that
 *        silently drifted from the declared record (corruption, a
 *        mis-attributed re-attach, a bug in a future storage adapter),
 *        something the EXISTING self-consistency check on the buyer side
 *        (step 4 below) structurally cannot catch, since that check only
 *        proves the released bytes match whatever digest THIS function
 *        itself computed — never that the digest matches what the product
 *        actually declared. A mismatch denies BEFORE ever decrypting or
 *        wrapping anything.
 *     4. ONLY on ALLOW at every step above does this function ever call
 *        `getProtectedContent()` (the caller's own
 *        `IpfsMediaStore.getProtected()`-backed callback) or touch the
 *        Master-Seed-derived key AT ALL, via `wrapMediaAccessGrantRelease()`
 *        (which itself re-runs step 2 before ever calling
 *        `authority.encryptNip44Wire()` — belt AND braces, same as the
 *        redeem handler's own design).
 *   A denial at ANY step produces a bounded, reasoned `"denied"` response
 *   payload — never a thrown error, never a bare drop (see
 *   `commerce_private_media_release_sync.ts`'s own header for why a denial
 *   reply exists at all on this one channel).
 *
 *   `applyInboundPrivateMediaReleaseResponse()` — the BUYER-side reaction
 *   to an inbound `PrivateMediaReleasePayload`. Fixed gate order:
 *     1. `evaluateInboundMediaReleaseResponseAuthorization()` — the real,
 *        verified sender must be this Order's own real seller, addressed to
 *        this buyer, for the expected order/media pair.
 *     2. On `outcome: "denied"` — surfaced as-is, honestly, never silently
 *        dropped (this arc's own mandate item 4).
 *     3. On `outcome: "released"` — `unwrapMediaAccessGrantRelease()`
 *        (`../media_grant/media_access_grant_key_release.ts`, already
 *        written, previously unused by any production caller); a `null`
 *        result (wrong counterparty, tampered ciphertext, unavailable
 *        authority) is `"wrap-unavailable"`, never a fabricated success.
 *     4. THE CONTENT-INTEGRITY CHECK this arc's own mandate item 4 requires:
 *        recompute the SHA-256 digest of whatever bytes
 *        `unwrapMediaAccessGrantRelease()` actually returned
 *        (`../catalog/product_media_content_address.ts`'s
 *        `computeCommerceMediaContentHash()` — reused, not reinvented) and
 *        compare against `payload.contentDigest`. A NIP-44 wire ciphertext
 *        that happens to decrypt to SOME bytes (e.g. under a fake/degraded
 *        transport in a test, or a genuinely corrupted upstream store) but
 *        does not match the digest the seller committed to is
 *        `"content-corrupt"` — this function NEVER treats a digest mismatch
 *        as success, and never asks the caller to "just attest you received
 *        it" instead.
 *     5. Only once ALL FOUR steps pass does this function return
 *        `"verified"` with the ready-to-persist `MediaReleaseContentRecord`
 *        (`../media_grant/persistence/durable_media_release_content_cache.ts`)
 *        — the caller is responsible for actually calling
 *        `DurableMediaReleaseContentCache.putRelease()` with it (this file
 *        does no I/O of its own, matching this file's own header
 *        discipline).
 */

import { evaluateMediaAccessGrant, type EvaluateMediaAccessGrantInput, type MediaAccessDenialReason } from "../media_grant/media_access_grant_policy.js";
import { wrapMediaAccessGrantRelease, unwrapMediaAccessGrantRelease } from "../media_grant/media_access_grant_key_release.js";
import type { FedosMasterSeedAuthority } from "../../core/vault/wasm/fedos_master_seed_authority.js";
import { computeCommerceMediaContentHash, verifyCommerceMediaContentAddress } from "../catalog/product_media_content_address.js";
import {
  evaluateInboundMediaReleaseRequestAuthorization,
  evaluateInboundMediaReleaseResponseAuthorization,
  type MediaReleaseRequestOrderLike,
  type MediaReleaseRequestMediaLike,
} from "../media_grant/media_access_grant_release_channel_policy.js";
import type { PrivateMediaReleaseRequestPayload, PrivateMediaReleasePayload } from "./commerce_private_media_release_sync.js";
import type { MediaReleaseContentRecord } from "../media_grant/persistence/durable_media_release_content_cache.js";

/** `evaluateMediaAccessGrant()` additionally needs `Order.status` (`isQualifyingOrderStatusForMediaAccess()`) — a field the request-authorization policy's own narrower `MediaReleaseRequestOrderLike` deliberately omits (it doesn't need it). This orchestration layer needs the wider shape. */
export interface MediaReleaseRequestOrderWithStatusLike extends MediaReleaseRequestOrderLike {
  readonly status: string;
}

// ---------------------------------------------------------------------------
// Seller side: build the response to an inbound request
// ---------------------------------------------------------------------------

export interface BuildOutboundPrivateMediaReleaseResponseInput {
  readonly requestPayload: PrivateMediaReleaseRequestPayload;
  /** The REAL, cryptographically verified outer-event signer of the inbound request. */
  readonly senderPubkeyHex: string;
  /** This seller process's own real identity for the account the request arrived on. */
  readonly ownPubkeyHex: string;
  readonly order: MediaReleaseRequestOrderWithStatusLike | undefined;
  /** Must include `storageRef`/`contentType`/`checksum` — fields `MediaReleaseRequestMediaLike` itself does not carry (that policy type only needs id/productId/classification). `checksum` is this product's own declared `ProductMedia.checksum` (`../catalog/product_media_types.ts`) — for `classification: "protected"` media this is a CIPHERTEXT-subject digest (`checksumSubject: "ciphertext"`), the exact quantity `getStoredCiphertextChecksum` below re-derives from the actual store. */
  readonly media: (MediaReleaseRequestMediaLike & { readonly storageRef: string; readonly contentType: string; readonly checksum: string }) | undefined;
  /** The candidate `MediaAccessGrantEnvelope` for `(mediaId, buyerPubkey, orderId)` at its latest known version, if any — `undefined` means "no grant on file", handled the same as `evaluateMediaAccessGrant()`'s own `envelope: undefined` case. */
  readonly candidateGrantEnvelope: EvaluateMediaAccessGrantInput["envelope"];
  readonly latestKnownGrantVersion: number;
  readonly now: number;
  readonly merchantAccountIndex: number;
  /** The SELLER's own, already-unlocked authority — never constructed fresh by this function. */
  readonly authority: FedosMasterSeedAuthority;
  /**
   * Commerce Product-Media Sync + Truthful Completion mega-arc (Agent C) —
   * synchronous CONTENT-IDENTITY check: the checksum of whatever bytes are
   * ACTUALLY stored under `storageRef` right now (e.g.
   * `IpfsMediaStore.metadata(storageRef)?.checksum ?? null`), never a bare
   * re-statement of `media.checksum` itself — this callback's whole purpose
   * is to let this function catch the two drifting apart. Sync, since every
   * real `MediaStorePort.metadata()` implementation in this codebase already
   * is (`../catalog/media_store_port.ts`). `null` means "unavailable" and is
   * treated as a mismatch (fail closed).
   */
  readonly getStoredCiphertextChecksum: (storageRef: string) => string | null;
  /** The caller's own `IpfsMediaStore.getProtected()`-backed callback — only ever invoked AFTER the grant independently evaluates ALLOW AND the content-identity check above passes. */
  readonly getProtectedContent: (storageRef: string) => Promise<Uint8Array | null>;
}

/**
 * Always returns a well-formed `PrivateMediaReleasePayload` — never throws,
 * never returns `undefined`. `outcome: "denied"` on ANY failure at ANY
 * gate, with a reason string; `outcome: "released"` only once every gate
 * has genuinely passed.
 */
export async function buildOutboundPrivateMediaReleaseResponse(
  input: BuildOutboundPrivateMediaReleaseResponseInput,
): Promise<PrivateMediaReleasePayload> {
  const base = {
    category: "private-media-release" as const,
    formatVersion: 1 as const,
    orderId: input.requestPayload.orderId,
    mediaId: input.requestPayload.mediaId,
    buyerPubkey: input.requestPayload.buyerPubkey,
    sellerPubkey: input.requestPayload.sellerPubkey,
    at: input.now,
  };
  const denied = (reason: string): PrivateMediaReleasePayload => ({ ...base, outcome: "denied", reason });

  const authorization = evaluateInboundMediaReleaseRequestAuthorization({
    payload: input.requestPayload,
    senderPubkeyHex: input.senderPubkeyHex,
    ownPubkeyHex: input.ownPubkeyHex,
    order: input.order,
    media: input.media,
  });
  if (!authorization.authorized) return denied(authorization.reason);
  // Narrowed non-undefined by the authorization check above.
  const order = input.order as MediaReleaseRequestOrderWithStatusLike;
  const media = input.media as MediaReleaseRequestMediaLike & { readonly storageRef: string; readonly contentType: string; readonly checksum: string };

  const decision = evaluateMediaAccessGrant({
    envelope: input.candidateGrantEnvelope,
    media: { id: media.id, productId: media.productId },
    actorPubkey: input.requestPayload.buyerPubkey,
    order: order as unknown as EvaluateMediaAccessGrantInput["order"],
    now: input.now,
    latestKnownGrantVersion: input.latestKnownGrantVersion,
  });
  if (!decision.allowed) return denied(decision.reason);

  // Commerce Product-Media Sync + Truthful Completion mega-arc (Agent C) —
  // CONTENT-IDENTITY gate, BEFORE ever touching the decryption key. See this
  // file's own header, step 3. Fail-closed: `null` (store has no record for
  // this `storageRef`, or the caller's callback itself is unavailable) is
  // treated exactly like an explicit mismatch, never like "skip the check".
  const storedChecksum = input.getStoredCiphertextChecksum(media.storageRef);
  if (storedChecksum === null || storedChecksum !== media.checksum) {
    return denied("content-checksum-mismatch");
  }

  const decrypted = await input.getProtectedContent(media.storageRef);
  if (decrypted === null) return denied("content-unavailable");

  const contentDigest = computeCommerceMediaContentHash(decrypted);
  const finalWrap = await wrapMediaAccessGrantRelease({
    envelope: input.candidateGrantEnvelope,
    media: { id: media.id, productId: media.productId },
    actorPubkey: input.requestPayload.buyerPubkey,
    order: order as unknown as EvaluateMediaAccessGrantInput["order"],
    now: input.now,
    latestKnownGrantVersion: input.latestKnownGrantVersion,
    merchantAccountIndex: input.merchantAccountIndex,
    releasePayload: decrypted,
    authority: input.authority,
  });
  if (finalWrap.outcome !== "released") {
    const reason: MediaAccessDenialReason | "payload-too-large" | "wrap-unavailable" =
      finalWrap.outcome === "denied" ? finalWrap.reason : finalWrap.outcome;
    return denied(reason);
  }

  return {
    ...base,
    outcome: "released",
    grantVersion: finalWrap.grant.grantVersion,
    contentType: media.contentType ?? "application/octet-stream",
    contentDigest,
    wireCiphertext: finalWrap.wireCiphertext,
  } as PrivateMediaReleasePayload;
}

// ---------------------------------------------------------------------------
// Buyer side: apply an inbound response
// ---------------------------------------------------------------------------

export interface ApplyInboundPrivateMediaReleaseResponseInput {
  readonly payload: PrivateMediaReleasePayload;
  /** The REAL, cryptographically verified outer-event signer of the inbound response. */
  readonly senderPubkeyHex: string;
  /** This buyer's own real identity for the account the response arrived on. */
  readonly ownPubkeyHex: string;
  readonly order: { readonly id: string; readonly sellerPubkey: string };
  readonly expectedMediaId: string;
  readonly buyerAccountIndex: number;
  /** The BUYER's own, already-unlocked authority — a DIFFERENT instance than the seller's. */
  readonly authority: FedosMasterSeedAuthority;
}

export type ApplyInboundPrivateMediaReleaseResponseOutcome =
  | { readonly outcome: "verified"; readonly record: MediaReleaseContentRecord }
  | { readonly outcome: "denied"; readonly reason: string }
  | { readonly outcome: "unauthorized"; readonly reason: string }
  | { readonly outcome: "wrap-unavailable" }
  | { readonly outcome: "content-corrupt" };

/**
 * Never throws. Returns `"verified"` ONLY once sender authorization,
 * unwrap, AND digest verification have ALL genuinely passed — see this
 * file's own header for the full four-gate account.
 */
export async function applyInboundPrivateMediaReleaseResponse(
  input: ApplyInboundPrivateMediaReleaseResponseInput,
): Promise<ApplyInboundPrivateMediaReleaseResponseOutcome> {
  const authorization = evaluateInboundMediaReleaseResponseAuthorization({
    payload: input.payload,
    senderPubkeyHex: input.senderPubkeyHex,
    ownPubkeyHex: input.ownPubkeyHex,
    order: input.order,
    expectedMediaId: input.expectedMediaId,
  });
  if (!authorization.authorized) return { outcome: "unauthorized", reason: authorization.reason };

  if (input.payload.outcome === "denied") {
    return { outcome: "denied", reason: input.payload.reason };
  }

  const unwrapped = await unwrapMediaAccessGrantRelease({
    buyerAccountIndex: input.buyerAccountIndex,
    merchantPubkeyHex: input.order.sellerPubkey,
    wireCiphertext: input.payload.wireCiphertext,
    authority: input.authority,
  });
  if (unwrapped === null) return { outcome: "wrap-unavailable" };

  if (!verifyCommerceMediaContentAddress(unwrapped, input.payload.contentDigest)) {
    return { outcome: "content-corrupt" };
  }

  const record: MediaReleaseContentRecord = {
    orderId: input.payload.orderId,
    mediaId: input.payload.mediaId,
    buyerPubkey: input.payload.buyerPubkey,
    sellerPubkey: input.payload.sellerPubkey,
    grantVersion: input.payload.grantVersion,
    contentType: input.payload.contentType,
    contentDigest: input.payload.contentDigest,
    contentBase64: Buffer.from(unwrapped).toString("base64"),
    obtainedAt: input.payload.at,
  };
  return { outcome: "verified", record };
}
