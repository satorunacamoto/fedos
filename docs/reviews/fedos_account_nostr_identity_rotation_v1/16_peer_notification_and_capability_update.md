# 16 — Peer Notification and Capability Update

## How a future transition uses `d825aa0`'s live peer-capability architecture

`d825aa0` already ships a closed, versioned, evidence-leveled peer
lifecycle-notification pipeline (`FedosRatchetPeerLifecycleFact`,
`FedosRatchetPeerCapabilityInboundCoordinator`, durable
`FedosRatchetPeerCapabilityObservationV1`) riding the EXISTING
authenticated private-message path (`"nostr-nip17-v1"` Gift Wrap via
`sendMailboxNip17Control()`) — no new Nostr kind, no public event. This
review's own Implementation Arc reuses this exact pipeline rather than
building a second one; the 6 new facts below are proposed as ADDITIVE
values to the SAME closed `FedosRatchetPeerLifecycleFact` union (or a
clearly-related sibling union, to be decided by the Implementation Arc,
never invented here as code):

- `identity-transition-advertised` — the bare fact a transition claim
  exists (schema/version valid), regardless of evidence level.
- `identity-transition-verified` — the claim's own signature(s) verify at
  whatever evidence level it claims (`07`).
- `identity-transition-conflicting` — two claims name the same
  predecessor at the same/overlapping revision (`17`).
- `old-identity-superseded` — a peer's own local policy has reached
  `"locally-accepted"` for a specific new identity as this predecessor's
  successor.
- `peer-reverification-required` — the recommended, SAFE recommendation
  (never an automatic action, mirroring `FedosRatchetPeerSessionActionRecommendation`'s
  own "recommendation only" discipline) whenever a transition is observed
  but not yet accepted.
- `ratchet-reset-required` — reuses the EXISTING recommendation value
  already defined by `d825aa0`'s own recommendation union; not a new
  value, cited here to confirm the Ratchet-transition consequence (`12`)
  routes through the SAME existing mechanism.

## Why the existing authenticated private path is sufficient

`d825aa0`'s Phase F reconciliation already established that a
protocol-neutral control payload riding the existing NIP-17 Gift Wrap
transport meets every requirement (encrypted, one-recipient-Device-scoped,
no public event, strict schema, size-bounded, replay-identity, duplicate
handling) — nothing about identity-transition claims changes any of
those requirements. **A public Relay event is not needed and this review
does not recommend one** — it would leak transition metadata to every
Relay operator and observer for no capability the private path lacks.

## First-contact / contact-discovery limitation (named honestly)

If a peer ONLY knows the OLD identity and has no currently-active
Conversation/transport path to the new identity, this mechanism **cannot
reach them proactively.** This mirrors `3ebfa37`'s own already-documented
finding that a brand-new Device is "effectively unreachable by existing
peers" until it messages first — the same limitation applies one layer
up: a peer with no live channel to the new identity can only learn of the
transition (a) if the OLD identity is still able to send one final
authenticated message announcing it (requires the old key/Device to still
be available — impossible if fully compromised/lost, `09`), or (b) through
an out-of-band channel this review does not specify (matching `08`'s
manual-verification fallback). **This is an accepted, honestly-disclosed
gap, not a defect this review claims to close.**
