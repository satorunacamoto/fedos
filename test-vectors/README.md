# `test-vectors/` — Official Crypto Known-Answer Vectors

**Status: this directory holds verbatim-imported OFFICIAL vectors for five
primitives; no Rust code reads them yet.** The vectors were copied byte-for-byte
from the official/upstream sources named in
[`../docs/crypto_vector_sources.md`](../docs/crypto_vector_sources.md), each
with a `source` + `section` + `revision` + `license` note recorded inside its
own JSON file, per the plan in
[`../docs/crypto_test_vectors.md`](../docs/crypto_test_vectors.md). This is a
**verification-data import, not an implementation** — `packages/fedos-core-rust`
still contains no cryptography and does not read any file in this directory
(§6, [`../docs/verification_infrastructure.md`](../docs/verification_infrastructure.md)
§5 "vector lifecycle": these vectors are now **imported**, not yet **wired**).

---

## 1. Directory purpose

- **The single landing place for known-answer test vectors** a future FedOS
  Rust crypto core (`packages/fedos-core-rust`) must pass before any
  primitive can be considered implemented, per the pipeline in
  [`../docs/verification_infrastructure.md`](../docs/verification_infrastructure.md).
- **Vectors here are consumed by `cargo test`**, not by the TypeScript
  runtime — nothing under `src/` reads this directory.
- **One file per source**, grouped by category subdirectory (§5).

## 2. What is committed (Stage 73)

| File | Algorithm | Source | Cases |
| --- | --- | --- | --- |
| [`aead/chacha20poly1305-rfc8439.json`](aead/chacha20poly1305-rfc8439.json) | ChaCha20-Poly1305 AEAD | RFC 8439 §2.8.2 + Appendix A.5 | 2 |
| [`aead/aes256gcm-nist.json`](aead/aes256gcm-nist.json) | AES-256-GCM | NIST CAVP GCM KATs (SP 800-38D) | 5 (incl. 1 official `FAIL`/negative) |
| [`kdf/hkdf-rfc5869.json`](kdf/hkdf-rfc5869.json) | HKDF-SHA256 | RFC 5869 Appendix A.1–A.3 | 3 |
| [`kdf/argon2id-rfc9106.json`](kdf/argon2id-rfc9106.json) | Argon2id | RFC 9106 §5.3 | 1 (the RFC's sole Argon2id KAT) |
| [`nip44/nip44-v2.json`](nip44/nip44-v2.json) | NIP-44 v2 | upstream `paulmillr/nip44`/`nostr-protocol/nips` | 8 categories (incl. 3 official negative categories) |

Every file's `source` / `section` / `revision` / `license` fields state the
exact upstream document, commit/RFC number, and license status; see each file
for the full citation. **`XChaCha20-Poly1305` is NOT imported** — per
[`../docs/crypto_vector_sources.md`](../docs/crypto_vector_sources.md) §4 its
source (draft-irtf-cfrg-xchacha vs. libsodium) is still undecided, so no
`xchacha20poly1305-*.json` exists yet.

## 3. Verbatim import — how "no rewritten values" was verified

- **RFC vectors** (ChaCha20-Poly1305, HKDF-SHA256, Argon2id) were extracted
  from the RFCs' own hex-dump / wrapped-hex formatting by concatenating the
  byte columns into one lowercase hex string per field — a scripted,
  deterministic extraction (not manual retyping), with every field's byte
  length checked against the RFC's own stated octet count, and the
  ChaCha20-Poly1305 plaintext fields additionally cross-checked by decoding
  the extracted hex as UTF-8 and diffing against the RFC's printed plaintext
  text.
- **NIST CAVP vectors** (AES-256-GCM) were copied byte-for-byte from the
  official `gcmEncryptExtIV256.rsp` / `gcmDecrypt256.rsp` files inside NIST's
  own `gcmtestvectors.zip`; each imported case records its exact source file
  and `Count` index for traceability back to the full `.rsp` file.
- **NIP-44 vectors** were imported as the ENTIRE upstream `v2` object from
  `nip44.vectors.json`, and its SHA-256 was verified to match the checksum
  NIP-44's own spec text (`44.md`) publishes inline — a deep-equality check
  (upstream JSON vs. the copy in this repo) confirmed every leaf value is
  byte-identical; only the nesting shape was changed (nested object →
  `vectors[]` array, per this catalog's required schema), never a value.
- **No independently generated vector was added.** Every negative/tamper
  case present in these files (the AES-256-GCM `FAIL` case, all of NIP-44's
  `invalid.*` categories) is itself an OFFICIAL vector copied from the
  source — RFC 8439/RFC 5869/RFC 9106 do not publish byte-level tamper
  vectors, so none is fabricated for those three files
  ([`../docs/crypto_test_vectors.md`](../docs/crypto_test_vectors.md) §3).

## 4. Official vectors only

- Every vector file here traces to an official RFC / standard / upstream
  project source, per
  [`../docs/crypto_vector_sources.md`](../docs/crypto_vector_sources.md) §2.
- Each vector file records its **source**, **source revision** (RFC number,
  or repo commit/tag for anything not RFC-stable), and a **license note**,
  alongside the vector data (schema per
  [`../docs/crypto_vector_sources.md`](../docs/crypto_vector_sources.md) §11,
  with a `vectors[]` array of per-case objects as adopted here).

## 5. Generated vectors forbidden (still, going forward)

- **No generated/custom/derived vector may be added to this directory
  without being clearly labeled `generated`**, with its exact generation
  method and reference implementation recorded — and even then, it is never
  mixed silently with official vectors in the same file
  ([`../docs/crypto_test_vectors.md`](../docs/crypto_test_vectors.md) §3).
- This rule is unchanged by Stage 73: every case in every file committed so
  far is an official, verbatim-sourced vector (§3); nothing generated has
  been added, and the guardrail against doing so silently in the future
  stays in force.

## 6. Layout

```
test-vectors/
  aead/
    chacha20poly1305-rfc8439.json     (committed — Stage 73)
    aes256gcm-nist.json               (committed — Stage 73)
    xchacha20poly1305-*.json          (NOT committed — source undecided)
  kdf/
    hkdf-rfc5869.json                 (committed — Stage 73)
    argon2id-rfc9106.json             (committed — Stage 73)
  nip44/
    nip44-v2.json                     (committed — Stage 73)
```

- **`aead/`** — ChaCha20-Poly1305, AES-256-GCM known-answer vectors, plus one
  official AES-256-GCM negative (`FAIL`) case
  ([`../docs/crypto_vector_sources.md`](../docs/crypto_vector_sources.md) §3–§5).
- **`kdf/`** — HKDF-SHA256 (3 RFC 5869 cases, including the zero-length
  salt/info case) and Argon2id (RFC 9106's sole published KAT)
  ([`../docs/crypto_vector_sources.md`](../docs/crypto_vector_sources.md) §6–§7).
- **`nip44/`** — the entire upstream NIP-44 v2 vector set, including its
  official `invalid.*` decrypt-failure and conversation-key-derivation-failure
  categories
  ([`../docs/crypto_vector_sources.md`](../docs/crypto_vector_sources.md) §8).

## 7. Current conclusion

- **Vectors imported, not wired.** These JSON files exist so a future Rust
  implementation Stage has official known-answer data to test against from
  day one; no Rust code parses or reads any file here yet.
- **No crypto, no Rust wiring, no dependency.** `packages/fedos-core-rust`
  is untouched by this stage; wiring `cargo test` to consume these files is
  a separate, future, explicitly-reviewed Stage.
- **`XChaCha20-Poly1305` remains unimported** pending a source decision
  ([`../docs/crypto_vector_sources.md`](../docs/crypto_vector_sources.md) §4).

## 8. Licensing — this data is NOT covered by the project's own license

**Nothing in this directory is FedOS's own work, and the project's
`LICENSE` (MPL-2.0) does not extend to any of it.** Each file records its
own `source` / `section` / `revision` / `license` fields inline; those
fields, not the root `LICENSE`, govern the data.

- **RFC-derived files** (`chacha20poly1305-rfc8439.json`,
  `hkdf-rfc5869.json`, `argon2id-rfc9106.json`) — IETF Trust Legal
  Provisions; code components extracted from an RFC (which is what these
  octet values are) are licensed under the Simplified BSD License.
- **`aes256gcm-nist.json`** — NIST CAVP publication.
- **`nip44-v2.json`** — published by NIP-44 itself, which is public
  domain per `nostr-protocol/nips`' README, and bound by the SHA-256
  checksum printed inside `44.md`. Its provenance was previously
  classified **unresolved**; it was re-verified from primary sources on
  2026-07-26 and resolved to **retain**. The full evidence chain, the
  reproduction commands, and the one residual caveat that remains open
  (neither upstream repository carries a formal `LICENSE` file) are
  recorded in [`../LICENSE_STATUS.md`](../LICENSE_STATUS.md) §4 — read
  that before relying on this file's status.

**These files are test-only.** They are consumed by `cargo test` through
`include_str!` in `#[cfg(test)]` modules and are not compiled into, or
shipped inside, any release artifact.
