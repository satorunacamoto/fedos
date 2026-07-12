# Secure Runtime Alpha 174 — Nostr Public Identifier Encoding Verification

**Status: this Stage is REVIEW ONLY — it adds test coverage
(`packages/fedos-core-rust/src/lib.rs`'s own `#[cfg(test)]` modules,
landed alongside Alpha 173's own implementation in the same file edit)
but makes NO further production-code change. This is Stage 4 of the
Alpha 171–175 Nostr Public Identifier Encoding Arc, following
Alpha 173's own Encoder implementation.**

## 1. Why now

Alpha 173 implemented the Encoder; this Stage verifies, by real
execution, that every property this Arc's own Objective required
actually holds — determinism, separation, boundary values, hex/npub
shape properties, and cross-checking against the one trusted offline
vector Alpha 171 §2.10 identified.

## 2. Verification performed (real execution)

### 2.1 Determinism

`same_master_seed_and_same_account_index_encode_identical_hex_and_npub`
(`master_root::tests`) builds the FULL chain — Master Seed → Identity
Root → Application Root → Nostr Root → Nostr Secret Key → Nostr Public
Key — TWICE from the SAME Master Seed bytes and the SAME Account
Index, and confirms both the resulting hex string and the resulting
`npub` string are byte-for-byte identical.

### 2.2 Separation

- `same_master_seed_and_different_account_index_encode_different_hex_and_npub`
  confirms account `0` and account `1` under the SAME Master Seed
  produce DIFFERENT hex and DIFFERENT `npub`.
- `different_master_seed_and_same_account_index_encode_different_hex_and_npub`
  confirms two different Master Seed byte patterns, same Account
  Index `0`, produce DIFFERENT hex and DIFFERENT `npub`.

### 2.3 Boundary values

`account_index_zero_one_and_u32_max_all_encode_successfully_and_distinctly`
confirms accounts `0`, `1`, and `u32::MAX` all encode successfully to
BOTH forms and are pairwise non-matching for both hex and `npub`.

### 2.4 Hex properties

The SAME test confirms, for all three boundary accounts: length
exactly 64, every character an ASCII hex digit, no uppercase
character present. `encode_nostr_public_key_hex_internal_produces_exactly_64_lowercase_hex_chars`
(`nostr_identifier_encoding::tests`) additionally confirms a KNOWN
input (`[0xAB; 32]`) encodes to the EXACT expected string
(`"ab".repeat(32)`) — a fixed-input, fixed-output known-answer check,
not just a shape check.

### 2.5 `npub` properties

- **Starts with `"npub1"`:** confirmed for all three boundary accounts
  and by `encode_nostr_npub_internal_starts_with_npub1_and_has_the_fixed_length`.
- **Canonical lowercase:** confirmed — no uppercase character in any
  produced `npub` string, in every test that checks it.
- **Deterministic checksum:** §2.1's own determinism test already
  proves this — the SAME input always yields the SAME checksum
  characters, since `bech32_encode` is a pure function of its input.
- **Fixed length:** `encode_nostr_npub_internal_starts_with_npub1_and_has_the_fixed_length`
  confirms the EXACT expected length — `"npub"` (4) + `"1"` (1) + 52
  data quintets (`ceil(32×8/5) = 52`) + 6 checksum quintets = 63
  characters — computed from first principles, not merely observed.
- **Payload corresponds to the original 32-byte public key:**
  `hex_and_npub_encode_the_same_underlying_32_byte_public_key` performs
  a MINIMAL, test-only reversal of the SAME `convertbits` algorithm
  Alpha 173's own encoder uses (decoding the `npub`'s own 5-bit data
  words back to bytes via the SAME published Bech32 charset) and
  confirms the recovered bytes, re-encoded as hex, match the encoder's
  OWN hex output for the SAME public key exactly. This is NOT a
  production Decoder (Alpha 171 §7's own scope decision stands
  unchanged) — it is a `#[cfg(test)]`-only cross-check, never compiled
  into a production build, never exposed, never named as an API.
- **No malformed data produced:** every property above already
  confirms this — a string starting with `"npub1"`, of the exact
  expected length, using only characters from the fixed Bech32
  charset, whose data payload round-trips to the correct bytes, is
  definitionally well-formed.

### 2.6 Known vector cross-check

`bech32_encode_matches_the_published_bip173_a_empty_vector`
(`nostr_identifier_encoding::tests`) confirms `bech32_encode("a", &[])`
produces EXACTLY `"a12uel5l"` — BIP-173's own first published test
vector (Alpha 171 §2.10), verifying the checksum/charset
implementation itself against a trusted, offline, Nostr-independent
source. No `test-vectors/nip19` file exists in this repository to
cross-check against (Alpha 171 §2.10 already confirmed this), and this
Arc's own instruction forbids network access — this BIP-173 vector,
plus the independent-reversal self-check (§2.5), are the full extent
of "known vector" verification available under those constraints, and
this Stage states that plainly rather than fabricating a
Nostr-specific hex/`npub` pair from memory (this Arc's own "推測禁止"
instruction).

### 2.7 No panic

`derive_nostr_public_key_internal` (Alpha 169, UNCHANGED) already
confirmed panic-free; Alpha 173 §5/§6 confirm, by direct source
inspection, that neither `encode_lowercase_hex_32` nor `bech32_encode`
contains any code path capable of panicking (no `.unwrap()`,
`.expect()`, `panic!()`, or unchecked-bounds array index) — every array
access is masked into range by construction.

## 3. What this Stage does NOT do

- Does **not** modify `packages/fedos-core-rust/src/lib.rs` beyond the
  `#[cfg(test)]`-only test modules landed alongside Alpha 173's own
  implementation — no further production code change.
- Does **not** implement a production Decoder — the reversal in §2.5
  is test-only, never exposed, never a public/`pub(crate)` API.
- Does **not** attempt network access of any kind, and does **not**
  fabricate a Nostr-specific known-answer vector without a verifiable
  source.
- Does **not** modify `src/desktop/*`, `src/identity/*`,
  `src/nostr/*`, `create_runtime.ts`, `types.ts`, `worker.ts`, Storage,
  Observation, any Protocol Adapter, `Cargo.toml`, or `package.json`.

## 4. See also

- `docs/secure_runtime_alpha_173_nostr_public_identifier_encoder.md`
- `docs/secure_runtime_alpha_172_nostr_identifier_representation_decision.md`
- `docs/secure_runtime_alpha_171_existing_nostr_identifier_inventory.md`
