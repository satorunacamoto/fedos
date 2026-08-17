# Recovery Truth Table — Product Durability Mega-Arc, Phase A

Solo pass (no sub-agent fan-out available). Verified via source reading, not assumed.

## Architecture fact that drives this whole table

Every durable Messenger concern is a flat file directly under ONE profile `root`
directory (`fedos_local_profile_paths.ts` — 30+ `*LogFile`/`*LogPath` fields, all
`join(root, "<name>.ndjson"|".json")`, zero subdirectories, zero external stores).
Commerce data lives under `<dataDir()>/commerce/` and `settings.json` at
`<dataDir()>/settings.json` — both siblings of the Messenger `profile/` root, same
top-level `dataDir()` tree (`fedos_electron_beta_main.cts`). **A single directory
backup of the whole `dataDir()` tree captures essentially all local durable state.**

This is more complete than the currently-shipped recovery notice discloses (see
`06_ROOT_CAUSE_DECISION.md`).

## Per-asset table

| Asset | Where stored | Plaintext/Sealed/Public | Backed up today? | Portable? | Device-bound? | Recreatable? |
|---|---|---|---|---|---|---|
| Master/root secret | `master-seed.sealed.json` | Sealed (Argon2+AEAD) | User must manually copy | Yes (file) | No | **No — irretrievable if lost + forgotten passphrase** |
| Profile descriptor | `profile.json` | Non-secret | User must manually copy | Yes | No | Recreatable but loses linkage to the above |
| Conversations/membership | `conversation*.ndjson` | Plaintext metadata, sealed payload refs | NOT mentioned by current notice | Yes (file copy) | No | Re-derivable from relay history in theory, not implemented |
| Message history | `conversation-payload.ndjson` | Sealed | NOT mentioned by current notice | Yes | No | No |
| Peer Device trust | `device-registry.ndjson` | Plaintext (public keys/state) | NOT mentioned | Yes | No | Re-observable from peer re-announce, not automatic |
| Own Device state | same registry + sync package files | Plaintext + sealed sync packages | NOT mentioned | Yes | Partially (see `02_OWN_DEVICE_SYNC_TRUTH_TABLE.md`) | Partially |
| Direct Ratchet sessions | `direct-ratchet-*.ndjson`/`.json` | Sealed (AEAD) | NOT mentioned | Yes | Bound to local Device ref | **No — by design, forward secrecy; safe re-establishment exists (Session Reset)** |
| Tor settings | `settings.json` | Plaintext preference only, never live state | NOT mentioned | Yes | No | Trivially recreatable (one toggle) |
| Commerce products/orders/receipts/reputation | `<dataDir>/commerce/*` | Plaintext + signed envelopes | NOT mentioned | Yes | No | No (receipts/reputation are signed, non-recreatable) |
| Purchased protected content bytes | `DurableIpfsTransport` blob dir under `<dataDir>/commerce/` (local-only "IPFS", confirmed no public network) | Ciphertext blobs, local-only | NOT mentioned | Yes (large) | No | **No — grant + bytes both required; grant survives, bytes only if the blob dir is backed up** |
| Signed Deletion state | `deletion-request-*.ndjson` | Plaintext + signed records | NOT mentioned | Yes | No | No |
| Identity Transition state | `identity-transition-*.ndjson` | Plaintext + signed records | NOT mentioned | Yes | No | No |
| App settings | `settings.json` | Plaintext | NOT mentioned | Yes | No | Yes, defaults |

## Machine-loss scenarios (mandate §5), modeled separately

- **A. App restart** — trivially fine, all durable state already proven to survive across this entire session's own work.
- **B. FedOS reinstall, same disk** — fine; installer never touches `dataDir()` (confirmed: `dataDir()` resolves under `%APPDATA%`/override env var, not the install directory).
- **C. Windows reinstall, user has a disk-level backup of `dataDir()`** — **RECOVERABLE for everything** if the whole tree was backed up (not just the 2 files the current notice names) and the user remembers the passphrase.
- **D. SSD/disk lost completely, no backup** — **total loss**. No cloud/custodial fallback exists (confirmed, deliberate, disclosed as an Absolute Prohibition elsewhere in this codebase).
- **E. Laptop lost/stolen, no backup** — same as D from a data-recovery standpoint; separately, any paired own-device retains its own local copy of what it received via sync (see truth table 02) — that portion IS recoverable from device B without any backup.
- **F. User buys a new computer** — same as C: recoverable only via a manual `dataDir()` copy the user chose to make.
- **G. Profile directory corrupted** — see `04_MIGRATION_ATOMICITY_AUDIT.md`; append-only NDJSON is single-record-append, so a mid-write crash loses at most the last unflushed record, not the whole file — not independently re-verified this pass beyond the existing corpus of restart/crash tests already proven elsewhere in this session's own Direct Ratchet Live-State Durability arc.
- **H. Forgot passphrase** — **unrecoverable**, already honestly disclosed in-app (`forgottenSecretIsUnrecoverable: true`).
- **I. Passphrase remembered, sealed file lost** — **unrecoverable**, no reset path exists (confirmed, deliberate).

## Answers to mandate §6

- **What secret proves ownership?** The unlock passphrase, combined with the sealed Master Seed file.
- **What must user preserve?** Both, together — the notice already says this correctly for identity. It does NOT currently say "and the rest of `dataDir()` if you want your conversations/Device trust/Commerce history back too."
- **What cannot be recovered?** Forgotten passphrase (no reset), and Direct Ratchet live session state (by cryptographic design — this is forward secrecy working as intended, not a bug; Session Reset re-establishes safely).
- **What happens if backup is stolen?** Sealed Master Seed alone is useless without the passphrase (Argon2-sealed) — same guarantee the in-app notice already states. Commerce/conversation data files are NOT similarly sealed at rest beyond individual payload sealing — a stolen full `dataDir()` backup exposes conversation metadata and Commerce records in plaintext (this is the SAME exposure the live running app already has locally; not a new regression, but worth naming explicitly if recovery guidance is broadened).
- **Can backup be copied between devices?** Yes, by construction (plain files).
- **Can an old backup roll back identity/security state?** This is the important one — see `06_ROOT_CAUSE_DECISION.md` and the anti-rollback analysis below.
