# FedOS Rust Export Readiness Review (Prototype EXECUTION Phase 008)

**Status: this document is a REVIEW ONLY — it adds no `#[wasm_bindgen]`
attribute, changes no Rust source, changes no `Cargo.toml`, changes no
`package.json`, changes no TypeScript, and does not connect Worker or
Production. It reviews the Rust → JS export boundary Prototype
EXECUTION Phase 007's own Pre-check found empty, and recommends what a
future, separate, explicitly-reviewed stage should do about it.**

## 1. Current Rust public API — 27 `pub fn`

`packages/fedos-core-rust/src/lib.rs` declares exactly 27 `pub fn`
(verified with the SAME regex this arc's own guard tests have used
since Stage 905: `/^\s*pub\s+fn\s+([a-zA-Z0-9_]+)/gm`):

| # | Function |
|---|---|
| 1 | `fedos_core_status` |
| 2 | `fedos_core_capabilities` |
| 3 | `random_bytes_placeholder` |
| 4 | `derive_key_placeholder` |
| 5 | `encrypt_placeholder` |
| 6 | `decrypt_placeholder` |
| 7 | `fedos_crypto_boundary_status` |
| 8 | `fedos_random_boundary_status` |
| 9 | `fedos_nonce_boundary_status` |
| 10 | `fedos_key_generation_boundary_status` |
| 11 | `fedos_key_import_boundary_status` |
| 12 | `fedos_key_export_boundary_status` |
| 13 | `fedos_capability_descriptors` |
| 14 | `fedos_algorithm_descriptors` |
| 15 | `fedos_boundary_version` |
| 16 | `fedos_boundary_features` |
| 17 | `fedos_boundary_policy_decision` |
| 18 | `fedos_key_format_descriptor_placeholder` |
| 19 | `fedos_key_usage_descriptor_placeholder` |
| 20 | `fedos_algorithm_requirements` |
| 21 | `fedos_algorithm_capabilities` |
| 22 | `fedos_algorithm_policy_decision` |
| 23 | `fedos_random_bytes_32` |
| 24 | `fedos_aead_nonce_96` |
| 25 | `fedos_generate_aead_key_32` |
| 26 | `fedos_encrypt` |
| 27 | `fedos_decrypt` |

## 2. `#[wasm_bindgen]` count — confirmed `0`

```bash
grep -c "#\[wasm_bindgen\]" packages/fedos-core-rust/src/lib.rs
# 0
```

**Matches the expected value exactly.** None of the 27 functions above
is JS-visible today, for any reason.

## 3. Current JS Glue exports — `default`/`initSync` only

Reconfirmed against the SAME generated artifact Prototype EXECUTION
Phase 007's own Pre-check built and inspected (`npm run build:wasm`,
then deleted `target/`/`Cargo.lock`/`pkg/`):

```js
export { initSync, __wbg_init as default };
```

**No crate-specific export exists.** `wasm-bindgen`'s own generic
module-loading machinery (`initSync`, `default`) is the ENTIRETY of
what the generated JS glue exposes — a direct consequence of §2's `0`
count, not a separate finding. This matches
`docs/runtime_wasm_js_glue_contract.md`'s own Stage 481 observation
and `docs/runtime_wasm_loader_dev_only_wasm_initialization_execution.md`'s
Stage 969 Pre-check, byte-for-byte, both times.

## 4. Minimal public API candidate for Prototype termination

**None of the 27 existing functions is a good `#[wasm_bindgen]`
candidate as-is.** Every one returns either a custom `struct`
(`FedosCoreStatus`, `FedosBoundaryVersion`, …), a custom `enum`
(`FedosCoreState`, `FedosBoundaryFeature`, …), or a `&'static [...]`
slice — none of which crosses the `wasm-bindgen` ABI boundary without
EITHER annotating the struct/enum itself with its own `#[wasm_bindgen]`
(expanding the bound surface well past "one minimal function"), OR
rewriting the function's own return type into something JS-primitive
(a breaking change to the EXISTING native Rust API, which this whole
arc has kept stable since Stage 74).

**Recommendation: a future, separate, explicitly-reviewed stage should
add ONE NEW, minimal, JS-only-purposed function — NOT retrofit any of
the 27 existing ones:**

```rust
#[wasm_bindgen]
pub fn version() -> String {
    "1.0.0".to_string()
}
```

- Mirrors `fedos_boundary_version()`'s own already-fixed `1.0.0` value
  (§1, #15) — the semantic content already exists in the crate; only
  the JS-facing SHAPE (a `String`, not a custom struct) is new.
- `String` is one of `wasm-bindgen`'s few directly-supported return
  types — no companion struct/enum annotation needed, no ABI
  conversion code to review.
- **Zero side effects**: reads no state, mutates nothing, allocates
  only the fixed string itself.
- Keeps the EXISTING 27-function native Rust API completely
  untouched — `version()` would be a 28th, JS-boundary-only function,
  never called from native Rust code, never replacing
  `fedos_boundary_version()`.

`runtimeVersion()` (the alternative name the Prototype EXECUTION Phase
008 request itself offered) is an equally acceptable name; this review
expresses no preference between `version()`/`runtimeVersion()` beyond
noting `docs/runtime_wasm_loader_rust_api_call_plan.md` (Stage 905)
already named `version()` specifically, which this review defers to
for naming consistency.

## 5. Impact of adding `#[wasm_bindgen]` to that candidate

- **Source**: exactly ONE new function in `src/lib.rs`, annotated
  `#[wasm_bindgen]`. No existing function's signature, body, or
  annotation changes.
- **Generated JS glue**: gains ONE new named export (`version`),
  alongside the existing `initSync`/`default` — the export list grows
  from two names to three, nothing else changes shape.
- **Rust public API surface**: grows from 27 to 28 `pub fn` — every
  guard test in this arc that currently asserts `pubFnNames.length ===
  27` would need updating to `28` at that time (the SAME kind of
  "narrow the assertion for one legitimate addition" pattern this arc
  has applied repeatedly, e.g. Stage 889/921/945/969's own bare-word
  narrowings).
- **Runtime/Worker/TypeScript**: NONE — `attemptDevOnlyWasmInitialization()`
  (Stage 969) already discards the `InitOutput` (including any future
  `version` export surfacing through it) without reading it; calling
  the new `version()` export would be its OWN future, separate,
  explicitly-reviewed stage, not a consequence of adding the
  `#[wasm_bindgen]` attribute by itself.

## 6. `Cargo.toml` change necessity — YES, a new direct dependency

**`wasm-bindgen` is NOT currently a `[dependencies]` entry.**
`docs/runtime_wasm_bindgen_version_policy.md` §2 confirms this
explicitly: `wasm-bindgen` reaches this crate's build graph ONLY as
`getrandom`'s own internal `wasm_js`-feature dependency — there is no
`Cargo.toml` line this crate owns today that could express a direct
`wasm-bindgen` version, and the `#[wasm_bindgen]` PROC-MACRO attribute
requires the `wasm-bindgen` crate to be imported directly (`use
wasm_bindgen::prelude::*;` or equivalent) — a transitive-only presence
via `getrandom` is not sufficient to use the attribute at all.

**A future stage would need to:**

1. Add `wasm-bindgen = "0.2.126"` (matching the CLI version
   `docs/runtime_wasm_bindgen_version_policy.md` already pins) as a
   genuine `[dependencies]` entry.
2. Follow `docs/rust_dependency_adoption.md`'s own "one dependency per
   Stage, explicitly reviewed" policy (§12 "Adoption log" convention)
   — recording crate + version, primitive/purpose served (JS-boundary
   version reporting, not cryptography), transitive dependency count
   added, and license.
3. No feature reorganization is otherwise required — `getrandom`'s
   existing `wasm_js` feature stays exactly as configured
   (`docs/runtime_wasm_getrandom_policy.md`), unrelated to this
   addition.

This review does NOT make this change — it only names it as a
precondition for §4/§5's own candidate.

## 7. Is `version()`-only sufficient for Prototype termination?

**Yes, as a first crossing — but not as the final state.** Exposing
exactly one, zero-side-effect, already-fixed-value function is
sufficient to prove the FULL Rust → JS → initialized-WASM → called
pipeline end-to-end for the first time in this arc's history, without
touching any Crypto/Key API surface (§ "禁止事項" — `encrypt`/`decrypt`
and the key/AEAD boundary functions among the 27 remain explicitly
OUT of scope for this crossing). It does NOT, by itself, complete
Prototype termination — `docs/fedos_core_public_api_design.md` §10
("Runtime / WASM wiring deferred") and §12 (implementation roadmap)
name the REAL crypto operations (`encrypt`/`decrypt`/`deriveKey`/
`randomBytes`) as the eventual destination; `version()` is a
deliberately minimal FIRST step proving the mechanism works, not a
substitute for that roadmap.

## 8. What this Phase does NOT do

- Does **not** add `#[wasm_bindgen]` to any function.
- Does **not** change any Rust source.
- Does **not** change `Cargo.toml`.
- Does **not** change `package.json`.
- Does **not** add any Rust API (`version()` included).
- Does **not** change `src/runtime/fedos_wasm_loader.ts` or any other
  TypeScript file.
- Does **not** connect to Worker or to any Production runtime path.

## 9. Next Phase (not this one)

A future, separate, explicitly-reviewed stage would, in order:

1. Add `wasm-bindgen` as a genuine `[dependencies]` entry (§6),
   following the one-dependency-per-Stage adoption policy.
2. Add `#[wasm_bindgen] pub fn version() -> String` (§4) as the 28th
   `pub fn`, with NO change to any of the existing 27.
3. Regenerate the JS glue (`npm run build:wasm`) and reconfirm its
   export list now includes `version` alongside `initSync`/`default`.
4. ONLY THEN — its own separate stage — extend
   `attemptDevOnlyWasmInitialization()`'s own successor (or a new,
   similarly-gated method) to actually CALL the new `version()` export
   on a successfully-initialized module, recording the result the SAME
   "attempted/succeeded/reason, never retain the payload" way every
   prior Execution stage has.

This review names the order; it implements none of it.

## 10. See also

- `docs/runtime_wasm_loader_dev_only_wasm_initialization_execution.md`
  (Stage 969, Prototype EXECUTION Phase 007) — the Pre-check whose
  "no crate-specific export" finding this review formalizes.
- `docs/runtime_wasm_js_glue_contract.md` (Stage 481) — the original
  observation this review's §3 reconfirms a third time, byte-for-byte.
- `docs/runtime_wasm_loader_rust_api_call_plan.md` (Stage 905,
  Prototype Phase 020) — first named `version()` as the eventual first
  real Rust API call target; this review's §4 builds on that naming.
- `docs/runtime_wasm_bindgen_version_policy.md` — confirms
  `wasm-bindgen` is not a direct dependency today, the basis for this
  review's §6 finding.
- `docs/rust_dependency_adoption.md` §12 — the "one dependency per
  Stage" adoption log convention a future `wasm-bindgen` adoption
  would need to follow.
- `docs/fedos_core_public_api_design.md` §10–12 — the real crypto
  operation roadmap `version()` is a first step toward, not a
  substitute for.
- `packages/fedos-core-rust/src/lib.rs` — the 27 `pub fn` this review
  inventories, unchanged.
