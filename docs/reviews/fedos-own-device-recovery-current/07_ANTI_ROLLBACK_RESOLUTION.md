# Anti-Rollback Network-Reconciliation — resolved (bounded evidence)

Prior finding (`04_RECOVERY_ASSET_MATRIX.md`) flagged as genuinely unknown: after restoring an
old local backup, does FedOS ever re-reconcile stale local trust/continuity/revocation state
against live network evidence, or trust the restored copy indefinitely?

## Evidence

Repo-wide `grep` for `since`/`sinceSeconds` filters across every Device/peer-device
announcement subscription construction site in `fedos_desktop_runtime.ts` and the
`device`/`peer_device` source trees: **zero matches**. This matches the SAME "deliberately
unbounded, no `since` filter -- durable mailbox semantics preserved" pattern this codebase's
own gift-wrap subscription already used before this session's own earlier `#p`-filter fix (that
fix added a recipient TAG filter, never a time-window filter — time-unboundedness was preserved
deliberately).

## Conclusion (bounded, not exhaustively traced end-to-end)

Because subscriptions to peer/own-device announcement streams are unbounded (no `since`), the
NEXT real launch with live network access re-subscribes and reprocesses the relay's entire
available history for those event kinds — not just events since the last local write. A
restored-from-backup profile that later reconnects to the network will naturally re-observe
any revocation/supersession/identity-transition announcement published after the backup was
taken, **provided**: (a) the relay(s) FedOS reconnects to still retain those historical events
(most relays have SOME retention window, not infinite — an old-enough backup restored long
after a relay's own retention has expired could genuinely miss the reconciling event), and (b)
the consumer code that applies a newly-observed announcement does not itself refuse to
downgrade an already-`"trusted"` local record (not independently re-verified this pass — this
is the one remaining gap in full certainty, though every "apply an inbound signed fact" handler
reviewed elsewhere this session follows a consistent "latest real signed evidence wins" pattern,
not a one-way ratchet).

**Practical implication for the user-facing recovery boundary**: restoring an old backup is not
a permanent security bypass under ordinary conditions (stay-connected-to-the-same-relays), but
IS a real, disclosable limitation for a long-neglected backup restored against relays that have
since rotated their retention window past the gap. Recommend this exact caveat be included in
any future recovery-bundle/rollback-runbook documentation (deferred work, `06_COORDINATOR_DECISION.md`).
