# Red Team Review — Disaster Recovery / Portable Backup DESIGN.md §4-§6

Scope: `docs/reviews/fedos_disaster_recovery_portable_backup_v1/DESIGN.md` §4 (Device
Trust), §5 (Ratchet exclusion), §6 (old-backup rollback / truth-log staleness). All
findings below are traced against the working tree at
`C:\wt\disaster-recovery-portable-backup` (branch
`arc/fedos-disaster-recovery-portable-backup`) via Read/Grep only — no build or test
run was performed (shell execution unavailable in this session).

---

## 1. Identity-transition notification reachability

**Claim under test (DESIGN.md §4):** "...notify known peers through the existing
Identity Transition / device-revocation outbound notification coordinator
(`fedos_identity_transition_outbound_notification_coordinator.ts`), rather than
silently resuming."

**What is actually reachable today, traced end to end:**

- `FedosIdentityTransitionPeerRuntime` (`src/os/messenger/conversations/identity_transition/peer_integration/fedos_identity_transition_peer_runtime.ts:91`) is real, constructed by production code — `FedosConversationRuntime` builds one whenever `deps.identityTransition` is supplied (`src/os/messenger/conversations/runtime/fedos_conversation_runtime.ts:877`), and `FedosDesktopApplicationShell#identityTransitionRuntime()` (`src/os/messenger/desktop/shell/fedos_desktop_application_shell.ts:894`) reaches it from the Shell.
- The **receive/accept side is fully wired end to end**, contradicting the stale prior-memory note that "Accept is a dead end": `Shell.identityTransitionAccept/Reject/Defer/List/Open/RecordManualVerification/AssessContinuity/AuthorizeRatchetReset` (`fedos_desktop_application_shell.ts:899-1034`) are all called from the Electron main-process IPC dispatcher (`packages/fedos-desktop-electron-spike/src/fedos_electron_beta_main.cts:317-352`), exposed through the preload bridge (`fedos_electron_beta_preload.cts:165-178`), and invoked from the renderer (`fedos_electron_beta_renderer.ts:1082`, `boundary.identityTransitions.accept/reject/defer` at `fedos_electron_beta_main.cts:1567-1569`). Inbound import is also wired into the live message pipeline: `FedosConversationRuntime`'s Rumor-import chain calls `this.#identityTransitionRuntime.importIdentityTransitionNotification(rumor.content)` as step 4 of 5 before falling back to plain chat (`fedos_conversation_runtime.ts:1527-1532`). **This part of the prior memory note is out of date and should be corrected**, not because the concern was wrong then, but because work has landed since.
- **The send/publish side is dead code in production**, exactly as the prior memory note suspected for "publish": `FedosIdentityTransitionPeerRuntime.publishIdentityTransitionNotification()` (`fedos_identity_transition_peer_runtime.ts:115-118`), which wraps `FedosIdentityTransitionOutboundNotificationCoordinator.publishTransitionNotification()` (`fedos_identity_transition_outbound_notification_coordinator.ts:125`), has **zero callers anywhere outside its own definition and the unit-test suite**. Repo-wide grep for `publishIdentityTransitionNotification` and `publishTransitionNotification` returns only: the method definitions, one docs mention (`docs/secure_runtime_alpha_5961_6040_execution_spec.md:118-119`), and ~19 call sites all inside `test/secure_runtime_alpha_*` unit tests. Grep for `FedosIdentityTransitionOutboundNotificationCoordinator` across `src/os/messenger/desktop/**` (Shell, host bridge, runtime config, application layer) returns **no matches at all** — it is never constructed or referenced outside `identity_transition/peer_integration/` and tests. No IPC handler, no Shell method, no preload entry, no renderer call exists for "publish"/"announce"/"notify" of an identity transition.

**Verdict: CONFIRMED HOLE (narrower than originally suspected, but real).** §4's recommendation to "notify known peers through the existing outbound notification coordinator" names a call path that is genuinely unreachable from any shipped entry point today. The receive side your memory flagged as a dead end has since been fixed; the send side has not, and it is precisely the half §4 depends on (a Recovery Bundle restore is the *sender* of a new-device notice, not the receiver).

---

## 2. Device identity stability risks

**Claim under test (DESIGN.md §4):** minting a fresh `localDeviceId`/keypair on
restore and registering it "via the existing pairing/registration path" is safe
because the codebase already treats Device as separable from Account/Master Seed.

**Stability invariant found:** `profile.json`'s `localDeviceId` is documented and
treated as durable-once-minted: `"Stable, non-secret local Device identifier (this
machine's own device id)"` (`src/os/messenger/desktop/onboarding/fedos_local_profile_descriptor.ts:58`). It is minted once at `createProfile()` time — `const localDeviceId = this.#deps.localDeviceId ?? \`device-${deviceKeypair.publicKeyHex.slice(0, 16)}\`;` (`src/os/messenger/desktop/onboarding/fedos_profile_initialization_coordinator.ts:449`, matches the design doc's own citation) — and every subsequent `#unlock()` call reads it verbatim off the persisted descriptor and threads it back through `#startAndBootstrap`/`#buildRuntimeConfig` unchanged (`fedos_profile_initialization_coordinator.ts:571`, `689`, `708`, `737`). Nothing in this file ever re-derives or mutates it after creation.

**Does anything break if it changes between two runs on the same profile.json?**
Not applicable in the way originally framed, because §4's own design does **not**
propose mutating an existing `profile.json`'s `localDeviceId` — restore writes a
**fresh** `profile.json` into a fresh, empty `userData` (§3 step 3: "atomically move
staged files into a fresh, empty `userData`"). So the "same profile.json, different
`localDeviceId` between runs" failure mode the prompt asked me to check for does not
arise from this design as written — it constructs a brand-new profile identity file,
it does not rewrite an existing one in place.

**Device Registry append discipline:** `FedosDeviceRegistryPersistence` (`src/os/messenger/device/persistence/fedos_device_registry_persistence.ts`) is a genuine append-only event-store keyed by `deviceId`, explicitly designed for multiple devices per account: `getBinding(deviceId)`, `listBindings()`, and — critically — `listBindingsForAccount(accountAuthority, accountPublicIdentifier)` (lines 34-37) exists specifically to enumerate *more than one* device per account. `reconstructFedosDeviceBindingRecord()` (lines 51-95) replays `registered`/`trusted`/`revoked` events per-device-id with no assumption that only one `deviceId` may ever exist for an account. **There is no "exactly-one-registry-entry" or fixed-bootstrap-order assumption found** — appending a new device entry for the same account is a natively supported, already-exercised shape (this is the same machinery Own-Device Sync already depends on).

**Verdict: NOT A HOLE**, with one caveat worth stating in the design doc explicitly: the safety here depends on restore **always** targeting a fresh `userData`/fresh `profile.json` (§3's own stated model) and never being offered as an in-place "repair my existing installation" operation — if a future revision of this design ever allows restoring into an *existing* profile directory, the "stable, non-secret" comment at `fedos_local_profile_descriptor.ts:58` and the multi-device registry model would need re-review, since nothing currently stops two different `localDeviceId` values from being live in the same registry — that's a feature (multi-device), not a bug, but it means "restore into existing profile" and "device replacement" would need to be modeled as visibly different operations, not variants of the same import.

---

## 3. Retention/suppression re-evaluation adequacy

**Claim under test (DESIGN.md §6):** "restored conversation/payload content is
re-run through the *current*, freshly-recomputed Payload Retention / Suppression
authority before being surfaced, not trusted verbatim from the raw restored bytes,"
citing the Archive-restore precedent.

**How `FedosPayloadRetentionAuthority` actually decides state:** `#currentState(payloadId)` (`src/os/messenger/conversations/retention/fedos_payload_retention_authority.ts:107-111`) reads **only** its own `retentionPersistence` decision log (`getDecision(payloadId, "payload-removed"/"tombstoned")`) — it does not replay or reconstruct anything from the Signed Deletion execution log at all. This is a real, separate durable store, not a cache.

**Is the deletion-execution log linked to that retention log?** Yes, genuinely: `executeFedosLocalPayloadDeletionPlan()` (`src/os/messenger/conversations/deletion/fedos_deletion_execution_coordinator.ts:131-170`) is the **only** place a `retention-transition` deletion step gets applied, and it does so by calling `deps.retentionAuthority.tombstonePayload()` / `.removeLocalPayload()` (lines 148-151) — the exact same `FedosPayloadRetentionAuthority` instance whose decision gets durably written to the retention persistence log that `#currentState()` reads. So a deletion that executed **before** the backup snapshot was taken is captured as a durable retention-decision record, and per DESIGN.md §3's own table both "payload/retention/capability logs" (bucketed under CONVERSATIONS/MESSAGES) and the `deletion-request-*` truth logs are included in the bundle. On restore, once that ndjson travels intact, `#currentState()` will correctly report `"tombstoned"`/`"payload-removed"` for that `payloadId` with no new code required — this is not free-standing hand-waving, it followed from the log being durable and included.

**The Archive-restore precedent, traced precisely:** `fedos_conversation_archive_restore.ts` deliberately uses `evaluateRetentionDecisionOnly()` (`fedos_payload_retention_authority.ts:141-143`) rather than `evaluatePayloadAccess()`, with the header explaining exactly why: `evaluatePayloadAccess()` first checks `payloadStorage.getDescriptor(payloadId) !== null`, which is **always false** during a fresh restore (the descriptor doesn't exist yet — restore is what would create it), so it would silently answer `"not-found"`/allow for every payload regardless of retention state (`fedos_conversation_archive_restore.ts:108-139`, self-documented as a self-discovered defect fixed in Alpha 7481-7560). `isPayloadPermittedForRestore()` (`fedos_conversation_archive_restore.ts:179-188`) gates **both** Envelope writes (line 312-318) and Payload writes (line 329-335) through this, denying either if `evaluateRetentionDecisionOnly()` returns anything other than `"active"`.

**The gap DESIGN.md §6 does not surface:** this entire gate is **opt-in and silently skippable** — `retentionAuthority` is an *optional* dependency (`readonly retentionAuthority?: Pick<...>` at `fedos_conversation_archive_restore.ts:126`), and the gate is only applied `if (deps.retentionAuthority !== undefined)` (lines 313, 330). If the caller omits it, restore proceeds with **zero** suppression re-checking — no error, no warning, just silent pass-through. DESIGN.md §3's own Recovery Bundle import model is a **generic manifest-validate-then-bulk-move** operation ("atomically move staged files into a fresh, empty `userData`"), structurally unlike Archive restore's per-record `isPayloadPermittedForRestore()` gate. §6 states the *principle* ("must apply the same principle") but never specifies **how** the new Recovery Bundle importer would construct a `FedosPayloadRetentionAuthority` from the just-staged (not-yet-live) retention log and thread it through a bulk-file-move step, nor does it flag that this dependency is optional-and-silently-skippable in the one place this pattern already exists — an implementer following §3's literal bulk-copy description could ship a version that copies the retention log file byte-for-byte (harmless) but never actually re-derives per-record denial the way Archive restore does, and nothing in the design doc would catch that omission.

One more precision point worth recording: the Archive-restore gate covers **Envelope and Payload writes only** (`fedos_conversation_archive_restore.ts:306-336`); Membership, Conversation record, and Capability-event restoration just above it (lines 260-296) are **not** retention-gated at all — consistent with the existing memory finding that "only ciphertext is retention-gated; all metadata survives export+restore unconditionally," here narrowed precisely: metadata survival applies to Membership/Capability/Conversation-record classes, not to Envelope/Payload, which genuinely are gated when the optional dependency is supplied.

The identity-transition-superseded half of §6's claim holds up cleanly: `isFedosIdentityTransitionPeerObservationSuperseded()` is computed dynamically from the full lineage on every read (`fedos_identity_transition_peer_runtime.ts:180`, `204`, `239`), never cached as a stale boolean — a genuinely "freshly recomputed" check, not a hand-wave, *provided* the underlying observation/lineage logs travel in the bundle (§3 lists them as included, PARTIAL).

**Verdict: PARTIALLY A HOLE.** The underlying mechanism is real and does what §6 claims *for Envelope/Payload data, if wired*. The hole is that (a) the wiring is optional and silently no-ops if omitted, (b) §3's generic bulk-copy import model is not obviously compatible with the per-record gate pattern the precedent actually uses, and (c) Membership/Conversation/Capability restoration is not retention-gated by the cited precedent at all, so §6 overstates uniform coverage. Not "design hand-wave that doesn't work" — more precisely "a real safeguard whose activation is not specified, in a design whose own default import shape (bulk copy) doesn't naturally produce it."

---

## 4. Other findings

### 4a. §4's device-continuity mechanism is a category mismatch, not just unreachable (CONFIRMED HOLE, more severe than reachability alone)

Independent of §1's reachability finding: even if `publishIdentityTransitionNotification()` were wired up tomorrow, **it cannot legally be used for the scenario §4 describes**. `FedosIdentityTransitionRecordV1` validation hard-requires the old and new account identities to actually differ: `isWellFormedFedosIdentityTransitionRecordV1()` explicitly rejects a record where they're equal — `if (accountRefsEqual(oldAccountRef, newAccountRef)) return false;` (`src/os/messenger/conversations/identity_transition/fedos_identity_transition_record.ts:198`). The wire content itself is scoped to **account**-identity replacement: `oldAccountIdentity`/`newAccountIdentity`/`oldNostrIdentity`/`newNostrIdentity` (`fedos_identity_transition_outbound_notification_coordinator.ts:149-152`), and `publishTransitionNotification()` requires a `newKeyProof: FedosIdentityTransitionNewKeyProofV1` that is a Schnorr signature by the **new account's own Nostr private key** over a transition digest (`verifyFedosIdentityTransitionNewKeyProof`, `fedos_identity_transition_new_key_proof.ts:73-96`, verified against `hexToBytes(proof.newNostrIdentity)`).

A Recovery Bundle restore per §1-§4 restores the **same** Master Seed and therefore the **same** account/Nostr identity — only the device changes. There is no "new account key" to prove, and `oldAccountIdentity === newAccountIdentity` by construction, which the validator rejects outright. **"Identity Transition" in this codebase is architecturally an account-key-rotation primitive, not a device-continuity primitive** — §4 recommends reusing it for a purpose it cannot structurally represent, independent of the dead-code problem in §1.

### 4b. §5's "reestablishes on next contact" claim is not automatic — it requires a peer-side trust step that has no working trigger

`evaluateFedosRatchetPeerCapabilityAcceptance()` — the pure decision function gating whether an incoming Ratchet peer-capability advertisement/lifecycle-notification from a device is accepted — fails closed on device trust **before anything else**: `if (input.peerDeviceTrustState !== "trusted") return "untrusted-device";` (`src/os/messenger/conversations/ratchet/peer_capability/fedos_ratchet_peer_capability_acceptance_policy.ts:82`). The inbound coordinator derives `peerDeviceTrustState` from the **receiving device's own local Device Registry** lookup on the sender's `deviceRef` — `#trustStateFor(record.senderDeviceRef)` → `this.#deps.deviceRegistry.getBinding(deviceRef)`, `"unknown"` if no binding exists (`fedos_ratchet_peer_capability_inbound_coordinator.ts:94-98`, `166`, `237`).

A brand-new device minted by Recovery Bundle restore is, by construction, unknown to every peer's local registry — peers have never seen it. §5 states sessions "reestablish through the existing, already-shipped `fedos_ratchet_peer_capability_*` renegotiation machinery on next contact with each peer" as if this were automatic. It is not: the peer's device registry must first gain a **"trusted"** binding for the new device, and the only mechanism in this codebase designed to carry that fact between peers for a continuity scenario is exactly the Identity Transition notification this review just showed is (a) unreachable in production (§1) and (b) structurally incompatible with a same-account device replacement (§4a). Without some other trust bootstrap, "next contact" with a restored device would produce `"untrusted-device"` rejections, not silent reestablishment — every peer would need to go through some **other**, currently-unspecified manual trust step (e.g. a fresh device-pairing/QR-style exchange, out of scope of anything named in DESIGN.md) before Ratchet renegotiation could succeed at all. DESIGN.md does not mention this requirement anywhere in §4-§6.

### 4c. `recipientDeviceRef` requirement compounds 4a/4b

Even setting aside 4a/4b, `publishTransitionNotification()`'s own preflight requires the **sender's** local device registry to already contain a binding for the intended recipient device — `getBinding(recipientDeviceRef) === null` → `"recipient-device-unknown"` (`fedos_identity_transition_outbound_notification_coordinator.ts:120-121`). A freshly-restored device (fresh `userData`, fresh registry per §3/§4) has no prior knowledge of any peer's device id at all — this is a bootstrapping problem the design doc doesn't address either, on top of the two structural blockers above.

---

## Net effect on the design

§4 and §5's device-continuity story does not currently work end-to-end, and the gap
is deeper than "the code isn't wired up yet" — it's a genuine category mismatch. The
"Identity Transition" subsystem this design leans on is, by its own validation rules,
scoped exclusively to **account**-key rotation (§4a), its outbound leg is dead code
in production regardless (§1), and even a hypothetical working notification wouldn't
by itself restore Ratchet interoperability, because Ratchet peer-capability
acceptance is separately gated on peer-side Device Trust state that nothing in this
design populates (§4b). §6's retention/suppression story is sounder — the underlying
mechanism is real, already shipped, and does what's claimed for Envelope/Payload data
— but its activation is optional/silently-skippable in the one place it exists today,
and §3's generic bulk-copy import model isn't obviously the same shape as the
per-record gate that makes it work, so the design doc's confidence there is somewhat
ahead of what it has actually specified.

Concrete changes this design needs before it's build-ready:

1. **Do not name `fedos_identity_transition_outbound_notification_coordinator.ts` as
   the device-continuity notification mechanism.** It cannot represent a
   same-account/new-device fact at all (rejected by `isWellFormedFedosIdentityTransitionRecordV1`'s `oldAccountIdentity !== newAccountIdentity` invariant). Either (a) design a new, distinct wire message/record type for "same account, replacement device" — scoped, reviewed, and specified up front per this project's own protocol-design convention, never reusing this state-changing envelope's purpose for a different function — or (b) explicitly scope this arc to "content/identity recovers, cross-device Ratchet/trust reestablishment is an out-of-scope manual step the operator must perform per-peer," and say so in the user-facing docs Agent D is writing, rather than implying reestablishment is automatic.
2. **Specify the actual peer-trust bootstrap** a restored device needs — a Recovery
   Bundle restore produces a device peers have never seen; without a described
   mechanism for peers to mark it "trusted," §5's "reestablishes on next contact"
   claim is false as written, and every conversation partner would need some
   undocumented manual re-pairing step.
3. **Specify, not merely assert, how the Recovery Bundle importer wires
   `FedosPayloadRetentionAuthority`/`FedosArchiveSuppressionObservationAuthority`
   into its own import path**, given §3's bulk-copy model doesn't structurally
   resemble the per-record `isPayloadPermittedForRestore()` gate that makes the
   Archive-restore precedent actually work — and note explicitly that Membership/
   Conversation-record/Capability-event data is NOT covered by that precedent even
   when correctly wired.
4. §4's fresh-`profile.json`/fresh-`localDeviceId`-into-empty-`userData` model itself
   is sound against the Device Registry's actual append-only, multi-device-per-account
   design — no change needed there, but the design doc should say explicitly that
   restore is defined only as "new machine, empty `userData`," never as "repair this
   existing installation," since the latter would need separate analysis.
