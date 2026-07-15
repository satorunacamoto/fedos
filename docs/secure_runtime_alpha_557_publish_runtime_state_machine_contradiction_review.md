# Secure Runtime Alpha 557 — State Machine Contradiction Investigation (State Machine矛盾)

Stage 17 of the Alpha 541–560 Publish Runtime Operational Review Arc.
Review only.

## Method

Compare the meaning of "ready"/"running"/"available" across every state
machine cataloged in Alpha 544, looking for two machines that use a
similar-sounding token to mean genuinely different things a caller
could reasonably confuse.

## `FedosDesktopHostState.ready` vs. `DesktopApplication.#started === true` — consistent, not contradictory

`Host.start()` only reaches `"ready"` AFTER `await this.#desktopApplication.start()`
resolves — so `Host.state() === "ready"` STRICTLY IMPLIES
`desktop()!.isBootstrapped() === true`-adjacent guarantees hold
(`DesktopApplication.start()` itself calls `bootstrap()` before
returning). No contradiction found — Host's own "ready" is, by
construction, a STRICT SUPERSET of DesktopApplication's own "started."

## `FedosDesktopHostState.ready` vs. `FedosPublishScheduler.#running` — NOT YET comparable, and that absence is itself the finding

Because nothing wires a Scheduler under Host today (Alpha 543), there
is NO relationship — contradictory or otherwise — between these two
today. This Stage's own contribution: once wired, "Host is ready" and
"Scheduler is running" MUST NOT be conflated into one boolean, because
their own reversibility rules already differ (Alpha 544 — Host's
`"ready"` is reached once and only exited by permanent failure/stop;
Scheduler's `#running` is designed to cycle). A future Arc that adds a
SEVENTH `FedosDesktopHostState` token meaning "ready AND delivering"
would create a genuine contradiction the moment `stopDelivery()` (per
the (unmerged) Host Ownership Review's own Option B) needs to move
Host from that token back to plain `"ready"` — a transition
`FedosDesktopHostState`'s own Alpha 333 closed-vocabulary guardrail
does not, and should not, accommodate. This Stage independently
re-derives and CONFIRMS Alpha 544's own recommendation (a separate,
Host-exposed `deliveryStatus().running` signal, never a new
`FedosDesktopHostState` token) is the only contradiction-free design.

## `FedosBoardService` (via `PersistedFedosBoardRepository`, if ever wired) vs. `FedosBoardService` (via default in-memory Repository) — a genuine LATENT contradiction, distinct from Alpha 553's own framing

Alpha 553 already reviewed this pair as a RESPONSIBILITY duplication
(who enforces thread integrity). Viewed as a STATE MACHINE question
instead: `FedosBoardRegistrationResult` (Alpha 307's own seven-token
union: `inserted | already-present | post-id-conflict | source-conflict |
missing-parent | invalid-thread | cross-board-reply`) is a contract
`FedosBoardService.registerPost()` guarantees to enforce — but
`PersistedFedosBoardRepository.register()`'s own THREE-token
`FedosBoardRepositoryWriteResult` (`inserted | already-present | conflict`,
Alpha 302) can never PRODUCE five of those seven tokens at all, by
construction, since it never runs the checks that would detect them.
**If a future Arc ever injects `PersistedFedosBoardRepository` as
`FedosBoardService`'s own `repository` constructor argument** (the
ONLY currently-unwired path that would connect them), `FedosBoardService.registerPost()`
would STILL run its OWN precheck first (per its own code, Alpha 307) —
so the seven-token contract would still hold at the `FedosBoardService`
layer even then. **No contradiction is reachable through that specific
injection path** — this Stage checked the one plausible wiring and
confirms Alpha 307's own precheck-before-write ordering protects it
structurally. The ONLY way a contradiction becomes real is a caller
using `PersistedFedosBoardRepository` DIRECTLY, bypassing
`FedosBoardService` entirely (exactly Alpha 553's own scenario) — which
is a responsibility-duplication finding, not a state-machine one. This
Stage records the distinction for completeness: the two investigations
looked at the SAME pair of classes and found the risk lives at a
different LAYER than either investigation alone would suggest.

## No other contradiction found

`FedosBoardOutboxObservation` kinds and `FedosDeliveryObservation`
states (Alpha 550/482) are already reviewed as VOCABULARY duplication,
not state-machine contradiction — neither has transitions that
conflict with the other since neither currently transitions the OTHER's
own state at all (zero coupling, Alpha 489/542).

## See also

- `docs/secure_runtime_alpha_544_publish_runtime_lifecycle_audit.md`
- `docs/secure_runtime_alpha_553_publish_runtime_responsibility_duplication_investigation.md`
- `docs/secure_runtime_alpha_333_desktop_host_state_model.md`
