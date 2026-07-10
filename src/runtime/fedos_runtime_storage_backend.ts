/**
 * Secure Runtime Alpha 021 — "Storage Backend Abstraction Layer".
 *
 * Alpha 019 ("Secure Storage Foundation") defined `RuntimeCiphertextStorage`
 * (the Storage Interface) and `MemoryCiphertextStorage` (its ONLY backend)
 * directly inside the Runtime Storage Service
 * (`fedos_runtime_ciphertext_storage.ts`) — deliberately, since no second
 * backend existed yet and no future-backend structure was needed. This
 * Stage extracts BOTH into their own module, renamed to match a layered
 * architecture a future OS-backed Secure Storage Stage will need:
 * `RuntimeStorageBackend` (the Backend Interface) and
 * `MemoryStorageBackend` (its ONLY implementation — still the ONLY one
 * this Stage ships). See `fedos_runtime_storage_resolver.ts` for the
 * Resolver that selects which backend the Runtime Storage Service
 * actually uses — currently, and for this Stage only, always
 * `MemoryStorageBackend`.
 *
 * **`MemoryStorageBackend`'s own storage behavior is BYTE-FOR-BYTE
 * UNCHANGED from Alpha 019's `MemoryCiphertextStorage`** — the SAME
 * plain, in-process `Map<string, AeadCiphertextWire>`, the SAME three
 * methods, the SAME semantics (`store` always resolves `true`; `load`
 * resolves `undefined` as `null`; `delete` resolves whether an entry
 * existed). Only the NAME and the FILE moved — no persistence, no
 * serialization, no new field.
 *
 * HARD GUARDRAILS:
 *   - `RuntimeStorageBackend` (interface) and `MemoryStorageBackend`
 *     (class) are the ONLY exports.
 *   - `MemoryStorageBackend` remains a plain in-process `Map` — NO
 *     filesystem, NO SQLite, NO IndexedDB, NO Windows DPAPI, NO macOS
 *     Keychain, NO Linux Secret Service, NO Cloud, NO Network reference
 *     of any kind.
 *   - NO reference to `src/worker.ts`, and this file is not referenced
 *     BY `src/worker.ts` — Worker remains fully unconnected.
 *   - `store()`/`load()`/`delete()` accept/return `AeadCiphertextWire`
 *     ONLY — NEVER an `AeadKeyHandle` — enforced at the type level,
 *     exactly as Alpha 019 already established.
 *   - NO call to `randomBytes()`/`generateAeadKey()`/`encrypt()`/
 *     `decrypt()`/`exportCiphertext()`/`importCiphertext()`/
 *     `runtimeCapabilities()` — this file is a pure storage backend,
 *     entirely downstream of those values, never a producer of them.
 */

import type { AeadCiphertextWire } from "./fedos_wasm_loader.js";

/**
 * The Storage Backend Interface. Byte-for-byte the same three-method
 * shape Alpha 019's `RuntimeCiphertextStorage` already defined, moved
 * here and renamed to match this Stage's layered architecture. A future
 * OS-backed backend (Windows DPAPI / macOS Keychain / Linux Secret
 * Service / SQLite — none implemented by this Stage) would implement
 * this SAME shape; the Runtime Storage Service depends on nothing
 * beyond it.
 */
export interface RuntimeStorageBackend {
  store(id: string, wire: AeadCiphertextWire): Promise<boolean>;
  load(id: string): Promise<AeadCiphertextWire | null>;
  delete(id: string): Promise<boolean>;
}

/**
 * The ONLY `RuntimeStorageBackend` implementation this Stage ships —
 * byte-for-byte the same plain in-process `Map` Alpha 019's
 * `MemoryCiphertextStorage` already was, moved here and renamed. Data
 * does NOT survive an actual process restart, is never written to disk,
 * and is never visible to a Worker or any other process. Stores
 * `AeadCiphertextWire` values ONLY; its own type signature (inherited
 * from `RuntimeStorageBackend`) makes accepting an `AeadKeyHandle` a
 * compile-time error, not merely a documented rule.
 */
export class MemoryStorageBackend implements RuntimeStorageBackend {
  #entries = new Map<string, AeadCiphertextWire>();

  async store(id: string, wire: AeadCiphertextWire): Promise<boolean> {
    this.#entries.set(id, wire);
    return true;
  }

  async load(id: string): Promise<AeadCiphertextWire | null> {
    const value = this.#entries.get(id);
    return value === undefined ? null : value;
  }

  async delete(id: string): Promise<boolean> {
    return this.#entries.delete(id);
  }
}
