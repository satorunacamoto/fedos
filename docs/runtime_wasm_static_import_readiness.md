# FedOS WASM Static Import Readiness — Stage 533

**Status: this document records real code's current state — the
static import it evaluates readiness for has NOT happened, does NOT
happen as a side effect of anything in this stage, and remains
PROHIBITED.**

`docs/runtime_wasm_static_import_safety_review.md` (Stage 525) is a
dedicated Safety Review that always resolves `{ approved: false,
reason: "GeneratedArtifactNotCommitted" }`. THIS document goes one
level deeper still: even IF a future, separate, explicitly-reviewed
stage someday satisfied that review's condition, several further
conditions would ALSO need to hold before the static import named by
`docs/runtime_wasm_static_import_plan.md` (Stage 517) could actually
run. This is the READINESS CHECKLIST for that future state — never
satisfied by anything in this repository today.

## 1. Conditions required after Safety Review passes

| # | Condition | Question it answers | State today |
|---|---|---|---|
| 1 | **Safety Review passed** | Has `reviewStaticImport()` ever resolved `approved: true`? | ❌ NO — fixed `approved: false` (Stage 526) |
| 2 | **Generated JS Glue present** | Does a real `.wasm` + JS glue pair exist at `packages/fedos-core-rust/pkg/fedos_core_rust.js` right now? | ❌ NOT CONFIRMED — never live-checked by this readiness record (see §2) |
| 3 | **Import path fixed** | Is the exact import path already named and stable? | ✅ YES — `FEDOS_WASM_STATIC_IMPORT_TARGET` (Stage 518) names it, but naming a path is not the same as being ready to import it |
| 4 | **Runtime unconnected** | Does `create_runtime.ts` still avoid this entire WASM chain? | ✅ CONFIRMED, but readiness requires an EXPLICIT future Runtime attach decision, not merely "still disconnected today" |
| 5 | **Worker unconnected** | Does `src/worker.ts` still avoid this entire WASM chain? | ✅ CONFIRMED, same caveat as #4 |
| 6 | **`initSync` not executed** | Has the JS glue's synchronous initializer ever been called? | ❌ NO — never called anywhere in this repository |
| 7 | **Default init not executed** | Has the JS glue's default (`__wbg_init`) export ever been called? | ❌ NO — never called anywhere in this repository |
| 8 | **Fail Closed maintained** | Does every link in this chain still deny by default? | ✅ YES — every placeholder in this arc still returns a fixed denial |

**Every condition must hold simultaneously before real readiness could
ever be declared.** Today, #1, #2, #6, and #7 are each independently
sufficient to keep readiness at `false` — #3, #4, #5, and #8 already
hold, by construction, but that alone changes nothing: satisfying only
some conditions is not readiness.

`src/runtime/fedos_wasm_static_import_readiness.ts` (Stage 534) is the
real, fixed-value implementation of this checklist's collapsed
answer — `createStaticImportReadiness()` always resolves
`{ readinessState: "PlanningOnly", ready: false, reason:
"RuntimeNotReady" }`, naming the table above as the concrete, standing
reason readiness cannot be declared while any of #1/#2/#6/#7 remains
unmet.

## 2. Why "Generated JS Glue present" is never a live check

`src/runtime/fedos_wasm_static_import_readiness.ts` (Stage 534) NEVER
inspects the filesystem, `import.meta`, or any environment variable —
the SAME discipline every other file in this WASM arc already follows
(`fedos_wasm_artifact.ts`'s `fedosWasmArtifactGenerated()`,
`fedos_wasm_loader_import_policy.ts`'s condition #2, etc.). Whether
`packages/fedos-core-rust/pkg/fedos_core_rust.js` happens to exist on
a given machine at a given moment is IRRELEVANT to this readiness
record's fixed answer — a readiness check whose answer depended on
local filesystem state would not be an auditable, reviewable record at
all, only an accident of whichever machine last ran `npm run
build:wasm`.

## 3. What this stage does NOT do

- Does **not** write the static `import` statement named by
  `docs/runtime_wasm_static_import_plan.md` (or any dynamic `import()`
  equivalent) anywhere in this repository's source.
- Does **not** call `initSync`/the default export.
- Does **not** call `WebAssembly.instantiate`/`WebAssembly.compile`/
  `WebAssembly.instantiateStreaming`.
- Does **not** call `fetch`.
- Does **not** connect Runtime (`create_runtime.ts`) or Worker
  (`src/worker.ts`) to any of this.
- Does **not** edit, generate, or commit any file under
  `packages/fedos-core-rust/pkg/`.
- Does **not** touch Rust crypto (`encrypt`/`decrypt` stay
  `"Unsupported"`).
- Does **not** change any Cargo/`package.json` dependency.

## See also

- `docs/runtime_wasm_static_import_safety_review.md` (Stage 525) — the
  Safety Review one level up this arc, whose own `approved: false`
  answer is condition #1 above.
- `docs/runtime_wasm_static_import_plan.md` (Stage 517) — the exact
  static import target and expected exports this readiness record
  evaluates.
- `src/runtime/fedos_wasm_static_import_readiness.ts` (Stage 534–535)
  — the real, fixed-value implementation of this readiness record and
  its wiring from `fedos_wasm_static_import_review.ts`.
- `docs/runtime_internal_execution_contract.md` (updated Stage 536) —
  the diagram naming Static Import Readiness's position between
  Static Import Review and Generated JS Glue.
