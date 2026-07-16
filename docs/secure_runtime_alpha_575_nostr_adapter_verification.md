# Secure Runtime Alpha 575 — Nostr Adapter Verification

Stage 15 of the Alpha 561–580 Publish Scheduler Concurrency Safety &
Abandonment Policy Arc.

## Verified, by real execution against the REAL Nostr Adapter (not a mock), in `test/secure_runtime_alpha_575_nostr_adapter_verification.test.ts`

- `FedosDesktopHost` -> `FedosPublishScheduler` (single-flight, Alpha
  563) -> `FedosNostrBoardPublisherAdapter` (Alpha 496, unchanged) ->
  `FedosRelayNostrBoardPublisher` (unchanged) -> `NullRelay` — real
  classes throughout, mirroring Alpha 513's own established pattern.
  Exactly one `relay.published` entry for one intent; the Delivery
  Retry Query reports exactly one recorded attempt.
- The Scheduler still imports NOTHING Nostr-specific — re-confirmed by
  regexing `fedos_publish_scheduler.ts`'s own CODE (comments stripped,
  mirroring Alpha 512's own `codeOnly()` convention) for `nostr` /
  `WebSocket` / a direct `FedosRelay*` construction, and confirming
  every `import ... from` specifier still matches
  `^\./fedos_board_outbox_` — the SAME boundary Alpha 486 established,
  now re-verified AFTER this Arc's own single-flight and abandonment-
  policy additions, not merely assumed still true.

## `accepted`/`rejected` outcomes through the real Adapter — covered by Alpha 579, not duplicated here

This Stage focuses on the SUCCESS path through the real Adapter/Relay
stack specifically, since that is the one path Alpha 513 already
established a real (non-mocked) reference implementation for.
`rejected`/abandonment-policy paths are exercised with a scripted
`FedosBoardOutboxPublisher` in Alpha 568/579 — the Adapter's own
outcome-mapping logic (Alpha 496) is unchanged by this Arc and outside
this Arc's own touched-file set, so re-deriving every outcome branch
through the real Relay stack here would duplicate Alpha 496's own
existing verification rather than add new coverage.

## See also

- `docs/secure_runtime_alpha_496_publisher_adapter.md`
- `docs/secure_runtime_alpha_513_full_pipeline_flow_verification.md` (referenced via `test/secure_runtime_alpha_513_...test.ts`)
- `docs/secure_runtime_alpha_486_scheduler_protocol_agnosticism_review.md`
