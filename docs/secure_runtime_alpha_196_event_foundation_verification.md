# Secure Runtime Alpha 196 — Nostr Event Foundation Verification

**Status: this Stage is REVIEW ONLY — it adds test coverage
(`packages/fedos-core-rust/src/lib.rs`'s own `#[cfg(test)]` module,
landed alongside Alpha 192/193/194/195's own implementation in the
same file edit) but makes NO further production-code change. This is
Stage 6 of the Alpha 191–200 Nostr Event Foundation Arc, following
Alpha 195's own connection to the Schnorr Signature foundation.**

## 1. Why now

Alpha 192–195 implemented the full pipeline — Handle construction,
canonical serialization, Event ID generation, and signing. This Stage
verifies, by real execution, that every property this Arc's own
Objective required actually holds, plus the strongest available proof
of end-to-end correctness: real BIP-340 verification of a fully
constructed, signed event.

## 2. Verification performed (real execution)

### 2.1 Identical input → identical Event ID

`same_event_fields_derive_identical_event_ids` (`master_root::tests`)
builds TWO separate `FedosNostrEventHandle` values from the SAME five
core fields (same public key, `created_at`, `kind`, `tags`, `content`)
and confirms `derive_nostr_event_id_internal` produces byte-for-byte
identical `[u8; 32]` output for both — the SAME "prove determinism by
constructing independently, not by reusing one object" discipline
Alpha 174/184 already established for hex/npub encoding and Schnorr
signing respectively.

### 2.2 Field changes → different Event ID

Per-field separation, one test per field, all five core fields
covered independently (this Arc's own instruction named two —
"message changes" and "pubkey changes" — this Stage covers ALL five,
the full `EventCore` shape Alpha 191 §5 decided):

- `different_content_derives_different_event_id`
- `different_created_at_derives_different_event_id`
- `different_kind_derives_different_event_id`
- `different_tags_derives_different_event_id`
- `different_pubkey_derives_different_event_id` (two INDEPENDENTLY
  derived secret keys → two independently derived public keys → two
  events, otherwise identical, confirmed non-matching)

### 2.3 Canonical serialization — known-answer and escaping-specific
   checks

- `canonical_serialization_matches_the_nip01_five_element_array_shape`
  — a known-input, known-output check: builds a real event with two
  tags and known `created_at`/`kind`/`content`, and asserts the
  produced canonical string EQUALS the exact expected NIP-01 array
  text, character for character, confirming no whitespace anywhere.
- `canonical_content_escapes_exactly_the_six_nip01_characters` — a
  `content` string containing ALL SIX of NIP-01's own escape-worthy
  characters (`\n` `"` `\\` `\r` `\t` backspace form-feed) confirms
  each one is escaped exactly as NIP-01 requires.
- `canonical_content_passes_non_ascii_utf8_through_verbatim` — a
  `content` string containing non-ASCII UTF-8 (`café 日本語`) confirms
  it passes through UNESCAPED, and that no `\u`-style escape sequence
  appears anywhere in the output — the exact divergence from generic
  JSON serializers Alpha 193 §3 documents.

### 2.4 Fail Closed

- `new_nostr_event_internal_succeeds_for_a_real_public_key`,
  `derive_nostr_event_id_internal_succeeds_for_a_real_event`, and
  `sign_nostr_event_internal_succeeds_for_a_real_event` confirm the
  positive path resolves `Some` at each of the three pipeline stages.
- `sign_nostr_event_internal_rejects_a_cleared_secret_key` confirms a
  `clear()`-ed `FedosNostrSecretKeyHandle` yields `None` from the
  connected signing path, never a panic.
- `sign_nostr_event_internal_does_not_mutate_the_input_secret_key`
  confirms `secret_key.is_cleared()` stays `false` after signing.

### 2.5 Signature verification remains valid — real, executed BIP-340
   verification of the FULL pipeline

`signed_nostr_event_cryptographically_verifies_end_to_end` builds a
real event, derives its own Event ID (Alpha 194) via canonical
serialization (Alpha 193), signs that ID via the connected Schnorr
foundation (Alpha 195), reconstructs a `k256::schnorr::VerifyingKey`
from the SAME public key the event itself carries, and confirms
`PrehashVerifier::verify_prehash` returns `Ok` — proving the ENTIRE
pipeline (event fields → canonical text → sha256 → Schnorr signature)
produces a genuinely valid Nostr event, not merely internally
self-consistent output. `signed_nostr_event_does_not_verify_against_a_different_events_id`
is the negative/tamper counterpart: a signature over one event's own
ID does NOT verify against a DIFFERENT event's own ID (simulating
post-signing tampering), confirming `verify_prehash` correctly
rejects the mismatch. `sign_nostr_event_internal_produces_identical_signatures_for_the_same_event`
additionally confirms signing determinism at the connected level, not
merely at Alpha 184's own lower (`derive_nostr_signature_internal`)
level.

## 3. Seventeen tests total — beyond this Arc's own four-item minimum

This Arc's own Objective named four required verifications
("identical input → identical Event ID," "message changes → different
Event ID," "pubkey changes → different Event ID," "signature
verification remains valid"). This Stage delivers seventeen real
`#[test]` functions covering those four PLUS every other core field's
own separation property, canonical-serialization correctness
(known-answer and escaping-specific), and Fail-Closed behavior at
both the event-construction and signing layers — the SAME
"exceed the stated minimum where the additional coverage is cheap and
directly relevant" pattern Alpha 184 §2.5 already set for the Schnorr
Signing Foundation Arc.

## 4. What this Stage does NOT do

- Does **not** modify `packages/fedos-core-rust/src/lib.rs` beyond the
  `#[cfg(test)]`-only test functions landed alongside Alpha
  192/193/194/195's own implementation — no further production code
  change.
- Does **not** implement a production Decoder, Verifier, or any public
  verification API — `verify_prehash` is called from `#[cfg(test)]`
  code only, using k256's own existing trait, never wrapped in a new
  crate-exported function (the SAME scope boundary Alpha 184 §4
  already drew for the Schnorr foundation's own equivalent tests).
- Does **not** modify `src/desktop/*`, `src/identity/*`, `src/nostr/*`,
  `create_runtime.ts`, `types.ts`, `worker.ts`, Storage, Observation,
  `Cargo.toml`, or `package.json`.

## 5. See also

- `docs/secure_runtime_alpha_195_connect_event_id_to_schnorr_signing.md`
- `docs/secure_runtime_alpha_194_deterministic_event_id_generation.md`
- `docs/secure_runtime_alpha_193_canonical_event_serialization.md`
- `docs/secure_runtime_alpha_192_nostr_event_handle.md`
- `docs/secure_runtime_alpha_184_signature_determinism_verification.md`
