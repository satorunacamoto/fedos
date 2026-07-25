# Secure Runtime Alpha 8121-8200 — Phase C: Review Commit Reconciliation

Reconciles `9c238a11`, `dbc1386`, `8e730f25`, `d760c95` (all read-only,
pre-UI, at base `97f26f0f`) against `7337759`. Historical reviews are
**not deleted or rewritten** — this document is a supersession/status
overlay, added alongside them.

## UX findings (`9c238a11` Desktop Beta UX Acceptance Review)

| Finding | Classification |
|---|---|
| Only four screens existed (welcome/create/unlock/ready) | **CLOSED BY 7337759** — 7 additional `.app-screen` panels now exist and are reachable. |
| Messaging UI absent | **CLOSED BY 7337759** — real chat view, composer, on-demand reveal, live poll. |
| Relay Settings absent | **CLOSED BY 7337759** — real Settings screen over the existing `FedosDesktopSettingsController`. |
| Recovery dead end (only "Quit") | **CLOSED BY 7337759** — Retry unlock + Copy diagnostic code added; see Phase F/G of this Arc for a fresh gate re-check. |
| Acceptance IPC (`fedosAcceptance`) mistaken by an end user for real UI reachability | **CLOSED BY 7337759** — `fedosAcceptance` remains, unreferenced by ordinary UI; a real, separate `fedosApp` bridge now exists instead. |
| Missing keyboard behavior (Enter submit, focus order, visible focus) | **PARTIALLY CLOSED** — Enter-submit and focus-visible CSS added for new screens; no dedicated automated keyboard-only regression suite exists yet (this Arc's own Phase G re-verifies and may close further). |
| Missing `aria-live`/error semantics | **CLOSED BY 7337759** — `role="alert"`/`aria-live="polite"` added throughout the new screens. |
| Passphrase autocomplete behavior (`autocomplete="off"` flagged as harmful) | **CLOSED BY 7337759** — changed to `"new-password"`/`"current-password"`. |

## Documentation/security-claims findings (`dbc1386` + `d760c95`)

| Finding | Classification |
|---|---|
| "real code-signing" overclaim | **CLOSED BY 7337759**, with one correction: `d760c95` cited this as living in the "Alpha 6601-6680 historical entry" at README:771 — re-verified this session and that attribution does not match current source (the Alpha 6601-6680 entry is about Secure Memory/Nostr-event signing keys, an unrelated topic; it contains no code-signing claim). The actual, real occurrence (in what is in fact the Alpha 7961-8040-adjacent release-pipeline entry) is the one 7337759 corrected. `grep -n -i "code.sign"` against the current README confirms zero remaining overclaim phrases. |
| Installer unsigned status not stated | **CLOSED BY 7337759** — `SECURITY.md` states artifacts are unsigned unless independently proven otherwise. |
| WASM build precondition unexplained | **CLOSED BY 7337759** — `docs/desktop_beta_user_guide_installation.md`. |
| Packaged feature reachability wording (claims of "real IPC surface" reachability read by an end user as UI reachability) | **CLOSED BY 7337759** for the CURRENT top status (the new entry states screens exist); the OLDER Alpha 7961-8040/7321-7400 entries further down the README retain their own original, now-historical wording, which remains accurate for what THAT Arc itself shipped at the time. No further edit needed — the newest-first convention itself supplies the correction via the new top entry. |
| No external audit disclosure | **CLOSED BY 7337759** — `SECURITY.md`. |
| Early prototype docs claim no real cryptography | **PARTIALLY CLOSED** — `docs/desktop_beta_known_limitations.md` item 13 adds an explicit pointer labeling any "Stage 1-133" document historical/superseded; the underlying ~100+ individual legacy doc files themselves were not each individually banner-labeled (disclosed scope limitation in 7337759's own commit, reasonable given it is a documentation-hygiene item explicitly marked lower-severity by `dbc1386` itself). |
| Missing `SECURITY.md` | **CLOSED BY 7337759**. |
| Missing user guides | **CLOSED BY 7337759** — 6 guides added (installation, first-run, Relay setup, invitation/chat, Archive/deletion, recovery/troubleshooting). |
| Deletion/Archive limitations underclaimed | **CLOSED BY 7337759** — known-limitations items 6-9, plus the Archive/deletion guide's own explicit warnings. |
| Search plaintext-token limitation | **CLOSED BY 7337759** — stated in-app (Search screen copy) and in the known-limitations doc. |
| Page-locking/RAM-erasure non-guarantees | **CLOSED BY 7337759** — Safety Center screen renders the real, existing section states (never a false green), and `SECURITY.md` states secure-memory zeroization is best-effort/unavailable depending on build. |
| `fedos_desktop_beta_limitations.ts` (the in-app closed vocabulary) omits "no messaging UI"/"recovery has no in-app path" (`d760c95` finding #2) | **NEEDS RE-TEST** — this specific TypeScript file was not touched by 7337759 (confirmed: `git diff 97f26f0f..7337759 --name-only -- src/desktop/beta/fedos_desktop_beta_limitations.ts` is empty). Its own listed items are now STALE in the opposite direction — it still lists limitations that no longer fully apply (messaging/invitation/Settings ARE now reachable) without yet reflecting the NEW, real limitations this Arc's own known-limitations doc discloses (bounded 2-second poll latency, non-openable Identity Replacement items, etc.). Flagged for a narrow doc-only update in Phase I of this Arc — not a source/protocol change. |

## External audit prep (`8e730f25`)

| Finding | Classification |
|---|---|
| "12 `fedos-acceptance:*` channels, all real, zero UI consumer" — largest attack surface, untested against adversarial input by any real user interaction pattern | **PARTIALLY CLOSED, NEW SURFACE ADDED** — `fedosAcceptance`/`fedos-acceptance:*` themselves remain exactly as found (still zero UI consumer, by design — Phase P of this Arc reconfirms this is intentional, not a regression). However, several of THEIR OWN underlying handler functions (e.g. `handleAcceptanceCreateConversationInvitation`, `handleAcceptanceSearch`, `handleAcceptanceArchive`, `handleAcceptanceSafetyCenterOverview`, the four Device Pairing handlers) are now ALSO reachable through a second, real, UI-consumed channel set (`fedos-app:*`, 34 channels). This is a **new attack surface this specific review has not yet assessed** — addressed via a new delta document (Phase J of this Arc), not a rewrite of `8e730f25` itself. |
| SecretHandle exposure-accessor count (27, corrected from a prior "10") | **HISTORICAL PRE-UI BASELINE** — unaffected by 7337759 (no `SecretHandle`-adjacent file touched). |
| Search index plaintext, in-memory-only | **HISTORICAL PRE-UI BASELINE, still accurate** — 7337759 added a Search SCREEN over the same unmodified index; the underlying property is unchanged. |
| `cargo test --release`: 639 passed / 1 pre-existing failure | **HISTORICAL PRE-UI BASELINE, reproduced again this session** identically (see Phase B). |

## Summary

No finding from any of the four reviews was found INCORRECT when
re-verified against current source (one citation, `d760c95`'s own
line/Arc attribution for the code-signing overclaim, was imprecise and is
corrected above). The two open items carried forward into this Arc's own
later phases are: (1) `fedos_desktop_beta_limitations.ts`'s own stale
closed vocabulary (Phase I), and (2) an audit-prep delta document for the
new `fedos-app:*` surface (Phase J).
