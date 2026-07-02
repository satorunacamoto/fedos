# Crypto Operation Test Vectors — Verification Plan (binding)

**Status: this document adds no code and commits no vectors.** It fixes, in
writing, the plan for the KNOWN-ANSWER test vectors a FUTURE FedOS Rust crypto
core must reproduce — so that core can be built **test-first**. This is a
**verification plan, not an implementation spec**: it defines what "correct" will
mean and where the answers come from, not how to implement any primitive.

No cryptography, Rust, WASM, AEAD, HKDF, Argon2, or NIP-44 is implemented here,
and **no vector JSON is committed** in this stage (see §10–§11). If a future
change would violate a rule below, the rule wins — do not write the code, or open
a new, explicitly-reviewed Stage to renegotiate the rule in the open.

This is a safety contract, not a marketing claim. It complements the crypto
boundary ([`vault_crypto_identity.md`](vault_crypto_identity.md) §3–4,
`src/crypto/`), the FedOS package boundary
([`../packages/fedos-core-rust/README.md`](../packages/fedos-core-rust/README.md)),
and the WASM loader safety rules
([`fedos_core_wasm_safety.md`](fedos_core_wasm_safety.md) §10, which lists "AEAD
test vectors" and "KDF test vectors" as prerequisites — this file is that plan).

---

## 1. Purpose

- **Test-first plan for a future Rust core.** Fix the known-answer vectors the
  future FedOS Rust/WASM crypto core must pass BEFORE it can be selected at
  runtime, so correctness is proven against upstream answers rather than asserted.
- **Verification plan, not an implementation spec.** This file says what must be
  reproduced and from which authoritative source. It defines no algorithm,
  parameter default, key schedule, wire format, or API.
- **No runtime dependency yet.** Nothing here is wired; the runtime still selects
  only `NoopCryptoProvider` / the inert `PlaceholderFedosCoreCrypto` (Stage 65).

## 2. Candidate primitives

In scope for the vector plan (all still UNIMPLEMENTED):

- **ChaCha20-Poly1305** (AEAD, 96-bit nonce) — RFC 8439.
- **XChaCha20-Poly1305** (AEAD, 192-bit nonce) — libsodium / draft-irtf-cfrg-xchacha.
- **AES-256-GCM** (AEAD) — NIST SP 800-38D / CAVP GCM test vectors.
- **HKDF-SHA256** (extract-and-expand KDF) — RFC 5869.
- **Argon2id** (password KDF) — RFC 9106.
- **NIP-44** (Nostr payload encryption v2) — upstream `nostr-protocol/nips`
  NIP-44 vectors.

Deferred to a **separate future candidate** (NOT covered by this plan):

- **BIP39** (mnemonic), **BIP32** (HD derivation), **NIP-06** (Nostr key from
  mnemonic). These involve seed/mnemonic handling and are scoped out here to keep
  seed material out of this stage entirely; they get their own future doc.

## 3. Vector-adoption rules

- **Prefer standard RFC / upstream official vectors.** Use the authoritative
  source's own published known-answer vectors (RFC appendices, NIST CAVP,
  libsodium, the NIP-44 repo). Each adopted vector records its **source + section
  + revision/commit** in an accompanying source note.
- **No home-grown vectors** — or, if a derived/generated vector is truly
  unavoidable, it must be **clearly labeled `generated`** with the exact
  generation method and the reference implementation used, and never mixed with
  official vectors silently.
- **Do not specify implementation-specific output.** The plan pins only
  standardized, implementation-independent answers (ciphertext/tag/derived bytes
  for fixed inputs). Anything that varies by library internals (buffer layout,
  streaming chunk boundaries, error string text) is out of scope and must not be
  frozen as an expected value.

## 4. AEAD test rules (ChaCha20-Poly1305 / XChaCha20-Poly1305 / AES-256-GCM)

Each AEAD vector fixes, from an authoritative source:

- **key** (exact byte length per algorithm),
- **nonce** (96-bit for ChaCha20-Poly1305 / AES-GCM; 192-bit for XChaCha20-Poly1305),
- **plaintext**,
- **AAD** (associated data; include an empty-AAD case),
- **expected ciphertext**,
- **expected tag** (authentication tag).

Required negative cases:

- **Tamper failure.** Flipping any bit of ciphertext, tag, nonce, or AAD MUST
  cause authentication to fail (decrypt returns an error/`allowed:false`, never
  plaintext).
- **No nonce reuse.** Vectors must never encrypt two distinct plaintexts under the
  same (key, nonce); the plan documents nonce reuse as catastrophic and forbids
  any vector or example that demonstrates "reuse working". Nonce-generation
  discipline is a core requirement, not a test convenience.

## 5. KDF test rules (HKDF-SHA256)

Each HKDF vector fixes, from RFC 5869:

- **input keying material** (the input secret / IKM),
- **salt** (include the no-salt / all-zero case per the RFC),
- **info / context** (the domain-separation label),
- **output length** (L),
- **expected output** (OKM).

Requirements:

- **Domain separation is mandatory.** Every derivation carries a distinct,
  documented `info`/context so keys for different purposes never collide. The plan
  includes vectors that show different `info` yields different output for the same
  IKM/salt.

## 6. Argon2id test rules

Each Argon2id vector fixes, from RFC 9106:

- **memory cost** (m), **time cost** (t), **parallelism** (p),
- **salt**,
- **password label** (a NON-secret label identifying the vector — never a real
  passphrase),
- **output length**,
- **expected output** (tag/hash).

Notes:

- **Mobile constraints.** The plan flags that production `m`/`t`/`p` must be tuned
  for mobile/low-memory devices; test vectors use the RFC's fixed parameters for
  correctness, while real parameter selection is a separate, documented decision
  (not frozen here).

## 7. NIP-44 test rules

- **Reference the upstream NIP-44 vectors.** Correctness is defined by the
  `nostr-protocol/nips` NIP-44 v2 test-vector file (recorded by commit/revision),
  not by anything invented here.
- Each vector fixes: **conversation key** (the derived shared key input), **nonce**
  (per-message), **plaintext payload**, and **expected payload** (versioned,
  base64 wire form).
- **Decrypt failure cases** are required: wrong version byte, bad MAC/tamper,
  wrong conversation key, and malformed length/padding MUST all fail closed.
- **NIP-44 is NOT implemented.** This is a plan to verify a future implementation
  against upstream; nothing encrypts or decrypts NIP-44 payloads today.

## 8. Rust implementation prerequisites

When the real core is built (its own future stage), it must:

- use **`zeroize`** to clear key/secret buffers on drop,
- wrap secrets in **`secrecy`** types so they are not accidentally logged/copied,
- use **`subtle`** for constant-time equality/selection,
- depend only on **audited, reviewed, pinned crates** (e.g. RustCrypto / libsodium
  bindings) — no home-grown primitives,
- contain **no custom XOR** "cipher" and **no hand-rolled constant-time compare**.

## 9. Forbidden

Never, in the future core or anywhere:

- **XOR cipher** (or any home-grown/"obfuscation" cipher),
- **unauthenticated encryption** (encryption without an authentication tag),
- **nonce reuse** under the same key,
- **custom KDF** (only standard HKDF/Argon2, etc.),
- **password used directly as a key** (a passphrase must go through a password KDF
  with a salt — never keyed directly),
- **Apple / Google / WebAuthn credential as a seed** (identity providers are
  unlock TRIGGERS only, never key-derivation sources — consistent with
  [`webauthn_passkey_safety.md`](webauthn_passkey_safety.md) and
  [`vault_crypto_identity.md`](vault_crypto_identity.md)).

## 10. Future test-file layout

When official vectors are eventually adopted, they would live under a future
`test-vectors/` tree, one file per source, e.g.:

- `test-vectors/aead/*.json` — ChaCha20-Poly1305 / XChaCha20-Poly1305 / AES-256-GCM
- `test-vectors/kdf/*.json` — HKDF-SHA256 / Argon2id
- `test-vectors/nip44/*.json` — NIP-44 v2

Rules for that tree (NOT created in this stage):

- Each file carries a **source note** (upstream origin, section/appendix,
  revision/commit, and license) at the top or alongside it.
- A file is added **only when the official vectors are copied verbatim with a
  verifiable source**; nothing is generated ad hoc and committed as if official.
- No `test-vectors/` files are added yet (§11).

## 11. Current conclusion

- **Docs only.** This stage adds no code and changes nothing under `src/` or
  `packages/fedos-core-rust/src/`.
- **No crypto code.** No AEAD/KDF/Argon2/NIP-44 is implemented; no primitive runs.
- **No vectors committed** unless and until a verified upstream source is copied
  with its source note (§10).
- **Gate on the vectors.** A future Rust implementation MUST pass these vectors
  before it can be selected at runtime — proven correct against upstream answers,
  behind the existing disabled-by-default gates (Stages 63–65) and the WASM
  provenance prerequisites ([`fedos_core_wasm_safety.md`](fedos_core_wasm_safety.md)
  §5, §10).
