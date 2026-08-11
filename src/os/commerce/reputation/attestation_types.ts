/**
 * Reputation / Persona Epoch design arc — `TradeCompletionAttestation` and
 * `ReputationAttestation` payload schemas.
 *
 * DESIGN + TYPE-ONLY SCAFFOLDING, same status as `persona_epoch.ts` — see
 * that file's header and `../README.md`.
 *
 * WHAT THESE ARE
 * ----------------------------------------------------------------------
 * `TradeCompletionAttestationPayload` — a SINGLE counterparty's signed
 * statement that one trade with a `PersonaEpoch` (`persona_epoch.ts`)
 * completed, with a coarse outcome label. This is the raw, per-trade unit.
 *
 * `ReputationAttestationPayload` — a coarser, DERIVED statement aggregating
 * some number of `TradeCompletionAttestationPayload`s into the kind of
 * summary a Persona Board (`disclosure_layers.ts`) would actually show:
 * "this epoch has N verified trade completions", not a list of every trade.
 *
 * SIGNING/VERIFICATION FLOW (conceptual — this file defines PAYLOAD SHAPES
 * only, not signing code)
 * ----------------------------------------------------------------------
 * Both payload types are designed to be carried inside an envelope shaped
 * exactly like `src/os/trust/envelope/fedos_trust_envelope_types.ts`'s
 * `FedosTrustSignedEnvelope<TPayload>` — same field set (`version`, `type`,
 * `issuer`, `subject`, `audience`, `issuedAt`, `expiresAt`, `nonce`,
 * `payload`, `signatureAlgorithm`, `keyId`, `signature`), same Schnorr/
 * secp256k1-over-canonical-bytes signing discipline described in that file
 * and in `src/os/trust/envelope/fedos_trust_envelope_sign.ts`. This file
 * defines `ReputationLocalSignedEnvelopeShape<TPayload>` below as an
 * INDEPENDENT, LOCAL mirror of that shape rather than importing it — see
 * that type's own doc comment and `trust_issuance_port.ts`'s header for
 * exactly why, and exactly which single future import replaces this
 * mirror once the coordinator relaxes the boundary test.
 *
 * A real implementation would:
 *   1. Have the completing counterparty sign a `TradeCompletionAttestationPayload`
 *      with THEIR OWN `PersonaEpoch` signing key (see `persona_epoch.ts`'s
 *      header on why that key is independent of messaging/Double-Ratchet
 *      material) — domain-separated under a NEW envelope `type` literal
 *      (e.g. `"fedos.commerce.trade-completion.v1"`), never by reusing an
 *      existing Trust `type` literal for a new purpose (this repo's own
 *      protocol-design discipline: never repurpose a signed envelope's
 *      domain-separation field).
 *   2. Optionally, an aggregator (which could be the subject epoch itself,
 *      self-attesting its own accumulated count, or a separate reputation
 *      service the subject opts into) signs a `ReputationAttestationPayload`
 *      referencing some set of prior `TradeCompletionAttestationPayload`s by
 *      opaque id — again under its own new envelope `type` literal
 *      (e.g. `"fedos.commerce.reputation-summary.v1"`).
 *   3. A verifier resolves `issuer`/`keyId` against ITS OWN chosen
 *      `FedosTrustPolicy`-shaped trust configuration (mirroring
 *      `src/os/trust/policy/fedos_trust_policy_types.ts`'s "verifier-selected
 *      trust, not a universal root" design) and calls a verify function
 *      shaped like `verifyFedosTrustEnvelopeV1()`, with a canonicalizer
 *      specific to whichever of these two payload shapes it is verifying —
 *      following `src/os/trust/envelope/fedos_trust_canonical_bytes.ts`'s
 *      "every domain owns its own payload canonicalizer" convention.
 *
 * WHAT THIS FILE DOES NOT CLAIM
 * ----------------------------------------------------------------------
 * A valid signature over either payload below proves exactly one thing:
 * "the key identified by `attestorEpochKeyPublicHex` (for a trade
 * completion) or `issuer`/`keyId` (for a reputation summary) signed these
 * bytes." It does NOT prove:
 *   - That the signer is a unique real human, or even a unique persona —
 *     nothing here provides Sybil resistance. Any actor who can generate an
 *     unlimited number of `PersonaEpoch` keypairs (which is free — see
 *     `persona_epoch.ts`, key generation is a local CSPRNG call with no
 *     issuer gate) can generate an unlimited number of counterparties to
 *     attest trades with itself. A completed-trade attestation proves "a
 *     configured counterparty signed this," never "this reputation is
 *     Sybil-resistant" or "this represents a unique real trading partner."
 *     State this limitation to a user wherever a trade-completion count is
 *     ever surfaced — do not let a UI imply more than this.
 *   - Zero-knowledge anything. No ZK primitive (range proof, membership
 *     proof, commitment scheme with hiding+binding properties, etc.) exists
 *     anywhere in this repository today (confirmed by repo-wide search —
 *     the only cryptography in `src/os/trust/` is Schnorr/secp256k1 signing
 *     and SHA-256 hashing via `@noble/curves`/`@noble/hashes`). Any coarse
 *     bucketing/aggregation this design does (see
 *     `ReputationAttestationPayload.verifiedTradeCount` and
 *     `disclosure_layers.ts`) is plain reduction of information shown, NOT
 *     a cryptographic privacy guarantee — a verifier with AUTHORIZED-layer
 *     access still sees the real number, and the aggregator that
 *     constructed the summary always saw every underlying trade.
 *   - That the trade was fair, that goods/services were actually delivered
 *     to spec, or anything about quality — only that the counterparty
 *     signing this attestation asserts the trade reached the stated
 *     `outcome`.
 *
 * FIELDS DELIBERATELY EXCLUDED FROM BOTH PAYLOADS (privacy boundary)
 * ----------------------------------------------------------------------
 * Neither payload below has, or may ever gain, a field carrying: the real
 * Commerce order id (`Order`/`PurchaseGrant` reference — see
 * `../catalog/types.ts`'s `PurchaseGrant`), the exact price/amount, the
 * counterparty's real-world identity (name/address/email/phone), exact
 * payment metadata (rail, transaction id, invoice reference), or any
 * free-text comment/note field. The last exclusion is deliberate and
 * grounded in this repo's own prior finding (Merchant Passport tracks
 * L/M/N review) that a free-text `comment` field is the one practically
 * unbounded, hard-to-canonicalize, privacy-risky field in an otherwise
 * bounded signed-record design — so neither payload here defines one, ever.
 * `tradeRefDigestHex` below is the one place a trade is referenced at all,
 * and it is a ONE-WAY DIGEST the completing parties compute locally, never
 * the raw order id itself (see that field's own doc comment).
 *
 * `isWellFormedTradeCompletionAttestationPayload` /
 * `isWellFormedReputationAttestationPayload` below reject ANY payload
 * object carrying a key outside their respective fixed allowlist — this is
 * a deliberately stricter posture than this repo's own Trust envelope
 * verifier, which is documented elsewhere (Merchant Passport tracks S/T/U/V
 * review) to silently tolerate unknown envelope keys; a reputation payload
 * is exactly the kind of artifact where an accidentally-added extra field
 * (e.g. a debug field someone wires up containing a real order id) must be
 * rejected outright rather than silently passed through to a verifier or a
 * UI.
 */

/** Independent, local mirror of
 * `src/os/trust/envelope/fedos_trust_envelope_types.ts`'s
 * `FedosTrustSignedEnvelope<TPayload>` — same field names and meanings,
 * duplicated rather than imported because `src/os/commerce` must not import
 * `src/os/trust` today (enforced by `test/architecture_boundary_trust.test.ts`,
 * which this design does not modify — see `trust_issuance_port.ts`'s header
 * for the one Port file the coordinator will make the single, deliberate
 * exception for). `type` here is deliberately `string`, not the real
 * `FedosTrustEnvelopeType` union, since this mirror must not need to change
 * whenever that union gains a new domain literal in `os/trust`. */
export interface ReputationLocalSignedEnvelopeShape<TPayload> {
  readonly version: number;
  readonly type: string;
  readonly issuer: string;
  readonly subject?: string;
  readonly audience?: string;
  readonly issuedAt: number;
  readonly expiresAt?: number;
  readonly nonce?: string;
  readonly payload: TPayload;
  readonly signatureAlgorithm: string;
  readonly keyId: string;
  readonly signature: string;
}

/** Coarse, closed outcome label — never a dispute transcript, never a
 * reason string with free text (see this file's header on why no
 * free-text field exists anywhere in this design). */
export type TradeCompletionOutcome =
  | "completed_as_agreed"
  | "completed_with_dispute"
  | "not_completed";

/** Coarse, closed category label. Deliberately much coarser than a real
 * `Product.kind` (`../catalog/types.ts`'s `"pdf" | "zip" | "template" |
 * "software" | "link" | "other"`) — a reputation attestation must never let
 * a verifier reconstruct which specific product/listing was involved. */
export type TradeCompletionCategory =
  | "digital_good"
  | "physical_good"
  | "service"
  | "other";

/**
 * Payload of a single completed-trade attestation, signed by the
 * COMPLETING COUNTERPARTY's own `PersonaEpoch` key (see `persona_epoch.ts`).
 * Carried inside a `ReputationLocalSignedEnvelopeShape<TradeCompletionAttestationPayload>`
 * — see this file's header for the conceptual envelope/signing flow.
 */
export interface TradeCompletionAttestationPayload {
  /** The counterparty attesting to this completion — hex-encoded
   * `PersonaEpoch.epochKeyPublicHex` of the ATTESTOR (the party making the
   * statement), redundant with the enclosing envelope's own `keyId` for the
   * same reason `FedosSubscriptionEntitlement.issuerKeyId` is redundant
   * with its envelope's `keyId` (see
   * `src/os/trust/entitlement/fedos_trust_subscription_entitlement_types.ts`'s
   * header): documentation-for-humans, never an independent trust input —
   * verification MUST treat the envelope's own `keyId` as authoritative. */
  readonly attestorEpochKeyPublicHex: string;
  /** The `PersonaEpoch.epochId` of the SUBJECT this attestation is about
   * (the counterparty being vouched for) — never the subject's messaging
   * identity, see `persona_epoch.ts`'s header. */
  readonly subjectEpochId: string;
  /** A ONE-WAY DIGEST (hex) of the real trade/order identifier, computed
   * locally by Commerce BEFORE this payload is ever constructed — NEVER the
   * raw order id itself. This design does not itself pick a hash function;
   * an implementation should reuse this repo's existing SHA-256 content-hash
   * convention rather than inventing one (see
   * `docs/commerce/FEDOS-COMMERCE-END-TO-END.md` §10's recommended
   * `ProductMedia.checksum` field, which points at the same existing
   * primitive: `computeFedosConversationArchiveContentHash()`). Salting the
   * pre-image (order id + a per-trade random value known only to the two
   * counterparties) is a REQUIRED implementation detail, not optional — an
   * unsalted digest of a small order-id space is brute-forceable back to
   * the raw id by anyone who can enumerate candidate ids. */
  readonly tradeRefDigestHex: string;
  readonly category: TradeCompletionCategory;
  readonly outcome: TradeCompletionOutcome;
  /** Unix seconds. Implementations SHOULD consider truncating this to a
   * coarse granularity (e.g. day boundary) before signing, to reduce timing
   * correlation against Messenger conversation timestamps or Nostr event
   * timestamps a verifier might separately observe — left as an
   * implementation-wave decision, not enforced by this design's types. */
  readonly completedAt: number;
  /** This payload's own schema version, mirroring every Trust payload's own
   * `formatVersion` convention (e.g.
   * `FEDOS_TRUST_SUBSCRIPTION_ENTITLEMENT_FORMAT_VERSION_1`). */
  readonly formatVersion: 1;
}

const TRADE_COMPLETION_OUTCOMES: readonly TradeCompletionOutcome[] = [
  "completed_as_agreed",
  "completed_with_dispute",
  "not_completed",
];

const TRADE_COMPLETION_CATEGORIES: readonly TradeCompletionCategory[] = [
  "digital_good",
  "physical_good",
  "service",
  "other",
];

const HEX_64_PATTERN = /^[0-9a-f]{64}$/;
const EPOCH_ID_PATTERN = /^[0-9a-f]{16,64}$/;

const TRADE_COMPLETION_ATTESTATION_ALLOWED_KEYS: ReadonlySet<string> = new Set([
  "attestorEpochKeyPublicHex",
  "subjectEpochId",
  "tradeRefDigestHex",
  "category",
  "outcome",
  "completedAt",
  "formatVersion",
]);

function isUnixSecondsInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0;
}

function hasOnlyAllowedKeys(candidate: Record<string, unknown>, allowed: ReadonlySet<string>): boolean {
  return Object.keys(candidate).every((key) => allowed.has(key));
}

/**
 * Structural well-formedness AND allowlisted-keys-only check. Fails closed
 * to `false` on any malformed input, any missing field, or any UNEXPECTED
 * extra field (see this file's header on why unknown keys are rejected
 * rather than tolerated); never throws.
 */
export function isWellFormedTradeCompletionAttestationPayload(
  value: unknown,
): value is TradeCompletionAttestationPayload {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as Record<string, unknown>;

  if (!hasOnlyAllowedKeys(candidate, TRADE_COMPLETION_ATTESTATION_ALLOWED_KEYS)) return false;

  if (typeof candidate.attestorEpochKeyPublicHex !== "string" || !HEX_64_PATTERN.test(candidate.attestorEpochKeyPublicHex)) {
    return false;
  }
  if (typeof candidate.subjectEpochId !== "string" || !EPOCH_ID_PATTERN.test(candidate.subjectEpochId)) return false;
  if (typeof candidate.tradeRefDigestHex !== "string" || !HEX_64_PATTERN.test(candidate.tradeRefDigestHex)) return false;
  if (typeof candidate.category !== "string" || !TRADE_COMPLETION_CATEGORIES.includes(candidate.category as TradeCompletionCategory)) {
    return false;
  }
  if (typeof candidate.outcome !== "string" || !TRADE_COMPLETION_OUTCOMES.includes(candidate.outcome as TradeCompletionOutcome)) {
    return false;
  }
  if (!isUnixSecondsInteger(candidate.completedAt)) return false;
  if (candidate.formatVersion !== 1) return false;

  return true;
}

/**
 * Payload of a DERIVED reputation summary — an aggregator's coarse claim
 * about how many `TradeCompletionAttestationPayload`s a given epoch has
 * accumulated. Carried inside a
 * `ReputationLocalSignedEnvelopeShape<ReputationAttestationPayload>`. This
 * is the shape a Persona Board (`disclosure_layers.ts`) actually reads from
 * — never the raw per-trade attestation list.
 */
export interface ReputationAttestationPayload {
  /** The `PersonaEpoch.epochId` this summary is about. */
  readonly subjectEpochId: string;
  /** Hex-encoded `PersonaEpoch.epochKeyPublicHex` of the subject — same
   * documentation-for-humans redundancy with the envelope's own `subject`
   * field as `TradeCompletionAttestationPayload.attestorEpochKeyPublicHex`
   * has with `keyId` (see that field's doc comment). */
  readonly subjectEpochKeyPublicHex: string;
  /** Exact count as computed by the aggregator — see this file's header:
   * this is a plain number, not a cryptographic commitment, and an
   * aggregator with access to every underlying attestation always knows the
   * real value. Coarser PUBLIC-layer bucketing of this number for display
   * is `disclosure_layers.ts`'s job, not this payload's. */
  readonly verifiedTradeCount: number;
  /** Opaque references (implementation-defined ids, e.g. a digest of each
   * referenced `TradeCompletionAttestationPayload`'s own envelope) to the
   * attestations this count was computed from — NEVER the attestations'
   * full contents inlined here. Bounded length; an implementation should
   * apply a limit similar in spirit to `FEDOS_TRUST_MAX_SCOPES`
   * (`src/os/trust/fedos_trust_limits.ts`) rather than leaving this
   * unbounded. */
  readonly attestationRefs: readonly string[];
  /** Unix seconds this summary was computed as of. */
  readonly asOf: number;
  readonly formatVersion: 1;
}

const REPUTATION_ATTESTATION_ALLOWED_KEYS: ReadonlySet<string> = new Set([
  "subjectEpochId",
  "subjectEpochKeyPublicHex",
  "verifiedTradeCount",
  "attestationRefs",
  "asOf",
  "formatVersion",
]);

/** Same bound family as `FEDOS_TRUST_MAX_SCOPES` — restated locally, not
 * imported, for the same cross-domain-import reason given throughout this
 * file. */
const MAX_ATTESTATION_REFS = 4096;

/**
 * Structural well-formedness AND allowlisted-keys-only check, mirroring
 * `isWellFormedTradeCompletionAttestationPayload`'s discipline. Fails
 * closed to `false`; never throws.
 */
export function isWellFormedReputationAttestationPayload(
  value: unknown,
): value is ReputationAttestationPayload {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as Record<string, unknown>;

  if (!hasOnlyAllowedKeys(candidate, REPUTATION_ATTESTATION_ALLOWED_KEYS)) return false;

  if (typeof candidate.subjectEpochId !== "string" || !EPOCH_ID_PATTERN.test(candidate.subjectEpochId)) return false;
  if (
    typeof candidate.subjectEpochKeyPublicHex !== "string" ||
    !HEX_64_PATTERN.test(candidate.subjectEpochKeyPublicHex)
  ) {
    return false;
  }
  if (
    typeof candidate.verifiedTradeCount !== "number" ||
    !Number.isInteger(candidate.verifiedTradeCount) ||
    candidate.verifiedTradeCount < 0
  ) {
    return false;
  }
  if (!Array.isArray(candidate.attestationRefs) || candidate.attestationRefs.length > MAX_ATTESTATION_REFS) {
    return false;
  }
  for (const ref of candidate.attestationRefs) {
    if (typeof ref !== "string" || ref.length === 0) return false;
  }
  if (!isUnixSecondsInteger(candidate.asOf)) return false;
  if (candidate.formatVersion !== 1) return false;

  return true;
}
