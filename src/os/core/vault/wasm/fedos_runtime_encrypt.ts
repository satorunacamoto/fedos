/**
 * Stage 1009 (Secure Runtime Alpha 014) — "Public Runtime encrypt() API
 * (Opaque Handle Edition)": the THIRD public Crypto API Runtime
 * exposes, and the FIRST that performs a real cryptographic OPERATION
 * (as opposed to randomness/key generation). Implements this arc's own
 * four-layer Public Runtime API -> Runtime Service -> Rust Boundary ->
 * Internal Rust architecture end to end, mirroring
 * `fedos_runtime_aead_key_generation.ts` (Stage 1008):
 *
 *   AppRuntime.encrypt()                                  Public Runtime API
 *     |                                                  (create_runtime.ts / types.ts)
 *     v
 *   attemptDevOnlyRuntimeEncrypt()                         Runtime Service
 *     |                                                  (THIS FILE)
 *     v
 *   FedosWasmLoaderSkeleton.attemptDevOnlyEncryptCall()    Rust Boundary reach
 *     |                                                  (fedos_wasm_loader.ts)
 *     v
 *   encrypt_aead()                                         Rust Boundary
 *     |                                                  (lib.rs, wasm_bindgen)
 *     v
 *   fedos_encrypt()                                        Internal Rust
 *                                                          (lib.rs, Stage 166-176, UNCHANGED)
 *
 * **OPAQUE HANDLE ONLY, per
 * `docs/secure_runtime_alpha_014_encrypt_opaque_handle_api.md`**: this
 * file's `encrypt()` accepts ONLY an opaque `AeadKeyHandle` (Stage
 * 1008) — never a raw `Uint8Array` key. There is no code path anywhere
 * in this file that constructs a key from bytes, and no fallback that
 * accepts one. The returned ciphertext is likewise an opaque
 * `AeadCiphertextHandle` — this file never reads, serializes, or
 * exposes a raw ciphertext byte. `decrypt()`/`importKey()`/
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
 *   - `attemptDevOnlyRuntimeEncrypt()` and `encrypt()` are the ONLY
 *     exports. Calling either constructs its OWN, fresh
 *     `FedosWasmLoader` instance — it never reuses or mutates any
 *     instance `fedos_runtime_random_bytes.ts`/
 *     `fedos_runtime_aead_key_generation.ts`/
 *     `fedos_runtime_prototype_execution.ts`/`create_runtime.ts` might
 *     hold, and never calls `randomBytes()`/`generateAeadKey()`/
 *     `attemptDevOnlyRuntimeRandomBytes()`/
 *     `attemptDevOnlyRuntimeAeadKeyGeneration()`/
 *     `attemptDevOnlyRuntimeRustIntegration()`/`runtimeCapabilities()`.
 *   - `createRuntimeInitializeCryptoResult()`/`AppRuntime.initializeCrypto()`
 *     and `runtimeCapabilities()`/`RuntimeCapabilities` are NEITHER
 *     modified NOR called from inside this file's own control flow —
 *     both remain completely separate, byte-for-byte unchanged, PUBLIC
 *     Runtime APIs.
 *   - `encrypt()` NEVER throws: any exception anywhere in the Loader
 *     chain is caught here and converted to `null` — Fail Closed,
 *     nothing ever leaks outside this Runtime Service boundary.
 *   - Calls `attemptDevOnlyEncryptCall()` EXACTLY ONCE per `encrypt()`
 *     invocation — no retry, no second attempt, no caching of a prior
 *     result.
 *   - NO `decrypt`/`deriveKey`/`importKey`/`exportKey`, or any Rust API
 *     other than `encrypt_aead()` (via the Loader's own existing gate),
 *     is ever called.
 *   - NO reference to `src/worker.ts`, and this file is not referenced
 *     BY `src/worker.ts` — Worker remains fully unconnected.
 *   - NO `fedos_crypto_backend_resolver.ts` reference — the Backend
 *     Resolver is unmodified and unreferenced by this file.
 *   - NO new persistent/Secure Storage of any kind — the returned
 *     `AeadCiphertextHandle` is a plain, transient, opaque value;
 *     nothing is written to disk, `localStorage`, or any storage
 *     backend.
 */

import {
  createFedosWasmLoader,
  type FedosWasmLoaderSkeleton,
  type AeadKeyHandle,
  type AeadCiphertextHandle,
  type AeadAlgorithm,
  type AeadAadDomain,
} from "./fedos_wasm_loader.js";

export type { AeadKeyHandle, AeadCiphertextHandle, AeadAlgorithm, AeadAadDomain };

/**
 * The Runtime Service-level record of one `encrypt()` attempt.
 * `succeeded: true` names that the full six-condition Loader chain
 * resolved a genuine `AeadCiphertextHandle` from `encrypt_aead()`;
 * `ciphertextHandle` is that value, or `null` on every other outcome
 * (unmet gate, an invalid `key` argument, absent export, thrown error,
 * a wrongly-shaped return, or Rust's own encryption failure).
 */
export interface RuntimeEncryptState {
  readonly succeeded: boolean;
  readonly ciphertextHandle: AeadCiphertextHandle | null;
}

/**
 * PUBLIC, ASYNC — the Runtime Service for `encrypt()`. Constructs a
 * fresh `FedosWasmLoader` (`createFedosWasmLoader()`) and drives it
 * through `planLoad()` -> `attemptDevOnlyJsGlueImport()` ->
 * `attemptDevOnlyWasmInitialization()` -> `attemptDevOnlyEncryptCall()`
 * (Stage 1009), then reads back ONLY `succeeded`/`ciphertextHandle`
 * from the final result. Outside Development Runtime, or with an
 * invalid `key`, every step of the Loader's own chain Fails Closed
 * exactly as `attemptDevOnlyEncryptCall()`'s own design already
 * guarantees — this function adds no additional environment or
 * key-shape check of its own.
 *
 * Accepts an OPTIONAL `loader` parameter, purely for testability
 * (mirroring `attemptDevOnlyRuntimeAeadKeyGeneration()`'s own reason for
 * accepting one, Stage 1008) — a TEST may pass a
 * `FedosWasmLoaderSkeleton` built with injected
 * `importGeneratedJsGlue`/`readGeneratedWasmBytes` hooks to observe the
 * success/failure paths without depending on a real Generated JS Glue
 * file on disk. Every REAL call site omits it, always getting the
 * real, default, freshly-constructed `createFedosWasmLoader()`
 * instance.
 */
export async function attemptDevOnlyRuntimeEncrypt(
  key: AeadKeyHandle,
  algorithm: AeadAlgorithm,
  aadDomain: AeadAadDomain,
  plaintext: Uint8Array,
  loader: FedosWasmLoaderSkeleton = createFedosWasmLoader() as unknown as FedosWasmLoaderSkeleton,
): Promise<RuntimeEncryptState> {
  loader.planLoad();
  await loader.attemptDevOnlyJsGlueImport();
  await loader.attemptDevOnlyWasmInitialization();
  const encryptResult = await loader.attemptDevOnlyEncryptCall(key, algorithm, aadDomain, plaintext);
  return {
    succeeded: encryptResult.succeeded,
    ciphertextHandle: encryptResult.ciphertextHandle,
  };
}

/**
 * PUBLIC, ASYNC — wired into `AppRuntime` as `encrypt` (`create_runtime.ts`).
 * Calls `attemptDevOnlyRuntimeEncrypt()` EXACTLY ONCE and returns its
 * `ciphertextHandle` on success, or `null` on any other outcome. Fail
 * Closed: wrapped in `try`/`catch` so that ANY unexpected error anywhere
 * in the Loader chain — beyond the chain's own already-Fail-Closed
 * `attemptDevOnlyEncryptCall()` — resolves `null` rather than rejecting
 * or throwing. Never mutates state, never writes to any storage, never
 * touches `src/worker.ts`, `fedos_crypto_backend_resolver.ts`, or
 * `createRuntimeInitializeCryptoResult()`/`AppRuntime.initializeCrypto()`/
 * `runtimeCapabilities()`/`randomBytes()`/`generateAeadKey()`. `key`
 * MUST be an opaque `AeadKeyHandle` — no raw `Uint8Array` key is ever
 * accepted.
 */
export async function encrypt(
  key: AeadKeyHandle,
  algorithm: AeadAlgorithm,
  aadDomain: AeadAadDomain,
  plaintext: Uint8Array,
): Promise<AeadCiphertextHandle | null> {
  try {
    const state = await attemptDevOnlyRuntimeEncrypt(key, algorithm, aadDomain, plaintext);
    return state.succeeded ? state.ciphertextHandle : null;
  } catch {
    return null;
  }
}
