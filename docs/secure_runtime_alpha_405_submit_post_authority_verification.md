# Secure Runtime Alpha 405 — submitPost Authority Verification

**Status: this Stage is verification only — it makes NO production
code change of any kind.** Stage 5 of the Alpha 401–410 Desktop Host
Canonical Write Boundary Closure Arc. Formally re-verifies, by direct
execution AFTER Alpha 404's own rewiring, that `submitPost()` remains
the sole canonical Host write boundary and that closing the `board()`
bypass changed none of its own established properties.

## 1. Why now

Alpha 404 changed `board()`'s own return type — a change to the SAME
class `submitPost()` lives on. This Stage confirms, by real execution
against the POST-rewiring source, that none of `submitPost()`'s own
Alpha 393/394/395/398 properties regressed, and that the required
properties this Arc's own instruction lists all still hold.

## 2. Required properties, each reverified

- **Persistence checked/written before in-memory registration**:
  unchanged — `submitPost()`'s own step order (Alpha 393) was not
  touched by Alpha 404; `#boardPersistence.putPost()` still precedes
  `#boardService.registerPost()` in source order, reconfirmed by direct
  inspection.
- **`previewRegistration()` remains pure**: unchanged — Alpha 403's
  own ONLY change to `FedosBoardService` was the additive
  `implements FedosBoardReader` declaration; `previewRegistration()`'s
  own body (Alpha 395) was not touched.
- **Duplicate outcome stays idempotent**: reverified by direct
  execution — submitting the same post twice still returns
  `"inserted"` then `"already-present"`, with exactly one persisted
  record.
- **Post-ID conflict stays fail closed**: reverified — a conflicting
  post still returns `"post-id-conflict"` with the original preserved
  in both Persistence and Repository.
- **Source conflict stays fail closed**: reverified — a post reusing
  another post's own source reference still returns
  `"source-conflict"` before Persistence is ever touched.
- **Persistence failure does not mutate BoardService**: reverified — a
  real `AppendOnlyFedosBoardPersistence` I/O failure still returns
  `"persistence-failed"` with `board()!.findPost()` returning `null`
  for that post afterward.
- **Persistence exception does not mutate BoardService**: reverified —
  a throwing `FedosBoardPersistence` fake still propagates the
  exception unmodified, with `board()!.findPost()` returning `null`
  for that post afterward and `host.state()` remaining `"ready"`.
- **Successful registration is immediately visible to Reader AND
  Query**: NEW coverage this Stage adds — Alpha 396 verified Query
  visibility; this Stage additionally verifies `board()`'s own new
  `FedosBoardReader` observes the SAME write immediately, in the same
  synchronous block, confirming Alpha 404 §5's own live-observation
  claim by direct execution.
- **No protocol-specific branch**: unchanged — reconfirmed by the same
  structural check Alpha 397 already established, rerun against the
  POST-Alpha-404 source.
- **No automatic publishing, no Relay call**: confirmed by direct
  inspection — `fedos_desktop_host.ts` and `fedos_board_service.ts`
  carry zero reference to any Relay, Publish, or outbound-protocol
  vocabulary of any kind, before or after this Arc.

## 3. Transaction ordering — unchanged, confirmed

No defect was found. The established Alpha 391–400 transaction order
(`Validate → Persistence → Repository → Query visibility → Success`)
is UNCHANGED by this Arc — Alpha 404's own only change was to
`board()`'s own return TYPE, a completely orthogonal accessor
`submitPost()` never calls or depends on. Per this Arc's own
instruction ("Do not change the established Alpha 391–400 transaction
ordering unless a real correctness defect is found. If a defect is
found, stop and report before redesigning."): no defect was found, so
no redesign was performed or considered.

## 4. Conclusion

Every property this Arc's own instruction requires of `submitPost()`
holds, reverified by direct execution against the POST-Alpha-404
source — closing the `board()` bypass changed zero property of the
write boundary itself, exactly as Alpha 402 §5 already predicted
("`submitPost()` ... remains completely unchanged").

## 5. See also

- `docs/secure_runtime_alpha_404_host_board_access_rewiring.md`
- `docs/secure_runtime_alpha_398_write_atomicity_verification.md`
- `docs/secure_runtime_alpha_396_immediate_query_visibility.md`
- `docs/secure_runtime_alpha_394_write_failure_policy.md`
