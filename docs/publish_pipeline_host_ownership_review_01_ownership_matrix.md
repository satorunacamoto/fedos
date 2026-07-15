# 01 — Host Ownership Matrix

## Decision table

| Component | Decision | Rationale |
|---|---|---|
| Outbox Persistence | **OWN** (already true today) | `FedosDesktopHost` already holds `#outboxPersistence`, constructor-injected, defaulted to `InMemoryFedosBoardOutboxPersistence()` when omitted (`fedos_desktop_host.ts:305,314`). No change proposed — this review extends the SAME pattern to the other three components rather than inventing a new one. |
| Publisher registry | **OWN the registry container; INJECT each concrete Publisher** | Host should hold a private `Map<FedosBoardOutboundProtocol, FedosBoardOutboxPublisher>` (or equivalent), assembled from a constructor-injected registry object — mirroring `outboxPersistence`'s own "injected, Host holds the reference" shape. Host must NOT construct a real Nostr/ActivityPub/AT Protocol/Session Publisher itself (that would pull transport/signing dependencies into the Host layer, which `create_fedos_desktop_host.ts`'s own header already forbids by precedent — see that file's own guardrail list for the full set of things it names as out of scope). An empty/omitted registry is legal — Host works with zero wired protocols, matching `submitPostWithOutbox()`'s own existing "empty `targets` is legal" precedent. |
| Scheduler | **OWN (constructed BY Host, in `start()`, from already-owned Outbox Persistence + registry-derived composite Publisher)** | Mirrors `FedosBoardQuery`'s own existing precedent exactly: `FedosDesktopHost` never accepts a pre-built `FedosBoardQuery` from a caller — it constructs one itself, inside `start()`, from an already-hydrated dependency (`fedos_desktop_host.ts:332`). The Scheduler should be built the same way: Host is the ONE place a `FedosPublishScheduler` is constructed for a running process, not a caller-supplied dependency. This directly resolves Alpha 488's own "zero production caller constructs a `FedosPublishScheduler`" finding, without adding a second, competing construction path a caller could also use incorrectly. |
| Observation Repository | **OWN (constructor-injected, defaulted)** | Same shape as `boardPersistence`/`outboxPersistence`: an optional `FedosDeliveryObservationRepository` (or the raw `FedosDeliveryObservationPersistence` it wraps) dependency, defaulted to a fresh in-memory instance when omitted. Injected rather than Host-constructed because — unlike the Scheduler, which has no meaningful state of its own to inject — a Repository wraps a Persistence backend a caller legitimately needs to choose (in-memory for tests, durable for production), exactly like `boardPersistence` already is today. |
| Retry policy | **NOT OWNED — out of Host's scope entirely** | Retry policy is already fully decided elsewhere: `FedosBoardOutboxPublishResult.retryPolicy` (`"immediate" \| "later" \| "never"`, Alpha 473/474) is authored by the Publisher and applied by the Scheduler's own `#attemptIntent` loop. Host has, and should have, zero opinion here — it does not read, override, or pass through a retry policy of any kind. Introducing a Host-level retry override would create a SECOND retry authority alongside the Publisher's own, contradicting Alpha 474's own "no exponential backoff or scheduled-delay computation" closed model. |
| Clock / timer | **NOT OWNED — pass-through injection only, no new Clock abstraction** | `FedosDesktopHost` today holds no clock of any kind — its own header states plainly that `submitPostWithOutbox()` "holds no injected Clock" and reuses `post.createdAt` instead of calling `Date.now()`. This repository has never defined a named `Clock` interface anywhere (confirmed by search); `FedosPublishScheduler` itself already accepts bare `now?: () => number` / `setIntervalFn?` / `clearIntervalFn?` function injections directly, with real defaults (`Date.now`/`setInterval`/`clearInterval`). Host should forward an OPTIONAL `{ now?, setIntervalFn?, clearIntervalFn? }` triple straight through to the Scheduler's own constructor, unmodified, rather than wrapping them in a new named abstraction this codebase has no precedent for. |

## Summary

Four components change ownership state; two stay explicitly unowned by
design, not by omission:

- Outbox Persistence: already owned (no change).
- Publisher registry, Scheduler, Observation Repository: become
  Host-owned, following the EXACT injection/construction split already
  proven for `boardPersistence`/`outboxPersistence` (inject a
  Persistence-shaped dependency) versus `FedosBoardQuery` (Host
  constructs the orchestration object itself, inside `start()`).
- Retry policy and Clock/timer: deliberately NOT owned — retry policy
  because it already has a canonical owner (the Publisher), and
  Clock/timer because it is a pass-through parameter, not a resource
  Host itself needs to hold an opinion about.

## See also

- `docs/publish_pipeline_host_ownership_review_02_startup_ordering.md`
- `docs/publish_pipeline_host_ownership_review_05_ownership_api.md`
- `docs/secure_runtime_alpha_488_desktop_host_ownership_review.md`
