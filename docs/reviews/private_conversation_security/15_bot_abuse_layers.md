# 15 — Bot and Abuse Defense Layering

Extends the prior review's own §11 (four layers: Application, Protocol/
Economic, Gateway, Ontology) to Private space specifically. Baseline
unchanged: none of NIP-13, Lightning stake, JA4, CrowdSec, or an
Ontology observation system exists anywhere in `src/` today (re-confirmed
this pass — no new hits since the prior review's own search).

## Layers, restated for Private space

**Capability/Application layer** — invite issuer limits (§09's own
`issuer`-scoped rate limiting), redemption limits (§09's own `maxUses`,
enforced per §10's own single-Authority recommendation), room rate
limits (message-send throttling per `FedosConversationId`), membership
revocation (§04/§06). This is the only layer this review's own
Private-conversation design (§02-§13) actually specifies; everything
below is named for boundary purposes only.

**Economic layer** — optional Lightning stake, optional NIP-13 PoW.
Unchanged from the prior review's own §11 finding: answers "has this
actor paid a real-world cost," never "how should an accepted message be
delivered" — belongs, if ever built, ahead of message/capability
creation, never inside the Conversation Core, Outbox, or Publisher.

**Gateway layer** — IP/ASN reputation, JA4/HTTP2 metadata, CrowdSec,
sequence/rate analysis. Belongs at a transport/connection boundary
outside this repository's own Board/Conversation domain entirely — see
§14's own finding that this layer sits largely outside what source-code
review can evaluate at all.

**Ontology layer** — a future Board-tuned observation/anomaly system.
Unchanged from the prior review's own §12 (Ontology Boundary): `p2p/`
is a separate, crypto-asset-domain Python project with its own git
repository (re-confirmed untouched this pass — this review's own
"Absolute Prohibitions" list forbids modifying, staging, or importing
it, honored throughout). Any future Board Ontology Projection must stay
one-way, read-only, never mutating Canonical Conversation/Membership
records — reapplied here unchanged.

## Required guardrails, restated and extended for Private space specifically

- **TLS fingerprint must never be used as Identity.** A network-layer
  signal (JA4 or similar) may inform a Gateway-layer reputation score,
  but must never become, or be conflated with, a
  `FedosConversationParticipantRef` (§04) — doing so would silently
  reintroduce a device/network-level identity into an authorization
  model §04 deliberately designed to need no permanent account id.
- **Datacenter IPs must not be uniformly blocked.** Named explicitly
  per this review's own instruction — a real risk specific to Private
  Conversation: a participant reasonably using a VPN/Tor/hosting
  provider for the SAME confidentiality reasons that motivate wanting a
  private conversation in the first place would be exactly the
  legitimate use case a uniform datacenter-IP block would wrongly
  reject — the anti-abuse and the confidentiality goals are in direct
  tension here, and a blanket policy resolves it in the wrong direction
  for this specific feature.
- **PoW alone must never be claimed to eliminate bots.** Restated,
  unchanged from the prior review's own §11 explicit non-claim.
- **Lightning payment correlation risk must be recorded, not ignored.**
  New this review, directly tied to §14: a Lightning stake requirement
  (Economic layer) — even though it never touches the Conversation Core
  itself — creates EXACTLY the "account/payment correlation" risk §14
  already named as a non-linkability failure mode. A future Arc
  choosing to add Lightning-stake anti-spam for private-space invites
  must weigh this explicitly: the stronger the economic anti-spam
  signal, the more it tends to correlate a real-world payment identity
  with participation in a specific private conversation feature — the
  same tension the Gateway/Ontology layers already carry for abuse
  signals generally (§14's own "abuse observations" item), made
  concrete for the one layer (Economic) most likely to leave an
  externally-auditable financial trail.

## What this section does not do

No implementation, no sizing, no specific rate-limit numbers, no choice
among PoW/Lightning/neither — every concrete decision is deferred to a
future Arc, per this review's own no-implementation mandate. This
section's own job is layering discipline and the two Private-space-
specific risks (datacenter-IP-block tension, Lightning correlation)
neither this review's own prior pass nor the general-purpose §11 of the
earlier review could have named without Private Conversation's own
confidentiality goal in view.

## See also

- `docs/reviews/private_conversation_security/09_capability_invitation.md`
- `docs/reviews/private_conversation_security/14_operator_non_linkability.md`
- `docs/reviews/board_runtime_application_api_11_anti_bot_layers.md`
