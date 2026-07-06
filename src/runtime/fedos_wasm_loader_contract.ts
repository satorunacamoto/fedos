/**
 * Stage 482 — FedOS WASM Loader Contract (standalone, unwired,
 * fixed-value only).
 *
 * `docs/runtime_wasm_js_glue_contract.md` (Stage 481) recorded, by
 * direct observation, what the real, locally-generated `wasm-bindgen`
 * JS glue (`packages/fedos-core-rust/pkg/fedos_core_rust.js`)
 * actually exports: a named `initSync` and a default async init
 * function, both returning an `InitOutput` with a `memory` export.
 * This file does NOT load, import, or execute any of that — it names
 * a small, fixed-value CONTRACT SHAPE a future, separate,
 * explicitly-reviewed loader stage could implement against, exactly
 * the same "plan/observation label, never a real action" discipline
 * every other file in this WASM arc already uses
 * (`fedos_wasm_artifact.ts`, `fedos_wasm_toolchain.ts`,
 * `fedos_wasm_boundary.ts`).
 *
 * "Unwired" means: NO other module in this repository imports this
 * file. `create_runtime.ts`/`src/worker.ts` do not reference it,
 * `fedos_wasm_boundary.ts`/`fedos_wasm_artifact.ts` do not reference
 * it. Only `runtime_crypto_diagnostics.ts`/`worker_crypto_diagnostics.ts`
 * (Stage 483) read its pure, standalone functions for DISPLAY, and
 * this codebase's own test suite exercises it directly — the same
 * "export for testability, wire nowhere" precedent every prior link
 * in this chain follows.
 *
 * HARD GUARDRAILS:
 *   - Every function in this file is PURE, synchronous, and returns a
 *     hand-fixed constant. None ever inspects `packages/fedos-core-rust/pkg/`,
 *     `import.meta`, the filesystem, or any environment variable.
 *   - NO `import`/`import()`/`require()` of
 *     `fedos_core_rust.js`/`fedos_core_rust_bg.wasm`, or any other
 *     generated artifact.
 *   - NO `WebAssembly.instantiate`/`WebAssembly.compile`/`fetch`
 *     reference of any kind.
 *   - NO `child_process`/filesystem/`process.env` reference.
 *   - `loaderImportMode()` is fixed `"StaticPlanning"` — naming that a
 *     real import-mode DECISION (`"StaticImport"` vs. `"DynamicImport"`,
 *     both RESERVED, unreachable from this file) has not been made,
 *     never implying one.
 *   - `loaderInitialized()` is fixed `false` — no loader has ever run,
 *     and this file cannot make one run.
 *   - No `SecretHandle`, `ConversationKey`, `MessageKey`, or
 *     `Nip44WirePayload` type or value is imported, referenced, or
 *     constructed anywhere in this file.
 */

/**
 * The loader's own coarse state. `"NotLoaded"` is the ONLY value this
 * stage's implementation ever produces; `"Loaded"` is RESERVED for a
 * future, separate, explicitly-reviewed stage that actually calls the
 * generated JS glue's `initSync`/default export — nothing in this
 * file can ever produce it.
 */
export type FedosWasmLoaderState = "NotLoaded" | "Loaded";

/**
 * The fixed version of THIS contract document/model (Stage 481's
 * observation, Stage 482's fixed labels) — not `wasm-bindgen`'s own
 * version, and not the crate's. `"1"` is the only value; a future
 * stage that changes what this contract records would bump it.
 */
export type FedosLoaderContractVersion = "1";

/**
 * The planned shape a future loader would pick between —
 * `"StaticImport"` (a top-level `import` of the generated JS glue)
 * vs. `"DynamicImport"` (a runtime `import()`) — both RESERVED,
 * unreachable from this file. `"StaticPlanning"` is the ONLY value
 * this stage's implementation ever produces: no import-mode decision
 * has been made yet, only that a decision exists to be made later.
 */
export type FedosLoaderImportMode = "StaticPlanning" | "StaticImport" | "DynamicImport";

/** A non-sensitive snapshot of the loader contract. `reason` is human-readable and non-sensitive. */
export interface FedosWasmLoaderContractStatus {
  readonly state: FedosWasmLoaderState;
  readonly contractVersion: FedosLoaderContractVersion;
  readonly importMode: FedosLoaderImportMode;
  readonly initialized: boolean;
  readonly reason: string;
}

/**
 * The standalone, unwired WASM Loader Contract. Reports a fixed
 * status — never loads, imports, or executes the generated JS glue.
 * `FedosWasmLoaderContractPlaceholder` is the one implementation this
 * stage provides.
 */
export interface FedosWasmLoaderContract {
  status(): FedosWasmLoaderContractStatus;
}

/**
 * The placeholder `FedosWasmLoaderContract` — always reports
 * `"NotLoaded"`/`false`. Constructing an instance does nothing: no
 * file read, no module imported, no WASM instantiated.
 */
export class FedosWasmLoaderContractPlaceholder implements FedosWasmLoaderContract {
  constructor() {
    // Does nothing: no file read, no module imported, no WASM instantiated.
  }

  status(): FedosWasmLoaderContractStatus {
    return {
      state: "NotLoaded",
      contractVersion: "1",
      importMode: "StaticPlanning",
      initialized: false,
      reason: "FedOS WASM loader contract is a fixed observation record, not a real loader",
    };
  }
}

/**
 * Build a `FedosWasmLoaderContract`. No other module in this
 * repository calls this function yet — it exists for direct
 * construction by this codebase's own test suite and for the pure,
 * standalone functions below. Pure; never throws.
 */
export function createFedosWasmLoaderContract(): FedosWasmLoaderContract {
  return new FedosWasmLoaderContractPlaceholder();
}

/**
 * Pure, standalone: the loader's own fixed state — usable by
 * diagnostics (Stage 483) WITHOUT constructing a
 * `FedosWasmLoaderContract` instance. Fixed `"NotLoaded"`.
 */
export function wasmLoaderState(): FedosWasmLoaderState {
  return "NotLoaded";
}

/**
 * Pure, standalone: the fixed version of this contract model. Fixed
 * `"1"`.
 */
export function loaderContractVersion(): FedosLoaderContractVersion {
  return "1";
}

/**
 * Pure, standalone: the fixed, planned import mode. Fixed
 * `"StaticPlanning"` — no real import-mode decision has been made.
 */
export function loaderImportMode(): FedosLoaderImportMode {
  return "StaticPlanning";
}

/**
 * Pure, standalone: whether the generated JS glue has ever actually
 * been initialized (`initSync`/the default export called). Fixed
 * `false` — no parameter or override anywhere can flip it.
 */
export function loaderInitialized(): boolean {
  return false;
}
