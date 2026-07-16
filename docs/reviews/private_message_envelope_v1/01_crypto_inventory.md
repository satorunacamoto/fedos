# 01 — Crypto Inventory (Current Source, All Seams)

Ground truth for every later section, re-derived by direct reading of
this worktree's own checked-out `src/` and `packages/fedos-core-rust/`
(base: `master` @ `9c1f52c`), not by memory of either prior review.
SEC §01 already inventoried Seams 1 and 2 in depth; this section
reconfirms both against this exact commit and adds two seams (3 and 4)
neither prior review investigated.

## Four independent, non-interoperating seams

### Seam 1 — `src/crypto/{types,noop_crypto,fedos_core_adapter,vault_bridge}.ts`: placeholder, confirmed unchanged

`CryptoProvider` (`src/crypto/types.ts:128-141`) declares
`getStatus`/`getCapabilities`/`randomBytes`/`deriveKey`/`encrypt`/`decrypt`,
every one resolving a `CryptoDecision` with **no output-bytes field** —
the file's own header states verbatim: *"NO real encryption, NO AEAD,
NO KDF/HKDF/Argon2, NO random generation... Decisions carry NO output
bytes: nothing is produced because nothing runs."* `NoopCryptoProvider`
(`noop_crypto.ts:27-69`) denies every operation unconditionally, always
returning `{ state: "unavailable" }`. `FedosCoreCryptoProvider`
(`fedos_core_adapter.ts:38-120`) is an adapter that would delegate to an
injected `FedosCoreCrypto` from `packages/fedos-core-rust/src/index.js`
— but its own header confirms it is *"NOT wired into the runtime or the
Worker. `create_runtime.ts`/`worker.ts` construct nothing from this
file"* — and no call site anywhere in `src/` ever injects a core. This
seam remains exactly as inert as SEC §01 found it.

### Seam 2 — `src/runtime/{fedos_runtime_encrypt,fedos_runtime_decrypt,fedos_runtime_aead_key_generation,fedos_runtime_ciphertext_storage}.ts` + `fedos_wasm_loader.ts`: real, gated, still unreachable in this tree

Re-confirmed directly (not merely re-cited from SEC): `fedos_wasm_loader.ts`
(4,289 lines) declares the real, opaque, `#[wasm_bindgen]`-shaped types:

```ts
// src/runtime/fedos_wasm_loader.ts
export interface AeadKeyHandle { readonly kind: "AeadKeyHandle"; }
export interface AeadCiphertextHandle { readonly kind: "AeadCiphertextHandle"; }
export type AeadAlgorithm = "ChaCha20Poly1305" | "Aes256Gcm";
export type AeadAadDomain = "RootKey" | "Identity" | "Storage" | "Conversation" | "TestOnly";
export type AeadCiphertextWire = string & { readonly __brand: "AeadCiphertextWire"; };
```

`fedos_runtime_encrypt.ts`/`fedos_runtime_decrypt.ts`/`fedos_runtime_aead_key_generation.ts`
each implement the same four-layer chain (Public Runtime API → Runtime
Service → Rust Boundary → Internal Rust), documented in each file's own
header, and each **fails closed to `null`** on any exception, an unmet
gate, or a wrongly-shaped return — confirmed by direct reading of
`encrypt()`/`decrypt()`/`generateAeadKey()`, all three wrapped in
`try`/`catch` returning `null`. `fedos_runtime_ciphertext_storage.ts`'s
`storeCiphertext`/`loadCiphertext`/`deleteCiphertext` never reach Rust
at all — they resolve `resolveRuntimeStorageBackend()`, which (per
`fedos_runtime_storage_backend.ts`, re-confirmed) only ever returns
`MemoryStorageBackend`, an in-process `Map`, non-persistent across
restarts. `WindowsDpapiStorageBackend`
(`fedos_runtime_storage_backend_windows_dpapi.ts`) is real but **not
wired into the resolver**.

**Gate status, reconfirmed this pass, directly:**

```
$ ls packages/fedos-core-rust/pkg
ls: cannot access 'packages/fedos-core-rust/pkg': No such file or directory
```

No compiled WASM artifact exists anywhere in this checked-out tree.
Every Runtime Service call in Seam 2 therefore resolves `null`
unconditionally today, regardless of `NODE_ENV` — matching SEC §01's
BLOCK-2 finding exactly, reconfirmed rather than assumed. See
`12_wasm_export_gap.md` for the export-surface detail and
`13_runtime_activation_gate.md` for the full activation checklist.

`packages/fedos-core-rust/src/crypto/conversation_key.rs` — re-grepped
this pass — still declares every conversation-key type/function
`pub(crate)`:

```
$ grep -n "^pub " packages/fedos-core-rust/src/crypto/conversation_key.rs
63:pub(crate) enum ConversationKeyState {
86:pub(crate) enum ConversationKeyKind {
100:pub(crate) enum ConversationKeyGeneration {
112:pub(crate) enum ConversationKeyStatus {
131:pub(crate) struct ConversationKeyDecision {
144:pub(crate) struct ConversationKey {
235:pub(crate) fn derive_conversation_key_via_ecdh_internal(
```

`nip44_public_api.rs`'s own `Nip44OpaqueStatus` still has exactly one
variant, `Unimplemented` — reconfirmed. No `#[wasm_bindgen]` attribute
exists on any conversation-key or NIP-44 item anywhere in
`packages/fedos-core-rust/src/lib.rs` (grepped: zero matches for
`wasm_bindgen` within two lines of `conversation`/`nip44`). SEC §01's
BLOCK-1 (real primitive, unexported) is reconfirmed, unchanged, at this
commit.

### Seam 3 — `src/runtime/crypto_provider.ts`: a third, independent placeholder — new finding, not investigated by either prior review

`RuntimeCryptoProvider` (Stage 249) is **not** `CryptoProvider` (Seam 1)
and **not** the real Seam 2 pipeline — its own header states this
explicitly: *"This is a SEPARATE seam from `src/crypto/types.ts`'s
`CryptoProvider` — never reused or merged with it... its method names
(`encrypt`/`decrypt`/`capabilities`/`status`) are deliberately distinct
from `CryptoProvider`'s... so the two are never confused at a glance."*
`RuntimeCryptoState` is `"Placeholder" | "NotConnected" | "Unsupported"`
— never `"available"`. `PlaceholderRuntimeCryptoProvider` is the only
implementation; it denies every `encrypt`/`decrypt` call, and its own
header confirms it *"calls no `packages/fedos-core-rust` function"* and
is *"not wired into `AppRuntime`/`createRuntime`/the Worker."* This is a
**third, dormant seam** — neither this review nor either prior review
found any caller anywhere in `src/` that constructs or reads a
`RuntimeCryptoProvider`. Any future Encryption Authority design
(`06_encryption_authority.md`) must not confuse this seam's `encrypt`/
`decrypt` method names with Seam 2's real, gated pipeline of the same
name — they share vocabulary, not implementation.

### Seam 4 — `src/storage/encrypted_payload.ts`: a label-only descriptor mirroring Rust's ciphertext-transport shape "by role, not by import"

`EncryptedPayloadDescriptor` (Stage 182–185) is a pure, label-only type
— `version: "v1"`, `algorithm: "chacha20poly1305" | "aes256gcm"`,
`encoding: "undecided" | "canonical_json_base64url_placeholder"`,
`transportKind: "storage" | "nostr_event"`, an optional opaque `idRef`,
and reviewed `metadata`. Its own header states it *"Mirrors this
repository's Rust-side `crypto::ciphertext_transport::CiphertextTransportDescriptor`
... ROLE for ROLE (not by importing/re-deriving from it — there is no
Rust↔TS bridge at all)."* `reviewEncryptedPayloadDescriptor` is pure and
**rejects** any `metadata` entry whose key or value contains
`buyer`/`chat`/`private`/`dm`/`body`/`content`/`message` (in addition to
`secret`/`key`/`seed`/`token`/`payment`/`entitlement`). This function is
not called by anything in `src/storage/noop_storage.ts` or any
federation adapter today — it is unwired, exactly like Seams 1 and 3.
See `02_storage_alignment.md` for what this means for a future envelope
persistence layer.

## Master Seed Authority — the one fully real, end-to-end-proven piece

`FedosMasterSeedAuthority` (`src/runtime/master_seed/fedos_master_seed_authority.ts`)
+ `FedosWasmMasterSeedAuthority` (`fedos_wasm_master_seed_authority.ts`) —
re-read in full this pass. The interface exposes only
`isAvailable`/`isCleared`/`generate`/`restoreSealed`/`seal`/`clear`,
every method `boolean`/`void`/a sealed envelope — **no raw-byte getter
exists anywhere**, confirmed by direct reading (no method returns
`Uint8Array`, and the file's own header states three "Permanent
Security Invariants" against ever adding one). `FedosWasmMasterSeedAuthority`
lazily constructs its WASM handle exactly once
(`#ensureConstructed()`), retains it across calls, and routes every
operation through a **narrow, injectable structural interface**
(`FedosMasterSeedWasmLoaderBoundary`, six methods) — this is the exact
pattern `06_encryption_authority.md` recommends reusing for a future
Encryption Authority. `fedos_sealed_master_seed_envelope.ts` confirms
the sealed envelope's own wire format (`{"v":1,"kdf":"argon2id",...}`)
is opaque even to this file — no field accessor of any kind exists, and
the file's own header states Rust is *"the sole AUTHORITATIVE parser of
this format."*

## Vault — `src/vault/*`, still fully placeholder, reconfirmed

`VaultBoundary`, `InMemoryVaultBoundary`, `NoopVaultBoundary` — every
method total, no method ever derives or stores a key/seed/passphrase.
`InMemoryVaultBoundary.unlock()` flips a coarse `locked`/`unlocked`
label only; its own comment states explicitly: *"PLACEHOLDER unlock:
flip state only. No KDF, no seed, no key."* Neither class is wired to
Seam 1, 2, or 3's crypto providers, or to the Master Seed Authority —
`src/crypto/vault_bridge.ts` is a pure, unwired capability-label mapper
between the two placeholder vocabularies only (Seam 1 ↔ Vault), never a
real connection.

## Answers to the seven questions this section must answer

1. **Reusable primitives**: real AEAD (ChaCha20-Poly1305/AES-256-GCM,
   Seam 2), real HKDF-SHA256 domain-separated derivation and Argon2id
   seed sealing (Master Seed Authority), real secp256k1 ECDH
   conversation-key derivation NIP-44-compatible (`conversation_key.rs`,
   `pub(crate)`-only) — all genuine, all reachable from TypeScript today
   only via Seam 2's gated path, and that path's own gate is closed for
   lack of a compiled WASM artifact in this tree.
2. **Existing conversation-key use**: none in production. Zero callers
   of `derive_conversation_key_via_ecdh_internal` anywhere.
3. **Secret leak path to TypeScript**: none found across any of the four
   seams — every raw key/seed stays behind an opaque WASM handle
   (`AeadKeyHandle`) or an Argon2id/AEAD-sealed envelope (`FedosSealedMasterSeedEnvelopeV1`);
   only already-ciphertext wire strings (`AeadCiphertextWire`) and
   opaque handle labels ever appear as plain TS values.
4. **Existing boundary that could store ciphertext**:
   `fedos_runtime_ciphertext_storage.ts`'s `storeCiphertext`/`loadCiphertext`
   (Seam 2), but non-persistent (`MemoryStorageBackend` only) and,
   confirmed by direct grep, zero cross-references between `src/board/`
   and `src/runtime/*` in either direction.
5. **Private message envelope**: none exists anywhere in `src/` under
   any name (`Envelope`, `Conversation`, or otherwise) — confirmed by
   this review's own repo-wide grep for `envelope`/`conversation`
   (results limited to Master Seed sealing, this file's own
   documentation comments, and unwired Seam-1/3/4 placeholder types).
6. **Key rotation/revocation**: none implemented anywhere in `src/`.
7. **Multi-recipient encryption**: none — the one real primitive
   (`conversation_key.rs`) is strictly pairwise (1:1) ECDH.

## See also

- `docs/reviews/private_conversation_security/01_existing_crypto_inventory.md`
- `docs/reviews/conversation_foundation_v1/07_private_readiness_gate.md`
- `12_wasm_export_gap.md`, `13_runtime_activation_gate.md`
