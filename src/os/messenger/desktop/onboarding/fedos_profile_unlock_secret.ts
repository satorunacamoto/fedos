/**
 * Secure Runtime Alpha 4661-4740 — Phase D / Phase J: the ONE trusted
 * secret payload type for the local unlock secret, with mandatory
 * redaction.
 *
 * SECURE UNLOCK INPUT DECISION (Phase D). The reviewed options were:
 *   A) Electron renderer form through the frozen preload command;
 *   B) native Electron dialog;
 *   C) stdin/CLI development fallback;
 *   D) OS credential store;
 *   E) environment variable;
 *   F) another evidence-backed option.
 *
 * Narrowest honest choice: **the local unlock secret is carried ONLY as an
 * in-process `Uint8Array` inside this dedicated `FedosProfileUnlockSecret`
 * payload, handed straight to the existing `FedosPassphraseProvider`
 * boundary (`../../runtime/master_seed/fedos_passphrase_provider.ts`, Alpha
 * 1267) and thence to `FedosMasterSeedAuthority.seal()/restoreSealed()`.**
 * It is never a string, never a config field, never a command-response
 * field, never logged. Options D (OS keychain) and E (env var) are
 * explicitly REJECTED by the Absolute Prohibitions. Option A (renderer form
 * through the frozen preload) is the intended eventual UI transport, but
 * this codebase has **no reviewed Electron GUI passphrase-prompt boundary
 * today** (Alpha 1267's own explicit "no GUI prompt in this Arc" scope
 * limit is still in force — Phase A §3), and a real unlocked Master Seed
 * cannot be produced at all here anyway (the WASM crypto gate is closed,
 * Phase A §2). So, per Phase D's fallback clause, this Arc:
 *   - implements profile detection + locked-state presentation,
 *   - implements the application service boundary + trusted secret payload,
 *   - provides a DEVELOPMENT-ONLY injected unlock authority
 *     (`./fedos_development_master_seed_authority.ts`),
 *   - and STOPS honestly before claiming a user-ready GUI unlock path.
 *
 * This file therefore defines the secret's TYPE and lifetime discipline
 * only — the transport that fills it is the caller's, kept as narrow as the
 * codebase honestly supports today.
 *
 * HARD GUARDRAILS:
 *   - `FedosProfileUnlockSecret` NEVER exposes its bytes to `JSON`,
 *     `toString`, or any diagnostic. `toJSON`/`toString` return a fixed
 *     redaction marker.
 *   - `consume()` hands the bytes to a callback exactly once, then zeroes
 *     and invalidates the buffer (best-effort clearing where the runtime
 *     permits — Phase D). A second `consume()` fails closed.
 *   - No persistence of any kind. No echo. No return to a Renderer.
 */

export const FEDOS_UNLOCK_SECRET_REDACTION = "[redacted:unlock-secret]" as const;

/** Coarse policy limits for a candidate unlock secret. Deliberately minimal — length only; never a password-strength oracle that could leak partial correctness. */
export interface FedosUnlockSecretPolicy {
  readonly minByteLength: number;
  readonly maxByteLength: number;
}

export const FEDOS_DEFAULT_UNLOCK_SECRET_POLICY: FedosUnlockSecretPolicy = Object.freeze({
  minByteLength: 8,
  maxByteLength: 1024,
});

export type FedosUnlockSecretValidation = "ok" | "too-short" | "too-long" | "empty";

/** Validates a candidate byte length against policy WITHOUT inspecting the bytes' content. Never reveals anything but the coarse length verdict. */
export function validateFedosUnlockSecretBytes(
  bytes: Uint8Array,
  policy: FedosUnlockSecretPolicy = FEDOS_DEFAULT_UNLOCK_SECRET_POLICY,
): FedosUnlockSecretValidation {
  if (bytes.length === 0) return "empty";
  if (bytes.length < policy.minByteLength) return "too-short";
  if (bytes.length > policy.maxByteLength) return "too-long";
  return "ok";
}

/**
 * A one-shot, redacted carrier for the raw unlock secret bytes. The ONLY
 * way to read the bytes is `consume(fn)`, which invokes `fn` once with the
 * live buffer and then zeroes+invalidates it. There is no getter, no
 * property, no serialization that reveals the bytes.
 */
export class FedosProfileUnlockSecret {
  #bytes: Uint8Array | null;

  /** The caller transfers ownership of `bytes` — this object zeroes them on `consume()`/`clear()`; the caller must not retain a separate reference. */
  constructor(bytes: Uint8Array) {
    this.#bytes = bytes;
  }

  /** True until the secret has been consumed or cleared. */
  get available(): boolean {
    return this.#bytes !== null;
  }

  /** The current byte LENGTH (a non-secret, coarse property used only for policy validation), or -1 once consumed/cleared. Never reveals content. */
  get byteLength(): number {
    return this.#bytes === null ? -1 : this.#bytes.length;
  }

  /**
   * Hands the live bytes to `fn` exactly once, awaits its result, then
   * ALWAYS zeroes and invalidates the buffer (even if `fn` throws). Returns
   * `fn`'s result, or `null` if the secret was already consumed/cleared.
   * Best-effort clearing where the JS runtime permits (Phase D).
   */
  async consume<T>(fn: (bytes: Uint8Array) => T | Promise<T>): Promise<T | null> {
    const bytes = this.#bytes;
    if (bytes === null) return null;
    try {
      return await fn(bytes);
    } finally {
      bytes.fill(0);
      this.#bytes = null;
    }
  }

  /** Zeroes and invalidates without ever exposing the bytes. Idempotent. */
  clear(): void {
    if (this.#bytes !== null) {
      this.#bytes.fill(0);
      this.#bytes = null;
    }
  }

  /** Redacted — never the bytes. */
  toString(): string {
    return FEDOS_UNLOCK_SECRET_REDACTION;
  }

  /** Redacted — `JSON.stringify` of this object (or anything containing it) never reveals the bytes. */
  toJSON(): string {
    return FEDOS_UNLOCK_SECRET_REDACTION;
  }
}

/** Builds a `FedosProfileUnlockSecret` from a UTF-8 string, transferring the encoded bytes into the one-shot carrier. The source string remains the caller's to manage; this Arc never persists or logs it. */
export function fedosProfileUnlockSecretFromUtf8(secret: string): FedosProfileUnlockSecret {
  return new FedosProfileUnlockSecret(new TextEncoder().encode(secret));
}
