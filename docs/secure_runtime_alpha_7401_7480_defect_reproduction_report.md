# Secure Runtime Alpha 7401–7480 — Phase A: Defect Reproduction Report

**FedOS Direct Conversation Route Binding and NIP-17 Inbound Isolation Arc.**

This report reproduces, independently of the prior disclosure (Secure
Runtime Alpha 7241–7320's `secure_runtime_alpha_7241_7320_multi_conversation_isolation.test.ts`
test 2), the defect this Arc exists to fix: two concurrent Direct
Conversations with the same peer are not correctly isolated by inbound
routing.

Two independent findings were made, at two different layers of this
codebase's inbound pipeline. Both share the exact same root cause.

## Finding 1 (live-reproduced, fresh, this Arc's own test): silent misrouting on the standard `nostr-nip17-v1` route

**Reproduced by**: `test/secure_runtime_alpha_7401_7480_route_binding_defect_reproduction.test.ts`
(new, this Arc — a fresh, independently-constructed real vertical slice:
two real profiles, a real local WebSocket relay, real WASM crypto, real
NIP-17 gift-wrap/seal/rumor framing, real inbound import through the
unmodified production pipeline). Also reconfirmed still live on this
Arc's own base commit (`194dc448`) by re-running the PRIOR arc's own test
unmodified — both pass, both prove the identical mechanism.

**Exact source path and selection rule**:

`src/conversation/delivery/nostr/fedos_private_nostr_inbound_conversation_resolver.ts`,
`resolveFedosPrivateNostrInboundDirectConversation()`:

```ts
for (const draft of deps.draftPersistence.listDrafts()) {
  if (draft.mode !== "direct") continue;
  ...
  if (keyResolution.outcome === "resolved" && keyResolution.publicKeyHex === senderPublicKeyHex) {
    return { outcome: "resolved", conversationId, counterpartyMembership: member };
  }
}
```

This resolves an inbound Rumor's target Conversation **solely** from the
sender's Nostr pubkey — the FIRST active `direct` draft (in
`listDrafts()`'s own iteration order, which is insertion order in every
persistence backend this codebase ships, both durable append-only and
in-memory) whose active counterparty membership carries that exact
pubkey. There is no cross-check against any Conversation-identifying fact
carried by the message itself.

`src/conversation/delivery/nostr/nip17/fedos_nip17_inbound_import_coordinator.ts`,
`FedosNip17InboundImportCoordinator.receiveRumor()` (the standard
`nostr-nip17-v1` route) calls the resolver above with only
`rumor.senderPublicKeyHex`, then imports directly under
`resolution.conversationId` — no cross-check exists anywhere in this file
against any binding in the Rumor. NIP-17's own `kind:14` Rumor `.content`
is arbitrary plaintext by design, and this codebase currently stores the
RAW plaintext there for this route — zero structured envelope, zero
Conversation-identifying field of any kind survives from sender intent to
inbound routing decision.

**Proven behavior**: Alice creates two real, concurrently-active Direct
conversations with Bob (A created first, B created second). Alice sends a
message specifically into B. The message never arrives in B — it is
imported into A (the first-created conversation with that peer) instead,
silently, with no error, no rejection, no ambiguity signal of any kind
surfaced anywhere. This is deterministic (not a race/coin-flip): as long
as A remains the first `listDrafts()` match for Bob's pubkey, every
inbound message from Bob lands in A regardless of the sender's own
intent, for as long as both conversations remain active.

## Finding 2 (source-traced, not freshly live-tested this session — disclosed methodology below): deterministic "wrong-conversation" rejection on the Direct-Ratchet-integration route

**Method**: rigorous, line-by-line source tracing of
`src/conversation/ratchet/fedos_direct_ratchet_inbound_integration.ts`
(`FedosDirectRatchetInboundIntegration`, Alpha 5561-5640), cross-referenced
against `src/conversation/ratchet/fedos_direct_ratchet_device_pair_resolver.ts`
(`resolveFedosDirectRatchetDevicePair()`, confirms `FedosDirectRatchetSessionId`
is derived from `(localAccountRef, localDeviceRef, remoteAccountRef,
remoteDeviceRef, conversationId, suite, generation)` — the session id
itself is bound to a specific Conversation). This is genuinely new
information beyond the prior report, which only disclosed Finding 1. A
live reproduction of this specific finding was not completed this
session (see the honest scope note below); the mechanism is nonetheless
real and traceable byte-for-byte through unmodified production source,
not inferred or speculative.

**Exact mechanism**:

`#receiveSessionInit()` (line ~200-208):

```ts
const resolution = resolveFedosPrivateNostrInboundDirectConversation(..., rumor.senderPublicKeyHex);
...
if (payload.conversationId !== conversationId) return { outcome: "wrong-conversation" };
```

`#receiveMessage()` (line ~372):

```ts
if ((sessionMetadata.binding.conversationId as unknown as string) !== resolution.conversationId) return { outcome: "wrong-conversation" };
```

Both handlers resolve `conversationId`/`resolution.conversationId` via
the SAME peer-pubkey-only resolver as Finding 1, THEN cross-check it
against the payload's own claimed `conversationId` (session-init) or the
session's own already-persisted ground-truth `binding.conversationId`
(message). Unlike Finding 1, this cross-check means the Ratchet route
never silently misroutes a message into the wrong conversation's history
— but because the resolver's first-match guess is used as one side of an
equality check rather than as a genuine lookup key, the outcome is a
**different** real defect: once Alice already has one active Direct
conversation with Bob (conversation A), a session-init or message
genuinely intended for a SECOND conversation with Bob (conversation B)
is REJECTED as `"wrong-conversation"` whenever the resolver's first-match
guess (deterministically A, since A was created first) does not equal
the payload's/session's own real, correct conversationId (B). This
manifests as: **a second Ratchet session with an already-conversing peer
can never even be established via the real inbound path**, since the
session-init itself is rejected before any session state is created —
not silent misrouting, but a real, deterministic availability/correctness
failure with the identical root cause (peer-identity-only resolution).

**Honest scope note**: reproducing this specific finding live requires
either (a) a full real Device-Pairing handshake between two different
accounts' Devices (this codebase's own `devicePairingCreate/Approve/Complete`
mechanism is same-account multi-device trust bootstrapping, not
peer-to-peer Device trust — a real, separate, undocumented gap in its own
right, noted here for completeness but out of this Arc's scope to close),
or (b) hand-constructing a `FedosDeviceRegistryPersistence` "trusted"
peer-Device binding directly via its own real `putEvent()` API and
driving `FedosDirectRatchetInboundIntegration` directly with in-memory
(real, non-mock) persistence ports for every one of its ~15 dependencies.
Both are legitimate, real-component constructions with no mocking of the
routing logic itself, but assembling either fully within this session's
own time budget was not completed. This finding is reported with full
source-path precision and is treated as equally load-bearing to Finding
1 for Phase C/D's own option evaluation (the chosen model must close
BOTH), but is flagged here, honestly, as source-traced rather than
freshly live-executed this session.

## Conclusion for Phase B/C/D

Both findings share one root cause: **inbound Conversation routing is
resolved from peer identity alone, with no unambiguous, authenticated
binding to a specific Conversation or session carried by (or derivable
from) the message itself.** The fix must supply that binding at the
layer both routes share (the encrypted Rumor payload), authenticated,
never relay-visible, versioned, and fail-closed on ambiguity — see the
Option Review and Normative Decision documents.
