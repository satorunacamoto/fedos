# Multi-Device and Conflict Resolution Model (Coordinator, mandate §12-14)

## Cardinality

**Many devices per account, explicitly supported** — matches the existing
Device Registry's own structural model (Agent A §5: `listBindingsForAccount`
returns arrays; no one-device assumption anywhere). A peer account may
announce any number of devices over time; each `(senderAccountRef,
deviceId)` pair is independently tracked. **One account per `deviceId`**
remains the one enforced cardinality constraint, inherited unchanged from
the existing Registry conflict rule (Agent A §1.5) — a protocol-level
`deviceId` (§5 of `06_PROTOCOL_CONTRACT_FREEZE.md`) cannot be re-announced
under a different `senderAccountRef` without hitting `"conflicting"`.

## Model: append-only observation, current state derived at read time

**Append-only observation persistence + read-time derivation of "current,"
never a mutable current-state row.** Mirrors `identity_transition`'s
`isFedosIdentityTransitionFactSuperseded()` pattern (Agent X §0.3) exactly:
every accepted announcement is written once, immutably; "is this the current
epoch for this `(senderAccountRef, deviceId)`" is computed at read time as
"no other accepted fact for this same key has a strictly higher `epoch`."
This was chosen over a mutable "current binding" row because:

- It matches this codebase's own converged, twice-independently-built
  precedent (peer_capability observation log AND identity_transition fact
  log both use this shape) rather than introducing a third pattern.
- It preserves full history for audit/debugging without a separate audit
  log.
- It makes "supersession" a pure query, not a write-time decision that could
  race across concurrent inbound deliveries.

The Device Registry write (§7 of `06_PROTOCOL_CONTRACT_FREEZE.md`) IS a
mutable current-state row (`FedosDeviceBindingV1.trustState`) — that is a
SEPARATE, already-existing store this protocol writes INTO once an
announcement is accepted; the append-only observation log is this
protocol's own evidence trail, not a replacement for the Registry.

## Conflict resolution rules (exhaustive)

| Situation | Resolution | Rationale |
|---|---|---|
| First announcement ever for `(senderAccountRef, deviceId)` | `"accepted-new-device"`, Registry write with fresh `"trusted"` binding | No prior state to conflict with |
| Higher `epoch` than any prior accepted fact for the same key | `"accepted-superseding"`, Registry binding's `devicePublicKeyRef` updated ONLY if `devicePublicKeyHex` is unchanged from the prior accepted fact (routine re-announcement, e.g. refreshed capability list) | Legitimate update |
| Higher `epoch`, but `devicePublicKeyHex` DIFFERS from the prior accepted fact for the same `deviceId` | `"conflicting"` — Registry NOT updated; the existing `"trusted"` binding is left untouched | A `deviceId` silently re-keying is indistinguishable from an attacker claiming an old device's slot with a new key; per §7 item 3 of `06`, this must never silently re-trust. A genuinely new physical device must announce under a fresh `deviceId`. |
| `epoch <= priorAccepted.epoch` | `"stale"` | Numeric-only rollback check, arrival-order-independent (mirrors acceptance_policy.ts:85) |
| Exact byte-identical redelivery (same nonce) | `"duplicate"`, idempotent no-op | Checked BEFORE epoch comparison, mirrors inbound_coordinator.ts:134-154 |
| Two different, validly-signed announcements at the SAME starting epoch for the same key (race) | `"conflicting"` for whichever the local process evaluates second | Mirrors fact_conflict_detection.ts:51's "two competing transitions" case; never silently pick a winner |
| Same account, multiple DISTINCT `deviceId`s, all independently `"trusted"` | All coexist; each is an independent Registry binding | Matches the multi-device design goal (Agent A §5) |
| Peer completes Identity Replacement (new account key) | Every existing `"trusted"` binding recorded under the OLD `senderAccountRef` is left as historical fact (never deleted, never silently re-attributed); the NEW account identity starts with ZERO peer-device bindings until fresh announcements arrive under the new identity | Mirrors `"device-replaced"` → `"manual-review-required"` (Agent X §1 row 14); no auto-carry-forward across an identity boundary |

## What is explicitly NOT modeled (deferred, disclosed)

- **Revocation as a first-class wire message.** No cross-account revocation
  authority exists anywhere in this codebase today (readiness doc,
  confirmed unchanged by Agent A/R). This protocol does not invent one. The
  only way a `"trusted"` binding's practical relevance can end is: (a) a
  `"conflicting"` re-key attempt is rejected (binding stays as last
  genuinely accepted), or (b) a local user manually revokes via the
  EXISTING, local-only `revokeFedesDeviceBinding()` path — which already
  exists and needs no new wiring for cross-account bindings; a
  peer-discovered binding revokes exactly the same way a same-account
  binding does today. A future arc could add a genuine signed
  supersession-to-nothing message; this arc does not, per mandate §14's
  "never invent revoked semantics" instruction.
- **Fan-out to multiple trusted devices for message delivery.** Confirmed
  real, pre-existing, single-value limitation (Agent R §6/§7 of `06`); not
  lifted by this arc.
