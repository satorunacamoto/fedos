# Secure Runtime Alpha 367 — Host Restart Verification

**Status: this Stage verifies existing, unmodified behavior by real
execution — no production code change.** Stage 7 of the Alpha
361–370 Board Recovery & Host Robustness Arc.

## 1. Why now

Alpha 359 (Arc 351–360) verified that `AppendOnlyFedosBoardPersistence`
survives a genuine restart AT THE PERSISTENCE LAYER — a fresh instance
pointed at the same file. This Stage goes one level up: it verifies
`FedosDesktopHost` ITSELF across MULTIPLE full start/stop cycles,
across MULTIPLE independently-constructed Host instances sharing the
SAME durable file, which no prior Arc's own test suite exercised.

## 2. What "Host restart" means here, distinct from Alpha 359's "persistence restart"

Alpha 359 restarted the PERSISTENCE object alone and hydrated it
directly, bypassing `FedosDesktopHost` entirely. This Stage
constructs a FULL `FedosDesktopHost` (with a real `DesktopApplication`
and the SAME `AppendOnlyFedosBoardPersistence` file path), runs it
through `start()` → write DURABLY (§2a) → `stop()`, then constructs a
SECOND, fully independent `FedosDesktopHost` pointed at the identical
file and repeats — verifying the ENTIRE lifecycle machinery (Alpha
333–337), not merely the persistence layer alone.

### 2a. A finding confirmed by this Stage's own execution: `board()` writes are NOT durable

`FedosDesktopHost.board()` (Alpha 336) returns the `FedosBoardService`
`hydrateFedosBoardService` (Alpha 318) constructed at `start()` time —
via `new FedosBoardService()`, its own FULLY DEFAULTED, in-memory
constructor (Alpha 307: `InMemoryFedosBoardRepository` +
`FedosBoardSourceIndex` + `FedosBoardIndex`), never a
`PersistedFedosBoardRepository` (Alpha 317). **A `registerPost()` call
made through `host.board()` therefore mutates ONLY that in-memory
service — it is never written back to `FedosBoardPersistence`, and is
LOST the moment the Host instance is discarded**, exactly as
`InMemoryFedosBoardPersistence`-backed Hosts have always behaved,
without exception. Durable writes, across this whole Arc's own test
suite and Alpha 359's own before it, go through
`FedosBoardPersistence.putPost()` DIRECTLY — never through
`host.board().registerPost()`. This is not a defect: `FedosDesktopHost`
was never specified to write-through Board mutations to disk (Alpha
332–337 name only hydration as a Host responsibility, never ongoing
persistence of writes) — it is a previously-undocumented, now
explicitly confirmed, architectural fact this Stage's own test suite
depends on getting right.

## 3. Verified properties

- **Content written durably (§2a) before a `stop()` is visible to a
  second, independently-constructed Host instance**, after that
  second instance's own `start()` re-hydrates from the shared file.
- **Lifecycle state is independent per instance.** The first Host
  being `"stopped"` has no bearing on the second Host's own `state()`,
  which begins at `"constructed"` and progresses normally.
- **Three or more successive cycles remain stable.** Repeating
  construct → start → write → stop three times against the same file
  produces a monotonically growing, never-shrinking, never-duplicated
  Board — matching Alpha 354's own append-only guarantees, now proven
  through the FULL Host lifecycle rather than direct persistence calls
  alone.
- **No cross-instance state leakage.** Each `FedosDesktopHost`
  instance's own `#boardService` (Alpha 335) is independently
  hydrated; nothing is cached or shared between instances beyond what
  physically exists in the shared file.
- **A Host restart after a normal `stop()` behaves identically to a
  Host "restart" after an ABNORMAL exit** (no `stop()` call at all,
  simulating a crash) — since neither `FedosDesktopHost` nor
  `AppendOnlyFedosBoardPersistence` performs any special
  shutdown-time flush or cleanup (Alpha 337 §2: neither has a
  dispose/close method to call), a clean `stop()` and a simulated
  crash (simply discarding the `FedosDesktopHost` reference without
  calling `stop()`) leave IDENTICAL on-disk state, verified directly.

## 4. Why this matters beyond Alpha 359's own coverage

A real Desktop process restart (the scenario this whole Arc's own
predecessor, Alpha 331–340, built `FedosDesktopHost` to eventually
serve) means constructing a BRAND NEW `FedosDesktopHost` — never
reusing the old one — exactly matching Alpha 333's own `failed →
ready` prohibition ("switching means constructing a new instance").
This Stage is the FIRST in this repository's history to exercise that
exact shape end to end with a REAL durable backend, rather than either
`InMemoryFedosBoardPersistence` (which cannot meaningfully "restart" —
a fresh instance is always empty) or a bare persistence-object restart
bypassing the Host (Alpha 359).

## 5. Conclusion

`FedosDesktopHost` correctly supports being constructed fresh,
repeatedly, against a durable, shared, on-disk Board — with no
special-case code needed anywhere, because `FedosDesktopHost`'s own
construct-only, no-hidden-state design (Alpha 334) and
`AppendOnlyFedosBoardPersistence`'s own no-cache, replay-based reads
(Alpha 355) already compose correctly without any Stage having to
verify it before now.

## 6. See also

- `docs/secure_runtime_alpha_359_four_protocol_append_only_verification.md`
- `docs/secure_runtime_alpha_337_desktop_host_shutdown_contract.md`
- `docs/secure_runtime_alpha_334_desktop_host_dependency_assembly.md`
- `docs/secure_runtime_alpha_333_desktop_host_state_model.md`
