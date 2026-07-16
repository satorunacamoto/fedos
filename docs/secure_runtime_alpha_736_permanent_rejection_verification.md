# Secure Runtime Alpha 736 — Permanent Rejection Verification (headline)

Stage 16 — this Arc's own explicitly-named headline acceptance criterion.
Verified in
`test/secure_runtime_alpha_736_permanent_rejection_verification.test.ts`:

1. A real, valid BIP-340-signed Event is published.
2. A matching `["OK", eventId, false, "rejected: ..."]` is emitted.
3. The canonical result is confirmed `{ outcome: "rejected", externalReference: eventId }`
   — never `"failed"`.
4. The Delivery Observation history shows state `"rejected"`.
5. Multiple Scheduler ticks run (a 10ms interval over 150ms — roughly a
   dozen ticks) — the Relay's own `published` array has length **1**,
   proving the Publisher was never re-invoked for this intent.
6. The runtime restarts (a fresh `FedosDesktopHost` over the SAME durable
   Outbox/Observation backends), with a FRESH Relay double configured to
   ACCEPT (proving the test would have visibly failed if a resend
   occurred).
7. The Publisher is not called again — `relay2.published` stays empty.

A second test confirms no arbitrary Relay rejection text (`"rejected:
untrusted content policy violation"`) is ever persisted anywhere in
Delivery Observation (Alpha 726).

This is the direct, real-execution proof that the Arc's own Objective is
met: "A matching Relay OK with `accepted=false`... currently retried using
the same policy as a transient delivery failure" is now false — a genuine
rejection is permanently terminal, proven by real Scheduler ticks and a
real runtime restart, not by code inspection alone.
