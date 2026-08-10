/**
 * Stage 1011 (Secure Runtime Alpha 018) — "Public Ciphertext Wire
 * Export / Import APIs": the FIFTH public Crypto API Runtime exposes.
 * Implements this arc's own four-layer Public Runtime API -> Runtime
 * Service -> Rust Boundary -> Internal Rust architecture end to end,
 * mirroring `fedos_runtime_decrypt.ts` (Stage 1010), executing
 * `docs/secure_runtime_alpha_017_ciphertext_wire_format_decision.md`'s
 * own formally-decided contract:
 *
 *   AppRuntime.exportCiphertext()                              Public Runtime API
 *     |                                                        (create_runtime.ts / types.ts)
 *     v
 *   attemptDevOnlyRuntimeExportCiphertext()                     Runtime Service
 *     |                                                        (THIS FILE)
 *     v
 *   FedosWasmLoaderSkeleton.attemptDevOnlyExportCiphertextCall()  Rust Boundary reach
 *     |                                                        (fedos_wasm_loader.ts)
 *     v
 *   serialize_aead_ciphertext()                                 Rust Boundary
 *     |                                                        (lib.rs, wasm_bindgen)
 *     v
 *   encode_envelope_internal()                                  Internal Rust
 *                                                                (ciphertext_serialization.rs, Stage 186, UNCHANGED)
 *
 * **OPAQUE HANDLE IN, BRANDED WIRE STRING OUT**: this file's
 * `exportCiphertext()` accepts ONLY an opaque `AeadCiphertextHandle`
 * (Stage 1009) — never a raw ciphertext byte — and returns ONLY an
 * `AeadCiphertextWire` (a branded `string`, Stage 1011) on success, or
 * `null` on every other outcome. No new wire format is created: the
 * returned string is the SAME canonical JSON + base64url text
 * (`v`/`alg`/`aad`/`n`/`ct`/`tag`) `docs/ciphertext_serialization_format_decision.md`
 * (Stage 182) fixed and Stage 186 already implements — this file adds
 * no serialization logic of its own.
 *
 * This file is the Runtime Service layer: TypeScript orchestration that
 * decides HOW to reach the Rust Boundary and reshapes its answer into a
 * Runtime-shaped result. It does NOT contain any serialization logic of
 * its own, does NOT read/write any byte beyond what the Loader chain
 * hands back, and does NOT touch `src/worker.ts`, Production, Secure
 * Storage, or `fedos_crypto_backend_resolver.ts`.
 *
 * HARD GUARDRAILS:
 *   - `attemptDevOnlyRuntimeExportCiphertext()` and `exportCiphertext()`
 *     are the ONLY exports. Calling either constructs its OWN, fresh
 *     `FedosWasmLoader` instance — it never reuses or mutates any
 *     instance `fedos_runtime_random_bytes.ts`/
 *     `fedos_runtime_aead_key_generation.ts`/`fedos_runtime_encrypt.ts`/
 *     `fedos_runtime_decrypt.ts`/`fedos_runtime_import_ciphertext.ts`/
 *     `fedos_runtime_prototype_execution.ts`/`create_runtime.ts` might
 *     hold, and never calls `randomBytes()`/`generateAeadKey()`/
 *     `encrypt()`/`decrypt()`/`importCiphertext()`/
 *     `attemptDevOnlyRuntimeRandomBytes()`/
 *     `attemptDevOnlyRuntimeAeadKeyGeneration()`/
 *     `attemptDevOnlyRuntimeEncrypt()`/`attemptDevOnlyRuntimeDecrypt()`/
 *     `attemptDevOnlyRuntimeImportCiphertext()`/
 *     `attemptDevOnlyRuntimeRustIntegration()`/`runtimeCapabilities()`.
 *   - `createRuntimeInitializeCryptoResult()`/`AppRuntime.initializeCrypto()`
 *     and `runtimeCapabilities()`/`RuntimeCapabilities` are NEITHER
 *     modified NOR called from inside this file's own control flow —
 *     both remain completely separate, byte-for-byte unchanged, PUBLIC
 *     Runtime APIs.
 *   - `exportCiphertext()` NEVER throws: any exception anywhere in the
 *     Loader chain is caught here and converted to `null` — Fail
 *     Closed, nothing ever leaks outside this Runtime Service boundary.
 *   - Calls `attemptDevOnlyExportCiphertextCall()` EXACTLY ONCE per
 *     `exportCiphertext()` invocation — no retry, no second attempt, no
 *     caching of a prior result.
 *   - NO Rust API other than `serialize_aead_ciphertext()` (via the
 *     Loader's own existing gate) is ever called.
 *   - NO reference to `src/worker.ts`, and this file is not referenced
 *     BY `src/worker.ts` — Worker remains fully unconnected.
 *   - NO `fedos_crypto_backend_resolver.ts` reference — the Backend
 *     Resolver is unmodified and unreferenced by this file.
 *   - NO new persistent/Secure Storage of any kind, no Network
 *     connection — the returned wire string is a plain, transient
 *     `string`; nothing is written to disk, `localStorage`, or any
 *     storage backend, and nothing is sent anywhere.
 */

import {
  createFedosWasmLoader,
  type FedosWasmLoaderSkeleton,
  type AeadCiphertextHandle,
  type AeadCiphertextWire,
} from "./fedos_wasm_loader.js";

export type { AeadCiphertextHandle, AeadCiphertextWire };

/**
 * The Runtime Service-level record of one `exportCiphertext()` attempt.
 * `succeeded: true` names that the full six-condition Loader chain
 * resolved a genuine, non-empty `AeadCiphertextWire` from
 * `serialize_aead_ciphertext()`; `wire` is that value, or `null` on
 * every other outcome (unmet gate, an invalid `ciphertext` argument,
 * absent export, thrown error, a wrongly-shaped return, or Rust's own
 * serialization failure).
 */
export interface RuntimeExportCiphertextState {
  readonly succeeded: boolean;
  readonly wire: AeadCiphertextWire | null;
}

/**
 * PUBLIC, ASYNC — the Runtime Service for `exportCiphertext()`.
 * Constructs a fresh `FedosWasmLoader` (`createFedosWasmLoader()`) and
 * drives it through `planLoad()` -> `attemptDevOnlyJsGlueImport()` ->
 * `attemptDevOnlyWasmInitialization()` ->
 * `attemptDevOnlyExportCiphertextCall()` (Stage 1011), then reads back
 * ONLY `succeeded`/`wire` from the final result. Outside Development
 * Runtime, or with an invalid argument, every step of the Loader's own
 * chain Fails Closed exactly as `attemptDevOnlyExportCiphertextCall()`'s
 * own design already guarantees — this function adds no additional
 * environment or argument-shape check of its own.
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
export async function attemptDevOnlyRuntimeExportCiphertext(
  ciphertext: AeadCiphertextHandle,
  loader: FedosWasmLoaderSkeleton = createFedosWasmLoader() as unknown as FedosWasmLoaderSkeleton,
): Promise<RuntimeExportCiphertextState> {
  loader.planLoad();
  await loader.attemptDevOnlyJsGlueImport();
  await loader.attemptDevOnlyWasmInitialization();
  const exportResult = await loader.attemptDevOnlyExportCiphertextCall(ciphertext);
  return {
    succeeded: exportResult.succeeded,
    wire: exportResult.wire,
  };
}

/**
 * PUBLIC, ASYNC — wired into `AppRuntime` as `exportCiphertext`
 * (`create_runtime.ts`). Calls `attemptDevOnlyRuntimeExportCiphertext()`
 * EXACTLY ONCE and returns its `wire` on success, or `null` on any other
 * outcome. Fail Closed: wrapped in `try`/`catch` so that ANY unexpected
 * error anywhere in the Loader chain — beyond the chain's own
 * already-Fail-Closed `attemptDevOnlyExportCiphertextCall()` — resolves
 * `null` rather than rejecting or throwing. Never mutates state, never
 * writes to any storage, never sends anything over any network, never
 * touches `src/worker.ts`, `fedos_crypto_backend_resolver.ts`, or
 * `createRuntimeInitializeCryptoResult()`/`AppRuntime.initializeCrypto()`/
 * `runtimeCapabilities()`/`randomBytes()`/`generateAeadKey()`/
 * `encrypt()`/`decrypt()`/`importCiphertext()`. `ciphertext` MUST be an
 * opaque `AeadCiphertextHandle` value — no raw ciphertext byte is ever
 * accepted.
 */
export async function exportCiphertext(
  ciphertext: AeadCiphertextHandle,
): Promise<AeadCiphertextWire | null> {
  try {
    const state = await attemptDevOnlyRuntimeExportCiphertext(ciphertext);
    return state.succeeded ? state.wire : null;
  } catch {
    return null;
  }
}
