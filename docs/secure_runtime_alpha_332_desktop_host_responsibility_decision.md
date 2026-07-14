# Secure Runtime Alpha 332 — Desktop Host Responsibility Decision

**Status: this Stage is REVIEW ONLY — it makes NO code change of any
kind.** Stage 2 of the Alpha 331–340 Desktop Host Runtime Foundation
Arc. This Stage issues the Arc's own shape Decision, implemented by
Alpha 333–337.

## 1. Why now

Alpha 331 confirmed no local-process entry point, no `bin`, no CLI, no
signal handling, and no disposable resource on `DesktopApplication`
exist today. Before any code is written, this Stage fixes exactly what
a `FedosDesktopHost` owns, what it must never own, and which
structural shape (class vs. free functions vs. an extended
`DesktopApplication` vs. reusing an existing entry point) it takes.

## 2. What the Host owns

- Exactly one `DesktopApplication` instance (Alpha 096–140,
  UNMODIFIED).
- Exactly one Board persistence instance (`FedosBoardPersistence`,
  Alpha 315 — the port, not a concrete backend choice; this Arc
  defaults to `InMemoryFedosBoardPersistence`, Alpha 316, per Alpha
  329's own still-standing Option E deferral).
- Exactly one hydrated `FedosBoardService`, produced by
  `hydrateFedosBoardService` (Alpha 318, UNMODIFIED) during `start()`.
- Its own startup state and shutdown state (Alpha 333).
- An explicit `start()` and an explicit `stop()`.

## 3. What the Host must NOT own

Master Seed bytes, Protocol Secret Keys, Relay Pool, GUI state, Worker
state, Ontology state, database-specific details (SQL/KV/filesystem
vocabulary of any kind), protocol-native events, or global process
singleton state. None of these has ANY reference anywhere in this
Arc's own code — confirmed directly by the structural regression tests
this Arc ships (Alpha 339 §"boundaries").

## 4. Candidates compared

- **Option A — a class that owns dependencies and lifecycle.** A
  single `FedosDesktopHost` class, constructed with explicit
  dependencies, exposing `state()`/`start()`/`stop()`/`desktop()`/
  `board()`. Matches this repository's own established shape for every
  prior stateful boundary: `DesktopApplication` itself,
  `FedosRuntimeIdentity`, `FedosBoardService`.
- **Option B — a set of free startup/shutdown functions.** Rejected:
  free functions have no natural place to hold `#state`/
  `#boardService` between calls without a module-level singleton —
  which Alpha 334's own guardrails explicitly forbid ("no global
  singleton state," "independent instances never share state," a
  requirement Alpha 339 §"lifecycle" tests directly). A class is the
  only shape that gives every Host instance its OWN private state by
  construction.
- **Option C — extend `DesktopApplication` into the full host.**
  Rejected: `DesktopApplication`'s own Alpha 096 doc comment fixes it
  as "a thin, internal-only holder of exactly ONE
  `FedosRuntimeIdentity` instance" — folding Board ownership and
  process lifecycle into it would violate that Stage's own frozen
  scope and couple two concerns (Identity bootstrap, Board hydration)
  that have never been coupled anywhere in this repository.
- **Option D — use `createRuntime()` as the Desktop Host.**
  Rejected: `createRuntime()` (`src/runtime/create_runtime.ts`, Alpha
  051) constructs an `AppRuntime` for the WORKER's own per-request
  `fetch` handler — a fundamentally different lifecycle (one
  short-lived object per HTTP request) from a long-lived local Host
  process. Alpha 321 §3.2 already found Node has no persistent
  server process of its own; conflating the two would misrepresent
  Node's own actual role as a test/dev harness.
- **Option E — use Worker startup as the host.** Rejected outright:
  the Worker is a V8 isolate with no filesystem and no long-running
  local process concept at all (Alpha 321 §3.10) — it cannot be a
  DESKTOP host by definition, and Board has zero wiring into
  `src/worker.ts` today (Alpha 321 §3.4, still true, confirmed
  unchanged by this Arc's own regression tests).

## 5. Decision

**Option A, adopted exactly as named:** `FedosDesktopHost` is a class
that owns its two dependencies and its own lifecycle state, matching
this repository's own established shape for every prior stateful
boundary. It is implemented at
`src/desktop/host/fedos_desktop_host.ts` (Alpha 334/335/336/337), with
its state vocabulary at `src/desktop/host/fedos_desktop_host_state.ts`
(Alpha 333) and its dependency-assembly factory at
`src/desktop/host/create_fedos_desktop_host.ts` (Alpha 334).

## 6. Conclusion

The Host owns exactly two dependencies and its own lifecycle state,
nothing more — every secret-bearing, GUI-bearing, network-bearing, or
database-specific concern stays permanently out of scope, matching
this Arc's own Absolute Prohibitions. A class (Option A) is the only
candidate that gives every Host instance independent, private state by
construction, without a global singleton and without folding two
already-separately-scoped concerns (`DesktopApplication`,
`createRuntime()`) into one.

## 7. See also

- `docs/secure_runtime_alpha_331_existing_desktop_host_inventory.md`
- `docs/secure_runtime_alpha_096_desktop_shell_skeleton.md`
- `docs/secure_runtime_alpha_062_identity_bootstrap_reset_review.md`
