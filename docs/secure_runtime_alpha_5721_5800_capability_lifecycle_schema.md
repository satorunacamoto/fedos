# Secure Runtime Alpha 5721–5800 — Capability / Lifecycle Schema

## Closed vocabulary (Phase B)

`fedos_ratchet_peer_capability_vocabulary.ts`:

- **Private-message route** — `FedosRatchetPeerCapabilityRoute`, a type
  ALIAS of the live `FedosPrivateWireRouteRequest`
  (`"fedos-private-v1" | "nostr-nip17-v1" | "nostr-nip17-v1-ratchet"`).
  Never redefined; imported.
- **Ratchet suite** — `FedosRatchetPeerCapabilitySuite`, a type alias of
  the live `FedosDirectRatchetSuite` (today: only `"fedos-direct-ratchet-v1"`).
- **Lifecycle capability** — `FedosRatchetLifecycleCapabilityId`:
  `"device-notification-v1" | "session-initialization-v1" |
  "authenticated-session-reset-v1" | "capability-advertisement-v1"`.
- **Capability entry** — `FedosRatchetPeerCapabilityEntry`, a closed
  discriminated union of exactly the three kinds above
  (`private-message-route` / `ratchet-suite` / `lifecycle-capability`),
  each with an exact field set. `FEDOS_RATCHET_PEER_CAPABILITY_MAX_ENTRIES = 16`.

Unknown values fail closed at every `isKnownFedosRatchet*`/`isWellFormed*`
predicate — never silently coerced or ignored.

## Peer Capability Advertisement (Phase C)

`FedosRatchetPeerCapabilityAdvertisementV1`:

```
schemaVersion: 1
senderAccountRef / senderDeviceRef
recipientAccountRef / recipientDeviceRef
conversationId
revision: number                 -- monotonic per (sender, recipient) subject
capabilities: entry[]             -- bounded, MAX 16
issuedAt / expiresAt
nonce                             -- 128-bit hex, replay identity
accountAuthorization              -- real kind-1 Nostr event (Phase E)
deviceSignatureHex: string | null -- OPTIONAL, best-effort (Phase E)
```

Canonical serialization is a fixed-order JSON array tuple (never an
object — no key-ordering ambiguity), prefixed with the fixed domain string
`"fedos-ratchet-peer-capability-advertisement-v1"` so a signature over this
content can never be replayed as authenticating a lifecycle notification,
a Session Reset, or a Device Binding challenge. Structural validation is
exact-field-set and total/never-throwing; unknown/extra fields fail
closed.

No private keys, root/chain/message keys, sealed-record references, local
paths, Runtime handles, or unbounded arrays are ever included.

## Device Lifecycle Notification (Phase D)

`FedosRatchetPeerLifecycleNotificationV1`:

```
schemaVersion: 1
notificationId          -- stable logical id, reused as the Outbox controlId
issuerAccountRef / issuerDeviceRef
targetAccountRef / targetDeviceRef
affectedDeviceRef        -- the Device the fact is ABOUT (may differ from issuer)
fact: FedosRatchetPeerLifecycleFact
revision                 -- independent counter from the advertisement's own
issuedAt / expiresAt
nonce
supersedesNotificationId: string | null
accountAuthorization / deviceSignatureHex (identical scheme to the advertisement, distinct domain string)
```

Six closed fact kinds, only the ones Phase A confirmed real source
supports:

| Kind | Extra field | Real source it maps to |
|---|---|---|
| `device-added` | — | A new, trusted `FedosDeviceBindingV1`. |
| `device-revoked` | — | `FedosDeviceTrustState === "revoked"` (terminal). |
| `device-replaced` | `newDeviceRef` | `FedosDeviceReplacementCoordinator`'s register-then-revoke flow. |
| `ratchet-session-reset-required` | `reason: FedosDirectRatchetSessionResetReason \| null` | ADVISORY only — reuses the Foundation Arc's own closed reason enum verbatim; never itself resets a session. |
| `ratchet-session-generation-advanced` | `newGeneration: number` | The existing `generation` concept on `FedosDirectRatchetSessionId`. |
| `capability-superseded` | `supersededRevision: number` | A peer's own prior Advertisement revision no longer current. |

`device-key-updated` is deliberately NOT a seventh kind — see the
execution spec's "Deliberately not implemented" section.

## Signature and trust boundary (Phase E)

Account-level: a real, fixed kind-1 Nostr event
(`FEDOS_RATCHET_PEER_CAPABILITY_NOSTR_TAG = ["t", "fedos-ratchet-peer-capability-v1"]`),
signed via the existing, unwidened `FedosNostrSigningAuthority`, verified
via the existing `NobleSignatureVerifier` (real BIP-340 Schnorr). The
signer's public key is read ONLY from the verified `event.pubkey`, then
bound to the claimed `senderAccountRef`/`issuerAccountRef` by the Inbound
Coordinator — a valid signature from a DIFFERENT real account is a hard
`"bad-account-signature"` rejection, never accepted as "some" evidence.

Device-level: optional, best-effort, reusing the exact
`FedosDeviceSigningKeypair` pattern the Session Reset Foundation
established — never a hard requirement (no durable Device-key storage
exists in this codebase). Three distinct evidence states, never silently
collapsed:

- `"account-and-device-authenticated"` — a `devicePublicKeyRef` is on file
  AND a Device signature was supplied AND it verified.
- `"account-authenticated"` — a `devicePublicKeyRef` is on file but no
  Device signature was supplied this time.
- `"account-authenticated-device-proof-unavailable"` — no
  `devicePublicKeyRef` is on file at all (today's common case).

A present-but-MISMATCHED Device signature is a hard `"bad-device-proof"`
rejection, never one of these three evidence levels.

## Durable Observation (Phase I)

`FedosRatchetPeerCapabilityObservationV1` — one row per
`(localDeviceRef, peerAccountRef, peerDeviceRef, sourceKind, sourceId)`:
`revision`, `evidenceLevel`, `acceptanceOutcome`, `supersededSourceId`,
`observedAt`/`expiresAt`, `claimedRoutes` (non-secret, needed for
restart-safe downgrade detection), `factKind` (`null` for an
advertisement — needed so a restart/replay can still recompute the
correct session-action recommendation for a lifecycle fact). No secrets,
no signatures, no raw payload beyond these closed, non-secret fields.
In-memory and append-only-NDJSON implementations, both fail-closed on a
corrupt line or an irreconcilable duplicate key.

## Acceptance outcome vocabulary (Phase J)

13 closed values, never a boolean:
`accepted | observed-not-accepted | unsupported | expired | stale |
conflicting | untrusted-device | revoked-device | peer-incompatible |
downgrade-detected | session-initialization-required |
session-reset-required | unavailable`.

## Safe status (Phase O)

10 closed values: `unknown | observed | compatible |
initialization-required | reset-required | stale | conflicting | revoked |
unsupported | unavailable`. `"trusted"` is never a value.
