# Runtime backend verification policy — Stage 412 (docs only, no code)

**Status: this document adds no code.** It fixes, in writing, the
`cargo` verification requirement every future stage MUST satisfy
before landing any change to `packages/fedos-core-rust` or introducing
any WASM tooling per `docs/runtime_backend_implementation_sequence.md`
(Stage 410, items 2–6). It does not run any command itself and does
not change any existing test, gate, or file.

## 1. The environment problem this policy responds to

This repository, as checked out on the machine this stage was
authored on, lives at a path under:

```
C:\Users\<user>\OneDrive - 公立諏訪東京理科大学\デスクトップ\OS
```

That path contains non-ASCII (Japanese) characters. With **zero**
Rust source change, `cargo check` succeeds, but `cargo check --tests`
and `cargo test` fail: mingw-w64's linker (the Windows GNU toolchain
`rustc` uses by default on this machine) cannot correctly link the
`serde_derive`/`getrandom` dev-dependency build scripts when object
files are produced under a non-ASCII path. `docs/runtime_backend_risk_
register.md` (Stage 411, Risk 2) names this as a confirmed,
reproducible environment property — not a code defect, and not
something any Stage 1–408 Rust change caused or could have avoided by
writing different code.

## 2. The policy

**For every future stage that touches `packages/fedos-core-rust`'s
Rust source, `Cargo.toml`, or introduces a `wasm32`/`wasm-bindgen`
build step (`docs/runtime_backend_implementation_sequence.md` items
2–6), `cargo check`, `cargo check --tests`, and `cargo test` MUST all
be run to green — and, wherever this environment's OneDrive-path
linker issue would block `cargo check --tests`/`cargo test`, the stage
MUST run them from one of the following instead of skipping them:**

1. **WSL (Windows Subsystem for Linux).** Clone or bind-mount the
   repository so its effective path inside WSL is a normal Linux path
   (e.g. `/home/<user>/OS` or a `/mnt/c/...` path whose full ASCII
   prefix does not matter to the Linux-side linker) — WSL's native
   `ld`/`gcc` toolchain is not affected by this issue at all, since the
   failure is specific to mingw-w64 resolving non-ASCII Windows paths.
2. **An ASCII-only path on Windows.** Copy or clone the repository to
   a path containing only ASCII characters (e.g. `C:\dev\OS`) and run
   `cargo check --tests`/`cargo test` there instead of in place.

**`cargo check` alone (no test target) is NOT sufficient** to satisfy
this policy for any stage that changes Rust behavior, not just Rust
syntax — it does not compile or run `#[test]` functions, so it cannot
catch a broken test, a broken vector check, or a linking-only failure
in a dev-dependency. It remains useful as a fast, cheap first pass
(and is what stays runnable directly in this environment today), but
it is not a substitute for `cargo check --tests`/`cargo test` before a
stage is considered verified.

## 3. What "possible, if any" means for a given stage

Not every future stage can necessarily reach a WSL or ASCII-path
environment before it lands (e.g. a docs-only or TypeScript-only
stage has no Rust to check at all, and this policy does not apply to
it). The requirement is scoped precisely:

- **Applies:** any stage that adds, edits, or deletes a `.rs` file,
  `Cargo.toml`, or `Cargo.lock`-affecting dependency; any stage that
  adds a `wasm32` build target or `wasm-bindgen`/`wasm-pack` step.
- **Does not apply:** any stage whose diff is entirely `.md`/`.ts`
  files with no `packages/fedos-core-rust` change (such as Stage
  409–411 and this stage itself) — for these, the existing
  `packages/fedos-core-rust` diff is empty, so its cargo state is
  identical before and after by construction, and re-running `cargo
  test` would only re-confirm a fact this policy already establishes
  once, not verify anything this stage changed.
- **When the requirement applies but cannot be satisfied in the
  authoring environment** (no WSL available, no ASCII-path clone
  possible), the stage MUST say so explicitly in its own verification
  record — silently reporting only `cargo check` as if it were
  equivalent to `cargo check --tests`/`cargo test` is not acceptable
  under this policy.

## 4. Relationship to existing verification documents

This policy narrows, for the Rust/WASM-touching subset of future
stages, the general test-gate list `docs/implementation_phase_roadmap.md`
§5 already fixes ("`cargo check` — GREEN... `cargo test` — GREEN, and
the RFC/NIST vector tests specifically must still pass unmodified").
That document did not yet name the OneDrive/mingw-w64 path issue this
stage's authoring environment surfaced; this document is the
concrete addendum, not a replacement — §5's requirement to keep every
existing vector test passing, unmodified, still stands in full.

## 5. What this stage's own verification looks like

Stage 409–412 (this document included) touches only `docs/*.md` — no
`.rs` file, no `Cargo.toml`, no `wasm32` target. Per §3, the cargo
requirement does not apply to it. `npm run typecheck` and `npm test`
remain the applicable gates (Stage 415), and `packages/fedos-core-rust`
being byte-for-byte unchanged is itself confirmed by the guard test
added in Stage 414 (dependency count and `pub fn` count assertions),
not by a fresh `cargo test` run.

## See also

- `docs/runtime_backend_risk_register.md` (Stage 411) — Risk 2, the
  concrete incident this policy is written in response to.
- `docs/implementation_phase_roadmap.md` §5 — the general test-gate
  list this policy narrows for Rust/WASM-touching stages.
- `docs/runtime_backend_implementation_sequence.md` (Stage 410) —
  items 2–6, the specific future stages this policy's `cargo`
  requirement binds.
- `docs/fedos_core_rust_safety.md` — the crate's own binding safety
  rules, unaffected by and independent of this environment-specific
  verification addendum.
