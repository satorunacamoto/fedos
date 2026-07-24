# Secure Runtime Alpha 7801–7880 — Archive vs. Live Ratchet Truth

**FedOS Direct Conversation Archive Product Completion and Parallel-Lineage Integration Arc — Phase F.**

## What a Direct Conversation Archive restores

- **Conversation history**: every already-persisted Envelope/Payload
  (subject to Retention/Suppression parity, unchanged from `feff676a`/
  `e048ff63`).
- **The Conversation's own identity fact**: its `FedosConversationDraftRecord`
  (id, mode, policyReference, creator, createdAt) — written via
  `draftPersistence.putDraft()`.
- **Membership/Capability facts**, exactly as for a Board Conversation.
- **Tombstones/redactions/safe metadata**, per the existing Retention/
  Suppression policy — unchanged.

## What it does NOT, and never will, restore

- **No live Ratchet root key, chain key, message key, or skipped key of
  any kind.** The Archive bundle carries no Ratchet session field at
  all — confirmed structurally (Phase L guard) — and this Arc adds none.
- **No Activation fact.** Restore writes ONLY the draft record via
  `draftPersistence.putDraft()` — it deliberately never calls
  `activationPersistence.putActivationFact()`. This is the single most
  important design decision in this Phase: **restoring an Archive never
  silently re-activates a Conversation or establishes a live Ratchet
  session as a side effect.**
- **No SecretHandle, Master Seed, or Device private key** of any kind —
  unchanged from every prior Arc's own identical guarantee.

## Why this matters: history recovery vs. live-session recovery are separate

`resolveFedosConversationActiveConversation()` (Alpha 1116/1160,
unmodified) requires BOTH a draft record AND a completed Activation
fact before reporting `"active"`. A freshly-restored Direct Conversation
therefore has its own real history immediately visible and inspectable
(`findConversation()`, message read, Search reindex once reconciled) —
but `resolveActiveConversation()` correctly reports `"not-active"` until
a real, independent activation/session-establishment flow completes
again, through the SAME normal path any brand-new Conversation would use
(Device Pairing / Ratchet session establishment / NIP-17 handshake, per
whatever this account's own real transport requires) — never derived
from, or granted by, the Archive's own bundled history.

**Concretely**: after restore, a caller CAN read every historical
message the Archive carried. A caller CANNOT send a new message until
they go through the real activation flow again — attempting to do so
hits the exact same `resolveActiveConversation()` gate
(`"not-active"`/`"not-found"`) any never-activated draft already does,
proven directly in the Phase J vertical slice.

## Why this is the correct, safe design (not merely the convenient one)

A Ratchet session's own forward-secrecy/post-compromise-security
guarantees depend on session state that is NEVER exported into the
Archive in the first place (there is nothing to "restore" even if this
Arc wanted to) — and even if it somehow were, silently reviving a live
session from cold, archived state would defeat the entire point of a
ratchet (an attacker who ever obtained one Archive file could otherwise
replay/desynchronize a real, ongoing session). Keeping "the history is
back" and "the session is live" as two, independently-gated facts is
not a limitation this Arc works around — it is the intended security
boundary, restated plainly for a real Direct Conversation exactly as it
already, silently, correctly applied to every Group Conversation this
codebase has restored since Alpha 1921–1980 (`FedosGroupGenerationAuthority`'s
own session material is, identically, never exported).

## UX/documentation statement (for Safety Center / any future renderer)

> Restoring an Archive brings back your message history. It does not
> reconnect a live conversation by itself — sending a new message may
> require re-establishing the conversation first, exactly like starting
> a new one.
