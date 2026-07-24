# Secure Runtime Alpha 7641–7720 — Index Ownership, Rebuild Model, and Consistency/Crash Semantics

**FedOS Delivery Observation Repository Subject Index and Query Scalability Arc — Phases C/D/E/I.**

## Ownership

The new `#bySubject: Map<FedosDeliveryObservationSubjectId, FedosDeliveryObservation[]>`
index is a PRIVATE field owned exclusively by
`FedosDeliveryObservationRepository` — no other class holds, mutates, or
serializes it. It is never persisted, never itself a durable store, and
never the sole source of truth: the injected `FedosDeliveryObservationPersistence`
remains that, unchanged, for the lifetime of every Repository instance.
This Arc does not create a second Observation Repository or a second
persistence port of any kind — it is the SAME class, SAME constructor
signature, extended internally.

## Rebuild model

Built exactly once, at construction, by iterating
`persistence.listObservations()` — the identical call `list()` already
made on its own first invocation before this Arc, so the FIRST cost this
class ever pays is unchanged; what changes is that the RESULT is now
retained (as a per-subject index) rather than discarded. A restart —
constructing a brand-new `FedosDeliveryObservationRepository` over the
SAME durable persistence — deterministically reconstructs an identical
index every time (proven: Phase F test 10, five real restart cycles over
a real file-backed log).

## Append (write) ordering, exactly as implemented

1. `createFedosDeliveryObservation()` validates the candidate — invalid
   input never proceeds (`"invalid"`, index untouched).
2. `serializeFedosDeliveryObservation()` — pure, cannot fail.
3. `persistence.putObservation()` performs the durable append (or
   detects `"already-present"`/`"conflict"`/`"failed"`).
4. The index is updated **only** when step 3 returns `"inserted"` —
   never for `"already-present"` (the fact was already indexed the FIRST
   time it was truly new), never for `"conflict"`/`"failed"`/`"invalid"`
   (nothing durable changed, so nothing in-memory should either).
5. `record()` returns to the caller.

This ordering means the index can NEVER contain an entry the durable
persistence does not also contain, and can never be MISSING an entry the
durable persistence DOES contain once construction has completed. A
process crash between step 3 (durable append succeeds) and step 4 (index
update) is impossible within a single synchronous JavaScript call — this
codebase's persistence layer is synchronous, and `record()` is one
non-yielding function call; the only real "crash between durable-write
and index-update" scenario is a full PROCESS crash, which is repaired
identically to any other restart: the next construction rebuilds the
index fresh from persistence, which by definition already reflects
everything durably written (step 3 already completed) — no special
recovery code is needed or was added.

## Consistency guarantees

- **The index can never diverge from persistence for the lifetime of one
  Repository instance** — `record()` is the ONLY method that touches
  the index, and it does so only in lockstep with a confirmed durable
  write.
- **A rejected/invalid/stale write (via `FedosValidatingDeliveryObservationRepository`)
  never reaches `record()` at all**, so it can never reach the index
  either — the pre-existing transition/staleness guard logic
  (`fedos_delivery_observation_write_validator.ts`, UNCHANGED) continues
  to run BEFORE this Arc's own code is ever reached.
- **Two separate Repository instances over the SAME durable persistence**
  (e.g., simulating two processes, or a "restart" test) do not share an
  index — the SECOND instance only ever sees what it independently
  reconstructed from persistence at ITS OWN construction time. A write
  made by one instance after the other's construction is invisible to
  the other's index until IT is reconstructed (this is the SAME
  single-writer-per-process assumption every other part of this
  synchronous, single-process codebase already makes — not a new
  constraint this Arc introduces).

## Safe resource limits (Phase I)

**Finding**: `subjectId` is an opaque, caller-supplied string (Alpha
462) — nothing in this Arc's own new index imposes a distinct-subject
count limit or a per-subject history-length limit beyond what the
DURABLE persistence log already allows (which itself has no compaction
and no such limit, an already-accepted, explicitly out-of-scope
tradeoff per the original audit's §10). This Arc's own index therefore
grows to, at most, the SAME total size the durable log already reaches
— it introduces no NEW attacker-reachable growth vector: an actor
capable of causing unbounded distinct subjects or unbounded per-subject
history could already grow the durable log unboundedly before this Arc
existed; this Arc's index merely keeps that SAME already-existing total
resident in memory for a process's lifetime, instead of re-reading it
transiently on every call (the original audit's own §8 "Memory growth"
section already sized this exact order of magnitude — "a few megabytes"
at 100,000 historical intents — and explicitly declined to treat it as
a practical ceiling).

**Decision: no new limit added.** Adding an arbitrary cap here would
violate this Arc's own "Do not introduce arbitrary low limits simply to
make benchmarks pass" instruction and would silently discard durable,
historically-real facts this Arc's own "no durable fact omitted from the
index after a successful append" guarantee (Phase E) forbids. If a
future Arc decides a hard memory ceiling is genuinely needed, it should
be sized and reviewed together with the ALREADY-documented, larger,
harder problem this shares a root cause with — durable-log compaction
(the original audit's own §10, still unimplemented, still explicitly
out of scope for both this Arc and its predecessor).

**Failure mode if exhausted**: none added by this Arc. The natural
ceiling remains what it already was — available process memory — and
this Arc does not change how construction/`record()` behave as that
ceiling is approached (neither did the pre-existing `list()`-per-call
pattern, which already materialized the same total data transiently on
every single call).
