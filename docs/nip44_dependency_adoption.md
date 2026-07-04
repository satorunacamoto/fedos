# NIP-44 secp256k1 Dependency Adoption Planning (Stage 192, DECIDED Stage 194) — binding, docs only

**Status: Stage 194 has ADOPTED `k256` — see §6.** This document
originally (Stage 192) added no code and made no decision; it compared
the two realistic secp256k1/ECDH crate candidates
`docs/nip44_internal_plan.md` §3 and `docs/nip44_vector_readiness.md` §3
step 2 both name ("secp256k1 dependency adoption") — `rust-secp256k1` and
`k256` — against the criteria `docs/rust_dependency_adoption.md` already
fixes for any new dependency, and against this stage's own additional
secp256k1-specific criteria (no_std, WASM, audit history, maintenance,
MSRV). As of Stage 192 itself: no dependency was adopted, `Cargo.toml`
was unchanged (9 production dependencies, no secp256k1/ECDH crate of any
kind) — §6 records what changed at Stage 194.

This complements, and does not renegotiate, `docs/rust_dependency_adoption.md`
(this crate's general one-crate-per-stage adoption discipline, which the
actual future adoption stage must still satisfy in full), `docs/nip44_internal_plan.md`
(§3, which named this exact dependency gap and deferred it here), and
`docs/nip44_vector_readiness.md` (§3, whose step 2 is what this planning
document prepares for — still not taken). Where this document and any of
those disagree, the earlier binding docs win.

---

## 1. Purpose

- **Name the two realistic candidates** for the secp256k1 ECDH primitive
  `docs/nip44_internal_plan.md` §3 identifies as needed for conversation-key
  derivation, and lay out what is actually known/unknown about each.
- **Fix the criteria** a future adoption stage must weigh — extending
  `docs/rust_dependency_adoption.md`'s general dependency-review discipline
  with secp256k1-specific concerns this crate has not needed for any prior
  dependency (chacha20poly1305/hkdf/argon2/aes-gcm/getrandom/sha2/zeroize/
  secrecy/subtle are all pure-Rust, no_std-friendly, non-FFI crates already
  — secp256k1 is the FIRST candidate where a C-FFI-backed option is even on
  the table).
- **Not a decision.** No crate is recommended, ranked, or adopted. Several
  facts below (exact current version, exact MSRV, exact audit report
  citation) are marked "verify at adoption time" rather than asserted with
  false precision — a planning document is the wrong place to freeze a
  fact that drifts with upstream releases.

## 2. The two candidates

### 2.1 `rust-secp256k1` (crates.io: `secp256k1`)

- **What it is**: Rust bindings (via `secp256k1-sys`) to `libsecp256k1`,
  the C library Bitcoin Core itself uses for all of its own secp256k1
  arithmetic. Maintained by the `rust-bitcoin` organization.
- **Implementation strategy**: C library + FFI bindings, not a pure-Rust
  implementation. Building it compiles C source (via the `cc` crate as a
  build dependency) unless a `cc`-free/vendored-headers configuration is
  used — verify current build requirements at adoption time.
- **Feature flags** (verify exact current set at adoption time; historical
  shape): `std` (default), `alloc` (for `no_std` + heap), `rand` (RNG
  convenience, would pull in a `rand`-ecosystem crate this repository has
  deliberately not adopted — see `docs/rust_dependency_adoption.md` §12's
  "only `getrandom` itself, not `rand`/`rand_core`" precedent), `serde`
  (NOT wanted — this crate has never enabled `serde` in a production
  dependency), `recovery` (public-key recovery from a signature — not
  needed for NIP-44's ECDH-only usage), `global-context` (a lazily-
  initialized shared secp256k1 context — a global-state pattern this
  crate has avoided everywhere else), `lowmemory` (smaller precomputed
  tables, slower operations — an embedded-target optimization).
- **`no_std` support**: yes, via the `alloc` feature (no `std`
  requirement) — but the underlying C library must still be CROSS-
  COMPILED for the target, which is a different (and historically more
  fragile) concern than a pure-Rust crate's `no_std` support.
- **WASM support**: buildable for WASM targets, but historically requires
  either `wasm32-unknown-emscripten` (a libc-providing WASM target) or
  additional toolchain configuration for `wasm32-unknown-unknown` (which
  has no libc by default, and C-FFI crates generally need one) — this has
  been a recurring friction point for pure-`wasm32-unknown-unknown`
  consumers industry-wide. Not a blocker (this crate has NO WASM target
  today regardless — `packages/fedos-core-rust/Cargo.toml`'s `[lib]`
  section is `crate-type = ["rlib"]` only), but relevant to `docs/nip44_internal_plan.md`'s
  eventual public-API-and-beyond future and any eventual browser/WASM
  consumer of this crate.
- **Audit / production track record**: `libsecp256k1` (the underlying C
  library) is the SAME code Bitcoin Core has run in production, securing
  many billions of dollars of value, for years — an exceptionally deep
  real-world usage/scrutiny history, though "extensively used in
  production" is not the same claim as "formally audited" — verify
  whether a current, citable third-party security audit report exists
  for the specific version under consideration at adoption time, rather
  than assuming one from this crate's Bitcoin Core reputation alone.
- **Maintenance**: actively maintained by `rust-bitcoin`, a well-
  established Rust cryptocurrency ecosystem organization with a long
  release history.
- **MSRV**: the `rust-bitcoin` ecosystem has historically maintained a
  conservative (older-Rust-compatible) MSRV policy — verify the exact
  current MSRV against this crate's own `edition = "2021"` Cargo.toml
  setting at adoption time.
- **License**: verify the exact current SPDX identifier at adoption
  time — do not assume without checking, since a C-library binding can
  carry different terms for the bindings crate versus the vendored/linked
  C source.
- **Ecosystem fit with THIS crate**: this crate's existing 9 production
  dependencies (chacha20poly1305, hkdf, zeroize, secrecy, subtle, argon2,
  aes-gcm, getrandom, sha2) are ALL pure-Rust, non-FFI, RustCrypto-or-
  RustCrypto-adjacent crates. `rust-secp256k1` would be the FIRST
  C-FFI/`unsafe`-internally dependency this crate has ever adopted — a
  qualitatively different risk category worth naming explicitly, even
  though this crate's own `#![forbid(unsafe_code)]` (`src/lib.rs`) only
  forbids `unsafe` written directly in THIS crate's source, not inside a
  dependency (a C-FFI binding necessarily contains `unsafe` internally to
  call into the C library — that is unavoidable for this candidate,
  wherever the ECDH implementation ultimately comes from).

### 2.2 `k256` (crates.io: `k256`, part of the RustCrypto `elliptic-curves` workspace)

- **What it is**: a pure-Rust secp256k1 implementation (field/group
  arithmetic, ECDSA, ECDH, Schnorr signatures behind feature flags),
  maintained by the RustCrypto organization — the same organization that
  maintains `hkdf`, `aes-gcm`, `chacha20poly1305`'s underlying primitives'
  siblings, `sha2`, and `subtle`, all of which this crate ALREADY depends
  on.
- **Implementation strategy**: pure Rust, no C dependency, no `cc` build
  step.
- **Feature flags** (verify exact current set at adoption time; historical
  shape): `arithmetic` (field/group operations — needed for ECDH),
  `ecdsa` (signing/verification — NOT needed for NIP-44's ECDH-only
  usage), `ecdh` (the specific Diffie-Hellman shared-secret operation
  NIP-44 needs), `schnorr` (BIP-340-style Schnorr — not needed here,
  though relevant to this crate's OWN future, separate Nostr-signing
  candidate work), `serde` (NOT wanted, same reasoning as §2.1),
  `precomputed-tables` (performance, larger binary), `std`/`alloc`
  (default-features-off `no_std` support).
- **`no_std` support**: a first-class design goal across the RustCrypto
  `elliptic-curves`/`traits` workspace — generally the more mature
  `no_std` story of the two candidates, since there is no C toolchain
  cross-compilation concern at all.
- **WASM support**: compiles to `wasm32-unknown-unknown` directly, no
  emscripten/libc shim needed — the simpler WASM story of the two
  candidates, for the same "pure Rust, no FFI" reason.
- **Audit / production track record**: RustCrypto's elliptic-curve crates
  have received SOME third-party security review as part of broader
  RustCrypto audit efforts, but pure-Rust elliptic-curve implementations
  as a category are, industry-wide, newer and less battle-tested in
  adversarial production conditions than `libsecp256k1` specifically —
  verify whether a current, citable audit report exists for `k256`
  specifically (as opposed to the RustCrypto workspace generally) at
  adoption time.
- **Maintenance**: actively maintained by RustCrypto, released as part of
  the shared `elliptic-curves` workspace alongside other curve crates.
- **MSRV**: RustCrypto crates generally track a moderately current MSRV,
  periodically bumped across workspace releases — verify the exact
  current MSRV against `edition = "2021"` at adoption time.
- **License**: Apache-2.0 OR MIT — RustCrypto's standard dual-license
  convention, matching every dependency this crate has adopted so far
  (verify the exact current `Cargo.toml`-declared license at adoption
  time regardless, per this crate's standing practice of not assuming).
- **Ecosystem fit with THIS crate**: same organization, same license
  convention, same "pure Rust, no FFI, `no_std`-friendly" shape as every
  dependency already in `packages/fedos-core-rust/Cargo.toml`'s
  `[dependencies]` section — the more homogeneous fit of the two
  candidates with this crate's existing dependency tree.

## 3. Adoption criteria (fixed; NOT weighed/decided here)

A future adoption stage (Stage 194 candidate: "rust-secp256k1 adoption",
though §2 above shows `k256` remains equally live a candidate under this
same criteria set — the Stage 194 NAME does not itself decide) MUST weigh
its choice against ALL of the following:

1. **Every criterion `docs/rust_dependency_adoption.md` already fixes for
   any new dependency** — this is an ADDITIONAL criteria list, not a
   replacement for that document's own review process.
2. **Minimal feature set.** Whichever crate is chosen, only the features
   NIP-44's ECDH-only usage needs are enabled (`docs/nip44_internal_plan.md`
   §3 needs raw ECDH shared-secret computation ONLY — no signing, no
   recovery, no Schnorr) — mirroring this crate's existing
   `default-features = false` discipline already applied to
   `chacha20poly1305`/`argon2`/`aes-gcm`.
3. **No `rand`/`rand_core` pull-in.** Neither candidate's `rand`-
   convenience feature (`rust-secp256k1`'s `rand` feature; `k256`
   indirectly through any RNG-convenience surface) may be enabled — this
   crate draws randomness ONLY through `getrandom::fill`, with no
   `rand`/`rand_core` dependency anywhere (`docs/rust_dependency_adoption.md`
   §12).
4. **No `serde` feature enabled.** Neither candidate's optional `serde`
   support may be turned on — this crate implements its own hand-written
   canonical JSON (`crypto::ciphertext_serialization`, Stage 186) and has
   never enabled `serde` in a PRODUCTION dependency (`serde`/`serde_json`
   remain `[dev-dependencies]`-only test-vector-parsing tools).
5. **A citable, current audit posture, not an assumed one.** Whichever
   candidate is chosen, the adopting stage names WHAT is actually known
   about that specific crate/version's security review history at THAT
   time (a specific audit report, or an explicit "no independent audit
   found, relying on production usage history/community review") — never
   an assumption carried over unverified from this planning document.
6. **`no_std`/WASM posture is recorded, even though unused today.** This
   crate has no WASM target today (§2.1), but `docs/nip44_internal_plan.md`
   itself is written expecting a FUTURE public API and possibly a future
   WASM/browser consumer — the adopting stage records the chosen
   candidate's `no_std`/WASM shape for that future's benefit, even if
   nothing in the adopting stage itself exercises either.
7. **MSRV compatibility with `edition = "2021"`** (`packages/fedos-core-rust/Cargo.toml`) —
   verified against the ACTUAL current release under consideration, not
   assumed from this document's general characterization.
8. **One crate, one stage, its own review** — per
   `docs/rust_dependency_adoption.md`'s standing "one crate per stage"
   discipline (the Stage 78 zeroize/secrecy/subtle trio being the one
   reviewed EXCEPTION, not a precedent for bundling this decision with
   anything else).
9. **Scope stays ECDH-only.** Whichever crate is chosen, this adoption
   stage adds ONLY the dependency + a build check (mirroring every prior
   "adopt first, wire later" dependency stage in this crate's history:
   chacha20poly1305 Stage 74, hkdf Stage 76, argon2 Stage 84, aes-gcm
   Stage 101, getrandom Stage 104) — NO conversation-key derivation
   function, no NIP-44 code of any kind, is authorized by the adoption
   itself. `docs/nip44_vector_readiness.md` §3 step 3 (conversation-key
   test) remains its own, separate, later stage.

## 4. What this document does NOT do

- **No dependency is adopted.** `Cargo.toml` is unchanged — still 9
  production dependencies, still zero secp256k1/ECDH crates.
- **No recommendation between `rust-secp256k1` and `k256`.** Both remain
  live candidates; §3's criteria are for the FUTURE adopting stage to
  weigh, not resolved here.
- **No NIP-44 cryptographic code of any kind** — this is a dependency
  PLANNING document only.
- **No Runtime/Worker/Storage/Federation/Relay connection.**
- **No public API addition.**

## 5. Conclusion

- **Two candidates named** (§2): `rust-secp256k1` (C-FFI, Bitcoin-Core-
  proven, less homogeneous fit with this crate's existing pure-Rust
  dependency tree) and `k256` (pure Rust, RustCrypto-family, more
  homogeneous fit, comparatively newer as a category).
- **Nine adoption criteria fixed** (§3), extending
  `docs/rust_dependency_adoption.md`'s general review process with
  secp256k1-specific concerns (feature minimalism, no `rand`/`serde`,
  citable audit posture, `no_std`/WASM posture, MSRV, scope discipline).
- **No decision, no dependency, no `Cargo.toml` change, no NIP-44 code**
  is made or authorized by this document AS OF STAGE 192.
- **The actual adoption decision and `Cargo.toml` change happened at
  Stage 194** — see §6 below for the full record.

## 6. Stage 194 update — `k256` ADOPTED

Stage 194 resolves §3's nine criteria in favor of **`k256`**, weighed as
follows:

1. **RustCrypto ecosystem fit (the deciding factor)**: `k256` is
   maintained by the SAME organization as `hkdf`/`aes-gcm`/`chacha20poly1305`'s
   underlying primitives/`sha2`/`zeroize`/`secrecy`/`subtle`/`argon2` —
   every dependency already in this crate's `Cargo.toml`. Same Apache-2.0
   OR MIT license convention, same pure-Rust/no-FFI/`no_std`-friendly
   shape, same `#![forbid(unsafe_code)]`-COMPATIBLE profile (this crate's
   own `unsafe_code` forbid only covers code written directly in this
   crate — `rust-secp256k1`'s C-FFI bindings would necessarily contain
   `unsafe` internally, in a DEPENDENCY, for the first time; `k256`
   introduces no such new risk category).
2. **Audit posture**: neither candidate has a citable, `k256`/
   `rust-secp256k1`-SPECIFIC third-party audit report as of this
   decision (§2's own comparison already named this honestly for both) —
   this criterion did not favor either candidate decisively, so it did
   NOT drive the final choice; `libsecp256k1`'s (rust-secp256k1's
   underlying C library) multi-year Bitcoin-Core-production track record
   remains a real, if different-shaped, form of scrutiny that `k256`
   does not yet have an equivalent of. This is named honestly, not
   glossed over: `k256`'s audit posture is the ONE criterion where
   `rust-secp256k1` arguably had the stronger case, outweighed here by
   ecosystem-fit and feature-minimality considerations instead.
3. **Feature minimalism**: `k256`'s `arithmetic` feature (see §7 below)
   is a smaller, more targeted enable-surface for THIS crate's ECDH-only
   need than `rust-secp256k1`'s comparable minimal configuration, mostly
   because `k256`'s feature graph is already split finely (arithmetic /
   ecdsa / ecdh / schnorr are each separately gate-able), whereas
   `rust-secp256k1`'s C library bundles more functionality behind fewer
   feature seams.
4. **WASM/no_std posture**: `k256` compiles to `wasm32-unknown-unknown`
   directly with no emscripten/libc shim, and its `no_std` support has no
   C-toolchain cross-compilation concern — the simpler story of the two,
   relevant to `docs/nip44_internal_plan.md`'s eventual public-API-and-
   beyond future even though this crate has no WASM target today.
5. **MSRV**: compatible with this crate's `edition = "2021"` — verified
   at adoption time via `cargo check` succeeding with the exact version
   pinned in `Cargo.toml`/`Cargo.lock`.
6. **Scope discipline**: `k256` is adopted ALONE, as its own single
   `Cargo.toml` change, exactly like every prior first-adoption stage in
   this crate's history (`chacha20poly1305` Stage 74, `hkdf` Stage 76,
   `argon2` Stage 84, `aes-gcm` Stage 101, `getrandom` Stage 104).

## 7. Feature selection rationale

`Cargo.toml`'s `k256` line: `default-features = false`, `features =
["arithmetic"]` — chosen because:

- **`arithmetic`** is the minimum needed for ANY future ECDH stage to
  build on (field/group operations) — nothing less would let a future
  stage even begin; nothing more is needed YET.
- **`ecdsa`/`schnorr` deliberately excluded**: NIP-44's conversation key
  needs raw ECDH (a shared-secret computation), never signing/
  verification. `schnorr` in particular is reserved for a SEPARATE,
  future, explicitly-reviewed Nostr-event-signing candidate — conflating
  the two would blur two unrelated capabilities into one dependency
  decision.
- **`serde` deliberately excluded**: this crate has never enabled `serde`
  in a PRODUCTION dependency (`docs/ciphertext_serialization_format_decision.md`
  — this crate's own canonical JSON codec is hand-written against the
  standard library specifically to avoid needing it).
- **`pem`/`pkcs8` deliberately excluded**: key-file-format encoding is
  irrelevant to an in-memory ECDH shared-secret computation — this crate
  has never persisted or exported a key in any file format.
- **No `rand`/`rand_core`-enabling FEATURE was selected** — `rand_core`
  DOES still appear in the resolved dependency graph (verified via
  `cargo tree -i rand_core`), but ONLY as a required, non-optional
  transitive dependency of `elliptic-curve`/`ff`/`group`/`crypto-bigint`
  (the trait crates `arithmetic` itself is built on) — an ecosystem-wide
  RustCrypto elliptic-curve trait requirement (e.g. `ff::Field`'s
  `random(rng)` trait method signature), confirmed unavoidable for ANY
  `k256` feature/version combination, not a feature THIS crate chose to
  turn on. `rand_core` is trait-definitions-only (`RngCore`/`CryptoRng`),
  with no actual entropy-source implementation — it cannot compete with
  or bypass `getrandom::fill`, this crate's one CSPRNG source. The full
  `rand` crate remains entirely absent from the resolved graph. This is a
  REVIEWED, USER-CONFIRMED exception to `docs/rust_dependency_adoption.md`
  §12's "no rand/rand_core anywhere" rule — recorded here, in
  `Cargo.toml`'s own comment, and verified by
  `packages/fedos-core-rust/src/crypto/secp256k1_dependency_guard.rs`
  (Stage 196).

## 8. Fixed future implementation order (unchanged from `docs/nip44_vector_readiness.md` §3, restated here for this document's own completeness)

Stage 194's adoption does not itself authorize skipping ahead. The
remaining steps stay in this exact order, one capability per stage, per
this crate's standing "1 stage = 1 crypto capability" discipline — a
future stage never combines two of these into one commit, and every
intermediate commit within a future stage keeps `cargo check`/`cargo
test` green:

1. **ECDH** — the shared-secret computation itself (Stage 198 candidate:
   skeleton; Stage 199 candidate: real implementation, per
   `docs/nip44_vector_readiness.md` §3 steps 2–3, combined or split at
   that future stage's own discretion).
2. **ConversationKey** — HKDF-extract from the ECDH shared secret
   (depends on step 1 landing first).
3. **MessageKey** — HKDF-expand from the conversation key (depends on
   step 2).
4. **Padding** — the length-obscuring schedule (independent of steps
   1–3, but ordered after them here to match `docs/nip44_vector_readiness.md`'s
   fixed sequence).
5. **Encrypt** — pad → ChaCha20 → HMAC → payload assembly (depends on
   steps 2–4).
6. **Decrypt** — HMAC-verify → decrypt → unpad (depends on step 5's
   encrypt path existing to test against).
7. **NIP-44** (the full public-facing primitive, if/when a public API is
   authorized) — depends on all of the above.

No step in this order is built by Stage 194–197 — this section only
fixes the SEQUENCE a future stage must follow, restating (not
re-deciding) `docs/nip44_vector_readiness.md` §3.

## 9. Conclusion (Stage 194)

- **`k256` adopted**, `default-features = false`, `features =
  ["arithmetic"]` only — no `ecdsa`/`schnorr`/`serde`/`pem`/`pkcs8`/`rand`
  feature enabled.
- **`rand_core` appears in the resolved graph as a reviewed, unavoidable,
  trait-only transitive dependency** — the full `rand` crate remains
  absent.
- **`CryptoCapability` gains an eleventh variant, `Ecdh`**, reporting a
  new `CapabilityReadiness::ReadyForImplementation` (Stage 195) — neither
  `Ready` (no code exists) nor `NotImplemented` (the dependency now
  does).
- **No ECDH implementation, no conversation-key/message-key/padding/
  encrypt/decrypt code, no NIP-44 code, no public API addition** — this
  remains dependency adoption plus label/diagnostics updates ONLY.
- **The fixed future order is ECDH → ConversationKey → MessageKey →
  Padding → Encrypt → Decrypt → NIP-44** (§8), one capability per future
  stage.
