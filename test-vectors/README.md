# `test-vectors/` — Official Crypto Known-Answer Vectors (empty skeleton)

**Status: this directory contains no vectors yet.** It exists only as the
future landing place for OFFICIAL, verbatim-imported crypto test vectors,
per the plan fixed in [`../docs/crypto_test_vectors.md`](../docs/crypto_test_vectors.md)
and the source catalog in
[`../docs/crypto_vector_sources.md`](../docs/crypto_vector_sources.md). No
`.json` vector file exists anywhere under this directory in this stage.

---

## 1. Directory purpose

- **The single landing place for known-answer test vectors** a future FedOS
  Rust crypto core (`packages/fedos-core-rust`) must pass before any
  primitive can be considered implemented, per the pipeline in
  [`../docs/verification_infrastructure.md`](../docs/verification_infrastructure.md).
- **Vectors here are consumed by `cargo test`**, not by the TypeScript
  runtime — nothing under `src/` reads this directory.
- **One file per source**, grouped by category subdirectory (§5).

## 2. No vectors committed yet

- This directory currently holds only this `README.md` and empty category
  subdirectories (kept in git via `.gitkeep` placeholders, since git does
  not track empty directories).
- **No AEAD, KDF, or NIP-44 vector JSON exists here.** Importing the first
  real vector file is explicitly deferred to a future, separate,
  explicitly-reviewed Stage (Stage 73 candidate — see the docs above).

## 3. Official vectors only

- Every vector file added here in the future must trace to an official
  RFC / standard / upstream project source, per
  [`../docs/crypto_vector_sources.md`](../docs/crypto_vector_sources.md) §2 —
  RFC 8439, RFC 5869, RFC 9106, NIST SP 800-38D / CAVP, libsodium (for
  XChaCha20-Poly1305, source TBD), or the upstream `nostr-protocol/nips`
  NIP-44 v2 vector file.
- Each vector file must record its **source**, **source revision**
  (RFC number, or repo commit/tag for anything not RFC-stable), and a
  **license note**, alongside the vector data (schema proposed in
  [`../docs/crypto_vector_sources.md`](../docs/crypto_vector_sources.md) §11).

## 4. Generated vectors forbidden (here, for now)

- **No generated/custom/derived vector may be added to this directory
  without being clearly labeled `generated`**, with its exact generation
  method and reference implementation recorded — and even then, it is never
  mixed silently with official vectors in the same file
  ([`../docs/crypto_test_vectors.md`](../docs/crypto_test_vectors.md) §3).
- In practice, for the primitives currently in scope, official upstream
  vectors are expected to be sufficient and generated vectors are not
  anticipated to be needed — this rule exists as a guardrail, not because a
  generated vector is planned.

## 5. Future layout

```
test-vectors/
  aead/
    chacha20poly1305-rfc8439.json
    xchacha20poly1305-source-tbd.json
    aes256gcm-nist-cavp.json
  kdf/
    hkdf-sha256-rfc5869.json
    argon2id-rfc9106.json
  nip44/
    nip44-v2-upstream.json
```

- **`aead/`** — ChaCha20-Poly1305, XChaCha20-Poly1305, AES-256-GCM known-answer
  and tamper/negative vectors
  ([`../docs/crypto_vector_sources.md`](../docs/crypto_vector_sources.md) §3–§5).
- **`kdf/`** — HKDF-SHA256 and Argon2id known-answer vectors, including
  domain-separation and no-salt cases
  ([`../docs/crypto_vector_sources.md`](../docs/crypto_vector_sources.md) §6–§7).
- **`nip44/`** — upstream NIP-44 v2 vectors, including decrypt-failure cases
  ([`../docs/crypto_vector_sources.md`](../docs/crypto_vector_sources.md) §8).

None of the files listed above exist yet — only the three empty category
directories (`aead/`, `kdf/`, `nip44/`) are created in this stage, each held
in git by a `.gitkeep` placeholder.

## 6. Current conclusion

- **Skeleton only.** This directory and its three empty subdirectories exist
  so a future vector-import Stage has a fixed place to add files, with no
  ambiguity about layout.
- **No vector bytes, no crypto, no Rust wiring** exists yet. Importing real
  vectors, and wiring `cargo test` to consume them, are both separate,
  future, explicitly-reviewed Stages.
