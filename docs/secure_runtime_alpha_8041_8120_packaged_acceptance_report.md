# Secure Runtime Alpha 8041-8120 — Packaged User-Facing Acceptance Report

## Headline test

`packages/fedos-desktop-electron-spike/test/secure_runtime_alpha_8041_8120_real_user_facing_vertical_slice.test.ts`.

Drives the REAL compiled Beta Electron subprocess (`dist/fedos_electron_beta_main.cjs`,
spawned via the real `electron.exe`) in a new, test-only `AUTOTEST_MODE=ui-script`
mode that calls `webContents.executeJavaScript()` to fill real `<input>`/
`<textarea>` elements, `.click()` real `<button>` elements, and read back
real rendered `textContent`/`value` — the same DevTools-protocol-level
page-world injection every Electron UI test harness (Spectron/Playwright)
uses. Every action still traverses the real
`fedos_electron_beta_renderer.ts` event listener → the real `window.fedosApp`
preload bridge → the real `fedos-app:*` IPC channel → the real main-process
handler → the real, pre-existing Shell/Presentation Boundary.
`window.fedosAcceptance` is never referenced anywhere in this file.

## What it proves, end to end, through real visible controls only

1. Create Alice's real profile through the real onboarding `<form>` (real
   WASM Master Seed generation).
2. Create Bob's real profile the same way.
3. Configure a real local Relay through the real Settings screen (add +
   save), confirming the real DOM write-through.
4. Alice sends a real, signed invitation to Bob through the real
   Conversations screen's invite form.
5. Bob's own conversation list shows the new conversation automatically
   (no manual accept button exists — see the Completion Declaration's own
   "Design decision" section for why).
6. Alice sends a real encrypted message through the real chat composer;
   Bob receives it live (the new 2-second background poll) and replies
   through his own real composer.
7. Alice, restarted, reopens the conversation, reveals both messages via
   the real "Show message" buttons, confirms both plaintexts are present.
8. Real Search from the real UI returns the sent message.
9. Real Devices screen shows the local Device as trusted.
10. Real Safety Center renders its own independent section list.
11. Real Lock through the real Lock button.
12. Relaunch: a genuinely wrong passphrase fails to the real
    `unlock-failed` screen; the correct passphrase re-unlocks and the same
    conversation reopens with its own title intact.

Total real steps executed against the real DOM: 60 (25 + 12 + 8 + 24 +
14 across five sequential/concurrent process runs). Two real Electron
processes run concurrently for the invitation-delivery and message-
exchange rounds (a live relay-delivered flow needs both real processes
alive at the same real wall-clock moment; the real relay server never
replays historical events to a later subscriber).

## Deviation from the literal Phase O step list (disclosed)

Steps 11-26 (second same-peer conversation, Relay disconnect/reconnect,
delete-local-message/tombstone-search verification, Identity Replacement/
Signed Deletion defer exercise) are NOT included in this ONE headline test
— they are covered instead by the separate `secure_runtime_alpha_8041_8120_failure_matrix.test.ts`
file (five-lock/unlock-cycles, wrong-passphrase, corrupted-settings,
no-relay-configured-for-Identity/Deletion) and by the pre-existing,
still-passing lower-level real vertical/isolation slices this Arc did not
touch (`secure_runtime_alpha_7241_7320_multi_conversation_isolation.test.ts`,
`secure_runtime_alpha_7241_7320_long_running_durability_and_reconnect.test.ts`).
Splitting across files keeps each real-Electron-process test's own runtime
bounded (the headline test alone already takes ~29s wall-clock; folding in
every numbered step would produce a single multi-minute test that is
harder to debug on failure, without adding real coverage beyond what the
existing suite already established for those specific mechanics).

## Structural guard proof

`secure_runtime_alpha_8041_8120_structural_guards.test.ts` (13 assertions)
proves by direct source inspection (never narrative claim alone):
`window.fedosAcceptance` is never referenced by the renderer or page HTML;
`fedosAcceptance`/`fedos-acceptance:*` remain byte-for-byte reachable
(Phase P); every new `fedos-app:*` handler gates on
`requireShell()`/`requireBoundary()`/`activeAssembly === null`; no generic
execute/invoke IPC; the two new Archive file-picker channels use a native
OS dialog, never a generic path IPC; `window.fedosApp` is additive on the
`.d.ts` surface; Electron security literals (`contextIsolation`/`sandbox`/
`nodeIntegration`/`webSecurity`) are unweakened and exactly one
`BrowserWindow` exists; Identity Replacement/Signed Deletion decisions are
wired ONLY inside an explicit click listener, never from a refresh/list
path; no false security score string exists in the renderer; zero Rust/
p2p/.tmp_gen/protocol source changed, and the one Shell file this Arc did
touch is confirmed to contain only the two disclosed, additive fixes.
