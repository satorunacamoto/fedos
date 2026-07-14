# Secure Runtime Alpha 361 — Host Failure Inventory

**Status: this Stage is REVIEW ONLY — it makes NO code change of any
kind.** This is Stage 1, the opening Stage, of the Alpha 361–370
Board Recovery & Host Robustness Arc. This Arc does NOT introduce a
new storage format — it strengthens the existing implementation
through review, classification, and policy, exactly as its own
instruction states.

## 1. Why now

Alpha 360 closed the Append-only Durable Board Backend Arc with a
list of named, disclosed remaining limitations — most importantly a
newly-discovered gap: `FedosDesktopHost.start()` does not catch a
THROWN exception from hydration, leaving `state()` stuck at
`"starting"` instead of `"failed"`. Before deciding what (if anything)
to do about it, this Stage inventories EVERY way the Host +
`AppendOnlyFedosBoardPersistence` pairing can fail today, by direct
inspection and reproduction — not assumption.

## 2. Every known failure path, inventoried

| # | Failure | Where it originates | How it currently surfaces | `state()` afterward |
|---|---|---|---|---|
| 1 | Hydration returns `"rejected-corrupt-record"`/`"rejected-unresolvable-thread-integrity"` | `hydrateFedosBoardService` (Alpha 318, its own internal check) | `FedosDesktopHost.start()` catches the RETURNED outcome, sets state, rejects | `"failed"` — correct |
| 2 | `DesktopApplication.start()` rejects (e.g. a throwing `FedosPublicIdentityReader`) | `DesktopApplication` (Alpha 096–136) | `FedosDesktopHost.start()`'s own `try`/`catch` around this ONE call | `"failed"` — correct |
| 3 | `persistence.listPosts()` THROWS (e.g. a malformed line, Alpha 357) | `AppendOnlyFedosBoardPersistence`/any future backend | Propagates OUT of `hydrateFedosBoardService` UNCAUGHT, then OUT of `FedosDesktopHost.start()` UNCAUGHT — `start()` itself still REJECTS (the caller sees failure) | **`"starting"` — NOT `"failed"`. Confirmed defect (§3).** |
| 4 | `persistence.putPost()` returns `"failed"` (Alpha 356, e.g. a missing parent directory) | `AppendOnlyFedosBoardPersistence` | Never reached during `start()` — hydration only ever CALLS `listPosts()`, never `putPost()`; this failure is only visible to a caller writing AFTER the Host is already `"ready"`, and is returned as a normal token, never thrown | N/A — Host state unaffected; the WRITE caller sees `"failed"` directly |
| 5 | A second `start()` call on any non-`"constructed"` instance | `FedosDesktopHost` itself (Alpha 335) | Throws synchronously, BEFORE touching hydration or Desktop at all | Unchanged — the guard runs first |
| 6 | `stop()` called from a non-`"ready"` state | `FedosDesktopHost` itself (Alpha 337) | Throws synchronously | Unchanged |

## 3. The confirmed defect, reproduced

Row 3 is the ONLY case in this table where `start()` rejects (correct,
from the caller's point of view) but `state()` reports something other
than `"failed"` afterward. Reproduced directly: constructing a
`FedosDesktopHost` with an `AppendOnlyFedosBoardPersistence` pointed
at a log file containing a malformed trailing line, then calling
`start()`, produces a rejected `Promise` AND `host.state() ===
"starting"` — never `"failed"`, forever, for the lifetime of that
instance (per Alpha 333's own forbidden-transition table, nothing can
ever move a `"starting"` instance to `"failed"` except the exact code
path this defect skips).

## 4. Why this was invisible until Alpha 351–360

`InMemoryFedosBoardPersistence.listPosts()` (Alpha 316) can
STRUCTURALLY never throw — a `Map` read cannot fail. Every Host test
written before this Arc's own predecessor (Alpha 339's own
verification, and everything before it) exercised ONLY that backend,
so row 3 of the table above was unreachable code, not a tested-and-passing
path. `AppendOnlyFedosBoardPersistence` (Alpha 353) is the first
`FedosBoardPersistence` implementation in this repository's history
that can genuinely throw from `listPosts()` — making this a LATENT
defect that only became REACHABLE, not one newly introduced by any
recent Stage.

## 5. Conclusion

Six distinct failure paths are inventoried. Five behave exactly as
`FedosDesktopHostState`'s own design intends. One — a thrown exception
from hydration — does not, and is reproduced here as a concrete fact,
not a hypothesis. Alpha 362 formalizes the INTENDED policy this defect
falls short of; Alpha 370 answers whether it is architectural and
names the minimal future fix, without implementing it.

## 6. See also

- `docs/secure_runtime_alpha_360_append_only_backend_completion.md`
- `docs/secure_runtime_alpha_357_crash_review.md`
- `docs/secure_runtime_alpha_335_board_hydration_ownership.md`
- `docs/secure_runtime_alpha_333_desktop_host_state_model.md`
