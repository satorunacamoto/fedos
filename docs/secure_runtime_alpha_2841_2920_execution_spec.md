# Secure Runtime Alpha 2841–2920 — Desktop Local Application Shell and Conversation Management Boundary Arc

Execution spec. Architecture frozen: no redesign of any accepted layer, no
renamed public interface, no new dependency, no Rust/WASM/Cargo change, no
`p2p/`/`.tmp_gen` touch. Base revision: `master` @ `3eb9ead` (Secure Runtime
Alpha 2581–2620), built in a dedicated worktree at `C:\wt\desktop-application-shell`
on branch `arc/desktop-application-shell`.

## Phase A — Inventory

### A1. Desktop Runtime lifecycle accessors

`src/desktop/runtime/fedos_desktop_runtime.ts` — `startFedosDesktopRuntime(config)`
→ `Promise<FedosRunningDesktopRuntime>`. The handle exposes exactly three
accessors, each throwing `"inaccessible after stop()"` post-stop:

- `host: FedosDesktopHost` (public field)
- `boardRuntime(): FedosBoardRuntime`
- `conversationRuntime(): FedosConversationRuntime`
- `privateTransport(): FedosPrivateTransport` — additionally throws `"not enabled"`
  when `config.privateTransportEnabled` was never set
- `stop(): Promise<void>` — not idempotent, throws on a second call

No accessor returns a persistence port, a raw Authority, or a crypto handle —
confirmed by reading the full file; every guardrail comment in the file states
this explicitly and the implementation matches.

### A2. Conversation Runtime commands (`FedosConversationRuntime`)

`src/conversation/runtime/fedos_conversation_runtime.ts`:

- `createPrivateGroupDraft(command): FedosPrivateConversationConstructionResult`
- `createDirectDraft(command): FedosPrivateConversationConstructionResult`
- `findConversation(id): FedosConversationDraftView | null`
- `readinessForConversation(id): FedosConversationReadiness | null`
- `listMemberships(id): readonly FedosConversationMembership[]`
- `issuedCapabilityDescriptors(id, issuer): readonly FedosConversationCapabilityDescriptor[]`
- `constructionStatus(id): FedosConversationConstructionCoordinationPhase | null`

**No enumeration primitive exists** — there is no `listConversations()`/`listDrafts()`
anywhere in `src/conversation`. A caller can only read a conversation it already
knows the id of.

**No send/list-message/activate/reactivate method exists anywhere in
`src/conversation`.** Confirmed by exhaustive grep (`sendMessage|listMessages|
replyTo|activateConversation|reactivat`) — zero real implementation hits, only
doc-comment prose. `"active"` is a named-but-never-constructed
`FedosConversationLifecycleState` value; `FEDOS_CONVERSATION_CONSTRUCTIBLE_LIFECYCLE_STATE`
is hardcoded to `"draft"`. The construction domain's own file headers state
plainly: *"a future reviewed activation operation owns that transition"* — not
yet written, on this base or any other reachable from it.

### A3. Direct/Group distinction, invitation, readiness

- Mode is a declared field (`FedosPrivateConversationMode = "private-group" | "direct"`),
  never inferred from member count — set once at `createDirectDraft`/`createPrivateGroupDraft`.
- Invitation **issue** happens only as a side effect of `createDirectDraft`/
  `createPrivateGroupDraft`'s optional `initialCapability` param; the issued
  descriptor (never the bearer secret, except once on the construction result
  itself) is readable back via `issuedCapabilityDescriptors(id, issuer)`.
- Invitation **redeem**: `FedosConversationCapabilityRedemptionAuthority` exists
  as a type (`src/conversation/capability/fedos_conversation_capability_redemption_authority.ts`)
  but `assembleFedosConversationRuntimeDependencies()` never constructs or wires
  one into the running Conversation Runtime — no redemption authority is
  reachable from `FedosRunningDesktopRuntime` at all.
- Readiness: `readinessForConversation(id)` returns a live `{ axes, overall }`
  reading; `overall ∈ "draft-ready" | "activation-ready" | "blocked"`. This is
  the only "activation status" primitive that exists — read-only, never a
  mutation, and `activation-ready` is unreachable by default because
  `encryptionReadinessAuthority` defaults to `UnavailableFedosConversationEncryptionReadinessAuthority`.

### A4. Search Runtime (`src/conversation/search/`, frozen Alpha 2501–2620)

`FedosConversationSearchIndex` is a real, retention-hardened facade, but it is
**not owned by, or reachable through, `FedosRunningDesktopRuntime`** — there is
no `runtime.searchIndex()` accessor. Its constructor dependencies
(`Pick<FedosConversationRuntimeDependencies, "draftPersistence" | "membershipAuthority">`
plus a retention authority) are private fields (`#deps`) inside
`FedosConversationRuntime`; no accessor exposes them. Populating an index
requires calling `indexEnvelope`/`indexArchiveBundle` with already-decrypted
plaintext, which requires reading envelopes at all — see A6.

### A5. Archive Runtime and Archive CLI library (`src/conversation/archive*`, frozen Alpha 1541–1610, 2341–2420)

Real, frozen, well-tested. **No CLI executable** — no `"bin"` field in
`package.json`, no `process.argv` read anywhere in `src/conversation/archive_cli`.
It is a pure composition library the caller wraps in its own I/O boundary.
`collectFedosConversationArchiveBundle(conversationId, deps, exportedAt)`
requires five raw persistence ports as `deps`: `conversationPersistence`
(the OLDER, Board-thread-keyed `FedosConversationPersistence`/`FedosConversationRecord`
domain — **not** the newer private-draft domain `FedosConversationRuntime`
owns), `membershipPersistence`, `capabilityPersistence`, `envelopePersistence`,
`payloadStorage`. None of these five ports is exposed by any accessor on
`FedosRunningDesktopRuntime`.

### A6. The central blocker: envelope/payload access

`src/desktop/runtime/fedos_desktop_runtime.ts` constructs
`conversationEnvelopePersistence` (`FedosConversationMessageEnvelopePersistence`)
and `conversationPayloadStorage` (`FedosConversationPayloadStorage`)
unconditionally (lines ~292–302) — but these are **local variables closed over
by `startFedosDesktopRuntime()`'s own function body and never returned**. The
only object that receives a reference to either is `FedosPrivateTransport`
(constructed only when `privateTransportEnabled`), and `FedosPrivateTransport`'s
own public surface (`sendMailbox`, `sendEphemeral`, `tick`, `observationQuery`,
`start`, `stop`, `isRunning`) has **no read/list method** of any kind — it can
queue an already-persisted envelope for delivery, never enumerate or read one
back.

Separately, `FedosConversationEncryptionAuthority.encrypt()` /
`FedosConversationDecryptionAuthority.decrypt()` both require
`localAccountIndex`/`counterpartyPublicKeyHex` **already resolved by the
caller** — every header comment on both files names this as *"this Arc's own
exact remaining activation-boundary blocker (Alpha 890's own completion
declaration), not solved here or there."* Grepping the whole `src/` tree for
any caller of `.encrypt(`/`.decrypt(` on these two Authorities turns up zero
hits outside their own WASM implementation wrapper — no Coordinator anywhere
resolves a conversation/membership pair down to those two fields. This is a
named, still-open Identity-domain decision, not something this Arc may invent
(inventing it would be exactly the "never invent future architecture" /
"do not redesign Conversation Runtime" prohibition this Arc operates under).

**Consequence:** there is no existing, reachable path — from
`FedosRunningDesktopRuntime`'s current public surface — from "plaintext the
user typed" to "a sent message," nor from "a conversation id" to "its message
list," nor to a real, connected Search Index, nor to Archive's five required
ports. This is true independent of this Arc; it was already true before this
Arc started.

**Decision (per this Arc's own "if a reviewed blocker is found, stop exactly
at that boundary and document it honestly" rule, weighed against "minimize
ripple" / "never broaden scope" / "do not redesign accepted architecture"):**
this Arc does **not** modify `fedos_desktop_runtime.ts` (or any other existing
production file) to add a new accessor closing this gap. Doing so would touch
the one file every prior Runtime-integration Arc (Alpha 606–620, 671–680,
921–930, 1471–1540) has treated as its own dedicated, individually-reviewed
extension point; bundling a fourth such extension into an already-large Arc,
un-reviewed on its own, is exactly the scope-broadening this Arc is told to
avoid. Instead: `listMessages`, `sendMessage`, `reply`, `search`, and `archive`
are implemented as real, testable shell methods that perform every check that
**is** possible against real runtime state (conversation existence, membership,
readiness) and terminate at an honest, closed `"unavailable"` outcome — never a
fake plaintext, never a silent empty list posing as "no messages yet," never a
raw error. `deviceStatus()` is `"unavailable"` for the distinct, independent
reason in A7. The recommended next Arc (see completion declaration) is exactly
the narrow, additive accessor extension this Arc declined to bundle in.

### A7. Device Sync Foundation (`src/sync/`)

Present, 9 files, real and self-consistent — but **wired into nothing**.
Grepping `src/desktop` and `src/conversation` for any import of `src/sync/*`
returns zero hits. `FedosSyncState` is a real facade a caller could compose a
device-status view from (`registerDevice`/`listDevices`, `getCursor`,
`listPendingChanges`, `applyPendingChanges`'s conflict outcomes) — but no
running Desktop Runtime constructs or owns an instance of it. The Arc's own
base-selection rule ("Device Sync Foundation where already integrated... do
not merge unrelated branches merely to satisfy optional capabilities") applies
literally: it is not integrated on this base, so `deviceStatus()` reports
`"unavailable"` honestly rather than the shell becoming the first integrator
(which would be new integration work, not shell work).

### A8. Sender-Key

`grep -rn "Sender-Key|sender_key|SenderKey" src/conversation` → 0 matches.
Not integrated on `master` at all. Per the base-selection rule ("Sender-Key
only if it exists on the chosen base"), this Arc implements Pairwise-only
Group semantics in its type vocabulary and does not reference Sender-Key.

### A9. Existing desktop/preview UI code

None. `src/desktop/*` outside `host/`+`runtime/` is Nostr wire/relay/event/
identity plumbing (`desktop_application.ts`, `fedos_relay*.ts`,
`websocket_relay.ts`, `nostr_*_verifier.ts`). The only process-facing file is
`run_fedos_desktop_runtime.ts`, a signal-handling launcher (`SIGINT`/`SIGTERM`
→ `stop()`), not an interactive shell. No view-model layer, no CLI dispatcher,
no rendering code exists anywhere in this repository prior to this Arc.

### A10. Sensitive vs. safe fields

Never exposed by this shell: bearer secrets (`FedosConversationCapabilityBearerSecret`,
returned exactly once by the runtime itself, on a construction result — this
shell passes that value through unchanged and never logs/stores it separately),
raw ciphertext bytes, `payloadId`/key handles, `localAccountIndex`/
`counterpartyPublicKeyHex`, any `Error` object or stack trace, any WASM/crypto
provider internal. Safe: conversation id, mode, lifecycle, readiness axes,
participant references (`authority`/`publicIdentifier`/`identityId` — already
public by construction, per `fedos_conversation_participant_reference.ts`'s own
header), membership role/state, capability descriptors (never the secret),
timestamps.

### A11. Expected production files (this Arc)

All new, all under `src/desktop/shell/`:

- `fedos_desktop_shell_result.ts` — closed outcome vocabulary
- `fedos_desktop_shell_view_models.ts` — `ConversationSummary`, `ConversationDetail`, `MessageView`, `DeviceStatusView`
- `fedos_desktop_application_shell.ts` — `FedosDesktopApplicationShell` class + `startFedosDesktopApplicationShell()`

No existing production file changes.

### A12. Baseline failures (this worktree, before any shell code)

- `npm run typecheck`: one pre-existing failure, unrelated —
  `test/secure_runtime_alpha_477_scheduler_lifecycle_model.test.ts(121,18):
  error TS2722: Cannot invoke an object which is possibly 'undefined'.`
- `npm test`: baseline captured separately (see completion declaration) —
  per this repository's own known "fresh worktree raw-import artifact" (linked
  worktrees can spuriously fail a batch of `Cargo.toml`/`lib.rs` raw-import
  tests that pass in the primary checkout), any such failures are treated as
  pre-existing worktree noise, not a regression, and are cross-checked before
  being written off as such.

### A13. No-UI-framework decision

No Electron, React, Vue, Svelte, HTTP server, or Worker route is added or
touched. This Arc's shell is plain TypeScript classes/functions over the
existing runtime handle — importable and testable exactly like every other
module in this repository, with zero new `package.json` dependencies. Phase M
(optional text shell) is not attempted this Arc — it is explicitly optional
and the Arc's own budget went to getting the mandatory Phases B–L honest and
correct against the real, non-trivial boundary found in A6.

## Phases B–K — design summary

- **B (shell)**: `FedosDesktopApplicationShell` owns exactly one
  `FedosRunningDesktopRuntime`. `start()`/`stop()`/`status()` wrap the runtime's
  own lifecycle; every other method throws-free, fail-closed (`"unavailable"`)
  once stopped or before started.
- **C (view models)**: `ConversationSummary`/`ConversationDetail` compose
  `FedosConversationDraftView` + `FedosConversationReadiness` + membership
  list + construction status. `MessageView` is defined for API-shape
  completeness (Phase C requires it) but is only ever produced with
  `plaintext: { state: "unavailable", reason: "..." }` — see A6.
- **D (result mapping)**: one closed `FedosDesktopShellOutcome` union:
  `ok | unavailable | unauthorized | not-found | invalid-input | conflict |
  requires-activation | requires-unlock | unsupported | failed`. Every shell
  method returns a value built from this vocabulary; the original domain
  result is preserved on an internal, non-serialized diagnostic field only
  where a test needs it, never surfaced as a raw `Error`.
- **E (conversation list)**: the shell keeps a session-local, in-memory
  registry of conversation ids it has itself created (there is no enumeration
  primitive to discover conversations created by another shell instance or a
  prior process run — A2). `listConversations(filter?)` reads each registered
  id fresh through `findConversation`/`readinessForConversation`/
  `listMemberships`/`constructionStatus` (never caches state itself beyond the
  id), sorted deterministically by `(createdAt, id)`.
- **F (message read/retention)**: `listMessages` returns `"unavailable"` — see
  A6. No plaintext is ever fabricated.
- **G (send/reply)**: `sendMessage`/`reply` run every check that is possible
  first (conversation exists → membership is active → not already
  `"unavailable"` for a structural reason) and only then reach the honest
  `"unavailable"` terminus at the encrypt boundary — never silently no-op,
  never a fake success.
- **H (creation/activation)**: `createDirectConversation`/`createPrivateGroup`
  are real. `issuedInvitations(id, issuer)` is real (wraps
  `issuedCapabilityDescriptors`). `redeemInvitation` is `"unavailable"` (A3).
  There is no `activate`/`reactivate` method — only a read-only
  `activationStatus` field on the view model, because no mutating primitive
  exists to call (A2) and inventing one is out of scope by this Arc's own
  prohibitions.
- **I (search)**: `search()` is `"unavailable"` — see A4/A6.
- **J (archive)**: `archive()` is `"unavailable"` — see A5/A6.
- **K (device status)**: `deviceStatus()` is `"unavailable"` — see A7.

## Verification order

1. `npm run typecheck`
2. focused: `npx vitest run test/desktop/shell` (new)
3. focused: `npx vitest run` filtered to conversation runtime / search /
   archive / sync test files (regression check only — this Arc changes none
   of them)
4. `npm test` (full)
5. clean temp profiles/archives/indexes/logs created by the new tests
6. stage exact new paths only
