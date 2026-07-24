# Secure Runtime Alpha 4661-4740 — Phase A First-Run & Secret-Input Inventory + Branch Reconciliation

Base commit: `568ddb8` (Alpha 4581-4660, Desktop Device Registration,
Pairing, and Durable Sync Journal Arc). Branch
`arc/desktop-master-seed-unlock-first-run-onboarding`, worktree
`C:\wt\desktop-first-run-onboarding`. Ancestry of the nine named
prerequisite arcs was verified by the coordinator via
`git merge-base --is-ancestor` before this session started (single linear
history). This document is the mandated Phase A report: **no production
file was edited before it existed.**

## 0. Branch reconciliation

- **One accepted lineage.** History is linear from `568ddb8` back through
  every named prerequisite arc. No sibling worktree holds an incompatible
  first-run/unlock architecture that would force a choice between accepted
  designs — the reconciliation stop-condition (Precondition Reconciliation
  item 6) does **not** fire. No unrelated branch is merged to inflate
  feature count.
- **Sibling capability absent from this base:** there is no first-run
  onboarding, no profile descriptor, no unlock flow, and no profile-state
  coordinator anywhere in this base. `git grep -il "onboarding\|profile
  descriptor\|first-run\|unlock"` across `src/` returns only unrelated
  matches (the Shell's `"requires-unlock"` outcome kind, which is a static
  vocabulary entry no code path ever emits). This Arc introduces the
  capability; it does not reconcile two rival versions of it.
- **README/status drift:** the README status blurbs stack newest-commit
  first (project convention, confirmed in memory). The newest blurb is
  Alpha 4581-4660. No drift between the README's newest entry and the git
  tip. This Arc prepends one new blurb.

## 1. Master Seed generation / sealing / restoration API

`src/runtime/master_seed/`:

- **Contract:** `FedosMasterSeedAuthority` (`fedos_master_seed_authority.ts`,
  Alpha 438) — `isAvailable()`, `isCleared()`, `generate(): Promise<boolean>`,
  `seal(passphrase: Uint8Array): Promise<FedosSealedMasterSeedEnvelopeV1 |
  null>`, `restoreSealed(envelope, passphrase): Promise<boolean>`,
  `clear(): Promise<void>`, `resolveConversationKey(...)`. **Every method
  returns only a boolean/void/sealed-envelope — no raw seed getter, no
  `nsec` export (Permanent Security Invariants 1-3).**
- **One real implementation:** `FedosWasmMasterSeedAuthority`
  (`fedos_wasm_master_seed_authority.ts`, Alpha 438). Delegates every
  operation to a gated `attemptDevOnlyMasterSeed*Call()` Rust Boundary
  reach on `FedosWasmLoaderSkeleton` (`../fedos_wasm_loader.ts`). Owns no
  cryptography itself.
- **Sealed wire type:** `FedosSealedMasterSeedEnvelopeV1`
  (`fedos_sealed_master_seed_envelope.ts`, Alpha 435) — an opaque
  `{ readonly json: string }` whose JSON is Argon2id-wrapped
  ChaCha20-Poly1305 ciphertext (fixed key order `v,kdf,m,t,p,salt,alg,n,ct`),
  produced and authenticated **only** by Rust's `restore_sealed`.
  `isWellFormedSealedMasterSeedEnvelopeV1Json()` is a structural pre-check
  (prefix `{"v":1,"kdf":"argon2id"`) only — never authentication.
- **Sealed persistence:** `FileFedosSealedMasterSeedEnvelopePersistence`
  (`fedos_sealed_master_seed_envelope_persistence.ts`, Alpha 1266/1290) —
  `read(): envelope | null` (null on first run; **throws** on a
  structurally-malformed existing file — fail closed, never auto-replace),
  `writeIfAbsent(): "written" | "already-exists" | "failed"` (**never
  overwrites**). No delete/overwrite method exists by design.

## 2. WASM loader prerequisites & dev/production crypto gate — THE BLOCKER

`attemptDevOnlyMasterSeedAuthorityConstructCall()` /
`...GenerateCall()` / `...SealCall()` / `...RestoreSealedCall()`
(`src/runtime/fedos_wasm_loader.ts`) each succeed **only** when ALL of:
`artifactCheck.artifactsExist` **&&** `devGate.developmentAllowed` **&&**
`readiness.ready` **&&** `importResult.succeeded` **&&** `module` present
**&&** `wasmInit.succeeded`. Two of these cannot be satisfied in this
worktree:

1. **`artifactsExist` is false here.** There is no compiled
   `packages/fedos-core-rust/pkg/` in this fresh worktree (project memory:
   "no compiled pkg/ here; all real-crypto/artifact-missing test failures
   are pre-existing"). Building it requires `npm run build:wasm`
   (`cargo build --target wasm32-unknown-unknown` + `wasm-bindgen`).
2. **The dev-only gate is closed by design.** `createDynamicLoaderGate()`
   (`fedos_dynamic_loader_gate.ts`, Stage 570) is hardcoded
   `{ gateState: "PlanningOnly", dynamicLoaderAllowed: false }` and
   `createDynamicLoaderDevApproval()` (`fedos_dynamic_loader_dev_approval.ts`,
   Stage 578) is hardcoded `{ approved: false, reason: "DevApprovalPending" }`
   — `true` exists only as a RESERVED, unreachable value. Production builds
   never open this gate at all.

**Consequence (honest, load-bearing):** real Master Seed *generation*,
*sealing*, and *restoration* are unreachable through the real Desktop
stack in this worktree. This is exactly the Phase D fallback condition and
the spec's pre-authored honest-partial commit title. Per Phase D, this Arc
implements profile detection, locked-state presentation, the application
service boundary, and a **development-only injected unlock/seed authority**,
and stops honestly before claiming user-ready production unlock.

## 3. Existing passphrase / unlock inputs

- `FedosPassphraseProvider` (`fedos_passphrase_provider.ts`, Alpha 1267) —
  the accepted narrow boundary between "something obtains a passphrase" and
  "the Master Seed Authority uses it." `obtainPassphrase(): Promise<{outcome:
  "provided"; passphrase: Uint8Array} | "unavailable" | "cancelled" |
  "failed">`. Implementations: `FedosFixedPassphraseProvider` (wraps an
  already-in-memory `Uint8Array`, `clear()` zeroes it) and
  `UnavailableFedosPassphraseProvider` (always `"unavailable"`, the safe
  default). **Explicit Alpha 1267 scope limit: "no GUI prompt, no CLI read"
  — an interactive provider is a future, reviewed stage.** No passphrase
  field exists on any Runtime config type (Alpha 1266 rule) — a *provider
  instance* may be injected, never a raw passphrase value.
- No `process.env`/CLI-argument passphrase path exists anywhere in `src/`
  (confirmed by grep). This Arc must not add one (Absolute Prohibitions).

## 4. Desktop Runtime startup sequence

`startFedosDesktopRuntime(config: FedosDesktopRuntimeConfig)`
(`src/desktop/runtime/fedos_desktop_runtime.ts`, Alpha 606+) constructs, in
order: Board runtime, conversation runtime, optional private transport,
optional archive runtime, and — inside the `config.deviceTrustEnabled` gate
— the Device Registry persistence, `PersistedFedosDeviceTrustAuthority`,
`FedosSyncState`, `FedosDeviceTrustRuntime`, optional Sync Scheduler, and
optional `deviceBinding()`/`devicePairing()` facades (Alpha 4581-4660).
Returns a `FedosRunningDesktopRuntime`. **The config is entirely
caller-supplied non-secret objects/paths.** Notably it ALREADY accepts:
`conversationArchiveMasterSeedAuthority?: FedosMasterSeedAuthority`,
`localDeviceId?`, `localAccountRef?: FedosDeviceBindingAccountRef`,
`deviceRegistrationAuthority?`, `deviceBindingAccountSigningAuthority?:
FedosNostrSigningAuthority`, and all durable `*LogPath` fields. **This Arc's
coordinator's job is to produce these values honestly from a first-run/unlock
flow, then call `startFedosDesktopRuntime()` — never to construct a second
Runtime.**

## 5. Application Shell command surface

`FedosDesktopApplicationShell` (`src/desktop/shell/fedos_desktop_application_shell.ts`,
Alpha 2841-2920) — owns exactly one `FedosRunningDesktopRuntime`;
`start()`/`stop()` plus conversation/message/search/archive/device-sync/
pairing commands, every one returning the closed `FedosDesktopShellResult<T>`
vocabulary (`fedos_desktop_shell_result.ts`: `ok | unavailable |
unauthorized | not-found | invalid-input | conflict | requires-activation
| requires-unlock | unsupported | failed`). **The Shell is constructed with
an already-assembled config and calls `start()` to build the Runtime — it
has no concept of profile state, unlock, or first-run.** The
`"requires-unlock"` outcome kind exists in the vocabulary but no code path
emits it — a reserved slot this Arc's boundary gives real meaning.

## 6. Electron main/preload command surface

`packages/fedos-desktop-electron-spike/` — `fedos_electron_host_adapter_dispatch_translation.ts`'s
`fedosElectronHandleInvoke()` is an ALREADY-GENERIC multiplexer over three
ops (`dispatch`/`render`/`status`); `dispatch` forwards its `command`
payload verbatim into `FedosDesktopHostBridge.dispatch()`, which re-validates
against `validateFedosDesktopHostCommand()`. **Prior-arc finding (Alpha
4581-4660 Phase J), re-confirmed: extending the Host command vocabulary +
the bridge switch is sufficient to reach a command through the existing
Electron IPC path — the `.cts` main/preload files need no change.**
`contextIsolation` enabled, `nodeIntegration` disabled, `sandbox` enabled —
this Arc changes none of it.

## 7. Device identity + Device Registry initialization

- **Device key:** `FedosDeviceSigningKeypair`
  (`src/device/crypto/fedos_device_signing_keypair.ts`, Alpha 3161-3240) —
  real independent BIP-340 Schnorr keypair via `@noble/curves`
  (`schnorr.utils.randomSecretKey()`). Opaque handle, no private-key getter,
  process-memory-only. `generateFedosDeviceSigningKeypair()`.
- **Account proof:** `authorizeFedosDeviceBindingChallenge()` +
  `verifyFedosDeviceBindingAccountAuthorization()`
  (`src/device/binding_challenge/`) — real Nostr-event Schnorr signature
  from a `FedosNostrSigningAuthority`.
- **Device proof:** `fedos_device_binding_proof_of_possession.ts` — a
  second, domain-separated real Schnorr signature.
- **Registration authority:** `FedosDeviceBindingRegistrationAuthority`
  (`fedos_device_binding_registration_authority.ts`) — verifies both proofs
  + replay guard, returns `"registered-trusted" | "already-present" |
  "conflict" | ...`. Reached in a running Runtime via
  `runtime.devicePairing()` (Alpha 4581-4660) over the SAME Device Registry
  the Runtime already owns — **never a second Registry.**
- **Pairing facade:** `FedosDevicePairingFacade`
  (`src/desktop/runtime/fedos_device_pairing_facade.ts`) —
  `createPairingRequest(deviceId, keypair, accountRef)`,
  `approvePairingRequest(...)`, `completePairing(...)`, `registrationStatus`,
  `revokeDevice`, `listPendingPairings`.
- **Non-WASM real signing for the account side exists:**
  `test/support/real_fedos_nostr_signing_authority.ts`
  (`RealFedosNostrSigningAuthority`) — real BIP-340 Schnorr
  `FedosNostrSigningAuthority` NOT requiring WASM. This means **the local
  Device bootstrap with real account+device proofs and real registration to
  `"trusted"` IS reachable in the development-runtime path** — the WASM gate
  blocks only tying the account identity to a sealed *Master Seed*, not the
  device-registration cryptography itself.

## 8. Durable Conversation/Search/Archive/Sync-Journal/Registry paths

Every durable concern is a caller-supplied explicit `*LogPath` string on
`FedosDesktopRuntimeConfig` (§4). There is **no** path-planning authority
today — each call site hand-builds absolute paths. Phase G introduces one
profile-root planner that derives every subpath deterministically from a
single profile root, so the coordinator supplies a coherent set.

## 9. Profile existence detection & current first-run failure behavior

**There is none.** A fresh install has no way to detect "does a profile
exist," no descriptor to read, and no unlock gate. `startFedosDesktopRuntime()`
will happily start with in-memory backends and no account identity —
`localDeviceId`/`localAccountRef`/`deviceBindingAccountSigningAuthority` are
optional and, when omitted, leave device trust `"unavailable"` and the
Master Seed authority unconfigured. **Reproduced in this session** (see
`test/secure_runtime_alpha_4661_4740_first_run_onboarding.test.ts`,
"baseline first-run gap"): constructing and `start()`-ing a Shell with no
profile/unlock reaches a running Runtime with **no unlocked Master Seed
authority and no account identity** — i.e. there is no safe, explicit
first-run/unlock path; the app cannot honestly reach a per-user usable
state through any reviewed boundary.

## 10. Current secret-redaction behavior

`FedosDesktopShellResult` failures carry only a short non-secret `reason`
string; no `Error`/stack/backend detail crosses the boundary. The
passphrase provider never logs. This Arc's trusted secret payload type
(Phase J) continues this: the unlock secret enters only through a dedicated
payload object, is redacted from every diagnostic/`toString`/command echo,
and is never placed on a serializable config or a command response.

## 11. Exact production files expected to change / be created

**New** (all under `src/desktop/onboarding/`):
- `fedos_local_profile_descriptor.ts` — Phase B model + validator + codec.
- `fedos_local_profile_persistence.ts` — Phase B port + in-memory + file backend.
- `fedos_profile_lifecycle_state.ts` — Phase C closed state machine.
- `fedos_local_profile_paths.ts` — Phase G durable path authority.
- `fedos_profile_unlock_secret.ts` — Phase D/J trusted secret payload + redaction.
- `fedos_development_master_seed_authority.ts` — Phase D dev-only injected authority (labeled non-crypto lifecycle double).
- `fedos_profile_initialization_coordinator.ts` — Phase E/F/H/M the ONE coordinator.
- `fedos_profile_recovery_notice.ts` — Phase I recovery-material UX boundary.
- `fedos_onboarding_presentation.ts` — Phase K framework-neutral view models.
- `fedos_onboarding_command.ts` — Phase J closed command vocabulary + validation + dispatcher.

**Modified:** `README.md` (one prepended blurb). **New tests + docs** under
`test/` and `docs/`.

**Explicitly NOT modified:** `fedos_desktop_runtime.ts`,
`fedos_desktop_runtime_config.ts`, the Shell, the Host command union, the
Electron `.cts` files, and every crypto/Rust/WASM file. The coordinator
*consumes* the existing config surface; it does not widen it. (See the
completion declaration for why the Shell/Host/Electron wiring is the honest
stop point rather than an omission.)

## 12. Baseline test failures

`node_modules` was absent in this fresh worktree (same as the prior arc's
own environment note) — installed with `npm install` at the root before
any verification. Known pre-existing, not-ours classes, per this lineage's
carried notes and confirmed by A/B against a sibling checkout:
`test/secure_runtime_alpha_477_scheduler_lifecycle_model.test.ts:121`; the
`?raw`-import / missing-WASM-`pkg/` artifact class; and the `test/reviews/**`
git-status-clean-only class (resolves on commit). This Arc's new files add
zero Rust/WASM dependency, so none of those classes is touched.

## 13. Full / partial execution plan

Implement Phases B, C, G, D(fallback), E, F, H(dev-real proofs), I, J, K,
M as real, tested boundaries under `src/desktop/onboarding/`, coordinating
the existing authorities through the existing `FedosDesktopRuntimeConfig`
surface, with a development-only injected Master Seed authority. **Stop
precisely** at: real Master Seed generation/seal/restore (Phase 2 blocker),
the Electron secret-input boundary (no reviewed GUI passphrase prompt
exists — Alpha 1267 scope limit), and Shell/Host/Electron production wiring
of onboarding (which is only meaningful once a real unlocked Master Seed
authority can be produced). Document all three honestly (Phases D, L, P).
Commit under the honest-partial title.
</content>
</invoke>
