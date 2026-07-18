# Review 03 — Internal Envelope vs Wire Envelope

## The four options, evaluated against what `01` confirmed actually exists

**A. Internal Envelope is the wire payload.** Rejected outright.
`FedosConversationMessageEnvelope` (`src/conversation/envelope/fedos_conversation_message_envelope.ts:76-88`)
carries `id`, `conversationId`, `senderMembershipId`, `payloadId`,
`encryptionSuite`, `keyEpoch`, `createdAt`, `replyToEnvelopeId` as a
**metadata record referencing an opaque ciphertext Payload by id** — it
is not itself a serializable wire message, and none of its fields are
shaped for any protocol's own wire format (a Nostr event, an
ActivityPub Activity, an AT Protocol record, a Session message all have
their own required shape this Envelope does not produce).

**B. Protocol adapter creates a protocol-native encrypted
representation.** This is the option this review prefers **wherever a
protocol-native semantics genuinely exists** — see per-protocol
verdicts below. It mirrors the existing, working pattern
`fedos_board_post_to_nostr_unsigned_event.ts` already establishes for
PUBLIC posts: a pure, one-way mapping function
(`boardPostToNostrUnsignedEventRequest`) from the internal domain type to
a protocol-native request shape, never the domain type serialized
directly onto the wire.

**C. Internal Envelope metadata embedded as generic JSON.** Available as
a fallback only where no protocol-native encrypted-message semantics
exists yet (today: ActivityPub, AT Protocol, Session — `06`/`07`/`08`).
This review does **not** recommend shipping this option for any
protocol today, because "embed as generic JSON" would require a
concrete wire-security decision (is the JSON blob itself the AEAD
ciphertext, wrapped how) this review's own ground rules (no crypto
implementation) do not authorize deciding.

**D. Protocol delivery unsupported.** The honest current state for
ActivityPub, AT Protocol, and Session (`06`/`07`/`08`) — named
explicitly rather than silently defaulted to.

## Per-protocol verdict, summarized (full reasoning in `04`/`06`/`07`/`08`)

| Protocol | Verdict | Why |
|---|---|---|
| Nostr | **B, once NIP-17/NIP-59 or an equivalent is chosen** (research-gated, `04`) | A real, protocol-native encrypted-DM envelope shape (NIP-17 gift wrap) is the standard mechanism; this repository has zero gift-wrap code today, so B is a target, not a shipped mapping. |
| ActivityPub | **D today** | No outbound Publisher of any kind exists (`06`); B requires official research this review does not perform. |
| AT Protocol | **D today** | Same reasoning, `07`. |
| Session | **D today** | Same reasoning, `08`; Session's own adapter explicitly places encryption upstream of this repository's boundary. |

## "Do not assume lossless mapping" — where this specifically bites

The internal Envelope's `replyToEnvelopeId` field has no guaranteed
protocol-native equivalent: Nostr's own NIP-10 `e`-tag reply convention
is a **public**, unencrypted tag today (confirmed:
`fedos_board_nostr_adapter.ts`'s `resolveNostrThreadRefs`, lines 96-109,
operates on plaintext tags) — a private NIP-17-wrapped reply reference
would need to travel **inside** the encrypted rumor, not as a plaintext
tag, or it leaks thread structure (`05`). Similarly, `keyEpoch` and
`senderMembershipId` are FedOS-internal concepts with no Nostr, ActivityPub,
AT Protocol, or Session equivalent at all — any Option B mapping must
either drop them (breaking round-trip fidelity) or invent a
FedOS-specific extension field the counterpart protocol has no
obligation to preserve. This review does not resolve which; it names
the tradeoff so no future Arc silently assumes round-trip fidelity a
protocol was never asked to provide.

## See also

- `01_source_inventory.md`
- `04_nostr_readiness.md`, `06_activitypub_delivery.md`,
  `07_atproto_delivery.md`, `08_session_delivery.md`
- `docs/reviews/private_message_envelope_v1/04_envelope_v1.md` (the
  Envelope's own original field-shape rationale, unchanged here)
