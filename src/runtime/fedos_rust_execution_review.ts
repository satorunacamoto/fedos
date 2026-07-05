/**
 * Stage 345 — FedOS Rust Execution Review (Provider-internal only).
 *
 * The SEVENTH and FINAL abstraction link in `FedosRuntimeCryptoProvider`'s
 * internal execution chain — `Provider → Operation
 * (fedos_runtime_operation.ts, Stage 313) → Opaque Request
 * (fedos_runtime_opaque_request.ts, Stage 314) → Opaque API
 * (fedos_opaque_api.ts, Stage 321) → Rust Boundary
 * (fedos_rust_boundary.ts, Stage 329) → Rust API (fedos_rust_api.ts,
 * Stage 337) → Execution Review (THIS FILE) → STOP`. This is the LAST
 * stop before any real Rust crypto invocation — the single, auditable
 * place a human reviewer or diagnostics display can read WHY execution
 * has not (yet) been approved.
 *
 * "Internal only" means: this module is imported ONLY by
 * `fedos_rust_api.ts` (Stage 346) — never by `AppRuntime`/
 * `create_runtime.ts`, never by `src/worker.ts`, never re-exported
 * through any public boundary. Every export here exists for that ONE
 * caller plus this codebase's own test suite (the established "export
 * for testability, wire nowhere" discipline already used throughout
 * `fedos_runtime_operation.ts`/`fedos_runtime_opaque_request.ts`/
 * `fedos_opaque_api.ts`/`fedos_rust_boundary.ts`/`fedos_rust_api.ts`).
 *
 * HARD GUARDRAILS:
 *   - `FedosRustExecutionReviewPlaceholder` NEVER invokes
 *     `packages/fedos-core-rust` (Rust crate or TS package boundary),
 *     never WASM, never FFI, never any cryptographic operation of any
 *     kind. It simply RECEIVES a `FedosOpaqueRequest` and returns a
 *     decision — execution stops here, permanently, in this stage.
 *   - NO `SecretHandle`, `ConversationKey`, `MessageKey`, or
 *     `Nip44WirePayload` type or value (all `pub(crate)`-private inside
 *     `packages/fedos-core-rust`, never exposed to TypeScript) is
 *     imported, referenced, or constructed anywhere in this file.
 *   - `reviewEncrypt()`/`reviewDecrypt()` ALWAYS resolve
 *     `{ approved: false, reason: "BlockedBeforeCrypto" }` in this
 *     stage. `"RuntimeNotActivated"`, `"WorkerNotActivated"`,
 *     `"RustExecutionNotApproved"`, and `"FutureOnly"` all exist in
 *     `FedosRustExecutionReviewReason` only as RESERVED labels for a
 *     future, separate, explicitly-reviewed stage; nothing in this file
 *     can ever produce them.
 *   - No `process.env`/`RuntimeEnv` reference. No network/storage/Relay/
 *     Nostr/NIP-17 reference. No Runtime/Worker activation of any kind.
 *   - Pure; every method here is synchronous, never throws, never
 *     mutates its argument.
 *
 * Stage 354 extends `FedosRustExecutionReviewPlaceholder.reviewEncrypt()`/
 * `reviewDecrypt()` with an EIGHTH link: each now builds a
 * `FedosInternalRustCall` (`fedos_internal_rust_call.ts`, Stage 353),
 * evaluates it (always `"Planned"`) — then IMMEDIATELY DISCARDS it and
 * returns the EXISTING review result UNCHANGED
 * (`{ approved: false, reason: "BlockedBeforeCrypto" }`). Planning a
 * call is NOT calling it — no `packages/fedos-core-rust`/WASM/FFI
 * invocation results from this, ever.
 */

import { evaluateFedosInternalRustCall, planFedosInternalRustCall } from "./fedos_internal_rust_call.js";
import type { FedosOpaqueRequest, OpaqueDecryptRequest, OpaqueEncryptRequest } from "./fedos_runtime_opaque_request.js";

/**
 * Coarse status of the Execution Review abstraction itself.
 * `"Blocked"` is the ONLY value this stage's implementation produces.
 */
export type FedosRustExecutionReviewState = "Blocked";

/** A non-sensitive snapshot of a `FedosRustExecutionReview`. `reason` is human-readable and non-sensitive. */
export interface FedosRustExecutionReviewStatus {
  readonly state: FedosRustExecutionReviewState;
  readonly reason: string;
}

/**
 * WHY `FedosRustExecutionReview.reviewEncrypt()`/`reviewDecrypt()`
 * currently deny every request. `"BlockedBeforeCrypto"` is the ONLY
 * value this stage's implementation ever produces (real Rust crypto
 * execution has not been reviewed or approved at all yet) —
 * `"RuntimeNotActivated"`/`"WorkerNotActivated"`/
 * `"RustExecutionNotApproved"`/`"FutureOnly"` are RESERVED for a future,
 * separate, explicitly-reviewed stage where each becomes a distinct,
 * meaningful blocker in its own right.
 */
export type FedosRustExecutionReviewReason =
  | "BlockedBeforeCrypto" // the only reason this stage's implementation ever produces
  | "RuntimeNotActivated" // RESERVED — never produced in this stage
  | "WorkerNotActivated" // RESERVED — never produced in this stage
  | "RustExecutionNotApproved" // RESERVED — never produced in this stage
  | "FutureOnly"; // RESERVED — never produced in this stage

/** Every `FedosRustExecutionReviewReason`, for validation/documentation helpers. */
export const FEDOS_RUST_EXECUTION_REVIEW_REASONS: readonly FedosRustExecutionReviewReason[] = [
  "BlockedBeforeCrypto",
  "RuntimeNotActivated",
  "WorkerNotActivated",
  "RustExecutionNotApproved",
  "FutureOnly",
];

/** The result of a `FedosRustExecutionReview.reviewEncrypt()`/`reviewDecrypt()` call. `approved` is always `false` in this stage. */
export interface FedosRustExecutionReviewDecision {
  readonly operation: "encrypt" | "decrypt";
  readonly approved: boolean;
  readonly reason: FedosRustExecutionReviewReason;
}

/**
 * The Provider-internal, final Execution Review boundary. Receives a
 * `FedosOpaqueRequest` and returns a decision — never invokes
 * `packages/fedos-core-rust`, WASM, or FFI. `FedosRustExecutionReviewPlaceholder`
 * is the one implementation this stage provides.
 */
export interface FedosRustExecutionReview {
  status(): FedosRustExecutionReviewStatus;
  reviewEncrypt(request: OpaqueEncryptRequest): FedosRustExecutionReviewDecision;
  reviewDecrypt(request: OpaqueDecryptRequest): FedosRustExecutionReviewDecision;
}

/**
 * The placeholder `FedosRustExecutionReview` — always denies, never
 * executes. Constructing an instance does nothing: no core loaded, no
 * handle resolved, no byte touched.
 */
export class FedosRustExecutionReviewPlaceholder implements FedosRustExecutionReview {
  constructor() {
    // Does nothing: no core loaded, no handle resolved, no byte touched.
  }

  status(): FedosRustExecutionReviewStatus {
    return {
      state: "Blocked",
      reason: "FedOS Rust execution review has not approved any execution in this stage",
    };
  }

  reviewEncrypt(_request: OpaqueEncryptRequest): FedosRustExecutionReviewDecision {
    this.#planInternalRustCall("Encrypt"); // constructed and discarded — never executed
    return this.#blocked("encrypt");
  }

  reviewDecrypt(_request: OpaqueDecryptRequest): FedosRustExecutionReviewDecision {
    this.#planInternalRustCall("Decrypt"); // constructed and discarded — never executed
    return this.#blocked("decrypt");
  }

  /**
   * PRIVATE — plans (but never executes) a `FedosInternalRustCall` for
   * `kind`. The evaluated decision is discarded; it never changes this
   * review's own, unchanged `"BlockedBeforeCrypto"` answer.
   */
  #planInternalRustCall(kind: "Encrypt" | "Decrypt"): void {
    const call = planFedosInternalRustCall(kind);
    evaluateFedosInternalRustCall(call); // always "Planned"; result not otherwise used
  }

  #blocked(operation: "encrypt" | "decrypt"): FedosRustExecutionReviewDecision {
    return {
      operation,
      approved: false,
      reason: "BlockedBeforeCrypto",
    };
  }
}

/**
 * Build a `FedosRustExecutionReview`. `FedosRustApi` (Stage 346) is the
 * ONLY caller of this function in this repository. Pure; never throws.
 */
export function createFedosRustExecutionReview(): FedosRustExecutionReview {
  return new FedosRustExecutionReviewPlaceholder();
}

/**
 * Pure, standalone: the Execution Review's own
 * `FedosRustExecutionReviewState` — usable by diagnostics WITHOUT
 * constructing a `FedosRustExecutionReview` instance (Stage 349). Fixed
 * `"Blocked"` in this stage, mirroring
 * `FedosRustExecutionReviewPlaceholder.status()` exactly.
 */
export function fedosRustExecutionReviewState(): FedosRustExecutionReviewState {
  return "Blocked";
}

/**
 * Pure, standalone: WHY execution has not (yet) been approved — usable
 * WITHOUT constructing an instance. Fixed `"BlockedBeforeCrypto"` in
 * this stage.
 */
export function fedosRustExecutionReviewReason(): FedosRustExecutionReviewReason {
  return "BlockedBeforeCrypto";
}

/**
 * Pure, standalone: whether real Rust execution has been approved.
 * Fixed `false` in this stage — no parameter or override anywhere can
 * flip it.
 */
export function fedosRustExecutionApproved(): boolean {
  return false;
}

/**
 * Route a `FedosOpaqueRequest` to the matching
 * `reviewEncrypt`/`reviewDecrypt` method. Pure; never throws; never
 * mutates `request`.
 */
export function reviewFedosRustExecution(
  review: FedosRustExecutionReview,
  request: FedosOpaqueRequest,
): FedosRustExecutionReviewDecision {
  if (request.operation === "encrypt") {
    return review.reviewEncrypt(request);
  }
  return review.reviewDecrypt(request);
}
