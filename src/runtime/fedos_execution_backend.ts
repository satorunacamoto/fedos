/**
 * Stage 402 — FedOS Execution Backend Model (Provider-internal only).
 *
 * Formalizes the abstraction `docs/runtime_execution_backend.md` (Stage
 * 401) describes in writing: `packages/fedos-core-rust` ("FedOS Core")
 * is the one and only core, and the Execution Backend is the swappable
 * INTERFACE between that core and any Runtime. WASM
 * (`fedos_wasm_boundary.ts`, Stage 386) is the FIRST implementation
 * candidate for this interface — not a permanent commitment. THIS
 * stage's `FedosExecutionBackend` implementation never selects,
 * connects to, or executes a real backend of any kind — it is the
 * STRUCTURAL placeholder a future, separate, explicitly-reviewed stage
 * would eventually fill in.
 *
 * "Internal only" means: this module is imported ONLY by
 * `fedos_rust_invocation_adapter.ts` (Stage 403) — never by
 * `AppRuntime`/`create_runtime.ts`, never by `src/worker.ts`, never
 * re-exported through any public boundary. Every export here exists
 * for that ONE caller plus this codebase's own test suite (the
 * established "export for testability, wire nowhere" discipline
 * already used throughout every prior link in this chain).
 *
 * Stage 403 extends `FedosRustInvocationAdapterPlaceholder.planEncrypt()`/
 * `planDecrypt()` to reach THIS file INSTEAD OF `fedos_wasm_boundary.ts`
 * directly. This file's own `planLoad()` builds a `FedosWasmBoundary`
 * (Stage 386, UNCHANGED) and calls its EXISTING `planLoad()` — then
 * DISCARDS the result and returns its OWN, unchanged `"Planning"`
 * answer. The WASM Boundary is thus now reached THROUGH the Execution
 * Backend, not directly from the Rust Invocation Adapter — the WASM
 * Boundary file itself is untouched by this stage.
 *
 * HARD GUARDRAILS:
 *   - `FedosExecutionBackendPlaceholder` NEVER selects, connects to, or
 *     executes any real backend. It NEVER calls
 *     `WebAssembly.instantiate`/`WebAssembly.compile`, never imports
 *     `wasm-bindgen`-generated bindings, never invokes `cargo build
 *     --target wasm32-*`/`wasm-pack`, never invokes a Native/Mobile
 *     toolchain of any kind, never FFI, never a Node Native Addon,
 *     never a spawned CLI process, never any cryptographic operation of
 *     any kind. It simply RECEIVES a backend/load request and returns a
 *     decision — nothing is ever actually selected, connected, built,
 *     loaded, or executed.
 *   - NO `SecretHandle`, `ConversationKey`, `MessageKey`, or
 *     `Nip44WirePayload` type or value (all `pub(crate)`-private inside
 *     `packages/fedos-core-rust`, never exposed to TypeScript) is
 *     imported, referenced, or constructed anywhere in this file.
 *   - `planBackend()`/`planLoad()` ALWAYS resolve `"Planning"` in this
 *     stage — `"Selected"` exists in `FedosExecutionBackendState` only
 *     as a RESERVED label for a future, separate, explicitly-reviewed
 *     stage; nothing in this file can ever produce it.
 *   - No `process.env`/`RuntimeEnv` reference. No network/storage/Relay/
 *     Nostr/NIP-17 reference. No Runtime/Worker activation of any kind.
 *   - Pure; every method here is synchronous, never throws, never
 *     mutates its argument, never allocates a payload/plaintext/
 *     ciphertext/key of any kind, never touches a filesystem or network
 *     resource to "select", "connect", "build", or "load" anything.
 */

import { createFedosWasmBoundary } from "./fedos_wasm_boundary.js";

/**
 * Which Execution Backend candidate a `FedosExecutionBackendSelection`/
 * `FedosExecutionBackendDecision` names. `"Wasm"` is the first
 * implementation candidate (a real, inert placeholder chain exists for
 * it); `"Native"` and `"Future"` are labels reserved for a Desktop
 * Native and any further backend candidate respectively — NEITHER has
 * any file, dependency, or code path anywhere in this repository.
 */
export type FedosExecutionBackendKind = "Wasm" | "Native" | "Future";

/**
 * Coarse connection status of the Execution Backend abstraction
 * itself. `"NotConnected"` is the ONLY value this stage's
 * implementation produces — mirroring `FedosWasmBoundaryState`'s own
 * `"NotLoaded"` precedent (`src/runtime/fedos_wasm_boundary.ts`),
 * renamed to `"NotConnected"` because connecting to a backend (not
 * loading a module) is this abstraction's own verb.
 */
export type FedosExecutionBackendConnectionState = "NotConnected";

/** A non-sensitive snapshot of a `FedosExecutionBackend`. `reason` is human-readable and non-sensitive. */
export interface FedosExecutionBackendStatus {
  readonly state: FedosExecutionBackendConnectionState;
  readonly reason: string;
}

/**
 * The outcome of `FedosExecutionBackend.planBackend()`/`planLoad()`.
 * `"Planning"` is the ONLY value this stage's implementation ever
 * produces; `"Selected"` is RESERVED for a future, separate,
 * explicitly-reviewed stage — nothing in this file can ever produce
 * it.
 */
export type FedosExecutionBackendState = "Planning" | "Selected";

/** The result of `FedosExecutionBackend.planBackend()` — which candidate is named, and that naming it is not selecting it. */
export interface FedosExecutionBackendSelection {
  readonly backend: FedosExecutionBackendKind;
  readonly state: FedosExecutionBackendState;
  readonly reason: string;
}

/** Which operation a `FedosExecutionBackendDecision` describes. */
export type FedosExecutionBackendOperation = "load";

/** The result of a `FedosExecutionBackend.planLoad()` call. No compiled bytes, module, secret, or byte of any kind. */
export interface FedosExecutionBackendDecision {
  readonly operation: FedosExecutionBackendOperation;
  readonly backend: FedosExecutionBackendKind;
  readonly state: FedosExecutionBackendState;
  readonly reason: string;
}

/**
 * The Provider-internal Execution Backend. Receives a backend/load
 * request and returns a decision — never selects, connects to, builds,
 * or loads a real WASM/Native/Mobile backend of any kind.
 * `FedosExecutionBackendPlaceholder` is the one implementation this
 * stage provides.
 */
export interface FedosExecutionBackend {
  status(): FedosExecutionBackendStatus;
  planBackend(): FedosExecutionBackendSelection;
  planLoad(): FedosExecutionBackendDecision;
}

/**
 * The placeholder `FedosExecutionBackend` — always plans, never
 * selects, connects, or executes. Constructing an instance does
 * nothing: no backend chosen, no module fetched, no toolchain invoked.
 */
export class FedosExecutionBackendPlaceholder implements FedosExecutionBackend {
  constructor() {
    // Does nothing: no backend chosen, no module fetched, no toolchain invoked.
  }

  status(): FedosExecutionBackendStatus {
    return {
      state: "NotConnected",
      reason: "FedOS Execution Backend has not connected to any real backend",
    };
  }

  planBackend(): FedosExecutionBackendSelection {
    return {
      backend: "Wasm",
      state: "Planning",
      reason:
        "FedOS Execution Backend's first implementation candidate is WASM -- naming it does not select or connect to it",
    };
  }

  planLoad(): FedosExecutionBackendDecision {
    this.#reachWasmBackend(); // result discarded -- no WASM module is ever loaded
    return {
      operation: "load",
      backend: "Wasm",
      state: "Planning",
      reason: "FedOS Execution Backend does not perform load in this stage: no backend is ever selected, connected, or executed",
    };
  }

  /**
   * PRIVATE — builds a `FedosWasmBoundary` (the WASM candidate's own,
   * UNCHANGED placeholder, Stage 386) and calls its `planLoad()`. The
   * result is discarded; it is never passed to
   * `packages/fedos-core-rust`, a real WASM/Native/Mobile/FFI
   * boundary, never passed to Runtime or Worker. The WASM Boundary
   * itself never loads anything either.
   */
  #reachWasmBackend(): void {
    const boundary = createFedosWasmBoundary();
    boundary.planLoad();
  }
}

/**
 * Build a `FedosExecutionBackend`. `FedosRustInvocationAdapter`'s own
 * placeholder (Stage 403) is the ONLY caller of this function in this
 * repository. Pure; never throws.
 */
export function createExecutionBackend(): FedosExecutionBackend {
  return new FedosExecutionBackendPlaceholder();
}

/**
 * Pure, standalone: the Execution Backend's own candidate kind —
 * usable by diagnostics WITHOUT constructing a `FedosExecutionBackend`
 * instance (Stage 404). Fixed `"Wasm"` in this stage, mirroring
 * `FedosExecutionBackendPlaceholder.planBackend()` exactly.
 */
export function fedosExecutionBackendKind(): FedosExecutionBackendKind {
  return "Wasm";
}

/**
 * Pure, standalone: the Execution Backend's own `FedosExecutionBackendState`
 * — usable by diagnostics WITHOUT constructing an instance. Fixed
 * `"Planning"` in this stage, mirroring `planBackend()`/`planLoad()`
 * exactly.
 */
export function fedosExecutionBackendState(): FedosExecutionBackendState {
  return "Planning";
}

/**
 * Pure, standalone: whether the Execution Backend is structurally
 * reachable from the Rust Invocation Adapter's own internal chain
 * (Stage 403 wires it) — NOT whether a real backend is ever selected
 * or connected. Fixed `true` in this stage: the code path exists and
 * is called, but every call still resolves `"Planning"`.
 */
export function fedosExecutionBackendReachable(): boolean {
  return true;
}

/**
 * Pure, standalone: whether ANY Execution Backend candidate (WASM,
 * Native, Mobile, or otherwise) has ever actually been implemented and
 * connected. Fixed `false` in this stage — no parameter or override
 * anywhere can flip it.
 */
export function fedosExecutionBackendImplemented(): boolean {
  return false;
}
