# Secure Runtime Alpha 7401–7480 — Phase D: Normative Routing Decision

**FedOS Direct Conversation Route Binding and NIP-17 Inbound Isolation Arc.**

## Chosen model

**A versioned, closed route-binding structure carried inside the
encrypted NIP-17 Rumor content, used as the PRIMARY key for inbound
Conversation resolution — never a secondary equality check against an
ambiguous peer-only guess.** This extends the SAME proprietary payload
convention `fedos_direct_ratchet_nip17_payload.ts` already established
for the Direct Ratchet route (Alpha 5561-5640) to the plain
`nostr-nip17-v1` route as well, and inverts the Ratchet route's own
existing algorithm from "resolve by peer, then check the binding matches"
to "resolve by binding directly, then check the sender is a genuine
member of that exact Conversation."

This is a **FedOS-proprietary encrypted payload convention carried inside
standard NIP-17 framing** — not a new NIP, not a claim of universal
NIP-17 client interoperability for the structured content (exactly the
same honest characterization this codebase's own Ratchet payload header
already gives itself). The outer Rumor/Seal/Gift-Wrap wire shapes are
completely unmodified standard NIP-17/NIP-59; only the MEANING of
`.content` for FedOS-to-FedOS Direct messages changes, exactly as it
already did once before for the Ratchet route.

## Schema

### New: `FedosDirectConversationPlainMessagePayloadV1` (plain `nostr-nip17-v1` route)

```ts
interface FedosDirectConversationPlainMessagePayloadV1 {
  readonly schemaVersion: 1;
  readonly conversationId: string;       // bounded, non-empty
  readonly senderAccountRef: FedosDeviceBindingAccountRef;
  readonly recipientAccountRef: FedosDeviceBindingAccountRef;
  readonly body: string;                 // bounded; the actual message text
}
```

Replaces raw plaintext as this route's own `Rumor.content` codec (a new,
additive sibling file mirroring `fedos_direct_ratchet_nip17_payload.ts`'s
own `hasExactFields`/strict-shape/never-throws discipline exactly). An
inbound Rumor whose content fails to parse as this exact shape is treated
as a LEGACY plain-text message (see Legacy Policy) — never a hard error,
matching the Ratchet route's own established "decode failure falls
through" convention.

### Modified (additive): `FedosDirectRatchetMessagePayloadV1`

```ts
// schemaVersion: 1 (existing, UNCHANGED shape) -- legacy fallback path.
// schemaVersion: 2 (NEW) -- adds one field:
interface FedosDirectRatchetMessagePayloadV1 {
  readonly schemaVersion: 1 | 2;
  readonly kind: "message";
  readonly suite: FedosDirectRatchetSuite;
  readonly generation: number;
  readonly sessionId: string;
  readonly messageNumber: number;
  readonly wireMessageBase64: string;
  readonly conversationId?: string; // REQUIRED when schemaVersion === 2; absent/ignored at schemaVersion 1
}
```

`FedosDirectRatchetSessionInitPayloadV1` is UNCHANGED — it already carries
`conversationId` at schemaVersion 1; only the ALGORITHM consuming it
changes (see below).

## Canonical serialization

`JSON.stringify()` of the exact, closed field set — identical discipline
to the existing Ratchet payload codec (`encodeFedosDirectRatchetNip17PayloadToPlaintext`/
`decodeFedosDirectRatchetNip17PayloadFromContent`), reused verbatim for
the new plain-route codec. No canonical byte-ordering requirement beyond
JSON's own object-key handling, since the ENTIRE structure is inside
already-authenticated (Seal-signed) content — this mirrors the existing,
reviewed convention exactly; introducing a stricter canonical-bytes
scheme here would be a new primitive this Arc's own mission does not
require and does not justify.

## Signing/authentication coverage

The binding is authenticated **transitively**: it lives inside
`Rumor.content`, which is only ever obtained by successfully
NIP-44-decrypting the Seal (`kind:13`), itself signed by the real
sender's Nostr private key. No additional signature is added over the
binding itself — this matches the existing, reviewed Ratchet-payload
authentication model exactly (its own header: "the existing NIP-17
envelope... already authenticates the sending ACCOUNT"). Device-level
authentication (for the Ratchet route) continues to come from the
Device Registry trust check already performed before any session state
is touched — unchanged.

## Producer

- Plain route: `FedosNip17InboundImportCoordinator`'s OUTBOUND
  counterpart (the existing plain-Direct-message send path) constructs
  the new envelope from the ALREADY-real, ALREADY-validated
  `conversationId`/local and remote `FedosDeviceBindingAccountRef` the
  Conversation Runtime already has in hand at send time — never a
  caller-supplied arbitrary value.
- Ratchet route: `FedosDirectRatchetOutboundIntegration.sendMessage()`
  supplies the ALREADY-real `conversationId` it already receives as a
  parameter — purely additive, no new resolution logic needed on the
  send side.

## Consumer

- Plain route: a NEW resolver,
  `resolveFedosDirectConversationByRouteBinding()`, looks up the
  Conversation DIRECTLY by the binding's own `conversationId` (an O(1)
  `draftPersistence.getDraft()` call, never an O(N) peer scan), confirms
  it is an active `direct` Conversation, then confirms the sender is a
  genuinely active Member of THAT EXACT Conversation (never any other).
  `resolveFedosPrivateNostrInboundDirectConversation()` (Alpha 1424,
  UNCHANGED) is retained, unmodified, and reused ONLY for genuinely
  legacy (undecodable) Rumor content, per the Legacy Policy below.
- Ratchet route: `FedosDirectRatchetInboundIntegration`'s
  `#receiveSessionInit()`/`#receiveMessage()` are changed to resolve the
  target Conversation FROM the payload's own `conversationId` first (via
  the SAME new resolver), THEN validate the sender against that exact
  Conversation's Membership — inverting today's "resolve by peer, then
  equality-check" order, which eliminates Finding 2 (deterministic
  wrong-conversation rejection) as a direct consequence, with zero change
  to the Ratchet cryptographic core, session-id derivation, or Device-
  pair/generation checks.

## Persistence

No new persistence port. The binding is derived at send time from
already-persisted Conversation/Membership/Device facts, and validated at
receive time against the SAME already-persisted facts — purely a routing
computation, never a new durable fact of its own.

## Version

`schemaVersion` field, `1` for the plain route's own (new) envelope;
`1 | 2` for the Ratchet message payload (additive). Any other value at
decode time is `"unsupported-version"` — fails closed, never guessed,
never silently treated as the highest known version.

## Legacy policy

See the dedicated Legacy and Migration Policy document
(`secure_runtime_alpha_7401_7480_legacy_migration_policy.md`) for the
full decision table. Summary: zero binding present (undecodable content)
→ fall through to the existing peer-only resolver, accepted ONLY if it
finds EXACTLY ONE active same-peer Direct conversation
("legacy-unambiguous"); zero or 2+ candidates → fail closed
(`"unknown-conversation"` / `"ambiguous-legacy-route"` respectively).
Never rewrites a past Relay event, never synthesizes a binding that was
never sent, never silently re-encrypts history.

## Malformed policy

A binding that decodes as valid JSON but fails the exact-shape/bounded-
length validator is `"malformed-binding"` — fails closed, distinct from
`"unknown-binding"` (a value present but referencing a Conversation this
Runtime has no record of at all) and distinct from `"binding-mismatch"`
(the binding is well-formed and the Conversation exists, but the sender
is not a genuine active Member of it).

## Conflict policy

If a binding names a real, locally-known Conversation, but the claimed
`senderAccountRef`/`recipientAccountRef` do not match that Conversation's
own real, active Membership records exactly, the import is rejected
(`"membership-denied"`) — never silently corrected, never imported under
a "best guess" Membership.

## Multi-Device behavior

Unchanged from the Ratchet route's own existing, reviewed discipline —
Device Registry trust (`resolveFedosDirectRatchetDevicePair()`,
UNMODIFIED) is still the sole authority for whether a specific Device
pair may participate in a session; the route binding only changes HOW
the target Conversation is found, never whether a Device pair is trusted.

## Session Reset behavior

Unchanged — `FedosDirectRatchetResetCoordinator`/`FedosDirectRatchetSessionResetAuthority`
(both UNMODIFIED) continue to evaluate every session-init exactly as
before; the only change is that the Conversation the evaluation applies
to is now found directly from the payload's own binding rather than via
a peer-only guess, meaning a reset for Conversation B can no longer be
spuriously evaluated against (or rejected in favor of) Conversation A's
own session state.

## Phase E — Decision gate: PASSED

- One model clearly dominates — yes (Option Review).
- Authentication is explicit — yes (transitive via the real Seal signature; documented above).
- Relay metadata exposure is bounded and documented — yes: zero NEW exposure (the binding lives strictly inside already-encrypted content; the outer Gift Wrap is unmodified).
- Ratchet/NIP-17 compatibility preserved or versioned safely — yes (additive `schemaVersion` 2 for the message payload only; session-init and the outer wire framing are unmodified; no new NIP).
- Legacy handling is deterministic — yes (Legacy and Migration Policy: zero/one/many candidates map to three fixed, closed outcomes, never a guess).
- No silent guess remains — yes (the only surviving peer-only path is the bounded "exactly one candidate" legacy case; 2+ candidates always fail closed).
- No unrelated protocol redesign is required — yes (zero Ratchet cryptographic-core change, zero Identity/Deletion change, zero new crypto primitive, zero new NIP).

**Proceeding to Stage 2 — Implementation.**

## Why this dominates every other option

See the Option Review for the full comparison. In one sentence: it is the
only option that supplies an authenticated, non-Relay-visible,
Conversation-exact binding usable as a genuine lookup key (not a
secondary check) for BOTH existing Direct-message routes, without
requiring a new NIP, a new crypto primitive, elimination of either
existing route, or any change to Ratchet's own cryptographic core,
Identity Transition, or Signed Deletion.
