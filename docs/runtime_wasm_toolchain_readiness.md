# FedOS WASM toolchain readiness — Stage 417 (updated Stage 425–426, 445)

**Status: this document adds no code.** It is a plain inventory of
what the eventual real WASM build (`docs/runtime_wasm_build_plan.md`,
Stage 393) would require. Stage 417 confirmed all six pieces were
missing. Stage 425 performed a MINIMAL, real toolchain PREFLIGHT on
this development machine — installing the `wasm32-unknown-unknown`
target and `wasm-bindgen-cli` as local ENVIRONMENT capabilities —
while deliberately NOT installing `wasm-pack`, NOT writing a build
script, and NOT generating or committing any artifact. Stage 426
updates this table to reflect that preflight. **None of this changes
the repository**: no `Cargo.toml`/`package.json` edit, no new tracked
file, no `.wasm`/generated-bindings artifact, no Rust public API
change. A toolchain existing on a machine is not the same thing as
this repository depending on, building with, or shipping it — see §3.

## 1. The six items, current state

| # | Item | State |
|---|---|---|
| 1 | `wasm32` target (`wasm32-unknown-unknown`) | **Installed** (environment capability, Stage 425) — `rustup target list --installed` includes `wasm32-unknown-unknown`. NOT referenced by `Cargo.toml`/any build config in this repository. |
| 2 | `wasm-bindgen-cli` | **Installed** (environment capability, Stage 425) — `wasm-bindgen --version` reports `0.2.100` via `cargo install wasm-bindgen-cli`. NOT a `Cargo.toml`/`package.json` dependency; NOT referenced by any script in this repository. |
| 3 | `wasm-pack` | **Not Adopted** (deliberate policy decision, not merely absent) — Stage 425's own adoption plan explicitly excludes it; confirmed absent (`wasm-pack --version` fails, command not found). |
| 4 | Build script (a script driving crate → target → bindgen) | **Not Added** — no shell/PowerShell/npm script anywhere in this repository invokes the now-installed toolchain. `package.json`'s `scripts` are unchanged. |
| 5 | Generated `.wasm` artifact | **Not Committed** — no `.wasm` file exists anywhere in this repository's tracked tree. |
| 6 | Generated JS bindings (bindgen glue code) | **Not Committed** — no bindgen-produced `.js`/`.d.ts` glue module exists anywhere in this repository's tracked tree. |

Items 1–2 moved from "Not Installed" to "Installed" as a MACHINE-LOCAL
fact only (§3). Items 3–6 are unchanged in substance, with wording
tightened to distinguish a deliberate non-adoption (item 3) from a
build artifact that must never be committed regardless of whether it
is ever locally generated (items 5–6).

## 2. How each row was confirmed, Stage 425

- **`wasm32` target** — `rustup target add wasm32-unknown-unknown`
  was run; `rustup target list --installed` subsequently listed both
  `wasm32-unknown-unknown` and the pre-existing
  `x86_64-pc-windows-gnu`. `packages/fedos-core-rust/Cargo.toml`'s
  `[lib]` section still declares `crate-type = ["rlib"]` only — no
  `cdylib` target was added, and nothing in `Cargo.toml` requests this
  target; the crate itself is unaware the target now exists on this
  machine.
- **`wasm-bindgen-cli`** — `cargo install wasm-bindgen-cli --version
  0.2.100` was run; `wasm-bindgen --version` subsequently reported
  `wasm-bindgen 0.2.100`. This installs a CLI BINARY into the local
  Cargo bin directory (`~/.cargo/bin`) — it is not, and does not
  create, a `Cargo.toml` dependency of `packages/fedos-core-rust`, nor
  a `package.json` dependency of this repository.
- **`wasm-pack`** — deliberately NOT installed. `wasm-pack --version`
  fails with "command not found", confirming the decision held, not
  merely that installation was skipped by oversight.
- **Build script** — still no script anywhere in this repository
  invokes `cargo build --target wasm32-*`, `wasm-bindgen`, or
  `wasm-pack`. `package.json`'s `scripts` section is byte-for-byte
  unchanged by Stage 425–432 — adding a script is explicitly out of
  scope for this batch (see `docs/runtime_wasm_build_contract.md`
  §4).
- **Generated `.wasm` artifact / JS bindings** — Stage 425 did not run
  `cargo build --target wasm32-unknown-unknown` or `wasm-bindgen`
  against any crate output; no artifact of either kind was produced,
  so none exists to commit. Confirmed by the existing filesystem-scan
  guard tests (e.g. `test/runtime_wasm_artifact.test.ts` item 15,
  `test/runtime_wasm_toolchain.test.ts`).

## 3. Environment capability vs. repository state — the distinction this stage turns on

Installing `wasm32-unknown-unknown` and `wasm-bindgen-cli` changes
what THIS MACHINE can do; it changes NOTHING about what THIS
REPOSITORY declares, depends on, or ships:

- `Cargo.toml` — byte-for-byte unchanged; still 10 production
  dependencies, no `wasm-bindgen` entry, `[lib]` still `crate-type =
  ["rlib"]` only.
- `package.json` — byte-for-byte unchanged; still 2 dependencies, no
  new `scripts` entry.
- `packages/fedos-core-rust`'s public API — unchanged; still 27
  `pub fn`s.
- No file in this repository's tracked tree changed as a result of
  running `rustup target add`/`cargo install wasm-bindgen-cli` — both
  commands write only to this machine's `~/.rustup`/`~/.cargo`
  directories, entirely outside this repository's working tree.

A future clone of this repository on a machine WITHOUT this preflight
run would build, test, and pass every guard exactly as it does here —
nothing in the repository itself requires or assumes the toolchain
exists. This is the same "toolchain is installed/available as
environment capability, but build remains non-operational" framing
`docs/runtime_wasm_build_contract.md` (Stage 427) and this stage's
README entry (Stage 430) both use.

## 4. What this readiness check is still not

- It does not install `wasm-pack` — deliberately excluded (item 3).
- It does not write a build script, and does not add any
  `package.json` script.
- It does not run `cargo build --target wasm32-unknown-unknown` or
  `wasm-bindgen` against any crate output (Stage 427/431 keep this
  explicitly out of scope; §5 records that a LATER, separate stage,
  441–444, did run `cargo check`/`cargo build` — never `wasm-bindgen`
  — against this target).
- It does not produce or commit a `.wasm` file or any generated JS
  bindings.
- It does not change `Cargo.toml`, `package.json`, or any Rust public
  API — `packages/fedos-core-rust`'s 27 `pub fn`s are untouched.
- It does not activate Runtime or Worker, and does not execute
  `encrypt`/`decrypt` in any form.

## 5. Update — Stage 445: `getrandom` `wasm_js` backend now compiles

Items 1–2 (`wasm32-unknown-unknown` target, `wasm-bindgen-cli`) were
already "Installed" as of Stage 425–426. Stage 441–444 adds a NEW,
SEPARATE fact this table did not previously track: whether the
CRATE ITSELF (`packages/fedos-core-rust`, not just the toolchain
around it) actually compiles for that target. As of Stage 443–444:

| # | Item | State |
|---|---|---|
| 7 | `getrandom` `wasm_js` backend (Cargo feature + `--cfg getrandom_backend="wasm_js"`) | **Applied, verified green** — `Cargo.toml`'s `getrandom` entry now enables `features = ["wasm_js"]` (Stage 442); `RUSTFLAGS='--cfg getrandom_backend="wasm_js"' cargo check`/`cargo build --target wasm32-unknown-unknown` both SUCCEED (Stage 443–444; `docs/runtime_wasm_build_observation.md` §7). The `--cfg` flag itself is NOT baked into any committed file (no `.cargo/config.toml`) — it must be supplied per-invocation via `RUSTFLAGS`, exactly as documented in `docs/runtime_wasm_getrandom_policy.md`. |

This does NOT change items 3–6's state — `wasm-pack` is still not
adopted, no build script exists, and no `.wasm`/generated JS bindings
exist (a `cdylib` target is still required for those, and is still not
added). Item 7 answers a narrower question than items 3–6: not "is
this crate a loadable WASM module" but "does this crate's own source,
plus its entire dependency graph, actually compile for
`wasm32-unknown-unknown` at all" — the answer is now yes, where it was
previously no (`docs/runtime_wasm_build_observation.md` §2–3, the
pre-Stage-442 failing run).

## 6. Why this preflight, and why now

`docs/runtime_backend_implementation_sequence.md` (Stage 410) named
"WASM build toolchain planning final check" as sequence item 1 and
"`wasm32` target / `wasm-bindgen` introduction" as item 2.
`docs/runtime_wasm_migration_plan.md` (Stage 421) names the same as
its own item 2, "Toolchain introduction". Stage 425 is the MINIMAL
real execution of that item: install exactly the two components the
adoption plan calls for (`wasm32-unknown-unknown`, `wasm-bindgen-cli`),
explicitly withhold the third (`wasm-pack`), and stop — no build, no
bindgen run, no artifact, no repository change — leaving item 3
("Build確認"/"Build confirmation") for a later, separate,
explicitly-reviewed stage.

## See also

- `docs/runtime_wasm_build_plan.md` (Stage 393) — the intended pipeline
  shape this readiness check inventories against.
- `docs/runtime_wasm_build_contract.md` (Stage 418, updated Stage 427)
  — the fixed, end-to-end diagram from Rust Source through to Runtime,
  now naming the exact future build commands.
- `docs/runtime_backend_implementation_sequence.md` (Stage 410) / item
  1–2, and `docs/runtime_wasm_migration_plan.md` (Stage 421) / item 2
  — the sequence steps this document's Stage 425 preflight satisfies.
- `docs/runtime_backend_risk_register.md` (Stage 411) — Risks 2/3/4
  (OneDrive path, Smart App Control, `target`/`Cargo.lock` guard),
  reviewed and found not to block this minimal preflight (no `cargo
  build`/`wasm-bindgen` was actually run against the crate, so no
  `target/` artifact or lock file was produced by this stage).
- `packages/fedos-core-rust/src/wasm_loader.ts` (Stage 63) — the
  existing, permanently-disabled, hand-written loader placeholder
  referenced in §2.
- `docs/runtime_wasm_getrandom_policy.md` (Stage 441) and
  `docs/runtime_wasm_build_observation.md` §7–8 (updated Stage 445) —
  the policy and recorded result behind §5's new item 7.
