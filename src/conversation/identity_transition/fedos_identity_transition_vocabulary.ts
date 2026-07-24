/**
 * FedOS Identity Transition Types, Validation, and Durable Evidence
 * Foundation Arc — Phase B: closed, versioned vocabularies.
 *
 * This is the FIRST code in a brand-new, standalone, additive domain
 * (`src/conversation/identity_transition/`) implementing the non-network
 * foundation named by the accepted `docs/reviews/fedos_account_nostr_identity_rotation_v1/`
 * review (commit `45e0fce`): account identity and Nostr identity remain
 * IMMUTABLE; a required identity change is modeled as a Replacement
 * transition with an optional, evidence-leveled continuity claim — never
 * an in-place rotation.
 *
 * Every value below is deliberately narrow and closed. No free-form
 * string is ever accepted as a reason, evidence kind, or status —
 * unknown values fail closed everywhere in this domain (Absolute
 * Prohibitions: no arbitrary free-form policy).
 *
 * `FedosIdentityTransitionEvidenceStatus` is intentionally NOT a boolean.
 * The review's own normative finding (doc 07) is that "is this transition
 * valid?" can never collapse to true/false — an old-key signature alone
 * is meaningfully different from a Device-corroborated one, and both are
 * different again from "rejected". Collapsing this to a boolean would
 * silently reintroduce the exact "old key vouches for new key" trust
 * model the review rejected.
 */

export const FEDOS_IDENTITY_TRANSITION_SCHEMA_VERSION = 1 as const;

/**
 * `"identity-replacement"` — a full account+Nostr identity replacement
 * (the only transition type this Arc actually persists through to a
 * durable fact).
 * `"continuity-claim"` — a standalone claim asserting continuity between
 * two ALREADY-KNOWN identities (e.g. attaching late Device corroboration
 * to a transition peers have already observed) without re-stating the
 * full replacement body. Reserved for the Peer Notification Arc; this Arc
 * defines the vocabulary value but does not implement a distinct
 * evaluation path for it (see execution spec, Structural Exclusions).
 */
export type FedosIdentityTransitionType = "identity-replacement" | "continuity-claim";

export const FEDOS_IDENTITY_TRANSITION_KNOWN_TYPES: readonly FedosIdentityTransitionType[] = Object.freeze([
  "identity-replacement",
  "continuity-claim",
]);

export function isKnownFedosIdentityTransitionType(value: unknown): value is FedosIdentityTransitionType {
  return typeof value === "string" && (FEDOS_IDENTITY_TRANSITION_KNOWN_TYPES as readonly string[]).includes(value);
}

/**
 * Coarse reason categories only — never a free-form string. The evidence
 * evaluator (Phase I) treats `"key-compromise-suspected"` and
 * `"key-compromise-confirmed"` specially: neither may ever be satisfied
 * by an old-key signature alone (Phase G's own stated limitation).
 */
export type FedosIdentityTransitionReasonCategory =
  | "key-compromise-suspected"
  | "key-compromise-confirmed"
  | "identity-lost"
  | "recovery-unavailable"
  | "user-initiated-replacement"
  | "implementation-migration";

export const FEDOS_IDENTITY_TRANSITION_KNOWN_REASON_CATEGORIES: readonly FedosIdentityTransitionReasonCategory[] = Object.freeze([
  "key-compromise-suspected",
  "key-compromise-confirmed",
  "identity-lost",
  "recovery-unavailable",
  "user-initiated-replacement",
  "implementation-migration",
]);

export function isKnownFedosIdentityTransitionReasonCategory(value: unknown): value is FedosIdentityTransitionReasonCategory {
  return typeof value === "string" && (FEDOS_IDENTITY_TRANSITION_KNOWN_REASON_CATEGORIES as readonly string[]).includes(value);
}

/** Reason categories under which an old-key-only signature can NEVER be treated as sufficient continuity evidence, regardless of how many times it is presented. */
export const FEDOS_IDENTITY_TRANSITION_COMPROMISE_REASON_CATEGORIES: readonly FedosIdentityTransitionReasonCategory[] = Object.freeze([
  "key-compromise-suspected",
  "key-compromise-confirmed",
]);

export function isFedosIdentityTransitionCompromiseReason(reason: FedosIdentityTransitionReasonCategory): boolean {
  return (FEDOS_IDENTITY_TRANSITION_COMPROMISE_REASON_CATEGORIES as readonly string[]).includes(reason);
}

/**
 * `"master-seed-authority"` is reserved for a future Arc where the LOCAL
 * Master Seed authority itself (not a remote peer) can honestly attest a
 * transition it originated — this Arc's own facade never produces this
 * evidence kind (Phase A found no such attestation boundary exists yet);
 * it exists here only so the closed vocabulary does not need widening
 * later purely to add it, matching this repo's own "reserve now, wire
 * later" convention (`identityId` on `FedosDeviceBindingAccountRef`).
 */
export type FedosIdentityTransitionEvidenceKind =
  | "old-identity-signature"
  | "new-identity-proof-of-possession"
  | "authorized-device-corroboration"
  | "manual-peer-verification"
  | "master-seed-authority"
  | "unavailable";

export const FEDOS_IDENTITY_TRANSITION_KNOWN_EVIDENCE_KINDS: readonly FedosIdentityTransitionEvidenceKind[] = Object.freeze([
  "old-identity-signature",
  "new-identity-proof-of-possession",
  "authorized-device-corroboration",
  "manual-peer-verification",
  "master-seed-authority",
  "unavailable",
]);

export function isKnownFedosIdentityTransitionEvidenceKind(value: unknown): value is FedosIdentityTransitionEvidenceKind {
  return typeof value === "string" && (FEDOS_IDENTITY_TRANSITION_KNOWN_EVIDENCE_KINDS as readonly string[]).includes(value);
}

/**
 * Deliberately NOT a boolean (see file header). `"corroborated"` is
 * reserved for evidence that has passed a SECOND, independent check
 * (e.g. a Device signature layered on top of an already
 * cryptographically-valid old-identity signature) — never produced by a
 * single signature check alone.
 */
export type FedosIdentityTransitionEvidenceStatus =
  | "absent"
  | "structurally-valid"
  | "cryptographically-valid"
  | "corroborated"
  | "locally-accepted"
  | "rejected"
  | "stale"
  | "conflicting"
  | "unverifiable";

export const FEDOS_IDENTITY_TRANSITION_KNOWN_EVIDENCE_STATUSES: readonly FedosIdentityTransitionEvidenceStatus[] = Object.freeze([
  "absent",
  "structurally-valid",
  "cryptographically-valid",
  "corroborated",
  "locally-accepted",
  "rejected",
  "stale",
  "conflicting",
  "unverifiable",
]);

export function isKnownFedosIdentityTransitionEvidenceStatus(value: unknown): value is FedosIdentityTransitionEvidenceStatus {
  return typeof value === "string" && (FEDOS_IDENTITY_TRANSITION_KNOWN_EVIDENCE_STATUSES as readonly string[]).includes(value);
}

/**
 * Closed Device policy vocabulary. `"rebind-required"` is the ONLY value
 * this Arc supports — it names the fact that Devices must be explicitly
 * rebound/reauthorized (review's own decision), never that this Arc
 * performs the rebind. No `"auto-rebind"` value exists (Absolute
 * Prohibitions: no automatic Device Registry rebind).
 */
export type FedosIdentityTransitionDevicePolicy = "rebind-required";

export const FEDOS_IDENTITY_TRANSITION_KNOWN_DEVICE_POLICIES: readonly FedosIdentityTransitionDevicePolicy[] = Object.freeze([
  "rebind-required",
]);

export function isKnownFedosIdentityTransitionDevicePolicy(value: unknown): value is FedosIdentityTransitionDevicePolicy {
  return typeof value === "string" && (FEDOS_IDENTITY_TRANSITION_KNOWN_DEVICE_POLICIES as readonly string[]).includes(value);
}

/**
 * Closed Ratchet policy vocabulary. `"reset-required-no-rebind"` is the
 * ONLY value this Arc supports — active sessions must become
 * reset-required and old root/chain keys must never be rebound to the
 * new identity (review's own decision, reaffirmed by Phase L's read-only
 * impact plan). No automatic-reset value exists (Absolute Prohibitions:
 * no automatic Ratchet reset).
 */
export type FedosIdentityTransitionRatchetPolicy = "reset-required-no-rebind";

export const FEDOS_IDENTITY_TRANSITION_KNOWN_RATCHET_POLICIES: readonly FedosIdentityTransitionRatchetPolicy[] = Object.freeze([
  "reset-required-no-rebind",
]);

export function isKnownFedosIdentityTransitionRatchetPolicy(value: unknown): value is FedosIdentityTransitionRatchetPolicy {
  return typeof value === "string" && (FEDOS_IDENTITY_TRANSITION_KNOWN_RATCHET_POLICIES as readonly string[]).includes(value);
}
