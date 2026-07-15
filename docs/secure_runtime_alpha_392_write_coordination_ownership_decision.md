# Secure Runtime Alpha 392 — Write Coordination Ownership Decision

**Status: this Stage is REVIEW ONLY — it makes NO code change of any
kind.** Stage 2 of the Alpha 391–400 Desktop Host Durable Write
Coordination Arc. This Stage issues the Arc's own shape Decision,
implemented by Alpha 395.

## 1. Why now

Alpha 391 located the exact gap: no code path today writes to BOTH
`FedosBoardPersistence` and `FedosBoardService`'s own Repository for
the same post, in the same call. Before writing any coordination code,
this Stage decides WHERE that coordination lives, per this Arc's own
instruction, which names exactly two candidates.

## 2. Candidates compared

- **Option A — Host owns write coordination directly.** A new public
  method on `FedosDesktopHost` itself (`submitPost()`), using the two
  private fields the Host already holds — `#boardPersistence` and
  `#boardService` — with no new class, no new file beyond the design
  docs and tests this Arc ships.
- **Option B — a new `WriteCoordinator` class.** A separate class,
  constructed with `FedosBoardPersistence` and `FedosBoardService` (or
  `FedosDesktopHost` itself) as dependencies, exposing its own
  `submitPost()`-shaped method, which `FedosDesktopHost` would then
  either construct internally or expose as a third owned object
  alongside `#boardService`/`#boardQuery`.

## 3. Evaluation

**Option A** matches this Arc's own Objective diagram exactly:

```
Host
    ↓
submitPost()
    ↓
Persistence
    ↓
Repository
    ↓
Query (same Board instance)
    ↓
Success
```

`submitPost()` is drawn as a Host-level operation, not a delegation to
a third object. It also matches this repository's own established
precedent: Alpha 332 (Arc 331–340) faced the exact same style of
choice — "Option A: a class that owns dependencies and lifecycle" vs.
"Option B: a set of free functions" — and adopted the class-owns-its-
concerns shape specifically because a class gives every instance
independent private state by construction, with no additional
indirection layer needed for a SINGLE coordinating operation. The Host
already owns both dependencies `submitPost()` needs
(`#boardPersistence`, `#boardService`) — no new dependency, no new
constructor parameter, no new lifecycle to manage.

**Option B** is rejected. A `WriteCoordinator` class would need
EITHER `FedosBoardPersistence` + `FedosBoardService` injected
separately (duplicating exactly what `FedosDesktopHostDependencies`
already assembles) OR a reference to `FedosDesktopHost` itself
(inverting the ownership direction for no benefit — the Host would then
own a coordinator that owns a reference back to state the Host itself
already holds). It also introduces a FOURTH owned object alongside
`#desktopApplication`/`#boardService`/`#boardQuery`, with its own
construction timing question (constructed in the constructor? In
`start()`, like `#boardQuery`? Before or after hydration?) that Option
A avoids entirely, since `submitPost()` is simply a method, not an
object with its own lifecycle. Nothing about write coordination is
complex enough to justify a dedicated class: it is exactly one
ordered sequence of calls to two objects the Host already owns — see
Alpha 393 for the full sequence. This Arc's own instruction lists "no
speculative future APIs" among its Absolute Prohibitions; a
`WriteCoordinator` class built for a single call sequence, with no
second caller and no second implementation ever named by this Arc's
own Objective, would be exactly that.

## 4. Decision

**Option A, adopted.** `FedosDesktopHost` gains one new public method,
`submitPost(post: FedosBoardPost): FedosDesktopHostSubmitPostResult`
(Alpha 395), using its own already-owned `#boardPersistence` and
`#boardService` fields directly. No new class, no new file under
`src/desktop/host/` beyond the existing `fedos_desktop_host.ts`.

## 5. What this decision does NOT change

- `board()` remains unchanged and still callable directly — this Arc
  does not remove, deprecate, or gate it (Alpha 391 §8). A caller can
  still bypass `submitPost()` by calling `board()!.registerPost()`
  directly, exactly as before; this residual gap is named honestly in
  Alpha 394 rather than closed by (for example) making `board()`
  return `null` or throwing — narrowing `board()`'s own contract is
  explicitly out of this Arc's scope, since Alpha 385 already froze
  `board()`/`query()` as the permanent read/write accessor pair one
  Arc ago, and this Arc's own instruction does not name revisiting
  that freeze.
- `FedosBoardService`, `FedosBoardRepository`, and `FedosBoardPersistence`
  remain the same three components; Option A does not "conflate" them
  (the risk this Arc's own instruction and Alpha 390 §4 both explicitly
  warn against) — it sequences calls to their EXISTING public surfaces
  from a fourth location (the Host), never reaching into either
  component's own private state.

## 6. Conclusion

A class that already owns both dependencies coordinating them directly,
via one new method, matches this repository's own established
Option-A-over-free-functions-or-indirection precedent (Alpha 332),
matches this Arc's own Objective diagram literally, and avoids
introducing a class with no second use case — exactly the kind of
speculative structure this Arc's own Absolute Prohibitions rule out.

## 7. See also

- `docs/secure_runtime_alpha_391_desktop_host_write_coordination_inventory.md`
- `docs/secure_runtime_alpha_332_desktop_host_responsibility_decision.md`
- `docs/secure_runtime_alpha_390_host_query_integration_completion.md`
