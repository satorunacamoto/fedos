# Option B — Additive Space A <-> Space B Translation Layer: Full Design

**Status**: read-only design specification. Written against current HEAD of
`arc/fedos-installed-startup-root-cause`, commit `83dca4ee69dbef22be143ff7ee6257f4063fba6c` (verified via
`git rev-parse HEAD` before writing this document). No source file was edited to produce this document.

**Relationship to prior work**: this document takes §2 ("Design option B") of
`docs/reviews/fedos-peer-device-discovery-current/11_DIRECT_RATCHET_IDENTITY_SPACE_DESIGN_NEXT.md` (the "recon doc")
and turns it into an implementation-ready spec. Every citation below was re-verified against the current tree
during this pass; where the recon doc's own citation was stale or its claim needed correction, that is called out
explicitly rather than silently repeated. Two corrections were found (see §3 and the callout under §0).

---

## 0. Corrections to the recon doc found during re-verification

- **`fedos_profile_initialization_coordinator.ts` localDeviceId derivation line numbers are stale.** The recon doc
  cites `:462-464`. Current code has this at **`src/os/messenger/desktop/onboarding/fedos_profile_initialization_coordinator.ts:524-526`**:
  ```
  524    const deviceKeypair = (this.#deps.generateDeviceKeypair ?? generateFedosDeviceSigningKeypair)();
  525    this.#deviceKeypair = deviceKeypair;
  526    const localDeviceId = this.#deps.localDeviceId ?? `device-${deviceKeypair.publicKeyHex.slice(0, 16)}`;
  ```
  The derivation formula itself (`device-${...slice(0,16)}`) is unchanged and accurately described by the recon doc
  — only the line numbers had drifted (the file grew between when the recon doc was written and now).
- **All other file:line citations checked below (outbound/inbound integration call sites, session binding, sealing
  context, payload shape, session record, `fedos_conversation_runtime.ts:768`) matched the recon doc's own line
  numbers exactly**, including two that are easy to get wrong by one line
  (`fedos_direct_ratchet_state_runtime.ts:370-371,423-425` — recon doc says these exact lines and they are
  correct). This gives reasonable confidence the recon doc was accurate as of its own writing and only this one
  citation drifted from unrelated intervening edits to that file.
- **The recon doc's Option A section claims "nothing registers this node's own PDD identity into the local Device
  Registry as a binding at all."** Re-verified independently (§3 below) via an exhaustive grep of every
  `registerDevice(` call site in `src/os/messenger/` — confirmed still true. This also matters for Option B (see
  §3): it means Option B needs **zero** new Device Registry writes, only the new link table.

---

## 1. New persistence type: `FedosDeviceIdentitySpaceLinkPersistence`

### 1.1 Modeling it on the codebase's own established append-only convention

The closest existing analog is `FedosPeerDeviceAnnouncementObservationV1`
(`src/os/messenger/conversations/peer_device/fedos_peer_device_announcement_observation.ts`) and its backend
`AppendOnlyFedosPeerDeviceAnnouncementObservationPersistence`
(`src/os/messenger/conversations/peer_device/persistence/append_only_fedos_peer_device_announcement_observation_persistence.ts`).
That pattern, confirmed by direct read of both files, is:

- A plain, exhaustively-validated record type with a `schemaVersion` literal, a deterministic JSON-stringified key
  function, a structural-equality function, `encode`/`decode` (NDJSON line) functions, and an `isWellFormed...()`
  validator that rejects any unknown key (`keys.length !== ALL_KNOWN_FIELDS.size`) — fail-closed on any shape
  drift, never silently accepting extra fields.
- A backend (`AppendOnlyFedos...Persistence`) over a single NDJSON log file: `readFileSync`/`appendFileSync` only,
  no delete, no compaction, no rewrite. `putX()` replays the whole log, checks the key: absent -> append
  (`"inserted"`); present + structurally equal -> `"already-present"` (idempotent replay); present + different ->
  `"conflict"` (never silently overwritten). A corrupt or schema-invalid line anywhere in the log throws
  unconditionally on ANY read (fail-closed on corruption, matching this file's own doc comment: "never silently
  regenerates over a corrupt file").

### 1.2 Proposed shape

```
export interface FedosDeviceIdentitySpaceLinkV1 {
  readonly schemaVersion: 1;
  /** Space A — Device Pairing's own `FedosLocalProfileDescriptorV1.localDeviceId`. */
  readonly localDeviceRef: string;
  /** Space B — this same physical device's own Peer Device Discovery `deviceId`
      (`FedosLocalPeerDeviceAnnouncementIdentityV1.deviceId`). */
  readonly peerDeviceAnnouncementDeviceId: string;
  /** The account this link was created under — a link is only ever valid for the
      account that created it (mirrors `PersistedFedosDeviceTrustAuthority`'s own
      "one deviceId belongs to at most one account" invariant, see §3.3). */
  readonly accountRef: FedosDeviceBindingAccountRef;
  /** How this node knows the two identities are the same device — see §5. Starts as
      `"same-process-generation"` (the only proof mechanism that exists today);
      reserved values for a future cryptographic strengthening are enumerated but
      unused until that work lands. */
  readonly proofKind: "same-process-generation";
  readonly createdAt: number;
}
```

Key function (mirrors `fedosPeerDeviceAnnouncementObservationKey()`):
```
JSON.stringify([record.localDeviceRef, record.peerDeviceAnnouncementDeviceId, record.accountRef.authority,
  record.accountRef.publicIdentifier, record.accountRef.identityId])
```
i.e. keyed on the **pair**, not on either identity alone — this matters because it makes a second, conflicting
link for the same `localDeviceRef` (or the same `peerDeviceAnnouncementDeviceId`) show up as a `"conflict"` write
outcome rather than silently succeeding, which is the mechanical hook the negative test in §8 depends on.

Structural-equality / `isWellFormed...()` / `encode`/`decode` functions: identical shape to
`fedosPeerDeviceAnnouncementObservationsAreEqual()` / `isWellFormedFedosPeerDeviceAnnouncementObservationV1()` /
`encodeFedosPeerDeviceAnnouncementObservationV1()` / `decodeFedosPeerDeviceAnnouncementObservationV1()`, adapted to
the fields above — same "reject unknown keys, reject malformed JSON, never throw from decode" discipline.

### 1.3 Backend

`AppendOnlyFedosDeviceIdentitySpaceLinkPersistence`, one new NDJSON log file (own path, own config key, e.g.
`config.deviceIdentitySpaceLinkLogPath`), same `putEvent`-free direct-append shape as
`AppendOnlyFedosPeerDeviceAnnouncementObservationPersistence` (no event-sourcing layer is needed here — a link,
once written, is an immutable, single fact, not a state machine with transitions, so the flatter
observation-persistence pattern is the correct analog, not the heavier `FedosDeviceRegistryPersistence` event-store
pattern used for trust-state transitions).

Interface:
```
export interface FedosDeviceIdentitySpaceLinkPersistence {
  putLink(record: FedosDeviceIdentitySpaceLinkV1): "inserted" | "already-present" | "conflict" | "failed";
  getLinkForLocalDeviceRef(localDeviceRef: string): FedosDeviceIdentitySpaceLinkV1 | null;
  getLinkForPeerDeviceAnnouncementDeviceId(peerDeviceAnnouncementDeviceId: string): FedosDeviceIdentitySpaceLinkV1 | null;
}
```
Both accessor methods are pure reads over `replayLog()`, exactly like
`listObservationsForPeerDevice()`. `"conflict"` on `putLink()` must be surfaced to the caller as a hard failure,
never swallowed — see the invariant in §5.

An in-memory variant (`InMemoryFedosDeviceIdentitySpaceLinkPersistence`) should exist too, mirroring
`InMemoryFedosDeviceRegistryPersistence`, purely for tests/dev.

---

## 2. The exact two call sites, precisely what the adapter does

Both files and line numbers below were read in full and confirmed exactly current.

### 2.1 Outbound — `src/os/messenger/conversations/ratchet/fedos_direct_ratchet_outbound_integration.ts`

`establishSession()` builds the signable content at lines 250-262:
```
250    const signableContent: FedosDirectRatchetSessionResetSignableContent = {
...
256      senderAccountRef: counterparty.localAccountRef,
257      senderDeviceRef: this.#deps.localDeviceRef,
258      recipientAccountRef: counterparty.remoteAccountRef,
259      recipientDeviceRef: remoteDeviceRef,
```
- **Line 257**: `senderDeviceRef` is built directly from `this.#deps.localDeviceRef` — Space A, unchanged by this
  option (per the hard constraint that Ratchet's own internals keep reading Space A).
- **Line 259**: `recipientDeviceRef` is the caller-supplied `remoteDeviceRef` parameter — already Space B (the
  only space a genuine peer identity can come from; see §4).

**Adapter action (outbound, at construction)**: at line 257 only, translate `this.#deps.localDeviceRef` (Space A)
through the new link table to this node's own Space B `peerDeviceAnnouncementDeviceId` **before** it is written
into `senderDeviceRef`. Concretely: a thin wrapper function
`translateLocalDeviceRefToWireSpace(link: FedosDeviceIdentitySpaceLinkPersistence, localDeviceRef: string): string`
that does `link.getLinkForLocalDeviceRef(localDeviceRef)?.peerDeviceAnnouncementDeviceId ?? localDeviceRef` (falls
back to the untranslated value if no link exists yet — see §7 ordering note on why fail-open-to-current-broken-
behavior, not fail-closed, is the correct choice at this one specific point, since failing closed here would newly
break the *existing* same-account/test paths that never needed Space B at all). Line 259 (`remoteDeviceRef`) is
**left untouched** — it is already Space B and must never be translated (there is no local link for a peer's
identity; see §4).

The two other places `this.#deps.localDeviceRef` is used inside `establishSession()`/`sendMessage()`
(`resolveFedosDirectRatchetDevicePair()` calls at lines 154, 184, 205, 218, 308; `FedosDirectRatchetCryptographicSession`
calls at lines 197, 234) are **left completely alone** — those all operate against the Device Registry or the
Rust sealing boundary, both of which are confirmed space-agnostic reads/writes over whatever string is supplied
consistently (see §6), and changing them would violate the "zero change to internals" constraint that is this
option's entire point.

### 2.2 Inbound — `src/os/messenger/conversations/ratchet/fedos_direct_ratchet_inbound_integration.ts`

`#receiveSessionInit()`:
```
276    if (!accountRefsEqual(payload.recipientAccountRef, localAccountRef)) return { outcome: "wrong-recipient" };
277    if (payload.recipientDeviceRef !== this.#deps.localDeviceRef) return { outcome: "wrong-recipient" };
278    if (!accountRefsEqual(payload.senderAccountRef, remoteAccountRef)) return { outcome: "wrong-recipient" };
```
and, further down, the Registry lookup used for the reset-authority signature check:
```
323    const evaluation = this.#deps.resetCoordinator.evaluate({
324      content: signableContent,
325      deviceSignatureHex: payload.deviceSignatureHex,
326      senderDeviceBinding: this.#deps.deviceRegistry.getBinding(payload.senderDeviceRef),
327      locallyKnownPreviousGeneration: priorRecord?.binding.generation ?? null,
328    });
```
- **Line 277**: compares the wire's `payload.recipientDeviceRef` (Space B — it is the value the remote sender put
  there by reading it off *their own* announced peer, i.e. from *this node's* announcement, which is Space B by
  construction) against `this.#deps.localDeviceRef` (Space A). This is the exact mismatch the recon doc's §0
  identifies as the root defect.
- **Line 326**: `deviceRegistry.getBinding(payload.senderDeviceRef)` — `payload.senderDeviceRef` is the remote
  peer's own local `senderDeviceRef`, which (once the outbound-side fix in §2.1 lands) will ALSO be Space B on the
  wire. This call is a Registry read, which — per the recon doc's own confirmed finding, re-verified in §6 below —
  is already space-agnostic, so **no change is needed here**; it will resolve correctly once the wire actually
  carries a real, PDD-announced Space B value for the peer, which is a **precondition of this whole fix
  regardless of which option is chosen**, not something Option B itself creates.

**Adapter action (inbound, at consumption)**: at line 277 only, translate `this.#deps.localDeviceRef` (Space A)
the SAME way as in §2.1 before the comparison: `payload.recipientDeviceRef !== translateLocalDeviceRefToWireSpace(link, this.#deps.localDeviceRef)`.
This makes the comparison Space-B-vs-Space-B, symmetric with what the outbound side now writes.

`payload.senderDeviceRef` at line 284 (used to build `resolveFedosDirectRatchetDevicePair()`'s `remoteDeviceRef`)
and lines 306, 317, 342, 366, 375, 390, 406 (all further downstream consumption of the SAME `payload.senderDeviceRef`
value, or of `this.#deps.localDeviceRef` passed as `localDeviceRef` into the SAME Registry/session/sealing calls
already covered under §2.1's "left alone" list) require **no translation** — they are consistent with the existing
Space A local / Space B remote split that the Registry and session-binding layers already tolerate (§6).

**Symmetry note**: the SAME `translateLocalDeviceRefToWireSpace()` helper is reused at both call sites — one
function, imported by both integration files, never two divergent translation implementations.

---

## 3. This node's own link entry: creation, timing, and rotation

### 3.1 Where both values already co-exist, confirmed

`src/os/messenger/desktop/runtime/fedos_desktop_runtime.ts` constructs BOTH dependency bags in the same function,
back to back:
```
1051  const conversationDirectRatchetDeps: FedosConversationDirectRatchetIntegrationDependencies | undefined =
...
1062          localDeviceRef: config.localDeviceId!,                              // Space A
...
1104  const conversationPeerDeviceAnnouncementDeps: ... =
...
1107      ? (() => {
1108          const localIdentity = readOrCreateFedosLocalPeerDeviceAnnouncementIdentity(config.peerDeviceAnnouncementIdentityLogPath!);
1109          return {
1110            deviceRegistry: deviceRegistryPersistence!,
...
1113            localDeviceRef: config.localDeviceId!,                            // Space A (used only as a LOCAL partition
                                                                                    // key for PDD's own observation records —
                                                                                    // see the note in §3.4, this is NOT the
                                                                                    // identity announced to peers)
1114            localAnnouncedDeviceId: localIdentity.deviceId,                    // Space B — what IS announced to peers
1115            localAnnouncedDevicePublicKeyHex: localIdentity.devicePublicKeyHex,
```
Both `config.localDeviceId` (Space A, sourced from the profile descriptor) and `localIdentity.deviceId` (Space B,
freshly read-or-created at line 1108) are in scope, as plain local variables, in the exact same closure, at
Desktop Runtime assembly time. **This is the natural, lowest-friction place to write the link entry**: right after
line 1108's `readOrCreateFedosLocalPeerDeviceAnnouncementIdentity()` call, before or alongside constructing
`conversationPeerDeviceAnnouncementDeps`, call
`linkPersistence.putLink({ localDeviceRef: config.localDeviceId!, peerDeviceAnnouncementDeviceId: localIdentity.deviceId, accountRef: config.localAccountRef!, proofKind: "same-process-generation", createdAt: now, schemaVersion: 1 })`,
ignoring an `"already-present"` result (idempotent — this runs on every Runtime assembly, i.e. every startup) and
treating `"conflict"`/`"failed"` as a hard startup-time error to surface (never silently continue with an
un-linked or wrongly-linked local identity).

### 3.2 Why "app startup" (Runtime assembly), not "profile-create" or "first PDD identity read"

Three candidate timings exist; only one is safe without new coupling:

- **Profile-create time** (`fedos_profile_initialization_coordinator.ts` step 7, lines 523-526): Space A's
  `localDeviceId` is minted here, but Space B's identity file is deliberately **not** touched by this coordinator
  at all — `readOrCreateFedosLocalPeerDeviceAnnouncementIdentity()` lives in a completely separate module
  (`src/os/messenger/conversations/peer_device/fedos_local_peer_device_announcement_identity.ts`) with no import
  relationship to the profile coordinator, by design (that file's own header: "a SEPARATE, minimal, standalone
  file rather than a new field on the already-large ... state machine"). Writing the link here would require
  either importing PDD's identity module into the profile coordinator (a new, undesirable coupling the original
  Arc explicitly avoided) or leaving Space B ungenerated at profile-create and writing a "half" link — worse than
  not writing one.
- **First PDD identity read** (inside `readOrCreateFedosLocalPeerDeviceAnnouncementIdentity()` itself): this
  function's own file has zero knowledge of Space A (`config.localDeviceId` is never passed to it — confirmed by
  reading the full file; its only inputs are `filePath`). Writing the link from inside it would require widening
  its signature with a new required Space A parameter, touching a frozen, minimal, single-purpose file for a
  concern (cross-space linking) that is arguably layered *above* it.
- **Runtime assembly / app startup** (`fedos_desktop_runtime.ts`, §3.1): **correct** — both values are already
  resolved and in scope with zero new imports, zero widened signatures on either existing identity module, and it
  runs exactly once per process start (idempotent thereafter via `putLink()`'s `"already-present"` outcome). This
  is also the natural place because it is where `conversationDirectRatchetDeps` and
  `conversationPeerDeviceAnnouncementDeps` are ALREADY assembled side by side today.

### 3.3 Can either identity ever rotate independently today? — verified, both effectively no, but for different reasons

- **Space B (PDD `deviceId`)**: `readOrCreateFedosLocalPeerDeviceAnnouncementIdentity()`'s own doc comment states
  it explicitly: "Idempotent... every subsequent call... reads the SAME, already-persisted values back... Throws
  only on a genuinely corrupt/schema-invalid file... never silently regenerates." There is no rotation path in
  the file at all — the only way `deviceId` changes is deleting the identity file out from under the process,
  which is corruption, not rotation.
- **Space A (`localDeviceId`)**: a real rotation *mechanism* exists in source —
  `src/os/messenger/device/fedos_device_replacement_coordinator.ts` (`FedosDeviceReplacementCoordinator`) —
  registers a brand-new Device identity (new `deviceId`, new keypair) and revokes the old one, per its own header
  ("the replacement Device is ALWAYS registered as a brand-new Device identity"). **However, this class has zero
  callers anywhere in `src/os/messenger/desktop/` (`fedos_desktop_runtime.ts`, `fedos_desktop_application_shell.ts`,
  `fedos_device_pairing_facade.ts`, `fedos_device_trust_runtime.ts` — all grepped, all empty) and zero callers
  anywhere in `src/` outside its own file and one unrelated type-only reference in
  `fedos_ratchet_peer_lifecycle_notification.ts`.** It is unreachable from the production Desktop Runtime today —
  confirmed by direct grep, not inferred. Separately, even if it *were* wired up, nothing in the coordinator
  itself updates `FedosLocalProfileDescriptorV1.localDeviceId` (the field Ratchet's own `deps.localDeviceRef`
  ultimately reads, via `config.localDeviceId` at `fedos_conversation_runtime.ts:768`) — that would be an entirely
  separate, currently-nonexistent wiring gap.

**Conclusion for the design**: in the SHIPPED system today, neither identity ever rotates once created. The link
is therefore a true create-once, durable-forever fact for the lifetime of a profile — no update/rotation code path
needs to exist in this option's v1. If Space A rotation is ever wired up in the future (a separate, currently
orphaned piece of work), the link table's `putLink()` semantics (key on the pair, `"conflict"` on a second,
different pairing) will correctly refuse to silently re-link without an explicit, new decision — that refusal is a
feature, not a gap, matching the "never silently overwrite" discipline `06_PROTOCOL_CONTRACT_FREEZE.md` §7 item 3
already establishes for a related case.

### 3.4 One more precision the recon doc did not surface: Space A is ALSO used inside PDD, but only as a local partition key

`fedos_desktop_runtime.ts:1113` passes `config.localDeviceId!` (Space A) into
`conversationPeerDeviceAnnouncementDeps.localDeviceRef` too — but that field is consumed by
`FedosPeerDeviceAnnouncementObservationV1.localDeviceRef`
(`src/os/messenger/conversations/peer_device/fedos_peer_device_announcement_observation.ts:29`, doc comment:
"Which LOCAL device recorded this — multi-device isolation, mirrors peer_capability") purely as a **local storage
partition key** for this node's own observation records, never transmitted to a peer and never compared against a
wire value. This is a third, narrow use of Space A that Option B does **not** need to touch — it is internal
bookkeeping, not a wire-boundary concern, and mixing it up with the two real translation points in §2 would be a
scope-creep mistake worth flagging explicitly so a future implementer doesn't "fix" it unnecessarily.

---

## 4. Would a PEER's Space A<->Space B link ever be needed? — verified true today, with one explicit caveat

Every current call site that resolves a **remote** device was traced:

- `fedos_direct_ratchet_outbound_integration.ts` — `remoteDeviceRef` is always a caller-supplied parameter
  (`establishSession(conversationId, remoteDeviceRef, ...)`, `sendMessage(conversationId, envelopeId,
  remoteDeviceRef, ...)`), never resolved from Space A anywhere in this file.
- `fedos_direct_ratchet_inbound_integration.ts` — the remote device identity is always `payload.senderDeviceRef`
  (wire-supplied, Space B once the fix lands) or, for the message path, implicitly re-derived from the already-
  established `sessionMetadata.binding.remoteDeviceRef` (itself originally set from `payload.senderDeviceRef` at
  session-init time — never re-resolved from Space A).
- `fedos_conversation_security_state_controller.ts:90-101` — `chosenDevice` comes from
  `this.#shell.peerDeviceAnnouncementListObserved()` (Space B, PDD's own observation list) and its `.deviceId` is
  passed straight into `directRatchetStatus(conversationId, chosenDevice.deviceId)` — confirmed by direct read,
  never touches Space A for the remote side.
- `fedos_safety_center_controller.ts:130` — `pair.remoteDeviceRef` passed into the same
  `directRatchetStatus()` — same shell method, same Space B contract.
- `fedos_desktop_application_shell.ts:1055,1111` — both `directRatchetStatus()` call sites take a bare
  `remoteDeviceRef: string` parameter with no space-specific handling of their own; whatever space the caller
  supplies (confirmed Space B at both actual call sites above) flows straight through to
  `FedosDirectRatchetConversationRuntime.getDirectRatchetStatus()` -> `resolveFedosDirectRatchetDevicePair()`'s
  `remoteDeviceRef`, which is a bare Registry `getBinding()` key (space-agnostic, §6).

No call site anywhere in the reachable production tree ever needs a peer's Space A identity, because **a genuine
cross-account peer has no Space A identity from this node's perspective at all** — Space A
(`FedosLocalProfileDescriptorV1.localDeviceId`) is a value each node mints for *itself only*; there is no protocol
message anywhere in this codebase that carries a peer's own profile-descriptor `localDeviceId` to another node
(Device Pairing's `localDeviceId` semantics are explicitly scoped to same-account multi-device pairing, never
cross-account — confirmed by the recon doc's own §1 "Invariants" bullet, itself consistent with
`01_CURRENT_DEVICE_AUTHORITY.md`'s framing, which this pass did not need to re-open).

**Caveat**: this conclusion holds only for TODAY's reachable code. If a future arc ever needs THIS node to prove
identity continuity of a peer's device across the peer's own device-replacement event (i.e., "the peer's new
Space B `deviceId` is the same physical device as their old one"), that is a `peerDeviceAnnouncementSupersedesId`-
style Space-B-to-Space-B continuity question (already partially modeled by
`FedosPeerDeviceAnnouncementObservationV1.supersedesAnnouncementId`), not a Space-A-involving one — so it does not
change this section's conclusion, but is worth naming so nobody mistakes it for the same problem later.

---

## 5. The security invariant: what proof does this node actually have?

### 5.1 The proof mechanism that exists today

Verified directly: **there is no cryptographic binding between the two keypairs at all.** Two entirely
independent calls to `generateFedosDeviceSigningKeypair()` / `FedosDeviceSigningKeypair.generate()`
(`src/os/messenger/device/crypto/fedos_device_signing_keypair.ts:69-71`, using
`schnorr.utils.randomSecretKey()`) happen at two different times, in two different files
(`fedos_profile_initialization_coordinator.ts:524` and
`fedos_local_peer_device_announcement_identity.ts:101`), with **zero code path connecting them** — confirmed by a
repo-wide grep for `cross-sign`/`crossSign`/`cross_sign`, which returned no results anywhere in `src/`.

The ONLY thing that makes this node's own Space A device and Space B device "the same device" is: **both
generation calls happen inside the same local process, during the same Desktop Runtime startup sequence, on the
same machine, for the same profile** — i.e., "implicit process co-location," exactly as the task description
anticipated. There is no signature, no shared secret, no attestation — just "this process generated both, and
this process is the one writing the link."

### 5.2 Is that sufficient? — a real assessment, not a sales pitch

**For this node's own link specifically, "implicit process co-location" is arguably adequate, with one important
caveat**, because:
- The link only ever needs to establish a fact ABOUT THIS PROCESS ITSELF, for its own later use — it is never
  transmitted to a peer, never used to authenticate anything to a third party, and never crosses a trust boundary.
  A wrong link here can only ever misconfigure *this node's own* outgoing/incoming wire values (see §5.3 for what
  that concretely breaks), not forge an identity claim a peer would ever be asked to trust.
- The two values it links are already each independently durable and already each independently the "real"
  identity for their own subsystem — the link doesn't grant new authority, it only records an already-true local
  fact.

**But it is not free of risk, and does need one hardening this section names explicitly**: process co-location is
only as trustworthy as "startup only ever runs the real Runtime assembly code path once, for the real profile."
The concrete failure mode: if `fedos_desktop_runtime.ts`'s link-writing code (§3.1) were ever accidentally invoked
against the WRONG `config.localDeviceId`/`localIdentity.deviceId` pair — e.g. a test harness or a future
multi-profile feature that constructs the Runtime with mismatched config for two different profiles sharing one
process — the link table has **no independent way to detect that the pairing is wrong**, because "same process"
is the entire proof. This is exactly the "new vulnerability class" the recon doc's own §2 flags: *a link, once
written, is trusted without re-derivation*, so a poisoned link (right shape, wrong pairing) is indistinguishable
from a correct one to every downstream reader.

**Recommended strengthening (not required for a correct v1, but should be scoped as an immediate follow-up, not
deferred indefinitely)**: a real cross-signature is technically available with **zero new durable secret
storage**, because of a real, verified timing fact — `fedos_profile_initialization_coordinator.ts` keeps the
freshly-generated Space A `deviceKeypair` in an in-memory instance field (`#deviceKeypair`, declared at line 324,
set at line 525, only nulled at line 703-705) for the remainder of the `createProfile()` call, which itself calls
`#startAndBootstrap()` (line 558) — the same call chain that, per `fedos_desktop_runtime.ts`'s own construction
order (§3.1), is where the PDD Space B keypair gets freshly generated too (inside
`readOrCreateFedosLocalPeerDeviceAnnouncementIdentity()`, line 101 of that file). **Both raw private keys are
plausibly alive in the SAME process's memory during the SAME `createProfile()` call**, before either goes out of
scope — the exact window needed to have the Space A key sign a `("this Space A device attests it is the same
physical device as", spaceBDevicePublicKeyHex)` statement (or vice versa, or both) using the already-existing
`FedosDeviceSigningKeypair.sign()` method (`fedos_device_signing_keypair.ts:77-79`) — no new keys, no new durable
secret storage, no violation of the "no durable Device-private-key storage exists anywhere" boundary
(`01_CURRENT_DEVICE_AUTHORITY.md` §1.3), since only the resulting **signature** (public, safe) would be persisted
alongside the link, not either private key. This would upgrade `proofKind` from `"same-process-generation"` to a
real `"cross-signed"` value verifiable independently of trusting "the process that wrote this link was honest."
**This pass did not verify the exact call-order-in-time overlap precisely enough to guarantee the two private keys
are simultaneously alive without a targeted trace/instrumented test — that verification is real, scoped follow-up
work, not something to assume true from static reading alone.**

### 5.3 What a wrong link concretely breaks if untreated

Since the link is consulted only at the two wire-boundary points in §2, a wrong (poisoned) link causes:
outbound: `senderDeviceRef` on this node's own `session-init` gets set to some OTHER `peerDeviceAnnouncementDeviceId`
than this node's real one, which a genuine peer would then durably record via
`fedosPeerDeviceAnnouncementRegistrationAuthority.registerDevice()` variants (already-shipped, described in §1's
sibling file) as belonging to THIS node's account under the wrong device id; inbound: the `recipientDeviceRef`
comparison at the (translated) line 277 would compare against the wrong Space B value and reject a genuine,
correctly-addressed peer message as `"wrong-recipient"`. Both are availability/correctness failures for THIS
node's own traffic, not a cross-account impersonation of anyone else — consistent with §5.2's assessment that the
blast radius is local, not a trust-boundary breach.

---

## 6. `FedosDirectRatchetSessionRecordV1.binding.{localDeviceRef,remoteDeviceRef}` — confirmed no downstream translation-awareness needed

Traced every consumer of `binding.localDeviceRef`/`binding.remoteDeviceRef`:

- **`resolveFedosDirectRatchetDevicePair()`** (`fedos_direct_ratchet_device_pair_resolver.ts:164,169`) — calls
  `deviceRegistry.getBinding(request.localDeviceRef)` and `deviceRegistry.getBinding(request.remoteDeviceRef)`.
  `FedosDeviceRegistryPersistence.getBinding(deviceId: string)` (`fedos_device_registry_persistence.ts:35`) is a
  bare `string -> FedosDeviceBindingV1 | null` lookup with **no space tag anywhere in its own type or
  implementation** (`reconstructFedosDeviceBindingRecord()`, same file, operates purely on whatever `deviceId`
  string keyed the events) — confirmed genuinely space-agnostic, matching the recon doc's claim exactly.
- **`fedosDirectRatchetSealingDeviceContext(accountRef, deviceRef)`** (`fedos_direct_ratchet_session_binding.ts:39-41`)
  — builds an opaque `"authority::publicIdentifier::deviceRef"` KDF context string, consumed only as one-way
  context bytes by Rust's `sealDirectRatchetSecret`/`restoreDirectRatchetSecret`
  (`fedos_direct_ratchet_state_runtime.ts:369-371,423-425`) — confirmed the Rust boundary never interprets or
  splits this string (per that function's own doc comment, re-quoted accurately by the recon doc). Since Option B
  keeps `binding.localDeviceRef`/`remoteDeviceRef` in Space A/B exactly as today (no persisted-binding-shape
  change), this context string is **byte-identical to today's**, for every already-established or newly-
  established session — zero re-sealing migration required, confirming the recon doc's "smaller-blast-radius
  sub-choice" framing.
- **`fedosDirectRatchetSessionBindingsEqual()`** (`fedos_direct_ratchet_session_binding.ts:44-60`) — pure
  structural string/number equality, no space semantics of its own.
- **`toFedosDirectRatchetSessionId()`** consumption inside `resolveFedosDirectRatchetDevicePair()` (lines 202-217)
  — builds the shared session id string from the SAME `localDeviceRef`/`remoteDeviceRef` values passed in; since
  Option B never changes what is passed in as `localDeviceRef`/`remoteDeviceRef` to this function (only the wire
  payload fields get translated, at the boundary, before/after this function is ever called), the session id
  construction is untouched.

**Conclusion, confirmed**: nothing downstream of binding construction needs to know a translation occurred.
Translation is a pure wire-boundary concern under this design, exactly as §2 specifies — this was independently
re-verified line-by-line rather than taken on the recon doc's word.

---

## 7. Ordered implementation plan (no code written — precise enough to need no further research)

1. **New files — the link record type and its persistence port + backend**, modeled exactly on §1:
   - `src/os/messenger/conversations/ratchet/fedos_direct_ratchet_device_identity_space_link.ts` (or a
     `device/` location if preferred — but `ratchet/` is where the ONLY consumer lives, matching this
     codebase's own "model directly on the consuming subsystem, don't over-generalize" precedent cited by
     `fedos_direct_ratchet_inbound_integration.ts`'s own header) — the record type, key function, equality
     function, encode/decode, `isWellFormed...()`.
   - `.../persistence/fedos_direct_ratchet_device_identity_space_link_persistence.ts` — the port interface
     (`FedosDeviceIdentitySpaceLinkPersistence`).
   - `.../persistence/append_only_fedos_direct_ratchet_device_identity_space_link_persistence.ts` — the NDJSON
     backend, modeled line-for-line on
     `append_only_fedos_peer_device_announcement_observation_persistence.ts`.
   - `.../persistence/in_memory_fedos_direct_ratchet_device_identity_space_link_persistence.ts` — test/dev double.
2. **New tiny translation helper** — one new file,
   `src/os/messenger/conversations/ratchet/fedos_direct_ratchet_device_identity_space_translation.ts`, exporting
   `translateLocalDeviceRefToWireSpace(link: FedosDeviceIdentitySpaceLinkPersistence, localDeviceRef: string): string`
   (§2.1's fallback-to-untranslated-if-absent semantics) — kept as ONE function reused by both integration files,
   never duplicated.
3. **Wire the link write into `fedos_desktop_runtime.ts`** at the point identified in §3.1 (immediately after the
   existing `readOrCreateFedosLocalPeerDeviceAnnouncementIdentity()` call at line 1108, inside the same
   `conversationPeerDeviceAnnouncementDeps` construction closure) — construct the
   `AppendOnlyFedosDeviceIdentitySpaceLinkPersistence` (a new config path,
   `config.deviceIdentitySpaceLinkLogPath`, following the exact same optional-path-gated-construction pattern
   every sibling `AppendOnlyFedos...Persistence` in this file already uses) and call `putLink()`, treating
   `"conflict"`/`"failed"` as a startup-time hard error surfaced through this function's existing error-signaling
   convention (grep the surrounding function for how other startup-time persistence failures are currently
   surfaced, and match it — do not invent a new error channel).
4. **Thread the new `FedosDeviceIdentitySpaceLinkPersistence` into
   `FedosDirectRatchetOutboundIntegrationDependencies`** (`fedos_direct_ratchet_outbound_integration.ts:109-131`)
   and **`FedosDirectRatchetInboundIntegrationDependencies`** (`fedos_direct_ratchet_inbound_integration.ts:132-155`)
   as one new required field, `readonly deviceIdentitySpaceLink: FedosDeviceIdentitySpaceLinkPersistence;` on each.
5. **Apply the translation at exactly the two points in §2**: outbound line 257
   (`senderDeviceRef: translateLocalDeviceRefToWireSpace(this.#deps.deviceIdentitySpaceLink, this.#deps.localDeviceRef)`)
   and inbound line 277
   (`if (payload.recipientDeviceRef !== translateLocalDeviceRefToWireSpace(this.#deps.deviceIdentitySpaceLink, this.#deps.localDeviceRef)) return { outcome: "wrong-recipient" };`).
   No other line in either file changes.
6. **Wire the new dependency through the construction chain**: `FedosDirectRatchetConversationRuntime`'s
   constructor (`fedos_direct_ratchet_conversation_runtime.ts:139-195`) already forwards every dependency it
   receives straight into `#outbound`/`#inbound` — add `deviceIdentitySpaceLink` to
   `FedosDirectRatchetConversationRuntimeDependencies` (line ~89, alongside `localDeviceRef`) and forward it at
   both construction sites (lines 154-169 and 171-194). Then update
   `conversationDirectRatchetDeps` in `fedos_desktop_runtime.ts` (the object built at lines 1051-1080) to include
   the SAME `AppendOnlyFedosDeviceIdentitySpaceLinkPersistence` instance constructed in step 3 — never a second,
   divergent instance (mirrors this file's own existing "one shared `deviceRegistryPersistence!`" discipline used
   for `deviceRegistry` throughout).
7. **No changes anywhere else** — not to `fedos_direct_ratchet_device_pair_resolver.ts`, not to
   `fedos_direct_ratchet_session_binding.ts`, not to `fedos_direct_ratchet_state_runtime.ts`, not to
   `fedos_direct_ratchet_nip17_payload.ts`'s schema, not to `fedos_direct_ratchet_session_record.ts`'s schema —
   confirmed unnecessary by §6.

---

## 8. Test plan

### 8.1 Positive/wiring tests (mirror this codebase's own existing acceptance-test style)

- **Link creation on startup**: assemble a Desktop Runtime twice against the same profile directory (simulating a
  restart); assert `getLinkForLocalDeviceRef(config.localDeviceId)` returns the SAME record both times (idempotent
  `"already-present"` on the second run), and that its `peerDeviceAnnouncementDeviceId` equals
  `readOrCreateFedosLocalPeerDeviceAnnouncementIdentity()`'s own already-durable `deviceId` for that profile.
- **Outbound translation**: unit-test `FedosDirectRatchetOutboundIntegration.establishSession()` with a real
  `AppendOnlyFedosDeviceIdentitySpaceLinkPersistence` pre-seeded with a link; assert the resulting
  `FedosDirectRatchetSessionInitPayloadV1.senderDeviceRef` equals the link's `peerDeviceAnnouncementDeviceId`, NOT
  `deps.localDeviceRef`.
- **Inbound translation**: unit-test `#receiveSessionInit()` with a `payload.recipientDeviceRef` set to a Space B
  value and a pre-seeded link mapping `deps.localDeviceRef` to that same Space B value; assert the outcome is no
  longer `"wrong-recipient"` (i.e., the specific regression this whole arc exists to fix).
- **Full bidirectional live test** (the closest analog to the already-existing
  `direct_ratchet_bidirectional_packaged_binary_real_electron.test.ts`, scenario c, cited in the recon doc's own
  header): run two independent real packaged-binary instances (Alice, Bob), each with the fix applied, and confirm
  BOTH sides reach `"active"` — the currently-broken end-to-end case.

### 8.2 The negative test that catches a wrong/poisoned link — designed concretely

**Scenario**: seed the link persistence with a link entry that maps THIS node's real `localDeviceRef` to a
`peerDeviceAnnouncementDeviceId` that is **not** this node's own PDD identity — e.g. a value copied from a
different (attacker-controlled or merely different-test-fixture) profile's PDD identity file, simulating exactly
the "process co-location proof was violated" failure mode named in §5.2 (a misconfigured test harness or a future
multi-profile bug writing the wrong pairing).

**Setup**:
1. Real profile A, real PDD identity A (`deviceId = "aaaa...aaaa"`).
2. Real profile B (a second, independent test fixture, never actually running as this process's own Runtime),
   real PDD identity B (`deviceId = "bbbb...bbbb"`).
3. Manually `putLink({ localDeviceRef: profileA.localDeviceId, peerDeviceAnnouncementDeviceId: "bbbb...bbbb", ... })`
   — i.e., profile A's Space A device wrongly linked to profile B's Space B device.
4. Construct `FedosDirectRatchetOutboundIntegration` with profile A's real deps, including this poisoned link.
5. Call `establishSession()` for a real, already-membership-valid conversation with a real, `"trusted"`-bound
   remote device.

**Expected (documenting the CURRENT design's honest gap, not a claim of prevention)**: the outbound `session-init`
payload's `senderDeviceRef` is silently `"bbbb...bbbb"` — profile B's identity, not profile A's own. **This test
should assert that this DOES happen** (i.e., it is a demonstration/regression-pinning test proving the
translation layer trusts the link unconditionally, exactly as designed in v1 — "read-only inference over
already-verified facts, never a NEW trust decision" per the recon doc's own §2 invariant, which explicitly means
this layer does NOT re-derive or re-verify the pairing itself). This is the concrete evidence that `proofKind:
"same-process-generation"` is doing all the work, and that a wrong link is currently **undetectable and
unprevented** by anything in this design other than "don't write a wrong link in the first place" — which is
exactly why §5.2's blast-radius argument (limited to this node's own traffic, no cross-account trust breach) is
the operative safety argument for shipping v1 without the cross-signing strengthening, and why that strengthening
should be tracked as explicit, scoped follow-up rather than silently deferred forever.

A SECOND variant of this test should additionally assert `putLink()` itself refuses a **second, different**
pairing for the same `localDeviceRef` once a link already exists (the `"conflict"` outcome from §1.2's pair-keyed
design) — proving that ONE class of poisoning (a later, competing write) is mechanically prevented, even though
the FIRST write being wrong (the scenario above) is not.

---

## 9. Multi-device implications — Option B vs. Option A (unification)

**This node having 2+ Space A devices** (a future same-account multi-device arc): Option B's link table is keyed
`(localDeviceRef, peerDeviceAnnouncementDeviceId, accountRef)` per §1.2 — each of this node's own Space A devices
would need its OWN independent Space B PDD identity file and its OWN link row (since
`readOrCreateFedosLocalPeerDeviceAnnouncementIdentity()`'s `filePath` parameter is already per-installation, this
falls out naturally: N Space A devices -> N independent PDD identity files -> N link rows, no schema change
needed). Option A, by contrast, would need Ratchet to resolve "which of my N Space A devices maps to which single
canonical identity" directly inline wherever `deps.localDeviceRef` is read today — since Option A's whole premise
is collapsing to ONE space, it would need to either give up the "N independent local devices" model entirely (make
Space B canonical everywhere, meaning each device already naturally has its own Space B identity — actually fine)
or introduce its OWN per-device selection logic at every read site. On reflection, **for the specific "N local
devices" case, Option A and Option B end up structurally similar in effort** — both ultimately need one Space-B-
shaped (or Space-B-becomes-canonical) identity per local device; Option B's advantage is that it never has to
touch the ALREADY-shipped Space A same-account pairing flow (`FedosDeviceBindingRegistrationAuthority`) at all,
whereas Option A explicitly would (per the recon doc's own Option A section: "a local self-binding under Space B
would need to be created").

**A peer having multiple devices**: this is already Space B on both options (§4) — peers never had a Space A
identity from this node's perspective under either option, so multi-device peers are identical complexity under
A and B; this dimension does not differentiate them.

**Net verdict on this axis**: Option B scales at least as well as Option A for "this node has multiple devices,"
and strictly better for "avoid touching the already-shipped Space A same-account pairing flow." Neither option is
differentiated by "peer has multiple devices."

---

## 10. Honest downsides and risks of Option B (not a sales pitch)

- **Permanent, not one-time, maintenance cost.** Option A's migration cost is paid once (a single cutover, plus a
  one-time Registry self-binding write per the recon doc's own Option A section) and then the codebase has ONE
  identity space forever. Option B instead adds a THIRD durable artifact (the link table) that must be created
  correctly at every future code path that ever assembles a Desktop Runtime for a real profile (today: one path,
  `fedos_desktop_runtime.ts`; tomorrow, if a second Runtime-assembly path is ever added — e.g. a headless/CLI mode,
  or a test harness that legitimately wants real translation behavior — that path must ALSO remember to write the
  link, or the fallback-to-untranslated behavior in §2.1 silently reverts to today's broken cross-account mismatch
  for that path). This is a standing tax on every future integrator, not a cost that is paid down over time.
- **A new persistence type is a new thing that can be corrupted, lost, or omitted from backup/restore tooling.**
  Every other durable fact in this subsystem (session records, sealed secrets, reset records, observations) is
  already accounted for in whatever backup/export code exists; the link table would need to be added to that
  inventory too, and forgetting it produces a SILENT, hard-to-diagnose failure mode after a restore: Space A and
  Space B both still independently exist and are individually valid, but the link connecting them is gone, so the
  translated `senderDeviceRef` reverts to an untranslated Space A value with no error, no crash — just quietly
  broken cross-account handshakes again, indistinguishable from the ORIGINAL bug this whole arc exists to fix.
  This is arguably the single most dangerous downside: **the failure mode of a lost/never-written link is
  identical to the failure mode of never having built this fix at all**, and nothing in the design surfaces that
  distinction to an operator.
- **The "read-only inference, never a new trust decision" framing undersells the real exposure.** §5.2/§5.3
  established the blast radius is local (this node's own traffic only) — but that argument depends on EVERY future
  reader of the link table respecting that scope forever. If a future feature ever starts trusting the link table
  for something with cross-account consequences (e.g., using it to auto-resolve a "which Space A device is this"
  question during a security-sensitive flow, rather than only at the two narrow wire-boundary points specified
  here), the "it's just local bookkeeping" safety argument silently stops applying, and nothing in the type system
  prevents that scope creep — it is an API-discipline invariant, not a compiler-enforced one.
  `FedosDeviceIdentitySpaceLinkPersistence`'s own interface should be kept as narrow as possible (only the two
  accessor methods in §1.3) specifically to make misuse harder, but that is a mitigation, not a guarantee.
  Recommend: comment the type/file header explicitly with "consumed ONLY by the two translation call sites in
  fedos_direct_ratchet_outbound_integration.ts/inbound_integration.ts — any new caller is a design review trigger,"
  mirroring this codebase's own established pattern of naming a boundary's own scope in its header comment.
  Renaming: keep the CURRENT method-name/type-narrowness as the actual enforcement, not just the comment.
- **Option A has a real, structural advantage this document should not undersell**: once done, Option A leaves the
  codebase with ONE identity space and ZERO ongoing translation code to reason about ever again — every future
  contributor reading `deps.localDeviceRef` anywhere in Ratchet code sees a value that IS the wire-compatible
  value, with no "is this translated yet?" question ever arising. Option B permanently bifurcates "what Ratchet's
  internals call `localDeviceRef`" from "what the wire actually carries," which is exactly the kind of two-
  meanings-one-name confusion that produced the ORIGINAL bug this arc is fixing in the first place (Space A and
  Space B both being informally called "this local device's identity" is what let the mismatch ship undetected).
  Shipping Option B does not eliminate that root pattern — it adds a translation layer ON TOP of it, permanently.
- **Zero peer-visible interoperability benefit over Option A**: since neither option changes the wire schema (both
  confirmed byte-identical to today's shape), Option B's much-touted "smallest wire footprint" advantage (recon
  doc §2) is not actually a DIFFERENTIATOR versus Option A on this specific axis — both options are wire-schema-
  neutral. The real trade-off is entirely internal-code-shape (permanent two-space bifurcation + translation vs.
  one-time internal migration to one space), not external compatibility, and should be evaluated as such.

---

## Appendix: files read in full or via targeted grep during this pass (beyond the recon doc's own inventory)

- `src/os/messenger/conversations/ratchet/fedos_direct_ratchet_outbound_integration.ts` (full file)
- `src/os/messenger/conversations/ratchet/fedos_direct_ratchet_inbound_integration.ts` (full file)
- `src/os/messenger/conversations/peer_device/fedos_local_peer_device_announcement_identity.ts` (full file)
- `src/os/messenger/desktop/onboarding/fedos_profile_initialization_coordinator.ts` (targeted, lines 400-560, plus
  grep for every `localDeviceId`/`deviceKeypair` occurrence)
- `src/os/messenger/conversations/ratchet/fedos_direct_ratchet_device_pair_resolver.ts` (full file)
- `src/os/messenger/conversations/ratchet/fedos_direct_ratchet_session_binding.ts` (full file)
- `src/os/messenger/conversations/peer_device/fedos_peer_device_announcement_observation.ts` (full file)
- `src/os/messenger/conversations/peer_device/persistence/append_only_fedos_peer_device_announcement_observation_persistence.ts` (full file)
- `src/os/messenger/desktop/presentation/security_state/fedos_conversation_security_state_controller.ts` (targeted,
  lines 60-120)
- `src/os/messenger/desktop/runtime/fedos_desktop_runtime.ts` (targeted, lines 1030-1160, plus grep for
  `deviceRegistryPersistence!`/`PersistedFedosDeviceTrustAuthority`)
- `src/os/messenger/conversations/runtime/fedos_conversation_runtime.ts` (grep for `localDeviceRef` occurrences;
  confirmed line 768)
- `src/os/messenger/conversations/ratchet/fedos_direct_ratchet_conversation_runtime.ts` (targeted, lines 1-260)
- `src/os/messenger/desktop/shell/fedos_desktop_application_shell.ts` (targeted, lines 1095-1130, plus grep for
  `directRatchetStatus`/`getDirectRatchetStatus`)
- `src/os/messenger/device/persistence/fedos_device_registry_persistence.ts` (full file)
- `src/os/messenger/device/persistence/persisted_fedos_device_trust_authority.ts` (targeted, lines 1-110)
- `src/os/messenger/device/crypto/fedos_device_signing_keypair.ts` (full file)
- `src/os/messenger/device/fedos_device_replacement_coordinator.ts` (targeted, lines 1-60, plus grep confirming
  zero production callers)
- `src/os/messenger/adapters/nostr/conversation_delivery/nip17/fedos_direct_ratchet_nip17_payload.ts` (targeted,
  lines 108-183)
- `src/os/messenger/conversations/ratchet/fedos_direct_ratchet_session_record.ts` (grep for `binding`-related
  fields/lines)
- Repo-wide grep for `registerDevice(` (every call site, to confirm §3's "no self-binding write exists" claim)
- Repo-wide grep for `cross-sign`/`crossSign`/`cross_sign` (confirmed zero results, for §5.1)
