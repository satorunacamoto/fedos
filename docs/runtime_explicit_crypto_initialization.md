# FedOS Runtime Explicit Crypto Initialization — Stage 585

**Status: this document records real code's current state — no
`import()` is implemented by this stage, no import (static or dynamic)
happens as a side effect of anything here, and both remain PROHIBITED.
Runtime/Worker connection and `WebAssembly.instantiate` remain
PROHIBITED as well.**

Every prior stage in this arc (`docs/runtime_dynamic_loader_gate.md`,
Stage 569; `docs/runtime_dynamic_loader_dev_approval.md`, Stage 577)
answered "WHETHER" and "UNDER WHAT CONDITIONS" a dynamic `import()` of
the generated JS glue could ever be written or activated. THIS
document answers a DIFFERENT question, one level closer to Runtime's
own call surface: even IF a dynamic loader were someday activated,
WHEN, exactly, would it ever run? This document fixes the answer —
**never automatically, never implicitly, only via a future, explicit,
separately-approved initialization call** — without implementing that
call.

## 1. The design this document fixes

| # | Rule | Meaning |
|---|---|---|
| 1 | **No auto-load at startup** | Runtime startup (`create_runtime.ts`) never triggers a WASM/JS glue load as a side effect of construction, today or in any future stage this document governs. |
| 2 | **No implicit load on `encrypt`/`decrypt`** | Calling `encrypt()`/`decrypt()` never triggers a load as a side effect of the call itself — `"Unsupported"` is returned without ever reaching for the generated JS glue. |
| 3 | **Only a future, explicit `initCrypto()`-style call may ever load anything** | A dedicated, separately-named, separately-reviewed initialization entry point — analogous to a future `initCrypto()` — is the ONLY path by which a load could ever be requested. No such entry point is implemented by this stage; this document only reserves its shape and its name. |
| 4 | **Runtime never knows WASM/JS Glue directly** | `create_runtime.ts`/`AppRuntime` never import, reference, or reason about `fedos_core_rust.js`/`fedos_core_rust_bg.wasm`, `WebAssembly.instantiate`/`compile`, or `initSync`/the default init export — not now, and not as a consequence of this document. |
| 5 | **Everything routes through Loader/Backend, never directly** | Whatever a future explicit initialization call eventually does, it is required to route through the existing Loader (`fedos_wasm_loader.ts`/`fedos_wasm_loader_plan.ts`) and Execution Backend (`fedos_execution_backend.ts`) abstractions this arc already built — never a bare `import()`/`WebAssembly.instantiate` call made directly from Runtime or anywhere else. |
| 6 | **Worker is out of scope** | This document governs Runtime-side explicit initialization only. Worker (`src/worker.ts`) is not addressed, is not approved, and is not connected by this document or by `src/runtime/fedos_explicit_crypto_initialization.ts` (Stage 586) in any way. |

## 2. Why "explicit initialization" and not "lazy/implicit load"

A lazy-load design — where the first `encrypt()`/`decrypt()` call
transparently triggers a WASM load — would make load timing invisible
to the caller and to review: a network request, a `WebAssembly.compile`
call, and a filesystem read could all happen inside what looks like a
pure crypto operation. Fixing "explicit initialization only" as a
permanent design decision means:

- Load timing is always caller-visible and caller-controlled — never a
  hidden side effect of an operation that looks pure.
- A future `initCrypto()`-style call can be reviewed, gated, and
  audited as its OWN operation, separate from `encrypt`/`decrypt`'s own
  review history (`docs/runtime_fedos_execution_approval_checklist.md`).
- `encrypt()`/`decrypt()` keep behaving exactly as documented today —
  synchronous-shaped, `"Unsupported"`-returning, no I/O — for as long as
  no explicit initialization has ever been approved and called.

`src/runtime/fedos_explicit_crypto_initialization.ts` (Stage 586) is
the real, fixed-value implementation of this decision's collapsed
answer — `createExplicitCryptoInitialization()` always resolves
`{ mode: "ExplicitInitialization", initializationAllowed: false,
initialized: false, reason: "InitializationApprovalPending" }`, naming
the table above as the concrete, standing reason no initialization
path exists yet.

## 3. What this stage does NOT do

- Does **not** write `import()` of any kind, anywhere in this
  repository's source.
- Does **not** write the static `import` statement named by
  `docs/runtime_wasm_static_import_plan.md`.
- Does **not** import, reference, or evaluate the generated JS glue in
  any way.
- Does **not** call `WebAssembly.instantiate`/`WebAssembly.compile`/
  `WebAssembly.instantiateStreaming`.
- Does **not** implement `initCrypto()` or any other initialization
  entry point — this document only reserves its shape and its name.
- Does **not** connect Runtime (`create_runtime.ts`) or Worker
  (`src/worker.ts`) to any of this — no Runtime connection of any kind
  exists yet, and Worker remains categorically out of scope.
- Does **not** commit any file under `packages/fedos-core-rust/pkg/`.
- Does **not** touch Rust crypto (`encrypt`/`decrypt` stay
  `"Unsupported"`) or implement NIP-17/NIP-59.
- Does **not** change any Cargo/`package.json` dependency.

## See also

- `docs/runtime_dynamic_loader_dev_approval.md` (Stage 577) — the
  eight dev-only conditions a future dynamic loader activation would
  need to satisfy, one level above this document.
- `src/runtime/fedos_explicit_crypto_initialization.ts` (Stage
  586–587) — the real, fixed-value implementation of this design
  decision and its wiring from
  `fedos_dynamic_loader_dev_approval.ts`.
- `docs/runtime_internal_execution_contract.md` (updated Stage 589) —
  the diagram naming Explicit Crypto Initialization's position between
  Dynamic Loader Dev Approval and Dynamic Import, and confirming no
  Runtime/Worker connection exists yet.
