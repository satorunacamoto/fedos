# Secure Runtime Alpha 194 — Deterministic Event ID Generation

**Status: this Stage IMPLEMENTS. It modifies exactly one file,
`packages/fedos-core-rust/src/lib.rs` (the same file edit as Alpha
192/193 — this Arc lands as a single commit). This is Stage 4 of the
Alpha 191–200 Nostr Event Foundation Arc, following Alpha 193's own
canonical serialization Encoder.**

## 1. Why now

Alpha 193 produces the canonical pre-image text; this Stage hashes
ONLY that text, producing NIP-01's own `id` — "the sha256 of the
serialized event data" (Alpha 191 §2, quoted from the spec directly).

## 2. What was implemented

```rust
pub(crate) fn derive_nostr_event_id_internal(event: &FedosNostrEventHandle) -> Option<[u8; 32]> {
    let canonical = nostr_event_encoding::serialize_nostr_event_canonical_internal(event);
    let digest = Sha256::digest(canonical.as_bytes());
    let mut id = [0u8; 32];
    id.copy_from_slice(&digest);
    Some(id)
}
```

`use sha2::{Digest, Sha256};` added to `master_root`'s own top-level
`use` list (previously only `Sha256` itself was imported, for
`Hkdf::<Sha256>`) — the SAME `Sha256::digest(bytes)` call shape
`crypto::nip44_hmac` (Stage 231) already established, reused verbatim.

## 3. Hashes ONLY the canonical serialized event — nothing else

`derive_nostr_event_id_internal`'s own input to `Sha256::digest` is
`canonical.as_bytes()` — the UTF-8 bytes of Alpha 193's own output,
and NOTHING else: no length prefix, no domain-separation tag, no
salt, no additional context of any kind. This matches NIP-01's own
rule exactly, and is DELIBERATELY DIFFERENT from every HKDF-based
derivation elsewhere in this module (which always mix in a fixed
salt/info context, Alpha 143 §3) — an Event ID is a content hash of a
public value, not a key-derivation output, and this function does not
confuse the two.

## 4. Fail Closed — `Option<[u8; 32]>`, matched exhaustively

Returns `Option<[u8; 32]>` rather than a bare `[u8; 32]`, following
this crate's own established Fail-Closed convention EVERY
`derive_*_internal` function in `master_root` applies — even here,
where no currently-reachable failure path exists: canonical
serialization (Alpha 193) is a pure, total function over any valid
`FedosNostrEventHandle`, and `Sha256::digest` never fails for any
input length. This is the SAME "`ALWAYS Some today`, matched
exhaustively rather than assumed infallible" shape
`nostr_identifier_encoding::encode_nostr_public_key_hex_internal`
(Alpha 173) already set as this crate's own precedent (Alpha 192 §4
restated it one Stage ago, for `new_nostr_event_internal`) — the
`Option` return preserves this function's own Fail-Closed discipline
for any future change that reintroduces a real failure path, rather
than silently becoming infallible and losing that guarantee.

Does not mutate `event` — borrowed, never consumed, so the SAME event
can have its own ID recomputed any number of times, always
identically — confirmed by Alpha 196's own real-execution test
(`same_event_fields_derive_identical_event_ids`), not merely asserted
here.

## 5. Structural confirmation (real inspection, this Stage)

- `#[wasm_bindgen]` count in `lib.rs`: fixed at 13, unchanged.
- `pub fn` count in `lib.rs`: fixed at 36, unchanged.
- `derive_nostr_event_id_internal`'s own body contains no `unwrap()`,
  `expect()`, `panic!()`, `todo!()`, or `unimplemented!()`.
- `derive_nostr_event_id_internal`'s own body calls
  `Sha256::digest` exactly once, on `canonical.as_bytes()` — no second
  hash call, no additional input mixed in.
- Alpha 196's own real-execution tests confirm determinism
  (`same_event_fields_derive_identical_event_ids`) and separation for
  EVERY one of the five core fields independently
  (`different_content_derives_different_event_id`,
  `different_created_at_derives_different_event_id`,
  `different_kind_derives_different_event_id`,
  `different_tags_derives_different_event_id`,
  `different_pubkey_derives_different_event_id`) — six tests, not
  merely the two this Arc's own instruction named as its own minimum
  bar.

## 6. What this Stage does NOT do

- Does **not** implement signing — Alpha 195's own deliverable (landed
  in the same `lib.rs` edit as this Stage).
- Does **not** implement Event ID verification (recomputing an ID from
  an already-received event and comparing) — that already exists,
  TypeScript-side, as `verifyEventId` (Alpha 1, unrelated, unchanged)
  — this Stage is the OUTBOUND-generation counterpart, never a
  replacement.
- Does **not** add a new hashing algorithm — `sha2`'s own `Sha256`
  type, already a production dependency since Alpha 164, is reused
  verbatim.
- Does **not** modify `src/desktop/*`, `src/identity/*`, `src/nostr/*`,
  `create_runtime.ts`, `types.ts`, `worker.ts`, Storage, Observation,
  `Cargo.toml`, or `package.json`.

## 7. See also

- `docs/secure_runtime_alpha_193_canonical_event_serialization.md`
- `docs/secure_runtime_alpha_192_nostr_event_handle.md`
- `docs/secure_runtime_alpha_191_nostr_event_model_inventory.md`
