# Secure Runtime Alpha 1541–1610: Conversation Export, Restore, Archive Foundation — Execution Spec

Architecture frozen. This Arc adds no new Rust/WASM primitive, no new `AeadAadDomain` variant, no new key-derivation domain, no Host/GUI wiring, no Cloud/Sync transport. It is a pure TypeScript orchestration layer over five already-existing, already-frozen conversation domains.

## Scope

**Reuse** (consumed as-is, unmodified except one additive port method — see below):
- Conversation Persistence (`src/conversation/persistence/`, Alpha 749/750)
- Envelope (`src/conversation/envelope/`, Alpha 854/858)
- Payload (`src/conversation/payload_storage/`, Alpha 803/804/806)
- Membership (`src/conversation/membership/`, Alpha 825/827)
- Capability (`src/conversation/capability/`, Alpha 833/836/837)

**Implement** (new, under `src/conversation/archive/`):
- Encrypted Export / Encrypted Import (`fedos_conversation_archive_encryption.ts`)
- Manifest (`fedos_conversation_archive_manifest.ts` / `_manifest_codec.ts`)
- Integrity (`fedos_conversation_archive_integrity.ts`)
- Schema Version (`fedos_conversation_archive_schema_version.ts`)
- Restore (`fedos_conversation_archive_restore.ts`)
- Duplicate Detection (`fedos_conversation_archive_duplicate_detection.ts`)

Plus two supporting files not separately named in the spec but required by it: the Bundle aggregate type + canonical codec (`fedos_conversation_archive_bundle.ts` / `_bundle_codec.ts`), the read-side Collector (`fedos_conversation_archive_collector.ts`), and the Archive Header (`fedos_conversation_archive_header.ts`, reusing Alpha 856's prefix-then-encrypt technique).

No Cloud, no Sync, no GUI: nothing in this Arc performs network I/O, nothing polls or pushes to a remote peer, and no file-path/Host/UI wiring exists — `export()`/`import()` accept and return in-memory bytes/objects only, mirroring `FedosMasterSeedAuthority`'s own Alpha 439 "Option E" deferral (persistence ownership is a later, separate Host-wiring Arc's job).

## Key design decisions

1. **Encryption key**: an Archive is sealed under the SAME per-conversation `AeadKeyHandle` `FedosMasterSeedAuthority.resolveConversationKey()` already derives for that conversation's own Envelopes (Alpha 869) — never a new passphrase or key-derivation domain. Consequence, stated plainly: you can decrypt an Export iff you can already decrypt that conversation. A passphrase-protected backup (independent of live conversation-key availability) is explicitly OUT of this Arc's scope — Architecture Frozen forbids adding the generic Argon2id-over-arbitrary-bytes primitive that would require.

2. **AAD domain**: reuses the existing `"Conversation"` `AeadAadDomain` — no new Rust-side enum variant. Identity binding (which conversation/export this ciphertext belongs to) is achieved via the SAME prefix-then-encrypt technique Alpha 856 already established for Envelopes (`fedos_conversation_archive_header.ts`), not native AAD.

3. **Membership export granularity**: the CURRENT record per id (`listConversationMemberships()`), not raw `(id, state)` history — that port exposes no raw-event listing, and the current record alone is sufficient to reconstruct correct present-day membership status on Restore.

4. **Capability export granularity**: RAW `"issued"`/`"redeemed"` events, via one additive port method, `listConversationCapabilityEvents()` — added to `FedosConversationCapabilityPersistence` and both its backends (`InMemoryFedosConversationCapabilityPersistence`, `AppendOnlyFedosConversationCapabilityPersistence`), mirroring `hasRedeemedEvent()`'s own Alpha 841 additive-port precedent. A reconstructed record's `currentUses` is a COUNT only; replaying just that count back into a fresh backend on Restore would lose WHICH distinct redeemers already used a slot, silently permitting a double-redemption after restore — a real correctness/security gap the raw-events approach closes.

5. **Restore ≠ new persistence logic**: every write goes through the five EXISTING ports' own `put*` methods and reuses their own EXISTING `deserializeX`/`serializeX` codec pair for deep, per-record validation — Restore never re-implements a single field check.

6. **Duplicate Detection ≠ a new outcome vocabulary**: `"already-present"`/`"conflict"` are this codebase's OWN pre-existing write-result vocabulary (Alpha 315/749/804/827/837/857). Restore's own outcome tally surfaces it as a side effect of writing; a separate, purely read-only preflight (`detectFedosConversationArchiveDuplicates`) surfaces the identical distinction via each port's existing `get*`/`has*` methods, without ever calling a `put*`.

7. **Integrity**: SHA-256 (`@noble/hashes`, an existing dependency) content hash over the canonical bundle bytes, carried in the cleartext Manifest. Verified twice on Import: once via the Archive Header (identity), once by re-hashing the decrypted bundle and comparing (content) — a distinct `"manifest-mismatch"` outcome, kept separate from AEAD's own undifferentiated `"failed"`.

## Deliberately out of scope (named, not silently dropped)

- Passphrase-protected export independent of conversation-key availability.
- Any Host/file-path/GUI wiring for where exported bytes are written or imported from.
- Cross-device sync, cloud upload, or any network transport.
- Draft (private, not-yet-active) conversation records (`src/conversation/construction/`) — this Arc covers the canonical, active `FedosConversationPersistence` record only.
- A dedicated Rust-side AAD domain for Archives — reuses `"Conversation"` per Architecture Frozen.
