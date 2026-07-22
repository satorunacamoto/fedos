# Secure Runtime Alpha 991–1050 — Reconciliation Report

**Arc:** Conversation Invitation Transport & Draft Management Arc
**Branch:** `arc/conversation-invitation-draft-management`
**Base HEAD:** `9846ba4` (Alpha 891–930 — Private Conversation Draft Construction and Readiness Runtime Arc)

This report is the MANDATORY first step required by the task's own AUTO MODE
EXECUTION ADDENDUM. Every claim below was verified by reading the actual source
in this worktree, not inherited on trust. Where my own reading corrects the
orchestrating session's initial summary, the correction is called out
explicitly.

## Method

Read, in full, before writing any production source:

- `src/conversation/capability/` — every file, including
  `fedos_conversation_capability_issuer_authority.ts`,
  `fedos_conversation_capability_redemption_authority.ts`,
  `fedos_conversation_capability_redemption_result.ts`,
  `fedos_conversation_capability_descriptor.ts`,
  `fedos_conversation_capability_bearer_secret.ts`,
  `fedos_conversation_capability_id.ts`,
  `fedos_conversation_capability_issuance_result.ts`,
  `in_memory_fedos_conversation_capability_authority.ts`, and
  `persistence/` (`persisted_fedos_conversation_capability_authority.ts`,
  `fedos_conversation_capability_persistence.ts`,
  `fedos_persisted_conversation_capability_v1.ts`,
  `in_memory_...`/`append_only_...` backends).
- `src/conversation/construction/` — draft record, its validator/codec,
  persisted V1 record, the three draft-persistence files, the lifecycle-state
  vocabulary, the construction coordinator, and `coordination/`.
- `src/conversation/runtime/` — `fedos_conversation_runtime.ts`,
  `fedos_conversation_runtime_assembly.ts`, generators.
- `src/conversation/membership/` — authority interface, state vocabulary,
  result vocabulary, persistence port (the closest precedent for append-only
  state transitions), participant reference.
- `docs/reviews/private_conversation_construction_v1/13_read_api.md`,
  `16_revocation_leave.md`.
- `src/desktop/runtime/fedos_desktop_runtime.ts` — the runtime wiring point.

## Finding 1 — "Invitation Authority / Token / Validation / Redemption / Expiration" already exist as **Capability**. CONFIRMED.

Verified against source:

- `FedosConversationCapabilityIssuerAuthority.issueJoinCapability()` **is**
  invitation issuance — it mints a public descriptor + a one-time bearer
  secret, gated by injected existence + authorization checks.
- `FedosConversationCapabilityBearerSecret` **is** the invitation token secret
  — a separate opaque branded value, never stored on the descriptor, delivered
  exactly once at issuance.
- `FedosConversationCapabilityRedemptionAuthority.redeem()` **is** invitation
  validation + redemption — it verifies the bearer secret (constant-time),
  enforces `expiresAt`, enforces `intendedRecipient`, enforces `maxUses`,
  enforces per-redeemer exactly-once, then admits Membership.
- **Expiration is already handled**: `FedosConversationCapabilityRedemptionResult`
  already includes `"expired"` and `"exhausted"`; `redeem()` returns `"expired"`
  when `now > expiresAt`.

**Decision (unchanged from the addendum):** the Arc's "Invitation" work is a
thin, additively-named application-layer facade over the existing Capability
boundary — `FedosConversationInvitationTransport` in a new
`src/conversation/invitation/` directory. It composes the existing issuer +
redemption authorities into invitation-shaped operations and re-shapes their
result vocabularies (`invalid-capability` → `invalid-invitation`, and a new
`revoked` outcome). It generates **no** bearer secret, checks **no** expiry, and
enforces **no** use-count itself — every one of those is delegated to the
existing authorities. The "Invitation Token" type
(`FedosConversationInvitationToken`) is a transport-shaped pairing of the
existing **public** `capabilityId` and the existing one-time bearer secret (both
are needed to redeem); it introduces no new secret and no new generation.

## Finding 2 — "Invitation Revocation" is a genuine gap. CONFIRMED, with a correction.

**Correction to the addendum's grep claim.** `revoke`/`revocation` **does**
appear in `src/conversation/` — but only in the **Membership** domain
(`FedosConversationMembershipAuthority.revoke()`/`.leave()`, which transition a
participant's Membership `state` from `"active"` to `"revoked"`/`"left"`). That
is participant removal, a different concern. There is **no** capability /
invitation revocation anywhere: neither `FedosConversationCapabilityIssuerAuthority`
nor `FedosConversationCapabilityRedemptionAuthority` has any revoke operation,
and the redemption result vocabulary has no `"revoked"` outcome.

Stronger corroboration than a grep miss: the persisted-capability event model
(`fedos_persisted_conversation_capability_v1.ts`, Alpha 838) **explicitly
documents** why it did *not* add a `"revoked"` event — *"`\"revoked\"` has NO
corresponding operation anywhere in the frozen Alpha 761–790 Capability
Authority contract — inventing a revoke-capability event here would be new
lifecycle scope this Arc's own objective (durability, not new operations) does
not call for."* This Arc (991–1050) is exactly the arc whose objective **does**
call for that operation. `16_revocation_leave.md` also already discusses the
decoupling at the review level and recommends the issuance authorization check
consult live Membership — which the existing assembly already does.

**Design chosen — a dedicated append-only revocation registry, consulted by the
transport, leaving the frozen Capability domain byte-for-byte unchanged.**

Two options were weighed:

- (A) Add a `"revoked"` event type to the frozen Capability event union and
  teach both `redeem()` implementations to check it. Rejected: it mutates
  frozen Alpha 833/838 files and both frozen authorities' `redeem()` — a
  redesign of accepted architecture, and it would change the behavior of the
  existing Capability boundary.
- (B) A NEW, additive `FedosConversationInvitationRevocationRegistry`
  (in-memory + append-only backends) that records terminal, one-per-capability
  revocation facts, keyed by `capabilityId`. The transport consults
  `isRevoked()` **before** delegating to `redeem()`. **Adopted.**

Option B is purely additive (no frozen file changes its meaning), fits the
established append-only discipline exactly (mirrors the draft/coordination/
capability backends: NDJSON, insert-only, replay, fail-closed on a conflicting
duplicate key, no delete/compaction), and keeps revocation an
invitation-transport concern — this Arc's own layer. Revocation is a **terminal,
one-way** fact (no un-revoke), matching the "no backward transition" discipline
used for Membership terminal states and coordination phases. Non-revoked
capabilities are entirely unaffected. Documented boundary: revocation is
enforced at the invitation transport (the redemption entry point this Arc owns
and the runtime exposes); the lower-level raw Capability `redeem()` primitive is
not exposed to application callers by any runtime surface, so there is no
application path that bypasses revocation.

## Finding 3 — "Draft Manager / Listing / Search / Delete / Restore" are genuinely new. CONFIRMED.

Verified: `FedosConversationDraftPersistence` has `putDraft`/`getDraft`/
`listDrafts` only; `FedosConversationRuntime` has single-record
`findConversation` and no listing/search/delete/restore. The draft record is
**immutable** (its port header forbids delete/compaction/rewrite; its validator
accepts `lifecycleState === "draft"` only; the record is keyed by id and a
differing second write is a `"conflict"`), so delete/restore **cannot** be an
in-place mutation of the draft record.

**Design chosen — a separate append-only draft-management-state log, resolved by
revision, composed by a Draft Manager; delete = tombstone, restore = back to
draft.** This reuses the `draft | tombstoned` values already present in the
frozen `FedosConversationLifecycleState` vocabulary (Alpha 893 named
`"tombstoned"` precisely so a future operation could transition into it) and
follows the same "one entity, several append-only transition facts over time"
shape the Membership persistence port already established. Delete is a
soft/tombstone state transition, never a physical removal — honoring the "fail
closed, no silent data loss, append-only" discipline (Alpha 918/919): the
underlying immutable draft record is never deleted; only a management-state fact
is appended. Restore appends a fact transitioning the managed state back to
`"draft"`. Because delete/restore can legitimately alternate (unlike the
monotonic coordination phases), each fact carries a monotonically increasing
`revision`, and the CURRENT managed state is the highest-revision fact's state
(default `"draft"` when no fact exists). Listing and search read the base
`listDrafts()` and join each with its current managed state.

## Finding 4 — No overlap with sibling Arc branches. CONFIRMED.

Nothing in this work imports from, or touches, Envelope / Encryption /
Decryption / Rust / WASM. The sibling
`arc/private-message-envelope-encryption-activation` work is not merged here and
is not referenced. This Arc is application/runtime coordination only.

## Ripple summary (see the completion report for the full per-file list)

New directory `src/conversation/invitation/` (token, result unions, revocation
registry port + two backends + persisted record, transport facade); new draft
management files under `src/conversation/construction/` (managed-state/summary/
search types, result unions, persistence port + two backends + persisted
record, the Draft Manager); one additive optional read method on the Capability
issuer authority interface and its two implementations (explicitly sanctioned by
the addendum for the "list capabilities for a conversation" management case);
additive extensions to `FedosConversationRuntime` and its assembly; and a
minimal additive pass-through of two new optional log paths in the desktop
runtime. No dependency, `package.json`, or Cargo change; `p2p/`,
Encryption/Envelope, Scheduler, Publisher, and the existing construction
coordinator's core sequence are untouched.
