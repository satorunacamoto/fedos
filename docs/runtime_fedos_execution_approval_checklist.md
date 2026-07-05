# FedOS execution approval checklist (Stage 348)

**Status: this document records real code's current state.** It names
the EIGHT conditions that would ALL need to be true before real FedOS
Rust crypto execution could ever be considered — and states, item by
item, which are structurally in place today and which are not.

## The checklist

| # | Item | Status | Where |
|---|---|---|---|
| 1 | Dual Lock configured | ✅ Structurally ready | `FEDOS_CRYPTO_PROVIDER`/`FEDOS_CRYPTO_ENABLED` (Stage 281–297, `docs/runtime_crypto_activation_policy.md`) |
| 2 | Provider implemented | ✅ Structurally ready | `FedosRuntimeCryptoProvider` (Stage 265), internal chain complete through the Execution Review (Stage 345) |
| 3 | Opaque API ready | ✅ Structurally ready | `FedosOpaqueApi`/`FedosOpaqueApiPlaceholder` (Stage 321–328) |
| 4 | Rust Boundary ready | ✅ Structurally ready | `FedosRustBoundary`/`FedosRustBoundaryPlaceholder` (Stage 329–336) |
| 5 | Rust API ready | ✅ Structurally ready | `FedosRustApi`/`FedosRustApiPlaceholder` (Stage 337–344) |
| 6 | Execution review approved | ❌ **NOT approved** | `fedosRustExecutionApproved()` fixed `false` (Stage 345) |
| 7 | Runtime activation approved | ❌ **NOT approved** | `AppRuntime.crypto` exists but nothing calls it automatically; no activation path exists |
| 8 | Worker activation approved | ❌ **NOT approved** | `src/worker.ts` still does not import any FedOS crypto file |

**Items 1–5 are structurally in place — the SHAPE of every layer
exists, is tested, and is wired together.** Items 6–8 are NOT approved
— and there is no code path, env var, or configuration in this
repository that could make any of them `true` today.

## Why "structurally ready" is not the same as "approved"

Items 1–5 describe ARCHITECTURE: does the abstraction exist, is it
correctly typed, is it wired to the next layer in the chain. None of
them describe PERMISSION: whether real cryptography is allowed to run
through that architecture. Items 6–8 describe permission, and all
three require a SEPARATE, future, explicitly-reviewed stage — none of
them can be granted by finishing more architecture.

This split is deliberate. A caller reading `providerImplementationStage:
"RustApiReady"` (`runtime_crypto_diagnostics.ts`) might reasonably ask
"so is it done?" — this checklist's answer is: the SCAFFOLDING is done;
the PERMISSION is not, and won't be granted by any change described in
Stage 345–352.

## What would need to change for each remaining item

- **Execution review approved** — `fedos_rust_execution_review.ts`'s
  `FedosRustExecutionReviewPlaceholder` would need a real, reviewed
  implementation that could return `approved: true` under SOME
  condition — and even then, per this stage's own guardrails, no such
  condition exists yet.
- **Runtime activation approved** — `create_runtime.ts`/`AppRuntime`
  would need to be extended to call the Provider's `encrypt`/`decrypt`
  (or the internal chain) automatically, as part of a real request
  path — not merely to construct the Provider (which it already does).
- **Worker activation approved** — `src/worker.ts` would need to import
  and call the Worker-side crypto boundary — which it currently does
  not import AT ALL (`docs/runtime_worker_activation_boundary.md`).

Each of the three remaining items is its own, separate, future,
explicitly-reviewed stage's decision — never a side effect of
completing more of the structural chain.

## See also

- `docs/runtime_fedos_rust_execution_review.md` (Stage 345–352) — the
  Execution Review layer this checklist's item 6 refers to.
- `docs/runtime_crypto_threat_model.md` — the fail-closed guarantee
  this checklist's "not approved" items reinforce.
