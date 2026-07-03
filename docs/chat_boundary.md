# Chat Provider Boundary (docs only — describes the Stage 111 type-only skeleton)

**Status: this document describes the `ChatProvider` seam shipped in
`src/chat/types.ts` (additive) and `src/chat/noop_chat.ts` (Stage 111). It
adds NO real DM, NO NIP-04/NIP-44/NIP-17 implementation, NO encrypted-chat
implementation, NO WebSocket/relay connection, and NO `fetch`.**

---

## 1. Two DIFFERENT things now live in `src/chat/`

`src/chat/types.ts` already held (since Stage 16) a LINE/Telegram-style
in-app chat data model — `ChatRoom`, `ChatMessage` (with a real `content`
field), `ChatDecision` — already wired to `src/notification/bridge.ts` and
`src/render/chat.ts` for the existing Reddit-style app's chat rendering.
That model is UNCHANGED by this stage.

Stage 111 adds a SEPARATE set of types to the same file:
`ChatProviderKind`, `ChatMessageDescriptor`, `ChatProviderStatus`,
`ChatSendRequest`/`ChatSendDecision`, `ChatFetchRequest`/`ChatFetchDecision`,
and the `ChatProvider` interface. These name a FUTURE, protocol-neutral
TRANSPORT boundary — not a replacement for the existing model, and not
wired to it. `ChatMessageDescriptor` is a narrower, label-only shape
(`idRef`/`chatRef`/`authorRef`/`createdAt`/`metadata` — no `content`) than
`ChatMessage`, on purpose: it can never leak a message body no matter what
future adapter is plugged in behind it.

---

## 2. What `ChatProvider` is for

A future real transport — Nostr NIP-04 (deprecated, unauthenticated
encryption), NIP-44 (versioned encrypted payloads), NIP-17 (gift-wrapped
private DMs), or any other protocol's DM/chat mechanism — would implement
`ChatProvider` behind this seam. Its three methods are:

- `status()` — a pure, synchronous read of the current `ChatProviderStatus`.
- `sendPlaceholder(request)` — ask to (eventually) send. Evaluates a
  decision only; nothing is sent to any relay/API in this stage.
- `fetchPlaceholder(request)` — ask to (eventually) fetch. `items` is
  ALWAYS empty in this stage.

---

## 3. What is explicitly NOT implemented

- **No NIP-04/NIP-44/NIP-17.** No encryption or decryption of any kind
  happens anywhere in this boundary.
- **No encrypted-chat implementation of any other shape** (Signal-protocol
  style double-ratchet, MLS, or otherwise).
- **No message content is held.** `ChatMessageDescriptor` has no `content`/
  `body`/bytes field — a caller cannot smuggle a real message through it.
- **No WebSocket/relay connection, no `fetch`.** `NoopChatProvider` opens
  nothing.
- **No wiring** into `FederationProvider` (`src/federation/`),
  `StorageBackend` (`src/storage/`), any `CryptoProvider`
  (`src/crypto/`), or the Worker. The Runtime selects `NoopChatProvider`
  only (see `src/runtime/create_runtime.ts`'s `selectChatProvider`) and
  never calls its methods.

---

## 4. Future connection points (not built yet)

If a real chat transport is ever implemented behind this seam, it would
eventually need to connect to (never reimplement) these EXISTING/separate
boundaries:

- **`CryptoProvider`** (`src/crypto/`) for any real encryption/decryption
  — a chat adapter should never contain its own crypto.
- **`FederationProvider`** (`src/federation/`) if the transport is a
  federated protocol (e.g. Nostr) — the chat adapter would ride on top of
  the same connection seam other social content uses, not open a second one.
- **`StorageBackend`** (`src/storage/`) if any message needs to be cached
  locally — subject to its own metadata policy
  (`docs/storage_metadata_policy.md`); message content is not automatically
  cleared for storage just because it passed a chat-provider check.
- **Identity/consent boundaries** for who may DM whom — not designed here.

None of these connections exists today.

---

## 5. Conclusion

- `ChatProvider` is a naming/shape boundary only.
- `NoopChatProvider` is the only implementation, permanently `unavailable`.
- The existing Stage 16 chat rendering model is untouched and unaffected.
