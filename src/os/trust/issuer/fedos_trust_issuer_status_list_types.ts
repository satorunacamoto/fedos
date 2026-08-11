/**
 * Trust — OPTIONAL signed status list (`fedos.status-list.v1`), §34.
 *
 * An issuer MAY publish/ship a signed list of revoked entitlement serials.
 * This is DELIBERATELY MINIMAL — a type plus one pure lookup helper, no
 * fetching, no network code, no caching, no server.
 *
 * NOT RELIED UPON BY DEFAULT: `fedos_trust_subscription_entitlement_verify.ts`
 * never references this file and never blocks on a status list's absence —
 * default entitlement verification checks ONLY signature + validity window,
 * exactly as documented on that module. A verifier who happens to HAVE a
 * status list (obtained however that verifier's own application chooses —
 * out of scope here) may ADDITIONALLY call `isSerialRevoked` after a normal
 * `verifyFedosSubscriptionEntitlement` call returns `"VALID"`, entirely at
 * that verifier's own option. Treating status-list absence as a verification
 * FAILURE would defeat the entire "offline, no server" design point of this
 * arc (§29) — never do that.
 *
 * A `FedosTrustStatusList` is itself the PAYLOAD of a
 * `FedosTrustSignedEnvelope<FedosTrustStatusList>` under the
 * `"fedos.status-list.v1"` domain (see
 * `../envelope/fedos_trust_envelope_types.ts`'s changelog note) — an issuer
 * signs it the same way it signs an entitlement, so a verifier who chooses
 * to trust it can check that signature with the exact same
 * `verifyFedosTrustEnvelopeV1` primitive every other domain uses. This
 * module does not itself provide a canonicalizer/issue/verify trio for that
 * envelope — only the payload shape and the pure lookup helper — since no
 * part of this arc issues or fetches one yet; a future arc that actually
 * ships status-list publishing can add those alongside real usage instead of
 * speculatively now.
 */

export const FEDOS_TRUST_STATUS_LIST_FORMAT_VERSION_1 = 1 as const;

/** Payload of an (optional, issuer-published) `fedos.status-list.v1`
 * envelope. */
export interface FedosTrustStatusList {
  /** Opaque issuer identifier — conventionally the same value as the
   * `issuer` field on the entitlements this list's serials refer to. */
  readonly issuerId: string;
  /** Every `FedosSubscriptionEntitlement.serial` this issuer considers
   * revoked, as of `generatedAt`. No ordering guarantee; a verifier should
   * treat this as a set. */
  readonly revokedSerials: readonly string[];
  /** Unix seconds — when this list was generated/signed. Has no bearing on
   * whether an INDIVIDUAL entitlement is expired (that is still
   * `validFrom`/`validUntil`, checked independently); this timestamp only
   * describes the list's own freshness. */
  readonly generatedAt: number;
  readonly formatVersion: typeof FEDOS_TRUST_STATUS_LIST_FORMAT_VERSION_1;
}

/** Pure lookup — `true` iff `serial` appears in `statusList.revokedSerials`.
 * Never throws, never fetches, never mutates its input. */
export function isSerialRevoked(statusList: FedosTrustStatusList, serial: string): boolean {
  return statusList.revokedSerials.includes(serial);
}
