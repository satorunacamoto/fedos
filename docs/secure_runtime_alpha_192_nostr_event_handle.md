# Secure Runtime Alpha 192 — FedosNostrEventHandle

**Status: this Stage IMPLEMENTS. It modifies exactly one file,
`packages/fedos-core-rust/src/lib.rs`, adding one new opaque type and
its own smart constructor. This is Stage 2 of the Alpha 191–200 Nostr
Event Foundation Arc, following Alpha 191's own decision on the
minimal canonical event representation.**

## 1. Why now

Alpha 191 §5 decided the exact five-field shape a FedOS Nostr Event
core needs. This Stage builds the Opaque Handle type that HOLDS that
shape — the SAME "type first, behavior in a later Stage" sequencing
`FedosNostrPublicKeyHandle` (Alpha 168, Handle) →
`derive_nostr_public_key_internal` (Alpha 169, behavior) and
`FedosNostrSignatureHandle` (Alpha 182, Handle) →
`derive_nostr_signature_internal` (Alpha 183, behavior) both already
established.

## 2. What was implemented

```rust
pub(crate) struct FedosNostrEventHandle {
    pubkey: nostr_identifier_encoding::FedosNostrPublicKeyHex,
    created_at: u64,
    kind: u64,
    tags: Vec<Vec<String>>,
    content: String,
}

impl FedosNostrEventHandle {
    fn new_for_internal_use(
        pubkey: nostr_identifier_encoding::FedosNostrPublicKeyHex,
        created_at: u64,
        kind: u64,
        tags: Vec<Vec<String>>,
        content: String,
    ) -> Self { ... }

    fn expose_fields_for_internal_canonical_serialization(
        &self,
    ) -> (&nostr_identifier_encoding::FedosNostrPublicKeyHex, u64, u64, &[Vec<String>], &str) { ... }
}

pub(crate) fn new_nostr_event_internal(
    pubkey: &FedosNostrPublicKeyHandle,
    created_at: u64,
    kind: u64,
    tags: Vec<Vec<String>>,
    content: String,
) -> Option<FedosNostrEventHandle> { ... }
```

Placed directly after `derive_nostr_signature_internal`'s own
`nostr_identifier_encoding` module closes, in `master_root` — reading
top-to-bottom as Public Key → Identifier Encoding → Event (the Event
depends on the Identifier Encoder, Alpha 191 §5's own REUSE decision).

## 3. Requirements — satisfied item by item

- **Opaque.** All five fields are module-private (no `pub`, not even
  `pub(crate)`) — unreachable from outside `master_root` by Rust's own
  privacy rules alone.
- **No `Clone`.** No `#[derive(Clone)]`, no manual `impl Clone`.
- **No `Debug`.** No `#[derive(Debug)]`, no manual `impl Debug`.
- **No `Serialize`.** No `serde::Serialize` derive or impl of any
  kind — `serde` remains `[dev-dependencies]`-only (Alpha 191 §4,
  unchanged).
- **No `wasm_bindgen`.** No `#[wasm_bindgen]` attribute anywhere on
  this type — confirmed by this Stage's own count check (§5): the
  crate's total stays fixed at 13.
- **No raw JSON export.** `expose_fields_for_internal_canonical_serialization`
  is the ONLY accessor, and it returns Rust VALUES (a tuple of
  references) — never a JSON string of any kind, and it is `fn`, not
  `pub(crate) fn`, reachable only from within `master_root` itself
  (its sole reviewed caller, `nostr_event_encoding`, Alpha 193, is a
  descendant module of `master_root` and can see this private method
  for the SAME Rust-privacy reason `nostr_identifier_encoding` can
  already see `FedosNostrPublicKeyHandle`'s own equivalent accessor).

## 4. The smart constructor — REUSES the existing Identifier Encoder,
   invents no second hex-encoding path

`new_nostr_event_internal` takes `&FedosNostrPublicKeyHandle` (the
SAME opaque type `derive_nostr_public_key_internal`, Alpha 169,
already produces) rather than a raw hex string, and calls the
EXISTING `nostr_identifier_encoding::encode_nostr_public_key_hex_internal`
(Alpha 173) internally to obtain the `pubkey` field — this crate never
computes a Nostr public key's own hex form two independent ways.
`created_at`/`kind` are taken verbatim as `u64`, `tags`/`content`
verbatim as owned `Vec<Vec<String>>`/`String` — no NIP-01 semantic
validation of any kind (Alpha 191 §5's own decision: this function
ASSEMBLES the five core fields, it does not judge their content).

Returns `Option<FedosNostrEventHandle>` — `None` only if encoding
`pubkey` ever fails, which is `ALWAYS Some today` since
`encode_nostr_public_key_hex_internal` itself already carries that
exact documented guarantee (Alpha 173) — matched exhaustively here
rather than assumed infallible, the same Fail-Closed discipline every
`derive_*_internal`/`new_*_internal` function in this module applies.
Does not mutate `pubkey` — borrowed, never consumed.

## 5. Structural confirmation (real inspection, this Stage)

- `#[wasm_bindgen]` count in `lib.rs`: fixed at 13, unchanged.
- `pub fn` count in `lib.rs`: fixed at 36, unchanged (`new_nostr_event_internal`
  is `pub(crate) fn`, not counted).
- `SecretHandleKind`/`HkdfDomain`'s own variant counts: unchanged —
  neither this type nor its constructor touches secret material or
  domain separation of any kind.
- Zero `derive(...)` attribute of any kind appears on
  `FedosNostrEventHandle`'s own struct declaration.
- Zero `&mut self` method exists anywhere on this type — confirmed
  again, independently, by Alpha 197's own Boundary Review.

## 6. What this Stage does NOT do

- Does **not** implement canonical serialization — Alpha 193's own
  deliverable (landed in the same `lib.rs` edit as this Stage, per
  this Arc's single-commit instruction).
- Does **not** implement Event ID generation or signing — Alpha
  194/195's own deliverables.
- Does **not** add any accessor exposing `pubkey`/`created_at`/`kind`/
  `tags`/`content` outside this type's own single private accessor.
- Does **not** add a `PartialEq`/`Eq`/`Hash` derive of any kind.
- Does **not** modify `src/desktop/*`, `src/identity/*`, `src/nostr/*`,
  `create_runtime.ts`, `types.ts`, `worker.ts`, Storage, Observation,
  `Cargo.toml`, or `package.json`.

## 7. See also

- `docs/secure_runtime_alpha_191_nostr_event_model_inventory.md`
- `docs/secure_runtime_alpha_182_nostr_signature_handle.md`
- `docs/secure_runtime_alpha_173_nostr_public_identifier_encoder.md`
- `docs/secure_runtime_alpha_168_nostr_public_key_handle.md`
