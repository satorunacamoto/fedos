# Secure Runtime Alpha 458 — Publisher Behavioral Verification

Stage 8 of the Alpha 451–460 Canonical Nostr Outbound Publisher
Foundation Arc. Verification only — no production code changes.

## 1. What this Stage verifies

Alpha 456/457's own test files already exercise `publishOne()`/
`publishBatch()` in isolation (protocol mismatch, not-connected,
success, arbitrary Relay error, sequencing, independent outcomes). This
Stage adds ONE additional test file exercising the FULL pipeline this
Arc's own scope names end to end: an Outbox intent, an already-signed
`FedosNostrWireEvent`, the Alpha 454 conversion, and a real
`FedosRelay` (`NullRelay`) — as one continuous flow, mixed with entries
targeting a different protocol, confirming only the `nostr`-targeted
entries reach the Relay and every reaching descriptor is byte-for-byte
the Alpha 454 mapping of its own source wire event.

## 2. Result

All new tests pass. `npm run typecheck` is GREEN for every file this
Arc adds or touches (the one pre-existing failure, in the untracked,
un-adopted Alpha 473 stray file, is unrelated — see Alpha 451 §4 and
Alpha 460 §4).

## 3. What remains unverified by design

Real-network delivery (an actual relay accepting the `["EVENT", ...]`
frame) is NOT verified here — `WebSocketRelay.publish()` itself was
already verified against a fake socket at Alpha 216/217; this Arc adds
no new claim about real-network behavior, only about the NEW conversion
and pairing logic sitting in front of the UNCHANGED `FedosRelay.publish()`
call.

## 4. See also

- `docs/secure_runtime_alpha_456_relay_nostr_board_publisher_publish_one.md`
- `docs/secure_runtime_alpha_457_relay_nostr_board_publisher_publish_batch.md`
- `docs/secure_runtime_alpha_217_relay_foundation_verification.md`
