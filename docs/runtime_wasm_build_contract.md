# FedOS WASM build contract — Stage 418 (updated Stage 427, 434, 445)

**Status: this document adds no code.** It fixes, as a single diagram,
the end-to-end path from `packages/fedos-core-rust`'s Rust source to
`Runtime` — naming every step a real WASM build/load would need, in
order, and marking which steps are FUTURE (not yet attempted) versus
which steps are REAL, EXISTING TypeScript placeholders today. Nothing
in this document builds, generates, binds, loads, or executes
anything. This is the diagram only — implementation of any labeled
step is explicitly OUT OF SCOPE for this stage.

Stage 427 adds §5: the EXACT future command lines for the two
"(future)" build steps, now that Stage 425 has installed the toolchain
those commands would need (`docs/runtime_wasm_toolchain_readiness.md`).
Naming a command is not running it — Stage 427 does not add a
`package.json` script, does not run either command against the crate,
and does not turn this diagram into an executable pipeline.

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
- Does not add a `package.json` `scripts` entry of any kind — Stage
  427 names commands in prose/a code block for humans to read, not a
  script this repository can invoke.
- Does not execute `encrypt`/`decrypt` in any form.

## 5. Planned future commands (named, not executed, not scripted) — Stage 427

Now that Stage 425 has installed `wasm32-unknown-unknown` and
`wasm-bindgen-cli` as local environment capabilities
(`docs/runtime_wasm_toolchain_readiness.md` §1–2), the two "(future)"
build steps in §1's diagram have an EXACT command each future,
separate, explicitly-reviewed stage would run — named here for
reference only:

```
# Step "cargo build (future)" — NOT run by this stage
cargo build --target wasm32-unknown-unknown --release \
  --manifest-path packages/fedos-core-rust/Cargo.toml

# Step "wasm-bindgen (future)" — NOT run by this stage
wasm-bindgen \
  --target web \
  --out-dir <TBD, a future stage decides this> \
  target/wasm32-unknown-unknown/release/fedos_core_rust.wasm
```

Both lines are illustrative and INCOMPLETE ON PURPOSE — e.g. the
`wasm-bindgen --out-dir` destination, whether `--release` or a debug
profile is correct for a first attempt, and whether `[lib]`'s
`crate-type` needs a `cdylib` target added (it does not have one
today; see `docs/runtime_wasm_toolchain_readiness.md` §2) are all
decisions for the future "Build確認"/"Build confirmation" stage
(`docs/runtime_wasm_migration_plan.md` item 3), not this one. Naming
these commands lets that future stage start from an agreed shape
instead of inventing the invocation from scratch; it does not
authorize running them, and this stage does not run them.

## 6. Build strategy decision for Stage 435–436 — `rlib` stays, observe only — Stage 434

Now that the toolchain exists on this machine (Stage 425), the next
question is HOW to take the first real step toward §5's `cargo build`
line — not whether to run it, but what to run it AGAINST. This section
fixes that decision, in writing, before Stage 435–436 run anything.

**Decision: `[lib]`'s `crate-type` stays `["rlib"]` for Stage 435–436.
No `cdylib` target is added.** Stage 435–436 will run
`cargo check --target wasm32-unknown-unknown` and (if that succeeds)
`cargo build --target wasm32-unknown-unknown` against the crate
EXACTLY AS IT EXISTS TODAY — no `Cargo.toml` edit of any kind. This is
an OBSERVATION of how far the existing, unmodified crate reaches
toward a `wasm32` target, not an attempt to produce a real,
loadable `.wasm` module (a `cdylib` target is required for that, and
is deliberately out of scope here).

**Why `cdylib` is deliberately withheld from this decision:**

- **Blast radius.** Adding `crate-type = ["rlib", "cdylib"]` changes
  what `packages/fedos-core-rust` PRODUCES (a shared-library artifact,
  loadable by `wasm-bindgen`) and, per
  `docs/fedos_core_wasm_safety.md`'s existing safety framing, widens
  the crate's public boundary in a way that needs its own explicit
  review — it is not a neutral toggle. Bundling it into a
  "does this crate even build for `wasm32`" check would make one stage
  responsible for two independently-reviewable decisions
  (`docs/runtime_backend_implementation_sequence.md` §1's
  one-concern-per-stage rule).
  `docs/runtime_wasm_build_contract.md` §5 already flagged this same
  open question; this section is where it gets deferred, in writing,
  rather than silently decided by whichever stage happens to need it
  next.
- **Diagnostic value without it.** `rlib`-only IS a valid, complete
  Rust target for `cargo check`/`cargo build --target wasm32-*` — the
  compiler still type-checks and compiles the crate for that target;
  it simply produces a `.rlib` (not directly `wasm-bindgen`-loadable)
  rather than a `.wasm`-producing `cdylib`. This is enough to answer
  Stage 435's real question — does the EXISTING dependency graph
  (`chacha20poly1305`/`hkdf`/`zeroize`/`secrecy`/`subtle`/`argon2`/
  `aes-gcm`/`getrandom`/`sha2`/`k256`) even compile for `wasm32-unknown-
  unknown` — without also deciding the separate, later question of
  what artifact shape the crate should eventually export.
- **Sequencing.** `docs/runtime_wasm_migration_plan.md` item 3 ("Build
  確認"/"Build confirmation") is scoped to exactly this: confirm the
  crate builds for the target. Item 4 ("wasm生成"/"WASM generation") is
  where a `cdylib` target and a real `wasm-bindgen` invocation would
  first become necessary — this document does not move that boundary.

**What this means concretely for Stage 435–436:** both the `cargo
check --target wasm32-unknown-unknown` and (conditional) `cargo build
--target wasm32-unknown-unknown` commands run against the crate's
CURRENT `Cargo.toml`, unedited. A "does it build" result under `rlib`
is the full extent of what this batch measures; "does it produce a
`.wasm` `wasm-bindgen` could consume" is explicitly NOT measured here
and is deferred to a future, separate, explicitly-reviewed stage that
would ALSO need to justify adding `cdylib` on its own merits.

## 7. Update — Stage 441–445: the "`cargo build` (future)" box is no longer purely future

§1's diagram labeled `cargo build (future)` as "NOT RUN". As of Stage
443–444, that is now more precise: `cargo build --target
wasm32-unknown-unknown` (and `cargo check` for the same target) HAVE
been run, and both SUCCEED, once `getrandom`'s `wasm_js` feature
(`Cargo.toml`, Stage 442) is enabled and `RUSTFLAGS='--cfg
getrandom_backend="wasm_js"'` is supplied per-invocation
(`docs/runtime_wasm_getrandom_policy.md`, Stage 441;
`docs/runtime_wasm_build_observation.md` §7, Stage 445). This does
NOT move the diagram's boundary — the next three boxes down
(`wasm-bindgen (future)`, `Generated JS Glue (future)`, `Generated
.wasm (future)`) are UNCHANGED and still entirely future: no
`cdylib` target exists (`[lib]`'s `crate-type` is still `["rlib"]`
only, §6's decision still stands), so there is still no artifact for
`wasm-bindgen` to consume, and `wasm-bindgen` (the CLI) was not
invoked by Stage 443–444 or any stage before it. What changed is
narrower than the diagram's box boundaries suggest: the crate's own
Rust source, plus its full dependency graph including `getrandom`,
now compiles for `wasm32-unknown-unknown` — a necessary but not
sufficient condition for anything below it in the diagram to become
real.

**Still unchanged by Stage 441–445:**

- `[lib]` `crate-type` — still `["rlib"]` only, no `cdylib`.
- `wasm-bindgen` (the CLI) — still never invoked; only the
  `wasm-bindgen` LIBRARY crate compiles, as `getrandom`'s own
  `wasm_js`-feature-gated internal dependency, not a direct dependency
  or CLI invocation of this repository.
- `wasm-pack` — still not installed or adopted.
- No `package.json` script — the `RUSTFLAGS` invocation is still run
  by hand, per-invocation, never scripted or baked into a committed
  `.cargo/config.toml`.
- No `.wasm` file or generated JS glue exists anywhere.
- No Runtime/Worker activation; no `encrypt`/`decrypt` execution; no
  NIP-44 code path executed.

## See also

- `docs/runtime_wasm_toolchain_readiness.md` (Stage 417, updated Stage
  425–426) — the inventory this contract's "(future)" boxes are drawn
  against, and the record of which toolchain pieces are now installed
  as environment capabilities vs. still not adopted (`wasm-pack`).
- `docs/runtime_wasm_getrandom_policy.md` (Stage 441) and
  `docs/runtime_wasm_build_observation.md` §7–8 (updated Stage 445) —
  the policy and recorded `cargo check`/`cargo build` SUCCESS behind
  this document's new §7.
- `docs/runtime_wasm_build_plan.md` (Stage 393) — the original pipeline
  shape (crate → wasm32 target → bindgen → loader → Runtime Provider)
  this contract extends all the way to `Runtime`.
- `docs/runtime_internal_execution_contract.md` — the authoritative
  12-link table naming `FedosWasmArtifact`/`FedosWasmBoundary`/
  `FedosExecutionBackend` as links 11/10/9 respectively.
- `docs/runtime_wasm_migration_plan.md` (Stage 421) — the stage-by-stage
  MIGRATION order that would eventually walk this diagram top to
  bottom, one reviewed stage at a time; item 3 ("Build確認"/"Build
  confirmation") is where §5's first command would actually run.
- `docs/runtime_wasm_build_observation.md` (Stage 437) — the actual,
  recorded result of running §5's `cargo check`/`cargo build` lines
  against the `rlib`-only crate this §6 decision fixes.
