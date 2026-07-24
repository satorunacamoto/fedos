# Secure Runtime Alpha 7481–7560 — Phase B: Normative Metadata Policy

**FedOS Archive Envelope Retention Parity and Metadata Deletion Semantics Arc.**

## The seven scenarios, distinguished

1. **Live deletion** — a Payload is tombstoned/removed on a running
   device via `FedosPayloadRetentionAuthority`. Unaffected by this Arc:
   the live pipeline already only ever touches Payload + Search
   (confirmed, reconciliation report §7).
2. **Archive export AFTER deletion** — `collectFedosConversationArchiveBundle()`
   runs while a Payload is already tombstoned/removed. This Arc's own
   headline fix applies here.
3. **Archive export BEFORE a later deletion** — the export predates the
   deletion event entirely; the bundle genuinely, correctly contains
   live content at the moment it was taken. Explicitly accepted,
   unchanged (see Phase F) — a point-in-time snapshot cannot retroactively
   know about a future event.
4. **Restore into the SAME profile** the deletion happened on — the
   restoring device's own `retentionAuthority` already has a real
   decision on file for the Payload in question.
5. **Restore into a NEW/foreign profile** — the restoring device has
   never seen this Payload id before; its own `retentionAuthority`
   returns `{outcome:"not-found"}`, not `{outcome:"denied"}` — a
   genuinely different, weaker signal (see Phase F).
6. **Retention-denied content encountered mid-flow** — `evaluatePayloadAccess()`
   returns `{outcome:"denied", state:...}` at export or restore time.
7. **Missing or corrupt Retention facts** — `retentionAuthority` is
   `undefined` (omitted by the caller), or a call to it throws. Both
   fail closed identically to "not permitted," never treated as "no
   gate configured, allow everything" — mirrors `isPayloadPermitted()`'s
   own existing `try { ... } catch { return false; }` discipline exactly.

## Closed policy, per category

| Category | Live deletion | Export after deletion | Export before deletion | Restore, same profile | Restore, foreign profile | Retention-denied | Missing/corrupt facts |
|---|---|---|---|---|---|---|---|
| Message existence (Envelope record) | Retained (no live delete path exists) | **Omitted** from the bundle (this Arc's own fix) | Retained (correct, point-in-time) | **Omitted** — the restoring device's own current denial is re-checked and suppresses it (this Arc's own fix) | Retained — the foreign device has no basis to deny it (Phase F, disclosed limitation) | Omitted / denied | **Denied** (fail closed — see below) |
| Timestamp (`createdAt`) | Retained | Omitted (bundled with the whole Envelope) | Retained | Omitted (bundled) | Retained (bundled) | Omitted / denied | Denied |
| Sender identity (`senderMembershipId`) | Retained | Omitted (bundled) | Retained | Omitted (bundled) | Retained (bundled) | Omitted / denied | Denied |
| Recipient identity (derived from Membership) | Retained (Membership is never touched by deletion) | Retained — Membership collection is intentionally NOT coupled to Payload retention (a Membership is a Conversation-level, not message-level, fact; excluding it would break the Conversation itself for every OTHER, non-deleted message) | Retained | Retained | Retained | Retained (see note below) | Retained |
| Conversation association (`conversationId`) | Retained | Omitted (bundled with the Envelope) | Retained | Omitted (bundled) | Retained (bundled) | Omitted / denied | Denied |
| Envelope ID | Retained | Omitted | Retained | Omitted | Retained | Omitted / denied | Denied |
| Relay event ID | N/A — never stored in the Archive/Envelope domain at all | N/A | N/A | N/A | N/A | N/A | N/A |
| Ciphertext | Access-denied via `readPayload()` (unchanged, Alpha 811) | **Omitted** from the bundle (unchanged, Alpha 7241-7320) | Retained | Omitted (unchanged) | Retained if bundle carries it AND foreign device has no denial on file | Omitted / denied | Denied |
| Payload reference (`payloadId` as a Payload-side fact) | N/A (Payload access-state only) | Omitted (bundled with its own Payload/Envelope) | Retained | Omitted | Retained | Omitted / denied | Denied |
| Attachment metadata | N/A — no attachment concept exists | N/A | N/A | N/A | N/A | N/A | N/A |
| Control-payload discriminator (deletion request/execution/decision records) | Retained permanently, by design (unmodified) | Never included in the bundle at all (unmodified — the bundle schema has no such record type) | N/A | N/A | N/A | N/A | N/A |
| Ratchet/session metadata | N/A — not part of the Conversation Archive bundle at all | N/A | N/A | N/A | N/A | N/A | N/A |
| Search tokens | Purged (unmodified, Alpha 2581-2600) | Never auto-reintroduced by restore (unmodified — `indexArchiveBundle()` is called from nowhere) | Same | Same | Same | N/A | N/A |

**Note on Recipient identity**: Membership collection/restoration remains
UNLINKED from Payload retention, deliberately. A Conversation's
Membership records describe who is IN the conversation, not facts about
any one message — excluding them when ONE message's Payload is denied
would incorrectly strip Membership for every OTHER message that
Conversation still legitimately retains, a far more invasive and
unjustified change than this Arc's own narrow mission permits ("Do not
redesign the Archive format broadly"). Recipient identity for a SPECIFIC
denied message is still effectively suppressed, because the ENVELOPE
naming that specific message (and thus which specific
send/receive pair it belonged to) is itself omitted — the general
Membership list surviving is a Conversation-level fact, not a
per-message metadata leak.

## Missing/corrupt Retention facts — always fail closed

If `retentionAuthority` throws, or is not supplied where the mission
requires it (restore-time re-evaluation), this Arc's policy is: **treat
as denied, never as "unavailable, so allow."** This mirrors
`isPayloadPermitted()`'s own pre-existing `try/catch` discipline exactly
— extended, not reinvented, for Envelope gating and for the new
restore-time check. A caller who omits `retentionAuthority` entirely
(as every pre-Arc caller of `collectFedosConversationArchiveBundle()`/
`restoreFedosConversationArchiveBundle()` does) gets byte-for-byte
UNCHANGED behavior — the gate is optional and additive, exactly like the
existing Payload gate; "fail closed" applies only once a caller HAS
opted in by supplying the authority.

## Summary sentence

Envelope and Payload are now evaluated TOGETHER, under the SAME single
retention decision, at BOTH export and restore time — no category
beyond ciphertext gains a NEW, separate gate; instead, every category
that is physically part of the same Envelope record inherits the
Envelope's own now-linked fate. Nothing this Arc does not name is
retained, omitted, or denied differently from before.
