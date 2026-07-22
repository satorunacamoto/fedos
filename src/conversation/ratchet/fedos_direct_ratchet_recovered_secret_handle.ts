/**
 * Secure Runtime Alpha 5401-5480 — Phase H/I: an opaque, in-memory-only
 * handle for a recovered ratchet secret. This Arc's own sealing
 * authority (`FedosDirectRatchetSealingAuthority`) returns plain
 * `Uint8Array` bytes (there is no WASM-side opaque handle for a
 * RECOVERED plaintext -- mirrors `decrypt()`'s own established
 * "recovered plaintext is the one value returned as a plain
 * `Uint8Array`" precedent, `../../runtime/fedos_runtime_decrypt.ts`).
 * This wrapper is this Arc's OWN, JS-side discipline for treating that
 * plaintext as disposable: `bytes()` returns `null` once `dispose()` has
 * been called, and `dispose()` overwrites the backing array with zeros
 * before dropping the reference.
 *
 * HONEST LIMITATION: this is BEST-EFFORT zeroization only. JavaScript
 * gives no guarantee that a `Uint8Array`'s backing memory is not copied
 * elsewhere by the engine (string interning, GC compaction, a prior
 * `.slice()`) before `dispose()` runs -- this file does not, and cannot,
 * claim the same guarantee Rust's `zeroize`-backed `SecretHandle` gives
 * for WASM-resident secrets. This is documented, not hidden.
 */
export class FedosDirectRatchetRecoveredSecretHandle {
  #bytes: Uint8Array | null;

  constructor(bytes: Uint8Array) {
    this.#bytes = bytes;
  }

  /** `null` once `dispose()` has been called. */
  bytes(): Uint8Array | null {
    return this.#bytes;
  }

  isDisposed(): boolean {
    return this.#bytes === null;
  }

  /** Idempotent -- calling more than once is safe and a no-op after the first call. Best-effort only; see file header. */
  dispose(): void {
    if (this.#bytes === null) return;
    this.#bytes.fill(0);
    this.#bytes = null;
  }
}
