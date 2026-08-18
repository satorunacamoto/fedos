# Interactive Install / SmartScreen Human Checklist — FedOS Desktop Beta 0.1.0-beta.1

**This is genuinely different from the prior silent-install proof.** The Final RC Seal arc already
proved, with real evidence, that `FedOS-Desktop-Beta-Setup-0.1.0-beta.1.exe /S /D=<isolated dir>`
installs, launches, creates a real profile, and uninstalls cleanly — but a silent (`/S`) install
never displays the Windows SmartScreen dialog, because `/S` suppresses all UI. **No dialog was
observed then, and none is fabricated here.** This checklist is for an actual human, watching an
actual screen.

No Windows security setting is changed by this checklist. SmartScreen, Defender, and UAC all stay
on throughout.

## Exact procedure

1. **Confirm the installer hash before you launch it.**
   ```powershell
   Get-FileHash "C:\wt\fedos-installed-startup-root-cause\packages\fedos-desktop-electron-spike\release\FedOS-Desktop-Beta-Setup-0.1.0-beta.1.exe" -Algorithm SHA256
   ```
   Expected: `A1C32889173A0AE9105724D8B708ABAA9456F15A054085A20C29CCDE3DE6DEE0` (case-insensitive match).
   This exact value was independently reconfirmed twice already in this review pass.

2. **Launch the installer by double-clicking it** (not `/S`, not from a script) — this is what a
   real user does.

3. **Record whether SmartScreen appears.** Expected: a "Windows protected your PC" dialog, since
   this build is unsigned.

4. **Record the exact visible publisher/signature wording** shown in that dialog (e.g. "Unknown
   publisher" or similar — copy the literal text shown).

5. **Confirm the expected application/version name is what's displayed** — should reference
   "FedOS Desktop Beta" and version `0.1.0-beta.1` somewhere in the installer UI.

6. **Proceed only if the artifact identity from step 1 still holds** — i.e. don't proceed on a
   different file than the one you hashed.

7. **Complete the install** using the on-screen defaults (per-user install, no elevation should be
   requested — `perMachine: false` in the build config).

8. **Launch the installed FedOS** from the Start Menu entry it created.

9. **Confirm the main window appears** (not just a process in Task Manager with no visible UI).

10. **Confirm the Beta/version presentation is understandable** — a normal user should be able to
    tell this is Beta software and roughly which version, without digging through menus.

11. **Exit cleanly** (close the app normally; no forced kill).

12. **Uninstall** via "Add or remove programs" if this is a disposable test environment. Confirm
    your profile data survives (expected — `deleteAppDataOnUninstall: false`) or is removed if you
    intentionally deleted it — whichever you expect, confirm it actually happened.

## Classification of each step

| # | Step | Classification |
|---|---|---|
| 1 | Confirm hash | **NOT_OBSERVABLE_AUTOMATICALLY as a "before-launch human action"** — the value itself is independently verified (MATCH) by this review; the act of a human re-checking it immediately before launch is inherently a human action |
| 2 | Launch interactively | **HUMAN_ACTION_REQUIRED** |
| 3 | SmartScreen appears | **HUMAN_ACTION_REQUIRED** — expected to show, not previously observed (silent install suppresses it) |
| 4 | Exact publisher wording | **HUMAN_ACTION_REQUIRED** |
| 5 | App/version name displayed | **HUMAN_ACTION_REQUIRED** |
| 6 | Proceed only if identity holds | **HUMAN_ACTION_REQUIRED** |
| 7 | Complete install | **HUMAN_ACTION_REQUIRED** (real automated evidence exists for the *silent* equivalent — exit code 0, real binary installed — but the GUI click-through itself is unobserved) |
| 8 | Launch installed FedOS | **HUMAN_ACTION_REQUIRED** for the GUI launch specifically; the underlying binary launching correctly is separately proven (real WASM Master Seed created via the same exe, silently) |
| 9 | Main window appears | **HUMAN_ACTION_REQUIRED** — no automated tool in this review can observe actual on-screen window rendering |
| 10 | Beta/version presentation understandable | **HUMAN_ACTION_REQUIRED** — a judgment call about clarity, not a fact an automated check can make |
| 11 | Clean exit | **HUMAN_ACTION_REQUIRED** for the GUI path; real exit code 0 + OS-level process-gone confirmation exists for the silent-launch equivalent |
| 12 | Uninstall | **HUMAN_ACTION_REQUIRED** for the GUI path; real silent uninstall (exit code 0, profile preserved) already proven |

**No step is marked PASS or FAIL by this review** — doing so would mean fabricating an observation
of a GUI dialog no automated tool in this session watched. Every step here requires an actual human
to look at an actual screen. Screenshots are welcome if you do this, but must not show any real
passphrase, Master Seed, private key, or message content — a blank first-run/profile-create screen
or the SmartScreen dialog itself is safe to capture.

**STOP condition acknowledged:** per the mandate, this document is exactly the "exact minimal
instructions" handoff to a human — this review does not, and cannot, complete steps 2-12 itself.
