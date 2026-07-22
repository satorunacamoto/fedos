# 13 — Downgrade and Rollback Policy

## Explicit statement

**Application downgrade (installing an OLDER FedOS Desktop Beta binary
over a newer one) is supported ONLY when every persisted format's own
schema version is unchanged between the two versions. Otherwise,
downgrade is NOT supported, and the only accepted recovery path is
restoring the profile root from a pre-upgrade backup (`12`, step 2).**
This review does not, and will not, claim arbitrary downgrade safety.

## Per-concern analysis

| Concern | Downgrade-safe when | Downgrade-unsafe when | Evidence |
|---|---|---|---|
| Application binary rollback | the older binary's own `buildIdentity`/version predates no schema-version bump relative to the profile currently on disk | any schema version on disk is NEWER than what the older binary's own codecs expect | `11` — every codec fails closed on a mismatched `schemaVersion`, so an older binary reading a newer-schema record fails exactly the same way a newer binary reading a corrupt record does: `"recovery-required"`/`"corrupt"`, never silent data loss, but also never a working downgrade |
| Profile schema rollback | `schemaVersion: 1` unchanged (true for all Beta 0.1.x today) | a hypothetical future `schemaVersion: 2` profile read by a Beta-0.1.x binary that only knows version 1 | `11` |
| Settings rollback | same reasoning, `schemaVersion: 1` | same reasoning | `11` |
| Archive compatibility | `fedos_conversation_archive_schema_version.ts`'s own version unchanged | that dedicated Archive schema version changes independently of Profile/Settings — an Archive-only schema bump could make an Archive unreadable by an older binary while Profile/Settings remain fully compatible, or vice versa | `11` — Archive is explicitly an INDEPENDENT version counter |
| Search index rebuild | if Search operates over Conversation records directly (unverified assumption, `11`), it inherits Conversation-record compatibility; no STANDALONE index-rebuild-on-downgrade mechanism is evidenced either way | — | flagged as an open question for the next Arc to resolve with direct source verification, not assumed safe here |
| Device Registry compatibility | Device Registry's own `schemaVersion` unchanged | changed | `11` |
| Sync Journal compatibility | Sync Journal's own `schemaVersion` unchanged | changed | `11` |
| Sealed Master Seed compatibility | the sealed envelope's own schema is independent of the WASM artifact version (`08`) — a downgrade to an older binary with the SAME WASM capability profile (`"desktop-master-seed-v1"`) and compatibility version (`1`) can still unseal an existing envelope, since unsealing depends on the Argon2id/AEAD parameters baked into the sealed bytes themselves, not the binary's own version | the WASM artifact's own `compatibilityVersion` changes (a NEW capability profile or incompatible crypto parameter set) | `08` |
| WASM manifest compatibility | the older binary's own bundled WASM artifact/manifest pair is INTERNALLY self-consistent regardless of which version is installed (`08` — each build carries its own matching pair) | N/A at the manifest-verification layer itself (this specific check always passes for a self-consistent package); the RISK is entirely at the data-schema layer above, not this layer | `08` |

## Preferred order (per this review's own instruction)

1. **Binary rollback only when every relevant schema is confirmed
   unchanged between the two versions** (verified against each specific
   release's own `schemaVersions` record, `10` — never assumed from the
   version NUMBER alone, `11`).
2. **Otherwise, restore from a pre-upgrade backup** — the profile root
   snapshot taken in `12`'s own step 2. This review does not implement
   backup tooling; it requires the upgrade procedure to include the step,
   so a restore path exists when downgrade is unsafe.

## Explicit non-claims

This review does not claim: that any specific future schema bump WILL
happen; that a downgrade across an unverified schema change is "probably
fine"; that Search/Device-Registry/Sync-Journal compatibility beyond what
is directly evidenced in `11` has been proven. Every "not independently
re-verified" item in `11` carries into this document as an open risk,
not a resolved one.
