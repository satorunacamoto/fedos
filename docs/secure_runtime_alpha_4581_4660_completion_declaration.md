# Secure Runtime Alpha 4581–4660: Desktop Device Registration, Pairing, and Durable Sync Journal Arc — Completion Declaration

**Full completion.** A real two-Device pairing lifecycle — challenge
minting, account authorization, Device proof of possession, registration,
sync eligibility, revocation — is now reachable end to end through the
real Desktop application stack (Electron IPC → Host Bridge → Shell →
Pairing Facade → Device Binding Registration Authority → Device Registry),
proven with real BIP-340 Schnorr signatures on both the account and Device
sides, and the Sync Journal now has a real, restart-surviving durable
backend. Both blockers Alpha 4501-4580 named are closed.

Base: `arc/desktop-device-sync-electron-main-integration` at commit
`8b0492e`. See `docs/secure_runtime_alpha_4581_4660_execution_spec.md` for
the full plan and `docs/secure_runtime_alpha_4581_4660_phase_a_inventory.md`
for the 22-item source inventory.

## What was built

See the execution spec for the full phase-by-phase account. Summary:

- **Phase B** — `FedosDevicePairingFacade` (`src/desktop/runtime/fedos_device_pairing_facade.ts`),
  the ONE new application-level boundary, composing the existing Alpha
  3161-3240 `FedosDeviceBindingBoundary` and Alpha 2921-3000
  `FedosDeviceTrustRuntime` — zero owned crypto, zero owned trust truth.
- **Phase C/D** — `FedosDevicePairingRequestV1`/`FedosDevicePairingApprovalV1`
  (`src/device/binding_challenge/fedos_device_binding_pairing_exchange.ts`),
  a versioned, strictly-validated, size-bounded, secret-free exchange
  format; `encode*`/`decode*` ARE the transport-neutral port.
- **Phase E** — `runtime.devicePairing()` on `FedosRunningDesktopRuntime`,
  gated on `config.deviceTrustEnabled`, over the SAME Device Registry
  persistence `deviceTrust()` already uses.
- **Phase F** — a real, durable, NDJSON append-only Sync Journal backend
  (`src/sync/persistence/`), optionally injected into the pre-existing
  `FedosSyncJournal`/`FedosSyncState` with zero change to their accepted
  business semantics for every pre-existing call site (the constructor
  parameter is optional; omitted, behavior is byte-for-byte unchanged).
  **A real, non-obvious gap found only by testing**: making the Journal
  durable did not, by itself, make Sync-fabric ELIGIBILITY survive a
  restart — `FedosSyncState`'s own Device Registry
  (`FedosSyncDeviceRegistry`) is a separate, always-in-memory structure.
  Fixed with an explicit restart-hydration step in
  `startFedosDesktopRuntime()` that re-admits every currently-`"trusted"`
  Device into the Sync fabric using the same public `registerSyncDevice()`
  method every other caller already uses.
- **Phase G** — five new, entirely optional `FedosDesktopRuntimeConfig`
  fields; every pre-existing call site compiles unchanged.
- **Phase H** — seven new Shell methods, seven new Host command types, and
  the matching Host Bridge dispatch cases. The Shell itself owns the one
  thing that must never cross an Electron IPC boundary: the Joining
  Device's own ephemeral in-process `FedosDeviceSigningKeypair`.
- **Phase I** — a seventh Presentation ViewModel
  (`FedosDesktopDevicePairingViewModel`), wired into the existing
  `FedosDeviceManagementController`/`FedosDeviceManagementRenderer`; the
  Registration and Revocation-Confirmation screens (Alpha 3941-4020,
  honestly `"unavailable"` at the time) are activated for real.
- **Phase J** — verified, not assumed: the existing Electron IPC dispatch
  translation was ALREADY a generic command-forwarding multiplexer.
  Extending the Host command vocabulary (Phase H) was sufficient — zero
  Electron `.cts` files needed, or received, any change. Proven by a real
  test dispatching a real `device-pairing-create` command through
  `fedosElectronHandleInvoke()` against a real, started
  `FedosDesktopHostBridge`.
- **Phase K/L** — proven via a real, two-independent-Shell,
  two-independent-durable-directory end-to-end test, including a real
  process restart (fresh `FedosDesktopApplicationShell` over the same
  durable paths) after trust and after revocation.
- **Phase N/O** — see below.

## Real, exact protocol semantics (Phase K's own "state exact semantics" requirement)

Registration recorded through this Arc's pairing flow is **local** to
whichever machine's own Device Registry a `registerDevice()` call reaches.
The Authorizing Device's `approvePairingRequest()` also immediately,
locally records the identical, already-fully-verified binding into its OWN
registry (an explicit, local-only side effect — never a network call) so
both machines' own local Sync target planning sees the new Device without
a human registering it twice by hand. **This is not cryptographic
bidirectional trust** — it is two independent local writes of the
identical, independently-verified fact. Symmetrically, **revocation is
equally local**: revoking a Device on the Authorizing Device's own
Registry does not reach the Joining Device's own separate Registry — proven
by a real restart test. This codebase has no cross-machine Device Registry
synchronization anywhere (the Sync Journal carries only allow-listed
Conversation-change records, confirmed unchanged).

## Phase N — Security claims

**Pairing through this Arc proves:** an account holder authorized this
exact Device binding (a real BIP-340 Schnorr signature over the canonical
challenge, verified against `event.pubkey`, never a caller claim); the
Device proved possession of its own independently-generated private key
(a second, independent real Schnorr signature, under a domain-separated
preimage that can never be confused with the account's own signature); the
signed challenge was valid, unexpired, and not replayed (a real,
durable-capable replay guard keyed on the challenge's own nonce); the
local Device Registry accepted the binding and recorded it durably; the
trusted binding became locally eligible for Sync target planning
(`registerSyncDevice()`, restart-safe as of this Arc's own Phase F fix).

**Pairing through this Arc does NOT prove:** the intended human controls
the Device (only that SOME actor holding that Device's private key
produced the proof); the Device is malware-free; the Device is currently
online; synchronization has actually completed (registration ≠ delivery);
the Relay deleted anything; remote data can be erased (revocation never
erases already-delivered content, on either side); the Master Seed is
absent from the Device (this Arc does not implement or verify any
Device-side secret-storage boundary); forward secrecy or compromise
recovery of any kind; physical proximity between the two Devices at
pairing time (the exchange records are transport-neutral strings — this
Arc assumes nothing about how they were moved); that a revocation
performed on one machine is known to, or enforced by, every OTHER machine
that might still hold a stale local belief that the same Device is
trusted (see "exact protocol semantics" above — a real, disclosed
limitation of this codebase's local-only Device Registry architecture).

## Phase O — Structural guards (verified, not merely asserted)

One `FedosDeviceTrustRuntime` per running Runtime (`devicePairing()`
composes the SAME instance `deviceTrust()` already returns). One Sync
Journal (`FedosSyncJournal` itself unmodified; one optional backend, no
second Journal class). One Scheduler (untouched). The Pairing Facade
delegates every mutation to the existing Alpha 3161-3240 registration
authority — verified by a real test asserting `devicePairing()` returns
the identical instance on every call while running, and throws once
stopped. No raw private-key getter exists on the Facade's own public
surface (verified by enumerating its own prototype method names against a
`/secret|privatekey|getkey/i` pattern). No secret in a pairing record or in
a durable Journal record (verified by real tests scanning actual encoded
bytes / actual on-disk NDJSON content). No QR/Bluetooth/LAN/Relay pairing
implementation exists anywhere in this Arc's new source. No Electron
security regression (Electron main/preload files received zero changes).
No new npm dependency (verified: `package.json`'s own `dependencies` list
is unchanged). No Rust/Cargo change (verified: zero files under
`packages/fedos-core-rust/` or `Cargo.toml` touched). Conversation/Search/
Archive/Sender-Key source unchanged (verified: zero files under
`src/conversation/`, `src/search/` touched). `p2p/`/`.tmp_gen/` untouched
(verified via `git status`).

## Verification

- `npm run typecheck:core` — passes, modulo the SAME one pre-existing,
  unrelated, documented failure every recent Arc's own baseline carries
  (`test/secure_runtime_alpha_477_scheduler_lifecycle_model.test.ts:121`).
- `npm run typecheck:electron` — passes, zero errors.
- **This Arc's own new acceptance suite**
  (`test/secure_runtime_alpha_4581_4660_device_registration_pairing_durable_journal.test.ts`):
  **39/39 passing.** Covers the pairing exchange format (encode/decode/
  malformed/oversized/cross-field/no-secret-bytes), the Facade's every
  outcome branch (disabled/create/inspect/wrong-account/malformed/changed-
  deviceId/changed-key/expired/proof-succeeds/approval-produced/approval-
  imported/trusted-completes/duplicate-identical/conflicting-duplicate/
  replay-denied/revocation/idempotent-revocation/stale-artifact-cannot-
  re-trust/new-identity-after-revocation/pending-not-a-sync-target), the
  full two-Shell real lifecycle including two independent process restarts
  (durability, revocation persistence, revoked-vs-trusted local-registry
  divergence), the real Electron dispatch translation against a real,
  started `FedosDesktopHostBridge`, and the durable Sync Journal
  (restart survival, duplicate suppression, corruption fail-closed,
  conflicting-duplicate fail-closed, account/Runtime isolation, no secret
  bytes, no plaintext Sync package byte). No mock stands in for the
  headline pairing/registration flow anywhere in this file.
- **Targeted regression suites** (Device Signature/Registration, Device
  Registry/Trust, Device Sync Foundation, Scheduler, Desktop Shell, Host
  Bridge, Device Sync Wiring Acceptance, Desktop Runtime Wiring, Device
  Management Presentation/Renderer, Security Boundary Guards — 9 files run
  together): **127/127 passing**, including two historical tests updated
  from Alpha 3941-4020 (their own `available: false`/`confirmAvailable:
  false` assertions were the honest fact of THAT Arc's base — updated to
  `true` now that this Arc closes the gap; every other assertion preserved
  unweakened) and one structural guard narrowed to exclude the Shell file
  this Arc legitimately extends (mirroring the identical precedent Alpha
  4101-4180 already set for `package.json`).
- **Full root suite** (`npx vitest run`): **1014 files, 810 passed / 204
  failed; 13308 tests, 13047 passed / 261 failed.** Compared to the
  immediately-prior Arc's own documented baseline (1013/810/203,
  13269/13009/260): +1 file (this Arc's own new test file, 39/39 passing)
  and +1 failed file / +1 failed test beyond that — traced to
  `test/reviews/**`'s own documented "fails only while the arc's own work
  is uncommitted (git-status-clean check)" pattern (this worktree's own
  memory notes name this exact, expected, resolves-on-commit effect); the
  other pre-existing 203 failed files are unchanged, all belonging to the
  documented Rust/WASM-artifact-missing class, zero relation to this Arc's
  own files.
- **Environment note (not a code finding, two separate gaps, both fixed):**
  this fresh worktree had never had `npm install` run at all (root AND
  `packages/fedos-desktop-electron-spike/`, zero `node_modules`) — fixed by
  running `npm install` in both locations. `electron.exe` was then still
  absent (npm's own electron postinstall binary download did not
  populate it) — fixed by copying the `electron` package's own `dist/`
  binary from a sibling worktree at the same `electron@43.1.1` version
  (`C:\wt\desktop-device-sync-electron-main`) via `robocopy`, a pure
  binary restore, no source touched. `npm run build:runtime` /
  `build:host-bridge` / `build:electron-spike` had also never been run in
  this worktree — run fresh from this worktree's own (modified) source,
  all three succeeding.
- **Real Electron subprocess suite** (`npm run test:electron-spike`, after
  the two environment fixes and three builds above): **7 files, 108
  passed / 4 skipped, 0 failed** — byte-for-byte the SAME numbers the
  immediately-prior Arc's own completion declaration documented; this Arc
  touches zero Electron `.cts`/`.ts` file (Phase J finding, above), so this
  was expected to be, and is, unchanged.
- `npm run build:wasm` / `cargo test`: N/A, honestly — this Arc touches no
  Rust/WASM file. Not run.

## Recommended next Arc

**Master Seed Unlock, First-Run Onboarding, and Local Profile
Initialization Arc** (the spec's own preferred choice, and the honest,
natural next step): with registration/pairing and durable Sync state now
both real and reachable, the remaining gap between "a real, tested
back-end stack" and "a person can actually open this app for the first
time" is entirely on the account-bootstrap side — there is still no
reachable flow for a first-run user to unlock/create a Master Seed,
resolve their own account identity, and reach the point where
`localDeviceId`/`localAccountRef`/`deviceBindingAccountSigningAuthority`
(all now real, load-bearing `FedosDesktopRuntimeConfig` fields, this Arc's
own and prior Arcs') can be supplied honestly instead of hand-constructed
in a test.

## Concurrent-session check

`git log --oneline -5` and `git status` were checked in this exact
worktree before this session's first production edit (branch at `8b0492e`,
working tree clean, matching the coordinator's own pre-verified state) and
again immediately before/after the commit below — no unexpected commits or
files from another session were found at either point.
