/**
 * Secure Runtime Alpha 1267 ("Passphrase Provider Boundary") — Phase B of
 * the Alpha 1261–1320 Production Conversation Crypto Runtime Activation
 * Arc.
 *
 * A narrow injected boundary between "something obtains a passphrase" and
 * "the Master Seed Authority uses it to seal/restore" — this file
 * implements NO prompt, NO GUI, NO CLI read (Alpha 1267's own explicit
 * "no GUI prompt implementation in this Arc" scope limit; a real
 * interactive provider is a separate, future, explicitly-reviewed stage).
 * `FedosMasterSeedAuthority.seal()`/`restoreSealed()` (Alpha 438,
 * unmodified) already accept a passphrase as a plain `Uint8Array`
 * parameter — this interface exists so a Production Authority Factory
 * (`../../conversation/encryption/production/fedos_conversation_production_crypto_authority_factory.ts`,
 * Alpha 1273) never reads a passphrase from `process.env`, a CLI
 * argument, or any other serializable/loggable source itself; it only
 * ever asks an INJECTED provider, ephemerally, at the moment of use.
 *
 * `FedosFixedPassphraseProvider` is the ONE concrete implementation this
 * Arc ships — a thin, test-and-narrow-production-use wrapper around an
 * already-in-memory `Uint8Array` the CALLER obtained however it sees fit
 * (an environment-injected test fixture, a future real interactive
 * provider's own resolved value, etc.). It never logs, never persists,
 * and never widens its input.
 *
 * HARD GUARDRAILS:
 *   - No `console.log`/`JSON.stringify` of a passphrase anywhere in this
 *     file.
 *   - No passphrase field of any kind on any Runtime config type (Alpha
 *     1266's own "no plaintext passphrase in serializable config" rule)
 *     — a `FedosPassphraseProvider` INSTANCE may be injected into config,
 *     never a raw passphrase value.
 */

export type FedosPassphraseProviderResult =
  | { readonly outcome: "provided"; readonly passphrase: Uint8Array }
  | { readonly outcome: "unavailable" }
  | { readonly outcome: "cancelled" }
  | { readonly outcome: "failed" };

export interface FedosPassphraseProvider {
  /** Total, never throws. Obtains a passphrase ephemerally — never logs, never persists it. */
  obtainPassphrase(): Promise<FedosPassphraseProviderResult>;
}

/**
 * Wraps an already-in-memory `Uint8Array` the caller resolved however it
 * sees fit. `clear()` overwrites the held buffer with zeros and makes
 * every subsequent `obtainPassphrase()` call resolve `"unavailable"` —
 * the SAME "clear temporary buffers where practical" discipline Alpha
 * 1267 asks for, applied to the one buffer this class itself retains.
 */
export class FedosFixedPassphraseProvider implements FedosPassphraseProvider {
  #passphrase: Uint8Array | null;

  constructor(passphrase: Uint8Array) {
    this.#passphrase = passphrase;
  }

  async obtainPassphrase(): Promise<FedosPassphraseProviderResult> {
    if (this.#passphrase === null) return { outcome: "unavailable" };
    return { outcome: "provided", passphrase: this.#passphrase };
  }

  /** Zeroes the held buffer in place and denies every future `obtainPassphrase()` call. */
  clear(): void {
    if (this.#passphrase !== null) {
      this.#passphrase.fill(0);
      this.#passphrase = null;
    }
  }
}

/** The safe default — always `"unavailable"`. No passphrase is ever held or fabricated. */
export class UnavailableFedosPassphraseProvider implements FedosPassphraseProvider {
  async obtainPassphrase(): Promise<FedosPassphraseProviderResult> {
    return { outcome: "unavailable" };
  }
}
