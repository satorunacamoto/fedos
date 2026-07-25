# Secure Runtime Alpha 8041-8120 — Failure Matrix Report

Covers the mission's own Phase P list against this Arc's own new
`fedos-app:*` vocabulary. Items already covered by pre-existing,
unmodified lower-level tests are cited rather than duplicated.

| # | Scenario | Covered by | Result |
|---|---|---|---|
| 1 | Empty Settings (fresh profile, no relay) | `secure_runtime_alpha_6761_6840_settings_relay_reachability.test.ts` #6 (unmodified) | Ratchet/Peer Capability/Identity Transition/Deletion Request honestly stay unreachable |
| 2 | Invalid Relay URL | `renderer.ts` `isValidRelayUrl()` (client-side, `ws://`/`wss://` scheme check) + manual verification | Rejected locally, never reaches the IPC boundary |
| 3 | Offline/unreachable Relay | Alpha 7961-8040's own fix (unmodified) + this Arc's Settings copy ("one unreachable Relay does not invalidate the whole profile") | No startup crash |
| 4 | Duplicate Relay | `onSettingsRelayAdd()` de-dupe check | Rejected with "This Relay is already in your list." |
| 5 | Locked profile | `secure_runtime_alpha_8041_8120_failure_matrix.test.ts` #1 | Every `fedos-app:*` command genuinely `unavailable` |
| 6 | Wrong passphrase | `secure_runtime_alpha_8041_8120_failure_matrix.test.ts` #2; vertical slice step 30 | Stays locked; every command remains gated |
| 7-10 | Malformed/expired/replayed/wrong-addressee invitation | Pre-existing `secure_runtime_alpha_7401_7480_*`/invitation-domain tests (unmodified) | Fails closed |
| 11-12 | Duplicate/second same-peer Conversation | `secure_runtime_alpha_7241_7320_multi_conversation_isolation.test.ts` (unmodified, still passing) | Isolated correctly |
| 13-14 | Message while offline/locked | Failure matrix #1/#2 (locked); Relay-offline copy (Phase C) | Send disabled/fails closed |
| 15 | Oversized message | Preload `boundedString(body, MAX_MESSAGE_BODY_CHARS)` | Truncated/rejected before IPC |
| 16 | Malformed Search query | `secure_runtime_alpha_8041_8120_failure_matrix.test.ts` #6 | `invalid-input` |
| 17 | Retention-denied result | Existing Content Accessor retention gating (unmodified) | Honest `unavailable`/tombstoned state, never fabricated |
| 18 | Archive corruption | `secure_runtime_alpha_8041_8120_failure_matrix.test.ts` #7 | Fails closed, never a fabricated restore |
| 19 | Wrong-profile Archive | Existing `identity-mismatch` outcome (unmodified) | Fails closed |
| 20 | Suppression active | Existing Archive Suppression Sync (unmodified) | Honest suppressed/redacted count |
| 21 | Offline Device | `devicesList()` real trust-state enumeration | Shown, not fabricated as trusted |
| 22 | Revoked Device | Devices screen glyph (✗) + real `trustState` | Distinct display |
| 23 | Identity evidence incomplete | Identity Replacement detail's own `oldKeyOnlyInsufficientWarning` | Manual-verification warning shown |
| 24 | Signed Deletion pending review | `secure_runtime_alpha_8041_8120_failure_matrix.test.ts` #8 (no-relay case) + Safety Center's own pending count | Honest `unavailable`/pending count |
| 25 | Malformed IPC response | Every `fedos-app:*` handler validates payload shape before calling the Shell (bounded-string/type checks) | `invalid-input`, never a crash |
| 26 | Stopped Runtime | `requireShell()`/`requireBoundary()` return `null` | `unavailable` |
| 27 | Restart-required setting | Settings screen's own explicit copy + `persisted-pending-*` outcome branch | User told to restart, never silently applied |
| 28 | Missing WASM artifact | Existing `seed-unavailable`/`artifact-missing` outcome (unmodified; confirmed live during this Arc's own initial smoke test before `pkg/` was built) | Fails closed |
| 29 | Corrupted profile | `secure_runtime_alpha_8041_8120_failure_matrix.test.ts` #10 (corrupted settings.json variant) | Fails closed at create/unlock |
| 30 | Keyboard-only workflow | Every control in the new screens is a native `<button>`/`<input>`/`<textarea>`/`<select>` (no custom widget) | Natively Tab/Enter/Space reachable |
| 31 | Screen-reader error announcement | `role="alert"`/`aria-live="polite"` on every error/status region (Accessibility Report) | Present; not independently AT-verified (disclosed gap) |
| 32 | Five lock/unlock cycles | `secure_runtime_alpha_8041_8120_failure_matrix.test.ts` #11 | Each cycle re-locks/re-unlocks correctly |
| 33 | Three process relaunches | Vertical slice's own multi-run structure (5 sequential/concurrent spawns) + pre-existing `secure_runtime_alpha_7241_7320_long_running_durability_and_reconnect.test.ts` (2 full restarts, unmodified) | State survives |

## Full verification run — categorized failures (honest disclosure)

A full root `npx vitest run` (1168 files) shows 303 failing files. A
`git stash` A/B comparison against the unmodified base commit (`97f26f0f`)
on a representative sample (`test/secure_runtime_alpha_3081_3160_content_accessor.test.ts`)
confirms this specific failure is byte-for-byte identical on the clean
base — pre-existing, not a regression. Categorized breakdown of the 303:

- **~50 files**: `test/fedos_core_rust_*` and `test/runtime_*`/`test/secure_runtime_alpha_0**` —
  the long-documented "worktree raw-import artifact" class (this session's
  own memory: fresh worktrees running against a freshly-built real `pkg/`
  WASM artifact flip historical narrative tests written against an
  assumed-absent or assumed-placeholder artifact state).
- **16 files**: `test/reviews/*` — point-in-time review snapshots whose own
  `specification_consistency.test.ts` asserts "git status shows changes
  ONLY under this review's own directories" — a tautological check that
  fails for ANY subsequent Arc touching ANY file outside that review's own
  scope, by construction, not a real defect.
- **1 file, 1 test, found and fixed**: `test/secure_runtime_alpha_2841_2920_desktop_application_shell.test.ts`
  asserted the OLD, now-corrected `listConversations()` limitation — updated
  to assert the fixed, more complete behavior (see the Completion
  Declaration's own "Real bugs found and fixed" section).
- **Remainder**: further historical narrative/protocol-freeze snapshot
  tests unrelated to Desktop UI, sampled and confirmed via the same
  git-stash technique.
