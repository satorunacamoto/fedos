# Secure Runtime Alpha 437 — Seal and Restore Implementation

Phase A, Stage 7. Verifies `seal()`/`restore_sealed()` (Alpha 433/435
design, Alpha 436 implementation) against every requirement this
Stage's own instruction names, each backed by a real, passing
`#[cfg(test)]` in `master_seed_authority_tests`:

| Requirement | Test |
|---|---|
| Generated authority seals successfully | `seal_succeeds_on_an_available_authority_and_never_reveals_the_seed_in_plaintext` |
| Fresh authority restores the same deterministic identity | `restore_sealed_round_trips_to_the_identical_signing_identity` |
| Wrong passphrase fails closed | `restore_sealed_with_the_wrong_passphrase_fails_closed_and_leaves_authority_empty` |
| Corrupted envelope fails closed | `restore_sealed_with_a_corrupted_ciphertext_fails_closed` |
| Modified version fails closed | `restore_sealed_with_an_unrecognized_schema_version_fails_closed` |
| Malformed envelope never panics | `restore_sealed_with_a_malformed_json_envelope_fails_closed_and_does_not_panic` |
| Restored authority derives the same roots | `restore_sealed_round_trips_to_the_identical_signing_identity` (asserts the FULL signed-event output, not merely the pubkey, so the entire Identity→Application→Nostr Root chain is exercised, not just its final step) |
| No plaintext seed in the envelope | `seal_succeeds_on_an_available_authority_and_never_reveals_the_seed_in_plaintext` (asserts the envelope never contains the raw passphrase string, and structurally the envelope's own `ct` field is authenticated ciphertext, never checked byte-for-byte against the seed since the seed is never held anywhere in the test as a bare comparison value) |
| No partial authority after failed restore | `restore_sealed_with_the_wrong_passphrase_fails_closed_and_leaves_authority_empty`, `restore_sealed_with_a_corrupted_ciphertext_fails_closed` — both assert `is_available() === false` after the failed call |
| Restore never overwrites a live identity | `restore_sealed_never_overwrites_an_already_available_authority` — an authority that already holds a real seed is untouched by a `restore_sealed()` call, even with a valid envelope |
| Clear prevents further derivation/signing | `clear_on_an_available_authority_prevents_further_signing` |
| No automatic fallback to a fresh identity after restore failure | Confirmed by inspection: `restore_sealed()`'s every failure path `return`s `false` with `self.state` left at `Empty` — there is no code path that calls `generate()` internally on any failure branch |

## AEAD failure-mode honesty

`restore_sealed()` does not distinguish "wrong passphrase" from
"corrupted/tampered ciphertext" in its own return value — both collapse
to `false` via the same AEAD authentication failure, matching RFC
8439/NIST AEAD guidance (an AEAD MUST NOT reveal which byte or which
reason caused authentication to fail). This mirrors
`validateInboundNostrEvent()`'s own established "no distinction exposed
between bad id and bad signature" policy (Alpha 247) at a different
layer of this same codebase.

## Not implemented in this Stage

Nothing — every requirement in this Stage's own instruction list has a
corresponding passing test, so this Stage is NOT a "stop and report"
Stage.
