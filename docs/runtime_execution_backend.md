# FedOS Execution Backend Architecture (Stage 401, updated Stage 405)

**Status: this document records a formal architecture decision, plus the
real (but still entirely inert) code that models it.** It does NOT build,
load, or execute anything. Its subject is a reorganization of HOW the
existing chain is described and extended — not a change to WHAT is
allowed to happen. Every guardrail already in force
(`docs/runtime_rust_boundary_decision.md`, `docs/runtime_wasm_boundary.md`,
`docs/runtime_wasm_build_plan.md`, `docs/runtime_internal_execution_contract.md`)
stays exactly as strict as before.

## 1. The decision this document fixes

Prior stages (385–400) treated WebAssembly as *the* boundary between
FedOS Runtime and `packages/fedos-core-rust` — a single, hard-coded
mechanism. **That framing is now retired.** From this stage forward:

- **FedOS Core (Rust, `packages/fedos-core-rust`) is the ONE AND ONLY
  core.** It never changes shape because of this stage, and it never
  depends on — or even imports — anything backend-specific.
- **The Execution Backend is a swappable INTERFACE** between that one
  core and any Runtime. WASM is the FIRST implementation CANDIDATE for
  that interface — not a permanent architectural commitment.
- **Native/Desktop and Mobile backends are explicitly allowed by
  design**, even though neither is implemented, scheduled, or even
  named beyond a placeholder label today.

This is a re-framing of Stage 385's decision, not a reversal of it:
Stage 385 decided WASM is the sole official **MVP** mechanism; this
stage clarifies that "MVP mechanism" was always meant to name the
*first Execution Backend*, not the *only possible one*.

```
FedOS Core (Rust)
        |
Execution Backend      <-- the swappable interface (THIS stage's subject)
        |
      Runtime
```

**Critical property: FedOS Core itself is not aware the Execution
Backend abstraction exists.** `packages/fedos-core-rust` has no
`Cargo.toml` change, no new `pub fn`, no new dependency, and no file
in it references "backend," "WASM," "native," or "mobile" in any
capacity. The Core's public surface (27 `pub fn`s, unchanged) is
exactly as backend-agnostic after this stage as before it — the
Execution Backend concept lives ENTIRELY on the TypeScript side, in
`src/runtime/`.

## 2. Execution Backend candidates

| Candidate | Status | Notes |
|---|---|---|
| **WASM** | First implementation candidate | `src/runtime/fedos_wasm_boundary.ts` (Stage 386) / `fedos_wasm_artifact.ts` (Stage 394) already model this candidate as an inert placeholder; Stage 403 nests it under the new `FedosExecutionBackend` abstraction. Still never loads, compiles, or instantiates anything. |
| **Native Desktop** | Future, unimplemented | No file exists for this candidate. Named here ONLY as a label FedOS Core's design must not structurally exclude — e.g., a future Node Native Addon, Tauri/Electron native bridge, or platform-specific binary loader. |
| **Mobile Backend** | Future, unimplemented | Same treatment as Native Desktop — a label reserved for a future iOS/Android execution path (e.g. a compiled static/dynamic library invoked through a mobile runtime bridge), not a real integration. |
| **Other Backend** | Future, unimplemented | The interface is deliberately open-ended — any future execution environment (embedded, serverless, etc.) is a candidate, reviewed on its own merits when it is actually proposed. |

None of the three future rows above has a file, a dependency, or a
line of code anywhere in this repository. They exist in this table so
that the WASM candidate's placeholder code is never mistaken for "the
only way FedOS Core can ever be reached."

## 3. Why this reorganization, and why now

Stage 385–400 built a real, tested, twelve-link TypeScript chain that
proves — structurally, not by executing anything — that the eventual
WASM path is fail-closed at every layer. That work is not undone.
What changes is the LABEL at the point where the chain reaches the
Rust crate: instead of hard-wiring "the next link is WASM" into the
Rust Invocation Adapter, an Execution Backend layer is inserted so
that a future Native or Mobile candidate could occupy the SAME
position without requiring the Rust Invocation Adapter, the Provider,
or any layer above it to change at all.

## 4. What this stage's code actually does (and does not do)

`src/runtime/fedos_execution_backend.ts` (Stage 402) models this
abstraction as an inert placeholder — `FedosExecutionBackend`,
`FedosExecutionBackendKind` (`"Wasm" | "Native" | "Future"`),
`createExecutionBackend()`, `planBackend()`/`planLoad()`. Every method
resolves a FIXED, non-executing answer:

- `status()` — always `{ state: "NotConnected", ... }`.
- `planBackend()` — always reports the candidate kind `"Wasm"` with
  decision state `"Planning"` — the ONLY backend kind this stage's
  placeholder ever names, and it never connects to it.
- `planLoad()` — builds a `FedosWasmBoundary` (unchanged file, Stage
  386) and calls its EXISTING `planLoad()`, discards the result, and
  returns its own fixed `"Planning"` answer.

Stage 403 rewires `FedosRustInvocationAdapterPlaceholder.planEncrypt()`/
`planDecrypt()` (`src/runtime/fedos_rust_invocation_adapter.ts`) to
reach `FedosExecutionBackend` INSTEAD OF `FedosWasmBoundary` directly.
The WASM Boundary file itself (`fedos_wasm_boundary.ts`) is UNCHANGED —
it is simply no longer reached directly from the Rust Invocation
Adapter; it is reached ONE LEVEL DEEPER, through the Execution
Backend, mirroring exactly the same "build the next link, call its
`planLoad()`, discard the result" idiom every previous stage in this
chain already established.

**Nothing here ever calls `WebAssembly.instantiate`/`compile`, never
`wasm-bindgen`/`wasm-pack`, never `cargo build --target wasm32-*`,
never any Native/Mobile toolchain, never FFI, never a Native Addon,
never a spawned CLI process, and never any cryptographic operation of
any kind.**

## 5. The full chain, end to end (Stage 401–408)

```
Runtime
  |
  v
Provider                                (src/runtime/fedos_runtime_crypto_provider.ts)
  |
  v
Operation -> Opaque Request -> Opaque API -> Rust Boundary -> Rust API
  |          (links 2-5, unchanged since Stage 305-341)
  v
Execution Review                        (src/runtime/fedos_rust_execution_review.ts)
  |
  v
Internal Rust Call (PLANNED ONLY)       (src/runtime/fedos_internal_rust_call.ts)
  |
  v
Rust Invocation Adapter                 (src/runtime/fedos_rust_invocation_adapter.ts)
  |
  v
Execution Backend (NEW, Stage 402-403)  (src/runtime/fedos_execution_backend.ts)
  |   planBackend() -> { backend: "Wasm", state: "Planning", ... }
  |   planLoad()    -> { operation: "load", backend: "Wasm", state: "Planning", ... }
  v
WASM Backend (formerly "WASM Boundary") (src/runtime/fedos_wasm_boundary.ts, UNCHANGED)
  |
  v
WASM Artifact                           (src/runtime/fedos_wasm_artifact.ts, UNCHANGED)
  |
  v
STOP                                    <-- STAGE 401-408 STOPS HERE, same as before
  |
  v
FedOS Core (packages/fedos-core-rust)   <-- STILL UNCONNECTED
```

`planPing()` is entirely UNCHANGED by this stage — it still reaches
`fedos_runtime_ping_internal()`'s contract via its own pure TypeScript
mirror (`docs/runtime_first_rust_ping_execution.md`), independently of
this Execution Backend wiring.

## 6. High-level architecture diagrams (conceptual, not call-order)

The diagram in §1 and the diagram immediately below describe the
DEPENDENCY direction (what depends on what) — the opposite direction
from §5's CALL-order diagram (who invokes whom). Both are true at
once: Runtime *calls into* the chain that eventually would reach
FedOS Core; FedOS Core is *depended upon* by that same chain, without
ever depending back.

### WASM (first implementation candidate — real placeholder code exists)

```
FedOS Core
    |
Execution Backend
    |
WASM Backend
    |
Artifact
    |
Runtime
```

### Native / Desktop (future — no code exists for this row)

```
Execution Backend
    |
  Native
    |
 Runtime
```

### Mobile (future — no code exists for this row)

```
Execution Backend
    |
  Mobile
    |
 Runtime
```

Both future diagrams are drawn ONLY to show that the Execution
Backend's position in the architecture does not change when the
candidate underneath it changes — neither diagram corresponds to any
file, type, or test in this repository.

## 7. Still true after this stage

- No cryptographic operation of any kind is ever executed.
- No WASM generated, compiled, or loaded; no `WebAssembly.instantiate`/
  `compile` call anywhere.
- No Native/Mobile backend code, dependency, or toolchain invocation
  of any kind.
- No `wasm-bindgen`/`wasm-pack` dependency; no `cargo build --target
  wasm32-*` invocation.
- No FFI, no Native Addon, no spawned CLI process.
- No Runtime activation, no Worker activation.
- `encrypt()`/`decrypt()` STILL always resolve `"Unsupported"`.
- `evaluateRuntimeCryptoActivation`/`evaluateWorkerCryptoActivation`
  STILL never return `"Allowed"`.
- `FEDOS_RUNTIME_PROVIDER_IMPLEMENTED` and `FEDOS_CRYPTO_ENABLED`
  handling are unchanged.
- No `SecretHandle`/`ConversationKey`/`MessageKey`/`Nip44WirePayload`
  exposure.
- No `Cargo.toml`/`package.json` change, no new Rust `pub fn`, no new
  Rust public API — `packages/fedos-core-rust` is untouched by this
  entire stage.

## See also

- `docs/runtime_rust_boundary_decision.md` (Stage 385) — the original
  decision this stage re-frames (WASM as the first Execution Backend
  candidate, not the only possible one).
- `docs/runtime_wasm_boundary.md` (Stage 386–392) / `docs/runtime_wasm_artifact.md`
  (Stage 393–400) — the WASM candidate's own model and wiring,
  unchanged by this stage except for WHO calls into them.
- `docs/runtime_internal_execution_contract.md` — updated by this
  stage (§ Execution Backend link) to record the chain's new shape.
- `README.md`'s "Execution Backend Architecture" section — the
  product-facing statement that FedOS is backend-swappable, not
  WASM-exclusive.
