# Runtime architecture phase review — Stage 409–416 (docs only, no code)

**Status: this document adds no code.** It is the design-phase-end
review for the chain built across Stage 1–408: it summarizes, without
changing, the full Runtime → Provider → Execution Backend → FedOS Core
(Rust) structure and states plainly which links are real placeholders
and which remain unconnected. Stage 409–416 as a whole adds documents
and a guard test only — no `src/`, `packages/`, `Cargo.toml`, or
`package.json` change, no WASM generation, no `wasm-bindgen`/
`wasm-pack`, no Runtime/Worker activation, no cryptographic execution.

## 1. Why this review, and why now

Stage 402–408 closed the "Execution Backend Architecture" work: FedOS
Core is now formally backend-agnostic, and WASM is named the first
implementation candidate behind a swappable interface rather than a
hard-coded destination. That was the last purely architectural
decision on the books. Before any stage starts replacing a
`"BlockedByImplementation"`/`"Planning"`/`"NotConnected"` placeholder
with a real implementation, this review fixes, in one place, what the
finished design-phase chain actually looks like end to end, so that
the implementation-phase work (Stage 410's sequence) has a single
agreed starting point instead of requiring a fresh re-derivation from
408 separate stage commits.

## 2. The full chain today (12 links, per `docs/runtime_internal_execution_contract.md`)

| # | Link | State | File |
|---|---|---|---|
| 1 | Dual Lock (`FEDOS_CRYPTO_PROVIDER`/`FEDOS_CRYPTO_ENABLED`) | Real, both gates always fail closed | `docs/runtime_crypto_activation_policy.md` |
| 2 | Provider (`FedosRuntimeCryptoProvider`) | Real, `encrypt`/`decrypt` fixed `"Unsupported"` | `src/runtime/fedos_runtime_crypto_provider.ts` |
| 3 | Opaque API (`FedosOpaqueApi`) | Real placeholder | `src/runtime/fedos_opaque_api.ts` |
| 4 | Rust Boundary (`FedosRustBoundary`) | Real placeholder | `src/runtime/fedos_rust_boundary.ts` |
| 5 | Rust API (`FedosRustApi`) | Real placeholder | `src/runtime/fedos_rust_api.ts` |
| 6 | Execution Review (`FedosRustExecutionReview`) | Real placeholder | `src/runtime/fedos_rust_execution_review.ts` |
| 7 | Internal Rust Call (`FedosInternalRustCall`) | Real, PLANNED ONLY | `src/runtime/fedos_internal_rust_call.ts` |
| 8 | Rust Invocation Adapter (`FedosRustInvocationAdapter`) | Real placeholder | `src/runtime/fedos_rust_invocation_adapter.ts` |
| 9 | Execution Backend (`FedosExecutionBackend`) | Real, NOT CONNECTED | `src/runtime/fedos_execution_backend.ts` |
| 10 | WASM Backend (`FedosWasmBoundary`) | Real, NOT LOADED | `src/runtime/fedos_wasm_boundary.ts` |
| 11 | WASM Artifact (`FedosWasmArtifact`) | Real, NOT BUILT | `src/runtime/fedos_wasm_artifact.ts` |
| 12 | Rust Crypto (`packages/fedos-core-rust`, `fedos_encrypt`/`fedos_decrypt`) | Real Rust, **disconnected** | Not called from any file in links 1–11 |

Links 1–11 are all typed, tested TypeScript placeholders that route to
the next link and discard its result, always returning their own
fixed denial. Link 12 is real, independently-tested Rust with zero
callers anywhere in `src/runtime/` or `src/worker.ts`. This table is
unchanged by Stage 409–416 — it is reproduced here, not re-decided.

## 3. Structural summary: Runtime → Provider → Backend → Rust Core

```
Runtime (src/runtime/create_runtime.ts)      <-- never imports any link below
        |
        v  (opt-in only, currently never selected)
Provider (FedosRuntimeCryptoProvider)         link 2
        |
        v
Opaque API -> Rust Boundary -> Rust API       links 3-5
        |
        v
Execution Review -> Internal Rust Call        links 6-7 (planned only)
        |
        v
Rust Invocation Adapter                       link 8
        |
        v
Execution Backend                             link 9  (swappable interface)
        |
        v
WASM Backend -> WASM Artifact                 links 10-11 (WASM candidate only)
        |
        v
STOP -- no caller crosses this line
        |
        v
FedOS Core (packages/fedos-core-rust)         link 12 (real Rust, unreached)
```

Three properties hold across every link, unchanged since Stage 401–408
(`docs/runtime_internal_execution_contract.md` §"What 'exists' means
for each link"):

1. **Typed and tested.** Every link has its own status/decision types,
   an inert placeholder implementation, and a dedicated guard test
   suite.
2. **Wired one level deep, no further.** Each placeholder constructs
   the next link and calls its `plan*()`/`status()` method, discarding
   the result, then returns its own unchanged fixed answer.
3. **Never invokes anything beyond the chain.** No link calls
   `WebAssembly.instantiate`/`compile`, runs a build tool, uses FFI, or
   imports `packages/fedos-core-rust`; `create_runtime.ts` and
   `src/worker.ts` import none of these files.

## 4. Where the Execution Backend abstraction sits (Stage 401–408 recap)

`docs/runtime_execution_backend.md` formalized link 9 as a swappable
interface rather than a synonym for "the WASM path": FedOS Core has no
knowledge that an Execution Backend concept exists (no Rust file,
`pub fn`, or `Cargo.toml` entry names "backend," "WASM," "native," or
"mobile"), and WASM is one candidate implementation among a set that
also names Native Desktop, Mobile, and Other as future, currently
codeless candidates. This review does not revisit that decision — it
restates it as the fixed baseline the Stage 410 sequence builds on.

## 5. What this review confirms is still true

- No cryptographic operation of any kind has ever been executed by
  this codebase.
- No `.wasm` file, no `wasm-bindgen`/`wasm-pack` dependency, no
  `cargo build --target wasm32-*` invocation, anywhere.
- No Native/Mobile/Other backend has any code, dependency, or file.
- No Runtime activation, no Worker activation — `create_runtime.ts`
  and `src/worker.ts` do not import any link in §2's table.
- `evaluateRuntimeCryptoActivation`/`evaluateWorkerCryptoActivation`
  have never returned `"Allowed"`.
- `packages/fedos-core-rust`'s 27 `pub fn`s and `Cargo.toml` are
  byte-for-byte unchanged since Stage 405.
- `package.json`'s dependency count (2) is unchanged.

## 6. What this review is not

This is not a new architectural decision, not a code change, and not
an implementation stage. It does not build, load, connect, or execute
anything. Its only output is: (a) this summary, (b) a fixed forward
sequence for the next implementation-phase stages
(`docs/runtime_backend_implementation_sequence.md`, Stage 410), (c) a
named risk register for that future work
(`docs/runtime_backend_risk_register.md`, Stage 411), and (d) a
verification policy for any future stage that does touch Rust/WASM
(`docs/runtime_backend_verification_policy.md`, Stage 412).

## See also

- `docs/runtime_internal_execution_contract.md` (Stage 356/389/397/405)
  — the authoritative 12-link table this review reproduces in §2.
- `docs/runtime_execution_backend.md` (Stage 401–408) — the Execution
  Backend abstraction this review's §4 recaps.
- `docs/runtime_wasm_build_plan.md` (Stage 393) — the WASM build
  pipeline plan the Stage 410 sequence's items 1–3 build on.
- `docs/runtime_backend_implementation_sequence.md` (Stage 410) — the
  fixed forward order this review motivates.
- `docs/runtime_backend_risk_register.md` (Stage 411) and
  `docs/runtime_backend_verification_policy.md` (Stage 412) — the risk
  and verification companions to this review.
