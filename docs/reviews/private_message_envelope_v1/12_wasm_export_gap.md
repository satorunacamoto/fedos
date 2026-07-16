# 12 — WASM Export Gap

## What is exported today, grep-verified against this exact commit

```
$ grep -c "wasm_bindgen" packages/fedos-core-rust/src/lib.rs
38
```

38 `wasm_bindgen` hits exist in `lib.rs` alone (more than SEC §01's own
cited "13 items" from an earlier Alpha 141 inventory — the real,
exported surface has grown since that snapshot, though this review does
not enumerate every one of the 38). Confirmed present among them, via
direct reading (`01_crypto_inventory.md`): `AeadKeyHandle`,
`AeadCiphertextHandle`, `generate_aead_key_handle`, `encrypt_aead`,
`decrypt_aead`, and the ciphertext export/import pair backing
`fedos_runtime_export_ciphertext.ts`/`fedos_runtime_import_ciphertext.ts`.
The Master Seed Authority's own methods (`generate`, `seal`,
`restore_sealed`, `clear`, `sign_nostr_event`) are exported as methods on
its own `#[wasm_bindgen]` struct.

## What is not exported — grep-verified, zero matches

```
$ grep -n "wasm_bindgen\]" -A1 packages/fedos-core-rust/src/lib.rs | grep -i "conversation\|nip44"
(no output)
```

Zero `#[wasm_bindgen]` attributes anywhere near a `conversation`- or
`nip44`-named item in `lib.rs`. Direct reading of
`conversation_key.rs` confirms every conversation-key type/function is
declared `pub(crate)`:

```
pub(crate) enum ConversationKeyState { ... }
pub(crate) enum ConversationKeyKind { ... }
pub(crate) enum ConversationKeyGeneration { ... }
pub(crate) enum ConversationKeyStatus { ... }
pub(crate) struct ConversationKeyDecision { ... }
pub(crate) struct ConversationKey { ... }
pub(crate) fn derive_conversation_key_via_ecdh_internal( ... )
```

`nip44_public_api.rs`'s own `Nip44OpaqueStatus` enum has exactly one
variant (`Unimplemented`), confirmed by direct reading — this is not an
oversight but a deliberate skeleton, per the file's own header: *"This
module adds NO public API. Every item here is `pub(crate)`... names the
LABEL VOCABULARY a future implementation would use, before writing any
real behavior behind it."*

## The export gap is layered under a more basic gap: no compiled artifact exists at all

Even if `derive_conversation_key_via_ecdh_internal` were exported today,
it would still be unreachable from TypeScript in this tree, because:

```
$ ls packages/fedos-core-rust/pkg
ls: cannot access 'packages/fedos-core-rust/pkg': No such file or directory
```

No compiled WASM artifact exists anywhere in this checked-out tree.
`package.json` already names the build command that would produce one:

```json
"build:wasm": "cargo build --manifest-path packages/fedos-core-rust/Cargo.toml --target wasm32-unknown-unknown --release && wasm-bindgen --target web --out-dir packages/fedos-core-rust/pkg packages/fedos-core-rust/target/wasm32-unknown-unknown/release/fedos_core_rust.wasm"
```

This script exists and is runnable — this review does not run it (a
build step, not a review action, and outside this review's own
review-only mandate) — but its existence confirms the tooling to close
this half of the gap is already present in the repository, unlike the
Rust-side export change, which requires an actual source edit to
`conversation_key.rs`/`nip44_public_api.rs`/`lib.rs`.

## Two independent gaps, not one — restated precisely

1. **Export gap** (Rust source change): add a `#[wasm_bindgen]`-exposed
   function wrapping `derive_conversation_key_via_ecdh_internal`,
   following the exact pattern `generate_aead_key_handle`/`encrypt_aead`
   already establish (opaque handle in, opaque handle out, no raw byte
   crossing the boundary). SEC §01/§20 (BLOCK-1) already characterized
   this correctly as "narrowly an EXPORT task... not a from-scratch
   cryptography problem" — reconfirmed unchanged at this commit.
2. **Build-artifact gap** (tooling, not source): run `npm run build:wasm`
   (or equivalent CI step) to produce `packages/fedos-core-rust/pkg/` in
   whatever tree ships this feature. SEC §01/§20 (BLOCK-2) — reconfirmed
   absent, unchanged.

Both must close before `06_encryption_authority.md`'s
`resolveConversationKey()` can be real. Neither alone is sufficient.

## See also

- `docs/reviews/private_conversation_security/01_existing_crypto_inventory.md`
- `01_crypto_inventory.md`, `13_runtime_activation_gate.md`
