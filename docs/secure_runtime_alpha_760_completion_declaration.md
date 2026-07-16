# Secure Runtime Alpha 760 — Canonical Conversation Identity and Record Foundation Completion

Alpha 741–760 implements Package A from the approved Conversation
Foundation V1 review (`docs/reviews/conversation_foundation_v1/`,
branch `worktree-conversation-foundation-v1-review`, never merged into
this branch's own history — read via `git show`). Built on the
completed Alpha 641–720 identity/policy/eligibility foundation.
**PUBLIC MODE ONLY**, exactly as this Arc's own instruction scopes it.

## What is complete

- **Canonical Conversation identity** — `FedosConversationId`
  (`src/conversation/fedos_conversation_id.ts`, Alpha 743), deterministic
  from `(FedosBoardId, FedosThreadId)`, mirroring
  `makeFedosBoardOutboxId()`'s own established `::`-join convention. No
  duplicate identity is minted where the existing Board/Thread pair
  already suffices (Alpha 742).
- **Immutable public Conversation Record** — `FedosConversationRecord`
  (`fedos_conversation_record.ts`, Alpha 745), reusing the EXISTING
  `FedosConversationMode` (Policy Arc, unmodified — no second mode enum,
  Alpha 744) and a fixed `policyReference: "public-v1"` tag rather than
  an unjustifiable content hash (Alpha 746). Fail-closed construction
  via `validateFedosConversationRecord` (Alpha 748), enforcing the Root
  Mapping Contract (`rootPostId === rootThreadId`, Alpha 747).
- **Public-only validation** — `mode !== "public"` is rejected fail
  closed; no `private-group`/`direct` record is constructible anywhere
  in this Arc's own code.
- **Board/thread mapping** — one root Board Post, one Thread ID, one
  Conversation Record; a reply never creates a second one (Alpha 755).
- **Dedicated persistence port** — `FedosConversationPersistence`
  (`persistence/fedos_conversation_persistence.ts`, Alpha 749), never
  folded into Board persistence — an Application-layer concern
  `FedosBoardRuntime` owns directly, exactly like its own Policy/Identity
  Authorities.
- **In-memory and append-only backends** —
  `InMemoryFedosConversationPersistence` (Alpha 751, `FedosBoardRuntime`'s
  own default) and `AppendOnlyFedosConversationPersistence` (Alpha 752,
  zero new dependency, `node:fs` only), both verified with real,
  file-backed round-trips.
- **Restart hydration** — `hydrateFedosConversations()` (Alpha 756)
  cross-checks every persisted record against the hydrated Board state
  at `startFedosDesktopRuntime()` startup, failing closed on corruption
  or a root mismatch; legacy Board data with no Conversation record is
  honestly unaffected (Option C — readable, no fabricated history).
- **`FedosBoardRuntime` integration** — `createPublicThread()` durably
  records exactly one Conversation per root post (Alpha 754);
  `replyToPublicThread()` only resolves the existing one (Alpha 755).
  Both attach a new, additive `conversation: FedosConversationAssociationResult`
  field to their existing result shape — every pre-Arc caller/test
  matching on `.outcome`/`.post`/`.outbox` alone is unaffected (confirmed:
  `test/secure_runtime_alpha_629/630/636/637/639/656/676/677/678/679/698`
  all pass unmodified).
- **Read-only Conversation access** — `findConversation()`/
  `conversationForThread()`/`listBoardConversations()` (Alpha 753/757),
  never exposing the persistence object itself.
- **Local Runtime ownership** — `startFedosDesktopRuntime()` owns and
  injects Conversation persistence, with one new optional
  `conversationLogPath` config field (Alpha 758); no default
  repository-relative path.
- **No fake private support** — no membership, no invitation, no
  encryption, no lifecycle field, and no `isPrivate` boolean anywhere;
  `writeAccess: "restricted"` remains correctly rejected (no membership
  authority exists to honor it).

## Honest, no-atomicity claim

Board and Conversation persistence are separate ports with no shared
commit. A process crash between the two writes leaves a durable Board
post with no Conversation record — surfaced explicitly via
`FedosConversationAssociationResult`'s `"conflict"`/`"persistence-failed"`
outcomes, never silently hidden and never described as atomic (Alpha
754).

## Verification

- `npx tsc --noEmit` — zero new error (one pre-existing, unrelated
  error in `test/secure_runtime_alpha_477_scheduler_lifecycle_model.test.ts`,
  confirmed untouched by this Arc, present before this Arc began).
- 14 test files, 111 tests, all passing, covering every new module plus
  a real, durable end-to-end restart cycle (Alpha 759).
- Two PRE-EXISTING tests were updated, not weakened, to reflect this
  Arc's own reasoned additions: `test/secure_runtime_alpha_638_structural_guards.test.ts`
  test 4 (Conversation persistence is a deliberate, narrow exception to
  the "no Persistence import" guard — Host has no Conversation concept
  at all) and `test/secure_runtime_alpha_632_read_boundary.test.ts` test
  7 (its closed method-name list extended with the three new read
  methods).
- A full `npx vitest run` was characterized: ~215 pre-existing failing
  test files, all in the `fedos_core_rust_*`/`nip44_*`/other
  `?raw`-Rust-or-TOML-source-parsing category, reproduced as caused by
  this environment's `core.autocrlf=true` converting committed LF files
  to CRLF on checkout (confirmed directly against the committed blob's
  own line endings) — pre-existing, unrelated to this Arc, present on
  any fresh Windows checkout of the same base commit.
- Production changes confined to `src/conversation/` (nine new files),
  `src/board/runtime/fedos_board_runtime.ts`/`fedos_board_runtime_command_types.ts`,
  and `src/desktop/runtime/fedos_desktop_runtime.ts`/
  `fedos_desktop_runtime_config.ts` — no Board Post persistence schema
  change, no Rust/Cargo change, no new dependency, `p2p/` untouched.

## Still out of scope

Membership, capabilities, invitations, encryption, private message
envelope, private storage, direct/DM, private groups, pseudonyms,
deletion/compaction, moderation, protocol-specific conversation
mapping, GUI, Worker, Ontology/AI. None of these is referenced anywhere
under `src/conversation/` or in this Arc's own changes to
`src/board/runtime/`/`src/desktop/runtime/`.

## Next Arc recommendation — exactly one

**Membership & Capability Foundation.**

Chosen over Conversation Storage & Retention Foundation because this
Arc's own findings make membership the more load-bearing blocker:
`validateFedosConversationPolicy()` (Policy Arc, unmodified) already
rejects `writeAccess: "restricted"` specifically because no membership
authority exists — a real, already-observable gap this Arc's own
`FedosConversationRecord`/`FedosConversationReader` now give a stable
identity and read surface to build against. A real
`FedosConversationMembershipAuthority` and a real
`FedosConversationInvitationCapability` (per
`docs/reviews/conversation_foundation_v1/10_membership_boundary.md`/
`12_invitation_capability.md`) are the direct dependency every
`private-group`/`direct` construction path needs before either mode can
be honestly attempted — Storage & Retention's own blocker (which of the
eight deletion meanings to support, a real but narrower product
decision) does not block anything else in the dependency graph the way
Membership does. Per the approved review's own `14_arc_packaging.md`:
Package B (Membership + Capability) and Package D (Storage + Retention)
may proceed in parallel once Package A (this Arc) ships, but Package B
is the one every later private-mode Arc transitively depends on.
