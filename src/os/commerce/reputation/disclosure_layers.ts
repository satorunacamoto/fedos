/**
 * Reputation / Persona Epoch design arc — semi-public Persona Board
 * disclosure-layer design (§26).
 *
 * DESIGN + TYPE-ONLY SCAFFOLDING, same status as the other files in this
 * directory — see `persona_epoch.ts`'s header and `../README.md`. The
 * actual read-only Persona Board UI is explicitly NOT this wave's job (the
 * arc brief names it Wave B/coordinator's) — this file provides the layer
 * model, the view shapes, and a REAL, testable projection function a
 * future UI/IPC layer would call.
 *
 * THREE DISCLOSURE LAYERS
 * ----------------------------------------------------------------------
 * - PUBLIC — anyone, no proof of anything required. The narrowest layer.
 * - PSEUDONYMOUS_PROOF — a viewer who has independently verified SOME
 *   signed artifact tying them to a claim of pseudonymous standing (e.g. a
 *   verified `TradeCompletionAttestationPayload` naming them as
 *   counterparty, or a Trust `fedos.credential.v1`-shaped pseudonymous
 *   credential presented out of band — conceptually, never imported, see
 *   `attestation_types.ts`'s header on why `os/trust` is never imported
 *   here). Gets the SAME field set as PUBLIC in this design — see below for
 *   why this design does not widen the allowlist for this layer.
 * - AUTHORIZED — a viewer holding some SEPARATE, out-of-scope-for-this-file
 *   capability grant (conceptually a Trust `fedos.capability.v1`-shaped
 *   grant, e.g. issued to a dispute mediator or platform operator — again
 *   never imported here). Gets exact figures instead of coarse buckets, but
 *   is bound by the EXACT SAME hard exclusion list as the other two layers
 *   — see below.
 *
 * WHY PSEUDONYMOUS_PROOF DOES NOT GET MORE FIELDS THAN PUBLIC IN THIS
 * DESIGN
 * ----------------------------------------------------------------------
 * The arc brief's own allowlist ("Public/semi-public reputation
 * representation may expose ONLY: persona identifier/epoch,
 * aggregate/bucket, verified trade count, coarse category, attestation
 * references") is stated once, covering BOTH "public" and "semi-public" —
 * this design reads that as applying to both PUBLIC and PSEUDONYMOUS_PROOF
 * uniformly, rather than inventing an intermediate field set the brief
 * never specified. A future design iteration MAY decide
 * PSEUDONYMOUS_PROOF should unlock something PUBLIC doesn't (e.g. a
 * slightly finer bucket) — this file deliberately does not guess at that
 * and keeps the two identical until a real requirement names the
 * difference.
 *
 * THE HARD EXCLUSION LIST — APPLIES TO EVERY LAYER, INCLUDING AUTHORIZED
 * ----------------------------------------------------------------------
 * Real identity (name/address/email/phone), a full order record, exact
 * payment metadata, or another party's private counterparty history are
 * NEVER exposed at ANY layer by this design — not even AUTHORIZED. This is
 * not merely a display-time filtering choice: none of that data is even
 * MODELED as a field anywhere in this directory (`persona_epoch.ts`,
 * `attestation_types.ts`, `carry_over.ts` — grep confirms no such field
 * exists), consistent with this repo's existing pattern of never
 * collecting real-world PII for a Trust credential
 * (`src/os/trust/credentials/fedos_trust_pseudonymous_credential_types.ts`'s
 * header: "does NOT claim real-world identity") or a Commerce entitlement
 * check (`../creator/entitlement.ts`'s header: "never a payment/receipt
 * reference"). AUTHORIZED in this design means "sees EXACT figures instead
 * of coarse buckets," never "sees data categories PUBLIC/PSEUDONYMOUS_PROOF
 * cannot see at all" — there simply is no such additional data category in
 * this design to unlock.
 */

import type { TradeCompletionCategory } from "./attestation_types.js";
import { isWellFormedPersonaEpochId, isWellFormedPersonaEpochKeyPublicHex } from "./persona_epoch.js";

export type PersonaBoardDisclosureLayer = "PUBLIC" | "PSEUDONYMOUS_PROOF" | "AUTHORIZED";

const DISCLOSURE_LAYERS: readonly PersonaBoardDisclosureLayer[] = [
  "PUBLIC",
  "PSEUDONYMOUS_PROOF",
  "AUTHORIZED",
];

export function isPersonaBoardDisclosureLayer(value: unknown): value is PersonaBoardDisclosureLayer {
  return typeof value === "string" && (DISCLOSURE_LAYERS as readonly string[]).includes(value);
}

/**
 * A HYPOTHETICAL full backing record this design assumes SOME future
 * store would hold — not wired to any real persistence layer (Commerce has
 * none — see `../README.md`/`docs/architecture/ACTOR-MAP.md` §5's "AUTHORITATIVE
 * DATA: None"). Intentionally contains NOTHING beyond what's already
 * modeled in this directory's other files, to make the hard exclusion list
 * above structurally true rather than merely a display convention — there
 * is no real-identity/order/payment field here to accidentally leak.
 */
export interface PersonaBoardInternalRecord {
  readonly epochId: string;
  readonly epochKeyPublicHex: string;
  readonly verifiedTradeCount: number;
  /** Coarse category counts only — e.g. `{ digital_good: 12, service: 3 }` —
   * never a per-trade list. Keys are `TradeCompletionCategory`
   * (`attestation_types.ts`); using `Partial<Record<...>>` rather than a
   * required full map since most personas will not have traded in every
   * category. */
  readonly categoryBreakdown: Partial<Readonly<Record<TradeCompletionCategory, number>>>;
  /** Opaque attestation ids this count is backed by — same shape as
   * `ReputationAttestationPayload.attestationRefs` (`attestation_types.ts`). */
  readonly attestationRefs: readonly string[];
  readonly asOf: number;
}

/** Coarse, fixed bucket boundaries — a UI/design choice, not a
 * cryptographic property (see `attestation_types.ts`'s header on why no
 * bucketing here is a privacy GUARANTEE, only a display reduction). */
const VERIFIED_TRADE_COUNT_BUCKETS: readonly { readonly max: number; readonly label: string }[] = [
  { max: 0, label: "0" },
  { max: 4, label: "1-4" },
  { max: 19, label: "5-19" },
  { max: 49, label: "20-49" },
];

/** The final, catch-all bucket — kept as its own named constant (rather
 * than indexing the end of `VERIFIED_TRADE_COUNT_BUCKETS`) so
 * `bucketVerifiedTradeCount`'s fallback paths don't need a possibly-`undefined`
 * array access under this repo's `noUncheckedIndexedAccess` setting. */
const VERIFIED_TRADE_COUNT_WIDEST_BUCKET_LABEL = "50+";

/**
 * Buckets an exact verified-trade count into a coarse display label. Real,
 * testable logic (not just a type) — this is the exact function
 * `disclosure_layers.test.ts` exercises. Fails closed to the widest bucket
 * label on any malformed input, never throws (a display helper must never
 * crash a render path over a bad count).
 */
export function bucketVerifiedTradeCount(count: number): string {
  if (typeof count !== "number" || !Number.isInteger(count) || count < 0) {
    return VERIFIED_TRADE_COUNT_WIDEST_BUCKET_LABEL;
  }
  for (const bucket of VERIFIED_TRADE_COUNT_BUCKETS) {
    if (count <= bucket.max) return bucket.label;
  }
  return VERIFIED_TRADE_COUNT_WIDEST_BUCKET_LABEL;
}

/** The one category with the highest count, or `undefined` if
 * `categoryBreakdown` is empty or all-zero — PUBLIC/PSEUDONYMOUS_PROOF only
 * ever see this single coarse label, never the full breakdown (that is
 * AUTHORIZED-only, see `PersonaBoardAuthorizedView` below). Ties broken by
 * `TradeCompletionCategory`'s own declaration order for determinism. */
function primaryCategory(
  categoryBreakdown: Partial<Readonly<Record<TradeCompletionCategory, number>>>,
): TradeCompletionCategory | undefined {
  const entries = Object.entries(categoryBreakdown) as [TradeCompletionCategory, number][];
  let best: [TradeCompletionCategory, number] | undefined;
  for (const entry of entries) {
    if (entry[1] > 0 && (best === undefined || entry[1] > best[1])) best = entry;
  }
  return best?.[0];
}

/** Fields visible at PUBLIC and PSEUDONYMOUS_PROOF (identical in this
 * design — see this file's header). */
export interface PersonaBoardPublicView {
  readonly layer: "PUBLIC" | "PSEUDONYMOUS_PROOF";
  readonly epochId: string;
  readonly verifiedTradeCountBucket: string;
  readonly primaryCategory?: TradeCompletionCategory;
  readonly attestationRefs: readonly string[];
}

/** Fields visible at AUTHORIZED — exact figures, still bound by the same
 * hard exclusion list (see this file's header). */
export interface PersonaBoardAuthorizedView {
  readonly layer: "AUTHORIZED";
  readonly epochId: string;
  readonly epochKeyPublicHex: string;
  readonly verifiedTradeCount: number;
  readonly categoryBreakdown: Partial<Readonly<Record<TradeCompletionCategory, number>>>;
  readonly attestationRefs: readonly string[];
  readonly asOf: number;
}

export type PersonaBoardView = PersonaBoardPublicView | PersonaBoardAuthorizedView;

/**
 * Projects a `PersonaBoardInternalRecord` down to exactly what the given
 * layer may see. This IS the enforcement point for the hard exclusion list
 * — real, testable logic. Throws `RangeError` on a malformed record or an
 * unrecognized layer (an internal-programming-error case, unlike this
 * directory's other `isWellFormed*` functions which fail closed to
 * `false`/never-throw for externally-supplied data — this function's INPUT
 * is assumed to come from a trusted internal caller, since it is the
 * projection step itself, not a boundary parser).
 */
export function projectPersonaRecordToDisclosureLayer(
  record: PersonaBoardInternalRecord,
  layer: PersonaBoardDisclosureLayer,
): PersonaBoardView {
  if (!isWellFormedPersonaEpochId(record.epochId)) {
    throw new RangeError("persona board projection: record.epochId is not well-formed");
  }
  if (!isWellFormedPersonaEpochKeyPublicHex(record.epochKeyPublicHex)) {
    throw new RangeError("persona board projection: record.epochKeyPublicHex is not well-formed");
  }
  if (!isPersonaBoardDisclosureLayer(layer)) {
    throw new RangeError(`persona board projection: unrecognized disclosure layer "${String(layer)}"`);
  }

  if (layer === "AUTHORIZED") {
    return {
      layer: "AUTHORIZED",
      epochId: record.epochId,
      epochKeyPublicHex: record.epochKeyPublicHex,
      verifiedTradeCount: record.verifiedTradeCount,
      categoryBreakdown: record.categoryBreakdown,
      attestationRefs: record.attestationRefs,
      asOf: record.asOf,
    };
  }

  const category = primaryCategory(record.categoryBreakdown);
  return {
    layer,
    epochId: record.epochId,
    verifiedTradeCountBucket: bucketVerifiedTradeCount(record.verifiedTradeCount),
    ...(category !== undefined ? { primaryCategory: category } : {}),
    attestationRefs: record.attestationRefs,
  };
}
