/**
 * Reputation / Persona Epoch — REAL signing keypair (Wave B, Agent R closure
 * pass).
 *
 * `persona_epoch.ts`'s header reserved `PersonaEpoch.epochKeyPublicHex` as a
 * "KEY MATERIAL SLOT for a THIRD, independent keypair" and named the exact
 * precedent to follow: `FedosTrustSigningKeypair.generate()`
 * (`src/os/trust/envelope/fedos_trust_signing_keypair.ts`) and
 * `FedosDeviceSigningKeypair.generate()`
 * (`src/os/messenger/device/crypto/fedos_device_signing_keypair.ts`) — same
 * `@noble/curves` `schnorr.utils.randomSecretKey()` call shape, duplicated
 * rather than imported because `src/os/commerce` must not depend on
 * `src/os/messenger` (`test/architecture_boundary_commerce.test.ts`) and
 * this directory's own established discipline (see every other file's own
 * header) is to keep `os/trust` an independent, non-imported mirror too —
 * this file follows that same precedent a THIRD time, for the SAME
 * documented reason: three independent domains (Messenger Device identity,
 * Trust envelope signing, Commerce reputation/Persona) each need their own
 * fresh, non-derived secp256k1 keypair, and gaining that independence is
 * worth ~20 duplicated lines over a cross-domain import.
 *
 * THIS FILE IS THE REAL IMPLEMENTATION the design docs deferred — not
 * scaffolding. `PersonaEpochSigningKeypair` is what `PersonaEpoch.epochKeyPublicHex`
 * (`persona_epoch.ts`) is the public half of, once actually generated.
 *
 * OPAQUE HANDLE DISCIPLINE (matches `FedosTrustSigningKeypair`,
 * `FedosDeviceSigningKeypair`): the raw secret key lives in one private
 * field, is never returned by any method, and is used only inside
 * `signDigest()`/`signBytes()`.
 *
 * KEY COMPROMISE — WHAT LEAKS, WHAT DOESN'T
 * ----------------------------------------------------------------------
 * If a `PersonaEpochSigningKeypair`'s secret key is compromised:
 *   - The attacker CAN sign new `TradeCompletionAttestationPayload`s
 *     claiming to be that epoch, for as long as the epoch remains within
 *     its `validFrom`/`validUntil` window (`persona_epoch.ts`) — i.e. the
 *     blast radius is bounded by the epoch's own bounded lifetime, which is
 *     exactly why `PersonaEpoch` is bounded-lifetime rather than permanent.
 *   - The attacker CANNOT retroactively alter or invalidate any
 *     ALREADY-ISSUED attestation signed by the legitimate key before
 *     compromise — signature integrity is per-object; a compromised key
 *     cannot rewrite history, only extend it.
 *   - The attacker CANNOT, by holding only this key, forge an attestation
 *     for a trade the legitimate persona was never actually a party to:
 *     `reputation_issuance.ts`'s `issueTradeCompletionAttestation` gates
 *     issuance on a REAL completed Commerce `Order` looked up from an
 *     `OrderRepository`, and on the caller's `attestorRealPubkey` matching
 *     that Order's own `buyerPubkey`/`sellerPubkey` — a leaked
 *     `PersonaEpochSigningKeypair` alone, without ALSO controlling the real
 *     identity that placed/accepted a real Order, is insufficient to mint a
 *     new valid attestation through that function. (It remains sufficient
 *     to forge a bare envelope OUTSIDE that function, which is why
 *     `verifyTradeCompletionAttestationEnvelope`
 *     (`attestation_sign_verify.ts`) alone — a pure signature check — must
 *     never be treated as "this trade really happened"; only a verifier who
 *     also trusts the issuance path, or who independently confirms the
 *     referenced order via `verifyTradeRefDigest`, gets that guarantee.)
 *   - There is no revocation list in this design (no CRL/OCSP-equivalent
 *     anywhere in `src/os/trust` either, confirmed by inspection) — the ONLY
 *     mitigation this design offers against a compromised epoch key is
 *     letting the epoch expire (or, once the coordinator's UI wires it,
 *     the persona choosing to stop presenting/renewing it) and rolling over
 *     to a fresh epoch via `persona_epoch_registry.ts`'s
 *     `rolloverPersonaEpoch` — which, if the persona wants a clean break,
 *     it can do WITHOUT a carry-over statement, at the cost of losing
 *     claimed continuity (see `carry_over.ts`'s own linkability warning for
 *     the opposite trade-off if a carry-over IS produced).
 */

import { schnorr } from "@noble/curves/secp256k1.js";
import { sha256 } from "@noble/hashes/sha2.js";
import { bytesToHex, hexToBytes } from "@noble/hashes/utils.js";

const PUBLIC_KEY_HEX_PATTERN = /^[0-9a-f]{64}$/;
const SCHNORR_SIGNATURE_HEX_PATTERN = /^[0-9a-f]{128}$/;

/** Human-readable note on key-compromise blast radius — see this file's
 * header. Exported so a future UI/CLI can surface it verbatim wherever a
 * Persona Epoch key's security properties are explained to a user, mirroring
 * this directory's `EPOCH_CARRY_OVER_LINKABILITY_WARNING` precedent
 * (`carry_over.ts`). */
export const PERSONA_EPOCH_KEY_COMPROMISE_NOTE =
  "If a persona epoch's signing key is compromised, the attacker can sign new trade-completion attestations as that epoch until it expires or you roll over to a fresh epoch — but only for real completed orders the attacker's real account was actually party to (a leaked epoch key alone cannot forge a trade that never happened), and past attestations already issued cannot be altered. There is no revocation list; expiry and rollover are the only mitigations.";

export class PersonaEpochSigningKeypair {
  readonly #secretKey: Uint8Array;
  readonly publicKeyHex: string;

  /** PRIVATE — use `PersonaEpochSigningKeypair.generate()` or
   * `.fromSecretKeyBytes()`. */
  private constructor(secretKey: Uint8Array) {
    this.#secretKey = secretKey;
    this.publicKeyHex = bytesToHex(schnorr.getPublicKey(secretKey));
  }

  /** Generates a fresh, independent keypair using `@noble/curves`'s own
   * reviewed key-generation path — NEVER derived from a Master Seed, Nostr
   * identity key, or Double Ratchet chain key (see `persona_epoch.ts`'s
   * header for why). */
  static generate(): PersonaEpochSigningKeypair {
    return new PersonaEpochSigningKeypair(schnorr.utils.randomSecretKey());
  }

  /**
   * FedOS Commerce FINAL P1 Closure — the seam a durable sealed-key-custody
   * caller uses to generate raw secret material it can seal at rest BEFORE
   * ever constructing an opaque `PersonaEpochSigningKeypair` instance (this
   * class's own instances never expose their secret — see the file header
   * — so a caller sealing a FRESH key at rest needs the raw bytes first).
   * Returns the exact same kind of CSPRNG-random secret `generate()`
   * itself uses internally; this is not a new source of randomness, only
   * a way to reach it before wrapping it in the opaque class. See
   * `src/os/core/vault/wasm/fedos_sealed_signing_key_store.ts`.
   */
  static generateSecretKeyBytesForSealedCustody(): Uint8Array {
    return schnorr.utils.randomSecretKey();
  }

  /** Loads a keypair from raw 32-byte secret material — the seam a future
   * durable key-custody adapter uses. Callers are responsible for how
   * `secretKeyBytes` was obtained; this class never reads a secret from an
   * env var, CLI argument, file, or log itself. */
  static fromSecretKeyBytes(secretKeyBytes: Uint8Array): PersonaEpochSigningKeypair {
    if (secretKeyBytes.length !== 32) {
      throw new RangeError("persona epoch signing keypair: secret key must be exactly 32 bytes");
    }
    return new PersonaEpochSigningKeypair(secretKeyBytes);
  }

  /** Signs an already-computed 32-byte digest. Returns 64 raw signature
   * bytes. Never exposes the secret key. */
  signDigest(messageDigest32: Uint8Array): Uint8Array {
    return schnorr.sign(messageDigest32, this.#secretKey);
  }

  /** Convenience: `signDigest(sha256(bytes))` — every reputation envelope in
   * this directory is signed over `sha256(canonicalBytes)`, matching this
   * repo's Trust-envelope and Nostr event-id conventions. */
  signBytes(bytes: Uint8Array): Uint8Array {
    return this.signDigest(sha256(bytes));
  }
}

export function isWellFormedPersonaEpochSignatureHex(value: unknown): value is string {
  return typeof value === "string" && SCHNORR_SIGNATURE_HEX_PATTERN.test(value);
}

/** Fails closed to `false` on any malformed input; never throws. */
export function verifyPersonaEpochSignatureOverDigest(
  publicKeyHex: string,
  messageDigest32: Uint8Array,
  signatureHex: string,
): boolean {
  if (typeof publicKeyHex !== "string" || !PUBLIC_KEY_HEX_PATTERN.test(publicKeyHex)) return false;
  if (!isWellFormedPersonaEpochSignatureHex(signatureHex)) return false;
  try {
    return schnorr.verify(hexToBytes(signatureHex), messageDigest32, hexToBytes(publicKeyHex));
  } catch {
    return false;
  }
}

/** Convenience: `verifyPersonaEpochSignatureOverDigest(pk, sha256(bytes), sig)`. */
export function verifyPersonaEpochSignatureOverBytes(
  publicKeyHex: string,
  bytes: Uint8Array,
  signatureHex: string,
): boolean {
  try {
    return verifyPersonaEpochSignatureOverDigest(publicKeyHex, sha256(bytes), signatureHex);
  } catch {
    return false;
  }
}
