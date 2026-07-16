# Secure Runtime Alpha 709 — Restart Delivery Verification

Stage 9 of Phase B. `test/secure_runtime_alpha_709_restart_delivery_verification.test.ts`,
using real append-only paths (`mkdtempSync`) and three fully independent
`startFedosDesktopRuntime()` calls:

1. Runtime A creates a post + Outbox intent with a `60_000`ms delivery
   interval, guaranteeing zero ticks fire within the test's timeframe —
   `relayA.published` stays empty.
2. Runtime A stops BEFORE any delivery attempt.
3. Runtime B restores the SAME sealed identity (a shared, real BIP-340
   keypair, standing in for a real Master Seed restore — already
   independently proven at the Rust level by
   `public_key_hex_for_account_restored_from_the_same_sealed_envelope_yields_the_identical_hex`,
   Alpha 696) and the SAME durable Board/Outbox/Observation paths.
4. Runtime B starts delivery with a fast (`10`ms) interval.
5. The expected signed event is actually sent — `relayB.published` has
   length 1, content matches.
6. Runtime B stops.
7. Runtime C restarts once more over the SAME durable paths.
8. The already-accepted intent is NOT resent — `relayC.published` stays
   empty, confirmed via a completely fresh Relay double per runtime
   instance (so any resend would be unmistakably visible).

## Weaker guarantee, honestly stated

This test uses a real, deterministic BIP-340 signing test double (not
real Rust/WASM signing — the dev-only gate blocks that in this test
environment) and a real, deterministic `AckingRelay` (not a live network
Relay). The DURABLE PERSISTENCE restart guarantee (Board/Outbox/Observation
state surviving a real process boundary via real append-only files) is
fully real and proven. The IDENTITY restoration and NETWORK transport
legs are proven at the unit level elsewhere (Rust `cargo test` for seed
restore; `test/secure_runtime_alpha_707_*` for real BIP-340 signing and
OK correlation) rather than in this exact restart scenario simultaneously
— combining all three in one live-network, live-Rust-WASM test was judged
out of reach for an automated, offline test suite (see Alpha 717's own
honest boundary statement).
