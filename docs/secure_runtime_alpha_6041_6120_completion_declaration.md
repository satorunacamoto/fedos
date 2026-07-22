# Secure Runtime Alpha 6041–6120 — Completion Declaration

**FedOS Signed Deletion Request Multi-Device Aggregation and User Consent UI Arc**

## Declared: full completion

Per the mission's own explicit "Full completion requires" list:

- [x] Per-Device aggregation — real, closed, 17-value per-Device + 7-value account-aggregate
      vocabulary, structurally incapable of producing an account-wide/erasure claim.
- [x] Explicit recipient consent — opening an item never executes anything; approve/reject are
      the only two paths to a terminal decision; no countdown, no automatic consent.
- [x] Real Shell/Presentation/Renderer path — nine new `FedosDesktopApplicationShell` methods,
      one new Controller, one new Renderer, all wired into the EXISTING, unmodified Presentation
      Boundary/Renderer aggregate — proven for real in the vertical slice.
- [x] Safe warnings — one centralized, closed, six-code warning set shown on every consent
      screen.
- [x] Durable restart behavior — proven directly: both Runtimes rebuilt from the same log files
      after a full stop/restart; Shell/Renderer reconstruct byte-identical status.
- [x] Honest mixed/unknown status — the real vertical slice's own aggregate is
      `"some-devices-applied"`, explicitly asserted distinct from `"all-known-devices-responded"`/
      any completion claim.
- [x] Real deletion path remains functional — Device A's own approval really executes through
      `b3b3a6d`, independently re-verified (`evaluatePayloadAccess()` → `"denied"`).
- [x] No overclaim — structural guard tests (Phase Q) prove no
      `"deleted-everywhere"`/`"account-deleted"`/Archive-deletion/Group/attachment/whole-conversation
      value exists anywhere in this Arc's own new code.
- [x] Real vertical slice — `test/secure_runtime_alpha_6041_6120_real_vertical_slice.test.ts`,
      real WASM (built fresh in this session), real Shell, real Controller, real Renderer, two
      real Device-specific requests, one real approval + real execution + real acknowledgement,
      real restart. **Passes.**

## A real, necessary functional fix (see the reconciliation report §4)

`5881-5960`'s own approval method re-evaluated `"always-review"` a second time at approval,
making every `"always-review"` item permanently un-approvable — caught by this Arc's own real
vertical slice, not by inspection. Fixed narrowly and documented in three places (the
reconciliation report, the execution spec, and the consent/warning UX document).

## Gap-closing follow-up (same Arc, same commit lineage)

The three limitations originally numbered 1–3 below were closed in a follow-up pass, at the
user's explicit request, without redesigning anything this Arc already declared frozen:

1. **Electron subprocess acceptance is now proven for real.** The existing, unmodified,
   generic `window.fedos.invoke()` transport (`fedos_electron_host_adapter_main.cts`/
   `_preload.cts`) already routed any validated Host Command, including this Arc's own nine —
   no new Electron entry point was needed. The self-test page
   (`packages/fedos-desktop-electron-spike/src/fedos_electron_host_adapter_selftest.ts`) gained
   four new steps dispatching `deletion-request-list-received`/`-list-sent`/`-status`/`-approve`,
   and `secure_runtime_alpha_4101_4180_electron_host_adapter.test.ts` now asserts all four return
   the honest `{outcome:"error", code:"unavailable"}` shape through a REAL spawned Electron
   subprocess (this spike's own minimal `hostRuntimeConfig()` still never sets
   `conversationDeletionRequest` — the same honest-`"unavailable"` precedent `device-status`
   already established in this same adapter). 21/21 tests pass.
2. **Notification Coordinator integration (Phase K) is now wired.** `FedosDesktopNotificationKind`
   (`src/desktop/notification/fedos_desktop_notification_types.ts`) gained five new, additive,
   fixed-template kinds (`deletion-request-received/-expired/-responded/-pending-devices/-partial`).
   `FedosDeletionRequestController` now owns a `FedosDesktopNotificationCoordinator` (defaulting to
   the safe `NoopFedosDesktopNotificationPort`, swappable via `setNotificationPort()`), fires
   `"deletion-request-received"`/`"-expired"` once per newly-seen Inbox item (in-memory
   `#notifiedRequestIds` tracking — never a duplicate within one process lifetime), and exposes
   explicit sender-side triggers (`notifyRecipientResponded`/`notifySomeDevicesPending`/
   `notifyPartiallyApplied`). `test/secure_runtime_alpha_6041_6120_notification_coordinator_wiring.test.ts`
   (8 tests) proves the once-only firing discipline and that no notification ever carries a
   request id, requester ref, reason code, or anything content-shaped — only the closed kind + an
   opaque `targetConversationId` + a short bounded `detail`.
3. **`fedos_desktop_runtime.ts`'s own full production bootstrap now threads `conversationDeletionRequest`
   through.** `FedosDesktopRuntimeConfig` gained one new optional field
   (`conversationDeletionRequest?: FedosConversationDeletionRequestIntegrationDependencies`),
   passed straight to `createFedosConversationRuntime({..., deletionRequest: config.conversationDeletionRequest})` —
   omitted, behavior is byte-identical to before (`deletionRequest()` stays `null`).
   `test/secure_runtime_alpha_6041_6120_desktop_runtime_config_threading.test.ts` (4 tests) proves,
   through the REAL `startFedosDesktopRuntime()`/`FedosDesktopApplicationShell.start()` production
   path (a real BIP-340 `FedosNobleTestNostrSigningAuthority`, no WASM artifact required): omitted
   stays `null`; supplied is real, non-null, and singleton-per-run; and the Shell's own
   `deletionRequestListReceived()` goes from `"unavailable"` to live `{outcome:"ok", value:[]}`
   through this exact config path.

## Named, honest limitations still standing (not silently dropped)

4. **`deletionRequestListSentForTarget()`'s own per-Device trust-fact lookup
   (`FedosDeletionRequestController.refreshSentStatus()`) needs `deviceSyncOperational()`**, which
   remains unconstructed by the minimal-config production paths exercised above. The real vertical
   slice instead feeds this Arc's own already-unit-tested pure aggregation functions directly from
   real Shell facts, proving the SAME math without requiring that additional Device Sync facade
   wiring. Out of scope for this gap-closing pass (the user's own selection named only the three
   items above).
5. **Pending-review durability** — see the consent/warning UX document's own final section.

## Verification run (this worktree)

1. `npx tsc --noEmit -p .` — clean except the two pre-existing, unrelated baseline errors
   (`4741-4820` production Master Seed activation, `477` scheduler lifecycle model — neither file
   touched by this Arc or its gap-closing follow-up; reproduced identically against a clean
   `git stash` of this Arc's own changes).
2. This Arc's own 4 original test files (36 tests) plus 3 gap-closing follow-up test files (16
   tests: 8 Notification Coordinator, 4 desktop-runtime config threading, plus the pre-existing
   Electron adapter file's 4 new self-test assertions folded into its own 21) — all passing,
   including the real WASM vertical slice and a real spawned Electron subprocess round trip.
3. Every pre-existing `5641-5720`/`5721-5800`/`5881-5960` test file (248 tests total across 19
   files, including their own three real WASM vertical slices) — unchanged, all still passing.
4. Every pre-existing Desktop Shell/Host-Bridge/Presentation-Boundary/Renderer-Boundary/Device-
   Management test file (98 tests across 6 files) — unchanged, all still passing.
5. No file under `p2p/` or `.tmp_gen/` was read, written, or referenced by this Arc or its
   gap-closing follow-up.

## Files changed

Six new files under `src/desktop/presentation/deletion_request/` and
`src/desktop/renderer/deletion_request/`; two new files under `src/conversation/deletion_request/`
(the additive Inbox summary port); seven existing shared Desktop/Runtime files gained a narrow,
additive extension each; five new docs; three new test files (plus one real vertical slice). No
`package.json`, `package-lock.json`, `Cargo.toml`, `p2p/`, or `.tmp_gen/` change.

## Recommended next Arc

**FedOS Desktop Beta Privacy Controls and Safety Center Arc.**
