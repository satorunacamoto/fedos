/**
 * Stage 510 — FedOS WASM Loader Import Policy (pure decision, fixed
 * value only).
 *
 * `docs/runtime_wasm_loader_import_policy.md` (Stage 509) fixes SIX
 * minimum conditions phase #2 ("Import Permission",
 * `docs/runtime_wasm_loader_planning.md`) requires before the
 * generated JS glue may ever be `import`ed: Loader Plan import
 * allowed, generated artifact present, artifact untracked/gitignored,
 * Runtime dev-only approval, no Worker approval, and Execution Review
 * approval. THIS file is the real, auditable decision function that
 * answers whether ALL of them currently hold —
 * `evaluateWasmLoaderImportPolicy()`, mirroring
 * `runtime_crypto_activation_policy.ts`'s own
 * `ActivationPolicy`/`ActivationDecision`/`ActivationReason`/
 * `evaluateRuntimeCryptoActivation` shape exactly, one level down
 * this WASM arc.
 *
 * Stage 511 wires `src/runtime/fedos_wasm_loader_plan.ts`'s
 * `planImport()` to CALL this function — the result is DISCARDED, and
 * `planImport()`'s own return value stays UNCHANGED
 * (`"BlockedByPolicy"`). That is the ONLY caller of this file
 * anywhere in this repository; neither `create_runtime.ts` nor
 * `src/worker.ts` references it, directly or indirectly.
 *
 * Stage 519 extends `evaluateWasmLoaderImportPolicy()` DOWNWARD only:
 * it now builds a `FedosWasmStaticImportPlan`
 * (`fedos_wasm_static_import_plan.ts`, Stage 518) and calls its
 * `planStaticImport()` — then DISCARDS the result and returns its
 * OWN, unchanged `{ allowed: false, reason: "BlockedByPolicy" }`
 * answer. This mirrors the SAME "reach one link deeper, keep your own
 * answer" pattern Stage 503/511 already established twice over in
 * this WASM arc.
 *
 * HARD GUARDRAILS:
 *   - `evaluateWasmLoaderImportPolicy()` is PURE, synchronous, takes
 *     no argument, and returns a hand-fixed constant. It NEVER
 *     inspects `packages/fedos-core-rust/pkg/`, `import.meta`, the
 *     filesystem, or any environment variable — see
 *     `docs/runtime_wasm_loader_import_policy.md` §2 for why
 *     "generated artifact present" is never a live check.
 *   - NO `import`/`import()`/`require()` of `fedos_core_rust.js`/
 *     `fedos_core_rust_bg.wasm`, or any other generated artifact.
 *   - NO `WebAssembly.instantiate`/`WebAssembly.compile`/`fetch`/
 *     `initSync`/default-init reference of any kind.
 *   - NO `child_process`/filesystem/`process.env` reference.
 *   - NO reference to `create_runtime.ts`/`AppRuntime`/`src/worker.ts`.
 *   - `evaluateWasmLoaderImportPolicy()` ALWAYS resolves
 *     `{ allowed: false, reason: "BlockedByPolicy" }` in this stage —
 *     `"Allowed"` exists in `FedosWasmLoaderImportReason` only as a
 *     RESERVED label for a future, separate, explicitly-reviewed
 *     stage; nothing in this file can ever produce it.
 *   - `wasmLoaderImportPolicyState()` is fixed `"Blocked"` —
 *     `"Allowed"` is RESERVED there too.
 *   - No `SecretHandle`, `ConversationKey`, `MessageKey`, or
 *     `Nip44WirePayload` type or value is imported, referenced, or
 *     constructed anywhere in this file.
 */

import { createFedosWasmStaticImportPlan } from "./fedos_wasm_static_import_plan.js";

/**
 * Coarse status of the Import Policy itself. `"Blocked"` is the ONLY
 * value this stage's implementation ever produces; `"Allowed"` is
 * RESERVED, unreachable from this file.
 */
export type FedosWasmLoaderImportPolicyState = "Blocked" | "Allowed";

/**
 * Every reason `evaluateWasmLoaderImportPolicy` can name.
 * `"BlockedByPolicy"` is the ONLY value this stage's implementation
 * ever produces (at least one of the six conditions in
 * `docs/runtime_wasm_loader_import_policy.md` is always unmet).
 * `"Allowed"` is RESERVED for a future, separate,
 * explicitly-reviewed stage where all six conditions hold
 * simultaneously; nothing in this file can ever produce it.
 */
export type FedosWasmLoaderImportReason = "BlockedByPolicy" | "Allowed";

/** The result of an import-policy evaluation. `allowed` is always `false` in this stage. */
export interface FedosWasmLoaderImportDecision {
  readonly allowed: boolean;
  readonly reason: FedosWasmLoaderImportReason;
}

/**
 * The shape of a WASM Loader Import Policy: a pure, zero-argument
 * function to a `FedosWasmLoaderImportDecision`.
 * `evaluateWasmLoaderImportPolicy` is the one implementation this
 * stage provides.
 */
export type FedosWasmLoaderImportPolicy = () => FedosWasmLoaderImportDecision;

/**
 * Evaluate whether the generated JS glue may ever be `import`ed right
 * now, and why (not). Always resolves
 * `{ allowed: false, reason: "BlockedByPolicy" }` in this stage — see
 * `docs/runtime_wasm_loader_import_policy.md` for the six conditions
 * this collapses. Pure; never throws; takes no argument, reads no
 * `process.env`/filesystem/`import.meta`.
 */
export const evaluateWasmLoaderImportPolicy: FedosWasmLoaderImportPolicy =
  (): FedosWasmLoaderImportDecision => {
    reachStaticImportPlan(); // result discarded -- the generated JS glue is never imported
    return { allowed: false, reason: "BlockedByPolicy" };
  };

/**
 * PRIVATE (module-scoped) — builds a `FedosWasmStaticImportPlan` and
 * calls its `planStaticImport()`. The result is discarded; it is
 * never passed to `WebAssembly.instantiate`/`compile`, `initSync`/the
 * default init export, `packages/fedos-core-rust`, Runtime, or
 * Worker. The Static Import Plan itself never imports anything
 * either.
 */
function reachStaticImportPlan(): void {
  const plan = createFedosWasmStaticImportPlan();
  plan.planStaticImport();
}

/**
 * Pure, standalone: the Import Policy's own fixed coarse state —
 * usable by diagnostics WITHOUT calling `evaluateWasmLoaderImportPolicy()`.
 * Fixed `"Blocked"`.
 */
export function wasmLoaderImportPolicyState(): FedosWasmLoaderImportPolicyState {
  return "Blocked";
}
