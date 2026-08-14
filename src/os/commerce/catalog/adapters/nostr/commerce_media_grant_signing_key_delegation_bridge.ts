/**
 * Real Digital Delivery mega-arc (Agent G, Grant Custody pass) — closes
 * Blocker 5: `MediaAccessGrant`'s own `evaluateMediaAccessGrant()`
 * (`../../media_grant/media_access_grant_policy.ts`) and
 * `issueMediaAccessGrantsForOrder()`
 * (`../../media_grant/media_access_grant_issuance.ts`) both require the
 * grant-signing key's public key to equal `order.sellerPubkey` LITERALLY —
 * a check that is structurally UNSATISFIABLE for a real seller, because the
 * durable media-grant-signing keypair
 * (`../../media_grant/persistence/durable_media_grant_signing_key_store.ts`,
 * `resolveCommerceMediaGrantSigningKeypair()`) is, by design, a FRESH,
 * CSPRNG-random keypair, independent of `order.sellerPubkey` (the seller's
 * REAL Nostr identity, `activeLocalIdentity.accountPublicIdentifier`) —
 * see that file's own header, "IMPORTANT, DISCLOSED LIMITATION". Two
 * unrelated keys can never be literally equal (short of solving the
 * discrete log problem), so that check was, for every real (non-demo)
 * seller, ALWAYS false — the entire `MediaAccessGrant` system had zero
 * production callers that could ever actually succeed.
 *
 * *** WHAT THIS FILE ADDS, AND WHY IT NEEDS NO NEW KEY CUSTODY ***
 * This does NOT introduce a new signing key, a global FedOS authority, or
 * any raw-key-in-JS-renderer shortcut. It reuses, a SIXTH time, the exact
 * real, already-reviewed primitive every other Commerce private-sync
 * channel in this same directory already uses to bind an artifact to a
 * seller's REAL identity: `FedosNostrSigningAuthority.signEvent()` (WASM-
 * backed, signs with the account's own real, Master-Seed-derived Nostr
 * identity key) + `NobleSignatureVerifier` (real BIP-340 Schnorr
 * verification, already reviewed, already used by every sibling bridge in
 * this exact directory).
 *
 * THE MECHANISM — a one-statement DELEGATION CERTIFICATE, not a new root:
 * the seller's REAL Nostr identity key signs ONE small, real Nostr event
 * (`kind: 1`, domain-tagged, mirroring every sibling bridge's own
 * tag-based domain separation) whose content names the ALREADY-EXISTING,
 * ALREADY-DURABLE, ALREADY-SEALED media-grant-signing public key
 * (`resolveCommerceMediaGrantSigningKeypair()`'s own output, unchanged) as
 * authorized, in this ONE domain, to sign `MediaAccessGrant`s on the real
 * identity's behalf. This is the smallest addition that makes the
 * ALREADY-BUILT delegate-key custody architecture actually usable: the
 * delegate key's own storage/durability/opaque-handle discipline is
 * UNCHANGED (this file mints no key and touches no seal); the ONLY new
 * thing is a real, independently-verifiable PROOF that a specific delegate
 * key really speaks for a specific real seller.
 *
 * WHY THIS IS A REAL SECURITY BOUNDARY, NOT A RUBBER STAMP: `event.pubkey`
 * on a genuinely-signed Nostr event is cryptographically tied to the
 * private key that produced `event.sig` (NIP-01: `sig` must verify against
 * `sha256(serializeForId(event))` under exactly `event.pubkey`) — Mallory,
 * signing with her OWN real identity key, can never produce an event whose
 * `pubkey` field verifiably equals Bob's real pubkey, regardless of what
 * string she writes into that field or into `content`. This holds even
 * fully offline / same-process — it is not contingent on relay delivery or
 * an outer transport (this file's own certificate never needs to leave the
 * seller's own device to be meaningful: it is minted and verified by the
 * SAME process, using the account's own already-unlocked identity, as a
 * self-contained, replayable, auditable proof — see
 * `media_access_grant_issuance.ts`'s and `media_access_grant_policy.ts`'s
 * own updated headers for exactly how the verified result of this file's
 * `verifyMediaGrantSigningKeyDelegationEvent()` is consumed).
 *
 * SCOPE: this certificate is consumed LOCALLY (composition root verifies
 * it before ever populating `sellerAuthorizedDelegateSigningKeys`) — it is
 * NOT currently published to a relay or transmitted to a buyer. The
 * existing cross-process buyer-facing guarantee for actual bytes already
 * comes from an INDEPENDENT, already-real, already-tested layer:
 * `evaluateInboundMediaReleaseResponseAuthorization()`
 * (`../../media_grant/media_access_grant_release_channel_policy.ts`)
 * verifies the OUTER `private-media-release` response event's own real
 * signer equals `order.sellerPubkey` BEFORE a buyer ever trusts anything
 * inside it — that check is unchanged and unweakened by this file. This
 * file's certificate exists to unblock the SELLER's own local
 * issuance/evaluation gate, which is the thing Blocker 5 actually named.
 */

import { isNostrEvent } from "../../../../messenger/adapters/nostr/protocol/event.js";
import { NobleSignatureVerifier } from "../../../../messenger/adapters/nostr/protocol/noble_signature.js";
import type { SignatureVerifier } from "../../../../messenger/adapters/nostr/protocol/signature.js";
import type { NostrEvent } from "../../../../messenger/adapters/nostr/protocol/types.js";
import {
  freezeFedosNostrUnsignedEventRequest,
  isWellFormedFedosNostrUnsignedEventRequest,
  type FedosNostrSigningAuthority,
  type FedosNostrUnsignedEventRequest,
} from "../../../../messenger/adapters/nostr/protocol/sign/fedos_nostr_signing_authority.js";

/** Same fixed `kind` every sibling private-sync/declaration bridge in this directory already uses — see `FedosNostrSigningAuthority`'s own closed `kind` allowlist. */
export const COMMERCE_MEDIA_GRANT_DELEGATION_EVENT_KIND = 1;
/** Distinct topic namespace — never collides with any other Commerce tag on the wire. */
export const COMMERCE_MEDIA_GRANT_DELEGATION_TAG = "fedos-commerce:media-grant-signing-key-delegation:v1";
/** Fixed content-level purpose string — domain-separates this delegation from any future, differently-scoped delegation this same mechanism might someday carry. */
export const COMMERCE_MEDIA_GRANT_DELEGATION_PURPOSE = "commerce-media-access-grant-signing-key";

const HEX_64_PATTERN = /^[0-9a-f]{64}$/;

export interface MediaGrantSigningKeyDelegationContent {
  readonly formatVersion: 1;
  readonly purpose: typeof COMMERCE_MEDIA_GRANT_DELEGATION_PURPOSE;
  readonly delegateKeyPublicHex: string;
}

function isWellFormedDelegationContent(value: unknown): value is MediaGrantSigningKeyDelegationContent {
  if (typeof value !== "object" || value === null) return false;
  const c = value as Record<string, unknown>;
  if (Object.keys(c).length !== 3) return false;
  if (c.formatVersion !== 1) return false;
  if (c.purpose !== COMMERCE_MEDIA_GRANT_DELEGATION_PURPOSE) return false;
  if (typeof c.delegateKeyPublicHex !== "string" || !HEX_64_PATTERN.test(c.delegateKeyPublicHex)) return false;
  return true;
}

/** Builds the unsigned event request a real `FedosNostrSigningAuthority` must sign — `null` on a malformed `delegateKeyPublicHex`, never throws. */
export function buildMediaGrantSigningKeyDelegationUnsignedEventRequest(
  delegateKeyPublicHex: string,
  accountIndex: number,
  createdAt: number,
): FedosNostrUnsignedEventRequest | null {
  if (typeof delegateKeyPublicHex !== "string" || !HEX_64_PATTERN.test(delegateKeyPublicHex)) return null;
  const content: MediaGrantSigningKeyDelegationContent = {
    formatVersion: 1,
    purpose: COMMERCE_MEDIA_GRANT_DELEGATION_PURPOSE,
    delegateKeyPublicHex,
  };
  const request: FedosNostrUnsignedEventRequest = {
    accountIndex,
    createdAt,
    kind: COMMERCE_MEDIA_GRANT_DELEGATION_EVENT_KIND,
    tags: [["t", COMMERCE_MEDIA_GRANT_DELEGATION_TAG]],
    content: JSON.stringify(content),
  };
  if (!isWellFormedFedosNostrUnsignedEventRequest(request)) return null;
  return freezeFedosNostrUnsignedEventRequest(request);
}

/**
 * Mints ONE real, seller-identity-signed delegation certificate via
 * `signingAuthority` (the seller's OWN, already-unlocked real Nostr
 * identity — never constructed fresh by this function). `null` on a
 * malformed input or if the signing authority itself declines/fails —
 * never throws, never fabricates a certificate.
 */
export async function signMediaGrantSigningKeyDelegation(
  signingAuthority: FedosNostrSigningAuthority,
  delegateKeyPublicHex: string,
  accountIndex: number,
  createdAt: number,
): Promise<NostrEvent | null> {
  const request = buildMediaGrantSigningKeyDelegationUnsignedEventRequest(delegateKeyPublicHex, accountIndex, createdAt);
  if (request === null) return null;
  try {
    return await signingAuthority.signEvent(request);
  } catch {
    return null;
  }
}

export type VerifyMediaGrantSigningKeyDelegationOutcome =
  | "valid"
  | "malformed"
  | "wrong-kind"
  | "wrong-tag"
  | "signature-invalid"
  | "seller-mismatch"
  | "delegate-mismatch";

export type VerifyMediaGrantSigningKeyDelegationResult =
  | { readonly outcome: "valid"; readonly sellerPubkeyHex: string; readonly delegateKeyPublicHex: string }
  | { readonly outcome: Exclude<VerifyMediaGrantSigningKeyDelegationOutcome, "valid"> };

export interface VerifyMediaGrantSigningKeyDelegationOptions {
  /** The REAL seller pubkey (`order.sellerPubkey`) this certificate must literally equal `event.pubkey` against — the whole point of this check. */
  readonly expectedSellerPubkeyHex: string;
  /** The SPECIFIC delegate signing key this certificate must name — a certificate that validly names a DIFFERENT delegate key (e.g. an old, rotated-away key) does not authorize the NEW one. */
  readonly expectedDelegateKeyPublicHex: string;
  readonly verifier?: SignatureVerifier;
}

/**
 * Independently, cryptographically verifies a candidate delegation
 * certificate — fixed check order, fails closed, never throws:
 *   1. Structural Nostr-event well-formedness (`isNostrEvent`).
 *   2. `kind`/domain tag match (this delegation, never any other artifact
 *      that happens to reuse `kind: 1`).
 *   3. The REAL Schnorr signature verifies (`NobleSignatureVerifier` by
 *      default, injectable for tests) — this is what makes `event.pubkey`
 *      trustworthy at all; skipping this step would let ANY caller simply
 *      write any desired `pubkey` into an unsigned/malformed object.
 *   4. `event.pubkey === expectedSellerPubkeyHex` LITERALLY — "Mallory
 *      signs her own certificate, but it can never verify as Bob's" is
 *      enforced exactly here.
 *   5. Content well-formedness + `delegateKeyPublicHex` match.
 */
export async function verifyMediaGrantSigningKeyDelegationEvent(
  event: unknown,
  options: VerifyMediaGrantSigningKeyDelegationOptions,
): Promise<VerifyMediaGrantSigningKeyDelegationResult> {
  if (!isNostrEvent(event)) return { outcome: "malformed" };
  if (event.kind !== COMMERCE_MEDIA_GRANT_DELEGATION_EVENT_KIND) return { outcome: "wrong-kind" };
  const hasTag = event.tags.some((tag) => tag[0] === "t" && tag[1] === COMMERCE_MEDIA_GRANT_DELEGATION_TAG);
  if (!hasTag) return { outcome: "wrong-tag" };

  const verifier = options.verifier ?? NobleSignatureVerifier;
  let sigOk: boolean;
  try {
    sigOk = await verifier.verify(event);
  } catch {
    sigOk = false;
  }
  if (!sigOk) return { outcome: "signature-invalid" };

  if (event.pubkey !== options.expectedSellerPubkeyHex) return { outcome: "seller-mismatch" };

  let parsed: unknown;
  try {
    parsed = JSON.parse(event.content);
  } catch {
    return { outcome: "malformed" };
  }
  if (!isWellFormedDelegationContent(parsed)) return { outcome: "malformed" };
  if (parsed.delegateKeyPublicHex !== options.expectedDelegateKeyPublicHex) return { outcome: "delegate-mismatch" };

  return { outcome: "valid", sellerPubkeyHex: event.pubkey, delegateKeyPublicHex: parsed.delegateKeyPublicHex };
}
