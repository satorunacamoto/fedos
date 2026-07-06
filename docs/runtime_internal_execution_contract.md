# FedOS internal execution contract (Stage 356, updated Stage 389/397/405)

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
| 8 | Rust Invocation Adapter (`FedosRustInvocationAdapter`) | ✅ Yes | `src/runtime/fedos_rust_invocation_adapter.ts` |
| 9 | Execution Backend (`FedosExecutionBackend`) | ✅ Yes (NOT CONNECTED) | `src/runtime/fedos_execution_backend.ts` |
| 10 | WASM Backend (`FedosWasmBoundary`, formerly "WASM Boundary") | ✅ Yes (NOT LOADED) | `src/runtime/fedos_wasm_boundary.ts` |
| 11 | WASM Artifact (`FedosWasmArtifact`) | ✅ Yes (NOT BUILT) | `src/runtime/fedos_wasm_artifact.ts` |
| 12 | Rust Crypto (`packages/fedos-core-rust`'s `fedos_encrypt`/`fedos_decrypt`) | ❌ **Disconnected** | Not called from any file in links 1–11 |

**Only the first eleven links exist. Rust Crypto remains disconnected.**
There is no function, import, or code path anywhere in this repository
connecting link 11 to link 12. `docs/runtime_execution_backend.md`
(Stage 401) formally re-frames WebAssembly (link 10) as the FIRST
Execution Backend (link 9) CANDIDATE — not the only one design allows
— while `docs/runtime_rust_boundary_decision.md` (Stage 385) remains
the record of why WASM was chosen as the sole official MVP candidate.
No `.wasm` module is generated or built (link 11), loaded (link 10),
or selected/connected (link 9) by any stage so far.

## What "exists" means for each link

Links 1–11 each satisfy the SAME three properties:

1. **Typed and tested** — every link has its own `FedosXxxStatus`/
   `FedosXxxDecision` types, a placeholder implementation, and a
   dedicated guard test suite (`test/runtime_fedos_*.test.ts`).
2. **Wired to the next link** — each link's placeholder implementation
   constructs the NEXT link, routes to it, and discards its result,
   ALWAYS returning its own unchanged, fixed denial. (Link 11 is the
   exception at the FAR end: it has no further internal link to
   construct — it is the formally-decided terminus before link 12.)
3. **Never invokes anything beyond the chain** — no link imports
   `packages/fedos-core-rust`, calls `WebAssembly.instantiate`/
   `WebAssembly.compile`, runs `cargo build --target wasm32-*`/
   `wasm-bindgen`/`wasm-pack`, or uses FFI/a Native Addon/a Native or
   Mobile toolchain of any kind; `AppRuntime`/`create_runtime.ts` and
   `src/worker.ts` import NONE of these files.

Link 12 satisfies NONE of these from the TypeScript side — it is a REAL,
independently-tested Rust `pub fn` pair
(`packages/fedos-core-rust/src/lib.rs`), but nothing in
`src/runtime/` calls it.

## Why the contract stops here

Each of links 1–11 is a STRUCTURAL precondition — the shape exists. Link
12 additionally requires THREE separate PERMISSIONS
(`docs/runtime_fedos_execution_approval_checklist.md` items 6–8):
execution review approval, Runtime activation approval, and Worker
activation approval — PLUS the actual selection of a real Execution
Backend candidate (WASM, Native, Mobile, or otherwise) and the
generation, building, and loading of whatever artifact that candidate
requires, which no stage so far has done. None of these can be
granted by adding more structure to links 1–11 — each is its own,
future, explicitly-reviewed stage's decision.

## Still true after this stage

- No Rust crypto execution, no WASM build, no WASM load, no FFI, no
  Native Addon, no Native/Mobile backend of any kind, anywhere in the
  chain.
- No Runtime activation, no Worker activation.
- `encrypt()`/`decrypt()` STILL always resolve `"Unsupported"`.
- `evaluateRuntimeCryptoActivation`/`evaluateWorkerCryptoActivation`
  STILL never return `"Allowed"`.
- `FedosInternalRustCall` is planned only, never executed
  (`fedosInternalRustCallExecuted()` fixed `false`).
- `FedosExecutionBackend` has never selected or connected to a real
  backend (`fedosExecutionBackendImplemented()` fixed `false`).
- `FedosWasmBoundary` has never loaded a WASM module
  (`fedosWasmLoaded()` fixed `false`).
- `FedosWasmArtifact` has never built a WASM artifact
  (`fedosWasmArtifactBuilt()` fixed `false`).

## See also

- `docs/runtime_internal_rust_call.md` (Stage 353–360) — the
  specification for what link 12 would eventually need, without
  implementing it.
- `docs/runtime_execution_backend.md` (Stage 401–408) — link 9's own
  model and wiring, and the formal re-framing of WASM (link 10) as the
  first Execution Backend candidate rather than the only one.
- `docs/runtime_rust_boundary_decision.md` (Stage 385) — the original
  decision that WASM is the sole official MVP candidate.
- `docs/runtime_wasm_boundary.md` (Stage 386–390) — link 10's own model
  and wiring (now reached through link 9, unchanged file otherwise).
- `docs/runtime_wasm_artifact.md` (Stage 393–400) — link 11's own
  model and wiring, plus the planning-only build pipeline it belongs
  to.
- `docs/runtime_fedos_execution_approval_checklist.md` (Stage 348) —
  the eight-item approval checklist this contract's "why it stops
  here" section references.
