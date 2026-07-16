# Private Conversation Construction V1 — Integration Specification Review — Index

Review only. No production source, README, package/Cargo, or dependency
change is made anywhere by this review. Every file this review adds
lives under `docs/reviews/private_conversation_construction_v1/` or
`test/reviews/private_conversation_construction_v1/`; every test file
is read-only against existing, unmodified source. No new "Alpha NNN"
number is minted anywhere in this review's own text. `p2p/` is
untouched. No encryption, private Conversation, invitation, GUI/Worker,
Ontology, or Humanizer/AI implementation is added. No external web
research is performed — every claim below is grounded in this
worktree's own checked-out source, read directly, or explicitly marked
as requiring official protocol research.

## Preconditions confirmed at the base commit

This review is written against `d8bbfae` ("Add Secure Runtime Alpha
821–850: Durable Conversation Membership and Capability Persistence
Arc"), the tip of
`worktree-private-conversation-construction-v1-review`. Confirmed by
direct reading of this worktree's own checked-out `src/`, not by
memory of any prior review, that `d8bbfae` carries as ancestors:

- Alpha 741–760 (Canonical Conversation Identity and Record
  Foundation) — `src/conversation/fedos_conversation_id.ts`,
  `fedos_conversation_record.ts`, `fedos_conversation_record_validator.ts`,
  `persistence/fedos_conversation_persistence.ts`.
- Alpha 761–790 (Conversation Membership and Capability Foundation) —
  `src/conversation/membership/*`, `src/conversation/capability/*`.
- Alpha 791–820 (Conversation Retention and Private Payload Storage
  Foundation) — `src/conversation/retention/*`,
  `src/conversation/payload_storage/*`.
- Alpha 821–850 (Durable Conversation Membership and Capability
  Persistence) — `src/conversation/membership/persistence/*`,
  `src/conversation/capability/persistence/*`,
  `src/conversation/capability/coordination/*`.
- Both prior merged review sets:
  `docs/reviews/private_conversation_security/` (01–20 + index) and
  `docs/reviews/conversation_foundation_v1/` (01–15 + index).

**Alpha 851–890 does not exist anywhere in this repository as of this
review** — no branch, worktree, or merged commit carries it, confirmed
by `git log`/`git branch` from this worktree. This review does not
assume its scope, outcome, or even its subject matter. `20_normative_next_arc.md`
states this plainly and selects the applicable conditional
recommendation on that basis, rather than leaving the question
unresolved.

## What this review is, and is not

The two prior review sets each converged on a large amount of design
vocabulary (Conversation Mode/Identity/Record, Membership, Capability,
Retention, Payload Storage) and, unlike either prior review's own point
in time, **all of that vocabulary now has real, shipped, committed
implementation** in this checked-out tree — not a sketch read via `git
show` from an unmerged branch. This review's job is narrower and more
load-bearing than either prior pass: **read the actual, current
`src/conversation/`, `src/board/runtime/policy/`, `src/crypto/`,
`src/runtime/`, `src/vault/`, and `src/identity/` trees and answer one
question honestly — when may this system construct a `private-group`
or `direct` Conversation, and what must exist, durably, before that
Conversation is usable?**

This review is about **construction** (creation) of a Private
Conversation record and its prerequisite state — readiness, atomicity,
ownership, lifecycle — not about the private message envelope or
encryption wire format. A sibling task (`private_message_envelope_v1`)
covers that adjacent, narrower question and is explicitly **not**
part of this worktree's history; this review does not read, assume, or
depend on its content.

## Headline finding

**Every domain object a `private-group`/`direct` Conversation would
need already exists, shipped, and works correctly in isolation —
Membership (`src/conversation/membership/`), Capability
(`src/conversation/capability/`), Retention
(`src/conversation/retention/`), and Payload Storage
(`src/conversation/payload_storage/`) are all mode-agnostic: none of
them reads or checks `FedosConversationRecord.mode` at all, confirmed
by direct source inspection (`01_source_alignment.md`). But the ONE
object each of them depends on for identity —
`FedosConversationRecord` itself — has a validator
(`validateFedosConversationRecord`,
`src/conversation/fedos_conversation_record_validator.ts`) that
unconditionally rejects any `mode` other than `"public"`, and a
Conversation id (`toFedosConversationId`,
`src/conversation/fedos_conversation_id.ts`) that is deterministically
derived from a `(FedosBoardId, FedosThreadId)` pair — a public-Board
concept a `direct`/`private-group` Conversation has no reason to carry.
No code path anywhere in this checked-out tree constructs a
`private-group` or `direct` `FedosConversationRecord`, and the
validator itself, as written today, cannot be asked to accept one.**

This is the single fact every one of the 20 reviews below reasons
from. It is also why this review's own Draft-vs-Active analysis
(`09_draft_vs_active.md`) and Failure Matrix (`14_failure_matrix.md`)
both conclude that "construct a Private Conversation today" is not
merely ungated but **structurally unreachable** without a Conversation
Record/Validator/Id change this review is itself forbidden from
making (a production source change) — the next Arc's own first job.

## Reading order

| # | Document | Answers |
|---|---|---|
| 01 | `01_source_alignment.md` | What is real vs. review-only across every prerequisite area, verified by direct source reading |
| 02 | `02_readiness_axes.md` | The nine independent readiness facts construction must check, kept uncollapsed |
| 03 | `03_readiness_results.md` | The closed readiness result vocabulary |
| 04 | `04_private_group_command.md` | The private-group construction command's caller-allowed input surface |
| 05 | `05_direct_command.md` | How a direct Conversation command differs from private-group, not merely `memberCount === 2` |
| 06 | `06_creator_membership.md` | The creator/owner Membership construction sequence |
| 07 | `07_initial_policy.md` | Exact initial policy axes for private-group and direct |
| 08 | `08_encryption_gate.md` | The encryption readiness gate construction must consult |
| 09 | `09_draft_vs_active.md` | Draft vs. active Conversation lifecycle — Option comparison, one recommendation |
| 10 | `10_persistence_coordination.md` | Recoverable, non-transactional write ordering across five durable concerns |
| 11 | `11_initial_capability.md` | Whether construction should auto-issue a join Capability |
| 12 | `12_runtime_ownership.md` | Which layer should own construction — a new Conversation Application boundary |
| 13 | `13_read_api.md` | The minimal application read surface |
| 14 | `14_failure_matrix.md` | Every construction failure mode and its honest, observable outcome |
| 15 | `15_authorization.md` | How future read/write operations must consult Policy → Membership → encryption → Storage |
| 16 | `16_revocation_leave.md` | Effects of revocation/leave on future writes, keys, and history |
| 17 | `17_arc_packaging.md` | Which next-Arc package is the largest safe one, given current source |
| 18 | `18_protocol_delivery.md` | Why construction must stay independent of protocol publishing |
| 19 | `19_security_claims.md` | Claims constructible after this foundation vs. claims that remain false |
| 20 | `20_normative_next_arc.md` | The one applicable next-Arc recommendation, conditional branches resolved |

## Absolute prohibitions honored by this review

No production source change; no README change; no Alpha number
assigned to this review's own deliverables or to any Arc it
recommends; no package/Cargo change; no dependency addition; no
private, encryption, or invitation implementation; no GUI/Worker
change; `p2p/` untouched; no Ontology; no Humanizer/AI; no external web
research (protocol-specific gaps are named, not guessed, in
`18_protocol_delivery.md`). Only `docs/reviews/private_conversation_construction_v1/`
and `test/reviews/private_conversation_construction_v1/` are written.
