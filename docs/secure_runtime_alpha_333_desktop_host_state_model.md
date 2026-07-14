# Secure Runtime Alpha 333 — Desktop Host State Model

**Status: this Stage implements code.** Stage 3 of the Alpha 331–340
Desktop Host Runtime Foundation Arc. Adds
`src/desktop/host/fedos_desktop_host_state.ts`, exporting
`FedosDesktopHostState`.

## 1. Why now

Alpha 332 adopted a class (Option A) that owns its own lifecycle
state. Before that class exists, this Stage fixes the exact
vocabulary that state is drawn from, and the transitions between its
values — a single closed string-literal union, matching this
repository's own existing convention for closed-vocabulary outcomes
(`FedosBoardRegistrationResult`, Alpha 307;
`FedosBoardPersistenceWriteResult`, Alpha 315).

## 2. The type

```ts
export type FedosDesktopHostState =
  | "constructed"
  | "starting"
  | "ready"
  | "stopping"
  | "stopped"
  | "failed";
```

## 3. Should `"failed"` retain an error object?

**No.** Reviewed and rejected: a `{ state: "failed"; error: unknown }`
shape (or a second `lastError()` accessor) would let an arbitrary
exception leak through the STATE boundary, which this Stage's own
Objective ("prefer coarse state without leaking arbitrary exceptions
through state") explicitly warns against. Instead,
`FedosDesktopHost.start()` (Alpha 335) itself REJECTS with the real
`Error` on hydration or Desktop-startup failure — the caller who
triggered the failing `start()` call already holds the real cause, on
the rejected `Promise`, at the exact moment it is most useful. A LATER
caller who only calls `state()` — with no access to that original
rejection — gets the same coarse answer regardless of which internal
step failed, mirroring `FedosRuntimeIdentity.isBootstrapped()`'s own
Alpha 060 Fail-Closed design: "bootstrap not yet attempted" and
"bootstrap failed" both read identically as `false` from that reader
alone.

## 4. Required transitions

```
constructed → starting
starting    → ready
starting    → failed
ready       → stopping
stopping    → stopped
```

Implemented by `FedosDesktopHost.start()`/`stop()` (Alpha 334/335/337)
as the ONLY code in this repository permitted to assign a
`FedosDesktopHostState` value.

## 5. Forbidden transitions

- Calling `start()` a second time on any instance, from any state.
- Calling `stop()` before `start()` has ever resolved (i.e. from any
  state other than `"ready"`) — no such transition is defined as safe
  by this Arc.
- Restarting an already-`"stopped"` instance.
- `ready → starting` (there is no "re-enter starting" path).
- `failed → ready` without constructing a brand-new
  `FedosDesktopHost` — per the Alpha 062 Identity Bootstrap Reset
  Decision, already binding on this repository: lifecycle reset uses a
  new instance, never a partial in-place reset API. This Arc adds NO
  `reset()`/`retry()` method of any kind.

## 6. No hidden automatic startup

The constructor (Alpha 334) never calls `start()` itself — every
instance begins at `"constructed"` and stays there until a caller
explicitly invokes `start()`. This mirrors `DesktopApplication`'s own
Alpha 091 Entry Point Decision (constructor performs no async work)
and Alpha 092 Bootstrap Sequence Decision (a future caller triggers
Bootstrap separately, after construction) exactly.

## 7. Conclusion

A six-token closed union, no error payload, five required transitions,
and an explicit set of forbidden transitions — including a Fail-Closed
`failed → ready` prohibition inherited from the Alpha 062 Identity
Bootstrap Reset Decision. `FedosDesktopHostState` itself carries no
behavior; `FedosDesktopHost` (Alpha 334–337) is the sole authority for
every transition.

## 8. See also

- `docs/secure_runtime_alpha_332_desktop_host_responsibility_decision.md`
- `docs/secure_runtime_alpha_062_identity_bootstrap_reset_review.md`
- `docs/secure_runtime_alpha_060_identity_bootstrap_status.md`
- `docs/secure_runtime_alpha_098_ready_state.md`
