# Secure Runtime Alpha 5721–5800 — Phase A Reconciliation Report

FedOS Ratchet Peer Notification and Capability Advertisement Arc. Base:
`f80889d` (FedOS Ratchet Device Lifecycle and Authenticated Session Reset
Foundation Arc), itself on `b8e9e06`/`cb50866`/`f4948a6`/`080cb99`/`be1bc0d`.

This report is read-only source inventory. No production file is edited
until this report exists, per this Arc's own brief.

## Alpha range reconciliation

Historical duplicate confirmed: `5401-5480` was used twice (`be1bc0d`
"FedOS Direct Ratchet State and Sealed Persistence Foundation Arc" and
`b3b3a6d` "FedOS Local Deletion Capability and Deletion-State Foundation
Arc" — two unrelated Arcs, same number, never renumbered).

Ranges already used after it, confirmed via `git log --oneline --all`:
`5481-5560` (`080cb99`), `5561-5640` (`b8e9e06` + its own `cb50866`
reconciliation report), `5641-5720` (`22f9277`, FedOS Signed Recipient
Deletion Request — explicitly **not** to be touched or merged by this
Arc). `f80889d` itself was committed **without** an Alpha number in its
own README blurb or doc filenames (confirmed: no `Alpha \d+` string
appears in its README diff; its docs/tests use bare
`fedos_ratchet_device_lifecycle_session_reset_*` names) — it is treated
as unnumbered, not as an occupant of any range.

Highest numbered range found across all branches: `5641-5720`. **This
Arc uses `5721-5800`** — the next genuinely unused range, consistent with
the repo's own span-80 cadence for recent arcs. Alpha numbers are
documentation labels only, not ancestry truth, per this Arc's own brief.

## Inventory (grouped by the brief's own checklist)

### Live Direct Ratchet route vocabulary
`src/conversation/transport/fedos_private_wire_route.ts:53-59` —
`FedosPrivateWireRouteRequest = "fedos-private-v1" | "nostr-nip17-v1" |
"nostr-nip17-v1-ratchet"`, closed, explicitly additive-extensible only
via a future reviewed change. `src/conversation/ratchet/fedos_direct_ratchet_route_resolution.ts:62-66`
adds the ratchet-specific decision layer over the same vocabulary
(`FedosDirectRatchetRouteDecision`, 15 closed unsupported-reasons).

### Ratchet suite/version vocabulary
`src/conversation/ratchet/fedos_direct_ratchet_session_id.ts:55,57` —
`FedosDirectRatchetSuite = "fedos-direct-ratchet-v1"` is the **only**
live suite value; the comment at line 54 reserves widening this union to
a future, separate, explicit review. This Arc reuses it verbatim, never
widens it.

### Ratchet readiness states
`fedos_direct_ratchet_readiness.ts` (24 lines, read in full) — internal,
narrower than the user-safe status: `"ready" | "sealing-authority-unavailable"
| "session-not-found" | "session-not-active" | "runtime-stopped"`.

### Device Registry / Device Trust facts
`src/device/fedos_device_binding.ts:36-66` — `FedosDeviceTrustState =
"pending"|"trusted"|"revoked"|"unavailable"`, `"revoked"` terminal (no
outgoing transition). Predicates `isFedosDeviceBindingTrusted`/
`isFedosDeviceBindingRevoked` confirmed exact (`:135-141`). No per-account
device-count limit exists anywhere in `src/device/` (grepped
`max.*device|device.*limit` — only unrelated Sync-scheduler batching caps
matched).

### Device pairing/replacement/revocation facts
`FedosDeviceBindingRegistrationAuthority.registerDevice()` requires BOTH
a real Nostr-signed account authorization AND a real Device
proof-of-possession, independently verified
(`src/device/binding_challenge/fedos_device_binding_registration_authority.ts:159-176`).
`revokeDevice()` only ever flips `trustState` to `"revoked"` and stamps
`revokedAt` — never deletes the append-only record, never reversible; a
revoked `deviceId` can never re-register (`:308-319`).
`FedosDeviceReplacementCoordinator.replaceDevice()`
(`src/device/fedos_device_replacement_coordinator.ts:73-109`) is strictly
register-then-revoke; the new Device is always a brand-new `deviceId`,
never inherits the old key or session (`:87-89` guard). The replacement
link record is purely informational audit — "grants no capability"
(header) — nothing reads it to authorize the new Device.

### Authenticated Session Reset schema
`fedos_direct_ratchet_session_reset_authentication.ts` signs/verifies a
fixed, domain-separated preimage
(`"fedos-direct-ratchet-session-reset-v1:"` + a fixed-order JSON tuple)
with the existing `FedosDeviceSigningKeypair`. Verification in
`fedos_direct_ratchet_session_reset_authority.ts:93` is explicitly
**best-effort**: only runs when both `deviceSignatureHex !== null` AND
`senderDeviceBinding.devicePublicKeyRef !== null`; absence of either
silently skips the check — never a hard requirement. The durable reset
record (`fedos_direct_ratchet_session_reset_record.ts:32-48`) is keyed by
`nonce` alone and serves as both audit trail and replay ledger. The reset
reason vocabulary (`fedos_direct_ratchet_session_reset_reason.ts:19-23`)
is closed to 4 values and **deliberately excludes**
`"peer-requested"`/`"device-replacement"`/`"device-revocation"` — device
lifecycle facts are explicitly not modeled as reset reasons in the
existing schema, confirming this Arc's own facts need a **new**, separate
vocabulary, never a widening of this one.

### Local Device-signature reality
Confirmed unchanged since the prior review
([[project_ratchet_multidevice_identity_rotation_v1_review]]): durable
Device-key storage still does not exist anywhere in this codebase
(`fedos_device_signing_keypair.ts` header, reconfirmed at this HEAD) — the
keypair is process-memory-only, passed per-call, never held by a
long-lived Runtime. Any Device-level signature this Arc produces must
follow the identical "optional, best-effort, per-call keypair" discipline
already established by the Reset Foundation Arc — never fabricate durable
Device-key storage.

### Account-signing authority
Real BIP-340 Schnorr over secp256k1, not a placeholder.
`fedos_device_binding_account_authorization.ts` demonstrates the reusable
pattern this Arc follows: a fixed kind-1 Nostr event, domain-separated by
an embedded `domain` field plus a recognizable `t` tag, signed via the
existing `FedosNostrSigningAuthority`, verified via the existing
`NobleSignatureVerifier` — the account's public identity is read only
from the cryptographically-verified `event.pubkey`, never accepted as
caller input.

### Private Transport payload boundaries / NIP-17 inner payload classification
`fedos_direct_ratchet_nip17_payload.ts` is a closed, exact-field-set
discriminated union (`kind: "session-init" | "message"`), decoded via a
total, never-throwing `decodeFedosDirectRatchetNip17PayloadFromContent()`.
Classified in `FedosDirectRatchetInboundIntegration.receiveRumor()`
(`fedos_direct_ratchet_inbound_integration.ts:158-197`) via a hard binary
`if/else` on `payload.kind`. The single, real, existing generic transport
seam for a **non-ratchet** control payload is
`FedosPrivateTransport.sendMailboxNip17Control(controlId, conversationId,
plaintext, createdAt)` (`fedos_private_transport.ts:350-390`) — already
generic over any control plaintext plus a caller-chosen `controlId`,
requiring route `"nostr-nip17-v1"` specifically (the plain NIP-17 Gift
Wrap adapter, not the ratchet-specific route), and already enforcing
non-empty plaintext/controlId. This is the correct, additive integration
seam for this Arc's control payload — it must **not** be added as a third
`kind` inside the Ratchet's own frozen `fedos_direct_ratchet_nip17_payload.ts`,
since that would conflate an unrelated wire format with the Ratchet
message codec (this Arc's own payload gets its own new, sibling codec
file, matching the repo's established "always a new parallel type, never
generalize an existing one" convention — see the Observation precedent
below).

### The ONE inbound dispatch call site
`FedosConversationRuntime.receiveNip17Rumor()`
(`src/conversation/runtime/fedos_conversation_runtime.ts:1098-1114`) is
explicitly documented as "the ONE inbound entry point for an already
fully unwrapped, fully authenticated standard NIP-17 Rumor." It tries the
ratchet decode first (`"not-ratchet-payload"` falls through), then the
legacy `FedosNip17InboundImportCoordinator.receiveRumor()`, which treats
anything undecoded as an ordinary chat message. This Arc's own narrow,
additive integration hook is a **third** attempt inserted here, tried
after the ratchet attempt and before the legacy chat fallback — mirroring
exactly the pattern `f80889d` itself used to touch this same file (12
lines, per its own commit stat). This is the only production file this
Arc's inbound wiring touches outside its own new directory.

### Outbox / retry / Relay ACK
`FedosPrivateTransport.sendMailboxNip17Control()` persists a
`schemaVersion: 2` outbox record keyed by the caller-supplied
`controlId` — this Arc reuses this verbatim, choosing its own
notification-id string as `controlId`. Retry is bounded (one same-tick
retry for `"immediate"`, else `"later"`/`"never"`, never unlimited).
"Delivered" **is** structurally the Relay ACK (`FedosMultiRelayOkCorrelatedConversationTransportPublisher.publish()`
resolves only on a real NIP-01 `OK`) — there is no separate
"published-but-unacked" persisted state; only the terminal Observation
fact is durable. Relay ACK is never conflated with peer acceptance
anywhere in the existing code, and this Arc must preserve that
separation for its own payload too.

### Inbound dedup / replay
Two layers: an in-memory, bounded (4096) FIFO Relay-event dedup keyed on
the outer Gift Wrap's own event id
(`fedos_relay_event_deduplicator.ts:42-50`), and a durable
`FedosPrivateNostrImportRecordPersistence` keyed on the **Rumor's own**
id (invariant across re-wrap), checked before any decrypt/state mutation.
A new control payload sharing `receiveNip17Rumor()`'s dispatch inherits
this exact dedup identity for free — this Arc does not need its own
Rumor-id dedup layer, only its own **notification-id**/nonce-based
replay ledger for the payload's own semantic content (mirroring the
existing reset record's "keyed by nonce, doubles as audit trail and
replay ledger" pattern).

### Existing capability representations / naming collision risk
`src/conversation/capability/` already owns the bare word "capability"
for an unrelated concept (`FedosConversationCapabilityDescriptor`, a
join-conversation invitation/bearer-secret token). A second, unrelated
`FedosDeviceRegistrationAuthorityCapability = "verified"|"unavailable"`
trust-ceiling enum exists in `src/device/fedos_device_registration_authority.ts:43`,
and `FedosDeviceBindingV1.capabilityVersion` is a third, reserved-but-unwired
use of the word. Grepped `advertis` (case-insensitive) across `src/`:
only 5 hits, all the verb "advertises" in unrelated fail-closed-adapter
comments — **no existing noun-form "advertisement" domain exists**. This
Arc's new types live under a new `peer_capability/` directory and use
"peer capability"/"peer capability advertisement" as a two-word compound
consistently, never the bare word "capability" alone as a type/file name,
to avoid visual collision with `src/conversation/capability/`.

### Existing Observation precedents
Two real precedents, both explicitly "a new, parallel type each time,
never generalized": `src/board/observation/fedos_delivery_observation.ts`
and `src/device/relay_sync/fedos_device_relay_sync_observation.ts`
(closest shape match: `{id, subjectId, state, observedAt, reason}` +
in-memory/append-only repository pair). **No existing type anywhere in
`src/` durably records a fact specifically about what a remote peer/
Device has claimed/advertised about itself** — this Arc's own
`FedosRatchetPeerCapabilityObservation` is a genuinely new, but
precedent-shaped, addition, not a duplicate of either.

### Device Sync / Archive exclusion
Grepped `src/conversation/archive/` and every device-sync directory
(`sync_package`, `sync_scheduler`, `relay_sync`, `sync_session`,
`transfer`, `runtime`) for `ratchet`: zero matches in both. Confirmed:
neither carries live ratchet secrets today, and this Arc introduces
nothing that would change that (the new Observation domain records only
non-secret peer-capability facts, never ratchet keys/counters).

### Maximum Device/session/resource limits
`fedos_direct_ratchet_limits.ts` (27 lines, full file): skipped-key/chain-gap
caps, 14-day retention windows, 32-bit counter ceiling. No device-count or
session-count cap exists anywhere in the ratchet/device directories —
this Arc introduces its own new caps (max capability entries per
advertisement, max observed peer Devices) rather than assuming an
existing one applies.

### Current user-safe status DTOs
`FedosDirectRatchetSafeStatus` (`fedos_direct_ratchet_conversation_runtime.ts:64-72`)
is the existing closed 8-value facade, exposed via `getDirectRatchetStatus()`.
It never leaks counters/keys/session ids/generation numbers. This Arc
adds a **new**, separate safe status type for peer-capability
compatibility, not a widening of this existing union (frozen, per its
own header discipline).

## File-by-file: responsibility / reachable / frozen vs. extension point

| File | Responsibility | Reachable | Frozen / extension point |
|---|---|---|---|
| `fedos_direct_ratchet_session_id.ts` | Suite literal + session id construction | Yes | Frozen; suite literal explicitly reserved |
| `fedos_direct_ratchet_readiness.ts` | Internal readiness enum | Yes | Frozen |
| `fedos_direct_ratchet_session_lifecycle.ts` | Closed lifecycle enum/transitions | Yes | Frozen; new facts get a new, sibling state space |
| `fedos_direct_ratchet_session_reset_reason.ts` | Closed 4-value reset-reason enum | Yes | Frozen; explicitly excludes device-lifecycle reasons — confirms need for a new vocabulary |
| `fedos_direct_ratchet_session_reset_record.ts` / persistence | Reset+replay audit record | Yes | Frozen; pattern to mirror for the new Observation record |
| `fedos_direct_ratchet_reset_coordinator.ts` | Evaluate/apply reset + device-revocation quarantine sweep | Yes | `applyDeviceRevocation()` is an existing, currently-uncalled wiring point; this Arc's local-policy layer may recommend invoking it, never call it automatically |
| `fedos_direct_ratchet_nip17_payload.ts` | Ratchet message wire codec | Yes | Frozen; this Arc must NOT add a third `kind` here |
| `fedos_direct_ratchet_inbound_integration.ts` | Ratchet inbound dispatch | Yes | Frozen; not touched |
| `fedos_private_transport.ts` (`sendMailboxNip17Control`) | Generic control-plaintext send seam | Yes | Frozen API, reused verbatim (extension point by usage, not edit) |
| `fedos_conversation_runtime.ts` (`receiveNip17Rumor`) | The one inbound dispatch call site | Yes | One narrow, additive third-attempt insertion — the only production edit outside the new directory |
| `fedos_device_binding.ts` / registration authority / replacement coordinator | Device Trust ground truth | Yes | Frozen; read-only evidence source for this Arc |
| `fedos_device_signing_keypair.ts` | Per-call Device signing keypair, process-memory-only | Yes | Frozen; no durable storage exists or is added |
| `src/conversation/capability/*` | Join-conversation invitation tokens | Yes | Untouched; naming collision avoided by construction |
| `src/conversation/archive/*`, device-sync directories | Archive/Sync | Yes | Untouched; confirmed no ratchet coupling |

## Conclusion

The one production integration hook required is a single additive
insertion in `FedosConversationRuntime.receiveNip17Rumor()`. Every other
production change is new source under a new
`src/conversation/ratchet/peer_capability/` directory, reusing (never
widening) the existing route/suite vocabularies, the existing
account-authorization Nostr-event pattern, the existing best-effort
Device-signature pattern, the existing `sendMailboxNip17Control` seam,
and the existing Observation/append-only persistence conventions.
