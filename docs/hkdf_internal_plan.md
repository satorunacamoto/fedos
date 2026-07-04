# HKDF Internal Implementation Plan + Record (Stage 147–149)

**Status: this document records a real implementation.** Unlike the prior
Stage 141–143 docs-only batch (which fixed policy/shape/test-strategy for
`SecretHandle` BEFORE it held real bytes), this document is written
alongside the Stage 147 implementation it describes — `kdf_core`
(`packages/fedos-core-rust/src/lib.rs`, Stage 82) now has a real,
`cargo test`-verified HKDF-SHA256 (RFC 5869) derivation function,
`derive_secret_handle_internal`. This document is the design record for
that function (§1–§9), plus the AEAD staging preparation for the NEXT
stage (§10) — staged in writing only, not built.

This complements, and does not renegotiate,
`docs/secret_lifecycle_implementation_plan.md` (§9's HKDF/AEAD connection
order, now §16's update record), `docs/secret_handle_api_shape.md` (§10's
sketch of this exact connection shape), `docs/fedos_core_rust_safety.md`
(memory safety, dependency policy), and `docs/implementation_phase_roadmap.md`
(§1 item 4, now §7's update record). Where this document and any of those
disagree, the earlier binding docs win.

---

## 1. Purpose

- **Record the HKDF internal implementation** landed Stage 147: what it
  is, what it is not, and why each design choice was made.
- **Fix, in writing, the AEAD staging preparation** (§10) for the stage
  after this one — labels and a fixed connection shape only, no code.
- **Binding on the future AEAD implementation stage**: §10 fixes what that
  stage must build against, the same "fix the shape before the byte"
  discipline `docs/secret_handle_api_shape.md` used for `SecretHandle`.

## 2. HKDF specification

- **Input: `SecretHandle(HkdfInputMaterial)` only.** `derive_secret_handle_internal`
  takes a `&SecretHandle` and immediately rejects (returns
  `HkdfStatus::InvalidInput`) any handle whose `kind()` is not
  `SecretHandleKind::HkdfInputMaterial` — a placeholder handle, a
  `TestOnlySecretMaterial` handle, or an already-`clear()`-ed handle are
  all rejected the same way. There is no second input type (no `Vec<u8>`,
  no `String`, no borrowed slice) — the ONLY way to provide input key
  material is an existing `SecretHandle` of the correct kind.
- **Salt: fixed `&'static [u8]`.** Never caller-supplied, never random,
  never derived from user/environment/config input. Each `HkdfDomain`
  variant has its own fixed salt literal (`HkdfDomain::salt`).
- **Info: fixed label.** Same rules as salt — each `HkdfDomain` variant has
  its own fixed info-context literal (`HkdfDomain::info`).
- **Output: `SecretHandle(HkdfOutputMaterial)` only.** On success
  (`HkdfStatus::Ready`), `HkdfDecision::output` is `Some` of a NEW
  `SecretHandle`, constructed via the existing (Stage 144–146)
  `new_from_32_bytes_for_internal_use(SecretHandleKind::HkdfOutputMaterial, okm)`
  — never a raw byte array, never a `Vec<u8>`, never returned directly.

## 3. Types

Three new `pub(crate)` types, all living inside the existing `kdf_core`
module (Stage 82) — no new top-level module:

| Type | Role |
|---|---|
| `HkdfDomain` | Which fixed salt/info pair a derivation uses — `RootKey` / `Identity` / `Storage` / `Conversation` / `TestOnly`. A label only, never a byte. |
| `HkdfStatus` | Coarse outcome — `Ready` / `InvalidInput` / `InternalFailure`. Never a byte. |
| `HkdfDecision` | The result struct — `domain: HkdfDomain`, `status: HkdfStatus`, `output: Option<SecretHandle>`. Derives nothing (no `Clone`/`Debug` — both would fail to compile anyway, since `SecretHandle` implements neither). |

`HkdfDomain` deliberately does NOT reuse the pre-existing `domain_label`
skeleton (Stage 88, `DomainLabelKind`) — `domain_label` remains an
unconnected placeholder per this crate's standing "when in doubt, leave
skeletons unconnected" rule (`docs/fedos_core_architecture_freeze_v1.md`).
Wiring `domain_label` into `kdf_core` in the SAME stage that gives HKDF its
first real implementation would be combining two separate design decisions
into one stage — `docs/implementation_phase_roadmap.md` §2–§3 forbids this
class of bundling. A future stage MAY choose to migrate `HkdfDomain`'s
labels onto `domain_label`'s infrastructure; this stage does not.

## 4. `derive_secret_handle_internal`

```rust
pub(crate) fn derive_secret_handle_internal(
    input: &SecretHandle,
    domain: HkdfDomain,
) -> HkdfDecision
```

- **Takes `input` by shared reference, never by value or `&mut`.** The
  input handle is left exactly as it was (still `Holding`, still the same
  bytes) after the call returns — the same input can be derived from again
  under a different `domain` for domain-separated sub-keys, matching
  `docs/secret_handle_api_shape.md` §10's sketch ("never mutating the
  input in place").
- **Reads bytes via exactly one accessor**: `SecretHandle::
  expose_bytes_for_internal_derivation()` (new, §5). No other path into
  the input handle's bytes exists inside `kdf_core`.
- **Calls `Hkdf::<Sha256>::new(Some(domain.salt()), &ikm)` then
  `.expand(domain.info(), &mut okm)`** — the two-step RFC 5869
  extract-then-expand HKDF-SHA256 the `hkdf` crate already implements
  (verified against the official RFC 5869 vectors since Stage 77, in the
  unrelated `#[cfg(test)]`-only `rfc5869_vectors` module, which this
  function does not call into and does not modify).
- **Zeroizes its own local copies as soon as they are no longer needed**:
  the local `ikm: [u8; 32]` copy (obtained from
  `expose_bytes_for_internal_derivation`) is zeroized immediately after
  `Hkdf::new` returns (which is the only call that reads it); the local
  `okm: [u8; 32]` buffer is zeroized after being copied into the output
  `SecretHandle`. This narrows, but does not eliminate, the compiler-copy
  exposure window `docs/secret_lifecycle_implementation_plan.md` §10
  already names as a standing, unsolved limitation.
- **`Hkdf::expand`'s `Result` is matched exhaustively** — `Ok(())` builds
  the `Ready` decision, `Err(_)` (RFC 5869 §2.3's `255 * HashLen` ceiling,
  unreachable at this function's fixed 32-byte output) builds
  `InternalFailure` — no `.unwrap()`/`.expect()`/`panic!` anywhere in
  production code, matching every other real implementation this crate has
  shipped (`fedos_random_bytes_32`, `fedos_aead_nonce_96`).

## 5. `SecretHandle::expose_bytes_for_internal_derivation`

- **The one new, narrowly-scoped raw-byte accessor** this stage adds to
  `SecretHandle` — anticipated by `docs/secret_handle_api_shape.md` §6/§10
  and `docs/secret_lifecycle_implementation_plan.md` §8 ("any raw-byte
  exposure is confined to `pub(crate)` internals that perform the actual
  cryptographic operation... never re-exported").
- **Signature**: `pub(crate) fn expose_bytes_for_internal_derivation(&self)
  -> Option<[u8; 32]>`. Returns `None` for the Stage 79 placeholder path
  and after `clear()` — only a `Holding`-state real payload has bytes to
  expose. Returns `Some` of a COPY (not a reference) — the caller
  (`kdf_core`) is responsible for zeroizing its own copy, which it does
  (§4).
- **`SecretHandle`'s method count grows from six to seven** as a direct,
  reviewed consequence — `docs/secret_handle_api_shape.md` §12 (its own
  Stage 144–146 update record) already names this exact tension: the
  original five/six-method sketch did not anticipate a SEVENTH method
  either, and resolves it the same way: a new accessor is added as its OWN
  reviewed stage's decision, not smuggled in earlier.

## 6. `Cargo.toml` change

- **`sha2` promoted from `[dev-dependencies]` to `[dependencies]`** — the
  ONLY `Cargo.toml` change in this batch. `hkdf`'s API (`Hkdf<H>`) is
  generic over the hash algorithm; a concrete one is mandatory to
  instantiate it at all, in test OR production code. Stage 77 only needed
  it under `#[cfg(test)]`; Stage 147 needs the same concrete type in
  PRODUCTION code (`derive_secret_handle_internal`), so the dependency
  must live in `[dependencies]`, not `[dev-dependencies]`.
- **No other dependency changed.** `hkdf` itself was already a production
  dependency since Stage 76 (adopted, unused in production, until now).

## 7. Forbidden (all verified by dedicated guard tests)

- Public `deriveKey` API — none added; `derive_secret_handle_internal`
  stays `pub(crate)`.
- Public `SecretHandle` getter — `expose_bytes_for_internal_derivation`
  stays `pub(crate)`; no `pub` accessor exists anywhere.
- `Vec<u8>` / `String` / password / seed-phrase input or storage — the
  function's only inputs are `&SecretHandle` and `HkdfDomain` (both fixed,
  non-string types); no field anywhere in `kdf_core` is `Vec<u8>`/`String`.
- AEAD/encrypt/decrypt calls — `kdf_core` never constructs an
  `AeadPlaceholderRequest`, never imports `chacha20poly1305`/`aes-gcm`.
- `randomBytes`/nonce calls — `derive_secret_handle_internal` never calls
  `fedos_random_bytes_32`/`fedos_aead_nonce_96`.
- Runtime/Worker/WASM wiring — none added.
- Any OTHER `Cargo.toml` change beyond the one line in §6.

## 8. Test strategy (implemented, all passing)

- **HKDF input holding**: a `SecretHandle(HkdfInputMaterial)` passed to
  `derive_secret_handle_internal` produces `HkdfStatus::Ready`, and the
  INPUT handle is left unchanged (`kind()` still `HkdfInputMaterial`,
  `is_cleared()` still `false`).
- **HKDF output `SecretHandle` generation**: the returned `HkdfDecision`'s
  `output` is `Some` of a `SecretHandle` whose `kind()` is
  `HkdfOutputMaterial`.
- **Domain preserved**: `HkdfDecision::domain` always equals the `domain`
  argument passed in, for every one of the five `HkdfDomain` variants.
- **Domain separation is real**: two different domains, same input,
  produce DIFFERENT output bytes (compared via
  `expose_bytes_for_internal_derivation` — a legitimate use of the same
  reviewed accessor §5 introduces, exercising the actual cryptographic
  property this stage claims).
- **Determinism**: the SAME domain + input produces the SAME output bytes
  across repeated calls.
- **Invalid input rejected**: a placeholder handle, an
  `AeadKeyMaterial`/`TestOnlySecretMaterial`-kinded handle, and an
  already-`clear()`-ed `HkdfInputMaterial` handle are all rejected with
  `HkdfStatus::InvalidInput` and `output: None`.
- **`HkdfDomain` has no sixth variant** — an exhaustive match with no
  wildcard arm compiles only because none exists.
- **Every pre-existing RFC 8439/5869/9106/NIST-CAVP vector test passes
  UNMODIFIED** — this stage did not touch `rfc5869_vectors` or any other
  vector-verification module.
- **Public API surface unchanged** — still twenty-four `pub fn`s.

## 9. What Stage 147 deliberately does NOT do

- Does not implement AEAD (§10 stages the shape only).
- Does not implement `encrypt`/`decrypt`.
- Does not implement NIP-44.
- Does not add a public `deriveKey` API.
- Does not wire anything into the Runtime, Worker, or WASM.
- Does not touch `domain_label` (Stage 88) — remains unconnected.
- Does not change any dependency other than the one `sha2` promotion.

## 10. AEAD staging preparation (Stage 149, docs only)

This section fixes, in writing, the shape the FUTURE AEAD implementation
stage builds against — naming it, not building it, mirroring how
`docs/secret_handle_api_shape.md` fixed `SecretHandle`'s shape before
Stage 144–146 implemented it.

- **AEAD accepts exactly one secret input: `SecretHandle(AeadKeyMaterial)`.**
  Never a raw key byte, never a password, never a second SecretHandle kind
  — the same "one narrow input type" discipline HKDF (§2) already uses.
  A caller that wants an AEAD key derived from other material gets there
  via `derive_secret_handle_internal` with a domain whose OUTPUT the AEAD
  stage's own review re-labels (or accepts directly) as
  `AeadKeyMaterial` — that re-labeling decision belongs to the AEAD
  stage's own review, not this document.
- **AEAD uses the existing nonce helper, unchanged.** `fedos_aead_nonce_96()`
  (Stage 138) already exists and is already `cargo test`-verified; the
  AEAD stage calls it directly for a fresh nonce per seal operation — it
  does not reimplement nonce generation, and does not accept a
  caller-supplied nonce (per `docs/nonce_generation_policy.md`).
- **Ciphertext production/verification is the NEXT stage's job, not this
  one.** This document authorizes no `chacha20poly1305`/`aes-gcm` import,
  no `seal`/`open` function, and no change to `aead_core` (Stage 80). The
  AEAD stage is free to choose ChaCha20-Poly1305, AES-256-GCM, or both
  (this crate already adopted both, Stage 74/101) — that choice is that
  stage's own review, not fixed here.
- **Expected shape** (naming it, not building it): a `pub(crate)` function
  taking a `&SecretHandle` (the `AeadKeyMaterial` key), a plaintext byte
  source, and internally drawing its own nonce via `fedos_aead_nonce_96()`
  — returning ciphertext + tag + the nonce used (a nonce is not a secret,
  per `docs/nonce_generation_policy.md` §9, so it travels alongside its
  ciphertext in the return value, unlike the key). The reverse (open/
  verify) function takes the same key handle, the nonce, and the
  ciphertext+tag, returning either plaintext or a decryption-failure
  status — never a panic on tamper/forgery, matching the existing
  `rfc8439_vectors`/`aes256gcm_vectors` test modules' own negative-vector
  handling.
- **This section authorizes NOTHING beyond documentation.** No
  `src/`, `Cargo.toml`, or `test/` file is changed by this section; the
  crate-private `crypto::diagnostics` module (Stage 151) reports `Aead` as
  `NotConnected`, not `Ready`, reflecting this precisely.

## 11. Conclusion

- **HKDF is now a real, `cargo test`-verified implementation**, consuming
  `SecretHandle(HkdfInputMaterial)` and producing
  `SecretHandle(HkdfOutputMaterial)` via RFC 5869 HKDF-SHA256, with real
  domain separation across five fixed `HkdfDomain` labels.
- **`SecretHandle` gains exactly one new, narrowly-scoped accessor**
  (`expose_bytes_for_internal_derivation`) — still no public raw-byte
  exposure anywhere.
- **`Cargo.toml` changed by exactly one line** (`sha2` promoted to
  production) — no other dependency added.
- **AEAD remains completely unconnected** — staged in writing (§10) for
  its own future, separate, explicitly-reviewed stage.
- **No public API change**: still twenty-four `pub fn`s, `pub(crate)`
  throughout for everything new.
