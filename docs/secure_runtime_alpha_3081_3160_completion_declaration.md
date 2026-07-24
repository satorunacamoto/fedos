# Secure Runtime Alpha 3081–3160 — Desktop Runtime Conversation Content
# Accessor and Application Shell Activation Arc — Completion Declaration

Branch/source reconciliation, Phase A precondition inventory, and the merge
that formed this worktree's own base are documented in
`docs/secure_runtime_alpha_3081_3160_reconciliation_report.md` (written
before any production edit in this Arc) — this document does not repeat
that material and instead covers Phases A(content-flow)–K plus the
completion declaration itself.

## 1. Content-flow inventory (Phase A)

**Direct messages — storage.** `FedosConversationDirectMessagingCoordinator`
(`src/conversation/messaging/fedos_conversation_direct_messaging_coordinator.ts`)
composes the frozen `FedosConversationEncryptionCoordinator`/
`DecryptionCoordinator` (Alpha 943/946): plaintext is encrypted, the
ciphertext lands in `FedosConversationPayloadStorage` under a fresh
`payloadId`, and a `FedosConversationMessageEnvelope` (metadata only —
`senderMembershipId`/`payloadId`/`encryptionSuite`/`keyEpoch`/`createdAt`/
`replyToEnvelopeId`) is durably written to
`FedosConversationMessageEnvelopePersistence`.

**Direct messages — read/decrypt.** `readDirectMessage()` resolves local
identity, verifies active Membership, loads the Envelope, verifies it
belongs to the requested conversation, checks `FedosPayloadRetentionAuthority.evaluatePayloadAccess()`
**before** any decrypt attempt, then delegates to `DecryptionCoordinator`.
`listDirectMessages()` (Alpha 1139) never decrypts — metadata + retention
state only.

**Group messages — storage.** `FedosGroupSendCoordinator`
(`src/conversation/group/fedos_group_send_coordinator.ts`) fans one logical
message out into N independent pairwise-encrypted Direct Envelopes — one
per active OTHER member, each via the SAME `FedosConversationDirectMessagingCoordinator.sendDirectMessage()`
above, over a per-(sender,recipient) pairwise Direct Conversation
(`FedosGroupDirectPathAuthority`). A local, canonical
`FedosGroupMessageRecord` (no plaintext/ciphertext) plus one
`FedosGroupFanoutDeliveryRecord` per recipient (mapping to that
recipient's own Envelope id) are the durable facts of one send.

**Group messages — read/decrypt.** `FedosGroupReadFacade.listMessages()`
(Alpha 1362/1366) is metadata-only, sourced from the **sender's own**
canonical record — it never reaches into a recipient's own Direct
Conversation. Reading a **specific recipient's own fanned-out plaintext**
had NO production API anywhere on this base before this Arc — see §3.

**Envelope/Payload persistence ownership.** Both are constructed inside
`startFedosDesktopRuntime()` (`src/desktop/runtime/fedos_desktop_runtime.ts`)
and passed into `FedosConversationRuntime` — never previously reachable
from any Runtime accessor (Alpha 2841-2920's own central finding).

**Membership/Capability ownership.** `FedosConversationMembershipAuthority`/
`FedosConversationCapabilityPersistence`, constructed once per
`FedosConversationRuntime`, reused by every coordinator (Direct, Group,
Activation, Reactivation) — never a second, divergent instance anywhere in
this Arc's own additions either.

**Identity resolution ownership.** `FedosConversationIdentityResolver`
(`DelegatingFedosConversationIdentityResolver` by default) — one instance
per `FedosConversationRuntime`, now also reachable read-only via
`resolveLocalParticipant()` (added by the pre-existing worktree state this
Arc inherited and completed).

**Activation/Reactivation checks.** `resolveFedosConversationActiveConversation()`
(`src/conversation/activation/fedos_conversation_active_lookup.ts`) is the
ONE shared "is this Direct conversation active" answer — **never**
`draft.lifecycleState`, which is permanently `"draft"` by construction
(Alpha 1116). This Arc found the pre-existing `FedosDesktopApplicationShell`
precondition check read `draft.lifecycleState` directly — a real, latent
defect that made `"requires-activation"` permanent and unfixable even after
Alpha 1111-1180/2041-2120 shipped real activation. Fixed in Phase I/E below
via a new `FedosConversationRuntime.resolveActiveConversation()` accessor.
A `private-group` id is **never** itself activated (Alpha 1123's frozen
Private-Group Gate) — its own send/receive readiness is
`FedosConversationGroupRuntime.readinessForPrivateGroup()`
(`"usable"` vs. everything else).

**Retention access checks.** `FedosPayloadRetentionAuthority.evaluatePayloadAccess()`
— already enforced inside `readDirectMessage()`/`FedosConversationSearchIndex`;
this Arc adds no second retention gate, only consumes the existing one
honestly (embedding `"tombstoned"`/`"payload-removed"` states in read
results rather than silently omitting or fabricating).

**Search Runtime dependencies.** `FedosConversationSearchIndex`
(`src/conversation/search/fedos_conversation_search_index.ts`) needs only
`draftPersistence`/`membershipAuthority`/a retention-preview dependency —
all already inside `FedosConversationRuntime`. `createSearchIndex()` (built
by the pre-existing worktree state) already returns one correctly-wired
instance; this Arc's own gap was that nothing RETAINED and FED it — see §5.

**Archive Runtime dependencies.** `FedosConversationArchiveRuntime`
(`src/conversation/archive/runtime/fedos_conversation_archive_runtime.ts`)
needs `conversationPersistence`/`membershipPersistence`/
`capabilityPersistence`/`envelopePersistence`/`payloadStorage` (+ optional
Group ports) plus a `FedosConversationArchiveEncryptionAuthority` and
`FedosConversationArchiveFileAuthority` — all already constructed by
`startFedosDesktopRuntime()` when `config.archiveEnabled` is `true`, and
already reachable via `runtime.conversationArchiveRuntime()`. **Important,
newly-discovered characteristic** (not a defect introduced by this Arc):
`exportConversationArchive()`'s own existence gate reads
`conversationPersistence.getConversation(conversationId)` — the PUBLIC,
Board-thread-derived Conversation record port (`FedosPersistedConversationRecordV1`,
requiring `boardId`/`rootThreadId`/`rootPostId`), a **completely separate
persistence domain** from the private Direct/Group draft conversation a
`FedosDesktopApplicationShell` caller actually creates and messages through
(`FedosConversationDraftPersistence`, id shape `private-draft::<mode>::<id>`).
Archiving a genuinely private Direct/Group conversation by its own real id
therefore requires a matching board-level Conversation record to
independently exist for the SAME id — this codebase's own pre-existing
Archive Runtime test suite (`test/secure_runtime_alpha_1691_1760_archive_runtime.test.ts`)
already manually constructs exactly this bridging record before every
export; this Arc's own Accessor does not invent an automatic bridge (that
would be new architecture, prohibited) and instead documents this honestly
— see §6/§9/Failure Matrix.

**Shell methods returning unconditional `"unavailable"` before this Arc.**
`listMessages` (once past existence check), `sendMessage`/`reply` (once
past authorization/lifecycle, itself permanently wrong per the
`lifecycleState` defect above), `search`, `archive`.

**Desktop Runtime construction graph.** `startFedosDesktopRuntime()`
constructs, in order: Board persistence → Host → `FedosBoardRuntime` →
production-crypto graph (if configured) → `FedosConversationRuntime` (owns
Direct/Group/Activation/Reactivation coordinators + Search Index factory) →
`FedosPrivateTransport` (if enabled) → `FedosConversationArchiveRuntime` (if
enabled) → **this Arc's own `FedosDesktopConversationContentAccessor`**
(always constructed, composing the two Runtimes above) → the returned
`FedosRunningDesktopRuntime` handle.

**Exact files changed** — see §7 below (file list) and `git status`.

**Baseline test failures in this worktree before this Arc's edits.** Zero —
`npm run typecheck` and every existing suite passed on the inherited base
(confirmed at the start of this session); the "gap" this Arc closes is a
missing CAPABILITY (Shell returning `"unavailable"`/wrong `"requires-activation"`
reasoning), not a failing test.

**Reproduction of a current `"unavailable"` result, before fixing it.**
Confirmed via `test/secure_runtime_alpha_2841_2920_desktop_application_shell.test.ts`
(inherited, run unmodified first): `shell.search()`/`shell.archive()`
asserted `"unavailable"` unconditionally, and `shell.listMessages()` on a
real, known conversation asserted `"unavailable"` (not the honest
`"requires-activation"` this Arc's own fix now produces — see §9's "Updated
historical tests" note).

## 2. Accessor ownership (Phase C)

`FedosDesktopConversationContentAccessor`
(`src/desktop/content_accessor/fedos_desktop_conversation_content_accessor.ts`)
is constructed exactly once inside `startFedosDesktopRuntime()`, given the
SAME `conversationRuntimeInstance`/`archiveRuntimeInstance` that function
already holds (never a second, divergent Conversation/Archive Runtime), and
an `isRuntimeRunning: () => !stopped` closure — the SAME lifecycle-gating
pattern `FedosConversationArchiveRuntime` itself already established.
`FedosRunningDesktopRuntime.conversationContentAccessor()` ADDITIONALLY
throws once `stop()` has run, giving two independent layers of
"inaccessible after stop" (mirrors `conversationArchiveRuntime()`'s own
precedent exactly). It owns exactly one `FedosConversationSearchIndex`
instance (built once via `conversationRuntime.createSearchIndex()`),
retained for the Runtime's whole lifetime, per that method's own "retain and
reuse ONE instance" contract. It constructs no persistence, no crypto
authority, no timer, no file handle of its own.

## 3. Authorization (Phase D)

Every read path resolves the LOCAL identity via
`FedosConversationIdentityResolver.resolveLocalParticipant()` — **never** a
caller-supplied identity. `listMessages()`/`readMessage()` explicitly check
active Membership before returning anything (`listDirectMessages()`/
`listPrivateGroupMessages()` themselves perform NO such check — a real gap
this Arc's own Accessor closes, since without it any caller knowing a
conversation id could otherwise read message METADATA for a conversation
they are not a member of). Every write path (`sendDirectMessage()`/
`sendGroupMessage()`) already enforces active Membership internally — the
Accessor adds a matching precondition check in
`FedosDesktopApplicationShell.#validateSendPreconditions()` for a fast,
honest early-exit (never learns activation state before authorization is
confirmed). Reply targets are checked to belong to the SAME conversation
(`getConversationMessageEnvelope(conversationId, envelopeId)` returns `null`
for a cross-conversation lookup — Alpha 1136/1141's own "no
cross-conversation existence oracle" rule, reused unmodified).

**New: reading a Group recipient's own plaintext.** No production API
existed for this before this Arc (§1). Added
`FedosConversationGroupRuntime.resolveLocalGroupMessagePlaintext()`
(`src/conversation/group/fedos_conversation_group_runtime.ts`) — composes
the SAME `FedosGroupFanoutDeliveryPersistence`/`FedosGroupDirectPathPersistence`/
`FedosConversationDirectMessagingCoordinator` instances `FedosGroupSendCoordinator`
itself already uses, resolving the local participant's own delivery record
then delegating to the frozen `readDirectMessage()` — invents no crypto, no
new Envelope lookup. Two new, honest outcomes:
`"own-message"` (the local participant IS this message's sender — no
self-Envelope was ever produced for them, `fedos_group_send_coordinator.ts`'s
own documented fan-out scope) and `"not-a-recipient"`.

## 4. Retention (unchanged, consumed honestly)

No new retention gate is added. `readMessage()` embeds the real, existing
`FedosPayloadRetentionState` in its returned view
(`"active"`/`"tombstoned"`/`"payload-removed"`/`"unavailable"`) rather than
collapsing every non-`"allowed"` state into a single failure — a caller
learns a message's retention status without ever receiving plaintext for a
denied one. `listMessages()` on Direct reuses `FedosConversationDirectMessageSummary.retentionState`
verbatim (Alpha 1139, unchanged) — a tombstoned message's METADATA still
lists (this base's own pre-existing, accepted design; only its plaintext is
ever gated, both via `listMessages()` — which never returns plaintext for
ANY message — and via `readMessage()`, which returns `plaintext.state:
"unavailable"` for it).

## 5. Message reads (Phase E)

`listMessages(conversationId)`: authorization check (see §3) → for `direct`,
the REAL activation check (`resolveActiveConversation`, fixing the Phase
A/§1 defect) → `listDirectMessages()`, mapped to a closed view, deterministic
`(createdAt, id)` order (unchanged upstream ordering, reused). For
`private-group`: authorization only (a Group id has no "activation" concept
— §1) → `listPrivateGroupMessages()`, mapped, deterministic order (unchanged
upstream). An unmessaged conversation returns `{ outcome: "ok", value: [] }`
— never conflated with `"unavailable"`.

`readMessage(conversationId, messageId)` (NEW method — Phase I explains why
adding it, rather than only widening `listMessages`, was necessary): dispatches
on mode, delegates to `readDirectMessage()`/`resolveLocalGroupMessagePlaintext()`,
maps every outcome into either an honest `ok` view (message resolvable,
content-level reason for missing plaintext: retention denial, own-message,
not-a-recipient, missing payload) or a genuine failure (not-found,
unauthorized, requires-activation, invalid-input, unavailable, failed) — see
Failure Matrix. Malformed envelopes fail closed to `"invalid-input"`
(`deserializeFedosConversationMessageEnvelope` returning `null`, unchanged).
No plaintext durable cache is introduced anywhere — the ONLY place plaintext
is held is the in-memory `FedosConversationSearchIndex` (an accepted,
pre-existing, non-persisted design, Alpha 2501-2580).

## 6. Send/reply (Phase F)

`sendMessage(conversationId, body, replyToMessageId)`/`replyToMessage(conversationId,
parentMessageId, body)`: dispatch on mode, delegate to `sendDirectMessage()`/
`sendPrivateGroupMessage()`. Returns a dedicated `FedosContentAccessorSendResult`
— `localWrite: "stored"` (only ever present on `ok`; a failed local write is
itself a top-level failure, never embedded) plus `fanout: "not-applicable" |
"complete" | "partial"` — the Phase F-required separation of "local write"
from "delivery/fan-out state." A Group send where NO recipient received
anything (`"fanout-failed"`) is a hard failure, never a fabricated `ok`.
Sender-Key Group send is not implemented — confirmed absent from this base
(`0` files matching `*sender_key*`, reconfirmed at the start of this Arc);
Pairwise is the only Group encryption mode here, and this Arc neither
downgrades nor auto-switches between modes that do not both exist.

## 7. Search (Phase G)

`searchConversations(query)` delegates to the ONE retained
`FedosConversationSearchIndex.searchKeyword()` (already retention-gated at
both ingest- and query-time, Alpha 2581-2620, unmodified), mapping each hit
envelope id to its conversation id via a NEW narrow accessor,
`FedosConversationSearchIndex.conversationIdForEnvelope()` — exposes the
index's own EXISTING internal linkage, not a second index. Indexing happens
ONLY when this Accessor itself already legitimately holds plaintext
(immediately after a real Direct `sendMessage()`/`readMessage()` succeeds) —
never a bulk/background decrypt pass (Phase G's own "no query-time
decryption bypass"). **Documented, deliberate scope limit:** Group messages
are NOT indexed by this Arc — a Group message's own per-recipient Envelope
lives under its pairwise Direct child's own conversation id, not the Group
id a caller holds; indexing it would either leak that internal id into a
search result or require inventing a remap this Arc declines to build.
Search is never gated by a "feature disabled" flag (unlike Archive) — it is
always constructed; only the Runtime running/stopped state gates it.

## 8. Archive (Phase H)

`archive(command)` is a closed, discriminated union over the FOUR real
operations `FedosConversationArchiveRuntime` actually exposes: `inspect`,
`preflightRestore`, `export`, `restore`. No `list`/`summary`/`verify`
operation is invented — this base's own Archive Runtime has no such
distinct capability (§1); `inspect` is the closest real "summary" (returns
the cleartext Manifest without decrypting), and `preflightRestore`'s own
duplicate-detection report is the closest real "verify." `export`'s
`"crypto-unavailable"` outcome (Master Seed Authority unavailable/locked)
maps to the Shell's own pre-existing `"requires-unlock"` outcome kind
(Phase H's own explicit requirement); `identity-mismatch` (wrong identity's
own key cannot open this archive) maps to `"unauthorized"` for both
`preflightRestore` and `restore`, kept distinct from `"requires-unlock"`
deliberately (a mismatched identity is not "currently locked," it fundamentally
cannot ever open this specific archive). `archive()` is `"unavailable"`
whenever `config.archiveEnabled` was never set — never fabricated readiness.

## 9. Shell mapping (Phase I)

`FedosDesktopApplicationShell`'s public shape is EXTENDED, never redesigned:
`listMessages`/`search`/`archive` keep their existing signatures (search/
archive gain a required parameter each — see below); `sendMessage`/`reply`
gain one new required `body: string` parameter and become `async`,
returning a NEW view (`FedosMessageSendResultView`) instead of `never`; one
new method, `readMessage(conversationId, messageId)`, is added.

**Why widening `sendMessage`/`reply` (not just adding new methods) was
necessary, not a redesign-for-its-own-sake:** this Arc's own explicit,
named objective is making Shell "send/reply... real" — a send is
structurally impossible without message content, and the pre-existing
signatures carried none. This is exactly the "reviewed architectural
defect" class Phase I's own instruction allows fixing (never renaming, but
widening a signature that cannot fulfill its own stated purpose).

`search()`/`archive()` similarly gain their one required parameter
(`query: string` / `command: FedosContentAccessorArchiveCommand`) for the
identical reason — the whole point of this Arc is making them real, and
neither operation is nameable without its own input.

Every accessor outcome kind maps 1:1 onto the Shell's own
`FedosDesktopShellOutcomeKind` (defined identically in both files —
confirmed, not assumed, by keeping the two vocabularies textually parallel).
`#validateSendPreconditions()` (pre-existing, Alpha 2841-2920) is preserved
almost verbatim — its ONE substantive change is reading
`FedosConversationRuntime.resolveActiveConversation()`/`FedosConversationGroupRuntime.readinessForPrivateGroup()`
instead of the permanently-`"draft"` `draft.lifecycleState` (§1's defect
fix) — the sender-authorization-before-lifecycle ordering, and every
existing outcome/reason shape, is unchanged.

**Updated historical tests (genuinely stale, per Phase K's own instruction
— never weakened, only corrected to the now-real behavior):**
`test/secure_runtime_alpha_2841_2920_desktop_application_shell.test.ts` —
`listMessages()` on a known, never-activated conversation now asserts the
MORE PRECISE `"requires-activation"` (previously asserted the coarser,
pre-fix `"unavailable"`); `search()`/`archive()` call sites gained their
required parameter and `archive()`'s own `await`; `sendMessage()`/`reply()`
call sites gained a `body` argument and `await`; the Search/Archive facade
test was renamed to assert `search()` is genuinely real (empty hits, not
`"unavailable"`) while `archive()` remains honestly `"unavailable"` (this
test's own config never sets `archiveEnabled`). Every PRE-EXISTING
assertion's own INTENT (conflict/not-found/unauthorized/invalid-input
ordering, no-leakage, isolation, restart-recovery) is unchanged — only the
call shape and the one now-real outcome were updated.
`test/secure_runtime_alpha_606_runtime_assembly.test.ts`'s own closed
key-enumeration test gained the one new key, `conversationContentAccessor`.

## 10. Lifecycle

`FedosDesktopConversationContentAccessor`: inaccessible before
`startFedosDesktopRuntime()` returns (it does not exist yet — no different
from every other accessor on the handle); accessible while running;
inaccessible after `stop()` via BOTH the handle's own throw and the
accessor's own internal `isRuntimeRunning()` check (defense in depth,
mirroring `conversationArchiveRuntime()`). No global singleton — a second
`startFedosDesktopRuntime()` call constructs a fully independent accessor
(confirmed by test). No timer, no file handle owned by the accessor itself.

## 11. Failure matrix (accessor-level outcome kinds)

| Situation | Outcome |
|---|---|
| Runtime not running / stopped | `unavailable` |
| Unknown conversation id | `not-found` |
| Local identity not an active member | `unauthorized` |
| Direct conversation not yet activated | `requires-activation` |
| Group conversation not yet `"usable"` | `requires-activation` |
| Malformed body / reply reference / envelope | `invalid-input` |
| Local identity unresolvable / crypto key unavailable | `unavailable` |
| Message/payload genuinely missing after existence confirmed | `not-found` (read) |
| Retention-denied payload (tombstoned/payload-removed), message resolvable | `ok` with `plaintext.state: "unavailable"`, real `retentionState` |
| Group message is local participant's own send | `ok` with `plaintext.state: "unavailable"`, reason `"own sender"` |
| Local participant is not a fan-out recipient of a Group message | `ok` with `plaintext.state: "unavailable"` |
| Zero-recipient Group fan-out failure | `failed` |
| Archive feature not enabled | `unavailable` |
| Archive source not found | `not-found` |
| Archive Master Seed Authority unavailable/locked (export) | `requires-unlock` |
| Archive identity cannot decrypt (preflight/restore) | `unauthorized` |
| Archive unsupported schema version | `unsupported` |
| Archive destination already exists | `conflict` |
| Any other backend failure | `failed` (never a raw `Error`) |

## 12. Security guarantees

- No persistence port (`FedosConversationDraftPersistence`,
  `FedosConversationMessageEnvelopePersistence`,
  `FedosConversationPayloadStorage`,
  `FedosConversationMembershipPersistence`, `FedosConversationCapabilityPersistence`,
  etc.) is ever returned by the Accessor or the Shell.
- No crypto authority, key handle, or Master Seed material crosses the
  Accessor/Shell boundary — every failure collapses to a coarse,
  non-secret outcome kind + short reason string.
- Every read/write resolves identity internally
  (`resolveLocalParticipant()`); no caller-supplied author is ever trusted
  for authorization or attributed as sender.
- Retention is consulted, never bypassed, on every read path.
- No new plaintext durable cache — the in-memory Search Index is the ONLY
  place plaintext is retained, and only for Direct messages this Accessor
  itself already decrypted/encrypted.
- No network call of any kind is introduced (verified by a dedicated test
  that fails the whole suite if `fetch` is ever invoked during any Accessor
  operation).

## 13. Real Runtime tests

`test/secure_runtime_alpha_3081_3160_content_accessor.test.ts` — 16 tests,
every one against a real `startFedosDesktopRuntime()` instance and real
append-only log files: accessor ownership/lifecycle/isolation; full Direct
send → reply → read → list round trip with exact plaintext; malformed-input
fail-closed; wrong-identity denial across two independent Runtime instances
sharing durable state; Group admit → send → real per-recipient read →
honest `"own-message"` → member removal excludes a future send; restored
(never-reactivated) conversation honestly `requires-activation` →
`reactivateRestoredConversation()` → real resumed send/read; real keyword
Search plus a real out-of-band retention transition removing both the
Search hit and the message's own plaintext; Archive `inspect`/`export`/
`preflightRestore`/`restore` wiring, `requires-unlock`, and the honest,
environment-driven `"failed"`/real-file `inspect` split documented in §14;
no raw Error/secret/ciphertext leakage; no hidden network activity.
Existing suites re-run unmodified (Direct messaging/activation, Group
vertical slice + delivery, Reactivation, Search/Retention, Archive
Runtime/CLI, Desktop Runtime assembly, Desktop Application Shell) — all
pass; two pre-existing tests were updated as genuinely stale (§9).

## 14. Baseline/final comparison

**Baseline** (start of this session, inherited worktree state, before this
Arc's own production edits beyond the pre-existing partial work already
found — see the reconciliation report): `npm run typecheck` clean except
one PRE-EXISTING, unrelated failure in
`test/secure_runtime_alpha_477_scheduler_lifecycle_model.test.ts` (committed
at `aff32c5`, untouched by this Arc, a `noUncheckedIndexedAccess` narrowing
issue in an 8-year-old scheduler test — confirmed via `git log`/`git diff`
against this exact file). Shell `listMessages`/`sendMessage`/`reply`/
`search`/`archive` unconditionally `"unavailable"` (or the wrong
`"requires-activation"` reasoning).

**Final:** `npm run typecheck` — identical, single pre-existing failure
only. Full `npm test`: 12774 tests, 254 failing — **every single failure**
falls into one of two independently-confirmed, pre-existing, environment-only
categories that predate and are unrelated to this Arc:
(1) ~230 tests reading `packages/fedos-core-rust/Cargo.toml`/`lib.rs` via
this checked-out tree's own raw-import mechanism, which returns empty
sections in this linked worktree (confirmed: the file exists on disk with
real content; the in-process read inside the test returns `""` — an
environment artifact, not a missing/corrupt file); (2) tests requiring the
real, compiled WASM crypto artifact (`buildRealParticipant: expected
"available", got "artifact-missing"` — confirmed: `pkg/` is not built in
this checked-out tree, affecting every "real, no-Fake-Authority" crypto
test uniformly, including this Arc's own honest discovery that
`startFedosDesktopRuntime()`'s `archiveEnabled` wiring has no test-injection
point for Archive's own crypto boundary, unlike messaging's
`conversationEncryptionAuthority`/`conversationDecryptionAuthority`). Every
test this Arc added or modified passes; every pre-existing conversation/
desktop/group/search/archive/shell test passes unmodified or (2 files) with
the narrow, documented staleness fix in §9.

## 15. Completion declaration

**COMPLETE.** `FedosDesktopApplicationShell.listMessages`/`readMessage`/
`sendMessage`/`reply`/`search`/`archive` perform real message read, send,
reply, Search, and Archive-boundary operations through the new
`FedosDesktopConversationContentAccessor`, while preserving: authorization
(Membership-gated on every read/write, identity always resolved
internally), Retention (consulted, never bypassed, honestly represented),
lifecycle (accessor unavailable before start/after stop, no singleton),
secret isolation (no port/authority/key/handle ever crosses the boundary),
and Direct/Group compatibility (both modes real for send/list;
Group-recipient read is real; Group-sender-own-message read is an honestly
documented structural gap, not a redesign target). No Rust/Cargo file
changed. `p2p/`/`.tmp_gen/` untouched.

**Recommended next Arc:** Desktop Local Conversation Management UI
Prototype Arc.
