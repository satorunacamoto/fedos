/**
 * Reputation / Persona Epoch design arc — epoch carry-over design (§25).
 *
 * DESIGN + TYPE-ONLY SCAFFOLDING, same status as the other files in this
 * directory — see `persona_epoch.ts`'s header and `../README.md`.
 *
 * STATUS OF THIS DESIGN: BOUNDED / EXPLICITLY LINKABLE ONLY.
 * A fully privacy-preserving carry-over (one where a verifier can confirm
 * "the new epoch legitimately continues some prior epoch's standing"
 * WITHOUT learning WHICH prior epoch) is NOT designed here, and this file
 * states plainly why it is not safely implementable with what exists in
 * this repository today: that property requires a selective-disclosure or
 * blind-signature primitive (e.g. a zero-knowledge proof of "I possess a
 * valid signature over some prior epoch in this set" without revealing
 * which one, or a blind signature scheme letting the new epoch obtain a
 * carry-over credential the issuer cannot later correlate to the specific
 * new key). Repo-wide inspection for this design (see
 * `src/os/trust/README.md`'s own "Design goals"/"Non-goals" and this
 * design's own read of every file under `src/os/trust/`) confirms the only
 * cryptography anywhere in `src/os/trust/` — the one capability this design
 * is allowed to conceptually build on — is Schnorr/secp256k1 signing
 * (`@noble/curves`) and SHA-256 hashing (`@noble/hashes`). Neither is a
 * selective-disclosure or blind-signature primitive. Building one from
 * scratch for this arc would be exactly the "invent a new KDF/crypto
 * scheme" this wave's instructions forbid. So: DO NOT claim unlinkability
 * anywhere a carry-over statement is described, surfaced in a UI, or
 * documented. What follows is the bounded, EXPLICITLY LINKABLE design that
 * IS safely buildable from existing primitives.
 *
 * THE BOUNDED DESIGN
 * ----------------------------------------------------------------------
 * The OLD (predecessor) epoch's own signing key signs a small, fixed-shape
 * statement naming the NEW (successor) epoch and, OPTIONALLY, a single
 * coarse threshold claim (`verifiedTradeCountAtLeast: N` — never the exact
 * count, never a full history). A verifier who trusts the predecessor
 * epoch's key can therefore accept "the entity behind this new epoch also
 * controlled that old epoch, which reached at least N verified trades" —
 * and, BY THE SAME SIGNATURE, can trivially link the two epochs together.
 * That linkability is not a bug to be worked around; it is the
 * unavoidable, direct consequence of using a plain signature for
 * continuity, and must be disclosed to a user before they ever request or
 * accept a carry-over (see `EPOCH_CARRY_OVER_LINKABILITY_WARNING` below —
 * mirrors this repo's own precedent of a canonical, verbatim-surfaced
 * meaning statement,
 * `src/os/trust/policy/fedos_trust_official_issuer_profile.ts`'s
 * `FEDOS_OFFICIAL_ENTITLEMENT_MEANING_STATEMENT`).
 *
 * A carry-over is therefore a DELIBERATE, OPT-IN action a persona takes
 * when it JUDGES the continuity benefit (not starting reputation over from
 * zero) worth the linkability cost — never a default, automatic, or
 * silent behavior. A persona that wants a clean break between epochs
 * simply never produces or presents a carry-over statement; the new epoch
 * then starts with no claimed history at all, which is the ONLY way this
 * design can offer real unlinkability (by omission, not by cryptography).
 *
 * ONE-DIRECTIONAL SIGNING ONLY, ON PURPOSE
 * ----------------------------------------------------------------------
 * This minimal design has the PREDECESSOR sign a statement naming the
 * successor's public key — it does NOT require the successor to
 * counter-sign proof of possession of its own key before the statement is
 * considered well-formed. A hardened future version could require that
 * (reusing `src/os/trust/possession/`'s challenge/response SHAPE
 * conceptually — never imported, per this wave's cross-domain-import
 * rule), so a predecessor cannot mint a carry-over statement pointing at a
 * successor key nobody controls. This design flags that as a RECOMMENDED
 * hardening for whichever wave actually implements signing, not something
 * `isWellFormedEpochCarryOverStatementPayload` enforces today.
 */

import { isWellFormedPersonaEpochId, isWellFormedPersonaEpochKeyPublicHex } from "./persona_epoch.js";

/** Canonical warning statement. A UI presenting an epoch carry-over option
 * to a user MUST surface this verbatim (or a faithful translation) rather
 * than paraphrasing — mirroring
 * `FEDOS_OFFICIAL_ENTITLEMENT_MEANING_STATEMENT`'s
 * "surface it verbatim in any UI/CLI output rather than paraphrasing"
 * convention (`src/os/trust/README.md` §"What a FedOS Official signature
 * does and does not mean"). */
export const EPOCH_CARRY_OVER_LINKABILITY_WARNING =
  "Carrying reputation over to a new persona epoch cryptographically links the new epoch to the old one for anyone who sees this statement. This is not hidden or anonymized in any way — a fresh epoch with no carry-over is the only way to fully separate your new persona from your old one.";

/** This payload's own schema version, matching every other payload shape's
 * `formatVersion` convention in this directory (`attestation_types.ts`). */
export const EPOCH_CARRY_OVER_STATEMENT_FORMAT_VERSION_1 = 1 as const;

/** A single, coarse, OPTIONAL threshold claim — never an exact count
 * (that would be `ReputationAttestationPayload.verifiedTradeCount`,
 * `attestation_types.ts`, which is a SEPARATE, distinctly-purposed
 * artifact, not carried here). `atLeast` must be a non-negative integer;
 * the claim's meaning is "the predecessor epoch had verified trade count
 * >= atLeast at the time this statement was signed" — a lower bound, never
 * an exact figure, and never itself independently checkable by a verifier
 * without ALSO trusting the predecessor's own signature (there is no
 * separate proof system backing this number — see this file's header on
 * why no ZK/range-proof primitive exists in this repo to do better). */
export interface EpochCarryOverThresholdClaim {
  readonly verifiedTradeCountAtLeast: number;
}

/**
 * Payload of a carry-over statement, signed by the PREDECESSOR epoch's own
 * key (see this file's header for the conceptual envelope/signing flow,
 * which mirrors `attestation_types.ts`'s
 * `ReputationLocalSignedEnvelopeShape<TPayload>` wrapper and its own
 * "independent local mirror, not an import of `os/trust`" discipline).
 */
export interface EpochCarryOverStatementPayload {
  readonly predecessorEpochId: string;
  readonly predecessorEpochKeyPublicHex: string;
  readonly successorEpochId: string;
  readonly successorEpochKeyPublicHex: string;
  /** OPTIONAL — omitted entirely means "continuity claimed, no threshold
   * claim attached" (the successor merely inherits an acknowledgment that
   * SOME predecessor epoch existed, nothing about its trade count). */
  readonly thresholdClaim?: EpochCarryOverThresholdClaim;
  /** Unix seconds this statement was signed. */
  readonly issuedAt: number;
  readonly formatVersion: typeof EPOCH_CARRY_OVER_STATEMENT_FORMAT_VERSION_1;
}

/**
 * Pure constructor mirroring this repo's `issueFedosSubscriptionEntitlement`-
 * style discipline (validate inputs, throw `RangeError` on malformed
 * input, never silently coerce) — see
 * `src/os/trust/entitlement/fedos_trust_subscription_entitlement_issue.ts`.
 * Does NOT sign anything (no key material is accepted here) — signing is
 * conceptual/future-wave, per this file's header.
 */
export function buildEpochCarryOverStatementPayload(
  predecessorEpochId: string,
  predecessorEpochKeyPublicHex: string,
  successorEpochId: string,
  successorEpochKeyPublicHex: string,
  issuedAt: number,
  thresholdClaim?: EpochCarryOverThresholdClaim,
): EpochCarryOverStatementPayload {
  if (!isWellFormedPersonaEpochId(predecessorEpochId)) {
    throw new RangeError("epoch carry-over: predecessorEpochId is not well-formed");
  }
  if (!isWellFormedPersonaEpochKeyPublicHex(predecessorEpochKeyPublicHex)) {
    throw new RangeError("epoch carry-over: predecessorEpochKeyPublicHex is not well-formed");
  }
  if (!isWellFormedPersonaEpochId(successorEpochId)) {
    throw new RangeError("epoch carry-over: successorEpochId is not well-formed");
  }
  if (!isWellFormedPersonaEpochKeyPublicHex(successorEpochKeyPublicHex)) {
    throw new RangeError("epoch carry-over: successorEpochKeyPublicHex is not well-formed");
  }
  if (predecessorEpochId === successorEpochId) {
    throw new RangeError("epoch carry-over: predecessor and successor epoch ids must differ");
  }
  if (!Number.isInteger(issuedAt) || issuedAt < 0) {
    throw new RangeError("epoch carry-over: issuedAt must be a non-negative integer");
  }
  if (thresholdClaim !== undefined) {
    if (
      !Number.isInteger(thresholdClaim.verifiedTradeCountAtLeast) ||
      thresholdClaim.verifiedTradeCountAtLeast < 0
    ) {
      throw new RangeError("epoch carry-over: thresholdClaim.verifiedTradeCountAtLeast must be a non-negative integer");
    }
  }

  return {
    predecessorEpochId,
    predecessorEpochKeyPublicHex,
    successorEpochId,
    successorEpochKeyPublicHex,
    ...(thresholdClaim !== undefined ? { thresholdClaim } : {}),
    issuedAt,
    formatVersion: EPOCH_CARRY_OVER_STATEMENT_FORMAT_VERSION_1,
  };
}

const CARRY_OVER_ALLOWED_KEYS: ReadonlySet<string> = new Set([
  "predecessorEpochId",
  "predecessorEpochKeyPublicHex",
  "successorEpochId",
  "successorEpochKeyPublicHex",
  "thresholdClaim",
  "issuedAt",
  "formatVersion",
]);

/**
 * Structural well-formedness AND allowlisted-keys-only check, matching
 * `attestation_types.ts`'s "reject unknown keys outright" discipline.
 * Fails closed to `false`; never throws.
 */
export function isWellFormedEpochCarryOverStatementPayload(
  value: unknown,
): value is EpochCarryOverStatementPayload {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as Record<string, unknown>;

  if (!Object.keys(candidate).every((key) => CARRY_OVER_ALLOWED_KEYS.has(key))) return false;

  if (!isWellFormedPersonaEpochId(candidate.predecessorEpochId)) return false;
  if (!isWellFormedPersonaEpochKeyPublicHex(candidate.predecessorEpochKeyPublicHex)) return false;
  if (!isWellFormedPersonaEpochId(candidate.successorEpochId)) return false;
  if (!isWellFormedPersonaEpochKeyPublicHex(candidate.successorEpochKeyPublicHex)) return false;
  if (candidate.predecessorEpochId === candidate.successorEpochId) return false;

  if (candidate.thresholdClaim !== undefined) {
    if (typeof candidate.thresholdClaim !== "object" || candidate.thresholdClaim === null) return false;
    const claim = candidate.thresholdClaim as Record<string, unknown>;
    if (Object.keys(claim).length !== 1 || !("verifiedTradeCountAtLeast" in claim)) return false;
    if (
      typeof claim.verifiedTradeCountAtLeast !== "number" ||
      !Number.isInteger(claim.verifiedTradeCountAtLeast) ||
      claim.verifiedTradeCountAtLeast < 0
    ) {
      return false;
    }
  }

  if (typeof candidate.issuedAt !== "number" || !Number.isInteger(candidate.issuedAt) || candidate.issuedAt < 0) {
    return false;
  }
  if (candidate.formatVersion !== EPOCH_CARRY_OVER_STATEMENT_FORMAT_VERSION_1) return false;

  return true;
}
