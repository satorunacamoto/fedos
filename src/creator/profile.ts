/**
 * Stage 115 — Creator profile / trust label boundary (types + pure policy).
 *
 * A protocol-neutral SHAPE for "what a creator's profile looks like from the
 * outside" (a display name, a short bio, a category, and a set of trust
 * labels) — decoupled from any real identity check. This file defines the
 * profile shape, the trust-label vocabulary, and a pure review function
 * only; nothing here fetches a profile, verifies an identity, or mutates
 * anything.
 *
 * HARD GUARDRAILS:
 *   - NO real identity verification, KYC, OAuth, or document check of any
 *     kind is performed anywhere in this file. `"verified_placeholder"` is a
 *     FUTURE trust-label NAME only — it is never set by an actual
 *     verification step in this stage, and no code path here can produce it
 *     from a real check (there is no check to produce it from).
 *   - NO payment/entitlement field on `CreatorProfileDescriptor`. A profile
 *     names WHO a creator presents themselves as — never what they charge,
 *     what a subject has access to, or a private/gated record.
 *   - `reviewCreatorProfile` evaluates a decision ONLY — it never fetches,
 *     verifies, mutates, or stores a profile, and never contacts
 *     `PaymentProvider`, `EntitlementProvider`, `StorageBackend`, or any
 *     `FederationProvider`.
 *   - This boundary makes NO trust, verification, or authenticity guarantee.
 *     Do not describe an `accepted_placeholder` decision as "verified",
 *     "trusted", or "confirmed" — it means the profile is policy-clean
 *     (carries no sensitive field), nothing more.
 */

/**
 * A creator's standing, as a DISPLAY LABEL only. None of these is produced by
 * a real check in this stage:
 *   - `unknown_placeholder`: no trust signal is available.
 *   - `verified_placeholder`: a FUTURE label name for some eventual identity
 *     check — NOT real identity verification today; nothing in this file (or
 *     anywhere else in this stage) performs KYC, OAuth, or a document check.
 *   - `community_trusted_placeholder`: a FUTURE label for community-derived
 *     standing (e.g. moderator vouching) — no such mechanism exists yet.
 *   - `new_creator_placeholder`: a FUTURE label for "recently joined".
 *   - `reported_placeholder`: a FUTURE label for "has open reports" — never
 *     a moderation action by itself (see `../community/moderation.js`).
 *   - `test_placeholder`: for tests only.
 */
export type CreatorTrustLabel =
  | "unknown_placeholder"
  | "verified_placeholder"
  | "community_trusted_placeholder"
  | "new_creator_placeholder"
  | "reported_placeholder"
  | "test_placeholder";

/**
 * A non-sensitive description of one creator profile. Carries NO payment/
 * entitlement/private field of any kind — only opaque labels, display
 * strings, a set of trust labels, and non-sensitive metadata (reviewed by
 * `reviewCreatorProfile`).
 */
export interface CreatorProfileDescriptor {
  /** OPAQUE label a real route would resolve to its own creator id. */
  readonly creatorRef?: string;
  /** A display name only — never a real legal name or verified identity. */
  readonly displayName?: string;
  /** A short, non-sensitive bio preview — never the full bio body/bytes. */
  readonly bioPreview?: string;
  /** A display category label (e.g. "art", "music"). */
  readonly category?: string;
  /** FUTURE-label-only trust signals — see `CreatorTrustLabel`'s doc comment. */
  readonly trustLabels?: readonly CreatorTrustLabel[];
  readonly createdAt?: number;
  /** Non-sensitive key/value labels only — reviewed by `reviewCreatorProfile`. */
  readonly metadata?: Readonly<Record<string, string>>;
}

/**
 * Coarse observable state of a profile review. No identity/payment data is
 * exposed at any state.
 */
export type CreatorTrustState =
  | "unavailable" // no profile boundary is wired up (reserved for a future provider-backed state)
  | "accepted_placeholder" // passed placeholder review; NOT "verified" — see the hard guardrails above
  | "rejected" // failed placeholder review
  | "error"; // an operation could not be served; recorded, never thrown

/**
 * The result of reviewing a profile. `accepted_placeholder` means the
 * profile is policy-clean — NOT that any identity was verified or any trust
 * label was earned.
 */
export interface CreatorTrustDecision {
  readonly allowed: boolean;
  readonly state: CreatorTrustState;
  readonly reason?: string;
}

/** Every creator-trust-label (for mapping/documentation helpers). */
export const CREATOR_TRUST_LABELS: readonly CreatorTrustLabel[] = [
  "unknown_placeholder",
  "verified_placeholder",
  "community_trusted_placeholder",
  "new_creator_placeholder",
  "reported_placeholder",
  "test_placeholder",
];

/**
 * Substrings that mark a metadata key/value as sensitive (case-insensitive).
 * Includes the identity/verification-specific family (KYC/document/contact
 * fields a real identity check would use) alongside the conservative marker
 * family used across this codebase's other boundaries (see
 * `../social/intent.js`, `../marketplace/intent.js`).
 */
const SENSITIVE_MARKERS: readonly string[] = [
  "secret",
  "key",
  "seed",
  "token",
  "payment",
  "entitlement",
  "kyc",
  "ssn",
  "passport",
  "dob",
  "address",
  "phone",
  "email",
  "document",
  "government",
  "verification",
];

function isSensitiveKey(key: string): boolean {
  const k = key.toLowerCase().replace(/[^a-z0-9]/g, "");
  return SENSITIVE_MARKERS.some((marker) => k.includes(marker));
}

/** True if a string value looks like it carries sensitive/identity content. */
export function isSensitiveCreatorProfileValue(value: string): boolean {
  if (typeof value !== "string") return false;
  const v = value.toLowerCase();
  return SENSITIVE_MARKERS.some((marker) => v.includes(marker));
}

function hasSensitiveMetadata(metadata: Readonly<Record<string, string>> | undefined): boolean {
  if (!metadata) return false;
  for (const [key, value] of Object.entries(metadata)) {
    if (isSensitiveKey(key) || isSensitiveCreatorProfileValue(value)) return true;
  }
  return false;
}

/** Return a NEW metadata object with sensitive entries removed, or `undefined` if none remain. */
export function sanitizeCreatorProfileMetadata(
  metadata: Readonly<Record<string, string>> | undefined,
): Record<string, string> | undefined {
  if (!metadata) return undefined;
  const out: Record<string, string> = {};
  let kept = 0;
  for (const [key, value] of Object.entries(metadata)) {
    if (isSensitiveKey(key) || isSensitiveCreatorProfileValue(value)) continue;
    out[key] = value;
    kept += 1;
  }
  return kept > 0 ? out : undefined;
}

/**
 * Decide whether a profile may be handed to a (future) route/preview. Denies
 * (never throws) when metadata or the bio preview contains a sensitive key/
 * value. A clean profile is `accepted_placeholder` — a PLACEHOLDER
 * acceptance that still verifies/confirms nothing about the creator's real
 * identity. Never mutates `profile`, never contacts a payment/entitlement/
 * storage/federation boundary.
 */
export function reviewCreatorProfile(profile: CreatorProfileDescriptor): CreatorTrustDecision {
  if (profile.bioPreview !== undefined && isSensitiveCreatorProfileValue(profile.bioPreview)) {
    return {
      allowed: false,
      state: "rejected",
      reason: "bio preview contains a sensitive value",
    };
  }
  if (hasSensitiveMetadata(profile.metadata)) {
    return {
      allowed: false,
      state: "rejected",
      reason: "profile metadata contains a sensitive key or value",
    };
  }
  return {
    allowed: true,
    state: "accepted_placeholder",
    reason: "profile carries only non-sensitive, display-only labels (no identity was verified)",
  };
}
