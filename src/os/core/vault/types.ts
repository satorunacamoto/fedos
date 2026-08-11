/**
 * Stage 33 — Vault boundary (types only).
 *
 * A MINIMAL, future-facing seam for the FedOS Vault / Crypto / Identity layer
 * sketched in `docs/vault_crypto_identity.md`. This file defines shapes ONLY — it
 * implements no cryptography, derives no key, and stores no secret. It exists so
 * a real vault can drop in later behind the same interface without the current
 * Nostr/Cloudflare core depending on any of it.
 *
 * HARD GUARDRAILS (see the design notes):
 *   - NO key generation, NO key derivation, NO seed storage, NO AEAD/XOR/BIP39/
 *     BIP32/NIP-44 here.
 *   - Apple ID / Passkey are AUTHENTICATION/UNLOCK factors ONLY — never a
 *     key-derivation source. A JWT, Apple `sub`/user id, or Passkey credential is
 *     NEVER turned into a key or seed. `VaultUnlockRequest` carries only an opaque,
 *     non-secret reference and never key material.
 *   - "Deniable"/shadow storage is RESEARCH only; the capability names below are
 *     placeholders and imply no shipped, safe feature.
 *   - This boundary makes NO security, privacy, or "hidden storage" guarantee. Do
 *     not describe it as "safe", "zero-trace", or able to "hide" anything.
 */

/** Coarse observable state of a vault. No secret is exposed at any state. */
export type VaultState =
  | "locked" // a vault exists but is not open (no secret material is held)
  | "unlocked" // PLACEHOLDER "open" state only — still no key/seed is stored
  | "unavailable" // no vault backend is present (the no-op default)
  | "error"; // an operation failed; recorded as state, never thrown

/**
 * A non-sensitive snapshot of the vault. `reason` is human-readable and MUST
 * never contain secrets, tokens, seeds, or key material.
 */
export interface VaultStatus {
  readonly state: VaultState;
  readonly reason: string;
}

/**
 * The result of an `unlock`/`lock` attempt. Failures are reported here (with a
 * non-sensitive reason) rather than thrown.
 */
export interface VaultDecision {
  readonly allowed: boolean;
  /** The vault state AFTER this decision. */
  readonly state: VaultState;
  /** Non-sensitive explanation. Never echoes the request's reference or secrets. */
  readonly reason: string;
}

/**
 * FUTURE capabilities a vault MIGHT expose — all PLACEHOLDERS in this stage.
 * Presence in this list is a label of intent, NOT a working or safe feature.
 */
export type VaultCapability =
  | "identity_unlock_placeholder" // unlock gated by an external auth factor
  | "deniable_storage_placeholder" // research-only hidden-storage idea
  | "aead_crypto_placeholder" // future AEAD via the crypto core (not here)
  | "external_signer_placeholder"; // delegate signing to a NIP-07 signer

/**
 * How a caller ASKS to unlock. The `kind` names the authentication factor; the
 * optional `reference` is an OPAQUE, non-secret label (e.g. an account handle) —
 * it is NEVER a JWT, user id, passphrase, seed, or key, and the boundary derives
 * nothing from it.
 */
export type VaultUnlockKind =
  | "apple_id" // auth factor only — NOT a key source
  | "passkey" // user-presence factor only — NOT a key source
  | "passphrase" // placeholder; no KDF is run in this boundary
  | "external_signer"; // delegate to an external signer (placeholder)

export interface VaultUnlockRequest {
  readonly kind: VaultUnlockKind;
  /**
   * Optional OPAQUE, non-secret reference. Must not carry key material, a seed, a
   * passphrase, or a raw token — this boundary neither stores nor derives from it.
   */
  readonly reference?: string;
}

/**
 * The vault seam. Implementations MUST NOT generate/derive keys or store secret
 * bytes. `unlock`/`lock` never throw — they resolve to a `VaultDecision` and move
 * the state (including to `error`). Constructing an implementation does nothing.
 */
export interface VaultBoundary {
  /** Current coarse state (pure read). */
  getState(): VaultState;
  /** The PLACEHOLDER capabilities this vault advertises (may be empty). */
  getCapabilities(): readonly VaultCapability[];
  /** Attempt a placeholder unlock. Derives NO key and stores NO secret. */
  unlock(request: VaultUnlockRequest): Promise<VaultDecision>;
  /** Return to the locked state. Never throws. */
  lock(): Promise<VaultDecision>;
  /** True only in the placeholder `unlocked` state. */
  isUnlocked(): boolean;
}

/** The unlock kinds this boundary recognizes (defensive runtime check). */
export const VAULT_UNLOCK_KINDS: ReadonlySet<VaultUnlockKind> = new Set([
  "apple_id",
  "passkey",
  "passphrase",
  "external_signer",
]);
