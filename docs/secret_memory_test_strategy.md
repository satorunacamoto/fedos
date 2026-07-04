# Secret Memory Test Strategy (binding, docs only — no code)

**Status: this document adds no code.** It is Stage 143 of the
**SecretHandle real-byte implementation preparation** docs-only batch. It
fixes the concrete TEST STRATEGY a future `SecretHandle` real-byte
implementation stage must satisfy — the verification counterpart to
`docs/secret_handle_api_shape.md`'s type/method shape and
`docs/secret_lifecycle_implementation_plan.md`'s policy. Nothing under
`src/`, `packages/`, `Cargo.toml`, or `test/` is changed by this document,
and no test named here exists yet.

This complements, and does not renegotiate,
`docs/secret_lifecycle_implementation_plan.md` §11 (the test-strategy
section this document expands into concrete gates),
`docs/secret_handle_api_shape.md` (the types/methods these tests exercise),
and `docs/random_bytes_implementation_plan.md` §12 /
`docs/nonce_generation_policy.md` §12 (the equivalent test strategies
already applied to Stage 137/138, whose pattern this document reuses for
`SecretHandle`). Where this document and any of those disagree, the
earlier binding docs win.

---

## 1. Purpose

- **Fix the test gates before real bytes land.** Name the concrete
  assertions a future `SecretHandle` real-byte implementation stage must
  pass, so "cargo test is green" means something specific and reviewed,
  not just "it compiles."
- **Not an implementation.** No test file, no test function, and no
  `#[cfg(test)]` module is added by this document.
- **Binding on whichever future stage implements real bytes.** Every gate
  named here is a precondition for that stage's own `cargo test` run to
  be considered complete — mirroring how
  `docs/random_bytes_implementation_plan.md` §12 and
  `docs/nonce_generation_policy.md` §12 were written before Stage
  137/138's own `random_bytes_wiring`/`aead_nonce_wiring` test modules
  existed.

## 2. `Clone` is not implemented — compile-time proof, not a runtime check

- **A guard test asserts `SecretHandle` (and any real-secret-holding
  sibling type) does not derive or implement `Clone`.** Per
  `docs/secret_handle_api_shape.md` §7 and
  `docs/secret_lifecycle_implementation_plan.md` §4, this is a
  compile-time property, not a runtime behavior — the test must PROVE
  absence, not merely fail to exercise presence.
- **Preferred mechanism: a compile-fail test.** A `trybuild`-style
  compile-fail fixture (or, if that tooling is not already adopted, a
  `#[cfg(test)]`-gated module containing a function that would only
  compile if `.clone()` were callable, checked to NOT compile) — mirroring
  the "exhaustive match with no wildcard arm compiles only because no
  [forbidden] variant exists" pattern already used in
  `random_bytes_wiring::fedos_random_bytes_length_has_no_variant_other_than_thirty_two`
  (Stage 137) and its Stage 138 nonce analogue.
- **If compile-fail tooling is judged not worth adopting for this alone**,
  the fallback is a source-string guard test (the same pattern
  `test/fedos_core_rust_*.test.ts` already uses throughout this crate):
  assert the type's declaration has no `#[derive(... Clone ...)]` and no
  `impl Clone for SecretHandle` anywhere in `lib.rs`. This is a weaker
  guarantee than a compile-fail test (it can miss a `Clone` impl added via
  an unexpected macro) but is strictly better than no check, and matches
  this crate's existing verification style.

## 3. `Debug` carries no raw byte — construct-and-inspect, never assume

- **A guard test constructs a `SecretHandle` from a known, clearly-labeled,
  non-production test fixture (32 bytes, e.g. a fixed repeating pattern
  documented as `generated`/test-only, per
  `docs/crypto_test_vectors.md` §3's "no home-grown vectors... unless
  clearly labeled" rule generalized to secret fixtures) and asserts the
  `format!("{:?}", handle)` output (if `Debug` exists at all) does not
  contain the fixture's bytes, their hex encoding, or any substring
  derived from them.**
- **If `SecretHandle` has no `Debug` impl at all**, the test instead
  asserts that attempting `format!("{:?}", handle)` fails to compile (or,
  if that is not practically testable, the guard test falls back to a
  source-string check that no `Debug` derive/impl exists) — either
  outcome satisfies `docs/secret_handle_api_shape.md` §7.
- **The check must cover the state/kind labels too, not just the byte
  buffer** — a `Debug` output that includes `SecretHandleKind` or
  `SecretHandleState` is fine (those are non-sensitive labels,
  §4 of the API shape doc), but the test must confirm the label alone
  is present, not a byte count or length that could narrow down which
  32-byte secret is held (`docs/secret_lifecycle_implementation_plan.md`
  §5's "not even their length" rule).

## 4. `clear()` transitions to `Cleared` — state-machine assertion

- **A test constructs a real-byte `SecretHandle`, calls `clear()`, and
  asserts `status().state` (or `is_cleared()`) reports the cleared state**
  — the same assertion shape Stage 79's own
  `test::clear_transitions_state_to_cleared_only` already exercises
  against the placeholder marker; this item scopes it to a handle
  constructed from real (test-fixture) bytes instead.
- **A test asserts `is_cleared()` is `false` before `clear()` is called**
  and **`true` after** — mirroring Stage 79's
  `is_cleared_is_false_until_clear_is_called`.
- **A test asserts calling `clear()` a second time does not panic** (an
  idempotency check) — clearing an already-cleared handle must be a safe
  no-op or a repeat-zeroize of already-zero memory, never a double-free
  or panic-inducing operation.

## 5. Drop-time zeroize — verification approach, with its limits named

- **Preferred mechanism: a `cfg(test)`-only introspection hook.**
  Construct the handle from a known fixture, capture a raw pointer/slice
  view into the underlying buffer BEFORE the handle drops (via a
  `pub(crate)`, `#[cfg(test)]`-gated accessor that exists ONLY under test
  compilation — never reachable from a production build), let the handle
  go out of scope, and assert the memory at that location no longer
  matches the fixture bytes.
- **This test is inherently a best-effort, not a formal proof** — per
  `docs/secret_lifecycle_implementation_plan.md` §6 and §10, reading
  "freed" memory through a raw pointer is technically use-after-free from
  Rust's own safety model, so this specific test, if written, must be
  narrowly scoped, clearly commented as `cfg(test)`-only introspection,
  and never promoted to a technique used anywhere near production code.
  If this tradeoff is judged unacceptable at implementation time, the
  fallback is asserting only that `zeroize()`/`ZeroizeOnDrop::zeroize()`
  is CALLED (e.g. via a test-only wrapper type that records the call)
  rather than directly inspecting freed memory — a weaker but safer
  guarantee.
- **No test claims memory is unrecoverable by a sufficiently privileged
  observer** (a debugger, a core dump, a page swapped before drop) — per
  `docs/secret_handle_api_shape.md` §9, this test strategy proves the
  zeroize CALL happens, not that no trace of the secret ever existed
  anywhere in the process's memory history.

## 6. No raw-byte exposure API — source-string + signature scan

- **A source-string guard test scans `lib.rs` for any `pub` (crate-public)
  function whose signature returns `Vec<u8>`/`&[u8]`/`String`/`[u8; N]`
  from a path reachable from `SecretHandle`** — the same
  "scanning the crate's public API surface for any function signature
  that returns raw bytes from a secret-handle-derived source" test
  `docs/secret_lifecycle_implementation_plan.md` §11 already named,
  concretized here as: enumerate every `pub fn` (not `pub(crate) fn`) in
  `lib.rs` and assert none of them accepts or returns `SecretHandle`, a
  type derived from it, or a raw byte array/slice/vector/string that
  could plausibly carry its contents.
- **A test asserts no `pub(crate)` accessor exists beyond the five named
  in `docs/secret_handle_api_shape.md` §6** — enumerate `SecretHandle`'s
  own `impl` block and assert its method set is exactly
  `new_from_32_bytes_for_internal_use`/`status`/`kind`/`clear`/
  `is_cleared`, so a sixth "just this once" raw-byte accessor cannot be
  added without this test failing first.

## 7. No `Vec`/`String`/`serde` anywhere in the type or its fields

- **A source-string guard test asserts `SecretHandle`'s own struct
  declaration (and `SecretHandleState`/`SecretHandleKind`/
  `SecretHandleStatus`/`SecretInputLength`) contains no `Vec<`, no
  `String`, no `&str` (beyond a fixed `&'static str` label, if any, the
  same shape `docs/fedos_core_architecture_freeze_v1.md` §4 already
  established for every other crate-private skeleton), and no
  `#[derive(Serialize)]`/`#[derive(Deserialize)]` or `serde::Serialize`/
  `serde::Deserialize` impl.**
- **A test asserts `Cargo.toml` gained no new `serde`-family PRODUCTION
  dependency** (the existing `serde`/`serde_json` entries are
  `[dev-dependencies]` only, per Stage 75's vector-test plumbing — this
  must stay true) — the same "Cargo.toml unchanged" check every Stage
  102–140 guard test already runs.

## 8. Panic-time limits — name what is NOT tested, and why

- **No test asserts a secret is zeroized after a panic** — per
  `docs/secret_handle_api_shape.md` §9 and
  `docs/secret_lifecycle_implementation_plan.md` §7, this is explicitly
  unsolved, so a test claiming to verify it would be testing a guarantee
  this plan does not make.
- **A test MAY assert that a panic inside a `SecretHandle`-touching
  function does not itself print a secret byte** (e.g. constructing a
  handle from a fixture, triggering a deliberate panic via a test-only
  helper, and asserting the panic message/backtrace text does not contain
  the fixture bytes) — this is testable and worth doing, and is a
  narrower, honest claim than "zeroized on panic."
- **This gap is recorded as a known, open limitation in the test
  strategy itself**, not silently absent — a future stage that wants to
  close it (a panic hook, a guard type) does so as its own explicitly-
  reviewed stage with its own new test strategy, per
  `docs/secret_handle_api_shape.md` §9.

## 9. WASM-time limits — not yet applicable, named for later

- **No WASM-specific test exists yet, because no WASM target exists yet**
  (`docs/fedos_core_wasm_safety.md`; Stage 63/64 boundary, not built).
  This document does not schedule one.
- **When a WASM target eventually exists**, `SecretHandle`'s zeroize
  guarantee would need its own WASM-specific test strategy (WASM linear
  memory has its own zeroing and side-channel characteristics,
  `docs/vault_crypto_identity.md` §4), reviewed as its own future,
  separate stage — named here as a follow-up, not authorized by this
  document.

## 10. Miri / Valgrind / sanitizer tooling — future, not this stage

- **Memory-sanitizer tooling (Miri, Valgrind, AddressSanitizer, or
  equivalent) is NOT adopted by this document** and is not required for
  the Stage that first gives `SecretHandle` real bytes to pass its own
  test gates (§2–§7 above are sufficient for that stage).
- **Recorded as a valuable future addition**, not a blocker: once
  `SecretHandle` holds real bytes, running its test suite under Miri (to
  catch undefined behavior around the `cfg(test)`-only introspection hook
  named in §5) or a memory sanitizer (to catch use-after-free/zeroize
  timing issues empirically) would strengthen confidence beyond what
  ordinary `cargo test` can prove — but adopting either is its own
  explicitly-reviewed future stage (a CI/tooling change, not a `Cargo.toml`
  production dependency), not a precondition for Stage 141's real-byte
  work to proceed.

## 11. Test gates (summary — all must pass before the implementing stage is done)

- `cargo check` — GREEN, no new `unsafe`, no new production dependency.
- `cargo test` — GREEN, including:
  - §2's `Clone`-absence proof,
  - §3's `Debug`-no-raw-byte assertion,
  - §4's `clear()`/`is_cleared()` state-machine assertions (including the
    double-clear idempotency check),
  - §5's drop-time zeroize verification (or its named fallback),
  - §6's no-raw-exposure and exact-method-set assertions,
  - §7's no-`Vec`/`String`/`serde` assertions,
  - every existing RFC 8439/5869/9106/NIST-CAVP vector test UNCHANGED
    (per `docs/secret_lifecycle_implementation_plan.md` §11: "a real
    `SecretHandle` must not require changing any existing vector test's
    expected output").
- `cargo check --tests` — GREEN.
- `npm run typecheck` / `npm test` — GREEN, with the corresponding
  `test/fedos_core_rust_*.test.ts` guard file(s) updated for the new
  `pub(crate)` surface (source-string checks only — `SecretHandle` itself
  contributes no new `pub fn` to the crate's public `pub fn` count, per
  `docs/secret_handle_api_shape.md` §2/§6).
- `git status` clean aside from the implementing stage's own intended
  files, per this crate's standing build-artifact policy
  (`docs/fedos_core_rust_safety.md` §9).

---

## 12. Conclusion

- **Six concrete test obligations** (§2–§7) turn
  `docs/secret_lifecycle_implementation_plan.md` §11's policy-level test
  strategy into gates a future implementation stage can run `cargo test`
  against directly.
- **Two limitations are named and left open, not solved**: panic-time
  zeroization (§8) and WASM-time behavior (§9) — consistent with this
  project's standing rule to describe mechanisms and their limits, never
  an unfalsifiable guarantee.
- **Sanitizer/Miri tooling is future work, not a blocker** (§10) — the
  gates in §11 are sufficient for the first real-byte stage to be
  considered complete.
- No code, test, or `Cargo.toml` change is authorized or made by this
  document.
