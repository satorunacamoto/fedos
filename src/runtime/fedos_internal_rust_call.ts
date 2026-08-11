/**
 * Stage 353 — FedOS Internal Rust Call Plan (Provider-internal only).
 *
 * The EIGHTH abstraction link in `FedosRuntimeCryptoProvider`'s internal
 * execution chain — `Provider → Operation (fedos_runtime_operation.ts,
 * Stage 313) → Opaque Request (fedos_runtime_opaque_request.ts, Stage
 * 314) → Opaque API (fedos_opaque_api.ts, Stage 321) → Rust Boundary
 * (fedos_rust_boundary.ts, Stage 329) → Rust API (fedos_rust_api.ts,
 * Stage 337) → Execution Review (fedos_rust_execution_review.ts, Stage
 * 345) → Internal Rust Call (THIS FILE) → STOP`. This models the SHAPE
 * of the call a future, separate, explicitly-reviewed stage would
 * eventually make into `packages/fedos-core-rust` — but THIS stage
 * never makes it. Planning a call is NOT calling it.
 *
 * "Internal only" means: this module is imported ONLY by
 * `fedos_rust_execution_review.ts` (Stage 354) — never by `AppRuntime`/
 * `create_runtime.ts`, never by `src/worker.ts`, never re-exported
 * through any public boundary. Every export here exists for that ONE
 * caller plus this codebase's own test suite (the established "export
 * for testability, wire nowhere" discipline already used throughout
 * `fedos_runtime_operation.ts`/`fedos_runtime_opaque_request.ts`/
 * `fedos_opaque_api.ts`/`fedos_rust_boundary.ts`/`fedos_rust_api.ts`/
 * `fedos_rust_execution_review.ts`).
 *
 * HARD GUARDRAILS:
 *   - This file NEVER invokes `packages/fedos-core-rust` (Rust crate or
 *     TS package boundary), never WASM, never FFI, never any
 *     cryptographic operation of any kind. `FedosInternalRustCall` is
 *     PLAIN DATA — a `kind` label only, never a request, never a
 *     handle, never a byte of any kind.
 *   - NO `SecretHandle`, `ConversationKey`, `MessageKey`, or
 *     `Nip44WirePayload` type or value (all `pub(crate)`-private inside
 *     `packages/fedos-core-rust`, never exposed to TypeScript) is
 *     imported, referenced, or constructed anywhere in this file.
 *   - `evaluateFedosInternalRustCall` ALWAYS resolves
 *     `{ status: "Planned", ... }` in this stage — `"Executed"` exists
 *     in `FedosInternalRustCallStatus` only as a RESERVED label for a
 *     future, separate, explicitly-reviewed stage; nothing in this file
 *     can ever produce it.
 *   - No `process.env`/`RuntimeEnv` reference. No network/storage/Relay/
 *     Nostr/NIP-17 reference. No Runtime/Worker activation of any kind.
 *   - Pure; every function here is synchronous, never throws, never
 *     mutates its argument.
 *
 * Stage 362 extends `evaluateFedosInternalRustCall` with a NINTH link:
 * it now builds a `FedosRustInvocationAdapter`
 * (`fedos_rust_invocation_adapter.ts`, Stage 361) and routes `call` to
 * it via `planFedosRustInvocationAdapterExecution` — then IMMEDIATELY
 * DISCARDS the result and returns the EXISTING `"Planned"` status
 * UNCHANGED. The Rust Invocation Adapter itself never invokes
 * `packages/fedos-core-rust`/WASM/FFI.
 */

import { createFedosRustInvocationAdapter, planFedosRustInvocationAdapterExecution } from "./fedos_rust_invocation_adapter.js";
import type { FedosInternalRustCallKind, FedosInternalRustCall } from "./fedos_internal_rust_call_shape.js";

// Nostr Consolidation Plan, Step 5 / architecture cycle detector baseline
// reduction — `FedosInternalRustCallKind`/`FedosInternalRustCall` now live
// in the dedicated `./fedos_internal_rust_call_shape.ts` (see that file's
// own header for why); re-exported here, unchanged in shape, so this
// file's own existing consumer (`fedos_rust_execution_review.ts`) needed
// zero call-site changes.
export type { FedosInternalRustCallKind, FedosInternalRustCall };

/**
 * Coarse status of a `FedosInternalRustCall`. `"Planned"` is the ONLY
 * value `evaluateFedosInternalRustCall` produces in this stage;
 * `"Executed"` is RESERVED — mirroring this codebase's existing
 * "Allowed"/"FutureFeature"/"Enabled"/"Completed" reserved-label
 * precedent (`src/runtime/runtime_crypto_activation_policy.ts`,
 * `src/runtime/runtime_crypto_diagnostics.ts`,
 * `src/runtime/fedos_runtime_operation.ts`).
 */
export type FedosInternalRustCallStatus = "Planned" | "Executed";

/** Every `FedosInternalRustCallStatus`, for validation/documentation helpers. */
export const FEDOS_INTERNAL_RUST_CALL_STATUSES: readonly FedosInternalRustCallStatus[] = [
  "Planned",
  "Executed",
];

/** The result of evaluating a `FedosInternalRustCall`. `reason` is non-sensitive and human-readable. */
export interface FedosInternalRustCallDecision {
  readonly call: FedosInternalRustCall;
  readonly status: FedosInternalRustCallStatus;
  readonly reason: string;
}

/** Plan a `FedosInternalRustCall` for the given kind. Pure; never throws. */
export function planFedosInternalRustCall(
  kind: FedosInternalRustCallKind,
): FedosInternalRustCall {
  return { kind };
}

/**
 * Evaluate a planned `FedosInternalRustCall`. ALWAYS resolves
 * `"Planned"` in this stage — there is no code path in this file that
 * could ever produce `"Executed"`. Pure; never throws; never mutates
 * `call`.
 */
export function evaluateFedosInternalRustCall(
  call: FedosInternalRustCall,
): FedosInternalRustCallDecision {
  const adapter = createFedosRustInvocationAdapter();
  planFedosRustInvocationAdapterExecution(adapter, call); // discarded — never changes this decision
  return {
    call,
    status: "Planned",
    reason: `FedOS internal Rust ${call.kind} call is planned only -- never executed in this stage`,
  };
}

/**
 * Pure, standalone: the Internal Rust Call's own
 * `FedosInternalRustCallStatus` — usable by diagnostics WITHOUT
 * constructing a `FedosInternalRustCall`/calling
 * `evaluateFedosInternalRustCall` (Stage 357). Fixed `"Planned"` in
 * this stage.
 */
export function fedosInternalRustCallState(): FedosInternalRustCallStatus {
  return "Planned";
}

/**
 * Pure, standalone: whether the Internal Rust Call plan is structurally
 * reachable from the Execution Review's own internal chain (Stage 354
 * wires it) — NOT whether real Rust crypto executes. Fixed `true` in
 * this stage: the code path exists and is called, but every call still
 * resolves `"Planned"`, never `"Executed"`.
 */
export function fedosInternalRustCallReachable(): boolean {
  return true;
}

/**
 * Pure, standalone: whether a `FedosInternalRustCall` has ever actually
 * executed. Fixed `false` in this stage — no parameter or override
 * anywhere can flip it.
 */
export function fedosInternalRustCallExecuted(): boolean {
  return false;
}
