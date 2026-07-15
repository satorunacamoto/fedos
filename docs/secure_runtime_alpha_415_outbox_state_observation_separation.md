# Secure Runtime Alpha 415 — Outbox State and Observation Separation

**Status: this Stage is REVIEW/DECISION ONLY — it introduces NO new
type and NO new persistence method.** Stage 5 of the Alpha 411–420
Canonical Board Durable Outbox Foundation Arc.

## 1. Candidates compared

- **Option A — mutable status inside the Outbox intent.** Add a
  `status` field to `FedosBoardOutboxIntent` that a future publisher
  overwrites in place.
- **Option B — separate, append-only delivery observation records.**
  Keep the intent immutable; a future, SEPARATE record type names each
  delivery attempt's own outcome as a historical fact.
- **Option C — overwrite the Outbox intent after each attempt.**
- **Option D — no future state model at all.**

## 2. Evaluation

**Option A/C are rejected**, for the identical reason Alpha 412 already
rejected mutable delivery state inside `FedosBoardPost`: an intent is a
REQUEST, not a running status; overwriting it after an attempt destroys
the original request's own audit trail and makes "how many times, and
when, was this actually attempted" unanswerable from durable state.

**Option D is rejected**: naming no future shape at all would leave a
genuine future consumer (a per-protocol publisher) free to invent an
incompatible, ad hoc shape per protocol — exactly the fragmentation
Alpha 412 §2 already rejected for intents.

**Option B — adopted**, exactly as this Arc's own required preferred
candidate names.

## 3. Permanent rule

**Intent is an authoritative delivery REQUEST. Observations are derived
historical FACTS and never rewrite the intent.** This rule binds every
future Arc that touches the Outbox, not only this one.

Candidate future observation kinds, named as VOCABULARY ONLY this Arc —
`queued`, `attempt-started`, `delivered`, `rejected`, `failed`,
`abandoned` — are NOT implemented as a TypeScript type, NOT given a
persisted record schema, and NOT added to `FedosBoardOutboxPersistence`
in this Arc.

## 4. Why this Arc implements NO observation code at all

This Arc's own instruction permits observation code only when "a
minimal foundation is strictly required," and requires any state type
introduced to "remain separate and inert." This Stage's own conclusion:
**no observation code is strictly required this Arc.** The only
consumer that would ever WRITE an observation is a protocol-specific
publisher — none exists yet, and this Arc's own Absolute Prohibitions
forbid implementing one (`ActivityPub outbound delivery`, `AT Protocol
outbound implementation`, `Session outbound implementation`, and — per
the Alpha 421 inventory finding this Arc also completed — the
cryptographic signing boundary needed even for the reference Nostr
publisher is not reachable from TypeScript today without a new Rust/WASM
export or a duplicated signing stack, both explicitly prohibited; see
`docs/secure_runtime_alpha_421_existing_nostr_outbound_construction_inventory.md`).
Introducing an unused observation type and an unused, untested
persistence method now would be dead code with no real caller — this
repository's own established discipline (`FedosBoardPersistence` itself
carries no method nothing calls) counsels against that.

`FedosBoardOutboxPersistence` (Alpha 417) therefore ships with EXACTLY
`putIntent`/`getIntent`/`listIntents` — no `putObservation`, no
`listObservations`, this Arc. Adding them remains a small, additive,
non-breaking change for whichever future Arc actually gains a publisher
that needs to write one.

## 5. No automatic retry policy

This Arc introduces NO retry policy, scheduled or automatic, of any
kind — not even as an inert type. Retry/backoff is out of scope for
every future Arc until explicitly scoped in.

## 6. See also

- `docs/secure_runtime_alpha_412_outbox_responsibility_decision.md`
- `docs/secure_runtime_alpha_417_outbox_persistence_port_memory_backend.md`
- `docs/secure_runtime_alpha_421_existing_nostr_outbound_construction_inventory.md`
