# Secure Runtime Alpha 335 — Board Hydration Ownership

**Status: this Stage implements code.** Stage 5 of the Alpha 331–340
Desktop Host Runtime Foundation Arc. Adds `start()` to
`FedosDesktopHost` (`src/desktop/host/fedos_desktop_host.ts`), wiring
Board hydration into Host startup.

## 1. Why now

Alpha 334 fixed how a `FedosDesktopHost` receives its two dependencies.
This Stage wires the first real caller of `hydrateFedosBoardService`
(Alpha 318) into a production code path — until now, Alpha 331 §3.7
confirmed hydration had no caller outside `test/*.test.ts`.

## 2. Required startup order, implemented exactly

```
1. state → "starting"
2. hydrate BoardService from FedosBoardPersistence
3. if hydration fails:
     state → "failed"
     do not start DesktopApplication
     fail closed (start() rejects)
4. start DesktopApplication
5. if Desktop startup fails:
     state → "failed"
     do not expose a ready BoardService
6. state → "ready"
```

`start()`'s own body implements this literally, in this order,
guarded by an initial `if (this.#state !== "constructed") throw`
before step 1 ever runs (a repeat `start()` call, per Alpha 333, is
forbidden from any state).

## 3. Hydration failure: fail closed, no fallback

`hydrateFedosBoardService(this.#boardPersistence)` is called
UNCHANGED — this Stage reuses Alpha 318's own bounded, deterministic,
fail-closed implementation without modification. Its own
`FedosBoardHydrationOutcome` union has exactly one success value,
`"hydrated"`, and two rejection values,
`"rejected-corrupt-record"`/`"rejected-unresolvable-thread-integrity"`
— `start()` treats anything other than `"hydrated"` (with a non-`null`
`service`) identically: `state → "failed"`, and `start()` itself
REJECTS with an `Error` naming the outcome. `DesktopApplication.start()`
is never reached on this path — no partial startup, no empty-Board
fallback of any kind, matching Alpha 318's own "no partial service
returned on corruption" guarantee one layer up.

## 4. Desktop startup failure: the hydrated service is discarded, not exposed

If hydration DOES succeed, `start()` holds the resulting
`FedosBoardService` in a local variable — NOT yet in `#boardService`
— and only THEN calls `await this.#desktopApplication.start()`. If
that call rejects, `state → "failed"` and the SAME rejection
propagates from `FedosDesktopHost.start()`; the local, already-hydrated
service is simply discarded (never assigned to `#boardService`, which
stays `null`). This is deliberate, not incidental: assigning
`#boardService` in only ONE place — `start()`'s own final two
statements, reached only after BOTH steps succeed — makes "expose a
ready BoardService after a Desktop startup failure" a structural
impossibility, not a runtime check.

## 5. Ownership, confirmed

- The Host holds the hydrated `FedosBoardService` — no other object in
  this Arc's own code ever receives a reference to it.
- Callers reach it ONLY via `board()` (Alpha 336), which itself returns
  `null` unless `state() === "ready"`.
- No partially-hydrated service is ever exposed (§4).
- No background hydration — `start()` is a single `async` call chain,
  awaited synchronously by its own caller; there is no `setTimeout`,
  `setInterval`, or fire-and-forget `Promise` anywhere in this file.
- No race between Board access and hydration — `board()` cannot return
  a non-`null` value before `start()`'s own final assignment runs,
  because that assignment is the ONLY writer of `#boardService` and it
  runs strictly before the `state → "ready"` assignment `board()`
  gates on.
- No network recovery, no ontology inference, no silent fallback to an
  empty Board on corrupt persistence — `hydrateFedosBoardService`
  itself already guarantees this (Alpha 318 §"HARD GUARDRAILS"), and
  this Stage adds no code that could weaken it.

## 6. Conclusion

Board hydration now has its first real production caller:
`FedosDesktopHost.start()`, in the exact order the Objective names,
reusing Alpha 318's own unmodified fail-closed hydration and exposing
the result only after a full, successful startup sequence.

## 7. See also

- `docs/secure_runtime_alpha_334_desktop_host_dependency_assembly.md`
- `docs/secure_runtime_alpha_318_board_hydration_index_rebuild.md`
- `docs/secure_runtime_alpha_136_startup_sequence.md`
