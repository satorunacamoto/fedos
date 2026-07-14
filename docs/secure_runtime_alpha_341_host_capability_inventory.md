# Secure Runtime Alpha 341 — Host Capability Inventory

**Status: this Stage is REVIEW ONLY — it makes NO code change of any
kind.** This is Stage 1, the opening Stage, of the Alpha 341–350 Board
Durable Backend Re-evaluation & Local Backend Selection Arc, following
exactly the pattern every prior Arc's own opening Stage already used
(Alpha 251, 261, 271, 281, 291, 301, 311, 321, 331).

## 1. Why now

Alpha 329 deferred every durable backend candidate (Option E) because
Board persistence had no real host CALLER in any production runtime.
Alpha 340 recommended exactly this Arc next, on the strength of one
finding: `FedosDesktopHost` now exists as a real, Node-executable,
fully test-injectable local-process ownership boundary. Before
comparing SQLite/append-only/etc. again, this Stage re-confirms — by
direct inspection of the ACTUAL `FedosDesktopHost` implementation
(`src/desktop/host/fedos_desktop_host.ts`, Alpha 334–337), not by
recollection of the prior Arc's own summary — exactly what that Host
can and cannot do.

## 2. Findings, observed directly from the actual source

### 2.1 Lifecycle

`FedosDesktopHostState` (`src/desktop/host/fedos_desktop_host_state.ts`)
is a real, six-token closed union with five enforced transitions,
implemented entirely inside `FedosDesktopHost` itself. `start()`
guards against a second call from any state; `stop()` is valid only
from `"ready"`. This is a REAL lifecycle, not a sketch — every
transition is exercised by `test/secure_runtime_alpha_339_desktop_host_integration_verification.test.ts`.

### 2.2 Ownership

`FedosDesktopHost` holds exactly two constructor-injected dependencies
— one `DesktopApplication` and one `FedosBoardPersistence` — plus one
internally-produced `FedosBoardService` (assigned only after a
successful `start()`). No other object, no global singleton, no
module-level mutable state exists anywhere in `src/desktop/host/`.

### 2.3 Persistence caller

`FedosDesktopHost.start()` is the FIRST real, non-test caller of
`hydrateFedosBoardService` (`src/board/persistence/fedos_board_hydration.ts`,
Alpha 318) anywhere in this repository — confirmed by Alpha 331 §3.7's
own finding (no caller outside `test/*.test.ts` before this Arc) now
being superseded by this real one. `boardPersistence` is held as a
private, typed `FedosBoardPersistence` field
(`src/desktop/host/fedos_desktop_host.ts`), reached ONLY through that
port's own three synchronous methods (`putPost`/`getPost`/`listPosts`)
— never through any backend-specific vocabulary.

### 2.4 Hydration

`start()` calls `hydrateFedosBoardService(this.#boardPersistence)`
synchronously (no `await` on the hydration call itself — only on
`DesktopApplication.start()` afterward) and fails closed on any
non-`"hydrated"` outcome, never starting `DesktopApplication` and never
exposing a partial `FedosBoardService`. This is UNCHANGED from Alpha
335 — this Stage adds no new hydration logic.

### 2.5 Startup

Fixed order: hydrate, then `DesktopApplication.start()`, then
`state → "ready"`. Confirmed unchanged by direct inspection.

### 2.6 Shutdown

`stop()` performs lifecycle-state closure only — it calls no method on
`#desktopApplication` or `#boardPersistence`, because neither exposes
a close/dispose method today (Alpha 337 §2, re-confirmed unchanged).

## 3. Can the Host own a local durable backend?

**Yes, structurally — the Host already owns a `FedosBoardPersistence`
value by construction, and that interface is the ONLY shape any
backend, durable or not, must satisfy.** Concretely:

- The Host is genuinely Node-executable (Alpha 331 §3.8, re-confirmed
  unchanged: `vitest.config.ts` runs under `environment: "node"`, and
  Node APIs remain reachable without a new dependency).
- `FedosDesktopHostDependencies.boardPersistence` accepts ANY
  `FedosBoardPersistence` implementation — `InMemoryFedosBoardPersistence`
  today, but the type itself carries no in-memory-specific constraint.
- `start()`'s own hydration/startup sequencing does not inspect,
  branch on, or depend on WHICH `FedosBoardPersistence` implementation
  it was given — it calls the port's own three methods exactly as
  specified (Alpha 315), nothing more.
- `stop()`'s own current no-op-beyond-lifecycle-state behavior is
  explicitly documented (Alpha 337 §6) as a placeholder pending a real
  backend's own close/dispose responsibility — the SHAPE for that
  extension already exists, even though nothing fills it yet.

**What is NOT yet true, and stays out of this Arc's own scope:**
no concrete durable backend exists; no filesystem path is chosen; no
Host configuration mechanism (Alpha 338 §5) resolves which backend to
construct; `createFedosDesktopHost()`'s own default remains
`InMemoryFedosBoardPersistence` (Alpha 334, unmodified by this Arc).

## 4. Conclusion

`FedosDesktopHost` is a real, structurally-durable-backend-capable
ownership boundary today — not a sketch, not a stub. Every property
Alpha 331 found MISSING before the Host existed (a real Node-capable
process caller for Board persistence) is now present, confirmed by
direct inspection of the unmodified Alpha 334–337 implementation. This
finding is the entire premise for re-opening backend selection in this
Arc.

## 5. See also

- `docs/secure_runtime_alpha_340_desktop_host_foundation_completion.md`
- `docs/secure_runtime_alpha_334_desktop_host_dependency_assembly.md`
- `docs/secure_runtime_alpha_335_board_hydration_ownership.md`
- `docs/secure_runtime_alpha_331_existing_desktop_host_inventory.md`
