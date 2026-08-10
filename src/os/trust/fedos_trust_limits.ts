/**
 * Trust — shared size/depth/length bounds.
 *
 * Every signed artifact this capability produces or accepts must have a
 * practical bound (arc brief §57 "Parser limits"). These constants are the
 * single source of truth so `envelope/`, `qr/`, `contracts/`, `entitlement/`
 * etc. all fail closed at the same, reviewed limits instead of each
 * inventing its own. Values are deliberately generous for the legitimate
 * use cases here (a subscription entitlement, a pseudonymous credential, a
 * proof-of-possession challenge, a capability grant, a contract-artifact
 * digest proof) and deliberately small compared to what a QR code can even
 * physically encode, so a malicious oversized payload is rejected long
 * before it reaches a QR encoder or a signature check.
 */

/** Max length (UTF-8 chars) of a canonical envelope (metadata + payload),
 * before signing / after verification-time re-canonicalization. */
export const FEDOS_TRUST_MAX_CANONICAL_ENVELOPE_LENGTH = 16_384;

/** Max length of any single opaque string field (issuer, subject, audience,
 * nonce, keyId, and most payload string fields unless a narrower bound is
 * defined closer to that field). */
export const FEDOS_TRUST_MAX_FIELD_STRING_LENGTH = 512;

/** Max number of scopes on a single entitlement or capability grant. */
export const FEDOS_TRUST_MAX_SCOPES = 32;

/** Max chain depth for a delegated proof (arc brief §27 — artifact signature
 * + entitlement signature is depth 2; this bounds any future extension so a
 * malicious chain cannot force unbounded recursive verification, "recursive
 * / chained proof bombs" per §56). */
export const FEDOS_TRUST_MAX_DELEGATION_CHAIN_DEPTH = 4;

/** Max number of keys a single trusted issuer may register in a TrustPolicy
 * (rotation seam, §54) — bounds resolution cost and rules out a pathological
 * policy object. */
export const FEDOS_TRUST_MAX_ISSUER_KEYS = 16;

/** Clock-skew tolerance (seconds) applied when checking `issuedAt` is not in
 * the future and `expiresAt`/`validUntil` has not yet passed. Local-only
 * verification has no NTP guarantee; a small tolerance avoids spurious
 * failures from ordinary clock drift without meaningfully weakening expiry
 * enforcement. */
export const FEDOS_TRUST_CLOCK_SKEW_TOLERANCE_SECONDS = 120;
