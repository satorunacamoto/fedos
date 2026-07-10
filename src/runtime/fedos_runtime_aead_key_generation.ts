/**
 * Stage 1005 (Secure Runtime Alpha 010), reshaped Stage 1008 (Secure
 * Runtime Alpha 013) — "Public Runtime AEAD Key Generation API": the
 * SECOND public Crypto API Runtime exposes, implementing this arc's own
 * four-layer Public Runtime API -> Runtime Service -> Rust Boundary ->
 * Internal Rust architecture end to end, mirroring
 * `fedos_runtime_random_bytes.ts` (Stage 1004):
 *
 *   AppRuntime.generateAeadKey()                          Public Runtime API
 *     |                                                  (create_runtime.ts / types.ts)
 *     v
 *   attemptDevOnlyRuntimeAeadKeyGeneration()               Runtime Service
 *     |                                                  (THIS FILE)
 *     v
 *   FedosWasmLoaderSkeleton.attemptDevOnlyAeadKeyGenerationCall()  Rust Boundary reach
 *     |                                                  (fedos_wasm_loader.ts)
 *     v
 *   generate_aead_key_handle()                            Rust Boundary
 *     |                                                  (lib.rs, wasm_bindgen)
 *     v
 *   fedos_generate_aead_key_32()                          Internal Rust
 *                                                          (lib.rs, Stage 171-176, UNCHANGED)
 *
 * **OPAQUE KEY HANDLE, per
 * `docs/secure_runtime_alpha_013_opaque_aead_key_handle_migration.md`**:
 * per this arc's own Alpha 012 Key Boundary Decision's deliberate
 * breaking-change decision, `generateAeadKey()` NO LONGER
 * returns raw key bytes — it resolves an opaque `AeadKeyHandle` (or
 * `null`). This file never reads, copies, or exposes a raw byte of any
 * key: the value `attemptDevOnlyAeadKeyGenerationCall()` hands back is
 * threaded through unchanged, the same reference, all the way to the
 * Public Runtime API. Still NOT Secure Storage — nothing is written to
 * disk, `localStorage`, or any storage backend, and this file retains
 * no copy of any handle beyond the single `await` chain of one
 * `generateAeadKey()` call. `encrypt()`/`decrypt()`/`importKey()`/
 * `exportKey()` remain unimplemented anywhere in this file.
 *
 * This file is the Runtime Service layer: TypeScript orchestration that
 * decides HOW to reach the Rust Boundary and reshapes its answer into a
 * Runtime-shaped result. It does NOT contain any cryptographic logic of
 * its own, does NOT read/write any byte beyond what the Loader chain
 * hands back, and does NOT touch `src/worker.ts`, Production, Secure
 * Storage, or `fedos_crypto_backend_resolver.ts`.
 *
 * HARD GUARDRAILS:
 *   - `attemptDevOnlyRuntimeAeadKeyGeneration()` and `generateAeadKey()`
 *     are the ONLY exports. Calling either constructs its OWN, fresh
 *     `FedosWasmLoader` instance — it never reuses or mutates any
 *     instance `fedos_runtime_random_bytes.ts`/
 *     `fedos_runtime_prototype_execution.ts`/`create_runtime.ts` might
 *     hold, and never calls `randomBytes()`/`attemptDevOnlyRuntimeRandomBytes()`/
 *     `attemptDevOnlyRuntimeRustIntegration()`/`runtimeCapabilities()`.
 *   - `createRuntimeInitializeCryptoResult()`/`AppRuntime.initializeCrypto()`
 *     and `runtimeCapabilities()`/`RuntimeCapabilities` are NEITHER
 *     modified NOR called from inside this file's own control flow —
 *     both remain completely separate, byte-for-byte unchanged, PUBLIC
 *     Runtime APIs.
 *   - `generateAeadKey()` NEVER throws: any exception anywhere in the
 *     Loader chain is caught here and converted to `null` — Fail
 *     Closed, nothing ever leaks outside this Runtime Service boundary.
 *   - Calls `attemptDevOnlyAeadKeyGenerationCall()` EXACTLY ONCE per
 *     `generateAeadKey()` invocation — no retry, no second attempt, no
 *     caching of a prior result.
 *   - NO `encrypt`/`decrypt`/`deriveKey`/`importKey`/`exportKey`, or any
 *     Rust API other than `generate_aead_key_handle()` (via the
 *     Loader's own existing gate), is ever called.
 *   - NO reference to `src/worker.ts`, and this file is not referenced
 *     BY `src/worker.ts` — Worker remains fully unconnected.
 *   - NO `fedos_crypto_backend_resolver.ts` reference — the Backend
 *     Resolver is unmodified and unreferenced by this file.
 *   - NO new persistent/Secure Storage of any kind — the returned
 *     `AeadKeyHandle` is a plain, transient, opaque value; nothing is
 *     written to disk, `localStorage`, or any storage backend.
 */

import {
  createFedosWasmLoader,
  type FedosWasmLoaderSkeleton,
  type AeadKeyHandle,
} from "./fedos_wasm_loader.js";

export type { AeadKeyHandle };

/**
 * The Runtime Service-level record of one `generateAeadKey()` attempt.
 * `succeeded: true` names that the full six-condition Loader chain
 * resolved a genuine `AeadKeyHandle` from `generate_aead_key_handle()`;
 * `keyHandle` is that value, or `null` on every other outcome (unmet
 * gate, absent export, thrown error, a wrongly-shaped return, or Rust's
 * own `EntropySourceUnavailable` Fail Closed).
 */
export interface RuntimeAeadKeyGenerationState {
  readonly succeeded: boolean;
  readonly keyHandle: AeadKeyHandle | null;
}

/**
 * PUBLIC, ASYNC — the Runtime Service for `generateAeadKey()`.
 * Constructs a fresh `FedosWasmLoader` (`createFedosWasmLoader()`) and
 * drives it through `planLoad()` -> `attemptDevOnlyJsGlueImport()` ->
 * `attemptDevOnlyWasmInitialization()` ->
 * `attemptDevOnlyAeadKeyGenerationCall()` (Stage 1008), then reads back
 * ONLY `succeeded`/`keyHandle` from the final result. Outside
 * Development Runtime, every step of the Loader's own chain Fails
 * Closed exactly as `attemptDevOnlyAeadKeyGenerationCall()`'s own
 * design already guarantees — this function adds no additional
 * environment check of its own.
 *
 * Accepts an OPTIONAL `loader` parameter, purely for testability
 * (mirroring `attemptDevOnlyRuntimeRandomBytes()`'s own reason for
 * accepting one, Stage 1004) — a TEST may pass a
 * `FedosWasmLoaderSkeleton` built with injected
 * `importGeneratedJsGlue`/`readGeneratedWasmBytes` hooks to observe the
 * success/failure paths without depending on a real Generated JS Glue
 * file on disk. Every REAL call site omits it, always getting the
 * real, default, freshly-constructed `createFedosWasmLoader()`
 * instance.
 */
export async function attemptDevOnlyRuntimeAeadKeyGeneration(
  loader: FedosWasmLoaderSkeleton = createFedosWasmLoader() as unknown as FedosWasmLoaderSkeleton,
): Promise<RuntimeAeadKeyGenerationState> {
  loader.planLoad();
  await loader.attemptDevOnlyJsGlueImport();
  await loader.attemptDevOnlyWasmInitialization();
  const keyGenerationResult = await loader.attemptDevOnlyAeadKeyGenerationCall();
  return {
    succeeded: keyGenerationResult.succeeded,
    keyHandle: keyGenerationResult.keyHandle,
  };
}

/**
 * PUBLIC, ASYNC — wired into `AppRuntime` as `generateAeadKey`
 * (`create_runtime.ts`). Calls `attemptDevOnlyRuntimeAeadKeyGeneration()`
 * EXACTLY ONCE and returns its `keyHandle` on success, or `null` on any
 * other outcome. Fail Closed: wrapped in `try`/`catch` so that ANY
 * unexpected error anywhere in the Loader chain — beyond the chain's
 * own already-Fail-Closed `attemptDevOnlyAeadKeyGenerationCall()` —
 * resolves `null` rather than rejecting or throwing. Never mutates
 * state, never writes to any storage, never touches `src/worker.ts`,
 * `fedos_crypto_backend_resolver.ts`, or
 * `createRuntimeInitializeCryptoResult()`/`AppRuntime.initializeCrypto()`/
 * `runtimeCapabilities()`/`randomBytes()`.
 */
export async function generateAeadKey(): Promise<AeadKeyHandle | null> {
  try {
    const state = await attemptDevOnlyRuntimeAeadKeyGeneration();
    return state.succeeded ? state.keyHandle : null;
  } catch {
    return null;
  }
}
