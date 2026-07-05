/**
 * Stage 361 — FedOS Rust Invocation Adapter (Provider-internal only).
 *
 * The NINTH abstraction link in `FedosRuntimeCryptoProvider`'s internal
 * execution chain — `Provider → Operation (fedos_runtime_operation.ts,
 * Stage 313) → Opaque Request (fedos_runtime_opaque_request.ts, Stage
 * 314) → Opaque API (fedos_opaque_api.ts, Stage 321) → Rust Boundary
 * (fedos_rust_boundary.ts, Stage 329) → Rust API (fedos_rust_api.ts,
 * Stage 337) → Execution Review (fedos_rust_execution_review.ts, Stage
 * 345) → Internal Rust Call (fedos_internal_rust_call.ts, Stage 353) →
 * Rust Invocation Adapter (THIS FILE) → STOP`. This is the FINAL
 * abstraction layer a future, separate, explicitly-reviewed stage
 * would eventually fill in with a real `packages/fedos-core-rust`
 * call — but THIS stage's `FedosRustInvocationAdapter` implementation
 * never makes one.
 *
 * "Internal only" means: this module is imported ONLY by
 * `fedos_internal_rust_call.ts` (Stage 362) — never by `AppRuntime`/
 * `create_runtime.ts`, never by `src/worker.ts`, never re-exported
 * through any public boundary. Every export here exists for that ONE
 * caller plus this codebase's own test suite (the established "export
 * for testability, wire nowhere" discipline already used throughout
 * `fedos_runtime_operation.ts`/`fedos_runtime_opaque_request.ts`/
 * `fedos_opaque_api.ts`/`fedos_rust_boundary.ts`/`fedos_rust_api.ts`/
 * `fedos_rust_execution_review.ts`/`fedos_internal_rust_call.ts`).
 *
 * Stage 363 implements the placeholder handlers: `planEncrypt()`/
 * `planDecrypt()` on `FedosRustInvocationAdapterPlaceholder`. BOTH
 * ALWAYS resolve `"BlockedByImplementation"` — never execute anything,
 * never allocate a payload, plaintext, ciphertext, or key of any kind.
 *
 * Stage 370 adds `planPing()` — the TypeScript-side counterpart of
 * `packages/fedos-core-rust`'s new, harmless, constant-returning
 * `fedos_runtime_ping_internal()` (Stage 369). `planPing()` ALWAYS
 * resolves `"BlockedByImplementation"` too, in THIS stage — it never
 * calls Rust yet. Wiring an actual cross-language call is a future,
 * separate, explicitly-reviewed stage's own decision
 * (`docs/runtime_first_rust_invocation.md`).
 *
 * HARD GUARDRAILS:
 *   - `FedosRustInvocationAdapterPlaceholder` NEVER invokes
 *     `packages/fedos-core-rust` (Rust crate or TS package boundary),
 *     never WASM, never FFI, never any cryptographic operation of any
 *     kind. It simply RECEIVES a `FedosInternalRustCall` and returns a
 *     decision — execution stops here, permanently, in this stage.
 *   - NO `SecretHandle`, `ConversationKey`, `MessageKey`, or
 *     `Nip44WirePayload` type or value (all `pub(crate)`-private inside
 *     `packages/fedos-core-rust`, never exposed to TypeScript) is
 *     imported, referenced, or constructed anywhere in this file.
 *   - `planEncrypt()`/`planDecrypt()` ALWAYS resolve
 *     `"BlockedByImplementation"` in this stage — `"ReadyForRustExecution"`
 *     exists in `FedosRustInvocationAdapterDecisionState` only as a
 *     RESERVED label for a future, separate, explicitly-reviewed stage;
 *     nothing in this file can ever produce it.
 *   - No `process.env`/`RuntimeEnv` reference. No network/storage/Relay/
 *     Nostr/NIP-17 reference. No Runtime/Worker activation of any kind.
 *   - Pure; every method here is synchronous, never throws, never
 *     mutates its argument, never allocates a payload/plaintext/
 *     ciphertext/key of any kind.
 */

import type { FedosInternalRustCall } from "./fedos_internal_rust_call.js";

/**
 * Coarse status of the Rust Invocation Adapter abstraction itself.
 * `"NotConnected"` is the ONLY value this stage's implementation
 * produces — mirroring `FedosRustApiState`'s own `"NotConnected"`
 * precedent (`src/runtime/fedos_rust_api.ts`).
 */
export type FedosRustInvocationAdapterState = "NotConnected";

/** A non-sensitive snapshot of a `FedosRustInvocationAdapter`. `reason` is human-readable and non-sensitive. */
export interface FedosRustInvocationAdapterStatus {
  readonly state: FedosRustInvocationAdapterState;
  readonly reason: string;
}

/**
 * The outcome of `FedosRustInvocationAdapter.planEncrypt()`/`planDecrypt()`.
 * `"BlockedByImplementation"` is the ONLY value this stage's
 * implementation ever produces; `"ReadyForRustExecution"` is RESERVED.
 */
export type FedosRustInvocationAdapterDecisionState = "BlockedByImplementation" | "ReadyForRustExecution";

/** The result of a `FedosRustInvocationAdapter.planEncrypt()`/`planDecrypt()` call. No payload/plaintext/ciphertext/key material of any kind. */
export interface FedosRustInvocationAdapterDecision {
  readonly kind: "Encrypt" | "Decrypt";
  readonly state: FedosRustInvocationAdapterDecisionState;
  readonly reason: string;
}

/**
 * The result of `FedosRustInvocationAdapter.planPing()`. No `kind`
 * field — ping is neither an encrypt nor a decrypt operation, and
 * carries no `FedosInternalRustCall` of its own. No payload/plaintext/
 * ciphertext/key material of any kind — indeed no material of any
 * kind at all, since `fedos_runtime_ping_internal()` takes no
 * parameters and returns a single constant `bool`.
 */
export interface FedosRustInvocationAdapterPingDecision {
  readonly state: FedosRustInvocationAdapterDecisionState;
  readonly reason: string;
}

/**
 * The Provider-internal, final Rust Invocation Adapter. Receives a
 * `FedosInternalRustCall` and returns a decision — never invokes
 * `packages/fedos-core-rust`, WASM, or FFI. `FedosRustInvocationAdapterPlaceholder`
 * is the one implementation this stage provides.
 */
export interface FedosRustInvocationAdapter {
  status(): FedosRustInvocationAdapterStatus;
  planEncrypt(call: FedosInternalRustCall): FedosRustInvocationAdapterDecision;
  planDecrypt(call: FedosInternalRustCall): FedosRustInvocationAdapterDecision;
  planPing(): FedosRustInvocationAdapterPingDecision;
}

/**
 * The placeholder `FedosRustInvocationAdapter` — always denies, never
 * executes. Constructing an instance does nothing: no core loaded, no
 * handle resolved, no byte touched.
 */
export class FedosRustInvocationAdapterPlaceholder implements FedosRustInvocationAdapter {
  constructor() {
    // Does nothing: no core loaded, no handle resolved, no byte touched.
  }

  status(): FedosRustInvocationAdapterStatus {
    return {
      state: "NotConnected",
      reason: "FedOS Rust invocation adapter is not connected to any real core",
    };
  }

  planEncrypt(_call: FedosInternalRustCall): FedosRustInvocationAdapterDecision {
    return this.#blocked("Encrypt");
  }

  planDecrypt(_call: FedosInternalRustCall): FedosRustInvocationAdapterDecision {
    return this.#blocked("Decrypt");
  }

  planPing(): FedosRustInvocationAdapterPingDecision {
    return {
      state: "BlockedByImplementation",
      reason: "FedOS Rust invocation adapter does not call Rust's ping in this stage: no cross-language wiring exists yet",
    };
  }

  #blocked(kind: "Encrypt" | "Decrypt"): FedosRustInvocationAdapterDecision {
    return {
      kind,
      state: "BlockedByImplementation",
      reason: `FedOS Rust invocation adapter does not perform ${kind} in this stage: no real Rust execution exists yet`,
    };
  }
}

/**
 * Build a `FedosRustInvocationAdapter`. `FedosInternalRustCall`'s own
 * `evaluateFedosInternalRustCall` (Stage 362) is the ONLY caller of
 * this function in this repository. Pure; never throws.
 */
export function createFedosRustInvocationAdapter(): FedosRustInvocationAdapter {
  return new FedosRustInvocationAdapterPlaceholder();
}

/**
 * Pure, standalone: the Rust Invocation Adapter's own
 * `FedosRustInvocationAdapterState` — usable by diagnostics WITHOUT
 * constructing a `FedosRustInvocationAdapter` instance (Stage 365).
 * Fixed `"NotConnected"` in this stage, mirroring
 * `FedosRustInvocationAdapterPlaceholder.status()` exactly.
 */
export function fedosRustInvocationAdapterState(): FedosRustInvocationAdapterState {
  return "NotConnected";
}

/**
 * Pure, standalone: whether the Rust Invocation Adapter is structurally
 * reachable from the Internal Rust Call's own internal chain (Stage
 * 362 wires it) — NOT whether real Rust crypto executes. Fixed `true`
 * in this stage: the code path exists and is called, but every call
 * still resolves `"BlockedByImplementation"`.
 */
export function fedosRustInvocationAdapterReachable(): boolean {
  return true;
}

/**
 * Pure, standalone: whether the Rust Invocation Adapter has ever
 * actually executed real Rust crypto. Fixed `false` in this stage — no
 * parameter or override anywhere can flip it.
 */
export function fedosRustInvocationAdapterExecuted(): boolean {
  return false;
}

/**
 * Pure, standalone: whether `planPing()` is structurally reachable
 * from the Rust Invocation Adapter's own placeholder implementation
 * (Stage 370 wires it) — NOT whether Rust's `fedos_runtime_ping_internal()`
 * has ever actually been called from TypeScript. Fixed `true` in this
 * stage: `planPing()` exists and can be called, but it never calls
 * Rust yet — it always resolves `"BlockedByImplementation"`.
 */
export function fedosRustPingReachable(): boolean {
  return true;
}

/**
 * Pure, standalone: whether Rust's `fedos_runtime_ping_internal()` has
 * ever actually been called from TypeScript. Fixed `false` in this
 * stage — no parameter or override anywhere can flip it; `planPing()`
 * never calls Rust in this stage.
 */
export function fedosRustPingExecuted(): boolean {
  return false;
}

/**
 * Route a `FedosInternalRustCall` to the matching
 * `planEncrypt`/`planDecrypt` method. Pure; never throws; never
 * mutates `call`.
 */
export function planFedosRustInvocationAdapterExecution(
  adapter: FedosRustInvocationAdapter,
  call: FedosInternalRustCall,
): FedosRustInvocationAdapterDecision {
  if (call.kind === "Encrypt") {
    return adapter.planEncrypt(call);
  }
  return adapter.planDecrypt(call);
}
