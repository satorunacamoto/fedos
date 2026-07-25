# FedOS Conversation Forward Secrecy — Migration Plan

Goal: **per-conversation forward secrecy on the ordinary send path**, without
breaking the existing legacy route or any deployed profile.

Phase 1 is landed on `arc/fedos-conversation-forward-secrecy-default`.
Phases 2–5 are specified but **not** implemented.

---

## Why this order

The binding constraint is §4 of the Architecture Report: **no account can
learn another account's Device reference.** Every other piece — routing,
UI, policy — is downstream of that. Building routing first would produce code
no real user could ever reach.

So: make the gap measurable (Phase 1), close the bootstrap (Phase 2), then
route on it (Phase 3), then make it visible and enforceable (Phases 4–5).

---

## Phase 1 — Measurement and per-conversation resolution ✅ LANDED

**Delivered:** `fedos_direct_conversation_forward_secrecy_route.ts`
(pure, per-conversation, send-time), the closed
`FedosForwardSecrecyUnavailableReason` vocabulary, optional
`forwardSecrecySelector` on the coordinator, optional `forwardSecrecy` field
on `sent-locally`, wired in `FedosConversationRuntime`.

**Unlocks:** every send now answers "did this get forward secrecy, and if not
why". Revocation is re-checked per send; ambiguity fails closed.

**Does not unlock:** any actual forward secrecy. Routing unchanged.

**Compatibility:** fully additive; both new surfaces optional.

---

## Phase 2 — Peer Device Announcement (the real blocker)

**Problem.** `resolveFedosDirectRatchetDevicePair()` needs the counterparty's
Device in the local registry as a *trusted* binding. Device Pairing only ever
registers *your own* Devices.

**Proposal — an additive, signed announcement over the existing NIP-17
transport.** Reuse the established pattern: a new closed, versioned payload
inside the encrypted Rumor content, exactly as
`fedos_direct_conversation_plain_message_payload.ts` and the Ratchet's own
NIP-17 payload already do. No new transport, no new relay behaviour.

```
FedosPeerDeviceAnnouncementV1 {
  schemaVersion: 1
  conversationId          // scoped, never a global broadcast
  announcingAccountRef
  deviceRef
  devicePublicKeyHex      // the Ratchet identity key
  issuedAt / expiresAt
  signature               // by the ANNOUNCING ACCOUNT's Nostr key
}
```

The account signature is what makes this safe: the recipient already knows
the counterparty's account public key (it is the conversation membership),
so a forged announcement from a third party is rejected without any new trust
root.

**A new binding class is required.** These Devices must NOT enter the
registry as `trusted` — that state means "my own Device, pairing-verified".
Add `peer-announced`, which:
- is accepted by the Ratchet device-pair resolver,
- is **never** accepted by Device Sync / transfer / revocation-authority paths,
- is displayed distinctly in the Devices UI.

Treat this honestly as **TOFU** (trust-on-first-use): the first announcement
for a peer is accepted; a *changed* key for an existing peer must be surfaced
as a security event, never auto-accepted — reuse the Identity Replacement
review UI, which already exists for exactly this shape of decision.

**Exit criteria:** two accounts on separate profiles, over a real relay,
exchange announcements and each ends with a `peer-announced` binding for the
other; a forged announcement is rejected; a changed key requires review.

---

## Phase 3 — Route on it

**Change.** In `FedosConversationDirectMessagingCoordinator`, promote the
Phase 1 selector from reporting to deciding, with a per-Device send:

```ts
sendRatchetMailboxNip17ForDevice(envelopeId, conversationId, plaintext, remoteDeviceRef)
```
added **alongside** the existing fixed-ref method. When the selector returns
`route:"ratchet"`, take it; otherwise fall back to legacy **and report the
reason** — the fallback is never silent.

Retire `directRatchetMessageDeliveryRemoteDeviceRef` (the single global ref)
once nothing reads it. Keep the legacy route permanently: a peer who has not
announced, or an older build, must still receive messages.

**Session establishment** becomes automatic on first send when a
`peer-announced` binding exists and no session does.

**Exit criteria:** a real two-profile relay slice where the first message
reports `forwardSecrecy:false, reason:"no-session-for-conversation"` and a
subsequent one reports `forwardSecrecy:true`; two conversations with two
different peers each use their own session (the FS-3 blocker gone).

---

## Phase 4 — Make it visible

Surface `forwardSecrecy` per conversation in the UI through the existing
`window.fedosApp` bridge and the Safety Center. Show the specific reason, not
a padlock — a padlock that lies is worse than no padlock.

Update `SECURITY.md` and `KNOWN_LIMITATIONS.md` in the same commit as the
behaviour change, never after. Today's honest sentence is: *"Direct messages
do not currently have forward secrecy; a compromise of either party's
long-term account key exposes previously captured messages."*

---

## Phase 5 — Close the remaining gaps

- **FS-4 (at rest).** Rotate `FIXED_DIRECT_MESSAGE_KEY_EPOCH` per epoch and
  discard superseded keys. Independent of the wire ratchet; needs a migration
  for existing envelopes.
- **FS-5 (groups).** Requires a real group ratchet (MLS/Sender-Key). Out of
  scope for this line of work; currently disclosed as unsupported.
- **FS-6 (identity replacement).** Define whether a replaced identity
  re-establishes sessions automatically or requires review. Recommend
  review — silent re-establishment across an identity change is the exact
  shape of an impersonation attack.

---

## Risk register

| Risk | Mitigation |
|---|---|
| TOFU accepts an attacker's first announcement | Announcement is signed by the account key already known from membership; only *key change* is the residual risk, and it is routed to explicit review |
| `peer-announced` bindings leak into Device Sync | New binding class rejected by every non-Ratchet consumer; guard-tested |
| Fallback silently hides a downgrade | Phase 1 already makes every fallback carry a reason; Phase 3 must assert it |
| Old builds cannot decrypt ratchet messages | Legacy route retained permanently; Ratchet used only when a session genuinely exists |
| Metadata still exposed to relays | Unchanged and already disclosed in `SECURITY.md`; forward secrecy does not address traffic analysis |

---

## What must not be claimed until Phase 3 ships

FedOS **does not** provide forward secrecy for Direct conversations today.
Until Phase 3 is landed and proven by a real two-profile relay slice, no
document, UI string, or release note may say or imply otherwise.
