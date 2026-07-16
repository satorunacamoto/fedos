# Secure Runtime Alpha 640 — Public Board Runtime Application API Foundation Completion

Alpha 621–640 implements the first real Application API on top of the
already-committed low-level runtime, following the design frozen by the
prior, review-only Board Runtime Application API & Conversation Model
Review (`docs/reviews/board_runtime_application_api_*`,
`docs/reviews/board_runtime_conversation_foundation_*`, branch
`review/board-runtime-api`, never merged into `master` — read via
`git show review/board-runtime-api:docs/reviews/...` from this Arc's
own separate worktree/branch, `worktree-alpha-621-640`). **PUBLIC MODE
ONLY**, exactly as this Arc's own instruction scopes it.

## What is complete

- **Public Application API** — `FedosBoardRuntime`
  (`src/board/runtime/fedos_board_runtime.ts`), constructed via
  `createFedosBoardRuntime({ host, idGenerator?, clock? })`. The first
  real caller shape for `FedosDesktopHost` outside its own test suite
  (confirmed by Alpha 621: zero production callers existed before this
  Arc).
- **Command validation** — `createPublicThread`/`replyToPublicThread`
  reuse `validateFedosBoardPost` (Alpha 257, unmodified) and
  `FedosBoardService`'s own existing thread-integrity precheck
  (missing-parent/cross-board-reply/invalid-thread, unmodified) — no
  duplicate validation logic written by this Arc.
- **ID authority** — `FedosBoardRuntimeIdGenerator`
  (`fedos_board_runtime_id_generator.ts`), default implementation using
  `@noble/hashes/utils.js`'s own `randomBytes`/`bytesToHex` (already a
  dependency; zero new dependency added).
- **Author policy** — `resolvePublicAuthorReference()`
  (`fedos_board_runtime_author_authority.ts`): prefers a real, resolved
  identity (`DesktopApplication.currentPublicIdentity()`), falls back to
  a single, fixed, explicit anonymous-local author reference
  (`{ identityId: null, protocol: "fedos", publicIdentifier:
  "local-anonymous" }`) whenever none resolves — which, per the prior
  review's own confirmed B1 finding (re-verified this Arc, unchanged),
  is **every** call today, since no default identity source is wired.
  Display pseudonym and cryptographic author are never conflated (no
  pseudonym concept exists in this Arc at all).
- **Local provenance policy** — every `FedosBoardRuntime`-authored post
  carries `source: { protocol: "fedos", reference: <the post's own
  generated id> }`, reusing the EXISTING `"fedos"` `FedosBoardSourceProtocol`
  value (already documented, pre-Arc, as "reserved for content authored
  directly through FedOS") — **zero Canonical Board model change** was
  needed for this Arc.
- **Thread/reply creation** — `createPublicThread` (a root post; per
  Alpha 631, structurally identical to "create a new thread" in this
  Canonical Model, so no separate thread-creation API exists) and
  `replyToPublicThread`, both routing exclusively through
  `FedosDesktopHost.submitPost()`/`submitPostWithOutbox()` — no direct
  `FedosBoardService` mutation anywhere in this Arc.
- **Host write-boundary reuse** — confirmed by Alpha 638's own
  structural-guard tests: no Persistence, Publisher, Relay, or crypto
  import anywhere under `src/board/runtime/`.
- **Read facade** — `findPost`/`recentFeed`/`thread`, delegating to
  `Host.board()`/`Host.query()`, never exposing either instance
  directly.
- **Local-only behavior** — omitting `outboundTargets` is a first-class,
  fully-tested product action (durable write, immediately query-visible,
  zero Outbox intent, zero network).
- **Explicit outbound intent** — `outboundTargets` creates a durable
  Outbox intent ONLY for targets the Outbound Eligibility gate
  (`fedos_board_runtime_outbound_eligibility.ts`) accepts (public
  protocols only, excluding `"session"`; author's own protocol must
  match the target's protocol) — evaluated strictly BEFORE
  `createFedosBoardOutboxIntent` is ever called, per the prior review's
  own §10 requirement.
- **No direct publishing** — confirmed by test (Alpha 633 #8):
  `FedosBoardRuntime` never calls a Publisher; only
  `Host.startDelivery()`'s own, separately-invoked Scheduler ever does.

## What is NOT implemented (unchanged from the prior review's own explicit scope)

private-group, direct/DM, membership, invitation, encryption, deletion,
thread-local pseudonym, moderation command, media, GUI, Worker
integration, Ontology. None of these is referenced anywhere under
`src/board/runtime/` (Alpha 638's own structural-guard tests confirm
this directly, not by assertion alone).

## Verification

- `npx tsc --noEmit` — zero new error (one pre-existing, unrelated error
  in `test/secure_runtime_alpha_477_scheduler_lifecycle_model.test.ts`,
  confirmed untouched by this Arc, present before this Arc began).
- 11 new test files, 83 tests, all passing:
  `test/secure_runtime_alpha_621_public_application_surface_inventory.test.ts`
  through
  `test/secure_runtime_alpha_639_end_to_end_verification.test.ts`.
- End-to-end verification (Alpha 639) exercises the REAL, durable
  (file-backed `AppendOnlyFedosBoardPersistence`/
  `AppendOnlyFedosBoardOutboxPersistence`) backends across a genuine
  Host stop → fresh-Host-restart → hydrate cycle, confirming the thread
  and feed survive intact through two entirely separate `FedosDesktopHost`/
  `FedosBoardRuntime` instance pairs.
- Production changes are confined to `src/board/runtime/` (six new
  files) plus this completion doc; no existing `src/` file is modified.

## Next Arc recommendation — exactly one

**A. Conversation Identity & Public Author Authority Arc.**

Chosen because identity resolution is provisional in this V1
(`resolvePublicAuthorReference()` falls back to the anonymous-local
author for every call today, per the confirmed, unchanged B1 finding) —
matching this Arc's own instruction: "IdentityがV1で暫定ならAを優先."
Wiring a real default `FedosPublicIdentitySource` is the single change
that would let every already-shipped piece of this Arc — command
validation, author policy, Outbound Eligibility's own "author protocol
must match target protocol" rule — start resolving real, attributable
authors more of the time, with zero change to any of their own logic
(`resolvePublicAuthorReference()`'s own real-identity branch is already
written and already tested, Alpha 627 tests 3–5). B (Visibility and
Conversation Policy Foundation Arc) and C (Private Conversation
Encryption Boundary Review) both remain valid future candidates — per
the prior review's own §15 dependency ordering
(`docs/reviews/board_runtime_application_api_15_implementation_dependency_order.md`)
— but neither is blocked by, or blocks, Identity resolution the way
every Conversation-mode Command downstream of Author Authority is.

## See also

- `docs/reviews/board_runtime_application_api_00_index.md` (read via
  `git show review/board-runtime-api:...` from this Arc's own worktree)
- `docs/reviews/board_runtime_conversation_foundation_09_architectural_blockers.md`
  (same access method — B1's own original finding)
