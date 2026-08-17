# Authoritative Lineage Reconstruction

## Old Red Team's product head (STALE)

`origin/main @ 4e2825cb1e08a03509cd6b7c6e708c9b496fcf65`

This was treated as authoritative by the prior read-only Red Team audit. It is **not** the
most advanced validated FedOS lineage — it is a far-less-developed branch point.

## Actual latest validated lineage (discovered this reconciliation pass)

Local branch `arc/fedos-installed-startup-root-cause`, tip:

```
f57812a0  Final EvidenceHead: full gates + Option A/B decision evidence
          against DEVICE-RECOVERY CandidateHead 8712add7
8712add7  fix(device-management): make Own-Device Sync status truthful
da693504  docs: Own-Device Sync + Machine-Loss Recovery Phase A investigation
```

**AUTHORITATIVE STARTING PRODUCT (CandidateHead): `8712add7`**
**AUTHORITATIVE STARTING EVIDENCE (EvidenceHead): `f57812a0`**

Verified:
- `git merge-base --is-ancestor 8712add7 f57812a0` → PASS
- `git merge-base --is-ancestor origin/main f57812a0` → PASS (origin/main is a strict
  ancestor; every commit on origin/main is included in this lineage, plus a very large
  amount of additional work that never reached origin/main)
- `git merge-base a3421092 origin/main` = `4e2825cb` (origin/main's own tip) — confirms
  the divergence point
- No strict descendant of `f57812a0` found across any local branch or remote ref
  (exhaustive `merge-base --is-ancestor` sweep over all `refs/heads` + `refs/remotes`)

## What's on this lineage that isn't on origin/main

Between `4e2825cb` (origin/main tip) and `f57812a0`, several hundred additional commits
landed, including full arcs for: Commerce (Order/Payment/Delivery/Receipt/Reputation,
multiple closure waves), Tor strict-transport (real installed two-process proof, public
Tor validation), Direct Ratchet Live-State Durability, Peer Device Discovery, Verified
Secure Session UI, a "Product Durability Mega-Arc" (recovery-notice + own-device-sync
truth tables), an "Outbox Flush Reliability" arc, and the "Own-Device Sync + Machine-Loss
Recovery" investigation that produced the current tip. None of this reached `origin/main`.
This matches (and updates) the prior-session memory finding "FedOS Forgotten Work Audit
v1" — origin/main and this larger epic diverged and were never reconciled.

## Worktree used for this reconciliation

`C:\wt\fedos-redteam-reconciliation-p0-closure`, branch
`arc/fedos-redteam-reconciliation-p0-closure`, created fresh from `f57812a0` (clean at
creation). The old, dirty checkout (`arc/fedos-conversation-forward-secrecy-default` in
the primary OneDrive worktree) was left untouched throughout, per instruction.
