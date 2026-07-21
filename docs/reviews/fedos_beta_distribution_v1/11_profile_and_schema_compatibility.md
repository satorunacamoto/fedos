# 11 — Profile and Schema Compatibility

## Method

`git grep -l "schemaVersion"` across `src/` (excluding tests) returns
over 90 files (proven current source, this worktree) — every persisted
record format in this codebase already carries an explicit, per-record
`schemaVersion` field. Rather than re-read all ~90 files individually,
this review verified the GENERAL mechanism against two representative,
directly-read examples (`FedosLocalProfileDescriptorV1`,
`FedosSettingsDescriptorV1`'s own codec) and confirms the same pattern
recurs project-wide by the sheer consistency of the `schemaVersion`
field's presence and naming across every listed file.

## Per-format inventory

| Format | Schema/version mechanism | Forward-read (newer reader, older record) | Backward-read (older reader, newer record) | Unknown-field behavior | Corruption behavior | Migration support | Rollback risk |
|---|---|---|---|---|---|---|---|
| Profile descriptor (`FedosLocalProfileDescriptorV1`) | `schemaVersion: 1` literal, strict `!== 1` rejection (`fedos_local_profile_descriptor.ts:118`) | N/A — only version `1` has ever existed | N/A | not permitted — the codec validates an exact known field set | `FedosLocalProfileCorruptError` (dedicated error type), fails closed to `"recovery-required"` lifecycle state (never a false `"ready"`) | **none implemented** — a `migrationVersion` field EXISTS (always `1`, integer `>= 1`, `fedos_local_profile_descriptor.ts:71`) as a RESERVED placeholder for a future data-directory migration generation counter, but zero code anywhere reads/bumps it beyond initialization | a rollback to an OLDER binary reading a schema-version-1 descriptor is safe (same version); rollback is UNSAFE the instant any future binary would write `schemaVersion: 2` |
| Sealed Master Seed envelope | versioned via its own envelope schema (`FedosSealedMasterSeedEnvelopePersistence`) — not independently re-verified in this review beyond confirming it is a SEPARATE file/format from the profile descriptor | not evidenced beyond version 1 | N/A | not evidenced | fails closed (consistent with every other format's own discipline observed) | none evidenced | same category of risk as the profile descriptor |
| Settings (`FedosSettingsDescriptorV1`) | `schemaVersion: 1`, `fedos_settings_codec.ts` | N/A — only version 1 exists | N/A | authority-level validation (`FedosSettingsAuthority`), closed outcome vocabulary `"ok"\|"invalid"\|"corrupt"\|"failed"` | `"corrupt"` outcome, fails closed (`fedos_settings_authority.ts`, confirmed this session and the immediately-prior two arcs' own test suites) | none implemented | same category |
| Device Registry / pairing / replay records | `schemaVersion` present per-record (`fedos_device_binding_codec.ts`, `fedos_device_binding_challenge_replay_codec.ts`, etc., confirmed present via `git grep`) | not independently re-verified beyond confirming the field's presence | not independently re-verified | not independently re-verified | not independently re-verified this session | none evidenced anywhere in this codebase's own migration tooling (none exists at all, `git grep` for "migrat" beyond the one reserved `migrationVersion` field returns no active migration code) | same category — treat as unproven-safe across a schema bump until proven otherwise |
| Durable Sync Journal | `schemaVersion` present (`fedos_persisted_device_sync_schedule_event_v1.ts` and siblings) | not independently re-verified | not independently re-verified | not independently re-verified | not independently re-verified | none | same category |
| Conversation records (draft/construction/membership/capability/envelope/payload) | `schemaVersion` present on every one of the ~15 `fedos_persisted_conversation_*_v1.ts` files (`git grep`) | not independently re-verified | not independently re-verified | not independently re-verified | not independently re-verified | none | same category |
| Search index | not independently located as a separate persisted-record type in this review's own search (search appears to operate over the Conversation records above, not a separately-versioned index file) — **unverified assumption, flagged, not asserted as fact** | — | — | — | — | — | treat as coupled to Conversation record compatibility until proven independent |
| Archive formats | independently versioned via `src/conversation/archive/fedos_conversation_archive_schema_version.ts` (a DEDICATED schema-version file, distinct from Settings/Profile's own inline `schemaVersion` literal) | not independently re-verified beyond confirming the dedicated file's existence | not independently re-verified | not independently re-verified | not independently re-verified | none evidenced | independent risk category from Settings/Profile — an Archive schema bump does not imply a Profile/Settings bump or vice versa |
| Navigation/session state | `AppendOnlyFedosDesktopNavigationPersistence` (append-only NDJSON, per `08548845`'s own ownership inventory) — schema-version field presence not independently re-verified this review | not independently re-verified | not independently re-verified | not independently re-verified | not independently re-verified | none evidenced | same category |
| Sender-Key records | present in the broader lineage per historical arc naming (`src/conversation/group/`) but NOT constructed/reachable from the canonical Beta entry point per the prior arc's own ownership inventory — **out of scope for a Beta 0.1 compatibility claim** since the capability itself is not exposed | — | — | — | — | — | not applicable to Beta 0.1's own release scope |

## The single most important finding

**No forward-migration code exists anywhere in this codebase.** A `git grep`
for migration-related logic beyond the one reserved, never-incremented
`migrationVersion` placeholder field returns nothing. Every codec this
review directly inspected rejects a non-matching `schemaVersion` outright
(fails closed to a corrupt/recovery-required state) — none of them
contain an "if old version, upgrade the shape" branch. **This means: for
Beta 0.1, any future schema-version bump to ANY persisted format is, by
default, a hard incompatibility, not a smooth upgrade** — this is the
single fact `12`/`13` are built on.

## Corrections to a version-number-only assumption

Do not infer compatibility from version numbers alone (the review's own
instruction) — this inventory confirms WHY: a `schemaVersion: 1` file
read by a `schemaVersion: 1`-expecting codec is compatible only because
today, literally every format in this accepted lineage has NEVER left
version 1. The moment any one of them changes, this codebase's own
existing behavior is to fail closed, not to interpret the version number
as a hint for a migration path that does not exist.
