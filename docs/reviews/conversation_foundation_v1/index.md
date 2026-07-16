# Canonical Conversation Foundation V1 — Specification Review

Review-only. No production source, README, package/Cargo, or dependency
change is made by this review. This directory converts two prior,
never-merged review passes plus one shipped-but-unmerged implementation
Arc into a single, implementation-ready V1 specification for the next
Arc.

## What this review reconciles

Three prior bodies of work, none of them merged into `master`, each read
via `git show <commit>:<path>` from this review's own worktree (never
checked out, per this review's own "do not edit another worktree"
instruction):

1. **The Application API review** — branch `review/board-runtime-api`,
   tip `d6dd7dc`. 26 docs
   (`docs/reviews/board_runtime_application_api_00..16` and
   `docs/reviews/board_runtime_conversation_foundation_00..09`) plus 4
   test files. Design-only; forked early (from `5aedccb`) and never
   updated against later Arcs. Proposed the Conversation Mode/Identity/
   Membership/Invitation/Pseudonym vocabulary and the Outbound
   Eligibility gate placement this spec builds on.
2. **The Security review** — branch
   `worktree-private-conversation-security-review`, tip `b56cfde` (one
   commit ahead of current `master`). 21 docs
   (`docs/reviews/private_conversation_security/index.md` +
   `01`–`20`) plus 3 test files. Grounds the same private-conversation
   question in the codebase's REAL crypto primitives (a working,
   vector-verified AEAD/HKDF/conversation-key Rust core, currently
   `pub(crate)`-only and not compiled to WASM in this tree) rather than
   treating cryptography as an unopened question.
3. **The Policy Arc** — branch `arc/public-identity-conversation-policy`,
   tip `f90ad71`. Not a review — a shipped, unmerged implementation Arc
   sitting directly on top of current `master` (`9c1f52c`). It actually
   built `FedosConversationMode`, `FedosConversationPolicy`, a
   `FedosConversationPolicyAuthority`, a richer public-author-authority
   vocabulary, and a `FedosOutboundEligibilityEvaluator` — all public-mode
   only, none of it merged, none of it visible from this worktree's
   checked-out `src/` tree (it must also be read via `git show`).

A fourth branch, `arc/nostr-identity-binding`, is checked out in its own
worktree directly on top of `f90ad71` with no commits of its own yet as
of this review — i.e. a Nostr Identity-to-Signing-Authority Binding Arc
is in progress, unmerged, outcome unknown. This review does not touch,
read privileged state from, or assume anything about that worktree's
in-progress content beyond the fact that it exists and is unresolved;
`15_normative_v1_specification.md` gives two conditional
recommendations that do not depend on knowing its outcome in advance.

**Current `master` reality**, confirmed by direct reading of this
worktree's own checked-out `src/` (not by memory of any prior review):
`FedosBoardRuntime` (`src/board/runtime/fedos_board_runtime.ts`) is
real, public-mode-only, and unrelated to any "Conversation" concept by
name. There is no `Conversation`, `ConversationPolicy`,
`ConversationMode`, membership, invitation, or deletion-lifecycle type
anywhere in `src/board/`. The only real per-message AEAD primitive is
generic key generation (`src/runtime/fedos_runtime_aead_key_generation.ts`);
there is no message-level ciphertext or per-conversation key concept in
`src/` at all.

## Why a third pass instead of repeating the first two

The Application API review and the Security review each independently
converged on much of the same shape (a distinct `FedosConversationId`,
`"public"|"private-group"|"direct"` mode, a dedicated private message
type kept out of `FedosBoardPost`, single-authority redemption as the
only real answer to one-time invites, "encrypting body alone is not
privacy"). Re-running that analysis a third time would add nothing. What
neither prior pass could do is **reconcile itself against the Policy
Arc**, because the Policy Arc did not exist yet when either was written.
This review's job is narrower and more load-bearing: take the union of
already-converged design decisions, check them against what the Policy
Arc actually shipped, and cut the smallest next V1 slice that is
honestly buildable today — not a re-derivation of what private mode
should eventually look like.

## Reading order

| # | Document | Answers |
|---|---|---|
| 01 | `01_decision_reconciliation.md` | What is frozen, provisional, blocked, or out of V1 — and where the three sources disagree |
| 02 | `02_minimal_scope.md` | Which of four V1 scope options to build next |
| 03 | `03_conversation_identity.md` | Exact `FedosConversationId`/`FedosConversationMode` types and their relationship to `FedosBoardId`/`FedosThreadId` |
| 04 | `04_conversation_record_v1.md` | The immutable V1 Conversation record shape |
| 05 | `05_policy_reuse.md` | Whether the Policy Arc's policy model can be reused unchanged |
| 06 | `06_public_application_mapping.md` | How `FedosBoardRuntime`'s real methods map to Conversation concepts, and whether it should be renamed |
| 07 | `07_private_readiness_gate.md` | The exact prerequisites before private-group/direct becomes constructible |
| 08 | `08_storage_migration.md` | Whether Conversation records need their own persistence port |
| 09 | `09_lifecycle_deletion.md` | The honest V1 lifecycle/deletion vocabulary |
| 10 | `10_membership_boundary.md` | The membership authority interface shape that must stay absent from V1 code |
| 11 | `11_private_message_envelope.md` | The private message envelope shape, and which fields are blocked |
| 12 | `12_invitation_capability.md` | The invitation capability shape, and why exactly-once redemption needs a chosen authority |
| 13 | `13_outbound_eligibility.md` | The full public+private eligibility gate chain |
| 14 | `14_arc_packaging.md` | Safe implementation package groupings and their dependency order |
| 15 | `15_normative_v1_specification.md` | The single normative V1 specification and the next-Arc recommendation |

## Absolute prohibitions honored by this review

No production source change; no README change; no Alpha number assigned
to this review's own deliverables or to any Arc it recommends; no
package/Cargo change; no dependency addition; no private, encryption, or
invite implementation; `p2p/` untouched; no Ontology; no Humanizer/AI;
no external web research. Prior Alpha numbers are cited only where
necessary to identify existing source material already carrying one
(e.g. "the Policy Arc's own `fedos_conversation_policy.ts`") — this
review mints none of its own.
