/**
 * The plain-data SHAPE of a `FedosInternalRustCall` (`./fedos_internal_rust_call.ts`,
 * Stage 353) — split into its own leaf file so `fedos_rust_invocation_adapter.ts`
 * (Stage 361), which needs this type for its own `planEncrypt()`/
 * `planDecrypt()`/`planFedosRustInvocationAdapterExecution()` signatures,
 * can depend on it WITHOUT depending on `fedos_internal_rust_call.ts`
 * itself — `fedos_internal_rust_call.ts` is the file that CALLS INTO the
 * Invocation Adapter (a real, value-level edge), so the type it hands the
 * Adapter cannot keep living there without closing a cycle.
 *
 * Nostr Consolidation Plan, Step 5 / architecture cycle detector baseline
 * reduction (`docs/architecture/NOSTR-CONSOLIDATION-PLAN.md`,
 * `test/architecture_cycle_detector.test.ts`) — this extraction is a
 * dedicated, single-purpose type module (never a mega-types dumping
 * ground): it holds exactly the two declarations `fedos_internal_rust_call.ts`
 * used to own directly, `FedosInternalRustCallKind` and
 * `FedosInternalRustCall` itself, and nothing else — every other export
 * (`FedosInternalRustCallStatus`, `FedosInternalRustCallDecision`,
 * `planFedosInternalRustCall`, `evaluateFedosInternalRustCall`, the
 * diagnostics helpers) stays exactly where it was.
 * `fedos_internal_rust_call.ts` re-exports both names from here
 * unchanged, so its own existing consumer (`fedos_rust_execution_review.ts`)
 * needed no change.
 *
 * HARD GUARDRAILS (unchanged from `fedos_internal_rust_call.ts`'s own,
 * carried forward verbatim for the two declarations that moved):
 *   - `FedosInternalRustCall` is PLAIN DATA — a `kind` label only, never
 *     a request, never a handle, never a byte of any kind.
 *   - This file defines TYPES ONLY — no function, no class, no runtime
 *     behavior of any kind.
 *   - NO `SecretHandle`, `ConversationKey`, `MessageKey`, or
 *     `Nip44WirePayload` type or value is imported, referenced, or
 *     constructed anywhere in this file.
 */

/** Which Rust operation a `FedosInternalRustCall` represents. */
export type FedosInternalRustCallKind = "Encrypt" | "Decrypt";

/** A planned internal Rust call — plain data, carries no request material of any kind. */
export interface FedosInternalRustCall {
  readonly kind: FedosInternalRustCallKind;
}
