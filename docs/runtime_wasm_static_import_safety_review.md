# FedOS WASM Static Import — Safety Review — Stage 525

**Status: this document records real code's current state — the
static import it reviews has NOT happened, does NOT happen as a side
effect of anything in this stage, and remains PROHIBITED.**

`docs/runtime_wasm_static_import_plan.md` (Stage 517) named the EXACT
static `import` statement a future, separate, explicitly-reviewed
stage would eventually write, without ever writing it.
`docs/runtime_wasm_loader_import_policy.md` (Stage 509) fixed six
conditions phase #2 ("Import Permission") requires, all still unmet.
THIS document goes one level deeper still: a dedicated SAFETY REVIEW
of what would break, and why, if that static `import` statement were
written today — before any future stage is allowed to write it.

## 1. Risk: the generated JS glue does not exist in most environments

`packages/fedos-core-rust/pkg/fedos_core_rust.js` (the Static Import
Plan's named target) is a GENERATED artifact — it is produced only by
running `RUSTFLAGS='--cfg getrandom_backend="wasm_js"' npm run
build:wasm` (`docs/runtime_wasm_generation.md`, Stage 450), and
`packages/fedos-core-rust/.gitignore`'s `/pkg/` rule (Stage 451) means
it is NEVER present on disk unless that build was run locally, on
THIS machine, moments before.

A real static `import { initSync, default as init } from
"packages/fedos-core-rust/pkg/fedos_core_rust.js"` statement is
resolved by the bundler/toolchain at BUILD time, not at run time —
unlike a dynamic `import()`, it cannot be wrapped in a try/catch or
skipped at runtime if the file is missing. Concretely, writing that
statement today would break:

- **Fresh clones** — anyone who clones this repository and runs
  `npm run build`/`npm test`/`npm run typecheck` WITHOUT first running
  `npm run build:wasm` would hit a hard module-resolution failure,
  since the imported file simply does not exist on their disk.
- **CI** — unless CI is changed to run the WASM build step first (no
  stage so far has made that change), every CI job touching the
  affected module would fail identically.
- **Every environment where `getrandom_backend="wasm_js"` cannot be
  built** — the WASM toolchain itself is optional infrastructure
  (`docs/runtime_wasm_toolchain.md`); requiring it transitively via a
  static import would make the WASM toolchain load-bearing for the
  ENTIRE codebase, not just the (currently nonexistent) code path that
  would eventually call into FedOS Core.

A static import fails closed in the WORST possible way for this
codebase's stated fail-closed discipline: it fails the BUILD, for
EVERYONE, regardless of whether they ever intend to exercise FedOS
crypto at all.

## 2. Policy: generated artifacts are never committed

`packages/fedos-core-rust/.gitignore` (Stage 451) ignores `/pkg/`
(and `/target/`, `Cargo.lock`, `*.wasm`, `*.rlib`) on purpose — this
repository's standing policy is that build output is reproducible
from source and never checked in. This review does not revisit that
policy; it only draws out its consequence for static import
specifically: since the generated JS glue can NEVER be assumed
present in version control, a static import of it can NEVER be made
safe merely by "committing the file" — that option is permanently
off the table, by design, for this codebase.

## 3. Why static import is not permitted yet

Even setting aside `docs/runtime_wasm_loader_import_policy.md`'s six
conditions (still all evaluated as unmet), THIS Safety Review is
itself an INDEPENDENT, additional gate: no future stage may write the
static `import` statement without this review's own explicit,
recorded approval — and no code in this repository grants that
approval today. `src/runtime/fedos_wasm_static_import_review.ts`
(Stage 526) is the real, fixed-value implementation of that
refusal — `reviewStaticImport()` always resolves
`{ approved: false, reason: "GeneratedArtifactNotCommitted" }`, naming
§1/§2 above as the concrete, standing reason no approval can be
granted while the generated artifact remains a local-only,
uncommitted build product.

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
- Does **not** edit, generate, or commit any file under
  `packages/fedos-core-rust/pkg/`.
- Does **not** touch Rust crypto (`encrypt`/`decrypt` stay
  `"Unsupported"`).
- Does **not** change `packages/fedos-core-rust/.gitignore` or any
  Cargo/`package.json` dependency.

## See also

- `docs/runtime_wasm_static_import_plan.md` (Stage 517) — the exact
  static import target and expected exports this review evaluates.
- `docs/runtime_wasm_loader_import_policy.md` (Stage 509) — the six
  conditions one level up this arc, all still unmet.
- `src/runtime/fedos_wasm_static_import_review.ts` (Stage 526–527) —
  the real, fixed-value implementation of this review and its wiring
  from `fedos_wasm_static_import_plan.ts`.
- `packages/fedos-core-rust/.gitignore` (Stage 451) — the standing
  "generated artifacts are never committed" policy this review's §2
  draws its consequence from.
- `docs/runtime_internal_execution_contract.md` (updated Stage 529) —
  the diagram naming Static Import Review's position between Static
  Import Plan and Generated JS Glue.
