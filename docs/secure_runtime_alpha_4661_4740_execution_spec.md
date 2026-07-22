# Secure Runtime Alpha 4661-4740 — Execution Spec (Phase-by-Phase)

Base commit `568ddb8`. Branch
`arc/desktop-master-seed-unlock-first-run-onboarding`. See
`secure_runtime_alpha_4661_4740_phase_a_first_run_inventory.md` for the
reconciliation + source inventory and
`secure_runtime_alpha_4661_4740_completion_declaration.md` for the honest
completion/blocker statement, threat model, and verification.

All new production source lives under one directory — `src/desktop/onboarding/`
— composing existing authorities through the existing
`FedosDesktopRuntimeConfig`/`startFedosDesktopRuntime()` surface. Zero
existing source file was modified except `README.md`.

## Phase B — Local profile model

`fedos_local_profile_descriptor.ts` — `FedosLocalProfileDescriptorV1`
(schemaVersion, profileId, displayLabel, accountPublicIdentity, localDeviceId,
createdAt, lastOpenedAt, sealedMasterSeedRef, dataDirectoryRoot,
initializationState, migrationVersion). Strict 11-key validator that also
rejects any forbidden secret-shaped key; deterministic fixed-key-order codec;
fail-closed `decode`. `fedos_local_profile_persistence.ts` — port +
`InMemoryFedosLocalProfilePersistence` (tests) + `FileFedosLocalProfilePersistence`
(mirrors `FileFedosSealedMasterSeedEnvelopePersistence`): `writeIfAbsent`
never overwrites, `update` advances state, corrupt file fails closed
(`FedosLocalProfileCorruptError`), plus `classifyFedosLocalProfileDuplicate`
(identical vs conflicting). **Profile metadata is not identity authority.**

## Phase C — Profile state machine

`fedos_profile_lifecycle_state.ts` — closed union `absent | initializing |
locked | unlocking | ready | failed | recovery-required | stopped`, a closed
event union, an explicit exhaustive transition table, and a total
`applyFedosProfileLifecycleTransition` (illegal transition returns the
unchanged state). Invariants: Runtime permitted ONLY in `ready`; unlock
failure `unlocking -> locked`; corruption/identity-mismatch `-> recovery-required`
(never `absent`); `ready -> stopped -> locked` on relaunch (profile
preserved).

## Phase G — Durable path authority

`fedos_local_profile_paths.ts` — one absolute profile root -> deterministic,
hardcoded, traversal-proof subpaths (descriptor, sealed seed, board/outbox/
conversation/envelope/payload/membership logs, device registry, replay,
sync journal/schedule/conflict, logs, session). Relative root rejected.
`ensureFedosLocalProfileDirectories` (assembly-owned dir creation),
`fedosLocalProfilePathsIsolated` guard. Windows/Japanese/OneDrive long-path
supported; short-path packaging preference documented, not enforced.

## Phase D — Secure unlock input boundary + fallback

`fedos_profile_unlock_secret.ts` — `FedosProfileUnlockSecret`: one-shot
`consume()` (zeroes on use), `byteLength` (coarse, non-secret),
`toString`/`toJSON` redacted. Decision: options D (OS keychain) / E (env
var) rejected by Absolute Prohibitions; option A (renderer form through the
frozen preload) is the eventual transport but no reviewed GUI passphrase
boundary exists today (Alpha 1267 scope limit) AND real Master Seed crypto
is gate-blocked (Phase A §2). Per Phase D's fallback clause this Arc ships a
**development-only injected authority**
(`fedos_development_master_seed_authority.ts`, a clearly-labeled
non-cryptographic lifecycle double: generate/seal/restore lifecycle with a
one-way passphrase verifier, NO seed byte, NO plaintext passphrase) and
STOPS before claiming user-ready production unlock.

## Phase E — Profile initialization coordinator (Flow A)

`fedos_profile_initialization_coordinator.ts` — the ONE coordinator.
`createProfile()` validates label + coarse secret length; refuses to
overwrite an existing/partial profile; creates dirs; `generate()`s the seed;
consumes the secret once to `seal()`; persists ONLY sealed material
(`writeIfAbsent`); resolves the account public identity; generates a real
independent Device key; writes the descriptor as `initializing`; starts the
Runtime + bootstraps the Device; marks `ready` ONLY after every step. No
owned cryptography, no private-key persistence, explicit rollback (a failed
create leaves the partial descriptor as `failed`, never deleted — forensic).

## Phase F — Existing profile unlock (Flows B/C)

`unlockProfile()` — detect; read sealed material (fail closed on corrupt/
missing -> `corrupt`); `restoreSealed()` with the consumed secret; wrong
secret is an indistinguishable coarse `unlock-failed` that returns to
`locked` with NO running Runtime; validate restored account identity against
the persisted public identity (mismatch -> `recovery-required`); start the
Runtime + hydrate; mark `ready`.

## Phase H — Local Device initialization

Real, independent Device key (`FedosDeviceSigningKeypair`, real BIP-340).
The first Device is NOT special-cased: `#bootstrapLocalDevice()` runs the
real pairing exchange (`createPairingRequest -> approvePairingRequest ->
completePairing`) through `runtime.devicePairing()` — a real account Schnorr
authorization + a real Device proof-of-possession, reaching `"trusted"`. No
caller-supplied `trusted=true`. When no account signing capability is
configured, the Device honestly stops at `"unavailable"` and the profile
still reaches ready.

## Phase I — Recovery material UX boundary

`fedos_profile_recovery_notice.ts` — honest backup requirement (sealed seed
file + descriptor, both required), forgotten-secret-is-unrecoverable stated,
NO plaintext seed display. Conversation-Archive export flagged separately
(recovers message data, not account authority).

## Phase J — Shell/Host commands

`fedos_onboarding_command.ts` — closed vocabulary (`profile-status`,
`profile-create`, `profile-unlock`, `profile-lock`, `profile-recovery-status`,
`profile-initialization-status`, `profile-open`, `profile-stop`), total
non-secret validator, `redactFedosOnboardingCommand` (secret always
redacted), and `dispatchFedosOnboardingCommand` over the coordinator. The
secret rides ONLY the dedicated `FedosProfileUnlockSecret` payload; no
response ever echoes it.

## Phase K — Presentation / renderer

`fedos_onboarding_presentation.ts` — framework-neutral view models for
welcome, create-or-open, create-profile form, unlock form, initializing,
recovery-warning, profile-ready, unlock-failed, recovery-required,
runtime-startup-failed, stopped. Only safe fields + explicit action
descriptors; no hidden auto-submit; no secret/handle/stack.

## Phase L — Electron main/preload integration (honest stop point)

No `.cts` change is made. Per the prior-arc, re-confirmed Phase A §6
finding, the Electron dispatch translation is an already-generic
command-forwarding multiplexer: extending the Host command vocabulary is
sufficient to reach a command through the existing IPC path. The onboarding
command layer (Phase J) is deliberately kept as a coordinator-facing
boundary rather than being wired into the production Shell/Host union in
THIS Arc, because a production onboarding command is only meaningful once a
real unlocked Master Seed authority can be produced — which the closed WASM
crypto gate prevents (Phase A §2). Wiring it into the Shell/Host now would
manufacture a user-facing "unlock" that cannot honestly succeed in a
packaged build. Electron security settings are unchanged (contextIsolation
on, nodeIntegration off, sandbox on).

## Phase M — Lock and shutdown

`coordinator.lock()` — stops the active Runtime (absorbing its
non-idempotent `stop()` throw), drops the Device keypair reference, clears
the in-memory seed authority, returns to `stopped`, leaves durable encrypted
state intact. Idempotent at the coordinator layer.

## Phase N — Interruption and recovery

Real tests: descriptor stuck `initializing` -> `recovery-required`; corrupt
descriptor -> `recovery-required`; sealed-present-no-descriptor ->
`recovery-required`; missing sealed on unlock -> `corrupt`. No false ready,
no silent new-profile overwrite in any case.

## Phase O — Real acceptance tests

`test/secure_runtime_alpha_4661_4740_first_run_onboarding.test.ts`, 40/40
passing, against the REAL `startFedosDesktopRuntime()` and REAL BIP-340
proofs. Development-runtime real acceptance is clearly distinguished from
packaged production availability (the seed crypto is the dev double; the
runtime, device registration, durable persistence, and identity checks are
all real). Production unlock is NOT claimed.
