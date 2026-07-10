/**
 * Stage 1011 (Secure Runtime Alpha 018) — "Public Ciphertext Wire
 * Export / Import APIs": the SIXTH public Crypto API Runtime exposes,
 * and `exportCiphertext()`'s (`fedos_runtime_export_ciphertext.ts`)
 * required pair — per
 * `docs/secure_runtime_alpha_017_ciphertext_wire_format_decision.md` §7,
 * export and import are designed AND implemented together, in this same
 * Stage; neither ships as a usable Public API without the other.
 * Implements this arc's own four-layer Public Runtime API -> Runtime
 * Service -> Rust Boundary -> Internal Rust architecture end to end,
 * mirroring `fedos_runtime_decrypt.ts` (Stage 1010):
 *
 *   AppRuntime.importCiphertext()                              Public Runtime API
 *     |                                                        (create_runtime.ts / types.ts)
 *     v
 *   attemptDevOnlyRuntimeImportCiphertext()                     Runtime Service
 *     |                                                        (THIS FILE)
 *     v
 *   FedosWasmLoaderSkeleton.attemptDevOnlyImportCiphertextCall()  Rust Boundary reach
 *     |                                                        (fedos_wasm_loader.ts)
 *     v
 *   deserialize_aead_ciphertext()                               Rust Boundary
 *     |                                                        (lib.rs, wasm_bindgen)
 *     v
 *   decode_envelope_internal()                                  Internal Rust
 *                                                                (ciphertext_serialization.rs, Stage 186, UNCHANGED)
 *
 * **INPUT IS COMPLETELY UNTRUSTED**: `serialized` may be a value read
 * back from a future Secure Storage layer, received over a future
 * network transport, or an arbitrary string an adversarial caller
 * constructs by hand. This file adds NO content validation of its own —
 * `decode_envelope_internal` (Stage 186) is the ONE, already-reviewed,
 * already-`cargo test`-verified place version/algorithm/AAD-domain/
 * base64url/field-completeness validation happens. This file's own job
 * is orchestration only: reach that decoder, and reshape its answer.
 *
 * **IMPORT SUCCESS DOES NOT IMPLY DECRYPT SUCCESS**: `importCiphertext()`
 * validates WIRE STRUCTURE only — it holds no key and performs no AEAD
 * operation. A wire string can decode successfully here and still fail
 * `decrypt()`'s own authentication check later (wrong key, wrong AAD,
 * tampering) — that is BY DESIGN, not a gap
 * (`docs/secure_runtime_alpha_017_ciphertext_wire_format_decision.md` §9).
 * This file never attempts to guess or verify cryptographic validity.
 *
 * HARD GUARDRAILS:
 *   - `attemptDevOnlyRuntimeImportCiphertext()` and `importCiphertext()`
 *     are the ONLY exports. Calling either constructs its OWN, fresh
 *     `FedosWasmLoader` instance — it never reuses or mutates any
 *     instance `fedos_runtime_random_bytes.ts`/
 *     `fedos_runtime_aead_key_generation.ts`/`fedos_runtime_encrypt.ts`/
 *     `fedos_runtime_decrypt.ts`/`fedos_runtime_export_ciphertext.ts`/
 *     `fedos_runtime_prototype_execution.ts`/`create_runtime.ts` might
 *     hold, and never calls `randomBytes()`/`generateAeadKey()`/
 *     `encrypt()`/`decrypt()`/`exportCiphertext()`/
 *     `attemptDevOnlyRuntimeRandomBytes()`/
 *     `attemptDevOnlyRuntimeAeadKeyGeneration()`/
 *     `attemptDevOnlyRuntimeEncrypt()`/`attemptDevOnlyRuntimeDecrypt()`/
 *     `attemptDevOnlyRuntimeExportCiphertext()`/
 *     `attemptDevOnlyRuntimeRustIntegration()`/`runtimeCapabilities()`.
 *   - `createRuntimeInitializeCryptoResult()`/`AppRuntime.initializeCrypto()`
 *     and `runtimeCapabilities()`/`RuntimeCapabilities` are NEITHER
 *     modified NOR called from inside this file's own control flow —
 *     both remain completely separate, byte-for-byte unchanged, PUBLIC
 *     Runtime APIs.
 *   - `importCiphertext()` NEVER throws: any exception anywhere in the
 *     Loader chain is caught here and converted to `null` — Fail
 *     Closed, nothing ever leaks outside this Runtime Service boundary.
 *   - Calls `attemptDevOnlyImportCiphertextCall()` EXACTLY ONCE per
 *     `importCiphertext()` invocation — no retry, no second attempt, no
 *     caching of a prior result.
 *   - NO Rust API other than `deserialize_aead_ciphertext()` (via the
 *     Loader's own existing gate) is ever called.
 *   - NO reference to `src/worker.ts`, and this file is not referenced
 *     BY `src/worker.ts` — Worker remains fully unconnected.
 *   - NO `fedos_crypto_backend_resolver.ts` reference — the Backend
 *     Resolver is unmodified and unreferenced by this file.
 *   - NO new persistent/Secure Storage of any kind, no Network
 *     connection — the returned handle is a plain, transient,
 *     WASM-instance-scoped `AeadCiphertextHandle`; nothing is read from
 *     or written to disk, `localStorage`, or any storage backend, and
 *     nothing is received from any network.
 */

import {
  createFedosWasmLoader,
  type FedosWasmLoaderSkeleton,
  type AeadCiphertextHandle,
  type AeadCiphertextWire,
} from "./fedos_wasm_loader.js";

export type { AeadCiphertextHandle, AeadCiphertextWire };

/**
 * The Runtime Service-level record of one `importCiphertext()` attempt.
 * `succeeded: true` names that the full six-condition Loader chain
 * resolved a genuine `AeadCiphertextHandle` from
 * `deserialize_aead_ciphertext()`; `ciphertextHandle` is that value, or
 * `null` on every other outcome (unmet gate, a non-`string` `serialized`
 * argument, absent import, thrown error, a wrongly-shaped return, or
 * Rust's own wire-structure rejection).
 */
export interface RuntimeImportCiphertextState {
  readonly succeeded: boolean;
  readonly ciphertextHandle: AeadCiphertextHandle | null;
}

/**
 * PUBLIC, ASYNC — the Runtime Service for `importCiphertext()`.
 * Constructs a fresh `FedosWasmLoader` (`createFedosWasmLoader()`) and
 * drives it through `planLoad()` -> `attemptDevOnlyJsGlueImport()` ->
 * `attemptDevOnlyWasmInitialization()` ->
 * `attemptDevOnlyImportCiphertextCall()` (Stage 1011), then reads back
 * ONLY `succeeded`/`ciphertextHandle` from the final result. Outside
 * Development Runtime, or with an invalid argument, every step of the
 * Loader's own chain Fails Closed exactly as
 * `attemptDevOnlyImportCiphertextCall()`'s own design already
 * guarantees — this function adds no additional environment or
 * argument-shape check, and no content-level validation, of its own.
 *
 * Accepts an OPTIONAL `loader` parameter, purely for testability
 * (mirroring `attemptDevOnlyRuntimeDecrypt()`'s own reason for accepting
 * one, Stage 1010) — a TEST may pass a `FedosWasmLoaderSkeleton` built
 * with injected `importGeneratedJsGlue`/`readGeneratedWasmBytes` hooks
 * to observe the success/failure paths without depending on a real
 * Generated JS Glue file on disk. Every REAL call site omits it, always
 * getting the real, default, freshly-constructed
 * `createFedosWasmLoader()` instance.
 */
export async function attemptDevOnlyRuntimeImportCiphertext(
  serialized: AeadCiphertextWire,
  loader: FedosWasmLoaderSkeleton = createFedosWasmLoader() as unknown as FedosWasmLoaderSkeleton,
): Promise<RuntimeImportCiphertextState> {
  loader.planLoad();
  await loader.attemptDevOnlyJsGlueImport();
  await loader.attemptDevOnlyWasmInitialization();
  const importResult = await loader.attemptDevOnlyImportCiphertextCall(serialized);
  return {
    succeeded: importResult.succeeded,
    ciphertextHandle: importResult.ciphertextHandle,
  };
}

/**
 * PUBLIC, ASYNC — wired into `AppRuntime` as `importCiphertext`
 * (`create_runtime.ts`). Calls `attemptDevOnlyRuntimeImportCiphertext()`
 * EXACTLY ONCE and returns its `ciphertextHandle` on success, or `null`
 * on any other outcome. Fail Closed: wrapped in `try`/`catch` so that
 * ANY unexpected error anywhere in the Loader chain — beyond the
 * chain's own already-Fail-Closed `attemptDevOnlyImportCiphertextCall()`
 * — resolves `null` rather than rejecting or throwing. Never mutates
 * state, never reads from any storage, never receives anything from any
 * network, never touches `src/worker.ts`,
 * `fedos_crypto_backend_resolver.ts`, or
 * `createRuntimeInitializeCryptoResult()`/`AppRuntime.initializeCrypto()`/
 * `runtimeCapabilities()`/`randomBytes()`/`generateAeadKey()`/
 * `encrypt()`/`decrypt()`/`exportCiphertext()`. `serialized` is treated
 * as COMPLETELY UNTRUSTED — its content is validated entirely by
 * `decode_envelope_internal` inside Rust, never guessed at or
 * pre-validated here.
 */
export async function importCiphertext(
  serialized: AeadCiphertextWire,
): Promise<AeadCiphertextHandle | null> {
  try {
    const state = await attemptDevOnlyRuntimeImportCiphertext(serialized);
    return state.succeeded ? state.ciphertextHandle : null;
  } catch {
    return null;
  }
}
