# Secure Runtime Alpha 6441–6520 — Migration Inventory

**FedOS Secure Memory Secret-Flow Migration and Native Page-Locking
Readiness Arc**

Continues directly from `33f29f2` (Secure Runtime Alpha 6281–6360). Full
Phase A inventory of every remaining production secret category the
mission named, classified.

## Classification legend

- **Already migrated** — already `SecretHandle`-backed before this Arc.
- **Migration candidate** — real, concrete, non-`SecretHandle` secret
  storage found; addressed in Phase B below.
- **Deferred** — a real gap exists but is out of this Arc's own bounded
  scope (named explicitly, not silently dropped).
- **Out of scope** — the category does not exist in this Rust crate at
  all (either TypeScript-side only, or not implemented anywhere yet).

## Inventory table

| Category | Type / field | Classification | Detail |
|---|---|---|---|
| Identity signing keys | `master_root::FedosNostrSecretKeyHandle` | Already migrated | Wraps `SecretHandle`, kind `NostrSecretKeyMaterial`; unchanged this Arc |
| Master Seed | `master_root::FedosMasterSeedHandle` | Already migrated | Wraps `SecretHandle`, kind `MasterSeedMaterial`; unchanged this Arc |
| Identity/Application/Protocol Root | `master_root::Fedos{Identity,Application,Protocol}RootHandle` | Already migrated | All wrap `SecretHandle`; unchanged this Arc |
| Device signing keys | — | Out of scope | No `DeviceSigning`/`device_signing`/`DevicePrivateKey`-shaped type exists anywhere in `packages/fedos-core-rust/src/` — this concept, if it exists at all, is TypeScript/Desktop-side only, outside this crate's boundary |
| **Ratchet root key (in-memory)** | `DirectRatchetSessionState.root_key` | Already migrated | `SecretHandle`, kind `DirectRatchetRootKeyMaterial` |
| **Ratchet chain keys (in-memory)** | `DirectRatchetSessionState.{sending,receiving}_chain_key` | Already migrated | `SecretHandle`, kind `DirectRatchetChainKeyMaterial` |
| **Ratchet root/chain/private/skipped keys — SEAL/RESTORE BOUNDARY** | `FedosDirectRatchetSession::seal_*`/`restore` (`lib.rs`), `DirectRatchetSessionState::restore` (`crypto/direct_ratchet_session.rs`) | **Migration candidate — CLOSED this Arc** | Raw `[u8; 32]` locals (seal path: bytes exposed from a `SecretHandle` for one-shot AEAD sealing) and a raw `Vec<u8>` (restore path: AEAD-decrypted plaintext) crossed multiple stack/heap locations without ever being explicitly zeroized — see Phase B |
| Sender keys (group messaging) | — | Out of scope | No `SenderKey`/`sender_key`/`SenderChain` type exists anywhere in this crate — no group Sender-Key primitive is implemented in Rust at all |
| Archive wrapping keys | — | Out of scope | No `Archive`-named type exists anywhere in this crate. The only `wrapping_key` in this crate is `fedos_derive_master_seed_wrapping_key_argon2id`'s Master-Seed-envelope wrapping key (unrelated to Archive) — already `SecretHandle`-wrapped, and its raw intermediate bytes already explicitly `.zeroize()`d at both call sites; Archive itself is entirely TypeScript-side |
| Capability secrets | — | Out of scope | No `Capability`+`Secret` combined type exists in this crate; the only match is the `CryptoCapability::SecretHandle` label (naming the capability, not a bearer-token type). `FedosConversationCapabilityBearerSecret` is TypeScript-side, non-cryptographic, and explicitly out of `SecretHandle`/`Secret<T>` scope per `docs/runtime_secure_memory.md` §16 |
| Deletion signing keys | — | Out of scope | No `Deletion`-related type exists anywhere in `packages/fedos-core-rust/src/` — deletion request signing is entirely TypeScript-side (`src/conversation/deletion_request/`), outside this crate's boundary |
| NIP-44 conversation key | `crypto::conversation_key::ConversationKey` | Already migrated | Wraps `SecretHandle`, kind `ConversationKeyMaterial`; unchanged this Arc |
| NIP-44 per-message keys | `Nip44MessageKeyDecision.handle` | Already migrated (prior Arc, 6281-6360) | `Nip44StreamKeyMaterial`/`Nip44HmacKeyMaterial`; unchanged this Arc |

## Phase B — what was actually migrated this Arc

**The Direct Ratchet seal/restore boundary**, matching the mission's own
"Ratchet chain keys / Ratchet root keys" category exactly — this is where
the real, previously-undetected gap lived, not in the in-memory session
state itself (already fully `SecretHandle`-backed before this Arc began).

### Seal path (`FedosDirectRatchetSession::seal_root_key`/`seal_sending_chain_key`/`seal_receiving_chain_key`/`seal_local_ratchet_private_key`/`seal_all_skipped_keys`, `lib.rs`)

Each method pulls a raw `[u8; 32]` copy out of the session's own
`SecretHandle` (via the existing, unchanged
`expose_bytes_for_internal_ratchet_state_sealing` accessor), passes it by
reference into `FedosMasterSeedAuthority::seal_direct_ratchet_secret`, and
previously returned without ever zeroizing that local copy. Fixed: every
method now zeroizes its own `bytes` local immediately after the seal call
completes, on every path (including `seal_all_skipped_keys`'s own
`filter_map` closure, one `bytes` local per skipped key).

### Restore path (`FedosDirectRatchetSession::restore`, `lib.rs`; `DirectRatchetSessionState::restore`, `crypto/direct_ratchet_session.rs`)

Two layers of un-zeroized copies, fixed independently:

1. **`restore_32` (lib.rs, nested helper)** — `FedosMasterSeedAuthority::restore_direct_ratchet_secret`
   returns the AEAD-decrypted plaintext as an owned, heap-allocated
   `Vec<u8>`. Previously copied into a `[u8; 32]` array and dropped
   un-zeroized on EVERY path (both the length-mismatch failure path and
   the success path). Fixed: `.zeroize()` on both exit paths — this is
   the highest-value fix in this Arc, since a heap `Vec<u8>` persists in
   allocator-managed memory longer than an ephemeral stack array.
2. **`restore()`'s own `[u8; 32]`/`Option<[u8; 32]>` locals (lib.rs)** —
   `root_key_bytes`/`sending_chain_key_bytes`/`receiving_chain_key_bytes`/
   `local_ratchet_private_key_bytes` are `Copy` types; passing them by
   value into `DirectRatchetSessionState::restore` does not clear the
   caller's own stack copy. Fixed: zeroized in `lib.rs` immediately after
   that call, in addition to `DirectRatchetSessionState::restore` (crypto/
   direct_ratchet_session.rs) now ALSO zeroizing its own received
   parameter copies right after each is wrapped in a `SecretHandle` —
   matching this crate's "every consumer zeroizes its own copy, at every
   hop" convention, not just the last one.

### Explicitly NOT closed this Arc (named, not silently dropped)

The `skipped_keys: Vec<([u8; 32], u32, i64, [u8; 32])>` parameter itself
(lib.rs → `direct_ratchet_session.rs::restore`) is moved by value across
that one function boundary; its PER-ENTRY `Vec<u8>` HEAP plaintext source
was already zeroized in `restore_32` (the higher-value fix, applied
per-skipped-key too, since each skipped key's sealed blob is restored via
its own `restore_32` call). The remaining gap — the brief STACK-level
`[u8; 32]` copy each tuple element represents while temporarily inside
that moved `Vec`, before `direct_ratchet_session.rs`'s own destructuring
loop zeroizes its own copy — is a narrower, lower-value remainder than the
heap-plaintext fix already applied. Closing it fully would require either
restructuring the Vec-of-tuples representation (a redesign this Arc's own
mission prohibits: "Do not redesign SecretHandle. Do not redesign
Runtime.") or accepting marginal additional complexity for a
stack-only, single-digit-count, short-lived copy. Named explicitly here
rather than silently treated as closed.

## What was NOT touched (explicitly out of this Arc's own scope)

- `SecretHandle` itself — unmodified.
- `SecretHandleStore` (prior Arc) — unmodified, still not wired into any
  production Runtime path (see the prior Arc's own completion declaration
  for why — unchanged this Arc).
- Every already-compliant category in the table above.
- Desktop Safety Center — not read, not touched, per explicit mission
  instruction.
