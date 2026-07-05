/**
 * Stage 313 — FedOS Runtime Internal Operation Model (definitions only).
 *
 * The FIRST link in `FedosRuntimeCryptoProvider`'s (`src/runtime/fedos_runtime_crypto_provider.ts`)
 * internal execution chain — a plan of what an `encrypt`/`decrypt` call
 * would attempt, modeled as plain data, with NO connection to anything
 * that could actually run it.
 *
 * COMPLETE EXECUTION FLOW (this stage stops at step 2; see
 * `docs/runtime_fedos_provider_execution.md` for the full diagram):
 *
 * ```
 * 1. FedosRuntimeCryptoProvider         (the boundary a caller sees)
 *      |
 *      v
 * 2. FedosRuntimeOperation               <-- THIS FILE
 *      |
 *      v
 * 3. Opaque Request                      (src/runtime/fedos_runtime_opaque_request.ts, Stage 314)
 *      |
 *      v
 * 4. (Not Yet Connected)                 (Stage 315 — execution terminates here)
 *      |
 *      v
 * 5. FedOS / packages/fedos-core-rust    (NOT reachable from this repository's
 *      |                                  TypeScript today)
 *      v
 * 6. Internal Crypto (NIP-44 wire, etc.)
 * ```
 *
 * HARD GUARDRAILS:
 *   - Every type/function here is PLAIN DATA and PURE FUNCTIONS — no
 *     `packages/fedos-core-rust` import, no WASM, no FFI, no
 *     `AppRuntime`/`src/worker.ts` import, no network/storage/Relay/Nostr
 *     reference of any kind.
 *   - `evaluateFedosRuntimeOperation` ALWAYS resolves `"Blocked"` — the
 *     `"Completed"` label exists in `FedosRuntimeOperationStatus` only as
 *     a RESERVED value for a future, separate, explicitly-reviewed
 *     stage; nothing in this file can ever produce it.
 *   - No secret, key, plaintext, or ciphertext byte — `FedosRuntimeOperation`
 *     carries only a `kind` label (`"encrypt"`/`"decrypt"`).
 *   - This module is imported BY `fedos_runtime_crypto_provider.ts`
 *     (Stage 315), never the other way — no import cycle.
 */

/** Which capability a `FedosRuntimeOperation` represents. */
export type FedosRuntimeOperationKind = "encrypt" | "decrypt";

/** A planned operation — plain data, carries no request material of any kind. */
export interface FedosRuntimeOperation {
  readonly kind: FedosRuntimeOperationKind;
}

/**
 * Coarse status of a `FedosRuntimeOperation`. `"Blocked"` is the ONLY
 * value `evaluateFedosRuntimeOperation` produces in this stage;
 * `"Completed"` is RESERVED — mirroring this codebase's existing
 * "Allowed"/"FutureFeature"/"Enabled" reserved-label precedent
 * (`src/runtime/runtime_crypto_activation_policy.ts`,
 * `src/runtime/runtime_crypto_diagnostics.ts`).
 */
export type FedosRuntimeOperationStatus = "Blocked" | "Completed";

/** The result of evaluating a `FedosRuntimeOperation`. `reason` is non-sensitive and human-readable. */
export interface FedosRuntimeOperationDecision {
  readonly operation: FedosRuntimeOperation;
  readonly status: FedosRuntimeOperationStatus;
  readonly reason: string;
}

/** Plan a `FedosRuntimeOperation` for the given kind. Pure; never throws. */
export function planFedosRuntimeOperation(
  kind: FedosRuntimeOperationKind,
): FedosRuntimeOperation {
  return { kind };
}

/**
 * Evaluate a planned `FedosRuntimeOperation`. ALWAYS resolves `"Blocked"`
 * in this stage — there is no code path in this file that could ever
 * produce `"Completed"`. Pure; never throws; never mutates `operation`.
 */
export function evaluateFedosRuntimeOperation(
  operation: FedosRuntimeOperation,
): FedosRuntimeOperationDecision {
  return {
    operation,
    status: "Blocked",
    reason: `FedOS runtime ${operation.kind} operation is blocked before reaching any crypto pipeline`,
  };
}
