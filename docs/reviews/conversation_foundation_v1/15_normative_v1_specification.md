# Review 15 — Normative V1 Specification

This document is the single normative reference. Where it repeats a
conclusion from `01`–`14`, this document governs; the numbered reviews
are its supporting derivation, not a competing source of truth.

## Exact V1 supported behavior

- `FedosBoardRuntime.createPublicThread()`/`.replyToPublicThread()`
  implicitly identify a Conversation as `toFedosConversationId(boardId,
  threadId)` (`03`) and, on thread-root creation, produce one immutable
  `FedosConversationRecordV1` (`04`) via a new
  `FedosConversationPersistence` port (`08`).
- Every V1 Conversation record has `mode: "public"`. The `mode` field's
  type admits `"private-group"`/`"direct"`; no code path in V1
  constructs either.
- `FedosConversationPolicy` (Policy Arc, reused unchanged, `05`) governs
  every V1 Conversation via `policyRef: "public-v1"`, resolved through
  the existing `StaticFedosConversationPolicyAuthority`.
- Outbound eligibility for every V1 Conversation is exactly what
  `master`/the Policy Arc already implement (`13`) — this spec adds no
  new eligibility check, since Mode/Encryption readiness are no-ops for
  `"public"`.
- `FedosBoardRuntime` remains the sole public Application API (`06`) —
  no rename, no wrapper.

## Exact V1 unsupported behavior

- No `direct` or `private-group` Conversation is constructible.
- No membership record, membership authority, or role of any kind
  exists or is consulted.
- No invitation capability is constructible (`FedosConversationInviteAuthority`
  keeps its single `"none"` value).
- No private message, envelope, ciphertext, or per-conversation
  encryption key exists.
- No `closeConversation`/lifecycle-transition command exists; no
  lifecycle field is stored.
- No deletion of any kind (Conversation-level or message-level) is
  implemented beyond what already exists (`fedos_board_moderation.ts`'s
  types-only record).
- No claim is made about the outcome of the in-progress Nostr Identity
  Binding Arc.

## Type sketches (normative summary; see 03/04/08 for full derivation)

```ts
type FedosConversationId = string & { readonly __brand: "FedosConversationId" };

interface FedosConversationRecordV1 {
  readonly id: FedosConversationId;
  readonly mode: FedosConversationMode;       // "public" | "private-group" | "direct"; V1 constructs "public" only
  readonly createdAt: number;
  readonly boardId: FedosBoardId;
  readonly threadId: FedosThreadId;
  readonly policyRef: "public-v1";
}

interface FedosConversationPersistence {
  putConversation(record: FedosConversationRecordV1): "inserted" | "already-present" | "conflict" | "failed";
  getConversation(id: FedosConversationId): FedosConversationRecordV1 | null;
  listConversations(): readonly FedosConversationRecordV1[];
}
```

## Authority boundaries

| Authority | Owns | Does not own |
|---|---|---|
| `FedosBoardRuntime` | Command orchestration, Conversation identification on thread-root creation | Persistence backends, Publisher execution, Host lifecycle (unchanged from today) |
| `FedosConversationPolicyAuthority` (Static, Policy Arc) | Resolving the one V1 policy value | Any per-conversation divergence (none exists) |
| `FedosConversationPersistence` (new, this spec) | Durable Conversation record storage | Policy values, membership, ciphertext — never embeds any of these |
| `FedosOutboundEligibilityEvaluator`/`isEligibleForPublicOutboundTarget` (unchanged) | Fail-closed protocol-capability gating before Outbox | Mode/Encryption readiness (no-ops for V1's only mode) |

## Dependency graph

```
Package A (this spec's own scope: 03 + 04 + 05 + 08)
    -> Package B (Membership + Capability; needs a redemption-authority product decision)
    -> Package D (Private Storage + Retention; parallel with B; needs a deletion-meaning product decision)
    -> Package C (Private Envelope + Encryption Authority; needs REAL B + D + independent crypto-export track)

Nostr Identity Binding Arc (in progress, unmerged): orthogonal to all four packages.
```

## Failure semantics

`putConversation` mirrors `FedosBoardPersistence`'s own
`FedosBoardPersistenceWriteResult` vocabulary exactly
(`inserted`/`already-present`/`conflict`/`failed`) — no new failure
vocabulary is invented. A Conversation record is never partially
written: construction either fully succeeds (all fields present and
valid) or produces no record at all, matching `FedosBoardPost`/
`FedosBoardOutboxIntent`'s existing fail-closed-to-`null` construction
discipline.

## Persistence ownership

`FedosConversationPersistence` is a new, independent port (`08`) —
Board, Outbox, Observation, and Conversation logs remain four separate
persistence concerns, none embedding another's data. No secret material
is ever placed in a Conversation or Policy record (`08`).

## Migration notes

Introducing `FedosConversationPersistence` and
`FedosConversationRecordV1` requires no migration of existing Board/
Outbox data — Conversation records are derived facts recorded going
forward from thread-root creation, not backfilled from existing posts
in this spec's scope. (Whether historical threads should be backfilled
with a Conversation record is a product decision this spec does not
make; V1 code paths work correctly whether or not backfill occurs,
since `toFedosConversationId()` is deterministic and idempotent either
way.) `05`'s policy-reuse migration notes govern how `FedosConversationPolicy`
itself evolves without invalidating existing `"public-v1"`-tagged
records.

## Security claims that may be made

- Every V1 Conversation's mode, policy, and outbound eligibility are
  exactly as visible and fail-closed as today's public Board post
  behavior — no new attack surface is introduced by adding a
  Conversation identity/record layer that does not change any actual
  read/write/eligibility behavior.
- No caller can construct a `private-group`/`direct` Conversation record
  or cause one to be persisted, in V1.
- No secret material (key, capability token, ciphertext) can be placed
  in a `FedosConversationRecordV1` or `FedosConversationPolicy` value —
  neither type has a field capable of holding one.

## Security claims that must NOT be made

- **Not** "private conversations are supported" — `mode` accepting the
  value at the type level is not support.
- **Not** "messages are encrypted" — no encryption authority is wired;
  V1 messages remain ordinary, plaintext `FedosBoardPost` values.
- **Not** "invitations are one-time" — `FedosConversationInviteAuthority`
  cannot even represent an invitation yet, let alone redeem one
  exactly-once.
- **Not** "conversations can be deleted" — no deletion, physical,
  remote, or logical-tombstone, is implemented by this spec.
- **Not** "membership is enforced" — no membership authority exists;
  `writeAccess: "restricted"` remains correctly rejected.

## Next Arc recommendation

**Recommend exactly one, unconditionally: Package A — the Conversation
Identity & Record Foundation Arc**, as specified in full by `03`/`04`/`05`/`08`
above. This recommendation does not depend on, and is not made
contingent on, the outcome of the in-progress Nostr Identity Binding
Arc — Package A touches Conversation identity/record/persistence only,
none of which the Nostr Identity Binding Arc's own scope (Nostr
signing-authority-to-identity binding) overlaps or blocks.

Two conditional recommendations for the Arc **after** Package A,
depending on how the in-progress Nostr Identity Binding Arc resolves:

**If Nostr binding succeeds** (a real signing-authority-to-identity
mapping exists, and `evaluateFedosOutboundEligibility()` can resolve at
least one real target as `"eligible"` rather than permanently
`"identity-not-controlled"`): recommend the following Arc replace
`StaticFedosConversationPolicyAuthority` with a real, persisted
per-Conversation policy authority, and begin Package D's storage-backend
design in parallel — public-mode delivery now genuinely works
end-to-end, so it is a reasonable point to start the (independent,
non-blocking) groundwork for private storage without distraction, while
deferring Package B's product decision (redemption authority choice)
until it is actually needed.

**If Nostr binding remains blocked** (the identity-to-signing gap
persists): recommend the following Arc continue Package A/D's
groundwork rather than waiting on Nostr binding — Conversation identity,
the Conversation persistence port, and private-storage-backend design
are all fully unblocked by that outcome, per `14`'s dependency graph.
Do not begin Package B or attempt to work around the identity gap by
introducing a parallel, non-Nostr identity path as a substitute — that
would be a scope decision outside this review, and outside what a
Conversation Foundation Arc should decide on Identity's behalf.
