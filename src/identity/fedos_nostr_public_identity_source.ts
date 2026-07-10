/**
 * Secure Runtime Alpha 039 — "Nostr Public Identity Source Boundary".
 *
 * The MINIMAL contract a future, real Nostr public-identity source
 * (an npub reader, a cached kind:0 profile, a linked-account
 * descriptor, or similar) would satisfy — a single READ-ONLY query
 * returning a public, non-secret snapshot or `null`. See
 * `docs/secure_runtime_alpha_039_nostr_public_identity_source_boundary.md`
 * for the full design rationale: why this Boundary exists separately
 * from `NostrIdentityProvider` (Alpha 035) itself, why no real source
 * implementation exists yet, why `NullNostrPublicIdentitySource` is
 * the only implementation today, and why this file carries zero
 * Relay/Authentication/Runtime/secret-key vocabulary of any kind.
 *
 * This file defines TYPES ONLY — no class, no function, no runtime
 * behavior, and no wiring into any other module in this repository.
 * `readPublicIdentity()` is a single, idempotent READ: it names "what
 * public Nostr identity snapshot is currently available," never a
 * sign-in flow, never a key derivation, never a Relay query, never a
 * state change.
 *
 * HARD GUARDRAILS:
 *   - `FedosNostrPublicIdentitySnapshot` carries PUBLIC, NON-SECRET
 *     fields only — never a private key, `nsec`, seed, mnemonic, or
 *     any other secret material.
 *   - No field on this file's own types may hold a Runtime-issued
 *     opaque handle (`AeadKeyHandle`, `AeadCiphertextHandle`) or any
 *     other Runtime/Storage-internal construct.
 *   - `readPublicIdentity()` takes no argument and performs no
 *     Authentication, Relay, or Storage operation of any kind — it is
 *     a pure read of whatever public identity data the implementation
 *     already holds.
 */

export interface FedosNostrPublicIdentitySnapshot {
  readonly id: string;
  readonly publicIdentifier: string;
}

export interface FedosNostrPublicIdentitySource {
  readPublicIdentity(): Promise<FedosNostrPublicIdentitySnapshot | null>;
}
