# Secure Runtime Alpha 891–930 — Private Conversation Draft Construction & Readiness Runtime Arc

Implementation arc for the specification in
`docs/reviews/private_conversation_construction_v1/`. Produces the maximum
safe Private Conversation construction foundation that does **not** require
encryption: a `private-group`/`direct` Conversation may be constructed only
as a metadata-only `lifecycleState: "draft"`, never active, never encrypted,
never a message.

## Record & lifecycle decision (Alpha 894)

Chosen: **a new, separate, versioned draft record** (`FedosConversationDraftRecord`,
`src/conversation/construction/`), NOT a change to the public
`FedosConversationRecord` V1. Compared A (add `lifecycleState` to V1 —
rejected, silently changes a durably-persisted schema), B (versioned V2 —
adopted, but as a distinct record type since a private draft has no
Board-thread anchor), C (separate lifecycle record — rejected, splits one
draft across two logs), D (infer externally — rejected, no durable writer).
The public record, its validator, codec, persistence, and reader are
byte-for-byte unchanged; every existing public V1 log stays valid and
readable. Because the draft record is brand new, `lifecycleState` is carried
inline with no migration risk. Id namespace: `private-draft::<mode>::<requestId>`
(deterministic, never Board-thread-derived, never caller-supplied).

Lifecycle vocabulary (Alpha 893): `draft | active | closed | tombstoned`
named for future-safe validation; only `"draft"` is ever constructed.
`"active"` cannot be produced anywhere. No `isActive`/`isPrivate`/`isEncrypted`
boolean.

## Policy (Alpha 895–897)

`FedosConversationReadAccess`/`FedosConversationInviteAuthority` unions
widened ADDITIVELY (`"members-only"`, `"owner-and-moderators"`); the public
`validateFedosConversationPolicy` is unchanged and still rejects every
private value. New `validateFedosPrivateConversationPolicy` + factories
`createPublicConversationPolicy()`/`createPrivateGroupDraftPolicy()`/
`createDirectDraftPolicy()`. Both private modes are fixed
`discoverability: "unlisted"`, `readAccess: "members-only"`,
`writeAccess: "restricted"`, `federationEligibility: "local-only"`;
private-group `inviteAuthority: "owner-and-moderators"`, direct `"none"`.
Policy never implies encryption.

## Readiness (Alpha 898–899)

Nine closed axes (`identity`, `conversationPersistence`, `policy`,
`creatorMembership`, `capability`, `encryption`, `payloadStorage`,
`retention`, `protocolDelivery`), each a coarse state
(`ready | unavailable | unsupported | failed | not-required`). Pure
evaluation into `draft-ready | activation-ready | blocked`.
`activation-ready` is returned ONLY when an INJECTED encryption-readiness
authority proves encryption ready. The sole shipped implementation is
`UnavailableFedosConversationEncryptionReadinessAuthority` (no fallback
crypto), so every constructed Conversation is at best `draft-ready`.

## Construction & coordination (Alpha 901–920)

`FedosPrivateConversationConstructionCoordinator.createPrivateGroupDraft()`/
`createDirectDraft()`: validate command → resolve creator identity → validate
mode/policy → durable coordination `"prepared"` → persist draft → admit ONE
durable owner creator Membership (deterministic id, idempotent, never
duplicated) → issue the initial Capability (optional/general for
private-group; a required `intendedRecipient`-bound one-use Capability for
the direct recipient — never a fabricated Membership) → `"draft-completed"`
→ evaluate readiness. A five-phase construction-coordination log (mirroring
the Alpha 845 redemption coordinator) makes a crash at any step recoverable:
a fresh coordinator over the same backends converges every partial state
forward, with no duplicate Membership and no second Capability (the issued
id is recorded on the coordination fact). Idempotency (Alpha 909) is via an
optional caller `idempotencyKey` from which the Conversation id is
deterministically derived. Corruption fails closed (append-only replay
throws). Closed result vocabulary: `draft-created | already-present |
partial-construction | conflict | invalid-command | identity-unavailable |
policy-failed | membership-failed | capability-failed | persistence-failed |
unavailable`.

## Runtime & Local Runtime ownership (Alpha 921–929)

`FedosConversationRuntime` (`src/conversation/runtime/`) — a NEW peer to
`FedosBoardRuntime`, owned by the Local Runtime
(`runtime.conversationRuntime()`, exactly one per running runtime, denied
after stop, no singleton, no automatic network/timer). API: construction
plus an immutable read facade (`findConversation`, `readinessForConversation`,
`listMemberships`, `issuedCapabilityDescriptors`, `constructionStatus`) —
never a persistence port, raw authority, encryption handle, or bearer secret.
The bearer secret of an initial Capability is returned exactly once on the
construction result and is verified absent from every durable log.

## Guarantees / prohibitions honored

No private message send/receive, no ciphertext/plaintext, no encryption/
decryption, no key generation/epochs, no active-lifecycle transition, no
automatic activation, no protocol delivery, no invitation transport, no
GUI/Worker, no new dependency, no Rust/Cargo change, no `p2p/`. Public Board
create/reply/query behavior is entirely unaffected.

## Next Arc (conditional)

Alpha 851–890 does not exist anywhere in this repository, so encryption
activation remains blocked. The applicable recommendation is therefore
**"Conversation Draft Management and Invitation Transport Boundary"** — NOT
private-message activation, which must not be recommended without a rebase
and revalidation against real Alpha 851–890 results. When (and only when) a
future Arc builds real encryption and injects a real
`FedosConversationEncryptionReadinessAuthority`, a separate reviewed
`draft → active` activation operation may lift a draft to active.
