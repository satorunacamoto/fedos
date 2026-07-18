# Secure Runtime Alpha 2041–2120 — Completion Declaration
## Conversation Identity Restoration and Reactivation Arc

Implemented and verified in this exact worktree
(`C:\wt\conversation-identity-reactivation`, branch
`arc/conversation-identity-restoration-reactivation`), based on `19b3d9f`
("Add Secure Runtime Alpha 1921-1980: Group Conversation Archive
Integration and Cross-Branch Recovery Arc"). Phase 1's own reconciliation
report, `docs/secure_runtime_alpha_2041_2120_reconciliation_report.md`,
was written and committed first, per this Arc's own "no production code
before this report" instruction; this document records what was actually
built and verified against it.

## 1. What was built

**Runtime ownership (per the reconciliation report §1): `FedosConversationRuntime`.**
A new class, `FedosConversationReactivationCoordinator`
(`src/conversation/activation/fedos_conversation_reactivation_coordinator.ts`),
composes EXISTING, unmodified machinery only —
`FedosConversationDraftPersistence`/`validateFedosConversationDraftRecord()`
(Alpha 894/895), `FedosConversationMembershipAuthority` (Alpha 761–790),
`FedosConversationIdentityResolver` (Alpha 931),
`FedosConversationDirectActivationCoordinator.activateDirectConversation()`
(Alpha 1122, byte-for-byte unmodified), and the read-only
`FedosGroupGenerationPersistence`/`FedosGroupDirectPathPersistence` ports
(Alpha 1321–1390). `FedosConversationRuntime` (`src/conversation/runtime/fedos_conversation_runtime.ts`)
gained one new private field (`#reactivationCoordinator`, constructed once
in the constructor over the SAME instances already built there — no
second, divergent object graph) and one new public method:

```ts
async reactivateRestoredConversation(conversationId: string): Promise<FedosConversationReactivationResult>
```

`FedosConversationReactivationResult`/`FedosConversationReactivationChildOutcome`
(`src/conversation/activation/fedos_conversation_reactivation_result.ts`)
is a new, closed result vocabulary mirroring
`FedosConversationDirectActivationResult`'s own discipline.

No existing file's public signature changed. No existing dependency
became required. `FedosConversationArchiveRuntime`, `FedosRunningDesktopRuntime`,
Runtime Factory, Desktop Runtime, Group Runtime, Conversation Runtime
(beyond the one additive method), Private Transport, NIP-17/Gift Wrap,
NIP-44 — none were touched.

## 2. Identity restoration approach

A restored Conversation's identity (its `FedosConversationId`) was never
in question — only its Draft record
(`mode`/`creator`/`policyReference`/`createdAt`) was missing, because the
archive deliberately never carries it (confirmed unchanged, reconciliation
report §4). `#ensureDraft()` re-derives it deterministically from
already-restored Membership facts alone:

- `mode`: `"private-group"` if `groupGenerationPersistence.currentGenerationForGroup(id) !== null`
  (the SAME real, authoritative Group-detection signal Alpha 1921–1980's
  own Phase A/B correction established), else `"direct"`. If a Draft
  ALREADY exists (e.g. a second reactivation call, or a conversation this
  Arc never needed to touch), its own already-persisted `mode` is trusted
  verbatim — deserialized via `deserializeFedosConversationDraftRecord()`
  and never re-derived or overwritten; a corrupt existing record fails
  closed to `"invalid-restored-state"` rather than being silently papered
  over.
- `creator`: the ONE `FedosConversationMembership` for this id whose
  `role === "owner"` — the ONLY role
  `FedosPrivateConversationConstructionCoordinator.#run()` ever assigns to
  a draft's creator, in every real construction path this codebase has.
  Absent (a genuinely malformed restore with no owner Membership at all):
  `"creator-unresolvable"`, never invented.
- `createdAt`: that same Membership's own `joinedAt`.
- `policyReference`: the closed, mode-determined constant
  (`"direct-draft-v1"`/`"private-group-draft-v1"`) — never a free value.

The record is built through `validateFedosConversationDraftRecord()`, the
SAME sole constructor every other Draft write in this codebase already
uses, then written via `putDraft()` — an ordinary, idempotent, append-only
write, skipped entirely once a Draft already exists.

## 3. Activation restoration approach

For a `direct` id (the top-level id itself, or — the real, load-bearing
case — each distinct pairwise child Direct Conversation a restored
Group's own Paths reference): once the Draft exists,
`FedosConversationDirectActivationCoordinator.activateDirectConversation()`
is called completely unmodified. It re-verifies EVERY precondition fresh
(policy, local identity, Membership, counterparty resolution, pairwise
key readiness, encryption/storage availability) and writes the
`"completed"` Activation fact — nothing about "what counts as active" was
touched.

A `private-group` id's own top-level Draft is reconstructed too, but it is
NEVER itself "activated" — Alpha 1123's own frozen Private-Group Gate is
untouched, and reactivation writes no Activation fact for a group id. The
group Draft alone is what `FedosGroupGenerationAuthority.createNextGeneration()`/
`evaluateFedosGroupUsability()` need (both require
`draft.mode === "private-group"`, confirmed in the reconciliation
report §3) — restoring it means future membership changes on a restored,
reactivated Group keep working, closing a blocker the prior Arc's own
completion declaration did not name.

Every distinct child `directConversationId` a Group's restored
Generations/Paths reference is walked and reactivated INDEPENDENTLY — one
per id, via the exact same Draft-then-Activate sequence above. A child the
local identity holds no active Membership for is legitimately skipped
(`"not-member"`), never forced; one child's failure never blocks any
other (mirrors the archive restore's own per-domain independent-loop
discipline).

## 4. Runtime reattachment / Conversation registration / Restart persistence

- **Reattachment**: `preparePath()` (`FedosGroupDirectPathAuthority`,
  unmodified) already returns early — never touching Draft/Activation —
  whenever a restored Path already reports `state === "ready"`, so a real
  post-restore Group send through an EXISTING generation would otherwise
  reach `sendDirectMessage()` and fail there (confirmed by this Arc's own
  round-trip test, before calling `reactivateRestoredConversation()`).
  This Arc's reactivation acts BEFORE that first post-restore send,
  reattaching the Runtime's own live coordinators to the restored state.
- **Registration**: writing the Draft record is itself the registration
  step — `draftPersistence.putDraft()` is the SAME durable log
  `conversationRuntime().findConversation(id)` reads from and (when a
  `FedosConversationDraftManager` is assembled) `listDrafts()` enumerates.
  No second, parallel "registry" concept was introduced; the existing
  Draft catalogue already IS the registration mechanism, once populated.
- **Restart persistence**: every write goes through the SAME durable,
  append-only ports (`FedosConversationDraftPersistence`,
  `FedosConversationActivationPersistence`, both already restart-stable by
  construction) — nothing new is held only in memory. Verified directly:
  the round-trip test's own Runtime C is a THIRD, fully independent
  process-equivalent instance over a second archive/restore cycle, and
  reactivation composes cleanly across it.

## 5. Authorization recovery

Reused, not invented (per this Arc's own governing instruction): the SAME
"local identity resolves, and holds an ACTIVE Membership on the
conversation id" check `activateDirectConversation()`/
`FedosGroupSendCoordinator.sendGroupMessage()` already enforce elsewhere
in this codebase, applied per id — at the top level AND, independently,
per child. A caller whose local identity was never a genuine, currently
active member of the restored conversation gets `"unauthorized"` (top
level) or `"not-member"` (a child); a genuinely unknown id (no Draft, no
Group generation, no Membership at all) gets `"conversation-not-found"`
before any identity check even runs. No new authorization model, no
network-facing trust boundary crossed, no widening of who may act on a
Conversation.

## 6. Verification (real flow, real Runtime APIs)

`test/secure_runtime_alpha_2041_2120_conversation_reactivation_round_trip.test.ts`
(1 test, PASS) — real `startFedosDesktopRuntime()` end to end:

- **Runtime A**: real `createPrivateGroupDraft()` → real
  `addPrivateGroupMember()` (Bob, Carol — real secp256k1 keys) → real
  `sendPrivateGroupMessage()` → real `exportConversationArchive()`
  (second, equally-real `FedosConversationArchiveRuntime`, the SAME
  documented substitution tier Alpha 1921–1980 established — no compiled
  WASM artifact exists in this dev environment) → `stop()`.
- **Runtime B** (independent files): `restoreConversationArchive()`
  (`"restored"`) → `stop()` → a genuinely FRESH `startFedosDesktopRuntime()`
  instance over the SAME durable files (a real restart).
- **Confirmed inert BEFORE reactivation**: `findConversation(groupId)`
  returns `null`; `readinessForPrivateGroup(groupId)` reports `"failed"`
  — both real, non-mutating Runtime reads, never a raw persistence-port
  peek.
- **`reactivateRestoredConversation(groupId)`** → `"reactivated"`, both
  distinct pairwise children (`Alice<->Bob`, `Alice<->Carol`) report
  `"reactivated"`.
- **Discover via a REAL Runtime read API**: `findConversation(groupId)`
  now returns a real `mode: "private-group"` record;
  `readinessForPrivateGroup(groupId)` now reports `"usable"`.
- **Resume messaging**: a genuinely NEW `sendPrivateGroupMessage()`
  succeeds (`"stored-for-all"`, a new, distinct `groupMessageId`); a
  REPLY to it also succeeds, correctly referencing it.
- **Idempotent reactivation**: calling `reactivateRestoredConversation()`
  again reports `"reactivated"` at the top level with BOTH children now
  `"already-active"` — the message count stays exactly 3 (1 restored + 2
  new), never duplicated by the repeat call.
- **Unrelated caller cannot hijack**: `reactivateRestoredConversation()`
  on a wholly unknown id returns `"conversation-not-found"`.
- **Archive again → restore into a fresh Runtime C → no duplicates**: a
  second, independent export/restore cycle over Runtime B's now-resumed
  state (1 originally restored + 2 new = 3 messages) reports
  `{inserted: 3, duplicate: 0, conflict: 0, failed: 0, invalid: 0}`, a
  second restore attempt against Runtime C's own destination reports
  `"already-present"`, and `listPrivateGroupMessages()` stays at exactly
  3 — never 6, never any duplicate. Reactivation on Runtime C succeeds
  too, proving the operation composes across a SECOND archive/restore
  cycle, not just one.
- **No plaintext/secret leakage**: every real plaintext string sent in
  this test (`"welcome to the group"`, `"back online after restore"`,
  `"replying after restore"`) is confirmed absent from BOTH raw archive
  files' own on-disk bytes.
- **No network side effect**: `privateTransport()` throws `"not enabled"`
  on both destination Runtimes — nothing was ever configured
  (`deliveryEnabled: false`, no transport of any kind).

`test/secure_runtime_alpha_2041_2120_conversation_reactivation_coordinator.test.ts`
(12 tests, PASS) — unit-level security/idempotency matrix directly over
`FedosConversationReactivationCoordinator`, simulating "an archive restored
Membership/Generation/Path facts but never Draft/Activation" without the
overhead of a full Runtime stack per scenario:

- Direct: happy-path reactivation (Draft re-derived from the owner
  Membership, then genuinely activated); idempotent second call
  (`"already-active"`, Draft never duplicated); `"unauthorized"` for a
  caller with no active Membership on the id (no Draft is ever written for
  a rejected caller); `"conversation-not-found"` for a wholly unknown id;
  `"identity-unavailable"`; `"creator-unresolvable"` when no Membership
  carries role `"owner"`; `"invalid-restored-state"` for a structurally
  corrupt pre-existing Draft (fails closed rather than silently
  re-deriving over it); an already-present VALID Draft is trusted
  verbatim and reactivation still proceeds to activation.
- Private-group: reactivates the group's own Draft AND every distinct
  pairwise child; idempotent second call (all children
  `"already-active"`, nothing duplicated — exactly 3 Draft records, never
  more); a child the local identity is no longer an active member of is
  skipped (`"not-member"`) while sibling children still reactivate; a
  caller with no Group Membership at all is rejected at the top level
  (`"unauthorized"`), before any child is even considered.

## 7. Security proof summary

- **No duplicated identity**: every Draft write is skipped once a Draft
  already exists for that id (`#ensureDraft()`'s own first check) — proven
  by `draftPersistence.listDrafts().length` staying constant across
  repeat calls in both the unit and round-trip tests.
- **No duplicated activation**: `activateDirectConversation()`'s own
  unmodified `"completed"`-short-circuit (Alpha 1122) is reused verbatim;
  a repeat reactivation call reports `"already-active"`, never re-running
  the durable write.
- **No duplicated capability**: this Arc issues no Capability of any kind
  — `#ensureDraft()`/`activateDirectConversation()` touch only Draft and
  Activation persistence; Membership/Capability state is read-only here.
- **No duplicated archive**: the round-trip test's own second
  archive/restore cycle reports `"already-present"` on a repeat restore
  attempt and an exact, non-doubled message count.
- **No replay**: a genuinely new post-reactivation send/reply always gets
  a fresh, distinct id, and the two originally restored messages are
  confirmed unchanged by it.
- **No overwrite**: an already-present Draft is read and trusted, never
  rewritten; `putDraft()`'s own append-only contract makes an overwrite
  structurally impossible even if attempted.
- **No plaintext/secret leakage**: verified directly against the raw
  on-disk archive bytes, not by type signature alone.
- **Restart safe**: every fact this Arc writes lives in the SAME durable,
  append-only ports the rest of this codebase already restart-verifies;
  the round-trip test's own Runtime B is a genuine restart (`stop()` then
  a fresh `startFedosDesktopRuntime()` over the same files) BEFORE
  reactivation is ever called.
- **Fail closed**: every rejection path (`"unauthorized"`,
  `"conversation-not-found"`, `"identity-unavailable"`,
  `"creator-unresolvable"`, `"invalid-restored-state"`,
  `"persistence-failed"`, `"activation-failed"`) is a closed, non-throwing
  outcome; nothing is ever invented or guessed in place of a genuinely
  missing fact.

## 8. Verification summary (this exact worktree)

A TRUE fresh baseline was captured IN THIS EXACT WORKTREE (not reused from
any other branch/Arc's own documented numbers, per this Arc's own
verification instruction): `git stash -u` (every uncommitted change and
new file set aside), a full `npm test` run at the clean `19b3d9f` tip,
then `git stash pop` to restore this Arc's own work before re-running.

- **Fresh clean-tree baseline (`19b3d9f`, nothing from this session
  present)**: 956 files / 12,540 tests. **764 files passed / 192 failed**;
  12,295 tests passed / 245 failed.
- `npm run typecheck` (with this Arc's own changes present): clean except
  the ONE pre-existing, cross-Arc-documented failure
  (`test/secure_runtime_alpha_477_scheduler_lifecycle_model.test.ts`) —
  confirmed present at the clean baseline too, so genuinely pre-existing,
  not introduced by this session.
- Focused: 2 new test files, 13/13 passing
  (`secure_runtime_alpha_2041_2120_conversation_reactivation_coordinator.test.ts`
  12/12, `_round_trip.test.ts` 1/1).
- Archive/runtime/group regression sweep (19 test files touching Direct/
  Group Archive, Conversation Runtime, Group Runtime, Local Runtime
  ownership — every file this Arc could plausibly have rippled into):
  193/193 passing, unchanged.
- **Full `npm test`, this Arc's own changes present (uncommitted at time
  of this run)**: 958 files (956 baseline + 2 new) / 12,553 tests (12,540
  baseline + 13 new). 762 files passed / 196 failed — a **+4 failed-file
  delta** versus the fresh 192-file baseline above, not the `+0` a naive
  "same as some other Arc's own final number" comparison might suggest.
  Diffed file-by-file against the baseline's own failure list
  (`comm -13`/`comm -23` over both sorted lists): ZERO files that passed
  at baseline now fail for a NEW reason, and exactly FOUR files fail for
  the first time —
  `test/reviews/conversation_foundation_v1/boundary_invariants.test.ts`,
  `test/reviews/private_conversation_security/boundary_guards.test.ts`,
  `test/reviews/private_message_envelope_v1/specification_consistency.test.ts`,
  `test/secure_runtime_alpha_531_ripple_review.test.ts` — spot-checked
  each directly: every one fails on its own "git working tree shows NO
  change under `src/`" (or equivalent ripple-scope) assertion, reacting
  correctly to this session's own STILL-UNCOMMITTED
  `src/conversation/runtime/fedos_conversation_runtime.ts` diff and new
  untracked files — the SAME "by-construction red until this Arc's own
  commit lands" phenomenon every prior Arc's own completion declaration
  documents identically; these flip back green the moment this session's
  commit lands (a clean working tree again satisfies every one of them).
  The 762 passed count is fully explained by 764 (baseline) − 4 (the
  above, now temporarily red) + 2 (this Arc's own two new, fully-passing
  files) = 762. **Zero real regressions** — confirmed by full diff, not
  assumed by count-matching alone.
- `cargo` NOT run — no Rust file changed this session (confirmed via
  `git status`); this Arc is TypeScript-level Runtime/lifecycle work only,
  exactly as scoped.
- `package.json`/`package-lock.json`/`Cargo.toml`: byte-unchanged.
- `p2p/`/`.tmp_gen/`: untouched (pre-existing untracked directories in the
  MAIN worktree, not this one).

## 9. Recommended next Arc

**Full cross-domain referential preflight validation** — Phase E's own
aspirational list (generations form a valid chain, paths reference valid
Memberships, replies reference valid Group Messages) that Alpha 1921–1980
scoped down to match Direct's own existing precedent (no cross-reference
FK-style validation today, only per-record existence/equality) remains the
clearest, most honestly-flagged remaining gap in the Archive/Restore
layer, independent of anything this Arc touched. A secondary candidate:
a user-facing "list every restorable-but-not-yet-reactivated conversation"
convenience view over `listDrafts()`/`findConversation()` plus a coarse
"needs reactivation" signal, for a real Desktop UI to surface directly
rather than a caller needing to know which ids to reactivate in advance.
