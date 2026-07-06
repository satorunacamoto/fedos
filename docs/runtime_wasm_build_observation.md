# FedOS WASM build observation — Stage 435–437 (observation only, no code fix); updated Stage 445 with the Stage 441–444 `getrandom` `wasm_js` result

**Status: this document records an OBSERVATION, not a fix.** Stage
435–436 ran two real commands against `packages/fedos-core-rust`
EXACTLY AS IT EXISTS TODAY — `crate-type = ["rlib"]`, no `cdylib`, no
`Cargo.toml` edit of any kind (per `docs/runtime_wasm_build_contract.md`
§6's Stage 434 decision) — to observe how far the existing,
unmodified crate reaches toward a `wasm32-unknown-unknown` target.
Both commands FAILED at the same point, for the same reason. This
document classifies that failure and stops — it does not patch
`Cargo.toml`, does not add a feature flag, and does not attempt any
other code-level fix. No `.wasm` file was produced by either run.

## 1. Commands run

```
# Stage 435
cd packages/fedos-core-rust
cargo check --target wasm32-unknown-unknown

# Stage 436
cd packages/fedos-core-rust
cargo build --target wasm32-unknown-unknown
```

Both were run from this repository's actual working tree, with the
`wasm32-unknown-unknown` target and `wasm-bindgen-cli` already
installed as environment capabilities (Stage 425;
`docs/runtime_wasm_toolchain_readiness.md`). Neither command's
`Cargo.toml`/`Cargo.lock` inputs were hand-edited before running —
`Cargo.lock` was freshly resolved by `cargo` itself (see §4).

## 2. Result: FAILED, identically, at the same dependency

**Both `cargo check --target wasm32-unknown-unknown` and `cargo build
--target wasm32-unknown-unknown` FAILED**, at the exact same point in
the dependency graph, with the exact same compiler error:

```
error: The wasm32-unknown-unknown targets are not supported by default;
you may need to enable the "wasm_js" configuration flag. Note that
enabling the `wasm_js` feature flag alone is insufficient. For more
information see: https://docs.rs/getrandom/0.3.4/#webassembly-support

error: could not compile `getrandom` (lib) due to 1 previous error
```

The failure occurs while compiling the `getrandom` crate itself (a
transitive/direct dependency, not `fedos-core-rust`'s own code) —
`fedos-core-rust`'s own `src/lib.rs`/`src/crypto/*` files were never
reached by the compiler in either run; the build stopped one layer
below them.

## 3. Classification

Per this batch's required failure taxonomy (dependency /
target / crate-type / feature / std / getrandom / k256), this failure
classifies as:

**→ `getrandom` problem.**

Specifically: `getrandom` v0.3.4 (this crate's adopted CSPRNG
dependency, Stage 104) does NOT support `wasm32-unknown-unknown` out
of the box starting with its 0.3 line — as of that version, WASM
support requires an explicit opt-in (`getrandom`'s own `wasm_js`
Cargo feature, PLUS a `--cfg getrandom_backend="wasm_js"` compiler
flag per the crate's own documentation, linked directly in the error
message). Neither is configured in `Cargo.toml` today, and configuring
either would itself BE a `Cargo.toml` change — explicitly forbidden
for this batch.

**Ruled out, explicitly, by direct evidence:**

- **NOT a dependency-unsupported problem in general** — every OTHER
  dependency up to this point in the graph (`typenum`, `zeroize`,
  `subtle`, `cfg-if`, `cmov`, `rand_core`, `const-oid` ×2,
  `opaque-debug`, `base16ct`, `base64ct`, `secrecy`, `der`, `ff`,
  `ctutils`, `group`, `generic-array`) compiled successfully for
  `wasm32-unknown-unknown` before the build reached `getrandom`. This
  is a single-dependency blocker, not a wholesale incompatibility.
- **NOT a `target` problem** — the `wasm32-unknown-unknown` target
  itself is correctly installed and recognized by `rustc`/`cargo`
  (confirmed Stage 425/433); the compiler reached and started
  compiling multiple crates against it before failing.
- **NOT a `crate-type` problem** — the failure occurs during
  dependency compilation, before `fedos-core-rust`'s own `[lib]`
  section (`crate-type = ["rlib"]`) is ever linked against; changing
  `crate-type` would not affect this error at all.
- **NOT a `k256` problem** — the compiler never reached `k256` (or
  `elliptic-curve`, `ff`'s dependent `group`, or any of `k256`'s own
  direct tree) in either run; it failed one step earlier, on
  `getrandom`, which several of `k256`'s dependencies (e.g. `rand_core`)
  pull in transitively.
- **NOT a `std`-dependency problem** — no "can't find crate for
  `std`"/`#![no_std]`-shaped error appeared anywhere in either run;
  the failure is a `compile_error!` macro inside `getrandom`'s own
  source, deliberately authored by that crate to explain a missing
  opt-in, not a toolchain/`std`-availability failure.
- **NOT a `fedos-core-rust`-authored feature problem** — no feature
  flag anywhere in `packages/fedos-core-rust/Cargo.toml`'s existing 10
  production dependencies caused this; it is `getrandom`'s OWN,
  upstream feature-gating design (its `wasm_js` feature must be
  explicitly requested by whichever crate/workspace ultimately depends
  on it) that this repository has never opted into, for either
  `wasm32` target.

## 4. `cdylib` was not added; the observation used the crate exactly as it is

Per `docs/runtime_wasm_build_contract.md` §6 (Stage 434), both runs
used `[lib]` `crate-type = ["rlib"]`, unedited. Adding a `cdylib`
target would NOT have changed this result — the failure occurs before
linking, while compiling a dependency crate, entirely independent of
what artifact shape `fedos-core-rust` itself would eventually produce.
This confirms §6's own reasoning: the `crate-type` decision and the
`getrandom`-support decision are genuinely independent, and bundling
them into one stage would not have produced useful additional signal.

`cargo` resolved and wrote a fresh `Cargo.lock` as a side effect of
both commands (`Locking 69 packages to latest compatible versions`) —
this is `cargo`'s own normal dependency-resolution behavior, not a
manual edit, and per this repository's existing "`Cargo.lock` not
committed" convention (`docs/rust_dependency_adoption.md` §7,
`packages/fedos-core-rust/.gitignore`) it was never staged or
committed; `git status` showed no `Cargo.lock`/`target` diff at any
point during or after Stage 435–436 (both are gitignored).

## 5. What was NOT done

- `Cargo.toml` was NOT edited — no `wasm_js` feature was added to the
  `getrandom` entry, no `[target.'cfg(...)'.dependencies]` section was
  added, no `.cargo/config.toml` `rustflags` was added.
- `crate-type` was NOT changed — still `["rlib"]` only, no `cdylib`.
- `wasm-bindgen` was NOT run — the failure occurred at the `cargo
  build` step, before there was any artifact for `wasm-bindgen` to
  consume even if it had been invoked; it was not invoked.
- `wasm-pack` was NOT installed or invoked.
- No `package.json` script was added.
- No generated artifact of any kind (`.wasm`, `.rlib` for this crate
  specifically, JS glue) exists as a result of this observation — the
  build never reached `fedos-core-rust`'s own crate compilation step,
  and `target/`/`Cargo.lock` were deleted after the observation was
  recorded (never committed; both are gitignored).
- No attempt was made to work around, silence, or reclassify the
  `getrandom` error as anything other than what it is.

## 6. What a future stage would need to decide

This observation surfaces a genuine, concrete decision point for a
future, separate, explicitly-reviewed stage — NOT resolved here:

1. **Whether to enable `getrandom`'s `wasm_js` feature at all**, which
   requires (per `getrandom` 0.3's own documentation) BOTH a
   `Cargo.toml` feature declaration AND a `--cfg
   getrandom_backend="wasm_js"` compiler flag (typically supplied via
   `.cargo/config.toml` or `RUSTFLAGS`) — a REAL `Cargo.toml`/build
   configuration change, requiring its own review under
   `docs/rust_dependency_adoption.md`'s existing dependency-change
   discipline, since `wasm_js` pulls in a JS-interop code path
   (`getrandom` calls into `crypto.getRandomValues` via `wasm-bindgen`
   internally) that this crate has never depended on before.
2. **Whether that review happens before or alongside `cdylib`
   adoption** — since a real, loadable `.wasm` artifact needs BOTH a
   working `getrandom` backend AND a `cdylib` target, a future stage
   could reasonably decide to review them together as "the real WASM
   artifact stage" (`docs/runtime_wasm_migration_plan.md` item 4)
   rather than as two separate stages — this document does not decide
   that ordering, only surfaces that both gaps now exist and are
   named.
3. **Whether `k256`'s own transitive `rand_core`/`getrandom`
   exposure** (already reviewed once, per `Cargo.toml`'s existing
   "REVIEWED EXCEPTION" comment for `rand_core` — see
   `docs/nip44_dependency_adoption.md`) needs re-review once
   `getrandom` actually compiles for `wasm32` — today that transitive
   edge exists but was never exercised for this target, since the
   build never got far enough to reach `k256` itself.

None of these three items is decided, started, or scheduled by this
document — they are named so the next stage that picks up
`docs/runtime_wasm_migration_plan.md` item 3/4 has an exact, current
starting point instead of rediscovering this same `getrandom` error
from scratch.

## 7. Update — Stage 441–444: `wasm_js` opt-in applied, `cargo check`/`cargo build` now SUCCEED

Stage 441 fixed the policy this section applies
(`docs/runtime_wasm_getrandom_policy.md`): `getrandom` 0.3.x's
`wasm32-unknown-unknown` support requires BOTH its own `wasm_js`
Cargo feature AND a `--cfg getrandom_backend="wasm_js"` compiler flag,
supplied via `RUSTFLAGS`. Stage 442 made the ONE `Cargo.toml` change
this required — adding `features = ["wasm_js"]` to the existing
`getrandom = "0.3"` entry, version unchanged, no new
`[dependencies]` line, `wasm-bindgen` still not a direct dependency of
this crate (`getrandom`'s own `Cargo.toml` carries that shim
internally). Stage 443–444 re-ran exactly the two commands §1 named,
now WITH the required `RUSTFLAGS`:

```
# Stage 443
cd packages/fedos-core-rust
RUSTFLAGS='--cfg getrandom_backend="wasm_js"' cargo check --target wasm32-unknown-unknown

# Stage 444
cd packages/fedos-core-rust
RUSTFLAGS='--cfg getrandom_backend="wasm_js"' cargo build --target wasm32-unknown-unknown
```

**Both SUCCEEDED** — exit code `0`, ending in `Finished \`dev\` profile
[unoptimized + debuginfo] target(s)`, with `getrandom v0.3.4` and every
dependency in the graph (including `k256`, never reached by §2's
failed run) compiling cleanly for `wasm32-unknown-unknown`, followed
by `fedos-core-rust` itself. This is the FIRST time this crate's own
`src/lib.rs`/`src/crypto/*` source has actually been compiled for a
`wasm32` target — Stage 435–437's run never got that far.

**What was produced, and what was not:**

- `target/wasm32-unknown-unknown/debug/libfedos_core_rust.rlib` was
  produced — an `.rlib`, matching `[lib]`'s unchanged `crate-type =
  ["rlib"]` (still no `cdylib`, per `docs/runtime_wasm_build_contract.md`
  §6's still-standing deferral, §8 below).
- **No `.wasm` file was produced anywhere** — confirmed by a recursive
  scan of `target/` for `*.wasm` after the build; a `.wasm` artifact
  requires a `cdylib` target, deliberately not added.
- **`wasm-bindgen` (the CLI) was NOT run** — only the `wasm-bindgen`
  library crate (v0.2.126) was compiled, as `getrandom`'s OWN
  `wasm_js`-feature-gated internal dependency, exactly as
  `docs/runtime_wasm_getrandom_policy.md` §2 described in advance; no
  `wasm-bindgen` CLI invocation, no generated JS glue file, no
  `_bg.js`/`_bg.wasm`/`.d.ts` of any kind exists anywhere in this
  repository as a result.
- `Cargo.lock` was freshly resolved by `cargo` as a side effect of both
  commands (gitignored, never staged); `target/` (gitignored) was
  deleted after this observation was recorded, per this batch's own
  scope (Stage 448).
- `git status` showed no diff beyond the expected `Cargo.toml` edit and
  new `docs/runtime_wasm_getrandom_policy.md` file at every point
  during and after Stage 443–444.

**Classification: RESOLVED.** The `getrandom` blocker §2–3 classified
is no longer reproducible once the `wasm_js` feature (Stage 442) and
the `--cfg getrandom_backend="wasm_js"` flag (Stage 443–444's
`RUSTFLAGS`) are both present. §2's ORIGINAL failing run remains an
accurate historical record of the crate's state BEFORE Stage 441–444 —
it is not retroactively edited — but it no longer describes the
crate's CURRENT state.

## 8. What Stage 441–444 still did not do

- `cdylib` was NOT added to `[lib]` — still `crate-type = ["rlib"]`
  only, per `docs/runtime_wasm_build_contract.md` §6's still-standing
  decision to defer that as its own, separately-reviewed stage.
- `wasm-bindgen` (the CLI binary) was NOT invoked — no JS glue, no
  `.wasm` `wasm-bindgen` could consume even exists yet (that requires
  `cdylib`, not added).
- `wasm-pack` was NOT installed or invoked.
- No `package.json` script was added — the `RUSTFLAGS` invocation was
  run directly by hand, exactly like every prior Stage in this arc.
- No Runtime/Worker activation of any kind; no
  `encrypt`/`decrypt`/NIP-44 code was executed; `getrandom` remains
  unimported and uncalled anywhere in `src/lib.rs`/`src/crypto/*` —
  the `wasm_js` feature changes what `getrandom` COULD compile against
  for `wasm32`, not whether this crate's production code calls it.
- No fallback/insecure PRNG was added anywhere, per
  `docs/runtime_wasm_getrandom_policy.md` §5.

## See also

- `docs/runtime_wasm_build_contract.md` §5–6 (Stage 427, 434) — the
  planned command lines this observation actually ran, and the
  `crate-type` decision this observation confirms did not affect the
  result.
- `docs/runtime_wasm_toolchain_readiness.md` (Stage 417, 425–426) —
  the toolchain state (`wasm32-unknown-unknown`/`wasm-bindgen-cli`
  installed, `wasm-pack` not adopted) this observation was run under.
- `docs/rust_dependency_adoption.md` §6–7 — the existing CSPRNG/
  `Cargo.lock` conventions this observation's §4–5 confirm were not
  violated.
- `docs/nip44_dependency_adoption.md` — the existing `k256`/`rand_core`
  "REVIEWED EXCEPTION" record referenced in §6 item 3.
- `docs/runtime_wasm_migration_plan.md` (Stage 421) — items 3–4, where
  this observation's §6 open questions would next be picked up.
- `docs/runtime_wasm_getrandom_policy.md` (Stage 441) — the policy §7's
  `wasm_js`/`--cfg getrandom_backend="wasm_js"` opt-in applies, and the
  fail-closed/no-fallback-PRNG rule that still holds after §7's result.
