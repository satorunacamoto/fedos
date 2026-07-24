# Secure Runtime Alpha 7401–7480 — Phase B: Current Route Inventory

**FedOS Direct Conversation Route Binding and NIP-17 Inbound Isolation Arc.**

Every identifier available at some layer of the current inbound pipeline,
assessed against the properties that matter for a route-binding
decision. "Encrypted" means confidential from the Relay and any network
observer; "authenticated" means cryptographically bound to the real
sender, not merely asserted.

| Identifier | Authenticated? | Encrypted? | Visible to Relay? | Persisted? | Available before decrypt? | Available after unwrap? | Stable across restart? | Suitable for routing? | Collision risk | Metadata cost |
|---|---|---|---|---|---|---|---|---|---|---|
| Conversation ID (`FedosConversationId`) | N/A (local value) | — | No (never sent as-is today) | Yes (draft/activation) | No | Only if embedded in payload | Yes | Yes, if embedded authenticated | None (locally unique) | Zero if embedded inside encrypted content |
| Membership ID | N/A (local value) | — | No | Yes | No | Derived locally post-routing | Yes | Indirectly (via Conversation) | None | N/A |
| Participant authority/reference (`{authority, publicIdentifier}`) | Yes (= account pubkey) | — | Yes (sender field is Rumor-level, itself inside the Seal, so relay sees only the outer ephemeral Gift Wrap keys) | Yes (Membership) | No | Yes (Rumor's own authenticated sender) | Yes | Alone: NO (peer-only = the defect) | High when 2+ Conversations share a peer | Zero (already carried) |
| Sender account pubkey (`rumor.senderPublicKeyHex`) | Yes (NIP-44/NIP-59 construction) | Relay never sees it (buried under ephemeral Gift Wrap) | No | No (used transiently) | No | Yes | Yes | Alone: NO (the defect's root cause) | High under 2+ same-peer Conversations | Zero |
| Sender Device identity (`senderDeviceRef`) | Only in the Ratchet payload (`senderDeviceRef` field, cross-checked against Device Registry); absent entirely on the plain nip17-v1 route | Yes, when present (inside Rumor content) | No | Yes (Device Registry) | No | Yes, Ratchet route only | Yes | Contributes, not sufficient alone | Low (registry-checked) | Small (short device id string) |
| Recipient Device identity (`recipientDeviceRef`) | Only in the Ratchet payload | Yes, when present | No | Yes (Device Registry) | No | Yes, Ratchet route only | Yes | Contributes, not sufficient alone | Low | Small |
| Ratchet session identity (`FedosDirectRatchetSessionId`) | Derived deterministically from (accounts, devices, **conversationId**, suite, generation); not itself signed, but only reconstructible by a party who already knows the real conversationId | Yes (inside Rumor content) | No | Yes (session persistence) | No | Yes, Ratchet route only | Yes | None by construction (conversationId is baked in) | Small (bounded string) |
| Ratchet generation | Structural, cross-checked against local ground truth | Yes | No | Yes | No | Yes, Ratchet route only | Yes | Contributes | Negligible |
| NIP-17 Rumor ID (`rumor.envelopeId`, the Rumor's own NIP-01 `id`) | Yes (canonical hash of authenticated content) | N/A (an id, not payload) | No (buried in Seal/Gift Wrap) | Yes (dedup ledger) | No | Yes | Yes | No (identifies the MESSAGE, not the Conversation) | None (already the dedup key) | Zero |
| Seal ID | Yes (it is itself a signed Nostr event) | The Seal's own ciphertext is the Rumor | Only the outer Gift Wrap is Relay-visible, never the Seal | Not separately | No | Discarded after unwrap | N/A | Not applicable to routing | N/A | N/A |
| Gift Wrap ID (outer Nostr event id) | Yes (signed by an ephemeral key — NOT the real sender) | It IS the ciphertext container | Yes — this is the ONE thing the Relay actually sees | Sometimes (dedup keys on the inner Rumor id instead, per this codebase's own established Alpha 1861 discipline) | Yes | N/A (outer layer) | Yes | Explicitly disqualified for carrying real routing facts (Relay-visible) | N/A | Already paid regardless |
| Outbox record ID (`FedosConversationTransportOutboxId`) | N/A (purely local bookkeeping) | N/A | No | Yes | N/A | N/A | Yes | No (sender-local only, invisible to recipient) | N/A | N/A |
| Relay event ID | Same as Gift Wrap ID at the wire level | — | Yes | Sometimes (relay dedup) | Yes | N/A | Yes | Disqualified (Relay-visible, outer layer) | N/A | N/A |
| Invitation/bootstrap identity (`FedosConversationInvitation` id) | Yes (signed at creation) | Sent via the same private delivery path | No | Yes | No | Yes | Yes | Establishes the Conversation, not per-message routing | N/A | Already paid |
| Control-payload discriminator (`payload.kind`: `"session-init"` \| `"message"`, Ratchet route only) | Structural (validated by strict codec) | Yes (inside Rumor content) | No | N/A (transient) | No | Yes | N/A | Distinguishes control vs. data, not Conversation identity | N/A | Negligible |

## Conclusions driving Phase C

1. **No currently Relay-visible field is an acceptable routing carrier** —
   the only thing the Relay ever legitimately sees is the outer Gift Wrap
   (ephemeral key, signed by a throwaway keypair, by NIP-59's own design).
   Any option that puts a real Conversation identifier there fails this
   Arc's own "no outer Relay-visible conversation ID" preference and this
   codebase's own established privacy posture.
2. **The Ratchet route's own `FedosDirectRatchetSessionId` already proves
   the concept works**: baking the Conversation id into a value carried
   inside the encrypted Rumor, and cross-checked against local ground
   truth, already eliminates SILENT misrouting for that route (Finding 2
   is a rejection defect, not a misrouting defect) — the missing piece is
   using an authenticated binding as the PRIMARY lookup key (Conversation
   → validate membership) rather than as a secondary equality check
   against an ambiguous peer-only guess.
3. **The plain `nostr-nip17-v1` route has no structured payload at all**
   today — `rumor.content` is raw user plaintext. Any fix for Finding 1
   necessarily introduces SOME structured envelope inside that content,
   mirroring the convention `fedos_direct_ratchet_nip17_payload.ts` already
   established for the Ratchet route (a `schemaVersion`-gated, strictly-
   validated JSON object) — this is the natural, minimal, already-precedented
   shape, not an invention.
4. **A Device pair is not sufficient alone** — a single Device pair can
   still participate in two different Conversations (e.g., a Board child
   Direct path vs. a standalone Direct conversation with the same peer's
   same Device), so the binding must name the Conversation directly, not
   merely the Device pair.
