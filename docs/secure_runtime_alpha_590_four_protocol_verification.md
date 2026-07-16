# Secure Runtime Alpha 590 — Four-Protocol Verification

Stage 10 of the Alpha 581–600 Durable Retry Registry & Delivery
Recovery Arc.

## The four protocols, confirmed from source

`FEDOS_BOARD_OUTBOUND_PROTOCOLS` (`src/board/outbox/fedos_board_outbox_types.ts`,
Alpha 413, unchanged): `"nostr" | "activitypub" | "atproto" | "session"`
— exactly four, re-confirmed by `test/secure_runtime_alpha_590_...test.ts`'s
own equality assertion against the live exported constant, not a
hardcoded list independent of source.

## Verified, by real execution, in `test/secure_runtime_alpha_590_four_protocol_verification.test.ts`

One intent per protocol, all four pending in the same Outbox
simultaneously. Cycle 1 (via a real `FedosHostDeliveryController` over
`createFedosDeliveryScheduler()`, so Observations actually persist):
nostr/activitypub deliver, atproto is rejected-forever (abandoned),
session stays genuinely pending. Cycle 2 (a genuinely fresh Scheduler +
Controller pair, hydrated from the SAME durable
`observationRepository`/`retryRegistry` cycle 1 used): nostr/
activitypub/atproto are NOT re-published (0 calls each); session IS
re-attempted (1 call) — the SAME "terminal suppressed, pending
continues" invariant Alpha 589 already proved at the Host level,
re-confirmed here across every protocol this repository defines, in
one composed run.

## Protocol-neutrality, confirmed structurally, not just behaviorally

`test/secure_runtime_alpha_590_...test.ts`'s own second case regexes
`fedos_delivery_recovery_hydration.ts`'s own CODE (comments stripped,
mirroring Alpha 512/576's own established `codeOnly()` convention) and
confirms it contains neither `.protocol` nor any of the four protocol
name literals — recovery hydration reads `outboxId`/`subjectId`/
attempt history only, exactly like `FedosPublishScheduler` itself
(Alpha 486, unchanged) and the abandonment policy boundary (Alpha 569,
unchanged) already do.

## A real test-authoring pitfall found and fixed during this Stage

An early draft called `createFedosDeliveryScheduler()`'s own returned
`FedosPublishScheduler` directly (`.tick()`), which — correctly, by
design (Alpha 581's own inventory: the Scheduler itself does not
persist Observations, only returns them) — wrote nothing durable,
making the "restart" half of the test see empty history for every
intent. Corrected by driving both cycles through a real
`FedosHostDeliveryController` (which DOES persist, Alpha 505/529,
unchanged), matching how `FedosDesktopHost.startDelivery()` actually
uses `createFedosDeliveryScheduler()` in production.

## See also

- `docs/secure_runtime_alpha_589_real_restart_verification.md`
- `docs/secure_runtime_alpha_486_scheduler_protocol_agnosticism_review.md`
