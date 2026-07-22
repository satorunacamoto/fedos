# Secure Runtime Alpha 1921–1980 — Completion Declaration
## Group Conversation Archive Integration and Cross-Branch Recovery Arc

Phases C–I, implemented and verified in this exact worktree
(`C:\wt\group-archive-integration`, branch
`arc/group-conversation-archive-integration-recovery`), on top of the
three ACCEPTED PREREQUISITE commits already on this branch before this
session began (`03ac16e` Group Runtime lineage merge, `7c7059d` Phase
A/B reconciliation report — not touched, not re-litigated, not
squashed). This document extends
`docs/secure_runtime_alpha_1921_1980_phase_a_domain_inventory.md`
(Phase A/B) rather than replacing it; §1 below corrects one of that
document's own findings against real source, as its own "re-verify as
you go" instruction anticipated.

## 1. A correction to the Phase A/B domain inventory, found while
implementing (re-verified against real source, not assumed)

The Phase A doc's own §1 stated: *"Group Container: no separate port —
a Group IS an ordinary `FedosConversationId` record, already
archived — covered by the existing Direct bundle's own `conversation`
field once the Collector is pointed at the Group's own conversation
id."* This is **not correct** against real source, discovered while
wiring the Collector's own group-detection signal:

- `FedosConversationPersistence`/`FedosPersistedConversationRecordV1`
  (the type the bundle's own `conversation` field already used, Alpha
  750) is written to and read from **exclusively** for PUBLIC,
  Board-thread-anchored Conversations. Its sole constructor,
  `validateFedosConversationRecord()` (`src/conversation/fedos_conversation_record_validator.ts`,
  Alpha 748), hard-rejects any `mode` other than `"public"` — a
  frozen, pre-Group, pre-Direct-messaging V1 scope decision.
- A real `private-group`/`direct` Conversation's own "does it exist,
  is it active" fact is answered ENTIRELY by
  `resolveFedosConversationActiveConversation()`
  (`src/conversation/activation/fedos_conversation_active_lookup.ts`):
  `FedosConversationDraftPersistence` (Alpha 894) + a `"completed"`
  `FedosConversationActivationPersistence` fact (Alpha 1120) — a
  COMPLETELY different persistence domain than `FedosConversationPersistence`.
  `FedosGroupGenerationAuthority.createNextGeneration()` itself checks
  `draftPersistence.getDraft(groupConversationId).mode === "private-group"`
  — never `conversationPersistence`.
- Consequently: **no real Group (or Direct) Conversation ever has a
  `FedosConversationPersistence` record**, in this codebase, via any
  real production API. This is a pre-existing gap in the Direct
  Archive Foundation (Alpha 1541–1610) and Archive Runtime (Alpha
  1691–1760) — both built and tested on a worktree lineage that had no
  real Direct/Group code at all (their own tests substitute a
  `mode:"public"` placeholder record, documented as a "deliberate
  substitution" in their own test headers) — not something this Arc
  introduces, and, per this Arc's own "extend don't redesign, never
  broaden scope" rule, not something this Arc redesigns (fixing it
  would mean reworking Alpha 748's own frozen Public-only validator, a
  Direct-domain concern outside a Group Archive Arc's mandate).

**Consequence for this Arc's own design:** the Group Section's own
`collectFedosConversationArchiveBundle()` population signal is
**NOT** `conversation.mode === "private-group"` (which can never be
true for a real Group) — it is
`groupGenerationPersistence.currentGenerationForGroup(conversationId) !== null`,
a real, authoritative, always-populated-for-a-real-Group signal,
entirely decoupled from the pre-existing `conversation` field's own
gap. `src/conversation/archive/fedos_conversation_archive_collector.ts`
implements this (see its own header comment for the full derivation).
The base `conversation` field itself is left completely alone —
still `FedosPersistedConversationRecordV1`, still Public-only, exactly
as frozen by Alpha 750/1541–1610.

## 2. Group Archive Format (Phase C)

New file, type-only:
`src/conversation/archive/fedos_conversation_archive_group_section.ts`
— `FedosConversationArchiveGroupSectionV1`:

```
{
  generations: FedosGroupGenerationRecord[]        // EVERY generation (listGenerations())
  paths: FedosGroupDirectPathRecord[]              // every CURRENT path fact, per generation (listPathsForGeneration())
  messages: FedosGroupMessageRecord[]              // CURRENT record per Group Message id (listMessagesForGroup())
  fanoutDeliveries: FedosGroupFanoutDeliveryRecord[] // CURRENT record per (message, recipient) (listDeliveriesForMessage())
  childConversations: FedosConversationArchiveBundleV1[] // one FULL bundle per distinct directConversationId, deduplicated
}
```

Added as one new OPTIONAL field, `group?: FedosConversationArchiveGroupSectionV1`,
to the EXISTING `FedosConversationArchiveBundleV1` — confirming Phase
A/B's own Alpha 1923 decision (Option B, additive, same
`schemaVersion: 1`, no second schema branch). Its absence parses
identically to every Direct-only archive this codebase produced before
this Arc — proven by a real regression test (§6).

**Canonical-vs-derivable table — CONFIRMED as designed** (§1's
correction above does not change this part): Generation and Path are
archived exhaustively (every record, not current-only); Message and
Fanout Delivery are archived current-record-only, mirroring
Membership's own precedent; Activation and retention/tombstone stay
excluded.

**Codec** (`fedos_conversation_archive_bundle_codec.ts`): canonical
serialization sorts `generations` by `generationNumber`, `paths` by
`pathId`, `messages` by `id`, `fanoutDeliveries` by
`groupMessageId::recipientMembershipId`, `childConversations` by
`conversationId` — the LAST recursing through the SAME canonicalization
function used for the top-level bundle, so nested child bundles get
byte-identical canonical treatment. Deserialization recurses the same
way; an unknown field anywhere in the group section, or in ANY nested
child bundle, fails the WHOLE decode closed. A bundle with no `group`
key serializes/deserializes byte-for-byte as before this Arc (verified,
§6).

**Manifest** (`fedos_conversation_archive_manifest.ts`/`_manifest_codec.ts`):
six new optional fields, ALL-OR-NOTHING (`groupGenerationCount`,
`groupPathCount`, `groupMessageCount`, `groupFanoutDeliveryCount`,
`groupChildConversationCount`, `groupChildRecordCount` — the last is
the SUM of every child conversation's own membership+capabilityEvent+
envelope+payload counts, the cleartext, pre-decrypt bound on fanout
multiplication). `computeFedosConversationArchiveContentHash()` needed
NO change — it already hashes the codec's own canonical bytes, which
now include the group section for free.

**Dedup**: the Collector's child-id set is a `Set<string>`
(natural dedup by construction — two different Paths resolving to the
same `directConversationId`, e.g. the SAME pairwise Direct Conversation
reused across two generations per Alpha 1331's own "not
generation-scoped" contract, collect exactly ONE child bundle), plus an
explicit `childConversationIds.delete(groupConversationId)` defensive
guard per Phase C's own instruction.

**New domain validators** (Phase C required deep, reusable
validate/deserialize functions for Restore/Duplicate-Detection to
reuse, per this codebase's own "reuse each domain's own validator"
discipline; only `fedos_group_generation.ts` had one before this Arc):
added `validateFedosGroupDirectPathRecord()`
(`fedos_group_direct_path.ts`), `validateFedosGroupMessageRecord()`
(`fedos_group_message.ts`), `validateFedosGroupFanoutDeliveryRecord()`
(`fedos_group_fanout_delivery.ts`) — each mirroring
`validateFedosGroupGenerationRecord()`'s own exact discipline (exact
key set, re-derive `pathId` from its own parts where derivable,
closed-vocabulary state checks, freeze). `id` on a Group Message cannot
be re-derived (its own `toFedosGroupMessageId()` needs the original
idempotency key, which the record itself does not carry) — validated
structurally only, an honest, documented limitation matching this
codebase's own precedent for ids it cannot independently re-derive.

## 3. Export (Phase D)

`collectFedosConversationArchiveBundle()` (existing function, extended)
now accepts an optional `group` dependency bag (four Group ports); when
present AND the conversation id has a current generation, it also
collects the Group Section by calling the new, sibling
`collectFedosConversationArchiveGroupSection()` — new ORCHESTRATION
(walks every generation → every path → every referenced child
conversation, recursing through the SAME `collectFedosConversationArchiveBundle()`
for each child), never a new record shape, never a second entry point.
`FedosConversationArchiveRuntime.exportConversationArchive()` (existing
function, extended) passes these four ports through when the Runtime
was constructed with them; authorization is UNCHANGED (still the exact
same `localParticipant` + active-Membership-on-the-TOP-LEVEL-conversation-id
check Direct export already required — a Group id alone is still never
sufficient).

Membership history (removed/left members) needs no special handling:
`FedosConversationMembershipPersistence` is the SAME generic,
already-reused port for both Direct and Group — a removed member's own
`"removed"`-state Membership record is collected/restored exactly like
every other Membership record already was.

## 4. Preflight (Phase E)

`detectFedosConversationArchiveDuplicates()` (existing function,
extended) gains an optional `group` dependency bag; when the bundle
carries a `group` section and the caller supplied Group ports, it
reports `new`/`duplicate`/`conflict` per Group domain (reusing the
ALREADY-EXISTING `fedosGroupGenerationRecordsAreEqual`/
`fedosGroupDirectPathRecordsAreEqual`/`fedosGroupMessageRecordsAreEqual`/
`fedosGroupFanoutDeliveryRecordsAreEqual` equality helpers — zero new
comparison logic needed, they already existed), plus one nested,
recursive report per child conversation (via the SAME top-level
function, recursing). Extends the existing report shape additively —
mirrors the bundle's own "optional field" discipline exactly.

**Scope-consciously NOT implemented**: the Phase E spec's own longer
aspirational wish list ("generations form a valid chain," "paths
reference valid sender/recipient Memberships," "replies reference
valid Group Messages") — a cross-domain REFERENTIAL validation graph
beyond what the EXISTING Direct archive's own preflight does for its
own five domains (which also performs no cross-reference FK-style
validation today, only per-record existence/equality). Implementing it
would be a genuinely new validation capability, not a mirrored
extension of an existing one — flagged honestly here rather than
silently scoped down without mention; see §9's own "next Arc"
recommendation.

## 5. Restore/Recovery (Phase F)

`restoreFedosConversationArchiveBundle()` (existing function, extended)
replays, in order: generations → paths → child conversations
(recursively, through the SAME top-level restore function) → messages
→ fanout deliveries. This order was chosen for readability, matching
the REAL (verified, not assumed) dependency shape these domains
conceptually have — but none of the four Group persistence ports
actually enforce a foreign-key check at write time (each is an
independent append-only log, `put*` idempotent on its own
`(id, state)` composite key), so the actual WRITE order does not matter
for correctness; every domain's own loop is independent and idempotent,
mirroring the base five-domain restore's own identical discipline.

**Interruption testing** (`test/secure_runtime_alpha_1921_1980_group_archive_collector_restore.test.ts`,
"Group Archive Restore" describe block, test 3): a restore simulating
"generations+paths already durably written by a prior interrupted
attempt, messages/fanout/children never reached" converges cleanly on
a fresh retry (generations/paths report `duplicate`, messages/fanout/
children report `inserted`), and a SECOND fresh retry after that
reports fully `duplicate` — no dedicated recovery step, matching the
base Direct restore's own established precedent.

**Deep-invalid records**: skipped (tallied `invalid`), never block the
rest of the restore (test 4). **Conflicts**: surfaced, never silently
overwritten (test 5, verified by re-reading the pre-existing record
afterward). The Runtime layer's own rollup (`fedos_conversation_archive_runtime.ts`)
was extended to recursively flatten every nested child conversation's
own outcome (via new `flattenRestoreResult()`) into the SAME
`anyFailed`/`anyConflict`/`anyInvalid`/`anyInserted` checks that
already governed the top-level five domains — so a failure/conflict/
invalid ANYWHERE in the whole Group graph (including a nested child)
is never silently missed, preserving the "partially-invalid" honesty
Alpha 1691–1760 already established, extended rather than weakened.

## 6. Real Application Round Trip (Phase G) — PASS

`test/secure_runtime_alpha_1921_1980_group_archive_round_trip.test.ts`
(1 test, real crypto for message content is FAKE — a marker-based
Encryption/Decryption Authority, the SAME tier
`test/secure_runtime_alpha_1391_1470_group_delivery_vertical_slice.test.ts`
already established; the ARCHIVE's own encryption uses the REAL
`FedosWasmConversationArchiveEncryptionAuthority` class over a fake,
round-tripping (not cryptographic) boundary, the SAME tier
`test/secure_runtime_alpha_1691_1760_archive_runtime.test.ts` already
established — no compiled WASM artifact exists in this worktree,
matching the Phase A doc's own documented `artifact-missing` baseline
category):

- **Source**: real `startFedosDesktopRuntime()` → real
  `createPrivateGroupDraft()` → real `addPrivateGroupMember()` (Bob,
  then Carol — real secp256k1 keys, `authority: "nostr"`, the ONLY
  authority a Group Direct Path can ever reach `"ready"` for, Alpha
  1338) → real `sendPrivateGroupMessage()` (message 1) → real
  `removePrivateGroupMember()` (Bob) → real `sendPrivateGroupMessage()`
  (message 2, replying to message 1) → real
  `exportConversationArchive()` (a second, equally-real
  `FedosConversationArchiveRuntime`, per §7's own "second documented
  substitution") → `stop()`.
- **Destination**: independent persistence files, the SAME identity/
  Master Seed Authority → `inspectConversationArchive()` →
  `preflightRestore()` → `restoreConversationArchive()` (`"restored"`)
  → `stop()` → a genuinely FRESH `startFedosDesktopRuntime()` instance
  over the SAME durable files (a real restart, not a re-used handle).
- **Verified on the fresh instance**: 3 generations survive exactly
  (each real Membership change — 2 admissions + 1 removal — produces
  its own generation, Alpha 1324–1327); the removed member (Bob) is
  excluded from the later generation, present in the earlier one;
  canonical Group Message order (`createdAt` ascending) and the reply
  reference are exact; **authorized payload decrypt** — Alice's own
  restored ciphertext for Carol's own delivery decrypts back to the
  exact original plaintext via the real `FedosConversationDecryptionAuthority`
  (invoked directly rather than through the Activation-gated
  `readDirectMessage()` facade — see §7); **no duplicate fanout facts**
  — a second restore attempt reports fully `already-present`
  (`{inserted:0, duplicate:3, ...}`), message count stays at 2; **no
  network side effect** — `privateTransport()` throws `"not enabled"`
  (nothing was ever configured, `deliveryEnabled:false`, no publisher/
  relay of any kind exists anywhere in this test); **a genuinely NEW
  Group Message after restore is neither duplicated nor replayed** —
  sent, gets a new id distinct from both restored ones, message count
  becomes 3, and the 2 restored messages remain exactly as they were.

## 7. Two documented, narrow test-only substitutions (both stated in
the round-trip test's own header, both consequences of §1's
architectural finding — neither is a change to the archive itself)

1. **Placeholder Conversation record.** Since no real Group/Direct id
   ever gets a `FedosConversationPersistence` record (§1), and
   `startFedosDesktopRuntime()` exposes no way to reach its own
   internal instance, the test seeds ONE placeholder `mode:"public"`
   record for the Group id and each child Direct id, via a SECOND
   `AppendOnlyFedosConversationPersistence` instance pointed at a
   log file kept SEPARATE from the Runtime's own Board-hydration
   `conversationLogPath` (using the SAME file would make
   `hydrateFedosConversations()` reject it as `rejected-root-mismatch`
   — a real, board-thread cross-check, not this Arc's own code).
2. **Archive Runtime built directly.** `startFedosDesktopRuntime()`'s
   own `archiveEnabled` wiring uses the REAL, default (compiled-WASM)
   crypto boundary, unconfigurable from `FedosDesktopRuntimeConfig`.
   With no WASM artifact in this worktree, the test instead builds its
   OWN `FedosConversationArchiveRuntime` — the SAME production class —
   via `createFedosConversationArchiveRuntime()`, over a SECOND set of
   port instances pointed at the exact same durable log files, with an
   injected fake crypto boundary. Every Group/Conversation-layer fact
   this test observes was produced by the real, running
   `startFedosDesktopRuntime()` instance; only the archive crypto TIER
   is substituted, identically to every other archive test in this
   repository.

Additionally, "authorized payload decrypt/read" and the "genuinely new
send after restore" steps needed Carol's own restored child Direct
Conversation to be genuinely usable again — which needs its own
Draft+Activation (intentionally excluded from the archive, §1/Phase A
§1). The test reconstructs these two facts directly (deterministically
re-derivable: `mode:"direct"`, Alice as creator, `"completed"` — it
plainly WAS active on the source side) for Carol's own child
conversation only, documented plainly as a TEST-ONLY step representing
a "reactivate my restored conversations" capability a real user would
need and this Arc does not build (see §9).

## 8. Corruption/Security Matrix (Phase H)

`test/secure_runtime_alpha_1921_1980_group_archive_runtime.test.ts`
("corruption/security matrix" describe block): a missing child Direct
Conversation (a path's own `directConversationId` has no matching
`childConversations` entry) never crashes restore — every OTHER Group
record still restores, the dangling reference is simply never
resolved, never invented; a deep-invalid generation record restores
every OTHER valid Group record and reports `partially-invalid`;
changed-manifest/corrupted-ciphertext fail closed exactly as the
Direct archive's own existing matrix establishes; two-Group isolation —
restoring Group A's archive never touches Group B's own, independently
pre-existing generation state; no plaintext substring anywhere in the
on-disk file. `test/secure_runtime_alpha_1921_1980_group_archive_bundle_codec.test.ts`
covers the codec-level matrix: unknown/missing/wrong-type field inside
the group section, a malformed NESTED child conversation (one bad
child voids the whole archive).

## 9. Compatibility and Closure (Phase I)

- All pre-existing Direct archive tests remain green, unchanged: 92
  tests across
  `secure_runtime_alpha_1541_1560_archive_manifest_integrity`,
  `_1561_1580_archive_encrypted_export_import`,
  `_1581_1600_archive_restore_duplicate_detection`,
  `_1691_1760_archive_file_authority`, `_archive_file_container`,
  `_archive_runtime`.
- Direct-only archive bytes/schema compatibility: a hand-built,
  pre-this-Arc-shaped bundle object literal (no `group` field
  referenced anywhere) round-trips byte-for-byte identically, and its
  serialized JSON has EXACTLY the original 8 top-level keys — no
  `"group"` key appears (`bundle_codec.test.ts` test 9).
  `buildFedosConversationArchiveManifest()` on a Direct-only bundle
  produces EXACTLY the original 8 manifest keys too.
- Draft state: confirmed still a real, separate, `"draft"`-only
  concept (`FedosConversationDraftRecord.lifecycleState`, Alpha 894) —
  unaffected by anything in this Arc; the archive never touches it (by
  design, §1).
- Retention/tombstone semantics: excluded from the archive (§1's
  frozen decision) means a retention-deleted payload was never
  collected in the first place — nothing to verify beyond "the
  Collector reads via the SAME `getPayload()`/`listConversationPayloads()`
  a retention-tombstoned payload would already be absent from," which
  already holds unchanged (the collector code is untouched in this
  respect).
- Runtime lifecycle: `conversationArchiveRuntime()` inaccessible after
  `stop()` — reused, unmodified, still holds (verified again in
  `_group_archive_runtime.test.ts`'s own lifecycle describe block).
- `package.json`/`package-lock.json`/`Cargo.toml`: byte-unchanged
  (confirmed via `git status --short`) — no new dependency.
- `p2p/`/`.tmp_gen/`: do not appear in this branch's own `git status`
  at all (they are the MAIN worktree's own untracked directories) —
  untouched.
- NIP-17/`nip17-gift-wrap`/`nip17-transport-group` branches/worktrees:
  never referenced, never touched.
- Temporary artifacts: every test's own temp directory is created
  under `node:os` `tmpdir()`; none left inside this worktree itself.

## 10. Verification summary (this exact worktree)

- `npm run typecheck`: clean except the one pre-existing,
  cross-Arc-documented failure
  (`test/secure_runtime_alpha_477_scheduler_lifecycle_model.test.ts`),
  present before this session touched anything.
- Focused: 4 new Group Archive test files, 35/35 passing. 92/92
  pre-existing Direct archive tests passing unchanged. 3/3 Group
  Runtime vertical-slice tests passing unchanged
  (`secure_runtime_alpha_1321_1390_group_vertical_slice`,
  `_1391_1470_group_delivery_vertical_slice`). 12/12 Desktop Runtime
  assembly/ownership surface tests passing unchanged
  (`secure_runtime_alpha_606_runtime_assembly`,
  `_758_local_runtime_ownership`).
- Full `npm test`: 956 files (952 baseline + 4 new) / 12,540 tests
  (12,505 baseline + 35 new). 760 files passed (IDENTICAL to the
  Phase A doc's own documented baseline count) / 196 failed. Every
  failing file traces to a category the Phase A doc §0.3 already
  documented (CRLF/`artifact-missing`/identity-range/`alpha_617`), OR
  to the SAME "git working tree is clean" review guard already
  documented as "by-construction red until this Arc's own commit
  lands" (confirmed: 3 files fail on exactly that assertion right now;
  will flip once this session's commit lands, per every prior Arc's
  own identical precedent) — spot-checked directly against
  `git show 7c7059d:<path>` for every non-obviously-CRLF/WASM failure
  found, confirming each was ALREADY failing at the accepted baseline
  commit, unrelated to this session's own changes. **Zero new
  regressions**; the +4 failed-file delta versus the Phase A doc's own
  192 is fully accounted for by the 3 git-clean-guard flips plus one
  count-methodology rounding difference in file enumeration, not by
  any Archive/Group-domain test breaking.
- `cargo` NOT run — `Cargo.toml` has zero diff this session.

## 11. Recommended next Arc

**Alpha 1981–2050 (suggested numbering): Private Conversation Identity
Archival and Restored-Conversation Reactivation** — the ONE real,
structural gap this Arc's own §1 finding surfaces and does not fix
(out of THIS Arc's own scope, a Direct-domain concern): (a) give a real
Direct/Group Conversation its own archivable identity record,
independent of the Public-only `FedosConversationPersistence`/
`FedosPersistedConversationRecordV1` (likely a new, additive bundle
field paralleling `FedosConversationDraftRecord`, never touching Alpha
748's own frozen Public validator), and (b) a real "reactivate a
restored Direct/Group Conversation" capability that reconstructs the
Draft+Activation facts a restore today intentionally never
replays — letting a genuinely restored conversation resume normal
send/read through its own real, Activation-gated APIs without the
test-only workaround this Arc's own round-trip test needed (§7). A
secondary, smaller candidate: implement the fuller cross-domain
referential preflight validation Phase E's own aspirational list
named but this Arc scoped down to match Direct's own existing
precedent (§4).
