# Lineage Reconciliation — Own-Device Sync Final Closure + Red-Team Reconciliation

## Discovery

While reconciling the Disaster Recovery worktree against "the latest validated product
lineage" per the current mandate's own instruction, discovered that my own arc's
EvidenceHead (`814e7c69`, Own-Device Sync Protocol Final Closure) was **not** the latest
validated head. A separate, independent session had run a "Red-Team Reconciliation + True-P0
Closure" arc, branching from the SAME shared ancestor (`f57812a0`) at a point before my own
arc's final continuation, and reached its own independent EvidenceHead: `14d9041a`.

Both lineages are real, validated, gate-passed work descending from `f57812a0` that never got
merged together:

- **Mine** (`f57812a0` → `814e7c69`): Own-Device Sync Journal Transport — real cross-process
  sync, live-wired, real installed two-device proof.
- **Theirs** (`f57812a0` → `14d9041a`): P0/P1 reconciliation against a corrected authoritative
  lineage (their own audit found `origin/main` was stale by several hundred commits — matches
  this session's own prior "FedOS Forgotten Work Audit v1" finding). Confirmed and fixed a
  real P0: the message-delivery-truth fix from an earlier arc this session (`50ffce50`)
  correctly plumbed the real delivery outcome to the IPC boundary, but the renderer's
  `onChatSend()` never read it — a rejected/undelivered send could still show "Sent." to the
  user. Also downgraded a stale P0 (old-key identity-transition auto-accept) to P1 after
  finding the actual state-changing Ratchet Reset action is already gated behind two explicit
  human confirmations, and reconfirmed a third stale P0 (corrupt-profile dead-end) as already
  fixed by an earlier arc.

## Merge

`git diff --name-only` overlap check: 2 files touched by both lineages
(`fedos_electron_beta_main.cts`, `fedos_desktop_runtime.ts`) — both composition-root files,
so not treated as safe-to-auto-trust without verification. `git merge --no-ff 14d9041a`
produced **zero conflict markers** (`b9ecf58d`).

Verified this was a semantically sound merge, not just textually non-conflicting:
- `npm run typecheck` (core + electron): clean, same 2 pre-existing baseline errors only.
- `npm run test:current`: 193 files / 2827 tests passed, 3 skipped.
- Directly confirmed both critical fixes coexist correctly in the merged
  `fedos_electron_beta_main.cts`/`fedos_electron_beta_renderer.ts`: my own
  `wrapAttemptFn(journalAttemptFn)` live-wiring (line 5152) AND their `onChatSend()` reading
  `value?.delivery` (line 1509) are both present and intact.
- `secure_runtime_alpha_8041_8120_structural_guards.test.ts` shows 3 failures (tests 3, 4, 11)
  on the merged commit — **confirmed pre-existing, not a merge regression**, via direct
  baseline comparison: the identical 3 failures reproduce at the red-team lineage's own pure
  tip (`14d9041a`) in its own clean worktree, before any merge. Not investigated further as
  part of this reconciliation (belongs to the other session's own lineage, not introduced
  here) — noted here for the record rather than silently ignored.

## INTEGRATED CandidateHead

`b9ecf58d` — this is now the authoritative starting point for the Disaster Recovery
reconciliation this mandate actually asked for.
