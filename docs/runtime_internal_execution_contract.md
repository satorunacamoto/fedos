# FedOS internal execution contract (Stage 356)

**Status: this document records real code's current state.** It names
the required preconditions for real FedOS Rust crypto execution to
ever happen, in the order the internal chain actually evaluates them,
and states which links exist today and which remain disconnected.

## The contract

Real Rust crypto execution requires ALL of the following, in order:

| # | Link | Exists today? | File |
|---|---|---|---|
| 1 | Dual Lock (`FEDOS_CRYPTO_PROVIDER`/`FEDOS_CRYPTO_ENABLED`) | ✅ Yes | `docs/runtime_crypto_activation_policy.md` |
| 2 | Provider (`FedosRuntimeCryptoProvider`) | ✅ Yes | `src/runtime/fedos_runtime_crypto_provider.ts` |
| 3 | Opaque API (`FedosOpaqueApi`) | ✅ Yes | `src/runtime/fedos_opaque_api.ts` |
| 4 | Rust Boundary (`FedosRustBoundary`) | ✅ Yes | `src/runtime/fedos_rust_boundary.ts` |
| 5 | Rust API (`FedosRustApi`) | ✅ Yes | `src/runtime/fedos_rust_api.ts` |
| 6 | Execution Review (`FedosRustExecutionReview`) | ✅ Yes | `src/runtime/fedos_rust_execution_review.ts` |
| 7 | Internal Rust Call (`FedosInternalRustCall`) | ✅ Yes (PLANNED ONLY) | `src/runtime/fedos_internal_rust_call.ts` |
| 8 | Rust Crypto (`packages/fedos-core-rust`'s `fedos_encrypt`/`fedos_decrypt`) | ❌ **Disconnected** | Not called from any file in links 1–7 |

**Only the first seven links exist. Rust Crypto remains disconnected.**
There is no function, import, or code path anywhere in this repository
connecting link 7 to link 8.

## What "exists" means for each link

Links 1–7 each satisfy the SAME three properties:

1. **Typed and tested** — every link has its own `FedosXxxStatus`/
   `FedosXxxDecision` types, a placeholder implementation, and a
   dedicated guard test suite (`test/runtime_fedos_*.test.ts`).
2. **Wired to the next link** — each link's placeholder implementation
   constructs the NEXT link, routes to it, and discards its result,
   ALWAYS returning its own unchanged, fixed denial.
3. **Never invokes anything beyond the chain** — no link imports
   `packages/fedos-core-rust`, WASM, or FFI; `AppRuntime`/
   `create_runtime.ts` and `src/worker.ts` import NONE of these files.

Link 8 satisfies NONE of these from the TypeScript side — it is a REAL,
independently-tested Rust `pub fn` pair
(`packages/fedos-core-rust/src/lib.rs`), but nothing in
`src/runtime/` calls it.

## Why the contract stops here

Each of links 1–7 is a STRUCTURAL precondition — the shape exists. Link
8 additionally requires THREE separate PERMISSIONS
(`docs/runtime_fedos_execution_approval_checklist.md` items 6–8):
execution review approval, Runtime activation approval, and Worker
activation approval. None of the three can be granted by adding more
structure to links 1–7 — each is its own, future, explicitly-reviewed
stage's decision.

## Still true after this stage

- No Rust crypto execution, no WASM, no FFI, anywhere in the chain.
- No Runtime activation, no Worker activation.
- `encrypt()`/`decrypt()` STILL always resolve `"Unsupported"`.
- `evaluateRuntimeCryptoActivation`/`evaluateWorkerCryptoActivation`
  STILL never return `"Allowed"`.
- `FedosInternalRustCall` is planned only, never executed
  (`fedosInternalRustCallExecuted()` fixed `false`).

## See also

- `docs/runtime_internal_rust_call.md` (Stage 353–360) — the
  specification for what link 8 would eventually need, without
  implementing it.
- `docs/runtime_fedos_execution_approval_checklist.md` (Stage 348) —
  the eight-item approval checklist this contract's "why it stops
  here" section references.
