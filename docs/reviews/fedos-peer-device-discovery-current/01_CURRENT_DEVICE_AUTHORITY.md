# Current Device-Authority Inventory — "Who may authoritatively state Device D belongs to Account/Persona P?"

**Status**: Phase A, read-only investigation. Agent A.
**Scope**: current HEAD of `arc/fedos-installed-startup-root-cause`, re-verified directly against source (not
inherited from any prior doc). Every claim below cites an exact file and, where useful, function/type name.
**Non-goal**: this document does not propose or design a cross-account peer-Device discovery protocol. It maps
what exists today only.

---

## 0. One-paragraph answer

FedOS today has a real, cryptographically-sound **same-account** Device Binding system: an account's own Nostr
signing key (BIP-340 Schnorr, via the existing `NobleSignatureVerifier`) authorizes a fresh, independent
`FedosDeviceSigningKeypair` to join that same account's Device Registry, and the joining Device proves possession
of that key. This is fully wired into the Desktop Runtime. **Nothing in the current codebase lets Account P make a
durable, verifiable statement that Device D belongs to a *different* account Q.** The one place that carries an
authenticated cross-account statement at all — `peer_capability`'s advertisement — authenticates the *account*
identity of the sender (real Schnorr verification), but the `senderDeviceRef` field inside it is an **unverified,
self-reported string label**: the receiving side only ever finds a corroborating device key for it when that
device happens to already be registered in the *receiver's own local* Device Registry (which, for a genuine
external peer, essentially never happens). So today's precedent proves "account P said X," not "device D belongs
to account P," for any device the verifying party does not already control.

---

## 1. Exact current mechanism(s) that CAN bind account → device (same-account pairing)

**This is real, not a stub.** It lives in `src/os/messenger/device/binding_challenge/` (Secure Runtime Alpha
3161–3240, "Account-to-Device Signature Verification Boundary," extended by Alpha 4581–4660) and is wired into
production via `src/os/messenger/desktop/runtime/fedos_desktop_runtime.ts`.

### 1.1 The challenge (the one signed preimage)

`src/os/messenger/device/binding_challenge/fedos_device_binding_challenge.ts`
- `FedosDeviceBindingChallengeV1` — `{schemaVersion, domain, action ("register-device"|"revoke-device"), deviceId,
  devicePublicKeyHex, issuedAt, expiresAt, nonce}`.
- `domain` is the fixed constant `FEDOS_DEVICE_BINDING_DOMAIN_V1 = "fedos:device-binding:v1"` — a domain
  separator so this signature can never be replayed as, or confused with, another signed shape.
- `serializeFedosDeviceBindingChallengeV1()` — canonical fixed-order array-tuple serialization; this exact string
  is what both signatures below are computed over.

### 1.2 Two independent signatures, both required for registration

1. **Account authorization** — `fedos_device_binding_account_authorization.ts`:
   - `authorizeFedosDeviceBindingChallenge(signingAuthority, accountIndex, challenge)` signs the challenge as an
     ordinary **kind-1 Nostr event** (tag `["t","fedos-device-binding-v1"]`, `content` = the canonical challenge
     serialization) via the **existing, unwidened** `FedosNostrSigningAuthority` (kind fixed to 1 at both the
     TS and Rust/WASM boundary — no new signing capability introduced).
   - `verifyFedosDeviceBindingAccountAuthorization(authorization, now)` re-derives the exact content, calls the
     **existing** `NobleSignatureVerifier.verify()` (real BIP-340 Schnorr over secp256k1,
     `src/os/messenger/adapters/nostr/protocol/noble_signature.ts`), and returns `accountPublicKeyHex` **only**
     from the cryptographically-verified `event.pubkey` — never a caller-supplied string (lines 34–35 comment,
     enforced at line 149 of that file: `return { outcome: "valid", accountPublicKeyHex: event.pubkey }`).
   - `accountIndex` is a local BIP32-style derivation index into the signing authority
     (`src/os/messenger/adapters/nostr/protocol/sign/fedos_nostr_signing_authority.ts:43,151`) — i.e. the signer
     must be an account **this node already locally controls the seed for**. There is no way to sign "as" an
     account you do not hold key material for.

2. **Device proof of possession** — `fedos_device_binding_proof_of_possession.ts`:
   - `createFedosDeviceBindingProofOfPossession(keypair, challenge)` signs `sha256("fedos-device-binding-proof-of-
     possession-v1:" + canonical-challenge)` with an **independent** device keypair.
   - `verifyFedosDeviceBindingProofOfPossession(proof, now)` verifies via `verifyFedosDeviceSigningSignature()`
     (real Schnorr, `src/os/messenger/device/crypto/fedos_device_signing_keypair.ts:103-115`) and requires
     `proof.devicePublicKeyHex === challenge.devicePublicKeyHex` before ever attempting the crypto check.

### 1.3 Device keypair

`src/os/messenger/device/crypto/fedos_device_signing_keypair.ts`
- `FedosDeviceSigningKeypair.generate()` — a **fresh, independent** secp256k1/Schnorr keypair via `@noble/curves`
  (`schnorr.utils.randomSecretKey()`), explicitly **not** derived from the account's Master Seed (Option B
  rejected by design, see file header). The secret key never leaves the class (`#secretKey` private field, no
  getter) and is **process-memory-only** — no durable Device-private-key storage exists anywhere in this Arc
  (stated explicitly, line 38).

### 1.4 The orchestrator that ties both signatures + persistence together

`src/os/messenger/device/binding_challenge/fedos_device_binding_registration_authority.ts`
- Class `FedosDeviceBindingRegistrationAuthority.registerDevice(accountAuthorization, deviceProof, now)`:
  requires **both** signatures to independently verify over the **identical** canonical challenge
  (`serializeFedosDeviceBindingChallengeV1(deviceProof.challenge) !== serializeFedosDeviceBindingChallengeV1
  (challenge)` is checked, lines 168–173), replay-guards on `challenge.nonce` via an injected
  `FedosDeviceBindingChallengeReplayPersistence`, and on success writes a
  `FedosDeviceBindingV1` with `accountRef = { authority: "nostr", publicIdentifier: accountPublicKeyHex,
  identityId: null }` (line 292-296) and `devicePublicKeyRef = challenge.devicePublicKeyHex` (line 298) — this is
  the **only** production code path in the repo where `devicePublicKeyRef` is ever populated to a non-null,
  cryptographically-established value.
- `revokeDevice(accountAuthorization, now)` — account-authorization alone (the Device need not cooperate),
  bound to the exact `deviceId` + `devicePublicKeyHex`, terminal (no path back from `"revoked"`).
- The internal `AlreadyVerifiedFedosDeviceRegistrationAuthority`
  (`fedos_already_verified_device_registration_authority.ts`) is explicitly documented as **never** to be
  constructed anywhere except inside this one orchestrator, precisely because it is only safe *after* both real
  signatures above have already been checked in the same call.

### 1.5 Where this is persisted

- `src/os/messenger/device/fedos_device_binding.ts` — `FedosDeviceBindingV1` (`schemaVersion, deviceId, accountRef,
  devicePublicKeyRef, label, createdAt, trustState, capabilityVersion, revokedAt`), states
  `"pending"|"trusted"|"revoked"|"unavailable"`, closed transition table (`ALLOWED_TRANSITIONS`, lines 107–112) —
  `"revoked"` has no outgoing edge.
- `src/os/messenger/device/persistence/persisted_fedos_device_trust_authority.ts` —
  `PersistedFedosDeviceTrustAuthority` is the single mutating orchestrator (`registerDevice`, `confirmTrust`,
  `revokeDevice`). Its own dedup rule (header comment, lines 14–23, enforced at `registerDevice()` lines 93–100):
  **a `deviceId` belongs to at most one account at a time** — re-registering the same device under a *different*
  account returns `"conflict"` without mutating anything; a `"revoked"` `deviceId` can never be reused.
- `src/os/messenger/device/persistence/fedos_device_registry_persistence.ts` — event-sourced backend
  (`FedosDeviceRegistryPersistence.putEvent/getBinding/listBindings/listBindingsForAccount`); real backend is
  `AppendOnlyFedosDeviceRegistryPersistence` (persistence dir), in-memory fallback also present.

### 1.6 Production wiring (confirmed reachable, not dead code)

`src/os/messenger/desktop/runtime/fedos_desktop_runtime.ts:1320,1364` — inside the `config.deviceTrustEnabled`
gate, `devicePairingBoundary = createFedosDeviceBindingBoundary({ registryPersistence: deviceRegistryPersistence!,
replayPersistence: deviceBindingReplayPersistence, limits, now: config.clock })`
(`src/os/messenger/device/binding_challenge/fedos_device_binding_boundary_factory.ts:77`), over the **same**
`deviceRegistryPersistence` instance the rest of the Runtime uses (never a second Registry).

`src/os/messenger/desktop/runtime/fedos_device_pairing_facade.ts` — `FedosDevicePairingFacade` is the
application-level Shell-reachable boundary (Alpha 4581–4660, Phase B), implementing the full manual pairing
handshake: `createPairingRequest()` (joining device) → out-of-band transport (QR/file/clipboard — this file
performs no I/O itself) → `inspectPairingRequest()`/`approvePairingRequest()` (authorizing device, the one holding
the account's Nostr key) → `completePairing()` (joining device). Its own header (lines 22–55) states the full
protocol semantics explicitly, including a named honest limitation: **"LOCAL RECIPROCAL RECORDING"** — there is
**no cross-machine Device Registry synchronization** anywhere in this codebase; every "trust" fact is written
independently, locally, on whichever machine's own registry a `registerDevice()` call actually reaches. Step 3
of the handshake additionally writes the same verified binding into the *authorizing* device's own local registry
(a second, independent local write, never a network call) purely so both machines can plan Sync without a human
re-registering twice — explicitly **not** "bidirectional trust" in any cryptographic sense (lines 57–71).

`src/os/messenger/desktop/shell/fedos_desktop_application_shell.ts` — confirms this reaches the Shell: imports
`FedosDevicePairingApprovalOutcomeView, FedosDevicePairingBindingView, FedosDevicePairingOutcomeKind,
FedosDevicePairingRequestInspectionView, FedosDevicePairingRequestSummary, FedosDevicePairingResult` from
`../runtime/fedos_device_pairing_facade.js` (lines 122–129), holds
`#pairingKeypairsByPairingId: Map<string, FedosDeviceSigningKeypair>` (line 269) as "the ONE place a JOINING
Device's own ephemeral `FedosDeviceSigningKeypair` is held in-process," and exposes `devicesList()`,
`deviceDetail()`, `deviceSyncStatus()`, `deviceSyncStart/Stop/Now()`, `syncSchedulesList/TransfersList/
ConflictsList()` (lines 574–665+), all delegating to `FedosRunningDesktopRuntime.deviceSyncOperational()` /
`FedosDevicePairingFacade`, none owning independent Device state itself. `deviceStatus()` is explicitly still
`"unavailable"` for the **separate**, unmodified `src/sync/*` Device Sync Foundation (line 24-27,
`DEVICE_STATUS_UNAVAILABLE_REASON`, line 242) — a different, legacy subsystem from the one described above; do
not conflate the two.

**Summary of 1**: same-account Device pairing is real, dual-signature (account Schnorr + device Schnorr),
replay-guarded, durably persisted, and reachable end-to-end from the Desktop Shell. It is structurally
**same-account-only**: the `accountRef` written into a binding is always derived from `event.pubkey` of a
signature this node itself produced with a locally-held `accountIndex` — there is no field, parameter, or code
path anywhere in this pipeline that accepts a caller-supplied *third-party* account identity to bind a device to.

---

## 2. Can any code path today durably record "Device D belongs to a DIFFERENT account than mine"?

**No.** Explicitly verified, not assumed:

- `PersistedFedosDeviceTrustAuthority.registerDevice()` derives `accountRef` from the *request* passed to it, but
  the only production caller that ever constructs that request —
  `FedosDeviceBindingRegistrationAuthority.#performRegistration()`
  (`fedos_device_binding_registration_authority.ts:287-300`) — hard-codes
  `accountRef = { authority: FEDOS_DEVICE_BINDING_NOSTR_ACCOUNT_AUTHORITY, publicIdentifier: accountPublicKeyHex,
  identityId: null }` where `accountPublicKeyHex` comes **only** from a signature this same call just verified
  (`accountVerification.accountPublicKeyHex`, line 188). There is no argument or injection point that lets a
  caller assert a *different* account than the one whose signature was actually checked.
- The registry's own conflict rule (`persisted_fedos_device_trust_authority.ts:93-100`) actively **rejects**
  ("conflict") an attempt to register the same `deviceId` under a second, different `accountRef` — so even a
  malicious/confused caller cannot use two separate calls to make one device "belong" to two accounts
  simultaneously; the second call is refused, never durably recorded.
- `fedos_ratchet_peer_capability_advertisement.ts` (see §4 below) *contains* a `recipientAccountRef` /
  `senderAccountRef` pair naming a different, remote account — but this is a **claim inside a signed message
  about a Direct Conversation counterparty**, not a Device Registry write. It is never fed into
  `FedosDeviceRegistryPersistence.putEvent()` anywhere (confirmed by grep — `putEvent(` has exactly the writers
  named in §1.5, all inside `fedos_device_binding_registration_authority.ts`/`persisted_fedos_device_trust_
  authority.ts`). Receiving an advertisement never creates or mutates a `FedosDeviceBindingV1`.
- `relay_sync/`, `transfer/`, `archive_suppression_sync/`, `sync_events/`, `sync_package/`, `sync_session/` — all
  checked directly:
  - `relay_sync/fedos_device_relay_sync_inbound_handler.ts:140-141` hard-requires
    `payload.accountAuthority === this.#deps.localAccountRef.authority && payload.accountPublicIdentifier ===
    this.#deps.localAccountRef.publicIdentifier` — i.e. this whole pathway only ever imports Sync Packages
    addressed to **this node's own local account**; there is no cross-account recipient case.
  - `transfer/fedos_device_transfer_coordinator.ts` (header, lines 14-18) explicitly treats the Device Registry
    as **read-only** and never registers/revokes/mutates a binding; it only checks that a device is already
    `"trusted"` in the (single-account-scoped-per-binding) registry before allowing a local transfer.
  - None of these directories contain a second `putEvent`/write path into `FedosDeviceRegistryPersistence`.

**Conclusion**: there is no mechanism anywhere in the current codebase — Device Binding, Relay Sync, Transfer,
Archive Suppression Sync, or Peer Capability — that lets one account durably record "Device D belongs to a
different account than mine." Every durable write to the Device Registry is gated on a real Schnorr signature
produced by an account this node itself locally controls, and the registry's own conflict rule additionally
prevents any accidental multi-account claim on the same `deviceId`.

---

## 3. Is the account's own Nostr signing key available/verifiable at the point a peer-device-binding claim would need to be checked?

**Yes, twice over — this primitive is already solved and reused three times in this codebase, verified directly:**

1. `src/os/messenger/adapters/nostr/protocol/noble_signature.ts` — `NobleSignatureVerifier` — real BIP-340 Schnorr
   over secp256k1 (via `@noble/curves`), described in every file that reuses it as "the EXISTING, UNMODIFIED"
   verifier. Confirmed reused by:
   - `verifyFedosDeviceBindingAccountAuthorization()` (`binding_challenge/fedos_device_binding_account_
     authorization.ts:140`),
   - `verifyFedosRatchetPeerCapabilityAccountAuthorization()`
     (`ratchet/peer_capability/fedos_ratchet_peer_capability_authentication.ts:118`),
   - `relay_sync/fedos_device_relay_sync_inbound_handler.ts` (header, "verify the OUTER Nostr signature — reusing
     the EXISTING, UNMODIFIED `NobleSignatureVerifier`").
2. Signing side: `FedosNostrSigningAuthority.signEvent({accountIndex, kind, tags, content, createdAt})`
   (`src/os/messenger/adapters/nostr/protocol/sign/fedos_nostr_signing_authority.ts`) — kind is fixed to `1` at
   both the TS and Rust/WASM boundary (`sign_nostr_event`, `packages/fedos-core-rust/src/lib.rs`, per every
   binding-challenge/peer-capability file header) — so any new authenticated-statement type built on this
   primitive would have to reuse the **existing** kind-1 domain-separation pattern (a fixed `t` tag +
   a `domain` string embedded in signed `content`), not a new signing capability. `publicIdentityForAccount
   (accountIndex)` (same file, line 151) additionally lets a caller read the account's own public key without
   signing anything.
3. The verified public key is **only ever read from `event.pubkey` post-verification**, never accepted as a
   caller-supplied claim — this exact discipline is repeated verbatim (same wording) in
   `fedos_device_binding_account_authorization.ts:104-108` and
   `fedos_ratchet_peer_capability_authentication.ts:90-91`.

So: yes — verifying "this signature really came from account P's own Nostr identity, and here is P's real pubkey"
is a solved, already-shipped, three-times-reused primitive. What is **not** solved anywhere is verifying that a
*second*, independently-claimed identifier (a `deviceId`/device pubkey string named inside such a signed
statement) actually corresponds to real key material controlled by the device it names, **when that device is not
one the verifying node already has a local, trusted binding for**. That is exactly the gap peer_capability's
`"account-authenticated-device-proof-unavailable"` evidence level names openly (§4).

---

## 4. Closest reusable precedent, and what would have to be added vs. reused

Two candidate precedents exist. Re-verified in detail; conclusions below differ somewhat from a purely
surface-level reading.

### 4.1 `peer_capability`'s authenticated cross-account advertisement — closer, but proves less than it appears to

`src/os/messenger/conversations/ratchet/peer_capability/`, Secure Runtime Alpha 5721–5800.

**What it proves:** `FedosRatchetPeerCapabilityAdvertisementV1`
(`fedos_ratchet_peer_capability_advertisement.ts:49-67`) is a record naming `senderAccountRef`, `senderDeviceRef`
(a bare string), `recipientAccountRef`, `recipientDeviceRef`, a `conversationId`, a monotonic `revision`, a
capability list, and `accountAuthorization` (the same kind-1 Schnorr pattern as §1.2.1) plus an **optional**
`deviceSignatureHex`. On receipt, `FedosRatchetPeerCapabilityInboundCoordinator.#importAdvertisement()`
(`fedos_ratchet_peer_capability_inbound_coordinator.ts:162`) hard-requires
`verification.accountPublicKeyHex === record.senderAccountRef.publicIdentifier` — so the **account** claim is
real, Schnorr-verified, exactly like §1.

**What it does NOT prove (verified precisely):** `#trustStateFor(record.senderDeviceRef)`
(`fedos_ratchet_peer_capability_inbound_coordinator.ts:94-98`) looks up `record.senderDeviceRef` in
`this.#deps.deviceRegistry` — which is the **verifying node's own local** `FedosDeviceRegistryPersistence`
(constructor param, line 61), the exact same single, local, same-account-scoped registry from §1.5. For a
genuinely external peer's device, this lookup essentially always returns `{trustState: "unknown",
devicePublicKeyRef: null}`, because (per §2) no mechanism populates a local registry with a *different* account's
device. `evaluateFedosRatchetPeerCapabilityEvidence()`
(`fedos_ratchet_peer_capability_authentication.ts:173-181`) then classifies this as
`"account-authenticated-device-proof-unavailable"` — the file's own doc comment states this is **"the common case
today"** (lines 162-166). So in the realistic cross-account case, `senderDeviceRef` is carried as an
**unverified, self-reported label** — it authenticates *who sent this statement* (the account), not *that the
named device is real/controlled by them*.

**What would have to be added to make this a real cross-account Device-identity precedent:** a way for the
*named* device's own key material (not just the sender account's Nostr key) to be independently verifiable by the
receiver — i.e. exactly the missing piece §2 confirms does not exist: a durable, cross-account-queryable
announcement/index of "account P attests: device D, public key K, is mine," verifiable without the receiver
already trusting/holding a local binding for D. The **signing/verification primitive** for such a statement is
fully reusable from here unmodified (kind-1 Schnorr + domain separation, §1.2.1/§3); what's missing is the
**durable cross-account distribution and verification-without-prior-local-state** layer, which is the actual
protocol-design question this document is explicitly not answering.

### 4.2 `identity_transition`'s evidence-graded acceptance — same-account, different subject (account continuity, not device identity)

`src/os/messenger/conversations/identity_transition/`.

- `evaluateFedosIdentityTransitionEvidence()`
  (`fedos_identity_transition_evidence_evaluation.ts:109-154`) is a **pure**, graded decision function over
  already-computed evidence statuses (new-key proof, old-key continuity, Device corroboration, history/rollback
  facts, local policy) — outcomes range from `"new-key-unproven"` through `"device-corroborated"` to
  `"locally-acceptable"`/`"rejected"`/`"rollback-detected"`. Two hard invariants are enforced directly in code:
  under a compromise reason, old-key continuity alone never reaches `"locally-acceptable"` (only Device
  corroboration or explicit manual verification can move it further, lines 131-137); rollback/conflict/staleness
  short-circuit everything else.
- `fedos_identity_transition_device_corroboration.ts` — `verifyFedosIdentityTransitionDeviceCorroboration()`
  (lines 94-121) requires the corroborating device's `FedosDeviceBindingV1.accountRef` to equal the transition's
  **own OLD account identity** (`fedosIdentityTransitionAccountRefsEqual(deviceBinding.accountRef,
  record.oldAccountIdentity)`, line 104), the binding to be `"trusted"` (not revoked, not merely pending), and
  `deviceBinding.devicePublicKeyRef` to match the corroboration's own `devicePublicKeyHex` — i.e. this reuses
  the **same** same-account Device Registry from §1, as a *second signer* corroborating that the **same account**
  it already trusts a device for is the one undergoing an identity change. It is not, and cannot be from its own
  data model, a statement about which account a device belongs to.

**Verdict on reusability:** the *evidence-grading pattern itself* (a pure function combining several independently
computed evidence statuses into one closed, ordered outcome enum, with named invariants like "no single
compromised-reason signal is ever sufficient alone") is a genuinely reusable **shape** for any future device-scoped
protocol's acceptance policy — but the *evidence sources* it currently combines (old-key continuity, Device
corroboration bound to a `"trusted"` same-account binding) are all same-account primitives. Nothing here proves or
disproves a cross-account device claim; it would need entirely new evidence-source inputs, only the *combinator
shape* (and the account-Schnorr-verification primitive, §3) is inherited for free.

### 4.3 Net assessment

- **Fully reusable today, unmodified**: the kind-1 Nostr Schnorr sign/verify primitive with domain separation
  (§1.2.1, §3) — this is the load-bearing cryptographic building block underneath both `binding_challenge` and
  `peer_capability`.
- **Reusable as a shape, not as data**: `identity_transition`'s pure evidence-grading combinator
  (`evaluateFedosIdentityTransitionEvidence`-style function returning a closed, ordered outcome enum) as a
  pattern for how a future protocol would combine multiple weak signals into a policy decision.
- **Not present anywhere and would have to be newly designed** (explicitly out of scope for this document, named
  only for completeness of the inventory): a durable, cross-account-queryable index of device announcements; a
  revocation/rotation model for such announcements; and a way to verify a *named* device's own key material
  independent of the verifier already holding a local trusted binding for it. `peer_capability`'s own
  `"account-authenticated-device-proof-unavailable"` evidence level is the current, honest name for exactly this
  gap.

---

## 5. Does the current registry/binding model assume one device per account anywhere structurally?

**No — the opposite invariant is what's structurally enforced.** Verified directly:

- `PersistedFedosDeviceTrustAuthority.listBindingsForAccount(accountRef)` and
  `.listTrustedBindingsForAccount(accountRef)` (`persisted_fedos_device_trust_authority.ts:180-186`) return
  **arrays** — the data model has no cardinality limit on devices per account.
- `FedosDeviceRegistryPersistence.listBindingsForAccount(accountAuthority, accountPublicIdentifier)`
  (`fedos_device_registry_persistence.ts:37`) is a first-class query, implying multiple rows per account is the
  expected shape, not an edge case.
- The Arc that introduced this whole subsystem is literally titled **"Device Trust and Multi-Device Runtime
  Integration"** (Secure Runtime Alpha 2921–3000, header of `fedos_device_binding.ts` and
  `persisted_fedos_device_trust_authority.ts`) — multi-device-per-account is the named design goal, not an
  afterthought.
- The **only** cardinality constraint that *is* structurally enforced runs the other direction: **one account per
  device** — `registerDevice()`'s conflict rule (§1.5/§2) refuses to let the same `deviceId` belong to two
  different accounts at once. This is a sensible invariant (a physical device identifier shouldn't silently
  switch owners) but is unrelated to "one device per account."
- `fedos_ratchet_peer_capability_observation.ts:18-22` explicitly names the multi-device case as a requirement
  it must not break: `localDeviceRef` is part of the observation record's own identity key specifically so "the
  SAME peer Device observed by two different local Devices (e.g. Alice's desktop and Alice's tablet, both talking
  to Bob) must never share a row."

One **caveat worth flagging** (not a structural one-device assumption, but a related current limitation): the
prior-arc doc `docs/reviews/fedos-direct-ratchet-readiness-current.md` (re-verified, not just trusted) notes that
`FedosDesktopRuntimeConfig.directRatchetMessageDeliveryRemoteDeviceRef` is "a single, runtime-wide,
construction-time-fixed device ref" for the *message-delivery* target — i.e. even though the Registry itself
supports many devices per account, today's Direct Ratchet message-delivery configuration only ever targets one
specific remote device at a time per running Runtime instance. That is a delivery-routing limitation, not a
Device-Registry data-model limitation, and this document does not re-verify that specific claim further (it falls
outside the file list this investigation was scoped to); flagging it only so the Coordinator does not conflate
"the Registry supports multi-device" (true, verified above) with "message delivery already fans out to all of an
account's trusted devices today" (not verified here, and the prior doc's own wording suggests it does not).

---

## Appendix: file inventory actually read for this document

- `src/os/messenger/device/fedos_device_binding.ts`
- `src/os/messenger/device/fedos_device_registration_authority.ts`
- `src/os/messenger/device/unavailable_fedos_device_registration_authority.ts`
- `src/os/messenger/device/binding_challenge/fedos_device_binding_challenge.ts`
- `src/os/messenger/device/binding_challenge/fedos_device_binding_account_authorization.ts`
- `src/os/messenger/device/binding_challenge/fedos_device_binding_proof_of_possession.ts`
- `src/os/messenger/device/binding_challenge/fedos_device_binding_pairing_exchange.ts`
- `src/os/messenger/device/binding_challenge/fedos_device_binding_registration_authority.ts`
- `src/os/messenger/device/binding_challenge/fedos_already_verified_device_registration_authority.ts`
- `src/os/messenger/device/binding_challenge/fedos_device_binding_boundary_factory.ts`
- `src/os/messenger/device/persistence/fedos_device_registry_persistence.ts`
- `src/os/messenger/device/persistence/persisted_fedos_device_trust_authority.ts`
- `src/os/messenger/device/crypto/fedos_device_signing_keypair.ts`
- `src/os/messenger/device/relay_sync/fedos_device_relay_sync_inbound_handler.ts`
- `src/os/messenger/device/transfer/fedos_device_transfer_coordinator.ts`
- (directory listings only, headers/greps confirming no cross-account writer: `sync_events/`, `sync_package/`,
  `sync_session/`, `archive_suppression_sync/`, `relay_sync/persistence/`, `transfer/persistence/`)
- `src/os/messenger/desktop/runtime/fedos_desktop_runtime.ts` (lines ~1290–1390)
- `src/os/messenger/desktop/runtime/fedos_device_pairing_facade.ts`
- `src/os/messenger/desktop/shell/fedos_desktop_application_shell.ts` (grep + targeted read)
- `src/os/messenger/conversations/ratchet/peer_capability/fedos_ratchet_peer_capability_authentication.ts`
- `src/os/messenger/conversations/ratchet/peer_capability/fedos_ratchet_peer_capability_advertisement.ts`
- `src/os/messenger/conversations/ratchet/peer_capability/fedos_ratchet_peer_capability_observation.ts`
- `src/os/messenger/conversations/ratchet/peer_capability/fedos_ratchet_peer_capability_inbound_coordinator.ts`
- `src/os/messenger/conversations/identity_transition/fedos_identity_transition_evidence_evaluation.ts`
- `src/os/messenger/conversations/identity_transition/fedos_identity_transition_device_corroboration.ts`
- `src/os/messenger/adapters/nostr/protocol/sign/fedos_nostr_signing_authority.ts` (grep)
- `src/os/messenger/device/README.md` (found to be a stale/aspirational migration-mapping note — its "RESERVED"
  language does not match the substantial, wired, production code actually present at this path; do not treat it
  as authoritative about this subtree's maturity)
- `docs/reviews/fedos-direct-ratchet-readiness-current.md` (prior synthesis, cross-checked against the above —
  its claims about same-account-only pairing, the absence of cross-account discovery, and peer_capability proving
  capability-not-identity were all independently reconfirmed by this investigation)
