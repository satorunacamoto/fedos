# Secure Runtime Alpha 821-850 Execution Spec (verbatim)

This file is copied verbatim from the task specification given for this
Arc, per that specification's own "Prompt Integrity Requirement" section.
It is committed as this Arc's own documentation.

```
This repository is now architecture-frozen.

Do not redesign previously accepted layers.

Only extend existing boundaries.

Do not rename existing public interfaces unless a reviewed
architectural defect makes it strictly necessary.

Minimize ripple.

Prefer adapters over replacements.

AUTO MODE EXECUTION RULES

The repository is architecture-frozen.

Do not redesign accepted architecture.

Prefer additive implementation.

Prefer adapters instead of replacing interfaces.

Never broaden scope.

Never introduce new dependencies unless explicitly instructed.

Never touch unrelated layers.

Minimize ripple.

If a reviewed blocker is found,
stop exactly at that boundary and document it honestly.

Never invent future architecture.

If a task becomes impossible because of a missing prerequisite,
complete every implementable part and stop precisely at the blocker.

One commit only.

No speculative abstractions.

# Secure Runtime Alpha 821–850
# Durable Conversation Membership & Capability Persistence Arc

Complete Alpha 821–850 as one coordinated Arc and one commit.

This task must run in a dedicated Git worktree and branch.

==================================================
AUTO MODE WORKTREE SAFETY
==================================================

At startup, run:

pwd
git rev-parse --show-toplevel
git branch --show-current
git status --short
git log --oneline -15
git worktree list

Use paths relative to the current worktree only.

Never edit, stage, commit, reset, stash, clean or checkout files in:
- the main worktree
- another worktree
- root-level p2p/

Do not run git add -A across the repository.

Stage the exact intended paths only.

Before commit, verify:

git diff --cached --name-status
git diff --cached --stat

If any foreign file is staged, stop and unstage only that foreign file.
Do not reset unrelated work.

==================================================
PROMPT INTEGRITY REQUIREMENT
==================================================

Before implementation, copy this entire task specification verbatim into:

docs/secure_runtime_alpha_821_850_execution_spec.md

Then verify that the file contains headings Alpha 821 through Alpha 850.

Run a check equivalent to:

for n in $(seq 821 850); do
  grep -q "Alpha $n" docs/secure_runtime_alpha_821_850_execution_spec.md ||
    echo "MISSING Alpha $n"
done

If any stage is missing, stop before production changes.

This execution-spec file is part of this Arc's documentation and may be
committed.

==================================================
PRECONDITION INTEGRATION AUTHORIZATION
==================================================

The required prerequisites may exist on separate sibling branches.

You are authorized to create one dedicated integration branch/worktree for
this Arc only and merge only the required prerequisite branches.

Required source state:

- Alpha 641–680 Public Identity / Conversation Policy
- Alpha 681–720 Nostr Identity Binding / Delivery Activation
- Alpha 721–740 Relay ACK / Permanent Rejection
- Alpha 741–760 Canonical Conversation Identity / Record
- Alpha 761–790 Membership & Capability Foundation
- Alpha 791–820 Retention & Private Payload Storage Foundation
- Private Conversation Security Review
- Conversation Foundation V1 Specification Review

Known relevant commits include:

- 40b5bd6
  Alpha 761–790 Membership & Capability Foundation

- dd7149f
  Alpha 791–820 Retention & Private Payload Storage

Use actual branch/commit discovery rather than assuming names.

Integration rules:

1. Merge only required prerequisite branches.
2. Do not merge unrelated branches.
3. Resolve README Status conflicts chronologically.
4. Preserve every prior status/history entry; do not silently delete one Arc.
5. Do not modify production design during prerequisite integration.
6. Report every merge performed.
7. After integration, run typecheck and focused prerequisite tests before
   beginning Alpha 821.
8. If source-level conflicts exist outside README or mechanical async/ripple
   updates, stop and report them.

==================================================
OBJECTIVE
==================================================

Close the primary durability blocker left by Alpha 761–790.

Current limitations:

- Membership Authority is in-memory only.
- Capability Authority is in-memory only.
- Capability bearer verification and use count do not survive restart.
- "Exactly once" redemption exists only within one process instance.
- Capability consumption and Membership admission cross two authorities.
- A crash between those writes may leave inconsistent state.
- Private Conversation construction must remain disabled until these facts
  become durable and recoverable.

Implement:

- versioned Membership persistence
- durable Membership Authority
- versioned Capability persistence
- safe bearer verification persistence
- durable Capability Authority
- restart-stable use counts and exhaustion
- recoverable Capability-to-Membership coordination
- honest corruption/failure semantics
- optional ownership/injection boundaries where currently justified

Do not create private messages or enable private/direct Conversations.

Target architecture:

Conversation Record
    ↓
Durable Membership Authority
    ↓
Durable Capability Authority
    ↓
Redemption Coordinator
    ↓
Membership Admission
    ↓
Restart-Stable State

==================================================
ABSOLUTE PROHIBITIONS
==================================================

Do not implement:

- private-group creation
- direct Conversation / DM
- private message envelope
- encryption or decryption
- key distribution
- group keys
- key epochs
- invitation URLs
- QR codes
- HTTP invitation endpoints
- distributed consensus
- multi-node redemption
- global exactly-once claims
- GUI
- Worker integration
- Relay or Publisher integration
- ActivityPub / AT Protocol / Session outbound
- Ontology
- Humanizer or AI
- Lightning
- NIP-13
- JA3 / JA4
- CrowdSec
- new npm dependencies
- new Cargo dependencies
- Rust changes
- Conversation Record V1 redesign
- Board persistence redesign
- Payload Storage redesign
- compaction
- physical-erasure claims

Do not modify, stage, enter or import root-level p2p/.

==================================================
ALREADY COMPLETE — DO NOT REDESIGN
==================================================

- Conversation Participant Reference
- Membership identity
- Membership roles and states
- Membership transition rules
- Membership Authority public contract
- In-memory Membership Authority
- Capability public descriptor
- opaque bearer-secret separation
- Capability issuance/redemption result vocabularies
- In-memory Capability Authority
- process-local exactly-once semantics
- Capability-to-Membership coordination
- Conversation Record persistence
- opaque Payload Storage
- Retention/tombstone semantics

==================================================
PHASE A — INVENTORY AND AUTHORITY
==================================================

## Alpha 821 — Membership Durability Inventory

Inspect actual production source and tests.

Determine:

1. authoritative Membership facts
2. derived/cache-only state
3. all current transition methods
4. stable Membership identity
5. required persisted fields
6. timestamp conventions
7. failure/result conventions
8. current immutable-copy behavior
9. exact public interfaces to preserve
10. expected ripple files

Do not change production source before this inventory is documented.

## Alpha 822 — Capability Durability Inventory

Determine:

1. canonical public descriptor facts
2. bearer-secret representation
3. current secret verification mechanism
4. use-count/exhaustion authority
5. expiry authority
6. intended-recipient enforcement
7. duplicate-redemption handling
8. what is lost on restart
9. whether secret material is currently serializable
10. expected ripple files

## Alpha 823 — Persistence Ownership Decision

Compare:

A. Authorities directly own filesystem persistence
B. dedicated persistence ports injected into Authorities
C. Host reads/writes raw Membership/Capability records
D. reuse Conversation Persistence

Adopt B unless actual code proves it incompatible.

Rules:

- Do not widen Conversation Persistence.
- Host must not understand record schemas.
- Raw persistence ports do not own domain transitions.
- Prefer new durable adapters over replacing in-memory implementations.

## Alpha 824 — Cross-Authority Coordination Decision

Capability consumption and Membership admission are separate writes.

Compare:

A. consume Capability first
B. admit Membership first
C. one shared generic transaction framework
D. dedicated narrow redemption-coordination record and recovery path
E. claim atomicity without rollback/recovery

Reject C unless an existing transaction abstraction already exists.
Reject E unconditionally.

Adopt the smallest domain-specific recoverable solution.

==================================================
PHASE B — MEMBERSHIP PERSISTENCE
==================================================

## Alpha 825 — Persisted Membership Record V1

Define a versioned plain-data record with only necessary fields:

- schemaVersion: 1
- membershipId
- conversationId
- participant reference
- role
- state
- joinedAt
- endedAt or null

No secret, display profile, payload, invitation or arbitrary metadata.

## Alpha 826 — Membership Codec

Implement a fail-closed codec.

Requirements:

- exact schema version
- exact top-level and nested fields
- unknown fields rejected
- malformed input returns null and never escapes an exception
- validation reuses existing Membership validators
- deep immutable output
- round-trip structural equality
- no silent migration or repair

## Alpha 827 — Membership Persistence Port

Introduce a dedicated port with the smallest necessary API:

- putMembership
- getMembership
- listMemberships
- listConversationMemberships

Use explicit outcomes:

- inserted
- already-present
- conflict
- failed

No delete method.

The raw port must not perform Membership transitions.

## Alpha 828 — In-Memory Membership Persistence

Implement a persisted-record backend distinct from the existing domain
Authority.

Verify:

- insertion
- idempotency
- conflict without overwrite
- immutable reads
- independent instances
- Conversation filtering
- no transition logic duplication

## Alpha 829 — Append-Only Membership Persistence

Implement a zero-dependency durable backend following existing repository
precedent.

Requirements:

- caller-supplied path
- append-only
- no rewrite/delete/compaction
- versioned records
- malformed line fails closed
- unknown schema fails closed
- trailing partial-write policy documented
- no automatic repair
- deterministic replay
- no new dependency

## Alpha 830 — Durable Membership Authority

Create an adapter/new implementation preserving the existing public Authority
contract where possible.

Requirements:

- preview transition before durable write
- existing transition graph unchanged
- no partial in-memory mutation before durable success
- durable conflict/failure reported explicitly
- returned records immutable
- no global/static state
- restart-stable state

## Alpha 831 — Membership Restart Verification

With a fresh Authority instance over the same backend, verify:

- active state
- revoked state
- left state
- role
- timestamps
- deterministic membership identity
- duplicate admission
- invalid resurrection remains rejected

## Alpha 832 — Membership Corruption Semantics

Compare strict whole-backend failure against per-record diagnostic behavior.

Follow existing project precedent and choose one honestly.

Do not silently skip malformed Membership records if doing so could restore a
revoked participant as absent/eligible.

Document the exact fail-closed behavior.

==================================================
PHASE C — CAPABILITY PERSISTENCE
==================================================

## Alpha 833 — Persisted Capability Facts

Define which public facts are durable:

- capabilityId
- conversationId
- action
- issuer reference
- intended recipient or null
- maxUses
- issuedAt
- expiresAt
- current use/exhaustion facts, according to selected state model

Do not store the plaintext bearer in the public descriptor.

## Alpha 834 — Bearer Verification Persistence Decision

Compare:

A. plaintext bearer persistence
B. one-way verifier persistence
C. OS secret-store handle
D. deterministic regeneration
E. invalidate all Capabilities on restart

Reject plaintext storage unless an already-reviewed contract explicitly
requires it.
Reject deterministic regeneration without an existing secure design.

Prefer a one-way verifier using an already-installed, reviewed primitive with
no dependency change.

If no safe verifier is possible in this scope:

- complete Membership persistence
- complete non-secret Capability descriptor/state persistence
- stop exactly at bearer-verifier durability
- do not fake restart-stable redemption

## Alpha 835 — Bearer Verifier Boundary

If feasible, implement a narrow boundary:

- deriveVerifier(bearer)
- matchesVerifier(verifier, bearer)

Requirements:

- verifier cannot be used directly as a bearer
- no bearer logging
- defensive copies
- constant-time comparison where applicable
- closed encoded verifier format
- no generic password framework
- no new crypto algorithm
- no new dependency

## Alpha 836 — Capability Codec V1

Implement a versioned fail-closed codec.

Validate:

- exact fields
- schemaVersion
- timestamps
- maxUses > 0
- currentUses bounds
- expiry ordering
- intended recipient
- verifier format
- action vocabulary
- state/event consistency

Never serialize or return the plaintext bearer.

## Alpha 837 — Capability Persistence Port

The port must support evolving use state.

Minimum read operations:

- getCapability
- listCapabilities
- listConversationCapabilities

Choose an honest append model for writes.

Do not use a simple immutable insert-only port if redemptions must update state.

## Alpha 838 — Capability State Representation Decision

Compare:

A. mutable rewritten snapshot
B. append-only full snapshots
C. append-only immutable events such as issued/redeemed/exhausted/revoked
D. unrelated Observation system

Prefer B or C based on the repository's existing replay conventions.

Define:

- ordering
- duplicate event behavior
- conflict behavior
- current-state reconstruction
- corruption behavior

Do not invent a generic event-sourcing framework.

## Alpha 839 — In-Memory Capability Persistence

Implement selected semantics.

Verify:

- issue
- duplicate issue
- bearer verification
- one redemption
- multiple use count if supported
- exhaustion
- expiry
- intended recipient
- duplicate redemption
- immutable reads
- independent instances

## Alpha 840 — Append-Only Capability Persistence

Implement a durable, zero-dependency backend.

Requirements:

- caller-supplied path
- append-only
- deterministic replay
- no plaintext bearer
- malformed record fails closed
- use count cannot decrease
- exhaustion cannot reverse
- no automatic repair
- no compaction
- no path traversal
- no dependency change

## Alpha 841 — Durable Capability Authority

Create an adapter/new implementation preserving the established public
contract as far as possible.

Responsibilities:

- issue
- persist verifier and descriptor/state
- verify bearer
- expiry
- intended recipient
- use count
- exhaustion
- restart-stable duplicate rejection

Do not claim distributed exactly-once.

## Alpha 842 — Capability Restart Verification

Using fresh instances over the same backend, verify:

- descriptor
- verifier
- expiry
- intended recipient
- current use count
- exhaustion
- duplicate redemption rejection
- wrong bearer rejection
- no bearer exposure

==================================================
PHASE D — RECOVERABLE REDEMPTION
==================================================

## Alpha 843 — Redemption Coordination Record

If required by Alpha 824, define a narrow versioned coordination record.

Candidate phases:

- prepared
- capability-consumed
- membership-admitted
- completed
- terminal-failed

Store only:

- coordinationId
- capabilityId
- conversationId
- participant/membership identity
- phase
- timestamps as required

No bearer secret.
No generic arbitrary payload.
No general saga abstraction.

## Alpha 844 — Coordination Persistence

Add a dedicated minimal persistence port only if the recovery algorithm needs
durable coordination facts.

Implement in-memory and append-only variants only when both are actual
consumers of the coordinator.

Do not overload Membership or Capability records with unrelated state.

## Alpha 845 — Durable Redemption Coordinator

Implement:

redeemAndAdmit(...)

Required conceptual order:

1. validate bearer without mutation
2. validate Capability state/expiry/recipient
3. preview Membership admission
4. persist prepared coordination fact if selected
5. durably consume Capability
6. durably admit Membership
7. persist completed fact
8. return a closed result

No fake rollback.

If a step fails, return the precise coarse outcome and preserve enough facts
for restart recovery.

## Alpha 846 — Crash-Window Recovery

Test interruption at every meaningful boundary:

- before prepared
- after prepared
- after Capability consumption
- before Membership admission
- after Membership admission
- before completion marker

A fresh coordinator must converge safely.

Requirements:

- no duplicate active Membership
- confirmed Capability consumption is never silently restored
- already-admitted Membership is recognized idempotently
- no infinite recovery loop
- corrupted coordination state fails closed

## Alpha 847 — Exactly-Once Contract

Document and test the exact guarantee.

May claim:

- restart-stable, idempotent redemption within one authoritative durable
  backend set and one supported writer model

Must not claim:

- distributed exactly-once
- safety across independent writable replicas
- global instantaneous invalidation
- network consensus
- multi-process safety unless actual locking exists

If concurrent writers are unsupported, state that clearly.

## Alpha 848 — Ownership and Activation Decision

Because private Conversation commands still do not exist, compare:

A. ports/backends/coordinator only
B. optional injected durable Authorities
C. default Local Runtime construction

Prefer A or B unless there is a real production caller.

Do not add unused runtime timers/resources.
Do not expose bearer secrets through serializable Runtime config.
Do not add private commands.

## Alpha 849 — End-to-End Durable Verification

Real filesystem-backed path:

1. create a durable public Conversation fixture
2. create durable issuer Membership
3. issue a join Capability
4. stop all instances
5. create fresh Authorities
6. redeem Capability for intended participant
7. Membership becomes active
8. stop
9. create another fresh set
10. repeated redemption is rejected/idempotent
11. revoke Membership
12. restart
13. revocation remains durable

Also test:

- wrong bearer
- expiry
- recipient mismatch
- Capability exhaustion
- Membership conflict
- corruption
- crash-window recovery
- independent backend sets
- no cross-contamination

Do not create a private message.

## Alpha 850 — Completion Declaration

Declare complete only what real execution proves:

- Membership V1 persistence
- durable Membership Authority
- Capability V1 persistence
- safe bearer-verifier durability
- durable Capability Authority
- restart-stable local redemption
- recoverable Capability-to-Membership coordination
- explicit corruption semantics
- no secret leakage
- honest exactly-once boundary
- public mode unaffected

If bearer durability or recoverable coordination remains blocked, state the
exact completed subset and blocker in both documentation and commit title.

Still out of scope:

- distributed/multi-writer redemption
- invitation URLs
- transport
- private Conversation construction
- private message envelope
- encryption/key distribution
- direct/DM
- private groups
- GUI
- Worker
- protocol mapping
- Ontology/AI

Recommend exactly one next Arc based on actual result.

Preferred if fully complete:

Conversation Private Readiness Gate & Private Construction Foundation Arc

Preferred if encryption remains the next independent blocker:

Private Message Envelope Foundation Arc

==================================================
EXPECTED PRODUCTION AREAS
==================================================

Prefer new files under:

src/conversation/membership/persistence/
src/conversation/capability/persistence/
src/conversation/capability/coordination/

Modify existing Authorities through adapters/additive constructor
injection.

Do not redesign existing Conversation or Payload Storage records.

README update.

Create documentation and tests covering every Alpha 821–850 stage.

==================================================
VERIFICATION
==================================================

Capture a baseline in this exact integrated worktree before production
edits.

Run sequentially, never concurrently:

npm run typecheck
focused prerequisite tests
focused new tests
npm test

Rust should remain unchanged. If so, do not run cargo.

Known-failure discipline:

- record exact baseline failing test names
- compare exact final names
- rerun flaky/time-sensitive tests alone
- do not reuse counts from another worktree
- do not call failures pre-existing without local evidence

Confirm:

- dependencies unchanged
- Cargo unchanged
- p2p untouched
- no raw bearer in git diff
- no secrets in logs/docs/test fixtures
- temporary log directories removed
- no generated artifacts
- main and sibling worktrees untouched

==================================================
COMMIT
==================================================

One commit only.

Preferred title:

Add Secure Runtime Alpha 821-850: Durable Conversation Membership and
Capability Persistence Arc

If partially blocked, use an honest title naming the exact completed
phase and
blocker.

Completion Report must include:

- integration merges performed
- branch/worktree
- commit hash
- changed files
- Membership persistence design
- Capability state/verifier design
- coordinator/crash recovery design
- exactly-once guarantee and exclusions
- ripple files
- typecheck
- focused/full test baseline comparison
- dependency/Cargo status
- p2p untouched
- secret/artifact cleanup
- remaining blockers
- exactly one next Arc recommendation
```
