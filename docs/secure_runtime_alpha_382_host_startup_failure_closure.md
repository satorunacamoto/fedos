# Secure Runtime Alpha 382 — Host Startup Failure Closure

**Status: this Stage implements code.** Stage 2 of the Alpha 381–390
Canonical Board Query Host Integration & Startup Failure Closure Arc.
Fixes the confirmed defect Alpha 361/370/381 each independently
reproduced.

## 1. The defect, restated precisely

```
hydrateFedosBoardService() throws
    ↓
start() rejects
    ↓
Host state remains "starting"
```

## 2. The fix

```ts
async start(): Promise<void> {
  if (this.#state !== "constructed") {
    throw new Error("FedosDesktopHost.start() may only be called once, from the constructed state.");
  }
  this.#state = "starting";

  try {
    const hydration = hydrateFedosBoardService(this.#boardPersistence);
    if (hydration.outcome !== "hydrated" || hydration.service === null) {
      throw new Error(`FedosDesktopHost failed to hydrate Board state: ${hydration.outcome}`);
    }
    const boardQuery = new FedosBoardQuery(hydration.service);

    await this.#desktopApplication.start();

    this.#boardService = hydration.service;
    this.#boardQuery = boardQuery;
    this.#state = "ready";
  } catch (error) {
    this.#boardService = null;
    this.#boardQuery = null;
    this.#state = "failed";
    throw error;
  }
}
```

## 3. Why one `try`/`catch` wrapping everything, not two

The PRIOR implementation (Alpha 335/337) already caught
`DesktopApplication.start()`'s own rejection correctly, in its OWN
inner `try`/`catch` — the defect was specifically that hydration's own
possible THROW sat outside any `try` at all. This Stage does not add a
SECOND `try`/`catch` around hydration alone — it REMOVES the
now-redundant inner one and wraps EVERY startup step (hydration, the
manually-thrown hydration-outcome check, Query construction,
`DesktopApplication.start()`) in exactly ONE `try`, closed by exactly
ONE `catch`. This is the smallest change that closes the defect for
EVERY current and future failure shape uniformly — a caller of
`start()` never needs to know WHICH step failed to know that
`state()` will read `"failed"` afterward, matching Alpha 362's own
frozen policy (Arc 361–370) exactly.

## 4. Preserving original Error/rejection identity

The `catch (error)` block's own LAST statement is `throw error;` —
the caught value, completely unmodified, whether it is:

- The manually-constructed `Error` this method itself throws on a
  RETURNED non-`"hydrated"` hydration outcome (SAME message Alpha 335
  always produced).
- Whatever `hydrateFedosBoardService`/`#boardPersistence.listPosts()`
  itself throws (a real bug fix target — previously uncaught).
- Whatever `DesktopApplication.start()` itself rejects with (already
  correctly preserved before this Stage; unchanged).

**No wrapping merely for prose** — no `new Error("Host startup
failed: " + error.message)`, no re-throw of a DIFFERENT error type. A
caller catching `start()`'s own rejection sees EXACTLY the same
`instanceof` and `.message` it would have seen calling the failing
step directly.

## 5. Why `#boardService`/`#boardQuery` are cleared unconditionally in `catch`

`this.#boardService = null; this.#boardQuery = null;` runs
UNCONDITIONALLY inside `catch` — even on the RETURNED
hydration-outcome-check failure, where neither field was ever
assigned a non-`null` value in the first place (both are already
`null` from construction). This is deliberately NOT conditional
(`if (this.#boardService !== null) ...`) — a plain, unconditional
reset is simpler, has no observable difference, and matches
`stop()`'s own existing identical pattern (Alpha 337) of
unconditionally nulling both fields regardless of their current
value.

## 6. Requirements confirmed satisfied

- **No swallowed exception** — `catch` always ends in `throw error;`.
- **No fallback to empty persistence, no fallback to an empty Board**
  — a failed hydration NEVER produces a `FedosBoardService`; the
  `boardQuery`/`hydration.service` local variables simply go out of
  scope, unassigned to any field, exactly as Alpha 335 already
  guaranteed for `#boardService` alone.
- **No automatic retry** — `start()`'s own leading guard
  (`if (this.#state !== "constructed") throw ...`) still rejects any
  second call, from ANY state including `"failed"`, unchanged.
- **No reset API** — no new method of any kind is added beyond
  `query()` (Alpha 384); `"failed"` remains permanent per-instance,
  matching Alpha 333's own forbidden-transition table exactly.
- **No partial ready state** — `#boardService`/`#boardQuery`/`state →
  "ready"` are STILL the method's own final three statements, reached
  only if EVERY prior line in the `try` block completed without
  throwing.
- **No public API removal** — `state()`/`start()`/`stop()`/`desktop()`/
  `board()` all keep their exact prior signatures.
- **No change to `hydrateFedosBoardService()`** — confirmed
  byte-for-byte unchanged by this Arc's own regression tests.

## 7. Conclusion

Exactly one `try`/`catch` restructuring closes the confirmed defect
for every failure shape uniformly, preserves original error identity,
clears both owned objects unconditionally on any failure, and changes
zero observable behavior for every path that already worked correctly
before this Stage.

## 8. See also

- `docs/secure_runtime_alpha_381_host_query_integration_inventory.md`
- `docs/secure_runtime_alpha_362_hydration_failure_policy.md`
- `docs/secure_runtime_alpha_370_recovery_robustness_completion.md`
- `docs/secure_runtime_alpha_333_desktop_host_state_model.md`
