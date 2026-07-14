# Secure Runtime Alpha 340 — Desktop Host Foundation Completion

**Status: this Stage is REVIEW ONLY — it makes NO further code change
of any kind. This is Stage 10, the closing Stage, of the Alpha
331–340 Desktop Host Runtime Foundation Arc.**

## 1. Why now

Alpha 331 inventoried the existing repository and found no local
entry point, no `bin`, no CLI, no signal handling, and no disposable
resource on `DesktopApplication`. Alpha 332 adopted Option A — a class
owning its own dependencies and lifecycle. Alpha 333 fixed the state
model. Alpha 334 fixed dependency assembly. Alpha 335 wired Board
hydration into Host startup, fail closed on either hydration or
Desktop-startup failure. Alpha 336 fixed the read-only access boundary,
gated on `state() === "ready"`. Alpha 337 fixed the (currently
lifecycle-only) shutdown contract. Alpha 338 reviewed and deferred a
real executable entry point (Option B). Alpha 339 verified the whole
assembly end to end, by real execution, with injected (never mocked)
dependencies. This Stage issues the Arc's own closing Completion
Declaration.

## 2. The architecture, frozen

```
Local Process Entry Point        NOT YET BUILT (Alpha 338: Option B,
        |                         deferred — testable Host, no
        |                         executable contract yet)
        v
FedosDesktopHost                 (Alpha 334-337, src/desktop/host/)
        |
        +-- DesktopApplication            (Alpha 096-140, UNMODIFIED)
        |
        +-- FedosBoardService             (Alpha 307, UNMODIFIED --
        |                                  hydrated via Alpha 318,
        |                                  UNMODIFIED, during start())
        |
        +-- FedosBoardPersistence         (Alpha 315 port, UNMODIFIED;
        |                                  InMemoryFedosBoardPersistence,
        |                                  Alpha 316, UNMODIFIED default)
        |
        +-- lifecycle state               (FedosDesktopHostState,
                                            Alpha 333: constructed ->
                                            starting -> ready ->
                                            stopping -> stopped, or
                                            starting -> failed)

Host startup (Alpha 335): construct dependencies -> hydrate Board
state -> start DesktopApplication -> Host ready. Fail closed at either
of the first two steps; #boardService assigned in exactly one place,
reached only after both succeed.

Host shutdown (Alpha 337): stop accepting work (state -> stopping) ->
release host-owned resources (none exist yet -- lifecycle closure
only) -> Host stopped. NOT idempotent -- a second stop() throws.
```

Zero new Rust code, zero new Cargo dependency, zero new npm
dependency — `package.json`'s own `dependencies` count stays fixed at
2, unchanged across this whole Arc.

## 3. Completion Declaration

**This Arc's own Objective is CONFIRMED COMPLETE.** The first real
host-runtime boundary capable of owning the existing
`DesktopApplication` and Canonical Board Application for a long-lived
local process now exists, fully test-injectable, with no GUI and no
packaging of any kind:

- **Real Desktop Host ownership boundary** — `FedosDesktopHost`
  (`src/desktop/host/fedos_desktop_host.ts`) owns exactly one
  `DesktopApplication` and one hydrated `FedosBoardService`, nothing
  more (Alpha 332).
- **Explicit lifecycle state** — `FedosDesktopHostState`
  (`src/desktop/host/fedos_desktop_host_state.ts`), a closed six-token
  union, no error payload (Alpha 333).
- **Dependency assembly** — `FedosDesktopHostDependencies` +
  `createFedosDesktopHost()`
  (`src/desktop/host/create_fedos_desktop_host.ts`), construction
  only, both dependencies independently overridable, no global
  singleton (Alpha 334).
- **Board hydration ownership** — `start()` hydrates via the
  UNMODIFIED `hydrateFedosBoardService`, fails closed on any non-
  `"hydrated"` outcome, and never starts `DesktopApplication` on a
  hydration failure (Alpha 335).
- **Desktop startup sequencing** — hydrate, then start
  `DesktopApplication`, in that fixed order; a Desktop-startup failure
  discards the already-hydrated service rather than exposing it
  (Alpha 335).
- **Ready-only application access / ready-only Board access** —
  `desktop()`/`board()` return `null` outside `state() === "ready"`,
  never throwing (Alpha 336).
- **Explicit shutdown semantics** — `stop()`, `"ready"`-only,
  non-idempotent, lifecycle-closure-only pending a future durable
  backend (Alpha 337).
- **Testable local-process host foundation** — every behavior above
  verified by real execution with injected dependencies, zero mocks of
  `DesktopApplication` or `FedosBoardService` themselves (Alpha 339).
- **No speculative GUI or packaging** — confirmed absent by direct
  inspection (Alpha 338, Alpha 339 §"boundaries").

## 4. Still out of scope (verbatim from this Arc's own instruction,
confirmed by direct inspection)

- Executable main, CLI, `package.json` `bin` — Alpha 338 reviewed and
  explicitly deferred (Option B); `package.json` carries zero diff
  from this Arc.
- Electron, Tauri, browser shell, GUI, system tray, OS integration —
  no reference anywhere in `src/desktop/host/`.
- SQLite, IndexedDB, filesystem persistence, D1 Board persistence —
  `boardPersistence` defaults to the SAME `InMemoryFedosBoardPersistence`
  Alpha 316 already shipped; Alpha 329's Option E deferral is
  completely unmodified by this Arc.
- Relay Pool, automatic sync — no reference anywhere in this Arc's own
  code.
- Signal handling, installer, code signing, auto-update — explicitly
  named Absolute Prohibitions of this Arc; none implemented.
- Ontology integration — `p2p/` remains completely untouched, not
  staged, not imported, not used as persistence or lifecycle
  management, confirmed by `git status`, not merely by absence of
  import.

## 5. Next Arc recommendation

**Board Durable Backend Selection Re-evaluation Arc.**

Reason: Alpha 329 deferred every durable backend candidate because
Board persistence had no real host CALLER in any production runtime —
"every backend-committing candidate fails the 'real runtime can call
it' constraint at the Board-integration level" (Alpha 329 §2). This
Arc removes exactly that blocker: `FedosDesktopHost` is a real,
Node-executable, fully test-injectable local-process host boundary
that already owns Board hydration and startup sequencing end to end
(Alpha 339). The next Arc must re-evaluate Alpha 329 now that this
real local Host caller exists — since the Host is genuinely
Node-capable (confirmed unchanged by Alpha 331 §3.8: Node APIs are
reachable without a new dependency), it may select between SQLite and
an append-only file, per Alpha 323/326's own reviews, now that "no real
Desktop host process exists" (their shared original blocker) no longer
holds. IndexedDB remains unavailable without a browser/webview host
(Alpha 324, still unmet — this Arc adds no browser or webview of any
kind). D1 remains a hosted Worker backend rather than the local Host
backend (Alpha 325's own finding — Board still has zero wiring into
`src/worker.ts`, confirmed unchanged by this Arc's own regression
tests).

**Ontology integration is explicitly NOT the next recommended Arc** —
this Stage names Board Durable Backend Selection Re-evaluation instead,
per this Arc's own instruction. The Board Ontology Projection Adapter
named in this Arc's own P2P Ontology Engine Boundary diagram remains
downstream of a durable, LOCAL, user-owned Board state — which still
does not exist after this Arc, only its HOST does.

## 6. What this Stage does NOT do

- Does **not** modify `fedos_desktop_host.ts`,
  `fedos_desktop_host_state.ts`, or `create_fedos_desktop_host.ts` —
  no further production code change of any kind.
- Does **not** select or implement a durable backend, a real executable
  entry point, an Ontology projection, or a GUI.
- Does **not** modify `packages/fedos-core-rust/src/lib.rs`,
  `Cargo.toml`, `src/runtime/*`, `src/desktop/desktop_application.ts`,
  `src/desktop/create_desktop_application.ts`, `src/identity/*`,
  `src/worker.ts`, any of the four Board Adapters,
  `src/board/repository/*`, `src/board/persistence/*`, Secure Runtime
  Storage, Observation, Relay transport, Nostr validation, or `p2p/`.

## 7. See also

- `docs/secure_runtime_alpha_339_desktop_host_integration_verification.md`
- `docs/secure_runtime_alpha_338_local_process_entrypoint_review.md`
- `docs/secure_runtime_alpha_337_desktop_host_shutdown_contract.md`
- `docs/secure_runtime_alpha_336_desktop_host_access_boundary.md`
- `docs/secure_runtime_alpha_335_board_hydration_ownership.md`
- `docs/secure_runtime_alpha_334_desktop_host_dependency_assembly.md`
- `docs/secure_runtime_alpha_333_desktop_host_state_model.md`
- `docs/secure_runtime_alpha_332_desktop_host_responsibility_decision.md`
- `docs/secure_runtime_alpha_331_existing_desktop_host_inventory.md`
- `docs/secure_runtime_alpha_330_durable_backend_selection_completion.md`
