# Secure Runtime Alpha 7401–7480 — Wire and Metadata Compatibility Report

**FedOS Direct Conversation Route Binding and NIP-17 Inbound Isolation Arc.**

## Classification: FedOS-proprietary encrypted payload convention, carried inside standard NIP-17 framing

This Arc's own route binding is **not** a new Nostr NIP, **not** a new
public event kind, and makes **no** claim of interoperability with a
generic NIP-17 client for its own structured inner meaning. It is the
exact same category of thing `fedos_direct_ratchet_nip17_payload.ts`
(Alpha 5561–5640) already shipped and this codebase's own reviewed
convention already established: a FedOS-specific, strictly-validated JSON
object placed inside `Rumor.content`, which NIP-17 itself defines as an
arbitrary application-level string. A standards-compliant NIP-17 client
receiving one of these Rumors sees a completely valid `kind:14` event
with plain-text `.content` — it simply has no way to render the FedOS
structure as anything meaningful, exactly as already true for the
Ratchet route today.

## What changed at the wire level

**Nothing at the outer wire level.** `NostrNip17V1WireAdapter`,
`fedos_nip17_rumor.ts`, `fedos_nip59_seal.ts`, and
`fedos_nip59_gift_wrap.ts` are all byte-for-byte unmodified by this Arc
(confirmed by structural guard). Every Gift Wrap, Seal, and Rumor
construction/parsing rule is identical to before this Arc. The ONLY
change is what the plain route's own `Rumor.content` string MEANS: it
used to be raw user plaintext; it is now (when the sender is running this
Arc's own code) a JSON envelope carrying `{schemaVersion, conversationId,
senderAccountRef, recipientAccountRef, body}`, where `body` is the real
user plaintext. The Ratchet route's own `"message"` payload gains one
additive optional field, `conversationId`, at `schemaVersion: 2`.

## Relay metadata exposure

**Zero new exposure.** The Relay only ever sees the outer Gift Wrap
event — an ephemeral-key-signed `kind:1059` event whose own `.content`
is the NIP-44-encrypted Seal. The route binding lives two encryption
layers below that (inside the Seal's own encrypted `.content`, which IS
the Rumor, whose `.content` is where this Arc's own binding lives). A
Relay operator, or any network observer, learns nothing new: they could
already see event timing, size, and the two communicating Nostr pubkeys'
`p`/author-adjacent metadata (an existing, pre-Arc property of NIP-17
itself) — never a Conversation identifier, before or after this Arc.

## NIP-17 interoperability

Unchanged from before this Arc for the Ratchet route (already
non-interoperable in its structured-payload sense); newly true for the
plain route as well, in the SAME narrow sense: a generic NIP-17 client
would see this Arc's own JSON as literal chat text (e.g.
`{"schemaVersion":1,"conversationId":"...", ...}`) rather than a rendered
message. This is an accepted, disclosed tradeoff consistent with the
existing Ratchet route's own precedent, not a new category of
non-compliance this Arc introduces.

## Authentication

The binding is authenticated **transitively**, never by its own
signature: it is only ever obtainable by successfully NIP-44-decrypting
the Seal, which is itself signed by the real sender's Nostr private key.
Tampering with the binding without invalidating the Seal's own
signature/AEAD tag is not possible. This exactly mirrors how the existing
Ratchet payload is authenticated — no new authentication mechanism, no
new signature scheme, no new key material.

## Replay behavior

Unchanged. Dedup remains keyed by the Rumor's own NIP-01 `id`
(`rumor.envelopeId`), tried BEFORE any binding decode or Conversation
resolution — a genuine replay of an identical event is rejected as
`"duplicate"` before this Arc's own new logic is ever reached, on both
routes, exactly as before this Arc (Alpha 1427/1861, unmodified).

## Restart recovery

No new persisted state exists for the route binding itself (see the
Legacy and Migration Policy doc) — restart recovery is governed entirely
by the SAME, unmodified Conversation/Membership/Ratchet-session
persistence this Arc leaves untouched.

## Legacy/static-route compatibility

See the Legacy and Migration Policy doc in full; summarized here: content
that does not decode as this Arc's own binding is treated as legitimate
legacy plaintext, accepted only when unambiguous, never guessed.

## Ratchet compatibility

The Ratchet cryptographic core, session-id derivation, Device-pair
resolution, and Session Reset authority are all byte-for-byte unmodified
(confirmed by structural guard). Only the SELECTION algorithm for which
Conversation an inbound Ratchet Rumor targets changed — from "resolve by
peer, then equality-check the claim" to "resolve by the claim directly,
then validate the sender is a genuine member of it."

## Multi-Device / Session Reset / migration requirements

See the Normative Routing Decision and Phase J's own real, live proof
(`secure_runtime_alpha_7401_7480_ratchet_route_binding_isolation.test.ts`).
No migration requirement beyond the additive `schemaVersion: 2` field on
one existing wire payload type.

## Implementation size

Three new, narrow, additive source files (a plain-message payload codec,
a route-binding resolver, a legacy-candidate counter — none exceeding
~120 lines), plus targeted edits to two existing coordinators/integration
classes to invert their own resolution order. No new persistence port,
no new Runtime, no new cryptographic primitive.

## Fail-closed behavior

Every new outcome this Arc introduces (`malformed-binding`,
`unknown-conversation`, `membership-denied`, `binding-mismatch`,
`ambiguous-legacy-route`, `unsupported-version`) is a closed rejection —
none of them ever silently accept, silently guess, or silently downgrade
to a weaker resolution path. Proven live in the failure matrix.
