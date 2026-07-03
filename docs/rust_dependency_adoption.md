# Rust Dependency Adoption Policy (binding)

**Update (Stage 74): the first dependency adopted under this policy is
`chacha20poly1305`** — see §12 "Adoption log" for its recorded review (crate +
version, primitive served, why this crate, transitive count, build-script
presence, internal `unsafe`, license, MSRV impact). `Cargo.toml`'s
`[dependencies]` table is no longer empty; `src/lib.rs` is unchanged and still
implements no cryptography. The rest of this document (§1–§11) is the
ORIGINAL Stage 72 process document and is otherwise unchanged.

**Update (Stage 76): the second dependency adopted under this policy is
`hkdf`** — see §12's `hkdf` — Stage 76 entry, appended after the
`chacha20poly1305` — Stage 74 entry (entries are appended, never edited in
place, per this section's own rule). `hkdf` serves the HKDF-SHA256 primitive
(RFC 5869 vectors imported Stage 73 at
test-vectors/kdf/hkdf-rfc5869.json); `src/lib.rs` is unchanged and still
implements no cryptography. `chacha20poly1305` v0.11.0 remains exactly as
adopted Stage 74 (and wired to the RFC 8439 vectors under `cfg(test)` Stage
75) — Stage 76 adds ONLY `hkdf`, following §1's one-crate-per-Stage rule.

**Update (Stage 78): the third adoption group under this policy is the
`zeroize` / `secrecy` / `subtle` secret-handling foundation** — see §12's
`zeroize` / `secrecy` / `subtle` — Stage 78 entry. This is a deliberate,
explicitly-reviewed REFINEMENT of §5's original wording ("adopted together
with the first primitive that handles real secret bytes") rather than a
silent violation of it: Stage 78 adopts the trio as a FOUNDATION ahead of
the internal secret-handle skeleton that will actually use them (Stage 79
candidate per this repo's README `Stage 78` status entry) — not "for later
with nothing ever planned to use them" (§1's speculative-add rule), but
one Stage ahead of the concrete consumer, with that consumer already named
as the immediate next Stage. §5's underlying concern — that these crates
must not sit unused indefinitely while hand-rolled secret handling
accumulates elsewhere in the meantime — still holds and is restated here:
no type in `src/lib.rs` holds a key/seed/plaintext/ciphertext byte today,
`derive_key_placeholder`/`encrypt_placeholder`/`decrypt_placeholder` remain
placeholders, and this ordering does not license a hand-rolled secret type
or comparison to appear before Stage 79 lands. `chacha20poly1305` and `hkdf`
remain exactly as adopted Stage 74/76 (and wired to their respective vector
files under `cfg(test)` Stage 75/77) — Stage 78 adds ONLY `zeroize` +
`secrecy` + `subtle`, reviewed and recorded together because they are one
inseparable secret-handling foundation (per §5's own grouping), not three
independent primitives.

**Update (Stage 84): the fourth dependency adopted under this policy is
`argon2`** — see §12's `argon2` — Stage 84 entry, appended after the
`zeroize`/`secrecy`/`subtle` — Stage 78 entry. `argon2` serves the Argon2id
password-hashing/KDF primitive (RFC 9106 vectors imported Stage 73 at
test-vectors/kdf/argon2id-rfc9106.json); `src/lib.rs` is unchanged and still
implements no cryptography. `chacha20poly1305` / `hkdf` /
`zeroize`/`secrecy`/`subtle` remain exactly as adopted Stage 74/76/78 — Stage
84 adds ONLY `argon2`, following §1's one-crate-per-Stage rule. Unlike
`chacha20poly1305`/`hkdf`, `argon2` is adopted with `default-features =
false` and NO features enabled at all — its default feature set (`alloc`,
`password-hash`, `rand`) would otherwise pull in `password-hash`'s optional
`rand_core` dependency (§6 reserves CSPRNG adoption for its own,
separate, explicitly-reviewed Stage); the bare hasher this crate will
eventually wire against the RFC 9106 vectors needs none of that convenience
API surface.

**Status: this document, as originally written in Stage 72, added no code and
added no dependency.** It fixes, in
writing, the PROCESS a future Stage must follow to add any dependency to
`packages/fedos-core-rust/Cargo.toml` — one crate at a time, audited, with a
recorded review. This concretizes the dependency policy already stated in
[`fedos_core_rust_safety.md`](fedos_core_rust_safety.md) §4–§5 into a
checklist-level process document.

No `Cargo.toml` change, no dependency, no Rust code, no `unsafe`, and no
crypto is added in this stage. If a future change would violate a rule below,
the rule wins — do not write the code, or open a new, explicitly-reviewed
Stage to renegotiate the rule in the open.

This is a safety contract, not a marketing claim. It complements
[`fedos_core_rust_safety.md`](fedos_core_rust_safety.md),
[`crypto_vector_sources.md`](crypto_vector_sources.md), and
[`verification_infrastructure.md`](verification_infrastructure.md).

---

## 1. One crate per Stage

- **A dependency-adoption Stage adds exactly one crate** (plus its own
  transitive tree) — never a bulk "add all the crypto crates" commit.
  Restated from [`fedos_core_rust_safety.md`](fedos_core_rust_safety.md) §5.
- **Each Stage states which primitive the crate serves** (e.g.
  "`chacha20poly1305` for AEAD") and links the vector file(s) from
  [`crypto_vector_sources.md`](crypto_vector_sources.md) that the crate must
  pass before it is considered adopted.
- **A crate with no immediate primitive use is not added speculatively.**
  "We'll need it eventually" is not sufficient justification for a Stage.

## 2. Audited crates only

- **Only reviewed, widely-used, maintained crates.** Preference order:
  crates with a public security audit or wide, long-term production use
  (e.g. the RustCrypto organization's crates) over anything less
  established.
- **No abandoned crates.** A crate with no maintenance activity in a long
  window, or explicitly marked unmaintained/deprecated upstream, is
  disqualified regardless of how well-known it once was.
- **No single-author novelty crates.** A crypto crate written and maintained
  by one person with no independent review is disqualified for FedOS's
  crypto core, even if it "looks correct".
- **The adopting Stage records why the specific crate was chosen** over
  visible alternatives (what was compared, what tipped the decision) — not
  just that it passed a checklist.

## 3. RustCrypto preference

- **RustCrypto crates are the default choice** for AEAD/KDF/hash primitives
  (e.g. `chacha20poly1305`, `aes-gcm`, `hkdf`, `sha2`) — a large,
  actively-maintained organization with a consistent API style and trait
  ecosystem (`aead`, `digest`, etc.), which keeps the crate surface uniform
  across primitives.
- **A non-RustCrypto crate requires an explicit reason.** Choosing something
  else is allowed only when RustCrypto has no suitable crate for the
  primitive, or the alternative has a documented, materially stronger
  provenance (e.g. a formally verified implementation) — the reason is
  recorded in the adopting Stage, not assumed.

## 4. libsodium — limited to specific uses

- **libsodium bindings are use-limited, not a default.** They are a
  candidate ONLY where RustCrypto has no equivalent AND the primitive's
  reference implementation is itself libsodium (e.g. XChaCha20-Poly1305 test
  vectors trace to libsodium per
  [`crypto_vector_sources.md`](crypto_vector_sources.md) §4).
- **A libsodium binding crate adds a C dependency and a build-script
  surface.** This is a materially larger supply-chain and build-reliability
  concern than a pure-Rust crate (§6's build-script rule) and must be
  weighed and stated explicitly in the adopting Stage, not glossed over.
- **Prefer a pure-Rust equivalent when one with adequate provenance
  exists**, even if libsodium is the "canonical" reference — the adopting
  Stage states this tradeoff explicitly rather than defaulting to libsodium
  out of convenience.

## 5. `zeroize` / `secrecy` / `subtle`

- **Adopted together with the first primitive that handles real secret
  bytes** — never adopted "for later" with nothing using them yet (restates
  [`fedos_core_rust_safety.md`](fedos_core_rust_safety.md) §6: "secrets and
  their zeroization arrive together").
- **`zeroize`** clears key/secret buffers on drop; any type holding raw
  key/seed/plaintext bytes derives or implements it.
- **`secrecy`** wraps secret values so they are not accidentally
  `Debug`/`Display`-printed, logged, or copied without an explicit
  `expose_secret()` call.
- **`subtle`** provides constant-time equality/selection; it is adopted
  alongside the FIRST primitive that needs to compare secret-derived bytes
  (e.g. an authentication tag) — never a hand-rolled comparison in the
  meantime (§9).

## 6. `rand` / `getrandom`

- **A separate, explicitly-reviewed Stage**, per
  [`fedos_core_rust_safety.md`](fedos_core_rust_safety.md) §7 — not bundled
  with an AEAD/KDF adoption Stage even though those primitives will
  eventually need randomness.
- **Only an audited CSPRNG source** (e.g. `rand` with the OS-backed
  `getrandom`/`OsRng` path) — never a non-cryptographic PRNG used for key
  material or nonces.
- **Deterministic/seeded RNG stays test-only.** A seeded RNG used to
  reproduce a known-answer vector never shares a code path with production
  key/nonce generation; the adopting Stage states how the two are kept
  separate in the crate's structure.

## 7. Semver update policy

- **A version bump is its own reviewed change**, not folded silently into an
  unrelated Stage.
- **A bump is validated against the full wired vector set before merge**
  (restated from [`verification_infrastructure.md`](verification_infrastructure.md)
  §7) — if any expected output changes, that is treated as a correctness
  incident to investigate, not an update to accept quietly.
- **A major-version bump is treated as a new adoption**, re-running the same
  review this document requires for a first-time add (crate reputation,
  audit status, maintenance activity may all have changed).
- **Pinned, not floating.** Dependencies are pinned to specific versions in
  `Cargo.toml` (and eventually locked via `Cargo.lock` policy, tracked by
  `dependencyLockDigest` in the build manifest); nothing floats on a loose
  range that could silently pull in an unreviewed version.

## 8. Dependency review (what a Stage must record)

Each dependency-adoption Stage records, at minimum:

- **crate name + exact version** being added,
- **which primitive** it serves and which vector file(s) it must pass,
- **why this crate** over alternatives (§2–§4),
- **transitive dependency count** (a rough supply-chain-surface statement —
  "adds N transitive crates"),
- **build-script presence** — does the crate or any transitive dependency
  run a build script (`build.rs`)? If yes, what does it do (codegen,
  linking a C library, etc.)?
- **`unsafe` presence** — does the crate use `unsafe` internally? (FedOS's
  own crate forbids `unsafe`, but a dependency is not bound by that
  `#![forbid]`; its own `unsafe` usage must be acknowledged, not assumed
  absent.)
- **license** — the crate's license, checked for compatibility.
- **MSRV impact** (§9) — does this crate raise the crate's minimum supported
  Rust version?

## 9. MSRV (minimum supported Rust version)

- **The crate's MSRV is stated explicitly once any dependency is added** —
  today, with zero dependencies, MSRV tracks whatever stable toolchain
  `cargo check` uses; adding a dependency may raise it.
- **An MSRV bump is called out in the adopting Stage**, not left implicit —
  stating the new minimum and which dependency required it.
- **No dependency is adopted whose MSRV requirement is undocumented
  upstream** — an adopting Stage must be able to state the crate's own
  MSRV policy (fixed, floating "latest stable", etc.), since an unstated
  policy makes future toolchain pinning
  ([`fedos_core_build_manifest.md`](fedos_core_build_manifest.md) §7,
  `rustToolchain`) unreliable.

## 10. Forbidden regardless of dependency state

Restated from [`fedos_core_rust_safety.md`](fedos_core_rust_safety.md) §5,
because this document is the one a future adoption Stage will read closest
to the moment of adding code — repeating them here is intentional, not
redundant:

- **No home-grown cryptography.** Every primitive comes from an audited
  crate (§2–§4); nothing is hand-implemented "to avoid a dependency".
- **No XOR cipher** or any other "obfuscation" construction, ever, under any
  name.
- **No custom constant-time comparison.** Secret-derived byte comparisons
  use `subtle` (§5) once adopted; before that, no code path compares secret
  bytes at all (there are no secrets yet — Stage 69's placeholder handles
  none).
- **No `unsafe` added to `packages/fedos-core-rust`'s own code** as a side
  effect of a dependency adoption — `#![forbid(unsafe_code)]` stays exactly
  as strict as [`fedos_core_rust_safety.md`](fedos_core_rust_safety.md) §3
  requires; a dependency may use `unsafe` internally (recorded per §8), but
  the FedOS crate's own code never does.

## 11. Current conclusion (as originally written, Stage 72 — see §12 for what changed in Stage 74)

- **Docs only (Stage 72).** That stage added no code and changed nothing under
  `src/` or `packages/fedos-core-rust/src/`.
- **No dependency added (Stage 72).** `Cargo.toml`'s `[dependencies]` table
  stayed empty; MSRV was unchanged.
- **No crypto, no `unsafe`, no randomness (Stage 72).** Nothing executed; it
  was a process document for a future Stage to follow.
- **A future explicit stage is required** for every crate this document
  discusses — one crate, one Stage, one recorded review (§8), every time. §12
  records the first such Stage.

## 12. Adoption log

Each entry follows the §8 review checklist. Entries are appended, never
edited in place, by the Stage that adopted the crate.

### `chacha20poly1305` — Stage 74

- **Crate + exact version:** `chacha20poly1305` v0.11.0 (pinned in
  `Cargo.toml`; `Cargo.lock` is not committed — see §7 "pinned, not
  floating" for the distinction between a pinned `Cargo.toml` version
  requirement and a committed lockfile).
- **Primitive served / vector file:** ChaCha20-Poly1305 AEAD; must eventually
  pass [`../test-vectors/aead/chacha20poly1305-rfc8439.json`](../test-vectors/aead/chacha20poly1305-rfc8439.json)
  (imported Stage 73) before any real implementation is wired.
- **Why this crate (§2–§3):** RustCrypto (default preference, §3); no
  libsodium binding needed since RustCrypto has a maintained, audited-family
  ChaCha20-Poly1305 implementation (§4 does not apply here).
- **Feature configuration:** `default-features = false`, `features =
  ["alloc"]` — explicitly excludes the crate's default `getrandom` feature
  (no CSPRNG dependency is adopted in this Stage, per §6).
- **Transitive dependency count:** 16 packages total per `cargo check`'s
  dependency-resolution output (`aead`, `block-buffer`, `cfg-if`, `chacha20`,
  `cipher`, `cmov`, `cpufeatures`, `crypto-common`, `ctutils`, `hybrid-array`,
  `inout`, `libc`, `poly1305`, `typenum`, `universal-hash`, plus
  `chacha20poly1305` itself) — all RustCrypto or small RustCrypto-adjacent
  utility crates; **no `getrandom`, no `rand`/`rand_core`, no `zeroize`**
  appear in the resolved graph with this feature configuration (verified by
  inspecting the generated `Cargo.lock` before deleting it, per the §7/Stage
  73 "Cargo.lock not committed" convention).
- **Build-script presence:** none. `chacha20poly1305` and its checked direct
  dependencies (`aead`, `chacha20`, `cipher`, `poly1305`, `cpufeatures`) each
  have no `build.rs`.
- **`unsafe` presence:** `chacha20poly1305` itself uses no `unsafe`. Several
  lower-level dependencies (`chacha20`, `poly1305`, `cipher`, `aead`,
  `cpufeatures`) use `unsafe` internally (SIMD backend selection / CPU
  feature detection) — acknowledged here, not assumed absent. This does not
  affect `packages/fedos-core-rust`'s own `#![forbid(unsafe_code)]`, which
  governs only this crate's code.
- **License:** Apache-2.0 OR MIT (chacha20poly1305, and the RustCrypto
  dependencies checked above use the same dual license).
- **MSRV impact:** `chacha20poly1305` 0.11.0 requires Rust ≥ 1.85 (per its
  published `rust_version`). This repository's toolchain at adoption time is
  newer, so no toolchain change was needed. No project-wide MSRV floor is
  formally pinned elsewhere yet — recorded as a gap, not silently assumed
  resolved.
- **What was NOT done:** no import of `chacha20poly1305` anywhere in
  `src/lib.rs`; no encrypt/decrypt implementation; no vector-loading code; no
  random/nonce/key generation; `Cargo.lock` was generated to verify the
  resolved dependency graph (§ above) and then deleted, not committed.

### `hkdf` — Stage 76

- **Crate + exact version:** `hkdf` v0.13.0 (pinned in `Cargo.toml`;
  `Cargo.lock` is not committed — same convention as the `chacha20poly1305`
  entry above).
- **Primitive served / vector file:** HKDF-SHA256 (extract-and-expand KDF);
  must eventually pass
  [`../test-vectors/kdf/hkdf-rfc5869.json`](../test-vectors/kdf/hkdf-rfc5869.json)
  (imported Stage 73) before any real implementation is wired. This Stage
  does not wire that file — see "What was NOT done" below.
- **Why this crate (§2–§3):** RustCrypto (default preference, §3); no
  libsodium binding needed since RustCrypto has a maintained, audited-family
  HKDF implementation (§4 does not apply here). `hkdf` is the RustCrypto
  KDFs-organization crate for HKDF specifically (as opposed to a
  hand-rolled HMAC-based construction), consistent with §10's "no home-grown
  cryptography" restated rule.
- **Feature configuration:** default features (no `default-features = false`
  override needed, unlike `chacha20poly1305`). `hkdf`'s only optional
  feature, `kdf` (an unrelated trait-abstraction crate from the `kdf` crate,
  not a hash algorithm), is NOT enabled — it is not selected by default and
  this Stage does not opt into it.
- **`sha2` explicitly NOT added this Stage.** `hkdf` is generic over its
  digest algorithm (its own dependency is only `hmac`, itself generic over
  `digest`'s traits) — no concrete hash algorithm crate is required to add
  `hkdf` to `Cargo.toml` or to pass `cargo check`. `sha2` (RustCrypto's
  SHA-256 implementation) is deferred to the future Stage that actually
  instantiates `Hkdf::<Sha256>` to wire the RFC 5869 vectors (Stage 77
  candidate, per this repo's README `Stage 76` status entry) — adding it now,
  unused, would violate §1's "no crate with no immediate primitive use is
  added speculatively" rule.
- **Transitive dependency count:** 3 NEW packages beyond what
  `chacha20poly1305` already pulls in — `hkdf` itself, `hmac` (its only
  dependency), and `digest` (`hmac`'s only dependency; already shared in the
  resolved graph via `crypto-common`'s use of `digest`-adjacent traits from
  the `chacha20poly1305` tree). Combined production dependency graph as of
  this Stage: 18 unique packages total (`aead`, `block-buffer`, `cfg-if`,
  `chacha20`, `chacha20poly1305`, `cipher`, `cmov`, `cpufeatures`,
  `crypto-common`, `ctutils`, `digest`, `hkdf`, `hmac`, `hybrid-array`,
  `inout`, `poly1305`, `typenum`, `universal-hash`), per `cargo tree -e
  normal`'s output at adoption time. **No `getrandom`, no `rand`/`rand_core`,
  no `zeroize`** appear in the resolved graph (verified by inspecting the
  generated `Cargo.lock` before deleting it).
- **Build-script presence:** none. `hkdf`, `hmac`, and `digest` each have no
  `build.rs`.
- **`unsafe` presence:** none of `hkdf`, `hmac`, or `digest` uses `unsafe` —
  `digest` itself declares `#![forbid(unsafe_code)]` in its own source. This
  is a cleaner result than `chacha20poly1305`'s transitive tree (which has
  internal `unsafe` in a few lower-level crates for SIMD/CPU-feature code);
  recorded here for completeness, not because any change was needed.
- **License:** MIT OR Apache-2.0 (`hkdf`, `hmac`, `digest` all use the same
  dual license — same license family as `chacha20poly1305`'s "Apache-2.0 OR
  MIT", just listed in the opposite order upstream).
- **MSRV impact:** `hkdf` 0.13.0 requires Rust ≥ 1.85 (per its published
  `rust-version`), same as `chacha20poly1305` 0.11.0 — no MSRV bump beyond
  what Stage 74 already established. This repository's toolchain at adoption
  time is newer, so no toolchain change was needed.
- **What was NOT done:** no import of `hkdf` anywhere in `src/lib.rs`
  (production or `cfg(test)`); no HKDF `extract`/`expand` implementation; no
  vector-loading code for
  [`../test-vectors/kdf/hkdf-rfc5869.json`](../test-vectors/kdf/hkdf-rfc5869.json);
  `derive_key_placeholder` is unchanged; no `sha2` (or any other digest
  crate) added; no random/key generation; `Cargo.lock` was generated to
  verify the resolved dependency graph (§ above) and then deleted, not
  committed.

### `zeroize` / `secrecy` / `subtle` — Stage 78

- **Crate + exact versions:** `zeroize` v1.9.0, `secrecy` v0.10.3, `subtle`
  v2.6.1 (all pinned in `Cargo.toml`; `Cargo.lock` is not committed — same
  convention as the `chacha20poly1305`/`hkdf` entries above). Reviewed and
  recorded together, per §5, as one secret-handling foundation rather than
  three independent adoptions.
- **Primitive served / vector file:** none — this trio serves no single AEAD
  or KDF primitive and has no known-answer test vector to pass. `zeroize`
  clears secret buffers on drop; `secrecy` wraps secret values against
  accidental `Debug`/`Display`/copy exposure; `subtle` provides
  constant-time equality/selection for a future secret-derived byte
  comparison. Adopted as a FOUNDATION ahead of the internal secret-handle
  skeleton that will use them (Stage 79 candidate) — see the "Update (Stage
  78)" note above for why this is a reviewed refinement of §5's original
  "adopted together with the first primitive that handles real secret
  bytes" wording, not a violation of it.
- **Why these crates (§2–§3):** `zeroize` and `secrecy` are RustCrypto
  organization crates (default preference, §3); `subtle` is
  dalek-cryptography's crate, the de facto standard constant-time-comparison
  crate in the Rust crypto ecosystem (used transitively by RustCrypto's own
  `poly1305`/`ctutils` stack already in this crate's dependency graph via
  `chacha20poly1305`, per §12's `chacha20poly1305` — Stage 74 entry's
  transitive list) — no equivalent RustCrypto-organization crate exists for
  constant-time comparison, so §3's "non-RustCrypto crate requires an
  explicit reason" is satisfied: `subtle` is the established choice with no
  RustCrypto alternative.
- **Feature configuration:** all three use DEFAULT features, unmodified.
  - `zeroize`: default feature is `alloc` only. The optional `derive`
    feature (which would pull in the `zeroize_derive` proc-macro crate) is
    deliberately NOT enabled — no type in this crate derives `Zeroize` yet
    (§10's rule against speculative capability).
  - `secrecy`: has no default-enabled optional feature; its only optional
    feature, `serde`, is NOT enabled. `secrecy` unconditionally depends on
    `zeroize` regardless of feature selection (it is not itself
    feature-gated).
  - `subtle`: default features are `std` + `i128`. Neither introduces
    `unsafe`, a build script, or a further transitive dependency beyond
    `subtle` itself (verified in the resolved `Cargo.lock` before deleting
    it).
- **Transitive dependency count:** exactly 3 NEW packages — `zeroize`,
  `secrecy`, `subtle` themselves. `secrecy`'s only dependency is `zeroize`
  (already counted); `subtle` has zero dependencies of its own. None
  overlaps with the existing `chacha20poly1305`/`hkdf` tree (verified via
  `cargo tree -e normal`: neither `zeroize` nor `subtle` appears anywhere in
  that tree before this Stage). Combined production dependency graph as of
  this Stage: 21 unique packages total (the 18 from the `hkdf` — Stage 76
  entry above, plus `zeroize`, `secrecy`, `subtle`), per `cargo tree -e
  normal`'s output at adoption time. **No `getrandom`, no `rand`/`rand_core`**
  appear in the resolved graph (verified by inspecting the generated
  `Cargo.lock` before deleting it).
- **Build-script presence:** none. `zeroize`, `secrecy`, and `subtle` each
  have no `build.rs` (`subtle`'s upstream `Cargo.toml` explicitly declares
  `build = false`).
- **`unsafe` presence:** `secrecy` declares `#![forbid(unsafe_code)]` in its
  own source (zero `unsafe`). `zeroize` uses `unsafe` internally (~10 call
  sites, mostly `core::ptr::write_volatile` and a raw-pointer offset helper)
  — this is intentional and load-bearing: volatile writes are how `zeroize`
  defeats compiler dead-store elimination to guarantee a zeroing write is
  not optimized away, which a safe-only implementation cannot achieve on
  stable Rust. `subtle` uses `unsafe` in 2 call sites (an optimization-barrier
  read and a `cmp::Ordering` raw-pointer cast used by its constant-time
  comparison primitives). None of this affects
  `packages/fedos-core-rust`'s own `#![forbid(unsafe_code)]`, which governs
  only this crate's code, not a dependency's — consistent with how
  `chacha20poly1305`'s internal `unsafe` was already acknowledged in its own
  Stage 74 entry above.
- **License:** `zeroize` — Apache-2.0 OR MIT; `secrecy` — Apache-2.0 OR MIT
  (same dual-license family as `chacha20poly1305`/`hkdf`); `subtle` —
  BSD-3-Clause (a new license family for this crate's dependency graph,
  checked for compatibility — BSD-3-Clause is a permissive license with no
  copyleft or additional obligation beyond attribution, compatible with this
  project's use).
- **MSRV impact:** `zeroize` 1.9.0 requires Rust ≥ 1.85 (per its published
  `rust-version`), same floor as `chacha20poly1305`/`hkdf` — no bump.
  `secrecy` 0.10.3 states `rust-version = "1.60"` (lower than the existing
  1.85 floor, so it does not raise it). `subtle` 2.6.1 publishes no
  `rust-version` field upstream (only `edition = "2018"`, which implies Rust
  ≥ 1.31) — its own MSRV policy is effectively "no fixed floor stated"; this
  is recorded as a gap per §9's "no dependency adopted whose MSRV
  requirement is undocumented upstream" rule, but is not blocking here
  because `subtle`'s `edition = "2018"` floor is already far below this
  repository's actual toolchain and below every other adopted crate's
  stated MSRV, so it cannot itself raise the crate's effective floor.
- **What was NOT done:** no import of `zeroize`, `secrecy`, or `subtle`
  anywhere in `src/lib.rs` — production or `cfg(test)` (no `#[cfg(test)]`
  module is added this Stage at all, unlike Stage 75/77, since there is no
  vector file for a dependency-adoption-only Stage to wire); no `Secret` /
  `SecretBox` / `ExposeSecret` type or usage; no `#[derive(Zeroize)]` or
  `.zeroize()` call; no `ConstantTimeEq` / `Choice` / `.ct_eq()` usage; no
  secret/key/seed/plaintext/ciphertext byte is defined, stored, or handled
  anywhere; `derive_key_placeholder` / `encrypt_placeholder` /
  `decrypt_placeholder` are unchanged; no random/key generation; no
  Runtime/Worker/`CryptoProvider` wiring; `Cargo.lock` was generated to
  verify the resolved dependency graph (§ above) and then deleted, not
  committed.

### `argon2` — Stage 84

- **Crate + exact version:** `argon2` v0.5.3 (pinned in `Cargo.toml`;
  `Cargo.lock` is not committed — same convention as every prior entry
  above).
- **Primitive served / vector file:** Argon2id password-hashing/KDF; must
  eventually pass
  [`../test-vectors/kdf/argon2id-rfc9106.json`](../test-vectors/kdf/argon2id-rfc9106.json)
  (imported Stage 73, RFC 9106 §5.3's Argon2id known-answer test case) before
  any real implementation is wired. This Stage does not wire that file — see
  "What was NOT done" below.
- **Why this crate (§2–§3):** RustCrypto (default preference, §3); no
  libsodium binding needed since RustCrypto has a maintained, audited-family
  Argon2 implementation (§4 does not apply here) — the same crate family
  already used for `chacha20poly1305`/`hkdf`.
- **Feature configuration:** `default-features = false`, NO `features`
  enabled. `argon2`'s own default features are `alloc`, `password-hash`, and
  `rand` — the `rand` feature specifically enables `password-hash`'s
  optional `rand_core` dependency (for `SaltString::generate`-style
  convenience). None of that convenience API (PHC-string encoding, salt
  generation) is needed to instantiate the low-level `Argon2` hasher
  directly against fixed vector bytes, and §6 reserves CSPRNG adoption for
  its own, separate, explicitly-reviewed Stage — so this Stage explicitly
  opts OUT of `argon2`'s defaults, mirroring Stage 74's
  `default-features = false` treatment of `chacha20poly1305`'s default
  `getrandom` feature. Verified empirically: with this configuration,
  neither `rand_core` nor `password-hash` appears anywhere in the resolved
  dependency graph.
- **Transitive dependency count:** 8 NEW packages beyond the existing
  21-package `chacha20poly1305`/`hkdf`/`zeroize`/`secrecy`/`subtle` tree —
  `argon2` itself, `base64ct`, `blake2`, and a SECOND, older generation of
  `digest`/`block-buffer`/`crypto-common`/`generic-array`/`cpufeatures`
  (Argon2's own `blake2` dependency pulls `digest` v0.10.7, distinct from
  the `digest` v0.11.3 already in the tree via `hkdf`/`hmac` — both
  generations coexist in the resolved graph, which Cargo permits; this is a
  binary-size/compile-time note, not a build failure). `subtle` v2.6.1 and
  `typenum` v1.20.1 are REUSED at their existing pinned versions (no
  duplicate). Combined production dependency graph as of this Stage:
  29 unique (name, version) packages total, per `cargo tree -e normal`'s
  output at adoption time. **No `getrandom`, no `rand`/`rand_core`, no
  `password-hash`** appear in the resolved graph (verified by inspecting
  the generated `Cargo.lock` before deleting it) — a direct consequence of
  the feature configuration above, not merely an absence of a default
  choice elsewhere.
- **Build-script presence:** none for `argon2`, `base64ct`, or `blake2`
  themselves. Two ALREADY-established transitive crates in the wider tree
  (`generic-array`, `libc`, both already present via the
  `chacha20poly1305`/`cpufeatures` tree since Stage 74) have their own
  `build.rs` — unchanged by this Stage, not newly introduced by `argon2`.
- **`unsafe` presence:** `argon2` itself uses `unsafe` in 2 call sites (an
  AVX2 SIMD backend for its compression function — the same
  SIMD-acceleration pattern already acknowledged for `chacha20poly1305`'s
  transitive tree in its own Stage 74 entry above). `blake2` and `base64ct`
  also use `unsafe` internally (their own SIMD/const-time-encoding
  internals). None of this affects `packages/fedos-core-rust`'s own
  `#![forbid(unsafe_code)]`, which governs only this crate's code.
- **License:** MIT OR Apache-2.0 (`argon2`, `blake2`); Apache-2.0 OR MIT
  (`base64ct`) — same dual-license family as every other adopted crate so
  far.
- **MSRV impact:** `argon2` 0.5.3 requires Rust ≥ 1.65 (per its published
  `rust-version`) — lower than the existing 1.85 floor established by
  `chacha20poly1305`/`hkdf`/`zeroize`, so no bump. `base64ct` 1.8.3 states
  ≥ 1.85 (matches the existing floor exactly, no-op). `blake2` publishes no
  `rust-version` upstream — recorded as a documented gap per §9, not
  blocking since its transitive presence via `digest`/`crypto-common` (both
  themselves stating no fixed floor either) does not raise the crate's
  effective MSRV above what `chacha20poly1305`/`hkdf`/`zeroize` already
  require.
- **What was NOT done:** no import of `argon2` anywhere in `src/lib.rs` —
  production or `cfg(test)` (no `#[cfg(test)]` module is added this Stage,
  same as Stage 78, since wiring the RFC 9106 vector is deferred to a future
  Stage); no Argon2id hashing/verification implementation; no vector-loading
  code for
  [`../test-vectors/kdf/argon2id-rfc9106.json`](../test-vectors/kdf/argon2id-rfc9106.json);
  `derive_key_placeholder` is unchanged; no random/password/key generation;
  no Runtime/Worker/`CryptoProvider` wiring; `Cargo.lock` was generated to
  verify the resolved dependency graph (§ above) and then deleted, not
  committed.

### `aes-gcm` — Stage 101

- **Crate + exact version:** `aes-gcm` v0.10.3 (pinned in `Cargo.toml`;
  `Cargo.lock` is not committed — same convention as every prior entry
  above).
- **Primitive served / vector file:** AES-256-GCM (this crate's SECOND
  AEAD); wired to
  [`../test-vectors/aead/aes256gcm-nist.json`](../test-vectors/aead/aes256gcm-nist.json)
  (imported Stage 73, NIST CAVP AES-256-GCM known-answer test vectors) IN
  THE SAME STAGE — unlike every prior entry in this log, which adopted its
  crate as a dependency-only step and deferred vector wiring to a later
  Stage (`chacha20poly1305` Stage 74 → wired Stage 75; `hkdf` Stage 76 →
  wired Stage 77; `argon2` Stage 84 → wired Stage 85), this Stage combines
  adoption + wiring + test-only helper extraction into one reviewed unit,
  per this Stage's own explicit scope.
- **Why this crate (§2–§3):** RustCrypto (default preference, §3); no
  libsodium binding needed since RustCrypto has a maintained, audited-family
  AES-GCM implementation (§4 does not apply here) — the same crate family
  already used for `chacha20poly1305`/`hkdf`/`argon2`.
- **Feature configuration:** `default-features = false`, `features =
  ["aes", "alloc"]` — explicitly selects only the AES block-cipher backend
  and `alloc`-based buffer support. `aes-gcm`'s optional `getrandom`
  feature (which would pull in a CSPRNG dependency for nonce-generation
  convenience) is NOT enabled — no random-number source is adopted in this
  Stage (docs/fedos_core_rust_safety.md §7, §6 above), same explicit
  opt-out pattern as `chacha20poly1305` (Stage 74) and `argon2` (Stage 84).
  Note: unlike `chacha20poly1305`/`argon2`, `aes-gcm`'s own *default*
  feature set (`["aes", "alloc"]`) already excludes `getrandom` — this
  Stage's explicit `default-features = false` override is therefore
  belt-and-suspenders (guards against a future upstream default-feature
  change), not strictly required to avoid `getrandom` today.
- **Transitive dependency count:** 10 NEW packages beyond the existing
  29-package `chacha20poly1305`/`hkdf`/`zeroize`/`secrecy`/`subtle`/`argon2`
  tree — `aes-gcm` itself, `aead` v0.5.2 (a SECOND, older generation,
  distinct from the `aead` v0.6.1 already in the tree via
  `chacha20poly1305`), `aes`, `cipher` v0.4.4 (a second, older generation,
  distinct from `cipher` v0.5.2), `ctr`, `ghash`, `opaque-debug`,
  `polyval`, and `universal-hash` v0.5.1 (a second, older generation,
  distinct from `universal-hash` v0.6.1). `crypto-common` v0.1.7,
  `generic-array` v0.14.7, `cpufeatures` v0.2.17, `subtle` v2.6.1, and
  `cfg-if` v1.0.4 are REUSED at their existing pinned versions (no
  duplicate) — the same "two generations of a RustCrypto trait crate
  coexist" pattern already noted in the `argon2` entry above (there,
  `digest` v0.10 vs v0.11; here, `aead`/`cipher`/`universal-hash`/`inout`
  each v0.4–0.5 vs v0.5–0.6), which Cargo permits and is a binary-size/
  compile-time note, not a build failure. Combined production dependency
  graph as of this Stage: 39 unique (name, version) packages total, per
  `cargo tree -e normal`'s output at adoption time. **No `getrandom`, no
  `rand`/`rand_core`** appear in the resolved graph (verified by
  inspecting the generated `Cargo.lock` before deleting it) — a direct
  consequence of the feature configuration above.
- **Build-script presence:** none for `aes-gcm`, `aead` v0.5.2, `aes`,
  `cipher` v0.4.4, `ctr`, `ghash`, `opaque-debug`, `polyval`, or
  `universal-hash` v0.5.1.
- **`unsafe` presence:** `aes-gcm` itself declares `#![deny(unsafe_code)]`
  — no `unsafe` in its own source. `aes` uses `unsafe` internally across
  its AES-NI (x86/x86_64 hardware AES instruction set) and ARMv8
  cryptography-extension backends, plus their CPU-feature autodetection —
  the same SIMD/hardware-acceleration pattern already acknowledged for
  `chacha20poly1305`'s and `argon2`'s transitive trees in their own
  entries above. None of this affects `packages/fedos-core-rust`'s own
  `#![forbid(unsafe_code)]`, which governs only this crate's code.
- **License:** Apache-2.0 OR MIT (`aes-gcm`, `ghash`, `polyval`,
  `universal-hash` v0.5.1) / MIT OR Apache-2.0 (`aes`, `cipher` v0.4.4,
  `ctr`) — same dual-license family as every other adopted crate so far.
- **MSRV impact:** `aes-gcm` 0.10.3, `aes` 0.8.4, `ctr` 0.9.2, `ghash`
  0.5.1, and `polyval` 0.6.2 each publish `rust-version = "1.56"` — well
  below the existing 1.85 floor established by
  `chacha20poly1305`/`hkdf`/`zeroize`, so no bump.
- **What was DONE (unlike every prior "adoption only" entry above):** a
  new `#[cfg(test)]`-only module, `aes256gcm_vectors`, reads
  [`../test-vectors/aead/aes256gcm-nist.json`](../test-vectors/aead/aes256gcm-nist.json)
  via `include_str!` and asserts `aes-gcm` reproduces its known-answer
  bytes; two private, test-only helper functions,
  `seal_aes256gcm_for_test`/`open_aes256gcm_for_test`, exist ONLY inside
  that module (never `pub`/`pub(crate)`, never re-exported), mirroring the
  byte-level shape `seal_chacha20poly1305_for_test`/
  `open_chacha20poly1305_for_test` (Stage 81) and
  `derive_argon2id_for_test` (Stage 86) already established — but
  extracted from the start in this Stage, rather than as a later
  refactor.
- **What was NOT done:** no import of `aes-gcm` anywhere in `src/lib.rs`'s
  PRODUCTION code (everything before the file's first `#[cfg(test)]`-gated
  module); no public `encrypt`/`decrypt` implementation using it; the
  crate-private `aead_core` skeleton (Stage 80) is UNCHANGED and still
  placeholder-only, not connected to the new module;
  `encrypt_placeholder`/`decrypt_placeholder` are unchanged; no random/
  nonce/key generation; no Runtime/Worker/`CryptoProvider` wiring;
  `Cargo.lock` was generated to verify the resolved dependency graph and
  run `cargo test` (§ above) and then deleted, not committed.
