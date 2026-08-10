/**
 * Trust — verifier-selected TrustPolicy / TrustedIssuer.
 *
 * Arc brief §15: "The generic Trust verifier must NOT hardcode FedOS
 * Official as the only valid issuer." This is the abstraction that makes
 * `verify(envelope, trustPolicy)` meaningful: a caller may trust FedOS
 * Official, a company, a university, themselves, or another community
 * issuer, all through the same shape. See `../README.md` §"No universal
 * root of trust" and `docs/architecture/TRUST-MODEL.md`.
 */

import { FEDOS_TRUST_MAX_ISSUER_KEYS } from "../fedos_trust_limits.js";

export interface FedosTrustedIssuerKey {
  /** Rotation identifier — matches `FedosTrustSignedEnvelope.keyId`. */
  readonly keyId: string;
  readonly publicKeyHex: string;
  /** Unix seconds. Key is not valid for verifying envelopes signed before
   * this instant (rotation start). Omit for "valid since always". */
  readonly notBefore?: number;
  /** Unix seconds. Key is not valid for verifying envelopes signed after
   * this instant (rotation end / revocation). Omit for "no planned end". */
  readonly notAfter?: number;
}

export interface FedosTrustedIssuer {
  /** Opaque issuer identifier — matches `FedosTrustSignedEnvelope.issuer`. */
  readonly issuerId: string;
  readonly keys: readonly FedosTrustedIssuerKey[];
}

/**
 * A verifier's own choice of who to trust. Two envelopes with byte-identical
 * payloads can verify differently under two different policies — that is
 * the intended behavior, not a bug: trust is local and verifier-selected,
 * never a protocol-wide constant.
 */
export interface FedosTrustPolicy {
  readonly trustedIssuers: readonly FedosTrustedIssuer[];
  /** Resolves `(issuer, keyId)` to the public key hex that was valid for
   * signing at `atTimeUnixSeconds`, or `null` if this policy does not trust
   * that issuer/key/time combination. Never throws. */
  resolveIssuerKey(issuer: string, keyId: string, atTimeUnixSeconds: number): string | null;
}

function keyValidAt(key: FedosTrustedIssuerKey, atTimeUnixSeconds: number): boolean {
  if (key.notBefore !== undefined && atTimeUnixSeconds < key.notBefore) return false;
  if (key.notAfter !== undefined && atTimeUnixSeconds > key.notAfter) return false;
  return true;
}

/** Builds a `FedosTrustPolicy` from a static, in-memory issuer/key list —
 * the normal case for a locally configured verifier (a subscriber's own
 * app config, a test fixture, an operator's CLI config). */
export function createFedosTrustPolicy(trustedIssuers: readonly FedosTrustedIssuer[]): FedosTrustPolicy {
  for (const issuer of trustedIssuers) {
    if (issuer.keys.length > FEDOS_TRUST_MAX_ISSUER_KEYS) {
      throw new RangeError(
        `fedos trust policy: issuer "${issuer.issuerId}" has more than ${FEDOS_TRUST_MAX_ISSUER_KEYS} keys`,
      );
    }
  }
  return {
    trustedIssuers,
    resolveIssuerKey(issuer, keyId, atTimeUnixSeconds) {
      const trustedIssuer = trustedIssuers.find((candidate) => candidate.issuerId === issuer);
      if (!trustedIssuer) return null;
      const key = trustedIssuer.keys.find((candidate) => candidate.keyId === keyId);
      if (!key) return null;
      if (!keyValidAt(key, atTimeUnixSeconds)) return null;
      return key.publicKeyHex;
    },
  };
}

/** A policy trusting exactly one issuer/key pair — the shape a subscriber
 * self-signing their own credentials uses ("self" is just another issuer
 * id, arc brief §17). */
export function createSingleIssuerFedosTrustPolicy(issuer: FedosTrustedIssuer): FedosTrustPolicy {
  return createFedosTrustPolicy([issuer]);
}

/** Merges any number of policies into one that trusts the union of every
 * input policy's issuers (later entries take precedence on an exact
 * `(issuerId, keyId)` collision — an intentionally simple, documented rule
 * rather than a silent one). */
export function mergeFedosTrustPolicies(...policies: readonly FedosTrustPolicy[]): FedosTrustPolicy {
  const byIssuer = new Map<string, Map<string, FedosTrustedIssuerKey>>();
  for (const policy of policies) {
    for (const issuer of policy.trustedIssuers) {
      const keys = byIssuer.get(issuer.issuerId) ?? new Map<string, FedosTrustedIssuerKey>();
      for (const key of issuer.keys) keys.set(key.keyId, key);
      byIssuer.set(issuer.issuerId, keys);
    }
  }
  const merged: readonly FedosTrustedIssuer[] = Array.from(byIssuer.entries()).map(([issuerId, keys]) => ({
    issuerId,
    keys: Array.from(keys.values()),
  }));
  return createFedosTrustPolicy(merged);
}
