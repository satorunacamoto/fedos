/**
 * Stage 1010 (Secure Runtime Alpha 015) — "Public Runtime decrypt() API
 * (Opaque Handle Edition)": the FOURTH public Crypto API Runtime
 * exposes, and the SECOND performing a real cryptographic OPERATION —
 * the counterpart to `encrypt()` (Stage 1009). Implements this arc's
 * own four-layer Public Runtime API -> Runtime Service -> Rust Boundary
 * -> Internal Rust architecture end to end, mirroring
 * `fedos_runtime_encrypt.ts` (Stage 1009):
 *
 *   AppRuntime.decrypt()                                  Public Runtime API
 *     |                                                  (create_runtime.ts / types.ts)
 *     v
 *   attemptDevOnlyRuntimeDecrypt()                         Runtime Service
 *     |                                                  (THIS FILE)
 *     v
 *   FedosWasmLoaderSkeleton.attemptDevOnlyDecryptCall()    Rust Boundary reach
 *     |                                                  (fedos_wasm_loader.ts)
 *     v
 *   decrypt_aead()                                         Rust Boundary
 *     |                                                  (lib.rs, wasm_bindgen)
 *     v
 *   fedos_decrypt()                                        Internal Rust
 *                                                          (lib.rs, Stage 166-176, UNCHANGED)
 *
 * **OPAQUE HANDLES ONLY, per
 * `docs/secure_runtime_alpha_015_decrypt_opaque_handle_api.md`**: this
 * file's `decrypt()` accepts ONLY an opaque `AeadKeyHandle` (Stage 1008)
 * and an opaque `AeadCiphertextHandle` (Stage 1009) — never a raw
 * `Uint8Array` key or ciphertext. There is no code path anywhere in
 * this file that accepts, constructs, or derives either from raw bytes.
 * The RECOVERED PLAINTEXT is the one value this file DOES return as a
 * plain `Uint8Array` — returning the caller's own requested plaintext,
 * in the caller's own requested shape, is the entire point of a decrypt
 * call; there is no opaque wrapper to return it in, and no reason to
 * invent one. `importKey()`/`exportKey()`/Secure Storage/ciphertext
 * serialization remain unimplemented anywhere in this file.
 *
 * This file is the Runtime Service layer: TypeScript orchestration that
 * decides HOW to reach the Rust Boundary and reshapes its answer into a
 * Runtime-shaped result. It does NOT contain any cryptographic logic of
 * its own, does NOT read/write any byte beyond what the Loader chain
 * hands back, and does NOT touch `src/worker.ts`, Production, Secure
 * Storage, or `fedos_crypto_backend_resolver.ts`.
 *
 * HARD GUARDRAILS:
 *   - `attemptDevOnlyRuntimeDecrypt()` and `decrypt()` are the ONLY
 *     exports. Calling either constructs its OWN, fresh
 *     `FedosWasmLoader` instance — it never reuses or mutates any
 *     instance `fedos_runtime_random_bytes.ts`/
 *     `fedos_runtime_aead_key_generation.ts`/`fedos_runtime_encrypt.ts`/
 *     `fedos_runtime_prototype_execution.ts`/`create_runtime.ts` might
 *     hold, and never calls `randomBytes()`/`generateAeadKey()`/
 *     `encrypt()`/`attemptDevOnlyRuntimeRandomBytes()`/
 *     `attemptDevOnlyRuntimeAeadKeyGeneration()`/
 *     `attemptDevOnlyRuntimeEncrypt()`/
 *     `attemptDevOnlyRuntimeRustIntegration()`/`runtimeCapabilities()`.
 *   - `createRuntimeInitializeCryptoResult()`/`AppRuntime.initializeCrypto()`
 *     and `runtimeCapabilities()`/`RuntimeCapabilities` are NEITHER
 *     modified NOR called from inside this file's own control flow —
 *     both remain completely separate, byte-for-byte unchanged, PUBLIC
 *     Runtime APIs.
 *   - `decrypt()` NEVER throws: any exception anywhere in the Loader
 *     chain is caught here and converted to `null` — Fail Closed,
 *     nothing ever leaks outside this Runtime Service boundary.
 *   - Calls `attemptDevOnlyDecryptCall()` EXACTLY ONCE per `decrypt()`
 *     invocation — no retry, no second attempt, no caching of a prior
 *     result.
 *   - NO `importKey`/`exportKey`, or any Rust API other than
 *     `decrypt_aead()` (via the Loader's own existing gate), is ever
 *     called.
 *   - NO reference to `src/worker.ts`, and this file is not referenced
 *     BY `src/worker.ts` — Worker remains fully unconnected.
 *   - NO `fedos_crypto_backend_resolver.ts` reference — the Backend
 *     Resolver is unmodified and unreferenced by this file.
 *   - NO new persistent/Secure Storage of any kind — the returned
 *     plaintext is a plain, transient `Uint8Array`; nothing is written
 *     to disk, `localStorage`, or any storage backend.
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
 * The Runtime Service-level record of one `decrypt()` attempt.
 * `succeeded: true` names that the full six-condition Loader chain
 * resolved a genuine `Uint8Array` from `decrypt_aead()`; `plaintext` is
 * that value, or `null` on every other outcome (unmet gate, an invalid
 * `key`/`ciphertext`/`algorithm`/`aadDomain` argument, absent export,
 * thrown error, a wrongly-shaped return, or Rust's own decryption
 * failure).
 */
export interface RuntimeDecryptState {
  readonly succeeded: boolean;
  readonly plaintext: Uint8Array | null;
}

/**
 * PUBLIC, ASYNC — the Runtime Service for `decrypt()`. Constructs a
 * fresh `FedosWasmLoader` (`createFedosWasmLoader()`) and drives it
 * through `planLoad()` -> `attemptDevOnlyJsGlueImport()` ->
 * `attemptDevOnlyWasmInitialization()` -> `attemptDevOnlyDecryptCall()`
 * (Stage 1010), then reads back ONLY `succeeded`/`plaintext` from the
 * final result. Outside Development Runtime, or with an invalid
 * argument, every step of the Loader's own chain Fails Closed exactly
 * as `attemptDevOnlyDecryptCall()`'s own design already guarantees —
 * this function adds no additional environment or argument-shape check
 * of its own.
 *
 * Accepts an OPTIONAL `loader` parameter, purely for testability
 * (mirroring `attemptDevOnlyRuntimeEncrypt()`'s own reason for accepting
 * one, Stage 1009) — a TEST may pass a `FedosWasmLoaderSkeleton` built
 * with injected `importGeneratedJsGlue`/`readGeneratedWasmBytes` hooks
 * to observe the success/failure paths without depending on a real
 * Generated JS Glue file on disk. Every REAL call site omits it, always
 * getting the real, default, freshly-constructed
 * `createFedosWasmLoader()` instance.
 */
export async function attemptDevOnlyRuntimeDecrypt(
  key: AeadKeyHandle,
  algorithm: AeadAlgorithm,
  aadDomain: AeadAadDomain,
  ciphertext: AeadCiphertextHandle,
  loader: FedosWasmLoaderSkeleton = createFedosWasmLoader() as unknown as FedosWasmLoaderSkeleton,
): Promise<RuntimeDecryptState> {
  loader.planLoad();
  await loader.attemptDevOnlyJsGlueImport();
  await loader.attemptDevOnlyWasmInitialization();
  const decryptResult = await loader.attemptDevOnlyDecryptCall(key, algorithm, aadDomain, ciphertext);
  return {
    succeeded: decryptResult.succeeded,
    plaintext: decryptResult.plaintext,
  };
}

/**
 * PUBLIC, ASYNC — wired into `AppRuntime` as `decrypt` (`create_runtime.ts`).
 * Calls `attemptDevOnlyRuntimeDecrypt()` EXACTLY ONCE and returns its
 * `plaintext` on success, or `null` on any other outcome. Fail Closed:
 * wrapped in `try`/`catch` so that ANY unexpected error anywhere in the
 * Loader chain — beyond the chain's own already-Fail-Closed
 * `attemptDevOnlyDecryptCall()` — resolves `null` rather than rejecting
 * or throwing. Never mutates state, never writes to any storage, never
 * touches `src/worker.ts`, `fedos_crypto_backend_resolver.ts`, or
 * `createRuntimeInitializeCryptoResult()`/`AppRuntime.initializeCrypto()`/
 * `runtimeCapabilities()`/`randomBytes()`/`generateAeadKey()`/
 * `encrypt()`. `key`/`ciphertext` MUST be opaque
 * `AeadKeyHandle`/`AeadCiphertextHandle` values — no raw
 * `Uint8Array` is ever accepted for either.
 */
export async function decrypt(
  key: AeadKeyHandle,
  algorithm: AeadAlgorithm,
  aadDomain: AeadAadDomain,
  ciphertext: AeadCiphertextHandle,
): Promise<Uint8Array | null> {
  try {
    const state = await attemptDevOnlyRuntimeDecrypt(key, algorithm, aadDomain, ciphertext);
    return state.succeeded ? state.plaintext : null;
  } catch {
    return null;
  }
}
