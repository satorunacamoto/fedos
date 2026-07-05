/**
 * Stage 321 — FedOS Opaque API Abstraction (Provider-internal only).
 *
 * The FOURTH link in `FedosRuntimeCryptoProvider`'s internal execution
 * chain — `Provider → Operation (fedos_runtime_operation.ts, Stage 313)
 * → Opaque Request (fedos_runtime_opaque_request.ts, Stage 314) →
 * Opaque API (THIS FILE) → STOP`. This is the boundary a future,
 * separate, explicitly-reviewed stage would eventually connect to
 * `packages/fedos-core-rust` — but THIS stage's `FedosOpaqueApi`
 * implementation never does.
 *
 * "Internal only" means: this module is imported ONLY by
 * `fedos_runtime_crypto_provider.ts` (Stage 322) — never by
 * `AppRuntime`/`create_runtime.ts`, never by `src/worker.ts`, never
 * re-exported through any public boundary. Every export here exists
 * for that ONE caller plus this codebase's own test suite (the
 * established "export for testability, wire nowhere" discipline
 * already used throughout `src/runtime/fedos_runtime_operation.ts`/
 * `fedos_runtime_opaque_request.ts`).
 *
 * Stage 323 implements the placeholder handlers: `planEncrypt()`/
 * `planDecrypt()` on `FedosOpaqueApiPlaceholder`. BOTH ALWAYS resolve
 * `"BlockedByImplementation"` — no ciphertext, no plaintext, no
 * `SecretHandle`, no `ConversationKey`, no `MessageKey`, ever.
 *
 * HARD GUARDRAILS:
 *   - `FedosOpaqueApiPlaceholder` NEVER invokes `packages/fedos-core-rust`
 *     (Rust crate or TS package boundary), never WASM, never FFI. It
 *     simply RECEIVES a `FedosOpaqueRequest` and returns a decision —
 *     no crypto execution of any kind.
 *   - NO `SecretHandle`, `ConversationKey`, `MessageKey`, or
 *     `Nip44WirePayload` type or value (all `pub(crate)`-private inside
 *     `packages/fedos-core-rust`, never exposed to TypeScript) is
 *     imported, referenced, or constructed anywhere in this file.
 *   - `planEncrypt()`/`planDecrypt()` ALWAYS resolve `"BlockedByImplementation"`
 *     in this stage — `"ReadyForRust"` exists in `FedosOpaqueApiState`
 *     only as a RESERVED label for a future, separate,
 *     explicitly-reviewed stage; nothing in this file can ever produce
 *     it.
 *   - No `process.env`/`RuntimeEnv` reference. No network/storage/Relay/
 *     Nostr/NIP-17 reference.
 *   - Pure; every method here is synchronous, never throws, never
 *     mutates its argument.
 *
 * Stage 330 extends `FedosOpaqueApiPlaceholder.planEncrypt()`/
 * `planDecrypt()` with a FIFTH link: each now builds a
 * `FedosRustBoundary` (`fedos_rust_boundary.ts`, Stage 329) and routes
 * the request to it via `planFedosRustBoundaryExecution` — then
 * DISCARDS the boundary's own decision and returns its OWN, unchanged
 * `"BlockedByImplementation"` answer. The Rust Boundary itself never
 * invokes `packages/fedos-core-rust`/WASM/FFI; the request terminates
 * immediately upon reaching it.
 */

import { createFedosRustBoundary, planFedosRustBoundaryExecution } from "./fedos_rust_boundary.js";
import type { FedosOpaqueRequest, OpaqueDecryptRequest, OpaqueEncryptRequest } from "./fedos_runtime_opaque_request.js";

/**
 * Coarse status of the Opaque API abstraction itself. `"NotConnected"`
 * is the ONLY value this stage's implementation produces — mirroring
 * `RuntimeCryptoState`'s own `"NotConnected"` precedent
 * (`src/runtime/crypto_provider.ts`).
 */
export type FedosOpaqueApiState = "NotConnected";

/** A non-sensitive snapshot of a `FedosOpaqueApi`. `reason` is human-readable and non-sensitive. */
export interface FedosOpaqueApiStatus {
  readonly state: FedosOpaqueApiState;
  readonly reason: string;
}

/**
 * The outcome of `FedosOpaqueApi.planEncrypt()`/`planDecrypt()`.
 * `"BlockedByImplementation"` is the ONLY value this stage's
 * implementation ever produces; `"ReadyForRust"` is RESERVED.
 */
export type FedosOpaqueApiDecisionState = "BlockedByImplementation" | "ReadyForRust";

/** The result of a `FedosOpaqueApi.planEncrypt()`/`planDecrypt()` call. No ciphertext/plaintext/secret material of any kind. */
export interface FedosOpaqueApiDecision {
  readonly operation: "encrypt" | "decrypt";
  readonly state: FedosOpaqueApiDecisionState;
  readonly reason: string;
}

/**
 * The Provider-internal Opaque API boundary. Receives a
 * `FedosOpaqueRequest` and returns a decision — never invokes
 * `packages/fedos-core-rust`, WASM, or FFI. `FedosOpaqueApiPlaceholder`
 * is the one implementation this stage provides.
 */
export interface FedosOpaqueApi {
  status(): FedosOpaqueApiStatus;
  planEncrypt(request: OpaqueEncryptRequest): FedosOpaqueApiDecision;
  planDecrypt(request: OpaqueDecryptRequest): FedosOpaqueApiDecision;
}

/**
 * The placeholder `FedosOpaqueApi` — always denies, never executes.
 * Constructing an instance does nothing: no core loaded, no handle
 * resolved, no byte touched.
 */
export class FedosOpaqueApiPlaceholder implements FedosOpaqueApi {
  constructor() {
    // Does nothing: no core loaded, no handle resolved, no byte touched.
  }

  status(): FedosOpaqueApiStatus {
    return {
      state: "NotConnected",
      reason: "FedOS opaque API is not connected to any real core",
    };
  }

  planEncrypt(request: OpaqueEncryptRequest): FedosOpaqueApiDecision {
    this.#reachRustBoundary(request); // result discarded — request terminates at the Rust Boundary
    return this.#blocked("encrypt");
  }

  planDecrypt(request: OpaqueDecryptRequest): FedosOpaqueApiDecision {
    this.#reachRustBoundary(request); // result discarded — request terminates at the Rust Boundary
    return this.#blocked("decrypt");
  }

  /**
   * PRIVATE — builds a `FedosRustBoundary` and routes `request` to it.
   * The boundary's own decision is discarded; it is never passed to
   * `packages/fedos-core-rust`/WASM/FFI, never passed to Runtime or
   * Worker. The Rust Boundary itself never invokes any of those either.
   */
  #reachRustBoundary(request: OpaqueEncryptRequest | OpaqueDecryptRequest): void {
    const boundary = createFedosRustBoundary();
    planFedosRustBoundaryExecution(boundary, request);
  }

  #blocked(operation: "encrypt" | "decrypt"): FedosOpaqueApiDecision {
    return {
      operation,
      state: "BlockedByImplementation",
      reason: `FedOS opaque API does not perform ${operation} in this stage: no Rust wiring exists yet`,
    };
  }
}

/**
 * Build a `FedosOpaqueApi`. `FedosRuntimeCryptoProvider` (Stage 322) is
 * the ONLY caller of this function in this repository. Pure; never
 * throws.
 */
export function createFedosOpaqueApi(): FedosOpaqueApi {
  return new FedosOpaqueApiPlaceholder();
}

/**
 * Pure, standalone: the Opaque API's own `FedosOpaqueApiState` — usable
 * by diagnostics WITHOUT constructing a `FedosOpaqueApi` instance (Stage
 * 325). Fixed `"NotConnected"` in this stage, mirroring
 * `FedosOpaqueApiPlaceholder.status()` exactly.
 */
export function fedosOpaqueApiState(): FedosOpaqueApiState {
  return "NotConnected";
}

/**
 * Route a `FedosOpaqueRequest` to the matching `planEncrypt`/`planDecrypt`
 * method. Pure; never throws; never mutates `request`.
 */
export function planFedosOpaqueApiExecution(
  api: FedosOpaqueApi,
  request: FedosOpaqueRequest,
): FedosOpaqueApiDecision {
  if (request.operation === "encrypt") {
    return api.planEncrypt(request);
  }
  return api.planDecrypt(request);
}
