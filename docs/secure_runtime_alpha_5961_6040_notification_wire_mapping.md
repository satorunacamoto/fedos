# Secure Runtime Alpha 5961–6040 — Notification / Wire Mapping Reference

## Transport

No new Nostr kind. The notification rides the EXISTING
`"nostr-nip17-v1"` Gift Wrap route through
`FedosPrivateTransport.sendMailboxNip17Control(controlId, conversationId,
plaintext, createdAt)` — the identical seam the peer-capability
advertisement/lifecycle-notification traffic already uses.

`plaintext` is the JSON encoding of a
`FedosRatchetPeerCapabilityControlPayloadV1` with the new third `kind`:

```ts
{ schemaVersion: 1, kind: "identity-transition-notification", notification: FedosIdentityTransitionNotificationV1 }
```

`controlId` = the notification's own `notificationId`, reused verbatim
(stable logical id — exact-event retry never mints a second logical
send, matching the lifecycle-notification convention).

## `FedosIdentityTransitionNotificationV1`

| Field | Source | Notes |
|---|---|---|
| `schemaVersion` | fixed `1` | |
| `notificationId` | caller | the Outbox `controlId` |
| `transitionId`, `oldAccountIdentity`, `newAccountIdentity`, `oldNostrIdentity`, `newNostrIdentity`, `revision`, `previousTransitionId` | copied from the `FedosIdentityTransitionRecordV1` | |
| `reasonCategory` | copied from the transition record | not in this Arc's own literal Phase B field list, added because correct receiver-side compromise-reason gating is impossible without it |
| `transitionBodyHash` | `fedosIdentityTransitionBodyHash(record)` | receiver recomputes an equivalent record and checks this matches before trusting anything else |
| `senderAccountRef`/`senderDeviceRef` | local (sender) identity | verified against the account authorization's own cryptographically-recovered pubkey, never trusted blind |
| `recipientAccountRef`/`recipientDeviceRef` | caller | checked against the receiver's own local identity |
| `issuedAt`/`expiresAt` | **copied VERBATIM from the transition record** | NOT a fresh send-time timestamp — see the outbound coordinator's own header for why (this is what lets the receiver reconstruct byte-identical canonical bytes) |
| `nonce` | fresh CSPRNG, 32 hex chars | |
| `evidence.newKeyProof` | real `FedosIdentityTransitionNewKeyProofV1` | always required |
| `evidence.continuityEvidence` | real `FedosIdentityTransitionContinuityEvidenceV1`, or `null` | `null` when the sender has none (e.g. `identity-lost`) |
| `evidence.deviceCorroborations` | bounded array (≤ 4) | informational only on the receiving side — see below |
| `accountAuthorization` | `FedosRatchetPeerCapabilityAccountAuthorizationV1` (REUSED type) | a fixed kind-1 Nostr event, tag `["t","fedos-ratchet-peer-capability-v1"]`, `content` = this notification's own canonical bytes |
| `deviceSignatureHex` | optional | best-effort Device-level signature over the same canonical bytes, domain-prefixed `fedos-identity-transition-notification-device-v1:` |
| `capabilityVersion` | fixed `1` | |

## Canonical bytes

`fedos:identity-transition-notification:v1` is the fixed domain tag,
first element of a `JSON.stringify([...])` fixed-order array covering
every signable-content field (see
`canonicalSerializeFedosIdentityTransitionNotificationContent()`). The
evidence artifacts are serialized as their own fixed-order sub-arrays
inside this same tuple — never object-property iteration anywhere.

## Receiver-side reconstruction

`reconstructFedosIdentityTransitionRecordFromNotification()` rebuilds a
`FedosIdentityTransitionRecordV1` from the notification's own declared
fields (fixing `devicePolicy`/`ratchetPolicy`/`capabilityVersion` to
their only supported values) and returns `null` if the rebuilt record's
own `bodyHash` disagrees with the notification's declared
`transitionBodyHash` — the ONE integrity check that must pass before any
evidence verification is attempted.

## Known, disclosed limitation: Device corroboration on the receiving side

`verifyFedosIdentityTransitionDeviceCorroboration()` (Foundation, Phase
H) requires a `FedosDeviceBindingV1` to confirm the corroborating
Device is `"trusted"` and not revoked — state that lives ONLY in the
SENDER's own local Device Registry, never transmitted. The Inbound
Notification Coordinator therefore treats embedded `deviceCorroborations`
as informational only: `deviceCorroborationStatuses` is always `[]` when
calling the evidence evaluator on the receiving side. A future Arc could
add a real cross-account Device attestation transport; this Arc does not
fabricate one.
