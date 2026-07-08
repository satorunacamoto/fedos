/**
 * Stage 666 — FedOS Runtime initializeCrypto Public API (pure data,
 * fixed value only).
 *
 * `docs/runtime_initialize_crypto_public_api.md` (Stage 665) fixes
 * the SHAPE of what Runtime would actually expose to its own
 * callers — whether `initializeCrypto()` is currently VISIBLE as a
 * public member on `AppRuntime`, and whether that public-facing
 * member is CALLABLE — kept separate from
 * `FedosInitializeCryptoWiringPlan.runtimeWiringAllowed` (Stage 658),
 * which only answers whether a Runtime connection is currently
 * permitted, a structurally earlier question. THIS file is the real,
 * fixed-value implementation of that design's collapsed answer:
 * `createInitializeCryptoPublicApi()` always resolves `{ state:
 * "PlanningOnly", apiVisible: false, callable: false, reason:
 * "PublicApiPending" }` — it never references the generated JS glue
 * and has NO side effects.
 *
 * NOTE ON NAMING: this file's own `callable` field is DISTINCT from
 * `FedosInitializeCryptoApiContract.callable` (Stage 634) — that one
 * answers whether the INTERNAL Facade-level `initializeCrypto()` is
 * callable; this one answers whether the PUBLIC-FACING `AppRuntime`
 * member is callable. Both are permanently `false` in this stage.
 * Because `runtime_crypto_diagnostics.ts`/`worker_crypto_diagnostics.ts`
 * already expose Stage 634's answer under the flat name
 * `initializeCryptoCallable` (Stage 636), this file's standalone
 * accessor is named `initializeCryptoPublicApiCallable()` — see
 * `docs/runtime_initialize_crypto_public_api.md` §1 — to avoid
 * colliding with that existing diagnostics field.
 *
 * Stage 667 wires
 * `src/runtime/fedos_initialize_crypto_wiring_plan.ts`'s
 * `createInitializeCryptoWiringPlan()` to CALL
 * `createInitializeCryptoPublicApi()` — the result is DISCARDED, and
 * `createInitializeCryptoWiringPlan()`'s own return value stays
 * UNCHANGED (`runtimeWiringAllowed: false`, `workerWiringAllowed:
 * false`). That is one caller of this file; neither
 * `create_runtime.ts` nor `src/worker.ts` references it, directly or
 * indirectly, and NEITHER FILE IS MODIFIED BY THIS STAGE.
 *
 * Stage 675 extends `createInitializeCryptoPublicApi()` DOWNWARD
 * only: it now calls `createInitializeCryptoInvocationContract()`
 * (`fedos_initialize_crypto_invocation_contract.ts`, Stage 674) —
 * then DISCARDS the result and returns its OWN, unchanged `{ state:
 * "PlanningOnly", apiVisible: false, callable: false, reason:
 * "PublicApiPending" }` answer. This mirrors the SAME "reach one link
 * deeper, keep your own answer" pattern
 * Stage 503/511/519/527/535/539/547/555/563/571/579/587/595/603/611/619/627/635/643/651/659
 * already established nineteen times over in this WASM arc.
 *
 * HARD GUARDRAILS:
 *   - `createInitializeCryptoPublicApi()` is PURE, synchronous, takes
 *     no argument, and returns a hand-fixed constant. It NEVER
 *     inspects `packages/fedos-core-rust/pkg/`, `import.meta`, the
 *     filesystem, build mode, or any environment variable. NO SIDE
 *     EFFECTS of any kind.
 *   - NO `fs`/`node:fs`/`path`/`node:path`/`existsSync`/`statSync`/
 *     glob API of any kind.
 *   - NO `import`/`import()`/`require()` of `fedos_core_rust.js`/
 *     `fedos_core_rust_bg.wasm`, or any other generated artifact —
 *     the generated JS glue is never referenced by this file at all,
 *     and NO `import()` of any kind (static or dynamic) is written
 *     here.
 *   - NO `WebAssembly.instantiate`/`WebAssembly.compile`/
 *     `WebAssembly.instantiateStreaming`/`fetch`/`initSync`/
 *     default-init reference of any kind.
 *   - NO `child_process`/`process.env` reference — no build-mode/
 *     dev-only flag is defined or consulted anywhere in this file.
 *   - NO reference to `create_runtime.ts`/`AppRuntime`/`src/worker.ts`
 *     — no Runtime or Worker connection of any kind exists yet, and
 *     neither file is modified by this stage.
 *   - NO reference to `FedosRuntimeCryptoProvider`/
 *     `RuntimeCryptoProvider`/`fedos_crypto_loader_facade.ts`/
 *     `fedos_wasm_loader.ts` — this file only records whether a
 *     public member would currently be visible/callable; it does not
 *     add one to `AppRuntime`.
 *   - `createInitializeCryptoPublicApi()` ALWAYS resolves
 *     `apiVisible: false`/`callable: false` in this stage — `true`
 *     exists only as a RESERVED possibility for a future, separate,
 *     explicitly-reviewed stage; nothing in this file can ever
 *     produce it.
 *   - `state` is fixed `"PlanningOnly"` — this file only ever records
 *     the Public API's fixed, not-yet-visible design; it never
 *     exposes `initializeCrypto()` on `AppRuntime` or anywhere else.
 *   - No `SecretHandle`, `ConversationKey`, `MessageKey`, or
 *     `Nip44WirePayload` type or value is imported, referenced, or
 *     constructed anywhere in this file.
 */

import { createInitializeCryptoInvocationContract } from "./fedos_initialize_crypto_invocation_contract.js";

/**
 * The Runtime initializeCrypto Public API's own coarse state.
 * `"PlanningOnly"` is the ONLY value this stage's implementation ever
 * produces; `"Visible"` is RESERVED, unreachable from this file.
 */
export type FedosInitializeCryptoPublicApiState = "PlanningOnly" | "Visible";

/**
 * Every reason `createInitializeCryptoPublicApi()` can name.
 * `"PublicApiPending"` is the ONLY value this stage's implementation
 * ever produces. `"Allowed"` is RESERVED for a future, separate,
 * explicitly-reviewed stage; nothing in this file can ever produce
 * it.
 */
export type FedosInitializeCryptoPublicApiReason = "PublicApiPending" | "Allowed";

/** The result of a `createInitializeCryptoPublicApi()` call. No module bytes or secret material of any kind. */
export interface FedosInitializeCryptoPublicApi {
  readonly state: FedosInitializeCryptoPublicApiState;
  readonly apiVisible: boolean;
  readonly callable: boolean;
  readonly reason: FedosInitializeCryptoPublicApiReason;
}

/**
 * Evaluate the Runtime initializeCrypto Public API
 * (`docs/runtime_initialize_crypto_public_api.md`) — whether
 * `initializeCrypto()` is currently visible as a public member on
 * `AppRuntime`, whether that member is currently callable, and why
 * (not). Always resolves `{ state: "PlanningOnly", apiVisible: false,
 * callable: false, reason: "PublicApiPending" }` in this stage. Pure;
 * never throws; takes no argument, reads no `process.env`/
 * filesystem/`import.meta`. Never references the generated JS glue,
 * and never writes `import()` of any kind.
 */
export function createInitializeCryptoPublicApi(): FedosInitializeCryptoPublicApi {
  reachInitializeCryptoInvocationContract(); // result discarded -- the generated JS glue is never imported
  return {
    state: "PlanningOnly",
    apiVisible: false,
    callable: false,
    reason: "PublicApiPending",
  };
}

/**
 * PRIVATE (module-scoped) — calls `createInitializeCryptoInvocationContract()`.
 * The result is discarded; it is never passed to
 * `WebAssembly.instantiate`/`compile`, `initSync`/the default init
 * export, `packages/fedos-core-rust`, Runtime, or Worker. The
 * Runtime initializeCrypto Invocation Contract itself never
 * references the generated JS glue or writes `import()` of any kind
 * either.
 */
function reachInitializeCryptoInvocationContract(): void {
  createInitializeCryptoInvocationContract();
}

/**
 * Pure, standalone: the Public API's own fixed coarse state — usable
 * by diagnostics WITHOUT calling `createInitializeCryptoPublicApi()`.
 * Fixed `"PlanningOnly"`.
 */
export function initializeCryptoPublicApiState(): FedosInitializeCryptoPublicApiState {
  return "PlanningOnly";
}

/**
 * Pure, standalone: whether `initializeCrypto()` is currently visible
 * as a public member on `AppRuntime` — the same answer as
 * `createInitializeCryptoPublicApi().apiVisible`. Fixed `false` — no
 * parameter or override anywhere can flip it.
 */
export function initializeCryptoApiVisible(): boolean {
  return false;
}

/**
 * Pure, standalone: whether the public-facing member is currently
 * callable — the same answer as
 * `createInitializeCryptoPublicApi().callable`. Fixed `false` — no
 * parameter or override anywhere can flip it. Named distinctly from
 * `fedos_initialize_crypto_api_contract.ts`'s own
 * `initializeCryptoCallable()` (Stage 634) — see this file's own
 * top-of-file NOTE ON NAMING.
 */
export function initializeCryptoPublicApiCallable(): boolean {
  return false;
}

/**
 * Pure, standalone: WHY `initializeCrypto()` is not currently visible
 * — the same answer as
 * `createInitializeCryptoPublicApi().reason`. Fixed
 * `"PublicApiPending"`.
 */
export function initializeCryptoPublicApiReason(): FedosInitializeCryptoPublicApiReason {
  return "PublicApiPending";
}
