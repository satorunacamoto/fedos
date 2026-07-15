# Secure Runtime Alpha 422 — Existing Rust / WASM Boundary Inventory

**Status: this Stage is REVIEW ONLY. It makes NO code change of any
kind.** Stage 1 of the Alpha 422–430 Nostr Outbound Signing Boundary
Decision & Foundation Arc (Phase A — Decision Review). Answers the
twelve inventory questions this Arc's own instruction requires, with
exact `file:line` citations, before any boundary option is compared
(Alpha 423) or adopted.

## 1. `#[wasm_bindgen]` export inventory

`packages/fedos-core-rust/src/lib.rs` is 11,149 lines. Every real
`#[wasm_bindgen]` attribute usage (15 occurrences; the remaining hits
for the bare string `wasm_bindgen` are doc-comment prose) sits inside
one contiguous AEAD section, `lib.rs:8981`–`9595`:

| Line | Item |
|---|---|
| 8981/8983 | `pub enum FedosAeadAlgorithm` |
| 8997/8999 | `pub enum FedosAeadAadDomain` |
| 9237/9238 | `pub fn version() -> String` |
| 9259/9260 | `pub fn random_bytes_32() -> Option<Vec<u8>>` |
| 9285/9286 | `pub struct AeadKeyHandle { inner: FedosAeadKeyHandle }` |
| 9290/9291, 9297/9298 | `impl AeadKeyHandle` + `#[wasm_bindgen(getter)] fn kind(&self)` |
| 9334/9335 | `pub struct AeadCiphertextHandle { inner: FedosCiphertextEnvelope }` |
| 9339/9340, 9346/9347 | `impl AeadCiphertextHandle` + `#[wasm_bindgen(getter)] fn kind(&self)` |
| 9383/9384 | `pub fn generate_aead_key_handle() -> Option<AeadKeyHandle>` |
| 9420/9421 | `pub fn encrypt_aead(...) -> Option<AeadCiphertextHandle>` |
| 9532/9533 | `pub fn decrypt_aead(...) -> Option<Vec<u8>>` |
| 9568/9569 | `pub fn serialize_aead_ciphertext(...) -> Option<String>` |
| 9594/9595 | `pub fn deserialize_aead_ciphertext(...) -> Option<AeadCiphertextHandle>` |

Zero `#[wasm_bindgen]` attribute exists anywhere near `mod master_root`
(§2). No other `.rs` file under `packages/fedos-core-rust/src`
(`crypto.rs`, the 34 files under `src/crypto/`) contains
`#[wasm_bindgen]` at all.

## 2. Module structure around Nostr signing

Everything lives inside one top-level module, `mod master_root`
(`lib.rs:3054`, closing before `mod key_material` at `~6019`), itself
carrying no `pub` — default crate-root-private. Every item inside it is
`pub(crate)` at most:

| Item | Line | Visibility |
|---|---|---|
| `struct FedosNostrSecretKeyHandle` | 3444 | `pub(crate)` |
| `fn derive_nostr_secret_key_internal` | 3632 | `pub(crate)` |
| `struct FedosNostrPublicKeyHandle` | 3698 | `pub(crate)` |
| `fn derive_nostr_public_key_internal` | 3756 | `pub(crate)` |
| `struct FedosNostrSignatureHandle` | 3800 | `pub(crate)` |
| `fn derive_nostr_signature_internal` | 3861 | `pub(crate)` |
| `struct FedosNostrEventHandle` | 4211 | `pub(crate)` |
| `fn derive_nostr_event_id_internal` | 4431 | `pub(crate)` |
| `fn sign_nostr_event_internal` | 4458 | `pub(crate)` |

Doc comments on every one of these Handle types (lines 3441, 3692,
3789, 4208) explicitly and repeatedly record "no WASM-export attribute
(`wasm_bindgen`)" as a deliberate prohibition, not an oversight.

## 3. Upstream Root handles

Also inside `master_root`, `pub(crate)`, wrapping `SecretHandle`, with
**no derives at all** (no `Clone`/`Debug`/`Serialize`/`PartialEq`):

- `FedosMasterSeedHandle` (3069)
- `FedosIdentityRootHandle` (3119)
- `FedosApplicationRootHandle` (3188)
- `FedosProtocolRootHandle` (3258) — one opaque type shared by all four
  downstream protocol roots (Nostr/Session/ATProto/Wallet)

Derivation chain, all `pub(crate)` or narrower:
`FedosMasterSeedHandle` → `derive_identity_root_internal` (4553) →
`FedosIdentityRootHandle` → `derive_application_root_internal` (4479) →
`FedosApplicationRootHandle` → `derive_protocol_root_internal` (3348,
bare-private) → `derive_nostr_root_internal` (3394) →
`FedosProtocolRootHandle` (the Nostr Root). None of the four Root
handles has `#[wasm_bindgen]` today.

## 4. Existing WASM-exposed structs — the crate's own precedent

`AeadKeyHandle` (9286) and `AeadCiphertextHandle` (9335) are the ONLY
two `#[wasm_bindgen]`-exported structs in the crate, and they establish
this repository's own pattern for crossing the WASM boundary with
secret-bearing material: an opaque wrapper struct around an existing
`pub(crate)` Handle; **zero derives** (`Clone`/`Debug`/`Serialize` all
absent, confirmed by `test/secure_runtime_alpha_018_ciphertext_wire_export_import_api.test.ts`'s
own structural assertion); exactly one non-secret `kind()` getter for
JS-side structural confirmation; a separate, plain (non-`wasm_bindgen`)
`impl` block holding a `pub(crate) fn inner(&self)` accessor reachable
only from other Rust code; and free functions
(`generate_*`/`encrypt_*`/`decrypt_*`/`serialize_*`/`deserialize_*`) as
the only public constructors. No raw-byte getter exists on either type.

## 5. `packages/fedos-core-rust/Cargo.toml`

- `[lib] crate-type = ["rlib", "cdylib"]` (line 76) — already present,
  added specifically to make `cargo build --target wasm32-unknown-unknown`
  emit a `.wasm` binary.
- `wasm-bindgen = "0.2.126"` (line 275) — already a pinned, direct
  dependency.
- `k256 = { version = "0.13", default-features = false, features =
  ["arithmetic", "schnorr"] }` (line 254) — `schnorr` was added for
  BIP-340 Nostr signing specifically (Alpha 181–190).
- `serde`/`serde_json` exist ONLY in `[dev-dependencies]` (lines
  284–285), never in production `[dependencies]` — a deliberate,
  tested discipline (`docs/ciphertext_serialization_format_decision.md`).
  A WASM export returning a full JSON object cannot use
  `#[derive(Serialize)]` without reopening that policy.
- **A narrow Nostr-signing WASM export requires zero new dependency and
  zero Cargo feature change** — `wasm-bindgen` and `k256`'s `schnorr`
  feature are both already production dependencies for other reasons.

## 6. WASM build/loader

`package.json`'s `build:wasm` script runs
`wasm-bindgen --target web --out-dir packages/fedos-core-rust/pkg`.
`pkg/` is gitignored (`packages/fedos-core-rust/.gitignore:21`) and
does not currently exist on disk — no generated artifact is tracked.
`packages/fedos-core-rust/src/wasm_loader.ts` is an inert, disabled
placeholder. The real, actively-staged loader,
`src/runtime/fedos_wasm_loader.ts`, gates every real action behind an
explicit tested step and, at its deepest reached stage, calls **only**
`version()` (the §1 export) — its own doc comment states it "Never
calls any Rust API other than `version()`." No caller in `create_runtime.ts`
or `worker.ts` reaches even that. No existing loader file references
AEAD or any Nostr export.

## 7. `DesktopApplication` / Runtime ownership

`DesktopApplication` (`src/desktop/desktop_application.ts:253`) holds
`#identity: FedosRuntimeIdentity`, `#reader`, `#publicIdentity`,
`#started`, `#currentPublicIdentity` — **no field or method references
the Rust core, WASM, or any Handle/signing type.** `FedosRuntimeIdentity`
(`src/runtime/fedos_runtime_identity.ts:812-816`) itself holds only
`#registry`/`#service`/`#resolver`/`#bootstrapped`/`#descriptor` — a
public-identity bootstrap-state assembly with **zero cryptographic
material of any kind**, backed by default on a `NoopFedosIdentityProvider`.
`DesktopApplication` has no access path to the Rust core today.

## 8. Existing signer abstractions

`src/sign/types.ts` defines `EventSigner { getPublicKey(); signEvent(unsigned) }`
and `src/sign/nip07.ts` implements `Nip07EventSigner` over an injected
`Nip07Provider` (real NIP-07/`window.nostr` shape, genuinely
key-material-free by design). Both are explicitly documented,
repeatedly (Alpha 234/243/244 doc comments), as "the legacy `src/sign`/`src/nostr`
stack," out of bounds for the newer `src/desktop/*` boundary this Arc
must extend.

## 9. TS event descriptor shapes

Three existing TS types already match the wire shape
`{id, pubkey, created_at, kind, tags, content, sig}` **exactly**:
`src/nostr/types.ts:NostrEvent`, `src/desktop/fedos_nostr_wire_event.ts:FedosNostrWireEvent`,
`src/desktop/fedos_validated_nostr_event.ts:FedosValidatedNostrEvent`.
`src/desktop/fedos_event_descriptor.ts:FedosEventDescriptor`
deliberately renames every field (`author`/`createdAt`/`signature`) and
does not match — it is a protocol-neutral read shape, not a wire shape.

## 10. Outbox / Board post types (context only, unaffected)

`FedosBoardPost` (`src/board/fedos_board_post.ts:41`),
`FedosBoardOutboxIntent`/`FedosBoardOutboxTarget`
(`src/board/outbox/fedos_board_outbox_types.ts`), and
`FedosDesktopHost.submitPostWithOutbox()`
(`src/desktop/host/fedos_desktop_host.ts:455`) are the completed Alpha
411–420 surface this Arc must not modify.

## 11. Relevant docs

Alpha 146–200 (`docs/secure_runtime_alpha_146_master_seed_handle.md`
through `docs/secure_runtime_alpha_200_event_foundation_completion.md`)
built the pipeline this Arc must reuse, not redesign. Alpha 411–421
(`docs/secure_runtime_alpha_411_existing_delivery_outbox_inventory.md`
through `docs/secure_runtime_alpha_421_existing_nostr_outbound_construction_inventory.md`)
built the Outbox and found the blocker this Arc exists to resolve.

## 12. Inbound event validator (reused as the independent verifier, unchanged)

`verifyNostrEventId` (`src/desktop/nostr_event_id_verifier.ts:143`),
`verifyNostrEventSignature` (`src/desktop/nostr_signature_verifier.ts:92`),
and `validateInboundNostrEvent` (`src/desktop/combined_inbound_event_validator.ts:86`)
— a from-scratch TypeScript reimplementation of BIP-340/NIP-01
verification, whose own doc comment already records
(`nostr_signature_verifier.ts:21-27`) that Alpha 241 searched for a
reachable Rust verification function and found none reachable.

## 13. Critical additional finding — no Master Seed authority exists anywhere

Investigating question 5 ("whether Master Seed creation/import exists
across a safe boundary") surfaced a finding that governs the rest of
this Arc: **no real 32-byte Master Seed material exists anywhere
reachable at runtime, in Rust or TypeScript, today.**

- Every call site of `FedosMasterSeedHandle::new_from_32_bytes_for_internal_use`
  sits inside `#[cfg(test)] mod tests` blocks, seeded with fixture
  constants (`TEST_MASTER_SEED: [u8; 32] = [0xEE; 32]` and similar).
  `mod master_root` is never `use`d outside itself and never called
  from any production function.
- `FedosRuntimeIdentity` (§7) performs no HKDF, no CSPRNG draw, and
  holds no byte array of any kind.
- `src/vault/types.ts:11` states explicitly: "NO key generation, NO key
  derivation, NO seed storage, NO AEAD/XOR/BIP39/..." — the vault
  boundary is types-only.
- `docs/secure_runtime_alpha_144_recovery_threat_model_decision.md:108`
  states Master Seed backup storage is "explicitly deferred to a future
  Storage Review" — a decision consciously deferred at Alpha 144 and
  never since revisited.

This finding is carried forward into Alpha 423–427 as the deciding
constraint: a narrow WASM signing wrapper (§4's own precedent pattern)
is technically straightforward to add, but **has no real, safe seed to
derive from** yet.

## 14. Answers to the Arc's own twelve questions, condensed

1. All Nostr Handle/derivation items are `pub(crate)`; none is `pub`.
2. Only the AEAD types/functions (§1) cross WASM today.
3. Yes — `AeadKeyHandle`/`AeadCiphertextHandle` (§4) prove wasm-bindgen
   can own non-`Clone` opaque Rust handles safely in this crate.
4. Yes, structurally — no evidence found that the loader cannot retain
   an opaque JS-visible object; it simply has never been asked to
   retain anything beyond a `String` (`version()`).
5. No (§13) — this is the Arc's central finding.
6. Yes, mechanically — `derive_nostr_secret_key_internal` takes a
   `&FedosProtocolRootHandle` and a `u32` and returns an opaque Handle;
   no raw-byte export is structurally required for THIS step alone.
7. Yes, mechanically — `sign_nostr_event_internal` returns a
   `FedosNostrSignatureHandle`, never touching the secret key's own
   bytes outside the existing `k256::schnorr` call.
8. Yes — three TS types already match (§9).
9. No — `wasm-bindgen`/`k256` `schnorr` are already present (§5).
10. No — `DesktopApplication` has no Rust access path (§7).
11. No — NIP-07 assumes an external browser-extension signer, not a
    Rust-owned local key (§8); evaluated fully at Alpha 423.
12. Ripple scope, if Phase B proceeds: `packages/fedos-core-rust/src/lib.rs`
    (new narrow export only) + a new adapter file under `src/desktop/`;
    zero change to Outbox, Board, Relay, or `p2p/`.

## 15. See also

- `docs/secure_runtime_alpha_421_existing_nostr_outbound_construction_inventory.md`
- `docs/secure_runtime_alpha_146_master_seed_handle.md`
- `docs/secure_runtime_alpha_144_recovery_threat_model_decision.md`
- `docs/secure_runtime_alpha_018_ciphertext_wire_export_import_api.md`
