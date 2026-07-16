# 01 — Existing Secret and Encryption Inventory

Ground truth for every later section, confirmed by direct source
reading (file:line references throughout), not inferred from class
names. **Class names alone are not trusted anywhere in this review** —
per this review's own instruction, every claim below was checked
against the actual function body or a direct quote of its own guardrail
comment.

## Two separate, non-overlapping crypto seams

### Seam 1 — `src/crypto/{types,noop_crypto,fedos_core_adapter}.ts`: confirmed still fully placeholder

`CryptoProvider` (`src/crypto/types.ts:128-141`) — `getStatus`,
`getCapabilities`, `randomBytes`, `deriveKey`, `encrypt`, `decrypt`,
every one `Promise<CryptoDecision>`. File header (lines 12-21), quoted
verbatim: *"NO real encryption, NO AEAD, NO KDF/HKDF/Argon2, NO random
generation, NO BIP39/BIP32, NO NIP-44, NO zeroize, NO key
generation/derivation here... Decisions carry NO output bytes: nothing
is produced because nothing runs."* `NoopCryptoProvider`
(`noop_crypto.ts:27-69`) denies every operation unconditionally.
`fedos_core_adapter.ts:10-23`: *"NOT wired into the runtime or the
Worker. `create_runtime.ts`/`worker.ts` construct nothing from this
file."* **This seam remains exactly as inert as the prior reviews
found it.**

### Seam 2 — `packages/fedos-core-rust/` + `src/runtime/fedos_runtime_*.ts`: real, working, gated

Neither prior review inspected this seam. It is materially more
developed than Seam 1 and must not be confused with it.

## 1. Rust AEAD implementation — real, not a stub

`packages/fedos-core-rust/src/crypto/aead_internal.rs:260-368` —
`seal_internal`/`open_internal` call `ChaCha20Poly1305`/`Aes256Gcm`
(RustCrypto crates, real `[dependencies]` in `Cargo.toml:87,154`, not
dev-only) directly. Keys reach the cipher only via
`SecretHandle::expose_bytes_for_internal_aead()`, zeroized immediately
after. A `#[cfg(test)]` suite (lines 370-616) round-trips both ciphers
and asserts tamper/wrong-nonce/wrong-AAD/wrong-key all collapse to one
undifferentiated `AeadStatus::AuthenticationFailed` (RFC 8439/NIST
discipline — no oracle). Exposed as a public crate API,
`fedos_encrypt`/`fedos_decrypt` (`lib.rs:9266,9357`), then
re-exposed across `#[wasm_bindgen]` (`lib.rs:9604,9716`).

## 2. `AeadKeyHandle`/`AeadCiphertextHandle` — genuine opaque handles

Rust side (`lib.rs:9469-9548`): `#[wasm_bindgen] pub struct AeadKeyHandle`,
*"Deliberately NOT `Clone`... NOT `Debug`/`Display`... NOT `Serialize`.
No public raw-byte getter and no `AsRef<[u8]>` exist anywhere on this
type."* Exactly one method, `kind()`, a fixed label string. TS side
(`src/runtime/fedos_wasm_loader.ts:1267-1268`):
```ts
export interface AeadKeyHandle { readonly kind: "AeadKeyHandle"; }
export interface AeadCiphertextHandle { readonly kind: "AeadCiphertextHandle"; }
```
No raw byte ever crosses into a plain TS variable — the real value is
an opaque wasm-bindgen class instance; TS only structurally checks
`.kind`. The one plain-string value that DOES carry real content is
`AeadCiphertextWire` (a branded `string`, the JSON+base64url wire
format) — ciphertext as text, never a key, never plaintext.

## 3. Master Seed Authority — real, generated, never exposes raw bytes

`FedosMasterSeedAuthority` (`lib.rs:10123-10414`) — `generate()` draws
32 real CSPRNG bytes (`getrandom::fill`); `seal(passphrase)` derives a
wrapping key via **real Argon2id** and AEAD-seals the seed under a
dedicated `AeadAadDomain::MasterSeedSealing` domain; `restore_sealed()`
is the fail-closed inverse; `clear()` zeroizes irreversibly. *"an
opaque wrapper struct, ZERO derives... no raw-byte getter of any kind,
and every mutating operation fails closed rather than overwriting live
state"* (lines 10111-10125). TS side, `FedosWasmMasterSeedAuthority`
(`src/runtime/master_seed/fedos_wasm_master_seed_authority.ts`), file
header: *"never exposes it [the WASM handle]... never logs `passphrase`
or envelope contents."*

## 4. Protocol-root / conversation-key derivation — real HKDF chain; real, but unexported, conversation key

Real HKDF-SHA256 chain (`kdf_core`, `lib.rs:2537-2612`,
`derive_secret_handle_internal`), root hierarchy `Master Seed →
Identity Root → Application Root → Protocol Roots (Nostr/Session/
ATProto/Wallet)` (`master_root`, `lib.rs:3054-3450`), never
`#[wasm_bindgen]`-exposed at any intermediate level (regression-guarded
by its own comment, line 10118-10121). From the Nostr Root, real
secp256k1 signing key derivation feeds `sign_nostr_event`
(`lib.rs:10381-10413`).

**A real "conversation key" concept already exists**
(`packages/fedos-core-rust/src/crypto/conversation_key.rs:235-305`):
`derive_conversation_key_via_ecdh_internal(secret_key, public_key)` —
real secp256k1 ECDH → X-coordinate → HKDF-SHA256 extract-only, fixed
salt `"nip44-v2"` — **NIP-44's own real conversation-key algorithm,
byte-verified against `test-vectors/nip44/nip44-v2.json`.** A complete,
vector-verified NIP-44 v2 wire pipeline (padding, ChaCha20 stream
cipher, HMAC-SHA256, base64) also exists in full.

**But this entire pipeline is `pub(crate)`-only.**
`nip44_public_api.rs:1-193` is an explicit skeleton: *"This module adds
NO public API. Every item here is `pub(crate)`... names the LABEL
VOCABULARY a future implementation would use, before writing any real
behavior behind it,"* and `Nip44OpaqueStatus` has exactly one variant,
`Unimplemented`. **No `#[wasm_bindgen]`-exported conversation-key or
NIP-44 function exists anywhere** — confirmed independently by Alpha
141's own inventory (exactly 13 `#[wasm_bindgen]` items existed at that
point, none for key derivation or NIP-44).

**Also directly relevant: `AeadAadDomain`'s own TypeScript type already
names a `"Conversation"` value** (`src/runtime/fedos_wasm_loader.ts:1384`,
`export type AeadAadDomain = "RootKey" | "Identity" | "Storage" |
"Conversation" | "TestOnly"`) — the AAD-domain vocabulary already
anticipates a conversation-scoped AEAD use, though nothing in this
codebase constructs a real AEAD call with that domain value today.

## 5. `src/runtime/fedos_runtime_{encrypt,decrypt,aead_key_generation,export_ciphertext,import_ciphertext,ciphertext_storage}.ts`

All six mirror the same four-layer chain and six-Fail-Closed-condition
gate `fedos_runtime_random_bytes.ts` already established (Public
Runtime API → Runtime Service → Rust Boundary → Internal Rust), quoted
by each file's own header. `encrypt(key: AeadKeyHandle, algorithm:
AeadAlgorithm, aadDomain: AeadAadDomain, plaintext: Uint8Array):
Promise<AeadCiphertextHandle | null>` (`fedos_runtime_encrypt.ts:154-166`)
never accepts a raw key. The six gate conditions: generated-artifact
existence, `NODE_ENV === "development"`, import readiness, dynamic
import success, module retention, WASM init success — every op wraps
its own call in try/catch and fails closed to `null` on any exception.

**Does it succeed today?** **No — confirmed by direct inspection this
pass: `packages/fedos-core-rust/pkg/` (the compiled WASM artifact
directory) does not exist in this checked-out tree.** Every Runtime
Service call therefore resolves `null` unconditionally today,
regardless of `NODE_ENV`. **This is not a permanently-denied stub** —
if the WASM artifact were built and `NODE_ENV=development`, the chain
would return real handles backed by the real AEAD in §1. Outside
Development Runtime, every gate stays permanently closed by design (no
code path flips the gate in a non-development runtime) — this is a
deliberate environment restriction, not a missing feature.
`storeCiphertext`/`loadCiphertext`/`deleteCiphertext`
(`fedos_runtime_ciphertext_storage.ts`) never reach Rust at all — pure
in-process `Map` operations on already-opaque `AeadCiphertextWire`
strings, separately Dev-only gated.

## 6. `StorageBackend` — opaque ciphertext only, unconnected to Board persistence

`RuntimeStorageBackend.store(id, wire: AeadCiphertextWire)`
(`fedos_runtime_storage_backend.ts:55-59`) — stores only the
already-serialized ciphertext wire string, never a key. Only
`MemoryStorageBackend` (in-process `Map`, non-persistent) is actually
wired into `resolveRuntimeStorageBackend()`.
`WindowsDpapiStorageBackend` (`fedos_runtime_storage_backend_windows_dpapi.ts:88-131`)
is real and working but **not wired into the active resolver** — it
DPAPI-protects the already-AEAD-encrypted wire string sitting in an
in-process `Map`, never touches disk, and has no relationship to the
Master Seed's own (separate, Argon2id-based) sealing. **Confirmed
independently: a repo-wide search finds zero reference from `src/board/`
to any `src/runtime/*` storage/crypto file, and every append-only
Board/Outbox persistence file's own guardrail comment states "NO
reference to `src/runtime/*`."** These are two fully separate,
non-interoperating storage stacks today.

## 7. Alpha 141–200 crypto design range — key decisions

- **Alpha 142** adopted the root hierarchy: `Master Seed → {Identity
  Root, Storage Root, Wallet Root, Application Root}`, Application Root
  as sole parent of all Protocol Roots.
- **Alpha 143** fixed HKDF context format (fixed-width binary, no
  free-form strings) and mandated Development/Production network
  separation so dev and prod identities are cryptographically unrelated
  under the same seed.
- **Alpha 144** formalized the recovery/threat model: everything
  derived from the Master Seed is deterministically reconstructible
  from seed+parameters; ciphertext bodies and Relay/server data are
  explicitly **not** recoverable this way. **A Master Seed leak
  compromises all derived identities with no containment; a single
  Protocol Root or Account Key leak IS contained** by HKDF's one-way
  domain separation. This is the single most load-bearing fact for §17
  (Backup) and §13 (Pseudonym) below.
- Alpha 145-199 implement the hierarchy, Nostr key derivation, and
  Schnorr (BIP-340) signing in sequence, each doc stating explicitly
  that pure-decision docs (141-144) made no code change.

## 8. Multi-recipient encryption / key rotation / key revocation — confirmed absent

No multi-recipient/group encryption concept exists anywhere in the
crypto core — the NIP-44 pipeline (§4) is inherently 1:1 (ECDH between
exactly two parties). No implemented key-rotation function exists (only
a comparative discussion in Alpha 142 §3, never built; `clear()` +
constructing a new authority is not in-place rotation). Every
`revoke`/`rotat` hit in `src/` is an unrelated `_placeholder`-suffixed
UI/device-trust label (`src/identity/device_trust.ts`,
`device_registration.ts`, `src/nearby/*`, `src/commerce/*`) — none
touches `SecretHandle`/`AeadKeyHandle`/`FedosMasterSeedAuthority`.

## Answers to this section's own seven required questions

1. **Reusable primitives**: real AEAD (ChaCha20-Poly1305/AES-256-GCM),
   real HKDF-SHA256 domain-separated derivation, real Argon2id seed
   sealing, real secp256k1 ECDH conversation-key derivation (NIP-44
   compatible) — all genuine, all currently unreachable from
   TypeScript except AEAD/key-generation (gated, and gate currently
   closed for lack of a built WASM artifact).
2. **Existing conversation-key use**: none in production — the
   primitive exists and is correct, has zero callers today.
3. **Secret leak path to TypeScript**: none found — every raw
   key/seed value stays behind an opaque WASM handle or Argon2id/AEAD
   ciphertext; only already-ciphertext wire strings and opaque handle
   labels ever appear as plain TS values.
4. **Existing boundary that could store ciphertext**:
   `RuntimeStorageBackend`/`MemoryStorageBackend` — but non-persistent
   (in-process only) and entirely disconnected from Board persistence.
5. **Private message envelope**: none — confirmed by §08 of the prior
   review's own companion doc, and independently re-confirmed this pass
   (no `Envelope` type scoped to board/chat/social/federation exists in
   `src/`; the only `Envelope` hits are Master Seed sealing and Rust
   doc-comment mentions of a future `AeadEnvelope*` naming scheme).
6. **Key rotation/revocation**: none implemented, only named/compared
   in a design doc (§7) and unrelated UI placeholders (§8).
7. **Multi-recipient encryption**: none — the one real primitive found
   is strictly 1:1.
8. **Group membership change support**: not applicable — no group
   encryption primitive exists to evaluate this against.

## See also

- `docs/reviews/private_conversation_security/02_private_canonical_model.md`
- `docs/reviews/private_conversation_security/05_key_distribution.md`
