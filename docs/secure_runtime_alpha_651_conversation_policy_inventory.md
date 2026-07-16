# Secure Runtime Alpha 651 — Conversation Policy Inventory

Stage 1 of Phase B. Confirms no canonical conversation model exists
today.

## 1. Reusable policy concepts

None exist as code today — `FedosBoardId`/`FedosThreadId`
(`src/board/fedos_board_identifiers.ts`, Alpha 251) are opaque
identifiers only, with no attached policy/visibility record.

## 2. Concepts that are Nostr/community-specific

None found. Searched for `Community`, `role`, `membership` across
`src/` — zero matches. `FedosBoardSourceProtocol` (Alpha 253) names
protocols, not policy.

## 3. Whether Board ID can represent conversation identity

Partially — a root post's `threadId === id` (Alpha 631), and every post
carries a `boardId`. For V1 (a single fixed public policy shared by
every Board), no separate Conversation ID is needed — see §4.

## 4. Whether a separate Conversation ID is required now

No. `FedosConversationPolicyAuthority.resolvePolicy()` (Alpha 656)
already accepts `(boardId, threadId)` — sufficient for V1's fixed
policy, and forward-compatible with a future per-board/per-thread
policy record without an interface change.

## 5. Whether policy can remain external to `FedosBoardPost`

Yes — confirmed by Alpha 654's own decision. No field is added to
`FedosBoardPost` by this Arc.

## 6. Persistence implications

None for V1 — `StaticFedosConversationPolicyAuthority` holds no
persisted state (Alpha 656/659).

## 7. Query implications

None for V1 — no query path filters by policy today, since public mode
has nothing to hide; see Alpha 658 for the structural guard against a
future private mode silently reusing today's public query path.

## 8. Outbound eligibility implications

`FedosConversationPolicy.federationEligibility` is a required input to
`evaluateFedosOutboundEligibility()` (Phase C) — a conversation with
`federationEligibility: "local-only"` makes EVERY target ineligible
with reason `"conversation-local-only"`, before any protocol-specific
check runs.
