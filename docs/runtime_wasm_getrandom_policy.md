# FedOS `getrandom` WASM policy — Stage 441

**Status: this document adds no code.** It fixes, in writing, the
POLICY a future `Cargo.toml` change (Stage 442) follows to let
`packages/fedos-core-rust`'s existing `getrandom = "0.3"` dependency
(Stage 104) even be considered for `wasm32-unknown-unknown`, given the
compile failure `docs/runtime_wasm_build_observation.md` (Stage 437)
already recorded and classified as a `getrandom` problem. This
document decides nothing about `cdylib`, `wasm-bindgen`, or any real
WASM artifact — only the entropy-source question `getrandom`'s own
compile-time error names.

## 1. `getrandom` 0.3.x does not support `wasm32-unknown-unknown` by default

Starting with the 0.3 line, `getrandom` DELIBERATELY does not pick an
entropy source for `wasm32-unknown-unknown` unless the crate that
ultimately depends on it opts in. Building without that opt-in fails
at compile time with `getrandom`'s own `compile_error!`, exactly as
observed:

```
error: The wasm32-unknown-unknown targets are not supported by default;
you may need to enable the "wasm_js" configuration flag.
```

This is an intentional upstream design choice, not a bug or a gap this
repository's `Cargo.toml` accidentally created — `wasm32-unknown-unknown`
has NO OS underneath it (unlike `wasm32-wasip1` or a browser's
`wasm32-unknown-emscripten`), so `getrandom` cannot guess which
JS-hosted entropy API to call without being told.

## 2. The `wasm_js` feature is required

`getrandom` 0.3.x names its browser/JS-hosted entropy backend
`wasm_js` — a Cargo feature that, when enabled, compiles in a code
path calling `crypto.getRandomValues` (browser/worker global) or
Node's `crypto.webcrypto.getRandomValues`, through a `wasm-bindgen`
`extern "C"` shim `getrandom` itself carries internally (Stage 442
does NOT add a direct `wasm-bindgen` dependency to this crate —
`getrandom`'s own `Cargo.toml` carries that shim as its own
implementation detail of the `wasm_js` feature).

## 3. The feature ALONE is insufficient — a `cfg` flag is also required

Per `getrandom` 0.3's own documentation (linked directly in the
compile error), enabling the `wasm_js` Cargo feature is necessary but
NOT sufficient. A SECOND, independent opt-in is required: the compiler
must also be told, via a `--cfg` flag, to actually select the
`wasm_js` backend at compile time:

```
--cfg getrandom_backend="wasm_js"
```

This is deliberately NOT something `Cargo.toml` alone can express —
`getrandom`'s maintainers chose a `cfg` (a `rustc`/`RUSTFLAGS`-level
flag, typically supplied via `RUSTFLAGS` or a `.cargo/config.toml`
`[build] rustflags`) rather than a second Cargo feature, specifically
so that ENABLING THE DEPENDENCY and SELECTING THE BACKEND remain two
separate, explicit steps — a library merely appearing in the
dependency graph with `wasm_js` turned on can never silently start
calling into the browser's RNG for a build that isn't actually asking
for it.

## 4. This is an explicit, reviewed opt-in — not a default

Both the `wasm_js` feature (Stage 442's `Cargo.toml` edit) and the
`--cfg getrandom_backend="wasm_js"` flag (supplied per-invocation via
`RUSTFLAGS`, never baked into `Cargo.toml` or committed into a
`.cargo/config.toml` by this batch) are treated, in this repository,
as an explicit choice of WHICH entropy source a future `wasm32` build
would draw from — the browser/worker's `crypto.getRandomValues`,
reached through `getrandom`'s own `wasm-bindgen`-based shim — made
ONCE, in writing, here, rather than assumed implicitly by whichever
stage first needed a green `cargo check --target wasm32-unknown-unknown`.
This mirrors the existing CSPRNG-adoption discipline already recorded
for this dependency (`docs/rust_dependency_adoption.md` §6,
`docs/fedos_core_rust_safety.md` §7): `getrandom` was adopted, Stage
104, as the ONLY entropy-source crate in this repository, specifically
so that every consumer of randomness in this crate goes through one
reviewed source and one reviewed backend selection — never an
ad hoc alternative picked per-target.

## 5. Fallback PRNGs are absolutely forbidden

No non-cryptographic, insecure, or "good enough for now" fallback
random-number generator is ever acceptable in this crate, on any
target, for any reason — WASM included. Concretely, this policy
forbids, permanently:

- Any hand-rolled PRNG (linear-congruential, xorshift, Mersenne
  Twister, or otherwise) as a substitute for `getrandom`'s CSPRNG.
- Any use of `Math.random()` (or a TypeScript/JavaScript equivalent)
  anywhere in this crate's WASM-facing boundary, ever, for any
  cryptographic or security-relevant purpose.
- Any "if `wasm_js`/`crypto.getRandomValues` is unavailable, silently
  substitute a weaker source" branch — no such branch is ever written.
- Any time-based, counter-based, or otherwise predictable seed used in
  place of a real CSPRNG call.

This restates, for the WASM target specifically, the same rule already
fixed for every other target this crate builds for
(`docs/fedos_core_rust_safety.md` §7): randomness comes from exactly
one place, `getrandom`, or it does not happen at all.

## 6. CSPRNG failure still fails closed

If `getrandom`'s `wasm_js` backend ever fails at RUNTIME — for
example, `crypto.getRandomValues` throwing, being unavailable in some
non-standard embedding, or a `wasm-bindgen` JS-interop error —
`getrandom`'s own `fill`/`getrandom` call returns an `Err`, and this
crate's existing, unchanged policy applies exactly as it does for
every other target: the calling operation FAILS. No fallback path
generates output anyway; no default/zero/predictable byte sequence is
substituted; no operation that needed entropy silently proceeds
without it. This is the same fail-closed shape already fixed for the
Runtime/Worker activation gates (`docs/runtime_crypto_activation_policy.md`)
and for `SecretHandle`/AEAD failure handling in this crate
(`docs/fedos_core_rust_safety.md`) — WASM introduces no new exception.

## 7. What this document does not decide

- It does not edit `Cargo.toml` — that is Stage 442, a separate,
  minimal change this document's §2–3 policy justifies in advance.
- It does not run `cargo check`/`cargo build` — that is Stage 443–444.
- It does not add `cdylib`, run `wasm-bindgen`, or produce any
  artifact — all remain out of scope, per
  `docs/runtime_wasm_build_contract.md` §6's existing deferral.
- It does not activate Runtime, Worker, or any encrypt/decrypt code
  path — `getrandom` remains, after Stage 442, still unimported and
  uncalled anywhere in `packages/fedos-core-rust/src/lib.rs`/
  `src/crypto/*`, exactly as it has been since Stage 104.

## See also

- `docs/runtime_wasm_build_observation.md` (Stage 437) — the recorded
  `getrandom` compile failure this policy responds to.
- `docs/rust_dependency_adoption.md` §6–7 — this repository's existing
  CSPRNG/dependency-review discipline, extended here to the WASM
  target specifically.
- `docs/fedos_core_rust_safety.md` §7 — the pre-existing "randomness
  comes from `getrandom` only, fail closed on error" rule this
  document restates for WASM.
- `packages/fedos-core-rust/Cargo.toml` — where Stage 442 applies this
  policy's §2 `wasm_js` feature addition.
