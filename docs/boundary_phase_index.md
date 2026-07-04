# Boundary Phase Index — Stage 1–130 (docs only, no code)

**Status: this document adds no code.** It is a single cross-cutting index
over every boundary shipped Stage 1 through Stage 130 (commit `f049df2`),
organized by category instead of chronology, so a reader does not have to
reconstruct the picture from 130 individual README sections. It changes
nothing under `src/`, `packages/`, `Cargo.toml`, or `test/` — it is a map of
what already exists, not a new boundary.

This is Stage 131 of the **Boundary Phase index + Implementation readiness
checklist + Phase transition roadmap** docs-only batch. It complements, and
does not replace, the per-stage detail in `README.md` and the topic-specific
design docs it links to below — where this index and any of those disagree,
the per-stage README section and the dedicated doc are authoritative; this
is a summary, not a new rule source.

---

## 1. Purpose

- **One inventory, ten categories.** Every Stage 1–130 boundary is listed
  once, grouped as Crypto / Identity / Storage / Federation / Social /
  Creator / Governance / Device / Preview / Docs, with its stage number,
  file(s), role, implemented scope, and explicitly NOT-implemented scope.
- **Fix the Boundary Phase conclusion in one place** (§12): real
  cryptography, real network transport, real payment/settlement, and real
  persistent storage do not exist anywhere in this codebase — every
  provider is a `Noop*`/`Placeholder*`/in-memory/mock, with the narrow,
  explicitly-scoped exceptions §12 names.
- **Not a new design.** No boundary is added, renamed, wired, or promoted
  by this document.

---

## 2. Crypto

Raw-primitive skeletons, the Vault/Crypto-Core seam, the WASM loader, and
the FedOS Rust crate. Full detail: `docs/fedos_core_architecture_freeze_v1.md`,
`docs/fedos_core_rust_safety.md`, `docs/crypto_test_vectors.md`,
`docs/crypto_vector_sources.md`, `docs/public_capability_matrix.md`.

| Stage | File(s) | Role | Implemented | Not implemented |
|---|---|---|---|---|
| 8 | `src/nostr/noble_signature.ts` | Real BIP-340 Schnorr signature verification | Verify-only Schnorr via `@noble/curves`/`@noble/hashes` — genuinely real crypto | No signing, no key generation, no key storage |
| 33 | `src/vault/*` | Vault boundary skeleton (locked/unlocked labels) | `NoopVaultBoundary`, `InMemoryVaultBoundary` (placeholder unlock state only) | No AEAD/XOR, no key gen/derivation, no seed storage |
| 34 | `src/crypto/*` | Crypto Core swap-point seam (`CryptoProvider`) | `NoopCryptoProvider`; opaque request/decision types only | No encryption, KDF, or random generation; no output bytes ever |
| 59 | `packages/fedos-core-rust` (TS side), `src/crypto/fedos_core_adapter.ts` | Future Rust/WASM crypto-core package boundary | `PlaceholderFedosCoreCrypto`, `FedosCoreCryptoProvider` (delegates only) | No real crypto of any kind; no `.wasm`/compiled artifact committed |
| 63 | `packages/fedos-core-rust/src/wasm_loader.ts` | WASM loader seam for a future Rust core | `NoopFedosCoreWasmLoader`/`PlaceholderFedosCoreWasmLoader` state machine | No `fetch`, no dynamic import, no `WebAssembly.instantiate` |
| 64 | `docs/fedos_core_wasm_safety.md` | Docs: safety contract for a future real WASM loader | Fixes absolute rules (no auto-load, no secrets in refs) | No code change |
| 65 | `src/runtime/create_runtime.ts` | Runtime `CryptoProvider` env-selection (disabled by default) | `selectCryptoProvider` DI seam; label only on status page | Never calls `randomBytes`/`deriveKey`/`encrypt`/`decrypt`; no WASM load |
| 66 | `docs/anti_analysis_shadow_vault_risks.md` | Docs: forbids anti-debug/anti-VM/self-destruct/fake shadow data | Hard prohibitions + safe alternatives (app-lock, timeout) | No code; binds future stages |
| 67 | `docs/crypto_test_vectors.md` | Docs: known-answer vector plan for a future Rust core | Candidate primitives + adoption rules fixed in writing | No vector JSON committed, no Rust code |
| 68 | `docs/fedos_core_build_manifest.md` | Docs: build/provenance manifest plan | Manifest field schema + forbidden-fields list | No manifest JSON, no hashing/signing tooling |
| 69 | `packages/fedos-core-rust/{Cargo.toml,src/lib.rs}` | Minimal Rust crate skeleton | 6 placeholder fns (`fedos_core_status`, etc.), `#![forbid(unsafe_code)]`, zero deps | No crypto crate, no `rand`/`getrandom`, no WASM target |
| 70 | `docs/fedos_core_rust_safety.md` | Docs: guardrails before any dependency/unsafe/crypto lands | `unsafe`/dependency/WASM/randomness policies fixed | No Rust/Cargo change |
| 71 | `docs/crypto_vector_sources.md` | Docs: official vector source catalog per primitive | RFC/NIST/upstream source list, per-primitive rules | No vector bytes copied yet |
| 72 | `docs/verification_infrastructure.md`, `docs/rust_dependency_adoption.md` | Docs: end-to-end vector→cargo-test→manifest pipeline | 6-stage pipeline + runtime-gate conditions fixed | No vectors, no Rust/Cargo change |
| 73 | `test-vectors/{aead,kdf,nip44}/*.json` | Verbatim import of official crypto vector files | RFC 8439 / NIST GCM / RFC 5869 / RFC 9106 / NIP-44 vectors committed | No Rust dependency, no code reads them yet |
| 74 | `packages/fedos-core-rust/Cargo.toml` | Adopt `chacha20poly1305` dependency | Build-check only; resolved dependency graph, no `getrandom` | No import/call anywhere in `lib.rs` |
| 75 | `lib.rs` `rfc8439_vectors` (`cfg(test)`) | Wire RFC 8439 vectors to `cargo test` | Seal/open reproduces RFC vectors under test only | No public encrypt/decrypt API; no Runtime wiring |
| 76 | `Cargo.toml` | Adopt `hkdf` dependency | Build-check only, production dependency added | No HKDF call outside future test wiring |
| 77 | `lib.rs` `rfc5869_vectors` (`cfg(test)`) | Wire RFC 5869 HKDF-SHA256 vectors to `cargo test` | `hkdf`+`sha2` reproduce RFC PRK/OKM under test | No public `deriveKey`; no Runtime wiring |
| 78 | `Cargo.toml` | Adopt `zeroize`/`secrecy`/`subtle` | Build-check only; no type uses them yet | No `Secret`/`SecretBox` type, no zeroize/ct-eq call |
| 79 | `lib.rs` `secret_handle` (crate-private) | First real use of `zeroize`/`secrecy`, on a fake marker | `SecretHandle` holds only a placeholder byte, `.clear()` zeroizes it | No real secret ever stored; not part of public API |
| 80 | `lib.rs` `aead_core` (crate-private) | AEAD request/operation label skeleton | `AeadPlaceholderRequest` (algorithm+operation labels only) | No `chacha20poly1305` import in production code |
| 81 | `lib.rs` `rfc8439_vectors` refactor | Extract test-only ChaCha20-Poly1305 seal/open helper | Private `_for_test` helpers reused by vector tests | Still no public API; helper never leaves `cfg(test)` |
| 82 | `lib.rs` `kdf_core` (crate-private) | HKDF request/operation label skeleton | `KdfPlaceholderRequest` (algorithm+operation labels only) | No `hkdf`/`sha2` import in production code |
| 83 | `lib.rs` `rfc5869_vectors` refactor | Extract test-only HKDF-SHA256 helper | 3 private `_for_test` extract/expand helpers | No public `deriveKey` |
| 84 | `Cargo.toml` | Adopt `argon2` dependency | Build-check only; `default-features=false`, no `rand_core` | No Argon2id call anywhere |
| 85 | `lib.rs` `rfc9106_vectors` (`cfg(test)`) | Wire RFC 9106 Argon2id vector to `cargo test` | Reproduces the sole RFC 9106 KAT under test | No public password-KDF API |
| 86 | `lib.rs` `rfc9106_vectors` refactor | Extract test-only Argon2id helper | Private `derive_argon2id_for_test` helper | No production `argon2` import |
| 87 | `lib.rs` `key_material` (crate-private) | Key-material handle skeleton | `KeyMaterialHandle` over a placeholder marker only | No real AEAD/HKDF/Nostr key stored |
| 88 | `lib.rs` `domain_label` (crate-private) | Domain-separation label skeleton | Fixed `&'static str` labels via `const fn` only | Not mixed into any real HKDF/AEAD operation |
| 89 | `lib.rs` `operation_context` (crate-private) | Operation-kind label skeleton | 10 label-only `OperationKind` variants | No connection to AEAD/KDF/key modules |
| 90 | `lib.rs` `request_descriptor` (crate-private) | Non-sensitive request-kind label skeleton | 10 label-only variants, no byte field | No real request payload of any kind |
| 91 | `lib.rs` `response_descriptor` (crate-private) | Non-sensitive response-kind label skeleton | 11 label-only variants + error-placeholder pairing | No result payload/bytes |
| 92 | `lib.rs` `crypto_pipeline` (crate-private) | Pipeline-kind label skeleton | 6 label-only variants | No descriptor bundling yet |
| 93 | `lib.rs` `descriptor_bundle` (crate-private) | Bundle-kind label skeleton | 6 label-only variants | No descriptor value wiring |
| 94 | `lib.rs` `execution_plan` (crate-private) | Fixed 6-step execution-order labels | `step_count()` returns hardcoded `6` | No real step execution |
| 95 | `lib.rs` `error_taxonomy` (crate-private) | Error-kind label skeleton | 9 label-only variants, no message/stack field | No raw error strings ever |
| 96 | `lib.rs` `audit_event` (crate-private) | Audit-event-kind label skeleton | 9 label-only variants | No logging, no event payload |
| 97 | `lib.rs` `audit_policy` (crate-private) | Audit decision-policy skeleton | `decision_placeholder()` always returns `DenyPlaceholder` | Not even wired to `audit_event` by name |
| 98 | `lib.rs` `lifecycle_state` (crate-private) | Internal lifecycle-state skeleton | 6-state enum + 4 transition methods, no payload | No timestamp/counter, no wiring to other modules |
| 99 | `lib.rs` `module_registry` (crate-private) | Enumerates all 15 prior skeleton modules by label | `registered_module_count()` hardcoded to 15 | No dynamic registry, no logging, no construction of others |
| 100 | `docs/fedos_core_architecture_freeze_v1.md` | Docs: freeze the 16-module internal architecture | Role table + non-claims section + next-phase order | No code changed; still only 6 public placeholder fns |
| 101 | `Cargo.toml`, `lib.rs` `aes256gcm_vectors` | Adopt `aes-gcm` AND wire NIST vectors | Second AEAD reproduces NIST GCM KATs under test | No public encrypt/decrypt; no production `aes-gcm` use |
| 102 | `docs/fedos_core_public_api_design.md`, `lib.rs` | Design docs + label-only public API boundary | `FedosCryptoOperation`/`Algorithm`/`BoundaryStatus` types (7th `pub fn`) | No encrypt/decrypt/deriveKey/randomBytes implementation |
| 103 | `lib.rs`, 3 new docs | 10 more label-only public types (nonce/key-gen/import/export boundaries) | `pub fn` surface grows 7→17, still all fixed labels | No key-import byte-level protocol decided |
| 104 | `Cargo.toml`, `lib.rs` (`cfg(test)` only) | Adopt `getrandom` CSPRNG dependency | Build-check only + test-only RNG-verification-plan placeholder | `getrandom` never called anywhere, prod or test |
| 105 | `lib.rs` | Public key-FORMAT label enumeration (`FedosKeyFormatLabel`) | `pub fn` surface 17→18; 7 future-planning labels | No raw byte layout/parser/import/export decided |
| 106 | `lib.rs`, `docs/public_capability_matrix.md` | Public key-USAGE + algorithm-policy labels; Public Boundary Freeze v2 | `pub fn` surface 18→22; 3 fixed relational tables | No raw byte, no `randomBytes` impl, no wiring |

## 3. Identity

Passkey/WebAuthn/identity-provider seams, plus the later session/recovery/
device boundaries. Full detail: `docs/webauthn_passkey_safety.md`,
`docs/device_identity_boundary.md`, `docs/vault_crypto_identity.md` §1.

| Stage | File(s) | Role | Implemented | Not implemented |
|---|---|---|---|---|
| 36 | `src/identity/passkey_boundary.ts`, `vault_bridge.ts` | Passkey/Face ID/Touch ID as Vault-unlock TRIGGER only | `NoopPasskeyBoundary`/`PlaceholderPasskeyBoundary`; opaque `reference` only | No WebAuthn call; never derives a key; doesn't unlock Vault |
| 37 | `src/identity/provider_boundary.ts`, `provider_bridge.ts` | Apple/Google/External as opaque auth-reference providers | Maps provider kind → Passkey/Vault request (type-only) | No OAuth/JWT; generates no key |
| 60 | `src/identity/webauthn_adapter.ts` | Browser WebAuthn adapter seam for Passkey boundary | `NoopWebAuthnProvider`/`PlaceholderWebAuthnProvider`; bridges to Stage 36 | No `navigator.credentials` call anywhere |
| 61 | `docs/webauthn_passkey_safety.md` | Docs: WebAuthn is a trigger, never a key source | Absolute rules + forbidden UI wording fixed | No code/behavior change |
| 62 | `src/runtime/create_runtime.ts` | Runtime `WebAuthnProvider` env-selection (disabled by default) | `selectWebAuthnProvider` DI seam only | No `begin()`/`cancel()` auto-call; no browser API |
| 129 | `src/identity/session_boundary.ts` | Session start/end/refresh label boundary | `reviewSessionRequest`, 1:1 placeholder state mapping | Never creates/stores/invalidates a real session |
| 130 | `src/identity/recovery_policy.ts`, `render/device_preview.ts`, `docs/device_identity_boundary.md` | Identity-recovery request boundary (strictest guardrail set) | Rejects password/mnemonic/seed/backup/export/import fields | No real recovery flow; `?devicePreview=1` is read-only |

## 4. Storage

Event/asset caches, D1/KV/R2/MeshKV adapters, the `StorageBackend`
abstraction, and Nearby. Full detail: `docs/storage_metadata_policy.md`,
`docs/nearby_consent_policy.md`, `docs/nearby_area_indexing_research.md`,
`docs/deniable_storage_research.md`.

| Stage | File(s) | Role | Implemented | Not implemented |
|---|---|---|---|---|
| 6 | `src/cache/event_cache.ts`, `types.ts` | `EventCache` boundary + deterministic keys | `InMemoryEventCache`, get-or-fetch policy | No durable/verified store |
| 7 | `src/cache/kv_event_cache.ts` | Cloudflare Workers KV event-cache adapter | `KvEventCache` (real KV binding, eventually consistent) | Not a verified/durable store |
| 14 | `src/indexer/d1_index.ts`, `schema/d1_index.sql` | D1 metadata/index adapter for discovery | Derived-metadata-only rows via prepared statements | Not wired into the Worker yet |
| 15 | `src/community/d1_directory.ts`, `schema/d1_space_directory.sql` | D1 space-directory adapter | Persists space defs + (pubkey, role) membership | D1 is not an access-control oracle; sync path still in-memory |
| 22 | `src/asset/types.ts`, `policy.ts`, `memory_asset_cache.ts` | Public `AssetCache` boundary, separate from the event cache | `InMemoryAssetCache` enforces public/unlisted-only policy | No purchased/DM/secret bytes ever cached |
| 23 | `src/asset/meshkv_asset_cache.ts` | MeshKV adapter for `AssetCache` (peer cache) | `MeshKVAssetCache` over `MockMeshKVClient` (no peers) | No real WebRTC/signaling/peer discovery |
| 24 | `src/asset/r2_asset_cache.ts` | R2 origin-storage adapter for `AssetCache` | `R2AssetCache` over `MockR2Bucket`/`R2LikeBucket` | No signed URLs, download delivery, or DRM |
| 26 | `src/asset/composite_asset_cache.ts` | Composes R2→MeshKV→in-memory into one cache | Warm-fill/fallback read + first/all-writable write strategies | `clear()` defaults to no-op; not access control |
| 28 | `packages/meshkv/*` (import) | Import real external MeshKV browser project as a package boundary | `MeshKVApi` typed surface + browser-free reference node | No network started by importing it |
| 29 | `packages/meshkv/src/index.ts`, `meshkv_browser_client.ts` | Wire MeshKV boundary to the real imported implementation | `MeshKVBrowserClient` retargeted to real `get`/`put`/`remove` API | Constructing it starts no signaling/WebRTC |
| 31 | `src/runtime/create_runtime.ts` | MeshKV runtime opt-in wiring (`selectMeshKVClient`) | Explicit `ENABLE_MESHKV_ASSET_CACHE` + API gate | Selecting the adapter starts no network |
| 32 | `src/asset/meshkv_lifecycle.ts` | Explicit online/offline MeshKV lifecycle boundary | `idle→prepared→online→offline` state machine | Not auto-wired; `goOnline()` is the only network trigger |
| 35 | `src/commerce/asset_preview.ts` | Product route sources asset PREVIEW metadata from `AssetCache` | Cache-hit metadata only, bytes always discarded | No asset bytes in HTML, no signed URL/download |
| 40 | `docs/deniable_storage_research.md` | Docs: Shadow Vault/Deniable Storage threat model & prohibitions | Forbids branch-selected hidden vaults; fixes leak vectors | No crypto/vault/hidden-volume/IPFS code |
| 43 | `src/asset/ipfs_asset_cache.ts` | IPFS candidate adapter boundary for `AssetCache` | `IpfsAssetCache`/`NoopIpfsClient`; CID plausibility helper | No IPFS node/gateway fetch/pin; not wired anywhere |
| 107 | `src/storage/types.ts`, `policy.ts`, `noop_storage.ts` | `StorageBackend` abstraction (Google Drive/relay/SQLite/mesh/IPFS as future candidates) | `NoopStorageBackend`/`PlaceholderStorageBackend`, `reviewStoragePacket` | No real backend; not wired into runtime/Worker |
| 108 | `docs/nearby_area_indexing_research.md`, `nearby_consent_policy.md`, `storage_metadata_policy.md` | Docs: Nearby/location privacy + storage-metadata policy | Compares Geohash/H3/S2 as candidates only; consent rules fixed | No location code; no dependency added |
| 109 | `src/nearby/types.ts`, `noop_consent.ts`, `src/storage/policy.ts` (sanitizer) | Storage env-selection + Nearby consent skeleton + metadata sanitizer | `selectStorageBackend`; `PlaceholderNearbyConsentProvider` (never grants) | No GPS/area-id; sanitizer not called from storage `put` |

## 5. Federation

Nostr protocol handling, relay read/write paths, multi-protocol adapters,
and the outbound publish queue. Full detail: `docs/federation_boundary.md`,
`docs/nostr_adapter_planning.md`, `docs/bluesky_adapter_planning.md`,
`docs/threads_adapter_planning.md`, `docs/rss_adapter_planning.md`,
`docs/protocol_moderation_compatibility.md`, `docs/federation_queue.md`.

| Stage | File(s) | Role | Implemented | Not implemented |
|---|---|---|---|---|
| 1 | `src/nostr/*`, `src/ingest/*`, `src/thread/*` | Initial Nostr ingest + NIP-10 thread builder foundation | Pure validate→dedupe→normalize; reply-graph→sorted trees | No relay connection, no signing/publish |
| 5 | `src/nostr/messages.ts`, `ws_relay.ts`, `signature.ts` | NIP-01 message parser + read-only WebSocket relay adapter + signer boundary shape | REQ→collect→EOSE/timeout→CLOSE; never publishes | No write path yet |
| 12 | `src/nostr/publish.ts`, `sign/publish_flow.ts` | Relay write-path (`RelayPublisher`) boundary | `WebSocketRelayPublisher`, NIP-20 OK parsing, `MockRelayPublisher` | Nothing auto-wired; boundary to compose/test only |
| 21 | `src/runtime/create_runtime.ts`, `types.ts` | Runtime integration layer (`createRuntime`) — cross-cutting DI | Selects event cache/directory/verifier/promotion/relay boundaries | Constructing it runs no op, issues no `fetch` |
| 110 | `src/federation/types.ts`, `noop_federation.ts`, `src/social/event.ts`, `board.ts` | `FederationProvider` seam for Nostr/Bluesky/Threads/RSS/local | `NoopFederationProvider` (never even reaches `connected`) | No relay/OAuth/AT-Protocol connection of any kind |
| 113 | `src/federation/nostr_mapping.ts`, `types.ts` | Pure `SocialEventDescriptor`→Nostr-event-candidate mapping | 4 pure mapping fns; rejects chat/private/non-public visibility | No relay/signing/publish; candidate is display data only |
| 116 | `src/federation/publish_intent.ts` | Nostr publish-intent policy boundary | `reviewPublishIntent`; `accepted_placeholder` ≠ "published" | No signing, no relay connection, no publish |
| 117 | `src/federation/capability_matrix.ts` | Cross-protocol capability matrix (Nostr/Bluesky/Threads/RSS) | Fixed per-adapter/per-capability decision row | Bluesky/Threads/RSS `unavailable` on every real capability |
| 118 | `src/federation/outbound_queue.ts` | In-memory FIFO outbound-queue skeleton | Pure `enqueuePlaceholder`/`dequeuePlaceholder`, no mutation | No real network send, no relay/WebSocket |
| 119 | `docs/bluesky_adapter_planning.md` | Bluesky adapter compatibility/planning doc | Candidate mapping table; capability row stays `unavailable` | No OAuth/AT-Protocol code |
| 120 | `docs/threads_adapter_planning.md` | Threads adapter compatibility/planning doc | Centralized-authority differences documented | No ActivityPub/Threads API code |
| 121 | `docs/rss_adapter_planning.md` | RSS adapter compatibility/planning doc | "No moderation primitive" documented | No RSS fetch/parse code |
| 122 | `src/federation/queue_status_preview.ts`, `render/queue_preview.ts`, `docs/federation_queue.md` | Read-only queue-status summary over the Stage 118 queue | `summarizeQueueStatusPreview`; `?queuePreview=1` | Never calls enqueue/dequeue itself; display-only |

## 6. Social

Threads, the community/space model, chat model, and notifications. Full
detail: `docs/community_moderation_policy.md`, `docs/chat_boundary.md`.

| Stage | File(s) | Role | Implemented | Not implemented |
|---|---|---|---|---|
| 2 | `src/thread/*` | NIP-10 thread builder (reply graph → sorted trees) | Pure thread construction | No storage/network |
| 4 | `src/query/thread_query.ts`, `types.ts` | Thread query policy: sort/filter/paginate | Sort (new/old/top/hot), filters, pagination | Pure/local only; no DB query |
| 9 | `src/community/{types,policy,classify}.ts` | Community/Channel/Group policy model | Role + read/post/moderate/admin decisions (pure) | No storage of keys, no posting UI |
| 16 | `src/chat/{types,policy,classify,space_bridge}.ts` | Chat/DM model boundary (LINE/Telegram-style) | `canReadChat`/`canPostChat` policy; tag-based classification | Nothing sent, no encryption (NIP-04/44 out of scope) |
| 39 | `src/notification/*` | Notification Bridge boundary (Telegram/LINE/APNs/FCM/Email) | `NoopNotificationBridge`/`PlaceholderNotificationBridge`; strict sanitizer | Sends nothing; no transport call; no `fetch` |
| 42 | `src/runtime/create_runtime.ts` | Notification provider env-selection boundary | `selectNotificationBridge` DI seam | Never auto-calls `notify()`; no transport import |
| 114 | `src/social/intent.ts` | Board interaction-intent policy (post/reply/react/hide/mute/report) | `reviewBoardInteractionIntent`; policy-clean ≠ posted | No real post/reply/react; no relay |

## 7. Creator

Commerce/product model, promotion/ads, payment, marketplace, and
entitlement. Full detail: `docs/creator_entitlement_boundary.md`,
`docs/creator_monetization_flow.md`, `docs/marketplace_boundary.md`.

| Stage | File(s) | Role | Implemented | Not implemented |
|---|---|---|---|---|
| 17 | `src/commerce/{types,policy,classify,bridge}.ts` | Creator/EC digital-goods model boundary | `Product`/`DigitalAsset`/`PurchaseGrant` policy (pure) | No money moves, nothing delivered, no DRM |
| 18 | `src/promotion/{types,policy,bridge,adapter}.ts`, `render/promotion.ts` | Promotion integration boundary (not an ad engine) | Placement resolution + `MockPromotionProvider` | No ranking/auction/CTR/tracking/billing |
| 19 | `src/promotion/edge_rec_adapter.ts` | EdgeRec adapter connecting the promotion seam to the real ad system | Pure mapping fns; posts via INJECTED fetch client only | No ranking/CTR/billing duplicated; no auto-invoke |
| 38 | `src/runtime/create_runtime.ts` | EdgeRec Worker env-selection boundary | Wires real endpoint + `fetch`-gated `EdgeRecPromotionProvider` | Constructing issues no `fetch`; viewer pubkey off by default |
| 44 | `src/payment/{types,noop_payment,commerce_bridge}.ts` | Payment/Lightning boundary skeleton (front door before a grant) | `NoopPaymentProvider`/`PlaceholderPaymentProvider`; policy bridge | No Lightning/Stripe/Apple/Google Pay; no invoice/checkout |
| 46 | `src/runtime/create_runtime.ts` | Payment provider env-selection boundary | `selectPaymentProvider` DI seam, mirrors notification pattern | Never auto-calls `requestPayment()`; no grant issuance |
| 49 | `src/promotion/invocation.ts` | Real provider invocation seam (disabled by default) | `invokePromotionProviderPreview` (dual-gate call) | Not wired into runtime/Worker this stage |
| 111 | `src/marketplace/{types,noop_marketplace}.ts`, `creator/entitlement.ts` | Marketplace + Creator-entitlement boundary foundation | `NoopMarketplaceProvider`/`NoopEntitlementProvider` (never grants) | No real listing/purchase/access grant |
| 115 | `src/creator/profile.ts` | Creator profile + trust-label boundary | `reviewCreatorProfile`; `verified_placeholder` is future-label only | No KYC/OAuth/document check ever performed |
| 112 (docs) | `docs/creator_monetization_flow.md`, `docs/nostr_adapter_planning.md` | Docs: fixes future sale/publish sequencing across Creator+Federation | Listing→purchase→payment→entitlement→chat→federation order fixed | No source/test file changed |

## 8. Governance

Moderation appeal, reputation, subscription-tier visibility, and
treasury-disclosure policy. Full detail: `docs/creator_governance.md`,
`docs/community_moderation_policy.md`.

| Stage | File(s) | Role | Implemented | Not implemented |
|---|---|---|---|---|
| 123 | `src/creator/appeal.ts` | Creator moderation-appeal boundary | `reviewCreatorAppeal`; a labeled dispute record only | Never an enforcement/reversal action |
| 124 | `src/creator/reputation.ts` | Creator reputation-signal boundary | Fixed `CreatorReputationLabel` only | Never a numeric score/weight/rank |
| 125 | `src/creator/subscription_policy.ts` | Subscription/membership-tier visibility policy | Structurally conservative — only `public_placeholder` visible | No real entitlement ever checked |
| 126 | `src/community/treasury_policy.ts`, `render/creator_governance_preview.ts`, `docs/creator_governance.md` | Community-treasury disclosure category policy | Category-name disclosure only; `?creatorGovernancePreview=1` | Computes no balance/amount/fund; no DAO/vote/settlement |

## 9. Device

Device registration and trust labeling. Full detail:
`docs/device_identity_boundary.md`.

| Stage | File(s) | Role | Implemented | Not implemented |
|---|---|---|---|---|
| 127 | `src/identity/device_registration.ts` | Device-name-label registration boundary | `reviewDeviceRegistration` | Never a pairing/key exchange/sync |
| 128 | `src/identity/device_trust.ts` | Device trust-label boundary (mirrors creator-trust convention) | `DeviceTrustLabel`/`reviewDeviceTrust` | Never a real attestation |

## 10. Preview

Read-only render/diagnostic pages behind explicit opt-in query flags. Full
detail: `docs/runtime_diagnostics.md`, `docs/provider_preview_safety.md`.

| Stage | File(s) | Role | Implemented | Not implemented |
|---|---|---|---|---|
| 3 | `src/render/html.ts`, `sample.ts`, `src/worker.ts` | Read-only Reddit-style render layer + demo Worker | HTML view over sample data | No live relay, no interaction |
| 11 | `src/render/space.ts`, `sample.ts`, `community/sample_spaces.ts` | Read-only space directory + landing pages | `?space=`/`?actor=` routes | No posting/membership/admin UI |
| 13 | `src/render/publish.ts` | Mock-only compose/publish UI prototype | Unsigned event preview; disabled publish button | Never signs, never calls signer/`RelayPublisher` |
| 20 | `src/render/product.ts`, `space.ts` | Read-only promotion placeholders on product/space pages | Empty "Sponsored" slots only | No candidate title/image/destination rendered |
| 25 | `src/commerce/directory.ts`, `sample_products.ts`, `render/product.ts` | Read-only product directory + page route | `?product=<id>`; PUBLIC/UNLISTED asset preview labels | No download/payment/DRM |
| 27 | `src/chat/directory.ts`, `sample_chats.ts`, `render/chat.ts` | Read-only chat directory + room UI | `?chat=<id>` plaintext label view | No send form/socket/delivery |
| 30 | `src/render/directory.ts` | Unified Space+Product+Chat directory page | `renderUnifiedDirectory` (pure composition) | No new data lookup/route |
| 41 | `src/render/promotion.ts` | Mock promotion preview mode (`MockPromotionProvider` only) | Candidate cards, no destination/image, opt-in flag | No real/EdgeRec provider call; no tracking |
| 45 | `src/render/payment.ts` | Product purchase-preview UI (placeholder payment only) | Disabled checkout button; fresh local `PlaceholderPaymentProvider` | No Lightning/Stripe/invoice/checkout/grant |
| 47 | `src/worker.ts` | Purchase preview wired to runtime payment provider (opt-in) | `?paymentPreview=1` uses `runtime.paymentProvider` | Still no real payment; board/chat unaffected |
| 48 | `src/render/grant_preview.ts` | Shows what a `PurchaseGrant` WOULD look like | `source:"preview_only"`, `access:"not_granted"` fixed literals | Never calls the real grant path; no grant issued |
| 50 | `src/render/runtime_status.ts` | Runtime provider status page (`?runtimeStatus=1`) | Coarse `constructor.name` labels only | Calls zero provider/cache/bridge methods |
| 51 | `src/render/runtime_status.ts` | Categorizes status page into 5 fixed sections | cache/storage/provider/bridge/security groupings | Still read-only; no new data source |
| 52 | `src/worker.ts`, `render/promotion.ts` | Real-provider promotion preview behind a dual flag | Env flag AND query flag both required to call provider | Board/chat routes never call it |
| 53 | `src/render/promotion.ts` | Provider-preview diagnostics hardening | 3 fixed disabled-reason sentences; error text dropped | No change to when the real provider is invoked |
| 54 | `src/render/runtime_status.ts` | Runtime status JSON export (opt-in `&format=json`) | Field-allowlisted serializer, never raw `JSON.stringify` | Same zero-call guarantee as HTML page |
| 56 | `src/render/payment.ts`, `grant_preview.ts` | Purchase/grant preview copy hardening | Explicit "Preview only." notice; wording fixes | Gating logic unchanged; still no real grant |
| 58 | `src/runtime/health_check.ts` | Health-check boundary shape (disabled by default) | `canRunHealthCheck` always `disabled`/`skipped` | Issues no `fetch`/ping; not wired anywhere |

## 11. Docs

Cross-cutting documentation checkpoints that add no code themselves.

| Stage | File(s) | Role | Implemented | Not implemented |
|---|---|---|---|---|
| 55 | `docs/runtime_diagnostics.md` | Docs: safety contract for the Stage 50–54 diagnostics layer | What may/must-never be shown; test-policy fixed | No code change |
| 57 | `docs/provider_preview_safety.md` | Docs: safety contract for the Stage 49/52/53 provider preview | Dual-flag condition + forbidden-content list fixed | No code change |
| 100 | `docs/fedos_core_architecture_freeze_v1.md` | Docs: freezes the Stage 79–99 16-module crypto architecture | Role table, non-connection rules, non-claims section | No code changed at all |

*(Every other Docs-only stage — 40, 61, 64, 66–72, 108, 112, 119–121 — is
listed under the category its topic belongs to above, since this codebase's
convention is "one doc, one topic area," not a separate Docs track. This
section lists only the handful whose primary subject is the documentation
process itself.)*

---

## 12. Boundary Phase conclusion

- **Nothing that touches money, the network, or ciphertext is real anywhere
  in this codebase.** Every `PaymentProvider`, `FederationProvider`,
  `MarketplaceProvider`, `EntitlementProvider`, `ChatProvider`,
  `NotificationBridge`, and `StorageBackend` implementation shipped in 130
  stages is a `Noop*` or `Placeholder*` that runs in memory, denies or
  fixed-accepts requests, and issues **zero** `fetch`/WebSocket/relay/
  Lightning/Stripe calls.
- **Crypto is the same story, with one carve-out.** No public `encrypt`/
  `decrypt`/`deriveKey`/`randomBytes` exists — `packages/fedos-core-rust`'s
  public surface is still 22 fixed placeholder `pub fn`s/types (§2). The one
  real exception: Stage 74–101's AEAD/KDF crates (`chacha20poly1305`,
  `hkdf`, `argon2`, `aes-gcm`) are genuinely wired to `cargo test` and
  verified against official RFC 8439 / RFC 5869 / RFC 9106 / NIST-CAVP
  vectors — but **only inside `#[cfg(test)]`**, never reachable from
  production code, the Runtime, or the Worker.
- **`getrandom` (Stage 104)** is a real CSPRNG dependency adopted at the
  `Cargo.toml` level, but it is never called anywhere (prod or test) and
  there is still no public `randomBytes` implementation.
- **A handful of adapters are backed by genuinely real infrastructure, but
  always behind an opt-in/selection gate the Worker never auto-flips**: NIP-07
  signing delegation (Stage 10, real external signer, app never holds a key)
  and Noble BIP-340 Schnorr verification (Stage 8, real but verify-only) are
  the two truly "live" crypto-adjacent pieces; D1/KV/R2 adapters (Stages
  7/14/15/24) are real Cloudflare bindings selected only when explicitly
  bound; MeshKV (Stages 28–32) is a real imported external package whose
  network (WebRTC/signaling) is never started merely by selecting it —
  `goOnline()`/`startSignaling()` must be called explicitly, and nothing in
  the Runtime or Worker calls it.
- **The boundary and preview surface is, however, quite complete.** Every
  domain the product eventually needs (crypto, identity, storage,
  federation, social, creator commerce, governance, device) has a typed
  interface, a safe default implementation, and — for most of them — a
  read-only preview page gated behind an explicit `?xPreview=1` flag. Stage
  131–133 (this batch) is the deliberate stop-and-consolidate point named as
  a Stage 131 candidate in the Stage 119–130 README section; see
  `docs/implementation_readiness_checklist.md` and
  `docs/implementation_phase_roadmap.md` for what comes next.

**Key file paths for reference:** `packages/fedos-core-rust/src/lib.rs`
(crypto skeleton core), `src/runtime/create_runtime.ts` (the one place every
provider is selected), `src/worker.ts` (the one place every preview flag is
gated), `docs/fedos_core_architecture_freeze_v1.md` and
`docs/public_capability_matrix.md` (crypto-boundary consolidation),
`docs/creator_monetization_flow.md` and `docs/nostr_adapter_planning.md`
(cross-domain future-wiring plans).
