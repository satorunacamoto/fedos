/**
 * Stage 329 — FedOS Rust Boundary Model (Provider-internal only).
 *
 * The FIFTH link in `FedosRuntimeCryptoProvider`'s internal execution
 * chain — `Provider → Operation (fedos_runtime_operation.ts, Stage 313)
 * → Opaque Request (fedos_runtime_opaque_request.ts, Stage 314) →
 * Opaque API (fedos_opaque_api.ts, Stage 321) → Rust Boundary (THIS
 * FILE) → STOP`. This is the boundary a future, separate,
 * explicitly-reviewed stage would eventually connect to
 * `packages/fedos-core-rust` — but THIS stage's `FedosRustBoundary`
 * implementation never does.
 *
 * "Internal only" means: this module is imported ONLY by
 * `fedos_opaque_api.ts` (Stage 330) — never by `AppRuntime`/
 * `create_runtime.ts`, never by `src/worker.ts`, never re-exported
 * through any public boundary. Every export here exists for that ONE
 * caller plus this codebase's own test suite (the established "export
 * for testability, wire nowhere" discipline already used throughout
 * `fedos_runtime_operation.ts`/`fedos_runtime_opaque_request.ts`/
 * `fedos_opaque_api.ts`).
 *
 * Stage 331 implements the placeholder handlers: `planRustEncrypt()`/
 * `planRustDecrypt()` on `FedosRustBoundaryPlaceholder`. BOTH ALWAYS
 * resolve `"BlockedByImplementation"` — no crypto, no Rust call, no
 * payload processing, no plaintext, no ciphertext, ever.
 *
 * HARD GUARDRAILS:
 *   - `FedosRustBoundaryPlaceholder` NEVER invokes
 *     `packages/fedos-core-rust` (Rust crate or TS package boundary),
 *     never WASM, never FFI, never any cryptographic operation of any
 *     kind. It simply RECEIVES a `FedosOpaqueRequest` and returns a
 *     decision — the request terminates immediately.
 *   - NO `SecretHandle`, `ConversationKey`, `MessageKey`, or
 *     `Nip44WirePayload` type or value (all `pub(crate)`-private inside
 *     `packages/fedos-core-rust`, never exposed to TypeScript) is
 *     imported, referenced, or constructed anywhere in this file.
 *   - `planRustEncrypt()`/`planRustDecrypt()` ALWAYS resolve
 *     `"BlockedByImplementation"` in this stage — `"ReadyForRustCrypto"`
 *     exists in `FedosRustBoundaryDecisionState` only as a RESERVED
 *     label for a future, separate, explicitly-reviewed stage; nothing
 *     in this file can ever produce it.
 *   - No `process.env`/`RuntimeEnv` reference. No network/storage/Relay/
 *     Nostr/NIP-17 reference.
 *   - Pure; every method here is synchronous, never throws, never
 *     mutates its argument.
 */

import type { FedosOpaqueRequest, OpaqueDecryptRequest, OpaqueEncryptRequest } from "./fedos_runtime_opaque_request.js";

/**
 * Coarse status of the Rust Boundary abstraction itself.
 * `"NotConnected"` is the ONLY value this stage's implementation
 * produces — mirroring `FedosOpaqueApiState`'s own `"NotConnected"`
 * precedent (`src/runtime/fedos_opaque_api.ts`).
 */
export type FedosRustBoundaryState = "NotConnected";

/** A non-sensitive snapshot of a `FedosRustBoundary`. `reason` is human-readable and non-sensitive. */
export interface FedosRustBoundaryStatus {
  readonly state: FedosRustBoundaryState;
  readonly reason: string;
}

/**
 * The outcome of `FedosRustBoundary.planRustEncrypt()`/`planRustDecrypt()`.
 * `"BlockedByImplementation"` is the ONLY value this stage's
 * implementation ever produces; `"ReadyForRustCrypto"` is RESERVED.
 */
export type FedosRustBoundaryDecisionState = "BlockedByImplementation" | "ReadyForRustCrypto";

/** The result of a `FedosRustBoundary.planRustEncrypt()`/`planRustDecrypt()` call. No ciphertext/plaintext/secret material of any kind. */
export interface FedosRustBoundaryDecision {
  readonly operation: "encrypt" | "decrypt";
  readonly state: FedosRustBoundaryDecisionState;
  readonly reason: string;
}

/**
 * The Provider-internal Rust Boundary. Receives a `FedosOpaqueRequest`
 * and returns a decision — never invokes `packages/fedos-core-rust`,
 * WASM, or FFI. `FedosRustBoundaryPlaceholder` is the one implementation
 * this stage provides.
 */
export interface FedosRustBoundary {
  status(): FedosRustBoundaryStatus;
  planRustEncrypt(request: OpaqueEncryptRequest): FedosRustBoundaryDecision;
  planRustDecrypt(request: OpaqueDecryptRequest): FedosRustBoundaryDecision;
}

/**
 * The placeholder `FedosRustBoundary` — always denies, never executes.
 * Constructing an instance does nothing: no core loaded, no handle
 * resolved, no byte touched.
 */
export class FedosRustBoundaryPlaceholder implements FedosRustBoundary {
  constructor() {
    // Does nothing: no core loaded, no handle resolved, no byte touched.
  }

  status(): FedosRustBoundaryStatus {
    return {
      state: "NotConnected",
      reason: "FedOS Rust boundary is not connected to any real core",
    };
  }

  planRustEncrypt(_request: OpaqueEncryptRequest): FedosRustBoundaryDecision {
    return this.#blocked("encrypt");
  }

  planRustDecrypt(_request: OpaqueDecryptRequest): FedosRustBoundaryDecision {
    return this.#blocked("decrypt");
  }

  #blocked(operation: "encrypt" | "decrypt"): FedosRustBoundaryDecision {
    return {
      operation,
      state: "BlockedByImplementation",
      reason: `FedOS Rust boundary does not perform ${operation} in this stage: no Rust crypto wiring exists yet`,
    };
  }
}

/**
 * Build a `FedosRustBoundary`. `FedosOpaqueApi` (Stage 330) is the ONLY
 * caller of this function in this repository. Pure; never throws.
 */
export function createFedosRustBoundary(): FedosRustBoundary {
  return new FedosRustBoundaryPlaceholder();
}

/**
 * Pure, standalone: the Rust Boundary's own `FedosRustBoundaryState` —
 * usable by diagnostics WITHOUT constructing a `FedosRustBoundary`
 * instance (Stage 333). Fixed `"NotConnected"` in this stage, mirroring
 * `FedosRustBoundaryPlaceholder.status()` exactly.
 */
export function fedosRustBoundaryState(): FedosRustBoundaryState {
  return "NotConnected";
}

/**
 * Pure, standalone: whether the Rust Boundary is structurally reachable
 * from the Opaque API's own internal chain (Stage 330 wires it) — NOT
 * whether real Rust crypto executes. Fixed `true` in this stage: the
 * code path exists and is called, but every call still resolves
 * `"BlockedByImplementation"`.
 */
export function fedosRustBoundaryReachable(): boolean {
  return true;
}

/**
 * Route a `FedosOpaqueRequest` to the matching
 * `planRustEncrypt`/`planRustDecrypt` method. Pure; never throws; never
 * mutates `request`.
 */
export function planFedosRustBoundaryExecution(
  boundary: FedosRustBoundary,
  request: FedosOpaqueRequest,
): FedosRustBoundaryDecision {
  if (request.operation === "encrypt") {
    return boundary.planRustEncrypt(request);
  }
  return boundary.planRustDecrypt(request);
}
