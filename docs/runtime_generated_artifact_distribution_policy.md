# FedOS Generated Artifact Distribution Policy — Stage 553

**Status: this document records real code's current state — the
static import this policy gates has NOT happened, does NOT happen as
a side effect of anything in this stage, and remains PROHIBITED.
Runtime/Worker connection and `WebAssembly.instantiate` remain
PROHIBITED as well.**

`docs/runtime_static_import_activation_review.md` (Stage 545) is the
final gate immediately before real static import could ever be
permitted. THIS document fixes a question that arc left open: how the
generated `.wasm`/JS glue pair itself should ever be DISTRIBUTED —
committed to version control, or produced fresh at build time on every
machine that needs it. This is a standing PROJECT POLICY, not a
per-stage placeholder answer, and it directly determines whether a
future static import could ever be "safe" in the sense of working
identically on every clone of this repository.

## 1. The two candidate distributions

**Option A — commit the generated artifact.** `packages/fedos-core-rust/pkg/fedos_core_rust.js`
and `fedos_core_rust_bg.wasm` would be checked into version control
directly, so a static `import` of them would resolve identically on
every clone without requiring a WASM build step first.

- Pro: a static import would never break a fresh clone or a CI job
  that skips `npm run build:wasm`.
- Con: binary/generated build output in version control — diffs
  become opaque, the repository grows with every Rust toolchain/
  `wasm-bindgen` version bump, and the committed bytes can silently
  drift out of sync with the Rust source that produced them (nothing
  enforces that the checked-in `.wasm` was built from the CURRENT
  `src/lib.rs`).
- Directly contradicts this repository's standing "generated build
  output is reproducible from source and never checked in" discipline
  — the SAME discipline `/target/`, `/build/`, `Cargo.lock`, `*.wasm`,
  and `*.rlib` already follow project-wide (`packages/fedos-core-rust/.gitignore`).

**Option B — never commit the generated artifact; build-time
generation only.** `packages/fedos-core-rust/pkg/` stays gitignored;
anyone who needs the generated JS glue/`.wasm` runs `RUSTFLAGS='--cfg
getrandom_backend="wasm_js"' npm run build:wasm` (`docs/runtime_wasm_generation.md`,
Stage 450) locally, and the output is regenerated from the current
Rust source every time.

- Pro: the generated artifact can NEVER drift from the Rust source
  that produced it — it is always freshly derived; no binary output
  in version control; consistent with this repository's existing
  `/target/`/`/build/`/`Cargo.lock`/`*.wasm`/`*.rlib` policy.
- Con: a static import would break any environment that has not just
  run the build step first (fresh clones, CI without a build step) —
  this is exactly the risk `docs/runtime_wasm_static_import_safety_review.md`
  (Stage 525) already identified and is why that Safety Review can
  never approve a static import today.

## 2. Current policy: Option B

**This repository adopts Option B.** `packages/fedos-core-rust/pkg/`
CONTINUES to be gitignored (Stage 451's `/pkg/` rule, unchanged by
this stage), and a fresh clone of this repository REQUIRES running
`npm run build:wasm` before the generated JS glue/`.wasm` exist on
disk at all. No stage so far has committed, or will commit, anything
under `packages/fedos-core-rust/pkg/` — this policy makes that
standing practice EXPLICIT and makes clear it is a deliberate choice,
not an oversight.

`src/runtime/fedos_generated_artifact_distribution.ts` (Stage 554) is
the real, fixed-value implementation of this policy's collapsed
answer — `createGeneratedArtifactDistribution()` always resolves
`{ distributionMode: "BuildTimeGenerated", artifactCommitted: false,
staticImportSafe: false, reason: "GeneratedArtifactNotCommitted" }`.

This choice does NOT, by itself, make a future static import safe —
it only fixes ONE variable (how the artifact would be distributed) out
of the many `docs/runtime_static_import_activation_review.md`'s seven
conditions require. Because Option B is chosen, a static import can
NEVER be considered "safe" purely by virtue of the artifact's
distribution mechanism: build-time generation means the artifact is
NEVER guaranteed present, so `docs/runtime_generated_artifact_presence_policy.md`'s
"artifact not generated for Runtime" answer remains structurally
correct regardless of what any individual developer's machine happens
to contain at a given moment.

## 3. What this stage does NOT do

- Does **not** write the static `import` statement named by
  `docs/runtime_wasm_static_import_plan.md` (or any dynamic `import()`
  equivalent) anywhere in this repository's source.
- Does **not** import, reference, or evaluate the generated JS glue in
  any way.
- Does **not** call `WebAssembly.instantiate`/`WebAssembly.compile`/
  `WebAssembly.instantiateStreaming`.
- Does **not** connect Runtime (`create_runtime.ts`) or Worker
  (`src/worker.ts`) to any of this.
- Does **not** change `packages/fedos-core-rust/.gitignore` — `/pkg/`
  stays ignored, unchanged.
- Does **not** commit any file under `packages/fedos-core-rust/pkg/`.
- Does **not** touch Rust crypto (`encrypt`/`decrypt` stay
  `"Unsupported"`).
- Does **not** change any Cargo/`package.json` dependency.

## See also

- `docs/runtime_static_import_activation_review.md` (Stage 545) — the
  final gate before real static import, whose own `approved: false`
  answer this policy's Option B choice reinforces.
- `docs/runtime_generated_artifact_presence_policy.md` (Stage 537) —
  the "presence ≠ permission" distinction this policy's §2 builds on.
- `docs/runtime_wasm_static_import_safety_review.md` (Stage 525) — the
  original identification of the "static import breaks fresh clones"
  risk this policy's Option A/B comparison directly answers.
- `packages/fedos-core-rust/.gitignore` (Stage 451) — the `/pkg/` rule
  this policy confirms stays unchanged.
- `src/runtime/fedos_generated_artifact_distribution.ts` (Stage
  554–555) — the real, fixed-value implementation of this policy and
  its wiring from `fedos_static_import_activation_review.ts`.
- `docs/runtime_internal_execution_contract.md` (updated Stage 557) —
  the diagram naming Generated Artifact Distribution Policy's position
  between Static Import Activation Review and Generated JS Glue.
