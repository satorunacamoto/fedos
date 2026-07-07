# FedOS Generated Artifact Presence Policy — Stage 537

**Status: this document records real code's current state — the
static import it gates has NOT happened, does NOT happen as a side
effect of anything in this stage, and remains PROHIBITED.**

`docs/runtime_wasm_static_import_readiness.md` (Stage 533) named EIGHT
conditions that would ALL need to hold before the static import named
by `docs/runtime_wasm_static_import_plan.md` (Stage 517) could ever
run — condition #2 of that checklist ("Generated artifact present")
was named but not itself given a dedicated policy. THIS document is
that dedicated policy: the LAST safety layer immediately before a
static import could ever be written, fixing exactly what "present" and
"usable" would need to mean, and why they are NOT the same thing.

## 1. The conditions this policy fixes

| # | Condition | Question it answers | State today |
|---|---|---|---|
| 1 | **Generated JS Glue exists** | Does `packages/fedos-core-rust/pkg/fedos_core_rust.js` exist on disk? | ❌ NOT CONFIRMED — never live-checked by this policy (see §2) |
| 2 | **Generated `.wasm` exists** | Does `packages/fedos-core-rust/pkg/fedos_core_rust_bg.wasm` exist on disk? | ❌ NOT CONFIRMED — never live-checked by this policy (see §2) |
| 3 | **Neither is git-tracked** | Are both excluded from version control? | ✅ STRUCTURALLY YES (`packages/fedos-core-rust/.gitignore`'s `/pkg/` rule, Stage 451) |
| 4 | **Runtime unconnected** | Does `create_runtime.ts` still avoid this entire WASM chain? | ✅ CONFIRMED |
| 5 | **Worker unconnected** | Does `src/worker.ts` still avoid this entire WASM chain? | ✅ CONFIRMED |
| 6 | **Presence ≠ permission** | Does confirming the file exists, by itself, permit importing it? | ❌ NO, BY DESIGN — see §3 |
| 7 | **Fail Closed maintained** | Does every link in this chain still deny by default? | ✅ YES — every placeholder in this arc still returns a fixed denial |

`src/runtime/fedos_generated_artifact_presence.ts` (Stage 538) is the
real, fixed-value implementation of this policy's collapsed answer —
`createGeneratedArtifactPresence()` always resolves `{ state:
"PlanningOnly", present: false, reason:
"ArtifactNotGeneratedForRuntime" }`, naming the table above as the
concrete, standing reason presence-and-usability cannot be declared
while any of #1/#2/#6 remains unconfirmed or unsatisfied.

## 2. Why presence is never a live filesystem check

`src/runtime/fedos_generated_artifact_presence.ts` (Stage 538) NEVER
inspects the filesystem, `import.meta`, or any environment variable —
the SAME discipline every other file in this WASM arc already follows
(`fedos_wasm_artifact.ts`'s `fedosWasmArtifactGenerated()`,
`fedos_wasm_loader_import_policy.ts`'s condition #2,
`fedos_wasm_static_import_readiness.ts`'s condition #2). No `fs`,
`path`, `existsSync`, `statSync`, or glob API of any kind is used to
determine whether `packages/fedos-core-rust/pkg/fedos_core_rust.js`/
`fedos_core_rust_bg.wasm` actually exist on a given machine at a given
moment — a presence check whose answer depended on local filesystem
state would not be an auditable, reviewable POLICY at all, only an
accident of whichever machine last ran `npm run build:wasm`.

## 3. Why presence and usage permission are separate concepts

Even if the generated artifact were confirmed present on disk, THAT
FACT ALONE would never be sufficient to permit a static import of it.
Presence is a purely physical/build-output question ("did `npm run
build:wasm` run here"); permission is a policy question governed by
EVERY other gate in this arc — `docs/runtime_wasm_loader_import_policy.md`'s
six conditions, `docs/runtime_wasm_static_import_safety_review.md`'s
Safety Review, and `docs/runtime_wasm_static_import_readiness.md`'s
eight-condition readiness checklist. Collapsing "present" into
"usable" would let a stray local build artifact silently grant import
permission — this policy exists specifically to keep those two
questions from ever being conflated.

## 4. What this stage does NOT do

- Does **not** write the static `import` statement named by
  `docs/runtime_wasm_static_import_plan.md` (or any dynamic `import()`
  equivalent) anywhere in this repository's source.
- Does **not** call `initSync`/the default export.
- Does **not** call `WebAssembly.instantiate`/`WebAssembly.compile`/
  `WebAssembly.instantiateStreaming`.
- Does **not** call `fetch`.
- Does **not** connect Runtime (`create_runtime.ts`) or Worker
  (`src/worker.ts`) to any of this.
- Does **not** read the filesystem via `fs`/`path`/`existsSync`/
  `statSync`/glob to confirm the generated artifact's actual presence.
- Does **not** edit, generate, or commit any file under
  `packages/fedos-core-rust/pkg/`.
- Does **not** touch Rust crypto (`encrypt`/`decrypt` stay
  `"Unsupported"`).
- Does **not** change any Cargo/`package.json` dependency.

## See also

- `docs/runtime_wasm_static_import_readiness.md` (Stage 533) — the
  eight-condition readiness checklist this policy's conditions #1/#2
  give a dedicated answer to.
- `src/runtime/fedos_generated_artifact_presence.ts` (Stage 538–539)
  — the real, fixed-value implementation of this policy and its
  wiring from `fedos_wasm_static_import_readiness.ts`.
- `packages/fedos-core-rust/.gitignore` (Stage 451) — the standing
  "generated artifacts are never committed" rule this policy's
  condition #3 draws on.
- `docs/runtime_internal_execution_contract.md` (updated Stage 541) —
  the diagram naming Generated Artifact Presence's position between
  Static Import Readiness and Generated JS Glue.
