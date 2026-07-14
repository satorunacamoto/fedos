# Secure Runtime Alpha 337 — Desktop Host Shutdown Contract

**Status: this Stage implements code.** Stage 7 of the Alpha 331–340
Desktop Host Runtime Foundation Arc. Adds `stop()` to
`FedosDesktopHost` (`src/desktop/host/fedos_desktop_host.ts`).

## 1. Why now

Alpha 336 fixed how a ready Host is read from. This Stage fixes how it
is shut down — without inventing a resource that does not yet exist.

## 2. Current expected reality, confirmed by direct inspection

- `DesktopApplication` has no dispose/close method — its own public
  surface (Alpha 336 §2) is `bootstrap`/`start`/`currentIdentity`/
  `isBootstrapped`/`readPublicIdentity`/`currentPublicIdentity`/
  `refreshPublicIdentity`; none releases a resource.
- `InMemoryFedosBoardPersistence` (Alpha 316) holds a private `Map`
  with no open handle of any kind — its own doc comment states "No
  persistence to JSON, no filesystem, no background work" directly.
- `FedosBoardService` has no close method — its own public surface
  (Alpha 336 §2) is `registerPost`/`findPost`/`listBoardPosts`/
  `listThreadPosts`; none releases a resource.

**Therefore `stop()` performs ONLY lifecycle-state closure this Arc —
no resource-release call of any kind, because none exists to call.**

## 3. Implementation

```ts
async stop(): Promise<void> {
  if (this.#state !== "ready") {
    throw new Error("FedosDesktopHost.stop() may only be called from the ready state.");
  }
  this.#state = "stopping";
  this.#boardService = null;
  this.#state = "stopped";
}
```

## 4. Idempotency policy, explicitly decided

**Not idempotent.** A second `stop()` call — on an instance already in
`"stopping"`, `"stopped"`, or any other non-`"ready"` state — THROWS,
rather than silently no-oping. This matches
`DesktopApplication.start()`'s own Alpha 098 precedent exactly (a
second `start()` call on an already-started instance throws, it does
not silently succeed a second time) rather than
`FedosRuntimeIdentity.bootstrapIdentity()`'s own DIFFERENT,
deliberately idempotent precedent (Alpha 061) — the two precedents
coexist in this repository for different reasons: Bootstrap
idempotency exists because a Provider read might legitimately be
retried after a FAILED attempt (Alpha 061 §"A FAILED attempt leaves
`#bootstrapped` at `false`... the very next call retries for real");
`stop()` has no analogous "retry after failure" case — a Host shutdown
either completes or the call was invalid, and a caller invoking
`stop()` twice almost always indicates a caller-side bug this Stage
chooses to surface loudly rather than mask.

## 5. Requirements confirmed

- `ready → stopping → stopped`, exactly as required.
- No restart after stopped — `start()`'s own guard (Alpha 335) rejects
  any call where `state() !== "constructed"`, which `"stopped"` is
  not.
- No Board access after stopped — `board()` (Alpha 336) gates on
  `state() === "ready"`, which becomes `false` the instant `stop()`
  transitions past `"ready"`.
- No Desktop operations after stopped through the Host boundary —
  `desktop()` (Alpha 336) gates identically.
- No `process.exit()` — absent from this file, and from every file
  under `src/desktop/host/`.
- No signal handling in the Host class itself — no `process.on(...)`
  reference anywhere in this file.
- No global cleanup — `stop()` touches only `this.#state` and
  `this.#boardService`; it never iterates or clears any module-level
  collection.
- No fake close calls — `stop()` calls NO method on
  `#desktopApplication`, `#boardPersistence`, or the discarded
  `#boardService` reference; §2 confirms none of the three has a
  close method to call.

## 6. Future additive resource cleanup, documented but NOT implemented

A future Stage that adds a real durable backend (SQLite or an
append-only file, per Alpha 329/330's own recommended next step) would
need to extend `stop()` to release, in whatever order that backend's
own semantics require:

- A SQLite connection (once selected — not this Arc).
- Relay connections (once a Relay Pool exists — explicitly out of
  scope, permanently, for `FedosDesktopHost`).
- Filesystem handles (once a filesystem-backed persistence backend is
  selected — not this Arc).
- Background sync (once any background task exists anywhere in this
  repository — none does today).

None of these four is implemented by this Stage. This section exists
so a future Stage extending `stop()` has a fixed list to check against,
not a blank page.

## 7. Conclusion

`stop()` performs lifecycle-state closure only, is NOT idempotent (a
second call throws), releases no resource because none exists yet, and
leaves a documented, unimplemented list of future resource-release
responsibilities for whichever Arc eventually selects a durable
backend.

## 8. See also

- `docs/secure_runtime_alpha_336_desktop_host_access_boundary.md`
- `docs/secure_runtime_alpha_098_ready_state.md`
- `docs/secure_runtime_alpha_061_identity_bootstrap_idempotency.md`
- `docs/secure_runtime_alpha_316_in_memory_board_persistence.md`
