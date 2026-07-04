# Secret Lifecycle Implementation Plan (binding, docs only — no code)

**Status: this document adds no code.** It is Stage 136 of the **Nonce /
Random / Secret lifecycle implementation-prep** docs-only batch. It fixes
the policy a future stage MUST follow before `SecretHandle` (Stage 79,
`packages/fedos-core-rust/src/lib.rs`) is extended to hold real secret
bytes instead of a placeholder marker. Nothing under `src/`, `packages/`,
`Cargo.toml`, or `test/` is changed by this document, and `SecretHandle`
holds no real secret today — only a fixed placeholder byte.

This is a safety contract, not an implementation. It complements, and does
not renegotiate, `docs/fedos_core_rust_safety.md` §6 (memory safety /
secret handling), `docs/crypto_test_vectors.md` §8 (Rust implementation
prerequisites), `docs/vault_crypto_identity.md` §4 (why Rust, not a
managed runtime, for the secret path), and
`docs/fedos_core_architecture_freeze_v1.md` §3–§4 (the `secret_handle`
module's current shape). Where this document and any of those disagree,
the earlier binding docs win.

---

## 1. Purpose

- **Fix the policy for `SecretHandle` real bytes before it is
  implemented.** Stage 79 proved `zeroize`/`secrecy` compile and a
  `.clear()` call zeroizes a fake marker; this document fixes what changes
  — and what must NOT change — when a real secret byte buffer replaces
  that marker.
- **Not an implementation.** No field is added to `SecretHandle`. No
  `Cargo.toml` change. No new type.
- **Binding on whichever future stage implements it.** Per
  `docs/fedos_core_rust_safety.md` §6, "Secrets and their zeroization
  arrive together... never 'add secrets now, zeroize later.'" This plan is
  the design record that stage must satisfy in full, in one commit/PR, not
  incrementally.

## 2. Status today: `SecretHandle` holds a placeholder marker only

- `SecretHandle` (Stage 79) is the crate's first production use of
  `zeroize`/`secrecy` (Stage 78's build-check-only adoption), but it holds
  **only a fixed placeholder byte**, never a real key, seed, or plaintext
  value (`docs/fedos_core_architecture_freeze_v1.md` §3).
- `.clear()` already zeroizes that placeholder byte — the mechanism is
  proven to compile and run, but there is nothing sensitive in it yet to
  protect.
- No public function anywhere in this crate constructs a `SecretHandle`
  from caller-supplied bytes; it is `pub(crate)`-at-most
  (`docs/fedos_core_architecture_freeze_v1.md` §2, §4).

## 3. `secrecy`/`zeroize` usage policy for real bytes

- **`secrecy`'s `Secret<T>`/`SecretBox<T>` (or the crate's then-current
  equivalent) wraps every real secret buffer**, so the value is not
  accidentally exposed through an ordinary `Debug`/`Display`/`Clone` derive
  — per `docs/crypto_test_vectors.md` §8 ("wrap secrets in `secrecy` types
  so they are not accidentally logged/copied").
- **`zeroize` clears the underlying buffer on drop** — every real-byte
  `SecretHandle` (or its successor type) derives or implements `Zeroize`/
  `ZeroizeOnDrop` so the memory is overwritten when the value goes out of
  scope, not left for the allocator to reuse silently.
- **Exposing the raw bytes requires an explicit, narrow accessor** (e.g.
  `secrecy`'s `expose_secret()`-equivalent), never an implicit conversion,
  `Deref` to `&[u8]` used casually, or a field made `pub`. Every call site
  that exposes raw bytes is expected to be a deliberate, reviewable,
  minimal-scope operation (the AEAD/KDF call itself — see §8), not a
  general-purpose "give me the bytes" convenience.
- **This policy governs every secret this crate ever holds** — key
  material, derived keys, seeds, and passphrases alike — not `SecretHandle`
  specifically; any future type added to hold one of these must follow the
  same wrapping/zeroize discipline, whether or not it reuses the
  `SecretHandle` name.

## 4. `Clone` is forbidden on any real-secret type

- **A type holding real secret bytes must never derive or implement
  `Clone`.** `Clone`-ing a secret defeats the purpose of tracking its
  lifetime and zeroize-on-drop guarantee — a cloned copy has its own
  independent lifetime, its own independent drop point, and doubles the
  number of memory locations that must be tracked and wiped.
- **If a future stage genuinely needs to derive multiple values from one
  secret** (e.g. deriving several sub-keys via HKDF from one input key),
  the correct shape is a function that consumes or borrows the original
  and produces new, independently-owned `SecretHandle`-wrapped outputs —
  never a `Clone` of the input passed to multiple call sites.
- **This is a stricter rule than `secrecy`'s own defaults may enforce out
  of the box** — a future implementation must not rely on the crate's
  default derive behavior alone; the prohibition must be checked
  explicitly (by code review and, where feasible, a guard test — see §10)
  for every real-secret-holding type added.

## 5. `Debug`/log output is forbidden on any real-secret type

- **A type holding real secret bytes must never derive `Debug`, and must
  never implement a custom `Debug`/`Display` that prints any byte of the
  secret**, even partially, even truncated, even hashed-for-display. This
  restates `docs/fedos_core_rust_safety.md` §6 ("No secret in logs/debug
  output. Keys, seeds, plaintext, ciphertext, passphrases, and tokens
  never appear in logs, `Debug`/`Display`, panic messages, or error text")
  as a binding requirement on the real-byte `SecretHandle` specifically.
- **If a `Debug` impl is needed for development ergonomics**, it must
  print a fixed, non-sensitive placeholder string (e.g. a type name and a
  state label, analogous to how `docs/fedos_core_architecture_freeze_v1.md`
  §4 already describes the current placeholder types' `Debug`/`Display` as
  "on non-secret placeholder types only") — never anything derived from
  the actual secret bytes, not even their length if length itself could
  narrow down what the secret is (e.g. distinguishing a 12-byte nonce
  input from a 32-byte key).
- **No secret byte may reach any audit/logging mechanism**, per
  `docs/fedos_core_public_api_design.md` §9 — this applies regardless of
  log level, verbosity, or debug-build configuration, and is not relaxed
  for internal-only or test-adjacent logging either.

## 6. Zeroize on drop is mandatory, and is the primary guarantee

- **Every real-secret-holding type implements `ZeroizeOnDrop`
  (or manually zeroizes in a custom `Drop` impl using `zeroize`)**, so
  the buffer is overwritten the moment the value's scope ends — this is
  the mechanism `docs/vault_crypto_identity.md` §4 identifies as the
  entire reason this crate exists in Rust rather than a managed runtime
  (Python/JS cannot reliably zero memory: immutable strings/bytes, GC,
  interning, and copies mean plaintext can linger).
- **Zeroize-on-drop is the guarantee this plan makes; it is not a
  guarantee that no copy of the secret ever existed anywhere in process
  memory.** A secret may still have been copied by the compiler (moves
  that the optimizer turns into copies, stack frames not yet overwritten,
  spilled registers) before `Drop` runs — `zeroize`'s own documentation
  and this crate's existing docs already acknowledge this class of
  limitation (see §7).

## 7. Panic-time behavior — do not over-promise

- **A panic must not print a secret byte** (§5 already forbids this via
  the "panic messages" clause) — but beyond that, this plan does **not**
  claim that a panic during a secret-holding operation guarantees the
  secret is zeroized before the process unwinds or aborts.
- **`docs/fedos_core_rust_safety.md` §6 already names this as future work,
  not a solved problem**: "Panic / core-dump risk is future work.
  Panic-safety and core-dump exposure of secrets are handled by a future
  docs + implementation Stage when secrets exist; they are named here as
  known concerns, not solved." This plan restates that limitation rather
  than resolving it — a real `SecretHandle` implementation must not claim
  panic-safety it has not actually implemented and tested.
- **Do not use unsafe or exotic mechanisms to "guarantee" panic-time
  zeroization** as a shortcut — per `docs/fedos_core_rust_safety.md` §3,
  any `unsafe` requires its own separate, explicitly-reviewed stage with a
  written invariant justification; panic-safety is not, by itself, a
  justification to introduce `unsafe` into this crate.
- **A future stage that wants to close this gap** (e.g. via a panic hook,
  a guard type, or process-level hardening) does so as its own explicitly-
  reviewed stage, named here as a known follow-up, not authorized by this
  document.

## 8. No raw secret is ever exposed through the public API

- **This restates and binds** `docs/fedos_core_public_api_design.md` §3–§4
  as the concrete rule for `SecretHandle`'s real-byte implementation:
  `encrypt`/`decrypt`/`deriveKey` (once real) accept only an opaque handle
  or reference, never a raw key/seed/passphrase byte or string parameter,
  and `SecretHandle` itself (or its public-facing wrapper, if any) never
  exposes an accessor on the crate's PUBLIC boundary that returns raw
  bytes.
- **Any raw-byte exposure is confined to `pub(crate)` internals that
  perform the actual cryptographic operation** — the AEAD seal/open and
  HKDF/Argon2 derivation call sites themselves (§9) — never re-exported,
  never returned across the crate's public function boundary, and never
  passed through a WASM/FFI boundary as a raw buffer without the
  provisioning-path review `docs/fedos_core_public_api_design.md` §4
  requires as a separate, future, explicitly-scoped decision.
- **A caller that genuinely needs to provision new secret material**
  obtains a `SecretHandle` through a dedicated, narrowly-scoped
  provisioning function — out of scope for this document, per
  `docs/fedos_core_public_api_design.md` §4 — never by constructing one
  from raw bytes it passes directly into `encrypt`/`decrypt`/`deriveKey`.

## 9. HKDF / AEAD connection order

- **`SecretHandle` real bytes land BEFORE HKDF is wired to consume one,
  and HKDF lands BEFORE AEAD is wired to consume its output** — this
  matches `docs/implementation_phase_roadmap.md` §1's fixed order (items
  3 → 4 → 5: `SecretHandle` real bytes → HKDF internal implementation →
  AEAD internal implementation) and `docs/fedos_core_public_api_design.md`
  §12's roadmap (`deriveKey` before `encrypt`/`decrypt`, since `encrypt`
  needs a key that `deriveKey` — or an equivalent provisioning path —
  produces).
- **Each connection is its own reviewed stage**, per
  `docs/fedos_core_rust_safety.md` §5's "adopt per feature, per stage"
  rule extended to internal wiring, not just dependency adoption: the
  stage that gives `SecretHandle` real bytes does not, in the same stage,
  also wire it into `kdf_core`; the stage that wires HKDF to consume a
  `SecretHandle` does not, in the same stage, also wire AEAD to consume
  HKDF's output.
- **Domain separation is mandatory at the HKDF step** — per
  `docs/crypto_test_vectors.md` §5, every derivation carries a distinct,
  documented `info`/context (reusing the already-fixed `domain_label`
  skeleton, Stage 88) so keys for different purposes never collide, even
  when derived from the same underlying `SecretHandle`.
- **The AEAD step consumes a `SecretHandle`-derived key and the nonce
  policy this batch's Stage 134 document fixes** — `encrypt` draws its
  nonce internally per `docs/nonce_generation_policy.md` §10, never
  receiving one as a caller-supplied parameter, and never accepting the
  key as anything other than an opaque handle (§8).

## 10. Memory safety limitations — state plainly, do not oversell

- **A managed-runtime copy exists nowhere in this crate's design** (no
  Python/JS holds these bytes, per `docs/vault_crypto_identity.md` §4) —
  but Rust's own compiler and hardware are not a complete guarantee
  either. This plan names the following limitations explicitly, per
  `docs/anti_analysis_shadow_vault_risks.md`'s standing rule to "describe
  mechanisms and their limits" rather than claim a solved problem:
  - **Compiler-introduced copies.** Moves that the optimizer implements as
    a memory copy, and stack slots or registers that held a secret value
    transiently before a variable's `Drop` runs, are not something
    `zeroize` alone erases — `zeroize` clears the buffer IT knows about,
    not every register or stack frame that may have transiently held a
    copy of its contents.
  - **OS/hardware paging.** If a page holding secret memory is swapped to
    disk (or, on some platforms, written to a hibernation/sleep image)
    before it is zeroized, the zeroize-on-drop guarantee does not retroact
    on that already-written copy.
  - **Core dumps and debuggers.** A process core dump or an attached
    debugger can observe live secret memory before `Drop` runs — this is
    the same class of exposure `docs/fedos_core_rust_safety.md` §6 already
    names as future work (§7 above), not solved by `zeroize` alone.
  - **WASM's own memory model** (once a WASM target exists — Stage 63/64
    boundary, not yet built) has its own zeroing and side-channel
    characteristics that `docs/vault_crypto_identity.md` §4 already flags
    as an open question, not answered by this document.
- **None of the above is a reason to skip `zeroize`/`secrecy`.** They
  narrow the exposure window and prevent the easiest, most common leak
  paths (accidental `Debug`/log printing, lingering heap-allocated copies
  after a value's intended lifetime) — narrowing risk, not eliminating it,
  is the honest claim this plan makes, consistent with this project's
  standing ban on unfalsifiable security language
  (`docs/anti_analysis_shadow_vault_risks.md` §11).

## 11. Test strategy

- **A guard test asserts the real-secret-holding type does not derive or
  implement `Clone`** — e.g. a compile-fail test (or an equivalent static
  check) confirming an attempted `.clone()` call does not compile, mirroring
  the existing pattern of dedicated guard tests per crypto stage
  (`test/fedos_core_rust_*.test.ts`).
- **A guard test asserts the type's `Debug`/`Display` output (if any)
  contains no byte derived from the actual secret value** — constructing
  the type with a known, test-only fixture secret and asserting the
  formatted output does not contain that fixture's bytes or any
  substring derived from them.
- **A test asserts `zeroize` actually runs on drop** — e.g. constructing
  the type with a known fixture, capturing the memory location before
  drop (via a test-only, `cfg(test)`-gated introspection hook if
  necessary), and asserting the bytes are overwritten after the value goes
  out of scope. This is the same kind of test Stage 79's placeholder
  `.clear()` already exercises against its fake marker — this item scopes
  it to a real secret value instead.
- **A test asserts no public function returns raw secret bytes** — a
  source-string guard test (the same pattern used throughout Stage 34–130)
  scanning the crate's public API surface for any function signature that
  returns `Vec<u8>`/`&[u8]`/`String` from a secret-handle-derived source,
  failing if one is found.
- **HKDF/AEAD wiring tests (once those stages land, per §9) must continue
  to pass the existing RFC 8439/5869/9106/NIST-CAVP vectors unmodified** —
  a real `SecretHandle` must not require changing any existing vector
  test's expected output; if it does, the wiring is wrong, not the vector.
- **No test constructs a real secret from a hardcoded literal that looks
  like production key material** — test fixtures use clearly-labeled,
  non-production placeholder values (mirroring
  `docs/crypto_test_vectors.md` §6's "password label — a NON-secret label
  identifying the vector — never a real passphrase" rule, generalized to
  every secret-shaped test fixture in this crate).

---

## 12. What this document does NOT do

- Does not add a field to `SecretHandle` or any other type.
- Does not implement `Zeroize`/`ZeroizeOnDrop`/`Clone`-prohibition/`Debug`
  suppression anywhere — it only fixes the policy the implementing stage
  must follow.
- Does not wire `SecretHandle` into `kdf_core` or `aead_core`.
- Does not resolve the panic-safety/core-dump gap named in §7 — it names
  the gap and defers it, per the existing binding docs.
- Does not touch `src/`, `packages/`, `Cargo.toml`, or `test/`.

## 13. Conclusion

- **`SecretHandle` real bytes and their zeroize-on-drop guarantee must
  land together, in one stage** — this plan exists so that stage has a
  complete policy to implement against instead of assembling one under
  pressure.
- **`Clone` is forbidden, `Debug`/logging of the raw value is forbidden,
  and no public function may return raw secret bytes** — three
  independent, all-binding constraints.
- **Zeroize-on-drop is the guarantee made; panic-safety and core-dump
  exposure are explicitly NOT guaranteed yet** — named as future work, not
  papered over.
- **HKDF connects to `SecretHandle` before AEAD connects to HKDF's
  output**, each its own reviewed stage, matching
  `docs/implementation_phase_roadmap.md`'s fixed order.
- Per `docs/implementation_phase_roadmap.md`'s recommendation, the next
  Implementation Phase step is the Rust `randomBytes` implementation
  (`docs/random_bytes_implementation_plan.md`), which precedes
  `SecretHandle` real bytes in the fixed order — this plan prepares the
  step that follows it.

## 14. Stage 141 update — randomBytes and the nonce helper are now implemented; SecretHandle real bytes is next, still not implemented

- **`fedos_random_bytes_32()`** (Stage 137) and **`fedos_aead_nonce_96()`**
  (Stage 138) are both real, `cargo test`-verified implementations now —
  the two items `docs/implementation_phase_roadmap.md` §1 placed BEFORE
  `SecretHandle` real bytes in its fixed order are done. `SecretHandle`
  real bytes (item 3 of that order) is next, and remains **NOT
  implemented** — `SecretHandle` still holds only the Stage 79 placeholder
  marker, exactly as §2 of this document describes.
- **`SecretHandle` does not, and must not, directly generate random bytes
  or a nonce.** Now that both generators are real functions a future
  implementation could be tempted to call directly, this is worth stating
  explicitly: `SecretHandle`'s real-byte constructor accepts already-drawn
  bytes as a parameter (see `docs/secret_handle_api_shape.md` §5–§6,
  `new_from_32_bytes_for_internal_use`) — it never calls
  `fedos_random_bytes_32` or `fedos_aead_nonce_96` itself. Keeping
  byte-generation and byte-holding as two separate, independently-testable
  concerns is the same "two boundaries, not one" reasoning
  `docs/public_random_boundary.md` §1 already used to keep `randomBytes`
  and the nonce helper apart from each other.
- **`SecretHandle` does not, and must not, directly connect to HKDF or
  AEAD in the same stage that gives it real bytes.** §9 above already
  fixed this ordering; this update restates it now that the two
  PRECONDITION stages (randomBytes, nonce) are real: the stage that
  extends `SecretHandle` with real bytes must ship — and be reviewable —
  entirely on its own, verified against
  `docs/secret_memory_test_strategy.md`'s gates (Clone-absence,
  Debug-no-raw-byte, clear/is_cleared state machine, drop-time zeroize)
  BEFORE any HKDF or AEAD wiring is even proposed.
- **HKDF connection remains its own, later, separate stage** — per §9
  above, unchanged by this update.
- **AEAD connection remains a further, still-later, separate stage** —
  also unchanged, and now additionally has a real nonce source
  (`fedos_aead_nonce_96`, Stage 138) it will eventually consume, per
  `docs/secret_handle_api_shape.md` §10's sketch of that future
  connection's shape.
- See `docs/secret_handle_api_shape.md` (the concrete type/method shape)
  and `docs/secret_memory_test_strategy.md` (the concrete test gates) for
  the two documents this update introduces alongside it.

## 15. Stage 144–146 update — SecretHandle real bytes are now IMPLEMENTED

- **`SecretHandle` (`packages/fedos-core-rust/src/lib.rs`) now holds real
  secret bytes.** `new_from_32_bytes_for_internal_use(kind: SecretHandleKind,
  bytes: [u8; 32])` is a real, `cargo test`-verified constructor — the
  precondition item 3 of `docs/implementation_phase_roadmap.md` §1's fixed
  order is now DONE. `new_placeholder()` (Stage 79) is unchanged; both
  construction paths coexist on the same type.
- **Every policy fixed above was satisfied in this one stage**, per §1's
  "binding on whichever future stage implements it, ... in one commit/PR,
  not incrementally": `secrecy::SecretBox` wraps the real 32-byte buffer
  (§3), zeroize runs on `clear()` and again on drop (§6, proven via a
  `#[cfg(test)]`-only call-count counter — never a production code path),
  `Clone` is not implemented anywhere in the real-secret-holding types (§4),
  no `Debug`/`Display`/logging exposes a raw byte (§5), and no public
  function anywhere returns or accepts a raw secret byte (§8) —
  `SecretHandle` and every new item remain `pub(crate)`-at-most.
- **`SecretHandle` still does not generate its own bytes or a nonce**, per
  §14's restated rule: it never calls `fedos_random_bytes_32` or
  `fedos_aead_nonce_96` itself.
- **HKDF and AEAD remain unconnected**, exactly as §9 requires: this stage
  did not, in the same stage, wire `SecretHandle` into `kdf_core` or
  `aead_core`. Those remain their own, later, separate, explicitly-reviewed
  stages — Stage 147 is recommended to begin with an HKDF planning update
  (re-confirming domain separation and the derived-output `SecretHandle`'s
  shape in writing) before any HKDF implementation stage.
- **The §10 memory-safety limitations remain exactly as named, not
  solved**: compiler-introduced copies, OS/hardware paging, and core
  dumps/debuggers can still observe live secret memory before `Drop` runs.
  Nothing in this stage's implementation claims otherwise.
- See `packages/fedos-core-rust/README.md`'s "Internal secret-handle
  real-byte storage (Stage 144–146)" section for the full implementation
  writeup, and
  [`test/fedos_core_rust_secret_handle_real_bytes.test.ts`](../test/fedos_core_rust_secret_handle_real_bytes.test.ts)
  for the guard suite verifying every constraint above.

## 16. Stage 147 update — HKDF is now CONNECTED to SecretHandle; AEAD remains unconnected

- **§9's ordering is satisfied**: HKDF connects to `SecretHandle` (this
  update) BEFORE AEAD connects to HKDF's output (still a future, separate
  stage — see `docs/hkdf_internal_plan.md`'s AEAD staging section).
  `kdf_core::derive_secret_handle_internal(input: &SecretHandle, domain:
  HkdfDomain) -> HkdfDecision` is the one, reviewed connection point: it
  takes a `SecretHandle(HkdfInputMaterial)` by shared reference (never
  consuming or mutating it) and returns a NEW, independently-owned
  `SecretHandle(HkdfOutputMaterial)` — exactly the shape §9 anticipated
  ("never mutating the input in place, never returning raw bytes").
- **Domain separation is real, not a placeholder**, per §9's mandate: each
  `HkdfDomain` variant (`RootKey`/`Identity`/`Storage`/`Conversation`/
  `TestOnly`) carries its own fixed, distinct salt AND info context —
  `cargo test` proves two different domains derived from the SAME input
  `SecretHandle` produce different output bytes
  (`derive_secret_handle_internal_separates_output_by_domain`).
- **The one raw-byte exposure §8 anticipated now exists, exactly as narrow
  as promised**: `SecretHandle::expose_bytes_for_internal_derivation(&self)
  -> Option<[u8; 32]>` is `pub(crate)`, named for its one reviewed caller
  (`kdf_core`'s HKDF call site), returns `None` for the Stage 79
  placeholder path and after `clear()`, and is never re-exported or
  reachable from this crate's public API. No other raw-byte accessor was
  added.
- **`SecretHandle` still does not generate its own bytes or a nonce** —
  `derive_secret_handle_internal` does not call `fedos_random_bytes_32` or
  `fedos_aead_nonce_96` either; both remain independent, unconnected
  boundaries.
- **AEAD remains completely unconnected** — `kdf_core` never constructs an
  `AeadPlaceholderRequest` and never imports `chacha20poly1305`/`aes-gcm`.
  `docs/hkdf_internal_plan.md`'s AEAD staging section fixes, in writing,
  what AEAD's own future connection will look like (a
  `SecretHandle(AeadKeyMaterial)` input plus `fedos_aead_nonce_96`'s
  output) without building any of it.
- **`Cargo.toml` changed by exactly one line**: `sha2` moved from
  `[dev-dependencies]` to `[dependencies]` — necessary because `hkdf`'s API
  is generic over the hash algorithm, and a concrete one
  (`sha2::Sha256`) is mandatory to call it at all, in test OR production
  code. No other dependency was added.
- See `docs/hkdf_internal_plan.md` for the full design record and
  `packages/fedos-core-rust/README.md`'s Stage 147 section for the
  implementation writeup, and
  [`test/fedos_core_rust_hkdf_internal.test.ts`](../test/fedos_core_rust_hkdf_internal.test.ts)
  for the guard suite verifying every constraint above.
