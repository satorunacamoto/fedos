# Direct-Ratchet Retry Safety (mandate §20-21) — Definitive Answer

## What the outbox stores

**Already-encrypted, already-signed native events — never plaintext, never a ratchet
checkpoint.** Confirmed by direct source read, not inferred:

- `FedosDirectRatchetOutboundIntegration`'s send method (`fedos_direct_ratchet_outbound_integration.ts:340`):
  `const wireMessage = await session.encrypt(plaintext);` — the ONE real ratchet chain
  advance for this logical message, called exactly once, synchronously, at the START of the
  send operation.
- Line 356: `this.#deps.stateRuntime.commitCounters(sessionId, ...)` — durably commits the
  advanced chain counters BEFORE any transport call (matches the Direct Ratchet Live-State
  Durability arc's own established "counters land durably strictly before the crypto
  checkpoint" discipline, this session, unchanged).
- Line 408: `sendMailboxNip17(envelopeId, conversationId, encodeFedosDirectRatchetNip17PayloadToPlaintext(messagePayload))`
  — only AFTER encrypt+commit, hands the ratchet ciphertext (as the wire adapter's own
  "plaintext" parameter) to the transport layer.
- Inside `FedosPrivateTransport.sendMailboxNip17Control()`/`sendMailboxNip17()`: the wire
  adapter (`NostrNip17V1WireAdapter.build()`) signs the outer Gift Wrap ONCE, with a
  single-use ephemeral key, and the fully-signed native event is persisted verbatim as a
  `schemaVersion: 2` outbox record.

## Is retrying the exact ciphertext/event protocol-safe?

**Yes, by design, already frozen and documented** (`fedos_private_wire_prepared_delivery.ts`'s
own header, Alpha 1846-1848, "Retry Stability", unchanged by this arc): `FedosConversationTransportSignedEventSource.resolveSignedEvent()`
(`fedos_conversation_transport_signed_event_source.ts:89-92`) returns a `schemaVersion: 2`
record's `nativeEvent` **verbatim** — "no Envelope/Payload/route re-derivation, no re-signing,
ever" (the file's own comment). The Scheduler's `tick()` → `#attemptOnce()` → `publisher.publish(intent)`
→ `resolveSignedEvent()` path NEVER calls back into `session.encrypt()`, `NostrNip17V1WireAdapter.build()`,
or `commitCounters()` — it only re-transmits the same already-built bytes over the network.
This was explicitly adopted specifically because plaintext (and the ratchet ciphertext derived
from it) is never retained past the original send operation ("Plaintext Ownership Decision",
Alpha 1842) — regenerating on retry is structurally impossible, so replay-verbatim is the only
sound option, and it is safe: the chain only ever advances once per logical message, at
original send time, never at retry time.

## Can the chain advance twice for one logical message?

**Not through any code path that exists in this codebase today** — confirmed by a source-wide
search: zero references to `resend`/`retrySend`/`manualRetry`/similar anywhere in the
renderer, IPC, or Shell layers. The ONLY thing that can trigger `session.encrypt()` is the
coordinator's own top-level "send a message" operation, called once per user action. The
Scheduler's automatic network-level retry (the only retry mechanism that exists) never
touches ratchet state.

**Real constraint for future work, stated explicitly rather than left implicit** (this is
exactly what the coordinator asked to have resolved before combining with any future
retry-UI): a future manual-retry/resend feature MUST re-publish the EXISTING outbox record
(e.g., by calling `transport.tick()`, or a new dedicated "re-attempt this specific outbox
intent" method) — it must NEVER re-invoke the coordinator's top-level send operation for an
envelope that has already been through `session.encrypt()` once. Doing so would call
`session.encrypt()` a second time for what the user perceives as "the same message," advancing
the chain twice, producing a second, DIFFERENT ciphertext under a NEW chain position. The
existing deterministic-outbox-id safety net (`putIntent()` returns `"conflict"` for a same-id,
different-content write) would catch and reject the resulting second `schemaVersion: 2` record
before it's ever published — so this would fail closed rather than silently double-send or
desync the peer's own chain state — but it would still be a wasted, wrong chain advance on the
LOCAL side (the counter/chain state itself has already moved forward even though the record
write is rejected), corrupting the local session's own chain position relative to what the
peer has actually seen. **This is the one specific hazard any future retry-UI design must
avoid by construction** (re-publish, never re-encrypt), not by a runtime guard alone.

## Verdict

- Does the outbox store plaintext, ciphertext, or a checkpoint? **Ciphertext (already-signed
  native event).**
- Is retrying the exact stored event protocol-safe? **Yes — proven safe by construction,
  already the deliberate, documented design (Alpha 1848).**
- Can the chain advance twice for one logical message via any EXISTING code path? **No —
  confirmed no retry/resend mechanism exists anywhere in this codebase today.**
- Is this arc's own `deliveryStatusForEnvelope()` fix (a pure read, triggers nothing) safe to
  combine with any future retry-UI work? **Yes, unconditionally — it doesn't touch send/retry
  logic at all.** The constraint above is for whoever builds that future retry UI, not for
  this fix.
