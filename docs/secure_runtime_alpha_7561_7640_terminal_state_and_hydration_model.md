# Secure Runtime Alpha 7561-7640 — Terminal State and Hydration Model

FedOS Conversation Outbox Restart Hydration and Scheduler Scalability Arc — Phases B, C, E

## Phase B — Terminal state model

Per Phase A's own decision (reconciliation report, "Decisions this report makes" #2),
this Arc reuses the existing, already-generic `FedosDeliveryObservationState` vocabulary
(`src/board/observation/fedos_delivery_observation.ts`, Alpha 462, unchanged) rather than
inventing a second truth model. That vocabulary has exactly five states: `queued`,
`publishing`, `accepted`, `rejected`, `failed`. Every requested distinction below is
expressed in terms of these five states plus the two Scheduler-level derived sets
(`delivered`, `abandoned`) this Arc's hydration function populates.

| Requested distinction | Mapping in this codebase |
|---|---|
| Pending | No recorded attempt history for this intent's id, OR the latest recorded attempt's state is `publishing`/`rejected`/`failed` with `isFinal: false`. The Scheduler's own `#runTick()` filter (`!delivered.has(id) && !abandoned.has(id)`) is exactly this definition, restated in Set-membership terms. |
| In-flight, if durable | `publishing` — durably recorded at the START of every attempt (`#attemptOnce()`, `observationRepository.record(attemptSubjectId, "publishing", startedAt)`), before the Publisher is ever called. A crash between this write and the terminal write leaves a real, durable `publishing` fact — `historyFor()`'s own `isFinal: false` while `state === "publishing"` rule means hydration correctly leaves such an intent pending (safe: at most one redundant retry), never misclassifies it. |
| Relay acknowledged | `accepted` — durably recorded when the Publisher's `publish()` result has `outcome: "delivered"`. This is a Relay-protocol fact only (any relay's own `OK` message accepted the event) — see "Relay ACK vs. recipient import" below. |
| Delivered/imported, if represented | **Not represented in this vocabulary, and this Arc does not add it.** Recipient-side import is a structurally separate, recipient-local fact (`FedosPrivateNostrImportRecord`, `src/conversation/delivery/nostr/fedos_private_nostr_import_record.ts`) that never reaches the sender's Outbox/Scheduler/Observation history — no read-receipt/ack-back protocol exists anywhere in this transport layer (Phase A report §9). The `delivered` Set this Arc hydrates means "Relay-accepted," identical to what the pre-existing (never-hydrated) in-memory `#delivered` Set already meant — this Arc changes WHEN that Set is populated (restart vs. never), never WHAT it means. |
| Abandoned | `rejected`/`failed` with `isFinal: true` (i.e. the Publisher returned `retryPolicy: "never"`) — durably recorded via `encodeFedosDeliveryRetryReason(isFinal, reason)` in the terminal `record()` call of the SAME attempt. |
| Failed-retryable | `rejected`/`failed` with `isFinal: false` — the Publisher returned `retryPolicy: "immediate"` or `"later"`. Remains pending; retried on a subsequent tick per the Scheduler's own existing (unchanged) retry loop. |
| Failed-terminal | Same as Abandoned — this codebase does not distinguish a third "failed but not abandoned" terminal category; `isFinal` is the one true/false split between retryable and terminal. |
| Expired | **Not modeled in this codebase, at any layer.** No expiry/TTL concept exists on `FedosConversationTransportOutboxIntent`, the Publisher, or the Observation vocabulary. Correctly reported as not applicable rather than invented — adding one would be a persistence-shape/protocol change, prohibited for this Arc. |
| Superseded | **Not modeled.** No intent-supersession concept exists in this codebase's Outbox/Scheduler layer. Not applicable, not invented. |
| Malformed/corrupt | Handled entirely at the persistence layer, unchanged by this Arc (Phase C's own "Corrupt-LOG handling" — see below). A corrupt Outbox log line throws, loudly, out of `listIntents()` and therefore out of hydration; a corrupt Observation record for one subject is caught per-subject by `historyForSafe()` and treated as "no history" (pending), never silently reclassified as delivered/abandoned. |

**Relay ACK vs. recipient import vs. local Outbox completion — never conflated.** Confirmed
structurally, not just by convention: `FedosMultiRelayOkCorrelatedConversationTransportPublisher`
(the only Publisher constructed in production) never reads or references any recipient-side
data structure — its `"delivered"` outcome is purely "a relay's own `OK` message accepted
this event." The Safety Center's own warning `"relay-ack-is-not-recipient-delivery"` is a
real, code-level fact, not just UI copy. Recipient-import (`FedosNip17InboundImportCoordinator`)
lives on a completely separate, recipient-local persistence path never consulted from the
sender's side. This Arc's hydration reads only the Observation history a real Publisher
attempt itself writes — it cannot possibly conflate these three concepts, because only one
of them (Relay ACK) is ever recorded into the vocabulary hydration reads from.

## Phase C — Hydration authority

`hydrateFedosConversationTransportDeliveryRecoveryState()`
(`src/conversation/transport/fedos_conversation_transport_delivery_recovery_hydration.ts`) —
pure function, the sole new production source file this Arc adds. Scans
`outboxPersistence.listIntents()` once; for each intent, reads its attempt history via a
`FedosDeliveryRetryQuery` (Board's own, already-generic, Alpha 528 class, reused unchanged);
classifies the latest attempt exactly per the Phase B table above. Deterministic — the same
durable facts always produce the same result. Insert-only-history aware — reads only, no
compaction, no rewrite. Latest-valid-terminal-fact-wins is enforced by the EXISTING
`FedosValidatingDeliveryObservationRepository`/transition-graph machinery at write time
(Alpha 494/495, unchanged) — a rollback/conflicting write is rejected before it is ever
durable, so hydration (a pure reader) never has to re-adjudicate a rollback itself; it only
ever reads already-valid history.

Fail-closed discipline (mirrors Board's Alpha 585 `historyForSafe()` exactly): a read
failure for one intent's own attempt history is caught and treated as "no history" (pending)
— never propagated to misclassify that intent, never allowed to void recovery for any other
intent. A corrupt OUTBOX log itself (as opposed to a corrupt Observation record) is
deliberately NOT caught here — see "Corrupt-LOG handling" in the file's own header — this
preserves the pre-existing, already-fail-closed persistence-layer behavior (Phase A §13)
rather than softening it.

Resource limits: hydration performs exactly one `listIntents()` call (O(T)) and, per
pending-or-classified intent, a bounded number of `historyFor()` probes (bounded by that
intent's own real attempt count, typically 1-3 in practice). No unbounded recursion, no
plaintext or ciphertext is read or copied (the function only ever touches `intent.id` and
Observation state/timestamp/reason fields — never `envelopeId`'s payload, never
`nativeEvent`). Diagnostics are safe: nothing this function returns or could log contains
message content.

No mutation of the durable log occurs during hydration — confirmed by the file's own "HARD
GUARDRAILS" (read-only against Persistence/Query; the only write anywhere near this Arc's
scope, Board's `hydrateAttemptCount()`, is explicitly NOT ported — see Phase A report §7,
§11).

## Phase E — Terminal transition durability audit

Audited every terminal outcome path in `FedosConversationTransportScheduler#attemptOnce()`
(the ONE place any attempt outcome is ever produced):

| Terminal outcome | Durable evidence written? | Where |
|---|---|---|
| Delivered/imported (Relay-accepted) | Yes, unconditionally | `observationRepository.record(attemptSubjectId, "accepted", now)` |
| Abandoned (Publisher `retryPolicy: "never"`) | Yes, unconditionally | `observationRepository.record(attemptSubjectId, "rejected"|"failed", now, encodeFedosDeliveryRetryReason(true, reason))` |
| Expiry | N/A — not modeled anywhere in this codebase (Phase B) |
| Terminal denial (Relay explicit reject) | Yes | Same `"rejected"` path above, `isFinal` per the Publisher's own `retryPolicy` |
| Revoked Device | N/A for this route — confirmed by grep, no device-trust/revocation reference exists anywhere in `src/conversation/transport/`. Device Trust/revocation is enforced at a different layer (Direct Ratchet route establishment, membership resolution at ENQUEUE time via `resolveFedosConversationTransportRoute()` — a message is never enqueued into this Outbox at all if the route cannot be resolved). Once an intent IS in the Outbox, the static `nostr-nip17-v1`/`fedos-private-v1` routes this Scheduler retries do not re-check Device Trust per attempt — this is pre-existing, unchanged behavior, out of this Arc's scope to alter (a Device-Trust-aware retry gate would be a new cross-subsystem policy, not a hydration/scalability fix). |
| Invalid route | Enforced BEFORE an intent ever reaches the Outbox (`sendMailboxNip17`/`sendMailboxNip17Control` fail closed to `"identity-unavailable"`/`"unauthorized"`/`"unsupported-recipient"` pre-enqueue) — never a Scheduler-level terminal outcome; nothing to hydrate. |
| Unsupported payload | Same as invalid route — a `built.outcome !== "built-signed"` fails closed to `"crypto-unavailable"` before enqueue. |
| Retry exhaustion, if terminal | This codebase has no attempt-count-based exhaustion policy on the Conversation Scheduler (unlike Board's optional `abandonmentPolicy` — Phase A §11, deliberately not ported). Termination is decided entirely by the Publisher's own `retryPolicy` return value on each attempt, which IS durably recorded per the "Abandoned" row above. |

**Conclusion: no gap found.** Every terminal outcome this Scheduler can actually produce
already writes durable evidence, unconditionally, as a structural property of
`#attemptOnce()` — the terminal `observationRepository.record()` call is not conditional on
which outcome occurred; it runs for every attempt, always, before `#attemptOnce()` returns.
This Arc adds no new append-only fact (per the Phase D/E instruction: "If one terminal state
currently exists only in memory, add the narrowest append-only fact required" — none was
found to be memory-only; the memory-only part was exclusively the DERIVED `delivered`/
`abandoned` Sets on the Scheduler itself, which this Arc's hydration function now
reconstructs from the pre-existing durable facts at construction time, not a new fact this
Arc must start writing).
