# Secure Runtime Alpha 8441-8520 — Phase I: Remaining Technical Defects Verification

Per this Arc's own mission ("Fix only current, source-verified release
defects... Do not re-fix already-closed defects"), each item the
mission explicitly names was re-verified directly against current
merged source (after reconciling `cc510fcb`/`bc8482d2` in Phase A) —
all found already fixed, no new source change required for this list.

| Item | Verified location | Status |
|---|---|---|
| Language save response | `fedos_electron_beta_renderer.ts`'s `onSettingsSave()` — `languageNote` appended when `candidate.language !== "en"` | **Fixed** (via `bc8482d2`, reconciled Phase A) |
| Relay reconnect wording | `fedos_electron_beta_renderer.ts:259` — `"...lock and unlock again to retry"` | **Already correct** (Alpha 8121-8200) |
| Recovery warnings | `fedos_electron_beta_page.html:111` — backup-importance warning | **Fixed** (via `bc8482d2`) |
| Archive warnings | `fedos_electron_beta_page.html:195` — pre-export session warning | **Already correct** (Alpha 7481-7560; independently re-confirmed by `bc8482d2` itself, which found it already implemented and did not duplicate it) |
| First-run Security Notice | `fedos_electron_beta_page.html:73` — `#welcome-security-notice` | **Fixed** (via `bc8482d2`) |
| Relay metadata notice | `fedos_electron_beta_page.html:289` — Relay-add metadata visibility notice | **Fixed** (via `bc8482d2`) |
| Feedback placeholder behavior | `fedos_electron_beta_page.html:319` — in-app Feedback section pointing to `SECURITY.md`; `docs/desktop_beta_feedback_guide.md` exists with the same placeholder convention | **Fixed** (via `bc8482d2` + this Arc's own prior lineage) |
| Package descriptions | Both `package.json` files' own `"description"` fields | **Fixed** (via `cc510fcb`, reconciled Phase A) |
| README claims | Product identity, code-signing overclaim (already fixed by a prior Arc), obsolete prototype content (moved this Arc, Phase B) | **Fixed** (this Arc's own prior lineage + Phase B) |
| Stale build paths | `BUILDING.md` rewritten this Arc (Phase C) with exact current toolchain versions and a verified-working reproduction | **Fixed** (Phase C) |
| Stale audit references | External audit bundle (`4158243f`) revalidation | **See Phase F's own dedicated report** — handled separately given its scope (20 files) |

## Conclusion

No new source defect was found requiring a fix beyond what Phases A
(merging `cc510fcb`/`bc8482d2`), B (README split), and C (BUILDING.md)
already closed. This is a verification pass, not a no-op — each item
was re-checked against real, current, merged source rather than assumed
fixed because a prior commit's own message claimed it.
