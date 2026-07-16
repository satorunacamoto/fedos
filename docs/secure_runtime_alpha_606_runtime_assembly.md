# Secure Runtime Alpha 606 — Runtime Assembly

Stage 6 of the Alpha 601–620 Desktop Local Runtime Entry Point &
Publish Pipeline Ownership Arc.

## What was implemented

`src/desktop/runtime/fedos_desktop_runtime.ts` — `startFedosDesktopRuntime(config)`,
the FIRST real production caller of `createFedosDesktopHost` this
repository has (Alpha 601's own inventory: none existed). Assembles
Board (Alpha 607)/Outbox (Alpha 608)/Observation (Alpha 609)
Persistence from caller-supplied paths, constructs one `FedosDesktopHost`,
calls `start()`, optionally `startDelivery()` (Alpha 611), and returns
`FedosRunningDesktopRuntime { host, stop() }` — no lower-level
Persistence/Scheduler object is ever returned (verified structurally,
`test/secure_runtime_alpha_606_...test.ts` §5).

## No module-level mutable state

Every call constructs entirely fresh Persistence/Host instances — two
calls, even over the SAME paths, produce two independent `FedosDesktopHost`
objects (`test/secure_runtime_alpha_618_...test.ts`'s own "no shared
singleton" case). This mirrors `createFedosDesktopHost()`'s own
established discipline (Alpha 334) exactly — this file assembles, it
introduces no new construction pattern.

## Directory creation, assigned here (Alpha 604)

`ensureParentDirectoryExists()` (`mkdirSync(dirname(path), {recursive:
true})`) runs for every configured log path BEFORE any Persistence
backend is constructed — the ONE piece of filesystem-adjacent
responsibility this Arc assigns to the assembly layer rather than the
unmodified `AppendOnlyFedos*Persistence` classes themselves.

## Verified, by real execution, in `test/secure_runtime_alpha_606_runtime_assembly.test.ts`

A submitted post durably survives a fresh runtime instance over the
same board log path; an EXPLICIT outbox target produces a real,
durable Outbox log entry; a post submitted WITHOUT any target writes
NOTHING to the Outbox log (confirms no automatic target inference); a
corrupt board log rejects `startFedosDesktopRuntime()`'s own returned
`Promise` — no partial handle is ever returned.

## See also

- `docs/secure_runtime_alpha_601_current_runtime_caller_inventory.md`
- `docs/secure_runtime_alpha_607_board_persistence_wiring.md`
- `docs/secure_runtime_alpha_608_outbox_persistence_wiring.md`
