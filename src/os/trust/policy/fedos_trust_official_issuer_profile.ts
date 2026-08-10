/**
 * Trust — the OPTIONAL "FedOS Official" issuer profile.
 *
 * Arc brief §16. Important semantics (also documented in
 * `docs/architecture/TRUST-MODEL.md` — read that file for the full
 * narrative, this is the load-bearing code comment version):
 *
 * A FedOS Official subscription signature means exactly:
 *   "this public key has a valid FedOS-issued entitlement for these scopes
 *    and this validity period."
 *
 * It does NOT mean any of: legal identity verified, real-world identity
 * verified, QR contents are true, contract is safe, contract is legal,
 * transaction is legitimate, or financial guarantee. Any code path that
 * collapses those into one boolean is a bug — see arc brief §28 and
 * `entitlement/` / `contracts/`'s own separate `ARTIFACT SIGNATURE` /
 * `SUBSCRIPTION ENTITLEMENT` / `CONTENT CLAIM` result fields.
 *
 * THIS FILE CONTAINS NO PRIVATE KEY MATERIAL and never will — the FedOS
 * Official signing key is operator-held (see `../issuer/`), generated and
 * used entirely outside this OSS repository. `FEDOS_OFFICIAL_ISSUER_ID` is
 * a public label; `createFedosOfficialTrustPolicyEntry()` requires the
 * caller to SUPPLY the current public key(s) (e.g. from an app's own
 * shipped or user-editable config) rather than trusting a hardcoded value
 * baked into source — see arc brief §54 (no eternal single hardcoded raw
 * public key) and §36 (this profile's *format* is OSS; the key itself is
 * not baked into it).
 *
 * A verifier is never required to trust this issuer (§15) — constructing
 * this policy entry is always an explicit, opt-in step by the consuming
 * application or user, never a default.
 */

import type { FedosTrustedIssuer, FedosTrustedIssuerKey } from "./fedos_trust_policy_types.js";

export const FEDOS_OFFICIAL_ISSUER_ID = "fedos-official" as const;

/**
 * Builds a `FedosTrustedIssuer` entry for FedOS Official from
 * caller-supplied current (and optionally historical, for rotation)
 * public keys. This function does no network I/O and reaches no
 * hardcoded key — every key comes from `keys`.
 */
export function createFedosOfficialTrustedIssuer(
  keys: readonly FedosTrustedIssuerKey[],
): FedosTrustedIssuer {
  if (keys.length === 0) {
    throw new RangeError("fedos official issuer: at least one public key must be supplied");
  }
  return { issuerId: FEDOS_OFFICIAL_ISSUER_ID, keys };
}

/** Canonical human-readable statement of what a FedOS Official subscription
 * signature does and does not mean — surfaced verbatim by UI/CLI output so
 * this semantic boundary is never silently lost between code and product
 * copy. */
export const FEDOS_OFFICIAL_ENTITLEMENT_MEANING_STATEMENT =
  "A FedOS Official subscription signature means: this public key has a " +
  "valid FedOS-issued entitlement for the stated scopes and validity " +
  "period. It does NOT mean the subject's real-world identity was " +
  "verified, that any content the subject later signs is true, safe, " +
  "legal, or approved, or that any transaction is legitimate or " +
  "financially guaranteed.";
