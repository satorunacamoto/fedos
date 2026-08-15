# Peer-Device Discovery Protocol — Frozen Contract (Coordinator)

Frozen before parallel implementation begins, per mandate §7. This is the
single source of truth for Agents A/P/R/X (implementation phase) and for
Coordinator-owned shared files. Do not deviate without a new Coordinator
decision recorded here.

## 1. Name and scope

**`FedosPeerDeviceAnnouncementV1`** — a new, standalone record type (NOT a
reuse of `FedosRatchetPeerCapabilityAdvertisementV1`; Agent P confirmed that
type's mandatory short expiry + trust-circular acceptance make it unsuitable
as-is). Purpose: let account P tell account Q "device D, public key K, is
mine" — durably, cross-account, cryptographically bound to P's own identity
and to D's own key material.

**Scope decision (minimizing new surface, mandate §4 "minimum
current-architecture protocol"):** announcements are exchanged **only
between accounts that already share an active Direct Conversation** (exactly
2 active memberships — the same precondition `peer_capability` already
requires). This is deliberate, not an oversight:

- Direct Ratchet only matters once two accounts are actually messaging, so
  gating discovery on "already in a Direct Conversation" loses no realistic
  use case.
- It reuses `FedosPrivateTransport.sendMailboxNip17Control()` and
  `resolveFedosConversationTransportRoute()` completely unmodified (Agent P
  §1a) — zero new transport code.
- It avoids adopting the invitation coordinator's "fabricate local
  membership before sending" cold-send trick (Agent P §2), which is a
  heavier, less-adversarially-tested surface not required to meet this
  arc's success bar.
- **Explicitly deferred, not solved**: announcing to an account with no
  prior conversation at all. Out of scope for this arc; noted as future
  work in the final report.

**Trigger**: once a Direct Conversation reaches 2 active memberships, each
side automatically publishes its own current device announcement(s) to the
other over the same transport — the same "automatic, unprompted" pattern
`peer_capability` already establishes for capability advertisements. No new
user-facing action is required to trigger discovery.

## 2. Wire shape

```ts
interface FedosPeerDeviceAnnouncementSignableContentV1 {
  readonly schemaVersion: 1;
  readonly domain: "fedos:peer-device-announcement:v1"; // fixed domain separator, own constant
  readonly senderAccountRef: FedosDeviceBindingAccountRef;   // {authority:"nostr", publicIdentifier, identityId:null}
  readonly recipientAccountRef: FedosDeviceBindingAccountRef; // bilateral addressing, checked FIRST on import (mirrors inbound_coordinator.ts:157-158)
  readonly deviceId: string;          // NEW format: fixed-length random hex (see §5) -- never a human-meaningful label
  readonly devicePublicKeyHex: string; // the announced device's own Schnorr public key (same shape as FedosDeviceSigningKeypair)
  readonly capabilities: readonly FedosRatchetPeerCapabilityEntryV1[]; // reuse the EXISTING closed vocabulary (vocabulary.ts) verbatim -- no new free-text field
  readonly epoch: number;             // monotonic per (senderAccountRef, deviceId); NOT wall-clock
  readonly supersedesAnnouncementId: string | null; // explicit chain ref, mirrors peer_capability's supersedesNotificationId shape
  readonly issuedAt: number;          // informational only, never authoritative for ordering (mandate §13)
  readonly nonce: string;             // 32-hex-char, 128-bit CSPRNG, SAME generator shape as generateFedosRatchetPeerCapabilityNonce()
}

interface FedosPeerDeviceAnnouncementV1 {
  readonly content: FedosPeerDeviceAnnouncementSignableContentV1;
  readonly accountAuthorization: FedosNostrEventEnvelope;  // kind-1 Schnorr, SAME pattern as fedos_device_binding_account_authorization.ts
  readonly deviceProofOfPossession: FedosDeviceSigningSignatureV1; // REQUIRED (not optional, unlike peer_capability's deviceSignatureHex) -- see §3
}
```

No `conversationId` field. Device identity is not a conversation-scoped
fact by construction — see §4 for why this does not reproduce Agent X's
§0.8 cross-conversation gap.

## 3. Signature requirement — CORRECTED during implementation (device signature optional, mirrors peer_capability exactly)

**Revision note**: this section originally required both signatures as
mandatory. Verified directly before writing code (grep for any durable
local-device-keypair store anywhere in the Desktop Runtime composition):
**no such store exists**. `FedosDeviceSigningKeypair` is explicitly
process-memory-only everywhere in this codebase (own header: "this Arc
implements no durable storage for a Device's own secret" — a disclosed,
pre-existing limitation, not introduced by this protocol). Same-account
pairing gets away with requiring a mandatory device signature only because
that signature is used exactly ONCE, at pairing time, from a keypair held
just long enough to complete that one call. A cross-account announcement
protocol needs a STABLE `devicePublicKeyHex` reused across every
announcement and across restarts (otherwise every relaunch would look like
a brand-new device to every peer, breaking restart persistence — a required
completion bar, mandate §67-69) — which would require inventing NEW durable
secret storage, a materially bigger and riskier change than this arc's
minimum-scope mandate (§4) justifies.

**Corrected decision: the device-level signature is OPTIONAL/best-effort,
exactly mirroring `peer_capability`'s own already-validated precedent**
(`fedos_ratchet_peer_capability_authentication.ts`'s three-evidence-level
model, reused verbatim):

1. **Account authorization (mandatory)** — kind-1 Schnorr over the
   canonical `content` serialization, domain-tagged, verified via the
   existing, unmodified `NobleSignatureVerifier`.
   `senderAccountRef.publicIdentifier` MUST equal the verified
   `event.pubkey` (never a caller-supplied value) — identical discipline to
   `fedos_device_binding_account_authorization.ts` and
   `fedos_ratchet_peer_capability_authentication.ts`.
2. **Device proof of possession (optional, best-effort)** — when supplied,
   a Schnorr signature over
   `sha256("fedos-peer-device-announcement-proof-of-possession-v1:" +
   canonical-content)`, verified via the existing
   `verifyFedosDeviceSigningSignature()`; a PRESENT-but-invalid device
   signature is a hard rejection (never silently downgraded to
   "absent"). Reuses `FedosRatchetPeerCapabilityEvidenceLevel`'s exact
   three-value vocabulary (`"account-authenticated"` /
   `"account-and-device-authenticated"` /
   `"account-authenticated-device-proof-unavailable"`) — the common case
   today will be `"account-authenticated"` alone, exactly as it already is
   for `peer_capability` (disclosed there as "the common case today," not a
   new limitation this protocol introduces).

**Trust-level justification (revised from §5 of `05_TRUST_AUTHORITY_DECISION.md`)**:
granting a `"trusted"` Registry binding on account-signature evidence ALONE
is not a weaker bar invented for convenience — it is EXACTLY the same trust
boundary already implicitly granted to account P's signature everywhere
else in this codebase (messages, product listings, capability
advertisements: all trusted on account-signature alone, no device
corroboration anywhere). Same-account pairing's own stronger, mandatory
dual-signature bar exists for a different reason (a NEW device asking to
act as an equal, local peer of the account owner's OTHER devices) that does
not apply here. A present, verified device signature still strengthens the
recorded evidence level (and is preferred when selecting which observed
device to trust first — see `06` §7), but its absence does not block
`"trusted"`.

## 4. Acceptance policy — new, dedicated, pure function

`evaluateFedosPeerDeviceAnnouncementAcceptance()` — pure, mirrors
`evaluateFedosRatchetPeerCapabilityAcceptance()`'s shape (closed outcome
union, never boolean, short-circuiting order), checked in this order:

1. Structural/codec validation fails → `"malformed"`
2. `recipientAccountRef` does not match the local account → `"wrong-recipient"` (checked BEFORE any signature verification, mirrors inbound_coordinator.ts:157-158/test :471-473)
3. Account signature invalid or `senderAccountRef.publicIdentifier` != verified signer → `"bad-account-signature"`
4. Device proof-of-possession PRESENT but invalid → `"bad-device-signature"` (absent is fine — evidence level drops to `"account-authenticated"` / `"account-authenticated-device-proof-unavailable"`, per §3's corrected decision; never a rejection)
5. Exact-nonce replay (identical `sourceId`) → `"duplicate"` (idempotent, checked BEFORE any revision/epoch re-evaluation — mirrors inbound_coordinator.ts:134-154)
6. Different nonce, same `epoch`, different content → `"conflicting"`
7. `epoch <= priorAccepted.epoch` for this exact `(senderAccountRef, deviceId)` → `"stale"` (purely numeric, never arrival-order-based — mirrors acceptance_policy.ts:85)
8. Otherwise → `"accepted-new-device"` (no prior binding existed) or `"accepted-superseding"` (a prior binding existed and this epoch is strictly greater)

**No `"untrusted-device"` gate.** This is the deliberate, load-bearing
difference from `peer_capability`: this protocol's entire purpose is
handling a genuinely new/unknown device, so gating acceptance on
pre-existing Registry trust (as `peer_capability` does) would be circular
(Agent P §2, Agent X §1 row 12 analysis extended). Acceptance here is
gated ONLY on the dual-signature strength (§3) — which is deliberately the
SAME bar same-account pairing already accepts without a human step (§5 of
`05_TRUST_AUTHORITY_DECISION.md`).

## 5. Device identifier — closing Agent X's flagged privacy gap

`deviceId` for this NEW protocol is a **fixed-format, 32-hex-character,
CSPRNG-derived opaque string** (same shape/generator as the existing
128-bit nonce generator, but domain-separated: a distinct constant/prefix so
a device-id value can never be confused with a nonce value). The codec
**structurally rejects** any string that is not exactly this shape — closing
Agent X's flagged gap (§2.3 item 1: `peer_capability`'s 512-char free-form
`deviceRef` is opaque only by convention). This `deviceId` is independent of
whatever `deviceId` same-account pairing already assigned locally to that
physical device (no cross-domain identifier reuse) — the announcement
carries `devicePublicKeyHex` as the actual cryptographic identity; `deviceId`
is a stable label for this protocol's own replay/epoch bookkeeping only.

## 6. Persistence

**New observation/announcement store**,
`FedosPeerDeviceAnnouncementObservationPersistence` (append-only, mirrors
`FedosRatchetPeerCapabilityObservationPersistence`'s "already-present vs
conflict" idempotency discipline), keyed by `(localAccountRef, senderAccountRef,
deviceId)` — no `conversationId` component (§2), because device identity is
account-scoped by design, not conversation-scoped. Records ONLY safe,
non-secret facts (senderAccountRef, deviceId, devicePublicKeyHex, epoch,
capabilities, acceptance outcome, observedAt) — mirrors
`FedosRatchetPeerCapabilityObservationV1`'s own "no raw payload plaintext
beyond these fields, no signatures, no keys" discipline.

**Current-vs-superseded**: never a stored flag, always derived at read time
from the full fact set for a `(senderAccountRef, deviceId)` key — mirrors
`identity_transition`'s `isFedosIdentityTransitionFactSuperseded()` pattern
(Agent X §0.3), the correct precedent for "which of this peer's several
devices/epochs is current."

## 7. Registry integration (Direct Ratchet consumption)

On `"accepted-new-device"` or `"accepted-superseding"`:

1. A new `FedosPeerDeviceRegistrationAuthority` (implementing the EXISTING
   `FedosDeviceRegistrationAuthority` seam,
   `fedos_device_registration_authority.ts:52-57` — a SEPARATE, dedicated
   instance for cross-account bindings, never sharing an authority instance
   with same-account pairing's own `AlreadyVerifiedFedosDeviceRegistrationAuthority`)
   returns `{allowed: true, capability: "verified"}` from the
   just-verified account-signature evidence (§3's corrected decision — device
   signature strengthens the recorded evidence level but is not required for
   `"verified"`).
2. Call `PersistedFedosDeviceTrustAuthority.registerDevice({deviceId,
   accountRef: senderAccountRef, devicePublicKeyRef: devicePublicKeyHex,
   label: null}, now)` then `.confirmTrust(deviceId, now)` — the SAME
   two-call sequence same-account pairing already performs
   (`fedos_device_binding_registration_authority.ts:297-325`), producing a
   `"trusted"` binding with zero additional step, matching §2 of
   `05_TRUST_AUTHORITY_DECISION.md`.
3. On `"accepted-superseding"` for a `deviceId` that already has a
   `"trusted"` binding under a DIFFERENT `devicePublicKeyRef`: this is a
   genuine key-rotation case. Do not silently overwrite — the registration
   authority must reject silent re-keying of an already-trusted `deviceId`
   (a new physical device must get a new protocol-level `deviceId`, mirroring
   `fedos_device_binding_registration_authority.ts`'s own "revoked/unavailable
   ids are not reused" discipline, §280-320 verified this session). A
   changed key under the same `deviceId` is treated as `"conflicting"` at the
   acceptance-policy layer (§4 step 6 generalizes: same subject, materially
   different claim, not silently accepted).
4. Zero changes required to `resolveFedosDirectRatchetDevicePair()`,
   `FedosDirectRatchetCryptographicSession`, session persistence, or session
   ID construction (Agent R §3, confirmed no cryptographic incompatibility).
5. `selectFedosDirectConversationForwardSecrecyRoute()`: leave its existing
   vocabulary unchanged for this arc (Agent R §2 — sufficient, not
   strictly required to add `"peer-device-trusted-session-not-established"`).
   The Security UI's DEVICE_KNOWLEDGE axis (see `06`... existing
   `fedos_conversation_security_state.ts`) is the layer that will surface
   "peer device now known" distinctly from "ratchet established" (already
   designed as two axes, per the prior arc).
6. Session bootstrap trigger: once a `"trusted"` binding exists for a
   conversation's counterparty device, and neither side has a live/persisted
   ratchet session for that `(conversationId, remoteDeviceRef)` tuple yet,
   the FIRST outbound message send in that conversation triggers session
   establishment via the EXISTING, unmodified
   `resolveFedosDirectRatchetDevicePair()` → session creation path (Agent R
   §1/§3) — no new bootstrap mechanism, only a new Registry writer feeding
   an existing consumer.
7. **Multi-device**: if a peer account has more than one `"trusted"` device
   discovered, `directRatchetMessageDeliveryRemoteDeviceRef`'s existing
   single-value, runtime-wide limitation (Agent R §6, confirmed real and
   separate from this protocol) means only ONE device can be the actual send
   target per running Runtime instance today. This protocol does not lift
   that limitation (explicitly out of this arc's minimum scope per §4);
   `selectFedosDirectConversationForwardSecrecyRoute()`'s existing
   `"ambiguous-remote-device"` fail-closed behavior already protects against
   silent misuse if multiple devices somehow acquire sessions.

## 8. Identity-replacement interaction

A `"trusted"` peer-device binding created by this protocol under account
identity X does NOT automatically carry forward if X later completes an
Identity Replacement to identity Y. Mirrors
`recommendFedosRatchetPeerSessionAction()`'s `"device-replaced"` →
`"manual-review-required"` precedent (Agent X §1 row 14): the Security UI's
IDENTITY_CONTINUITY axis already surfaces this distinctly; this protocol
adds no auto-carry-forward logic, and a fresh announcement under the NEW
identity is required to re-establish trust for the new identity.

## 9. Downgrade / no-silent-downgrade

Mirrors `isRouteDowngrade()`'s shape: if a previously-accepted announcement
claimed a stronger capability set (e.g. `ratchet-suite` support) and a later
one drops it, this is `"conflicting"` at minimum, never silently accepted as
a routine update, consistent with §4's step-6 conflict handling generalized
to capability regressions, not just epoch collisions. Every fact surfaced
through the Security UI carries an `asOf`/`source: "live"|"cached"`
qualifier (already the established pattern from the prior arc) — a
withheld/never-arrived newer announcement must age visibly, never render as
an unqualified "current" state (Agent X §3's cross-cutting meta-test).

## 10. Why this does not reproduce Agent X's §0.8 cross-conversation gap

`peer_capability`'s advertisement claims to be conversation-scoped
(`conversationId` is a signed field) but the receiver never enforces it —
that is a real bug in that domain. This protocol has **no `conversationId`
field at all**, because device identity ("device D belongs to account P")
is not a conversation-scoped fact by nature — it means the same thing in
every context. There is therefore no conversation-scoping claim to fail to
enforce. The actual substitution risks for THIS protocol are (a) wrong
recipient (bilateral addressing, checked first, §4 step 2) and (b) wrong
device slot for a multi-device account (§7 item 3, `deviceId` uniqueness).
Downstream RATCHET SESSION establishment remains fully conversation-scoped
via the existing, unmodified session-id tuple (Agent R confirmed this is
unaffected by where the trusted-device fact came from).

## 11. Transport reuse (Agent P)

`FedosPrivateTransport.sendMailboxNip17Control()`, unmodified. New payload
kind (a `rumorKind`/marker analogous to peer_capability's own marker,
domain-separated per §2's `domain` string) rides the SAME NIP-59 Gift Wrap →
Seal → Rumor pipe. Inbound: a new coordinator,
`FedosPeerDeviceAnnouncementInboundCoordinator`, parallel to
`FedosRatchetPeerCapabilityInboundCoordinator`, registered alongside it at
the same dispatch point already unwrapping Rumor content for
`peer_capability`. Restart/offline: inherits the SAME durable Outbox +
`FedosConversationInboundSubscription` `since`-filter reconnect behavior
already proven for `peer_capability` and ordinary messages (Agent P §1a) —
no new sync mechanism.
