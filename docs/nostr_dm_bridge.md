# Nostr DM bridge planning (Stage 244) — docs only, no code

**Status: this document adds no code.** It fixes, in writing, the
publish/receive flow a future stage would use to connect the NIP-44 v2
wire opaque API (`docs/public_nip44_wire_api.md`, Stage 241–242) to a
real Nostr encrypted direct-message flow — BEFORE any such connection
exists. No relay code, no NIP-17 gift-wrap code, and no
`FederationProvider`/`ChatProvider` implementation is added by this
document or by Stage 244.

## 1. What already exists (unconnected)

- `src/federation/types.ts` (Stage 110) already defines a
  `FederationProvider` seam with a `"nostr_placeholder"` provider kind
  and a `NostrEventCandidate` mapping shape (Stage 113) — but every
  method is a no-op today (`docs/federation_boundary.md`'s own
  guardrails: "NO real relay/WebSocket/HTTP/OAuth/AT-Protocol connection
  is opened by anything in this boundary").
- `src/runtime/types.ts`'s `AppRuntime.chatProvider` (Stage 111's
  `ChatProvider` seam) is ALWAYS a `NoopChatProvider` unless an override
  is supplied — "the runtime never calls its
  `sendPlaceholder`/`fetchPlaceholder`" (that file's own doc comment).
- `packages/fedos-core-rust`'s NIP-44 v2 wire encrypt/decrypt pipeline
  (`docs/nip44_wire_crypto_completion.md`, Stage 229–240) is complete
  and vector-verified, but `pub(crate)`-only — see
  `docs/public_nip44_wire_api.md` for the still-unbuilt public boundary
  in front of it.

**Nothing above changes.** This document plans a FUTURE stage that would
eventually connect these three existing, currently-inert seams.

## 2. The publish flow (planned, not implemented)

```
DM publish
   │  caller supplies plaintext + recipient's opaque conversation handle
   ▼
encrypt (future public opaque API, docs/public_nip44_wire_api.md §3 — not built yet)
   │  internally: derive message keys → pad → ChaCha20 → HMAC-SHA256 (Stage 219-236, UNCHANGED)
   ▼
wire payload (base64 string — crypto::nip44_wire_encoding, Stage 234, UNCHANGED)
   │  wrapped as a NIP-04/NIP-44-kind event's `content` field (NOT decided which kind here)
   ▼
relay publish (src/federation/ FederationProvider.publishPlaceholder — STILL a no-op)
```

## 3. The receive flow (planned, not implemented)

```
DM receive
   │  a Nostr event's `content` field is treated as a candidate wire payload
   ▼
wire decode (crypto::nip44_wire_encoding::decode_wire_payload_internal, Stage 234, UNCHANGED)
   │  InvalidPayload → reject, never attempt decrypt
   ▼
decrypt (future public opaque API — not built yet)
   │  AuthenticationFailed → reject, never surface partial plaintext
   ▼
message (handed to whatever local chat/message model consumes it — e.g. Stage 16's ChatRoom/ChatMessage, not decided here)
```

## 4. What is explicitly NOT connected by this document

- **NIP-17** (gift-wrapped DMs, the modern replacement for NIP-04) is
  **not implemented, not evaluated for which primitives it needs beyond
  NIP-44, and not connected.** `docs/nip44_wire_implementation_roadmap.md`
  names a NIP-17 planning stage (Stage 251 candidate) as its own,
  separate, later step — this document does not pre-empt that
  evaluation.
- **Relay** — no WebSocket, no subscription, no publish call. Every
  relay-facing method in `src/federation/`/`src/nostr/` this flow would
  eventually use remains exactly as inert as `docs/federation_boundary.md`
  already documents.
- **Network** — no `fetch`, no HTTP request, of any kind.
- **`FederationProvider`/`ChatProvider` implementation** — no new
  adapter class, no change to `NoopFederationProvider`/`NoopChatProvider`.
- **Which Nostr event kind** a NIP-44-wrapped DM would use (NIP-04's
  kind 4, a NIP-44-only variant, or a NIP-17 gift-wrap kind) is **not
  decided** — an open question for the future connection stage.
- **No `packages/fedos-core-rust` public API added** — see
  `docs/public_nip44_wire_api.md`; that remains planning + skeleton
  only.
- **No new dependency of any kind** (npm or Cargo).

## See also

- `docs/public_nip44_wire_api.md` (Stage 241–242) — the opaque API
  boundary both the publish and receive flows above would call, once it
  exists.
- `docs/runtime_crypto_bridge.md` (Stage 243) — the separate,
  also planning-only, Runtime↔crypto-core connection this flow's
  encrypt/decrypt calls would go through.
- `docs/federation_boundary.md` / `src/federation/types.ts` (Stage
  110) — the existing, UNCHANGED `FederationProvider` seam a future
  Nostr adapter would eventually implement.
- `docs/nostr_adapter_planning.md` (Stage 113) — the existing event
  MAPPING candidate shapes (`NostrEventCandidate`) this flow's "wrap as
  an event" step would eventually use, unrelated to and unmodified by
  this document.
- `docs/nip44_wire_implementation_roadmap.md` — where a NIP-17
  evaluation stage is named as a future, separate candidate.
