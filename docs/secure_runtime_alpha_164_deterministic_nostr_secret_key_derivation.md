# Secure Runtime Alpha 164 — Deterministic Nostr Secret Key Derivation

**Status: this Stage IMPLEMENTS. It modifies exactly one file,
`packages/fedos-core-rust/src/lib.rs`, and nothing else — no `src/`
file is touched. This is Stage 4 of the Alpha 161–165 Deterministic
Nostr Secret Key Derivation Arc, following Alpha 163's own addition of
`FedosNostrSecretKeyHandle`.**

## 1. Why now

Alpha 163 added the Handle type; this Stage adds the one function that
actually constructs a real one — `derive_nostr_secret_key_internal`,
implementing Alpha 162's own adopted Option B.

## 2. What was implemented

```rust
pub(crate) fn derive_nostr_secret_key_internal(
    nostr_root: &FedosProtocolRootHandle,
    account_index: u32,
) -> NostrSecretKeyDecision {
    let mut root_bytes = match nostr_root.expose_bytes_for_internal_nostr_secret_key_derivation() {
        Some(bytes) => bytes,
        None => return NostrSecretKeyDecision { status: NostrSecretKeyStatus::InvalidInput, output: None },
    };

    let hk = Hkdf::<Sha256>::new(Some(NOSTR_SECRET_KEY_SALT), &root_bytes);
    root_bytes.zeroize();

    let mut info = [0u8; NOSTR_SECRET_KEY_INFO_LEN];
    info[..NOSTR_SECRET_KEY_INFO_PREFIX.len()].copy_from_slice(NOSTR_SECRET_KEY_INFO_PREFIX);
    info[NOSTR_SECRET_KEY_INFO_PREFIX.len()..].copy_from_slice(&account_index.to_be_bytes());

    let mut candidate = [0u8; 32];
    let expand_result = hk.expand(&info, &mut candidate);
    // Ok(()) -> k256::SecretKey::from_slice(&candidate); Success on Ok,
    // InvalidScalar on Err. Err(_) from expand -> InternalFailure.
    // `candidate` is zeroized on every return path.
}
```

The exact signature matches the candidate the Objective itself named
(`derive_nostr_secret_key_internal(nostr_root: &FedosProtocolRootHandle,
account_index: u32) -> Option<FedosNostrSecretKeyHandle>`), with one
deliberate refinement: the return type is
`NostrSecretKeyDecision { status: NostrSecretKeyStatus, output:
Option<FedosNostrSecretKeyHandle> }`, not a bare `Option`, matching
EVERY other derivation function in this crate
(`IdentityRootDecision`, `ApplicationRootDecision`,
`ProtocolRootDecision`, `ConversationKeyDecision`) — a bare `Option`
would lose the distinction between "input was already cleared"
(`InvalidInput`) and "HKDF output failed `k256`'s own scalar
validation" (`InvalidScalar`), a distinction Alpha 165's own
verification plan explicitly requires being able to test.

## 3. HKDF construction — the exact byte layout

- **IKM (input key material):** the Nostr Root's own 32 bytes, exposed
  via the ONE new, narrowly-scoped accessor
  `FedosProtocolRootHandle::expose_bytes_for_internal_nostr_secret_key_derivation`
  (private to `master_root`, mirroring
  `expose_bytes_for_internal_protocol_root_derivation`'s own shape
  exactly), zeroized immediately after the `Hkdf::new` call consumes
  it.
- **Salt (fixed):** `NOSTR_SECRET_KEY_SALT = b"fedos-hkdf-salt-nostr-secret-key-v1"`
  — a NEW fixed compile-time constant, following the SAME
  `b"fedos-hkdf-salt-{domain}-v1"` shape every existing `HkdfDomain`
  variant already uses (Alpha 161 §2.14), one level deeper than
  `HkdfDomain::Nostr`'s own `b"fedos-hkdf-salt-nostr-v1"` — never the
  same salt, so a Nostr Root and a Nostr Secret Key derived under it
  are cryptographically unrelated beyond the one-way HKDF hop itself.
- **Info (fixed prefix + Account Index):**
  `NOSTR_SECRET_KEY_INFO_PREFIX = b"fedos-hkdf-info-nostr-secret-key-v1"`
  followed by EXACTLY 4 bytes, `account_index.to_be_bytes()`
  (`u32`, big-endian, fixed-width) — per Alpha 162 §5 / Alpha 143 §3,
  never ASCII decimal, never variable-length. Total `info` length is
  `NOSTR_SECRET_KEY_INFO_PREFIX.len() + 4`, a compile-time constant
  (`NOSTR_SECRET_KEY_INFO_LEN`).
- **Output length:** 32 bytes, matching secp256k1's own scalar size —
  decided by this function itself, per Alpha 143 §3's "output length:
  fixed per consuming protocol's own standard... decided by each
  Protocol Adapter" rule.
- **KDF primitive:** `Hkdf::<Sha256>::new(...)`/`.expand(...)` — the
  SAME `hkdf`/`sha2` crates, the SAME construction shape, as
  `kdf_core::derive_secret_handle_internal` and
  `crypto::conversation_key`'s own direct call — no second KDF
  implementation, no new cryptographic primitive of any kind.

## 4. Invalid-scalar handling — decided and implemented

Per Alpha 162 §6, four alternatives were named in this Arc's own
Objective:

- **A. Fail with `None`** — the HKDF output is rejected outright,
  nothing more is attempted.
- **B. Counter-based re-derivation** — retry with an incremented
  internal counter until a valid scalar is produced.
- **C. Modular reduction** — reduce the 32-byte candidate modulo the
  curve order to force it into range.
- **D. Existing-crate-recommended approach** — defer to whatever
  validation the crate's own already-adopted dependency provides.

**D, realized as A, is adopted; B and C are rejected outright.** `C`
is EXPLICITLY forbidden by this Arc's own Objective ("暗号学的に雑な
modulo処理を独自実装してはならない") — a hand-rolled modular reduction
is exactly the kind of ad hoc cryptographic code this crate has never
written anywhere, and reducing modulo the curve order changes the
statistical distribution of the resulting key, a property this crate
has no test vector or review basis to justify. `B` would be a NEW
algorithm (a retry loop with its own termination/counter-domain-
separation design) that no existing code in this crate implements or
has been reviewed for — Alpha 161 §2.2/§4 found no such precedent
anywhere. `D` — the existing crate's OWN recommended approach — is
`k256::SecretKey::from_slice`, which already performs the correct,
constant-time, RFC-correct range/non-zero check; calling it and
branching on `Ok`/`Err` IS mechanically Option A. This is the exact
same choice `crypto::conversation_key::derive_conversation_key_via_ecdh_internal`
already made for its own `sec1` input (Alpha 161 §2.2), reapplied here
without modification.

Concretely: `SecretKey::from_slice(&candidate)` — `Ok(_)` wraps
`candidate` in a new `FedosNostrSecretKeyHandle` and returns
`NostrSecretKeyStatus::Success`; `Err(_)` returns
`NostrSecretKeyStatus::InvalidScalar` with `output: None` — never a
panic (no `.unwrap()`/`.expect()` on this branch), never a second HKDF
call, never a loop.

## 5. Determinism and separation — the four required properties

- **Same Root + same Account Index → same key:** `Hkdf::<Sha256>` is a
  pure function of `(salt, IKM, info)`; all three are identical for
  two calls with the same Root bytes and the same `account_index`.
- **Same Root + different Account Index → different key:** `info`
  differs (the appended 4 big-endian bytes differ), and HKDF-Expand's
  own pseudorandomness makes distinct `info` values produce
  statistically independent output, per RFC 5869.
- **Different Root + same Account Index → different key:** the IKM
  differs; HKDF-Extract binds its output to the full IKM.
- **No raw secret byte leaves `master_root`:** `root_bytes`/`candidate`
  are local `[u8; 32]` arrays, `.zeroize()`-d on every return path;
  the function's own return type never contains a raw byte, only an
  opaque `FedosNostrSecretKeyHandle` or `None`.

## 6. What this Stage does NOT do

- Does **not** derive, return, or log a Nostr public key, `npub`,
  `nsec`, or signature.
- Does **not** implement a counter-based retry or a modular-reduction
  fallback for an invalid scalar (§4).
- Does **not** modify `kdf_core::derive_secret_handle_internal` or
  `HkdfDomain` — both are UNCHANGED; this function is a deliberately
  separate, direct HKDF call (Alpha 161 §2.14).
- Does **not** modify `src/desktop/*`, `src/identity/*`,
  `create_runtime.ts`, `types.ts`, `worker.ts`, Storage, Observation,
  any Protocol Adapter, `Cargo.toml`, or `package.json`.

## 7. See also

- `docs/secure_runtime_alpha_163_nostr_secret_key_handle.md`
- `docs/secure_runtime_alpha_162_nostr_account_derivation_decision.md`
- `docs/secure_runtime_alpha_161_existing_nostr_key_inventory.md`
- `docs/secure_runtime_alpha_143_domain_separation_decision.md`
