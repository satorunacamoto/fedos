# Secure Runtime Alpha 390 — Host Query Integration Completion

**Status: this Stage is REVIEW ONLY — it makes NO further code change
of any kind. This is Stage 10, the closing Stage, of the Alpha
381–390 Canonical Board Query Host Integration & Startup Failure
Closure Arc.**

## 1. Why now

Alpha 381 inventoried the actual Host/Query source and precisely
located the confirmed defect. Alpha 382 closed it with the smallest
possible restructuring — one `try`/`catch` wrapping every startup
step, preserving original error identity, clearing both owned objects
unconditionally on any failure. Alpha 383 gave the Host ownership of
exactly one `FedosBoardQuery`, constructed only after successful
hydration, exposed only after full success. Alpha 384 added `query()`,
confirmed safe under Option A because `FedosBoardQuery` has no
mutating method. Alpha 385 froze `board()` (write) versus `query()`
(read) as a permanent, documented distinction. Alpha 386 declined
Host-level delegation, avoiding an unnecessary maintenance ripple.
Alpha 387/388/389 verified the whole assembly by real execution — the
in-memory case, the real durable-backend case (with the exact
corruption shape that originally exposed the defect), and the
real four-protocol case. This Stage freezes every finding.

## 2. Completion Declaration

**This Arc's own Objective is CONFIRMED COMPLETE.**

- **Host startup exception closure** — Alpha 382, verified by direct
  re-execution of the EXACT scenario Alpha 361/370 used to confirm
  the original defect.
- **No settled `start()` leaves Host in `"starting"`** — every startup
  failure shape (returned hydration failure, thrown hydration
  exception, Desktop startup rejection) now transitions to `"failed"`
  before `start()`'s own `Promise` settles, confirmed for all three
  shapes by direct execution.
- **Host-owned Query lifecycle** — Alpha 383, exactly one
  `FedosBoardQuery` per successful start, constructed over the
  already-hydrated `FedosBoardService`, discarded on any failure.
- **Ready-only Query access** — Alpha 384, `query()` returns `null`
  before ready, the instance while ready, `null` after stopped or
  failed, never throwing.
- **Failed/stopped Query denial** — confirmed by direct execution
  across every failure shape and the normal shutdown path.
- **Board write / Query read boundary separation** — Alpha 385,
  `board()` unchanged, `query()` new, neither merged nor deprecated.
- **Append-only hydration compatibility** — Alpha 388, verified
  against a REAL, explicitly-injected `AppendOnlyFedosBoardPersistence`,
  including the exact corruption shape that originally exposed the
  defect.
- **Four-protocol Host Query integration** — Alpha 389, verified with
  real fixtures from all four Board Adapters, zero adapter
  modification.
- **Independent Host isolation** — confirmed for Query specifically,
  extending Alpha 367's own Host-restart isolation finding.

## 3. Still out of scope (verbatim from this Arc's own instruction,
confirmed by direct inspection)

- Automatic persistence of `board().registerPost()` writes — Alpha
  389 §3 confirms and documents this gap honestly; NOT solved here.
- Storage path authority, append `fsync`, compaction, recovery
  tooling, query indexes, full-text search, ranking, recommendations
  — no reference anywhere in this Arc's own code.
- GUI, executable entry point, DM/private conversation model,
  Ontology projection, TLS/JA4 abuse defense, Relay Pool — no
  reference anywhere in this Arc's own code; `p2p/` remains completely
  untouched, confirmed by `git status`, not merely by absence of
  import.

## 4. Durable Write Warning, restated

```
host.board()?.registerPost(post)
    ↓
in-memory Repository updated
    ↓
FedosBoardPersistence unchanged
```

This is a KNOWN, DOCUMENTED gap — first found by Alpha 367 (Arc
361–370), re-confirmed at the Host layer by Alpha 389 (this Arc). It
is NOT solved by this Arc, per its own explicit instruction. The next
Arc must design ONE Host-owned write boundary coordinating: (1)
persistence conflict checks, (2) `FedosBoardService` integrity checks,
(3) no partial writes, (4) Query visibility, (5) failure behavior.
This Arc's own instruction is explicit: do NOT casually patch
`FedosBoardService` to know about persistence — that would conflate
two already-frozen, independently-reviewed components (Alpha 307,
Alpha 315) in a way no Stage has reviewed.

## 5. Next Arc recommendation

**Desktop Host Durable Write Coordination Arc.**

Reason: this Arc's own required recommendation, matching its own
instruction verbatim. The Host can now hydrate durable state and
query it safely — Alpha 382–389 close every gap this Arc's own
Objective named — but writes through `board().registerPost()` remain
memory-only (§4). The next architectural requirement is to coordinate
persistence and `FedosBoardService` registration atomically, as ONE
Host-owned write boundary, not as an ad hoc patch to either already-frozen
component.

**Ontology integration is explicitly NOT the next recommended Arc** —
this Stage names Desktop Host Durable Write Coordination instead, per
this Arc's own instruction.

## 6. Conclusion

Every item this Arc's own Objective named is complete, verified by
real execution against both the in-memory default and a real durable
backend, with the confirmed startup-exception defect closed and
re-verified against the exact scenario that first exposed it. The
memory-only write gap is named honestly, not solved, with a precisely
scoped recommendation for the Arc that must solve it next.

## 7. See also

- `docs/secure_runtime_alpha_389_four_protocol_host_query_verification.md`
- `docs/secure_runtime_alpha_388_append_only_host_query_compatibility.md`
- `docs/secure_runtime_alpha_387_host_query_lifecycle_verification.md`
- `docs/secure_runtime_alpha_386_host_query_delegation_review.md`
- `docs/secure_runtime_alpha_385_board_service_access_review.md`
- `docs/secure_runtime_alpha_384_host_query_access_boundary.md`
- `docs/secure_runtime_alpha_383_host_owned_query_construction.md`
- `docs/secure_runtime_alpha_382_host_startup_failure_closure.md`
- `docs/secure_runtime_alpha_381_host_query_integration_inventory.md`
- `docs/secure_runtime_alpha_367_host_restart_verification.md`
