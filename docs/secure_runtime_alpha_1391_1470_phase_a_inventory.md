# Secure Runtime Alpha 1391–1470 — Phase A: Integrated Source Inventory & Protocol Compliance Gate

Repository: `C:/wt/nostr-private-delivery`, branch `arc/nostr-private-direct-pairwise-fanout-delivery`, integrated from `b3b9b96` (Alpha 1261–1320), `3dc4f7a` (Alpha 1321–1390 Group Foundation), and `f715a5d` (Private Protocol Delivery review).

## 1. Exact existing outbound chain

- **Signing**: `src/nostr/sign/fedos_nostr_signing_authority.ts` (`FedosNostrSigningAuthority`), real implementation `FedosWasmNostrSigningAuthority` (`fedos_wasm_nostr_signing_authority.ts`) — WASM/Rust-backed, `kind` hard-fixed to `1` prior to this Arc.
- **Publish**: `FedosRelayOkCorrelatedNostrBoardPublisher` (`src/board/publish/nostr/`) — OK-correlated ACK/rejection/timeout distinction over `FedosRelay` (`src/desktop/fedos_relay.ts`).
- **Outbox**: `FedosBoardOutboxIntent` (`src/board/outbox/fedos_board_outbox_types.ts`) — Board-post-specific, keyed by `(postId, protocol, destination)`.
- **Scheduler/Retry/Observation**: `FedosPublishScheduler` + `FedosDeliveryObservationRepository`/`FedosDeliveryObservation` (`queued|publishing|accepted|rejected|failed`).
- Every one of these is Board-post-specific or protocol-generic — none carries a Conversation/Envelope/recipient concept.

## 2. Exact existing inbound chain

- `parseRelayInboundMessage()` (`src/desktop/relay_inbound_parser.ts`) — structural parsing only.
- `validateInboundNostrEvent()` (`src/desktop/combined_inbound_event_validator.ts`) — the ONE place that verifies Event ID + BIP-340 signature and produces a `FedosValidatedNostrEvent`. No kind-based classification, no dispatch, exists above it.

## 3. Wire-level gaps (before this Arc)

No private delivery of any kind: no recipient-specific wrapping, no private event kind, no inbound-to-local-history import path. The only writer of a local `FedosConversationMessageEnvelope` anywhere in the codebase was the LOCAL sender path (`FedosConversationEncryptionCoordinator.encrypt()`).

## 4. Recipient identity inputs

`resolveFedosConversationCounterpartyPublicKeyHex()` (Alpha 934, `src/conversation/encryption/identity/`) — the counterparty's `FedosConversationParticipantReference` must carry `authority === "nostr"` and a 64-hex `publicIdentifier`. Reused verbatim by this Arc for both Direct recipient resolution (Phase B) and Group per-recipient resolution (Phase C).

## 5. Signing identity authority

`FedosConversationLocalAccountIndexAuthority.localAccountIndex()` (fixed, injected, never inferred) + `FedosNostrSigningAuthority.publicIdentityForAccount()`/`.signEvent()`. Local-participant identity bound to an account index requires `FedosNostrAuthorBindingAuthority` (Alpha 688) — reused unmodified.

## 6. Event ID / idempotency conventions

NIP-01 `id` is the deterministic hash of `[0, pubkey, created_at, kind, tags, content]`. This Arc's own delivery-request id is deterministic from `(conversationId, envelopeId, recipientMembershipId)` — never randomly minted (`toFedosPrivateNostrDeliveryRequestId()`).

## 7. Current expiration support

None at the Nostr wire level anywhere in the repository (no NIP-40 `expiration` tag construction found). `expiresAt`-shaped fields exist only for Capability/invitation redemption and generic HTTP caching — unrelated to message delivery.

## 8. Deletion-request support

None. No Nostr deletion-request (`kind: 5`-shaped) construction exists anywhere in the repository.

## 9. Canonical local-history ownership

`FedosConversationMessageEnvelopePersistence` + `FedosConversationPayloadStorage` (Alpha 857/804) — unmodified. This Arc's inbound path writes into these SAME ports with fresh local ids; the Nostr transport event id is provenance only (`FedosPrivateNostrImportRecord`), never canonical.

## 10. Expected ripple scope

New domain `src/conversation/delivery/nostr/` (13 files). Minimal, additive extensions to 5 existing files:
- `src/nostr/sign/fedos_nostr_signing_authority.ts` — kind allowlist extended from `{1}` to `{1, FEDOS_PRIVATE_NOSTR_DELIVERY_KIND}` (Alpha 1399/1402's own justification).
- `src/conversation/runtime/fedos_conversation_runtime.ts` — new optional dependency fields + `privateNostrDelivery()` accessor.
- `src/conversation/runtime/fedos_conversation_runtime_assembly.ts` — new optional config fields threaded through.
- `src/desktop/runtime/fedos_desktop_runtime_config.ts` / `fedos_desktop_runtime.ts` — new optional config fields, mirroring the Group Arc's own recent precedent exactly.

## Alpha 1393 — Protocol Compliance Gate

**Verdict: zero implementation, zero normative material found anywhere in this repository.**

Every review this repository already contains was consulted directly (never inferred from memory):

- `docs/reviews/private_protocol_delivery_group_v1/04_nostr_readiness.md`: *"NIP-17 gift wrap does not exist in any form."* Names the exact open research questions (NIP-17's `kind:14`/`kind:1059` rumor/seal/gift-wrap three-layer structure, per-layer key derivation) as explicitly NOT researched, per that review's own "no external web research" ground rule.
- `docs/reviews/private_protocol_delivery_group_v1/20_normative_next_arc.md`: recommends the next Arc explicitly NOT resolve these open questions — defers further.
- `docs/reviews/private_group_pairwise_fanout/01_nip17_inventory.md`: *"Reconfirmed, not re-derived: zero NIP-17 code exists anywhere in this repository."*
- `docs/reviews/private_group_pairwise_fanout/02_gift_wrap_inventory.md`: *"Reconfirmed: zero gift-wrap code exists anywhere in this repository."* *"No ephemeral-per-recipient-key generation code of any kind exists."*
- `packages/fedos-core-rust/src/crypto/nip44_message_keys.rs`/`nip44_padding.rs`/`nip44_wire*.rs` — Rust-internal, non-exported NIP-44 message-key/padding primitives exist, but with no TypeScript-callable surface and no confirmation they implement the correct key schedule for a gift-wrap rumor layer specifically (that exact question is what `04_nostr_readiness.md` itself names as unresolved).

**Decision, per the Gate's own explicit fallback**: this Arc implements **protocol-neutral Private Nostr Delivery contracts** and explicitly does **not** claim NIP-17, NIP-44, or NIP-59 compliance anywhere.

Concretely:
- `FEDOS_PRIVATE_NOSTR_DELIVERY_KIND = 24700` — a FedOS-proprietary, disclosed, non-standard event kind. NOT NIP-17's `kind:14`/`kind:1059`. NOT interoperable with any other Nostr client. Chosen only to avoid colliding with the real, existing kind-1 public-post path (Alpha 1447's own Public Isolation requirement is otherwise unsatisfiable).
- Confidentiality is provided entirely by the EXISTING, real, already-proven pairwise ECDH + AEAD scheme (Alpha 861–890, real since Alpha 1261–1320) — never a second, invented encryption layer. No gift-wrap, no seal, no ephemeral per-recipient key scheme is implemented (inventing one would be inventing cryptography, explicitly prohibited).
- Sender identity is NOT hidden — the Nostr event's own `pubkey` field is the sender's real signing identity, exactly like every other Nostr event. No sender-hiding claim is made anywhere (Alpha 1402's own "sender identity protection only to the extent proven by the actual spec" — none, honestly disclosed).
- No wire-level expiration (`NIP-40`) encoding is implemented (Alpha 1432's own explicit "if unsupported or unavailable, stop this subfeature honestly" — no reviewed normative confirmation exists that a NIP-40 `expiration` tag is honored by this repository's own Relay harness or by any real-world Relay). `expiresAt` exists only as a non-authoritative, local retention INTENT field (Alpha 1396), never encoded onto the wire.
- No Nostr deletion-request (would-be `kind: 5`) construction is implemented — no reviewed normative material for it either (Alpha 1435's own explicit conditional: "If an existing reviewed Nostr deletion request can reference the transport event" — none exists here).
- `"ephemeral-online"` delivery mode (Alpha 1433) is an APPLICATION-LEVEL distinction only (no `expiresAt` attached, no offline-delivery expectation) — NOT backed by any wire-level ephemeral event-kind convention or Relay-enforced non-persistence guarantee.

## Alpha 1394 — Canonical vs Wire Identity (frozen)

- Local `FedosConversationMessageEnvelope.id` (sender's own) and local `FedosGroupMessageRecord.id` (sender's own) are canonical ONLY on the side that created them.
- The Nostr event's own `id` is transport provenance only (`FedosPrivateNostrImportRecord.nostrEventId`) — never treated as canonical.
- Each recipient's own wrapped event has a DIFFERENT `id` (independent signing per recipient).
- No recipient's own event id, and no foreign sender-supplied `groupMessageId` (carried as opaque `groupLinkage`), ever becomes the RECEIVER's own canonical id. The receiver always mints fresh local ids.

## Alpha 1395–1398 — Delivery Mode Vocabulary, Retention Intent, Transport Privacy Claims, Phase A Gate

See `fedos_private_nostr_delivery_mode.ts`'s own header for the mode vocabulary (`"mailbox" | "ephemeral-online"`, no generic boolean). See the Completion Declaration (`secure_runtime_alpha_1391_1470_completion_declaration.md`) §Metadata Threat Model / §Relay Trust Honesty for the full Transport Privacy Claims writeup. Canonical local history (`FedosConversationMessageEnvelopePersistence`/`FedosConversationPayloadStorage`) and transport facts (`FedosPrivateNostrDeliveryRequestPersistence`/`FedosPrivateNostrImportRecordPersistence`/`FedosDeliveryObservationRepository`) are structurally SEPARATE ports — Phase A Gate satisfied; Phase B proceeds.
