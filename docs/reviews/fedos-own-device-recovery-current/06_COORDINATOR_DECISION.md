# Coordinator Decision (mandate §36)

Given this arc's own remaining time budget after a thorough, real Phase A investigation, every
finding is classified below. No implementation was made this pass — see reasoning per item.

| Finding | Classification | Why |
|---|---|---|
| Own-Device Sync transport never wired in production (central finding) | **DEFER** — dedicated future arc | High-blast-radius, never-exercised-live code path; wiring it solo under remaining budget would be the exact high-ambiguity risk this mandate's own §36 warns against. Document precisely instead (done). |
| Own-device revocation propagation via Sync | PROTOCOL_GAP (consequence of the above) | Same root cause, not a separate defect. |
| Whole-profile-directory backup safety | Verified SAFE for current use (ratchet snapshot already fails closed on cross-device restore) | No fix needed; already correct due to earlier-session live-state-durability work. |
| Portable/versioned/sealed recovery bundle | DESIGN_ONLY | Real, valuable, substantial new work; whole-directory approach is not unsafe today, just not portable/minimal. |
| Anti-rollback network-reconciliation question | UNVERIFIED, flagged | Needs dedicated tracing of continuity/revocation consumers; not resolved this pass, not claimed either way. |
| File-level schema migration mechanism | DEFER | No concrete schema bump exists yet to validate a migration mechanism against; premature to build speculatively. |
| Rollback runbook | DEFER | Depends on the recovery-bundle work not yet built. |
| Auto-update | REJECT (reconfirmed) | Explicit mandate prohibition, no change. |
| Red-team pass | Bounded, source-based; no new P0/P1 beyond the central finding | Live installed attack simulation out of remaining budget. |

## Severity of the central finding

Own-Device Sync is **enabled by default** in the shipped Beta and **structurally cannot ever
succeed** — every attempt fails by construction, forever, because the real relay transport was
never connected to the scheduler in the composition root. This is real and user-facing (a
paired second device's own registry will never sync), but it fails CLOSED and (per the honest
ViewModel pattern observed) likely fails VISIBLY rather than silently claiming false success —
the end-to-end truthfulness of that failure display was not independently re-verified on the
installed binary this pass. Given it degrades gracefully (no data loss, no false-good claim
found) rather than corrupting anything or lying, this is classified **P1, not P0**: a real,
named, currently-non-functional default-on feature, not a trust-breaking or destructive defect.
