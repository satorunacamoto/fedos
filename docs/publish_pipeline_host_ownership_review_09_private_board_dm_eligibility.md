# 09 — Private Board / DM Impact and Eligibility Boundary

## Current state: no visibility concept exists anywhere in the canonical Board model

`FedosBoardPost` (`src/board/fedos_board_post.ts:41-54`) has exactly
eight fields — `id`/`boardId`/`threadId`/`replyTo`/`author`/`body`/
`createdAt`/`source` — **no visibility, audience, or recipient field of
any kind.** Every post that reaches the canonical model today is
implicitly, structurally public; the concept of "private Board,"
"invite-only group," or "DM" does not exist in ANY committed file —
confirmed by the same finding every recent Arc's own README status
banner already names under "Still out of scope" (e.g. Alpha 450 §6:
"DM/private Board, capabilities/invites... Ontology integration").

## Can the delivery foundation this review designs eventually handle all four?

**Structurally, yes — nothing in this review's own Host ownership
design (Alpha 01/05/06) hardcodes "public" anywhere.** The Outbox
already carries routing as opaque data (`target.protocol`/
`target.destination`, Alpha 413); the Scheduler is protocol-agnostic
(prior review's own Alpha 486 finding); the Publisher registry (Alpha
01/08) dispatches by protocol label, not by visibility. A future
"private Board"/"DM" feature could, in principle, route through the
SAME Outbox -> Scheduler -> Publisher -> Observation chain this review
designs, using a DIFFERENT `target.protocol` value or a
DIFFERENT Publisher registered for the same protocol under different
audience rules.

## The real risk this review must name explicitly: nothing today stops a private post from reaching a public Publisher

Because `FedosBoardPost` carries no visibility field, and
`submitPostWithOutbox()` (existing, unmodified) accepts ANY caller-
supplied `targets` array for ANY post with no eligibility check
whatsoever, **the CURRENT code already has no structural barrier
preventing a future "private Board" or "DM" feature from being wired
carelessly straight into the SAME Outbox path a public Board post
uses** — there is nothing today that would reject
`submitPostWithOutbox(privatePost, [{ protocol: "nostr", destination: null }])`
even if `privatePost` were later tagged private by some
not-yet-built field, because no code anywhere checks such a field
before writing an Outbox intent.

## Required eligibility/policy boundary (design-level requirement, not implemented by this review)

**A visibility-eligibility check must run BEFORE an Outbox intent is
ever created — inside (or immediately ahead of) `submitPostWithOutbox()`
itself, never inside the Scheduler or Publisher layer**, for the same
reason Alpha 07 already established Outbox intents are permanent and
undeletable: an intent that should never have been created cannot be
un-created, only prevented. Concretely, this review specifies the
REQUIRED shape a future private-Board/DM Arc must add (out of THIS
review's own no-src-change scope):

1. A visibility/audience field on the canonical post model (or a
   parallel, explicitly-separate DM/private post model — this review
   does not decide WHICH, since that is Board Model scope, not Host
   Ownership scope; it only requires that SOME such field exists before
   any eligibility check can be written).
2. An eligibility function, `isEligibleForOutboundTarget(post, target): boolean`,
   called INSIDE `submitPostWithOutbox()` before `createFedosBoardOutboxIntent`
   is ever invoked for a given target — fail-closed (default REJECT
   unless a post is explicitly marked public-eligible), mirroring this
   codebase's own established "fail closed to `null`/rejection, never
   throw for a normal domain rejection" convention
   (`createFedosBoardOutboxIntent`'s own Alpha 414 discipline).
3. The Publisher registry (Alpha 01) itself carries no audience
   awareness — it is the LAST place such a check could correctly run,
   since by the time a `FedosPersistedBoardOutboxRecordV1` reaches a
   Publisher, the eligibility decision must ALREADY be final. Putting
   the check there instead of at Step 2 would mean a private post's
   ROUTING INTENT is already durably recorded in the Outbox even if the
   Publisher itself later refuses it — a durable, permanent record of
   an attempted misdelivery, which is worse than preventing the intent
   from being written at all.
4. `FedosDeliveryObservation`/`FedosBoardOutboxObservation` (Alpha 06)
   must never carry post BODY content (already true — neither type has
   a body field, Alpha 462/475's own guardrails) — so even a
   observation-log leak of a private delivery attempt cannot itself
   leak content, only the fact that AN attempt happened, to WHICH
   subject id, at WHAT time. This is an existing property this review
   confirms is preserved, not a new one it adds.

## See also

- `docs/publish_pipeline_host_ownership_review_01_ownership_matrix.md`
- `docs/publish_pipeline_host_ownership_review_07_outbox_processing.md`
- `docs/secure_runtime_alpha_413_outbox_identifier_target_model.md`
