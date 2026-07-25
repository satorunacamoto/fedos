# Secure Runtime Alpha 8121-8200 — Phase F/G: Recovery and Accessibility Gates

## Phase F — Recovery release gate

Re-verified this session directly against `RECOVERY_EXPLANATIONS` in
`fedos_electron_beta_renderer.ts` and the Coordinator's own real,
producible outcome codes.

| Condition | Distinguishable? | Real action available |
|---|---|---|
| Wrong passphrase | YES — routes to `screen-unlock-failed`, distinct from Recovery | Retry (returns to unlock) |
| Corrupted profile descriptor / sealed material | YES — `recovery-required`/`corrupt` diagnostic code shown verbatim | Retry unlock, Copy diagnostic code, Quit |
| Missing WASM artifact | YES — `seed-unavailable` diagnostic code | Retry unlock (will keep failing honestly until the artifact exists — never fabricated as fixable in-app), Copy diagnostic code, Quit |
| Unsupported profile schema | YES — `unsupported-version` diagnostic code | Retry unlock, Copy diagnostic code, Quit |
| Invalid settings | YES — settings-load/apply failures surface through the Settings screen's own error region, not Recovery (a corrupted settings.json blocks profile create/unlock entirely instead — confirmed in `secure_runtime_alpha_8041_8120_failure_matrix.test.ts` #10) | N/A — distinct failure path, not a Recovery-screen condition |
| Unreachable Relay | YES — does not route to Recovery at all (Alpha 7961-8040's own fix; one relay failing never blocks startup) | N/A by design |
| Archive recovery path | PARTIAL — Recovery screen itself has no "restore from Archive" button; the Archive screen exists and is reachable once ANY profile is unlocked, but Recovery is reached only when NO profile could be unlocked, so Archive restore cannot help recover THAT SAME profile from Recovery. This is an honest limitation, not a missing button to add — Archive restore is documented in the user guide as the real recovery path (create a fresh profile, then restore), not fabricated as a button inside the Recovery screen. |
| Restart-required setting | YES — Settings screen's own explicit copy after Save | N/A — not a Recovery-screen condition |

**No invented recovery codes, seed phrases, remote support account, or
automatic profile repair exist anywhere in the source.** Verdict: **PASS
for a closed pilot** — every real, distinguishable condition has at least
one real, honest action; the one gap (Archive-restore-from-Recovery) is a
genuine architectural boundary (you cannot restore an Archive for a
profile that itself cannot be identified/unlocked), not a missing feature,
and is correctly documented rather than papered over with a fake button.

## Phase G — Accessibility release gate

Re-verified directly against `fedos_electron_beta_page.html`/`_renderer.ts`
this session (superseding, not duplicating, 7337759's own accessibility
report):

| Item | Status |
|---|---|
| Enter submits forms | PASS |
| Escape closes safe dialogs | PASS — the two destructive confirmations (Device revoke, Identity Replacement accept) use native `window.confirm()`, natively Escape-closable |
| Keyboard-only primary navigation | PASS — every control is a native `<button>`/`<input>`/`<textarea>`/`<select>`, no custom widget |
| Visible focus | PASS — `:focus-visible` outline on every interactive element |
| Logical focus order | PASS — DOM order matches visual order; no `tabindex` overrides anywhere in the new markup |
| Associated labels | PASS |
| Passphrase autocomplete | PASS — `new-password`/`current-password` |
| `role=alert`/`aria-live` | PASS |
| Loading state announcements | PASS — `screen-initializing` |
| Non-color-only status | PASS — glyph-prefixed badges |
| Destructive-action confirmation | PASS |
| Copy-action feedback | PASS |
| Long identity / Japanese text handling | PASS — `word-break: break-all`, `box-sizing: border-box` |
| 200% zoom / basic layout resilience | **NOT INDEPENDENTLY VERIFIED this pass** — the layout uses relative units and no fixed pixel-width containers wider than the viewport, which is favorable, but no explicit 200%-zoom manual pass was performed in this session (disclosed gap). |

**Classification of remaining findings**:
- **POLISH**: the unused `#recovery-actions` empty `<div>` in the HTML (dead markup, Phase B's own note).
- **POLISH**: no independent 200%-zoom verification pass yet.
- **MEDIUM**: no automated screen-reader (NVDA/JAWS/VoiceOver) run has been performed (carried over from 7337759's own disclosed gap).
- **No BETA BLOCKER or HIGH finding identified.**

Verdict: **PASS for a closed pilot**, with the MEDIUM item (no AT
verification) explicitly disclosed in the pilot-candidate documentation
(Phase L) rather than silently omitted, and formal WCAG compliance is
never claimed anywhere in this repository's own documentation.
