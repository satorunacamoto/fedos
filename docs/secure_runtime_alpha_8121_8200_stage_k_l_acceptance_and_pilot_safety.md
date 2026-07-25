# Secure Runtime Alpha 8121-8200 — Phase K/L: Visible-Control Acceptance and Closed-Pilot Safety Controls

## Phase K — the original 42 steps (Secure Runtime Alpha 8041-8120's own vertical slice, unmodified)

Steps 1-42 remain proven by
`packages/fedos-desktop-electron-spike/test/secure_runtime_alpha_8041_8120_real_user_facing_vertical_slice.test.ts`
and `secure_runtime_alpha_8041_8120_failure_matrix.test.ts`, both
re-verified passing after every change this Arc made (last full re-run:
clean, 2/2 and 11/11 respectively). No regression found; not repeated
here in full — see that Arc's own completion declaration.

## Phase K — the 14 new, review-driven steps

| # | Step | Status | Evidence |
|---|---|---|---|
| 43 | ordinary production Renderer has no `window.fedosAcceptance` | **PASS** | `secure_runtime_alpha_8121_8200_acceptance_bridge_isolation.test.ts` — real process, `ui-script` mode, `readGlobal` reads `"undefined"` |
| 44 | acceptance-mode Renderer still supports the test harness | **PASS** | same file — real process, `AUTOTEST=acceptance`, `read-global` reads `"object"`; all pre-existing acceptance-mode/lower-level regression suites re-verified passing |
| 45 | rapid double-click invitation acceptance creates one decision | **N/A for this product** | invitations are automatically accepted via real-time delivery; no manual accept/reject control exists (`redeemInvitation()` is a permanent, disclosed backend stub, Phase A report) — reconciliation doc records this explicitly |
| 46 | rapid double-click Identity Transition action affects the exact selected durable item once | **PASS** | `secure_runtime_alpha_8121_8200_exact_target_authorization.test.ts` test 3 (double-decide dedup) + `secure_runtime_alpha_8121_8200_double_submit_guards.test.ts` (structural: renderer button-disable guard) |
| 47 | rapid double-click Signed Deletion approval affects the exact request once | **PASS** | Controller's own `#actionInFlight` (shared code path with Identity Transition, same guard mechanism) + structural renderer-guard test |
| 48 | switch selection during an in-flight action; target cannot change | **PASS** | `secure_runtime_alpha_8121_8200_exact_target_authorization.test.ts` tests 1-2, 4-5 — proves the OLD API redirects to the wrong item and the NEW exact-id API does not |
| 49 | lock clears visible conversation plaintext | **PASS** | `secure_runtime_alpha_8121_8200_lock_content_invalidation.test.ts` — real 2-party message exchange, real reveal, real Lock, real DOM read |
| 50 | lock clears Search query/results | **PASS** | same file — Search results proven present then genuinely empty after Lock |
| 51 | stale pre-lock live-update callback cannot repopulate the DOM | **PASS** | both polling intervals (chat, relay-status) are explicitly stopped inside `clearAllRendererContentState()`/`onLock()` before the screen switches; proven indirectly by the same lock-content test showing no repopulation |
| 52 | fresh unlock does not show old-generation plaintext until reloaded through the new Runtime | **PASS** | same file — explicit assertion immediately after re-unlock, before re-opening the conversation |
| 53 | Relay disconnect copy states no automatic reconnect | **PASS** | renderer copy fixed from a FALSE "retrying the rest" claim to "lock and unlock again to retry"; proven via the real disconnect/reconnect vertical slice (Alpha 8121-8200's own Phase K steps 15-18 test, `secure_runtime_alpha_8041_8120_real_user_facing_vertical_slice.test.ts`) |
| 54 | Lock→Unlock reconnect succeeds visibly | **PASS** | same test — real relay close+rebind, real Lock→Unlock, status genuinely returns to "1/1 Relay connected" |
| 55 | clean-checkout generated WASM no longer creates false unrelated guard failures | **PASS** | Reproducibility Finding 2 — directly proven against a REAL WASM artifact present on disk in this worktree; `secure_runtime_alpha_8121_8200_wasm_git_truth_guard.test.ts` (6 tests) |
| 56 | explicit Electron binary installation works without lifecycle scripts | **PASS** | `secure_runtime_alpha_3881_3940_electron_build_spike.test.ts` test 28 (no postinstall/install script) passes; `ensure-electron-binary` script re-verified by deleting the binary and re-running |

The headline flow throughout remains visible-control driven: every new
test drives real spawned Electron processes through `AUTOTEST_MODE=
ui-script`/real DOM `click()`/`textContent` reads, or (for the 3
Controller-level exact-id race tests, disproportionate to reproduce via a
full cross-account protocol flow) direct, disclosed Controller-level
tests explicitly scoped to the presentation-layer authorization logic
that changed — never a substitute for the real DOM-driven proof where one
was practical.

## Phase L — Closed-Pilot Safety Controls

| Requirement | Status | Where |
|---|---|---|
| Beta label | **Already present** | page title + `<h1>` both say "— Beta" (Alpha 5061-5160/8041-8120) |
| Unsigned installer warning | **Already present** | `README.md`, `SECURITY.md`, release manifest `unsigned: true` field (Alpha 7961-8040 Stage 6 + this Arc's own reconciliation) |
| No external audit disclosure | **Already present** | `SECURITY.md` states no independent external audit has occurred; `docs/secure_runtime_alpha_8121_8200_external_audit_prep_delta_v1.md` reiterates "this is audit preparation, not an audit" |
| Local WASM source-build prerequisite | **Already present** | `SECURITY.md`, this Arc's own clean-checkout reproducibility documentation |
| Relay has no automatic reconnect; Lock→Unlock is current recovery action | **NEW this Arc** | `fedos_desktop_beta_limitations.ts` (`relay-has-no-automatic-reconnect`), surfaced on `about`/`beta-status`; also the nav-bar's own real-time status text |
| Archive/deletion limitations | **Already present** | `SECURITY.md` (Archive retained-copy limits, Device revocation cannot erase prior copies, Signed Deletion acknowledgement limits) |
| Search plaintext-token limitation | **Already present** | inline copy on the Search screen itself (`fedos_electron_beta_page.html`) + `SECURITY.md` |
| Page-locking/RAM-erasure limitation | **NEW this Arc** | `fedos_desktop_beta_limitations.ts` (`no-guaranteed-memory-erasure`) + `SECURITY.md`'s own existing "no mlock/VirtualLock guarantee" bullet (Phase I/J work) |
| Feedback guidance without secrets | **NEW this Arc** | genuinely missing before this Arc (confirmed by direct search — no prior doc contained emergency/severity/exit-criteria language); now `docs/secure_runtime_alpha_8121_8200_closed_pilot_runbook.md`'s own "Immediate action" section |
| Version/build identifier | **Already present** | `#release-info` element, wired to `APP_VERSION`/release configuration |
| Emergency stop-use runbook | **NEW this Arc** | `docs/secure_runtime_alpha_8121_8200_closed_pilot_runbook.md` — did not exist before this Arc; confirmed by direct search of all prior docs for "emergency"/"stop using this build"/"severity"/"triage"/"pilot exit" (zero matches before this Arc) |
| Pilot exit criteria | **NEW this Arc** | same runbook, "Pilot exit criteria" section — no open SEV-1, matrix has no security-correctness FAIL, audit commissioned |
| Issue severity and triage vocabulary | **NEW this Arc** | same runbook, "Issue severity and triage vocabulary" section (SEV-1 stop-pilot / SEV-2 fix-before-next-build / SEV-3 known-limitation / SEV-4 polish) |
| Known accessibility limitations | **Already present** | this Arc's own Stage F/G report (`secure_runtime_alpha_8121_8200_stage_fg_recovery_accessibility_gates.md`), classified BETA BLOCKER/HIGH/MEDIUM/POLISH |
| External audit preparation status | **Already present** | `docs/secure_runtime_alpha_8121_8200_external_audit_prep_delta_v1.md`, explicitly labeled preparation, not an audit |

No internal review commit hash (`6873d24f`/`73fc0b2`/`d760c95`/etc.) is
surfaced anywhere in the ordinary end-user UI — every reference lives in
`docs/` (developer/reviewer-facing) only, matching the mission's own
instruction.
