# Review 20 — Normative Next-Arc Recommendation

This document is the single normative reference for this review's own
recommendation, mirroring the discipline `private_message_envelope_v1/20_normative_next_arc.md`
and `private_conversation_construction_v1/20_normative_next_arc.md`
already established: where it repeats a conclusion from `01`–`19`, this
document governs.

## Confirmed state, restated once, plainly

As of this review's own base commit (`d15a107`, with `f7fbb67` observed
and confirmed immaterial, `01`): the Identity Resolution/Encryption
Coordinator blocker (Alpha 890's own named gap) **is resolved** — real
identity/key resolution exists and is wired end-to-end. The blocker
that remains, unchanged across every branch this review inspected, is
structural and singular: **nothing in this repository can construct an
`"active"` Conversation.** `19`'s own dependency graph shows every
protocol-delivery and group-crypto package sitting downstream of this
one fact.

## Conditional recommendation, per the task's own required framing

**If a future Alpha 1111–1180 (or equivalently-scoped) Arc proves real
direct messaging** — meaning it ships a reviewed draft-to-active
lifecycle transition and at least one message round-trips through
`FedosConversationEncryptionCoordinator`/`DecryptionCoordinator` for a
real, active Conversation: this review recommends the next Arc be
**Package B — Generic Private Outbox Eligibility** (`09`/`10`/`11`/`12`/`13`),
not Package A (a Nostr adapter) and not any group package. Reasoning:
B has zero protocol-specific dependency (`19`), can be fully
implemented and tested against the now-real active-Conversation path
without resolving any of `04`'s open NIP-17/NIP-59 research questions,
and its own Observation/retry half is **already proven, reusable
architecture** (`10`/`12`) — the smallest package that turns "encryption
works" into "a private message has a durable, observable, protocol-
neutral send lifecycle," which every subsequent protocol adapter (A) or
group scheme (C/D) needs as its own foundation regardless of which
protocol or group strategy is chosen next.

**If active direct messaging remains blocked** (the confirmed state as
of this review's own commit): this review recommends the exact fix
named by `19`'s own root-blocker analysis — **a reviewed Arc that
designs and implements the draft-to-active lifecycle transition
command** for `direct` Conversations specifically (not
`private-group` — `15`/`16` both name group activation as
categorically premature ahead of a chosen group strategy). This is not
a new invention of this review: `private_conversation_construction_v1/09_draft_vs_active.md`
already named this as "a future command, not designed here," and
`fedos_conversation_managed_draft_state.ts` (`01`, inspected via
`git show 50082bc:...`) confirms the most recent sibling Arc to touch
draft lifecycle explicitly excluded activation from its own scope
too — three consecutive Arcs now have correctly deferred this exact
operation rather than inventing it inline, and this review recommends
the next Arc be the one that finally builds it, scoped narrowly:
validate every readiness axis `fedos_conversation_readiness.ts`'s own
`activation-ready` check already requires (`01`), persist the
transition, and change nothing about the Coordinators, Envelope, or
Membership models the Alpha 851–990 work already froze.

## For group messaging

**Recommend against implementing any group encryption strategy in the
next Arc, unconditionally.** No honest V1 is ready to build yet: `16`'s
own pairwise-fanout interim design requires a widened participant
resolver that does not exist and is not itself a small, low-risk change
(it touches the exact Identity-domain boundary `14` confirms was only
just closed for the single-recipient case) — building it before even
one single-recipient private message has ever been sent end-to-end
(the root blocker, above) would be building on top of a foundation
this review cannot confirm is solid in practice, only on paper.
**Explicitly retain draft-only `private-group`** — every finding in
`14`–`18` stands as a specification for a *future* Arc, not an
authorization for the next one.

## The single immediately applicable next Arc, after rebase

**The draft-to-active lifecycle transition Arc for `direct`
Conversations**, scoped exactly as described above. This is the one
recommendation in this document that does not branch on Alpha
1111–1180's own outcome, because it IS what closes the question that
conditional branches on — matching the "exactly one immediately
applicable next Arc" instruction. Package B (Generic Private Outbox
Eligibility) is the correct Arc to follow it, but only once the
lifecycle transition is real and reviewed; recommending B before that
would repeat the exact mistake `19`'s own dependency graph exists to
prevent — building a delivery pipeline nothing can ever exercise.

## See also

- `01_source_inventory.md`, `19_dependency_graph.md`
- `09_delivery_eligibility.md`, `15_group_strategy.md`, `16_pairwise_fanout.md`
- `docs/reviews/private_conversation_construction_v1/09_draft_vs_active.md`,
  `20_normative_next_arc.md`
