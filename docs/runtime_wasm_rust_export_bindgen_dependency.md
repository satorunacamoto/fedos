# FedOS Rust — `wasm-bindgen` Dependency Adoption (Prototype EXECUTION Phase 009)

**Status: this document records a SINGLE, narrowly-scoped `Cargo.toml`
change — adding `wasm-bindgen` as a direct `[dependencies]` entry
(Stage 985) — following `docs/rust_dependency_adoption.md`'s own "one
dependency per Stage, explicitly reviewed" convention (§12 log
precedent: `chacha20poly1305`/`hkdf`/`zeroize`+`secrecy`+`subtle`/
`argon2`/`aes-gcm`/`getrandom`). It adds ONLY the dependency line. No
`#[wasm_bindgen]` attribute, no new Rust function, no `version()`, and
no TypeScript change is made.**

## 1. What this Phase adds

```toml
wasm-bindgen = "0.2.126"
```

Added to `packages/fedos-core-rust/Cargo.toml`'s `[dependencies]`
table, immediately after `k256` (the most recently adopted production
dependency, Stage 194).

## 2. Why this version, and why now

`docs/runtime_wasm_rust_export_readiness_review.md` (Prototype
EXECUTION Phase 008) found `wasm-bindgen` was NOT a direct dependency
— it reached this crate's `wasm32-unknown-unknown` build graph ONLY
transitively, via `getrandom`'s own internal `wasm_js`-feature
dependency (`docs/runtime_wasm_bindgen_version_policy.md` §2) — and
identified that the `#[wasm_bindgen]` proc-macro attribute REQUIRES a
direct dependency to be usable at all in `src/lib.rs`.

**`0.2.126`** is not a new choice — it is the EXACT version this
crate's build graph already resolves to transitively, and the EXACT
version `wasm-bindgen-cli` is already pinned to
(`docs/runtime_wasm_bindgen_version_policy.md` §1). Declaring it
directly at the SAME version avoids introducing any version skew
between the CLI, the transitive resolution, and this new direct entry.

## 3. Dependency-only adoption — verified

- **Crate + exact version:** `wasm-bindgen` v0.2.126.
- **License:** MIT OR Apache-2.0 — same dual-license family as every
  other dependency already adopted in this crate.
- **Feature configuration:** default features, unmodified — the same,
  standard feature set every `wasm-bindgen`-generated JS glue in this
  repository's own `packages/fedos-core-rust/pkg/` output already
  depends on.
- **Transitive dependency count:** `wasm-bindgen`'s own subtree
  (`cargo tree -e normal -p wasm-bindgen`) is `cfg-if`, `once_cell`,
  `wasm-bindgen-macro` → `wasm-bindgen-macro-support` → `syn`/`bumpalo`/
  `wasm-bindgen-shared`, plus `proc-macro2`/`quote`/`unicode-ident`.
  `cfg-if`/`once_cell`/`proc-macro2`/`quote`/`unicode-ident` are
  already present in the graph via other paths; the packages newly
  compiled by this ONE line, confirmed directly against `cargo check`'s
  own build log, are `wasm-bindgen`, `wasm-bindgen-macro`,
  `wasm-bindgen-macro-support`, `wasm-bindgen-shared`, `bumpalo`, and
  `syn` (v2.0.118).
- **Build-script presence:** NO — `wasm-bindgen` itself ships no
  `build.rs`.
- **`unsafe` presence:** `wasm-bindgen` uses `unsafe` internally
  (inherent to a JS-interop/ABI crate — same category of exception
  already recorded for `getrandom`'s own FFI `unsafe` usage). This does
  not affect `packages/fedos-core-rust`'s own
  `#![forbid(unsafe_code)]`, which governs only this crate's code, not
  a dependency's.
- **MSRV impact:** none observed — `cargo check` succeeds unchanged
  against this crate's existing MSRV floor.
- **What was DONE:** exactly one `[dependencies]` line added; `cargo
  check` reconfirmed green immediately after.
- **What was NOT done:** no `#[wasm_bindgen]` attribute anywhere in
  `src/lib.rs`; no new Rust function of any kind, `version()` included;
  no import or reference to the `wasm_bindgen` crate anywhere in
  `src/lib.rs`'s own code; Rust public API remains exactly 27 `pub fn`,
  byte-for-byte unchanged from Prototype EXECUTION Phase 008.

## 4. Generated JS glue — not regenerated, not committed

This Phase does NOT run `npm run build:wasm`. No `target/`,
`Cargo.lock`, or `pkg/` output is committed — all three remain
gitignored, exactly as every prior Stage in this arc has kept them.
Even once a future stage DOES regenerate the JS glue (after adding
`#[wasm_bindgen] pub fn version()`), its export list would still not
be committed — this repository's own convention
(`docs/runtime_wasm_js_glue_contract.md` §7) has never committed a
generated artifact and this Phase does not change that.

## 5. What this Phase does NOT do

- Does **not** add any Rust function.
- Does **not** add `version()`.
- Does **not** add `#[wasm_bindgen]` to anything.
- Does **not** change `src/runtime/fedos_wasm_loader.ts` or any other
  TypeScript file.
- Does **not** regenerate or commit the JS glue/`.wasm` output.
- Does **not** commit `target/`, `Cargo.lock`, or `pkg/`.
- Does **not** connect to Worker or to any Production runtime path.
- Does **not** change `package.json`.

## 6. Next Phase (not this one)

A future, separate, explicitly-reviewed stage would add
`#[wasm_bindgen] pub fn version() -> String` as the crate's 28th `pub
fn` — the minimal candidate `docs/runtime_wasm_rust_export_readiness_review.md`
§4 already named — now that this Phase makes the attribute usable at
all. This Phase implements none of that.

## 7. See also

- `docs/runtime_wasm_rust_export_readiness_review.md` (Prototype
  EXECUTION Phase 008) — identified this exact dependency need and
  named `version()` as the eventual first candidate this Phase
  prepares for.
- `docs/runtime_wasm_bindgen_version_policy.md` — the CLI/crate
  version-alignment policy this Phase's own `0.2.126` pin matches.
- `docs/rust_dependency_adoption.md` §12 — the "one dependency per
  Stage" adoption log convention this Phase follows.
- `packages/fedos-core-rust/Cargo.toml` (Stage 985) — the real
  `[dependencies]` change this document describes.
