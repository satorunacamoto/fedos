/**
 * Stage 337 — FedOS Rust API Abstraction (Provider-internal only).
 *
 * The SIXTH link in `FedosRuntimeCryptoProvider`'s internal execution
 * chain — `Provider → Operation (fedos_runtime_operation.ts, Stage 313)
 * → Opaque Request (fedos_runtime_opaque_request.ts, Stage 314) →
 * Opaque API (fedos_opaque_api.ts, Stage 321) → Rust Boundary
 * (fedos_rust_boundary.ts, Stage 329) → Rust API (THIS FILE) → STOP`.
 * This is the ONE seam a future, separate, explicitly-reviewed stage
 * would eventually connect to `packages/fedos-core-rust`'s real
 * functions — but THIS stage's `FedosRustApi` implementation never
 * does.
 *
 * "Internal only" means: this module is imported ONLY by
 * `fedos_rust_boundary.ts` (Stage 338) — never by `AppRuntime`/
 * `create_runtime.ts`, never by `src/worker.ts`, never re-exported
 * through any public boundary. Every export here exists for that ONE
 * caller plus this codebase's own test suite (the established "export
 * for testability, wire nowhere" discipline already used throughout
 * `fedos_runtime_operation.ts`/`fedos_runtime_opaque_request.ts`/
 * `fedos_opaque_api.ts`/`fedos_rust_boundary.ts`).
 *
 * Stage 339 implements the placeholder handlers: `planRustApiEncrypt()`/
 * `planRustApiDecrypt()` on `FedosRustApiPlaceholder`. BOTH ALWAYS
 * resolve `"BlockedByImplementation"` — no payload, no plaintext, no
 * ciphertext, no key material, ever.
 *
 * HARD GUARDRAILS:
 *   - `FedosRustApiPlaceholder` NEVER invokes `packages/fedos-core-rust`
 *     (Rust crate or TS package boundary), never WASM, never FFI, never
 *     any cryptographic operation of any kind. It simply RECEIVES a
 *     `FedosOpaqueRequest` and returns a decision — execution stops
 *     immediately before the actual Rust implementation.
 *   - NO `SecretHandle`, `ConversationKey`, `MessageKey`, or
 *     `Nip44WirePayload` type or value (all `pub(crate)`-private inside
 *     `packages/fedos-core-rust`, never exposed to TypeScript) is
 *     imported, referenced, or constructed anywhere in this file.
 *   - `planRustApiEncrypt()`/`planRustApiDecrypt()` ALWAYS resolve
 *     `"BlockedByImplementation"` in this stage — `"ReadyForRustCall"`
 *     exists in `FedosRustApiDecisionState` only as a RESERVED label for
 *     a future, separate, explicitly-reviewed stage; nothing in this
 *     file can ever produce it.
 *   - No `process.env`/`RuntimeEnv` reference. No network/storage/Relay/
 *     Nostr/NIP-17 reference.
 *   - Pure; every method here is synchronous, never throws, never
 *     mutates its argument.
 *
 * Stage 346 extends `FedosRustApiPlaceholder.planRustApiEncrypt()`/
 * `planRustApiDecrypt()` with a SEVENTH link: each now builds a
 * `FedosRustExecutionReview` (`fedos_rust_execution_review.ts`, Stage
 * 345) and routes the request to it via `reviewFedosRustExecution` —
 * then DISCARDS the review's own decision and returns its OWN,
 * unchanged `"BlockedByImplementation"` answer. The Execution Review
 * itself never invokes `packages/fedos-core-rust`/WASM/FFI; it is the
 * LAST stop before any real Rust crypto invocation.
 */

import { createFedosRustExecutionReview, reviewFedosRustExecution } from "./fedos_rust_execution_review.js";
import type { FedosOpaqueRequest, OpaqueDecryptRequest, OpaqueEncryptRequest } from "./fedos_runtime_opaque_request.js";

/**
 * Coarse status of the Rust API abstraction itself. `"NotConnected"`
 * is the ONLY value this stage's implementation produces — mirroring
 * `FedosRustBoundaryState`'s own `"NotConnected"` precedent
 * (`src/runtime/fedos_rust_boundary.ts`).
 */
export type FedosRustApiState = "NotConnected";

/** A non-sensitive snapshot of a `FedosRustApi`. `reason` is human-readable and non-sensitive. */
export interface FedosRustApiStatus {
  readonly state: FedosRustApiState;
  readonly reason: string;
}

/**
 * The outcome of `FedosRustApi.planRustApiEncrypt()`/`planRustApiDecrypt()`.
 * `"BlockedByImplementation"` is the ONLY value this stage's
 * implementation ever produces; `"ReadyForRustCall"` is RESERVED.
 */
export type FedosRustApiDecisionState = "BlockedByImplementation" | "ReadyForRustCall";

/** The result of a `FedosRustApi.planRustApiEncrypt()`/`planRustApiDecrypt()` call. No ciphertext/plaintext/key material of any kind. */
export interface FedosRustApiDecision {
  readonly operation: "encrypt" | "decrypt";
  readonly state: FedosRustApiDecisionState;
  readonly reason: string;
}

/**
 * The Provider-internal Rust API seam. Receives a `FedosOpaqueRequest`
 * and returns a decision — never invokes `packages/fedos-core-rust`,
 * WASM, or FFI. `FedosRustApiPlaceholder` is the one implementation
 * this stage provides.
 */
export interface FedosRustApi {
  status(): FedosRustApiStatus;
  planRustApiEncrypt(request: OpaqueEncryptRequest): FedosRustApiDecision;
  planRustApiDecrypt(request: OpaqueDecryptRequest): FedosRustApiDecision;
}

/**
 * The placeholder `FedosRustApi` — always denies, never executes.
 * Constructing an instance does nothing: no core loaded, no handle
 * resolved, no byte touched.
 */
export class FedosRustApiPlaceholder implements FedosRustApi {
  constructor() {
    // Does nothing: no core loaded, no handle resolved, no byte touched.
  }

  status(): FedosRustApiStatus {
    return {
      state: "NotConnected",
      reason: "FedOS Rust API is not connected to any real core",
    };
  }

  planRustApiEncrypt(request: OpaqueEncryptRequest): FedosRustApiDecision {
    this.#reachExecutionReview(request); // result discarded — request terminates at the Execution Review
    return this.#blocked("encrypt");
  }

  planRustApiDecrypt(request: OpaqueDecryptRequest): FedosRustApiDecision {
    this.#reachExecutionReview(request); // result discarded — request terminates at the Execution Review
    return this.#blocked("decrypt");
  }

  /**
   * PRIVATE — builds a `FedosRustExecutionReview` and routes `request`
   * to it. The review's own decision is discarded; it is never passed
   * to `packages/fedos-core-rust`/WASM/FFI, never passed to Runtime or
   * Worker. The Execution Review itself never invokes any of those
   * either.
   */
  #reachExecutionReview(request: OpaqueEncryptRequest | OpaqueDecryptRequest): void {
    const review = createFedosRustExecutionReview();
    reviewFedosRustExecution(review, request);
  }

  #blocked(operation: "encrypt" | "decrypt"): FedosRustApiDecision {
    return {
      operation,
      state: "BlockedByImplementation",
      reason: `FedOS Rust API does not perform ${operation} in this stage: execution stops before the actual Rust implementation`,
    };
  }
}

/**
 * Build a `FedosRustApi`. `FedosRustBoundary` (Stage 338) is the ONLY
 * caller of this function in this repository. Pure; never throws.
 */
export function createFedosRustApi(): FedosRustApi {
  return new FedosRustApiPlaceholder();
}

/**
 * Pure, standalone: the Rust API's own `FedosRustApiState` — usable by
 * diagnostics WITHOUT constructing a `FedosRustApi` instance (Stage
 * 341). Fixed `"NotConnected"` in this stage, mirroring
 * `FedosRustApiPlaceholder.status()` exactly.
 */
export function fedosRustApiState(): FedosRustApiState {
  return "NotConnected";
}

/**
 * Pure, standalone: whether the Rust API is structurally reachable
 * from the Rust Boundary's own internal chain (Stage 338 wires it) —
 * NOT whether real Rust crypto executes. Fixed `true` in this stage:
 * the code path exists and is called, but every call still resolves
 * `"BlockedByImplementation"`.
 */
export function fedosRustApiReachable(): boolean {
  return true;
}

/**
 * Route a `FedosOpaqueRequest` to the matching
 * `planRustApiEncrypt`/`planRustApiDecrypt` method. Pure; never throws;
 * never mutates `request`.
 */
export function planFedosRustApiExecution(
  api: FedosRustApi,
  request: FedosOpaqueRequest,
): FedosRustApiDecision {
  if (request.operation === "encrypt") {
    return api.planRustApiEncrypt(request);
  }
  return api.planRustApiDecrypt(request);
}
