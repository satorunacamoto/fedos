# Secure Runtime Alpha 574 — Host Lifecycle Verification

Stage 14 of the Alpha 561–580 Publish Scheduler Concurrency Safety &
Abandonment Policy Arc.

## Verified, by real execution, in `test/secure_runtime_alpha_574_host_lifecycle_verification.test.ts`

1. **`start()` -> `startDelivery()` -> slow publish -> `stopDelivery()`
   -> `Host.stop()`:** `stopDelivery()` does not resolve before the
   in-flight, gated Publisher call completes (proven by an explicit
   "still not resolved" check mid-await, not merely by absence of an
   error); no further `Publisher.publish()` call occurs after the gate
   is released post-stop; `deliveryStatus()` correctly reports
   `{ running: false }` afterward.
2. **`FedosDesktopHost` itself is unchanged by this Arc:** this Arc's
   own production changes are confined to
   `src/board/outbox/fedos_publish_scheduler.ts`,
   `src/desktop/host/fedos_host_delivery_controller.ts`, and the new
   `src/board/outbox/fedos_board_outbox_abandonment_policy.ts` —
   `fedos_desktop_host.ts` and `create_fedos_desktop_host.ts` are not
   touched, confirmed by `git status` at commit time (see
   `docs/secure_runtime_alpha_578_publish_runtime_compatibility_review.md`).
3. **`startDelivery()`/`stopDelivery()` may be cycled repeatedly
   without wedging** — every cycle completes normally, the single-
   flight guard (Alpha 563/564) never leaves a Scheduler or Controller
   instance stuck. This same test ALSO surfaces a real, pre-existing,
   out-of-scope characteristic (fresh-Scheduler-per-`startDelivery()`
   re-attempts already-delivered intents) — see
   `docs/secure_runtime_alpha_573_restart_stable_abandonment.md` for the
   full, honest account; not a regression this Arc introduces, not
   something this Arc's own Absolute Prohibitions permit fixing here.

## `FedosDesktopHost`'s own pre-existing Board/Query boundary — unaffected

Nothing in this Arc touches `submitPost()`, `previewRegistration()`,
`registerPost()`, `query()`, or any Board-persistence path — confirmed
by Alpha 576's own structural guard (#7) regexing the touched files for
those exact identifiers, none found.

## See also

- `docs/secure_runtime_alpha_564_scheduler_stop_barrier.md`
- `docs/secure_runtime_alpha_573_restart_stable_abandonment.md`
