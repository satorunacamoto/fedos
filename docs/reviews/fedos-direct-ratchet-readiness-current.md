# Direct Ratchet Readiness — Current State (Read-Only Note)

Per mandate §56: bounded, read-only readiness note for a future Direct
Ratchet arc. **No implementation in this document or this arc.** Synthesizes
Agent C's Phase A investigation (`01_CURRENT_SECURITY_STATE_MAP.md`, Items
5/7) plus direct verification against current HEAD (`58a7e161`).

## Is peer Device discovery still the blocker?

**Yes, confirmed, unchanged.** Ratchet session establishment requires the
counterparty's Device to be a `"trusted"` binding in the local Device
Registry (`FedosDeviceRegistryPersistence`). The **only production writer**
of that registry is same-account Device Pairing
(`fedos_device_binding_pairing_exchange.ts`) — explicitly same-account-only
by design. There is **no cross-account peer-Device discovery/announcement
protocol anywhere in this codebase.** A validly-signed peer-capability
advertisement from a genuinely different account is still rejected
`"untrusted-device"` by `fedos_ratchet_peer_capability_acceptance_policy.ts`,
because acceptance is gated on that same Registry's trust state, not on
signature validity alone.

Separately, and independently: the *send-path* wiring
(`FedosDesktopRuntimeConfig.directRatchetMessageDeliveryRemoteDeviceRef`) is
a single, runtime-wide, construction-time-fixed device ref, currently
supplied **only** by a test-injection-only environment variable
(`FEDOS_BETA_DIRECT_RATCHET_MESSAGE_DELIVERY_REMOTE_DEVICE_REF`), unset on
every ordinary launch. Even if the Device-discovery blocker were closed,
this second, narrower wiring gap would still need to become per-conversation
(it cannot today serve two conversations with different peers) — this arc's
new `fedos_direct_conversation_forward_secrecy_route.ts`-consuming code
(`fedos_conversation_security_state_controller.ts`) already works around
this narrowly for READ purposes only; it does not change send-path routing.

## What exact signed object/protocol is missing?

A **peer-Device announcement**: a signed object, published by an account,
that says "here is a device I control, with this public key" — discoverable
and independently verifiable by ANY other account, not just devices already
paired to the same account. None of the following exist today:

- A wire format/event kind for such an announcement.
- A durable, cross-account-queryable index of announcements (the current
  `FedosDeviceRegistryPersistence` is explicitly single-account-scoped by
  its own construction; `peerCapabilityListObserved()`'s own persistence,
  `FedosRatchetPeerCapabilityObservationPersistence`, records only devices
  THIS process has itself directly received a capability advertisement
  from — a passive observation log, not a discovery/announcement protocol).
- A revocation/rotation message an announcing account could publish to
  invalidate a previously-announced device (see "replay/revocation
  questions" below).

## Which current types/ports already exist and are reusable?

- `FedosDeviceBindingV1` / `FedosDeviceBindingAccountRef`
  (`src/os/messenger/device/fedos_device_binding.ts`) — the trust-state
  record shape itself is protocol-agnostic and reusable as-is for a
  cross-account binding, once *something* populates it for a non-local
  account.
- `FedosRatchetPeerCapabilitySafeStatus` / peer capability observation
  machinery (`src/os/messenger/conversations/ratchet/peer_capability/`) —
  already does real, signed, cross-account capability advertisement
  send/receive (`FedosRatchetPeerCapabilityOutboundCoordinator`/
  `...InboundCoordinator`). This is the CLOSEST existing scaffold: it
  already proves an account can publish a real, Schnorr-signed statement
  another account's process durably records
  (`FedosRatchetPeerCapabilityObservationPersistence`). It is NOT itself a
  Device-identity announcement (it advertises *capabilities* — e.g.
  "I support nostr-nip17-v1" — not "this key belongs to my device"), but
  its wire/signing/persistence pattern is the most direct precedent to
  extend rather than reinvent.
- `resolveFedosDirectRatchetDevicePair()`
  (`fedos_direct_ratchet_device_pair_resolver.ts`) — already correctly
  separates "session resolution" from "trust gate" (checks the Registry
  AFTER resolving a session candidate); a real discovery protocol would
  plug in as a NEW Registry writer, requiring zero change to this
  resolver's own logic.
- `selectFedosDirectConversationForwardSecrecyRoute()` (this arc's own
  citation, `fedos_direct_conversation_forward_secrecy_route.ts`) — already
  fails closed and honestly on every one of the "no discovery yet" cases
  (`"no-session-for-conversation"`, `"remote-device-unknown"`); a real
  discovery protocol would make these cases become reachable-and-solvable
  rather than requiring new failure modes.

## Which trust authority would bind peer identity → peer device?

Not yet designed. Candidates to weigh in a future arc (not decided here):

1. **Self-signed by the announcing account's own Nostr identity key** —
   mirrors `fedos_ratchet_peer_capability_authentication.ts`'s own
   existing "the account key signs, a device key is optional/best-effort
   corroboration" pattern (Agent C Item 7). Cheapest, requires no new
   authority, but a compromised ACCOUNT key can then announce arbitrary
   devices — same trust boundary the account key already has for
   everything else in this codebase (messages, product listings, etc.), so
   likely proportionate.
2. **Cross-signed by an existing paired (trusted, same-account) device** —
   stronger, but only useful for a MULTI-device account; does nothing for
   the common single-device-per-account case that is most of today's real
   usage.
3. Any third-party/attestation authority — explicitly out of scope; FedOS's
   own architecture has no central authority anywhere and this document
   does not propose introducing one (mandate's own local-first constraint,
   consistent with every other arc this session).

Option 1 is the closest fit to the existing peer-capability precedent and
should be the starting hypothesis for a future design arc, not a decision
made here.

## What replay/revocation questions remain?

- **Replay**: an announcement, once published, is presumably intended to be
  durable/long-lived (unlike a capability advertisement's own bounded
  request/response shape) — a future protocol needs its own explicit
  freshness/expiry model, since blindly reusing
  `FedosRatchetPeerCapabilityOutboundCoordinator`'s request/response
  freshness assumptions would not fit a "durable standing fact" shape.
- **Revocation**: no existing mechanism in this codebase revokes a
  cross-account fact at all (the closest analogue,
  `revokeFedosDeviceBinding()`, is LOCAL-only — it revokes trust in this
  process's own Registry, never propagates to any other account). A real
  announcement protocol needs its own signed revocation message, and
  every RECEIVING account's process needs to durably apply it — a second,
  separate protocol leg from the announcement itself.
- **Rotation**: an account replacing one device with another (or adding a
  second device) needs the SAME open question as revocation — no current
  precedent for "durably propagate a fact across accounts and have every
  receiver apply it, with replay protection" exists anywhere in this
  codebase today. The Identity Transition subsystem
  (`evaluateFedosIdentityTransitionEvidence()`) is the closest analogous
  precedent for a "receive a claim about identity change, verify it,
  durably record an evidence-graded outcome" shape, but it operates on
  ACCOUNT identity, not device identity, and its own generation/rollback
  detection machinery would need to be re-derived, not reused verbatim,
  for a device-scoped version.

## Conclusion

The blocker is exactly as previously understood, independently
re-confirmed this arc: **cross-account peer-Device discovery**, not
anything about the Ratchet session/encryption machinery itself (which is
real, tested, and already correctly gates on Device trust once a trusted
binding exists). `FedosRatchetPeerCapabilitySafeStatus`'s own
observation/advertisement machinery is the strongest existing scaffold to
extend. A future arc designing this protocol should explicitly answer the
binding-authority question (candidate 1 above) and design revocation
BEFORE announcement, not after, given how much of this codebase's own
existing discipline treats "no revocation path" as the harder half of
similar problems elsewhere (see `FedosDeviceTrustState`'s own terminal-state
guarantees, `FedosDirectRatchetSessionLifecycleState`'s own terminal
states).

**Not implemented, not designed further, in this arc — this document is
read-only synthesis of what this arc's Phase A investigation already
found.**
