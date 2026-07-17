# Secure Runtime Alpha 1391–1470 — Completion Declaration

## Nostr Private Direct and Pairwise Fanout Delivery Arc

Branch: `arc/nostr-private-direct-pairwise-fanout-delivery`, worktree `C:\wt\nostr-private-delivery`, built from `arc/private-conversation-activation-direct-messaging` at `b3b9b96` (Alpha 1261–1320 tip).

## Integrations

Two prerequisite sibling branches merged into this dedicated integration branch, reported in full:

1. `f715a5d` (`review/private-protocol-delivery-group-v1`, "Private Protocol Delivery and Group Encryption V1 Specification Review") — clean merge, zero conflicts. Adds `docs/reviews/private_protocol_delivery_group_v1/` (20 docs + index) and `test/reviews/private_protocol_delivery_group_v1/` (3 tests).
2. `3dc4f7a` (`arc/private-group-pairwise-fanout-foundation`, "Alpha 1321–1390 Private Group Pairwise Fanout Foundation Arc," already containing `b205ff0`) — two conflicts, both clean additive unions: `README.md` (both branches' own status banners, resolved chronologically — the 1321–1390 banner placed above the 1261–1320 banner, per Alpha numbering) and `src/desktop/runtime/fedos_desktop_runtime_config.ts` (an import and a field-declaration conflict, resolved by keeping both sides' additions). Merge commits: `f12553e`, `85b66d6`.

No unrelated branch was integrated.

## Normative protocol source used

**None exists in this repository.** The Protocol Compliance Gate (Alpha 1393) was run first, before any production code: every review already present (`docs/reviews/private_protocol_delivery_group_v1/04_nostr_readiness.md`, `20_normative_next_arc.md`; `docs/reviews/private_group_pairwise_fanout/01_nip17_inventory.md`, `02_gift_wrap_inventory.md`, `20_final_recommendation.md`) was read directly and each independently reconfirms "zero NIP-17/NIP-44-wire/NIP-59/gift-wrap code exists anywhere in this repository," names the exact open research questions, and explicitly defers them to a future Arc. See `docs/secure_runtime_alpha_1391_1470_phase_a_inventory.md` for the full citation trail.

**Per the Gate's own explicit fallback, this Arc implements protocol-neutral Private Nostr Delivery contracts and makes NO NIP-17/NIP-44/NIP-59 compliance claim anywhere** — in code, comments, or this document. `FEDOS_PRIVATE_NOSTR_DELIVERY_KIND = 24700` is a disclosed, FedOS-proprietary event kind, not a registered NIP, not interoperable with any other Nostr client.

## Direct wire model

`src/conversation/delivery/nostr/fedos_private_nostr_wire_payload.ts` — the Nostr event `content` field carries base64(JSON) of `{schemaVersion, envelopeId, conversationId, senderMembershipId, keyEpoch, createdAt, replyToEnvelopeId, suite, ciphertextBase64, groupLinkage}`. Every one of the sender's own Envelope-identifying fields travels VERBATIM (required for the Alpha 856 associated-data header to re-derive correctly on decrypt — see that file's own header for the full reasoning); the receiver treats them as opaque foreign values, never its own local ids. No plaintext, no key, no seed, no passphrase anywhere in this shape (verified by `secure_runtime_alpha_1391_1470_architecture_and_secret_guards.test.ts`).

Confidentiality is provided entirely by the EXISTING, real, already-proven pairwise ECDH + AEAD scheme (Alpha 861–890, real since Alpha 1261–1320) — this Arc invents no second encryption layer, no gift-wrap, no ephemeral per-recipient key. The recipient is addressed via a single NIP-01 `["p", recipientPubKeyHex]` tag; sender identity is the event's own real `pubkey` field, exactly like every other Nostr event — no sender-hiding is claimed anywhere.

## Group recipient fanout

`src/conversation/delivery/nostr/fedos_private_nostr_group_delivery_planner.ts` — reuses the EXISTING, unmodified `FedosGroupFanoutDeliveryPersistence`/`FedosGroupDirectPathPersistence` (Alpha 1321–1390): for each `"stored"` fanout delivery record, resolves the recipient's own Group child Direct path (itself a real `direct` Conversation) and calls the SAME outbound coordinator used for plain Direct delivery, once per recipient. Never one shared group event. The sender's own local Group Message id travels as opaque `groupLinkage` inside the authenticated encrypted payload (Alpha 1394/1411) — never becomes any recipient's own canonical id. Delivery-request ids are collision-free per recipient by construction (keyed by each recipient's own distinct `directConversationId`). A per-recipient result array is always returned (Alpha 1413/1414) — one recipient's failure never erases another's success, and the existing local `FedosGroupMessageRecord`/`FedosGroupFanoutDeliveryRecord` state is never rewritten by this layer.

## Outbox/Publisher/ACK behavior

`FedosPrivateNostrDeliveryRequest` (`fedos_private_nostr_delivery_request.ts`) — a NEW, parallel immutable intent record (deliberately NOT forced into `FedosBoardOutboxIntent`, which is structurally Board-post-specific; this follows the SAME "adapt the established pattern, not the literal class" precedent the Group Arc itself already set). Delivery STATE reuses the EXISTING `FedosDeliveryObservationRepository`/`FedosDeliveryObservation` vocabulary (`queued|publishing|accepted|rejected|failed`) directly, keyed by the delivery request's own deterministic id — no second state vocabulary invented.

`FedosRelayOkCorrelatedPrivateNostrDeliveryPublisher` (`fedos_private_nostr_delivery_publisher.ts`) mirrors `FedosRelayOkCorrelatedNostrBoardPublisher`'s own OK-correlation technique field-for-field over the EXISTING, unmodified `FedosRelay`. `accepted: true` → `"accepted"`; genuine `accepted: false` → terminal `"rejected"`; timeout/socket error → retryable `"failed"`. Relay acceptance is never conflated with recipient receipt or decryption — this layer has no visibility into either.

**Named limitation**: this coordinator performs no automatic retry of its own and is not wired into the generic `FedosPublishScheduler` (Alpha 1407's own "do not modify the generic Scheduler's protocol neutrality" — and no NEW protocol-specific scheduler wrapper was built either, given this Arc's own effort scope). `deliverEnvelope()`/`deliverGroupMessage()` are single, caller-invoked attempts; a caller (or a future Scheduler integration) consults the durable Observation record to decide whether to retry a `"failed"` (transient) delivery — exactly as the Board's own Scheduler already consults `retryPolicy` for the generic Outbox.

## Inbound import

`FedosPrivateNostrInboundDeliveryCoordinator` (`fedos_private_nostr_inbound_delivery_coordinator.ts`) — an adapter strictly ABOVE the existing, unmodified `validateInboundNostrEvent()`; performs no Event ID/signature verification of its own. Pipeline: classify by kind → recipient ownership gate (fixed, injected account index; no scan) → duplicate detection (keyed by the event's own intrinsic NIP-01 id, before any decrypt) → outer wrap validation → Conversation Resolution (`fedos_private_nostr_inbound_conversation_resolver.ts`, reused identically for both Direct and Group child paths — a Group path IS a real Direct Conversation) → unwrap/decrypt via the EXISTING `FedosConversationDecryptionAuthority.decrypt()` directly (no cryptography in TypeScript) → on success, a FRESH local Envelope/Payload pair is written through the EXISTING, unmodified persistence ports, making the received message readable through the UNCHANGED `readDirectMessage()`/`listDirectMessages()`. `replyToEnvelopeId` is always `null` on import (V1 simplification, explicitly documented — the sender's own `replyToEnvelopeId` is a foreign id meaningless in the receiver's own namespace).

Unknown senders quarantine/drop (`"unknown-sender"`, Alpha 1425) — no Membership is ever auto-created.

## Mailbox/ephemeral behavior

`FedosPrivateNostrDeliveryMode` = `"mailbox" | "ephemeral-online"` (closed vocabulary, no generic boolean). `"ephemeral-online"` is an APPLICATION-LEVEL distinction only (no `expiresAt` attached) — NOT backed by any wire-level ephemeral event-kind convention or Relay-enforced non-persistence guarantee, since no reviewed normative material confirms either exists. Default mode is explicit (`"mailbox"`, documented in `FedosConversationRuntimeDependencies`'s own header).

## Retention-intent honesty

`expiresAt` on a `FedosPrivateNostrDeliveryRequest` is a non-authoritative, sender-side retention INTENT only — never encoded onto the wire (no NIP-40 tag construction — Alpha 1432's own "if unsupported, stop this subfeature honestly" was invoked), never proof of deletion, never copied into local canonical retention state automatically.

## Deletion-request honesty

**Not implemented.** No reviewed normative Nostr deletion-request material exists in this repository (Alpha 1435's own explicit conditional was not met) — this subfeature is honestly incomplete, not silently faked.

## Local canonical-history model

Local Envelope/Payload persistence (Alpha 857/804, unmodified) remains the sole source of truth. The Nostr transport event id is provenance only (`FedosPrivateNostrImportRecord.nostrEventId`), never canonical. Relay history is never read back as a source of truth — this Arc's own inbound path only ever processes ONE already-validated event at a time, handed to it by a caller (see "Still out of scope" below).

## Hostile-Relay limitations (Alpha 1448/1450)

A Relay may retain ciphertext indefinitely, ignore any retention intent, correlate connecting-IP/timing/size/frequency metadata across events it observes, and may be a different Relay than the one a recipient later fetches from. None of this is prevented or claimed prevented anywhere in this Arc. Local privacy claims remain content-level only: the AEAD ciphertext itself resists a Relay that cannot derive the pairwise key, but sender pubkey, recipient-tag pubkey, event timing, and event size are all Relay-observable in the clear, exactly as with any Nostr event. No network-level anonymity claim is made. Key compromise (either participant's local Master Seed) breaks confidentiality for every message exchanged under that key pair, retroactively — no forward secrecy exists in the underlying pairwise ECDH scheme (no key ratcheting is implemented anywhere in this repository); this Arc claims none.

## Real-crypto compatibility (Alpha 1458)

Both vertical-slice tests use the Fake Encryption/Decryption Authority pair (this Arc's own baseline verification tier, matching every prior Arc's own default) combined with a REAL Schnorr-signing `FedosNostrSigningAuthority` (`@noble/curves`, real BIP-340 signing/verification through the unmodified `validateInboundNostrEvent()`) and a real OK-correlated Relay publisher. This Arc's own new coordinators (`FedosPrivateNostrOutboundDeliveryCoordinator`/`FedosPrivateNostrInboundDeliveryCoordinator`) are Authority-agnostic by construction — they call `FedosConversationEncryptionAuthority`/`DecryptionAuthority` through the exact same interface the Alpha 1261–1320 real WASM-backed Authorities already implement, so swapping in `assembleFedosConversationProductionCryptoGraph()`'s own real graph requires no code change here.

**Named limitation, honestly disclosed**: `FedosConversationProductionCryptoGraph` (Alpha 1273) does not expose a raw `FedosNostrSigningAuthority` — only the narrower `FedosNostrAuthorBindingAuthority` derived from it. A caller wanting full WASM-backed identity coherence between production crypto's own signing identity and this Arc's private-delivery signing identity must independently construct a `FedosWasmNostrSigningAuthority` against the SAME sealed-seed source. This Arc did not build (or run) a combined real-WASM-signing-plus-real-WASM-crypto vertical slice, given effort constraints — the two real-crypto properties (real AEAD, real Schnorr signing) are each independently proven real elsewhere in this repository (Alpha 1261–1320's own vertical slice; `test/secure_runtime_alpha_713_failure_matrix_and_safety.test.ts`'s own real-signing pattern, reused verbatim here), but not composed together in one single test in this Arc.

## Production Gate Honesty (Alpha 1459)

The Production-mode WASM Dev-only Gate (`fedos_wasm_loader.ts#evaluateDevOnlyGate()`) is byte-for-byte untouched by this Arc (verified structurally in `secure_runtime_alpha_1391_1470_architecture_and_secret_guards.test.ts`). Private network delivery, as built by this Arc, is: **development-Runtime capable** (real signing/AEAD both work under `NODE_ENV=development` with the WASM artifact built, per the "Real-crypto compatibility" section above) — never packaged-Runtime or production-enabled, matching the pre-existing, permanent, reviewed "never Production, never Worker" boundary exactly.

## Public isolation (Alpha 1447)

Verified in both vertical-slice tests and the guards test: the private-delivery Nostr kind (`24700`) is never `1`; no private plaintext or ciphertext appears in any public Board post, public Outbox target, or public kind-1 event construction path (`src/board/publish/nostr/fedos_board_post_to_nostr_unsigned_event.ts` remains byte-for-byte unmodified and is never referenced by this Arc's own CODE, only discussed in prose explaining the design decision).

## Metadata threat model (Alpha 1448)

A Relay observes: the connecting socket's IP (unless hidden by external means, out of scope), the recipient's own pubkey (visible in the `p` tag), the sender's own pubkey (the event's own `pubkey` field), event timing (`created_at`), event byte size, which Relay(s) a client selects to publish to, and repeated-retrieval/subscription patterns. A future Onion Transport Arc (this Arc's own preferred recommendation, below) would reduce connecting-IP correlation and Relay-selection correlation — nothing here implements or claims any part of that.

## Tests / typecheck / cargo / WASM

- `npm run typecheck` — clean relative to baseline (one pre-existing, unrelated failure in `test/secure_runtime_alpha_477_scheduler_lifecycle_model.test.ts`, unchanged from every prior Arc).
- Focused private-delivery tests — 4 new files, 26 tests, all passing: `secure_runtime_alpha_1391_1470_wire_payload_codec.test.ts` (10), `secure_runtime_alpha_1391_1470_direct_delivery_vertical_slice.test.ts` (2), `secure_runtime_alpha_1391_1470_group_delivery_vertical_slice.test.ts` (1), `secure_runtime_alpha_1391_1470_architecture_and_secret_guards.test.ts` (13).
- Direct/Group regression tests (`secure_runtime_alpha_606_runtime_assembly.test.ts`, `secure_runtime_alpha_758_local_runtime_ownership.test.ts`, `secure_runtime_alpha_1321_1390_group_vertical_slice.test.ts`) — all still passing; `FedosRunningDesktopRuntime`'s own exposed key set is unchanged by this Arc (this Arc's new accessor lives on `FedosConversationRuntime`, not on the outer handle).
- Full `npm test` — precisely diffed via a stashed clean-baseline re-run in this exact worktree: baseline 12313 total / 12071 passed / 242 failed (190 failing files); this Arc's own tree 12339 total / 12090 passed / 249 failed (195 failing files). Net: +26 tests (all this Arc's own new tests), +19 newly passing, +7 newly failing — every one of those 7 traced to exactly 5 newly-failing FILES, and every one of those 5 is a pre-existing, git-status-dependent "working tree unchanged" staleness guard (`test/secure_runtime_alpha_531_ripple_review.test.ts` and four `test/reviews/*/`) that trips on ANY uncommitted `src/` change outside its own older allowlist — the SAME documented, expected category every prior Arc's own README banner already names. Zero attributable to a genuine functional regression in this Arc's own code.
- Rust/Cargo/WASM — not run. This Arc's own new code depends on the EXISTING `FedosConversationEncryptionAuthority`/`DecryptionAuthority`/`FedosNostrSigningAuthority` interfaces only, already proven real by Alpha 1261–1320 and never re-derived here; no new Rust/WASM surface was added, so real artifact compatibility is inherited, not re-verified end-to-end in this Arc (see "Real-crypto compatibility" above for the honest scope of what WAS verified).

## Dependency status

`package.json`/`package-lock.json`/`Cargo.toml` byte-for-byte unchanged. No new npm or Cargo dependency (verified structurally by the guards test's own import-specifier check).

## p2p/ untouched

Confirmed — no delivery source file imports, references, or resolves into `p2p/` (verified structurally by the guards test).

## Cleanup

`dist/`, `target/`, `Cargo.lock`, `pkg/` were never created in this worktree (no build/WASM step was run). No temporary Relay data, seed, or log file outside the test harness's own `mkdtempSync()`-managed directories (auto-cleaned by the OS temp-directory convention this repository's own test suite already relies on throughout).

## Still out of scope (honest, unchanged from the Arc's own preconditions)

Guaranteed Relay deletion; Onion routing; mixnet; Sender Keys; MLS; forward secrecy (no key ratcheting exists); multi-device sync; backup; ActivityPub/ATProto/Session private delivery; GUI; Worker production activation; operator anonymity; physical erasure; Ontology/AI. Additionally, specific to this Arc: NIP-17/NIP-44-wire/NIP-59 compliance (the Protocol Compliance Gate blocked it — no normative material exists locally); Nostr deletion requests; wire-level (NIP-40-style) expiration encoding; automatic Runtime-level subscription/reconnect wiring (`receiveInboundEvent()` is a manually-invoked coordinator method — no `FedosRelay.onSubscriptionMessage()` listener is automatically registered by `startFedosDesktopRuntime()` in this Arc); automatic retry/Scheduler integration for outbound private delivery.

## Recommended next Arc

Since normative NIP mapping remains blocked (no NIP-17/44/59 material exists locally), per this Arc's own preconditions:

**Nostr Private Wire Specification and Vector Completion Arc** — fetch and review the actual NIP-17/NIP-44/NIP-59 texts, produce a reviewed normative specification document in this repository, and re-evaluate whether this Arc's own protocol-neutral wire model (or a NIP-17-compliant successor) is the right target before any interoperability claim is made.
