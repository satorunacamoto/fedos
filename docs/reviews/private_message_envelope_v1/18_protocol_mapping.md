# 18 — Protocol Mapping

No web search performed, per this review's own instruction and matching
SEC §18's own discipline. This document reuses SEC §18's matrix
findings unmodified (this review re-derives nothing about Nostr/
ActivityPub/AT Protocol/Session's own real-world protocol behavior) and
adds exactly one new finding: `03_envelope_boundary.md`'s discovery of
`src/chat/*` creates a mapping ambiguity SEC §18 could not have
anticipated, since SEC never inspected `src/chat/`.

## SEC §18's matrix — reused, not re-derived

| Protocol | Status (SEC §18, reconfirmed unchanged this pass) |
|---|---|
| **Nostr** | Real, vector-verified NIP-44-compatible conversation-key/wire pipeline exists (`pub(crate)`-only, `12_wasm_export_gap.md`). `capability_matrix.ts`'s own `canProtocolAdapterSupport()` already hard-codes `private_message_placeholder` → `rejected` for `nostr_placeholder` (disconnected planning table, not runtime-enforced). NIP-17 gift-wrap envelope semantics: **requires official protocol research.** |
| **ActivityPub** | Inbound adapter only, no outbound Publisher anywhere in `src/board/publish/` (confirmed still only a `nostr/` subdirectory exists, re-checked this pass). Addressed-only delivery's actual confidentiality guarantee: **requires official protocol research.** |
| **AT Protocol** | Inbound adapter only, no outbound Publisher. Private-messaging story: **requires official protocol research entirely** — this repository's own source is silent. |
| **Session** | No DM-vs-group distinction modeled anywhere in `src/board/session/`, not even as a comment (SEC §18's own strongest finding, reconfirmed). Private-delivery protocol: **requires official protocol research entirely.** |

Six items SEC §18 already named as requiring official protocol research
remain unresolved and unresearched by this review, per this review's own
instruction not to guess: NIP-17 gift-wrap semantics beyond the
already-implemented NIP-44 conversation-key layer; Nostr group-DM
conventions; ActivityPub addressed-only delivery's confidentiality
guarantee; ActivityPub Group actor membership semantics; AT Protocol's
entire private-messaging story; Session's entire private-delivery
protocol.

## New finding: two candidate landing points for a future Nostr mapping

`03_envelope_boundary.md` establishes that `FedosConversationMessageEnvelopeV1`
(Surface A, Board/Conversation lineage) is the correct home for the V1
Envelope — but `src/chat/*`'s `ChatKind = "dm" | "group"` (Surface B)
already exists, is real, already Nostr-event-sourced, and already has
its own — currently unwired — `ChatProvider` transport placeholder
(Stage 111). This creates a genuine, not-yet-resolved mapping question a
future protocol Arc will encounter that neither SEC nor CFv1 anticipated:

**When a real Nostr DM/gift-wrap mapping is eventually built, does it
map onto Surface A's Envelope (producing/consuming
`FedosConversationMessageEnvelopeV1` records) or onto Surface B's
`ChatProvider` (producing/consuming `ChatMessageDescriptor`
records)?** Both are structurally plausible destinations for an inbound
decrypted Nostr DM — Surface A because it is where all of SEC/CFv1's
own membership/key/eligibility machinery lives; Surface B because it is
already the real, wired surface real-time chat UI reads from today, and
`ChatProvider`'s own `ChatMessageDescriptor` already carries no content
field (matching the "opaque routing metadata only" discipline this
review's own Envelope requires).

**This review does not resolve this question** — it is a genuine
architectural fork a future Arc must decide explicitly, not an oversight
this document can close from source alone. It is named here, rather
than left implicit, so a future Nostr protocol-mapping Arc does not
discover the fork mid-implementation and improvise an answer under time
pressure.

## No lossless mapping assumed anywhere

Per this review's own instruction: no protocol above is assumed to map
losslessly to `04_envelope_v1.md`'s Envelope shape. In particular,
`14_associated_data.md`'s own recommended AAD binding
(`conversationId`/`keyEpoch`/`senderRef`) has **no confirmed equivalent**
in any of the four protocols' own wire formats — SEC §18's own finding
that Nostr has no native conversation-level identifier at all (addressing
is per-event, by recipient pubkey) means a future Nostr mapping would
need to either invent a convention for carrying `conversationId`/`keyEpoch`
alongside a NIP-44/NIP-17 event, or accept that this metadata is
FedOS-internal only and does not survive a round trip through Nostr —
this review does not choose, and flags the ambiguity rather than
asserting either resolution.

## See also

- `docs/reviews/private_conversation_security/18_protocol_mapping.md`
- `03_envelope_boundary.md`, `04_envelope_v1.md`
