/**
 * Stage 1004 (Secure Runtime Alpha 008) — "Public Runtime `randomBytes()`
 * API": the FIRST public Crypto API Runtime exposes, implementing this
 * arc's own four-layer Public Runtime API -> Runtime Service -> Rust
 * Boundary -> Internal Rust architecture END TO END, for exactly one
 * operation:
 *
 *   AppRuntime.randomBytes()          <- Public Runtime API   (create_runtime.ts / types.ts)
 *     -> attemptDevOnlyRuntimeRandomBytes()  <- Runtime Service  (THIS FILE)
 *       -> FedosWasmLoaderSkeleton.attemptDevOnlyRandomBytesCall()  <- Rust Boundary reach (fedos_wasm_loader.ts, Stage 1004)
 *         -> random_bytes_32()        <- Rust Boundary (lib.rs, Stage 1004, `#[wasm_bindgen]`)
 *           -> fedos_random_bytes_32()  <- Internal Rust (lib.rs, Stage 137, UNCHANGED)
 *
 * This file is the Runtime Service layer: TypeScript orchestration that
 * decides HOW to reach the Rust Boundary and reshapes its answer into a
 * Runtime-shaped result. It does NOT contain any cryptographic logic of
 * its own, does NOT read/write any byte beyond what the Loader chain
 * hands back, and does NOT touch `src/worker.ts`, Production, Secure
 * Storage, or `fedos_crypto_backend_resolver.ts`.
 *
 * Mirrors `fedos_runtime_prototype_execution.ts`'s own
 * `attemptDevOnlyRuntimeRustIntegration()` (Stage 994) exactly: drives a
 * FRESH `FedosWasmLoader` instance (via `createFedosWasmLoader()`)
 * through the SAME fixed sequence — `planLoad()` (sync) ->
 * `attemptDevOnlyJsGlueImport()` -> `attemptDevOnlyWasmInitialization()`
 * -> (here) `attemptDevOnlyRandomBytesCall()` — then reads back ONLY
 * `succeeded`/`bytes` from the final result. Every one of the Loader's
 * own six Fail-Closed conditions (Generated Artifact Check, Development
 * Runtime, Import Ready, JS Glue Import, JS Glue Module retained, WASM
 * Initialization) is evaluated EXACTLY ONCE, by the Loader's own chain —
 * this file adds NO new gate, NO new environment check, and NO new
 * Fail-Closed reason of its own.
 *
 * HARD GUARDRAILS:
 *   - `attemptDevOnlyRuntimeRandomBytes()` and `randomBytes()` are the
 *     ONLY exports. Calling either constructs its OWN, fresh
 *     `FedosWasmLoader` instance — it never reuses or mutates any
 *     instance `fedos_runtime_prototype_execution.ts`/
 *     `create_runtime.ts` might hold, and never calls
 *     `attemptDevOnlyRuntimeRustIntegration()`/`runtimeCapabilities()`.
 *   - `createRuntimeInitializeCryptoResult()`/`AppRuntime.initializeCrypto()`
 *     and `runtimeCapabilities()`/`RuntimeCapabilities` are NEITHER
 *     modified NOR called from inside this file's own control flow —
 *     both remain completely separate, byte-for-byte unchanged, PUBLIC
 *     Runtime APIs.
 *   - `randomBytes()` NEVER throws: any exception anywhere in the Loader
 *     chain is caught here and converted to `null` — Fail Closed,
 *     nothing ever leaks outside this Runtime Service boundary.
 *   - Calls `attemptDevOnlyRandomBytesCall()` EXACTLY ONCE per
 *     `randomBytes()` invocation — no retry, no second attempt, no
 *     caching of a prior result.
 *   - NO `encrypt`/`decrypt`/`deriveKey`, or any Rust API other than
 *     `random_bytes_32()` (via the Loader's own existing gate), is ever
 *     called.
 *   - NO reference to `src/worker.ts`, and this file is not referenced
 *     BY `src/worker.ts` — Worker remains fully unconnected.
 *   - NO `fedos_crypto_backend_resolver.ts` reference — the Backend
 *     Resolver is unmodified and unreferenced by this file.
 *   - NO new persistent/Secure Storage of any kind — the returned bytes
 *     are a plain, transient `Uint8Array`; nothing is written to disk,
 *     `localStorage`, or any storage backend.
 */

import { createFedosWasmLoader, type FedosWasmLoaderSkeleton } from "./fedos_wasm_loader.js";

/**
 * The Runtime Service-level record of one `randomBytes()` attempt.
 * `succeeded: true` names that the full six-condition Loader chain
 * resolved a genuine `Uint8Array` from `random_bytes_32()`; `bytes` is
 * that value, or `null` on every other outcome (unmet gate, absent
 * export, thrown error, or Rust's own `EntropySourceUnavailable`
 * Fail Closed).
 */
export interface RuntimeRandomBytesState {
  readonly succeeded: boolean;
  readonly bytes: Uint8Array | null;
}

/**
 * PUBLIC, ASYNC — the Runtime Service for `randomBytes()`. Constructs a
 * fresh `FedosWasmLoader` (`createFedosWasmLoader()`) and drives it
 * through `planLoad()` -> `attemptDevOnlyJsGlueImport()` ->
 * `attemptDevOnlyWasmInitialization()` -> `attemptDevOnlyRandomBytesCall()`
 * (Stage 1004), then reads back ONLY `succeeded`/`bytes` from the final
 * result. Outside Development Runtime, every step of the Loader's own
 * chain Fails Closed exactly as `attemptDevOnlyRandomBytesCall()`'s own
 * design already guarantees — this function adds no additional
 * environment check of its own.
 *
 * Accepts an OPTIONAL `loader` parameter, purely for testability
 * (mirroring `attemptDevOnlyRuntimeRustIntegration()`'s own reason for
 * accepting one, Stage 994) — a TEST may pass a `FedosWasmLoaderSkeleton`
 * built with injected `importGeneratedJsGlue`/`readGeneratedWasmBytes`
 * hooks to observe the success/failure paths without depending on a
 * real Generated JS Glue file on disk. Every REAL call site omits it,
 * always getting the real, default, freshly-constructed
 * `createFedosWasmLoader()` instance.
 */
export async function attemptDevOnlyRuntimeRandomBytes(
  loader: FedosWasmLoaderSkeleton = createFedosWasmLoader() as unknown as FedosWasmLoaderSkeleton,
): Promise<RuntimeRandomBytesState> {
  loader.planLoad();
  await loader.attemptDevOnlyJsGlueImport();
  await loader.attemptDevOnlyWasmInitialization();
  const randomBytesResult = await loader.attemptDevOnlyRandomBytesCall();
  return {
    succeeded: randomBytesResult.succeeded,
    bytes: randomBytesResult.bytes,
  };
}

/**
 * PUBLIC, ASYNC — wired into `AppRuntime` as `randomBytes`
 * (`create_runtime.ts`). Calls `attemptDevOnlyRuntimeRandomBytes()`
 * EXACTLY ONCE and returns its `bytes` on success, or `null` on any
 * other outcome. Fail Closed: wrapped in `try`/`catch` so that ANY
 * unexpected error anywhere in the Loader chain — beyond the chain's
 * own already-Fail-Closed `attemptDevOnlyRandomBytesCall()` — resolves
 * `null` rather than rejecting or throwing. Never mutates state, never
 * writes to any storage, never touches `src/worker.ts`,
 * `fedos_crypto_backend_resolver.ts`, or
 * `createRuntimeInitializeCryptoResult()`/`AppRuntime.initializeCrypto()`/
 * `runtimeCapabilities()`.
 */
export async function randomBytes(): Promise<Uint8Array | null> {
  try {
    const state = await attemptDevOnlyRuntimeRandomBytes();
    return state.succeeded ? state.bytes : null;
  } catch {
    return null;
  }
}
