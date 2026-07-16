# Secure Runtime Alpha 735 — Acceptance Verification

Stage 15. `test/secure_runtime_alpha_736_permanent_rejection_verification.test.ts`
(the file also carries this Alpha's own headline sibling, Alpha 736)
verifies the full accepted path for real:

1. A real BIP-340 secp256k1 keypair produces a genuinely signed Nostr
   Event (same real-crypto test-double pattern established in Phase B of
   the prior Arc — the WASM dev-only gate blocks real Rust signing in
   this test environment).
2. Published through `FedosOutcomeAwareNostrBoardPublisherAdapter` +
   `FedosRelayOkCorrelatedNostrBoardPublisher` (this Arc's own new fix).
3. A matching `["OK", eventId, true, ...]` is emitted.
4. The canonical result is confirmed `{ outcome: "accepted", externalReference: eventId }`.
5. The Delivery Observation history shows state `"accepted"`.
6. The runtime restarts (a fresh `FedosDesktopHost` over the SAME durable
   Outbox/Observation backends).
7. The already-accepted intent is not resent — confirmed via a
   completely fresh Relay double per runtime instance.
