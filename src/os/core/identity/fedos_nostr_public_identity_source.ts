/**
 * Secure Runtime Alpha 039 — "Nostr Public Identity Source Boundary".
 * Secure Runtime Alpha 044 — "Nostr Public Identity Snapshot
 * Expansion" (this revision — Snapshot only).
 *
 * The MINIMAL contract a future, real Nostr public-identity source
 * (an npub reader, a cached kind:0 profile, a linked-account
 * descriptor, or similar) would satisfy — a single READ-ONLY query
 * returning a public, non-secret snapshot or `null`. Alpha 044 adds two
 * OPTIONAL fields to `FedosNostrPublicIdentitySnapshot` —
 * `displayName`/`avatar` — matching Alpha 038's own formal ADOPT
 * decision for `FedosIdentityDescriptor` (not yet implemented there).
 * See
 * `docs/secure_runtime_alpha_044_nostr_public_identity_snapshot_expansion.md`
 * for the full design rationale: why the Snapshot may carry these two
 * fields now while the Descriptor still does not, why `avatar` is a
 * reference only, and why neither Authentication nor secret
 * information is ever representable here. See also
 * `docs/secure_runtime_alpha_039_nostr_public_identity_source_boundary.md`
 * for the original rationale: why this Boundary exists separately from
 * `NostrIdentityProvider` (Alpha 035) itself, why no real source
 * implementation exists yet, why `NullNostrPublicIdentitySource` is
 * the only implementation today, and why this file carries zero
 * Relay/Authentication/Runtime/secret-key vocabulary of any kind.
 *
 * This file defines TYPES ONLY — no class, no function, no runtime
 * behavior, and no wiring into any other module in this repository.
 * `readPublicIdentity()` is a single, idempotent READ: it names "what
 * public Nostr identity snapshot is currently available," never a
 * sign-in flow, never a key derivation, never a Relay query, never a
 * state change. `FedosNostrPublicIdentitySource` itself (the Interface)
 * is BYTE-FOR-BYTE UNCHANGED by this Stage.
 *
 * HARD GUARDRAILS:
 *   - `FedosNostrPublicIdentitySnapshot` carries PUBLIC, NON-SECRET
 *     fields only — never a private key, `nsec`, seed, mnemonic, or
 *     any other secret material.
 *   - `displayName`/`avatar` are both OPTIONAL (`?:`) — a Source that
 *     does not know either value simply omits it; neither field is
 *     ever required, defaulted, or fabricated.
 *   - `avatar`, if present, is a REFERENCE (a URL or CID) only — never
 *     embedded image bytes of any kind.
 *   - Neither `displayName` nor `avatar` may ever hold Authentication
 *     or credential-shaped content (a session token, a login
 *     timestamp, a credential id) — both are display-only, public
 *     profile fields, exactly like `publicIdentifier`.
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
  readonly displayName?: string;
  readonly avatar?: string;
}

export interface FedosNostrPublicIdentitySource {
  readPublicIdentity(): Promise<FedosNostrPublicIdentitySnapshot | null>;
}
