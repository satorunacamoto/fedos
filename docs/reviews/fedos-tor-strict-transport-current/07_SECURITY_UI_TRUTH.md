# Security UI Truth Model

## New, separate axis — never folded into a global "Secure" boolean

Mirrors the already-shipped `deriveConversationSecurityState()`'s own
"six independent axes, no global Verified boolean" discipline (mandate §28
explicitly invokes this precedent). Tor transport state is exposed as its
own field, never merged into `FedosConversationSecurityState`'s existing
six axes (which are per-conversation; Tor state is process-wide/transport-
level, a different shape entirely — reported at the Settings/connection
level, not per-conversation).

## Vocabulary (mirrors mandate §27's own suggestion, adapted to this arc's actual states)

```
Tor transport:  Off | Starting | Ready | Unavailable
Strict routing: Enabled | Disabled
```

`Unavailable` covers both DEGRADED and FAILED_CLOSED for user-facing
purposes (the distinction matters internally for retry/re-probe logic, not
for the two-sentence status line a user sees) — Advanced details may show
the more precise internal state.

## Copy

> "When strict Tor routing is enabled, network activity is blocked until
> the Tor transport is ready."

Literally true given this arc's implementation (§7 of
`03_STRICT_TRANSPORT_ARCHITECTURE.md`'s fail-closed invariant) — kept as
the exact suggested wording since it is accurate.

Settings enable-flow copy (§29 of the mandate):
> "Strict Tor routing blocks all network activity until Tor is ready.
> Tor does not verify who you are. Tor does not guarantee anonymity.
> Local and offline features keep working normally."

No forbidden words used (checked against §27's list: Anonymous, Hidden,
Untraceable, Private mode — none appear).

## Forward Secrecy independence (mandate §21)

Explicitly NOT coupled: `getDirectRatchetLiveVerification()`/
`deriveConversationSecurityState()`'s Forward Secrecy axis reads only
Ratchet session/counter state (already true, unchanged by this arc —
confirmed by inspection, no import of anything Tor-related in
`fedos_direct_ratchet_conversation_runtime.ts` or
`fedos_conversation_security_state.ts`). Tor being READY never upgrades
Forward Secrecy to GOOD; Ratchet being ACTIVE never upgrades Tor transport
to Ready. Two fully independent reads.
