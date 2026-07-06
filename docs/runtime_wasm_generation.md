# FedOS WASM generation flow — Stage 449

**Status: this document is PLANNING ONLY.** It fixes, as a single
diagram, the exact sequence a real WASM Artifact (a `.wasm` file plus
its `wasm-bindgen`-generated JS glue) would need to be produced in —
naming a concrete script name (Stage 450) and output directory (Stage
451) for the first time, now that `docs/runtime_wasm_build_observation.md`
§7 (Stage 445) has already confirmed the crate itself compiles clean
for `wasm32-unknown-unknown`. This document does not build, bind,
generate, load, or execute anything. Naming a step, a script, or a
directory is not performing it.

## 1. The generation flow

```
cargo build                          <-- REAL, already GREEN (Stage 443-444),
     |                                   RUSTFLAGS='--cfg getrandom_backend="wasm_js"'
     v                                   cargo build --target wasm32-unknown-unknown
wasm-bindgen                         <-- NOT RUN. CLI installed as an environment
     |                                   capability only (Stage 425); no invocation
     v                                   anywhere in this repository.
generated JS glue                    <-- NOT GENERATED. No file exists.
     |
     v
generated wasm                       <-- NOT GENERATED. No file exists.
     |
     v
FedosWasmArtifact                    <-- REAL placeholder (src/runtime/fedos_wasm_artifact.ts,
     |                                   Stage 394); Stage 452 adds a `generationState`
     |                                   field fixed "NotGenerated" — still no artifact.
     v
FedosWasmBoundary                    <-- REAL placeholder (src/runtime/fedos_wasm_boundary.ts,
     |                                   Stage 386); planLoad()/planEncrypt()/planDecrypt()
     |                                   fixed "BlockedByImplementation"
     v
ExecutionBackend                     <-- REAL placeholder (src/runtime/fedos_execution_backend.ts,
     |                                   Stage 402); planBackend()/planLoad() fixed
     |                                   "Planning", status() fixed "NotConnected"
     v
Runtime (未接続 / NOT CONNECTED)      <-- create_runtime.ts imports none of the above.
```

This restates `docs/runtime_wasm_build_contract.md` §1's own diagram
at a finer grain for exactly the two steps between "`cargo build`" and
"`FedosWasmArtifact`" — `wasm-bindgen`, Generated JS Glue, Generated
`.wasm` — now that the box directly above them (`cargo build`) is no
longer purely hypothetical (Stage 443–444). The four bottom boxes
(`FedosWasmArtifact` → `FedosWasmBoundary` → `ExecutionBackend` →
`Runtime`) are UNCHANGED from `docs/runtime_wasm_build_contract.md`
§1/§2 — this document does not modify their order, their fixed
`"BlockedByImplementation"`/`"Planning"`/`"NotConnected"` answers, or
their wiring.

## 2. What Stage 449–456 names, without doing

- **A script name** (Stage 450): `npm run build:wasm`, added to
  `package.json`'s `scripts`. This batch adds the script text but
  never runs it — no test, no CI step, no lifecycle hook (`pretest`,
  `prepare`, `postinstall`, or otherwise) invokes it, and `npm test`/
  `npm run typecheck` do not touch it either.
- **An output directory** (Stage 451): `packages/fedos-core-rust/pkg/`
  — the `--out-dir` a future `wasm-bindgen --target web` invocation
  would write its generated `.wasm`/JS glue/`.d.ts` files into. Added
  to `packages/fedos-core-rust/.gitignore` so that IF a future,
  separate stage ever actually runs the script, its output is never
  accidentally staged or committed. The directory itself is not
  created — there is nothing to ignore yet except the pattern.
- **An artifact-generation state** (Stage 452): `FedosWasmArtifact`
  gains a `generationState` field, distinct from its existing `state`
  (`"NotBuilt"`, Stage 394) — `"Generated"` / `"NotGenerated"`, fixed
  `"NotGenerated"`. This tracks a DIFFERENT question than `state`:
  `state` asks "has this Provider-internal abstraction's own build
  step ever executed" (it never has, `planBuild()` always resolves
  `"BlockedByImplementation"`); `generationState` asks "does a real
  `.wasm` + JS glue pair exist on disk" (it never does).
- **Diagnostics** (Stage 453): `wasmArtifactGenerated` (fixed
  `false`) and `generatedArtifactPath` (fixed `null`), read-only,
  added to both `runtimeCryptoActivationStatus`/
  `workerCryptoActivationStatus`.

## 3. Why `npm run build:wasm`'s command text is written WITHOUT an embedded `RUSTFLAGS`

Per `docs/runtime_wasm_getrandom_policy.md` §3/§4, a real
`wasm32-unknown-unknown` build of this crate requires
`RUSTFLAGS='--cfg getrandom_backend="wasm_js"'` to be supplied
per-invocation — that policy also fixed, in writing, that this `--cfg`
flag is NEVER baked into a committed `.cargo/config.toml`. The SAME
reasoning extends to `package.json`: the `build:wasm` script's command
text (Stage 450) does not embed `RUSTFLAGS` either, for two reasons —
(1) `RUSTFLAGS='...'` prefix syntax is POSIX-shell-specific and would
silently fail under `cmd.exe` (npm's default `script-shell` on
Windows), and (2) baking the entropy-backend selection into a
committed script would blur the same explicit, reviewed opt-in line
`docs/runtime_wasm_getrandom_policy.md` §4 already drew. A future,
separate stage that actually RUNS `npm run build:wasm` must still
export `RUSTFLAGS='--cfg getrandom_backend="wasm_js"'` in its own
shell environment first — exactly as Stage 443–444 did by hand.

## 4. Still true after Stage 449–456

- No `.wasm` file, generated JS glue, or `.d.ts` file is generated,
  committed, or loaded anywhere in this repository.
- `wasm-bindgen` (the CLI) is never invoked by this batch.
- `npm run build:wasm` exists but is never executed by this batch, by
  `npm test`, by `npm run typecheck`, or by any lifecycle hook.
- No `Cargo.toml`/`package.json` DEPENDENCY is added — `build:wasm` is
  a script entry, not a dependency; production dependency counts stay
  at 10 (Rust)/2 (`package.json`).
- No new Rust `pub fn` — the public API stays at 27.
- `FedosWasmArtifact`/`FedosWasmBoundary`/`ExecutionBackend` keep
  their existing fixed `"BlockedByImplementation"`/`"Planning"`/
  `"NotConnected"` answers; none of their `plan*()` methods change
  behavior.
- No Runtime activation, no Worker activation —
  `create_runtime.ts`/`src/worker.ts` import none of the WASM chain.
- `FEDOS_RUNTIME_PROVIDER_IMPLEMENTED` stays permanently `false`;
  the Dual Lock (`FEDOS_CRYPTO_PROVIDER`/`FEDOS_CRYPTO_ENABLED`)
  handling is unchanged; `"Allowed"` is never reachable from either
  activation policy.
- No `encrypt`/`decrypt` code path is touched, in Rust or TypeScript.

## See also

- `docs/runtime_wasm_build_contract.md` (Stage 418, updated 427, 434,
  445) — the original, coarser end-to-end diagram this document
  refines at the `cargo build` → `FedosWasmArtifact` step.
- `docs/runtime_wasm_build_observation.md` §7–8 (Stage 445) — the
  recorded `cargo check`/`cargo build --target wasm32-unknown-unknown`
  SUCCESS this document's §1 diagram builds on.
- `docs/runtime_wasm_getrandom_policy.md` (Stage 441) — the
  `wasm_js`/`--cfg getrandom_backend="wasm_js"` opt-in discipline §3
  of this document extends to `package.json`.
- `docs/runtime_wasm_build_plan.md` (Stage 393) — the original
  crate → target → bindgen → loader → Runtime Provider pipeline shape,
  still the ultimate reference for the loader/Runtime Provider rows.
- `src/runtime/fedos_wasm_artifact.ts` (Stage 394, updated Stage 452)
  — where this document's §2 `generationState` field is added.
- `src/runtime/fedos_wasm_boundary.ts` (Stage 386) /
  `src/runtime/fedos_execution_backend.ts` (Stage 402) — unchanged by
  this batch, still the fixed `FedosWasmBoundary`/`ExecutionBackend`
  links this document's §1 diagram names.
