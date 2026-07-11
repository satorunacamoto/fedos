# Secure Runtime Alpha 085 — Identity Bootstrap Observation Framework Completion & Implementation Readiness Review

**Status: this Stage is REVIEW / DECISION ONLY. It makes NO
implementation change of any kind. `src/` is untouched by this Stage
— no header comment, no field, no method, nothing. This document, its
own guard test, and a `README.md` entry are the entire deliverable.**

## 1. Why now

Alpha 076 through Alpha 084 designed and fixed nine separate
dimensions of a Bootstrap Observation Framework — Boundary, Contract,
Ordering, Scope, Vocabulary, Event Shape, Lifecycle, Delivery
Responsibility, and Consumer Boundary — one Stage at a time, each
adding a single header-comment paragraph to `fedos_runtime_identity.ts`
and nothing else. None of the nine Stages implemented anything: the
Hook added at Alpha 076, `#observeBootstrap()`, remains an empty
synchronous method to this day. This Stage does not add a tenth
dimension. It instead performs the audit those nine Stages have been
building toward: are the nine Decisions mutually consistent with each
other AND with the actual, unimplemented Hook shape they all govern;
does anything need implementing right now; and should further
Observation sub-review Stages be allowed to continue indefinitely.
This Stage answers all three, and closes the review arc.

## 2. The nine Observation Framework elements

| # | Element | Alpha | One-line Decision |
|---|---------|-------|--------------------|
| 1 | Boundary | 076 | Adds the empty `#observeBootstrap()` Hook, called once, immediately before `#completeBootstrap()`. |
| 2 | Contract | 077 | The Hook must stay synchronous, `void`-returning, never throwing, never reading/writing `#descriptor`/`#bootstrapped`, never touching `#registry`/`#service`/`#resolver`; permitted future uses limited to Metrics/Tracing/Audit/Logging/Telemetry. |
| 3 | Ordering | 078 | Fixed call chain `#bootstrapIdentity()` → `#performBootstrap()` → `#acquireDescriptor()` → `#describeIdentity()` → `#observeBootstrap()` → `#completeBootstrap()`; the Hook always runs strictly BEFORE the state write, observing pre-write state only. |
| 4 | Scope | 079 | Allowed to observe: Bootstrap start/end, the null-vs-non-null fact about the Descriptor, elapsed time, invocation count, success/failure. Forbidden: Descriptor field contents, Provider/Registry/Storage internal state, Runtime Mode/Platform, secret material. |
| 5 | Vocabulary | 080 | A closed five-token set — `BOOTSTRAP_STARTED`, `BOOTSTRAP_COMPLETED`, `BOOTSTRAP_FAILED`, `DESCRIPTOR_PRESENT`, `DESCRIPTOR_ABSENT` — facts only, no free text. |
| 6 | Event Shape | 081 | Any future Event has EXACTLY three fields — `event`, `timestamp`, and the Alpha 080 Vocabulary token — nothing else. |
| 7 | Lifecycle | 082 | One-way: generated → optionally consumed → never retained → never resent → end. No Queue/History/Cache/Replay/Retry/Dead Letter Queue of Observation Events. |
| 8 | Delivery Responsibility | 083 | The Runtime may generate an Event and may synchronously notify a Consumer — nothing more. All actual delivery (Logging, Telemetry, Metrics, Audit, Network, Storage, Queueing, Retrying) is permanently the Consumer's own responsibility. |
| 9 | Consumer Boundary | 084 | A Consumer may only read an Event and may Log/Trace/Telemetry/Metrics/Audit/discard it. It may never re-run Bootstrap or mutate the Descriptor/Registry/Provider/Resolver/Storage/Runtime/Worker state. Observation is one-way; no reverse flow. |

Together these nine Decisions fully specify the OUTER SHAPE any future
Observation implementation must have — what it may see, what it may
say, how it may say it, what happens to what it says, who must deliver
it, and what the recipient may do with it. None of the nine
implements anything.

## 3. Current implementation, verbatim

The entire Observation surface, read directly from
`src/runtime/fedos_runtime_identity.ts` as of this Stage:

```ts
#observeBootstrap(descriptor: FedosIdentityDescriptor | null): void {
  // Intentionally empty — Bootstrap Observation Boundary (Alpha 076); no observer implementation yet.
}
```

Its one and only call site, inside `#bootstrapIdentity()`:

```ts
async #bootstrapIdentity(): Promise<void> {
  if (this.#isBootstrapped()) {
    return;
  }
  const descriptor = await this.#performBootstrap();
  this.#observeBootstrap(descriptor);
  this.#completeBootstrap(descriptor);
}
```

The full Bootstrap Flow chain, confirmed against the actual source:
`#bootstrapIdentity()` → `#performBootstrap()` → `#acquireDescriptor()`
→ `#describeIdentity()` → (Descriptor resolved) → `#observeBootstrap(descriptor)`
→ `#completeBootstrap(descriptor)`.

None of the following exist anywhere in this repository as of this
Stage:

- A Vocabulary type (the five Alpha 080 tokens exist only as prose in
  header comments, not as a TypeScript type, `enum`, or `const`
  object).
- An Observation Event type (the Alpha 081 three-field shape exists
  only as prose).
- A Consumer interface or callback type.
- Any Consumer injection point (constructor parameter, setter, or
  otherwise) on `FedosRuntimeIdentity`.
- `timestamp` generation logic of any kind.
- A `BOOTSTRAP_STARTED` notification (no call site exists before
  Descriptor acquisition begins).
- A `BOOTSTRAP_COMPLETED` notification.
- A `BOOTSTRAP_FAILED` notification.
- A `DESCRIPTOR_PRESENT` notification.
- A `DESCRIPTOR_ABSENT` notification.
- Logging, Metrics, Tracing, Audit, or Telemetry of any kind.

## 4. Integrity audit — does the current Hook shape actually support the nine Decisions?

Ten questions, answered directly against the source quoted in §3 and
the Alpha 076–084 header-comment text quoted in
`fedos_runtime_identity.ts`.

**Q1. The current Hook is called exactly once, after the Descriptor is
acquired and before the state write. Can this single call site express
`BOOTSTRAP_STARTED`?**

No. `BOOTSTRAP_STARTED` means "Bootstrap began." The only existing
call site fires AFTER `#performBootstrap()` has already resolved —
i.e., after the entire Descriptor-acquisition flow has already run to
completion. There is no call site anywhere before that point; the
guard (`if (this.#isBootstrapped()) { return; }`) and the
`#performBootstrap()` call that follows it contain no Hook invocation
of their own. Expressing `BOOTSTRAP_STARTED` accurately would require
a SECOND call site, immediately after the guard and before
`#performBootstrap()` is invoked — which does not exist today and
which Alpha 078's Ordering Decision does not itself forbid, but which
is also not yet decided. This is a genuine, unresolved architectural
gap, not a naming detail.

**Q2. `#observeBootstrap()` receives only a `descriptor` parameter. Can
it express `BOOTSTRAP_FAILED`?**

No, and for a stronger reason than Q1: the single existing call site
is reached only if `await this.#performBootstrap()` resolves WITHOUT
throwing. If `#describeIdentity()` rejects (a Provider failure), the
`await` throws, `#bootstrapIdentity()`'s own function body exits via
that exception, and `this.#observeBootstrap(descriptor)` is NEVER
reached — confirmed directly by the statement order in `#bootstrapIdentity()`
quoted in §3. The current Hook's call site is structurally
UNREACHABLE on the failure path. `BOOTSTRAP_FAILED` cannot be emitted
by the Hook as it exists today under any implementation, however
clever — the call site itself never executes when Bootstrap fails.
Supporting it would require wrapping the `await` in a `try`/`catch`
that does not exist anywhere in this file.

**Q3. The current Hook is an empty, synchronous `void` function. How
would it generate the Alpha 081 three-field Event (`event`,
`timestamp`, `vocabulary`)?**

Nothing in this file constructs such an object today — there is no
Event type, no timestamp source, no object literal of this shape
anywhere in `fedos_runtime_identity.ts`. A future implementation would
need to build this three-field object entirely inside
`#observeBootstrap()`'s own body, synchronously (Alpha 077 forbids
`async`/`await` on this Hook), reading a wall-clock time source such as
`Date.now()` for `timestamp`, hard-coding the `event` name, and
selecting one of the Alpha 080 Vocabulary tokens for the third field.
This is mechanically straightforward but presently entirely absent —
zero of the three fields has any generation logic today.

**Q4. There are five Vocabulary tokens. Does one `bootstrapIdentity()`
call produce one Event or several?**

Undecided by Alpha 076–084. A single successful Bootstrap plausibly
touches at minimum two facts simultaneously — `BOOTSTRAP_COMPLETED`
(the Promise settled) and `DESCRIPTOR_PRESENT`/`DESCRIPTOR_ABSENT`
(the resolved value). The Alpha 081 Event shape fixes what ONE Event
looks like (one `event` name, one `timestamp`, one Vocabulary token)
but does not say whether the Hook's single call should emit one
combined Event or two separate Events for two simultaneous facts.
Since there is only ONE call site (per Q1/Q2, and per the Alpha 078
Ordering Decision fixing that single call site's position), a future
implementation reaching multiple Consumer notifications from that one
call would need to invoke the Consumer's own callback multiple times
synchronously from within the same `#observeBootstrap()` invocation —
a decision Alpha 076–084 never makes.

**Q5. Do `BOOTSTRAP_COMPLETED` and `DESCRIPTOR_PRESENT`/`DESCRIPTOR_ABSENT`
fire as one Event or two?**

Same unresolved question as Q4, restated for the specific pair that
would ALWAYS co-occur at the current call site — since the Hook
receives the already-resolved `descriptor`, both facts are known
simultaneously, at the same instant, from the same call. Whether that
becomes one Event carrying a single combined token, or two Events each
carrying one of the five Alpha 080 tokens, is not fixed by any of the
nine Decisions and cannot be inferred from the current empty
implementation.

**Q6. Delivery (Alpha 083) permits a synchronous Consumer notification.
May a Consumer's own exception fail Bootstrap?**

Not decided, and the current source contains no protection against
it. `#bootstrapIdentity()` has no `try`/`catch` around the
`#observeBootstrap()` call (see §3) — if a future implementation calls
a Consumer's own callback synchronously from inside
`#observeBootstrap()` and that callback throws, standard JavaScript
semantics propagate the exception straight out of
`#observeBootstrap()`, then out of `#bootstrapIdentity()`, then to
`bootstrapIdentity()`'s own caller — indistinguishable from an actual
Provider failure. Nothing in Alpha 076–084 states who is responsible
for catching that exception before it reaches this far.

**Q7. Alpha 077's Contract states the Hook itself must never throw. If
a Consumer throws inside it, who absorbs that?**

This is the same gap as Q6, phrased from the Contract's own
obligation rather than the caller's exposure. The Alpha 077 Contract
binds `#observeBootstrap()`'s OWN code to never throw — it says
nothing about a Consumer callback invoked from within it. A future
implementation that calls a Consumer synchronously must itself
introduce error-absorption logic (a `try`/`catch` around the Consumer
call, specifically) to satisfy the Alpha 077 Contract at all — and
NONE of the nine existing Decisions specifies this as a requirement.
This is not an omission this Stage can fill by inference; it requires
an explicit design decision at implementation time.

**Q8. If the Runtime generates `timestamp`, is that a new,
Platform/Mode-independent responsibility?**

Yes, and it is new. `fedos_runtime_identity.ts`'s own HARD GUARDRAILS
(the constructor comment) state the constructor "reads NO `RuntimeEnv`,
and performs NO environment classification of any kind." Reading a
wall-clock time source (`Date.now()` or equivalent) inside
`#observeBootstrap()` does not read `RuntimeEnv` and does not classify
Mode or Platform, so it does not conflict with that specific
guardrail — but it IS a capability this class does not currently
exercise anywhere (no method in the current source reads the system
clock). It would need to be explicitly authorized when implemented,
not merely assumed compatible.

**Q9. With no Consumer existing today, does generating an Event have
any value?**

No. Per Alpha 083, the Runtime "must never presuppose a Consumer
exists," and per §3, no Consumer injection point exists on this class
at all — there is no constructor parameter, setter, or field capable
of holding one. An Event constructed today, before any such injection
point exists, would have no possible recipient: it would be allocated
and then immediately discarded, satisfying Alpha 082's Lifecycle
(discard is permitted) but serving no purpose, since Alpha 082 also
establishes that Observation is not State and carries no
retention responsibility — there is nothing to keep it FOR.

**Q10. Does implementing the Framework now, with no real Consumer,
violate YAGNI?**

Yes. §3 confirms zero Consumers exist in this repository — no
Logging, Metrics, Tracing, Audit, or Telemetry implementation is
wired anywhere, and `bootstrapIdentity()` itself is, as of this
Stage, still "called by nothing anywhere in this repository" (a fact
already recorded in this file's own Alpha 058 header-comment
paragraph and unchanged through Alpha 084). Building Vocabulary/Event/
Consumer types now would mean designing a wire format and an
extension point for a peer that does not exist, cannot be tested
against anything real, and — per Q4/Q5/Q6/Q7 above — has FOUR
genuinely open design questions (multi-event handling, Consumer
exception handling, `BOOTSTRAP_STARTED` reachability,
`BOOTSTRAP_FAILED` reachability) that cannot be soundly resolved
without a concrete real-world Consumer to validate the design against.
Implementing now means guessing at the answers to four unresolved
questions and then living with those guesses in code, or freezing them
as speculative unused API — both of which contradict this project's
established practice of Fail-Closed, incrementally-verified,
zero-speculation design.

## 5. Option comparison

Five options were compared against twenty evaluation criteria (YAGNI,
whether a real Consumer exists today, impact on Bootstrap semantics,
Fail Closed, Consumer-exception handling, Observability value, test
ease, Runtime complexity, whether `FedosRuntimeIdentity` grows further,
Protocol independence, Desktop fit, Worker fit, Production fit, future
Logging/Metrics/Tracing/Audit readiness, API stability, and removal
cost vs. implementation cost).

- **Option A — Implement everything now** (Vocabulary type, Event
  type, Consumer type, Consumer injection, all five Vocabulary
  notifications). Fails YAGNI directly (§4 Q10: zero real Consumers
  exist). Would force premature answers to all four open questions
  from §4 (Q4/Q5/Q6/Q7) with no real Consumer to validate against.
  Highest implementation cost of the five options, and the highest
  future removal/rework cost if any of those forced guesses turns out
  wrong once a real Consumer arrives. Rejected.

- **Option B — Minimal Typed Seam only** (Vocabulary type, Event type,
  Consumer Interface; Hook stays empty, Consumer stays unconnected).
  Better than A — defers the STARTED/FAILED/multi-event/exception
  questions since nothing is wired — but still adds three new exported
  or file-scoped types with zero current callers, all of which are
  unused API surface the moment they land, growing
  `fedos_runtime_identity.ts` (or a sibling file) for a peer that does
  not exist yet. Still a YAGNI violation, just a smaller one than A.
  Rejected.

- **Option C — Freeze the Framework until a real Consumer appears.**
  Keeps the current empty Hook and the nine documented Decisions
  exactly as they are. Adds no type, no field, no method anywhere.
  Every one of the four open questions from §4 stays explicitly
  unresolved AND explicitly documented as unresolved (this document),
  rather than silently guessed at. Zero implementation cost, zero
  removal cost, zero new complexity, zero new API surface — the
  strongest score on every criterion that penalizes speculative work,
  and no criterion where it scores worse than B, D, or E. **Adopted —
  see §7.**

- **Option D — Delete `#observeBootstrap()` entirely.** Removes the
  Hook Alpha 076 added and simplifies `#bootstrapIdentity()`'s own
  body back to a five-statement guard/performBootstrap/completeBootstrap
  sequence. Scores well on Runtime complexity and
  `FedosRuntimeIdentity` size, but throws away nine Stages'
  worth of already-fixed, already-reviewed, zero-cost DESIGN
  constraints (§2) that cost nothing to keep and would need
  re-deriving from scratch — including the Ordering guarantee (§4 Q1)
  and the Scope/Vocabulary limits (§2 rows 4–5) that any future
  observability work would otherwise have to re-litigate. The Hook
  itself is a single empty method with a single call site; its
  removal saves negligible complexity while destroying real, cheap-to-
  keep prior work. Rejected.

- **Option E — Split Observation into a separate module.** Would
  require `FedosRuntimeIdentity` to import from, or otherwise couple
  to, a new file before any Consumer or Event type exists to justify
  the split — premature modularization for a feature that is currently
  a single empty method with a single call site. Increases file count
  and import surface for zero present behavior change. Rejected.

## 6. `FedosRuntimeIdentity` bloat audit

The full private pipeline, inventoried directly from §3 and the
actual class body, classified per the categories this Stage's own
instructions specify:

| Method | Classification |
|---|---|
| `#bootstrapIdentity()` | Independent responsibility — owns the idempotency guard and orchestrates the Bootstrap/Observe/Complete sequence; not a pure delegation. |
| `#performBootstrap()` | Simple delegation, reduction candidate — its ENTIRE body is `return this.#acquireDescriptor();`, one statement, no branching, no state of its own. |
| `#acquireDescriptor()` | Simple delegation, reduction candidate — its ENTIRE body is `return this.#describeIdentity();`, one statement, no `await`, no branching. |
| `#describeIdentity()` | Simple delegation, but a reasonable future extension point — it is the sole Runtime/Identity-Layer reader boundary Alpha 068 deliberately consolidated onto; unlike the two rows above, this one has a documented architectural reason to exist as its own named unit. |
| `#observeBootstrap()` | Observation-only. |
| `#completeBootstrap()` | Bootstrap-state-only — the sole writer of `#descriptor`/`#bootstrapped`. |
| `#isBootstrapped()` | Bootstrap-state-only / needed as the Public wrapper's own backing — the sole reader of `#bootstrapped`. |
| `#currentIdentity()` | Bootstrap-state-only / needed as the Public wrapper's own backing — the sole reader of `#descriptor`. |

**Finding:** two of the eight private methods — `#performBootstrap()`
and `#acquireDescriptor()` — are genuine one-line delegation chains
added by two separate, purely structural Stages (Alpha 074, Alpha
075) for single-reader/single-caller discipline, not for any
independent behavior. This is a real, already-existing fragmentation
concern in `FedosRuntimeIdentity`, entirely separate from the
Observation Framework itself (neither method has anything to do with
Observation). The Observation Framework's OWN contribution to this
class is exactly ONE method, `#observeBootstrap()`, with a single
one-line empty body — Observation itself is not a source of the
fragmentation found here. Per this Stage's own instruction, no
deletion or consolidation is performed now; this finding is recorded
for a future Stage's own consideration (see §9's Alpha 086
recommendation).

## 7. Decision

**Option C is adopted: freeze the Identity Bootstrap Observation
Framework exactly as Alpha 076–084 left it, until a real Consumer
exists.**

Rationale, drawn directly from §4 and §5: zero real Consumers exist in
this repository today (§4 Q9/Q10); the current empty Hook does not
change Bootstrap semantics in any way and costs nothing to keep as-is;
four genuinely open design questions (§4 Q1/Q2 reachability of
`BOOTSTRAP_STARTED`/`BOOTSTRAP_FAILED`, Q4/Q5 multi-event handling, and
Q6/Q7 Consumer-exception handling) cannot be soundly resolved without
a concrete real Consumer to validate against; and the nine already-
fixed Decisions (§2) remain fully sufficient as constraints on
whatever future implementation eventually answers those four
questions — nothing about freezing the Framework weakens or discards
any of the nine.

## 8. Completion Declaration

- The Identity Bootstrap Observation Framework's Design Phase is
  hereby declared **COMPLETE**.
- Alpha 076 through Alpha 084 are frozen as ONE integrated Framework —
  Boundary, Contract, Ordering, Scope, Vocabulary, Event Shape,
  Lifecycle, Delivery Responsibility, and Consumer Boundary — all nine
  Decisions remain in force, unchanged, and binding on any future
  implementation.
- **No further implementation occurs until a real Consumer exists.**
  `#observeBootstrap()` remains the empty Hook Alpha 076 left it.
- **No new Observation Review Stage may be added past this one.** The
  nine-element enumeration in §2 is final. Any future work on
  Observation is IMPLEMENTATION against these nine Decisions, governed
  by this document's own resumption conditions below — not a new
  Review Stage adding a tenth dimension.

### Resumption conditions

Implementation resumes ONLY when at least one of the following becomes
true:

1. A Desktop shell is implemented (the Alpha 059-designated Bootstrap
   Authority actually exists and calls `bootstrapIdentity()`).
2. A concrete Logging, Metrics, or Audit Consumer is actually required
   by a real feature — not hypothetically, but as a named, scoped
   requirement.
3. A Production observability requirement is formally defined for this
   Runtime.
4. Observing a Bootstrap failure becomes operationally necessary — not
   merely convenient — for a real, running system.

Until one of these four is true, this Framework stays exactly as
Alpha 076–084 and this Stage leave it: nine Decisions, one empty Hook,
zero types, zero Consumers.

## 9. Alpha 086 recommendation

**Desktop Integration Boundary Review.**

Not another Observation Stage — none is recommended, consistent with
§8's own Completion Declaration. Of the four permitted candidates,
Desktop Integration Boundary Review is the closest match to FedOS's
actual purpose: a Secure Runtime/Identity foundation supporting DM,
digital content sales, and bulletin-board features — not a project
whose goal is the Observation Framework itself. `bootstrapIdentity()`
has been callable since Alpha 058 and Alpha 059 formally designated
Desktop Application startup as its Authority, yet as of this Stage it
remains, verbatim from this file's own header comment, "called by
nothing anywhere in this repository." Reviewing that actual
integration boundary — what a Desktop caller may assume, what it must
provide, how it should react to a Bootstrap rejection — is the direct
prerequisite for Identity Bootstrap to do anything useful in a running
application at all, and it is also Resumption Condition #1 from §8:
reviewing this boundary now is preparatory work for the same milestone
that would eventually unfreeze Observation. The internal-pipeline
fragmentation finding in §6 (`#performBootstrap()`/`#acquireDescriptor()`
as reduction candidates) is real but lower priority — it is
code-quality work with no effect on whether Identity Bootstrap is
ever actually reached by a caller, which the Desktop boundary question
resolves first.

## 10. What this Stage does NOT do

- Does **not** add any Observation type — no Vocabulary type, no Event
  type, no Consumer interface, of any kind.
- Does **not** modify `src/runtime/fedos_runtime_identity.ts` — no
  header comment, no field, no method. `src/` is untouched entirely by
  this Stage.
- Does **not** modify `src/runtime/create_runtime.ts` or `AppRuntime`.
- Does **not** modify `src/worker.ts`.
- Does **not** modify any `src/identity/*` file.
- Does **not** modify any Storage or Crypto file.
- Does **not** modify `packages/fedos-core-rust`, `Cargo.toml`, or
  `package.json`.
- Does **not** implement Desktop, Nostr, Relay connections, Logging,
  Metrics, or Telemetry of any kind.
- Does **not** add a tenth Observation Review Stage, and forbids any
  future Stage from adding one under this Framework's own name.

## 11. See also

- `docs/secure_runtime_alpha_076_identity_bootstrap_observation_boundary.md`
- `docs/secure_runtime_alpha_077_identity_bootstrap_observation_contract.md`
- `docs/secure_runtime_alpha_078_identity_bootstrap_observation_ordering_review.md`
- `docs/secure_runtime_alpha_079_identity_bootstrap_observation_scope_review.md`
- `docs/secure_runtime_alpha_080_identity_bootstrap_observation_vocabulary_review.md`
- `docs/secure_runtime_alpha_081_identity_bootstrap_observation_event_review.md`
- `docs/secure_runtime_alpha_082_identity_bootstrap_observation_event_lifecycle_review.md`
- `docs/secure_runtime_alpha_083_identity_bootstrap_observation_delivery_review.md`
- `docs/secure_runtime_alpha_084_identity_bootstrap_observation_consumer_boundary_review.md`
- `docs/secure_runtime_alpha_058_identity_bootstrap_boundary.md`
- `docs/secure_runtime_alpha_059_identity_bootstrap_authority_review.md`
