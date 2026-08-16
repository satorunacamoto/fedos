# Direct Ratchet Cross-Account Identity-Space Mismatch — Exhaustive Search for an Existing Canonical Primitive

**Status**: Read-only investigation (Agent C). No source file was edited to produce this document. Written against
`arc/fedos-installed-startup-root-cause` at commit `83dca4ee69dbef22be143ff7ee6257f4063fba6c`.

**Mandate**: independently re-verify §3 of
`docs/reviews/fedos-peer-device-discovery-current/11_DIRECT_RATCHET_IDENTITY_SPACE_DESIGN_NEXT.md` (the prior
recon doc's "Design option C — search for an existing canonical identity primitive") and exhaustively search the
current repo state for any OTHER existing primitive that could avoid choosing between that doc's Option A (unify
to Space B) and Option B (translation layer). Every claim below is cited to a specific file/line read this session,
not carried over from the prior doc uncritically.

**Bottom line up front**: no third way was found. The prior doc's own §3 conclusion — that `devicePublicKeyRef`
is real but not currently a free shortcut, because it collapses back into "which of A/B do you use to make the two
subsystems derive from the SAME keypair" — is CONFIRMED, and this session found additional evidence that makes the
"not currently canonical" verdict even stronger than the prior doc stated (see §1.3). No third identity space, no
abandoned unification attempt, and no usable account-level fallback exist anywhere in the current repo.

---

## 1. Re-verification of `devicePublicKeyRef`/`devicePublicKeyHex` (task item 1)

### 1.1 All `generateFedosDeviceSigningKeypair()` call sites in the repo (exhaustive)

The function is defined exactly once:
`src/os/messenger/device/crypto/fedos_device_signing_keypair.ts:83` —
`export function generateFedosDeviceSigningKeypair(): FedosDeviceSigningKeypair`.

Every call site in the ENTIRE repo (production `src/`, not counting the ~60 test-file call sites which all
construct throwaway keypairs for test fixtures and are not a fourth identity space):

| Call site | Role |
|---|---|
| `src/os/messenger/desktop/onboarding/fedos_profile_initialization_coordinator.ts:524` | Device Pairing — Space A. Generates `deviceKeypair` at profile-create time; `localDeviceId` is derived from it one line later (`:526`). **Line number has drifted from the prior doc's citation of `:462-464` — see §1.2.** |
| `src/os/messenger/conversations/peer_device/fedos_local_peer_device_announcement_identity.ts:101` | Peer Device Discovery — Space B. Generates a fresh keypair inside `readOrCreateFedosLocalPeerDeviceAnnouncementIdentity()`, used only the first time (no existing identity file); the private half is discarded immediately after `devicePublicKeyHex` is captured. Matches the prior doc's citation exactly (line number unchanged). |
| `src/os/messenger/desktop/shell/fedos_desktop_application_shell.ts:692` (`devicePairingCreate()`) | **Not cited by the prior doc.** This is the JOINING-device side of the SEPARATE Device Transfer/Pairing (same-account multi-device) protocol — a THIRD call site, but it is explicitly same-account device-to-device pairing, not a new cross-account identity space. The resulting keypair is held ephemerally in `#pairingKeypairsByPairingId` (line 695) and is consumed by `FedosDevicePairingFacade.createPairingRequest()`, which is a different mechanism entirely from both Space A's own profile-create keypair and Space B's PDD identity. Confirmed out of scope for Direct Ratchet's own cross-account mismatch: same-account pairing already works today (per the prior doc's own §5, the only real sessions that ever reach `"active"` are same-account Device Pairing scenarios). |
| `src/os/messenger/desktop/shell/fedos_desktop_application_shell.ts:524,657` (`this.#deps.generateDeviceKeypair ?? generateFedosDeviceSigningKeypair`) | Same Shell file's own profile-create/unlock flows — these call the SAME coordinator-owned generation path (mirrors `fedos_profile_initialization_coordinator.ts`'s own test-injection pattern), not a fourth independent generation site. |

**Conclusion on item 1's keypair-generation search**: exactly two independent LOCAL-device keypairs are generated
for what may be the same physical device (Space A at profile-create, Space B at PDD-identity-file-create) — the
prior doc's claim holds. A third call site exists (Device Transfer/Pairing, `fedos_desktop_application_shell.ts:692`)
but it is a same-account mechanism with its own ephemeral, per-pairing keypair never persisted as "this node's
local identity" anywhere — it is not a third *identity space* in the sense this investigation is scoped to (a
durable "who am I" value consumed elsewhere as `senderDeviceRef`/`recipientDeviceRef`).

### 1.2 Line-number drift found in the prior doc (correction, not a substance change)

The prior doc cites `fedos_profile_initialization_coordinator.ts:462-464` for the Space A keypair/`localDeviceId`
derivation. At current HEAD this logic is at **lines 524-526**:

```
523	    // 7. Local Device identity (Phase H) — a real, independent Device key.
524	    const deviceKeypair = (this.#deps.generateDeviceKeypair ?? generateFedosDeviceSigningKeypair)();
525	    this.#deviceKeypair = deviceKeypair;
526	    const localDeviceId = this.#deps.localDeviceId ?? `device-${deviceKeypair.publicKeyHex.slice(0, 16)}`;
```

The logic itself is byte-identical to what the prior doc described (same template-literal derivation, same
generate-then-derive order) — this is pure line drift (the file grew from other edits between when `11_...md` was
written and now, on the SAME arc/branch), not a design change. Verified: `wc -l` on the file today is 1161 lines;
the file's own `git log` on this branch shows edits after `11_...md`'s commit (`8b077419`, "Direct Ratchet P1 arc"
— which explicitly touched Peer Device TOFU/UX code, not this coordinator, so the drift is more likely from an
unrelated earlier edit still on this same branch). Every OTHER citation in the prior doc's §0/§3 was independently
re-checked this session and found to still be byte-accurate at today's HEAD:

- `fedos_local_peer_device_announcement_identity.ts:101` — exact match (§1.1 above, quoted in full at that file's
  lines 80-111 read this session).
- `fedos_device_binding_registration_authority.ts` (real path:
  `src/os/messenger/device/binding_challenge/fedos_device_binding_registration_authority.ts`) — Space A's
  `devicePublicKeyRef` population confirmed at **line 298**:
  `{ deviceId: challenge.deviceId, accountRef, devicePublicKeyRef: challenge.devicePublicKeyHex, label: null }`
  inside `#performRegistration()`.
- PDD's own population — `src/os/messenger/conversations/peer_device/fedos_peer_device_announcement_registration_authority.ts:64`:
  `this.#trustAuthority.registerDevice({ deviceId, accountRef, devicePublicKeyRef: devicePublicKeyHex, label: null }, now)`
  inside `registerOrUpdate()`. This registers a **peer's** announced device (Space B `deviceId`, the peer's own
  announced `devicePublicKeyHex`) — never this node's own local device (confirmed: nothing in this file, or
  anywhere in `src/os/messenger/conversations/peer_device/`, calls `registerDevice()` for THIS node's own
  identity; the prior doc's §1 claim that "nothing registers this node's own PDD identity into the local Device
  Registry as a binding at all" is independently reconfirmed).
- `fedos_direct_ratchet_nip17_payload.ts:127,130` — `senderDeviceRef`/`recipientDeviceRef` fields, exact match.
- `fedos_direct_ratchet_inbound_integration.ts:277` (`payload.recipientDeviceRef !== this.#deps.localDeviceRef`)
  and `:326` (`this.#deps.deviceRegistry.getBinding(payload.senderDeviceRef)`) — both exact matches.
- `fedos_direct_ratchet_outbound_integration.ts:257` (`senderDeviceRef: this.#deps.localDeviceRef`) — exact match.
- `fedos_conversation_security_state_controller.ts:90-101` — exact match (`peerDeviceAnnouncementListObserved()`
  at 90, `chosenDevice` at 98, `directRatchetStatus(conversationId, chosenDevice.deviceId)` at 101).

### 1.3 New evidence strengthening (not overturning) the prior doc's "not a free win" verdict

Beyond the "two independent keypairs" caveat the prior doc already found, this session found a second, independent
reason `devicePublicKeyRef` cannot be treated as already-canonical even where both subsystems DO happen to agree:
it is **nullable and sometimes deliberately forced to `null`**.

`src/os/messenger/device/fedos_device_binding.ts:58,71` — `readonly devicePublicKeyRef: string | null;` appears on
BOTH binding-construction producer functions in that file. Producer 2's own doc comment (line 91) is explicit:

```
91  /** Producer 2 of 2 — a binding whose registration authority could NOT verify the request (the Phase E
    blocker). `devicePublicKeyRef` is always forced to `null` here, regardless of what the caller supplied —
    this Arc never fakes a production Device key. */
97    devicePublicKeyRef: null,
```

And `fedos_ratchet_peer_capability_authentication.ts:166` independently documents the same real-world consequence
from the peer_capability subsystem's own perspective: `"reconfirmed most bindings have devicePublicKeyRef: null"`.
This means even a binding that IS in the shared Registry does not reliably carry a `devicePublicKeyRef` value at
all today — a second, independent reason it cannot be adopted as "the" canonical cross-subsystem identity without
first also closing this gap (which is itself Registry-population work, not a new mechanism).

---

## 2. Broader primitive search — "canonical", "unified device", `DeviceRef`, cross-folder shared types (task item 2)

Ran repo-wide (not just the two folders named in the task) case-insensitive searches for `canonical`,
`unified device`, `device identity`, `DeviceRef`, `deviceRef`, `Rosetta`, `DeviceIdentitySpaceLink`,
`IdentitySpaceLink`, `deviceIdentityLink`, `canonicalDeviceId`, `unifyDevice`, `UnifiedDevice`. Findings:

- **No type or interface exists that is shared, verbatim, between
  `src/os/messenger/device/` and `src/os/messenger/conversations/peer_device/` or
  `src/os/messenger/conversations/ratchet/`** beyond the already-known `FedosDeviceBindingV1`/
  `FedosDeviceBindingAccountRef` (the Registry's own shape, string-keyed by bare `deviceId`, space-agnostic by
  construction — this is the prior doc's own §0 finding, reconfirmed, not a new candidate).
- `DeviceIdentitySpaceLink`/`IdentitySpaceLink`/`canonicalDeviceId`/`unifyDevice`/`UnifiedDevice` — **zero matches
  anywhere in the repo**, including test files, docs, and git history (see §4). The only file containing the
  string "DeviceIdentitySpaceLink" at all is `11_DIRECT_RATCHET_IDENTITY_SPACE_DESIGN_NEXT.md` itself, where it is
  a PROPOSED name for Option B's new persistence type, never implemented anywhere.
- **`localDeviceRef` is used far more widely than just Direct Ratchet.** Grepping
  `src/os/messenger/conversations/ratchet/peer_capability/` (a subsystem the task specifically asked about — see
  §5) shows it consumes a `localDeviceRef` dependency field with the exact same name and shape as Direct Ratchet's
  own. Checking the Runtime wiring (`src/os/messenger/desktop/runtime/fedos_desktop_runtime.ts`) shows this is NOT
  a coincidence of naming — every one of `conversationDirectRatchetDeps` (:1062), `conversationPeerCapabilityDeps`
  (:1089), `conversationPeerDeviceAnnouncementDeps` (:1113), `conversationInvitationDeps` (:1140), and
  `conversationIdentityTransitionDeps` (:1154) is wired from the literal same expression, `config.localDeviceId!`
  — i.e. **Space A**. `conversationDeletionRequestDeps` (:1183) also uses it, nullable. So Space A is already the
  de facto "local device" value for FIVE separate conversation subsystems, not just Direct Ratchet — reinforcing
  that Space A, not Space B, is the value structurally embedded as "this node's identity" across the Runtime today.
- **One genuinely new observation this session made, not in the prior doc**: the Peer Device Discovery deps block
  itself (`fedos_desktop_runtime.ts:1104-1128`) carries BOTH spaces side-by-side, as two differently-named fields
  on the SAME dependency object, constructed in the SAME few lines:

  ```
  1108	          const localIdentity = readOrCreateFedosLocalPeerDeviceAnnouncementIdentity(config.peerDeviceAnnouncementIdentityLogPath!);
  1109	          return {
  1110	            deviceRegistry: deviceRegistryPersistence!,
  ...
  1113	            localDeviceRef: config.localDeviceId!,                      // Space A
  1114	            localAnnouncedDeviceId: localIdentity.deviceId,               // Space B
  1115	            localAnnouncedDevicePublicKeyHex: localIdentity.devicePublicKeyHex,  // Space B's own key
  ```

  Tracing how PDD's own runtime (`fedos_peer_device_announcement_runtime.ts:35-37,70,115,127,133`) actually USES
  each: `localDeviceRef` (Space A) is consumed ONLY as an opaque local partition key for the observation-log's own
  subject index (`listObservationsForPeerDevice(this.#deps.localDeviceRef, ...)`) — it is never placed on the wire
  and never compared against any value a peer supplies. `localAnnouncedDeviceId`/`localAnnouncedDevicePublicKeyHex`
  (Space B) is what is actually signed and sent to peers. **This is exactly the split Direct Ratchet does NOT
  have**: PDD already cleanly separates "local bookkeeping key" (Space A, never wire-facing) from "protocol-facing
  identity" (Space B, wire-facing), while Direct Ratchet uses Space A in the wire-facing role instead. This is
  useful supporting evidence for *how* Option A or B would be implemented (the correspondence is already
  materialized, once per process, at this exact point in the Runtime wiring — a translation link built at Option
  B time would have both values available for free, right here, with no extra lookup) — but it is not itself a
  third mechanism; it is the same two known spaces, just co-located in one object literal.

**Conclusion on item 2**: no third primitive, no already-existing translation/link type, no differently-named
"canonical device" concept anywhere in the current repo.

---

## 3. Could account-level identity (the Nostr account pubkey / `FedosDeviceBindingAccountRef`) serve as a disambiguator or fallback? (task item 3)

**No — verified concretely, not assumed.** Three independent structural reasons, each cited to code read this
session:

1. **The Registry lookup itself is device-keyed, never account-scoped.**
   `PersistedFedosDeviceTrustAuthority.getBinding(deviceId: string)`
   (`src/os/messenger/device/persistence/persisted_fedos_device_trust_authority.ts:176-178`) takes ONLY a
   `deviceId`; there is no `getBinding(accountRef, deviceId)` overload anywhere, and
   `resolveFedosDirectRatchetDevicePair()` (`fedos_direct_ratchet_device_pair_resolver.ts:164,169`) calls
   `deviceRegistry.getBinding(request.localDeviceRef)`/`getBinding(request.remoteDeviceRef)` — the account ref is
   never passed into the trust-gate lookup at all. An account identity cannot disambiguate a Registry lookup that
   structurally never consults it.

2. **`FedosDeviceBindingAccountRef` genuinely cannot select among an account's own multiple devices** — that is
   the entire reason a separate `deviceId` exists. The Registry's own "one account per device id" conflict rule
   (already cited in the prior doc, §1.5 of `01_CURRENT_DEVICE_AUTHORITY.md`) constrains a `deviceId` to at most
   one account, but says nothing about the reverse — one account legitimately owns many `deviceId`s (that is the
   whole multi-device model). Substituting accountRef for deviceRef would collapse every device of an account into
   one Ratchet identity, which is a straightforwardly wrong shape for a per-device session — confirmed by
   `findCurrentFedosDirectRatchetSession()`'s own lookup tuple
   (`fedos_direct_ratchet_device_pair_resolver.ts:82-89`), which keys on `(localAccountRef, localDeviceRef,
   remoteAccountRef, remoteDeviceRef, conversationId, suite)` — BOTH account and device are already independently
   required components, never account alone.

3. **The sealing/HKDF context already folds the account ref in, but always ALONGSIDE the device ref, never
   instead of it** — `fedosDirectRatchetSealingDeviceContext(accountRef, deviceRef)`
   (`fedos_direct_ratchet_session_binding.ts:39-41`) returns
   `` `${accountRef.authority}::${accountRef.publicIdentifier}::${deviceRef}` `` — the account is there to bind
   "wrong account, same Device string" into a real cryptographic-context mismatch (per that function's own doc
   comment, lines 24-37), not to serve as a standalone identity. The `deviceRef` component is exactly the
   mismatched Space A/Space B value this whole investigation is about; folding the account in does nothing to
   resolve which space that component should be read from.

`03_DIRECT_RATCHET_INTEGRATION_POINTS.md:294-303` independently confirms the design intent: Ratchet has **no
independent "same person, new device string" merge logic anywhere, and none should be expected to appear here** —
device-identity stability is explicitly declared the discovery protocol's own responsibility, not something
Ratchet's own account-level facts could ever substitute for.

**Classification: UNSUITABLE** (see §6).

---

## 4. Git history — any abandoned unification attempt, design doc, or deprecated field? (task item 4)

Searched `git log --all` for commit messages and file paths matching device-identity-unification themes
(`device.*identity.*unif`, `unify.*device`, `identity.*space`, `device.*ref.*link`, `DeviceIdentitySpaceLink`,
`canonical.*device`, and file-path patterns `*device*identity*`, `*device*ref*`, `*device*link*`,
`*device*translat*`, `*space*link*`) across the entire history (`--all`, not just this branch).

**No abandoned attempt exists.** What the search found instead is that the mismatch is a KNOWN, deliberately
DEFERRED blocker, disclosed and re-confirmed across two separate arcs on this same lineage, both of which
explicitly declined to fix it:

- `4aef5d1a` ("P0 Closure: timing fix, first-run/unlock recovery, release integrity, peer-device UX,
  forward-secrecy hardening") — commit message: *"Direct Ratchet: a real, installed, two-process bidirectional
  proof found a genuine cross-account device-identity-space mismatch that prevents the recipient side of a
  handshake from ever reaching 'active' — deliberately NOT fixed this arc (matches this mandate's own stop
  condition on trust-authority ambiguity/crypto-contract redesign); disclosed via a new design-next doc."* This is
  the commit that produced `11_DIRECT_RATCHET_IDENTITY_SPACE_DESIGN_NEXT.md` itself.
- `8b077419` ("Direct Ratchet P1 arc: TOFU knowledge-state, re-announcement throttle, release-pipeline wiring, UX
  cleanup") — commit message: *"Direct Ratchet full bidirectional closure was independently reconstructed and
  reconfirmed blocked by the same cross-account device-identity-space mismatch the prior arc (4aef5d1a) disclosed
  and deliberately declined to fix, for the same reason... Per explicit user decision this arc does not pick one
  of that document's three competing designs; Direct Ratchet remains PARTIAL with the exact prior boundary. No
  code under fedos_direct_ratchet_outbound_integration.ts / fedos_direct_ratchet_inbound_integration.ts was
  touched."*

Both confirm: (a) the mismatch has been independently re-derived TWICE from a live, real, two-process proof, not
assumed; (b) neither arc attempted a partial/half-finished fix, so there is no half-migrated field or deprecated
type to learn from; (c) the design-next doc this investigation is verifying is itself the product of a deliberate
non-decision, current as of the branch's own most recent Direct-Ratchet-touching commit — it is not stale relative
to any subsequent design work, only relative to unrelated line-shifting edits elsewhere in the same files (§1.2).

Broader `docs/` search for "device identity"/"identity space"/`devicePublicKeyRef`/"canonical" (30 files matched)
surfaced no additional relevant doc beyond the ones the prior doc already read, with one exception:
`docs/reviews/fedos_account_nostr_identity_rotation_v1/03_identity_layer_taxonomy.md:13` (a DIFFERENT review, from
the account/Nostr identity-rotation investigation) has its own "Device identity" taxonomy row that explicitly
cites doc `11` (this same design-next doc) as the authority on the topic — i.e. that separate investigation
already deferred to the same document rather than proposing its own primitive. `07_MULTI_DEVICE_AND_CONFLICT_MODEL.md`
and `03_DIRECT_RATCHET_INTEGRATION_POINTS.md` (both in the same `fedos-peer-device-discovery-current/` folder,
read in full this session) add supporting detail (§1.3, §3 above) but no new candidate primitive.
`fedos-direct-ratchet-readiness-current.md` and `docs/architecture/MESSENGER-ARCHITECTURE.md` were checked and
contain no additional relevant material (the latter only notes `src/device/` is the legacy 88-file facade — see
§5's footnote).

**Conclusion on item 4**: SUPERSEDED/abandoned-attempt search returns empty. There is nothing to learn from a
false start because none exists — the two prior arcs correctly recognized the problem and correctly declined to
guess at a fix without a real design decision, exactly the discipline this investigation itself is continuing.

---

## 5. `FedosRatchetPeerCapabilityRuntime`/peer_capability — a third space, or a Rosetta stone? (task item 5)

**Neither — it is a third CONSUMER of the same two known spaces, wired identically to Direct Ratchet.**

`src/os/messenger/conversations/ratchet/peer_capability/fedos_ratchet_peer_capability_runtime.ts:42` declares its
own `localDeviceRef: string` dependency field, structurally identical in shape and name to Direct Ratchet's own.
Tracing where it is wired (`fedos_desktop_runtime.ts:1082-1094`,
`conversationPeerCapabilityDeps.localDeviceRef: config.localDeviceId!`) confirms it is fed the exact same **Space
A** value as Direct Ratchet, Peer Device Discovery's own local-bookkeeping field, Conversation Invitation, and
Identity Transition (§2 above). Its own trust check
(`fedos_ratchet_peer_capability_outbound_coordinator.ts:105`,
`this.#deps.deviceRegistry.getBinding(this.#deps.localDeviceRef)`) reads the SAME shared Registry the same way
Direct Ratchet's resolver does.

Peer capability's own three-value evidence model (`account-authenticated` /
`account-and-device-authenticated` / `account-authenticated-device-proof-unavailable`,
`fedos_ratchet_peer_capability_authentication.ts:150-179`) is a DIFFERENT concept from device identity itself — it
grades how strongly a claimed sender's device signature was corroborated against whatever `devicePublicKeyRef` (if
any — see §1.3's nullability finding) happens to be on file for the CLAIMED `senderDeviceRef`/`issuerDeviceRef` in
the inbound payload. It does not introduce, generate, or persist any device identity of its own; it only ever
reads the Registry that Space A (via Device Pairing) or Space B (via PDD's peer-registration path) already
populated. There is no `peer_capability`-specific device-id generation anywhere in
`src/os/messenger/conversations/ratchet/peer_capability/` (confirmed: zero `generateFedosDeviceSigningKeypair`
call sites in that folder, per the exhaustive §1.1 inventory).

Because `peer_capability` is fed Space A for its own `localDeviceRef` — the SAME space Direct Ratchet reads today
— it inherits the identical cross-account mismatch by construction whenever a peer's genuinely cross-account
`senderDeviceRef` (necessarily Space B, sourced from PDD, per the prior doc's own §0 table) is checked against
it, though this investigation's scope is Direct Ratchet specifically and this document does not attempt to fully
trace whether `peer_capability`'s own production callers ever hit that path live (a separate question from
whether the primitive exists — it does not).

**Classification: not applicable as a candidate primitive — peer_capability is a downstream consumer of the same
two spaces, contributing no new value.**

---

## 6. Classification table (task item 6)

| Candidate | Classification | Why |
|---|---|---|
| `devicePublicKeyRef`/`devicePublicKeyHex` (device's own Schnorr public key on `FedosDeviceBindingV1`) | **UNSUITABLE today; PATCH_EQUIVALENT if unified** | Real, already-populated by both subsystems (§1.2), but the two subsystems currently derive it from TWO INDEPENDENT keypairs for the same physical device (§1.1) — so it is not currently the same value across spaces. Additionally nullable and frequently actually `null` in real bindings today (§1.3), a second independent reason it cannot be relied on as-is. The "patch" that would make it canonical — making PDD reuse Device Pairing's already-durable keypair instead of generating a second one — is structurally identical migration work to Option A (repoint what "this device's identity" means) or Option B (link the two known keypairs), just phrased in terms of the key instead of the id string. Not a fourth independent mechanism. |
| `localDeviceRef` used by `peer_capability`, Conversation Invitation, Identity Transition, Deletion Request (§2, §5) | **CURRENT_CANONICAL, but ONLY as Space A** — i.e., these subsystems already agree with Direct Ratchet, not a solution to Direct Ratchet's OWN mismatch against Space B | All five subsystems read the identical `config.localDeviceId!` expression (§2). This proves Space A is already the Runtime-wide convention for "local device," which is evidence FOR Option A (make Ratchet consistent with everything else) rather than evidence of an escape hatch — it does not change what value a genuine cross-account peer's `remoteDeviceRef` can ever be (still only Space B, per the prior doc's own §0 table, unchanged by this session). |
| PDD's own `localDeviceRef` (Space A, bookkeeping-only) vs. `localAnnouncedDeviceId`/`localAnnouncedDevicePublicKeyHex` (Space B, wire-facing) co-located in one deps object (§2) | **Not a primitive — an implementation convenience for whichever of A/B is chosen** | Both values already exist side-by-side in memory at Runtime construction time (`fedos_desktop_runtime.ts:1104-1128`), so a translation-link write (Option B) would need no extra lookup to obtain both values for THIS node's own device — but this only lowers Option B's implementation cost, it does not avoid the design decision. |
| `FedosDeviceBindingAccountRef` (account-level Nostr pubkey identity) | **UNSUITABLE** | Registry lookups are device-keyed only, never account-scoped (§3.1); accountRef cannot disambiguate among an account's own multiple devices, which is the entire reason `deviceId` exists as a separate concept (§3.2); the sealing context folds account ref in ALONGSIDE device ref, never as a substitute (§3.3). Confirmed by design intent in `03_DIRECT_RATCHET_INTEGRATION_POINTS.md:294-303`: Ratchet has no "same person, new device string" merge logic anywhere, by design. |
| `FedosRatchetPeerCapabilityEntry`/peer_capability subsystem's own device concept | **N/A — not a distinct space** | Confirmed a third CONSUMER of Space A (same wiring as Direct Ratchet), not a third space or a Rosetta stone; contributes no new identity primitive (§5). |
| Device Transfer/Pairing's own ephemeral keypair (`fedos_desktop_application_shell.ts:692`) | **N/A — out of scope, same-account only** | A third `generateFedosDeviceSigningKeypair()` call site not cited by the prior doc, but it is same-account Device-to-Device pairing (already working today per the prior doc's own §5), never a durable identity consumed as a cross-account `senderDeviceRef`/`recipientDeviceRef` (§1.1). |
| Any `DeviceIdentitySpaceLink`/canonical-device/unified-device type, historical or current | **SUPERSEDED — never existed** | Zero matches anywhere in the current repo or across `git log --all` (§2, §4). The only place the name `DeviceIdentitySpaceLink` appears at all is as a PROPOSED name in the prior doc's own Option B section — never implemented. |
| Prior abandoned migration/half-finished field | **SUPERSEDED — never existed** | Confirmed via `git log --all` across both commits that disclosed the mismatch (`4aef5d1a`, `8b077419`) — both explicitly declined to touch `fedos_direct_ratchet_outbound_integration.ts`/`inbound_integration.ts`, so no partial fix or deprecated field was ever created to leave behind (§4). |

---

## 7. Final answer

After an exhaustive, independently-re-derived search — every `generateFedosDeviceSigningKeypair()` call site in
the repo (not just the two the prior doc cited), a repo-wide grep for any shared canonical/unified-device type, a
concrete trace of why account-level identity cannot substitute (not merely asserted), a full `git log --all`
sweep for any abandoned unification attempt, and a full read of the peer_capability subsystem to check whether it
is a third space — **the honest answer is no, there is no shortcut**. `devicePublicKeyRef` remains the single
real, already-present candidate, and adopting it as canonical is still, precisely as the prior doc's §3 already
suspected, Option A or Option B wearing a different name: someone still has to decide which subsystem's keypair
generation becomes authoritative for "this device's real identity," and that decision has the exact same
migration shape (persistence-format impact, sealed-secret-context impact, Registry self-binding impact) as
choosing Option A or Option B directly. This session's own new findings (the nullable/`null`-in-practice
`devicePublicKeyRef` field, §1.3; the fact that `localDeviceRef`/Space A is ALREADY the convention for five other
conversation subsystems, §2 and §5; the confirmed absence of any account-level fallback, §3; the confirmed absence
of any abandoned attempt, §4) all reduce the remaining uncertainty around that verdict rather than reopening it.
A future arc making this decision should treat Option A vs. Option B as the real, and only, choice.

---

## Appendix: file inventory read for this document (beyond the prior doc's own appendix)

- `src/os/messenger/device/crypto/fedos_device_signing_keypair.ts` (function definition + full header)
- `src/os/messenger/desktop/onboarding/fedos_profile_initialization_coordinator.ts` (lines 500-579, full
  `generateDeviceKeypair`/`localDeviceId` derivation with current line numbers)
- `src/os/messenger/desktop/shell/fedos_desktop_application_shell.ts` (lines 500-1120, the previously-uncited third
  `generateFedosDeviceSigningKeypair()` call site inside `devicePairingCreate()`)
- `src/os/messenger/device/binding_challenge/fedos_device_binding_registration_authority.ts` (lines 230-357, full
  `#performRegistration()`/`#performRevocation()`, real path — confirmed `src/device/binding_challenge/...` is a
  pure one-line re-export facade to this file, not a second implementation)
- `src/os/messenger/conversations/peer_device/fedos_local_peer_device_announcement_identity.ts` (full file)
- `src/os/messenger/conversations/peer_device/fedos_peer_device_announcement_registration_authority.ts` (full file)
- `src/os/messenger/conversations/peer_device/fedos_peer_device_announcement_runtime.ts` (targeted reads of
  `localDeviceRef` vs. `localAnnouncedDeviceId` usage)
- `src/os/messenger/conversations/peer_device/fedos_peer_device_announcement_authentication.ts` (lines 105-128)
- `src/os/messenger/desktop/runtime/fedos_desktop_runtime.ts` (lines 1040-1240, every
  `conversation*Deps` construction block and its `localDeviceRef` wiring)
- `src/os/messenger/conversations/ratchet/fedos_direct_ratchet_device_pair_resolver.ts` (full file, re-read for
  the account-vs-device Registry-key analysis in §3)
- `src/os/messenger/conversations/ratchet/fedos_direct_ratchet_session_binding.ts` (full file,
  `fedosDirectRatchetSealingDeviceContext()`)
- `src/os/messenger/conversations/ratchet/peer_capability/` — every file in this directory grepped for
  `deviceId`/`deviceRef`/`devicePublicKey`/`localDevice`; `fedos_ratchet_peer_capability_runtime.ts`,
  `fedos_ratchet_peer_capability_outbound_coordinator.ts`, `fedos_ratchet_peer_capability_inbound_coordinator.ts`,
  `fedos_ratchet_peer_capability_authentication.ts` targeted-read
- `src/os/messenger/device/fedos_device_binding.ts` (lines 40-100, both binding-producer functions,
  `devicePublicKeyRef` nullability)
- `src/device/` (facade-only confirmation: 88 files, no independent `generateFedosDeviceSigningKeypair` or device
  identity generation of any kind, all re-export the `src/os/messenger/device/...` implementations)
- `docs/reviews/fedos-peer-device-discovery-current/07_MULTI_DEVICE_AND_CONFLICT_MODEL.md` (full file)
- `docs/reviews/fedos-peer-device-discovery-current/03_DIRECT_RATCHET_INTEGRATION_POINTS.md` (full file)
- `docs/reviews/fedos-direct-ratchet-readiness-current.md` (grepped, no new material)
- `docs/reviews/fedos_account_nostr_identity_rotation_v1/03_identity_layer_taxonomy.md` (grepped for its own
  independent "Device identity" taxonomy row)
- `docs/architecture/MESSENGER-ARCHITECTURE.md` (grepped, no new material beyond confirming `src/device/`'s facade
  status)
- `git log --all` — commit-message and file-path sweeps for device-identity-unification themes (see §4 for exact
  patterns); full commit bodies of `4aef5d1a` and `8b077419` read in full
