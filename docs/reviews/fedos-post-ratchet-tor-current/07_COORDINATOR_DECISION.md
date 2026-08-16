# Coordinator Decision — Post-Direct-Ratchet-Closure Branch Selection

**Status**: Frozen. Written against commit `cb7f0b9d`.

## Inputs

- `02_DIRECT_RATCHET_CURRENT_TRUTH.md`: Direct Ratchet = **PARTIAL**. The original mandate
  blocker (cross-account identity-space mismatch) is resolved. A second real bug
  (conversation-activation startup race) was found and resolved during live proof. Direct
  Ratchet remains PARTIAL solely because of a pre-existing, disclosed, deep gap
  (`FedosDirectRatchetLiveStateSnapshotPersistence` has no durable backend) that blocks full
  restart-survival of bidirectional messaging, plus a newly-confirmed real Security-UI
  truthfulness risk downstream of that same gap (Forward Secrecy can read `"good"` for a
  session that cannot actually send after a restart).
- `05_RELEASE_READINESS.md`: 0 P0, 3 P1 at the time of that audit (two of the three P1s were
  fixed in this mandate's own work: the stale `.d.mts` declarations; the third, the hardcoded
  `beta-acceptance-journey-passed` gate, remains open and disclosed).
- `03_NETWORK_SURFACE_INVENTORY.md` / `04_TOR_EXISTING_ASSET_AUDIT.md`: one concentrated
  network exit exists in the current product; no live Tor code exists on this branch; a
  substantial but stale, layout-mismatched Tor implementation exists on an unmerged branch
  family.
- `06_SECURITY_RED_TEAM.md`: 13 fail-closed invariants for any future Tor integration; no
  fail-open exists anywhere today (nothing to bypass yet); adapting the stale branch looks
  safer than building fresh on security grounds specifically, though DNS-safe WebSocket
  tunneling is unbuilt on both.

## Decision

**BRANCH A: Direct Ratchet is still not COMPLETE.**

Per the mandate's own rule: Tor implementation MUST NOT start. This decision is followed.

Note the mandate's Branch A wording is "close Direct Ratchet first" — this mandate's own work
*did* close the specific blocker Direct Ratchet was originally reported PARTIAL for (the
identity-space mismatch) and found+closed a second real bug besides. What remains open (live
ratchet state durability) is not a continuation of the same problem — it is a distinct,
deeper, pre-existing architectural gap that predates this mandate and predates the identity-
space work entirely. Attempting to close it under this same mandate would mean either (a)
rushing a real cryptographic persistence-security design under time pressure — exactly the
class of decision this mandate's own stop conditions caution against — or (b) silently
expanding scope well past what was authorized. Neither is acceptable. It is disclosed here,
precisely, as the next arc's own clear starting point.

## What was still done under Branch A (explicitly permitted: read-only Tor investigation,
independent P0/P1 closure with bounded/unambiguous scope)

- Full Phase A read-only audit (network surface, Tor assets, release readiness, security red
  team) — completed, all four documents written.
- Two release-readiness P1s closed (stale `.d.mts` declarations blocking `typecheck:electron`)
  — bounded, unambiguous, zero overlap with Direct Ratchet/Tor architecture.
- The conversation-activation race fix — found during live Direct Ratchet proof, unambiguous
  root cause, bounded fix, zero architecture ambiguity.

## What was explicitly NOT done, per Branch A and this mandate's own stop conditions

- No Tor code written, no Tor process ever started, no public network contact.
- No fix attempted for the live-ratchet-state-durability gap (a real crypto-persistence
  security design decision, correctly out of scope for autonomous same-arc closure).
- No fix attempted for the newly-confirmed Forward-Secrecy-after-restart truthfulness risk,
  since a correct fix requires first resolving the durability gap it sits downstream of (or a
  separate, carefully-scoped truthfulness-only patch to `getDirectRatchetStatus()` that this
  mandate did not have the remaining bounded scope to design and verify live).

## Recommended next-arc scope (not started here)

1. Design and implement real durable/sealed persistence for
   `FedosDirectRatchetLiveStateSnapshotPersistence`, mirroring the security rigor already
   applied to the "skipped-message-key" sealed persistence type.
2. As a possibly-separable, smaller first step: make `getDirectRatchetStatus()` honest about
   the case where metadata says `"active"` but the live session cannot actually be restored —
   even before full durability exists, the STATUS should never overclaim.
3. Only after Direct Ratchet is genuinely COMPLETE (including full restart-survival): revisit
   Tor readiness per Branch B/C, informed by the four Phase A documents already produced here.
