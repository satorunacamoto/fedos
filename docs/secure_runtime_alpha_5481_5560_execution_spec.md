# Secure Runtime Alpha 5481-5560: FedOS Direct Double Ratchet Cryptographic Core — Execution Spec

Architecture frozen. This Arc implements ONLY the pure cryptographic core the normative review (`review/fedos-forward-secrecy-double-ratchet-v1` @ `b34d608`) delegates to a future Arc — no live Conversation wiring, no NIP-17 mapping, no transport. See `docs/secure_runtime_alpha_5481_5560_reconciliation_report.md` for Phase A and `docs/secure_runtime_alpha_5481_5560_cryptographic_construction.md` for the full suite specification.

## Phase C — secret types

Three new `SecretHandleKind` variants (`lib.rs`, `mod secret_handle`): `DirectRatchetRootKeyMaterial`, `DirectRatchetChainKeyMaterial` (one kind for both send/receive directions — direction tracked by which struct field holds it), `DirectRatchetPrivateKeyMaterial`. Message keys deliberately reuse the EXISTING `AeadKeyMaterial` kind (immediately usable with the crypto core's own AEAD sealing, mirroring the Foundation Arc's own identical choice for its sealing key). No `Clone` anywhere (inherited from `SecretHandle` itself — never re-derived). Four new narrowly-scoped byte accessors added, each named for its one reviewed caller, mirroring the five pre-existing accessors' own convention exactly: `expose_bytes_for_internal_ratchet_ecdh`, `expose_bytes_for_internal_ratchet_root_kdf`, `expose_bytes_for_internal_ratchet_chain_kdf`, `expose_bytes_for_internal_ratchet_state_sealing`, `expose_bytes_for_internal_ratchet_bootstrap`.

## Phase D/E — root KDF and chain KDF

`packages/fedos-core-rust/src/crypto/direct_ratchet.rs` (new file, mirrors `conversation_key.rs`'s own module shape). Both KDFs use raw `hkdf::Hkdf<Sha256>` directly — NOT the shared `kdf_core::HkdfDomain` fixed-domain helper, which never accepts caller-supplied context. This mirrors the Foundation Arc's own already-accepted precedent (`fedos_derive_direct_ratchet_session_sealing_key_internal`'s two-stage extract-then-context-expand design) rather than inventing a new pattern.

- **Root KDF**: `Hkdf::extract(salt=current_root_bytes, ikm=dh_output)`, then TWO independent `expand()` calls with fixed labels (`"fedos-direct-ratchet-root-v1"`, `"fedos-direct-ratchet-chain-seed-v1"`), each label prefixed with the FULL session-binding context (session id + generation) — giving session/Device-pair/Conversation/generation binding at the cryptographic layer, not merely by separate storage. Deterministic for identical inputs; different context or different DH output provably yields different output (proven by dedicated tests).
- **Chain KDF**: treats the chain key as an already-extracted PRK (`Hkdf::from_prk`), then two independent `expand()` calls (`"fedos-direct-ratchet-message-key-v1"`, `"fedos-direct-ratchet-next-chain-v1"`) — a one-way, non-invertible advance. 16 consecutive advances proven to never repeat a message key.

## Phase F — DH ratchet

`generate_direct_ratchet_keypair_internal()`: fresh secp256k1 keypair via `fedos_random_bytes_32()` (real CSPRNG, never `Math.random`), bounded 8-attempt retry for the astronomically-rare invalid-scalar case, fails closed immediately on entropy-source unavailability (never masked by retrying). `direct_ratchet_ecdh_internal()`: mirrors `conversation_key.rs`'s own validated point-lift-and-multiply technique (same even-Y SEC1 convention for x-only Nostr-style keys — the review's own Phase F warning about "not silently mixing x-only Nostr signing keys with an incompatible ECDH representation" is satisfied by reusing the SAME validated conversion rule `conversation_key.rs` already established and tests already cover, never a second, divergent convention) but returns the RAW shared secret rather than baking in NIP-44's own fixed `"nip44-v2"` HKDF salt — a deliberate, narrow, independent function, never a modification of the frozen `conversation_key.rs`.

The full DH ratchet transition (`direct_ratchet_session.rs`, inside `decrypt()`) mirrors the real Signal Double Ratchet algorithm exactly: on receiving a message under a NEW remote ratchet public key, (1) the OLD receiving chain (if any) is drained up to the header's `previous_chain_length`, storing each derived key as a bounded skipped reference; (2) DH1 = ECDH(current local private, new remote public) seeds a new root + receiving chain; (3) a FRESH local keypair is generated and the OLD one is dropped (post-compromise security); (4) DH2 = ECDH(new local private, same new remote public) seeds a new root + sending chain. All four steps are computed into local variables before any field of `self` is mutated — proven atomic by a dedicated test (`tampered_ciphertext_is_rejected_and_state_is_unchanged`).

## Phase G — authenticated header

`packages/fedos-core-rust/src/crypto/direct_ratchet_header.rs` — a fixed-layout BINARY encoding (never JSON: `serde_json` is `[dev-dependencies]`-only in this crate's `Cargo.toml`). Exactly seven fields (schema version, suite label, session id, sender Device ref, ratchet public key, message number, previous-chain length, generation), each bounded (session id/Device ref capped at 256 bytes), with NO trailing bytes permitted after the last fixed field — this format's own unknown-field/tamper-append rejection. The header becomes the AEAD Additional Authenticated Data for the ciphertext it travels with (see Phase H).

## Phase H/I — message encrypt/decrypt

The existing `crypto::aead_internal::seal_internal`/`open_internal` only accept a FIXED, per-domain AAD label — never arbitrary caller bytes. Rather than widening that shared, frozen primitive (used by many other callers), this Arc adds a narrow, independent pair, `seal_direct_ratchet_message_internal`/`open_direct_ratchet_message_internal` (`direct_ratchet.rs`), using the SAME underlying `chacha20poly1305` crate and construction pattern directly, with the header bytes as AAD. Nonce is a FIXED all-zero 12-byte value — cryptographically sound because each `message_key` seals exactly one message ever, then is discarded (key-uniqueness alone provides AEAD safety here; documented explicitly as a deliberate departure from the Conversation-level static-key encryption's own fresh-nonce-per-message requirement, where the SAME key is reused across many messages).

`encrypt()`/`decrypt()` on the session compute the full candidate next-state (chain advance, skipped-key derivation, DH ratchet step where applicable) before attempting the actual AEAD operation, and commit to `self` in exactly one place, only after authentication has genuinely succeeded — Phase K's atomic-transition requirement, satisfied directly rather than via a bolted-on transaction wrapper.

## Phase J/K — skipped keys and atomicity

Bounded session-wide at 1000 total (the review's own number, applied here as a stricter, session-wide total rather than per-sub-chain — a conservative interpretation, never looser than the review's own bound), 14-day expiry evaluated on every successful decrypt. A message strictly behind the current receiving-chain frontier must already be a stored, non-expired skipped reference, or it is rejected as duplicate/replay — indistinguishable from each other by design (matching the review's own honest "not distinguishable from replay, rejected either way" acceptance). Atomicity is achieved structurally (see Phase H/I above), not via a bolted-on transaction log — this Arc's own "smallest transaction abstraction" is simply "compute everything fallible first, mutate `self` exactly once, at the end, only on success."

## Phase L — sealed persistence integration

Deliberately per-secret-kind, matching the Foundation Arc's OWN existing `FedosSealedDirectRatchetSecretRecordV1` granularity exactly (`root-key`/`sending-chain-key`/`receiving-chain-key`/`local-ratchet-private-key`/`skipped-message-key`) — no new sealed bundle format is invented. `FedosDirectRatchetSession::seal_root_key()`/`seal_sending_chain_key()`/`seal_receiving_chain_key()`/`seal_local_ratchet_private_key()`/`seal_all_skipped_keys()` each call the EXISTING, unmodified `FedosMasterSeedAuthority::seal_direct_ratchet_secret()` internally (Rust-to-Rust) — raw secret bytes never cross the WASM boundary into JS at all; only opaque sealed-blob strings do. `restore()` is the exact mirror, via `restore_direct_ratchet_secret()`. The local ratchet PUBLIC key is always recomputed deterministically from the restored private key at restore time — never taken as separate, unverified input.

## Phase M/N/O — Rust API, WASM bridge, TypeScript authority

Six candidate operations adopted almost verbatim from Phase M's own list (`initialize_as_receiver`/`initialize_as_sender` instead of a single ambiguous "initialize", `encrypt`/`decrypt`, `seal_*`/`restore` instead of one `seal_direct_ratchet_state`/`restore_direct_ratchet_state` — kept per-secret-kind per Phase L above). `encrypt()`/`decrypt()` combine the header and ciphertext into ONE opaque wire message (`[4-byte BE length][header][ciphertext]`) — this Arc remains transport-neutral; nothing here decides how this blob travels. Every WASM-exposed method returns `Option<T>` (→ `T | undefined`/`null` in TypeScript), never a thrown exception for an ordinary cryptographic failure. The TypeScript authority (`src/conversation/ratchet/fedos_direct_ratchet_cryptographic_session.ts`) is standalone — it does not import or depend on `FedosDirectRatchetStateRuntime` (the Foundation Arc's own state facade), per Phase M's own "prefer a constructible standalone Runtime" preference; a future integration Arc decides how the two are wired together.

## Verification

`npm run typecheck`: clean except the SAME two pre-existing, unrelated baseline errors already documented by the Foundation Arc's own completion declaration (confirmed unchanged via inspection — this Arc touches neither file).

`cargo test --lib`: 592 passed (59 new: 34 `direct_ratchet` + 17 `direct_ratchet_session` + 8 `direct_ratchet_header` + 12 pre-existing Foundation Arc), 1 pre-existing failure (`secp256k1_dependency_guard`, confirmed identical to the Foundation Arc's own documented pre-existing failure — `Cargo.toml` untouched by this Arc either).

`npm run build:wasm`: succeeds; `FedosDirectRatchetSession`'s full method surface confirmed present in the generated `.d.ts`.

New TypeScript tests: 14 passed across 3 files (real vertical slice, TS authority boundary with a mocked loader, structural guards).
