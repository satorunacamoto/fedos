# FedOS Build-Time Loader Strategy — Stage 561

**Status: this document records real code's current state — no
loader is implemented by this stage, no import (static or dynamic)
happens as a side effect of anything here, and both remain
PROHIBITED. Runtime/Worker connection and `WebAssembly.instantiate`
remain PROHIBITED as well.**

`docs/runtime_generated_artifact_distribution_policy.md` (Stage 553)
fixed this repository's standing choice: `packages/fedos-core-rust/pkg/`
is never committed (Option B, build-time generation only). THIS
document draws the direct consequence for how the generated JS
glue/`.wasm` could ever be LOADED: since the artifact's mere existence
can never be guaranteed by version control, no future loader may ever
be written that ASSUMES the artifact is present. This is a standing
STRATEGY DECISION, fixing which loading approach this repository
commits to before any loader is ever built — not an implementation.

## 1. Consequences of Option B for loading

- **`pkg/` is never Git-managed.** Confirmed again here: no commit in
  this repository's history, and no future commit under this policy,
  ever adds a tracked file inside `packages/fedos-core-rust/pkg/`.
- **Fresh clones require `npm run build:wasm`.** Anyone who wants the
  generated JS glue/`.wasm` to exist on their machine must run the
  WASM build step themselves; nothing in this repository automates
  that for them, and no loader may assume it has already happened.
- **Static import is unsafe today.** `docs/runtime_wasm_static_import_safety_review.md`
  (Stage 525) already established this; this document does not revisit
  that conclusion, only restates the CONSEQUENCE: a static `import`
  statement is resolved at build/bundle time, so it would break any
  environment lacking the generated artifact — precisely the
  environments Option B guarantees will exist (every fresh clone,
  every CI job that skips the WASM build step).
- **A loader must not presuppose the artifact's presence.** Whatever
  loading mechanism a future stage eventually builds, it must check
  for (or otherwise tolerate the absence of) the generated artifact
  rather than assuming a static `import` binding that would already
  have failed at load time if the artifact were missing.

## 2. Three candidate future loading strategies

| Option | Description | Trade-off |
|---|---|---|
| **A. Prebuild step required** | CI/dev tooling is changed to always run `npm run build:wasm` before any other build/test step, so the artifact is guaranteed present by the time anything could load it. | Removes the "missing artifact" risk entirely, but makes the WASM toolchain a HARD dependency for every contributor and every CI job, even ones that never touch FedOS crypto. |
| **B. Optional loader** | A loader that checks for the artifact's presence and simply stays inert (no-op) if it is absent — Runtime/Worker continue operating normally either way. | Keeps the WASM toolchain fully optional, but means FedOS crypto silently never activates on any machine that has not run the build step, with no explicit signal that this happened. |
| **C. Dynamic loader with an explicit dev-only gate** | A loader using dynamic `import()` (never static `import`), gated behind an EXPLICIT, dev-only, non-default flag — so it only ever attempts to load the artifact when a developer has deliberately opted in, and dynamic `import()`'s built-in failure handling covers the "artifact missing" case gracefully. | Requires implementing an explicit gate and dynamic-import error handling; more moving parts than A or B, but keeps the toolchain optional AND makes activation an explicit, auditable developer choice rather than an implicit environment accident. |

## 3. Current decision: Option C is the future candidate

**This repository designates Option C — a dynamic loader with an
explicit dev-only gate — as the candidate strategy for a future,
separate, explicitly-reviewed stage.** This stage does **NOT**
implement it: no dynamic `import()` is written, no gate exists, no
loader code is added beyond a fixed-value strategy record naming this
decision. Choosing Option C now, without building it, lets later
stages design the explicit dev-only gate and the dynamic-import error
handling deliberately, instead of retrofitting them onto a static
import that was written first.

`src/runtime/fedos_build_time_loader_strategy.ts` (Stage 562) is the
real, fixed-value implementation of this decision — `createBuildTimeLoaderStrategy()`
always resolves `{ strategy: "DynamicLoaderPlanned", requiresPrebuild:
true, staticImportAllowed: false, dynamicImportAllowed: false,
runtimeAttachAllowed: false }`, naming Option C as the DESIGNATED
future candidate without implementing any part of it.

## 4. What this stage does NOT do

- Does **not** write a dynamic `import()` or any other loader
  implementation.
- Does **not** write the static `import` statement named by
  `docs/runtime_wasm_static_import_plan.md`.
- Does **not** import, reference, or evaluate the generated JS glue in
  any way.
- Does **not** call `WebAssembly.instantiate`/`WebAssembly.compile`/
  `WebAssembly.instantiateStreaming`.
- Does **not** connect Runtime (`create_runtime.ts`) or Worker
  (`src/worker.ts`) to any of this.
- Does **not** commit any file under `packages/fedos-core-rust/pkg/`.
- Does **not** touch Rust crypto (`encrypt`/`decrypt` stay
  `"Unsupported"`).
- Does **not** change any Cargo/`package.json` dependency.

## See also

- `docs/runtime_generated_artifact_distribution_policy.md` (Stage 553)
  — the Option A/B distribution choice this document's loading
  consequences build directly on.
- `docs/runtime_wasm_static_import_safety_review.md` (Stage 525) — the
  original "static import is unsafe" conclusion this document restates
  as a consequence, not a new finding.
- `src/runtime/fedos_build_time_loader_strategy.ts` (Stage 562–563) —
  the real, fixed-value implementation of this strategy decision and
  its wiring from `fedos_generated_artifact_distribution.ts`.
- `docs/runtime_internal_execution_contract.md` (updated Stage 565) —
  the diagram naming Build-Time Loader Strategy's position between
  Generated Artifact Distribution Policy and Generated JS Glue.
