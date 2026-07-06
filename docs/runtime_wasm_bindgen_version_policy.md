# FedOS `wasm-bindgen` CLI/crate version-alignment policy — Stage 473–480

**Status: this document fixes a POLICY, then Stage 474–475 apply it
once.** `docs/runtime_wasm_artifact_observation.md` §7 (Stage 469)
classified a THIRD, previously-unknown failure blocking JS glue
generation: the locally-installed `wasm-bindgen-cli` binary
(`0.2.100`, Stage 425) does not match the `wasm-bindgen` LIBRARY
version (`0.2.126`) actually compiled into `fedos_core_rust.wasm` —
`wasm-bindgen`'s bindgen format is not forward/backward compatible
across schema versions, so the CLI refuses to process a `.wasm` built
against a newer schema. This document fixes which side moves.

## 1. The policy — the CLI moves to match the crate, never the reverse

**The `wasm-bindgen-cli` binary is upgraded to match whatever
`wasm-bindgen` version the crate's dependency graph actually resolves
to (`0.2.126` today).** The crate side is NEVER pinned down to the
CLI's older version.

## 2. Why the CLI moves, and Cargo-side is never pinned old

- **`wasm-bindgen` is not a direct dependency of this crate.**
  `packages/fedos-core-rust/Cargo.toml` does not list `wasm-bindgen`
  in `[dependencies]` at all — it arrives ONLY as `getrandom`'s own
  internal `wasm_js`-feature dependency (see `Cargo.toml`'s existing
  comment on the `getrandom` entry). There is no `Cargo.toml` line
  this crate owns that could even express a `wasm-bindgen` version
  pin without adding a brand-new direct dependency this crate has
  never had — itself forbidden by this batch's own scope ("Cargo.toml
  dependency version変更" is prohibited; adding a NEW dependency line
  to pin one is a bigger change, not a smaller one).
- **Pinning `Cargo.lock` to the old version is a dead end, not a
  fix.** `Cargo.lock` is never committed
  (`docs/rust_dependency_adoption.md` §7) — a local `cargo update -p
  wasm-bindgen --precise 0.2.100` would only last until the next
  fresh `cargo build` re-resolves `Cargo.lock` from scratch (as it
  has every single run in this WASM arc, per
  `docs/runtime_wasm_build_observation.md`/
  `docs/runtime_wasm_artifact_observation.md`'s own repeated "Locking
  N packages to latest compatible versions" log lines). It would not
  be a real, durable fix — it would silently break again the next
  time anyone runs `build:wasm` from a clean `Cargo.lock`.
- **Pinning old would fight the ecosystem, not this repository.**
  `getrandom`'s `wasm_js` feature depends on whatever `wasm-bindgen`
  version its own `Cargo.toml` allows (a semver range this repository
  does not control) — `0.2.126` is simply the current latest
  compatible release upstream. A future `getrandom`/dependency update
  would very likely resolve an EVEN NEWER `wasm-bindgen`; permanently
  chasing the CLI to match whatever the graph resolves to is the only
  approach that keeps working without a `Cargo.toml`/`Cargo.lock`
  edit on every future dependency bump.
- **The CLI is a machine-local environment capability, not a
  repository dependency.** Stage 425 already established this
  category: installing/reinstalling `wasm-bindgen-cli` via `cargo
  install` writes only to this machine's `~/.cargo/bin`, never to
  `Cargo.toml`/`package.json`/`Cargo.lock` — no repository file
  changes as a result. Upgrading it to `0.2.126` is the same category
  of action Stage 425 already took (installing it in the first
  place), not a new kind of change.

## 3. What this policy does NOT do

- Does not add `wasm-bindgen` as a direct `[dependencies]` entry in
  `packages/fedos-core-rust/Cargo.toml` — it stays exactly as
  `getrandom`'s own internal, transitive dependency.
- Does not change any EXISTING `Cargo.toml` dependency's version —
  no `[dependencies]` line's version string is edited.
- Does not add a `package.json` dependency.
- Does not install or invoke `wasm-pack`.
- Does not change `build:wasm`'s script text (Stage 467 already
  fixed its input path; nothing about a CLI version needs a script
  change).
- Does not wire Runtime/Worker, call `WebAssembly.instantiate`/
  `WebAssembly.compile`, or touch `encrypt`/`decrypt`.

## 4. What a future dependency bump would need to re-check

If a future, separate stage upgrades `getrandom` (or any other
dependency reaching `wasm-bindgen` transitively) and the resolved
`wasm-bindgen` version changes again, this SAME policy applies
unchanged: re-run `cargo install wasm-bindgen-cli --version
<whatever the new resolved version is> --force` before the next
`build:wasm` attempt. This document fixes the DIRECTION of the
policy, not a specific version number frozen forever — `0.2.126` is
today's target because it is what Stage 469 observed the crate graph
actually resolving to.

## See also

- `docs/runtime_wasm_artifact_observation.md` §7–9 (Stage 469, updated
  476) — the version-mismatch failure this policy resolves, and its
  Stage 475 re-run result.
- `docs/runtime_wasm_artifact_generation_fix.md` (Stage 465–467) — the
  two EARLIER causes (no `cdylib`, wrong input path) this stage's
  fix builds on; both already resolved before this THIRD cause was
  even reachable.
- `docs/runtime_wasm_toolchain_readiness.md` (Stage 417, 425–426) —
  the original `wasm-bindgen-cli` install as a machine-local
  environment capability, the same category of action Stage 474
  repeats at a new version.
- `docs/rust_dependency_adoption.md` §7 — the "`Cargo.lock` never
  committed" convention this document's §2 relies on to rule out
  pinning the crate side.
- `src/runtime/fedos_wasm_toolchain.ts` (updated Stage 477) — where
  this policy's fixed labels (`wasmBindgenCliExpectedVersion`,
  `wasmBindgenVersionAligned`) are exposed as diagnostics.
