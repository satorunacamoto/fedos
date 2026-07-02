# Rust Dependency Adoption Policy (binding)

**Status: this document adds no code and adds no dependency.** It fixes, in
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

## 11. Current conclusion

- **Docs only.** This stage adds no code and changes nothing under `src/` or
  `packages/fedos-core-rust/src/`.
- **No dependency added.** `Cargo.toml`'s `[dependencies]` table stays
  empty; MSRV is unchanged.
- **No crypto, no `unsafe`, no randomness.** Nothing here executes; it is a
  process document for a future Stage to follow.
- **A future explicit stage is required** for every crate this document
  discusses — one crate, one Stage, one recorded review (§8), every time.
