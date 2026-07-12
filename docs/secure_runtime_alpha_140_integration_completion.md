# Secure Runtime Alpha 140 — Integration Completion

**Status: this Stage is REVIEW / DESIGN ONLY. It makes NO code change
of any kind — no `src/` file is modified. This is Stage 5, the closing
Stage, of the Alpha 136–140 Desktop Startup Identity Sequence Arc.**

## 1. Why now

Alpha 136 wired `bootstrap() → refreshPublicIdentity()` into `start()`.
Alpha 137 confirmed the ordering guarantee. Alpha 138 verified the
resulting state, by real execution. Alpha 139 confirmed `start()`
touches only Runtime Identity and Reader, never Provider, Registry,
Storage, Worker, or Observation directly. This Stage issues the Arc's
own closing Completion Declaration, formally fixing the Desktop
Startup Flow as a named sequence.

## 2. The Desktop Startup Flow, confirmed complete

```
construct
    ↓   (new DesktopApplication(...) — Alpha 096: synchronous only,
    ↓    no async work, #started = false, #currentPublicIdentity = null)
bootstrap
    ↓   (start()'s own first await — Alpha 097/098/136: drives
    ↓    #identity.bootstrapIdentity() to completion)
refreshPublicIdentity
    ↓   (start()'s own second await — Alpha 136: drives
    ↓    readPublicIdentity() → #reader.readPublicIdentity(), persists
    ↓    into #currentPublicIdentity on success — Alpha 137's own
    ↓    ordering guarantee: only reached if bootstrap succeeded)
Desktop Ready
    (this.#started = true — Alpha 098/136: set only after BOTH
     prior steps resolve without throwing)
```

This is `start()`'s own literal, current body, read top to bottom —
the Startup Flow is not a new abstraction layered on top of `start()`;
it IS `start()`, named.

## 3. Completion Declaration

**The Desktop Startup Flow — `construct → bootstrap →
refreshPublicIdentity → Desktop Ready` — is now formally fixed. Desktop
Ready is reached if and only if `bootstrap()` and `refreshPublicIdentity()`
have BOTH resolved without throwing, in that order (Alpha 137).
`currentIdentity()` and `currentPublicIdentity()` are the intended
STEADY-STATE readers for code that runs AFTER Desktop Ready — this is
a USAGE convention, not a new runtime enforcement: both methods remain
callable at any time (Alpha 116/128 already guarantee synchronous,
non-throwing reads), and BEFORE Desktop Ready they simply return their
own pre-Bootstrap/pre-Refresh defaults (`null`), exactly as they
already did. This Stage does not add a guard preventing early calls —
it names, and formally recommends, the sequencing callers should
already have inferred from `start()`'s own existing contract.**

This reconfirms, rather than revises, every prior Completion
Declaration in this lineage — Alpha 111 (`FedosRuntimeIdentity` is the
sole Identity Authority), Alpha 120 (Desktop consumes, never becomes,
the Authority), Alpha 125 (the Dual Identity Path), Alpha 130 (the
three-layer structure), Alpha 135 (the four-layer structure). This
Stage adds a fifth concept — the Startup Flow ORDER — without altering
any of the four layers' own boundaries.

## 4. What this Stage does NOT do

- Does **not** modify `desktop_application.ts` or any other `src/`
  file.
- Does **not** add, remove, or rename any public method.
- Does **not** add any runtime guard preventing `currentIdentity()`/
  `currentPublicIdentity()` from being called before Desktop Ready —
  both remain unconditionally callable, exactly as before this Arc.
- Does **not** revise or weaken any prior Completion Declaration
  (Alpha 111/120/125/130/135) — it reconfirms them and adds the
  Startup Flow ORDER on top.
- Does **not** modify `src/runtime/fedos_runtime_identity.ts`,
  `create_runtime.ts`, `types.ts`, `src/worker.ts`, `src/identity/*`,
  Storage, Observation, Rust, `Cargo.toml`, or `package.json`.
- Does **not** implement Relay communication, Nostr communication,
  signing, secret-key handling, or GUI of any kind.

## 5. See also

- `docs/secure_runtime_alpha_092_bootstrap_sequence_review.md`
- `docs/secure_runtime_alpha_135_integration_completion.md`
- `docs/secure_runtime_alpha_138_startup_state_verification.md`
- `docs/secure_runtime_alpha_139_desktop_startup_boundary.md`
