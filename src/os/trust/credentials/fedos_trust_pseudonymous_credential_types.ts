/**
 * Trust — PseudonymousIdentityCredential payload shape.
 *
 * FEDOS Trust / Offline Monetization + OSS Release Closure arc, §17. A
 * `fedos.credential.v1` envelope binds a pseudonymous identifier/label to a
 * public key — nothing more.
 *
 * IMPORTANT — this credential explicitly does NOT claim real-world identity.
 * A verified signature over this payload means exactly: "the issuer named in
 * the envelope's `issuer` field asserts that `subjectPublicKeyHex` may use
 * the pseudonymous label `label`." It does NOT mean the subject's legal name,
 * government ID, or any other real-world attribute was checked, unless a
 * SEPARATE issuer policy the verifier explicitly opts into says otherwise
 * (mirrors `../policy/fedos_trust_official_issuer_profile.ts`'s own
 * "FedOS Official subscription signature means exactly..." pattern — the
 * meaning of a signature is scoped to what its payload actually says, never
 * inflated by an application UI or a reader's assumption). Any code path
 * that treats a verified `fedos.credential.v1` envelope as real-world
 * identity proof is a bug.
 */

/** Payload of a `fedos.credential.v1` envelope. */
export interface FedosTrustPseudonymousCredentialPayload {
  /** The subject's public key, hex-encoded (conventionally the same key
   * that would sign a possession proof for this credential — but this type
   * does not itself require or check that relationship). */
  readonly subjectPublicKeyHex: string;
  /** The pseudonymous handle/display name being bound to the key. Bounded by
   * `FEDOS_TRUST_MAX_FIELD_STRING_LENGTH` (see
   * `../fedos_trust_limits.ts`) — never a real-world legal name field. */
  readonly label: string;
  /** Optional free-text statement from the issuer about this credential.
   * Explicitly NON-identifying — issuers must not use this field to smuggle
   * real-world identity claims; document any such policy separately (see
   * this file's header). */
  readonly issuerStatement?: string;
}
