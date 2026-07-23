# Secure Runtime Alpha 6601–6680 — Production Secret-Flow Map

**FedOS Secure Memory Store Production Wiring Arc**

## The real production path, end to end

```
Bounded passphrase bytes (&[u8], TypeScript already passes Uint8Array
across the WASM boundary, unchanged by this Arc)
  │
  ▼
FedosMasterSeedAuthority::generate()  (fresh CSPRNG)
  or
FedosMasterSeedAuthority::restore_sealed(envelope, passphrase)  (AEAD-unseal)
  │
  ▼
SecretHandle::new_from_32_bytes_for_internal_use(MasterSeedMaterial, bytes)
  │  (the ORIGINAL CSPRNG/decrypted-plaintext local is zeroized
  │   immediately after this line, every path)
  ▼
SecretHandleStore::with_capacity(1)  ← constructed fresh, ONE per Authority
  │
  ▼
store.insert(secret_handle) → SecretHandleId
  │
  ▼
FedosMasterSeedAuthorityState::Available { store, master_seed_id }
  │  (the Authority's ONLY state field; SecretHandleId never leaves it)
  │
  ├──▶ sign_nostr_event()             ──▶ with_master_seed(closure) ──▶ signature JSON
  ├──▶ public_key_hex_for_account()   ──▶ with_master_seed(closure) ──▶ public key hex
  ├──▶ resolve_conversation_key()     ──▶ with_master_seed(closure) ──▶ AeadKeyHandle (opaque)
  ├──▶ encrypt_nip44_wire()           ──▶ with_master_seed(closure) ──▶ wire payload string
  ├──▶ decrypt_nip44_wire()           ──▶ with_master_seed(closure) ──▶ plaintext bytes
  ├──▶ seal_direct_ratchet_secret()   ──▶ with_master_seed(closure) ──▶ sealed blob string
  ├──▶ restore_direct_ratchet_secret()──▶ with_master_seed(closure) ──▶ raw ratchet bytes*
  └──▶ seal()                         ──▶ with_master_seed_bytes(f)  ──▶ sealed envelope JSON

  * `restore_direct_ratchet_secret`'s own `Vec<u8>` return is consumed
    ENTIRELY inside `crypto::direct_ratchet_session.rs`'s own `restore()`
    (prior Arc, 6441-6520, already zeroizes it on every exit path) —
    never returned to TypeScript; it is a Rust-to-Rust internal boundary.

  │
  ▼
clear()  ──▶  store.destroy(master_seed_id)  ──▶  Cleared (terminal)
  │
  ▼
Drop (backstop) — SecretHandleStore::drop() zeroizes any still-live slot
```

## What crosses the Rust→TypeScript boundary at each production method

| Method | Returns to TypeScript | Ever a raw secret byte? |
|---|---|---|
| `sign_nostr_event` | Signed NIP-01 event JSON `String` | No |
| `public_key_hex_for_account` | 64-char hex public key `String` | No — public key, not secret |
| `resolve_conversation_key` | Opaque `AeadKeyHandle` (a WASM class, no raw-byte accessor) | No |
| `encrypt_nip44_wire` | NIP-44 wire payload `String` (ciphertext) | No |
| `decrypt_nip44_wire` | Plaintext `Vec<u8>` — the DECRYPTED MESSAGE, never the key | No (message content, not key material) |
| `seal_direct_ratchet_secret` | Opaque sealed blob `String` (AEAD ciphertext) | No |
| `restore_direct_ratchet_secret` | Raw `Vec<u8>` — but this method is called ONLY from `FedosDirectRatchetSession::restore` (Rust-to-Rust, `lib.rs`), never directly from TypeScript in this crate's own production wiring | No, in practice — see note below |
| `seal` | Sealed Master Seed envelope JSON `String` | No — AEAD ciphertext |
| `restore_sealed` | `bool` | No |
| `is_available`/`is_cleared` | `bool` | No |

**Note on `restore_direct_ratchet_secret`'s own public signature**: it IS
a `pub fn` on a `#[wasm_bindgen]` type, so it is technically WASM-callable
directly. This is UNCHANGED by this Arc (it was already `pub fn`
returning `Option<Vec<u8>>` before this Arc) — this Arc's own scope is
the Master Seed's ownership model, not re-auditing whether this
particular pre-existing method's own return type should be narrowed. It
is named here explicitly, not silently passed over, as a boundary this
Arc did not close (see the completion declaration's own "deferred, not
closed" section).

## Ownership summary

- **Exactly one Secret Buffer of Master-Seed-shaped material exists at
  any time per running Authority** — inside the Store, addressed by
  `master_seed_id`. No second, parallel copy is ever held as a struct
  field.
- **Every consumer gets a scoped, temporary, zeroized COPY** — never a
  reference into the Store's own held bytes, never a second
  independently-owned `SecretHandle`.
- **The Store itself is never exposed** — not to TypeScript (it is never
  WASM-bound), not even to other Rust modules (`master_seed_id`/`store`
  are private fields of `FedosMasterSeedAuthority` alone).
