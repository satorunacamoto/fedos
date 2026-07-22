# Secure Runtime Alpha 5561–5640 — Execution Specification
## FedOS Direct Double Ratchet Conversation Runtime and NIP-17 Integration Arc

This is the as-built specification for the Arc whose Phase A reconciliation
report is `secure_runtime_alpha_5561_5640_reconciliation_report.md`. It
records what was actually implemented, not a plan.

## 1. Scope

Wires the already-real, already-tested `FedosDirectRatchetStateRuntime`
(Alpha 5401–5480) and `FedosDirectRatchetCryptographicSession` (Alpha
5481–5560) into the already-real NIP-17 Rumor/Seal/Gift Wrap wire adapter
lineage (`100c231`, merged as this Arc's own prerequisite) and the existing
Direct Conversation send/receive path. Direct (1:1) Conversations only —
Group/Sender-Key/MLS/PQ/Identity Rotation are untouched.

## 2. New production files

| File | Responsibility |
|---|---|
| `src/conversation/ratchet/fedos_direct_ratchet_device_pair_resolver.ts` | Phase C — resolves the canonical, side-independent `FedosDirectRatchetSessionId` for a (local account, local Device, remote account, remote Device, Conversation) tuple from real `FedosDeviceRegistryPersistence` facts; denies unknown/revoked/not-trusted Devices. |
| `src/conversation/ratchet/fedos_direct_ratchet_route_resolution.ts` | Phase B — the closed route decision layered over the device-pair resolver and `FedosDirectRatchetStateRuntime.readiness()`; downgrade-detection; reuses (never edits) `resolveFedosPrivateWireRoute()`. |
| `src/conversation/delivery/nostr/nip17/fedos_direct_ratchet_nip17_payload.ts` | Phase D/F — the strict, closed `"session-init"` / `"message"` payload codec carried as NIP-17 Rumor `.content` plain text. |
| `src/conversation/ratchet/fedos_direct_ratchet_live_session_cache.ts` | In-process cache of live `FedosDirectRatchetCryptographicSession` handles, shared between outbound/inbound integration within one Runtime instance. |
| `src/conversation/ratchet/fedos_direct_ratchet_secret_checkpoint.ts` | Bridges `sealState()`'s already-sealed hex fields into durable persistence (see §5). |
| `src/conversation/ratchet/persistence/fedos_direct_ratchet_remote_public_key_persistence.ts` | Small additive current-value port for the counterparty's live ratchet DH public key (see §5). |
| `src/conversation/ratchet/persistence/fedos_direct_ratchet_live_state_snapshot_persistence.ts` | Small additive current-value port for the four fixed-kind sealed secrets (see §5). |
| `src/conversation/ratchet/fedos_direct_ratchet_outbound_integration.ts` | Phase D/E — real session establishment (receiver role) and real message send. |
| `src/conversation/ratchet/fedos_direct_ratchet_inbound_integration.ts` | Phase G — real inbound dispatch: session-init (sender role) and message decrypt/import. |
| `src/conversation/ratchet/fedos_direct_ratchet_conversation_runtime.ts` | Phase M — the narrow Runtime facade (`initializeDirectRatchetSession`, `resetDirectRatchetSession`, `getDirectRatchetStatus`/`assessDirectRatchetReadiness`, `sendDirectRatchetMessage`, `importRatchetPrivatePayload`). |

## 3. Modified production files (additive only)

- `src/conversation/transport/fedos_private_wire_route.ts` — widened the closed route vocabulary with `"nostr-nip17-v1-ratchet"` (never renamed/repurposed the existing two values; `resolveFedosPrivateWireRoute()`'s own body is unchanged).
- `src/conversation/transport/fedos_private_transport.ts` — added `sendMailboxNip17Control()`, the control-message counterpart of the existing `sendMailboxNip17()`, for ratchet-protocol facts (session-init) not backed by a Conversation Envelope. Byte-for-byte the same route/adapter/Outbox mechanics.
- `src/conversation/messaging/fedos_conversation_direct_messaging_coordinator.ts` — added the optional, structurally-separate `ratchetDelivery` dependency (parallel to the existing `delivery`), and one new branch in `sendDirectMessage()`. Omitting both leaves the method byte-for-byte unchanged.
- `src/conversation/messaging/fedos_conversation_direct_message_send_result.ts` — additively widened `delivery`'s type union.
- `src/conversation/runtime/fedos_conversation_runtime.ts` — added the optional `directRatchet` dependency bundle, the `directRatchet()` accessor, and extended `receiveNip17Rumor()`'s own body to try the ratchet facade first (falling through to the existing, unchanged legacy coordinator on `"not-ratchet-payload"`). Omitting `directRatchet` leaves both methods byte-for-byte unchanged.
- `src/conversation/ratchet/fedos_direct_ratchet_state_runtime.ts` (Foundation Arc's own file) — `updateCounters()` gained an additive optional `previousChainCounter` field, and a new `commitCounters()` method was added (see §5). No existing method's behavior changed.
- `packages/fedos-core-rust/src/lib.rs` — added ONE getter, `FedosDirectRatchetSession::previous_sending_chain_length()`, mirroring the existing `send_counter()`/`receive_counter()`/`skipped_key_count()` pattern exactly. No cryptographic logic changed.
- `src/runtime/fedos_wasm_loader.ts` / `src/conversation/ratchet/fedos_direct_ratchet_cryptographic_session.ts` — the corresponding additive TS bridge method and wrapper method for the getter above.

## 4. Two real bugs found and fixed during this Arc's own development

1. **Session id length overflow.** The Rust header encoder
   (`packages/fedos-core-rust/src/crypto/direct_ratchet_header.rs`,
   `MAX_BOUNDED_STRING_LEN = 256`) bounds the entire `session_id` string
   embedded in every ratchet message header. A naive encoding using full
   64-hex-char account public keys plus device refs plus a real
   Conversation id routinely exceeded 256 bytes, causing every real
   `encrypt()` call to fail closed with `None`. Fixed by truncating the
   account-ref component to 16 hex characters (64 bits — collision-negligible
   for this domain-separation purpose, never the sole authentication factor)
   and, separately, discovering that the two Device-pair participants must
   compute the session id from a **canonically ordered** tuple (not each
   side's own "local first" perspective) — confirmed against the
   Cryptographic Core Arc's own real vertical slice test, which reuses one
   literal session id string for both `createAsReceiver` and `createAsSender`.
2. **`previous_sending_chain_length`/`send_counter` reset on a real DH step.**
   `direct_ratchet_session.rs`'s own `decrypt()` resets `send_counter` to `0`
   and sets `previous_sending_chain_length` to the pre-step value whenever
   the remote party's ratchet public key changes — a legitimate protocol
   event the Foundation Arc's own `advanceFedosDirectRatchetCounters()`
   (monotonic-non-decrease only) cannot represent, and which no earlier Arc
   ever read back (no public getter existed for `previous_sending_chain_length`
   at all). Restoring a session with stale counters after such a step
   produced a header the other party's `decrypt()` correctly rejected.
   Fixed by exposing the missing getter (§3) and adding
   `FedosDirectRatchetStateRuntime.commitCounters()` — a narrow, additive
   write path that sets counters exactly as read from the live, already-Rust-
   validated session, bypassing the rollback guard that (correctly) protects
   against untrusted input but cannot model a genuine reset.

## 5. Durability design (see the dedicated atomic-state document for the full writeup)

Two small, additive, current-value ports were added because the
Foundation Arc's own `FedosSealedDirectRatchetSecretPersistence` is
deliberately insert-only (one fixed key per `(sessionId, secretKind,
generation)` for every kind except `"skipped-message-key"`) — correct for
skipped keys (genuine one-shot events) but structurally unable to represent
the sending/receiving chain key, which the real Rust core advances on
**every** message. Rather than force-fit an event-sourced port to a
mutable-current-value need, or redesign that already-reviewed port, this
Arc added `FedosDirectRatchetLiveStateSnapshotPersistence` (the four
fixed-kind secrets, last-write-wins) and
`FedosDirectRatchetRemotePublicKeyPersistence` (the counterpart's current
ratchet public key). Skipped keys continue to flow through the Foundation's
own unmodified port.

## 6. Device identity source

`resolveFedosDirectRatchetDevicePair()` reads Device trust exclusively from
`FedosDeviceRegistryPersistence` (Alpha 2921–3000, unmodified) — the SAME
port originally scoped to "my own additional Devices." This Arc reuses it,
additionally, to record a known correspondent's Device too (a caller must
register+trust both the local and remote Device explicitly before a
Device-pair session can resolve). No Device identifier is ever fabricated
from a display name, array index, Relay identity, or process id.

## 7. What Phase K (multi-device proof) actually covers

The real vertical slice and route/device-pair unit tests prove: independent
session ids per Device pair (canonically ordered, still unique per
Conversation/generation), Device revocation denial, and unknown-Device
fail-closed behavior. A full three-session proof (Alice-A↔Bob-A,
Alice-A↔Bob-B, Alice-B↔Bob-A simultaneously) was not separately
constructed as its own test beyond what the session-id derivation itself
already guarantees structurally (each distinct Device-pair tuple
deterministically produces a distinct session id, proven by
`fedosDirectRatchetSessionBindingsEqual`/session-id uniqueness tests
inherited from the Foundation Arc) — see the completion declaration for
this as an explicit, narrow scope boundary.
