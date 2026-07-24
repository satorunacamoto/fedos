# Secure Runtime Alpha 7401–7480 — Phase C: Route-Binding Option Review

**FedOS Direct Conversation Route Binding and NIP-17 Inbound Isolation Arc.**

Eight options evaluated against: Relay metadata exposure, NIP-17
interoperability, authentication, tamper resistance, replay behavior,
restart recovery, legacy compatibility, static-route compatibility,
Ratchet compatibility, multi-Device behavior, Session Reset behavior,
migration requirements, implementation size, fail-closed behavior.

## A. Outer Gift Wrap tag

The Gift Wrap (`kind:1059`) is the ONE thing a Relay actually observes,
signed by a throwaway ephemeral key per NIP-59's own design — its tags
are visible to every Relay and every observer, and are NOT authenticated
as the real sender's (the ephemeral signer proves nothing about who is
really inside). **Disqualified**: exposes raw Conversation identity to
the Relay unnecessarily, and any routing fact placed there would be
trusted, unauthenticated metadata — both explicit disqualifiers in this
Arc's own mission.

## B. Seal metadata (Seal-level tags)

The Seal (`kind:13`) IS signed by the real sender's key and is itself
hidden from the Relay (nested inside the Gift Wrap's own ciphertext) —
so a Seal-level tag would be both authenticated and non-Relay-visible.
However, the Seal/Gift-Wrap construction and parsing
(`fedos_private_wire_adapter.ts`) is a single, SHARED, foundational layer
used identically by Direct delivery, the legacy proprietary route, AND
Group pairwise fanout — modifying it to carry route-specific data would
touch a much broader, lower-level surface than this Arc's own narrow
mission requires, and risks becoming exactly the kind of "unrelated
protocol redesign" the mission forbids. **Rejected in favor of C**: same
authentication/exposure properties are achievable one layer up, in Rumor
content, which is already route-specific and already extended once
before (the Ratchet payload) without touching the shared Seal/Gift-Wrap
codec at all.

## C. Encrypted Rumor content/tags

The Rumor (`kind:14`) is unsigned by design (NIP-17's own plausible-
deniability property), but is only ever obtained by successfully
NIP-44-decrypting the Seal — which WAS signed by the real sender's key
over content that includes the serialized Rumor. A routing fact inside
Rumor content is therefore authenticated **transitively**: nobody can
forge or tamper with it without breaking the Seal's own signature/AEAD.
It is never Relay-visible (buried two layers deep). `fedos_direct_ratchet_nip17_payload.ts`
already establishes exactly this convention for the Ratchet route (a
`schemaVersion`-gated, strictly-validated JSON object in `.content`) —
extending the SAME convention to the plain `nostr-nip17-v1` route is
additive, minimal, and precedented, not an invention.

**Selected as this Arc's own wire mechanism** — see the Normative
Decision.

## D. Route entirely by Ratchet session identity

`FedosDirectRatchetSessionId` already IS a Conversation-bound identifier,
and already prevents SILENT misrouting for the Ratchet route (Finding 2
is a rejection defect, not a misrouting defect — see the Defect
Reproduction Report). But the plain `nostr-nip17-v1` route has no Ratchet
session at all by design (a real, simpler, non-forward-secret route this
codebase deliberately still supports) — routing "entirely" by Ratchet
session identity would require mandating Ratchet for every Direct
message, i.e., removing or replacing the plain route outright. **Disqualified
as the sole mechanism**: this is a scope-exceeding protocol change, not a
routing fix. The Ratchet route's own session-id binding remains valid and
is preserved unmodified as an ADDITIONAL, stronger binding layer once the
general Conversation-id binding (Option C) exists.

## E. Derive a stable opaque route binding from conversation + Device pair

Structurally this is what `FedosDirectRatchetSessionId` already does
(a derived string baking in conversationId + both Device refs). Applying
an opaque DERIVED token (e.g., an HMAC) as the general binding, rather
than the plain conversationId field itself, adds implementation
complexity (a new derivation function, a new domain-separation constant,
a new place to get canonicalization wrong) without a real security
benefit — the binding is already inside encrypted content, so a derived
opaque value hides nothing an attacker with edge access could not already
infer from an authenticated plaintext field, and a plain field is simpler
to validate, audit, and log safely. **Absorbed into the chosen model as a
design note, not adopted as a separate opaque-hash mechanism**: the
chosen binding carries the real conversationId (and account/Device refs
where required) directly, plain, inside the encrypted Rumor — Option C's
placement with Option E's own "exact binding" intent, expressed directly.

## F. One peer-level inbox, then disambiguate only after decrypt

This is, in effect, ALREADY how Seal decryption works today: NIP-44
decryption of the Seal depends only on the (sender, recipient) real
identity pair, never on which Conversation a message belongs to — the
Seal-decrypt step is already a real "peer-level inbox." What is
genuinely MISSING is the disambiguation step immediately after that
decrypt succeeds. **This option's own high-level shape is correct and is
exactly what the chosen model implements** — Option C supplies the
disambiguation payload that step needs; F is not a separate,
competing option so much as an accurate description of the algorithm
Option C's own inbound handling must follow (decrypt once per real
identity pair, THEN resolve the exact Conversation from the authenticated
binding, never from peer identity alone).

## G. Prohibit multiple Direct Conversations per peer

A real product regression (removing legitimate functionality — separate
threads with the same contact, e.g., work vs. personal), does not fix
conversations that already exist in this exact ambiguous state today (the
prior arc's own test constructed this reachable state live), and does
not address the underlying routing gap at all, merely avoids exercising
it going forward for NEW conversations. **Disqualified**: does not solve
the problem, regresses real functionality, silently strands existing
state.

## H. Another source-grounded model

Not needed — Option C (wire placement) combined with F's own correct
algorithmic shape and E's "exact binding" intent dominates cleanly across
every evaluated criterion, is fully source-grounded (extends an already-
shipped, already-reviewed convention), requires no new NIP, no new crypto
primitive, and no redesign of Ratchet, Identity, NIP-17's own Seal/
Gift-Wrap construction, or Secure Memory.

## Disqualification summary

| Option | Disqualifying reason |
|---|---|
| A | Relay-visible, unauthenticated at that layer |
| B | Correct properties, but touches a shared, foundational, cross-route codec — broader blast radius than necessary |
| D (as sole mechanism) | Requires eliminating the plain route entirely — scope-exceeding |
| G | Product regression; does not fix already-reachable ambiguous state; avoids rather than solves |

## Selected: C, with F's algorithmic shape and E's binding-content intent

See `secure_runtime_alpha_7401_7480_routing_decision.md` for the full
normative schema, authentication coverage, legacy policy, and multi-
Device/Session-Reset behavior.
