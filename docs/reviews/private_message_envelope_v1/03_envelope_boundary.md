# 03 — Envelope Boundary

## Two independent "private message" surfaces exist in this codebase today

Neither prior review names both. This review must resolve which one the
Private Message Envelope attaches to before `04_envelope_v1.md` can
propose a concrete shape.

### Surface A — the Board/Conversation lineage (SEC + CFv1's own design target)

`FedosBoardPost` (`src/board/fedos_board_post.ts`), `FedosThreadId`
(`src/board/fedos_board_identifiers.ts`), and CFv1's own
`FedosConversationRecordV1`/`FedosConversationId` (not yet implemented
anywhere in `src/`). CFv1 §11 (`11_private_message_envelope.md`)
sketches `FedosConversationMessageEnvelopeV1` rooted in this lineage —
`conversationId` derived deterministically from `(boardId, threadId)`
(CFv1 §03), reusing `FedosBoardSourceReference` for protocol provenance.
This lineage is **entirely unimplemented for anything beyond public
mode** — confirmed again this pass, no `Conversation`/`Envelope` type
exists anywhere under `src/board/`.

### Surface B — the Chat lineage (`src/chat/*`, real, wired, plaintext)

`ChatKind = "dm" | "group"` (`src/chat/types.ts`) is a **real,
already-wired** model, in production use for read-only rendering:
`InMemoryChatDirectory`, `canReadChat`/`canPostChat`
(`src/chat/policy.ts`), `chatFromGroupSpace` (`src/chat/space_bridge.ts`),
sample data feeding an actual `?chat=<id>` room view (per
`sample_chats.ts`'s own header). Its `ChatMessage` shape:

```ts
// src/chat/types.ts — real, current source
export interface ChatMessage {
  readonly id: string;
  readonly chatId: string;
  readonly authorPubkey: string;
  readonly createdAt: number;
  readonly content: string;          // plaintext, as supplied
  readonly event: NostrEvent;        // REQUIRED — the originating signed event
}
```

Two structural facts distinguish this from Surface A, both confirmed by
direct reading:

1. **`content` is a required plain `string`, with a scope note in the
   file's own header**: *"Encrypted DMs (NIP-04 / NIP-44) are
   explicitly OUT OF SCOPE for this stage — `ChatMessage.content` is
   whatever plaintext the caller already holds; this layer neither
   encrypts nor decrypts."*
2. **`event: NostrEvent` is a required field, not optional** — a
   `ChatMessage` is, by its own type, always a *projection of an
   already-existing, already-signed Nostr event*. There is no
   constructor path in `src/chat/` for a message that has been composed
   locally but not yet turned into a signed protocol event.

A **separate, narrower, unwired placeholder** also lives in this file:
`ChatProvider` (Stage 111) — `ChatMessageDescriptor` carries only opaque
labels (`idRef`/`chatRef`/`authorRef`/`metadata`), explicitly **no**
`content`/`body` field, and `sendPlaceholder`/`fetchPlaceholder` send
and fetch nothing. The file's own header states this is *"A SEPARATE,
protocol-neutral seam from the `ChatRoom`/`ChatMessage` model above...
the FUTURE seam a real DM/chat TRANSPORT... would eventually
implement,"* and confirms it is not wired to `FederationProvider`,
`StorageBackend`, any `CryptoProvider`, or the Runtime beyond selecting
`NoopChatProvider`.

## Which lineage does the V1 Envelope belong to?

**Surface A (Board/Conversation lineage).** Three reasons, each
sufficient alone, mirroring the reasoning SEC §02 already used to reject
"protocol-native wire event as canonical form" (Option E there):

1. **`ChatMessage.event: NostrEvent` being required makes Surface B
   canonically protocol-dependent by construction** — a locally-composed
   Direct message that has not yet been signed/published as a Nostr
   event has no legal `ChatMessage` value at all today. This is exactly
   the failure mode SEC §02 named for treating a protocol wire event as
   the canonical private form: it "would force ... post exists durably
   before any outbound target is chosen" discipline to invert itself.
   `FedosBoardOutboxIntent`'s own precedent (post exists durably before
   any outbound target is chosen, SEC §02/§10) has no analog in Surface
   B's data model.
2. **Surface B's own header explicitly disclaims encryption as in
   scope** for its Stage — building the V1 Envelope on top of it would
   mean retrofitting confidentiality onto a type whose own author
   already decided, in writing, not to carry it, rather than building
   the Envelope where SEC/CFv1's entire membership/key/eligibility
   machinery (§03–§13 of both reviews) already expects it.
3. **Surface B has no membership, key-epoch, or capability-invitation
   concept of any kind** — `ChatRoom.participants`/`.admins` are bare
   pubkey arrays with no revocation, epoch, or role machinery (contrast
   SEC §04/§06's `FedosConversationMembership`). Attaching the Envelope
   here would mean redesigning Surface B to grow all of Surface A's own
   machinery, which is strictly more work than building on Surface A
   directly, and would leave `ChatRoom`'s own real, already-wired public
   read path with unrelated new complexity it does not need (Surface B
   also carries `"public"` visibility, which the Envelope must never
   apply to).

**Conclusion: `FedosConversationMessageEnvelopeV1` (CFv1 §11's own
sketch, refined in `04_envelope_v1.md`) belongs to Surface A, rooted in
`FedosConversationId`, exactly as CFv1 designed it.** This review adds
no new lineage and does not redesign CFv1 §11's placement decision — it
confirms it against a fact (`src/chat/*`'s existence) CFv1 did not have
in view, and the confirmation holds.

## What Surface B remains relevant for

`ChatProvider` (Stage 111) — not `ChatRoom`/`ChatMessage` — is the more
natural **eventual transport-boundary counterpart** once a real Surface
A envelope and Encryption Authority exist: its own
`ChatMessageDescriptor` already carries no content, matching the
"routing metadata plaintext, ciphertext opaque" split CFv1 §11 and this
review's own `04_envelope_v1.md` both require. This review does **not**
wire Surface A's envelope into `ChatProvider` — that is a future Arc's
own transport-layer decision, named here only so it is not lost. Surface
B's `ChatRoom`/`ChatMessage` (the real, wired, plaintext read model)
remains completely out of this review's scope and is not modified,
extended, or deprecated by anything here.

## See also

- `docs/reviews/conversation_foundation_v1/11_private_message_envelope.md`
- `docs/reviews/private_conversation_security/02_private_canonical_model.md`
- `04_envelope_v1.md`
