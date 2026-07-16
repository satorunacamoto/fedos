# Secure Runtime Alpha 589 — Real Restart Verification

Stage 9 of the Alpha 581–600 Durable Retry Registry & Delivery Recovery
Arc.

## "Real restart," defined per this repository's own established convention

Confirmed by reading `docs/secure_runtime_alpha_545_publish_runtime_recovery_audit.md`
(Alpha 541–560 Arc): a "real restart," throughout this repository's own
prior verification, means constructing a BRAND NEW top-level instance
(`FedosBoardService` via `hydrateFedosBoardService`, there; a brand new
`FedosDesktopHost`, here) over the SAME injected durable Persistence/
Repository backend(s) a genuine process restart would also reuse (since
neither `InMemoryFedosBoardOutboxPersistence` nor
`InMemoryFedosDeliveryObservationPersistence` are themselves tied to
any single Host/Scheduler/Controller instance's own lifetime). This
Stage adopts that SAME convention, not a new one.

## Verified, by real execution, in `test/secure_runtime_alpha_589_real_restart_verification.test.ts`

Three cases, each constructing a FIRST `FedosDesktopHost`, running
delivery to a definite outcome, `stop()`ping it entirely, then
constructing a genuinely SECOND, independent `FedosDesktopHost` — a new
`#deliveryRetryRegistry`, a new (would-be) Scheduler/Controller, over
the SAME `outboxPersistence`/`observationRepository`:

1. An intent delivered by the first Host is never re-published by the
   second (`secondHostCalls === 0`).
2. An intent abandoned (Publisher `"rejected"`+`"never"`) by the first
   Host is never re-published by the second.
3. An intent still genuinely pending (Publisher always `"later"`, never
   terminal) by the first Host IS re-attempted by the second
   (`secondHostCalls > 0`) — restart never silently drops real,
   unfinished work; only GENUINELY terminal outcomes are ever
   suppressed.

Case 3 is the one this Stage considers most important to have proven
explicitly: a hydration bug that silently treated EVERYTHING as
terminal would pass cases 1–2 while silently discarding all real
pending work — case 3 is what rules that out.

## See also

- `docs/secure_runtime_alpha_545_publish_runtime_recovery_audit.md`
- `docs/secure_runtime_alpha_586_hydrate_retry_registry_during_host_startup.md`
- `docs/secure_runtime_alpha_590_four_protocol_verification.md`
