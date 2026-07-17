# Secure Runtime Alpha 1321–1390 — Source and Review Reconciliation Report

Private Group Pairwise Fanout Foundation Arc. Worktree
`C:\wt\private-group-fanout`, branch
`arc/private-group-pairwise-fanout-foundation`.

## 0. Branch reconciliation performed before any production file was written

`git log --all --oneline` at the start of this Arc showed the most
advanced integrated commit was `7990ce4` ("Secure Runtime Alpha
1181–1260: Conversation Runtime Finalization Arc"), on
`arc/private-conversation-activation-direct-messaging` — still ahead of
`master` (`8b65609`). No `Alpha 1261–1320` branch or commit existed
anywhere in this repository at the time this Arc began (confirmed by
`git for-each-ref` grepped for `1261`/`1320`/`production`/`crypto` —
zero matches), consistent with the task's own framing of a
"concurrently-running Production Crypto Activation Arc" this Arc must
not depend on or merge.

This Arc's own worktree/branch was created from `7990ce4`, then the
required Pairwise Fanout Review commit (`b205ff0`,
`review/private-group-pairwise-fanout-v1`) was merged in — a clean
merge (`489cc2b`) with zero conflicts, since that review commit only
adds files under `docs/reviews/private_group_pairwise_fanout/` and
`test/reviews/private_group_pairwise_fanout/`, disjoint from anything
`7990ce4` touches. **One merge performed, reported here in full**; no
other branch was merged.

## 1. Why private-group Direct activation remains forbidden

`FedosConversationDirectActivationCoordinator.activateDirectConversation()`
(`src/conversation/activation/fedos_conversation_direct_activation_coordinator.ts:99-102`)
contains its own named, deliberate "Private-Group Gate" (Alpha 1123):

```ts
// Step 2 -- verify direct mode. Alpha 1123's own Private-Group Gate:
// never activate, never invent a group/shared key, no message API
// ever becomes reachable for a private-group draft.
if (draft.mode !== "direct") return { outcome: "unsupported-mode" };
```

This is not a gap awaiting completion — activating a `private-group`
Conversation would require inventing what "active" means for N>2
participants (a shared epoch? a group key? a single Envelope readable
by all?), exactly the group-key design question the prior review
(`docs/reviews/private_group_pairwise_fanout/`) and this Arc's own
Absolute Prohibitions forbid inventing. The gate is confirmed
byte-for-byte unchanged by this Arc (`test/secure_runtime_alpha_1321_1390_architecture_and_secret_guards.test.ts`,
item 1).

## 2. Existing Group draft facts

A `private-group` draft is fully constructible today via the existing,
unmodified `FedosPrivateConversationConstructionCoordinator.createPrivateGroupDraft()`
(Alpha 915) — durable, `lifecycleState: "draft"` permanently (Alpha
893's own frozen validator statically rejects every other lifecycle
value for a draft record), holding a real creator Membership (owner
role) and an optional initial join Capability. Nothing about
construction implies activation or messaging.

## 3. Existing Membership facts

`FedosConversationMembershipAuthority` (Alpha 761–790, unmodified) is
mode-agnostic — `admit()`/`revoke()`/`leave()`/`findMembership()`/
`listMemberships()` all operate on any `FedosConversationId` with no
mode check of their own. A `private-group` Conversation's own
Membership roster is therefore already real and durable; this Arc adds
no new Membership transition, state, or role.

## 4. Existing Direct Conversation creation APIs

`FedosPrivateConversationConstructionCoordinator.createDirectDraft({recipient,
idempotencyKey})` (Alpha 915) constructs a real, durable `direct` draft
plus a one-time, recipient-bound join Capability, deriving the
Conversation id deterministically via `toFedosPrivateConversationId("direct",
requestId)` (Alpha 908) — the SAME `requestId`/`idempotencyKey` always
yields the SAME Conversation id, which this Arc's own Direct Path
Authority (`06`) reuses directly rather than inventing a parallel
id-minting scheme.

## 5. Existing invitation/admission APIs

`FedosConversationCapabilityIssuerAuthority.issueJoinCapability()` +
`FedosConversationCapabilityRedemptionAuthority.redeem()` (Alpha
780/783, unmodified) are the ONLY admission mechanism this codebase
has — this Arc's own `FedosGroupAdmission` (group-level add/remove) and
`FedosGroupDirectPathAuthority` (per-pair Direct admission) both
compose these two authorities directly, exactly mirroring how
`FedosPrivateConversationConstructionCoordinator` itself already uses
them for a draft's own creator/recipient. The separate Invitation
Transport facade (`src/conversation/invitation/`, Alpha 991–1050) is
untouched and remains available for the Group Container's own
invitations unchanged.

## 6. Required new canonical Group facts (what this Arc actually adds)

Four new, additive persistence domains under `src/conversation/group/`:
`FedosGroupGenerationRecord` (immutable Membership snapshot),
`FedosGroupDirectPathRecord` (one per-generation mapping from a member
pair to an underlying `direct` Conversation), `FedosGroupMessageRecord`
(local canonical fanout-send record), `FedosGroupFanoutDeliveryRecord`
(one per-recipient outcome record) — see `docs/secure_runtime_alpha_1321_1390_completion_declaration.md`
for the full field-level account.

## 7. Exact expected ripple scope

**New, additive only:** `src/conversation/group/` (20 files: 4 record/
port modules, 8 in-memory/append-only backend pairs, 2 authorities, 1
send coordinator, 1 admission module, 1 read facade, 1 top-level
facade, 1 participant-limit policy, 1 usability evaluator).

**Narrow, mechanical, additive-only edits** to four existing files —
every edit is a NEW optional field/branch, no existing field renamed,
removed, or made required, no existing method signature changed:
- `src/conversation/runtime/fedos_conversation_runtime.ts` — one new
  private field, one new constructor block wiring the Group facade over
  already-existing local variables, one new public accessor
  (`groupRuntime()`).
- `src/conversation/runtime/fedos_conversation_runtime_assembly.ts` —
  five new optional config fields, five new backend constructions,
  threaded into the returned dependency object.
- `src/desktop/runtime/fedos_desktop_runtime.ts` — four new log paths
  added to the existing parent-directory-creation loop and the existing
  assembly call.
- `src/desktop/runtime/fedos_desktop_runtime_config.ts` — five new
  optional config fields.

**Never touched:** `packages/fedos-core-rust/`, `src/conversation/encryption/fedos_conversation_{en,de}cryption_coordinator.ts`,
`src/conversation/activation/fedos_conversation_direct_activation_coordinator.ts`,
`src/conversation/encryption/identity/fedos_conversation_participant_resolver.ts`,
any Publisher/Scheduler/Outbox/Relay file, `p2p/`, `package.json`,
`package-lock.json`, `Cargo.toml`. Confirmed by
`test/secure_runtime_alpha_1321_1390_architecture_and_secret_guards.test.ts`.
