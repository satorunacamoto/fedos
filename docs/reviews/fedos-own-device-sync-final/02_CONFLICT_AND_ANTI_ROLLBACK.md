# Conflict Classification and Anti-Rollback — Already Built, Verified Against the Mandate

**Consolidates mandate doc 05** (`05_CONFLICT_AND_ROLLBACK.md`) plus §13-19/§22-26.

## Finding: the conflict/anti-rollback system this mandate asks for already exists

`FedosDeviceSyncImportCoordinator` + `classifyFedosDeviceSyncConflict()` +
`planFedosDeviceSyncResolution()` (Alpha 3721-3800, Phase H/I/J — real, tested,
already wired to the Import Coordinator, which IS reachable today for any
already-local Sync Journal entry, independent of whether a live cross-process
transport exists) implement a genuine, security-aware conflict taxonomy — not the
generic last-writer-wins the mandate's own §13/§9-12 explicitly warns against.

## Conflict classification (verified against source, `fedos_device_sync_conflict.ts`)

| Mandate category (§13) | Codebase kind | Verified behavior |
|---|---|---|
| Commutative | `safe-concurrent-append` | Only for `capability-public-event` (explicitly allowlisted append-only-safe) — two different, currently-trusted devices' own entries coexist, never overwritten |
| LWW-safe | `stale-projection` | Only for `search-canonical-id` (explicitly allowlisted as a locally re-derivable projection) — a concurrent disagreement resolves by local re-derivation, never by trusting either device's claim |
| Manual/operator | `operator-decision-required` | Two devices produced different changes for the same conversation with no record-type context — durably recorded as an unresolved Conflict, never auto-resolved |
| Security-sensitive, never LWW | `immutable-record-conflict` | Same identity, different content, from an untyped-as-append-only/projection record — REJECTED as `"record-conflict"`, never applied |
| Security-sensitive, never LWW | `invalid-transition` | An upsert arriving for a conversation whose last-applied entry was a **tombstone** (signed-deletion terminal fact, §17) — REJECTED unconditionally; a tombstone is never reversed by a later upsert, regardless of which device sent it or how it's timestamped |
| Security-sensitive, never LWW | `revoked-device-contribution` | The originating device's LIVE Registry trust state is checked per-entry at import time (not just at journal-append time) — a device revoked AFTER contributing an entry is caught here even if the entry was already durably journaled |

## Anti-rollback mapping (§14, §22-26) — verified, not assumed

- **Identity transition (§24)**: out of THIS subsystem's scope by construction — identity
  transition state is not on the Sync Journal record-type allowlist at all (only
  `conversation-identity-metadata`/`membership-metadata`/`capability-public-event`/
  `retention-tombstone-fact`/`archive-reference`/`search-canonical-id` are). An old
  device/backup cannot roll back identity transition state via THIS transport because
  this transport carries none of it. Identity transition's own anti-rollback semantics
  (established in an earlier arc this session: relay-reconnect self-healing, bounded by
  relay retention) are unaffected and unchanged by this arc.
- **Signed deletion (§17, §23)**: `invalid-transition` (above) is the exact mechanism —
  a tombstone (`retention-tombstone-fact`, `kind: "tombstone"`) is a terminal fact in
  the base classifier (`classifyFedosSyncConflict()`, Alpha 2421-2500, unmodified) and
  the richer classifier both; a later upsert for the same conversation is rejected, not
  silently re-applied. This directly satisfies §23's "does not resurrect deleted content
  merely because another device has an older copy."
- **Device revocation (§18, §25)**: `revoked-device-contribution`, above — re-checked
  live at import time, not just at journal-append time, so a device revoked between
  contribution and import is still caught. This matches the codebase's own established
  discipline elsewhere this session (Direct Ratchet, identity continuity) of never
  trusting a frozen snapshot over a live re-check.
- **Sequence gap (§14, "Do not sync mutable projection as canonical when reconstructible" +
  §25)**: `missing-dependency` — an incoming sequence more than one ahead of the local
  cursor is flagged, never silently treated as "caught up." Duplicate/replay
  (§24): `identical-duplicate` via the base classifier's own `changeId` dedup — exact
  replay is a documented no-op, never a second application. Reordering: `cursor-divergence`
  — an entry at or behind the cursor that isn't recognized as the same change is flagged,
  never silently re-applied or treated as a rollback success.
- **Commerce (§19)**: `commerce-*` record types are **not** on the Sync Journal
  allowlist at all (confirmed via `FEDOS_SYNC_ALLOWED_RECORD_TYPES`, above) — Commerce
  financial/authority facts never flow through this transport, so this transport
  cannot be a rollback vector for Commerce by construction. Commerce's own existing
  signed-evidence authority (established in an earlier arc this session — payment/
  completion facts are never resolved by ordinary last-writer-wins) is unaffected.

## What genuinely remains open (carried into `05_ROOT_CAUSE_AND_IMPLEMENTATION_PLAN.md`)

The relay-retention self-healing limitation (§15) for device-trust/identity-transition
state is a pre-existing, already-disclosed boundary from an earlier arc this session —
re-confirmed unchanged: an old device/backup's stale trust state self-heals on next
live relay reconnect, bounded by whatever history window the relay retains, never
infinite/permanent. This arc found no stronger local monotonic fact that would let this
subsystem strengthen that guarantee without new protocol design (a candidate — a durable
"last known account epoch" monotonic counter — would itself need a new authority
decision about who can advance it, out of scope here).
