/**
 * Trust — CapabilityGrant payload shape.
 *
 * A `fedos.capability.v1` envelope is a SMALL, reusable primitive — arc
 * brief: "do not build a large authorization system". It states "the issuer
 * grants `subjectPublicKeyHex` these `permissions` on `resource`, under this
 * delegation policy" and nothing more: no role hierarchies, no policy
 * language, no group membership, no revocation registry. A verifier that
 * needs more than "does this signed grant cover this resource/permission"
 * builds that on top, outside this file.
 */

/** Deliberately narrow, closed enum (arc brief: "keep narrow") — not an
 * open-ended policy language. `"none"`: the subject may use the granted
 * permissions but may not issue a further `fedos.capability.v1` grant to
 * anyone else for the same resource/permissions. `"subject-may-delegate"`:
 * the subject may issue such a further grant (verifying a delegation CHAIN,
 * if a caller builds one, is out of scope for this minimal primitive —
 * bounded in principle by `FEDOS_TRUST_MAX_DELEGATION_CHAIN_DEPTH`, see
 * `../fedos_trust_limits.ts`, but this module does not itself walk chains). */
export type FedosTrustCapabilityDelegationPolicy = "none" | "subject-may-delegate";

/** Payload of a `fedos.capability.v1` envelope. */
export interface FedosTrustCapabilityGrantPayload {
  /** The subject being granted the capability, hex-encoded public key. */
  readonly subjectPublicKeyHex: string;
  /** Opaque, issuer-defined resource identifier this grant applies to. */
  readonly resource: string;
  /** Bounded by `FEDOS_TRUST_MAX_SCOPES` (see `../fedos_trust_limits.ts`) —
   * the same shared bound an entitlement's own scopes list uses. */
  readonly permissions: readonly string[];
  readonly delegationPolicy: FedosTrustCapabilityDelegationPolicy;
  /** Optional caller-supplied nonce — NOT the possession-domain replay nonce
   * (`../possession/`'s challenge/response nonce is a distinct mechanism);
   * this is simply an opaque disambiguator a caller may use to distinguish
   * otherwise-identical grants (e.g. two grants issued in the same second). */
  readonly nonce?: string;
}
