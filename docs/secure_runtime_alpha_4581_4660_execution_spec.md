# Secure Runtime Alpha 4581–4660: Desktop Device Registration, Pairing, and Durable Sync Journal Arc — Execution Spec

Base: `arc/desktop-device-sync-electron-main-integration` at commit
`8b0492e`, "Add Secure Runtime Alpha 4501-4580: Desktop Device Sync
Electron Main Integration Arc" (the immediately-prior arc, whose own
completion declaration explicitly recommended THIS Arc next). Worktree
`C:\wt\desktop-device-pairing`, branch
`arc/desktop-device-registration-pairing-durable-journal`.

See `docs/secure_runtime_alpha_4581_4660_phase_a_inventory.md` for the full
22-item source inventory this Arc's plan is built on.

## Objective (restated from the two named blockers)

1. Device registration and pairing exist below the Shell boundary (Alpha
   3161-3240's real `FedosDeviceBindingRegistrationAuthority`), but were
   never reachable through the real Desktop application stack.
2. The Sync Journal (`FedosSyncJournal`) has no durable Desktop Runtime
   path/configuration — a restarted application loses every journaled Sync
   record even when every other durable path is supplied.

## What was actually built, by phase

**Phase B** — `src/desktop/runtime/fedos_device_pairing_facade.ts`,
`FedosDevicePairingFacade`. Composes the EXISTING `FedosDeviceBindingBoundary`
(`createFedosDeviceBindingBoundary()`, Alpha 3161-3240, previously
unwired — its own header already named this exact integration point) and
the EXISTING `FedosDeviceTrustRuntime` — constructs neither's underlying
persistence itself. Public surface: `createPairingRequest()`,
`listPendingPairings()`, `completePairing()` (Joining Device);
`inspectPairingRequest()`, `approvePairingRequest()`, `revokeDevice()`
(Authorizing Device); `registrationStatus()` (either). Owns no crypto
implementation (every signature check/production reuses the unmodified
Alpha 3161-3240 functions) and no independent trust truth (every mutating
call delegates to `FedosDeviceBindingRegistrationAuthority`).

**Phase C/D** — `src/device/binding_challenge/fedos_device_binding_pairing_exchange.ts`.
`FedosDevicePairingRequestV1` (challenge + Joining Device's own proof of
possession) and `FedosDevicePairingApprovalV1` (challenge + account
authorization) — both plain, versioned, JSON-encodable records with strict
structural validation (exact key count, cross-field challenge-identity
consistency, 16 KiB hard size ceiling checked BEFORE `JSON.parse()`). No
private key, Master Seed, passphrase, bearer secret, or Sync package byte
in either shape — confirmed both structurally (`isWellFormedFedosDevicePairing*V1()`)
and by a real test asserting the encoded byte string never matches
`/secret|private|seed|passphrase/i`. `encode*`/`decode*` ARE this Arc's own
"minimal transport-neutral pairing port" (Phase D) — a caller moves the
resulting bounded UTF-8 string by whatever out-of-band channel it likes;
nothing in this file performs I/O. No QR/Bluetooth/LAN/Relay
implementation exists anywhere in this Arc.

**Phase E** — `src/desktop/runtime/fedos_desktop_runtime.ts` gains one new
accessor, `devicePairing()`, on `FedosRunningDesktopRuntime`, constructed
ONLY when `config.deviceTrustEnabled` is `true` (the SAME gate
`deviceTrust()`/`deviceSyncOperational()` already use), over the SAME
`deviceRegistryPersistence` instance `FedosDeviceTrustRuntime`'s own
`PersistedFedosDeviceTrustAuthority` already uses — never a second Device
Registry (see the Phase A inventory's own §8 finding: `PersistedFedosDeviceTrustAuthority`
is a stateless read-through orchestrator, so a second thin instance over
the identical persistence is safe and was already the documented,
pre-approved integration shape). Same two-state fail-closed
`"not enabled"`/`"inaccessible after stop"` contract every other accessor
uses.

**Phase F** — `src/sync/persistence/` gains a new port
(`fedos_sync_journal_persistence.ts`), codec, and two implementations
(`in_memory_fedos_sync_journal_persistence.ts`,
`append_only_fedos_sync_journal_persistence.ts`, following the EXACT
NDJSON-backend precedent `append_only_fedos_device_binding_challenge_replay_persistence.ts`
already established: insert-only, deterministic replay, fail-closed on a
corrupt or conflicting-duplicate line). `FedosSyncJournal`
(`src/sync/fedos_sync_journal.ts`) gains an OPTIONAL constructor parameter
— omitted (every pre-existing call site), behavior is byte-for-byte
unchanged; supplied, it hydrates from the durable backend at construction
and write-throughs every successful `append()`. `FedosSyncJournalAppendOutcome`
gains one new value, `"failed"` (a durable write failure — the in-memory
append still succeeded, but a caller such as `FedosSyncState.recordLocalChange()`
must not fan out to other devices on `"failed"`; it already only fans out
on `"appended"`, so this required zero changes to that call site).
`FedosSyncState` gains an OPTIONAL `journalPersistence` dependency, passed
straight through. `startFedosDesktopRuntime()` wires this over the new
`config.deviceSyncJournalLogPath` field.

A REAL gap found only by testing (documented honestly, not smoothed over):
admitting a Device into the local Sync fabric's TARGET set
(`FedosDeviceTrustRuntime.registerSyncDevice()`) writes into
`FedosSyncState`'s own `FedosSyncDeviceRegistry` — a SEPARATE, always-in-memory
structure (Alpha 2421-2500, unmodified) from the durable Device Trust
Registry. Making the JOURNAL durable did not, by itself, make sync
ELIGIBILITY durable: a real restart test failed with `syncEligible: false`
for an already-`"trusted"` Device until this Arc added an explicit restart
hydration step in `startFedosDesktopRuntime()`'s own `deviceTrustEnabled`
block — after constructing `FedosDeviceTrustRuntime`, every CURRENTLY
`"trusted"` binding for the local account is re-admitted into the Sync
fabric via the SAME public `registerSyncDevice()` method every other caller
already uses. No new Sync Foundation semantics, no second registry — just
restoring what the durable Device Trust Registry already answers
authoritatively.

**Phase G** — `src/desktop/runtime/fedos_desktop_runtime_config.ts` gains
five new, entirely optional fields, all following the existing "explicit
caller-supplied path, no default, no cwd-relative implicit path"
convention verbatim: `deviceBindingChallengeReplayLogPath`,
`deviceBindingChallengeTtlSeconds`, `deviceBindingAccountSigningAuthority`,
`deviceBindingAccountIndex`, `deviceSyncJournalLogPath`. Every
pre-existing call site compiles unchanged (all five are optional, no
required-field surface widened). Parent-directory creation for the two new
log paths is added alongside the existing `ensureParentDirectoryExists()`
calls.

**Phase H** — `src/desktop/shell/fedos_desktop_application_shell.ts` gains
seven methods: `devicePairingCreate`, `devicePairingsList`,
`devicePairingInspect`, `devicePairingApprove`, `devicePairingComplete`,
`deviceRevoke`, `deviceRegistrationStatus` — every one delegates entirely
to `runtime.devicePairing()`, mapped onto the Shell's EXISTING, unmodified
`FedosDesktopShellOutcomeKind` (never widened — several pairing-specific
outcomes collapse onto the closest existing bucket, with the fine-grained
distinction preserved verbatim in `reason` text). The Shell itself now owns
the ONE thing the facade deliberately does not: an in-process
`#pairingKeypairsByPairingId` map, so a real Electron IPC caller (which can
only ever send/receive plain, JSON-safe strings) never has to hold, or be
handed, a Device's own private key — `devicePairingCreate()` generates a
fresh `FedosDeviceSigningKeypair` and holds it; `devicePairingComplete()`
retrieves and consumes it by `pairingId`.

`src/desktop/host_boundary/fedos_desktop_host_command.ts` gains seven new
command types (`device-pairing-create`, `device-pairing-inspect`,
`device-pairing-approve`, `device-pairing-complete`, `device-pairings-list`,
`device-revoke`, `device-registration-status`), each with real structural
validation (id bounds, pairing-record byte-length ceiling, account-ref
shape). `fedos_desktop_host_bridge.ts`'s `#dispatchOne()` gains one `case`
per command, each a direct `boundary.shell.<method>()` call — the SAME
pattern `conversation-create-direct`/`conversation-create-group` already
use for a Shell method with no dedicated ViewModel.

**Phase I** — `src/desktop/presentation/fedos_desktop_device_pairing_view_model.ts`
(NEW, the seventh ViewModel, mirroring the existing six's exact "thin
Shell-wrapping state holder" shape) is registered as `devicePairing` on
`FedosDesktopConversationUiPresentationBoundary`. `FedosDeviceManagementController`
gains real `createPairingRequest`/`refreshPendingPairings`/
`inspectPairingRequest`/`approvePairingRequest`/`completePairing`/
`confirmRevokeDevice` methods, all delegating to this new ViewModel — never
the Shell directly (preserving the controller's own stated layering rule).
The pre-existing, HONEST "registration has no Shell/Facade command on this
base" / "revocation has no Shell/Facade command on this base" screen
content (Alpha 3941-4020's own accurate finding at the time) is updated to
`available: true` / `confirmAvailable: true`, with an updated reason
string naming the real command that now exists — the historical Alpha
3941-4020 tests asserting the OLD `false` value are updated in place (see
"Historical test updates" below), never weakened beyond restoring
truth.

**Phase J** — Verified, not merely assumed: `packages/fedos-desktop-electron-spike/src/fedos_electron_host_adapter_dispatch_translation.ts`'s
`fedosElectronHandleInvoke()` is ALREADY a generic 3-op (`dispatch`/`render`/`status`)
multiplexer that forwards any `command` payload verbatim into
`FedosDesktopHostBridge.dispatch()`, which itself re-validates against
`validateFedosDesktopHostCommand()`. Adding the seven new command types to
that ONE vocabulary function (Phase H, above) is therefore SUFFICIENT to
make them reachable through the real, unmodified Electron IPC path — `fedos_electron_host_adapter_main.cts`/`_preload.cts`
needed, and received, ZERO changes. Verified end-to-end by a real test
(`fedosElectronHandleInvoke()` against a real, started
`FedosDesktopHostBridge`, dispatching a real `device-pairing-create`
command and receiving a real, cryptographically-produced pairing request).

**Phase K/L** — proven via a real, two-independent-`FedosDesktopApplicationShell`
end-to-end test (`test/secure_runtime_alpha_4581_4660_device_registration_pairing_durable_journal.test.ts`).
Exact semantics, stated once and for all: registration recorded through
this Arc's pairing flow is LOCAL to whichever machine's own Device Registry
a `registerDevice()` call reaches. The Authorizing Device's own
`approvePairingRequest()` ALSO immediately, locally records the identical,
already-fully-verified binding into ITS OWN local Registry (an explicit,
disclosed, purely local side effect — never a network call, never a claim
about the Joining Device's own state) so both machines' local Sync
Scheduler/target planning can see the new Device without a human
separately registering it twice. This is NOT cryptographic bidirectional
trust — it is two independent local writes of the identical, already-verified
fact. A real, disclosed corollary: revocation is equally local — revoking
on the Authorizing Device's own Registry does NOT reach the Joining
Device's own separate Registry (proven by a real restart test asserting
the Joining Device still reports `"trusted"` after the Authorizing Device
revoked and restarted). This codebase has no cross-machine Device Registry
synchronization anywhere (confirmed: the Sync Journal carries only
allow-listed Conversation-change records, never Device Registry facts).

## Historical test updates (genuinely stale, not weakened)

Three pre-existing tests from Alpha 3941-4020 asserted `available: false`
/ `confirmAvailable: false` as an honest fact of THAT Arc's own base (no
real Shell command existed yet) — updated to `true` now that Alpha
4581-4660 closes exactly that gap; every OTHER assertion in those tests
(exact screen, exact Device id, exact warning text) is preserved
unweakened. One structural guard
(`secure_runtime_alpha_3941_4020_security_boundary_guards.test.ts` #14,
"no existing Shell file is modified by this Arc") narrowed its own
protected-file list to exclude `fedos_desktop_application_shell.ts`
specifically (this later Arc is explicitly authorized to extend it, Phase
H) while preserving protection on the six untouched Alpha 3801-3880
ViewModels/renderers — mirroring the IDENTICAL precedent Alpha 4101-4180
already set for guard #13 (package.json).

## Absolute Prohibitions — compliance record

No second Device Registry (Phase E, above). No second Device Trust
Runtime (`devicePairing()` composes the EXISTING `deviceTrustRuntimeInstance`).
No second Sync Journal (`FedosSyncJournal` itself, unmodified business
semantics, one optional backend). No second Scheduler. No redesign of
account-to-device signatures, Device proof-of-possession, Transfer
Session, or Relay Sync (zero lines changed in any of those files). No
Device/account private key exposed (verified structurally by a real test
against every new source file's own public surface). No raw signature
exposed unnecessarily (the pairing exchange record IS the explicit,
user-controlled transfer artifact Phase I names as the one exception — and
is labeled as such in this document and the Shell's own field doc
comments). No encrypted Sync package byte exposed to the UI (the pairing
exchange format carries no Sync package field at all). No secret in the
Sync Journal (opaque `contentHash` only, unchanged). No label/QR/caller
string trusted as identity proof (every registration path requires a real,
independently-re-verified signature). No silent trust (every mutating
facade call re-verifies both signatures fresh). No revoked-Device
restoration (the underlying transition table's terminal `"revoked"` state
is unmodified). No cloud accounts, push notifications, remote Device
discovery, Onion/Tor, MLS, or Sender-Key synchronization implemented. No
React/Vue/Svelte/Tauri or new dependency added (verified: `package.json`'s
own `dependencies` still list exactly `@noble/curves`/`@noble/hashes`). No
Electron security setting changed. `p2p/`/`.tmp_gen/` untouched (verified
by `git status`).
