# Secure Runtime Alpha 5561–5640 — Ratchet / NIP-17 Payload Mapping

## Framing (unchanged)

NIP-17/NIP-59's own normative outer framing is untouched by this Arc:

```
Rumor (kind:14, unsigned)  ->  Seal (NIP-44, real signing key)  ->  Gift Wrap (kind:1059, ephemeral key)
```

`fedos_nip17_rumor.ts` / `fedos_nip59_seal.ts` / `fedos_nip59_gift_wrap.ts` /
`fedos_nostr_nip17_v1_wire_adapter.ts` are byte-for-byte unmodified. No new
NIP, no new public event kind. A standards-compliant NIP-17 client can
correctly unwrap the outer Gift Wrap/Seal to reach the Rumor's own plain-text
`.content` field — it simply cannot make cryptographic sense of that
content as a ratchet message. Describe this precisely as: **a FedOS ratchet
payload carried through NIP-17/NIP-59 framing** — never "generic NIP-17
client interoperability."

## Inner payload (this Arc's own addition)

`src/conversation/delivery/nostr/nip17/fedos_direct_ratchet_nip17_payload.ts`
defines the ONE closed, discriminated inner shape a Rumor's `.content` may
carry (as a JSON string — itself valid UTF-8 plain text, satisfying NIP-17's
own "content MUST be plain text" requirement):

### `"session-init"` (Phase D)

```ts
{
  schemaVersion: 1,
  kind: "session-init",
  suite: "fedos-direct-ratchet-v1",
  generation: number,
  senderAccountRef: { authority, publicIdentifier, identityId },
  senderDeviceRef: string,
  recipientAccountRef: { authority, publicIdentifier, identityId },
  recipientDeviceRef: string,
  conversationId: string,
  ratchetPublicKeyHex: string,   // PUBLIC DH key only
}
```

Every field is a public initialization fact. Structurally incapable of
carrying a root key, chain key, message key, ratchet private key, Master
Seed, sealing key, or raw `SecretHandle` — the type has no such field, and
the strict validator (`isWellFormedFedosDirectRatchetNip17Payload`) rejects
any unrecognized extra field outright (exact closed field set, mirroring
`fedos_direct_ratchet_session_record.ts`'s own `hasExactFields()`
discipline).

### `"message"` (Phase F)

```ts
{
  schemaVersion: 1,
  kind: "message",
  suite: "fedos-direct-ratchet-v1",
  generation: number,
  sessionId: string,          // the safe binding reference
  messageNumber: number,       // safe, public observability metadata only
  wireMessageBase64: string,   // opaque header+ciphertext, already Rust-sealed
}
```

`wireMessageBase64` is the exact, opaque, already-encrypted wire message
`FedosDirectRatchetCryptographicSession.encrypt()` returns — this file never
decomposes or re-derives it. `sessionId` is a public reference only (see
the device-pair resolver's own header for why it is canonically ordered,
not a secret).

## Mislabeling guard (Phase F/G requirement)

The inbound coordinator always attempts
`decodeFedosDirectRatchetNip17PayloadFromContent()` **first**; a decode
failure returns `"not-ratchet-payload"`, and only then does the caller
(`FedosConversationRuntime.receiveNip17Rumor()`) fall through to the
existing, unmodified legacy `FedosNip17InboundImportCoordinator` (plain
chat text). This ordering, plus the strict exact-field-set validator,
means an ordinary human chat message can never be misread as a ratchet
payload, and a real ratchet payload is never misdelivered to the legacy
plain-text importer.

## Size bound

`wireMessageBase64` is bounded (`MAX_WIRE_MESSAGE_BASE64_LENGTH = 65536`) —
generous for a real ratchet header (session id + device refs + a 32-byte
public key + counters, all bounded ≤256 bytes per the Rust header encoder's
own limit) plus AEAD-sealed chat-length ciphertext, while still a closed
bound, never unlimited.
