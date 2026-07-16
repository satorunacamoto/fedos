# Review 07 — Policy Creation

## Exact initial policy, by axis, per mode

`FedosConversationPolicy`'s six axes (`src/board/runtime/policy/fedos_conversation_policy.ts`,
confirmed real in `01`) each get an explicit, independently-justified
V1 value — never inferred from `mode` alone, matching the file's own
existing header discipline ("Policy is modeled as DISTINCT axes...
never collapsed into one enum").

| Axis | `private-group` V1 value | `direct` V1 value | Why |
|---|---|---|---|
| `mode` | `"private-group"` | `"direct"` | fixed by construction, never caller-chosen (`04`/`05`) |
| `discoverability` | `"unlisted"` | `"unlisted"` | neither mode may ever be `"listed"` — a private Conversation appearing in a public query result would contradict the word "private" regardless of any other axis; construction fixes this unconditionally, no caller override exists on either command |
| `readAccess` | new closed value needed: **not** `"public"`; this review recommends a new `"membership-gated"` value be added to `FedosConversationReadAccess`'s union in a future Arc (a production source change out of THIS review's own scope) | same | `FedosConversationReadAccess` today has exactly one legal value, `"public"` (`01`) — literally incapable of expressing "only Members may read." This is a genuine, named blocker (`14`/`20`), not a value this review can select from an existing closed vocabulary because none exists yet |
| `writeAccess` | `"restricted"` | `"restricted"` | the ONLY sensible value for either private mode — but `validateFedosConversationPolicy()` UNCONDITIONALLY REJECTS `"restricted"` today (`01`), a second, independent structural blocker beyond the Conversation Record validator's own `mode !== "public"` rejection |
| `inviteAuthority` | new closed value needed (e.g. `"owner-and-moderators"` or similar) — today's `FedosConversationInviteAuthority` has exactly one legal value, `"none"` | new closed value needed (e.g. `"none"` remains correct — a `direct` conversation's own two participants never invite a third, per `05`) | private-group genuinely needs SOME participant able to invite; `direct` genuinely needs none, per `05`'s own structural "exactly two" analysis |
| `federationEligibility` | `"local-only"` (V1 default; `"allowed"` left as a caller CHOICE on `04`'s command, since a private-group MAY eventually federate to invited remote participants, a decision this review does not resolve — see `18`) | `"local-only"` (fixed, no caller choice — `05`'s command carries no `federationEligibility` field at all, since federating a two-person direct conversation before any real private delivery protocol exists, per `18`, would be actively misleading) | matches `18`'s own "construction stays independent of protocol publishing" boundary — recording INTENT here never implies a real Publisher exists |

## This review does NOT claim encryption merely from mode

Per this review's own required scope: nowhere above does setting
`mode: "private-group"`/`"direct"` imply anything about encryption.
`FedosConversationPolicy` has no encryption-related axis at all — `08`
is entirely independent of Policy, consulted separately by
construction. A caller reading `mode: "private-group"` off a
constructed record learns NOTHING about whether messages in it will be
encrypted; `19` names this explicitly as a claim that must NOT be made
from Policy/mode alone.

## Two structural blockers this table surfaces, restated plainly

1. `FedosConversationReadAccess` cannot express "members only" —
   `"public"` is its only legal value today.
2. `validateFedosConversationPolicy()` rejects `writeAccess:
   "restricted"` unconditionally, regardless of `mode`.

Both are genuine, reviewed, PRODUCTION SOURCE gaps this review
identifies but does not fix (forbidden by this review's own ground
rules). They are the Policy-domain twin of `01`'s central Conversation-Record-validator
finding: **the Policy layer, like the Record layer, structurally
cannot represent a private-group/direct policy today, independent of
any Membership/Capability/Encryption readiness question.** `20`
folds this into the next-Arc recommendation directly.

## No persistence needed beyond what already exists

Per the existing Policy Authority's own Alpha 654 decision (still
valid, unmodified): a real per-Conversation Policy AUTHORITY (resolving
a DIFFERENT policy per Conversation id, rather than one static value)
is required once `private-group`/`direct` policies exist at all —
`StaticFedosConversationPolicyAuthority`'s "same fixed value for every
input" design is fundamentally incompatible with two modes needing two
different fixed value SETS. This is additive: a new
`FedosConversationPolicyAuthority` implementation, never a change to
the interface itself (`resolvePolicy()`'s own shape already accepts a
`boardId`/`threadId` pair and returns a closed
`FedosConversationPolicyResolution` — sufficient for a real
implementation to key off, once one exists).
