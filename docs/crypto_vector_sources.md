# Crypto Test-Vector Source Catalog (binding)

**Update (Stage 73): the vectors this catalog names for ChaCha20-Poly1305,
AES-256-GCM, HKDF-SHA256, Argon2id, and NIP-44 v2 have since been imported
verbatim into [`test-vectors/`](../test-vectors/README.md) — see that
directory's README for the committed file list, and §10/§13 below for the
updated file layout. `XChaCha20-Poly1305` (§4) is still NOT imported; its
source remains undecided. No Rust code reads any imported vector yet; the
rest of this document (§1–§9, §11–§12) describes the ORIGINAL Stage 71
source-selection research and is otherwise unchanged.**

**Status: this document adds no code and, as originally written in Stage 71,
committed no vectors.** It fixes, in
writing, the **official/upstream source catalog** a FUTURE FedOS Rust crypto
core will draw its known-answer test vectors from — for each candidate
primitive named in [`crypto_test_vectors.md`](crypto_test_vectors.md), it
records WHICH standard/upstream source to use, WHERE (section/appendix/file),
and what must be noted alongside a copied vector (revision, license). This is
a **source-selection catalog, not a vector file and not an implementation
spec** — it makes concrete, per-primitive, what
[`crypto_test_vectors.md`](crypto_test_vectors.md) already committed to in
general (§3, "prefer standard RFC / upstream official vectors ... record
source + section + revision/commit").

No cryptography, Rust, WASM, AEAD, HKDF, Argon2, or NIP-44 is implemented
here, and **no vector bytes are copied or committed** in this stage (see
§10–§11). If a future change would violate a rule below, the rule wins — do
not write the code, or open a new, explicitly-reviewed Stage to renegotiate
the rule in the open.

This is a research/planning document, not a marketing claim. It complements
the crypto boundary ([`vault_crypto_identity.md`](vault_crypto_identity.md)
§3–4, `src/crypto/`), the crypto test-vector plan
([`crypto_test_vectors.md`](crypto_test_vectors.md)), the Rust crate safety
rules ([`fedos_core_rust_safety.md`](fedos_core_rust_safety.md)), and the
build manifest plan
([`fedos_core_build_manifest.md`](fedos_core_build_manifest.md)).

---

## 1. Purpose

- **Official test-vector source catalog for a future Rust core.** For each
  candidate primitive, name the authoritative RFC/standard/upstream project
  that a future implementation's known-answer tests must be copied from.
- **Source selection before implementation.** This is groundwork done BEFORE
  any Rust/WASM crypto exists — narrowing "which official source" so a later
  implementation Stage does not make that call under time pressure.
- **A concretization of the existing plan.** This file does not replace
  [`crypto_test_vectors.md`](crypto_test_vectors.md); it fills in the "from an
  authoritative source" language in that plan's §4–§7 with named sources,
  sections, and candidate URLs.
- **Docs only — no vectors copied yet.** No byte, hex string, or JSON vector
  from any source below is copied into this repository in this stage.

## 2. Adoption principles

- **Official RFC / standard / upstream project vectors are preferred over
  everything else.** A vector is adopted only from a source that itself
  defines or normatively references the algorithm (an RFC appendix, a NIST
  publication, the CAVP program, the upstream project that owns the
  construction — e.g. libsodium for XChaCha20-Poly1305, `nostr-protocol/nips`
  for NIP-44).
- **Every adopted vector records source + section + revision + license
  note.** At minimum: which document/repo, which section/appendix/file path,
  which revision (RFC number is stable; a repo needs a commit hash or tag),
  and a one-line license note (most RFCs are IETF Trust Legal Provisions;
  upstream repos carry their own license — this must be checked, not
  assumed, at copy time).
- **Generated/custom vectors are out of scope until a separate future
  Stage.** Nothing here authorizes a "generated" vector
  ([`crypto_test_vectors.md`](crypto_test_vectors.md) §3 already requires any
  such vector to be clearly labeled `generated` with its method and reference
  implementation) — this catalog only researches official sources.
- **This catalog does not specify implementation behavior.** It says where
  the answers come from, not how a future Rust implementation must be
  structured, what its API looks like, or what buffer/streaming layout it
  uses.
- **A vector copy always needs its source note.** No vector file may ever be
  added to this repository without the source, revision, and license note
  living alongside it (see §10–§11).

## 3. AEAD: ChaCha20-Poly1305

- **Primary source:** RFC 8439, "ChaCha20 and Poly1305 for IETF Protocols".
- **Sections:**
  - RFC 8439 §2.8.2 — the worked AEAD construction example (key, nonce, AAD,
    plaintext, ciphertext, tag).
  - RFC 8439 Appendix A.5 — "ChaCha20-Poly1305 AEAD Decryption", a full
    known-answer decryption vector.
- **Fields to record per vector:** key, nonce, plaintext, AAD, ciphertext,
  tag.
- **Required failure cases** (per
  [`crypto_test_vectors.md`](crypto_test_vectors.md) §4): tag tamper,
  ciphertext tamper, AAD tamper — each must fail closed.
- **No nonce reuse** — RFC 8439 vectors never reuse a (key, nonce) pair
  across distinct plaintexts, and none copied here may either.
- **Revision note:** RFC 8439 is a published, stable RFC (obsoletes RFC
  7539); no revision drift to track beyond the RFC number itself.

## 4. AEAD: XChaCha20-Poly1305

- **Candidate sources (not yet chosen between):**
  - `draft-irtf-cfrg-xchacha` (IRTF CFRG draft defining XChaCha20 /
    XChaCha20-Poly1305) — an internet-draft, NOT an RFC; draft revision must
    be pinned explicitly (draft version number) since drafts can change.
  - libsodium's own test vectors (libsodium is the reference implementation
    XChaCha20-Poly1305 shipped from) — requires recording the libsodium
    release/commit the vectors were taken from.
  - RustCrypto's `chacha20poly1305` crate upstream test vectors, but **only**
    if they themselves cite a traceable official source (RFC/draft/libsodium)
    — a RustCrypto test file with no cited origin does not count as an
    official source under §2 and must not be treated as one.
- **Note:** XChaCha20-Poly1305 has no RFC of its own (it is a draft +
  libsodium-defined construction), so **source stability/revision must be
  recorded explicitly** for whichever source is eventually chosen — this is a
  weaker provenance than RFC 8439 and the catalog entry must say so plainly
  rather than implying RFC-level stability.
- **Do not treat informal vectors as normative without a source note.** A
  vector found in a blog post, gist, or unsourced test file is not adopted
  under this catalog.

## 5. AEAD: AES-256-GCM

- **Candidate sources:**
  - NIST SP 800-38D — "Recommendation for Block Cipher Modes of Operation:
    Galois/Counter Mode (GCM) and GMAC" — contains worked examples.
  - NIST CAVP (Cryptographic Algorithm Validation Program) GCM Known Answer
    Tests / GCMVS test vectors — the larger, machine-checkable official test
    suite for GCM implementations.
  - Project Wycheproof AES-GCM **negative/edge-case** tests, listed as an
    **optional future source** for tamper/edge-case coverage — Wycheproof is
    a Google security-testing project, not a cryptographic standard, so it is
    a supplement to CAVP/SP 800-38D, never a substitute for them.
- **Fields to record per vector:** key, IV/nonce, plaintext, AAD, ciphertext,
  tag.
- **Required failure cases:** invalid tag, wrong AAD, wrong nonce — each must
  fail closed.
- **Note — 96-bit IV vs non-standard IV:** SP 800-38D defines the 96-bit
  (12-byte) IV as the standard, recommended case; GCM also defines a more
  general IV-processing path (via GHASH) for non-96-bit IVs. The catalog
  entry for AES-256-GCM must **distinguish which case each vector covers** —
  a 96-bit-IV vector is not a substitute for testing non-standard-IV handling
  and vice versa, and any future implementation decision about which IV
  lengths it accepts is out of scope here.

## 6. KDF: HKDF-SHA256

- **Primary source:** RFC 5869, "HMAC-based Extract-and-Expand Key
  Derivation Function (HKDF)".
- **Sections:** RFC 5869's published test cases for the SHA-256 hash
  (RFC 5869 §A.1–A.3 cover SHA-256 cases directly; the RFC also has SHA-1
  cases, which are out of scope — FedOS only ever needs SHA-256).
- **Fields to record per vector:** IKM (input keying material), salt
  (including the RFC's no-salt / all-zero-salt case), info (context string),
  L (requested output length), PRK (intermediate extract output, optional to
  record), OKM (final expand output).
- **FedOS-specific rule (binding, from
  [`crypto_test_vectors.md`](crypto_test_vectors.md) §5 and
  [`vault_crypto_identity.md`](vault_crypto_identity.md)):**
  - **Domain-separation labels must be explicit.** Every derivation's `info`
    is a distinct, documented string; vectors chosen here must include cases
    that show different `info` values yield different `OKM` for the same
    `IKM`/`salt`, so this property is provably tested, not assumed.
  - **An Apple/Google/WebAuthn credential is never IKM or a seed.** Identity
    providers are unlock TRIGGERS only ([`webauthn_passkey_safety.md`](webauthn_passkey_safety.md)); no vector or future implementation may
    feed credential material into HKDF as the secret input.

## 7. KDF: Argon2id

- **Primary source:** RFC 9106, "Argon2 Memory-Hard Function for Password
  Hashing and Proof-of-Work Applications" (defines Argon2id and its own
  worked test vectors).
- **Candidate fields to record per vector:** password (a non-secret vector
  label per [`crypto_test_vectors.md`](crypto_test_vectors.md) §6, never a
  real passphrase), salt, memory cost (m), time cost (t), parallelism (p),
  output length, expected tag/hash.
- **Note — mobile vs. desktop profile:** RFC 9106's own test vectors use
  fixed, RFC-defined `m`/`t`/`p` for correctness testing; the separate
  question of what parameters FedOS actually runs in production on
  memory-constrained mobile devices versus desktop is an **explicit future
  decision**, not implied or frozen by adopting these vectors — mobile and
  desktop profiles must be decided and documented separately when that Stage
  arrives.
- **Never use the password directly as an AEAD key.** A passphrase always
  passes through Argon2id (with a salt) before it may key any AEAD
  construction — restated here from
  [`crypto_test_vectors.md`](crypto_test_vectors.md) §9 because it is the
  primary reason Argon2id exists in this catalog at all.

## 8. NIP-44

- **Primary source:** the upstream NIP-44 v2 test-vector file in the
  `nostr-protocol/nips` repository (the canonical Nostr NIPs repo that
  defines NIP-44 "Encrypted Payloads (Versioned)").
- **Fields to record per vector:** conversation key (the derived shared-key
  input to the construction), nonce (per-message), plaintext/payload,
  expected ciphertext (versioned, wire-encoded form), and decrypt-failure
  cases.
- **Note:** **NIP-44 is a separate, versioned wire protocol layered on top of
  an AEAD-like construction — it is NOT the generic AEAD layer** described in
  §3–§5 above, and it must never be treated as interchangeable with raw
  ChaCha20-Poly1305/XChaCha20-Poly1305/AES-GCM vectors. **Do not invent a
  local variant** of NIP-44 or "NIP-44-like" construction; correctness is
  defined solely by the upstream vector file, recorded by its exact
  commit/revision at copy time.

## 9. Negative / tamper vectors (cross-cutting)

Every primitive's vector set, when eventually adopted, must include negative
cases alongside the positive known-answer cases — restated here as a single
checklist so no primitive's catalog entry silently skips them:

- AEAD tag failure (any bit flip in the tag).
- Wrong AAD (AAD substituted or truncated).
- Wrong nonce (nonce substituted, reused, or wrong length).
- Corrupted ciphertext (any bit flip in ciphertext).
- Malformed payload (wire-format violation — relevant to NIP-44's versioned
  envelope in particular).
- Truncated payload (ciphertext/tag/envelope cut short).
- Wrong domain-separation label (HKDF `info` mismatch must not produce a
  matching `OKM`).
- KDF wrong `info`/`salt` must not match the expected output for a different,
  valid `info`/`salt` — i.e. the vector set must prove that "close but wrong"
  inputs do NOT collide with a correct output, not merely that "correct"
  inputs work.

## 10. File layout (updated — Stage 73 committed five of six files)

Originally (Stage 71) this section named a future layout with none of these
files created. As of Stage 73, the following are COMMITTED, verbatim-imported
files under [`test-vectors/`](../test-vectors/README.md):

- `test-vectors/aead/chacha20poly1305-rfc8439.json` — **committed**.
- `test-vectors/aead/xchacha20poly1305-*.json` — **still NOT committed**;
  §4's source (draft-irtf-cfrg-xchacha vs. libsodium vs. a traceable
  RustCrypto vector) remains undecided.
- `test-vectors/aead/aes256gcm-nist.json` — **committed** (named
  `aes256gcm-nist.json`, not the originally sketched
  `aes256gcm-nist-cavp.json` — a naming detail only).
- `test-vectors/kdf/hkdf-rfc5869.json` — **committed** (named `hkdf-rfc5869.json`,
  not the originally sketched `hkdf-sha256-rfc5869.json`).
- `test-vectors/kdf/argon2id-rfc9106.json` — **committed**.
- `test-vectors/nip44/nip44-v2.json` — **committed** (named `nip44-v2.json`,
  not the originally sketched `nip44-v2-upstream.json`).

Each committed file carries its own `source` / `section` / `revision` /
`license` fields inline (per the §11 schema, as adopted); see
[`test-vectors/README.md`](../test-vectors/README.md) §3 for how verbatim
fidelity (no rewritten values) was verified for each source type.

## 11. Future JSON schema proposal (NOT implemented in this stage)

A proposed shape for the future vector files (proposal only, not committed,
not code):

- `algorithm` — the exact primitive name (e.g. `"chacha20poly1305"`).
- `source` — the named authority (e.g. `"RFC 8439"`, `"NIST CAVP GCMVS"`,
  `"nostr-protocol/nips NIP-44"`).
- `sourceRevision` — RFC number (stable) or repo commit/tag/draft-version
  (for anything not RFC-stable, per §4's XChaCha20-Poly1305 note).
- `licenseNote` — one line on the source's license/terms as verified at copy
  time.
- `cases[]` — the list of individual known-answer (and negative) cases.
  - per-algorithm case fields, e.g. AEAD: `key`, `nonce`, `plaintext`, `aad`,
    `ciphertext`, `tag`; HKDF: `ikm`, `salt`, `info`, `length`, `okm`;
    Argon2id: `passwordLabel`, `salt`, `m`, `t`, `p`, `outputLength`,
    `expected`.
  - `expected` — the expected output bytes (or, for a negative case, the
    expected failure).
  - `shouldPass` — boolean; `true` for known-answer cases, `false` for
    tamper/negative cases that must fail closed.
  - `notes` — free-text, e.g. "empty AAD case", "no-salt case", "wrong info
    must not collide".

This schema is a proposal for a later Stage to adopt, adjust, or replace —
nothing here commits a future Stage to this exact shape.

## 12. Rust implementation linkage

- This catalog sits between
  [`crypto_test_vectors.md`](crypto_test_vectors.md) (the general plan: what
  categories of vectors and rules apply) and a future real implementation —
  it exists to make source selection a solved problem before that
  implementation Stage begins.
- It also connects to
  [`fedos_core_rust_safety.md`](fedos_core_rust_safety.md) (crypto-crate
  adoption policy — "test vectors are mandatory at adoption") and
  [`fedos_core_build_manifest.md`](fedos_core_build_manifest.md) (the
  `testVectorSet` manifest field that will eventually reference which vector
  files a given build was checked against).
- **A future Rust implementation must pass these vectors before the runtime
  crypto-provider selection can be considered real.** Until then, the
  runtime crypto provider remains the inert `NoopCryptoProvider` /
  `PlaceholderFedosCoreCrypto` placeholder (Stage 65/69) — this catalog does
  not change that gate; it only prepares the sources the future gate will be
  checked against.

## 13. Current conclusion (updated — Stage 73)

- **Docs + committed vector data.** Stage 71 (this document) added no code.
  Stage 73 added the five verbatim vector files named in §10 under
  `test-vectors/`, still without touching `src/` or
  `packages/fedos-core-rust/src/`.
- **Vectors committed for five of six named primitives.** ChaCha20-Poly1305,
  AES-256-GCM, HKDF-SHA256, Argon2id, and NIP-44 v2 each have a committed,
  source-cited vector file; XChaCha20-Poly1305 does not.
- **No crypto implementation.** No AEAD/KDF/Argon2/NIP-44 runs anywhere in
  this repository — the vectors are inert JSON data, read by no code.
- **No dependencies.** `packages/fedos-core-rust/Cargo.toml` is untouched;
  `[dependencies]` stays empty.
- **Next stage may add an empty `test-vectors/` directory/schema docs or a
  manifest example** — not real vector bytes, which remain gated on a
  separate, explicitly-reviewed Stage per source (§10).
