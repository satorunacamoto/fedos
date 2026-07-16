# Secure Runtime Alpha 707 — Real Nostr Outbox Processing

Stage 7 of Phase B. The exact ten-step scenario, run for real in
`test/secure_runtime_alpha_707_real_nostr_outbox_processing.test.ts` test 1:

1. Create a controlled Nostr identity — a real BIP-340 secp256k1 keypair
   (`@noble/curves`, already an existing project dependency).
2. Create a public thread with an explicit `"nostr"` target.
3. Canonical post is durable — `InMemoryFedosBoardPersistence`, confirmed
   via `findPost()`.
4. Outbox intent is durable — confirmed via `outboxPersistence.listIntents()`.
5. Start delivery — `host.startDelivery()`, `deliveryIntervalMs: 10`.
6. Scheduler selects the intent — `FedosPublishScheduler`, unchanged.
7. Publisher signs — via the real signing test double (genuine BIP-340
   Schnorr signature, not a WASM/Rust call — see the file's own header
   for why: the WASM dev-only gate blocks real Rust execution in this
   test environment, matching every pre-existing TS-level signing test's
   own convention).
8. Relay transport receives one Event — `AckingRelay.published` has
   length 1, content matches the post body exactly.
9. Observation recorded — `FedosDeliveryRetryQuery.historyFor()` shows
   one attempt, state `"publishing"` or `"accepted"`.
10. No duplicate send — test 3 of the same file confirms a single
    accepted intent is not re-attempted on a later tick.

An injected, deterministic test-double Relay (`AckingRelay`) is used
throughout, per the task's own "Use injected deterministic Relay/test
socket as needed" instruction — no live network connection is made.
