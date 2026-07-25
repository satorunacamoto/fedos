# Secure Runtime Alpha 8121-8200 — Phase B: Claim Verification (7337759)

Every claim verified directly against committed source (`git show 7337759:...`)
and by running the real test suite in a fresh integration worktree — never
trusting the prior Arc's own completion declaration alone.

| Claim | Verdict | Evidence |
|---|---|---|
| `window.fedosApp` exists, separate from `window.fedosAcceptance` | **VERIFIED** | `fedos_electron_beta_window.d.ts` `interface Window` lists both as distinct readonly members; `fedosApp: FedosAppBridge` is a wholly separate interface from `fedosAcceptance: FedosAcceptanceBridge`. |
| Ordinary UI uses `fedosApp` only | **VERIFIED** | `grep -c "fedosAcceptance"` in `fedos_electron_beta_renderer.ts` returns exactly 1 match — a header-comment sentence stating the renderer never reads it, not a code reference. Confirmed via `stripComments()`-based structural-guard test (`secure_runtime_alpha_8041_8120_structural_guards.test.ts` #1), which passes. |
| Relay Settings / Invitation / Conversations+chat / Search / Archive / Devices / Identity Replacement / Signed Deletion / Safety Center all visibly reachable | **VERIFIED** | `fedos_electron_beta_page.html` contains all 7 `.app-screen` sections (`app-screen-conversations`, `-chat`, `-search`, `-archive`, `-devices`, `-safety`, `-settings`); Identity Replacement/Signed Deletion confirmed nested inside `app-screen-safety` (`#identity-transition-list`, `#deletion-request-list`). |
| Recovery has usable actions beyond a dead-end Quit | **VERIFIED, with one cosmetic note** | `screen-recovery` has `#recovery-retry-btn` (Retry unlock), `#recovery-copy-btn` (Copy diagnostic code, non-secret), plus Quit — 3 real actions. Minor, non-blocking finding: the HTML's `#recovery-actions` div is present but unused by the renderer (dead markup, no functional impact) — classified POLISH in Phase G's own findings table below. |
| `contextIsolation`/`sandbox` enabled, `nodeIntegration` disabled | **VERIFIED** | `fedos_electron_beta_main.cts`: `contextIsolation: true`, `nodeIntegration: false`, `sandbox: true`, unchanged from before this Arc. |
| No generic execute IPC / no unrestricted filesystem IPC | **VERIFIED** | Every `fedos-app:*` channel is individually named (34 distinct channels enumerated); no `fedos-app:execute`/`:invoke` exists; the two Archive path channels (`archive-choose-export-destination`/`archive-choose-source`) invoke a native `dialog.showSaveDialog`/`showOpenDialog`, never accept an arbitrary caller-supplied path for read/write. |
| No raw Runtime/secret reaches Renderer | **VERIFIED** | Every `fedos-app:*` handler returns only already-safe Shell/Boundary result shapes (no `SecretHandle`, Master Seed, or raw signature field appears in any handler's return type). |
| Live conversation updates work | **VERIFIED (real, not simulated)** | `secure_runtime_alpha_8041_8120_real_user_facing_vertical_slice.test.ts` drives a REAL two-process relay exchange through the real DOM and asserts Bob's reply appears in Alice's chat view without a manual reload — passes. |
| Inviter and invitee conversation discovery both work | **VERIFIED** | Same vertical-slice test asserts BOTH `aliceConversationsText` (inviter) and `bobConversationsText` (invitee) show the new conversation — passes, and is exactly the fix for the 2 real bugs 7337759's own completion declaration discloses. |
| Same-peer conversation isolation remains correct | **VERIFIED (pre-existing, unmodified)** | `test/secure_runtime_alpha_7241_7320_multi_conversation_isolation.test.ts` (untouched by 7337759) still passes unmodified in this integration worktree. |
| DOM-driven acceptance harness is authentic (real controls, not an internal-handler shortcut) | **VERIFIED** | `AUTOTEST_MODE === "ui-script"` branch in `fedos_electron_beta_main.cts` uses `window.webContents.executeJavaScript()` to call `document.querySelector(selector).click()`/`.value = ...`/`.dispatchEvent(new Event("input"))` against the REAL loaded page — structurally distinct from the pre-existing `AUTOTEST_MODE === "acceptance"` branch (which does call named internal handler functions directly, kept ONLY as lower-level regression coverage, never cited as the headline UI proof). |
| Full electron-spike test suite passes | **VERIFIED, this session, in a fresh worktree** | 15 files, 178 tests: 174 passed, 4 skipped (pre-existing artifact-dependent skips), 0 genuinely failed. One file (`secure_runtime_alpha_4341_4420_badge_electron_acceptance.test.ts`) hit a 25s timeout under full-suite resource contention; re-run in isolation passed cleanly (9.2s) — confirmed flake, not a regression. |

## Verdict

No claim in 7337759's own completion declaration was found to be FALSE or
NOT VERIFIED. All are VERIFIED or VERIFIED-with-a-cosmetic-note. No block
on integration from this phase.
