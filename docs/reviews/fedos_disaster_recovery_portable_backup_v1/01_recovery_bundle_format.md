# Recovery Bundle v1 — Wire Format (draft for Agent A to implement, Agent C to red-team)

## 1. Container shape

```json
{
  "v": 1,
  "kind": "fedos-recovery-bundle",
  "createdAt": 1234567890,
  "sealedMasterSeedEnvelope": "{\"v\":1,\"kdf\":\"argon2id\",...}",
  "dataCiphertext": { "...": "AeadCiphertextWire, or null if Data Part omitted" },
  "manifest": {
    "contentHash": "...",
    "includedLogs": ["board", "conversation", "..."],
    "excludedLogs": ["direct-ratchet-session", "sync-journal", "..."],
    "accountIndex": 0
  }
}
```

Fixed key set (exactly these top-level keys, in this order, mirroring
`FedosSealedMasterSeedEnvelopeV1`'s own fixed-key-order discipline and
`isWellFormedFedosDeviceTransferPackageV1`'s own `Object.keys(value).length`
check) — reject on any extra/missing/renamed key, any wrong `v`, any wrong
`kind`. `sealedMasterSeedEnvelope` must independently pass
`isWellFormedSealedMasterSeedEnvelopeV1Json()` before this container is
considered structurally well-formed at all. `dataCiphertext` is `null` when
the operator chose an Identity-only bundle (still fully valid — see §4).

`manifest` travels in the clear, exactly like the Conversation Archive's own
Manifest (`fedos_conversation_archive_manifest.ts`) and the Sealed Master
Seed envelope's own cost params — never itself AEAD-protected, never itself
trusted for anything beyond bookkeeping/diagnostics. `includedLogs`/
`excludedLogs` are structural echoes of §2 below (not restore-time policy —
the real inclusion decision is compiled into the builder), useful for a
human/CLI to introspect a bundle without decrypting it, and for the
integrity/content-hash check.

## 2. Data Part composition — one profile root, `planFedosLocalProfilePaths()`

Serialize each INCLUDED leaf file's raw NDJSON bytes (or absence — a leaf
that doesn't exist yet on the source profile is simply omitted, never an
error) into one canonical bundle, keyed by a fixed logical name (not the
raw filesystem path — a restore target may use a different root). Concat
order is fixed (alphabetical by logical name) for determinism.

**INCLUDED** (durable, not device-bound, not Own-Device-Sync-owned):

`profile-descriptor`, `board`, `outbox`, `conversation`,
`conversation-envelope`, `conversation-payload`, `conversation-membership`,
`conversation-invitation-received`, `conversation-draft`,
`conversation-capability`, `conversation-payload-retention`,
`deletion-request-state`, `deletion-request-decision`,
`deletion-request-acknowledgement`, `deletion-request-execution`,
`deletion-request-inbox-summary`, `deletion-request-pending-review`,
`identity-transition-observation`, `identity-transition-local-decision`,
`archive-suppression-observation`

**EXCLUDED, and why** (draft — Agent C confirms or overturns each):

| Excluded | Reason |
|---|---|
| `master-seed.sealed.json` | Not part of the Data Part at all — it IS the Identity Part, travels separately, verbatim (§3). |
| `device-registry` | Working default: EXCLUDE. Restoring an old snapshot risks resurrecting a since-revoked device's trust if revocation is forward-only and this snapshot predates it (hard requirement: no silent trust rollback). New device re-learns trust via the real pairing flow. **Agent C: confirm whether device-registry is actually append-only-forward or whether a later revocation could be silently undone by this: verify before shipping either way.** |
| `device-binding-replay` | EXCLUDE. This is replay-protection challenge/nonce state — restoring it onto a different device risks reintroducing stale replay-window state; at best useless, at worst a real weakening. Never a candidate for portability. |
| `direct-ratchet-session`, `direct-ratchet-sealed-secret`, `direct-ratchet-reset-record`, `direct-ratchet-import-record` | EXCLUDE, hard requirement. Sealed secret is cryptographically inert on a new device anyway (`SealingAuthorityPort` binds to `localDeviceRef`); the plaintext session/reset/import metadata describes live per-device session state that must not be reanimated. New device re-negotiates generation-0 sessions via the existing `fedos_direct_ratchet_reset_coordinator.ts` path. |
| `peer-capability-observation` | EXCLUDE. Live per-device session/capability announcement state, same category as ratchet session state. |
| `sync-journal`, `sync-schedule`, `sync-conflict` | EXCLUDE, hard requirement (Own-Device Sync's own fact/snapshot model — explicitly off-limits to this arc). |
| `archive-suppression-inbound-dedup`, `archive-suppression-fanout-observation` | EXCLUDE. Per their own doc comments, "meaningful only when Device Sync suppression propagation is enabled" — Own-Device-Sync-adjacent, not core profile-portable data. |
| `conversation-transport-observation` | EXCLUDE. Delivery-observation/relay-transport bookkeeping — re-observed naturally on next contact, not required for identity or message-content recovery, and keeping the Data Part's scope narrow is itself a goal ("strict parser," minimal trust surface). |
| `logs/`, `session/` directories | EXCLUDE. Non-secret diagnostics and navigation/session UI state — never durable meaningful data by their own doc comments in `fedos_local_profile_paths.ts`. |

Commerce receipts / purchased content / Tor settings: pending the parallel
research fork's findings — folded into `03_asset_classification.md`, not
duplicated here.

## 3. Identity Part

The `sealedMasterSeedFile` (`master-seed.sealed.json`) contents, copied
byte-for-byte as the `sealedMasterSeedEnvelope` string. No transformation.
Already Argon2id + ChaCha20-Poly1305 sealed under the operator's existing
passphrase — this Stage does not re-wrap it under anything.

## 4. Sealing the Data Part

1. Resolve `selfAccountPublicKeyHex` for `manifest.accountIndex` (caller-
   supplied, mirrors every other reuse of `resolveConversationKey`'s own
   "already resolved by the caller" discipline — this format never resolves
   it internally).
2. `keyHandle = masterSeedAuthority.resolveConversationKey(accountIndex, selfAccountPublicKeyHex)`
   — requires the Master Seed to already be UNLOCKED on the source machine
   (true by construction: you can only build a bundle from a live, unlocked
   profile).
3. Concatenate the Data Part's serialized logs (§2) with a small fixed
   header (bundle format version + `accountIndex`, mirroring
   `fedos_device_sync_package_header.ts`'s own prepend-header pattern) to
   bind the header to the ciphertext.
4. `encrypt(keyHandle, suite, "Conversation", sealed)` → `exportCiphertext()`
   → `dataCiphertext`. Same `AeadAadDomain` Archive/Sync Package already
   use; no new domain.
5. `manifest.contentHash` = a hash of the pre-encryption sealed bytes,
   mirroring `computeFedosConversationArchiveContentHash`'s own pattern —
   re-verified after decrypt on restore, distinct from AEAD-authentication
   failure (mirrors the Archive's own `"manifest-mismatch"` vs `"failed"`
   distinction).

An Identity-only bundle (`dataCiphertext: null`) is valid and does not
require step 2 (no unlocked Master Seed needed to export identity-only —
wait: building ANY bundle requires an unlocked seed to read
`master-seed.sealed.json` is not accurate — that file is already sealed at
rest and can be read/copied without unlocking anything. An Identity-only
bundle therefore requires NO live unlock at all, only filesystem read
access — Agent A: implement this as the cheap/always-available path, and
the Data Part as strictly additive.)

## 5. Restore protocol

1. Parse + structurally validate the container (§1). Any failure →
   `"malformed"`, stop. Never partially trust.
2. `masterSeedAuthority.restoreSealed(sealedMasterSeedEnvelope, passphrase)`
   on a **freshly constructed, empty** authority targeting a **new, empty**
   profile root (never an existing/populated one — profile isolation hard
   requirement). Wrong passphrase → AEAD failure inside Rust → `false` →
   stop here, nothing else is attempted (wrong-secret rejection).
3. If `dataCiphertext` is present: resolve `selfAccountPublicKeyHex` for
   `manifest.accountIndex` against the NOW-restored identity, derive the
   same `resolveConversationKey`, decrypt, split the header, re-verify the
   header binding AND the content hash (mirrors Archive Import's own
   double-check) — any mismatch → `"manifest-mismatch"`, keep the Identity
   Part's restore (still valid — see §6 classification) but do not write
   any Data Part content.
4. On full success, write each included log's bytes to the fresh profile
   root's own matching leaf path (via `planFedosLocalProfilePaths()` on the
   NEW root) — never touch any file this format didn't explicitly include;
   never write into an existing non-empty profile.

## 6. Failure vocabulary (mirrors Archive Export/Import's own coarse,
stable shape)

`"restored"` (full), `"identity-only"` (Identity Part restored, Data Part
absent or explicitly skipped), `"wrong-secret"`, `"manifest-mismatch"`,
`"malformed"`, `"key-unavailable"`, `"failed"`. Never throws.
