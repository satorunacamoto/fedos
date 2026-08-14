# FedOS Verified Secure Session UI — Agent R: Test Model Design + Current Coverage Audit

Phase A investigation, read-only. Repo root at time of writing:
`C:\wt\fedos-installed-startup-root-cause` (worktree, branch
`arc/fedos-installed-startup-root-cause`, commit `a9f0a7bb`, clean working
tree — no uncommitted changes at investigation time). No production file was
edited. This file is a draft; not staged, not committed.

---

## Part 1 — Current regression coverage (read from the actual files, not assumed)

### 1.1 Old-key visibility / old-key notice

Real files, read in full:

- `test/fedos_commerce_media_sync_security_recovery_agent_s_task1_identity_transition_silent_autoaccept_visibility.test.ts`
- `packages/fedos-desktop-electron-spike/test/commerce_media_sync_agent_s_task1_identity_autoaccept_visibility.test.ts`

Both belong to "Commerce Product-Media Sync + Truthful Completion mega-arc,
Wave A (Agent S) — Task 1", which added visibility for the fact that
`FEDOS_IDENTITY_TRANSITION_DEFAULT_LOCAL_POLICY.autoAcceptOldKeyContinuity`
(`src/os/messenger/conversations/identity_transition/fedos_identity_transition_evidence_evaluation.ts:79-81`,
still `true`) silently auto-accepts an old-key-only continuity claim.

**Three layers in the root `test/` file, all genuinely behavioral (not
merely structural):**

1. **Pure detector** — `isFedosIdentityTransitionSilentlyAutoAcceptedOldKeyContinuity()`
   (`src/os/messenger/conversations/identity_transition/peer_integration/fedos_identity_transition_silent_acceptance_detection.ts:78-84`).
   Table-tests every `{evidenceOutcome, acceptanceState, superseded}`
   combination: fires only for `locally-acceptable` + `accepted` +
   `!superseded`; explicitly proves it never fires once `superseded`, never
   fires for any of the other 13 known `FedosIdentityTransitionEvidenceOutcome`
   values, and never fires for a still-pending item. This is a real behavioral
   truth-table over the actual exported function, not a source-grep.

2. **Real end-to-end wiring, real crypto** — `publishAndImport()` drives a
   real `RealFedosNostrSigningAuthority`, real `schnorr.sign()`/`schnorr.getPublicKey()`
   (`@noble/curves/secp256k1.js`), a real
   `FedosIdentityTransitionOutboundNotificationCoordinator.publishTransitionNotification()`,
   real NIP-17-shaped control-payload encoding
   (`encodeFedosRatchetPeerCapabilityControlPayload`), and a real
   `FedosIdentityTransitionPeerRuntime.importIdentityTransitionNotification()`
   import on the receiving side. Four scenarios are exercised end to end:
   default policy (auto-accepted, flagged `silentlyAutoAcceptedWithoutAsking: true`
   in `inspectPeerIdentityTransitionStatus()`, `getIdentityTransitionSafeView()`,
   and `listIdentityTransitionInbox()`); conservative policy with an explicit
   `recordIdentityTransitionDecision(..., "accept")` (never flagged); a
   still-pending item with no continuity evidence (never flagged); and a
   `key-compromise-suspected` reason category, where old-key-only evidence is
   capped at `manual-verification-required` and never reaches `accepted` at
   all (the evaluator's own Absolute Prohibition).

3. **Safety Center aggregation** — `fedosSafetyCenterBuildSummary()`
   (`src/os/messenger/desktop/presentation/safety_center/fedos_safety_center_summary.ts`),
   pure fixture-based: silent auto-accept raises the `identity-replacement`
   section to `"warning"` (ranked above a merely-`"pending"` item, which stays
   `"attention"`), folds into `attentionCount`, and `identityReplacementRuntimeConfigured: false`
   stays honestly `"unavailable"` rather than fabricating a warning.

**Electron package test — two tiers, and they are NOT the same kind of proof:**

- `commerce_media_sync_agent_s_task1_identity_autoaccept_visibility.test.ts`,
  "structural guards" describe block (lines 56-77): **structural/source-order
  only** — regexes against the stripped-comments source of
  `fedos_electron_beta_renderer.ts` confirming the inbox list and detail
  screen reference `silentlyAutoAcceptedWithoutAsking` and the expected copy
  strings, and that the Safety Center screen's existing generic
  `overview.summary.sections` / `overview.standingWarnings` loops need no
  renderer change. This proves the field is *wired into source*, not that a
  live DOM ever renders it correctly.
- The same file's `realSuite` block (gated on `CAN_RUN_REAL` — a built
  `dist/fedos_electron_beta_main.cjs`, a real Electron binary, and a compiled
  WASM `pkg/`, none guaranteed present in every environment): **genuinely
  behavioral** — spawns the real Electron app, creates a real fresh profile,
  navigates to `#nav-safety`, and reads the real `#safety-sections` DOM text,
  asserting the STANDING disclosure sentence
  ("accepts an identity replacement signed with a contact's previous key
  without asking you first") is present unconditionally on a fresh profile
  with zero transitions.

**Gap to flag for the Coordinator:** the real-crypto path (layer 2, above)
and the real-DOM path (the `realSuite` block) never meet. No test drives two
real Electron processes through an actual old-key replacement over a live
relay and then reads the resulting DOM marker on the inbox/detail screen —
the DOM-behavioral coverage today only proves the unconditional standing
warning renders, not that a real completed auto-accept renders its own
per-item marker through real DOM. That specific full-loop case is not
covered by any test found.

### 1.2 Signed Deletion UI

Real files, read in full:

- `packages/fedos-desktop-electron-spike/src/fedos_electron_deletion_request_send_ipc.ts` (implementation)
- `packages/fedos-desktop-electron-spike/test/fedos_electron_deletion_request_send_ipc.test.ts` (IPC-boundary contract test)
- `packages/fedos-desktop-electron-spike/test/real_digital_delivery_agent_u_security_ui_closure.test.ts` (renderer/main wiring test, "Real Digital Delivery mega-arc, Agent U")

`fedos_electron_deletion_request_send_ipc.test.ts` is genuinely behavioral
over the real exported pure functions and handler factories (all boundary/
shell dependencies are mocked, but the functions under test —
`resolveFedosDeletionRequestRecipient`, `validateFedosDeletionRequestSendPayload`,
`createFedosDeletionRequestSendHandler`, `createFedosDeletionRequestSentStatusHandler`
— are the real, shipping exports, not stand-ins). It proves: a Group
conversation (>1 other participant) never guesses a recipient (`returns null`);
an unresolved Device ref never falls back to a guess; a malformed payload
short-circuits before `membership.load()`/`createRequest()` are ever called;
the acceptance-gate rejection (no unlocked profile) is checked first; and the
exact params forwarded to `createRequest()` match precisely (including that
`expiresInSeconds` defaults to `FEDOS_DELETION_REQUEST_SEND_MAX_LIFETIME_SECONDS`,
never unbounded).

`real_digital_delivery_agent_u_security_ui_closure.test.ts`, Tier 1
("always-run structural invariants", lines 54-166) is **structural/source-order
only** — every assertion is a regex or `indexOf`-ordering check against the
raw (or comment-stripped) source of `fedos_electron_beta_renderer.ts` /
`fedos_electron_beta_main.cts`. It proves, by source position rather than
execution: `onRequestDeletion()` disables its button before the (awaited)
`confirmInPage()` call and never calls `window.confirm(`; the message list
only attaches the deletion-request control to the local sender's own,
not-yet-deleted messages; the button label is "Request deletion" and the
confirmation copy says "They may decline it." while never claiming
"delete[sd]? ... everywhere/remotely/for everyone"; the renderer only ever
requests scope `"local-history-and-index"` (never a caller-supplied
full-erasure scope); and the IPC channel is registered without
`allowConcurrentSelf`. Tier 2 (gated `CAN_RUN_REAL`) is a real Electron DOM
smoke test, but it exercises **Device Sync inventory rendering only** — it
never drives the actual Signed Deletion send flow (fill/click/confirm/read
status) through real DOM.

**Confirmed via grep (Part 4 detail repeated here for context):**
- No literal "everywhere"/"all devices"/"permanently deleted"/"deleted for
  everyone" overclaim exists in `packages/fedos-desktop-electron-spike/src/*`
  or `src/*`. Every hit is either a negative-claim disclaimer (e.g.
  `fedos_electron_beta_preload.cts:232` "NEVER claims 'deleted everywhere'",
  `fedos_electron_beta_renderer.ts:4221` "This never guarantees removal
  everywhere — see the warnings above.",
  `src/os/messenger/conversations/deletion/fedos_deletion_non_guarantees.ts:60`
  `"no-deleted-everywhere": "No combination of local statuses is ever
  presented as \"deleted everywhere.\""`) or the unrelated Device-list filter
  tab title `all: "All Devices"`
  (`src/os/messenger/desktop/renderer/device_management/fedos_device_management_renderer.ts:133`,
  a filter label, not a security claim).
- `window.confirm(` has **zero live call sites** anywhere in
  `packages/fedos-desktop-electron-spike/src/*` or `src/*` — every repo-wide
  hit is inside a comment, doc, or test describing its historical removal
  (the Commerce Unpublish freeze regression). Not reintroduced.

**Gap to flag for the Coordinator:** no test drives the real DOM through an
actual Signed Deletion request-and-confirm sequence (only source-order proof
exists for that specific flow). This mirrors the same gap noted in 1.1.

### 1.3 Identity Replacement / Ratchet Reset review flow

Real files, read in full:

- `packages/fedos-desktop-electron-spike/src/fedos_electron_identity_transition_ratchet_reset_ipc.ts` (implementation)
- `packages/fedos-desktop-electron-spike/test/fedos_electron_identity_transition_ratchet_reset_ipc.test.ts` (IPC-boundary sequencing test)
- `test/fedos_ratchet_device_lifecycle_session_reset_foundation_unit.test.ts` (domain-level security-boundary test)
- `packages/fedos-desktop-electron-spike/test/real_digital_delivery_agent_u_security_ui_closure.test.ts` (renderer source-order test, same file as 1.2)

**CANCEL is genuinely safe — exact file:line evidence, at three independent
layers:**

1. Renderer source order —
   `real_digital_delivery_agent_u_security_ui_closure.test.ts:58-68`: inside
   `async function runIdentityTransitionRatchetResetFlow(`, the index of
   `if (!confirmed) return;` is strictly greater than the index of
   `await confirmInPage(`, and the index of
   `window.fedosApp.identityTransitionAuthorizeRatchetReset(` is strictly
   greater than the cancel-return — i.e. an un-confirmed dialog returns
   *before* the one call that would authorize a reset, proven by source
   position (`indexOf`), not by executing the function.
2. IPC sequencing gate (behavioral) —
   `fedos_electron_identity_transition_ratchet_reset_ipc.test.ts:167-175`,
   "refuses (never calls authorizeRatchetReset) if assess-continuity was
   never called first": `createFedosIdentityTransitionAuthorizeRatchetResetHandler`
   really executes and really asserts `authorizeRatchetReset` (a `vi.fn()`)
   was never invoked, and lines 177-192 prove a prior `assess` reporting
   `canAuthorize:false` (`acceptanceState: "corroborated"`, not `"accepted"`)
   returns `{outcome: "conflict"}` and still never calls
   `authorizeRatchetReset`.
3. Domain authority (behavioral, real crypto) —
   `fedos_ratchet_device_lifecycle_session_reset_foundation_unit.test.ts:208-341`,
   `FedosDirectRatchetSessionResetAuthority.evaluate()`: rejects an unknown/
   revoked/pending sending Device (`rejected-device-untrusted`), rejects a
   `previousGeneration` mismatch against local ground truth
   (`rejected-generation-mismatch`), verifies a Device signature only when a
   `devicePublicKeyRef` is on file and fails closed on a wrong key
   (`rejected-signature`), and enforces replay protection (`rejected-replayed`
   for a conflicting reuse of an already-recorded nonce).

**CONFIRM only reaches an already-authorized reset path — exact file:line
evidence:**

- `fedos_electron_identity_transition_ratchet_reset_ipc.test.ts:194-215`,
  "the FULL real sequence: assess (canAuthorize:true) then authorize
  actually dispatches authorizeRatchetReset with sessions resolved via the
  injected resolver" — proves `authorize` only fires, and fires with the
  EXACT `resolveAffectedSessions`-derived session list, after a real prior
  `assess` call reported `canAuthorize: true`.
- `real_digital_delivery_agent_u_security_ui_closure.test.ts:70-75`, "the
  Ratchet-reset follow-up NEVER runs on reject/defer, and only after Accept
  itself already reported outcome 'ok'" — regex-matches the exact guard
  `if (decision === "accept" && result.outcome === "ok") { await
  runIdentityTransitionRatchetResetFlow(target);` in
  `decideIdentityTransition()`.
- `fedos_ratchet_device_lifecycle_session_reset_foundation_unit.test.ts:369-414`,
  `FedosDirectRatchetResetCoordinator.applyConsequences()` — a real reset
  only ever transitions the *prior* session's `lifecycleState` to
  `"reset-required"` and persists one durable audit record per nonce
  (idempotent on repeat, never rewritten via `skipRecord: true`).

**Assessment:** this flow has the deepest, most genuinely layered coverage
of the three surfaces audited — renderer source order, IPC sequencing, and
domain security-authority evaluation all independently agree that Cancel
never reaches the mutating call and Confirm only reaches it via a real,
in-process, freshness-tied prior `assess`. No live-DOM click-through test of
this specific two-step confirm exists (same class of gap as 1.1/1.2), but
the three-layer agreement here is stronger than either of the other two
surfaces.

---

## Part 2 — False-green negative matrix (DESIGN ONLY, for the future evaluator)

### Proposed axis model

The existing `fedosSafetyCenterBuildSummary()` doctrine
(`fedos_safety_center_summary.ts:8-10`: "No hidden weighting, no single
numeric score ... each section keeps its OWN independent state") is the
right precedent to extend, not replace. A single "conversation security
state" evaluator should emit **independent per-axis results**, never one
collapsed verdict:

| Axis | Question it answers |
|---|---|
| `IDENTITY_CONTINUITY` | Is the peer's identity for this conversation the one we've always known, and if it changed, was that change reviewed? |
| `ENCRYPTION` | Is content for this conversation+peer-device pair actually flowing through a live, working ratchet session right now? |
| `DEVICE_KNOWLEDGE` | Do we have current, trusted knowledge of the specific peer Device this conversation is bound to? |
| `EVIDENCE_INTEGRITY` | Is the most recent relevant security evidence (transition, reset, corroboration) structurally/cryptographically valid, non-stale, non-replayed? |

Each axis result is `{ state, asOf: number | null, source: "live" | "cached" | "unavailable" }`
— the `asOf`/`source` pair is how restart/offline scenarios (12, 13 below)
are handled, rather than inventing a sixth axis: staleness is a property of
*every* axis's evidence, not a separate fact.

Candidate states (using the mandate's own vocabulary, justified per-axis
below): `GOOD`, `ATTENTION`, `UNKNOWN`, `UNAVAILABLE`, `NOT_APPLICABLE`.
`GOOD` text must never use any Part 4 forbidden word (never "verified",
"secure", "safe" as a standalone claim) — e.g. `IDENTITY_CONTINUITY: GOOD`
should render as "same identity as when first added to this conversation",
not "Identity verified".

### The 15 required scenarios

**1. New/unknown peer**
- (a) Precondition: a `FedosConversationMembership` naming participant `X`
  is created, but `InMemoryFedosIdentityTransitionPeerObservationPersistence`
  has zero records for `X`, and `InMemoryFedosDeviceRegistryPersistence` has
  zero `FedosDeviceBindingV1` records for `X`'s `accountRef`. No prior
  message ever exchanged.
- (b) Expected: `IDENTITY_CONTINUITY: UNKNOWN`, `DEVICE_KNOWLEDGE: UNKNOWN`,
  `ENCRYPTION: UNKNOWN` (ratchet session not yet initialized —
  `FedosDirectRatchetSafeStatus: "initialization-required"`, never mapped to
  `GOOD`), `EVIDENCE_INTEGRITY: UNKNOWN`.
- (c) Forbidden false-green: `IDENTITY_CONTINUITY: GOOD` for a peer that has
  literally never been observed before — this is TOFU-presented-as-verified,
  the single most dangerous false-green in this whole matrix.
- (d) Construction: instantiate `FedosIdentityTransitionPeerRuntime` per the
  Task 1 test's `makeBobRuntime()` pattern with all-empty in-memory
  persistences, and a `FedosConversationMembership` (via
  `validateFedosConversationMembership`) whose `participant` was never
  passed to `importIdentityTransitionNotification()`.

**2. Established continuity**
- (a) Precondition: the same peer `X` has an active
  `FedosDirectRatchetSessionLifecycleState: "active"` session (via
  `FedosDirectRatchetStateRuntime`) with `sendCounter`/`receiveCounter` > 0,
  and zero identity-transition records exist for `X` at all (never changed
  key since first contact).
- (b) Expected: `IDENTITY_CONTINUITY: GOOD`, `ENCRYPTION: GOOD`,
  `DEVICE_KNOWLEDGE: GOOD` (a `FedosDeviceBindingV1` with `trustState:
  "trusted"` on file), `EVIDENCE_INTEGRITY: GOOD` (nothing to flag).
- (c) Forbidden false-green: none of these `GOOD` states may render as
  "Identity verified" / "Fully secure" (Part 4 forbidden strings) — `GOOD`
  here still only means "no contrary evidence has ever been observed", never
  cryptographic proof of identity.
- (d) Construction: reuse `sessionIdFor()`-style construction from
  `fedos_ratchet_device_lifecycle_session_reset_foundation_unit.test.ts:357-367`
  via `toFedosDirectRatchetSessionId()`, with `lifecycleState: "active"` put
  directly into `InMemoryFedosDirectRatchetSessionPersistence`.

**3. Old-key condition**
- (a) Precondition: exactly the Task 1 default-policy scenario —
  `publishAndImport()` with `withContinuityEvidence: true`,
  `reasonCategory: "user-initiated-replacement"`, default
  `autoAcceptOldKeyContinuity: true` — `evidenceOutcome: "locally-acceptable"`,
  `acceptanceState: "accepted"`, `silentlyAutoAcceptedWithoutAsking: true`.
- (b) Expected: `IDENTITY_CONTINUITY: ATTENTION` (not `GOOD`), carrying the
  existing warning code `"identity-replacement-auto-accepted-without-asking"`.
- (c) Forbidden false-green: `IDENTITY_CONTINUITY: GOOD` merely because
  `acceptanceState === "accepted"` — this is precisely the failure mode Task
  1 already fixed once at the Safety Center *aggregate* level
  (`fedos_safety_center_summary.ts`); a new per-conversation evaluator that
  naively reads `acceptanceState` alone, without also consulting
  `silentlyAutoAcceptedWithoutAsking` / `evidenceOutcome`, would silently
  reintroduce it.
- (d) Construction: identical to
  `commerce_media_sync_agent_s_task1_identity_autoaccept_visibility.test.ts:278-297`
  — call `runtime.inspectPeerIdentityTransitionStatus(aliceAccount,
  "alice-old-desktop", transitionId)` and feed its
  `silentlyAutoAcceptedWithoutAsking`/`evidenceOutcome` fields into the axis.

**4. Identity key changed (no continuity evidence at all)**
- (a) Precondition: `publishAndImport()` with `withContinuityEvidence: false`
  and `reasonCategory: "identity-lost"` — `evidenceOutcome` resolves to
  `"continuity-unproven"` (per `evaluateFedosIdentityTransitionEvidence()`'s
  own priority order, `fedos_identity_transition_evidence_evaluation.ts:109-120`).
- (b) Expected: `IDENTITY_CONTINUITY: ATTENTION`.
- (c) Forbidden false-green: `GOOD`, or silently falling back to `UNKNOWN`
  as if this peer had never been seen before — a genuinely new, unproven key
  claim for an already-known peer must never look identical to scenario 1's
  brand-new peer.
- (d) Construction: same helper, `continuityEvidence: null` branch already
  exercised by
  `commerce_media_sync_agent_s_task1_identity_autoaccept_visibility.test.ts:321-329`
  ("NO false warning: a still-pending item").

**5. Unresolved transition**
- (a) Precondition: `evidenceOutcome: "manual-verification-required"` (e.g.
  `reasonCategory: "key-compromise-suspected"` per
  `commerce_media_sync_agent_s_task1_...` lines 331-340), and
  `recordIdentityTransitionDecision()` never called.
- (b) Expected: `IDENTITY_CONTINUITY: ATTENTION`, explicitly the "action
  required" sub-state (distinguishable in the rendered reason string from
  scenario 3/4's "already happened, flag only" ATTENTION).
- (c) Forbidden false-green: `GOOD` (obviously), but also collapsing to
  `UNKNOWN` — `UNKNOWN` would hide that a concrete, actionable pending
  record exists; that is a false-negative-by-omission, the same failure
  class as a false green.
- (d) Construction: `runtime.inspectPeerIdentityTransitionStatus(...)` with
  `acceptanceState !== "accepted"` and `evidenceOutcome ===
  "manual-verification-required"`.

**6. Resolved transition**
- (a) Precondition: same as 5, then
  `runtime.recordIdentityTransitionDecision(aliceAccount,
  "alice-old-desktop", transitionId, "accept")` is called explicitly.
- (b) Expected: `IDENTITY_CONTINUITY: GOOD`, with
  `silentlyAutoAcceptedWithoutAsking: false` verified per
  `commerce_media_sync_agent_s_task1_...:311-314`.
- (c) Forbidden false-green: rendering literal "Identity verified" text for
  this `GOOD` state (Part 4 forbidden string) — an explicit user Accept is
  still not cryptographic proof, only an informed decision.
- (d) Construction: identical to
  `commerce_media_sync_agent_s_task1_...:299-319`, the conservative-policy
  "NO false warning" test.

**7. Encryption unavailable**
- (a) Precondition: `FedosConversationProductionCryptoCapabilityOutcome`
  (`src/os/messenger/conversations/encryption/production/fedos_conversation_production_crypto_capability_result.ts`)
  reports unavailable/absent — the real capability-result type, fed from
  `fedos_conversation_production_crypto_authority_factory.ts`, never
  inferred from "no error was thrown".
- (b) Expected: `ENCRYPTION: UNAVAILABLE`.
- (c) Forbidden false-green: `GOOD`/`ACTIVE`-shaped text while messages are
  actually flowing through a no-op/fallback crypto authority — the evaluator
  must read the capability-result value itself, never assume availability
  from successful send-call completion alone.
- (d) Construction: feed `productionCrypto: null` (mirrors
  `FedosSafetyCenterRawFacts.productionCrypto: FedosConversationProductionCryptoCapabilityOutcome
  | null`, `fedos_safety_center_summary.ts:21`) into the evaluator.

**8. Encryption active**
- (a) Precondition: a real `FedosDirectRatchetStateRuntime` session with
  `lifecycleState: "active"` AND `productionCrypto: "available"` AND
  `counters.sendCounter > 0` / `receiveCounter > 0` (actual observed
  traffic, not merely an initialized-but-unused session).
- (b) Expected: `ENCRYPTION: GOOD`.
- (c) Forbidden false-green: `GOOD` for a session that exists with
  `lifecycleState: "active"` but `sendCounter === 0 && receiveCounter === 0`
  (ratchet initialized, never actually exercised) — that is exactly the
  shape of claim that produces the forbidden "Forward secrecy active" text
  before any ratchet step has actually occurred; such a session should read
  `ATTENTION`/a distinct "ready, not yet used" state, not `GOOD`.
- (d) Construction: `stateRuntime.getSessionMetadata(sessionId)` per
  `fedos_ratchet_device_lifecycle_session_reset_foundation_unit.test.ts`'s
  own `makeCoordinator()` fixture, with `counters` populated non-zero.

**9. Ratchet unavailable**
- (a) Precondition: `this.#sealingAuthority === null` inside
  `FedosDirectRatchetStateRuntime` (per that file's own
  `"sealing-authority-unavailable"` branch, line 163), or
  `FedosDirectRatchetSafeStatus: "unavailable"`/`"unsupported"`.
- (b) Expected: `ENCRYPTION: UNAVAILABLE`.
- (c) Forbidden false-green: mapping this to `NOT_APPLICABLE` instead of
  `UNAVAILABLE` — `NOT_APPLICABLE` would wrongly imply ratchet was never
  expected for this conversation type, when in fact it IS expected here but
  is currently broken; conflating the two hides a real outage as if it were
  by design.
- (d) Construction: construct `FedosDirectRatchetStateRuntime` with
  `sealingAuthority: null` exactly as
  `fedos_ratchet_device_lifecycle_session_reset_foundation_unit.test.ts`'s
  `makeCoordinator()` already does, and call `sealingReadiness()`
  (the `state: "sealing-authority-unavailable"` branch).

**10. Missing peer device knowledge**
- (a) Precondition: conversation membership includes peer `Y`, but
  `InMemoryFedosDeviceRegistryPersistence`/the real Device Registry has zero
  `FedosDeviceBindingV1` records for `Y.accountRef` at all — never
  registered, not merely revoked.
- (b) Expected: `DEVICE_KNOWLEDGE: UNKNOWN`.
- (c) Forbidden false-green: `GOOD` (obviously) but also `ATTENTION` — the
  matrix must keep `UNKNOWN` (nothing known) distinct from `ATTENTION`
  (something known, but degraded/stale); collapsing them hides which case
  actually applies.
- (d) Construction: query the Device Registry for `Y.accountRef` and assert
  the lookup returns nothing, mirroring
  `fedos_electron_deletion_request_send_ipc.test.ts:58-61`'s own "returns
  null when no observed Device ref matches ... never falls back to a guess".

**11. Stale device knowledge**
- (a) Precondition: a `FedosDeviceBindingV1` exists with `trustState:
  "trusted"` but the bound Ratchet session's `lastActivityAt` is far in the
  past relative to `now()`, or the locally-known generation is behind a
  generation the peer has since moved past (an old, cached binding that
  hasn't been refreshed).
- (b) Expected: `DEVICE_KNOWLEDGE: ATTENTION`, carrying an explicit
  "last known as of `<timestamp>`" qualifier via the axis's own
  `asOf`/`source: "cached"` fields.
- (c) Forbidden false-green: presenting this identically to fresh, live
  `GOOD` knowledge — a stale binding must never render the same text as a
  binding just confirmed moments ago.
- (d) Construction: `FedosDirectRatchetStateRuntime.getSessionMetadata()`
  with a `lastActivityAt` far before the evaluator's own `now()` clock
  parameter (the coordinator's fixtures already inject `now: () => 1000`
  as a controllable clock — reuse that pattern).

**12. Restart**
- (a) Precondition: mirror
  `fedos_ratchet_device_lifecycle_session_reset_foundation_unit.test.ts:517-542`
  ("a record written before 'restart' is still readable by a brand-new
  instance over the same file") — construct
  `AppendOnlyFedosDirectRatchetSessionResetRecordPersistence`/
  `AppendOnlyFedosDeviceRegistryPersistence` over a file, write facts, then
  construct a SECOND instance over the same file (simulating cold start) and
  query the evaluator immediately, before any relay subscription is
  (re)established.
- (b) Expected: every axis reads its persisted value with
  `source: "cached"`, never `source: "live"`, until a live subscription
  round-trip has actually occurred post-restart.
- (c) Forbidden false-green: rendering an identical, unqualified `GOOD` as a
  freshly-live-verified state — a peer could have revoked a Device or sent a
  compromise-reason replacement while the app was closed, and that event
  simply hasn't been fetched yet; showing plain `GOOD` here overclaims
  currentness.
- (d) Construction: reuse the exact append-only restart pattern above;
  assert the evaluator's `source` field, not just its `state`.

**13. Offline**
- (a) Precondition: no active `websocket_relay`/`FedosSubscription` — the
  Relay boundary reports disconnected (mirrors
  `src/os/messenger/desktop/websocket_relay.ts` / `fedos_subscription.ts`
  disconnected state).
- (b) Expected: same cached/last-known qualifier as scenario 12, plus an
  explicit "cannot currently receive new security events" fact distinct from
  "restart" (offline can persist indefinitely with the app otherwise warm).
- (c) Forbidden false-green: `IDENTITY_CONTINUITY: GOOD` while offline, when
  a legitimate identity-replacement notification the peer already published
  may be sitting unread on the Relay — never claim current-ness while
  genuinely disconnected.
- (d) Construction: feed the evaluator a Relay/Subscription status object
  reporting disconnected (the real desktop Relay/Subscription types already
  distinguish this from "never configured"); assert `source:
  "cached"`/"unavailable-for-new-events" rather than `"live"`.

**14. Replayed old security event**
- (a) Precondition: exactly
  `fedos_ratchet_device_lifecycle_session_reset_foundation_unit.test.ts:305-340`
  — a reset record already persisted for nonce `"a".repeat(32)`, then a
  CONFLICTING re-use of the same nonce with different generation/reason is
  submitted; `FedosDirectRatchetSessionResetAuthority.evaluate()` returns
  `"rejected-replayed"`.
- (b) Expected: `EVIDENCE_INTEGRITY: ATTENTION` (the rejection itself is
  surfaced, not swallowed); every OTHER axis (`IDENTITY_CONTINUITY`,
  `ENCRYPTION`, `DEVICE_KNOWLEDGE`) stays at whatever value it held
  immediately BEFORE the replay attempt — a rejected event must have zero
  side effect on any other axis.
- (c) Forbidden false-green: (i) the replayed event silently succeeding and
  flipping `IDENTITY_CONTINUITY`/`ENCRYPTION` to a new state, or (ii) the
  rejection being swallowed so `EVIDENCE_INTEGRITY` stays `GOOD`/`UNKNOWN`
  as if the replay attempt never happened — a rejected replay is itself a
  security-relevant fact that must remain visible/attributable.
- (d) Construction: reuse the exact fixture at
  `fedos_ratchet_device_lifecycle_session_reset_foundation_unit.test.ts:305-340`
  verbatim; assert the evaluator's `EVIDENCE_INTEGRITY` axis reflects
  `"rejected-replayed"` and that a snapshot of the other three axes taken
  before vs. after the replay attempt is byte-for-byte identical.

**15. Malformed/unverifiable security evidence**
- (a) Precondition: a payload failing `isWellFormedFedosDirectRatchetNip17Payload()`
  (e.g. `resetReason: "made-up-reason"`, mismatched
  `previousGeneration`/`resetReason` per
  `fedos_ratchet_device_lifecycle_session_reset_foundation_unit.test.ts:124-157`),
  or `evaluateFedosIdentityTransitionEvidence()`'s `structurallyValid: false`
  path (→ `"invalid"`, `fedos_identity_transition_evidence_evaluation.ts:112`).
- (b) Expected: `EVIDENCE_INTEGRITY: ATTENTION`, distinct from `UNKNOWN`.
- (c) Forbidden false-green: (i) `GOOD`/silently-ignored (the malformed
  input simply vanishes with no axis change at all — an omission is itself
  a false green here), and (ii) collapsing this into `UNKNOWN` as if no
  evidence had ever been submitted — that erases an actual attack/corruption
  signal; "nothing ever arrived" and "something arrived and failed
  validation" must never be indistinguishable to the user.
- (d) Construction: feed
  `isWellFormedFedosDirectRatchetNip17Payload(basePayload({ resetReason:
  "made-up-reason" as never }))` (returns `false`) or an
  `evaluateFedosIdentityTransitionEvidence()` input with
  `structurallyValid: false` directly into the evaluator; assert
  `EVIDENCE_INTEGRITY: ATTENTION` with a reason string naming "could not be
  validated", not a generic "no data".

---

## Part 3 — Wrong-binding tests (DESIGN ONLY)

### Exact current domain identifiers that must serve as binding keys

- `FedosConversationId` — opaque, deterministic,
  `toFedosConversationId(boardId, threadId)`
  (`src/os/messenger/conversations/fedos_conversation_id.ts:43-45`).
- `FedosConversationParticipantReference { authority, publicIdentifier,
  identityId }` — the peer/account identity binding key; the type's own
  header is explicit that "two references with the same `publicIdentifier`
  but different `authority` are NEVER treated as the same participant"
  (`fedos_conversation_participant_reference.ts:30-32`), so `authority` +
  `publicIdentifier` together, never `publicIdentifier` alone.
- `FedosDeviceBindingAccountRef { authority, publicIdentifier, identityId }`
  — the identical shape used on the Device-Trust side
  (`fedos_device_binding.ts:47-51`).
- Device ref (`deviceId: string`, e.g. `"bob-desktop"`,
  `"alice-old-desktop"`) — paired with the account ref, never used alone;
  `inspectPeerIdentityTransitionStatus(accountRef, deviceRef, transitionId)`
  takes all three.
- `FedosDirectRatchetSessionIdComponents { localAccountRef, localDeviceRef,
  remoteAccountRef, remoteDeviceRef, conversationId, suite, generation }` —
  the canonical 7-component ratchet-session binding key
  (`fedos_direct_ratchet_session_id.ts:61-70`); `toFedosDirectRatchetSessionId()`
  is a pure, deterministic function where changing ANY one component
  produces a completely different id string (delimiter-safe by
  construction, `isSafeComponent()`), never a collision.
- `transitionId` (`generateFedosIdentityTransitionId()`) + `revision` — the
  identity-transition binding key,
  chained via `previousTransitionId` for supersession.
- `FedosConversationMembership { id, conversationId, participant, role,
  state, joinedAt, endedAt }` — the authoritative "is this identity actually
  part of this conversation" fact
  (`fedos_conversation_membership.ts:39-49`).

### Designed tests

**T1 — Wrong conversation, same peer.** Construct `conv-A` and `conv-B` via
`toFedosConversationId()` with different `threadId`s, both containing the
SAME `FedosConversationParticipantReference`. Record an old-key
`silentlyAutoAcceptedWithoutAsking` condition tied only to a transition
notification whose `FedosRatchetPeerCapabilityControlPayload` was delivered
`conversationId: conv-B` (per the Task 1 test's own `publishAndImport()`,
which takes a `conversationId` parameter). Assert the evaluator called for
`conv-A` (same peer) reflects conv-A's OWN independent state, never
inherits conv-B's `ATTENTION`. **Real gap this test would expose today:**
`FedosIdentityTransitionPeerRuntime.inspectPeerIdentityTransitionStatus(accountRef,
deviceRef, transitionId)` takes NO `conversationId` parameter at all —
identity-transition peer-observation state is keyed by
`(accountRef, deviceRef, transitionId)` only, not per-conversation. A future
per-conversation evaluator must NOT assume this state is naturally
conversation-scoped; it needs the same explicit derivation
`resolveFedosIdentityTransitionAffectedPairs()`
(`fedos_electron_identity_transition_ratchet_reset_ipc.ts`, tested at
`fedos_electron_identity_transition_ratchet_reset_ipc.test.ts:32-53`) already
performs at the IPC layer — deriving which conversations are affected from
membership, never assuming a transition record itself carries the binding.

**T2 — Wrong peer, same conversation.** Build a Group `FedosConversationMembership`
list with participant `X` (old-key `ATTENTION`) and participant `Y` (`GOOD`)
both members of the SAME `FedosConversationId`. Assert the evaluator queried
for `(conv, Y)` never reflects `X`'s condition — using
`authority`+`publicIdentifier` (not identifier alone) as the lookup key,
per the type's own cross-authority-non-equivalence rule.

**T3 — Wrong account (local multi-account).** Construct two local runtimes
exactly as `makeBobRuntime()` does, but with distinct `accountIndex`
(`0` and `1`) / `localAccountRef`, each with its OWN
`InMemoryFedosIdentityTransitionPeerObservationPersistence` instance
(mirrors the real per-account persistence discipline). Record an old-key
auto-accept only on account-0's runtime for remote peer `Z`. Assert
account-1's runtime, queried for the "same" remote peer `Z`, returns
independently-derived state — not by trusting construction-time isolation
alone, but by asserting the evaluator's own lookup explicitly threads
`accountIndex`/`localAccountRef` as part of its key, so a future shared-cache
implementation cannot accidentally collapse the two.

**T4 — Wrong device (multi-device peer).** Remote peer `Alice` has TWO
`FedosDeviceBindingV1` records sharing one `accountRef` but different
`deviceId`s: `"alice-old-desktop"` (the actual source of a real transition
notification, per the Task 1 fixtures) and `"alice-phone"` (never sent
anything). Assert evaluating security state for `(Alice, "alice-phone")`
never surfaces the `ATTENTION` recorded only against
`(Alice, "alice-old-desktop")` — the binding key is always the
`(accountRef, deviceRef)` pair, exactly as
`inspectPeerIdentityTransitionStatus()` requires both, never `accountRef`
alone.

**T5 — Wrong membership (removed / never-a-member).** Build a
`FedosConversationMembership` list for `conv-A` that does NOT include
participant `Z` (either never added, or `state` reflects "left"/"revoked"
per `FedosConversationMembershipState`). Feed the evaluator identity-
transition/ratchet facts that DO exist for `Z` from some other conversation.
Assert the evaluator for `conv-A` never reports on `Z` at all — this
exercises the exact guard already proven at
`fedos_electron_deletion_request_send_ipc.test.ts:42-52` ("returns null for
a Group conversation ... never guesses ambiguously") and `:54-56` ("returns
null when the viewer is the only participant on file (malformed/empty
membership)") — the future evaluator must resolve membership FIRST, the
same way the deletion-request IPC layer already does, never derive
"who is this conversation about" from wherever transition/ratchet records
happen to exist.

**T6 — Wrong key-history (rollback/superseded confusion).** Construct an
identity-transition chain: `T1` (old key A → new key B), later
`T2` (`previousTransitionId: T1.transitionId`, superseding it —
`historyOutcome: "superseded"` per
`fedos_identity_transition_evidence_evaluation.ts:117`). Assert the
evaluator's `IDENTITY_CONTINUITY` reflects the state of the CURRENT
(`T2`-derived) identity only, never a stale `ATTENTION` re-surfacing `T1`
(mirrors `isFedosIdentityTransitionSilentlyAutoAcceptedOldKeyContinuity()`'s
own proven "never fires once superseded" behavior,
`commerce_media_sync_agent_s_task1_...:59-67`) — AND that the fact a
supersession occurred is not silently dropped either. Binding key:
`transitionId` + `revision`, resolved via the `previousTransitionId` chain
to the LATEST revision for a given `(oldAccountIdentity, newAccountIdentity)`
pair, never an arbitrary or first-found `transitionId`.

---

## Part 4 — Forbidden-claim string audit (current state)

Grepped (case-sensitive and case-insensitive passes) across
`packages/fedos-desktop-electron-spike/src/*` (renderer + main + preload +
HTML) and all of `src/*`:

- `Fully secure` — no matches.
- `End-to-end verified` — no matches.
- `Identity verified` — no matches. (One adjacent, deliberately-negative hit:
  `src/os/trust/policy/fedos_trust_official_issuer_profile.ts:12`, a comment
  stating what a credential does **NOT** mean: "It does NOT mean any of:
  legal identity verified, real-world identity ...". This is a disclaimer
  inside a doc-comment, never rendered UI copy, and it is phrased as a
  negation — not a hit against the forbidden-claim list.)
- `All devices verified` — no matches. (`"All Devices"` exists only as a
  Device-list filter-tab title,
  `src/os/messenger/desktop/renderer/device_management/fedos_device_management_renderer.ts:133`,
  not a security-state claim.)
- `Forward secrecy active` — no matches.
- `No one can intercept` — no matches.
- `Anonymous` (as literal UI copy / security label) — no matches in
  renderer/main/HTML. All repo hits are internal class/type names
  (`AnonymousLocalFedosConversationCreatorIdentityAuthority`,
  `AnonymousLocalPublicAuthorAuthority`) — implementation identifiers, never
  user-facing strings.
- `Safe` (as a standalone security claim) — no matches for `>Safe<`/`"Safe"`/
  `'Safe'` in renderer/main/HTML. (The word appears only inside longer,
  non-claim identifiers like `fedos_identity_transition_safe_view.ts`,
  `getIdentityTransitionSafeView`, `FedosDirectRatchetSafeStatus` — internal
  naming, not rendered text asserting safety.)

**Verdict: zero forbidden-claim strings found anywhere in current
renderer/main/preload/HTML source.** The codebase's own existing discipline
(explicit "never claims X" comments throughout the deletion and identity-
transition domains, cited above) is already consistent with this mandate;
Part 4 found no regression to fix, only confirmation to preserve as the new
evaluator is built.

---

## Summary for the Coordinator

1. All three named regression surfaces (old-key visibility, Signed Deletion
   UI, Identity Replacement/Ratchet Reset review) have real, non-trivial
   CURRENT test coverage — not merely structural in every layer, but each
   surface's live-DOM coverage is narrower than its logic-level coverage
   (see the "Gap to flag" notes in 1.1/1.2; 1.3 is the strongest of the
   three, with three independently-agreeing layers).
2. No forbidden-claim string exists today (Part 4) — a clean baseline to
   protect going forward, not a fix-first blocker.
3. The false-green matrix (Part 2) and wrong-binding tests (Part 3) are
   deliberately grounded in real, already-existing types and functions
   (`FedosIdentityTransitionPeerRuntime`, `evaluateFedosIdentityTransitionEvidence()`,
   `FedosDirectRatchetSessionResetAuthority`, `toFedosDirectRatchetSessionId()`,
   `FedosConversationParticipantReference`, `FedosConversationMembership`) —
   the future evaluator can be built directly against these without
   inventing new domain primitives, except the four-axis result type itself
   (`IDENTITY_CONTINUITY` / `ENCRYPTION` / `DEVICE_KNOWLEDGE` /
   `EVIDENCE_INTEGRITY`, each with `{state, asOf, source}`), which does not
   exist anywhere in the codebase yet.
4. T1 in Part 3 surfaces a genuine, pre-existing architectural fact the
   Coordinator should design around explicitly, not discover late:
   identity-transition peer-observation state is NOT keyed by
   `conversationId` today — only `(accountRef, deviceRef, transitionId)`.
   Conversation-scoping must be derived via membership resolution (the same
   pattern `resolveFedosIdentityTransitionAffectedPairs()` /
   `resolveFedosDeletionRequestRecipient()` already use), never assumed to
   be intrinsic to the transition record itself.
