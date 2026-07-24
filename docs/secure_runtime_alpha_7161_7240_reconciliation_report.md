# Secure Runtime Alpha 7161–7240 — Reconciliation Report

**FedOS Conversation-Level Production Crypto and Identity Authority Wiring Arc.**

Written BEFORE any source change, per this repository's established
convention. Grounded in direct source inspection at base commit
`b44e1a45`, not narrative recollection from the prior Arc's own
completion declaration.

## The three named gaps, re-verified against real source

`docs/secure_runtime_alpha_7081_7160_deep_production_gap_report.md`
named three gaps. Re-inspection this Arc finds all three real, but
**far narrower to close than that report anticipated** — none require a
second WASM instance, a `NODE_ENV` bypass, or new cryptography. Every
piece needed already exists; only the LAST wiring step was missing.

### Gap 2 (identity) is actually already solved by wiring Gap 3 correctly

`FedosConversationRuntime`'s own constructor
(`src/conversation/runtime/fedos_conversation_runtime.ts:604`):
`const identityResolver = deps.identityResolver ?? new DelegatingFedosConversationIdentityResolver(deps.creatorIdentityAuthority);`
— when `identityResolver` is not explicitly supplied (the unconditional
default through the real Coordinator/packaged path), it ALREADY
delegates to `creatorIdentityAuthority`. The "generic anonymous-local"
identity Arc 7081-7160 observed was never a defect in the resolver
itself — it was `creatorIdentityAuthority` itself never being wired to
anything real. Closing Gap 3 (below) closes Gap 2 as a direct
consequence, with zero additional code.

### Gap 3 (encryption/identity authorities) — the classes are already generic, only the graph-assembly is missing

`FedosWasmConversationEncryptionAuthority`/`FedosWasmConversationDecryptionAuthority`
(`src/conversation/encryption/fedos_wasm_conversation_{encryption,decryption}_authority.ts`)
both accept the **generic `FedosMasterSeedAuthority` interface** in
their constructors, not the concrete `FedosWasmMasterSeedAuthority`
class — "Wasm" in the name is a historical label, not a type
constraint. Both call only `resolveConversationKey()`, a method
`FedosProductionMasterSeedAuthority`
(`src/desktop/production_activation/fedos_production_master_seed_authority.ts`)
already implements. `FedosSigningAuthorityNostrAuthorBinding` similarly
accepts the generic `FedosNostrSigningAuthority` interface, already
satisfied by `FedosProductionNostrSigningAuthority`
(`src/desktop/production_activation/fedos_production_nostr_signing_authority.ts`)
— the REAL signing authority the packaged Electron main
(`fedos_electron_beta_main.cts:503`) already constructs over the same
canonical `masterSeedAuthority` the Coordinator holds, and which
`config.conversationTransportSigningAuthority` already threads into
Peer Capability, Identity Transition, Deletion Request, and Conversation
Invitation today. **No existing crypto class needs a type change.** The
only missing piece is a factory that assembles the
`FedosConversationProductionCryptoGraph` shape from these ALREADY-REAL,
ALREADY-CANONICAL authorities, instead of the only existing factory
(`assembleFedosConversationProductionCryptoGraph()`,
`fedos_conversation_production_crypto_authority_factory.ts`) which
always constructs a SECOND, independent, `NODE_ENV`-gated
`FedosWasmMasterSeedAuthority` instance — exactly the pattern Alpha
6841-6920 already eliminated for Direct Ratchet
(`conversationDirectRatchetMasterSeedAuthority`), not yet extended to
Conversation-level identity/encryption.

### Gap 1 (NIP-17 wire adapter) — the Rust/WASM capability is real and tested; only the TS adapter method is missing

`NostrNip17V1WireAdapter`'s `nip44Wire` dependency requires
`FedosMasterSeedAuthority.encryptNip44Wire?`/`decryptNip44Wire?` —
declared OPTIONAL on the interface specifically because
`FedosProductionMasterSeedAuthority` "never constructed a real NIP-44
wire bridge" (`fedos_master_seed_authority.ts`'s own doc comment,
naming this exact class). The underlying Rust/WASM capability is
real and tested: `packages/fedos-core-rust/src/lib.rs` implements
`encrypt_nip44_wire`/`decrypt_nip44_wire` as `#[wasm_bindgen]` methods
on the SAME exported `FedosMasterSeedAuthority` struct whose
`seal_direct_ratchet_secret`/`restore_direct_ratchet_secret`/
`resolve_conversation_key` methods `FedosProductionMasterSeedAuthority`
ALREADY calls through its own `#handle`
(`FedosMasterSeedAuthorityHandle`, which already optionally declares
`encrypt_nip44_wire?`/`decrypt_nip44_wire?` in
`src/runtime/fedos_wasm_loader.ts:1667/1672`) — round-trip-tested,
tamper-tested, wrong-recipient-tested in Rust (`lib.rs:6353-6420`).
Closing this gap means adding two thin wrapper methods to
`FedosProductionMasterSeedAuthority`, mirroring
`sealDirectRatchetSecret`/`restoreDirectRatchetSecret`'s own exact
pattern (Alpha 6841-6920) — reusing an already-real, already-verified
Rust capability, zero new cryptography, zero Cargo.toml change.

## What this Arc actually builds (all pure wiring, per the mission's own constraint)

1. `FedosProductionMasterSeedAuthority.encryptNip44Wire()`/
   `decryptNip44Wire()` — thin wrappers over the already-real
   `h.encrypt_nip44_wire()`/`h.decrypt_nip44_wire()` handle methods.
2. A new factory,
   `assembleFedosConversationCanonicalProductionCryptoGraph()`
   (`src/conversation/encryption/production/`), building the SAME
   `FedosConversationProductionCryptoGraph` shape as the legacy factory
   but from the Coordinator's own already-activated
   `masterSeedAuthority`/`accountSigningAuthority`/`accountIndex` —
   zero second WASM instance, zero `NODE_ENV` dependency, reusing
   `StaticFedosConversationCreatorIdentityAuthority`,
   `FedosWasmConversationEncryptionAuthority`,
   `FedosWasmConversationDecryptionAuthority`,
   `FixedFedosConversationLocalAccountIndexAuthority`,
   `FedosSigningAuthorityNostrAuthorBinding` verbatim, unmodified.
3. `FedosDesktopRuntimeConfig` — one new optional field,
   `conversationCanonicalCryptoAuthority`, mirroring
   `conversationDirectRatchetMasterSeedAuthority`'s own established
   "already-activated canonical authority, reused directly" pattern.
4. `fedos_desktop_runtime.ts` — resolves the canonical graph
   alongside the existing legacy `productionCryptoGraph`; prefers it
   (mirrors the Ratchet field's own `??` precedence exactly) for
   `creatorIdentityAuthority`/`encryptionAuthority`/`decryptionAuthority`/
   `accountIndexAuthority`/`nostrAuthorBindingAuthority`, and for the
   NIP-17 wire adapter's own construction gate. The legacy
   `productionCryptoGraph` path is untouched and remains the fallback
   for any dev/test caller that still supplies `conversationProductionCrypto`
   directly — zero regression, zero removed capability, mirroring Alpha
   6841-6920's own explicit "zero regression, zero removed capability"
   discipline verbatim.
5. `FedosProfileInitializationCoordinator` — one new optional dep flag,
   `conversationCanonicalCryptoEnabled`, populating the new config field
   from the Coordinator's own already-required `masterSeedAuthority`/
   `accountSigningAuthority`/`accountIndex` — mirrors `archiveEnabled`'s
   and `directRatchetEnabled`'s own established "optional capability
   toggle" convention exactly.
6. **No change** to `stop()`'s existing Master Seed clear logic: the
   canonical authority is externally owned by the Coordinator's own
   lock/unlock lifecycle (mirrors `conversationDirectRatchetMasterSeedAuthority`'s
   own established "never cleared by this Runtime" discipline) — only
   the legacy, self-constructed `productionCryptoGraph.masterSeedAuthority`
   is cleared here, unchanged.

## What this Arc does NOT touch

Direct Ratchet's own cryptographic session logic, NIP-17's own Gift
Wrap/Seal/Rumor construction, Identity Transition, Signed Deletion, the
old Capability/Invitation Transport system, and the Rust/WASM core
(beyond confirming — never modifying — that `encrypt_nip44_wire`/
`decrypt_nip44_wire` already exist and are already tested). The
"routing regression" the Architecture Conformance Review named
(`fedos_desktop_runtime.ts:833-847`, Direct Ratchet not consulted by
`sendDirectMessage()`'s own internal route choice) is a SEPARATE,
Ratchet-routing concern this Arc's own mission explicitly excludes
("do NOT redesign Ratchet") — this Arc's mission is the STATIC NIP-17
v1 route's own crypto/identity graph, which is what the mission's
success criteria literally describes ("Encryption Authority selected
automatically... NIP-17 transport used").

## Real production vertical slice — feasibility confirmed

`FedosDesktopConversationContentAccessor.sendMessage()`
(`src/desktop/content_accessor/fedos_desktop_conversation_content_accessor.ts:307`)
already calls `conversationRuntime.sendDirectMessage()` — the SAME
Runtime method that performs real NIP-17 delivery when
`conversationDirectMessageDeliveryRoute: "nostr-nip17-v1"` is
configured. The Shell's public `sendMessage()`/`reply()` therefore
already reach real NIP-17 delivery once this Arc's wiring makes the
route's own prerequisites (a resolved crypto graph, a real wire
adapter) genuinely satisfiable through the real Coordinator/packaged
path — nothing about the send/reply path itself needs to change.
