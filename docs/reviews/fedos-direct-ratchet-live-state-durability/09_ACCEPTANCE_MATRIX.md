# Acceptance Matrix — Direct Ratchet Live-State Durability

**Status**: Written before implementation, against commit `3b78add1`. Target bar for
`CandidateHead`.

## Unit/integration (from `06_RED_TEAM_MATRIX.md` + this doc's own synthesis)

1. Active session snapshot saved (atomic rewrite, not appended).
2. Restart restore success (real vertical-slice test already exists — confirm it still covers
   the corrected storage shape).
3. Missing snapshot → fail closed, `"no-durable-snapshot"`.
4. Corrupt snapshot → fail closed, `"restore-attempted-and-failed"`.
5. Truncated snapshot → AEAD auth failure, fail closed.
6. Unsupported schema version → reject.
7. Wrong profile/conversation/device/account → reject (confirm existing AEAD context binding
   + lookup-key barrier both hold for the corrected storage shape).
8. **Stale chain-position replay** (Agent R's genuinely-vulnerable finding) — restore an
   old-but-validly-sealed record; must be rejected by the new freshness check even though it
   decrypts successfully.
9. Duplicate/concurrent write → atomic rewrite means last-writer-wins is well-defined, not
   ambiguous; test this explicitly.
10. Identity transition / device change → old snapshot never restorable under new binding.
11. Legacy metadata-only session (today's universal case) → correctly reports
    `"no-durable-snapshot"`, not `"active"`-implying-usable.
12. Crash between `commitCounters()` and crypto checkpoint → fails closed (no key reuse, no
    leak), session lands in a state requiring Reset — test proves safety, not silent success.
13. Successful restore → `getDirectRatchetStatus()` + Axis 3 Forward Secrecy → GOOD only after
    genuine confirmation.
14. Failed/never-attempted restore → Axis 3 Forward Secrecy → never GOOD.

## Live installed two-process proof (mandate §30-38)

Real NSIS-installed Alice + Bob: establish → bidirectional messages → Alice restart →
Alice→Bob and Bob→Alice still work → Bob restart → same → both restart → same. Corruption
negative (tamper a real sealed snapshot, restart, confirm rejection + Reset path still
available). Security UI live proof: Forward Secrecy not GOOD during/after a failed restore,
GOOD only after genuine confirmed restore.
