# 05 — Ownership API

## Options compared

**A. Host directly exposes Publisher/Scheduler.** e.g.
`host.scheduler(): FedosPublishScheduler | null`,
`host.publisher(protocol): FedosBoardOutboxPublisher | null`. Mirrors
`desktop()`/`board()`/`query()`'s own existing "return the owned
instance directly" pattern (Alpha 336/384/385's own precedent, whose
own design doc explicitly justifies this because none of those three
returned types exposes a mutating/dangerous method beyond its own
narrow, already-reviewed surface).

REJECTED for Scheduler/Publisher specifically: unlike
`DesktopApplication`/`FedosBoardQuery`/`FedosBoardReader`,
`FedosPublishScheduler` exposes `start()`/`stop()` — a SECOND,
independent lifecycle a caller could drive out of step with the Host's
own (e.g. calling `host.scheduler()!.stop()` directly, leaving Host's
own `state()` at `"ready"` while delivery is silently halted, with no
Host-visible signal). This is exactly the "two lifecycles the caller
can desync" risk `FedosDesktopHostState`'s own Alpha 333 design
explicitly guards against for Host itself ("forbidden, permanently:
starting `start()` a second time... restarting a stopped instance").
Exposing Scheduler's raw lifecycle methods would reintroduce that same
class of risk one layer down.

**B. Host exposes only a publish-lifecycle FACADE** — `startDelivery()`/
`stopDelivery()`/`deliveryStatus()` — never the raw Scheduler/Publisher
instances.

**C. Fully internal ownership, status-only.** Host exposes NOTHING
callable about delivery — only a read-only status/diagnostic snapshot
(e.g. `deliveryStatus(): { running: boolean, pendingCount: number, ... }`),
with delivery start/stop happening automatically and un-controllably
from outside Host.

REJECTED: contradicts Alpha 02's own "explicit start, not auto-start"
recommendation directly — a future caller wanting to pause delivery
independently has no way to do so without stopping the entire Host.
Too coarse for a subsystem Alpha 04 already
established has its OWN, narrower failure/degradation surface — a
facade that cannot be independently paused cannot express "delivery is
degraded but Board is fine" as an ACTIONABLE state, only an
observable one.

**D. A separate `FedosOutboundDeliveryHost` class**, owned BY
`FedosDesktopHost` internally (Host holds ONE instance, does not expose
its type) or as a peer object a caller wires up independently.

Considered seriously — it would isolate delivery's own six inputs
(Outbox Persistence, Publisher registry, Scheduler, Observation
Repository, retry policy [not owned, § Alpha 01], clock/timer
[pass-through, § Alpha 01]) behind one cohesive class rather than
growing `FedosDesktopHost` itself by four more private fields and
several more methods. REJECTED as the PRIMARY recommendation, not
because it is wrong, but because it duplicates work Option B already
does at lower cost: Option D's own internal implementation would BE
essentially Option B's facade, just given a class name and instantiated
separately — the review finds no behavior Option D enables that Option
B's own method surface cannot express directly on `FedosDesktopHost`.
Named instead as a REFACTOR Option D could become LATER, if
`FedosDesktopHost` itself grows uncomfortably large — not a decision
this review needs to force now.

## Recommendation: **B — Host exposes a publish-lifecycle facade only**

Concrete shape (design only, not implemented by this review):

```ts
// On FedosDesktopHost, additive to its existing public surface:
startDelivery(): void;            // throws if state() !== "ready", or if already started
stopDelivery(): Promise<void>;    // per Alpha 03's shutdown ordering; no-op-safe like scheduler.stop()
deliveryStatus(): FedosDesktopHostDeliveryStatus | null;  // null unless state() === "ready"

interface FedosDesktopHostDeliveryStatus {
  readonly running: boolean;
  readonly registeredProtocols: readonly FedosBoardOutboundProtocol[];
  // Per Alpha 04: a delivery-scoped degradation signal, NEVER surfaced through
  // FedosDesktopHostState itself.
  readonly lastTickFailed: boolean;
}
```

`startDelivery()`/`stopDelivery()` are Host's OWN lifecycle methods —
NOT re-exposed Scheduler methods — so Host retains full authority over
when the Scheduler's own `start()`/`stop()` are actually called,
closing the two-independent-lifecycles risk Option A carries. No raw
`FedosPublishScheduler`, `FedosBoardOutboxPublisher`, or
`FedosDeliveryObservationRepository` reference is ever returned to a
caller — matching `submitPost()`'s own existing "the Host is the
boundary, not a passthrough" precedent.

## See also

- `docs/publish_pipeline_host_ownership_review_01_ownership_matrix.md`
- `docs/publish_pipeline_host_ownership_review_04_failure_isolation.md`
- `docs/secure_runtime_alpha_336_desktop_host_access_boundary.md`
