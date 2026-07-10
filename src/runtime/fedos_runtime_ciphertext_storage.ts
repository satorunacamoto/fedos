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
 * four-layer chain, because there is no Rust Boundary to reach.**
 * Secure Runtime Alpha 021 ("Storage Backend Abstraction Layer") adds
 * ONE more link — a Storage Resolver — between this Service and the
 * backend it uses, so a future OS-backed backend can be added by
 * changing only the Resolver, never this file:
 *
 *   AppRuntime.storeCiphertext()/loadCiphertext()/deleteCiphertext()  Public Runtime API
 *     |                                                              (create_runtime.ts / types.ts)
 *     v
 *   storeCiphertext()/loadCiphertext()/deleteCiphertext()             Runtime Storage Service
 *     |                                                              (THIS FILE)
 *     v
 *   resolveRuntimeStorageBackend()                                   Storage Resolver
 *     |                                                              (fedos_runtime_storage_resolver.ts)
 *     v
 *   RuntimeStorageBackend (Backend Interface)                        Storage Backend Interface
 *     |                                                              (fedos_runtime_storage_backend.ts)
 *     v
 *   MemoryStorageBackend                                             Storage Backend
 *                                                                     (fedos_runtime_storage_backend.ts, the ONLY backend)
 *
 * **Development-Runtime-limited, exactly like every other Crypto API's
 * own Fail-Closed discipline** — but since there is no `FedosWasmLoader`
 * to reach for this gate, this file makes its OWN Fail-Closed decision
 * from the shared Runtime Mode Authority's classification (Secure
 * Runtime Alpha 020, `fedos_runtime_mode_authority.ts`): `"Development"`
 * allowed, `"Production"`/`"Unknown"` Fail Closed — the SAME established
 * three-way shape `#evaluateDevOnlyGate()`/`determineRuntimeMode()`
 * already use, now read from one place instead of three.
 *
 * **`MemoryStorageBackend` is the ONLY backend the Resolver ever
 * returns, and is deliberately a Local-Development-only, in-process,
 * non-persistent (across actual process restarts) `Map`.** SQLite,
 * IndexedDB, filesystem, Windows DPAPI, macOS Keychain, and Linux
 * Secret Service are all explicitly NOT implemented by this Stage —
 * `RuntimeStorageBackend` (the Backend Interface) and the Resolver seam
 * exist precisely so a FUTURE, separately-reviewed Stage can add one of
 * those without changing this file's own Public API shape.
 *
 * **Deliberate exception to this arc's own "fresh instance per call"
 * convention:** every prior Crypto API's Runtime Service constructs a
 * BRAND NEW `FedosWasmLoader` on every call (nothing persists between
 * calls). Storage's entire purpose is the opposite — `storeCiphertext()`
 * now and `loadCiphertext()` later must observe the SAME data — so this
 * file's default storage is whatever `resolveRuntimeStorageBackend()`
 * (`fedos_runtime_storage_resolver.ts`) returns, which is itself a
 * SINGLE, module-level instance, shared across every call that omits
 * the optional `storage` parameter. This is the one deliberate,
 * documented departure from the fresh-instance convention (Alpha 019),
 * now implemented one hop further down, via the Resolver.
 *
 * HARD GUARDRAILS:
 *   - `storeCiphertext()`/`loadCiphertext()`/`deleteCiphertext()` are
 *     the ONLY exports of this file. The Backend Interface and its
 *     Memory implementation live in `fedos_runtime_storage_backend.ts`;
 *     the Resolver lives in `fedos_runtime_storage_resolver.ts`.
 *   - NO reference to `src/worker.ts`, and this file is not referenced
 *     BY `src/worker.ts` — Worker remains fully unconnected.
 *   - NO Production connection — outside Development Runtime, every
 *     function resolves `null`, regardless of what the resolved backend
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
// Secure Runtime Alpha 020 -- isDevelopmentRuntimeForCiphertextStorage()
// below now delegates to the shared Runtime Mode Authority instead of
// reading process.env.NODE_ENV itself. See
// fedos_runtime_mode_authority.ts's own top-of-file doc comment; this
// import is a classifier only, never an authorization one -- this file
// still makes its own Fail-Closed decision from the classification it
// returns.
import { determineFedosRuntimeMode } from "./fedos_runtime_mode_authority.js";
// Secure Runtime Alpha 021 -- the Backend Interface (RuntimeStorageBackend)
// and its ONLY implementation (MemoryStorageBackend) moved to their own
// module. This file no longer defines either -- see
// fedos_runtime_storage_backend.ts's own top-of-file doc comment.
import type { RuntimeStorageBackend } from "./fedos_runtime_storage_backend.js";
// Secure Runtime Alpha 021 -- the Storage Resolver, the ONE seam that
// decides WHICH RuntimeStorageBackend this Service uses. Currently
// always resolves MemoryStorageBackend; a future Stage can change ONLY
// this Resolver to add a real backend switch. See
// fedos_runtime_storage_resolver.ts's own top-of-file doc comment.
import { resolveRuntimeStorageBackend } from "./fedos_runtime_storage_resolver.js";

/**
 * PRIVATE — delegated to the shared Runtime Mode Authority
 * (`fedos_runtime_mode_authority.ts`) by Secure Runtime Alpha 020; this
 * file no longer reads `process.env` itself. Treats `"Development"` as
 * the ONE allowed classification, and treats `"Production"`/`"Unknown"`
 * (including a classification failure, which the Authority itself
 * already resolves to `"Unknown"` rather than throwing) as Fail Closed.
 * Unlike the Authority's own classification (a label only), this
 * function's result IS a real gate — every exported function below
 * branches on it; this file keeps making its OWN Fail-Closed decision
 * from the shared classification, never delegating the decision itself.
 */
function isDevelopmentRuntimeForCiphertextStorage(): boolean {
  try {
    return determineFedosRuntimeMode() === "Development";
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
 * (`create_runtime.ts`). Stores `wire` under `id` in the backend the
 * Storage Resolver resolves (`resolveRuntimeStorageBackend()`, Secure
 * Runtime Alpha 021 — currently always `MemoryStorageBackend`), or an
 * injected `storage`, purely for testability — every REAL call site
 * omits it. Fail Closed to `null` (never `false`) when: not Development
 * Runtime; `id`/`wire` is not a genuine non-empty `string`; or the
 * storage backend itself throws. Resolves the backend's own
 * `true`/`false` only when the gate and shape checks both pass and the
 * call did not throw.
 */
export async function storeCiphertext(
  id: string,
  wire: AeadCiphertextWire,
  storage: RuntimeStorageBackend = resolveRuntimeStorageBackend(),
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
 * recently stored under `id` from the backend the Storage Resolver
 * resolves (or an injected `storage`, purely for testability). Fail
 * Closed to `null` when: not Development Runtime; `id` is not a genuine
 * non-empty `string`; no value was ever stored under `id` (or it was
 * deleted); or the storage backend itself throws.
 */
export async function loadCiphertext(
  id: string,
  storage: RuntimeStorageBackend = resolveRuntimeStorageBackend(),
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
 * backend the Storage Resolver resolves (or an injected `storage`,
 * purely for testability). Fail Closed to `null` (never `false`) when:
 * not Development Runtime; `id` is not a genuine non-empty `string`; or
 * the storage backend itself throws. Resolves the backend's own
 * `true`/`false` only when the gate and shape checks both pass and the
 * call did not throw.
 */
export async function deleteCiphertext(
  id: string,
  storage: RuntimeStorageBackend = resolveRuntimeStorageBackend(),
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
