# Secure Runtime Alpha 6121–6200 — Execution Specification

**FedOS Identity Replacement User Verification and Conversation
Continuity UI Arc.**

See [reconciliation report](secure_runtime_alpha_6121_6200_reconciliation_report.md)
for the merge/base decision. See
[user-verification and warning UX document](secure_runtime_alpha_6121_6200_user_verification_and_warning_ux.md)
and
[conversation-continuity truth document](secure_runtime_alpha_6121_6200_conversation_continuity_truth.md)
for the field/decision reference.

## Base

This Arc's own branch merges TWO diverged lineages: `a5f9cca5`
(Identity Transition) and `b72ca7b6` (Desktop/UI, itself building on
`8981f81`/`8548845`). Merge commit `02845ed9`. Only `README.md`
conflicted (both branches independently stacked their own newest-first
status blurb); every source/doc/test file merged cleanly.

## Phases implemented

- **B — Safe view model**: `FedosIdentityTransitionSafeViewV1`
  (`fedos_identity_transition_safe_view.ts`). Combines a Peer
  Observation, its lineage-derived supersession fact, the computed
  acceptance state, a per-Device evidence list, and an optional manual-
  verification fact into one closed DTO. `evidenceOutcome` and
  `acceptanceState` are always two distinct fields — never collapsed to
  one boolean, never displayed as equivalent.
- **C — User verification lifecycle**: reuses the Foundation's own
  `FedosIdentityTransitionAcceptanceState` (11 values, already includes
  `pending`-flavored/`manual-review-required`/`accepted`/`rejected`/
  `conflicting`/`rollback-detected`/`superseded` — no second, competing
  vocabulary invented) plus `FedosIdentityTransitionEvidenceOutcome` (14
  values, covers `evidence-incomplete`-flavored/`old-key-only`-flavored/
  `device-corroborated`/`manual-verification-required`/`unsupported`/
  `unavailable`). Required actions (`inspect evidence`, `accept`,
  `reject`, `defer`, `record manual verification`, `assess Ratchet
  impact`, `authorize Ratchet reset`) are each a SEPARATE Shell/Controller
  method — opening/inspecting never mutates anything (verified directly
  in the real vertical slice, step 6).
- **D — Manual verification boundary**: `fedos_identity_transition_manual_verification.ts`.
  Three closed methods (`safety-number-comparison`,
  `out-of-band-confirmation`, `in-person-confirmation`), a coarse closed
  note-code set, durable append-only facts keyed by `(localDeviceRef,
  verifierAccountRef, transitionId, revision)` — a re-verification is a
  NEW, higher-revision fact, never an overwrite. Unknown methods/note
  codes fail closed at both the domain (`recordManualVerification()`
  returns `"unavailable"`) and Host Command (structural validator
  rejects) layers.
- **E — Peer Device evidence**: `fedos_identity_transition_device_evidence_display.ts`.
  A 10-value closed status vocabulary; only a HONEST SUBSET
  (`observed`/`corroborating`/`not-corroborating`/`conflicting`/`stale`/
  `unavailable`) is ever actually produced today, documented explicitly
  — `signature-valid`/`authorized-at-proof-time`/`revoked`/`unknown` are
  reserved for a future Arc that threads raw per-Device signature/trust
  detail through to this display layer (today's durable Peer Observation
  intentionally does not carry it). One row per REPORTING PEER DEVICE,
  never merged into an account-wide verdict.
- **F/G — Conversation continuity**: the SMALLEST additive model —
  `FedosIdentityTransitionConversationContinuityRecordV1` (new,
  additive; the existing Peer Observation record has no
  `conversationId`/verification-method/new-session-required fields and
  was judged unsafe to overload). Keyed by `(localDeviceRef,
  conversationId)`, one row per accepted transition-conversation link;
  a strictly-higher-revision link for the SAME conversation is a
  legitimate append-only supersession (never an overwrite); a
  same-or-lower revision is `"rollback-detected"`. The EXISTING
  Conversation ID is never rewritten — this Arc presents the new
  identity as a locally-accepted continuity LINK on the SAME
  conversation, never a silent ID reassignment (see the truth document
  for the full reasoning).
- **H — Ratchet reset user flow**: two explicit, separate Shell/Controller
  steps — `assessContinuity()` (read-only, Phase I) then
  `authorizeRatchetReset()` (Phase J, mutates). The pre-authorization
  disclosure content (`fedosIdentityTransitionBuildRatchetResetConfirmationContent()`)
  always shows the same four warnings regardless of `canAuthorize`. The
  reset call itself is a THIN adapter over the ALREADY-PUBLIC
  `FedosDirectRatchetConversationRuntime.initializeDirectRatchetSession()`
  — no new Ratchet-facing method, no root/chain/session secret ever
  exposed.
- **I — Pending Outbox / late message view**: NOT implemented as a
  separate feature this Arc — no existing Runtime surface exposes
  per-message Outbox/Relay-ACK/late-message status scoped to an identity
  transition (Phase A found none), and inventing one would be a Ratchet/
  Transport-domain change this Arc's own prohibitions forbid. Honestly
  named as future work rather than fabricated.
- **J — Identity Transition Inbox**: `FedosIdentityTransitionPeerRuntime.listIdentityTransitionInbox()`
  (bounded ≤200, deterministic `revision`-then-`transitionId` order, one
  row per logical transitionId even when multiple peer Devices reported
  it) + `FedosIdentityTransitionController.refreshInbox()`/`inboxState`.
  Never imports as a chat message; never Search-indexed (this domain
  imports nothing from `search/`, proven by the structural guard test).
- **K — Shell commands**: 10 new `FedosDesktopApplicationShell` methods
  (`identityTransitionList`/`Open`/`InspectEvidence`/
  `RecordManualVerification`/`Accept`/`Reject`/`Defer`/
  `AssessContinuity`/`AuthorizeRatchetReset`/`Status`), each delegating
  ENTIRELY to `FedosConversationRuntime.identityTransition()` (new
  nullable accessor, mirrors `deletionRequest()` byte-for-byte) plus, for
  the two Ratchet-facing methods, `directRatchet()`. 10 matching
  `FedosDesktopHostCommand` kinds with structural-only validators.
- **L — Presentation**: `FedosIdentityTransitionController` (one file,
  mirrors `FedosDeletionRequestController`'s composition exactly) with
  `inboxState`/`detailState`/`manualVerificationState`/`continuityState`/
  `ratchetImpactState`/`ratchetResetConfirmationState`, each a
  `FedosDesktopViewModelState<T>`. `"Evidence Review"`/`"Peer Device
  Evidence"` are the SAME `detailState` as `"Identity Transition
  Detail"` — documented explicitly as a deliberate non-duplication, not
  an omission. No cryptography, persistence, private transport, or
  identity mutation anywhere in this file — every action delegates to
  the Shell.
- **M — Renderers**: `FedosIdentityTransitionRenderer`, one render
  method per Controller state, each via the shared `fedosRenderModel()`
  projection. Reads only Controller getters; calls no action method.
- **N — Navigation**: `FedosIdentityTransitionNavigationState`, its own
  sibling class (no shared registry exists in this codebase to extend —
  confirmed by inspecting `device_management`/`deletion_request`'s own
  precedent). 6 screens (`inbox`/`detail`/`evidence`/
  `manual-verification`/`continuity`/`ratchet-reset`), one-level
  `goBack()`, canonical `transitionId`-only selection, stale-selection
  clearing on demand.
- **O — Notifications**: NOT wired this Arc — `b72ca7b6`'s own README
  explicitly disclosed "Notification Coordinator wiring were not
  reached (narrow, non-redesign follow-on)" for the PRECEDENT this Arc
  was asked to mirror; this Arc makes the identical scope choice rather
  than exceeding the pattern it copies.
- **P — Host Bridge/Electron**: 10 new dispatch cases in
  `FedosDesktopHostBridge`, reusing the SAME two dispatch idioms
  (`boundary.identityTransitions.<method>()` for list/open/evidence/
  manual-verification, `boundary.shell.<method>()` for the rest) the
  `deletion-request-*` cases already established. No canonical
  Electron Main/preload exists in `src/` to extend — same disclosed gap
  as `b72ca7b6`.
- **Q — Safe warnings**: `fedos_identity_transition_warning_codes.ts`,
  10 closed codes, one `fedosIdentityTransitionWarningText()` lookup —
  every screen resolves warning text through this ONE function, never
  an inline string.
- **R — Real vertical slice**: `test/secure_runtime_alpha_6121_6200_real_vertical_slice.test.ts`.
  A genuinely REAL `FedosConversationRuntime` (built via
  `assembleFedosConversationRuntimeDependencies()`, the SAME production
  wiring helper the real Local Desktop Runtime itself calls, spread with
  this Arc's own `identityTransition` config), driven through the REAL
  `FedosDesktopApplicationShell.fromRunningRuntime()` /
  `FedosDesktopConversationUiPresentationBoundary.fromShell()` /
  Controller / Renderer stack, with 100% real BIP-340 Schnorr crypto.
  Proves: notification receipt -> inbox -> open (no mutation) -> manual
  verification -> accept -> continuity link -> honest reset-refusal
  (`directRatchet` not configured) -> competing-transition conflict ->
  restart -> exact reconstruction (inbox AND the accepted decision,
  which needed the append-only, not in-memory, local-decision backend —
  see the completion declaration's own "real bug found" note) -> no
  secret in render output or durable log.

## Structural exclusions honored

No in-place identity rotation, no Master Seed replacement, no profile
auto-mutation, no Device Registry auto-rebind, no Membership/Archive/
Search mutation, no old Ratchet key rebinding, no Group/Sender-Key/MLS/
PQ change, no deletion-request protocol change, no Privacy/Safety
Center, no new NIP, no public transition event, no Electron security
weakening, no `p2p/`/`.tmp_gen` change — all proven by the structural
guard test (`secure_runtime_alpha_6121_6200_host_command_and_structural_guards.test.ts`).

## Verification performed

`npm run typecheck:core` clean for every file this Arc touched (2
pre-existing, unrelated baseline errors remain). 5 new test files, 39
new tests, all passing (no WASM gate needed anywhere in this Arc's own
tests — see the completion declaration for the one disclosed boundary
this still leaves). Re-ran the Foundation's own, the Peer/Reset Arc's
own, the Deletion-Request-UI Arc's own, and the pre-existing Desktop
Shell test suites — all pass unchanged in the merged worktree.

## Next Arc

**FedOS Desktop Beta Privacy Controls and Safety Center Arc.**
