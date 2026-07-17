# Review 01 — Integrated Source Inventory and Branch Reconciliation

## Required reconciliation, performed before any other document was written

The task commissioning this review names five prerequisite pieces the
"integrated source" should contain: **Envelope + Encryption Authority**,
**Draft Construction Runtime**, **Identity Resolution + Coordinators**,
**Invitation/Draft Management**, **Runtime Consolidation**. A direct
`git log --all --graph` and `git branch -a --contains <commit>` pass,
run before this worktree was created, found that **no single branch in
this repository contains all five** as of this review's own commit.
Three lines have diverged from a shared base (`bb1893e`):

```
*   d15a107  Merge 'arc/conversation-identity-resolution-encryption-coordinator'
|\           into arc/private-conversation-activation-direct-messaging
| * f36c334  Alpha 931-990: Conversation Identity Resolution and Encryption
| |          Coordinator Arc  <- resolves the Alpha 890 key-resolution blocker
* | 8b65609  Alpha 1051-1110: Conversation Runtime Consolidation Arc (master)
|/
*   bb1893e  merge (private-conversation-construction -> ...)
```

A fourth commit, `50082bc` ("Alpha 991-1050: Conversation Invitation
Transport & Draft Management Arc"), sits on yet another branch
(`arc/conversation-invitation-draft-management`) branched from `9846ba4`
— it is **not an ancestor of `d15a107`, `f36c334`, or `master`**, and no
branch in this repository merges it with either `8b65609` or `f36c334`
(confirmed: `git merge-base --is-ancestor` checked against all three
pairwise combinations, none satisfied).

**Decision made by this review, stated plainly rather than assumed:**
this review's worktree (`review/private-protocol-delivery-group-v1`) is
branched from **`d15a107`** — the most-integrated real commit, combining
Runtime Consolidation (`master`'s own tip) with the Identity
Resolution/Encryption Coordinator Arc. This is a deliberately different
(and more advanced) starting point than plain `master`: `master`'s own
README still describes the Alpha 890 key-resolution blocker as "carried
forward unchanged," but `f36c334` (merged into this worktree's base)
resolves it. Every claim below is checked against this worktree's own
checked-out `src/`, `packages/fedos-core-rust/src/`. Content that exists
only on `arc/conversation-invitation-draft-management` (`50082bc`) is
inspected via `git show 50082bc:<path>` **without checking that branch
out or merging it into this review's worktree** — every reference to it
below says so explicitly and is never described as "present in `src/`."

`C:/wt/private-direct-messaging` (tracking `arc/private-conversation-activation-direct-messaging`,
also at `d15a107` at the time of writing) is a **separate, live worktree
this review does not touch** — it is plausibly where the "Alpha
1111–1180"-shaped activation work the task's preconditions anticipate is
being built concurrently. This review reads its tip commit only via
`git show`/`git log`, never its working tree, and makes no claim about
what that worktree may contain beyond this commit.

## What is real (non-noop, non-review-only) in this worktree's own `src/`

**Envelope + Encryption/Decryption Authority (Alpha 851–8XX, `59cd1bf`,
unmodified in `d15a107`):** `FedosConversationMessageEnvelope`
(`src/conversation/envelope/fedos_conversation_message_envelope.ts:76-88`)
— real fields, real validator, real persistence (in-memory + append-only
NDJSON). `FedosWasmConversationEncryptionAuthority`/
`FedosWasmConversationDecryptionAuthority`
(`src/conversation/encryption/fedos_wasm_conversation_{en,de}cryption_authority.ts`)
are real, calling `FedosMasterSeedAuthority.resolveConversationKey()`
(`src/runtime/master_seed/fedos_master_seed_authority.ts:39`), itself a
real `#[wasm_bindgen]` export (`packages/fedos-core-rust/src/lib.rs`,
`resolve_conversation_key`) reusing the pre-existing, NIP-44-vector-
verified `derive_conversation_key_via_ecdh_internal`
(`packages/fedos-core-rust/src/crypto/conversation_key.rs:235`).

**Identity Resolution + Coordinators (Alpha 931–990, `f36c334`, present
in `d15a107` only, NOT on plain `master`):**
`FedosConversationEncryptionCoordinator`/`FedosConversationDecryptionCoordinator`
(`src/conversation/encryption/fedos_conversation_{en,de}cryption_coordinator.ts`)
are real, wired into `FedosConversationRuntime.encryptMessage()`/
`decryptMessage()`. `FedosConversationKeyResolver`
(`src/conversation/encryption/identity/fedos_conversation_key_resolver.ts`)
composes four real resolver stages and **genuinely resolves**
`localAccountIndex`/`counterpartyPublicKeyHex` from a live
Conversation/Membership pair — the exact blocker `59cd1bf`'s own commit
message named as open is closed in this worktree's base commit.

**Structural, permanent V1 limits this same Arc's own code enforces,
not a gap in this review's reading:**
`MembershipFedosConversationParticipantResolver.resolveCounterparty()`
(`.../fedos_conversation_participant_resolver.ts:62-78`) requires
**exactly one** other active member — zero returns `"no-counterparty"`,
two-or-more returns `"ambiguous-counterparty"`. Group encryption is not
merely unimplemented; it is **structurally, deliberately rejected** by
already-shipped code. `resolveFedosConversationCounterpartyPublicKeyHex()`
(`.../fedos_conversation_counterparty_public_key_resolver.ts:48`) returns
`"unsupported-authority"` for every `FedosConversationParticipantAuthority`
except `"nostr"` — a non-Nostr counterparty can never resolve a key.

**The one blocker that survives even in this most-integrated base,
confirmed by direct read of both Coordinators' own gates
(`fedos_conversation_encryption_coordinator.ts:201-203`,
`fedos_conversation_decryption_coordinator.ts:107-109`):** both read the
raw persisted `lifecycleState` and fail closed to
`"conversation-not-active"` unless it is exactly `"active"`.
`fedos_conversation_lifecycle_state.ts` (`FEDOS_CONVERSATION_CONSTRUCTIBLE_LIFECYCLE_STATE`,
line 40) fixes the only constructible value to `"draft"` — **nothing in
this worktree's own `src/` can construct an `"active"` Conversation**.
Every downstream question this review answers (delivery, retry, group
strategy) is therefore evaluated against a pipeline that is real,
wired, and end-to-end, but categorically unreachable today for that one
named reason — restated throughout this review, never silently assumed
fixed.

**Invitation/Draft Management (`50082bc`, inspected via `git show` only,
absent from this worktree's checked-out `src/`):**
`fedos_conversation_invitation_transport.ts` is a thin application-layer
facade re-shaping the frozen Capability issuer/redemption authorities
(Alpha 780/783) into invitation-shaped results, plus one genuinely new
piece: `FedosConversationInvitationRevocationRegistry`, an additive
revocation gate checked before redemption. It performs no protocol
delivery of any kind — it is an in-process facade over an already-real
Capability boundary, not a transport in the network sense this review's
own title uses the word. It is not integrated with anything this review
proposes below.

## What is real and reusable in `src/board/` (public posting — NOT the Conversation domain)

A full public-posting Outbox/Publisher/Observation/Retry stack exists
under `src/board/outbox/`, `src/board/publish/`, `src/board/observation/`,
plus real Nostr signing/relay/ACK-correlation code under `src/nostr/`
and `src/board/publish/nostr/`, and non-functional (inbound-only,
unwired) ActivityPub/ATProto/Session adapters under
`src/board/activitypub/`, `src/board/atproto/`, `src/board/session/`.
`02`–`13` inventory this in full. **Confirmed by direct grep of
`src/board/outbox/`, `src/board/observation/`, `src/board/publish/`:
zero references to `src/conversation` anywhere in those three
directories, and zero references the other way** — the Conversation
domain has no outbox, publisher, or observation system of its own
today, and nothing under `src/board/` is wired to deliver a private
Envelope.

## A further sibling commit landed while this review was being written

Confirmed by a second `git log --all`/`git branch -a` pass taken while
drafting this review (not at the start): `arc/private-conversation-activation-direct-messaging`
has since advanced from `d15a107` to `f7fbb67` ("Merge branch
'arc/conversation-invitation-draft-management' into
arc/private-conversation-activation-direct-messaging"), merging in
`50082bc` and thereby integrating all five precondition pieces the
task names onto one branch for the first time. `git diff --stat d15a107 f7fbb67`
confirms this merge introduces only the same 23 files `50082bc`'s own
diff already introduces (invitation/draft-management code, plus a
merge-conflict resolution in `fedos_conversation_runtime.ts`/
`fedos_conversation_runtime_assembly.ts` — both already read in full
above) — no new crypto, protocol, or delivery-relevant code, and (per
`fedos_conversation_managed_draft_state.ts`, read directly via
`git show 50082bc:...`) its own "managed draft state" vocabulary is an
explicit, additive **subset** of the existing lifecycle states —
`"draft"`/`"tombstoned"` only, deliberately excluding `"active"`/`"closed"`
(file header: "this Arc performs no activation and no close"). The
"nothing can construct an `active` Conversation" finding above is
therefore unchanged even by this newest sibling commit. This review's
own worktree remains pinned at `d15a107` rather than rebasing onto
`f7fbb67` mid-review, because (a) the delta is confirmed immaterial to
every finding above, and (b) this review's own instructions describe a
rebase-after-landing workflow for exactly this situation rather than
continuous rebasing during writing. A future rebase, per the task's own
addendum, should simply confirm this same immateriality against
whatever has landed by then.

## See also

- `docs/reviews/private_message_envelope_v1/` (Envelope/Encryption
  Authority design basis, Alpha 851–8XX)
- `docs/reviews/private_conversation_construction_v1/18_protocol_delivery.md`
  (this review's own direct predecessor on the protocol question)
- `docs/reviews/private_conversation_security/05_key_distribution.md`,
  `17_backup_multi_device.md` (group-crypto design basis, `14`–`18`
  reconfirm rather than re-derive these)
