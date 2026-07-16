# Secure Runtime Alpha 717 — Operational Subprocess Verification

Stage 17 of Phase B.

## Honest boundary

A real, separate Node subprocess reaching "ready" and exchanging Nostr
events with a genuinely external Relay was judged NOT appropriate for
this automated verification pass: it would require either a live
internet connection to a real public Nostr relay (non-deterministic,
network-dependent, and outside this sandboxed environment's own
reviewed scope) or hand-rolling a full WebSocket SERVER (HTTP Upgrade
handshake + RFC 6455 frame parsing) from scratch, which this Arc's own
"no new dependency" constraint would make a substantial, unreviewed new
surface — well beyond a "verification" Arc's own proportionate scope.

`npm run build:runtime && node dist/desktop/runtime/run_fedos_desktop_runtime.js`
remains the real, existing entry point (`src/desktop/runtime/run_fedos_desktop_runtime.ts`,
Alpha 613, unchanged) a real deployment would use, now with
`nostrAuthorBindingAuthority`/`nostrAccountIndex`/a caller-assembled real
`FedosNostrBoardPublisherAdapter` (Alpha 704) available to wire through
its own config surface — no new code was needed there.

## Fallback executed instead (per this Alpha's own explicit instruction)

The SAME execution graph — Local Runtime → BoardRuntime → Public Author
Authority → Nostr Binding → Eligibility → Host durable write → Outbox →
Scheduler → Publisher → (real BIP-340) signer → (deterministic,
in-process) Relay double → Observation → Retry — is verified in-process,
with real cryptographic signing and real durable append-only persistence
across real process-boundary-shaped restarts (three independent
`startFedosDesktopRuntime()` calls over the same files), in:

- `test/secure_runtime_alpha_707_real_nostr_outbox_processing.test.ts`
- `test/secure_runtime_alpha_709_restart_delivery_verification.test.ts`
- `test/secure_runtime_alpha_713_failure_matrix_and_safety.test.ts`

No seed/passphrase/secret material is ever printed anywhere in this
Arc's own code or tests — confirmed by direct inspection (every new
production file's own return types carry no secret, Alpha 695/718).
