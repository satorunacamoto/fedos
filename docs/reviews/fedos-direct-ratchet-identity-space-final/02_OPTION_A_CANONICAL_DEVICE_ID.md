# Option A — Make Peer Device Discovery's `deviceId` (Space B) Canonical for Direct Ratchet

**Status**: Read-only design specification. Written against current HEAD of `arc/fedos-installed-startup-root-cause`
at commit `83dca4ee69dbef22be143ff7ee6257f4063fba6c` (verified via `git rev-parse HEAD` at the start of this
investigation). No source file was edited to produce this document.

**Relationship to prior work**: this document takes §1 ("Design option A") of
`docs/reviews/fedos-peer-device-discovery-current/11_DIRECT_RATCHET_IDENTITY_SPACE_DESIGN_NEXT.md` (the "recon doc")
and turns it into an implementation-ready specification. Every file:line citation in the recon doc was re-verified
directly against current source for this document; where the recon doc's citations were stale or its conclusions
needed correction, that is called out explicitly below rather than silently repeated. The two identity spaces are
exactly as the recon doc's §0 defines them:

- **Space A** — Device Pairing's own `localDeviceId`, generated once at profile-create time, stored in
  `FedosLocalProfileDescriptorV1.localDeviceId`.
- **Space B** — Peer Device Discovery's (PDD's) own `deviceId`, a separately-generated CSPRNG value, stored in its
  own identity file via `readOrCreateFedosLocalPeerDeviceAnnouncementIdentity()`.

---

## 0. Verification summary — what changed since the recon doc was written

The recon doc's core claims hold up. Two things needed correction:

1. **Line-number drift (cosmetic)**: the recon doc cites
   `fedos_profile_initialization_coordinator.ts:462-464` for the Space A `localDeviceId` derivation. At current HEAD
   this code is at **lines 524-526** (`src/os/messenger/desktop/onboarding/fedos_profile_initialization_coordinator.ts:524-526`)
   — the logic and the exact expression (`` `device-${deviceKeypair.publicKeyHex.slice(0, 16)}` ``) are unchanged,
   only the line numbers shifted (evidently other work landed in this file between when the recon doc was written
   and now). Every other file:line citation in the recon doc's §0/§1 was re-verified byte-for-byte against current
   HEAD and is accurate (see §1 below for the full re-verified inventory).

2. **Substantive correction to the "Affected persistence formats" claim in recon §1** (the sealed-secret
   context-binding claim). The recon doc states sealed secrets are "keyed/context-bound by
   `fedosDirectRatchetSealingDeviceContext(accountRef, deviceRef)`" and cites
   `fedos_direct_ratchet_state_runtime.ts:370-371,423-425`. This citation is to real code
   (`FedosDirectRatchetStateRuntime.sealAndPersistSecret()`/`.recover()`), but **that code is never called by the
   real outbound/inbound integration path** — see §4 below for the full, re-verified picture. The actual production
   sealing/restoring flow uses a different mechanism (`FedosDirectRatchetCryptographicSession.sealState()` →
   Rust `seal_root_key`/`seal_sending_chain_key`/etc., checkpointed via `checkpointFedosDirectRatchetSecretsV1()`),
   which binds on the **raw** `localDeviceRef`/`remoteDeviceRef` strings (baked into the Rust session object at
   construction), not on the `fedosDirectRatchetSealingDeviceContext()` composite string. The practical conclusion
   (empty real migration surface) is the same either way, but the mechanism is different, and an implementer who
   trusted the recon doc's citation literally would instrument/patch the wrong code path.

---

## 1. Every call site that reads `deps.localDeviceRef`/`config.localDeviceId` for Direct Ratchet purposes

All paths below are under `src/os/messenger/` (the shipping codebase — `src/conversation/ratchet/*` is a parallel,
unreachable tree per the existing scope-freeze finding and is not analyzed further here).

### 1.1 Composition root — where Space A first enters the Ratchet dependency graph

`src/os/messenger/desktop/runtime/fedos_desktop_runtime.ts:1062` —
```ts
localDeviceRef: config.localDeviceId!,
```
inside the construction of `conversationDirectRatchetDeps` (the `FedosConversationDirectRatchetIntegrationDependencies`
object, gated on `config.directRatchetEnabled`). This is the **one place** `config.localDeviceId` (Space A) becomes
`deps.directRatchet.localDeviceRef`. **Change**: replace this with the local node's own PDD `deviceId` (Space B) —
see §3 for exactly how that value should be obtained here.

Contrast: line 1113, `conversationPeerDeviceAnnouncementDeps.localDeviceRef: config.localDeviceId!` — this is a
**different, legitimate** use of Space A that must **not** change under Option A. PDD's own `localDeviceRef` field
is a pure same-account multi-device *observation isolation key* (so Alice's desktop and Alice's tablet keep
separate observation rows for the same peer device — confirmed by
`fedos_peer_device_announcement_outbound_coordinator.ts:37`: "never the same-account `localDeviceRef` config
string" is used for the *announced* identity — that identity is the separate `localAnnouncedDeviceId`/
`localAnnouncedDevicePublicKeyHex` fields at lines 1114-1115, sourced from
`readOrCreateFedosLocalPeerDeviceAnnouncementIdentity()`). This is a structurally different field on a structurally
different subsystem; Option A must leave it alone.

### 1.2 `fedos_conversation_runtime.ts:768` — Ratchet Runtime construction

`src/os/messenger/conversations/runtime/fedos_conversation_runtime.ts:768`:
```ts
localDeviceRef: deps.directRatchet.localDeviceRef,
```
Feeds into `FedosDirectRatchetConversationRuntime`'s own constructor deps. **Change**: automatic once §1.1 changes
(no independent literal here — it forwards whatever `deps.directRatchet.localDeviceRef` already is). Re-verified:
line 768 is exact at current HEAD, matching the recon doc's citation precisely.

Also note (out of scope, do not touch): `fedos_conversation_runtime.ts:1003`, inside the `forwardSecrecySelector`
closure passed to `FedosConversationDirectMessagingCoordinator`, reads `deps.directRatchet!.localDeviceRef` — this
is **in scope** (§1.6 below), just noting it lives in the same file as the constructor wiring.

### 1.3 `FedosDirectRatchetConversationRuntime` — internal fan-out (four sites)

`src/os/messenger/conversations/ratchet/fedos_direct_ratchet_conversation_runtime.ts`:
- Line 162 — `localDeviceRef: deps.localDeviceRef` into `FedosDirectRatchetOutboundIntegration`'s constructor deps.
- Line 185 — `localDeviceRef: deps.localDeviceRef` into `FedosDirectRatchetInboundIntegration`'s constructor deps.
- Line 237 — inside `resetDirectRatchetSession()`, `localDeviceRef: this.#deps.localDeviceRef` passed to
  `resolveFedosDirectRatchetDevicePair()`.
- Line 257 — inside `getDirectRatchetStatus()` (aliased as `assessDirectRatchetReadiness()` at line 283),
  `localDeviceRef: this.#deps.localDeviceRef` passed to `resolveFedosDirectRatchetDevicePair()`.

These four are **not named individually in the recon doc's §1 sketch** (which only names "outbound/inbound
integration construction" generically) — they are a complete, re-verified enumeration. All four change
automatically once §1.1 changes the value flowing into `deps.localDeviceRef`; no independent code edit is needed
at these four sites themselves, but each is a place a reviewer must confirm the change actually reaches.

### 1.4 `FedosDirectRatchetOutboundIntegration` — real call sites (not just construction)

`src/os/messenger/conversations/ratchet/fedos_direct_ratchet_outbound_integration.ts`:
- Line 154 — `localDeviceRef: this.#deps.localDeviceRef` into `findCurrentFedosDirectRatchetSession()`.
- Line 184 — `localDeviceRef: this.#deps.localDeviceRef` into `resolveFedosDirectRatchetDevicePair()`.
- Line 197 — `this.#deps.localDeviceRef` passed as the `localDeviceRef` positional argument to
  `FedosDirectRatchetCryptographicSession.createAsReceiver()` — **this is the Rust session-construction call site**
  (see §1.7 below for what happens inside Rust).
- Line 205 — `localDeviceRef: this.#deps.localDeviceRef` into `stateRuntime.createSession()` — this is what gets
  written into `FedosDirectRatchetSessionRecordV1.binding.localDeviceRef` (persisted).
- Line 218 — `localDeviceRef: this.#deps.localDeviceRef` into `resetCoordinator.applyConsequences()`.
- Line 257 — `senderDeviceRef: this.#deps.localDeviceRef` inside the wire `signableContent` object that becomes
  `FedosDirectRatchetSessionInitPayloadV1.senderDeviceRef` — **this is the wire-payload construction site**.
- Line 308 — `localDeviceRef: this.#deps.localDeviceRef` into `resolveFedosDirectRatchetRoute()`'s
  `devicePair` argument (inside `sendMessage()`).
- Line 420 — `this.#deps.localDeviceRef` passed to `FedosDirectRatchetCryptographicSession.restore()` (inside
  `#restoreLiveSession()`).

Recon doc's citation `fedos_direct_ratchet_outbound_integration.ts:257` for the wire-payload construction and
`:259` for `recipientDeviceRef: remoteDeviceRef` are both exact at current HEAD.

### 1.5 `FedosDirectRatchetInboundIntegration` — real call sites

`src/os/messenger/conversations/ratchet/fedos_direct_ratchet_inbound_integration.ts`:
- Line 277 — `payload.recipientDeviceRef !== this.#deps.localDeviceRef` — the comparison the recon doc's §0
  identifies as the literal point of failure today (Space B payload value vs. Space A local value). Exact at
  current HEAD.
- Line 282 — `localDeviceRef: this.#deps.localDeviceRef` into `resolveFedosDirectRatchetDevicePair()`.
- Line 304 — `localDeviceRef: this.#deps.localDeviceRef` into `findCurrentFedosDirectRatchetSession()`.
- Line 326 — `deviceRegistry.getBinding(payload.senderDeviceRef)` — the recon doc's second identified failure
  point (this is a **remote**-side lookup, keyed by whatever space the wire payload's `senderDeviceRef` carries;
  it becomes correct automatically once senders populate that field from Space B). Exact at current HEAD.
- Line 340 — `localDeviceRef: this.#deps.localDeviceRef` into `resetCoordinator.applyConsequences()`.
- Line 364 — `this.#deps.localDeviceRef` passed to `FedosDirectRatchetCryptographicSession.createAsSender()`.
- Line 373 — `localDeviceRef: this.#deps.localDeviceRef` into `stateRuntime.createSession()`.
- Line 388 — `localDeviceRef: this.#deps.localDeviceRef` into `resetCoordinator.applyConsequences()` (second call,
  the "created" branch).
- Line 447 — `sessionMetadata.binding.localDeviceRef !== this.#deps.localDeviceRef` — a genuine tamper/integrity
  check inside `#receiveMessage()`, comparing the already-persisted session binding's own `localDeviceRef` against
  the live config value; becomes self-consistent automatically once both sides agree on the space.
- Line 578 — `this.#deps.localDeviceRef` passed to `FedosDirectRatchetCryptographicSession.restore()` (inside
  `#restoreLiveSession()`).

### 1.6 Forward-secrecy route selector — NOT named in the recon doc's §1 sketch

`src/os/messenger/conversations/ratchet/fedos_direct_conversation_forward_secrecy_route.ts:171`
(`selectFedosDirectConversationForwardSecrecyRoute()`):
```ts
if (b.localDeviceRef !== request.localDeviceRef) continue;
```
filters `sessionPersistence.listSessions()` candidates by the caller-supplied `request.localDeviceRef`. The caller
is `src/os/messenger/desktop/runtime/fedos_desktop_runtime.ts:1003`:
```ts
localDeviceRef: deps.directRatchet!.localDeviceRef,
```
inside the `forwardSecrecySelector` closure wired into `FedosConversationDirectMessagingCoordinator`
(`fedos_desktop_runtime.ts:996-1007`). This governs the UI-facing "is this conversation actually forward-secret"
answer (`FedosConversationSecurityStateController`'s Axis 3, and the raw send-time route decision itself,
`FedosConversationDirectMessagingCoordinator.sendDirectMessage()`). This is a **real, independent call site the
recon doc's §1 sketch does not name** (it lists only "session construction, binding, session-id derivation,
Rust sealing-context binding") — it must be included in the implementation plan or the send-time route decision
and the establishment path will disagree about which space `localDeviceRef` lives in even after Option A ships
everywhere else.

### 1.7 Rust boundary — two independent bindings, not one

The recon doc names "Rust sealing-context binding via `fedosDirectRatchetSealingDeviceContext()`" as the one Rust
touchpoint. Re-verified: this function is **only** called from `FedosDirectRatchetStateRuntime.sealAndPersistSecret()`/
`.recover()` (`fedos_direct_ratchet_state_runtime.ts:370-371,424-425` — grep-confirmed, zero other call sites in
`src/`), and **that code is never invoked by the real outbound/inbound integration** (see §4 for the full
explanation). The real Rust-boundary bindings that actually matter for Option A are:

1. **Session construction** (`FedosDirectRatchetCryptographicSession.createAsReceiver`/`createAsSender`/`restore`,
   `fedos_direct_ratchet_cryptographic_session.ts:380-468`) — `localDeviceRef` is passed straight through to the
   WASM boundary (`attemptDevOnlyDirectRatchetInitializeAsReceiverCall`/`...AsSenderCall`/`...RestoreCall`) and
   ends up in `DirectRatchetSessionState.local_device_ref`
   (`packages/fedos-core-rust/src/crypto/direct_ratchet_session.rs:66`), a field baked into the Rust session object
   for its whole lifetime.
2. **Per-message header** — `packages/fedos-core-rust/src/crypto/direct_ratchet_session.rs:250`:
   ```rust
   sender_device_ref: self.local_device_ref.clone(),
   ```
   inside `encrypt()`. `self.local_device_ref` (raw, whatever was passed at construction) is placed into
   `DirectRatchetHeaderFields`, encoded into `header_bytes`
   (`encode_direct_ratchet_header()`), and that `header_bytes` is used as AEAD-authenticated associated data in
   `seal_direct_ratchet_message_internal(&message_key, &header_bytes, plaintext)`. **This is a call site the recon
   doc does not mention at all.** On `decrypt()` (`direct_ratchet_session.rs:273-434`), the header is decoded and
   its `session_id`/`generation` are compared against `self.session_id`/`self.generation` (line 280), but
   `header.sender_device_ref` itself is **never compared against an expected value** anywhere in `decrypt()` — it
   is authenticated (any bit-flip fails the AEAD tag) but not cross-checked. Practically: this field just travels
   as tamper-evident metadata; it does not gate anything today, and Option A does not need to add a check here —
   but an implementer should know this field exists and also carries `local_device_ref`, independent of the
   sealing path.
3. **Sealing** (`FedosDirectRatchetCryptographicSession.sealState()`, `fedos_direct_ratchet_cryptographic_session.ts:509-559`)
   — passes `remoteDeviceRef`/`conversationId` per call; `localDeviceRef` is **not** a parameter here — it comes
   from the already-constructed Rust session object's own `self.local_device_ref` (see §4 for the full Rust-side
   trace: `packages/fedos-core-rust/src/lib.rs:13250` etc., `self.inner.local_device_ref.clone()`).

Net: the Rust boundary has **two** places `local_device_ref` matters (session construction, feeding both the
per-message header and the sealing calls), not the one place (`fedosDirectRatchetSealingDeviceContext()`) the
recon doc names. Both change automatically and correctly once TS-side `deps.localDeviceRef` changes at its one
source (§1.1) — no Rust code needs editing for Option A. This is confirmed by the port contract itself
(`src/os/core/ports/sealing_authority_port.ts:36-67`, `SealingAuthorityPort`): `localDeviceRef`/`remoteDeviceRef`
are documented as "opaque HKDF context bytes only (never interpreted, never split apart)" — Option A only changes
*which string* flows through this already-opaque parameter, never the parameter's shape or the Rust code that
consumes it.

---

## 2. Wire payload shape — confirmed no field-shape change

Re-verified directly against `src/os/messenger/adapters/nostr/conversation_delivery/nip17/fedos_direct_ratchet_nip17_payload.ts`:

- `FedosDirectRatchetSessionInitPayloadV1.senderDeviceRef`/`recipientDeviceRef` (lines 127, 130) are typed
  `string`, validated by `isSafeIdField()` (line 60-62: any non-empty string ≤ 512 characters) — no space marker,
  no format constraint tied to either space's generation scheme. Space A values (`` `device-${...16 hex}` ``) and
  Space B values (32-hex-char CSPRNG, per `fedos_peer_device_announcement_nonce.ts`) both already satisfy this
  validator today.
- `FedosDirectRatchetSessionResetSignableContent` (`fedos_direct_ratchet_session_reset_authentication.ts`) is
  built directly from the same `senderDeviceRef`/`recipientDeviceRef` values (see
  `fedos_direct_ratchet_outbound_integration.ts:250-262`) — same conclusion, no shape change.
- `isWellFormedSessionInit()`'s exact-field-set closed validator (`SESSION_INIT_FIELDS`, lines 168-183) is
  unaffected — no field is added, removed, or retyped.

**Confirmed**: the recon doc's claim that Option A has "the smallest wire-schema footprint" of the three options is
correct. This is a pure "which string populates an already-generic field" change, not a schema change. No signed
artifact's byte format changes; only the *value* placed into already-existing bare-string fields changes, from a
Space A value to a Space B value.

---

## 3. New local self-binding registration needed

**Today**: confirmed by grep — `readOrCreateFedosLocalPeerDeviceAnnouncementIdentity()`
(`src/os/messenger/conversations/peer_device/fedos_local_peer_device_announcement_identity.ts`) never calls
`registerDevice()`/`PersistedFedosDeviceTrustAuthority` for **this node's own** PDD identity. It only writes the
standalone identity file (`deviceId`, `devicePublicKeyHex`, `nextEpoch`). `resolveFedosDirectRatchetDevicePair()`
(§1.3/1.4/1.5 above) requires `deviceRegistry.getBinding(request.localDeviceRef)` to return a `"trusted"` binding
(`fedos_direct_ratchet_device_pair_resolver.ts:164-167`) — under Option A, `request.localDeviceRef` becomes the
PDD `deviceId`, so **without a new local self-binding, every Direct Ratchet establishment attempt fails closed at
`"local-device-unknown"`** the moment Option A ships. This registration is not optional polish — it is a hard
prerequisite for Option A to work at all.

### 3.1 The model to follow — already exists for Space A

`FedosProfileInitializationCoordinator.#bootstrapLocalDevice()`
(`src/os/messenger/desktop/onboarding/fedos_profile_initialization_coordinator.ts:1098-1122`) is the exact
precedent: it runs the **full** Device Pairing dual-signature protocol against itself —
```ts
pairing.createPairingRequest(localDeviceId, deviceKeypair, accountRef)   // line 1110
  → pairing.approvePairingRequest(created.value.encoded)                // line 1112
  → pairing.completePairing(created.value.pairingId, deviceKeypair, approval.value.encoded)  // lines 1115-1119
```
using `FedosDevicePairingFacade`'s public API
(`src/os/messenger/desktop/runtime/fedos_device_pairing_facade.ts:251,295,367`), producing a genuinely
`"trusted"` `FedosDeviceBindingV1` for Space A `localDeviceId`, gated by the **same** real account-Schnorr +
device-Schnorr dual signature every other Device Pairing registration requires (§1.2 of
`01_CURRENT_DEVICE_AUTHORITY.md` — re-verified, this is real, not a stub: both signatures are independently
checked by `FedosDeviceBindingRegistrationAuthority.registerDevice()`).

### 3.2 The complication this precedent exposes for Space B

`readOrCreateFedosLocalPeerDeviceAnnouncementIdentity()` generates a device keypair
(`generateFedosDeviceSigningKeypair()`, line 101) but **only persists the public half**
(`devicePublicKeyHex`) — the file's own header states explicitly: "The corresponding PRIVATE key is generated
fresh, held in-memory for this one call only, and immediately discarded" (lines 12-14). This is deliberate and
matches the codebase-wide invariant that **no durable Device private-key storage exists anywhere**
(`01_CURRENT_DEVICE_AUTHORITY.md` §1.3). Consequence: a dual-signature self-registration mirroring §3.1 is only
possible **at the exact moment the identity is freshly created** — the private key needed for
`createFedosDeviceBindingProofOfPossession(keypair, challenge)` does not exist in memory (or anywhere) on any
subsequent call. Today's call site (`fedos_desktop_runtime.ts:1108`,
`readOrCreateFedosLocalPeerDeviceAnnouncementIdentity(config.peerDeviceAnnouncementIdentityLogPath!)`) runs on
**every** Runtime construction, and the function itself conflates "read existing" and "generate fresh" into one
return shape with no signal to the caller about which branch ran — so the composition root cannot currently tell
whether it just received a keypair it could use for self-registration, or an identity that was already durable
from a prior run (and for which no keypair exists any more).

### 3.3 Recommended shape (describe-only, no code to write)

1. Add an **optional callback parameter** to `readOrCreateFedosLocalPeerDeviceAnnouncementIdentity(filePath,
   onFreshlyGenerated?)` — invoked **synchronously, only on the "generate fresh" branch** (i.e. only when
   `existingRaw === null`, the current lines 88/101-110), passing the just-generated `FedosDeviceSigningKeypair`
   and the newly-created `identity`. The keypair still never leaves this one call's dynamic scope except into the
   callback — the existing "process-memory-only, immediately discarded" invariant for every OTHER call path is
   unchanged; the callback simply gets a chance to use it before it goes out of scope. This is the minimal-blast-
   radius option: on every subsequent (non-fresh) call, `onFreshlyGenerated` is simply never invoked, and the
   function's return shape and every existing caller are unaffected.
2. At the `fedos_desktop_runtime.ts:1108` call site, pass a callback that performs **exactly** the §3.1 sequence,
   substituting the PDD identity's own `deviceId` for `localDeviceId` and the freshly generated keypair for
   `deviceKeypair`: `devicePairing.createPairingRequest(localIdentity.deviceId, freshKeypair, config.localAccountRef!)`
   → `approvePairingRequest()` → `completePairing()`. This requires `devicePairing()` (the same
   `FedosDevicePairingFacade` accessor `#bootstrapLocalDevice()` already uses) to be reachable at the point PDD
   deps are constructed — today PDD deps are built in the same function (`assembleFedosDesktopRuntimeConfig`/
   equivalent) as `conversationDirectRatchetDeps` and `deviceRegistryPersistence`, so the facade (or the same
   `PersistedFedosDeviceTrustAuthority`/`FedosDeviceBindingRegistrationAuthority` pair it wraps) is already
   constructible in scope; wiring is additive, not a new dependency edge.
3. **Populated `FedosDeviceBindingV1` fields** (per `fedos_device_binding.ts:53-61`), for the resulting binding:
   `deviceId` = PDD's `localIdentity.deviceId` (Space B); `accountRef` = `config.localAccountRef!` (this node's own
   account — verified by the real account-Schnorr signature inside `approvePairingRequest()`, never caller-supplied
   unchecked, per §1.2.1 of `01_CURRENT_DEVICE_AUTHORITY.md`); `devicePublicKeyRef` = the freshly generated
   keypair's own `publicKeyHex` (which **already equals** `localIdentity.devicePublicKeyHex`, since PDD's own
   `readOrCreateFedosLocalPeerDeviceAnnouncementIdentity()` derives `devicePublicKeyHex` from this exact same
   keypair, line 105); `label` = `null` (no user-facing label exists for this synthetic self-binding, mirroring
   `fedos_peer_device_announcement_registration_authority.ts:64`'s own `label: null` for peer-side PDD
   registrations); `trustState` = `"trusted"` (the outcome of a successful `completePairing()`); `capabilityVersion`
   / `revokedAt` follow the same defaults `#bootstrapLocalDevice()`'s own call path already produces for Space A.
4. **Idempotency / restart safety**: because step 2 only runs on the "freshly generated" branch (once per
   `filePath`, ever), the self-binding is written exactly once, the same durability lifetime as the identity file
   itself — no re-registration attempt on every subsequent restart, and no "conflict"/"already-registered" outcome
   to handle on the steady-state path (Registry write happens atomically with identity-file creation, at the one
   moment both are fresh).
5. **What happens to profiles that already have a PDD identity file today** (created before Option A ships): their
   private key is already gone (per §3.2), so the callback-on-fresh-generation approach cannot retroactively
   self-register them via the dual-signature path. This is a real migration gap for any **already-running**
   installation and is called out explicitly in §7 (implementation plan) and §10 (risks) — it is not silently
   glossed over here.

---

## 4. Sealed-secret migration — re-verified against actual persistence/query code, not the recon doc's claim

The recon doc's claim ("currently-empty real migration surface") is **directionally correct** but its *mechanism*
citation needed correction (§0.2 above). Full trace, re-verified:

### 4.1 Two independent seal/persist mechanisms exist in this codebase — only one is live

**Mechanism 1 — `FedosDirectRatchetStateRuntime.sealAndPersistSecret()`/`.recover()`**
(`fedos_direct_ratchet_state_runtime.ts:355-434`). This is the mechanism the recon doc cites. It calls
`fedosDirectRatchetSealingDeviceContext(record.binding.localAccountRef, record.binding.localDeviceRef)` (lines
370, 424) and the equivalent for the remote side — a `"authority::publicIdentifier::deviceRef"` composite string
(`fedos_direct_ratchet_session_binding.ts:39-41`). Grep-confirmed (`grep -rn "fedosDirectRatchetSealingDeviceContext"
src/`): this function has **exactly 5 references in the entire `src/` tree** — its own definition, its two imports,
and these two call sites. Grep-confirmed separately (`grep -rn "\.sealAndPersistSecret\(" src/`): **zero** call
sites anywhere in `src/` — not in the outbound integration, not in the inbound integration, not in the desktop
runtime composition root. The only callers of `sealAndPersistSecret()`/`.recover()` anywhere in the repository are
two Foundation-Arc-level test files:
`test/secure_runtime_alpha_5401_5480_runtime_facade.test.ts` and
`test/secure_runtime_alpha_5401_5480_real_vertical_slice.test.ts`. This mechanism's own file header additionally
self-documents this: "Every 'seal'/'recover' call here operates on OPAQUE PLACEHOLDER SECRET BYTES this Arc's own
callers supply for testing — never message content, never a claim of real ratchet cryptography"
(`fedos_direct_ratchet_state_runtime.ts:17-20`).

**Mechanism 2 — the real, live path.** `FedosDirectRatchetOutboundIntegration.establishSession()`/`.sendMessage()`
and `FedosDirectRatchetInboundIntegration.#receiveSessionInit()`/`#receiveMessage()` all call
`session.sealState(masterSeedAuthority, remoteDeviceRef, conversationId)`
(`fedos_direct_ratchet_cryptographic_session.ts:509-559` — note: **no `localDeviceRef` parameter here at all**;
see below) and pass the result to `checkpointFedosDirectRatchetSecretsV1()`
(`fedos_direct_ratchet_secret_checkpoint.ts:77-107`), which writes into
`FedosDirectRatchetLiveStateSnapshotPersistence` (the four "fixed-kind" secrets, current-value/overwrite semantics)
and `FedosSealedDirectRatchetSecretPersistence` (only `"skipped-message-key"` entries, one row per
`(sessionId, secretKind, generation, chainCounter)` via `fedosSealedDirectRatchetSecretRecordKey()`,
`fedos_sealed_direct_ratchet_secret_record.ts:113-121` — this key function is **`buildIntegrityContext()`'s** own
`[sessionId, secretKind, generation, chainCounter]` join, structurally unrelated to
`fedosDirectRatchetSealingDeviceContext()`).

### 4.2 Where `localDeviceRef` actually enters the real sealing binding

`sealState()`'s own `remoteDeviceRef` parameter is passed through unmodified to the Rust boundary
(`attemptDevOnlyDirectRatchetSealRootKeyCall`/etc., `fedos_direct_ratchet_cryptographic_session.ts:516-547`).
`localDeviceRef` is **not** a per-call parameter of `sealState()` at all — it was already baked into the Rust
session object at construction time (§1.7 above:
`DirectRatchetSessionState.local_device_ref`). Rust's own `seal_root_key`/etc. (traced to
`packages/fedos-core-rust/src/lib.rs:13250`, `self.inner.local_device_ref.clone()`, passed into
`master_seed_authority.seal_direct_ratchet_secret(local_device_ref, remote_device_ref, conversation_id, generation,
secret_bytes)`) use the **raw** device-ref string — never wrapped in an account-prefixed composite context.
`restore_direct_ratchet_secret` requires the exact same tuple (`packages/fedos-core-rust/src/lib.rs:12788-12813`,
and the fail-closed unit tests at lines 14855-14875: `restore_direct_ratchet_secret_fails_closed_on_wrong_local_device`/
`..._wrong_remote_device`) — any mismatch on `local_device_ref` fails closed by AEAD authentication, not by a
string-equality gate.

### 4.3 Practical consequence for Option A

Because the real sealing binding is the raw `localDeviceRef` (not a composite), and because `sessionId` itself is
**also** derived from the raw `localDeviceRef`/`remoteDeviceRef` strings
(`fedos_direct_ratchet_device_pair_resolver.ts:202-217`, `accountRefToSessionIdComponent()` +
`toFedosDirectRatchetSessionId()`), changing `localDeviceRef` from a Space A value to a Space B value produces a
**different `sessionId`** for the same logical conversation/counterparty automatically. Since
`FedosDirectRatchetSessionRecordV1` (keyed by `sessionId` in `FedosDirectRatchetSessionPersistence`) and every
`FedosSealedDirectRatchetSecretRecordV1` derived from it (keyed by `fedosSealedDirectRatchetSecretRecordKey()`,
which embeds `sessionId`) and the `FedosDirectRatchetLiveStateSnapshotPersistence` current-value row (also keyed by
`sessionId`) are **all** namespaced by `sessionId`, Option A produces a clean, automatic namespace split — no old
record is silently reinterpreted under the new space; it simply becomes unreachable (a new `sessionId` is computed
going forward, and nothing queries the old one). This is the correct, safe outcome for a migration surface the
recon doc already established (§5 of the recon doc, independently re-confirmed here at the mechanism level) is
empty in real production data — the only sessions that have ever reached `"active"` are same-account Device
Pairing scenarios and Alice's own unilateral receiver-role side of a cross-account attempt, per the recon doc's own
citation of `direct_ratchet_bidirectional_packaged_binary_real_electron.test.ts`. **No explicit re-seal/migration
step is needed** — the natural effect of changing which value flows into `localDeviceRef` is that Option A starts a
fresh session/secret namespace, and the old (Space-A-keyed) rows are simply orphaned, harmless dead data (never
read by any live code path once the composition root change lands).

---

## 5. Security State Controller implications — exact before/after

`src/os/messenger/desktop/presentation/security_state/fedos_conversation_security_state_controller.ts`. Re-verified
directly (recon doc's `:90-98` citation maps to current lines 90-98 exactly):

**Before Option A** (current, broken, behavior confirmed by tracing every hop):
1. `#gatherFacts()` line 90: `peerDeviceAnnouncementListObserved()` → `chosenDevice.deviceId` (line 98) — this is
   the **peer's own Space B** PDD-announced `deviceId`, the only value PDD can ever expose for a genuine external
   peer.
2. Line 101: `this.#shell.directRatchetStatus(conversationId, chosenDevice.deviceId)` passes that Space B value as
   `remoteDeviceRef`.
3. `FedosDesktopApplicationShell.directRatchetStatus()` (`fedos_desktop_application_shell.ts:1107-1112`) forwards
   to `FedosDirectRatchetConversationRuntime.getDirectRatchetStatus(conversationId, remoteDeviceRef)`
   (`fedos_direct_ratchet_conversation_runtime.ts:251-263`), which calls `resolveFedosDirectRatchetDevicePair()`
   with `localDeviceRef: this.#deps.localDeviceRef` — **today, Space A** (`config.localDeviceId`) — and
   `remoteDeviceRef` = the Space B value from step 2.
4. This computes a `sessionId` from **(Space A local, Space B remote)** — a tuple that can never match the
   `sessionId` a genuine cross-account peer's own outbound `establishSession()` call would compute, because that
   peer's own outbound integration builds its wire `senderDeviceRef` from **its own** `deps.localDeviceRef`, which
   is (today) **that peer's own Space A** value, not this node's PDD-observed Space B value for them. The UI's
   "which device did I pick" (Space B) and the wire protocol's own agreement mechanism (Space A vs Space A on each
   side, mismatched against the other side's Space B expectations) were never in the same namespace — this is a
   second, independent confirmation of the root mismatch the recon doc's §0 describes, reached this time by tracing
   forward from the Security State Controller's own UI selection rather than from the wire payload construction.

**After Option A**:
1. Step 1 unchanged — `chosenDevice.deviceId` is still the peer's own Space B value (Option A does not touch PDD).
2. Step 2 unchanged.
3. `getDirectRatchetStatus()`'s own `this.#deps.localDeviceRef` is now **this node's own Space B** value (§1.1-1.3),
   so the tuple becomes **(Space B local, Space B remote)** — the same space on both sides, for the first time.
4. This `sessionId` now genuinely matches what a real cross-account `establishSession()`/inbound
   `#receiveSessionInit()` exchange would compute, because **both** sides' outbound integrations now build their
   wire `senderDeviceRef` from their own Space B PDD identity (§1.4, line 257) — Alice's `senderDeviceRef` (her own
   Space B) is exactly the value Bob's PDD announcement list would show him as Alice's `deviceId`, and vice versa.

**Net**: the recon doc's characterization ("becomes fully coherent end-to-end... a strict improvement, not a new
risk") is confirmed correct by this trace. No new UI logic, no new Shell method, no change to
`FedosConversationSecurityStateController` itself is required — the controller was already, structurally,
"reading the right space"; it was Direct Ratchet's own internal identity that was wrong. Axis 3 (`forwardSecrecy`,
lines 113-116) is likewise unaffected in its own logic — it already compares
`this.#messageDeliveryRemoteDeviceRef` (an operator-configured value, `FedosDesktopRuntimeConfig.directRatchetMessageDeliveryRemoteDeviceRef`)
against `chosenDevice.deviceId` (Space B); for this comparison to ever be true for a genuine peer it already had
to be configured with a Space B value, so Option A does not change what operators must supply here — it only makes
the `ratchetStatus` feeding into the same axis (line 115) honest for the first time.

---

## 6. Invariants Option A must not weaken — verified against current enforcement code

1. **Registry revoked/trusted gate.** `resolveFedosDirectRatchetDevicePair()`
   (`fedos_direct_ratchet_device_pair_resolver.ts:151-221`) denies unconditionally on
   `isFedosDeviceBindingRevoked()`/`!isFedosDeviceBindingTrusted()` for **both** local and remote bindings (lines
   164-172), before ever constructing a `sessionId`. Option A changes **which string** is looked up as
   `request.localDeviceRef` — it does not touch this function's own logic at all. The gate applies identically to
   whichever binding is now found under the Space B key.
2. **"One account per device id" conflict rule.** `PersistedFedosDeviceTrustAuthority.registerDevice()`
   (`persisted_fedos_device_trust_authority.ts:93-100`, confirmed lines match) refuses ("conflict") re-registering
   an existing `deviceId` under a different `accountRef`. This rule is **keyed purely on `deviceId`**, with no
   awareness of which "space" a `deviceId` came from — it already applies identically to Space B `deviceId`s today
   (PDD peer registrations already go through this exact same authority, `fedos_peer_device_announcement_registration_authority.ts:64`).
   Option A's new self-binding write (§3) goes through the same `registerDevice()` path and is subject to the
   same rule — a Space B `deviceId` cannot be claimed by two accounts, exactly as today.
3. **Same-account Device Pairing's own dual-signature bar.** `FedosDeviceBindingRegistrationAuthority.registerDevice()`
   (`fedos_device_binding_registration_authority.ts`, §1.2-1.4 of `01_CURRENT_DEVICE_AUTHORITY.md`) is untouched by
   Option A — it is the **same** orchestrator §3.1/§3.3 above reuse for the new PDD self-binding write. Option A
   adds a **new caller** of this existing, unmodified authority; it does not add a new authority, a new bypass, or
   a new trust rule. Every existing same-account pairing flow (`FedosDevicePairingFacade`, manual QR/file/clipboard
   exchange) is completely untouched.
4. **Never-announced/never-trusted device rejected closed.** The recon doc cites a real, packaged-binary-verified
   guarantee (scenario k) that this holds today for whichever space `remoteDeviceRef` is resolved from. Because
   Option A changes only *which value* is passed as `remoteDeviceRef`/`localDeviceRef` into
   `resolveFedosDirectRatchetDevicePair()` — never that function's own gate logic — this guarantee is structurally
   preserved, not just preserved by observation.

---

## 7. Implementation plan — ordered, file-by-file

This plan sequences changes so the system is never left in a state where establishment can silently corrupt data
or where the self-binding is missing when Ratchet tries to use it.

1. **`fedos_local_peer_device_announcement_identity.ts`** — add the optional `onFreshlyGenerated` callback
   parameter to `readOrCreateFedosLocalPeerDeviceAnnouncementIdentity()` (§3.3 step 1). Invoked synchronously,
   only inside the current "generate fresh" branch (today's lines 101-110), passing the freshly generated
   `FedosDeviceSigningKeypair` and the constructed `identity`. No behavior change for any existing caller that
   omits the new parameter.

2. **`fedos_desktop_runtime.ts`** (composition root), inside the `conversationPeerDeviceAnnouncementDeps`
   construction (today's lines 1104-1128): pass the new callback, performing the §3.1/§3.3 self-registration
   sequence (`devicePairing().createPairingRequest()` → `approvePairingRequest()` → `completePairing()`) against
   the freshly generated keypair and the PDD `deviceId`, using `config.localAccountRef!` as the account. This step
   must land **before** step 3 below — if the self-binding writer ships after the `localDeviceRef` source switch,
   every fresh profile created in between has a PDD identity with no self-binding, reproducing the exact
   `"local-device-unknown"` failure Option A is meant to fix.

3. **`fedos_desktop_runtime.ts`**, `conversationDirectRatchetDeps` construction (today's line 1062): change
   `localDeviceRef: config.localDeviceId!` to read this node's own PDD `deviceId` instead. Because
   `conversationPeerDeviceAnnouncementDeps` (§1.1) already computes `localIdentity` via
   `readOrCreateFedosLocalPeerDeviceAnnouncementIdentity()` at line 1108, the composition root already has the
   value in scope at this point in the same function — the ordering of the two `const` blocks
   (`conversationDirectRatchetDeps` currently precedes `conversationPeerDeviceAnnouncementDeps` in file order,
   lines 1051 vs. 1104) needs to be **swapped**, or `localIdentity` needs to be read once, earlier, and shared by
   both blocks (preferred — avoids reading/creating the identity file twice per Runtime construction, which is
   itself a pre-existing but orthogonal minor inefficiency worth fixing in the same change).

4. **`fedos_desktop_runtime.ts`**, the `forwardSecrecySelector` closure (today's line 1003,
   `localDeviceRef: deps.directRatchet!.localDeviceRef`) — no separate edit needed once step 3 lands, since this
   reads the same `deps.directRatchet.localDeviceRef` value; included here only as an explicit verification
   checkpoint (§1.6) so an implementer confirms this call site was not missed.

5. **No edits needed** in `fedos_direct_ratchet_outbound_integration.ts`, `fedos_direct_ratchet_inbound_integration.ts`,
   `fedos_direct_ratchet_conversation_runtime.ts`, `fedos_direct_ratchet_device_pair_resolver.ts`,
   `fedos_direct_ratchet_session_binding.ts`, `fedos_direct_ratchet_cryptographic_session.ts`, the Rust boundary,
   or the NIP-17 payload codec — every one of these consumes `localDeviceRef` structurally (as an opaque string),
   confirmed in §1/§2/§4 above. This is the core practical benefit of Option A: the change is entirely at the
   composition root plus one new additive self-registration write.

6. **`fedos_conversation_security_state_controller.ts`** — no edit needed (§5); included as a verification
   checkpoint only (confirm `getSecurityState()` reports coherent Axis 2/3 results in the new integration test,
   §8).

7. **Existing-installation migration note** (not a code change, an operational one) — any profile whose PDD
   identity file (`peerDeviceAnnouncementIdentityLogPath`) already exists **before** step 1/2 ship cannot be
   retroactively self-registered via the dual-signature path (§3.5, §10). Document this as a known limitation for
   already-provisioned closed-pilot installs; do not attempt a silent regenerate-the-identity-file workaround (that
   would break already-observed peer trust for that `deviceId`, violating
   `readOrCreateFedosLocalPeerDeviceAnnouncementIdentity()`'s own "never silently regenerate" discipline, lines
   74-79).

---

## 8. Test plan

### 8.1 New tests needed

- **Self-binding registration unit test** for the new `onFreshlyGenerated` callback path: verify it fires exactly
  once (only on first creation, never on a subsequent read of an existing identity file), verify it does **not**
  fire when the identity file already exists, and verify the resulting `FedosDeviceBindingV1` has the exact field
  values named in §3.3 step 3.
- **End-to-end resolver test**: `resolveFedosDirectRatchetDevicePair()` with `localDeviceRef` = a Space B-shaped
  value, asserting `"local-device-unknown"` before the self-binding write and `"resolved"` after it — a direct,
  minimal regression test for the exact failure Option A fixes.
- **Cross-account bidirectional integration test** — the real target: a same-shape rewrite of
  `packages/fedos-desktop-electron-spike/test/direct_ratchet_bidirectional_packaged_binary_real_electron.test.ts`'s
  scenario c (the one that reproduces Bob durably stuck at `"initialization-required"`), asserting the scenario now
  reaches `"active"` on **both** sides after Option A ships. This is the test that actually proves the fix, not
  just its individual mechanisms.
- **Security State Controller coherence test**: assert `getSecurityState()`'s Axis 2 (`ratchetStatus`) reports
  `"active"` (not `null`/`"peer-incompatible"`) for a conversation with a genuinely established cross-account
  session, using the real `peerDeviceAnnouncementListObserved()`-sourced `chosenDevice.deviceId` end-to-end — this
  is the regression test for §5's before/after trace.
- **Forward-secrecy route selector test**: extend or add a case to whatever currently exercises
  `selectFedosDirectConversationForwardSecrecyRoute()` confirming it selects `"ratchet"` for a session whose
  `binding.localDeviceRef` is a Space B value, matching the now-Space-B `request.localDeviceRef` the composition
  root supplies.

### 8.2 Existing tests likely to need updates (found via grep for `localDeviceRef` + ratchet-related filenames)

- `test/secure_runtime_alpha_5561_5640_route_and_device_pair.test.ts` — likely constructs test fixtures with
  literal Space-A-shaped `localDeviceRef` strings; audit for any assertion that depends on the *value's own shape*
  (e.g. asserting it starts with `"device-"`) rather than treating it as opaque.
- `test/secure_runtime_alpha_5961_6040_real_vertical_slice.test.ts`, `test/secure_runtime_alpha_5961_6040_ratchet_reset_integration.test.ts`
  — reset-flow tests; check whether `localDeviceRef` fixtures are shared with any Device Pairing-specific
  assertion that would now be inconsistent if the "self" device ref changes shape.
- `test/secure_runtime_alpha_6921_7000_production_session_vertical_slice.test.ts` — production WASM-boundary
  vertical slice; confirm it does not hardcode a Space-A-shaped literal that a real composition-root change would
  no longer produce.
- `test/secure_runtime_alpha_7001_7080_structural_guards.test.ts` — likely tests
  `directRatchetMessageDeliveryRemoteDeviceRef`/forward-secrecy wiring structurally; audit for Space assumptions.
- `test/secure_runtime_alpha_7401_7480_ratchet_route_binding_isolation.test.ts` — route-binding isolation tests;
  confirm fixtures for `senderDeviceRef`/`recipientDeviceRef` don't assume a particular space's shape.
- `test/fedos_ratchet_device_lifecycle_session_reset_foundation_unit.test.ts`,
  `test/fedos_ratchet_device_lifecycle_session_reset_real_vertical_slice.test.ts` — session-reset authority tests;
  audit `senderDeviceRef` fixtures similarly.
- `test/support/fake_direct_ratchet_sealing_authority.ts` — a shared test double; confirm it does not encode any
  assumption about the *shape* of `localDeviceRef`/`remoteDeviceRef` (it should already be opaque per §1.7's port
  contract, but worth an explicit audit pass since it is shared fixture code many of the above tests likely import).
- `packages/fedos-desktop-electron-spike/test/direct_ratchet_bidirectional_packaged_binary_real_electron.test.ts` —
  covered in §8.1 as the primary target, listed again here because its **existing, currently-passing** assertions
  (e.g. that Bob gets durably stuck at `"initialization-required"` — the documented current bug) must be updated,
  not just extended, once Option A actually fixes the behavior; leaving the old assertion in place would make this
  test fail for the right reason for the wrong reason (a false regression signal instead of a real one).

None of the above needed a full read for this document — they are named from the grep inventory in §1/investigation
setup; an implementer must actually open each one before editing, since this document has not verified their
current contents line-by-line.

---

## 9. Multi-device implications

**Easier**, on balance, if a future arc adds real multi-device support — for one specific, verifiable reason:
Space B (PDD's `deviceId`) is already the identity space every *peer*-facing device discovery/announcement
mechanism uses (§0/§7 item 2 of the frozen protocol contract, `06_PROTOCOL_CONTRACT_FREEZE.md`, re-confirmed live
at `fedos_peer_device_announcement_registration_authority.ts:64`). A future multi-device arc that lets Alice's
desktop and Alice's tablet both hold independent Direct Ratchet sessions with Bob would need **each of Alice's own
devices** to have its own stable, peer-visible identity anyway — which is exactly what a PDD identity file already
provides per physical device (one file per machine, `readOrCreateFedosLocalPeerDeviceAnnouncementIdentity()` is
already scoped to a `filePath`, not to the account). Under Option A, Direct Ratchet's own `localDeviceRef` is
already that same per-machine PDD identity — so a multi-device arc inherits a working "which of my devices is
this" answer for Ratchet for free, rather than having to first reconcile Ratchet's Space-A single-value-per-Runtime
identity (today's `FedosDesktopRuntimeConfig.localDeviceId` is one value per running Runtime instance, matching
the "one account, one Space A identity" assumption Device Pairing was built around) with PDD's already-correct
per-device model.

**Not free**, and worth naming precisely: Option A does nothing about
`FedosDesktopRuntimeConfig.directRatchetMessageDeliveryRemoteDeviceRef` remaining "a single, runtime-wide,
construction-time-fixed device ref" for message-delivery routing (the caveat `01_CURRENT_DEVICE_AUTHORITY.md` §5
already names and explicitly declines to re-verify further) — that limitation is orthogonal to which identity
*space* is used and would need its own separate arc regardless of Option A/B/C.

---

## 10. Honest downsides and risks of Option A specifically

1. **The self-binding write is a new, additive trust-establishing code path** (§3), even though it reuses the
   existing dual-signature authority unmodified. Every new caller of `FedosDeviceBindingRegistrationAuthority` is a
   place a bug could, in principle, write a binding it should not — the mitigation is that this caller signs with
   the node's own real account key and its own freshly-generated device key (the same guarantees §3.1's existing
   precedent already relies on), but this is still new code exercising a security-critical authority, and it needs
   real review, not just "it reuses an existing function so it's safe."
2. **Already-provisioned installations have no retroactive migration path** (§3.5, §7 item 7). Any closed-pilot
   profile whose PDD identity file already exists cannot be self-registered without either (a) accepting that
   Direct Ratchet remains broken for that specific installation until it is re-provisioned, or (b) a separate,
   not-yet-designed mechanism to obtain proof-of-possession for an already-generated (private-key-discarded) PDD
   identity — which structurally cannot exist given the "private key never durably stored" invariant. This is a
   real, not-fully-closed gap this document does not solve, only names.
3. **The forward-secrecy route selector (§1.6) is easy to miss.** It was not named in the recon doc's own sketch,
   and an implementer working strictly from that sketch (session construction, binding, session-id derivation,
   Rust sealing) would ship Option A with the establishment/inbound path correctly using Space B while the
   send-time route-selection path (`selectFedosDirectConversationForwardSecrecyRoute()`) still compares against
   whatever `deps.directRatchet.localDeviceRef` happens to be at that moment — which, if step 3 and step 4 of the
   implementation plan are not both verified together, could silently diverge again in a future refactor even
   after this document's fix ships, since nothing structurally forces these two read sites to agree beyond both
   reading the same composition-root value today.
4. **The per-message Rust header's `sender_device_ref` field is authenticated but never validated** (§1.7 item 2).
   Option A does not introduce this — it is a pre-existing property of `decrypt()` — but Option A does mean this
   field will now, for the first time, actually be populated with a value (Space B) that could meaningfully be
   cross-checked against the Device Registry binding used to resolve the session, and today nothing does that
   cross-check. This is not a regression Option A causes, but Option A is the point at which this dormant gap
   becomes reachable with real, matching cross-account data for the first time — worth a follow-up review, not
   necessarily a blocker for Option A itself.
5. **No cryptographic domain separation between Space A and Space B strings was ever needed before, and still
   isn't strictly required by Option A** — but it is worth stating plainly that Option A relies on the two spaces
   never colliding by construction (a `` `device-${16 hex}` `` string vs. a 32-hex-char CSPRNG string, per
   `fedos_peer_device_announcement_nonce.ts`'s own generator) rather than on any structural, enforced separation.
   Nothing in `resolveFedosDirectRatchetDevicePair()` or the Registry itself would detect or reject a
   pathological future change that made the two generators produce overlapping value shapes; this has always been
   true of the "one flat string keyspace" Registry design (per the recon doc's own §0 explanation of "why the
   Registry lookup itself doesn't already fail this obviously"), and Option A does not change that pre-existing
   property, but it is worth an explicit note since it is exactly the kind of assumption that erodes silently
   across future arcs.
6. **This document, and the investigation behind it, did not execute any code** — every conclusion is from static
   reading and grep. The "no edits needed" claims in §7 item 5 in particular are strong claims (nine files/systems
   asserted to need zero changes) that should be validated by actually running the new bidirectional integration
   test (§8.1) against a real implementation before treating them as final.

---

## Appendix: file inventory read for this document

- `docs/reviews/fedos-peer-device-discovery-current/11_DIRECT_RATCHET_IDENTITY_SPACE_DESIGN_NEXT.md` (full file)
- `docs/reviews/fedos-peer-device-discovery-current/01_CURRENT_DEVICE_AUTHORITY.md` (full file)
- `src/os/messenger/conversations/ratchet/fedos_direct_ratchet_outbound_integration.ts` (full file)
- `src/os/messenger/conversations/ratchet/fedos_direct_ratchet_inbound_integration.ts` (full file)
- `src/os/messenger/conversations/ratchet/fedos_direct_ratchet_device_pair_resolver.ts` (full file)
- `src/os/messenger/conversations/ratchet/fedos_direct_ratchet_session_binding.ts` (full file)
- `src/os/messenger/conversations/ratchet/fedos_direct_ratchet_session_record.ts` (full file)
- `src/os/messenger/conversations/ratchet/fedos_direct_ratchet_state_runtime.ts` (full file)
- `src/os/messenger/conversations/ratchet/fedos_direct_ratchet_cryptographic_session.ts` (full file)
- `src/os/messenger/conversations/ratchet/fedos_direct_ratchet_secret_checkpoint.ts` (full file)
- `src/os/messenger/conversations/ratchet/fedos_direct_ratchet_conversation_runtime.ts` (targeted reads, lines
  ~140-320)
- `src/os/messenger/conversations/ratchet/fedos_direct_conversation_forward_secrecy_route.ts` (full file)
- `src/os/messenger/conversations/ratchet/fedos_sealed_direct_ratchet_secret_record.ts` (targeted reads)
- `src/os/messenger/conversations/ratchet/fedos_direct_ratchet_sealing_authority.ts` (full file)
- `src/os/core/ports/sealing_authority_port.ts` (full file)
- `src/os/messenger/adapters/nostr/conversation_delivery/nip17/fedos_direct_ratchet_nip17_payload.ts` (full file)
- `src/os/messenger/conversations/runtime/fedos_conversation_runtime.ts` (grep + targeted reads, lines ~400-1015)
- `src/os/messenger/desktop/runtime/fedos_desktop_runtime.ts` (targeted reads, lines ~1040-1240)
- `src/os/messenger/desktop/onboarding/fedos_profile_initialization_coordinator.ts` (targeted reads, lines
  ~400-575, ~940-1020)
- `src/os/messenger/conversations/peer_device/fedos_local_peer_device_announcement_identity.ts` (full file)
- `src/os/messenger/conversations/peer_device/fedos_peer_device_announcement_registration_authority.ts` (targeted
  grep)
- `src/os/messenger/conversations/peer_device/fedos_peer_device_announcement_outbound_coordinator.ts` (targeted
  grep)
- `src/os/messenger/desktop/presentation/security_state/fedos_conversation_security_state_controller.ts` (full
  file)
- `src/os/messenger/desktop/shell/fedos_desktop_application_shell.ts` (targeted grep, `directRatchetStatus()`)
- `src/os/messenger/device/fedos_device_binding.ts` (targeted reads, lines 1-60)
- `src/os/messenger/device/persistence/persisted_fedos_device_trust_authority.ts` (targeted reads, lines 85-115)
- `src/os/messenger/desktop/runtime/fedos_device_pairing_facade.ts` (targeted grep, pairing API signatures)
- `packages/fedos-core-rust/src/crypto/direct_ratchet_session.rs` (full read of lines 1-520)
- `packages/fedos-core-rust/src/lib.rs` (targeted grep for `seal_direct_ratchet_secret`/`restore_direct_ratchet_secret`/
  `local_device_ref`/`remote_device_ref`, ~90 matches surveyed)
- Grep-only surveys (no full read; used to build the test-plan inventory and confirm dead-code claims):
  `grep -rn "fedosDirectRatchetSealingDeviceContext" src/`,
  `grep -rn "\.sealAndPersistSecret\(" src/` and `test*/**`,
  `grep -rl "localDeviceRef" test/ packages/fedos-desktop-electron-spike/test/` filtered to ratchet-named files,
  `grep -rl "resolveFedosDirectRatchetDevicePair|FedosDirectRatchetOutboundIntegration|FedosDirectRatchetInboundIntegration|establishDirectRatchetSession|directRatchetMessageDeliveryRemoteDeviceRef" test/`
