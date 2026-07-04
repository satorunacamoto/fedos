# `randomBytes` Implementation Plan (binding, docs only — no code)

**Status: this document adds no code.** It is Stage 135 of the **Nonce /
Random / Secret lifecycle implementation-prep** docs-only batch. It fixes
the preconditions and constraints a future, real `randomBytes`
implementation MUST satisfy — extending `docs/public_random_boundary.md`
(Stage 103) and `docs/public_random_design.md` (Stage 104) from design
records into a concrete pre-implementation plan. Nothing under `src/`,
`packages/`, `Cargo.toml`, or `test/` is changed by this document, and
`getrandom` is called by **zero** lines of code anywhere in this crate
today — production or test.

This is a safety contract, not an implementation. It complements, and does
not renegotiate, `docs/fedos_core_rust_safety.md` §7 (randomness policy),
`docs/fedos_core_public_api_design.md` §7 (nonce/random as a separate
boundary), `docs/public_random_boundary.md` (the two-boundary design), and
`docs/public_random_design.md` (the `getrandom`-specific design). Where
this document and any of those disagree, the earlier binding docs win.

---

## 1. Purpose

- **Fix the concrete conditions for implementing `randomBytes` for real**,
  now that the design (Stage 103) and the dependency choice (Stage 104)
  are both already fixed — this is the next open item, and per
  `docs/implementation_phase_roadmap.md` §1 item 2, the recommended first
  real implementation stage of the whole Implementation Phase.
- **Not an implementation.** No function body is written here. No
  `getrandom` call is added.
- **Binding on whichever future stage implements `randomBytes`.** That
  stage must satisfy every item below, or open a new, explicitly-reviewed
  stage to renegotiate a specific item in the open.

## 2. `getrandom` is already adopted — status today

- `packages/fedos-core-rust/Cargo.toml` already lists `getrandom` as a
  dependency (Stage 104) — a **build-check-only** adoption, reviewed on
  its own per `docs/fedos_core_rust_safety.md` §5's "adopt per feature, per
  stage" rule.
- `getrandom` was chosen over the higher-level `rand`/`rand_core` crates
  specifically because it is the minimal OS-CSPRNG wrapper with no
  pluggable-algorithm surface and no seedable-deterministic-PRNG code path
  that could be misused (`docs/public_random_design.md` §1) — this
  rationale is not revisited here.
- **`getrandom` is not imported, called, or referenced by any production
  or test code today.** The Stage 104 `csprng_verification_infrastructure`
  module is a `#[cfg(test)]`-only label enumeration of four FUTURE
  verification categories — it draws no byte and calls no function
  (`docs/public_random_design.md` §4).
- `FedosRandomBoundary`/`fedos_random_boundary_status()` (Stage 103) remain
  byte-for-byte unchanged, permanently `Unavailable`.

## 3. Preconditions before a public `randomBytes` implementation

All of the following must be true before a future stage replaces
`random_bytes_placeholder`'s fixed body with a real one:

- **The nonce generation policy is fixed in writing**
  (`docs/nonce_generation_policy.md`, Stage 134) — done, this batch,
  precisely so this precondition is satisfied before `randomBytes` lands.
- **The output-size classes are a fixed, small, reviewed enumeration**,
  not an open caller-supplied byte count (§4 below) — this must be
  designed as part of the same implementation stage, since
  `docs/public_random_boundary.md` §2 named it as still-open.
- **The error-mapping label is fixed** (§6 below) so a `getrandom` failure
  has a defined destination in this crate's error taxonomy before the
  first call that could fail is written.
- **No consuming code exists yet that would call the new `randomBytes`
  before it is reviewed on its own** — per
  `docs/fedos_core_public_api_design.md` §12's roadmap, `randomBytes` is
  implemented and reviewed BEFORE `deriveKey` or `encrypt`/`decrypt`
  consume its output, never alongside them in the same stage.

## 4. Length limits — fixed, bounded, label-selected

- **`randomBytes` never accepts an open-ended, caller-supplied byte
  count.** This restates `docs/public_random_boundary.md` §2's design
  constraint as a binding implementation requirement: the function accepts
  a size SELECTED BY LABEL from a small, fixed enum of supported output
  lengths (e.g. distinct labels for a key-length draw, a nonce-length
  draw, and similar fixed-purpose sizes), never a raw `usize`/`u32`
  parameter a caller can set arbitrarily.
- **Rationale:** an unbounded or caller-controlled length parameter
  invites both an unbounded-allocation risk and a "give me N bytes for
  whatever purpose" primitive with no accountability for what the bytes
  are used for (`docs/public_random_boundary.md` §2). Fixing the label
  set is part of the same implementation stage's own review — this
  document does not enumerate the exact labels, it fixes that they must
  be an enum, not a number.
- **The label set is small enough to review exhaustively** — every
  addition of a new size label is itself a reviewable, visible change to
  the enum, not a silent runtime parameter change.

## 5. Zero-length requests

- **A zero-length output is not a valid request and must be rejected by
  the label enumeration itself (§4)** — since sizes are selected by a
  fixed label, not an arbitrary integer, "zero" is simply not a value any
  label can carry unless a future stage deliberately adds a
  zero-length-labeled use case (none is anticipated today).
- If a future caller genuinely has no bytes to request, the correct
  design is to not call `randomBytes` at all, never to call it with a
  size label that resolves to zero and treat the resulting empty output
  as meaningful randomness.

## 6. OS CSPRNG failure handling

- **A `getrandom` failure must surface as a single, specific, fixed error
  label** — per `docs/public_random_design.md` §3, something like "entropy
  source unavailable" — **never** the underlying platform error's raw
  text, error code, `Display`/`Debug` representation, or any
  platform-specific detail. This is the `randomBytes`-specific instance of
  `docs/fedos_core_public_api_design.md` §8's general rule that every
  public-API failure is one label from a closed, reviewed taxonomy.
- **A CSPRNG failure must never be silently retried with different
  parameters, degraded to a warning, or treated as a partial success.**
  The call either returns the requested bytes in full or reports the
  fixed failure label — there is no third outcome.
- **A CSPRNG failure must propagate to any caller consuming its output**
  (a future nonce draw, a future key-material draw) as a hard failure of
  that caller's own operation — per `docs/nonce_generation_policy.md` §11,
  an encrypt call whose nonce draw fails must abort entirely, never
  substitute a degraded nonce.

## 7. No fallback PRNG of any kind

- **If the OS CSPRNG is unavailable, `randomBytes` fails — it does not
  fall back to any other randomness source.** There is no secondary
  generator, no software-only fallback PRNG, no XOR of low-entropy inputs,
  and no "better than nothing" degraded mode. `docs/fedos_core_rust_safety.md`
  §5 already forbids "custom XOR / home-grown cipher" constructions
  generally; this section makes the same prohibition explicit for
  randomness sourcing specifically.
- **Rationale:** a fallback PRNG that activates only when the real CSPRNG
  fails is exactly the kind of rarely-exercised code path that is hardest
  to test and most dangerous to get subtly wrong — and per §6, failure is
  already a well-defined, correctly-handled outcome that does not need a
  silent workaround.

## 8. No `Math.random()` (or any non-cryptographic PRNG), anywhere

- **`Math.random()`, or any TypeScript/JavaScript non-cryptographic PRNG,
  must never back this crate's `randomBytes`, any future nonce draw, or
  any key/seed-adjacent value anywhere in this codebase.** This applies
  regardless of layer — Worker, Runtime, render, or any TypeScript-side
  helper that might be tempted to "just generate a quick random id" near
  crypto-adjacent code.
- **This is not a new rule** — it follows directly from
  `docs/fedos_core_rust_safety.md` §7 ("No `rand`/`getrandom` yet... CSPRNG
  adoption is a separate stage" — establishing that only a reviewed CSPRNG
  may ever back randomness used for security purposes) and
  `docs/vault_crypto_identity.md` §2/§4 (key material must come from a
  vetted CSPRNG, never an ad hoc source). This document restates it here
  because `randomBytes` is the exact boundary a future TypeScript caller
  would reach for, and the temptation to reach for `Math.random()`
  instead — for "just a quick id," "just a test fixture," or similar — is
  highest right at this boundary.
- Non-cryptographic randomness for genuinely non-security purposes (e.g. a
  UI animation delay) is out of scope of this restriction, but must never
  be routed through, or confused with, this crate's `randomBytes`.

## 9. No deterministic test RNG in production

- **A deterministic or seeded RNG exists ONLY inside `#[cfg(test)]` and
  must never be reachable from a production code path.** This is
  `docs/fedos_core_rust_safety.md` §7's "Separate test RNG from production
  RNG" rule, restated as binding on the `randomBytes` implementation
  specifically: whatever test fixtures a future implementation stage adds
  to make its own unit tests deterministic and reviewable, none of them
  may be reachable from `random_bytes_placeholder`'s eventual real
  production body, from `selectCryptoProvider`
  (`src/runtime/create_runtime.ts`), or from any Worker route.
- **A future test-only seeded generator, if one is added, must be
  named and gated so it cannot be mistaken for the production path** —
  e.g. clearly `#[cfg(test)]`-scoped, never exported, and covered by a
  dedicated guard test asserting it is absent from the crate's public
  surface (the same guard-test pattern every Stage 74–106 crypto stage
  already uses).

## 10. WASM is a separate, later stage

- **This plan does not cover, authorize, or schedule producing a `.wasm`
  artifact or loading one at runtime.** Per
  `docs/fedos_core_rust_safety.md` §8, WASM work (a `cdylib` target, a
  `.wasm` artifact, and actually loading it) are "distinct, later,
  explicitly-reviewed Stages — never folded into a crypto-implementation
  Stage," and `docs/implementation_phase_roadmap.md` §1 places the WASM
  build boundary (item 7) and the Runtime crypto opt-in (item 8) strictly
  AFTER the real `randomBytes` implementation (item 2) and the rest of the
  crypto core (items 3–6).
- **A future WASM-hosted `randomBytes` must still satisfy every
  precondition in this document** (§3–§9) — WASM does not relax the
  CSPRNG-only, no-fallback, no-`Math.random()`, or fixed-error-taxonomy
  requirements; if anything, a WASM host's own available entropy source
  (browser `crypto.getRandomValues` vs. a native OS syscall) is an
  additional platform-specific wiring detail `docs/public_random_design.md`
  §1 already flagged as a candidate concern for that later stage to
  resolve, not this one.

## 11. Relationship to the Fedos random/nonce boundary

- **`randomBytes` and nonce generation stay two independent boundaries**,
  per `docs/public_random_boundary.md` §1: a general-purpose random byte
  has no uniqueness obligation, while a nonce must never repeat under a
  key — folding them into one code path risks the wrong failure mode
  being applied to the wrong case.
- **A future nonce draw consumes the SAME underlying CSPRNG call this
  `randomBytes` implementation exposes** (`docs/public_random_design.md`
  §6 step 4; `docs/nonce_generation_policy.md` §6) — but nonce generation
  itself is never exposed as a standalone public function; only
  `randomBytes` is a caller-facing entry point (§4). Implementing
  `randomBytes` first, and reviewing it independently, is what lets a
  later `encrypt` implementation reuse an already-reviewed CSPRNG path
  for its internal nonce draw instead of wiring a second one.

## 12. Test strategy

- **Category 1 — linkage/invocability.** A test confirms the real
  `getrandom` call links and can be invoked at all in the target build
  (the first of the four categories `csprng_verification_infrastructure`,
  Stage 104, already named as a future check).
- **Category 2 — exact length honored.** For every fixed size label (§4),
  a test confirms the returned buffer is exactly that many bytes — never
  more, never fewer, never a truncated or padded result.
- **Category 3 — failure surfaces as `Result::Err`, never a panic.** A
  test (using a fault-injected or mocked entropy source, not the real OS
  CSPRNG, so the failure path is exercised deterministically) confirms a
  `getrandom` failure returns the fixed error label from §6 rather than
  panicking, aborting the process, or returning zeroed/uninitialized
  bytes.
- **Category 4 — non-determinism, not a statistical quality claim.** A
  test confirms two calls in immediate succession do not return
  identical output — this is a basic sanity check, never a claim about
  distribution, entropy quality, or passing a statistical test suite (no
  such claim is made anywhere in this crate's docs, and none should be
  added).
- **No official known-answer vector exists for randomness** — unlike the
  RFC 8439/5869/9106/NIST-CAVP vectors already wired for AEAD/KDF,
  correctness for `randomBytes` cannot be "verified against an expected
  output," since the expected output is, by design, not fixed. The four
  categories above are the complete test strategy; no fifth "verify the
  actual bytes match X" test should ever be added, since that would
  indicate a non-random (deterministic) implementation per §9.
- **Every test in categories 1–4 must run under `cargo test` and must not
  weaken or replace any existing RFC/NIST vector test** — the new
  `randomBytes` test module is additive, following the same pattern every
  Stage 74–101 dependency-adoption/vector-wiring stage already used.

---

## 13. What this document does NOT do

- Does not call `getrandom` anywhere, production or test.
- Does not implement `randomBytes`, public or private.
- Does not fix the exact output-size label enum's member names (that is
  part of the implementing stage's own review, per §4).
- Does not wire anything into `src/runtime/create_runtime.ts` or
  `src/worker.ts`.
- Does not touch `src/`, `packages/`, `Cargo.toml`, or `test/`.

## 14. Conclusion

- **`getrandom` is adopted and ready; nothing calls it yet.** The
  precondition list in §3 is now complete as of this document (paired
  with `docs/nonce_generation_policy.md`, Stage 134) — the next stage may
  begin the real implementation.
- **Length is always label-selected, never an open count; zero-length is
  not a representable request.**
- **CSPRNG failure is a hard, labeled failure — no fallback PRNG,
  no `Math.random()`, no degraded output, ever.**
- **A deterministic RNG exists only under `#[cfg(test)]`, never in a
  production path.**
- **WASM loading is explicitly out of scope and stays a later, separate
  stage**, per the existing WASM safety rules and the Implementation
  Phase roadmap's ordering.
- Per `docs/implementation_phase_roadmap.md`'s recommendation, the Rust
  `randomBytes` implementation itself is the next Implementation Phase
  step this plan was written to prepare.
