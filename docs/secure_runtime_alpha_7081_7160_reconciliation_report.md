# Secure Runtime Alpha 7081–7160 — Reconciliation Report

**FedOS Conversation Invitation and Shared Conversation Foundation Arc.**
Written before source edits, per established process. Grounded in direct
source inspection of the base commit (`e43cf67a`).

## The real gap (confirmed, not assumed)

`FedosDesktopApplicationShell.redeemInvitation()` is unconditionally
`"unavailable"` because `assembleFedosConversationRuntimeDependencies()`
never constructs a `FedosConversationCapabilityRedemptionAuthority`. But
inspecting the EXISTING Capability/Invitation system
(`src/conversation/capability/`, `src/conversation/invitation/fedos_conversation_invitation_transport.ts`,
Alpha 991-1050) reveals a deeper, structural reason wiring it up would
not be sufficient on its own: `PersistedFedosConversationCapabilityAuthority.redeem()`
looks up `this.#persistence.getCapability(request.capabilityId)` in the
REDEEMER's own local persistence. For two genuinely independent,
separately-provisioned real profiles (no shared backend — confirmed
throughout this repository's own architecture), the redeemer's local
capability store never independently learns about a capability the
issuer created in her own separate store. The existing system was built
and is only ever exercised (Alpha 5561-5640's own real vertical slice)
against a SHARED in-memory backend — it has no cross-profile transport
leg at all.

A second, independent circular dependency was found: `FedosConversationTransportRouting.resolveFedosConversationTransportRoute()`
(`src/conversation/transport/fedos_conversation_transport_routing.ts:60-98`)
requires EXACTLY 2 `"active"` local memberships for a conversationId
before ANY NIP-17 send (control or user message) can be routed. This
means the inviter cannot send the FIRST invitation message through the
real transport until the invitee is already an active local member — but
the invitee only becomes a member by receiving and accepting an
invitation. Breaking this requires the inviter to admit the invitee's
membership LOCALLY (on her own side only) at invitation-creation time,
before any acceptance is known — the "optimistic admission" this Arc
adopts (see design decision below).

## Reused, not redesigned (existing, unmodified machinery)

- `FedosConversationMembershipAuthority.admit(conversationId, participant, role, now)`
  (`src/conversation/membership/fedos_conversation_membership_authority.ts:47-52`)
  — idempotent, real, unmodified.
- `FedosConversationRuntime.reactivateRestoredConversation(conversationId)`
  (`src/conversation/runtime/fedos_conversation_runtime.ts:1090-1091`,
  delegating to `FedosConversationReactivationCoordinator`, Alpha
  2041-2120) — ALREADY deterministically reconstructs a local Draft
  record from already-admitted Membership facts alone (the owner
  Membership supplies `creator`/`createdAt`) and then activates it via
  the unmodified `FedosConversationDirectActivationCoordinator`. This is
  the EXACT "Conversation bootstrap" mechanism this Arc's own mission
  names — reused verbatim, not reinvented, on BOTH sides of the
  invitation exchange.
- The real cross-peer signed-control-message pattern Peer Capability
  already established (Alpha 5721-5800):
  `sendMailboxNip17Control(controlId, conversationId, plaintext, createdAt)`
  for outbound, `receiveNip17Rumor()`'s dispatch chain
  (`fedos_conversation_runtime.ts:1367-1433`) for inbound, and an
  explicit account-level Nostr signature (fixed kind-1 event, domain-
  separated content, verified via real BIP-340 Schnorr
  `NobleSignatureVerifier`) — NOT reliance on Gift-Wrap/Seal alone (a
  NIP-59 Rumor is deliberately unauthenticated). This Arc mirrors that
  EXACT authentication idiom for its own new record kind, with its own
  distinct domain string, so a signature can never be replayed across
  record kinds.
- `toFedosPrivateConversationId("direct", requestId)` (`src/conversation/construction/fedos_private_conversation_id.ts:46-48`)
  and `FedosSecureRandomConstructionIdGenerator` (real CSPRNG, 16 bytes)
  — reused verbatim for minting the invitation's own conversationId.

## Design decision: optimistic local membership admission

The inviter admits BOTH parties' memberships locally (herself as
`"owner"`, the invitee as `"member"`) at invitation-creation time, before
any acceptance is known — solving the circular route-resolution
dependency above using only the existing `admit()` primitive, no new
Membership state/vocabulary. This is local-only bookkeeping (never
shared, never implies the invitee has agreed to anything) and mirrors
how many real messaging apps show a pending contact immediately after
sending an invite. The invitee, symmetrically, admits both memberships
locally upon receiving and verifying the real signed invitation. Neither
side needs the other's local store to be reachable at any point.

## What this Arc does NOT touch

- The existing Capability/Invitation Transport system
  (`src/conversation/capability/`, `src/conversation/invitation/fedos_conversation_invitation_transport.ts`)
  remains fully intact, unmodified, for any future shared-backend use
  case — this Arc's own new mechanism is additive and parallel, never a
  replacement.
- Direct Ratchet, Identity Transition, Signed Deletion — zero source
  files under those domains are touched.
- The Rust/WASM crypto core — this Arc needs no new cryptographic
  primitive; account-level signing reuses the existing `FedosNostrSigningAuthority.signEvent()`/`NobleSignatureVerifier`
  path, byte-for-byte the same one Peer Capability already uses.

## Scope for this Arc's own new files

Mirrors `src/conversation/ratchet/peer_capability/`'s own file
organization, narrowed to what a single one-time invitation (not an
ongoing, revisable advertisement) actually needs: advertisement content +
codec, authentication, control-payload wire wrapper, inbound coordinator
(the mission's own "Acceptance Coordinator"), outbound coordinator, and
one new durable append-only persistence class for the received-invitation
record (restart-safety/idempotent-duplicate-delivery, mirroring
`AppendOnlyFedosRatchetPeerCapabilityObservationPersistence`'s own
convention exactly).
