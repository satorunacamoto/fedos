# Secure Runtime Alpha 338 — Local Process Entry-Point Review

**Status: this Stage is REVIEW ONLY — it makes NO code change of any
kind.** Stage 8 of the Alpha 331–340 Desktop Host Runtime Foundation
Arc.

## 1. Why now

Alpha 333–337 built a real, fully test-injectable `FedosDesktopHost`.
Before this Arc closes, this Stage reviews whether it should ALSO add
an executable Node entry point that constructs and starts a Host as a
real, double-clickable (or `node`-invokable) process.

## 2. Candidates compared

- **Option A — add a real `src/desktop/main.ts` that starts the
  Host.** Would require deciding, right now, un-reviewed: how
  configuration reaches it (env vars? a config file? Runtime Mode
  Authority?), what happens on an unhandled rejection from `start()`,
  whether it stays running indefinitely (an event loop keep-alive) or
  exits after `start()` resolves, and whether/how it responds to
  `SIGINT`/`SIGTERM` — every one of which Alpha 331 §3.4/§3.12
  confirmed is currently UNRESOLVED, and every one of which this Arc's
  own Absolute Prohibitions explicitly forbid touching (no signal
  handlers, no `process.exit()`, no `package.json` `bin` without
  stopping for review).
- **Option B — add a testable host only; defer executable entry
  point.** `FedosDesktopHost`/`createFedosDesktopHost` are already
  fully constructible and startable from `test/*.test.ts` (Alpha 339
  proves this end to end) without ANY of Option A's unresolved
  decisions needing an answer yet.
- **Option C — add `package.json` `bin` and a CLI.** Rejected outright
  by this Arc's own Absolute Prohibitions ("package.json bin addition
  without stopping for review") and by Alpha 331 §3.2/§3.3 (no `bin`,
  no CLI, no `process.argv` parsing exists anywhere today) — adopting
  this would be a much larger, separately-scoped decision than a
  Runtime Foundation Arc should make silently.
- **Option D — reuse `src/index.ts`.** Rejected: Alpha 331 §3.9
  already found `src/index.ts` is a pure library barrel with a fixed,
  large public export surface, never a process entry point — folding
  Host-startup logic into it would conflate two concerns this
  repository has always kept structurally separate (`src/worker.ts` is
  its own, separate Worker entry point, never merged into the barrel
  either).

## 3. Decision

**Option B, adopted.** Inventory (Alpha 331) found no real executable
contract and no packaging pipeline anywhere in this repository — there
is no `bin`, no CLI, no signal handling, and no configuration-loading
convention for a Desktop process to inherit. A Host boundary can be
real and fully usable in tests without pretending packaging, signal
handling, configuration sourcing, or UI decisions are already
resolved.

## 4. What this Stage does NOT do, per Option B

- No `package.json` change of any kind — `"bin"`, `"scripts"`, and
  `"dependencies"`/`"devDependencies"` are all byte-for-byte unchanged
  from Alpha 330's own frozen count.
- No process signal handling anywhere in this repository — unchanged.
- No automatic Host start from anywhere — every `FedosDesktopHost`
  instance across this Arc's own test suite is started explicitly, by
  an explicit `await host.start()` call the test itself makes.

## 5. Requirements a future entry-point Stage would need to resolve first

Before Option A could be adopted, a future, separately-scoped Stage
would need to fix, at minimum:

1. **Configuration sourcing** — how the future entry point decides
   which `FedosBoardPersistence` backend to construct (this Arc leaves
   that decision to Alpha 329's Option E: none selected yet), and
   whether any environment variable is read, and by which single
   Authority (per the Runtime Mode Authority precedent,
   `src/runtime/fedos_runtime_mode_authority.ts`).
2. **Process lifetime** — whether the process exits once `start()`
   resolves (unlikely useful for a long-lived Host) or stays alive
   indefinitely, and by what mechanism (an explicit keep-alive vs. a
   pending listener of some kind, none of which exists yet).
3. **Signal handling** — whether/how `SIGINT`/`SIGTERM` map to
   `host.stop()`, and what happens to an in-flight `start()` if a
   signal arrives mid-startup — deliberately unresolved by this Arc,
   per its own Absolute Prohibitions.
4. **Failure reporting** — how a `"failed"` Host state (Alpha 333)
   surfaces to whatever process or user launched the entry point,
   given that no logging/Observation authority exists yet in this
   Host's own scope (Observation changes are an Absolute Prohibition
   of this Arc).
5. **Packaging** — installer, code signing, auto-update: all
   explicitly out of scope per this Arc's own Objective, and
   unaddressed by this Stage.

## 6. Conclusion

This Arc adds a testable Host boundary and stops there. `package.json`
is unchanged; no signal handler, no automatic start, and no executable
entry point exists anywhere in this repository as of this Arc's own
completion (Alpha 340).

## 7. See also

- `docs/secure_runtime_alpha_331_existing_desktop_host_inventory.md`
- `docs/secure_runtime_alpha_337_desktop_host_shutdown_contract.md`
