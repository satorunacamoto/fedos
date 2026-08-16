# Acceptance Matrix

**Status**: Written against commit `cb7f0b9d`, before the full authoritative gate run.

## Direct Ratchet completion bar

See `02_DIRECT_RATCHET_CURRENT_TRUTH.md`'s own detailed table. Summary: identity-space
mismatch RESOLVED, activation race RESOLVED, live-state durability gap OPEN (disclosed, not
this mandate's scope) → **Direct Ratchet: PARTIAL**.

## Release readiness (from `05_RELEASE_READINESS.md`, re-verified after this mandate's fixes)

| Item | Status |
|---|---|
| First-run/profile creation | CLEAN (confirmed by prior audit) |
| Unlock/recovery | CLEAN |
| Security UI 6-axis evaluator | CLEAN structurally; see the new Forward-Secrecy-after-restart risk in `02_DIRECT_RATCHET_CURRENT_TRUTH.md` (not part of the evaluator itself, part of what feeds it) |
| Device Trust / TOFU | CLEAN |
| Commerce E2E | CLEAN (test present, covers full happy path; not re-run this mandate — unaffected by any change made) |
| Release pipeline gates | CLEAN, both P1s (stale `.d.mts`) now fixed |
| Beta gate hardcoded journey check | OPEN P1, disclosed, not fixed this mandate |
| `typecheck:electron` | Clean (was previously masked-broken by the same stale `.d.mts` issue) |

## Tor readiness

| Item | Status |
|---|---|
| Network surface inventoried | YES |
| Existing Tor assets found | Stale, unmerged, layout-mismatched implementation on `feature/commerce-tor-*` |
| Strict-transport architecture (current branch) | NOT STARTED |
| Local implementation (current branch) | NOT STARTED |
| Public Tor network contact | NOT AUTHORIZED, NOT ATTEMPTED |

Full authoritative gate run (typecheck, targeted tests, test:current, OSS, cargo, package,
etc.) recorded separately once run, per the mandate's own sequencing (CandidateHead freeze
first).
