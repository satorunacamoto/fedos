# Secure Runtime Alpha 671 — Running Runtime Ownership Decision

Stage 1 of Phase D. Compares:

- **A.** `FedosRunningDesktopRuntime` exposes `boardRuntime()` —
  **ADOPTED**.
- **B.** caller constructs `FedosBoardRuntime` from `runtime.host` —
  rejected; every caller would duplicate construction, and nothing
  would prevent a caller from constructing a SECOND, independent
  `FedosBoardRuntime` over the same Host by mistake.
- **C.** `startFedosDesktopRuntime` returns both `host` and
  `boardRuntime` as sibling PLAIN fields — rejected; a method (Option
  A) is what lets `boardRuntime()` fail closed after `stop()` (Alpha
  678) — a plain field cannot un-expose itself.

`startFedosDesktopRuntime()` (`src/desktop/runtime/fedos_desktop_runtime.ts`)
now returns a `FedosRunningDesktopRuntime` exposing `host` and
`boardRuntime()` only — no low-level Persistence, Scheduler, Publisher,
Reader, or Query object of any kind, unchanged from Alpha 606's own
original guarantee.
