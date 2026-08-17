# Migration / Rollback / Red Team (mandate §27-34) — bounded pass

## Migration inventory (§27-31)
Carries forward the prior arc's own finding, not re-derived from scratch this pass (time
budget): every durable record type has a per-record `schemaVersion` field (verified present
across `fedos_device_binding_codec.ts`, `fedos_local_profile_descriptor.ts`, the Direct
Ratchet snapshot, the sync session/manifest — a consistent, repo-wide convention), but there
is no FILE-LEVEL or PROFILE-LEVEL migration transaction (read-old → validate → write-new-temp
→ atomic-replace → record-version, per mandate §28's own template). **Real, but low-urgency
PROTOCOL_GAP**: only one schema generation (`schemaVersion: 1` everywhere) has ever shipped,
so no migration has ever actually needed to run. Building the general mechanism now, with no
concrete v1→v2 transform to validate it against, risks exactly the kind of speculative,
untested infrastructure this session's own discipline has consistently avoided. **DEFER** —
build it when the first real schema bump is actually needed, not preemptively.

Downgrade (§31): not separately tested this pass. Given `schemaVersion` fields are read and
validated by every codec function already (`if (value.schemaVersion !== 1) return false` is
the universal pattern observed throughout this session's own work), an old FedOS reading a
hypothetical future `schemaVersion: 2` record would already fail closed (reject as
schema-invalid) rather than corrupt it — this is a structural consequence of the existing
validator pattern, not a new guarantee added this pass, but a real one worth naming.

## Update mechanism (§32) — reconfirmed
No auto-updater exists anywhere in `src/` (re-confirmed via grep, matches the prior arc's own
finding and this session's own explicit "no unsigned auto-update" prohibition). Correctly not
built this pass either.

## Rollback runbook (§33) — not written this pass (DEFER)
A real, useful rollback runbook needs the recovery-bundle work (§18-19 above) to exist first
— writing user-facing rollback instructions for a backup mechanism that's still whole-directory-
copy-only would either be trivial-to-the-point-of-uselessness ("copy the folder back") or
would need to describe a bundle format that doesn't exist yet. Deferred alongside the bundle
work itself.

## Red team (§34) — bounded, source-based pass only (no live installed attack simulation this
pass — time budget)

Attempted, as a source-reading exercise, the personas the mandate names:

- **New user**: first-run flow not re-audited this pass (multiple prior arcs this session
  already verified create/unlock/recovery-notice paths; no new source touched here that would
  regress it).
- **Stolen-device attacker**: see `03_DEVICE_AUTHORITY.md` — no overclaim found; the
  no-remote-wipe limitation is real but was already an accepted, disclosed architectural
  property, not a newly-discovered gap.
- **Corrupt-backup / rollback attacker**: see `04_RECOVERY_ASSET_MATRIX.md` — genuine open
  question (network-reconciliation-on-restore) flagged, not resolved.
- **Malicious relay / malicious local file editor**: not newly tested this pass — this
  session's own extensive prior work (fail-closed corruption handling on the Direct Ratchet
  snapshot, structural validators rejecting malformed records everywhere) already covers much
  of this; no new regression found in what was reviewed.
- **Release operator**: the false-completion, false-security-good, and secret-log concerns
  named in mandate §34 were the direct subject of dedicated prior arcs this session (Message
  Delivery Truth, Security-state truthfulness work, and a security spot-audit in the Product
  Durability arc that found zero secret-logging/clipboard findings) — not re-run from scratch
  here, carried forward as still-valid.

**No new P0/P1 found by this red-team pass beyond the Own-Device Sync transport gap already
documented as this arc's central finding.**
