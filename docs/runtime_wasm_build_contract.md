# FedOS WASM build contract — Stage 418 (docs only, no code)

**Status: this document adds no code.** It fixes, as a single diagram,
the end-to-end path from `packages/fedos-core-rust`'s Rust source to
`Runtime` — naming every step a real WASM build/load would need, in
order, and marking which steps are FUTURE (not yet attempted) versus
which steps are REAL, EXISTING TypeScript placeholders today. Nothing
in this document builds, generates, binds, loads, or executes
anything. This is the diagram only — implementation of any labeled
step is explicitly OUT OF SCOPE for this stage.

## 1. The fixed contract

```
Rust Source (packages/fedos-core-rust/src/lib.rs)   <-- exists today, real, tested, 27 pub fn
        |
        v
cargo build (future)                                <-- NOT RUN. `cargo build --target wasm32-*`
        |
        v
wasm-bindgen (future)                                <-- NOT RUN. No dependency, no CLI invocation.
        |
        v
Generated JS Glue (future)                           <-- NOT GENERATED. No file exists.
        |
        v
Generated .wasm (future)                             <-- NOT GENERATED. No file exists.
        |
        v
FedosWasmArtifact                                    <-- REAL placeholder (src/runtime/fedos_wasm_artifact.ts, Stage 394)
        |                                                 planBuild()/planLoad() fixed "BlockedByImplementation"
        v
FedosWasmBoundary                                    <-- REAL placeholder (src/runtime/fedos_wasm_boundary.ts, Stage 386)
        |                                                 planLoad()/planEncrypt()/planDecrypt() fixed "BlockedByImplementation"
        v
ExecutionBackend                                     <-- REAL placeholder (src/runtime/fedos_execution_backend.ts, Stage 402)
        |                                                 planBackend()/planLoad() fixed "Planning", status() fixed "NotConnected"
        v
Runtime                                              <-- NOT CONNECTED. create_runtime.ts imports none of the above.
```

## 2. Reading the diagram: future vs. real

The four steps labeled **(future)** — `cargo build`, `wasm-bindgen`,
Generated JS Glue, Generated `.wasm` — have **zero** code, dependency,
script, or artifact anywhere in this repository today, per
`docs/runtime_wasm_toolchain_readiness.md` (Stage 417)'s inventory.
They are named in this diagram ONLY to fix the exact point in the
chain each future step would occupy, once (and if) a later,
explicitly-reviewed stage introduces it.

The bottom four boxes — `FedosWasmArtifact`, `FedosWasmBoundary`,
`ExecutionBackend`, `Runtime` — are the REAL chain already built by
Stage 386–408 (see `docs/runtime_internal_execution_contract.md` links
9–11 and `docs/runtime_architecture_phase_review.md` §2). Every one of
them today returns a fixed, non-executing answer
(`"BlockedByImplementation"`/`"Planning"`/`"NotConnected"`), and
`Runtime` (`src/runtime/create_runtime.ts`) imports none of them.

## 3. What this contract fixes, precisely

- **The ORDER is fixed**: no future stage may, for example, generate a
  `.wasm` artifact before running `wasm-bindgen`, or run `wasm-bindgen`
  before a `wasm32` build exists. This mirrors
  `docs/runtime_wasm_build_plan.md`'s (Stage 393) existing pipeline
  shape exactly — this document does not redefine that order, it
  restates it as one fixed diagram spanning all the way to `Runtime`.
- **The BOUNDARY is fixed**: nothing above `FedosWasmArtifact` in this
  diagram exists as code today, and nothing below `Generated .wasm`
  needs to change shape once the future steps are real — each REAL
  placeholder already has the exact method shape (`planBuild()`/
  `planLoad()`/`planBackend()`) a real implementation would fill in
  later, per the "wired one level deep, discard the result" idiom
  already used at every prior link.
- **The STOP point is unchanged**: `Runtime` at the bottom is still not
  connected to anything above it. This diagram does not change that —
  it only draws the full path that a future, separate connection stage
  would eventually complete.

## 4. What this stage explicitly does NOT do

- Does not run `cargo build --target wasm32-*`.
- Does not run `wasm-bindgen` or `wasm-pack`.
- Does not generate a `.wasm` file or JS glue code.
- Does not modify `FedosWasmArtifact`, `FedosWasmBoundary`, or
  `ExecutionBackend` — all three files are untouched by this stage.
- Does not connect `Runtime`/`Worker` to any step in this diagram.
- Does not change `Cargo.toml`, `package.json`, or any Rust public
  API.
- Does not execute `encrypt`/`decrypt` in any form.

## See also

- `docs/runtime_wasm_toolchain_readiness.md` (Stage 417) — the
  inventory this contract's four "(future)" boxes are drawn against.
- `docs/runtime_wasm_build_plan.md` (Stage 393) — the original pipeline
  shape (crate → wasm32 target → bindgen → loader → Runtime Provider)
  this contract extends all the way to `Runtime`.
- `docs/runtime_internal_execution_contract.md` — the authoritative
  12-link table naming `FedosWasmArtifact`/`FedosWasmBoundary`/
  `FedosExecutionBackend` as links 11/10/9 respectively.
- `docs/runtime_wasm_migration_plan.md` (Stage 421) — the stage-by-stage
  MIGRATION order that would eventually walk this diagram top to
  bottom, one reviewed stage at a time.
