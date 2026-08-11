# `src/os/messenger/sync/` — Multi-Device Sync (moved from top-level `src/sync/`)

Moved 1:1 from `src/sync/` (14 files) in the Compatibility Facade Reduction +
Package Extraction Readiness arc, closing the classification gap
`docs/architecture/ARCHITECTURE-DEPENDENCY-CLOSURE-FINAL-VALIDATION.md`'s
"Known limitations" section left open ("`src/sync/` (14 files) — still
unclassified in every architecture doc... Not touched").

## Classification: Messenger, not a new top-level capability

Traced fresh, every real (non-test, non-shim) importer of these 14 files is
inside `src/os/messenger/**`:

- `os/messenger/conversations/deletion/{fedos_deletion_assessment,
  fedos_deletion_execution_coordinator}.ts` (device registry awareness for
  deletion eligibility)
- `os/messenger/desktop/runtime/{fedos_desktop_runtime,
  fedos_device_trust_runtime}.ts` (the desktop Runtime's own sync
  composition)
- `os/messenger/device/sync_scheduler/{fedos_device_sync_conflict,
  fedos_device_sync_import_coordinator,fedos_device_sync_scheduler,
  fedos_device_sync_target_planning}.ts` (the device-pairing sync scheduler
  built on top of this Journal/State machinery)

No file here carries a Commerce-shaped or Core-generic type — every record
(`FedosSyncJournalEntryV1`, device bindings, cursors, the pending-change
queue) is specifically about synchronizing Messenger facts (conversation
identity metadata, membership, retention/archive references — see
`fedos_sync_record_allowlist.ts`'s closed allowlist) across a Messenger
account's own devices. This is why it landed inside the existing
`os/messenger` capability as a sibling of `conversations/`, `device/`,
`desktop/`, `board/` — spanning more than one of those subdirectories'
own real consumers (not just `device/`) is exactly why it is its own
top-level directory here rather than nested under `device/sync_scheduler/`,
but it is NOT a new `os/`-level capability: the kickoff brief's high bar
for inventing one ("real evidence it spans multiple existing capabilities
in a way that doesn't fit inside one") is not met here — every real
consumer is Messenger, none is Commerce or a Core-generic concern.

## Shim

`src/sync/*.ts` (all 14 old paths, including `persistence/*.ts`) now
`export * from` the corresponding file here — every existing import at the
old path, including this arc's own test suite (which still imports via
`../src/sync/...`), continues to resolve identically.
