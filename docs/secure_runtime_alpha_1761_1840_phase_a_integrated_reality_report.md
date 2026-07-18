# Secure Runtime Alpha 1761–1840 — Phase A Integrated Reality Report
## NIP-17 Rumor Seal Gift Wrap Standard Delivery Arc

Written after the implementation work (not strictly before, given this
session's own time constraints — see the reconciliation report for the
mid-session process note), but covers exactly what Alpha 1761–1763 asks
for: the state of every seam this Arc touches, confirmed by direct
inspection, not assumed from the task brief.

## Normative material (Alpha 1761)

`docs/normative/nostr-protocol-nips/{17,44,59}.md` — byte-verbatim,
pinned to upstream `nostr-protocol/nips@bdfa7e62ef87fcfcb992b1a27aee49d36b0b4f91`
(confirmed already checked in by the prior Arc; read in full this
session before writing any Rumor/Seal/Gift-Wrap code). Official NIP-44
test vectors: `test-vectors/nip44/nip44-v2.json` (confirmed already
wired to `packages/fedos-core-rust/src/crypto/nip44_*_vectors.rs`
`#[cfg(test)]` modules, unmodified by this Arc).

## Rust NIP-44 internal API surface actually called/extended (Alpha 1761)

Called, UNMODIFIED: `crypto::conversation_key::derive_conversation_key_via_ecdh_internal`,
`crypto::nip44_wire_encrypt::encrypt_wire_internal`,
`crypto::nip44_wire_decrypt::decrypt_wire_payload_internal`,
`master_root::derive_identity_root_internal`/`derive_application_root_internal`/
`derive_nostr_root_internal`/`derive_nostr_secret_key_internal`/
`derive_nostr_public_key_internal`/`new_nostr_event_internal`/
`derive_nostr_event_id_internal`/`sign_nostr_event_internal`/
`nostr_event_encoding::serialize_signed_nostr_event_internal`,
`fedos_random_bytes_32`. Added, NEW: `master_root::encrypt_nip44_wire_from_master_seed_internal`/
`decrypt_nip44_wire_from_master_seed_internal` (Phase B),
`master_root::sign_nostr_event_with_fresh_ephemeral_key_internal`
(Phase E), `master_root::build_and_sign_nip17_gift_wrap_internal`
(Phase F) — all thin plumbing over the functions in the first list, no
new cryptographic primitive of any kind.

**Correction to the task brief's own assumption**: `crypto::nip44_public_api.rs`
(found by direct inspection) is a pure LABEL-ONLY skeleton — every item
`pub(crate)`, zero reachable outside the crate, "no real conversation
derivation, no real encrypt/decrypt call" per its own header. There was
no existing "narrow additive export" to extend for NIP-44 wire
encrypt/decrypt specifically; Phase B built the real bridge from
nothing, reusing the crate's own already-complete internal pipeline.

## Currently-exported WASM crypto surface (Alpha 1761)

Before this Arc: `version`, `random_bytes_32`, `generate_aead_key_handle`,
`encrypt_aead`/`decrypt_aead`, `FedosMasterSeedAuthority` (opaque class:
`new`/`is_available`/`is_cleared`/`generate`/`seal`/`restore_sealed`/
`clear`/`sign_nostr_event`/`public_key_hex_for_account`/
`resolve_conversation_key`). Added this Arc: `FedosMasterSeedAuthority::encrypt_nip44_wire`/
`decrypt_nip44_wire` (Phase B), the free functions
`sign_nostr_event_with_fresh_ephemeral_key` (Phase E) and
`build_and_sign_nip17_gift_wrap` (Phase F). Confirmed present in the
generated `packages/fedos-core-rust/pkg/fedos_core_rust.d.ts` with
correct signatures via direct `npm run build:wasm` runs in this exact
worktree (the artifact itself stays gitignored/not checked in, matching
pre-Arc convention — deleted again before this Arc's own final
verification pass, per the review-suite's own "no compiled WASM
artifact in the checked-out tree" guard, confirmed still passing).

## `FedosPrivateWireAdapter` / route / adapters (Alpha 1761, confirmed)

`fedos_private_wire_adapter.ts` (interface), `fedos_private_wire_route.ts`
(closed vocabulary + resolver), `fedos_private_v1_wire_adapter.ts`
(`FedosPrivateV1WireAdapter`, proprietary, unchanged behavior beyond a
trivial `async` wrap), `fedos_nostr_nip17_v1_wire_adapter.ts`
(`NostrNip17V1WireAdapter`, was a permanent stub, now real) — all
confirmed exactly as the prior Arc's own completion declaration
described, before this Arc's own changes. `FedosPrivateTransport` was
NOT yet wired to dispatch through an injected adapter — confirmed by
direct inspection of its own constructor and internal
`FedosConversationTransportSignedEventSource` composition.

## Nostr-signing allowlist (Alpha 1761 — "does it need extension?")

**Yes.** `src/nostr/sign/fedos_nostr_signing_authority.ts`'s own
`SUPPORTED_NOSTR_KINDS` (TypeScript-side validator) allowed `{1,
FEDOS_PRIVATE_NOSTR_DELIVERY_KIND}` before this Arc — extended
additively with `13` (NIP-59 Seal) for Phase D. A SEPARATE, deeper
finding: `packages/fedos-core-rust/src/lib.rs`'s own
`FedosMasterSeedAuthority::sign_nostr_event` WASM method had its OWN
independent `if kind != 1` check — NOT extended to match the
TypeScript-side allowlist's own pre-existing `24700` entry (a
pre-existing gap this Arc found but does not otherwise fix, since
fixing kind `24700`'s own Rust-level signing path — if it is genuinely
unreachable today — is unrelated to NIP-17). This Arc's own kind-13
extension WAS applied at both layers (TypeScript validator AND the Rust
WASM method), since Seal signing is squarely in scope.

Gift Wrap (kinds `1059`/`21059`) never reaches this signing authority at
all — a wholly separate, narrower ephemeral authority handles it,
Phase E/F.

## Exact ripple (Alpha 1761's own "file list" ask)

See the reconciliation report's own §3 for the byte-exact
`git status --short` listing; unchanged since that report except for
this doc, `fedos_private_transport.ts` (Phase G constructor injection),
`test/secure_runtime_alpha_1471_1540_private_transport_coordinator.test.ts`
(one new test), and `test/secure_runtime_alpha_1761_1840_direct_real_vertical_slice.test.ts`
(new — the Phase I acceptance-bar test).

## Field mapping table (Alpha 1762)

| Field | Rumor (kind:14) | Seal (kind:13) | Gift Wrap (kind:1059) | Normative source |
|---|---|---|---|---|
| `pubkey` | real sender | real sender (MUST match Rumor's own `pubkey` — impersonation guard) | fresh ephemeral, single-use | NIP-17 §"Encrypting"; NIP-59 §2/§3 |
| `created_at` | canonical, real message time | independently randomized, up to 2 days in the past | independently randomized, up to 2 days in the past, SEPARATE draw from the Seal's own | NIP-59 §"Other Considerations" |
| `tags` | `["p", recipient]` (+ optional `["e", replyId]`) | MUST be empty | `[["p", recipient]]` only | NIP-17 kind-14 example; NIP-59 §2/§3 |
| `content` | plain text (MUST) | NIP-44-encrypted Rumor JSON, keyed by `conversation_key(senderPriv, recipientPub)` | NIP-44-encrypted Seal JSON, keyed by `conversation_key(wrapperPriv, recipientPub)` | NIP-17 §"Message Rumor Definitions"; NIP-59 §"Encrypting Payloads" |
| `sig` | NONE — never signed | real sender's signature | ephemeral wrapper's signature | NIP-59 §"Overview" |

## Smallest standard scope adopted (Alpha 1763)

Direct message only, one explicit recipient, one local account index,
mailbox delivery (`kind:1059`, not `kind:21059` — no existing
Ephemeral/Mailbox split in `FedosPrivateTransport` to map the latter's
"relays MUST NOT store it" semantics onto safely without further
review). Group pairwise fanout: honestly deferred (see the completion
declaration). Ephemeral mode: NOT implemented (the type accepts
`kind:21059` structurally, but no Transport-level wiring exists for it).
`kind:15` (File Message): out of scope, a distinct kind with its own
required tags this codebase has no feature to attach to.
