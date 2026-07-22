# 12 — Ratchet Session Transition

## Decision (the strong default, adopted as-is)

**Identity rotation/replacement terminates every active Direct Ratchet
session bound to the old identity and requires new, authenticated
Device-pair sessions under the new identity.** No exception.

## Why, precisely, given real source

`FedosDirectRatchetSessionId`/`FedosDirectRatchetSessionBinding` bake the
account's own Nostr `publicIdentifier` directly into the session's
identity (`accountRefToSessionIdComponent()`,
`fedos_direct_ratchet_device_pair_resolver.ts:139-143` — a truncated hex
slice of the account pubkey itself, not an indirection). Once the
account identity changes, this component permanently changes too — there
is no code path, and this review does not create one, that re-derives an
EXISTING session's id/binding under a new account reference. `01`/`05`
already prove no such re-keying mechanism exists. Attempting to "rebind"
an existing session's root/chain keys to a new identity would mean
reusing DH-derived secret material across two different identity
contexts with no cryptographic justification — this review explicitly
forbids it.

## Whether all sessions become reset-required

Yes, unconditionally, for every session where `localAccountRef` or
`remoteAccountRef` equals the identity being replaced. This reuses
`f80889d`'s own live `"reset-required"` lifecycle state (terminal-except-to-`"revoked"`,
`fedos_direct_ratchet_session_lifecycle.ts:36-44`) and its own
`FedosDirectRatchetResetCoordinator.applyDeviceRevocation()`-style sweep
pattern (`fedos_direct_ratchet_reset_coordinator.ts:123-131`) — a future
Implementation Arc adds an analogous `applyIdentityTransitionToSessions()`
sweep, reusing the SAME transition-to-`"reset-required"` mechanism, never
inventing a new terminal state for this. One new, additive
`FedosDirectRatchetSessionResetReason` value is required
(`"identity-transition"` or similar) since the current 4-value vocabulary
explicitly excludes it (`fedos_direct_ratchet_session_reset_reason.ts:14-16`)
— this review names the gap; it does not close it.

## Whether a new session generation is enough

No. A "new generation" (the existing `generation` increment mechanic) is
the RIGHT primitive for the same Device pair to reset a session under the
SAME account identity (already live, `f80889d`). It is insufficient here
because the whole POINT of this transition is that `localAccountRef`/
`remoteAccountRef` themselves change — that is a new session identity by
definition (`fedos_direct_ratchet_session_id.ts`'s own 8-segment id
includes the account references), not merely a new generation of the same
one.

## Old session state and historical readability

Old sealed secrets remain on disk, unmodified, per `f80889d`'s own
absolute prohibition against ever deleting sealed records. They remain
readable ONLY for decrypting already-received historical plaintext
locally (via Archive, `14`) — never reused to derive new message keys,
never reactivated by any future action, including Archive Restore.

## Pending Outbox events and late messages from the old identity

Any Outbox entry still queued under the old identity's own signing
authority is either (a) sent and rejected/ignored by the recipient once
the recipient has accepted the transition (since the recipient will
treat the old identity's Device pair as `"revoked"`/`"reset-required"`),
or (b) never sent at all if the old Master Seed is no longer held. A late
message that arrives claiming to be from the OLD identity, after a
transition has been locally accepted, is evaluated by the EXISTING,
unmodified inbound pipeline against the OLD session's own (now
`"reset-required"`) state — it is not silently decrypted or trusted;
the existing fail-closed session-state checks already handle this
without any new code, because `"reset-required"` already denies new
session-establishment attempts from that Device pair (`f80889d`).

## Peer capability state and skipped keys

Every `FedosRatchetPeerCapabilityObservationV1` keyed to the OLD
`peerAccountRef` remains, immutably, exactly as recorded — it is
historical evidence about a peer identity that no longer represents the
current holder. It is never deleted, never rewritten, and never silently
merged with observations about the NEW identity (`10`, `17`). Skipped
message keys bound to the old session generation do not survive into any
new session — they are session-scoped secrets with no meaning outside
the terminated session, and the existing sealed-secret persistence layer
already never carries them forward across a `"reset-required"`
transition (unchanged behavior, `f80889d`).

## Device-pair session rebuild

Exactly the same authenticated establishment flow used today
(`initializeDirectRatchetSession()`) — under the NEW account identity,
for each rebound Device pair (`11`) — generation 0, fresh ephemeral DH
keypair, no inherited state. No new cryptographic mechanism is required;
only the trigger (identity transition, rather than a Device replacement
or a corrupt-state reason) is new, and it is modeled as a new reset
reason, not a new reset mechanism.
