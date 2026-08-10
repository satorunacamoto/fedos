/**
 * Trust — FedosSubscriptionEntitlement payload shape (`fedos.subscription.v1`).
 *
 * FEDOS Trust / Offline Monetization + OSS Release Closure arc, §11. A
 * verified `fedos.subscription.v1` envelope means exactly: "the issuer named
 * in the envelope's `issuer` field asserts that `subjectPublicKeyHex` holds a
 * subscription for `planId`, granting `scopes`, valid from `validFrom` to
 * `validUntil`." It does NOT mean the subject's real-world name, email,
 * postal address, phone number, or device fingerprint was collected or
 * checked — no such fields exist anywhere on this payload, deliberately (§11:
 * cryptographic validity never depends on real-world PII).
 *
 * TWO DISTINCT VALIDITY WINDOWS, BOTH ENFORCED — read this before touching
 * either one:
 *   - `FedosTrustSignedEnvelope.issuedAt`/`.expiresAt` (see
 *     `../envelope/fedos_trust_envelope_types.ts`) describe the SIGNED
 *     ARTIFACT's own freshness — "was this particular signed bundle of bytes
 *     produced recently enough / has it itself expired." This is an
 *     envelope-level, domain-agnostic concept every Trust proof type shares.
 *   - `validFrom`/`validUntil` below describe the actual SUBSCRIPTION PERIOD
 *     being attested — "is the plan itself currently active." This is
 *     entitlement-specific and has nothing to do with when the bytes were
 *     signed.
 *   A future re-issued envelope could, in principle, re-wrap the SAME
 *   subscription period (e.g. an issuer re-signs with a rotated key without
 *   changing the underlying plan dates) — that is exactly why both windows
 *   exist as separate fields instead of collapsing into one, and why
 *   `fedos_trust_subscription_entitlement_verify.ts` checks BOTH, never just
 *   one as a proxy for the other.
 */

import { FEDOS_TRUST_MAX_SCOPES } from "../fedos_trust_limits.js";

/** The payload's OWN schema version — distinct from
 * `FedosTrustSignedEnvelope.version` (the envelope wire format's version).
 * This lets the entitlement payload shape evolve independently of the
 * envelope shape. */
export const FEDOS_TRUST_SUBSCRIPTION_ENTITLEMENT_FORMAT_VERSION_1 = 1 as const;

/**
 * Canonical initial set of subscription scopes. A CLOSED union at the type
 * level (`FedosTrustSubscriptionScope`) for compile-time ergonomics, but the
 * WIRE payload field (`FedosSubscriptionEntitlement.scopes`) is validated at
 * runtime against `FEDOS_TRUST_SUBSCRIPTION_SCOPES`/`isValidFedosTrustSubscriptionScope`
 * rather than the TypeScript type — so a FUTURE scope literal is an additive
 * change to this array (and a runtime-version bump on the issuer side), never
 * a type-level breaking change for every existing consumer.
 */
export const FEDOS_TRUST_SUBSCRIPTION_SCOPES = [
  "credential",
  "signed-qr",
  "pseudonymous-credential",
  "contract-proof",
] as const;

export type FedosTrustSubscriptionScope = (typeof FEDOS_TRUST_SUBSCRIPTION_SCOPES)[number];

export function isValidFedosTrustSubscriptionScope(value: unknown): value is FedosTrustSubscriptionScope {
  return (
    typeof value === "string" &&
    (FEDOS_TRUST_SUBSCRIPTION_SCOPES as readonly string[]).includes(value)
  );
}

/** Payload of a `fedos.subscription.v1` envelope. */
export interface FedosSubscriptionEntitlement {
  /** The subject's public key, hex-encoded. */
  readonly subjectPublicKeyHex: string;
  /** Which of the issuer's keys signed this entitlement — REDUNDANT with the
   * enclosing envelope's own `keyId` field on purpose (§11): the envelope's
   * `keyId` is what verification actually trusts (via a `FedosTrustPolicy`),
   * but the payload is meant to be self-describing even if extracted from
   * its envelope for display/audit/logging purposes, so a human or a
   * downstream tool reading ONLY the payload JSON can still see which key
   * issued it without reaching back into the envelope. Verification MUST
   * treat the envelope's `keyId` as authoritative and reject any envelope
   * where this field disagrees with it (see
   * `fedos_trust_subscription_entitlement_verify.ts`) — this field is
   * documentation-for-humans, never an independent trust input. */
  readonly issuerKeyId: string;
  readonly planId: string;
  /** Runtime-validated against `FEDOS_TRUST_SUBSCRIPTION_SCOPES` (or any
   * future superset an issuer/verifier pair has separately agreed on) rather
   * than the closed `FedosTrustSubscriptionScope` union — see this file's
   * header. Bounded by `FEDOS_TRUST_MAX_SCOPES`. */
  readonly scopes: readonly string[];
  /** Unix seconds. Start of the actual subscription period — see this
   * file's header for why this is distinct from the envelope's `issuedAt`. */
  readonly validFrom: number;
  /** Unix seconds. End of the actual subscription period — see this file's
   * header for why this is distinct from the envelope's `expiresAt`. */
  readonly validUntil: number;
  /** Unique-per-issuance identifier. A renewal is a NEW entitlement with a
   * NEW `serial` (and new `validFrom`/`validUntil`) — an existing signed
   * entitlement is never mutated in place (§33; see
   * `fedos_trust_subscription_entitlement_issue.ts`'s own header). */
  readonly serial: string;
  /** This payload's OWN schema version — see this file's header. Currently
   * always `FEDOS_TRUST_SUBSCRIPTION_ENTITLEMENT_FORMAT_VERSION_1`. */
  readonly formatVersion: typeof FEDOS_TRUST_SUBSCRIPTION_ENTITLEMENT_FORMAT_VERSION_1;
}

/** Fails closed to `false` on any malformed input; never throws. Checked
 * before canonicalization, which only bounds string lengths — it does not
 * know about scope-allowlist membership, integer-ness of timestamps, etc. */
export function isWellFormedFedosSubscriptionEntitlement(
  payload: unknown,
): payload is FedosSubscriptionEntitlement {
  if (typeof payload !== "object" || payload === null) return false;
  const candidate = payload as Record<string, unknown>;

  if (typeof candidate.subjectPublicKeyHex !== "string" || candidate.subjectPublicKeyHex.length === 0) return false;
  if (typeof candidate.issuerKeyId !== "string" || candidate.issuerKeyId.length === 0) return false;
  if (typeof candidate.planId !== "string" || candidate.planId.length === 0) return false;

  if (!Array.isArray(candidate.scopes)) return false;
  if (candidate.scopes.length === 0 || candidate.scopes.length > FEDOS_TRUST_MAX_SCOPES) return false;
  for (const scope of candidate.scopes) {
    if (typeof scope !== "string" || scope.length === 0) return false;
  }
  // Duplicate scopes are a malformed/ambiguous payload, not a trust decision — reject outright.
  if (new Set(candidate.scopes as string[]).size !== candidate.scopes.length) return false;

  if (typeof candidate.validFrom !== "number" || !Number.isInteger(candidate.validFrom)) return false;
  if (typeof candidate.validUntil !== "number" || !Number.isInteger(candidate.validUntil)) return false;
  if (candidate.validUntil <= candidate.validFrom) return false;

  if (typeof candidate.serial !== "string" || candidate.serial.length === 0) return false;

  if (candidate.formatVersion !== FEDOS_TRUST_SUBSCRIPTION_ENTITLEMENT_FORMAT_VERSION_1) return false;

  return true;
}
