# Secure Runtime Alpha 5641–5720 — Request and Acknowledgement Schema

Both schemas below are `schemaVersion: 1`. Unknown fields fail closed
(exact property-count validation). Neither is ever transmitted by this
Arc — this document specifies the wire shape a future transport-integration
Arc carries verbatim.

## `FedosDeletionRequestRecordV1`

```
{
  schemaVersion: 1,
  requestId: string,                 // 64 lowercase hex chars (256-bit random)
  requesterAccountRef: string,       // opaque, ≤256 chars, no path characters
  requesterDeviceRef: string | null, // opaque, advisory only -- no real Device key exists
  recipientAccountRef: string,
  recipientDeviceRef: string | null,
  conversationId: string,            // opaque FedosConversationId shape
  targetEnvelopeId: string,          // opaque FedosConversationEnvelopeId shape
  scope: "local-history" | "local-history-and-index",
  issuedAt: number,                  // Unix seconds, non-negative integer
  expiresAt: number,                 // Unix seconds, > issuedAt, ≤ issuedAt + 14 days
  nonce: string,                     // 32 lowercase hex chars (128-bit random)
  capabilityVersion: 1,
  reasonCode: "sent-in-error" | "content-correction" | "privacy" | "other" | null,
}
```

Canonical bytes: UTF-8 of the fixed-field-order string above (exact key
order as listed), each string value `JSON.stringify`-escaped, each
integer emitted as a plain decimal literal. This string becomes the
`content` of a real, `kind: 1` Nostr event signed by the requester's own
real account authority (`FedosNostrSigningAuthority`) — the event's own
`id`/`pubkey`/`sig`/`created_at` ARE this request's signature metadata;
no separate signature field exists on the record itself.

**Deliberately absent, by design**: `targetType` (fixed to one implicit
value, `"direct-message"` — no field needed), any Group/attachment/
wildcard-shaped field, any raw filesystem path, any free-form command,
any arbitrary JSON policy object, any secret or plaintext.

## `FedosDeletionAcknowledgementRecordV1`

```
{
  schemaVersion: 1,
  requestId: string,                 // correlates to the original request
  recipientAccountRef: string,
  recipientDeviceRef: string | null, // advisory only, same limits as the request
  outcome: "accepted-pending" | "applied-local-history" | "applied-local-history-and-index"
         | "applied-partial" | "rejected-policy" | "unauthorized" | "unsupported-scope"
         | "expired" | "invalid" | "failed",
  appliedScopes: ("local-history" | "local-index")[],   // max 2 entries
  retainedScopes: ("local-history" | "local-index")[],  // max 2 entries
  evidenceClass: "none" | "local-observed" | "local-verified" | "unverifiable", // b3b3a6d's own vocabulary, reused verbatim
  acknowledgedAt: number,
  protocolVersion: 1,
}
```

Canonical bytes and signing mirror the request exactly (same fixed-order
encoding discipline, same real signing/verification chain, signed by the
RECIPIENT's own account authority).

**Honesty guard** (`isFedosDeletionAcknowledgementRecordHonest`): an
`"applied-*"` outcome requires a non-empty `appliedScopes`; every other
outcome requires an empty one — a caller cannot claim partial or full
application without actually reporting what applied, and cannot claim
zero application while listing applied scopes.

**Never present**: a local absolute path, a backup name, a "physical
erasure" evidence level (the vocabulary has none), or an "account-wide"/
"deleted-everywhere" outcome value (the vocabulary has neither).

## Durable state (three independent domains, keyed by `requestId`)

| Domain | Shape | Write discipline |
|---|---|---|
| Outbound request state | `FedosPersistedDeletionRequestStateRecordV1` (`bodyHash`, `lifecycleState`, `retryCount`, `acknowledgementCorrelationId`, …) | Append-only, monotonic-transition-validated; `"draft"` is the only valid initial state |
| Recipient decision state | `FedosPersistedDeletionRecipientDecisionRecordV1` (`decisionState`, `suppliedLocalOutcome`) | Same discipline; `"received"` is the only valid initial state |
| Acknowledgement fact | `FedosPersistedDeletionAcknowledgementRecordV1` (wraps the acknowledgement + its own real signing event id) | Insert-once per `requestId`, mirrors `b3b3a6d`'s own execution record exactly |

Every domain has both an in-memory and a real append-only NDJSON backend;
both share ONE write-decision function (`evaluateFedosDeletionRequestStateWrite`
/ `evaluateFedosDeletionRecipientDecisionWrite`) so the transition rule
can never drift between backends. A corrupt or hand-edited log line — or
one recording an invalid transition — throws on the next read; never
silently skipped or merged.
