/**
 * Stage 1012 (Secure Runtime Alpha 019) — "Secure Storage Foundation":
 * the minimal Storage layer that makes `AeadCiphertextWire` (Stage
 * 1011, Secure Runtime Alpha 018) actually persistable across separate
 * calls within one Runtime process — the FIRST storage-shaped Public
 * Runtime API this arc adds. Adds `AppRuntime.storeCiphertext()`/
 * `loadCiphertext()`/`deleteCiphertext()`.
 *
 * **STORES `AeadCiphertextWire` ONLY. NEVER `AeadKeyHandle`.** This
 * file defines no function, method, or code path that accepts, stores,
 * or returns an `AeadKeyHandle` (or any raw key byte) in any form — the
 * `docs/public_crypto_opaque_handles.md`/Alpha 007 §6 permanent
 * exclusion of raw/persistable key material from a general-purpose
 * surface remains fully in force. `exportKey()`/`importKey()` remain
 * unimplemented and are not made any more reachable by this Stage.
 *
 * **NO RUST CHANGE.** `AeadCiphertextWire` is ALREADY a plain,
 * fully-opaque-content-wise (from this file's perspective) `string` by
 * the time it reaches this layer — `exportCiphertext()`/
 * `importCiphertext()` (Stage 1011) already did the one and only
 * WASM/Rust round trip this value ever needs. Storing/loading/deleting
 * a string requires no cryptographic operation, no new
 * `#[wasm_bindgen]` export, and no `FedosWasmLoader` reach at all —
 * `packages/fedos-core-rust/src/lib.rs` is untouched by this Stage.
 *
 * **Architecture — deliberately SHORTER than every prior Crypto API's
 * four-layer chain, because there is no Rust Boundary to reach:**
 *
 *   AppRuntime.storeCiphertext()/loadCiphertext()/deleteCiphertext()  Public Runtime API
 *     |                                                              (create_runtime.ts / types.ts)
 *     v
 *   storeCiphertext()/loadCiphertext()/deleteCiphertext()             Runtime Storage Service
 *     |                                                              (THIS FILE)
 *     v
 *   RuntimeCiphertextStorage (Storage Interface)                      Storage Interface
 *     |                                                              (THIS FILE)
 *     v
 *   MemoryCiphertextStorage                                          Storage Backend
 *                                                                     (THIS FILE, the ONLY backend)
 *
 * **Development-Runtime-limited, exactly like every other Crypto API's
 * own Fail-Closed discipline** — but since there is no `FedosWasmLoader`
 * to reach for this gate, this file performs its OWN, directly
 * analogous `process.env.NODE_ENV` read
 * (`#evaluateDevOnlyGate()`/`determineRuntimeMode()`'s own established
 * three-way shape: `"development"` allowed, `"production"`/anything
 * else/an unreadable `process.env` all Fail Closed), wrapped in the SAME
 * try/catch discipline.
 *
 * **`MemoryCiphertextStorage` is the ONLY backend, and is deliberately
 * a Local-Development-only, in-process, non-persistent (across actual
 * process restarts) `Map`.** SQLite, IndexedDB, filesystem, Windows
 * DPAPI, macOS Keychain, and Linux Secret Service are all explicitly
 * NOT implemented by this Stage — `RuntimeCiphertextStorage` (the
 * Storage Interface) exists precisely so a FUTURE, separately-reviewed
 * Stage can add one of those without changing this file's own Public
 * API shape.
 *
 * **Deliberate exception to this arc's own "fresh instance per call"
 * convention:** every prior Crypto API's Runtime Service constructs a
 * BRAND NEW `FedosWasmLoader` on every call (nothing persists between
 * calls). Storage's entire purpose is the opposite — `storeCiphertext()`
 * now and `loadCiphertext()` later must observe the SAME data — so this
 * file's default storage (`defaultCiphertextStorage`) is a SINGLE,
 * module-level instance, shared across every call that omits the
 * optional `storage` parameter. This is the one deliberate, documented
 * departure from the fresh-instance convention, and it is confined
 * entirely to this file.
 *
 * HARD GUARDRAILS:
 *   - `storeCiphertext()`/`loadCiphertext()`/`deleteCiphertext()` (plus
 *     the `RuntimeCiphertextStorage` interface and
 *     `MemoryCiphertextStorage` class) are the ONLY exports.
 *   - NO reference to `src/worker.ts`, and this file is not referenced
 *     BY `src/worker.ts` — Worker remains fully unconnected.
 *   - NO Production connection — outside Development Runtime, every
 *     function resolves `null`, regardless of what `MemoryCiphertextStorage`
 *     itself would have returned.
 *   - NO OS Keychain, Secure Enclave, Cloud, Network, Nostr, ActivityPub,
 *     Bluesky, or Session reference of any kind.
 *   - NO exception ever escapes any of the three exported functions —
 *     every storage-backend call is wrapped in `try`/`catch`.
 *   - NO call to `randomBytes()`/`generateAeadKey()`/`encrypt()`/
 *     `decrypt()`/`exportCiphertext()`/`importCiphertext()`/
 *     `runtimeCapabilities()`/`createRuntimeInitializeCryptoResult()` —
 *     this file is a pure storage layer, entirely downstream of those
 *     values, never a producer of them.
 */

import type { AeadCiphertextWire } from "./fedos_wasm_loader.js";

declare const process: { env?: { readonly NODE_ENV?: string } };

/**
 * The Storage Interface. A future backend (SQLite/IndexedDB/filesystem/
 * OS Keychain/Secret Service — none implemented by this Stage) would
 * implement this SAME shape; `storeCiphertext()`/`loadCiphertext()`/
 * `deleteCiphertext()` (below) depend on nothing beyond it. Deliberately
 * narrow: three methods, no query/list/enumerate capability, no
 * metadata beyond the `id` the caller itself supplies.
 */
export interface RuntimeCiphertextStorage {
  store(id: string, wire: AeadCiphertextWire): Promise<boolean>;
  load(id: string): Promise<AeadCiphertextWire | null>;
  delete(id: string): Promise<boolean>;
}

/**
 * The ONLY `RuntimeCiphertextStorage` implementation this Stage ships.
 * A plain in-process `Map` — data does NOT survive an actual process
 * restart, is never written to disk, and is never visible to a Worker
 * or any other process. Stores `AeadCiphertextWire` values ONLY; its
 * own type signature (inherited from `RuntimeCiphertextStorage`) makes
 * accepting an `AeadKeyHandle` a compile-time error, not merely a
 * documented rule.
 */
export class MemoryCiphertextStorage implements RuntimeCiphertextStorage {
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

/**
 * PRIVATE (module-scoped) — the ONE shared `MemoryCiphertextStorage`
 * instance every exported function below uses when its caller omits the
 * optional `storage` parameter. See this file's own top-of-file doc
 * comment ("Deliberate exception...") for why this is a singleton
 * rather than a fresh instance per call.
 */
const defaultCiphertextStorage: RuntimeCiphertextStorage = new MemoryCiphertextStorage();

/**
 * PRIVATE — mirrors `FedosWasmLoaderSkeleton#evaluateDevOnlyGate()`/
 * `fedos_runtime_prototype_execution.ts`'s own `determineRuntimeMode()`
 * Fail-Closed try/catch shape exactly: reads ONLY `process.env.NODE_ENV`,
 * treats `"development"` as the ONE allowed value, and treats
 * `"production"`, any other value, or a read failure (including
 * `process`/`process.env` being unavailable at all) as Fail Closed.
 * Unlike `determineRuntimeMode()` (a label only), this function's
 * result IS a real gate — every exported function below branches on it.
 */
function isDevelopmentRuntimeForCiphertextStorage(): boolean {
  try {
    return process.env?.NODE_ENV === "development";
  } catch {
    return false;
  }
}

/** PRIVATE — Fail-Closed shape guard: a genuine, non-empty `string`. */
function isGenuineNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.length > 0;
}

/**
 * PUBLIC, ASYNC — wired into `AppRuntime` as `storeCiphertext`
 * (`create_runtime.ts`). Stores `wire` under `id` in the shared
 * `MemoryCiphertextStorage` (or an injected `storage`, purely for
 * testability — every REAL call site omits it). Fail Closed to `null`
 * (never `false`) when: not Development Runtime; `id`/`wire` is not a
 * genuine non-empty `string`; or the storage backend itself throws.
 * Resolves the backend's own `true`/`false` only when the gate and
 * shape checks both pass and the call did not throw.
 */
export async function storeCiphertext(
  id: string,
  wire: AeadCiphertextWire,
  storage: RuntimeCiphertextStorage = defaultCiphertextStorage,
): Promise<boolean | null> {
  if (!isDevelopmentRuntimeForCiphertextStorage()) {
    return null;
  }
  if (!isGenuineNonEmptyString(id) || !isGenuineNonEmptyString(wire)) {
    return null;
  }
  try {
    return await storage.store(id, wire);
  } catch {
    return null;
  }
}

/**
 * PUBLIC, ASYNC — wired into `AppRuntime` as `loadCiphertext`
 * (`create_runtime.ts`). Loads whatever `storeCiphertext()` most
 * recently stored under `id` from the shared `MemoryCiphertextStorage`
 * (or an injected `storage`, purely for testability). Fail Closed to
 * `null` when: not Development Runtime; `id` is not a genuine non-empty
 * `string`; no value was ever stored under `id` (or it was deleted); or
 * the storage backend itself throws.
 */
export async function loadCiphertext(
  id: string,
  storage: RuntimeCiphertextStorage = defaultCiphertextStorage,
): Promise<AeadCiphertextWire | null> {
  if (!isDevelopmentRuntimeForCiphertextStorage()) {
    return null;
  }
  if (!isGenuineNonEmptyString(id)) {
    return null;
  }
  try {
    return await storage.load(id);
  } catch {
    return null;
  }
}

/**
 * PUBLIC, ASYNC — wired into `AppRuntime` as `deleteCiphertext`
 * (`create_runtime.ts`). Removes whatever is stored under `id` from the
 * shared `MemoryCiphertextStorage` (or an injected `storage`, purely
 * for testability). Fail Closed to `null` (never `false`) when: not
 * Development Runtime; `id` is not a genuine non-empty `string`; or the
 * storage backend itself throws. Resolves the backend's own
 * `true`/`false` only when the gate and shape checks both pass and the
 * call did not throw.
 */
export async function deleteCiphertext(
  id: string,
  storage: RuntimeCiphertextStorage = defaultCiphertextStorage,
): Promise<boolean | null> {
  if (!isDevelopmentRuntimeForCiphertextStorage()) {
    return null;
  }
  if (!isGenuineNonEmptyString(id)) {
    return null;
  }
  try {
    return await storage.delete(id);
  } catch {
    return null;
  }
}
