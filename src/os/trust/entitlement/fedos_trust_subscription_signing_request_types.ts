/**
 * Trust — SubscriptionSigningRequest payload shape (`fedos.subscription-request.v1`).
 *
 * FEDOS Trust / Offline Monetization + OSS Release Closure arc, §31. Before
 * an offline issuer signs a `fedos.subscription.v1` entitlement for some
 * public key, it needs proof the requester actually HOLDS the private key
 * matching `subjectPublicKeyHex` — otherwise anyone could request an
 * entitlement for a key they do not control. A `SubscriptionSigningRequest`
 * is that proof: the SUBJECT signs this request themselves, with their own
 * `FedosTrustSigningKeypair`, and the issuer verifies that self-signature
 * before issuing (see `../issuer/fedos_trust_issuer_cli_core.ts`).
 *
 * WHY THIS IS ITS OWN ENVELOPE TYPE, NOT `fedos.possession.v1`: the existing
 * `fedos.possession.v1` domain (see `../possession/`) is a CHALLENGE/RESPONSE
 * proof-of-possession primitive — a verifier issues a nonce challenge and the
 * subject signs a response bound to it. A `SubscriptionSigningRequest` is a
 * different shape entirely: a self-contained, subject-initiated ARTIFACT
 * declaring "I hold this key and I am requesting this plan/these scopes,"
 * with its own `requestNonce` for replay-resistance rather than a
 * verifier-issued challenge nonce. Reusing `fedos.possession.v1` for this
 * would conflate two distinct signing domains and — per
 * `../envelope/fedos_trust_envelope_types.ts`'s own domain-separation
 * rule — risk a signature produced for one purpose being replayable as the
 * other. This module widens `FedosTrustEnvelopeType` with exactly one new
 * literal, `"fedos.subscription-request.v1"`, instead (see that file's own
 * changelog note).
 *
 * This payload — and the request as a whole — contains ONLY public,
 * non-secret material (a public key, plan/scope choices, a nonce, a
 * timestamp, a format version). No secret of any kind is ever placed on
 * this type.
 *
 * Verification (`fedos_trust_subscription_signing_request_verify.ts`) does
 * NOT go through a `FedosTrustPolicy` / issuer-trust lookup at all: the
 * whole point of self-attestation is "does this signature validate against
 * the exact public key the request itself declares," which is a direct
 * signature check, not an issuer-trust decision (there is no issuer to
 * trust here — the subject is signing over their own claim about
 * themselves, and it is the OFFLINE ISSUER's later, separate
 * `fedos.subscription.v1` signature that turns this self-attested request
 * into something a third party might trust).
 */

/** This payload's OWN schema version — distinct from
 * `FedosTrustSignedEnvelope.version`. */
export const FEDOS_TRUST_SUBSCRIPTION_SIGNING_REQUEST_FORMAT_VERSION_1 = 1 as const;

/** Payload of a `fedos.subscription-request.v1` envelope. */
export interface SubscriptionSigningRequest {
  /** The subject's own public key, hex-encoded — MUST equal the public key
   * of the `FedosTrustSigningKeypair` that signs the enclosing envelope
   * (checked at verification time; see the verify module). */
  readonly subjectPublicKeyHex: string;
  readonly requestedPlan: string;
  /** Runtime-validated the same way `FedosSubscriptionEntitlement.scopes`
   * is (see `fedos_trust_subscription_entitlement_types.ts`) — an issuer
   * may grant a subset, but never a scope outside this requested set. */
  readonly requestedScopes: readonly string[];
  /** Replay-resistance nonce, opaque to this module. */
  readonly requestNonce: string;
  /** Unix seconds. */
  readonly createdAt: number;
  readonly formatVersion: typeof FEDOS_TRUST_SUBSCRIPTION_SIGNING_REQUEST_FORMAT_VERSION_1;
}

/** Fails closed to `false` on any malformed input; never throws. */
export function isWellFormedSubscriptionSigningRequest(value: unknown): value is SubscriptionSigningRequest {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as Record<string, unknown>;

  if (typeof candidate.subjectPublicKeyHex !== "string" || candidate.subjectPublicKeyHex.length === 0) return false;
  if (typeof candidate.requestedPlan !== "string" || candidate.requestedPlan.length === 0) return false;

  if (!Array.isArray(candidate.requestedScopes) || candidate.requestedScopes.length === 0) return false;
  for (const scope of candidate.requestedScopes) {
    if (typeof scope !== "string" || scope.length === 0) return false;
  }

  if (typeof candidate.requestNonce !== "string" || candidate.requestNonce.length === 0) return false;
  if (typeof candidate.createdAt !== "number" || !Number.isInteger(candidate.createdAt)) return false;
  if (candidate.formatVersion !== FEDOS_TRUST_SUBSCRIPTION_SIGNING_REQUEST_FORMAT_VERSION_1) return false;

  return true;
}
