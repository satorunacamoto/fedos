# FedOS Core Rust Crate — Safety Rules (binding)

**Status: this document adds no code.** It fixes, in writing, the guardrails
around the Stage 69 minimal Rust crate skeleton
([`packages/fedos-core-rust`](../packages/fedos-core-rust/README.md)) — the rules
for adding dependencies, `unsafe`, `zeroize`, crypto crates, randomness, and WASM
*before* any real primitive lands. It is a **safety contract, not a crypto
implementation spec**.

No Rust code, `Cargo.toml`, dependency, cryptography, `zeroize`, `rand`, or WASM
is added in this stage. If a future change would violate a rule below, the rule
wins — do not write the code, or open a new, explicitly-reviewed Stage to
renegotiate the rule in the open.

This is not a marketing claim. Nothing here should be read as "secure",
"audited", or "complete". It complements the crate skeleton
([`../packages/fedos-core-rust/README.md`](../packages/fedos-core-rust/README.md)),
the crypto test-vector plan ([`crypto_test_vectors.md`](crypto_test_vectors.md)),
the build manifest plan ([`fedos_core_build_manifest.md`](fedos_core_build_manifest.md)),
and the WASM loader safety rules ([`fedos_core_wasm_safety.md`](fedos_core_wasm_safety.md)).

---

## 1. Purpose

- **Rust crate safety contract.** Fix the rules that keep the FedOS Rust crate
  safe as it grows toward a real crypto core — one guardrail per concern
  (unsafe, dependencies, crypto adoption, secrets, randomness, WASM, artifacts).
- **Future crypto-implementation guardrails.** Define what MUST be true before a
  primitive is added, not how to implement it.
- **Not a crypto implementation spec.** No algorithm, parameter default, key
  schedule, wire format, or API is defined here.

## 2. Current crate state (Stage 69)

- `packages/fedos-core-rust/Cargo.toml` exists (name `fedos-core-rust`, version
  `0.0.0`, edition 2021).
- `packages/fedos-core-rust/src/lib.rs` exists — placeholder API only.
- **No dependencies** (empty `[dependencies]`).
- **`rlib` only** — `crate-type = ["rlib"]`.
- **No `cdylib`**, **no WASM target**, **no `.wasm`**.
- **No cryptography** — every function returns an `Unavailable`/`Placeholder`
  status and runs nothing.
- **`#![forbid(unsafe_code)]`** — `unsafe` is banned crate-wide.

## 3. `unsafe` policy

- **Keep `unsafe` forbidden.** `#![forbid(unsafe_code)]` stays; the crate must
  compile with zero `unsafe`.
- **Adding `unsafe` requires its own Stage.** Any `unsafe` block/fn/impl requires
  a separate, explicitly-reviewed Stage, a safety-docs update, and review with a
  written justification of each invariant it upholds.
- **No casual `unsafe` at FFI/WASM boundaries.** Even when an FFI or WASM boundary
  is eventually added, `unsafe` is not introduced lightly — each use is minimized,
  documented, and reviewed; a boundary is not an excuse to relax the rule.

## 4. Dependency policy

- **Adding dependencies is a separate Stage.** The empty `[dependencies]` table
  changes only in an explicit, reviewed Stage — never as an incidental commit.
- **Audited crates only.** Only reviewed, widely-used, maintained crates (e.g.
  RustCrypto family) — no abandoned, unaudited, or single-author novelty crates.
- **Crypto dependencies bind to the test-vector plan.** A crypto crate is adopted
  only alongside the known-answer vectors it must satisfy
  ([`crypto_test_vectors.md`](crypto_test_vectors.md)); adoption without vectors
  is forbidden.
- **Manifest must be updated.** Any dependency change updates the
  `dependencyLockDigest` and the build manifest
  ([`fedos_core_build_manifest.md`](fedos_core_build_manifest.md)) so the
  dependency set is pinned and drift is detectable.
- **Supply-chain risk is explicit.** Each added dependency is a supply-chain
  surface (transitive deps, build scripts, maintainer trust); the adopting Stage
  states this risk and how it is bounded (pinning, review, minimal feature set).

## 5. Crypto-crate adoption policy

- **Candidates (not yet adopted):** `chacha20poly1305`, `aes-gcm`, `hkdf`,
  `argon2`, `zeroize`, `secrecy`, `subtle`.
- **Adopt per feature, per Stage.** Each primitive lands in its own Stage (e.g.
  AEAD separate from KDF), never a bulk "add all crypto" commit.
- **Test vectors are mandatory at adoption.** A primitive is added only with its
  official known-answer vectors wired as tests (§10,
  [`crypto_test_vectors.md`](crypto_test_vectors.md)).
- **No custom XOR / home-grown cipher.** Never a hand-written cipher or
  "obfuscation" — only standard, reviewed primitives.
- **No hand-rolled constant-time compare.** Use `subtle` (or an audited
  equivalent) for constant-time equality/selection — never a bespoke comparison.

## 6. Memory safety / secret handling

- **`zeroize`/`secrecy` are deferred.** They are NOT implemented until real secret
  bytes are introduced; the current placeholder handles no secrets.
- **Secrets and their zeroization arrive together.** The Stage that first handles
  real key/seed/plaintext bytes MUST add the `zeroize`/`secrecy` design in the
  same Stage — never "add secrets now, zeroize later".
- **No secret in logs/debug output.** Keys, seeds, plaintext, ciphertext,
  passphrases, and tokens never appear in logs, `Debug`/`Display`, panic
  messages, or error text. (Note: the current `Debug`/`Display` derives are on
  non-secret placeholder types only.)
- **Panic / core-dump risk is future work.** Panic-safety and core-dump exposure
  of secrets are handled by a future docs + implementation Stage when secrets
  exist; they are named here as known concerns, not solved.

## 7. Randomness policy

- **No `rand`/`getrandom` yet.** Neither is a dependency; the crate generates no
  randomness.
- **CSPRNG adoption is a separate Stage.** A cryptographic RNG lands in its own
  reviewed Stage, using an audited source.
- **Separate test RNG from production RNG.** Deterministic/seeded RNG is for tests
  and known-answer vectors ONLY; production paths use a CSPRNG. The two are never
  conflated, and a deterministic RNG never reaches a production code path.
- **No nonce reuse.** Nonce/IV generation follows a strict non-reuse discipline;
  nonce reuse under a key is catastrophic and is forbidden
  ([`crypto_test_vectors.md`](crypto_test_vectors.md) §4).

## 8. WASM policy

- **No `wasm-bindgen`.** Not a dependency; not added here.
- **No `cdylib`.** `crate-type` stays `rlib`; no dynamic/WASM library target.
- **No `.wasm` generation.** Nothing compiles to or commits a `.wasm` artifact.
- **Follow the WASM loader safety rules.** Any future WASM work obeys
  [`fedos_core_wasm_safety.md`](fedos_core_wasm_safety.md) (disabled by default,
  no fetch/dynamic import/instantiate, provenance/pinned digest first).
- **Runtime loading is a separate Stage.** Producing a `.wasm` and actually
  loading it at runtime are distinct, later, explicitly-reviewed Stages — never
  folded into a crypto-implementation Stage.

## 9. Build-artifact policy

The following must NEVER be committed to the package:

- `target/` (Cargo build directory),
- `Cargo.lock` (for this library crate, in this repo's convention),
- `.wasm` artifacts,
- compiled binaries: `.rlib` / `.so` / `.dll` / `.dylib` / `.a` / `.o`,
- any `build/` output directory.

This is enforced two ways: the package `.gitignore`
(`packages/fedos-core-rust/.gitignore`) excludes them, and the TS test guards
(`test/fedos_core_rust_skeleton.test.ts`, `test/fedos_core_wasm_loader.test.ts`,
`test/fedos_core_adapter.test.ts`) fail if any such artifact appears.

## 10. Test policy

- **`cargo check`** must pass (dependency-free today; optional in CI but expected
  to build cleanly).
- **`cargo test`** covers the crate's own unit tests (the placeholder skeleton has
  `#[cfg(test)]` checks that state stays `Unavailable`/`Placeholder`).
- **`npm test` source guards** stay green: no compiled/WASM artifact committed, no
  crypto deps, no `unsafe`, no `wasm-bindgen`/`cdylib`, Runtime/Worker not wired.
- **Official vectors at crypto adoption.** When a primitive is added, its official
  known-answer vectors are wired as tests.
- **No generated custom vectors unless labeled.** A derived/generated vector is
  used only when unavoidable, clearly labeled `generated` with its method and
  reference implementation, never mixed silently with official vectors
  ([`crypto_test_vectors.md`](crypto_test_vectors.md) §3).

## 11. Future implementation order

The intended, one-Stage-at-a-time sequence (each its own reviewed Stage):

1. Test-vector docs ([`crypto_test_vectors.md`](crypto_test_vectors.md)) — **done**.
2. Build manifest docs ([`fedos_core_build_manifest.md`](fedos_core_build_manifest.md)) — **done**.
3. Dependency adoption (audited crates, manifest updated).
4. Minimal AEAD implementation (with official vectors).
5. KDF implementation (HKDF, then Argon2, with vectors).
6. WASM target (behind loader safety rules).
7. Runtime loading (manifest-validated, disabled by default).

Nothing beyond steps 1–2 is implemented; each later step is a separate Stage.

## 12. Current conclusion

- **Docs only.** This stage adds no code and changes nothing under `src/` or
  `packages/fedos-core-rust/src/`.
- **No Rust code changes.** `Cargo.toml` and `lib.rs` are untouched.
- **No dependencies.** The `[dependencies]` table stays empty.
- **No crypto.** No AEAD/KDF/random/zeroize is implemented.
- **No WASM.** No `wasm-bindgen`, no `cdylib`, no `.wasm`.
- **A future explicit stage is required.** Each guardrail above is renegotiated
  only in the open, in its own reviewed Stage — never grown silently out of the
  skeleton.
