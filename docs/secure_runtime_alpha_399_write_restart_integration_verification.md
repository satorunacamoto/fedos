# Secure Runtime Alpha 399 — Integration Verification

**Status: this Stage is verification only — it makes NO production
code change of any kind.** Stage 9 of the Alpha 391–400 Desktop Host
Durable Write Coordination Arc. Runs the real integration this whole
Arc exists to enable: `AppendOnlyFedosBoardPersistence` →
`PersistedFedosBoardRepository`-shaped durability (via `submitPost()`)
→ `FedosDesktopHost` → `FedosBoardQuery`, across a genuine process
restart.

## 1. Why now

Alpha 396 verified visibility WITHIN one live Host instance. Alpha 397
verified protocol neutrality. Alpha 398 verified every failure shape
in isolation. This Stage is the end-to-end proof the whole Arc's own
Objective names explicitly: `write → restart → hydrate → query`,
everything preserved — the exact scenario that was IMPOSSIBLE before
this Arc (a post written via the old `board().registerPost()` path
vanished on restart, confirmed by Alpha 367/389/390).

## 2. Method

1. Construct a `FedosDesktopHost` over a REAL
   `AppendOnlyFedosBoardPersistence` pointed at a fresh temp file.
   `start()` it.
2. `submitPost()` several posts, including a reply thread, through the
   NEW write boundary — never `board().registerPost()` directly.
3. `stop()` the first Host instance — simulating process shutdown.
4. Construct a SECOND, entirely independent `FedosDesktopHost`, over a
   NEW `AppendOnlyFedosBoardPersistence` instance pointed at the SAME
   file path — simulating a fresh process restart reading the same
   durable log.
5. `start()` the second instance and query it.

## 3. Result

Every post `submitPost()`-written by the FIRST Host instance is
visible via `query()` on the SECOND, independently-constructed Host
instance — thread structure, `createdAt` ordering, and filter
correctness all preserved, matching the exact guarantees Alpha
373–376/388/389 already established for READS of a pre-seeded log,
now confirmed for a log that was WRITTEN through this Arc's own new
path rather than pre-seeded by a test fixture directly.

## 4. What this closes, precisely

This is the exact scenario Alpha 390 §4 named as the required next
Arc's own success condition: "coordinate persistence and
`FedosBoardService` registration atomically, as ONE Host-owned write
boundary." Before this Arc, no such write-then-restart-then-read round
trip was reachable through any public API — `board().registerPost()`
never reached Persistence at all (Alpha 391 §5), so a restart always
lost every live-registered post. After this Arc, `submitPost()` is
that boundary, and this Stage proves the round trip holds.

## 5. What remains honestly out of scope

- The residual `board()` bypass (Alpha 392 §5, Alpha 394 §8) is NOT
  retested here — it is unchanged, and reproducing the OLD lost-write
  behavior again would only re-confirm Alpha 389 §12's own already-
  established finding, not this Arc's own new guarantee.
- Compaction, `fsync`, and crash-mid-write recovery remain exactly as
  disclosed by Alpha 357/364 — this Stage restarts cleanly, it does
  not inject a crash mid-`appendFileSync`.

## 6. Conclusion

The full `write → restart → hydrate → query` round trip is verified by
direct execution against a real, file-backed durable persistence
implementation, confirming this Arc's own Objective is met: the Host
is now the single owner of durable Canonical Board write coordination.

## 7. See also

- `docs/secure_runtime_alpha_398_write_atomicity_verification.md`
- `docs/secure_runtime_alpha_395_host_write_api_implementation.md`
- `docs/secure_runtime_alpha_390_host_query_integration_completion.md`
- `docs/secure_runtime_alpha_367_host_restart_verification.md`
- `docs/secure_runtime_alpha_388_append_only_host_query_compatibility.md`
