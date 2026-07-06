/**
 * Stage 386 — FedOS WASM Boundary Model (Provider-internal only).
 *
 * The TENTH abstraction link in `FedosRuntimeCryptoProvider`'s internal
 * execution chain — `Provider → Operation (fedos_runtime_operation.ts,
 * Stage 313) → Opaque Request (fedos_runtime_opaque_request.ts, Stage
 * 314) → Opaque API (fedos_opaque_api.ts, Stage 321) → Rust Boundary
 * (fedos_rust_boundary.ts, Stage 329) → Rust API (fedos_rust_api.ts,
 * Stage 337) → Execution Review (fedos_rust_execution_review.ts, Stage
 * 345) → Internal Rust Call (fedos_internal_rust_call.ts, Stage 353) →
 * Rust Invocation Adapter (fedos_rust_invocation_adapter.ts, Stage 361)
 * → WASM Boundary (THIS FILE) → STOP`. This is the boundary
 * `docs/runtime_rust_boundary_decision.md` (Stage 385) formally
 * DECIDES is the sole official MVP mechanism for ever reaching
 * `packages/fedos-core-rust` — WebAssembly, not a Node Native Addon,
 * not a spawned CLI process, not raw FFI. THIS stage's
 * `FedosWasmBoundary` implementation never loads a real WASM module —
 * it is the STRUCTURAL placeholder that a future, separate,
 * explicitly-reviewed stage would eventually fill in.
 *
 * "Internal only" means: this module is imported ONLY by
 * `fedos_rust_invocation_adapter.ts` (Stage 387) — never by
 * `AppRuntime`/`create_runtime.ts`, never by `src/worker.ts`, never
 * re-exported through any public boundary. Every export here exists
 * for that ONE caller plus this codebase's own test suite (the
 * established "export for testability, wire nowhere" discipline
 * already used throughout every prior link in this chain).
 *
 * Stage 395 extends `planLoad()` with a TWELFTH link: it now builds a
 * `FedosWasmArtifact` (`fedos_wasm_artifact.ts`, Stage 394) and calls
 * its `planBuild()` — then DISCARDS the result and returns its OWN,
 * unchanged `"BlockedByImplementation"` answer. Only `planBuild()` is
 * called — `FedosWasmArtifact.planLoad()` is never reached from here
 * in this stage, since no real artifact could ever be loaded before
 * it is built. `planEncrypt()`/`planDecrypt()` are UNCHANGED by this
 * stage.
 *
 * HARD GUARDRAILS:
 *   - `FedosWasmBoundaryPlaceholder` NEVER calls
 *     `WebAssembly.instantiate`/`WebAssembly.compile`, never imports
 *     `wasm-bindgen`-generated bindings, never invokes `cargo build
 *     --target wasm32-*`, `wasm-pack`, `packages/fedos-core-rust`,
 *     never FFI, never a Node Native Addon, never a spawned CLI
 *     process, never any cryptographic operation of any kind. It
 *     simply RECEIVES a load/encrypt/decrypt request and returns a
 *     decision — nothing is ever actually built, loaded, or executed.
 *   - NO `SecretHandle`, `ConversationKey`, `MessageKey`, or
 *     `Nip44WirePayload` type or value (all `pub(crate)`-private inside
 *     `packages/fedos-core-rust`, never exposed to TypeScript) is
 *     imported, referenced, or constructed anywhere in this file.
 *   - `planLoad()`/`planEncrypt()`/`planDecrypt()` ALWAYS resolve
 *     `"BlockedByImplementation"` in this stage — `"ReadyForWasmExecution"`
 *     exists in `FedosWasmBoundaryDecisionState` only as a RESERVED
 *     label for a future, separate, explicitly-reviewed stage; nothing
 *     in this file can ever produce it.
 *   - No `process.env`/`RuntimeEnv` reference. No network/storage/Relay/
 *     Nostr/NIP-17 reference. No Runtime/Worker activation of any kind.
 *   - Pure; every method here is synchronous, never throws, never
 *     mutates its argument, never allocates a payload/plaintext/
 *     ciphertext/key of any kind, never touches a filesystem or network
 *     resource to "load" or "build" anything.
 */

import { createFedosWasmArtifact } from "./fedos_wasm_artifact.js";
import type { OpaqueDecryptRequest, OpaqueEncryptRequest } from "./fedos_runtime_opaque_request.js";

/**
 * Coarse status of the WASM Boundary abstraction itself. `"NotLoaded"`
 * is the ONLY value this stage's implementation produces — mirroring
 * `FedosRustBoundaryState`'s own `"NotConnected"` precedent
 * (`src/runtime/fedos_rust_boundary.ts`), renamed to `"NotLoaded"`
 * because loading (not connecting) is this specific boundary's own
 * verb.
 */
export type FedosWasmBoundaryState = "NotLoaded";

/** A non-sensitive snapshot of a `FedosWasmBoundary`. `reason` is human-readable and non-sensitive. */
export interface FedosWasmBoundaryStatus {
  readonly state: FedosWasmBoundaryState;
  readonly reason: string;
}

/**
 * The outcome of `FedosWasmBoundary.planLoad()`/`planEncrypt()`/
 * `planDecrypt()`. `"BlockedByImplementation"` is the ONLY value this
 * stage's implementation ever produces; `"ReadyForWasmExecution"` is
 * RESERVED.
 */
export type FedosWasmBoundaryDecisionState = "BlockedByImplementation" | "ReadyForWasmExecution";

/** Which operation a `FedosWasmBoundaryDecision` describes. */
export type FedosWasmBoundaryOperation = "load" | "encrypt" | "decrypt";

/** The result of a `FedosWasmBoundary.planLoad()`/`planEncrypt()`/`planDecrypt()` call. No ciphertext/plaintext/secret material of any kind. */
export interface FedosWasmBoundaryDecision {
  readonly operation: FedosWasmBoundaryOperation;
  readonly state: FedosWasmBoundaryDecisionState;
  readonly reason: string;
}

/**
 * The Provider-internal WASM Boundary. Receives a load/encrypt/decrypt
 * request and returns a decision — never invokes
 * `WebAssembly.instantiate`, `wasm-bindgen`, `packages/fedos-core-rust`,
 * FFI, or a Native Addon. `FedosWasmBoundaryPlaceholder` is the one
 * implementation this stage provides.
 */
export interface FedosWasmBoundary {
  status(): FedosWasmBoundaryStatus;
  planLoad(): FedosWasmBoundaryDecision;
  planEncrypt(request: OpaqueEncryptRequest): FedosWasmBoundaryDecision;
  planDecrypt(request: OpaqueDecryptRequest): FedosWasmBoundaryDecision;
}

/**
 * The placeholder `FedosWasmBoundary` — always denies, never loads,
 * never executes. Constructing an instance does nothing: no module
 * fetched, no bytes compiled, no instance instantiated.
 */
export class FedosWasmBoundaryPlaceholder implements FedosWasmBoundary {
  constructor() {
    // Does nothing: no module fetched, no bytes compiled, no instance instantiated.
  }

  status(): FedosWasmBoundaryStatus {
    return {
      state: "NotLoaded",
      reason: "FedOS WASM boundary has not loaded any module",
    };
  }

  planLoad(): FedosWasmBoundaryDecision {
    this.#reachWasmArtifact(); // result discarded -- no WASM artifact is ever built
    return this.#blocked("load");
  }

  planEncrypt(_request: OpaqueEncryptRequest): FedosWasmBoundaryDecision {
    return this.#blocked("encrypt");
  }

  planDecrypt(_request: OpaqueDecryptRequest): FedosWasmBoundaryDecision {
    return this.#blocked("decrypt");
  }

  /**
   * PRIVATE — builds a `FedosWasmArtifact` and calls its
   * `planBuild()`. The result is discarded; it is never passed to
   * `cargo build --target wasm32-*`/`wasm-bindgen`/`wasm-pack`/
   * `packages/fedos-core-rust`, never passed to Runtime or Worker.
   * The WASM Artifact itself never builds anything either.
   */
  #reachWasmArtifact(): void {
    const artifact = createFedosWasmArtifact();
    artifact.planBuild();
  }

  #blocked(operation: FedosWasmBoundaryOperation): FedosWasmBoundaryDecision {
    return {
      operation,
      state: "BlockedByImplementation",
      reason: `FedOS WASM boundary does not perform ${operation} in this stage: no WASM module is ever loaded`,
    };
  }
}

/**
 * Build a `FedosWasmBoundary`. `FedosRustInvocationAdapter`'s own
 * placeholder (Stage 387) is the ONLY caller of this function in this
 * repository. Pure; never throws.
 */
export function createFedosWasmBoundary(): FedosWasmBoundary {
  return new FedosWasmBoundaryPlaceholder();
}

/**
 * Pure, standalone: the WASM Boundary's own `FedosWasmBoundaryState` —
 * usable by diagnostics WITHOUT constructing a `FedosWasmBoundary`
 * instance (Stage 388). Fixed `"NotLoaded"` in this stage, mirroring
 * `FedosWasmBoundaryPlaceholder.status()` exactly.
 */
export function fedosWasmBoundaryState(): FedosWasmBoundaryState {
  return "NotLoaded";
}

/**
 * Pure, standalone: whether the WASM Boundary is structurally
 * reachable from the Rust Invocation Adapter's own internal chain
 * (Stage 387 wires it) — NOT whether a real WASM module ever loads.
 * Fixed `true` in this stage: the code path exists and is called, but
 * every call still resolves `"BlockedByImplementation"`.
 */
export function fedosWasmBoundaryReachable(): boolean {
  return true;
}

/**
 * Pure, standalone: whether a real WASM module has ever actually been
 * loaded. Fixed `false` in this stage — no parameter or override
 * anywhere can flip it.
 */
export function fedosWasmLoaded(): boolean {
  return false;
}
