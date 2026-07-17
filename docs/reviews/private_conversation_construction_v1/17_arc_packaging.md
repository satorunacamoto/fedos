# Review 17 — Direct/Group Packaging

## Options, per this review's own required list

**Option A — readiness gate only.** Implement `02`/`03` (the nine
axes and the closed result vocabulary) as a real, callable
`FedosConversationConstructionReadinessAuthority`, with NO actual
construction command wired to anything. A caller can ask "would
construction succeed" and get an honest answer, but cannot actually
construct.

**Option B — readiness + construction records for both modes.**
Implement `02`/`03` PLUS `04`/`05`/`06`/`07`/`09`/`10`/`11`/`12`/`13`
in full — real `private-group` and `direct` construction, both modes,
Draft/Active lifecycle, coordination-recoverable persistence, the new
`FedosConversationRuntime` boundary. Requires the two structural
blockers `01`/`07` name (Conversation Record validator, Conversation
Policy validator) to be lifted FIRST, by this same Arc, as prerequisite
steps — a production source change this review cannot make but the
NEXT Arc explicitly can.

**Option C — direct only.** Option B's scope, narrowed to `05`/`06`/`11`(Path
B only)/`12`/`13`, omitting `04`'s general-Capability private-group
path entirely.

**Option D — private-group only.** The mirror of C — `04`/`06`/`11`(Path
A)/`12`/`13`, omitting `05`.

**Option E — both modes + message sending.** Option B's scope plus a
private message send/receive command. **REJECTED, per this review's
own explicit instruction** — message sending is the sibling
`private_message_envelope_v1` scope's own subject matter, not this
review's, and per `18`'s own boundary, construction must remain
independent of protocol publishing; folding message-send into this
Arc would also require solving `08`'s encryption gate for real, which
`01` confirms is blocked on a WASM artifact this review has no path to
produce.

## Recommendation: Option B, the largest safe package — with two prerequisite steps named explicitly

Given current source (`01`), Option B is buildable IF, and only if, the
next Arc FIRST performs two narrow, additive, non-redesigning changes
this review is itself forbidden from making but can specify precisely:

1. Widen `validateFedosConversationRecord()`
   (`src/conversation/fedos_conversation_record_validator.ts`) to
   accept `mode: "private-group" | "direct"` in addition to
   `"public"` — an ADDITIVE change to one `if` condition, not a
   redesign; every existing `"public"`-mode test and behavior is
   unaffected (the function's own existing structure already threads
   `mode` through as a plain field).
2. Add a real per-Conversation `FedosConversationPolicyAuthority`
   implementation capable of resolving `07`'s private-group/direct
   policy values, alongside (never replacing)
   `StaticFedosConversationPolicyAuthority` — plus widen
   `validateFedosConversationPolicy()` to accept the new
   `readAccess`/`inviteAuthority` values `07` names as currently
   missing from their respective closed vocabularies.

Neither of these two prerequisite steps requires encryption, requires
touching `src/crypto`/`src/runtime`, or requires resolving `16`'s named
ownership-transfer gap — both are pure type/validator widenings plus
one new Authority implementation, matching this codebase's own
"additive, never redesigning accepted architecture" discipline
throughout Alpha 761–850's own history (every one of which added a NEW
file/class rather than editing an existing frozen interface, confirmed
repeatedly in `01`).

## Why not C or D alone

Both `direct` and `private-group` share `06` (creator Membership),
`07`'s general axis structure (even though the SPECIFIC values differ),
`08`/`09` (encryption gate, draft/active), `10` (persistence
coordination pattern), `12` (runtime ownership), and `13` (read API) —
implementing only one mode would still require building ALL of that
shared infrastructure, for a marginal savings of only `04` XOR `05`'s
own narrower command-shape work. The shared infrastructure is the
expensive, load-bearing part; the mode-specific command shapes are
comparatively small. Splitting them into two separate Arcs would
create an artificial midpoint with no real reduction in the hard work,
matching this review's own "reject artificial splits that don't
reduce risk" instinct, consistent with `20`'s own recommendation.
