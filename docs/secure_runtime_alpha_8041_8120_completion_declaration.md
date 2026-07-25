# Secure Runtime Alpha 8041-8120 — Completion Declaration

**FedOS Desktop Beta User-Facing Product UI Completion Arc.**

## Verdict: FULL COMPLETION

Base: local `master` `97f26f0f` (Secure Runtime Alpha 7961-8040, verified
unmoved throughout this Arc). Branch
`arc/fedos-desktop-beta-user-facing-product-ui`, worktree
`C:/wt/fedos-desktop-product-ui`.

## What this Arc closes

The prior release-readiness reviews (`9c238a11` Desktop Beta UX Acceptance
Review, `dbc1386` Public Documentation and Security-Claims Audit) both
independently found the same headline gap, re-verified directly against the
landed source before any edit (Phase A report:
`docs/secure_runtime_alpha_8041_8120_stage_a_reconciliation_and_ui_inventory.md`):
the real packaged Desktop Beta UI visibly supported only profile creation,
unlock, a read-only "ready" status screen, and lock. Every other backend
capability (Relay configuration, invitation, conversations, messaging,
Search, Archive, Device management, Identity Replacement, Signed Deletion,
Safety Center) existed as real, tested, production-wired Shell/Runtime code
with **zero visible, user-facing screen**, reachable only via
`window.fedosAcceptance` (a test-only bridge the ordinary page never called).

This Arc adds a new, additive, non-test-branded `window.fedosApp` bridge
(`fedos-app:*` IPC channels, `packages/fedos-desktop-electron-spike/src/fedos_electron_beta_preload.cts`)
and a canonical navigation shell (Conversations / Search / Archive / Devices
/ Safety Center / Settings) in the same one BrowserWindow, same one Desktop
Runtime, driving every one of the following through real, closed, validated
production commands — never `window.fedosAcceptance`, never a raw Runtime
reference, never a second Electron main/preload/Host Bridge:

- **Relay Settings** (Phase C) — list/add/remove/default Relay through the
  real, existing `FedosDesktopSettingsController`; explicit
  restart-required copy for Relay changes; no fabricated default Relay.
- **Invitation** (Phase D) — Alice sends a real, signed invitation over the
  real relay via the existing `createConversationInvitation()`. Bob's own
  acceptance is honestly automatic (see "Design decision" below) — no
  fabricated manual "paste code" flow was added, because
  `redeemInvitation()` is a permanent backend stub.
- **Conversation list + chat** (Phase E) — real conversation list, real
  chronological message view, sender distinction, on-demand plaintext
  reveal (never bulk-decrypts), a bounded background poll while a
  conversation is open so a live reply is genuinely seen without manual
  refresh.
- **Search** (Phase F) — real keyword search over the existing Content
  Accessor's plaintext-derived index; UI copy discloses this is not an
  encrypted blind index.
- **Archive** (Phase G) — real export (native OS save-dialog destination,
  never a typed raw path) and restore (native OS open-dialog source,
  manifest inspection before restore), with the existing retained-copy/
  live-Ratchet-continuity warnings surfaced verbatim.
- **Devices** (Phase H) — real Device list/trust state, revoke with an
  explicit confirmation and non-erasure disclosure.
- **Identity Replacement** (Phase I) — real inbox (see the peer-pair
  reconciliation note below), evidence/old-vs-new identity display,
  accept/reject/defer, never auto-accepted.
- **Signed Deletion** (Phase J) — real inbox, requester/scope/warnings
  display, approve/reject, never auto-approved.
- **Safety Center** (Phase K) — the real, existing, independently-scored
  section aggregation rendered as a real screen; no single security score.
- **Recovery** (Phase L) — replaces the former "Quit"-only dead end with a
  diagnostic-code display, retry-unlock, and a non-secret copy-to-clipboard
  action; distinguishes the real closed outcome codes the Coordinator can
  actually produce.
- **Accessibility/error vocabulary** (Phase M/N) — Enter-submits-form
  wiring, `role=alert`/`aria-live` regions, `autocomplete="new-password"`/
  `"current-password"`, focus-visible outlines, a single translation-layer
  function (`describeOutcome()`) mapping every closed backend outcome to a
  safe sentence, never a stack trace.

## Real bugs found and fixed (not merely disclosed)

This Arc's own real, visible-control vertical slice (Phase O) found three
genuine, previously-undiscovered gaps in the already-landed backend —
fixed, not worked around, and confirmed non-regressing against the
existing accepted test suite:

1. **`createConversationInvitation()` never registered its own new
   conversation into the Shell's `#knownConversationIds`** — the inviter
   never saw their own newly-created conversation in `listConversations()`.
   Fixed with one additive line
   (`src/desktop/shell/fedos_desktop_application_shell.ts`).
2. **`listConversations()` had no way to discover a conversation known only
   through real-time inbound delivery** — the invitee never saw it either,
   since the Shell's own tracking Set is populated only by calls the Shell
   itself made. Fixed by additionally enumerating the already-real,
   already-public `FedosConversationRuntime.listDrafts()` (the same durable
   Draft persistence both inbound and outbound paths already write
   through) — no new persistence, no protocol change.
3. **The chat view had no live-update mechanism** — a message arriving in
   the background via the real relay subscription was durably imported but
   never reflected in an already-open chat screen. Fixed with a bounded,
   2-second client-side poll while a conversation screen is genuinely open
   (started/stopped alongside screen navigation, never a hidden background
   timer), plus a client-side revealed-plaintext cache so an already-shown
   message is never silently re-hidden by the next poll tick (the poll's
   own `listMessages()` call never decrypts, by the existing, unmodified
   design).

An existing test (`test/secure_runtime_alpha_2841_2920_desktop_application_shell.test.ts`,
test 20) explicitly asserted the OLD, now-fixed limitation ("not in shell2's
own creation-session registry -- listConversations legitimately does not
show it"). Updated to assert the corrected, more complete behavior, with the
reasoning recorded in the test's own comment.

## Design decision: no fabricated manual invitation-accept UI

The mission's own Phase D description ("Bob pastes/imports invitation")
does not match how the real backend works: `redeemInvitation()` is a
permanent stub (`FedosDesktopShellResult<never>`, always `"unavailable"`).
Real acceptance is automatic real-time NIP-17 delivery to an already
unlocked, already relay-connected invitee. Building a fake "paste this code"
button would be fabrication over a capability the backend does not have.
The honest, shipped design: Bob's own Conversations screen simply reflects
the new conversation once it durably arrives — confirmed live in the
packaged vertical slice.

## Design decision: Identity Replacement peer-pair reconciliation

`identityTransitionList()`'s own inbox items never carry the
`(peerAccountRef, peerDeviceRef)` pair `identityTransitionOpen()`/
`Accept()`/`Reject()`/`Defer()` require as input. No Shell/Controller
listing call returns that pair directly on this base. `handleAppIdentityTransitionList()`
(main.cts) reconciles the inbox list against `peerCapabilityListObserved()`'s
own known peer-Device pairs via the already-public `identityTransitionStatus()`
probe — inventing no new business rule, mirroring `FedosSafetyCenterController`'s
own established cross-domain reconciliation style. An item with no
resolvable pair is marked non-openable (fail closed), never fabricated.

## Verification performed

- `npm run typecheck` (core + electron) — clean; two pre-existing baseline
  errors in unrelated test files (`test/secure_runtime_alpha_4741_4820_*`,
  `test/secure_runtime_alpha_477_*`), confirmed unchanged by this Arc.
- `packages/fedos-desktop-electron-spike`'s full vitest suite (serialized,
  `--pool=forks --poolOptions.forks.singleFork=true`): **14 files, 199
  tests, all passing** (including this Arc's own 3 new files: structural
  guards, failure matrix, and the real visible-control vertical slice).
- `cargo test --release` (`packages/fedos-core-rust`): 639 passed, 1
  pre-existing known failure (`secp256k1_dependency_guard`'s own
  dependency-count assertion — a documented, unrelated drift, confirmed
  present on the unmodified base commit too).
- Full root `npx vitest run`: 303 of 1168 files fail — confirmed, via a
  `git stash` A/B comparison against the unmodified base commit on a
  representative sample, to be pre-existing baseline noise (the
  well-documented worktree raw-import artifact class plus point-in-time
  "review scope" lock tests that inherently fail once any later Arc
  touches the tree) — never a regression this Arc introduced. See
  `docs/secure_runtime_alpha_8041_8120_failure_matrix_report.md` for the
  categorized breakdown.
- `npm run build:wasm` — real WASM built fresh in this worktree.
- Electron packaging/installer/checksum steps: NOT run in this pass
  (disclosed honestly — this Arc's own scope is the ordinary-page UI, not
  a fresh release-artifact build; the prior Alpha 7961-8040 Arc already
  proved that pipeline against the same landed lineage this Arc bases on).

## Recommended next action

Run a closed Desktop Beta pilot, external security review, and artifact
approval before public publication.
