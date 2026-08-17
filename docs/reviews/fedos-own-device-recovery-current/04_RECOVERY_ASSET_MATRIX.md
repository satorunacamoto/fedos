# Machine-Loss Recovery Asset Matrix (mandate §17-26)

## Whole-profile-directory backup sufficiency (§18) — real finding, not assumed

Checked `fedos_local_profile_paths.ts` for anything that would make a raw directory copy
unsafe to restore verbatim on a **different** machine/device context:

- `direct-ratchet-live-state-snapshot.json` — the ONE plausibly-dangerous file (live crypto
  checkpoint). Verified this is actually SAFE to blindly copy-and-restore, by construction of
  work already done earlier this session: the Rust-sealed AEAD context binds
  `local_device_ref`/`remote_device_ref` into the ciphertext itself, and
  `checkFedosDirectRatchetLiveStateSnapshotFreshness()` gates every restore against the
  separately-durable session counters. Restoring this file to a genuinely different device
  context fails closed (AEAD auth failure on unseal, since the new device's own `localDeviceRef`
  differs) rather than silently reusing stale/foreign crypto state. This is a real positive
  finding, not an assumption — the live-state-durability work done earlier this session already
  solves the exact hazard mandate §18/§25 was worried about, for this one file.
- No other obviously machine-specific (absolute-path, hostname-bound) content found in the
  time available — every persistence class this session touched or reviewed uses relative,
  portable record shapes (append-only NDJSON / atomic-rewrite JSON, no embedded absolute
  paths observed).

**Verdict: whole-profile-directory backup, as the prior arc's fix already recommends, is a
reasonable, currently-safe recovery mechanism** for a same-identity restore (same or a
genuinely fresh device — the ratchet snapshot fails closed either way, never silently
misused). It is NOT a *portable, minimal, versioned, tamper-evident* recovery artifact in the
sense mandate §19 describes (no encryption of the directory itself beyond what individual
files already seal, no single-file bundle, no explicit version negotiation at the bundle
level) — building that is real, valuable, but substantial new work, correctly out of this
arc's remaining time budget. **Classification: DESIGN_ONLY** — the existing whole-directory
approach is not unsafe, just not yet a polished, portable bundle; a dedicated recovery-bundle
arc is legitimate future work, not an urgent P0/P1 fix.

## Anti-rollback (§22-26) — architectural reasoning, not exhaustively tested this pass

Every state category this arc cared about (Device trust, identity transition, signed
deletion, Direct Ratchet counters) is stored as append-only or atomically-rewritten local
files, all captured together in a single point-in-time directory snapshot. Restoring an OLD
backup necessarily rolls back ALL of them together to that same point in time — this is an
inherent property of any point-in-time local backup, not a FedOS-specific flaw. The real
question is whether NETWORK-anchored facts (peer-observed device revocation, superseded
identity assertions already published to relays) get silently trusted from the stale local
copy forever, or whether the app re-reconciles against live network evidence on next
connection. **Not verified this pass** (would require tracing every consumer of continuity/
revocation state for a "trust cache indefinitely vs. re-validate on next live observation"
distinction) — flagged as the single most important open question for whoever picks up
recovery-bundle work next, since it determines whether "restore an old backup" is a
convenience feature or a genuine security downgrade path.

Ratchet-state rollback specifically: already safe (see whole-profile-backup finding above —
freshness-gated, fails closed on staleness).

## Commerce / purchased-content recovery (§15-16, §20) — classification only, not tested

Following the same flat-directory, append-only pattern: Commerce receipts, order records, and
payment-evidence records restore exactly as durably as messages/conversations do (same
directory, same backup mechanism) — **RECOVERABLE_FROM_BACKUP** at the metadata level. Actual
purchased protected-CONTENT bytes were not traced this pass; per a prior arc's own
established distinction this session ("a Commerce receipt surviving while purchased content is
lost should be surfaced truthfully"), receipt survival must never be conflated with content-byte
survival — this arc did not verify which one whole-directory backup actually captures for
protected media specifically. **Flagged as unverified, not claimed either way.**
