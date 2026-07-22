# Secure Runtime Alpha 6121–6200 — Conversation Continuity Truth Document

## The chosen model (Phase F's own required documentation)

**The existing Direct Conversation ID is NEVER rewritten.** This Arc
adds a purely additive, LOCAL display relationship —
`FedosIdentityTransitionConversationContinuityRecordV1` — linking one
already-accepted transition to one Direct Conversation, on ONE local
Device. The visible thread is kept exactly as it was; only a NEW
cryptographic Device-pair session generation is required going forward
(`newSessionRequired: true`, informational only — this Arc never
applies it, see Phase H).

This is the smaller of the two options `45e0fce` left open ("keep the
visible thread while preserving separate cryptographic generations" vs.
"present the new identity as a new secure conversation with an explicit
link") — chosen because nothing in this codebase's Conversation/
Membership layer needs a NEW Conversation object to represent "the
same thread, a new session generation required," and inventing one
would be exactly the kind of Conversation-domain redesign this Arc is
explicitly prohibited from doing.

## What is preserved, unconditionally, by construction

- **Historical message author identity** — this Arc imports NOTHING
  from `src/conversation/envelope/`, `src/conversation/messaging/`, or
  any message-authoring code path. There is no code path by which this
  Arc could rewrite a message's author even if it wanted to.
- **Historical Membership facts** — this Arc imports nothing from
  `src/conversation/membership/`.
- **Reply references / Nostr event IDs** — untouched, same reason.
- **Archive records** — this Arc imports nothing from
  `src/conversation/archive/`. Archive Restore establishing no new
  trust is stated as a standing warning
  (`archive-restore-does-not-establish-trust`) but this Arc does not
  and could not touch Archive Restore's own behavior.
- **Search historical participant identity** — this Arc imports nothing
  from `src/conversation/search/`. No identity merge, accepted or
  otherwise, is performed by this Arc.

All of the above is verified structurally
(`secure_runtime_alpha_6121_6200_host_command_and_structural_guards.test.ts`'s
own import-exclusion checks over the Presentation/Renderer subtrees;
the domain layer's own equivalent checks already existed from the
prior two Arcs and were re-verified passing unchanged) rather than
merely asserted.

## Supersession and conflict, for continuity records specifically

A continuity record is keyed by `(localDeviceRef, conversationId)`. A
second link for the SAME conversation with a STRICTLY HIGHER `revision`
(i.e. a later-accepted transition superseding an earlier one) is a
legitimate, additional, append-only row — the OLDER row is never
rewritten; "is this link superseded?" is answered by
`isFedosIdentityTransitionConversationContinuitySuperseded()`, a pure
query over the whole lineage, exactly like every other supersession
check in this Arc's own lineage. A same-or-lower revision is
`"rollback-detected"`; a different transitionId claiming the identical
revision is `"conflict"`.

## Group continuity

Remains entirely unbuilt, as named in the mission. No file in this Arc
references a Group/Sender-Key concept at all.

## Effective-from

`acceptedAt` (the timestamp the explicit accept action recorded) is the
continuity record's own effective-from marker. There is no retroactive
timestamp — a transition accepted "now" is effective "from now," never
backdated to the transition's own `issuedAt`.
