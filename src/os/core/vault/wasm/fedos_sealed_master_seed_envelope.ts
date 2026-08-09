/**
 * Secure Runtime Alpha 435 — the Sealed Master Seed Envelope V1
 * TypeScript-side wire type. The Rust Master Seed Authority
 * (`FedosMasterSeedAuthority`, `packages/fedos-core-rust/src/lib.rs`) is
 * the sole producer and sole AUTHORITATIVE parser of this format
 * (Argon2id-wrapped ChaCha20-Poly1305 ciphertext, schema version 1,
 * fixed key order `v,kdf,m,t,p,salt,alg,n,ct`) — this file never
 * re-implements that codec, and never parses out an individual field
 * (no `salt`/`nonce`/`ciphertext` accessor of any kind), since none of
 * those fields has a legitimate TypeScript-side use: the envelope only
 * ever needs to travel, whole, from wherever it is persisted back into
 * `restoreSealed()`.
 *
 * HARD GUARDRAILS:
 *   - No plaintext Master Seed byte ever appears in, or is derivable
 *     from, this file.
 *   - `isWellFormedSealedMasterSeedEnvelopeV1Json()` is a structural,
 *     NON-authoritative pre-check only — passing it does NOT mean a
 *     string is a genuine, unforged envelope. Real authentication
 *     happens exclusively inside Rust's `restore_sealed`.
 *
 * Architecture Dependency Closure Arc — moved here from
 * `src/runtime/master_seed/fedos_sealed_master_seed_envelope.ts`
 * unmodified (a shim remains at that old path). See
 * `docs/architecture/CORE-SECRETS-OWNERSHIP-PLAN.md`.
 */

const SEALED_MASTER_SEED_ENVELOPE_V1_PREFIX = '{"v":1,"kdf":"argon2id"';

export interface FedosSealedMasterSeedEnvelopeV1 {
  readonly json: string;
}

/**
 * Structural pre-validation only: confirms `candidate` is a string
 * starting with this format's fixed schema-version + KDF prefix. Rejects
 * every other shape/version/KDF label. Never throws.
 */
export function isWellFormedSealedMasterSeedEnvelopeV1Json(candidate: unknown): candidate is string {
  return typeof candidate === "string" && candidate.startsWith(SEALED_MASTER_SEED_ENVELOPE_V1_PREFIX);
}

/**
 * Wraps `candidate` as a deep-frozen `FedosSealedMasterSeedEnvelopeV1`,
 * or returns `null` if it fails `isWellFormedSealedMasterSeedEnvelopeV1Json()`.
 * Never throws.
 */
export function toSealedMasterSeedEnvelopeV1(candidate: unknown): FedosSealedMasterSeedEnvelopeV1 | null {
  if (!isWellFormedSealedMasterSeedEnvelopeV1Json(candidate)) return null;
  return Object.freeze({ json: candidate });
}
