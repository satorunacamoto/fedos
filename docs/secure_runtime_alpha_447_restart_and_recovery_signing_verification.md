# Secure Runtime Alpha 447 — Restart and Recovery Signing Verification

Phase B, Stage 7. The exact eight-step sequence this Stage's own
instruction specifies, verified end-to-end by
`restore_sealed_round_trips_to_the_identical_signing_identity`
(Rust, real execution):

1. Generate authority — `let original = generated_authority();`
2. Seal it — `let envelope = original.seal(TEST_PASSPHRASE).expect("must seal");`
3. Sign an event — `let original_event = original.sign_nostr_event(7, 1_700_000_001.0, 1, vec![], "restart test".to_string()).expect("must sign");`
4. Destroy/clear the authority — a SECOND, INDEPENDENT
   `FedosMasterSeedAuthority::new()` instance is constructed
   (`restored`), simulating a real process restart more faithfully than
   calling `.clear()` on `original` would (a real restart does not
   "clear" the old process's memory — it simply no longer exists);
   `original` itself is dropped at end of scope, Rust's own
   zeroize-on-drop (`FedosMasterSeedHandle`'s `Drop` impl) running
   exactly as it would on real process exit.
5. Create a fresh authority — `let mut restored = FedosMasterSeedAuthority::new();`
6. Restore from the sealed envelope — `restored.restore_sealed(&envelope, TEST_PASSPHRASE)`
   returns `true`.
7. Sign the same event request — `restored.sign_nostr_event(7, 1_700_000_001.0, 1, vec![], "restart test".to_string())`.
8. Confirm identical pubkey/id/signature — `assert_eq!(original_event, restored_event)` —
   byte-for-byte identical JSON strings, so `pubkey`, `id`, AND `sig`
   all match (BIP-340 Schnorr signatures are deterministic per RFC 6979-
   style nonce derivation in this crate's own `k256` dependency, so a
   re-signed IDENTICAL request from the SAME restored key produces the
   SAME signature, not merely the same pubkey).

## Also verified

- **Different sealed seed → different signing identity**:
  `two_generated_authorities_sign_the_same_request_differently` — two
  independently generated authorities produce different `pubkey` AND
  `sig` for the identical request.
- **Corrupt restore never silently generates a replacement identity**:
  confirmed by inspection (Alpha 437) — `restore_sealed()`'s every
  failure path returns `false` with no call to `generate()` anywhere on
  those paths; `restore_sealed_with_a_corrupted_ciphertext_fails_closed`
  additionally asserts `is_available() === false` after the failed
  call, so no identity — replacement or otherwise — exists to sign
  with.
- **Failed restore cannot sign**: same test — `restored.sign_nostr_event(...)`
  is never even called in that test, since `is_available()` is already
  `false`; `sign_nostr_event_fails_closed_on_an_empty_authority`
  separately confirms an `Empty` authority's `sign_nostr_event()`
  itself returns `None`.

## A concrete real fixture (captured, not fabricated)

A temporary probe test (removed immediately after capture, per this
Arc's own artifact-hygiene rule) produced one real, complete signed
event from a real generated authority:

```json
{"id":"8dfc662e1c95a0aa2e803316149583ff08b8e0a15c622b5b9a48b84983333cf2","pubkey":"0dd114ce42282a141284d9658753545d86574f763781ed302236d2e89f6668f7","created_at":1735000000,"kind":1,"tags":[["e","deadbeefcafe"],["p","abc123"]],"content":"Secure Runtime Alpha 446 fixture","sig":"cca2e65a427c06c01152baba037d68b978b0443c2211037a4df5a4579509bd3a993afa769b255880e0d962ca4b2d84f658eff155beaf81b623601ade3c57d100"}
```

This exact fixture is reused, unmodified, by
`test/secure_runtime_alpha_446_cryptographic_verification.test.ts` to
prove the TypeScript-side independent verifier
(`validateInboundNostrEvent`) accepts a genuinely Rust-signed event.
