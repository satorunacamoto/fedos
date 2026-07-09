/**
 * Stage 994 (Prototype EXECUTION Phase 013) — "Runtime Integration
 * (Prototype Completion Candidate)".
 *
 * Phase 012 (Stage 993) reached the first real Rust API call —
 * `FedosWasmLoader.attemptDevOnlyRustVersionCall()` — but nothing
 * anywhere in `src/runtime/` ever called it: the six-condition chain
 * (Generated Artifact Check -> Development Runtime -> Import Ready ->
 * JS Glue Import -> WASM Initialization -> `version()`) was reachable
 * only from tests. THIS file is the connection: a NEW, separate,
 * standalone, PUBLIC, ASYNC function —
 * `attemptDevOnlyRuntimeRustIntegration(): Promise<RuntimePrototypeExecutionState>`
 * — that drives a FRESH `FedosWasmLoader` instance (via
 * `createFedosWasmLoader()`, `fedos_wasm_loader.ts`) through that
 * exact chain and reads back its `version()` result.
 *
 * **`AppRuntime.initializeCrypto()`
 * (`createRuntimeInitializeCryptoResult()`, `create_runtime.ts`, Stage
 * 691/697) is NEITHER modified NOR called from inside this new
 * function's own control flow that could change its answer** — it
 * remains a completely separate, byte-for-byte unchanged, PUBLIC
 * Runtime API ALWAYS resolving `{ allowed: false, initialized: false,
 * reason: "PrototypeDisabled" }`, exactly as every prior Stage left
 * it. This file does not import `create_runtime.ts`, is not imported
 * BY `create_runtime.ts`, and is not wired into the `AppRuntime`
 * object `createRuntime()` assembles — no NEW Runtime Service is
 * added; `AppRuntime`'s own shape (`src/runtime/types.ts`) is
 * unchanged. `create_runtime.ts` and `fedos_wasm_loader.ts` are BOTH
 * byte-for-byte untouched by this stage.
 *
 * HARD GUARDRAILS:
 *   - `attemptDevOnlyRuntimeRustIntegration()` is the ONLY export.
 *     Calling it constructs its OWN, fresh `FedosWasmLoader` instance
 *     (via `createFedosWasmLoader()`) — it never reuses or mutates any
 *     instance `fedos_wasm_backend.ts`/`create_runtime.ts` might hold.
 *   - Every one of the six conditions
 *     `attemptDevOnlyRustVersionCall()` itself already gates on
 *     (Generated Artifact Check, Development Runtime,  Import Ready,
 *     JS Glue Import, JS Glue Module retained, WASM Initialization) is
 *     evaluated EXACTLY ONCE, by driving `planLoad()` ->
 *     `attemptDevOnlyJsGlueImport()` -> `attemptDevOnlyWasmInitialization()`
 *     -> `attemptDevOnlyRustVersionCall()` in that fixed order — this
 *     file adds NO new gate, NO new environment check, and NO new
 *     Fail-Closed reason of its own; it only reads what the Loader's
 *     OWN chain already decided. Outside Development Runtime, the
 *     Loader's own internal gate already Fails Closed at every step,
 *     so `module.version()` is never reached — this file does not
 *     duplicate that check.
 *   - `RuntimePrototypeExecutionState` carries ONLY `reachedRust`
 *     (`versionResult.succeeded`) and `rustVersion`
 *     (`versionResult.version`) — no module, no Rust object, no
 *     `InitOutput`/memory/instance, and no `FedosWasmLoader` instance
 *     itself is ever returned or retained beyond this one call.
 *   - Obtaining a `rustVersion` here NEVER flips `allowed`/`initialized`
 *     on ANY Runtime API — no field of this file's own result is ever
 *     read by, or merged into, `createRuntimeInitializeCryptoResult()`'s
 *     return value, because that function is never called from this
 *     file's control flow at all.
 *   - NO `encrypt`/`decrypt`/`randomBytes`/`deriveKey`, or any Rust API
 *     other than `version()` (via the Loader's own existing gate), is
 *     ever called.
 *   - NO reference to `src/worker.ts`, and this file is not referenced
 *     BY `src/worker.ts` — Worker remains fully unconnected.
 *   - NO `fedos_crypto_backend_resolver.ts` reference — the Backend
 *     Resolver is unmodified and unreferenced by this file.
 *   - NO new persistent/Secure Storage of any kind — the returned
 *     `RuntimePrototypeExecutionState` is a plain, transient object;
 *     nothing is written to disk, `localStorage`, or any storage
 *     backend.
 *   - NO diagnostics field is added to `runtime_crypto_diagnostics.ts`/
 *     `worker_crypto_diagnostics.ts` — neither file is imported or
 *     referenced by this one.
 */

import { createFedosWasmLoader, type FedosWasmLoaderSkeleton } from "./fedos_wasm_loader.js";

/**
 * The Runtime-side record of THIS Prototype's own end-to-end reach
 * into Rust — the minimal structure Prototype EXECUTION Phase 013
 * introduces. `reachedRust: true` names that `version()` genuinely
 * resolved a `string` through the full six-condition chain;
 * `rustVersion` is that decoded `string`, or `null` on every other
 * outcome. Neither field is ever read by, or merged into, ANY
 * existing Runtime API's own return value.
 */
export interface RuntimePrototypeExecutionState {
  readonly reachedRust: boolean;
  readonly rustVersion: string | null;
}

/**
 * PUBLIC, ASYNC, standalone -- the FIRST time any file under
 * `src/runtime/` ever calls `FedosWasmLoader.attemptDevOnlyRustVersionCall()`.
 * Constructs a fresh `FedosWasmLoader` (`createFedosWasmLoader()`) and
 * drives it through the SAME fixed sequence every prior Prototype
 * EXECUTION Phase has already exercised individually --
 * `planLoad()` (sync) -> `attemptDevOnlyJsGlueImport()` ->
 * `attemptDevOnlyWasmInitialization()` -> `attemptDevOnlyRustVersionCall()`
 * -- then reads back ONLY `succeeded`/`version` from the final result.
 * Never calls `createRuntimeInitializeCryptoResult()`/
 * `AppRuntime.initializeCrypto()`, and never touches
 * `src/worker.ts`/`create_runtime.ts`/`fedos_crypto_backend_resolver.ts`.
 * Outside Development Runtime, every step of the Loader's own chain
 * Fails Closed exactly as `attemptDevOnlyRustVersionCall()`'s own
 * design already guarantees -- this function adds no additional
 * environment check of its own; `reachedRust` is `false` and
 * `rustVersion` is `null` whenever any of the Loader's own six
 * conditions is unmet.
 *
 * Accepts an OPTIONAL `loader` parameter, purely for testability
 * (mirroring `FedosWasmLoaderSkeletonOptions`'s own reason for
 * existing, Stage 945) — a TEST may pass a `FedosWasmLoaderSkeleton`
 * built with injected `importGeneratedJsGlue`/`readGeneratedWasmBytes`
 * hooks to observe the success/failure paths without depending on a
 * real Generated JS Glue file on disk. Every REAL call site (there are
 * none yet — this function is not wired into `AppRuntime`'s own
 * assembled shape) omits it, always getting the real, default,
 * freshly-constructed `createFedosWasmLoader()` instance.
 */
export async function attemptDevOnlyRuntimeRustIntegration(
  // `attemptDevOnlyJsGlueImport()`/`attemptDevOnlyWasmInitialization()`/
  // `attemptDevOnlyRustVersionCall()` are NOT part of the `FedosWasmLoader`
  // interface `createFedosWasmLoader()` returns (by design, since Stage
  // 945) -- the SAME cast every prior Phase's own test suite already
  // uses to reach them on the real, factory-constructed instance.
  loader: FedosWasmLoaderSkeleton = createFedosWasmLoader() as unknown as FedosWasmLoaderSkeleton,
): Promise<RuntimePrototypeExecutionState> {
  loader.planLoad();
  await loader.attemptDevOnlyJsGlueImport();
  await loader.attemptDevOnlyWasmInitialization();
  const versionResult = await loader.attemptDevOnlyRustVersionCall();
  return {
    reachedRust: versionResult.succeeded,
    rustVersion: versionResult.version,
  };
}
