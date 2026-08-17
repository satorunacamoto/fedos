# Fresh-Machine Restore — Paper Trace (Agent B)

Read-only source trace against the real, production-wired code path (no
shell access in this session — no build/run was performed; every claim
below is a citation, not an execution result).

**Important context discovered during this trace, not asked for but load-
bearing for how to read the rest of this document:** `DESIGN.md` (the file
this task named as "the design doc") is not this arc's current head
document. The working tree already contains a later Gate Decision
(`00_gate_decision.md`: *"Status: DESIGN complete, proceeding to
IMPLEMENT"*), a more detailed format spec (`01_recovery_bundle_format.md`),
a red-team pass (`rollback-identity-truth-red-team.md`), UX flow drafts,
and real (uncommitted-status-unknown, but present-on-disk) implementation
files under `src/os/messenger/desktop/recovery/`
(`fedos_recovery_bundle.ts`, `fedos_recovery_bundle_manifest.ts`,
`fedos_recovery_bundle_header.ts`, `fedos_recovery_bundle_data_part_codec.ts`,
`fedos_recovery_bundle_profile_selection.ts`, `fedos_recovery_bundle_encryption.ts`).
Those files define the container/codec/inclusion-list/crypto envelope, but
— confirmed by full method inventory of `fedos_profile_initialization_coordinator.ts`
below — **no orchestrator that actually drives a restore through the
Coordinator exists yet on disk**. So DESIGN.md's threat model is still the
right frame for this trace, but its per-asset table and §4 claims should be
read as already-superseded-in-intent by `01_recovery_bundle_format.md` /
`00_gate_decision.md` where they differ. Flagging this for whoever reconciles
the two next — not resolving the reconciliation myself.

---

## 1. Contacts

**Verdict: CONFIRMED — DESIGN.md's "derived, not first-class" claim is correct.**

- `src/os/messenger/contacts/` exists but is explicitly, permanently empty:
  `src/os/messenger/contacts/README.md:1-49` documents it as "RESERVED, and
  intentionally empty" — a deliberate decision record, not an oversight. It
  states the "closest thing this codebase has to 'contacts'" is
  `src/conversation/encryption/identity/*` (physically now at
  `src/os/messenger/conversations/encryption/identity/**`), and that this
  code is conversation-internal identity plumbing (22 internal call sites
  inside `src/conversation/**`, only 1 external caller,
  `fedos_desktop_runtime_config.ts`) — "not a strong enough signal that this
  is an independently-reusable 'contacts' capability."
- Grepped `src/os/messenger/conversations/encryption/identity/**`
  (`fedos_conversation_counterparty_public_key_resolver.ts`,
  `fedos_conversation_identity_resolver.ts`, `fedos_conversation_key_resolver.ts`,
  `fedos_conversation_local_account_index_authority.ts`,
  `fedos_conversation_participant_resolver.ts`): these are pure resolver
  functions — no `class`, no persistence, no `ndjson` reference in any of
  them (confirmed by content grep on the participant resolver). They
  compute a counterparty's identity/key on demand; they do not maintain a
  durable roster of "known contacts."
- Grepped the whole repo (`contact`/`Contact`, case-insensitive) — the only
  messenger-tree hits are: this reserved README, `conversations/README.md`,
  `create_messenger.ts`/`index.ts` (barrel re-exports), the identity-transition
  acceptance-state file (unrelated "contact" as English word), and
  `noop_messenger_ports.ts:130` ("Contacts no relay..." — verb, not the noun).
  No `Roster`, `AddressBook`, or `KnownPeer` type/file anywhere under `src/os/messenger`.
- `planFedosLocalProfilePaths()` — the single authoritative enumeration of
  every durable leaf a profile owns
  (`src/os/messenger/desktop/onboarding/fedos_local_profile_paths.ts:158-200`,
  34 named leaf paths) — has no `contact`/`roster`/`addressBook` field.

**Conclusion**: there is no first-class Contacts store reachable from
production anywhere in this tree. What DESIGN.md calls "derived from
`conversation-membership.ndjson` + `device-registry.ndjson`" is accurate in
spirit — any UI notion of "who do I know" would have to be reconstructed
from `conversation-membership.ndjson` (who's in my conversations) via the
identity resolvers above, there is no separate persisted list to include or
exclude in a Recovery Bundle. Note the newer `01_recovery_bundle_format.md`
already implicitly agrees — it never lists "CONTACTS" as an asset category
at all (grepped, zero hits), consistent with this being a non-issue rather
than an open question.

---

## 2. Full bootstrap file/state list

**Verdict: CONFIRMED**, traced through `detectProfileState()` /
`unlockProfile()` / `#startAndBootstrap()` /
`#buildRuntimeConfig()` in
`src/os/messenger/desktop/onboarding/fedos_profile_initialization_coordinator.ts`.

### 2a. What `unlockProfile()` STRICTLY requires to exist before it can even attempt to succeed

Only **two** files, both read via `detectProfileState()`
(`fedos_profile_initialization_coordinator.ts:316-365`) before `unlockProfile()`
does anything else (`:506`):

1. `profile.json` (`profileDescriptorFile`) — read by
   `this.#deps.profilePersistence.read()` (`:319`). Absent → `"absent"`
   (no profile to unlock, `:511-514`). Corrupt → `"recovery-required"`
   (`:320-327`).
2. `master-seed.sealed.json` (`sealedMasterSeedFile`) — read by
   `this.#deps.sealedSeedPersistence.read()` (`:527-541`). Missing or
   corrupt after a valid descriptor exists → `"corrupt"` outcome (`:536-541`).

**Nothing else is required to exist.** Every one of the ~30 other `.ndjson`
leaves (`board.ndjson`, `conversation*.ndjson`, `device-registry.ndjson`,
`direct-ratchet-*.ndjson`, `deletion-request-*.ndjson`,
`identity-transition-*.ndjson`, etc.) is wired into
`FedosDesktopRuntimeConfig` as a bare path string
(`#buildRuntimeConfig()`, `:706-822`) and handed to an `AppendOnly*Persistence`
class. Confirmed by reading one representative backend
(`src/os/messenger/conversations/persistence/append_only_fedos_conversation_persistence.ts:38-40,61-79`):
the constructor does **no filesystem I/O**, and `readLogFile()` explicitly
treats `ENOENT` as "an empty, freshly-started log," never throwing. This
pattern is called out in the file's own doc comment as deliberate
("no constructor... I/O of any kind"). So a Recovery Bundle whose Data Part
was entirely dropped (digest mismatch, or an "Identity-only bundle" per
`fedos_recovery_bundle.ts:11-14`'s own documented `dataCiphertext: null`
case) still lets `unlockProfile()` reach `"ok"` — just with every
conversation/board/etc. subsystem starting empty. This is consistent with,
not a gap in, the design's own "Identity Part alone is valid" model — but
it means the manifest-completeness check DESIGN.md §3 describes ("every
listed file present... reject the whole bundle") is a **policy layered on
top by whatever future Recovery Bundle importer writes these files** — it
is not, and cannot be, enforced by `unlockProfile()`/`detectProfileState()`
themselves, which fail-open (treat-as-empty) on missing logs by design.

### 2b. Full ordered list a staged import SHOULD write for the profile to be genuinely usable (not just "unlock succeeds")

From `planFedosLocalProfilePaths()` (`fedos_local_profile_paths.ts:161-199`),
every leaf, grouped:

- **Required for `unlockProfile()` to succeed at all**: `profile.json`,
  `master-seed.sealed.json`.
- **Required for the two directories `ensureFedosLocalProfileDirectories()`
  creates** (`fedos_local_profile_paths.ts:148-151,208-217`): `logs/`,
  `session/` — see 2c, neither is load-bearing content, only presence-as-a-
  directory matters and `ensureFedosLocalProfileDirectories()` (always
  called first, `:408` in `createProfile`, and implicitly assumed already
  present for `unlockProfile` since it's only ever called after a prior
  `createProfile`/import in practice — **note**: `unlockProfile()` itself
  never calls `ensureFedosLocalProfileDirectories()`, so a staged-import
  writer MUST call it, or an equivalent recursive mkdir, before invoking
  `unlockProfile()` on a truly fresh `userData` root, or the very first
  `AppendOnly*Persistence.append()` write will fail with `ENOENT` on the
  root itself).
- **Everything else** (the ~30 `.ndjson` logs) is optional for `unlockProfile()`
  to return `"ok"`, but each is exactly the durable state a real user would
  expect back: `board.ndjson`, `outbox.ndjson`, `conversation.ndjson`,
  `conversation-envelope.ndjson`, `conversation-payload.ndjson`,
  `conversation-membership.ndjson`, `conversation-draft.ndjson`,
  `conversation-capability.ndjson`, `conversation-payload-retention.ndjson`,
  `conversation-invitation-received.ndjson`, `deletion-request-state.ndjson`,
  `deletion-request-decision.ndjson`, `deletion-request-acknowledgement.ndjson`,
  `deletion-request-execution.ndjson`, `deletion-request-inbox-summary.ndjson`,
  `deletion-request-pending-review.ndjson`, `identity-transition-observation.ndjson`,
  `identity-transition-local-decision.ndjson`, `archive-suppression-observation.ndjson`
  — this list matches `FEDOS_RECOVERY_BUNDLE_INCLUDED_LOGS`
  (`fedos_recovery_bundle_profile_selection.ts:23-44`) essentially 1:1 (that
  file is already the canonical "what's in the Data Part" answer and
  post-dates DESIGN.md's own per-asset table).
- **Deliberately excluded** by the newer design
  (`fedos_recovery_bundle_profile_selection.ts:53-69`, matches DESIGN.md
  §4/§5 intent): `device-registry.ndjson`, `device-binding-replay.ndjson`,
  all 4 `direct-ratchet-*.ndjson`, `peer-capability-observation.ndjson`,
  all 3 `sync-*.ndjson`, `archive-suppression-inbound-dedup.ndjson`,
  `archive-suppression-fanout-observation.ndjson`,
  `conversation-transport-observation.ndjson`.

### 2c. `logs/` and `session/` — confirmed non-load-bearing

Both are explicitly excluded from the Recovery Bundle already
(`fedos_recovery_bundle_profile_selection.ts:67-68`, comments: *"non-secret
diagnostics, never durable meaningful data"* / *"navigation/session UI
state, never durable meaningful data"*). Grepped every reference to
`sessionStateDirectory`/`logsDirectory` across `src/os/messenger` — the
**only** two non-definition references anywhere are those same two comment
lines in the profile-selection file. No coordinator, runtime, or unlock
path reads anything under either directory as a precondition. **Confirmed,
not just asserted by that file's own comment**: nothing in
`fedos_profile_initialization_coordinator.ts` or `fedos_desktop_runtime.ts`
reads from `paths.logsDirectory` or `paths.sessionStateDirectory` at
startup — they are write-only sinks for other subsystems (diagnostics /
Navigation UI state respectively), never read back to gate `unlockProfile()`.

### 2d. One more field checked and confirmed clean

`profile.json`'s own `dataDirectoryRoot`/`sealedMasterSeedRef` fields
(`fedos_local_profile_descriptor.ts:65,67`) record the **original**
machine's absolute paths at profile-creation time
(`fedos_profile_initialization_coordinator.ts:460-461`). These are
never cross-checked against the actual runtime `paths` object at
unlock time — `detectProfileState()`/`unlockProfile()` only validate they
are non-empty, bounded-length strings (`fedos_local_profile_descriptor.ts:127-128`).
So a Recovery Bundle that copies `profile.json` verbatim onto a
differently-pathed new machine's `userData` directory does **not** break
unlock on that account — the stale path strings are inert metadata, not a
gap.

---

## 3. Fresh device registration without a second trusted device

**Verdict: CONFIRMED, and the real answer is different from — and better
than — what DESIGN.md §4 implies is needed.** The real production pairing
path is a **local self-pairing loopback**, not a two-party protocol that
needs a second machine physically present.

### 3a. The device signing key is never durably stored — regenerated every single unlock, not just on restore

`FedosDeviceSigningKeypair.generate()`
(`src/os/messenger/device/crypto/fedos_device_signing_keypair.ts:69-71`)
calls `schnorr.utils.randomSecretKey()` — "a real random secret every
call — never derived from the Master Seed, never caller-supplied, never
reused" (file header, `:36-38`: *"process-memory-only — this Arc implements
no durable storage for a Device's own secret"*). Both `createProfile()`
(`fedos_profile_initialization_coordinator.ts:447`) and `unlockProfile()`
(`:564`) call `generateFedosDeviceSigningKeypair()` unconditionally, with
no production override — confirmed by grepping the whole repo for
`generateDeviceKeypair`: the only two hits are the dependency-injection
seam's declaration (`:154`) and its two default-fallback usages (`:447`,
`:564`); no production caller (`fedos_electron_beta_main.cts:679-689`,
`buildFreshCoordinator()`) ever supplies it.

### 3b. `#bootstrapLocalDevice()` is a self-contained, single-process, three-step loopback — no external party required

`#bootstrapLocalDevice()` (`fedos_profile_initialization_coordinator.ts:836-860`)
runs, in the SAME call, on the SAME process:
1. `pairing.createPairingRequest(...)` — the "Joining Device" role, signs a
   proof of possession with the freshly-generated keypair.
2. `pairing.approvePairingRequest(created.value.encoded)` — the
   "Authorizing Device" role, in the SAME process, using
   `config.deviceBindingAccountSigningAuthority`
   (`fedos_device_pairing_facade.ts:367-393`). This is the account's own
   Nostr signing authority — itself a pure function of the just-unsealed
   Master Seed (confirmed: `fedos_electron_beta_main.cts:665,684`,
   `signer = new m.NostrSigningAuthority(masterSeedAuthority)`, passed as
   `accountSigningAuthority`/`deviceBindingAccountSigningAuthority`). No
   relay round-trip, no second device, no manual confirmation — it is a
   synchronous, local call.
3. `pairing.completePairing(...)` — re-verifies and calls
   `registerDevice()`, which returns `"registered-trusted"` immediately
   (`fedos_device_binding_registration_authority.ts:287-330`,
   `persisted_fedos_device_trust_authority.ts:88-139` +
   `confirmTrust()`). No `"pending"`-awaiting-a-human-approval state is
   ever left open on this path.

The Device Pairing Facade's own file header confirms this is deliberate,
not an accident of test wiring: *"The first Device is NOT special-cased
with a caller-supplied `trusted=true`; it proves possession and is
authorized by the same account signature every other Device uses"*
(`fedos_profile_initialization_coordinator.ts:826-834`).

### 3c. Host/artifact gate is machine-independent, not identity-bound

Before any of the above runs, `buildFreshCoordinator()` calls
`activateFedosProductionProfileMasterSeed()` →
`authorizeAndActivateFedosProductionDesktopMasterSeed()`
(`fedos_production_desktop_crypto_activation_authority.ts:95-198`). Traced
in full: it checks (1) a valid Electron-main host attestation object
(constructed locally, no external call — `createElectronMainHostAttestation()`),
(2) presence + hash/signature verification of the packaged WASM artifact
files under `packages/fedos-core-rust/pkg/`. This is a **build/artifact
integrity gate**, not a per-machine or per-hardware binding (no TPM, no
keychain, no prior-launch state referenced) — it passes identically on any
correctly-packaged install of the app, fresh machine or not.

### 3d. So: does a "restore with nobody else around" work?

**Yes, mechanically** — once the Master Seed is unsealed (the passphrase
step), `unlockProfile()` can self-pair and self-trust a brand-new device
identity with zero external dependency. DESIGN.md §4's framing ("register
it via the existing pairing/registration path... rather than silently
resuming") undersells how self-contained this already is — there is no
"needs a second trusted device to approve" fallback to design, because the
real path was never two-party to begin with. Worth being explicit in the
design's revision: this also means **device trust here is not a meaningful
security boundary against "attacker has the passphrase"** — anyone who can
unseal the Master Seed can mint and self-trust an arbitrary new device
every launch. That's a pre-existing property of the shipped pairing model,
not something the Recovery Bundle introduces, but it's worth stating
explicitly rather than implying (as "register it via pairing" phrasing
might) that some meaningful second-factor check happens.

### 3e. Confirmed structural gap this enables (see also §4 below): `unlockProfile()` cannot mint a fresh `localDeviceId`

`unlockProfile()` always calls
`#startAndBootstrap(accountRef, deviceKeypair, descriptor.localDeviceId)`
(`:571`) — it reuses the **existing** descriptor's `localDeviceId` string;
it has no code path to generate a new one (only `createProfile()` does,
`:449`, and `createProfile()` always calls
`this.#deps.masterSeedAuthority.generate()` to mint a **brand-new** seed,
`:415` — it never accepts a restored/imported seed). See §4.

---

## 4. Other concrete feasibility gaps

### 4a. CONFIRMED — no coordinator method exists that combines "restore an imported Master Seed" with "mint a fresh device identity"

Full method inventory of `FedosProfileInitializationCoordinator`
(grepped every method signature): `detectProfileState()`, `createProfile()`,
`unlockProfile()`, `lock()`, `runningRuntime()`, `adoptReplacementRuntime()`,
`recoveryNotice()`, `status()`, plus three private helpers. There is no
`restoreFromRecoveryBundle()` / `importProfile()` / equivalent. This means:

- `createProfile()` mints a fresh `localDeviceId` + fresh device keypair
  (right shape for "new device"), but **always generates a brand-new Master
  Seed** — it has no parameter to accept an already-unsealed/restored seed,
  and it refuses to run at all if a descriptor/sealed file already exists
  (`already-exists`/`recovery-required` guards, `:395-402`).
- `unlockProfile()` restores an existing sealed Master Seed correctly, but
  **always reuses the existing descriptor's `localDeviceId`** — it has no
  parameter to mint a new one, which is exactly what DESIGN.md §4 says a
  restore must do ("mint a fresh `localDeviceId`... never reuse the backed-up
  one").

**Neither existing entry point does what the Recovery Bundle design
requires.** A genuinely new coordinator flow is needed — something like
"stage the imported `profile.json` + `master-seed.sealed.json` +
selected `.ndjson` logs, then run a variant of `createProfile()`'s
identity-generation *shape* (fresh device id + fresh keypair + self-pairing)
but with `unlockProfile()`'s *seed-restoration* logic (`restoreSealed()`
against the imported envelope, not `generate()`)." This is squarely a "new
surface, not just wiring" item, consistent with DESIGN.md's own "Why
DESIGN_ONLY" framing for the Rust side — but the framing should be
broadened: the missing surface is not only Rust/WASM, it is also this exact
TypeScript coordinator method, which is not scaffolded anywhere yet
(confirmed: grepped `src/os/messenger/desktop/recovery/**`, the six files
there are container/codec/inclusion-list/crypto-envelope only — none of
them call into `fedos_profile_initialization_coordinator.ts` at all).

### 4b. LIKELY — Device Registry's stored `devicePublicKeyRef` goes stale after the very first unlock, independent of Recovery Bundle (pre-existing, but directly relevant to §4c below)

Because the device keypair is regenerated fresh on **every** `unlockProfile()`
call (§3a), and `PersistedFedosDeviceTrustAuthority.registerDevice()`'s own
dedup check only compares `deviceId` + `accountRef` — never
`devicePublicKeyRef` — for an already-existing binding
(`persisted_fedos_device_trust_authority.ts:93-100`: *"return { outcome:
"already-registered", binding: existing }"* with no key-equality check),
every unlock after the first returns `"already-present"` / `"already-registered"`
and the Registry's stored `devicePublicKeyRef` silently keeps pointing at
whichever key happened to be generated on the FIRST-ever unlock — never
updated to match the actual key the current process is really signing
with. I could not fully trace (given time budget) whether anything
consequential actually verifies signatures against the stored
`devicePublicKeyRef` later (vs. only ever consulting the durable
`localDeviceId` string, which the design's own §1 citation says is what
Direct Ratchet's `local_device_ref` binds to, not the raw public key) — so
this is marked **LIKELY**, not CONFIRMED, as a live security-relevant bug.
Flagging it because the Recovery Bundle's own §4 plan ("register it via the
existing pairing machinery") inherits this exact same staleness the moment
a restored profile is unlocked a second time (e.g., the user closes and
reopens the app after a successful restore) — worth a from-scratch
verification pass by whoever implements §4b, not something to silently
inherit.

### 4c. CONFIRMED — the design's manifest-completeness check (§3) is enforced nowhere the real unlock path can see

As covered in §2a: `unlockProfile()`/`detectProfileState()` and every
`AppendOnly*Persistence` backend treat a missing `.ndjson` file as "empty
log," not as an error. This is correct/desired behavior for the *existing*
create/unlock flows (a brand-new profile legitimately starts with no
conversation history) but means the Recovery Bundle importer's own
"validate manifest completeness, reject the whole bundle on any mismatch"
promise (DESIGN.md §3 step 2) is a property the **importer itself** must
enforce entirely before ever touching the live profile directory — there
is no fallback safety net one layer down if that importer has a bug. Not a
new finding beyond what DESIGN.md already says ("staged, never in-place"),
but confirms there is zero double-coverage: get the importer's staging/
validation step wrong, and `unlockProfile()` will not catch it — it will
simply and silently start several subsystems empty.

### 4d. Not independently re-verified — flagged as UNABLE TO CONFIRM in the time available

- Whether `activateFedosProductionProfileMasterSeed()`'s WASM artifact gate
  (§3c) could ever plausibly fail on a *freshly installed* (not
  freshly-built-from-source) end-user machine — this depends on how the
  Beta is actually packaged/distributed (whether `pkg/` ships inside the
  installer), which is outside this trace's file set and this session has
  no shell to check `npm run package:beta` output against.
  Cross-reference: prior session memory records "no compiled pkg/" as a
  known worktree artifact, not necessarily a packaged-install issue — I
  did not re-derive this independently here.
- Whether any UI-layer code (Electron renderer / IPC) that a real user
  would actually drive during "Restore from Recovery Bundle" exists at all
  — `ux-recovery-flow.md` / `UX_FLOW_DRAFT.md` exist as design docs; I did
  not trace whether any renderer-side button/command currently calls
  anything under `desktop/recovery/` (given §4a's finding, this would be
  premature — no orchestrator method exists yet for a UI to call).

---

## Required changes to §3/§4 of the design

**§3 (staged import)** should add an explicit step-0 precondition:
call `ensureFedosLocalProfileDirectories()` (or equivalent recursive
mkdir of the profile root) before the "validate manifest" step, since nothing
downstream does this for a truly empty target directory (§2b). It should
also state explicitly, not just imply, that only `profile.json` +
`master-seed.sealed.json` are load-bearing for `unlockProfile()` to
succeed at all — every `.ndjson` log is best-effort content, not a
precondition — so the manifest-completeness check is a product-quality
guarantee the importer owns end-to-end, not a defense the coordinator layer
also provides (§4c).

**§4 (device trust)** needs the biggest revision: replace "register it via
the existing pairing/registration path" with an explicit statement that
(a) this pairing path is a **single-process self-pairing loopback**
requiring no second device, no relay, and no manual confirmation —
mechanically simpler than the design implies, which is good news for
"restore when nobody else is around," but (b) it provides no security
value beyond possession of the unsealed Master Seed, which is worth saying
plainly rather than leaving a reader to assume cross-device confirmation
happens. Most importantly, (c) the design must name and scope a **new
coordinator method** — neither `createProfile()` nor `unlockProfile()` as
they exist today can perform "restore an imported sealed seed AND mint a
fresh device identity" (§4a) — this is a concrete, additional piece of new
surface belonging in the same "Why DESIGN_ONLY" bucket as the Rust/WASM
work, not something "reuses existing machinery" can wave through as pure
wiring.
