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
 * it. AT STAGE 994's OWN SCOPE, this file was not imported by
 * `create_runtime.ts` and was not wired into the `AppRuntime` object
 * `createRuntime()` assembles. Stage 999 (Secure Runtime Alpha 003,
 * below) changes exactly that ONE fact — nothing about
 * `initializeCrypto()`'s own contract.
 *
 * Stage 999 (Secure Runtime Alpha 003) adds the FIRST read-only
 * Runtime Capability Reader — `runtimeCapabilities(): Promise<RuntimeCapabilities>`
 * — and wires it into `AppRuntime` as a NEW, second field
 * (`create_runtime.ts`/`src/runtime/types.ts`), alongside
 * `initializeCrypto` and `crypto`. It internally calls
 * `attemptDevOnlyRuntimeRustIntegration()` — the SAME function this
 * file has exported since Stage 994 — and adds NO new Rust call, NO
 * new gate, and NO new environment check beyond a single, safe
 * `process.env.NODE_ENV` read (mirroring
 * `FedosWasmLoaderSkeleton`'s own `#evaluateDevOnlyGate()`, used ONLY
 * to label which of three states the reader currently observes, never
 * to gate anything). `runtimeCapabilities()`'s own result is a plain,
 * read-only snapshot of "how far Runtime currently reaches" — it is
 * NEVER merged into, and NEVER read by, `initializeCrypto()`'s own
 * `if` logic; the two remain provably independent, exactly like
 * `attemptDevOnlyRuntimeRustIntegration()` and
 * `createRuntimeInitializeCryptoResult()` already are.
 *
 * HARD GUARDRAILS:
 *   - `attemptDevOnlyRuntimeRustIntegration()` and (as of Stage 999)
 *     `runtimeCapabilities()`/`RuntimeCapabilities` are the ONLY
 *     exports. Calling either constructs its OWN, fresh
 *     `FedosWasmLoader` instance (via `createFedosWasmLoader()`) — it
 *     never reuses or mutates any instance
 *     `fedos_wasm_backend.ts`/`create_runtime.ts` might hold.
 *   - `runtimeCapabilities()` calls `attemptDevOnlyRuntimeRustIntegration()`
 *     EXACTLY ONCE and reads NOTHING else Rust-related — no second
 *     `FedosWasmLoader` instance, no direct call to
 *     `attemptDevOnlyRustVersionCall()`/`attemptDevOnlyJsGlueImport()`/
 *     `attemptDevOnlyWasmInitialization()` of its own. `runtimeState`
 *     is derived from ONE safe, try/catch-wrapped `process.env.NODE_ENV`
 *     read — no filesystem access, no `import()`, no WebAssembly
 *     reference of any kind.
 *   - `prototypeCompleted` is a FIXED constant (`true`) — it does not
 *     read any file, docs, or git state; it is a hand-set label
 *     recording that `docs/fedos_prototype_completion.md` (Stage 996)
 *     already declared the Prototype complete.
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

// This project's tsconfig.json carries no `@types/node`; declared
// ambient here the same, minimal way `fedos_wasm_loader.ts` itself
// does (Stage 929) — used ONLY to read `NODE_ENV` for `runtimeState`
// below, never for filesystem or process control of any kind.
declare const process: { env?: { readonly NODE_ENV?: string } };

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
 * real Generated JS Glue file on disk. Every REAL call site — as of
 * Stage 999, exactly one: `runtimeCapabilities()`, below — omits it,
 * always getting the real, default, freshly-constructed
 * `createFedosWasmLoader()` instance.
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

/**
 * Stage 999 (Secure Runtime Alpha 003) — the FIRST read-only Runtime
 * Capability Reader, per
 * `docs/secure_runtime_alpha_002_public_surface_review.md` §7's own
 * recommendation. Reports ONLY "how far Runtime currently reaches" —
 * it triggers no activation, grants no permission, and is never read
 * by `initializeCrypto()`'s own `if` logic.
 *
 * - `prototypeCompleted` — a FIXED constant (`true`), recording that
 *   `docs/fedos_prototype_completion.md` (Stage 996) already declared
 *   the Prototype complete. Never computed from file/git state.
 * - `rustReachable`/`rustVersion` — read DIRECTLY from a single call
 *   to `attemptDevOnlyRuntimeRustIntegration()` (the SAME function
 *   Stage 994 added) — `false`/`null` under every one of its own six
 *   Fail-Closed conditions, exactly as that function already
 *   guarantees. No second `FedosWasmLoader` instance, no direct call
 *   to any of its `attemptDevOnly*` methods, no new Rust reach of any
 *   kind is introduced here.
 * - `runtimeState` — `"Development"`/`"Production"` when
 *   `process.env.NODE_ENV` reads exactly `"development"`/`"production"`,
 *   `"Prototype"` otherwise (unset, `"test"`, or unreadable) — the
 *   SAME three-way, try/catch-wrapped, Fail-Closed-to-a-safe-default
 *   pattern `FedosWasmLoaderSkeleton`'s own `#evaluateDevOnlyGate()`
 *   already uses, just re-labeled for this reader's own purpose. This
 *   is NOT a new gate — nothing branches on it inside
 *   `attemptDevOnlyRuntimeRustIntegration()`'s own control flow; it
 *   only LABELS which of three states this call observed.
 */
export interface RuntimeCapabilities {
  readonly prototypeCompleted: boolean;
  readonly rustReachable: boolean;
  readonly rustVersion: string | null;
  readonly runtimeState: "Prototype" | "Development" | "Production";
}

/**
 * PUBLIC, ASYNC — wired into `AppRuntime` as `runtimeCapabilities`
 * (`create_runtime.ts`, Stage 999). Calls
 * `attemptDevOnlyRuntimeRustIntegration()` EXACTLY ONCE and returns a
 * plain, read-only snapshot. Never mutates state, never writes to any
 * storage, never touches `src/worker.ts`,
 * `fedos_crypto_backend_resolver.ts`, or
 * `createRuntimeInitializeCryptoResult()`/`AppRuntime.initializeCrypto()`.
 */
export async function runtimeCapabilities(): Promise<RuntimeCapabilities> {
  const executionState = await attemptDevOnlyRuntimeRustIntegration();
  return {
    prototypeCompleted: true,
    rustReachable: executionState.reachedRust,
    rustVersion: executionState.rustVersion,
    runtimeState: determineRuntimeState(),
  };
}

/**
 * PRIVATE (module-scoped) — the ONLY environment read this file
 * performs, used solely to LABEL `runtimeCapabilities()`'s own
 * `runtimeState` field. Mirrors `FedosWasmLoaderSkeleton`'s own
 * `#evaluateDevOnlyGate()` Fail-Closed try/catch shape, but is not
 * itself a gate -- nothing in this file branches on its result.
 */
function determineRuntimeState(): "Prototype" | "Development" | "Production" {
  try {
    const nodeEnv = process.env?.NODE_ENV;
    if (nodeEnv === "development") {
      return "Development";
    }
    if (nodeEnv === "production") {
      return "Production";
    }
    return "Prototype";
  } catch {
    return "Prototype";
  }
}
