# FedOS Disaster Recovery / Portable Backup — Design (V1, DESIGN_ONLY)

Arc: `arc/fedos-disaster-recovery-portable-backup` (worktree `C:\wt\disaster-recovery-portable-backup`)
Status: **DESIGN_ONLY**. See "Why DESIGN_ONLY" at the bottom before reading this as a build-ready spec.

## 1. Portability finding: does raw whole-profile-directory copy work? (Goal 1)

**Partially, and the product already documents it as the recovery mechanism** (`docs/desktop_beta_user_guide_backup.md`): "Back up the entire profile directory... Copy your saved profile directory back into the same `userData` location on a fresh install of the **same or compatible** Beta version."

What actually travels safely in a raw copy, confirmed from source:

- **Master Seed** (`master-seed.sealed.json`) — sealed under a portable, passphrase-based Argon2id (RFC 9106) + ChaCha20-Poly1305 envelope, schema `{"v":1,"kdf":"argon2id",...}` (`src/os/core/vault/wasm/fedos_sealed_master_seed_envelope.ts`, Rust codec `packages/fedos-core-rust/src/lib.rs:11862-11953`, seal/restore `lib.rs:12210-12365`). Not device-bound. Restore is a strict, fail-closed, never-panics parser (verified against wrong-passphrase, corrupted ciphertext, unrecognized schema version, malformed/truncated/empty JSON, and unbounded input — `lib.rs:12292-12365`, `11793-11953`, tests at `lib.rs:13960-14120`).
- **Conversation content** — pairwise conversation keys are resolved via `resolveConversationKey(accountIndex, counterpartyPublicKeyHex)`, itself a pure function of the Master Seed (`lib.rs` `resolve_conversation_key`, no device ref involved). So conversation/message payload confidentiality at rest is **not** device-bound either.
- **Direct Ratchet session secrets** ARE sealed under a key that additionally binds `(local_device_ref, remote_device_ref, conversation_id, generation)` (`seal_direct_ratchet_secret`/`restore_direct_ratchet_secret`, `lib.rs:12562-12661`). `local_device_ref` is `profile.json`'s `localDeviceId` — a durable string minted once at profile creation (`fedos_profile_initialization_coordinator.ts:449`) and reused across restarts, **not** the ephemeral in-memory `FedosDeviceSigningKeypair`. So a raw copy that includes `profile.json` + `device-registry.ndjson` consistently would, in fact, let `restore_direct_ratchet_secret` succeed cryptographically on a new machine. **The reason not to do this is protocol security, not cryptography** — see §5.

What raw copy does **not** handle:
- No manifest, no completeness check, no tamper detection beyond whatever each individual file's own (uneven) parser happens to enforce. `FedosProfileInitializationCoordinator#detectProfileState()` fails closed for a corrupt `profile.json` or sealed-seed file, but never inspects the other ~25 durable `.ndjson` logs — a partially-copied or partially-corrupted directory can silently proceed with incomplete state (confirmed gap, not a guess: traced the full coordinator).
- No cross-version compatibility story (doc's own words: "untested," no `Cargo.lock`, no schema migration).
- No handling at all for device-identity continuity, ratchet exclusion, or truth-log staleness (see §4–§6).

**Conclusion: raw directory copy is a real, working baseline for IDENTITY/CONVERSATIONS/MESSAGES today, but is not "genuinely portable" as a disaster-recovery primitive** — it has no integrity guarantee, no versioning, and actively does the wrong thing for Ratchet/device continuity if followed naively. A versioned Recovery Bundle format is justified.

## 2. Recovery Bundle V1 — proposed format (Goal 2)

An outer envelope, structurally a sibling of the Master Seed envelope, **not a new crypto primitive**:

```
{
  "v": 1,
  "kind": "fedos-recovery-bundle",
  "kdf": "argon2id", "m": ..., "t": ..., "p": ..., "salt": "...",
  "alg": "chacha20poly1305", "n": "...",
  "ct": "..."   // AEAD ciphertext of the manifest+payload below
}
```

The plaintext `ct` wraps a **manifest** (schema version, source app version, creation timestamp, per-asset-class list of included files with byte length + BLAKE3/SHA-256 digest per file) followed by the concatenated bytes of every included durable file, OR (simpler, recommended) the bundle is a manifest-plus-tar: encrypt a deterministic tar of `{manifest.json, profile.json, master-seed.sealed.json, <selected ndjson files>}` as one AEAD payload. Manifest-first is preferable — it lets the importer validate completeness (§3) before touching any live file.

**Passphrase**: bundle-specific, chosen at export time (may equal or differ from the live unlock passphrase). This is a deliberate deviation from today's implicit "your unlock passphrase protects your backup too" — it lets an operator mint a bundle for offline/handoff custody without exposing the daily-use passphrase, and satisfies "wrong-secret rejection" cleanly (AEAD auth failure, same as today).

**Rust surface needed (new, but reuses existing internals — not new crypto)**: a sibling pair, e.g. `seal_recovery_bundle(passphrase, payload_bytes) -> Option<String>` / `restore_recovery_bundle(envelope_json, passphrase) -> Option<Vec<u8>>`, implemented by calling the **same** `fedos_derive_master_seed_wrapping_key_argon2id` and `aead_internal::seal_internal`/`open_internal` primitives `seal`/`restore_sealed` already use, under a distinct `AeadAadDomain` (mirroring how `DirectRatchetSealing` is already domain-separated from the master-seed AAD) so a Recovery Bundle envelope can never be replayed as a Master Seed envelope or vice versa. Confirmed via full method inventory: **no existing method seals arbitrary bytes under a passphrase today** — `seal`/`restore_sealed` hard-code a 32-byte Master Seed (`lib.rs:12338`, `plaintext.len() != 32` check). This is genuinely new (but low-risk, primitive-reusing) Rust + WASM-boundary + TS-wrapper surface — see "Why DESIGN_ONLY."

**Strict parser / tamper rejection**: reuse `restore_sealed`'s exact discipline — fixed key order, explicit version/kdf/alg checks, no panics, AEAD-only pass/fail (never distinguishes wrong-passphrase from tampering, by design — same as today).

## 3. Per-asset inclusion and import validation

Import is staged, never in-place:
1. Decrypt bundle → manifest + payload into a **temp staging directory** (not the live profile root).
2. Validate manifest: every listed file present, digest matches, schema versions all recognized. Any mismatch → reject the whole bundle, zero partial writes to the live profile (closes the gap in §1 that raw copy has).
3. Only on full validation success, atomically move staged files into a **fresh, empty `userData`** (never merge into an existing live profile — see §4).

Per-asset plan, using the report's own vocabulary:

| Asset | Included in bundle? | Classification | Why |
|---|---|---|---|
| IDENTITY (Master Seed, account keys) | Yes — `master-seed.sealed.json`, `profile.json` | **RECOVERED** | Passphrase-sealed, not device-bound (§1). |
| CONVERSATIONS / MESSAGES | Yes — `conversation*.ndjson`, `outbox`, `board`, drafts, invitations, payload/retention/capability logs | **RECOVERED** | Keys derive from Master Seed only, not device (§1). |
| CONTACTS | No dedicated file found — appears derived from `conversation-membership.ndjson` + `device-registry.ndjson`, not a first-class store (unconfirmed with full certainty; flagged for Agent B). | **RECOVERED** (as a derived byproduct) if confirmed, else **PARTIAL** | Travels with membership/registry logs above. |
| DEVICE TRUST | Yes, but **reinterpreted, not resumed as-is** | **PARTIAL** | See §4 — restore mints a *new* device identity rather than resurrecting the old one silently. |
| RATCHET | **Excluded from the bundle** (`direct-ratchet-session.ndjson`, `direct-ratchet-sealed-secret.ndjson`, `direct-ratchet-reset-record.ndjson`) | **REESTABLISHED** | See §5 — cryptographically restorable, deliberately not restored; re-negotiated via existing Peer Capability machinery instead. |
| COMMERCE RECEIPTS | N/A — no durable store exists anywhere on this branch (`os/commerce/creator/entitlement.ts:22`: "inert scaffolding, not reachable from the shipped Electron app"; no commerce path in `fedos_local_profile_paths.ts`) | **LOST** | Pre-existing gap, out of this arc's scope — nothing to back up. |
| PURCHASED CONTENT | Same as above | **LOST** | Same reason. |
| TOR SETTINGS | N/A — no persisted field exists (`FedosSettingsDescriptorV1` has only Archive Directory / Auto Start / Auto Lock Timeout / Window Layout) | **LOST** (effectively N/A) | Pre-existing gap. Also means the "no stale live Tor Ready restoration" hard requirement is automatically satisfied — there is nothing to restore. |
| Identity Transition / Signed Deletion truth logs | Yes — all 8 ndjson files (`identity-transition-*`, `deletion-request-*`) | **PARTIAL** | See §6 — local historical record travels, but must be treated as re-verifiable, not authoritative, against current network state. |

## 4. Device Trust / device-revocation truth (Goal 6, part 1)

Restoring `device-registry.ndjson` + `profile.json`'s `localDeviceId` verbatim onto a new machine would make the new machine **impersonate the old device's identity**, including any trust/revocation state that predates the backup. If the original device was revoked (by a peer, or by another of the user's own devices) *after* the snapshot was taken, that revocation fact is not in the bundle — restoring naively would resurrect a device identity that should be dead. This is the same class of risk called out generically in the "old-backup rollback" requirement, but Device Trust is the sharpest instance of it.

**Recommendation**: Recovery Bundle restore is modeled as a **device replacement event**, using machinery that already exists rather than inventing new trust semantics:
- On import, mint a **fresh** `FedosDeviceSigningKeypair` and a fresh `localDeviceId` (same mechanism `createProfile()` already uses, `fedos_profile_initialization_coordinator.ts:447-449`) — never reuse the backed-up one.
- Treat the restored Master Seed + conversation history as continuous, but the *device* as new — register it via the existing pairing/registration path, and (where the peer relationship already exists) notify known peers through the existing Identity Transition / device-revocation outbound notification coordinator (`fedos_identity_transition_outbound_notification_coordinator.ts`), rather than silently resuming.
- This also cleanly disposes of Ratchet secrets (§5): `restore_direct_ratchet_secret` requires the *exact* original `local_device_ref`; a fresh one makes every old sealed ratchet blob permanently and safely unopenable — a side effect, not an extra mechanism.

## 5. Ratchet — why REESTABLISHED, not RECOVERED (Goal 6, part 2)

Confirmed cryptographically restorable (§1) — the wrapping key is `(MasterSeed, local_device_ref, remote_device_ref, conversation_id, generation)`, no per-machine secret. The reason to exclude it anyway is a **Double Ratchet protocol-security property**, not a crypto limitation: a live ratchet chain must exist on exactly one device at a time. Restoring old chain/message keys onto a second (replacement) device — especially if the original device kept advancing the ratchet after the snapshot but before loss — risks chain-key duplication and message-key reuse across two devices, which is precisely what the Double Ratchet's forward-secrecy design exists to prevent.

Given §4's device-replacement design, this is enforced *structurally*, not just by policy: excluding the ratchet ndjson files from the bundle, combined with minting a new `local_device_ref` on import, means there is no path by which old ratchet secrets could be unsealed even if a future bug tried. Post-restore, sessions reestablish through the existing, already-shipped `fedos_ratchet_peer_capability_*` renegotiation machinery on next contact with each peer.

## 6. Old-backup rollback / truth-log staleness (Goal 5)

Identity Transition already carries a revision/supersession model (`isFedosIdentityTransitionPeerObservationSuperseded`) and Signed Deletion execution is already idempotent-by-`planId` with restart-safe replay guards (`fedos_deletion_execution_coordinator.ts:71-91`). The existing Archive restore feature already establishes the right precedent for exactly this problem: **"restoring an Archive applies your CURRENT retention/suppression state at restore time, so some previously-deleted content may come back marked as redacted/tombstoned rather than fully restored, by design"** (`docs/desktop_beta_user_guide_backup.md`).

**Recommendation**: Recovery Bundle restore must apply the same principle — restored conversation/payload content is re-run through the *current*, freshly-recomputed Payload Retention / Suppression authority before being surfaced, not trusted verbatim from the raw restored bytes. This means a since-deleted item stays suppressed post-restore even though the raw backup bytes still technically contain it, and a since-superseded identity-transition observation is re-evaluated rather than silently trusted.

**Genuinely, honestly unrecoverable**: anything that happened strictly between the last backup snapshot and the loss event, that never reached a durable local log this device's own copy captured. No backup design can close this gap — it is a snapshot-staleness property of backups in general, not a defect of this one. State this explicitly in the operator-facing docs (Agent D).

## 7. Own-Device Sync boundary (Integration Overlap)

Read-only awareness, zero edits planned or needed, in: `src/os/messenger/device/sync_scheduler/**`, `sync_session/**`, `sync_package/**`, `sync_events/**`, `relay_sync/**`, `archive_suppression_sync/**`, `src/os/messenger/sync/**`, and Direct Ratchet transport (`fedos_direct_ratchet_*_integration.ts`, `fedos_direct_ratchet_route_resolution.ts`, NIP-17 wire files). The Recovery Bundle is a pure export-snapshot + new-import-coordinator design; it reads the same durable files Own-Device Sync also reads/writes but never needs to modify sync scheduler/transport code itself.

**One real shared-surface risk**: `fedos_local_profile_paths.ts` and `profile.json`'s schema are natural extension points both arcs might reach for (e.g. adding a bundle-manifest path, or a sync-related field). **Coordinate before merge** — do not add fields to either without checking the other arc's current diff first.

## Why DESIGN_ONLY

Two independent reasons, and they should not be conflated when this is read later:

1. **Environment**: this session's shell execution (Bash/PowerShell) is broken for every agent regardless of isolation settings — confirmed repeatedly. No build, no test run, no WASM rebuild, no running binary, no git commit was possible. Goals 3–4 (implement + prove with an actual installed binary) are categorically blocked by infrastructure, independent of design quality.
2. **Genuine new surface, not just wiring**: a Recovery Bundle needs a new Rust seal/restore method pair, a new WASM-boundary call, and new profile-initialization import code — none of this exists today (confirmed by full inventory of `pub fn seal*/restore*` in `lib.rs` and the full `attemptDevOnly*Call` WASM method list). The *design* above is not ambiguous — it specifies exact reuse of existing Argon2id+AEAD primitives under domain separation — but writing and shipping new cryptographic code that cannot be compiled or tested in this session is exactly the class of risk this codebase's own conventions are built to avoid (see the pervasive "inert scaffolding until proven" pattern across `os/core/identity/*`, `os/commerce/creator/entitlement.ts`, etc.). Implementation should happen in a session with working shell access, against this spec.
