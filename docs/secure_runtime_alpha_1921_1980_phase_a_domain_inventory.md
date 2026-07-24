# Secure Runtime Alpha 1921–1980 — Phase A/B Design Record
## Group Conversation Archive Integration and Cross-Branch Recovery Arc

Run in a dedicated integration worktree (`C:\wt\group-archive-integration`,
branch `arc/group-conversation-archive-integration-recovery`), built from
`master` (`8c48c95`, Alpha 1471–1540). This document covers the
Preconditions/Reconciliation step and Phase A/B design decisions only — no
production code changes are included here (per this Arc's own "No
production change first" instruction for Phase A). Implementation
(Phases C–I) is tracked separately.

## 0. Branch reconciliation

### 0.1 Ancestry inspection

`master` (`8c48c95`) already contains the Archive Foundation
(`5a283ad`, Alpha 1541–1610) as a direct ancestor, but contains **zero**
Group Conversation code and **zero** Direct-messaging activation/send
facade — that entire lineage (Alpha 931–1470, including Identity
Resolution, Direct Activation/Messaging, Production Crypto Runtime
Activation, and Private Group Pairwise Fanout Foundation) lives on a
sibling branch that diverged from `master`'s own line at `8b65609`
(Alpha 1051–1110, "Conversation Runtime Consolidation") and was never
merged back. This is the exact, named blocker `83a25b0`'s own status
text records: *"this worktree's own branch contains zero Group
Conversation code and zero Direct-messaging activation/send facade at
all."*

Required sources resolved to concrete commits:

| Precondition | Resolved to | Notes |
|---|---|---|
| `83a25b0` or integrated equivalent | `83a25b0` exactly | direct child of `master` HEAD — a clean, single-commit, purely-additive diff (14 files, all archive/desktop-runtime wiring) |
| `5a283ad` Archive Foundation | already an ancestor of `master` | no merge needed |
| `3dc4f7a` or later Group Runtime | `71c938b` (Alpha 1391–1470, "Nostr Private Direct and Pairwise Fanout Delivery") | latest commit on the Group lineage before it turns into wire-standardization/NIP-17 territory (`a64b1ac` → `97e563b`), which this Arc is explicitly told not to merge. `71c938b` already contains `3dc4f7a` as an ancestor (merged via `85b66d6`/`f12553e`), so pulling `71c938b` transitively satisfies the `3dc4f7a` precondition and also brings the real Direct/Group persistence, Membership/Capability persistence, Envelope/Payload persistence, and real development-Runtime crypto (Production Crypto Runtime Activation, Alpha 1261–1320) preconditions in one step |

`a64b1ac` (Nostr Private Wire Standardization) was deliberately **not**
merged — it is the commit that pulls in NIP-17 wire-format work, out of
scope per this Arc's own explicit prohibition.

### 0.2 Merge sequence and conflicts (all resolved additively/chronologically, no overwrite)

1. `git merge 83a25b0` into a fresh branch off `master` — **zero conflicts**
   (83a25b0's only parent is `master` HEAD).
2. `git merge 71c938b` — 5 conflicting files, all in the mechanical/additive
   class this Arc's own instructions anticipate (`git merge-tree` preview
   confirmed no conflicts at all in `src/conversation/transport`/`relay`
   despite both lines having independently reworked those directories
   since their common ancestor — git's 3-way merge resolved those
   non-overlapping hunks cleanly on its own):
   - `src/desktop/runtime/fedos_desktop_runtime.ts` — both sides added a
     new sibling accessor to `FedosRunningDesktopRuntime`
     (`conversationArchiveRuntime()`/`privateTransport()` from the Archive
     side, `conversationProductionCryptoCapability()` from the Group
     side). Resolved by keeping both — no semantic overlap.
   - `src/desktop/runtime/fedos_desktop_runtime_config.ts` — both sides
     added new optional config fields plus a duplicate `import type
     { FedosNostrSigningAuthority }`. Resolved by keeping the union of all
     fields and deduplicating the one shared import.
     `conversationEnvelopeLogPath`/`conversationPayloadLogPath` were
     declared identically on both sides (both branches independently wired
     the same shared Envelope/Payload logs into their own facade) —
     deduplicated to one declaration; `conversationPayloadMaxByteLength`
     (Archive/Transport side) and `conversationMaxPayloadByteLength`
     (Group side) are genuinely two distinct, already-coexisting fields
     controlling two different constructions — both kept.
   - `test/secure_runtime_alpha_606_runtime_assembly.test.ts` and
     `test/secure_runtime_alpha_758_local_runtime_ownership.test.ts` — both
     assert the exact `Object.keys(runtime)` surface; each side's own
     assertion only listed its own new key. Resolved by combining into the
     full 7-key surface (`boardRuntime`, `conversationArchiveRuntime`,
     `conversationProductionCryptoCapability`, `conversationRuntime`,
     `host`, `privateTransport`, `stop`).
   - `README.md` — both branches' own "Status:" blockquote had advanced
     independently past their common ancestor. Resolved by preserving
     **all** history additively: `master`'s newer current status
     (Alpha 1691–1760) stays on top; the Group lineage's own status chain
     (Alpha 1391–1470 → 1321–1390 → 1261–1320 → 1181–1260 → 1111–1180) is
     spliced in as a contiguous "Prior status" block, ahead of `master`'s
     own older entries (1471–1540, 1541–1610), which in turn continue into
     the shared common history both lines already agree on verbatim from
     Alpha 1051–1110 backward. No status text was deleted or overwritten.

No non-mechanical architecture conflict was found — every conflict was two
independent, non-overlapping additive extensions to the same file, which is
exactly the class of conflict this Arc's own preconditions anticipated and
authorized resolving directly.

### 0.3 Post-merge baseline

- `npm run typecheck`: clean except the one pre-existing,
  cross-Arc-documented failure
  (`test/secure_runtime_alpha_477_scheduler_lifecycle_model.test.ts`) —
  zero new errors introduced by any conflict resolution.
- `npx vitest run`: 760/952 test files passing, 12,259/12,505 tests
  passing. All 192 failing files were individually categorized against
  the full log and every one falls into a category already documented as
  pre-existing by a prior Arc's own completion declaration, none of them
  touching Conversation/Archive/Group/Encryption code:
  - ~24 `test/fedos_core_rust_*`/`test/nip44_*`/`test/secp256k1_*`/
    `test/worker_crypto_boundary.test.ts` — the same
    `core.autocrlf=true`-driven CRLF artifact in `Cargo.toml` a fresh
    `git worktree add` checkout produces (`expected +0 to be 11`,
    documented verbatim by Alpha 1391–1470's own completion declaration).
  - ~90 `test/runtime_*`/`test/runtime_wasm_*` — the companion WASM
    build-artifact-absent category (`artifact-missing`) for a fresh
    worktree that has never run the WASM build step; not a code defect.
  - ~60 `test/secure_runtime_alpha_001`–`060` plus assorted
    identity/protocol-root-handle/publish-scheduler files
    (147–410-range) — pre-existing, environment- or
    documentation-string-content assertions, unrelated to this Arc's own
    domain (confirmed spot-checked: `test/secure_runtime_alpha_617_no_implicit_startup_guard.test.ts`
    fails identically, 2/3 tests, on the pre-Group-merge
    `C:\wt\conversation-archive-runtime` worktree alone — proven
    pre-existing, not introduced by this merge).
  - 3 `test/reviews/*/source_alignment.test.ts`-family "git working tree
    is clean" guards — by-construction red until this Arc's own commit
    lands, per every prior Arc's own identical precedent.
  - `test/secure_runtime_alpha_1261_1320_production_gate_semantics.test.ts`/
    `_real_crypto_vertical_slice.test.ts` — `"artifact-missing"`, same WASM
    build-artifact category above.

  Zero new failures attributable to the merge itself.

## 1. Phase A — Integrated Group/Archive domain inventory (Alpha 1921)

| Domain | Persistence | Status |
|---|---|---|
| Group Container | *(none — a `private-group` Group is an ordinary `FedosConversationId` record; there is no separate Group Container port)* | **Already archived** — covered by the existing Direct bundle's own `conversation` field once the Collector is pointed at the Group's own conversation id |
| Group generation | `FedosGroupGenerationPersistence` (`src/conversation/group/fedos_group_generation.ts`) | **Must be added** — new domain, no existing archive coverage |
| Group path | `FedosGroupDirectPathPersistence` (`fedos_group_direct_path.ts`) | **Must be added** |
| Group Message | `FedosGroupMessagePersistence` (`fedos_group_message.ts`) | **Must be added** |
| fanout delivery record | `FedosGroupFanoutDeliveryPersistence` (`fedos_group_fanout_delivery.ts`) | **Must be added** |
| child Direct Conversation | `FedosConversationPersistence` (existing, generic) | **Already archived, mechanism exists** — but the Group Collector must be extended to additionally walk every Group Path's own `directConversationId` and collect that child Conversation's own bundle; this is new *orchestration*, not a new record shape |
| Membership | `FedosConversationMembershipPersistence` (existing, generic — already keyed by any conversation id, Group's own and each child Direct's own) | **Already archived**, once the Collector loops over Group + every child Direct id |
| Capability | `FedosConversationCapabilityPersistence` (existing, generic) | **Already archived**, same as Membership |
| Envelope | `FedosConversationMessageEnvelopePersistence` (existing, generic, per child Direct Conversation) | **Already archived**, same as Membership |
| payload | `FedosConversationPayloadStorage` (existing, generic) | **Already archived**, same as Membership |
| activation | `FedosConversationActivationPersistence` (`src/conversation/activation/`) | **Intentionally excluded** — mirrors the Direct archive's own existing, already-accepted precedent: `FedosConversationArchiveBundleV1` does not include an activation field today. Activation is a one-time bootstrapping coordination log (`prepared → … → completed`), not required to reconstruct history; a restored Conversation/Membership/Envelope set is already usable without replaying activation phases. Group's own child Direct paths reuse the identical `FedosConversationDirectActivationCoordinator`, so the same reasoning applies unchanged — fixing this for Direct is out of this Arc's own scope |
| retention/tombstone | `FedosPayloadRetentionPersistence` (`src/conversation/retention/`) | **Intentionally excluded** — same existing Direct precedent: retention decisions are not in `FedosConversationArchiveBundleV1` today. A deleted payload is simply absent from `getPayload()` and therefore never collected in the first place, so no separate tombstone fact is needed to prevent resurrection on restore. Extending Direct's own retention-archiving is a separate, orthogonal gap this Arc does not adopt |
| coordination/recovery record | Group Message's own superseded `"planned"`/`"failed"` facts before reaching `"complete"`; Fanout Delivery's own superseded `"planned"`/`"encrypting"` facts before `"stored"`/`"failed"` | **Intentionally excluded (current-record-only)** — see §2 |

## 2. Canonical vs. derivable decision (Alpha 1922)

- **Generation**: canonical, archive **every** record (`listGenerations()`,
  not just the current one) — unlike Message/Fanout below, every past
  generation is independently meaningful (Alpha 1950 requires "generation
  history" and "removed member excluded from later generation" to survive
  a round trip; an old generation is never superseded content-wise, only
  numerically surpassed).
- **Path**: canonical, archive every path record across every known
  generation (`listPathsForGeneration()` per generation id collected
  above) — a historical Group Message's own `fanoutDelivery.pathId` can
  reference an OLDER generation's path, so only archiving the current
  generation's paths would silently break restore's own referential
  validation (Alpha 1936) for older messages.
- **Group Message**: canonical, but only the **current** (highest-ranked
  `fanoutState`) record per id is needed — mirrors Membership's own
  existing "current record per id is sufficient" precedent, not
  Capability's own "raw events, a reconstructed count loses information"
  precedent, because a Group Message's own current record already carries
  every field a superseded `"planned"` fact would (id, generation, sender,
  timestamps, `replyToGroupMessageId`, `recipientCount`) — nothing is lost
  by not replaying the intermediate, not-yet-resolved state.
- **Fanout delivery**: canonical, current-record-per-(message, recipient)
  only, same reasoning — the durable fact worth preserving is the
  resolved `envelopeId`/`"stored"` linkage; a superseded `"planned"`/
  `"encrypting"` fact carries no information the resolved fact doesn't
  already supersede.
- **Activation / retention**: derivable / not required — see §1.

## 3. Archive version decision (Alpha 1923)

`FedosConversationArchiveBundleV1` (and its Manifest sibling) is a closed,
fully-typed interface today — **not** already generic (Option A does not
apply; there is no existing extension point or `unknown`-bag field to
reuse). Option D (silently inject unknown fields) is rejected per this
Arc's own explicit instruction.

**Decision: Option B — an additive, OPTIONAL Group section under the same
`schemaVersion: 1`.** A new optional field
(`group?: FedosConversationArchiveGroupSectionV1`) is added to
`FedosConversationArchiveBundleV1`/`ManifestV1`; its absence means "this is
a Direct-only bundle," identical to every bundle this codebase has ever
produced. This is the smallest honest change that satisfies "old Direct
archives must remain readable" — the bundle *codec* does not need a second
schema-version branch, only one new optional field to parse when present.
Option C (bump to schema version 2) is rejected as unnecessarily heavy: the
container format itself is unchanged, only the payload it can optionally
carry grows, which is exactly what an optional field is for. This mirrors
`FedosConversationArchiveBundleV1`'s own existing precedent of aggregating
already-existing wire shapes without inventing a second format for any of
them.

## Next Arc step

Implementation (Phases C–I: Group Bundle Records, Export, Preflight,
Restore, Runtime round trip, corruption/security matrix, compatibility
regression, completion) is tracked as this Arc's own remaining, un-landed
work — not yet implemented as of this document. No production code has
been added in this pass; only the two branch-merge commits
(`20ae79a`, `03ac16e`) and this design record exist on
`arc/group-conversation-archive-integration-recovery` so far.

## Post-implementation correction (recorded during Phase C, see the
completion declaration's own §1 for the full finding)

§1's own "Group Container" row above — *"already archived — covered by
the existing Direct bundle's own `conversation` field once the
Collector is pointed at the Group's own conversation id"* — is
**factually incorrect** against real source, discovered while wiring
the Collector: no real `private-group`/`direct` Conversation is ever
written into `FedosConversationPersistence` by any real production
path in this codebase (that port/its sole validator,
`validateFedosConversationRecord`, Alpha 748, is Public-Board-only,
hard-rejecting any other `mode`) — a private Conversation's own
identity lives entirely in `FedosConversationDraftPersistence` +
`FedosConversationActivationPersistence` instead, a pre-existing gap
in the Direct Archive Foundation/Runtime this Arc does not introduce
and (per its own "extend don't redesign" rule) does not fix. This does
NOT invalidate the Alpha 1923 archive-version decision (§3) or the
canonical-vs-derivable table (§2) — both stand as designed and were
implemented unchanged. It changes only the Collector's own
group-detection SIGNAL, from the (never-true-for-a-real-Group)
`conversation.mode === "private-group"` to the real, authoritative
`groupGenerationPersistence.currentGenerationForGroup(conversationId) !== null`.
See `docs/secure_runtime_alpha_1921_1980_completion_declaration.md`
§1 for the full derivation and its own recommended next-Arc follow-up.
