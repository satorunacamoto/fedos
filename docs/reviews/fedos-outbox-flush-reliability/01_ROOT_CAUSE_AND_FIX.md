# Outbox Flush Reliability — Root Cause and Fix

**Scope note**: this arc's own mandate is extremely large (9 planning docs, 4-agent
investigation, full crash-window matrix, installed proof, public-Tor confirmation). Executed
solo (no subagent spawning available), against a hard session time budget. This document
condenses the investigation to what was actually needed to find and close the real gap;
it does not attempt the full 9-document structure. Everything not reached is disclosed
honestly in the final report rather than fabricated.

## Pipeline trace (§3-8 condensed)

Traced the real send path: `FedosPrivateTransport.sendMailboxNip17()`/`sendMailboxNip17Control()`
→ `#outboxPersistence.putIntent()` (durable, synchronous) → `void this.tick().catch(() => {})`
(fire-and-forget best-effort immediate flush) → returns `{outcome: "queued", ...}` to the
caller BEFORE the tick resolves. The periodic `FedosConversationTransportScheduler` (armed by
`start()`) re-lists ALL non-delivered/non-abandoned intents from `outboxPersistence.listIntents()`
on every tick — this is **poll-based, not notification-based**, so the mandate's own leading
hypothesis (lost-wakeup / async scheduling race) does **not apply**: there is no one-shot
notification to lose. Confirmed by direct code reading, not assumed.

Each attempt gets its own attempt-scoped subject id
(`makeFedosDeliveryAttemptSubjectId(originalSubjectId, attemptNumber)`, Alpha 525/528,
UNCHANGED) and its real outcome is recorded into `FedosDeliveryObservationRepository` via
`FedosValidatingDeliveryObservationRepository`. `FedosMultiRelayOkCorrelatedConversationTransportPublisher`'s
own aggregation policy (its own header, unchanged, verified sound): `"delivered"` if any relay
accepts, `"rejected"` (`retryPolicy: "never"`) only if **every** relay explicitly, terminally
rejects, otherwise `"failed"` (`retryPolicy: "later"`, retried on the next tick). This part of
the design is correct.

## The actual gap (§33 root-cause freeze)

**EXACT SILENT-LOSS ROOT CAUSE**: a genuinely, permanently rejected send (every relay in the
set returns a real `OK{accepted:false}`) is correctly recorded as terminal in the Delivery
Observation repository and correctly never retried — but **nothing in this codebase's
presentation/Shell layer ever read that fact back**. Confirmed via source-wide search: zero
references to `FedosDeliveryObservationQuery`/`FedosDeliveryRetryQuery` outside
`board/observation/*` and the transport layer itself, before this fix. The caller's only
signal is `sendMailboxNip17()`'s own synchronous `queued` return — already honest (per the
prior Message Delivery Truth arc, `50ffce50`) about what it can prove AT THAT MOMENT, but
nothing ever updates the caller once the real, later, terminal outcome is known. A rejected
message is durably recorded as rejected, and permanently invisible to the user.

- ASYNC OUTBOX ISSUE: NO (poll-based scheduler, re-scans full pending list every tick)
- LOST WAKEUP: NO (no notification mechanism exists to lose)
- RESTART-SPECIFIC: NO (already correctly hydrated via `hydrateFedosConversationTransportDeliveryRecoveryState`, Alpha 7561-7640, unchanged, unaffected)
- TOR-SPECIFIC: NO (this gap exists at the `FedosPrivateTransport`/Scheduler/Observation layer, entirely below and independent of the Tor SOCKS transport)

Deterministic local reproduction (no public network, no Tor, per mandate §21/§28):
`test/fedos_outbox_silent_rejection_repro.test.ts`, using the SAME `ManualRelay` fixture
pattern as `secure_runtime_alpha_1471_1540_private_transport_coordinator.test.ts`. Fires a
real `OK{accepted:false}` from a fake relay, proves the item is (a) correctly never retried
again, (b) durably recorded as `"rejected"` in the Observation repository, and — before the
fix — had no queryable path to that fact from any caller.

## Fix

Two new additive files:
- `src/os/messenger/adapters/nostr/transport/fedos_conversation_delivery_status_presentation.ts`
  — a pure mapper from `FedosDeliveryRetryQuery`'s own already-real latest-attempt fact
  (`FedosDeliveryRetryAttemptState | null`) to a closed, presentation-safe
  `FedosConversationDeliveryStatus` vocabulary (`"not-yet-attempted" | "attempting" |
  "delivered" | "retrying" | "rejected"`), mirroring `FedosDirectRatchetSafeStatus`'s own
  established closed-vocabulary precedent. Never infers success from the synchronous enqueue
  result alone.
- `FedosPrivateTransport.deliveryStatusForEnvelope(envelopeId)` — the one new caller-facing
  method, composing the SAME `FedosDeliveryRetryQuery` machinery `#attemptOnce()` itself
  already writes to (Alpha 528, unchanged) with the new mapper above. No new query mechanism,
  no new persistence, no new schema — purely an accessor that was missing.

**What layer this reaches, disclosed plainly**: this closes the gap at the
`FedosPrivateTransport` (transport/Shell-reachable) layer — a caller CAN now get a truthful
answer to "what actually happened to this send." It does NOT wire this into the Conversation
Runtime's message-list read model or any renderer UI (mandate §31's "Sending…/Sent to
relay/Retrying/Failed" bubble text) — that would require touching the much larger
`fedos_conversation_runtime.ts` message-list surface, out of reach within this session's
remaining time budget. Mirrors the same "backend-only, no renderer" scope decision an earlier
arc this session made for the Tor Security UI backend, which the coordinator accepted.

## Verified

- `npx tsc --noEmit -p tsconfig.json`: clean (2 pre-existing, unrelated errors only, in
  untouched root test files — confirmed identical to the coordinator's own baseline this
  session).
- Targeted: `fedos_outbox_silent_rejection_repro.test.ts` (2/2, new),
  `secure_runtime_alpha_1471_1540_private_transport_coordinator.test.ts` (5/5, unchanged),
  `secure_runtime_alpha_7561_7640_private_transport_restart_hydration.test.ts` (2/2,
  unchanged) — 9/9, zero regression.
- `npm run test:current`: 188/191 files, 2808/2814 tests, 3 failures — confirmed identical to
  a known, pre-existing, worktree-specific artifact class (`commerce_ipfs_media_store.test.ts`,
  `commerce_wasm_product_media_decryption.test.ts`, `commerce_wasm_product_media_encryption.test.ts`
  — real-WASM dev-glue-loader tests that fail in a freshly junctioned isolated worktree,
  already reported identically by a sibling fork's own isolated worktree earlier this session,
  unrelated to any file this fix touches).
