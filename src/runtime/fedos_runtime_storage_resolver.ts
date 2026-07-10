/**
 * Secure Runtime Alpha 021 — "Storage Resolver".
 *
 * The single seam between the Runtime Storage Service
 * (`fedos_runtime_ciphertext_storage.ts`) and WHICH
 * `RuntimeStorageBackend` (`fedos_runtime_storage_backend.ts`) it
 * actually uses. Today, and for this Stage only,
 * `resolveRuntimeStorageBackend()` is hardcoded to always return the
 * SAME shared `MemoryStorageBackend` singleton — there is no
 * environment/platform switch of any kind yet.
 *
 * **This Resolver exists so a FUTURE, separately-reviewed Stage can add
 * a real switch (Windows DPAPI / macOS Keychain / Linux Secret Service
 * / SQLite / etc.) by changing ONLY this one file.** The Runtime
 * Storage Service never constructs a backend itself, and will never
 * need to change when a new backend is added or the selection logic
 * changes — it only ever calls `resolveRuntimeStorageBackend()`. This
 * Stage adds NO switch condition, NO platform detection, and NO new
 * backend of any kind — `MemoryStorageBackend` remains the ONLY backend
 * that exists.
 *
 * **Singleton, not fresh-per-call**: mirrors Alpha 019's own documented
 * exception to this arc's "fresh instance per call" convention —
 * `storeCiphertext()` now and `loadCiphertext()` later must observe the
 * SAME data, so the resolved backend is ONE shared, module-level
 * instance, not a new one per call. Every call to
 * `resolveRuntimeStorageBackend()` returns the exact same object.
 *
 * HARD GUARDRAILS:
 *   - `resolveRuntimeStorageBackend()` is the ONLY export.
 *   - Always resolves `MemoryStorageBackend` — no condition, no
 *     environment read, no platform detection of any kind. (A future
 *     Stage may add one; this Stage does not.)
 *   - NO reference to `src/worker.ts`, and this file is not referenced
 *     BY `src/worker.ts` — Worker remains fully unconnected.
 *   - NO filesystem, SQLite, IndexedDB, Windows DPAPI, macOS Keychain,
 *     Linux Secret Service, Cloud, or Network reference of any kind.
 */

import { MemoryStorageBackend, type RuntimeStorageBackend } from "./fedos_runtime_storage_backend.js";

/**
 * PRIVATE (module-scoped) — the ONE shared backend instance
 * `resolveRuntimeStorageBackend()` always returns. See this file's own
 * top-of-file "Singleton, not fresh-per-call" note.
 */
const sharedBackend: RuntimeStorageBackend = new MemoryStorageBackend();

/**
 * PUBLIC — resolves which `RuntimeStorageBackend` the Runtime Storage
 * Service should use. Currently, and for this Stage only, ALWAYS
 * `MemoryStorageBackend` — a future Stage may add a real selection
 * condition here (e.g. platform detection choosing DPAPI/Keychain/
 * Secret Service/SQLite) without changing this function's own
 * signature, its caller, or any Public Runtime API.
 */
export function resolveRuntimeStorageBackend(): RuntimeStorageBackend {
  return sharedBackend;
}
