# Secure Runtime Alpha 6281–6360 — Migration Inventory

**FedOS Secure Memory Secret Buffer and Zeroization Foundation Arc**

Exhaustive record of every secret-bearing Rust type this Arc's own Phase A
inventory examined, and its exact disposition. See the reconciliation
report for the full per-type table this summarizes.

## Migrated this Arc

| Secret category | Type / field | Before | After |
|---|---|---|---|
| NIP-44 per-message stream-cipher-role key (32 bytes) | `Nip44MessageKeyDecision`'s `ChachaKey` entry | Raw, never-zeroized `Vec<u8>` | `SecretHandle` (kind `Nip44StreamKeyMaterial`) |
| NIP-44 per-message authentication-role key (32 bytes) | `Nip44MessageKeyDecision`'s `HmacKey` entry | Raw, never-zeroized `Vec<u8>` | `SecretHandle` (kind `Nip44HmacKeyMaterial`) |

## Deliberately NOT migrated to a handle (not confidential)

| Value | Reason |
|---|---|
| NIP-44 per-message nonce (12 bytes), `Nip44MessageKeyDecision`'s `ChachaNonce` entry | Transmitted on NIP-44's own wire payload; stream-cipher security depends on nonce UNIQUENESS, never nonce secrecy. Wrapping a value that was never confidential would misrepresent what "migrated" means. |
| `random_bytes_32()`'s WASM-exported CSPRNG output | General-purpose entropy export, not itself stored key material at rest — the CALLER decides what to do with it, including immediately wrapping it in a `SecretHandle` if it becomes a key. |
| Ciphertext/plaintext on every AEAD/Ratchet encrypt/decrypt WASM export | Not key material by definition. |

## Already compliant before this Arc (no code change needed)

| Secret category | Type | Evidence |
|---|---|---|
| Master Seed | `master_root::FedosMasterSeedHandle` | Wraps `SecretHandle`, kind `MasterSeedMaterial` |
| Identity Root | `master_root::FedosIdentityRootHandle` | Wraps `SecretHandle`, kind `IdentityRootMaterial` |
| Application Root | `master_root::FedosApplicationRootHandle` | Wraps `SecretHandle`, kind `ApplicationRootMaterial` |
| Protocol Root (Nostr/Session/ATProto/Wallet) | `master_root::FedosProtocolRootHandle` | Wraps `SecretHandle`, kind `ProtocolRootMaterial` |
| Nostr signing private key | `master_root::FedosNostrSecretKeyHandle` | Wraps `SecretHandle`, kind `NostrSecretKeyMaterial`; constant-time comparison via `subtle`, never raw `==` |
| NIP-44 conversation key | `crypto::conversation_key::ConversationKey` | Wraps `SecretHandle`, kind `ConversationKeyMaterial` |
| NIP-44 message key (Direct-Ratchet-adjacent, Stage 200/201) | `crypto::message_key::MessageKey` | Wraps `SecretHandle`, kind `MessageKeyMaterial` |
| Direct Ratchet root key | `DirectRatchetSessionState.root_key` | `SecretHandle`, kind `DirectRatchetRootKeyMaterial` |
| Direct Ratchet sending/receiving chain keys | `DirectRatchetSessionState.{sending,receiving}_chain_key` | `SecretHandle`, kind `DirectRatchetChainKeyMaterial` |
| Direct Ratchet skipped message keys | `DirectRatchetSkippedEntry.message_key` / `StoredSkippedKey.message_key` | `SecretHandle` |
| Direct Ratchet ephemeral DH private key | `DirectRatchetKeypair.private` | `SecretHandle`, kind `DirectRatchetPrivateKeyMaterial`; public half is separately, correctly non-secret |
| Master Seed / passphrase input at the WASM boundary | `FedosMasterSeedAuthority::seal`/`restore_sealed` | Already `&[u8]`, never `String`; local copies already zeroized after use |

## New infrastructure this Arc adds (not a "migration" of an existing
type — a new capability)

- `SecretHandleStore` — an opaque, generation-safe handle registry. No
  existing consumer was moved onto it; this Arc's own real vertical slice
  proves it against a freshly constructed handle instead (see the
  reconciliation report §8 and execution spec Phase L for the rationale).
- `PageLockingCapability`/`page_locking_capability()` — a status type,
  not a migration target.
- `SecureMemoryFoundationDiagnostics`/`secure_memory_foundation_diagnostics()`
  — a diagnostics composer, not a migration target.

## What a future Arc would need to do to close remaining gaps

1. **Wire a real, production `SecretHandleStore` instance somewhere in the
   running Runtime** (e.g. into `FedosMasterSeedAuthority` or a future
   per-Account secret registry) — this Arc deliberately did not attempt
   this (see "Do not attempt to retrofit every existing secret flow in one
   Arc," this Arc's own mission).
2. **Decide whether `SecretHandleId`/Store operations should ever cross the
   WASM boundary** — today they do not (Phase F, deliberately deferred).
3. **Native page locking**, if a native Desktop Rust host process is ever
   built (see the zeroization assurance document's own Phase J section) —
   currently `Unsupported`/`NotRequested` honestly, for every real build
   target this crate has.
