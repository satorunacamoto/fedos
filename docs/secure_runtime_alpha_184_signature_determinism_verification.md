# Secure Runtime Alpha 184 — Nostr Signature Determinism Verification

**Status: this Stage is REVIEW ONLY — it adds test coverage
(`packages/fedos-core-rust/src/lib.rs`'s own `#[cfg(test)]` module,
landed alongside Alpha 182/183's own implementation in the same file
edit) but makes NO further production-code change. This is Stage 4 of
the Alpha 181–190 Nostr Schnorr Signing Foundation Arc, following
Alpha 183's own `derive_nostr_signature_internal`.**

## 1. Why now

Alpha 183 implemented the signing function; this Stage verifies, by
real execution, that every property this Arc's own Objective required
actually holds — determinism, message separation, account separation,
and Fail Closed — plus one property beyond this Arc's own minimum bar:
real BIP-340 cryptographic verification against the independently
derived public key (Alpha 186's own Interoperability Review, proven
here rather than merely asserted there).

## 2. Verification performed (real execution)

### 2.1 Same key + same message → identical signature

`same_secret_key_and_same_message_derive_identical_signatures`
(`master_root::tests`) derives a Nostr Secret Key once, then calls
`derive_nostr_signature_internal` TWICE against the SAME message,
confirming the two resulting `FedosNostrSignatureHandle` values match
via `matches_for_internal_verification`. `signature_matches_for_internal_verification_returns_true_only_for_equal_bytes`
independently reconfirms the SAME property using a differently
structured pair of calls, mirroring the identical pair of tests
`derive_nostr_public_key_internal` already has (Alpha 174's own
precedent for this exact "prove determinism twice, two different
ways" pattern).

### 2.2 Different message → different signature

`same_secret_key_and_different_message_derive_non_matching_signatures`
holds the secret key fixed and varies only the message
(`[0x01; 32]` vs. `[0x02; 32]`), confirming the two signatures do NOT
match.

### 2.3 Different account → different signature

- `different_account_indices_derive_non_matching_signatures_for_the_same_message`
  confirms account `0` and account `1` under the SAME Nostr Root,
  signing the SAME message, produce non-matching signatures.
- `different_master_seeds_and_same_account_index_derive_non_matching_signatures`
  confirms two different Master Seed byte patterns, same Account Index
  `0`, same message, produce non-matching signatures — the SAME
  separation property one full level higher up the derivation chain,
  mirroring `different_master_seeds_and_same_account_index_derive_non_matching_public_keys`'s
  own identical structure (Alpha 170).
- `account_index_zero_one_and_u32_max_all_sign_successfully_and_distinctly_for_the_same_message`
  confirms accounts `0`, `1`, and `u32::MAX` — the SAME three boundary
  values Alpha 170/174 already exercised for key derivation and
  identifier encoding — all sign successfully and are pairwise
  non-matching, for the identical fixed message.

### 2.4 Fail Closed

- `derive_nostr_signature_internal_rejects_a_cleared_secret_key`
  confirms a `clear()`-ed `FedosNostrSecretKeyHandle` yields `None`,
  never a panic.
- `derive_nostr_signature_internal_succeeds_for_a_real_secret_key`
  confirms the positive path resolves `Some`.
- `derive_nostr_signature_internal_does_not_mutate_the_input_secret_key`
  confirms `secret_key.is_cleared()` stays `false` after signing —
  the input is borrowed, never consumed or invalidated.

### 2.5 Real cryptographic cross-verification (beyond this Arc's own
   minimum bar)

`derived_signature_cryptographically_verifies_against_the_independently_derived_public_key`
derives BOTH the public key (via the EXISTING, unmodified
`derive_nostr_public_key_internal`, Alpha 169) and the signature (via
the NEW `derive_nostr_signature_internal`, Alpha 183) from the SAME
secret key, reconstructs a `k256::schnorr::VerifyingKey` from the
public key's own x-only bytes, and confirms
`PrehashVerifier::verify_prehash` returns `Ok` — REAL, executed
BIP-340 verification, not merely internal self-consistency between two
calls to the same function. This is Alpha 186's own Interoperability
Review claim, PROVEN here by execution rather than asserted by prose
there — Alpha 186 itself cites this exact test as its own evidence.
`derived_signature_does_not_verify_against_a_different_message` is the
negative counterpart: the SAME signature, checked against a DIFFERENT
message, fails verification (`verify_prehash(...).is_err()`).

## 3. Why zero auxiliary-randomness determinism is sound, restated
   from Alpha 181 §3 and now empirically confirmed

Alpha 181 §3 already established, from reading k256's own source, that
`sign_prehash` fixes BIP-340's own auxiliary-randomness input at
all-zero bytes rather than drawing from an RNG — the reason
determinism was EXPECTED before this Stage ran a single test. This
Stage's own §2.1/§2.2 tests confirm that expectation empirically: the
SAME key and message ALWAYS produce the SAME signature across
independent calls (never merely "usually" or "with high probability"
— every test run, every CI run, produces byte-identical output),
and §2.5's real BIP-340 verification confirms that deterministic
output is not merely internally self-consistent but ACTUALLY VALID
per the published specification.

## 4. What this Stage does NOT do

- Does **not** modify `packages/fedos-core-rust/src/lib.rs` beyond the
  `#[cfg(test)]`-only test functions landed alongside Alpha 182/183's
  own implementation — no further production code change.
- Does **not** implement a production Decoder, Verifier, or any public
  verification API — `verify_prehash` is called from `#[cfg(test)]`
  code only, using k256's own existing trait, never wrapped in a new
  crate-exported function.
- Does **not** modify `src/desktop/*`, `src/identity/*`, `src/nostr/*`,
  `create_runtime.ts`, `types.ts`, `worker.ts`, Storage, Observation,
  `Cargo.toml`, or `package.json`.

## 5. See also

- `docs/secure_runtime_alpha_183_derive_nostr_signature_internal.md`
- `docs/secure_runtime_alpha_182_nostr_signature_handle.md`
- `docs/secure_runtime_alpha_181_k256_schnorr_api_inventory.md`
- `docs/secure_runtime_alpha_174_nostr_public_identifier_encoding_verification.md`
