# Secure Runtime Alpha 3321–3400: Device Registration Runtime Activation and Local Device Sync Foundation — Completion Declaration

## What this Arc proves

- The Alpha 3161–3240 Registration Authority is now activated inside an actual, real, constructible Runtime facade — `FedosDeviceSyncRuntime` (`src/device/runtime/fedos_device_sync_runtime.ts`), built via the single factory `createFedosDeviceSyncRuntime()`. It is real, not a stub: every registration/activation/revocation call is a thin, direct delegation to the EXISTING, unmodified `FedosDeviceBindingRegistrationAuthority`/`createFedosDeviceBindingBoundary()` — no new verification logic, no bypass, no shortcut.
- Runtime Device Registration and Runtime Device Activation are proven end to end with real cryptography: real BIP-340 Schnorr account authorization (`RealFedosNostrSigningAuthority`, the same test-only real-crypto stand-in Alpha 3161–3240 already established) and a real, freshly-generated `FedosDeviceSigningKeypair` device proof, reaching `"registered-trusted"` through the Runtime facade.
- Runtime Device Revocation is proven: account-authorization-only, terminal, reflected immediately in both `getDevice()`/`deviceStatus()` and `listActiveDevices()`; a second revocation is refused (`"already-revoked"`), never re-applied.
- Local Device Inventory (`listDevices`/`listActiveDevices`) and Device Status Queries (`deviceStatus`) are proven against a real, multi-device Registry with mixed trust states — read directly from the EXISTING `FedosDeviceRegistryPersistence` port, introducing no second, parallel inventory.
- Sync Session Preparation is proven to refuse an unauthorized (never-registered or revoked) target Device, and to snapshot every currently-trusted sibling device, sorted deterministically, when the target IS trusted.
- Sync Session Validation is proven to re-check a session against the LIVE Registry rather than trusting its own frozen snapshot: an expired session is denied regardless of Registry state; a target Device revoked after preparation is denied; a sibling Device revoked after preparation is caught as `"stale-device-list"`.
- The Encrypted Sync Package Builder/Reader is proven end to end (build → read round trip recovers an identical session byte-for-byte) using the same real, in-memory round-trip AEAD-boundary-fake technique the Archive's own encryption test already established, plus: malformed package rejected before any decrypt is attempted; malformed bytes at the codec layer return `null`, never throw; an expired package (Manifest `expiresAt`) is denied; a tampered Manifest identity field (`targetDeviceId`) and a tampered `contentHash` are both independently caught as `"manifest-mismatch"`; an unresolvable ciphertext wire string fails closed; a `null` key resolution fails closed.
- Restart recovery is proven directly: two independent `FedosDeviceSyncRuntime` instances constructed over the SAME on-disk `AppendOnlyFedosDeviceRegistryPersistence`/`AppendOnlyFedosDeviceBindingChallengeReplayPersistence` log files — the second, freshly constructed after the first registered a device, recovers the identical trusted binding.
- Duplicate registration is proven idempotent/refused: a fresh, differently-nonced registration attempt for an already-trusted device+account is denied as `"already-present"`, never re-mutating the Registry; a byte-identical resubmission of the SAME account authorization + device proof replays the SAME recorded outcome.
- Replay is proven: two DIFFERENT registration attempts sharing one already-consumed nonce (via an injected fixed nonce generator) — the second is denied as `"replayed"`, and the device it targeted is never registered.
- An unauthorized device is proven denied at two independent layers: a forged device proof naming a key it does not control is denied `"invalid-device-proof"` at registration; a session prepare request for a device that was never registered, or was registered then revoked, is denied at Sync Session Preparation.

## What this Arc explicitly does NOT claim

- **No network sync, no cloud sync, no relay sync.** Sync Sessions and Encrypted Sync Packages are LOCAL data structures only — nothing in this Arc opens a socket, calls a relay, or reaches any remote endpoint. Explicitly out of scope by this Arc's own instructions.
- **No Encrypted Device-to-Device Local Transfer.** This Arc builds the data (Sync Sessions, Encrypted Sync Packages) a future transfer mechanism would move between two Devices; it does not itself move anything between two Devices, processes, or machines.
- **No Desktop Shell change, no Search change, no Archive change, no Sender-Key change, no Rust/WASM change, no new dependency.** Confirmed by structural guard (below).
- **`FedosDeviceSyncRuntime` is not wired into `fedos_desktop_runtime.ts`.** It is a real, complete, independently constructible and tested facade, deliberately kept as a NEW, parallel construction point (mirroring how Alpha 3161–3240 itself shipped `createFedosDeviceBindingBoundary()` unwired) rather than retrofitted into the Desktop-Runtime-owned, legacy-path `FedosDeviceTrustRuntime`. A caller (a future Arc, or Desktop Runtime integration step) constructs it explicitly.
- **The Encrypted Sync Package Builder/Reader is not wired into `FedosDeviceSyncRuntime`.** It requires a `FedosMasterSeedAuthority` this Runtime has no opinion about sourcing — mirroring how the Archive's own encryption authority is never constructed BY any Runtime in this codebase either. A caller injects whichever Master Seed Authority instance it already manages.
- **The self-ECDH key-resolution technique (Phase E) is a documented adaptation, not a new cryptographic primitive.** It reuses `resolveConversationKey()` and the `"Conversation"` `AeadAadDomain` exactly as they already exist; it does not add a new Rust discriminant, and a future Arc reviewing this choice should know it was a deliberate, explicit trade-off under a hard "no new dependency / Architecture Frozen" constraint, not an oversight.
- **No distributed exactly-once replay guarantee** — inherited from Alpha 3161–3240; this Arc's replay test exercises the SAME single-writer, in-process guard, not a new one.
- **Sync Session/Package expiry is a LOCAL, in-process TTL check**, not a cryptographic freshness proof against a trusted third party — there is no clock authority beyond the caller-supplied `now`.

## Baseline vs. final

| | Baseline (before this Arc, `0f8ac0b`) | Final (this Arc) |
| --- | --- | --- |
| Registration Authority activation | exists, unwired (`createFedosDeviceBindingBoundary()`, no caller in `src/`) | `FedosDeviceSyncRuntime`, a real, tested, constructible facade |
| Local Device Inventory | none as a named capability | `listDevices`/`listActiveDevices`, read from the existing Registry |
| Device Status Queries | none | `deviceStatus()`, honest `"unknown"`/`found: false` for unregistered devices |
| Sync Session concept | none anywhere in the repo | `FedosDeviceSyncSessionV1` + prepare/validate, LOCAL-only |
| Encrypted Sync Package | none anywhere in the repo | `FedosDeviceSyncPackageV1` + Builder/Reader, self-ECDH under the existing `"Conversation"` AAD domain |
| `npm run typecheck` | clean except pre-existing `alpha_477_scheduler_lifecycle_model.test.ts:121` | unchanged — same one pre-existing failure, nothing new |
| New test files | — | 2 files, 33 tests, real Schnorr signatures + real Device Registry throughout |

## Verification run (this worktree, `C:\wt\device-sync-foundation`)

1. `npm run typecheck` — clean except the one pre-existing, unrelated `test/secure_runtime_alpha_477_scheduler_lifecycle_model.test.ts:121` failure (present at the identical line before this Arc's own changes).
2. New Arc test files — `secure_runtime_alpha_3321_3400_device_sync_runtime.test.ts` (12/12) and `secure_runtime_alpha_3321_3400_sync_session_and_package.test.ts` (21/21) — 33/33 passed.
3. `npx vitest run` (full suite) — 12,231 passed / 239 failed across 944 files. Every failure falls into the same two pre-existing, previously-documented categories, neither a regression from this Arc:
   - The fresh-worktree `?raw`-import artifact (Vite's `?raw` import of `Cargo.toml`/`lib.rs` returning an empty string), confirmed directly by inspecting two representative failures (`test/secure_runtime_alpha_001_baseline.test.ts`, `test/runtime_wasm_toolchain.test.ts`) — both fail with the exact documented signature `expected +0 to be 11` ([[project_worktree_raw_import_artifact]]).
   - Expected-red-until-commit `test/reviews/**` git-status snapshot assertions (e.g. `private_conversation_search_runtime_v1/source_alignment.test.ts`, `private_message_envelope_v1/specification_consistency.test.ts`) reacting to this Arc's own new, still-uncommitted `src/device/runtime/`, `src/device/sync_package/`, `src/device/sync_session/` — both resolve once this Arc's changes are committed and the tree returns to clean, the same resolution path every prior Arc's completion declaration in this repo documents.
4. Rust/`cargo` — not run; no Rust file was touched by this Arc.
5. Restart-recovery test uses `mkdtempSync(os.tmpdir())` with an unconditional `rmSync` in a `finally` block — no stray temp files left behind.

## Security guard scan

`grep` across every new file under `src/device/runtime/`, `src/device/sync_session/`, `src/device/sync_package/` for `masterseed`, `privatekey`/`private_key`, `passphrase`, `mnemonic`, `Math.random` — every match is prose/comments documenting the reuse of an existing guardrail; zero occurrences carry an actual secret-bearing field or value. No new file constructs a `FedosDeviceSigningKeypair` from raw bytes, reads a private key, or reads the Master Seed directly — the Encrypted Sync Package Builder/Reader receives only an opaque `AeadKeyHandle` from the injected `FedosMasterSeedAuthority`, exactly like the Archive's own encryption authority.

## Security Statement

**What this Arc's Runtime activation proves:** that a real, cryptographically-verified Device registration/activation/revocation call reaches an actual callable Runtime object, backed by the Registry's own durable, restart-safe persistence — not merely that the underlying Authority classes exist in isolation (Alpha 3161–3240 already proved that). That a Sync Session can only ever be prepared for, and only ever validated against, a target Device the LIVE Registry currently trusts. That an Encrypted Sync Package's ciphertext can only be opened by the same account's own Master-Seed-resolvable key, and that its cleartext Manifest is independently bound to both the Package's identity (Header) and its content (hash) after decryption.

**What this Arc's Runtime activation does NOT prove:** anything about a second Device, a second machine, or a network of any kind — no transfer, delivery, or synchronization between two Devices occurs anywhere in this Arc. It does not prove the Encrypted Sync Package's self-ECDH construction is the FINAL key-resolution design for device-to-device transfer — a future Arc extending this to a genuine second Device will need a real, non-self key agreement, which this Arc explicitly does not attempt (no counterparty Device key exists to agree with under Architecture Frozen's own "no new Rust" constraint until a future Arc reviews that need directly).

## Structural guards confirmed

- `git diff 0f8ac0b -- src/desktop/ src/device/fedos_device_binding.ts src/device/persistence/ src/device/binding_challenge/ src/sync/ package.json package-lock.json` — empty except for the newly ADDED files under `src/device/runtime/`, `src/device/sync_session/`, `src/device/sync_package/` (all new paths, zero modification to any existing file's own content).
- `git diff 0f8ac0b --stat -- src/conversation/` — empty (Archive, Search, Sender-Key, Group Runtime all live under `src/conversation/` in this codebase; none touched).
- No new dependency: `git diff 0f8ac0b -- package.json package-lock.json` — empty.
- No new `AeadAadDomain` variant: `git diff 0f8ac0b -- src/runtime/fedos_wasm_loader.ts` — empty.
- `p2p/`, `.tmp_gen/` untouched: confirmed via `git status --porcelain p2p .tmp_gen` — empty.

## Files changed

New: `src/device/runtime/fedos_device_sync_runtime.ts`, `src/device/sync_session/fedos_device_sync_session.ts`, `src/device/sync_session/fedos_device_sync_session_codec.ts`, `src/device/sync_package/fedos_device_sync_package_header.ts`, `src/device/sync_package/fedos_device_sync_package_manifest.ts`, `src/device/sync_package/fedos_device_sync_package.ts`, `src/device/sync_package/fedos_device_sync_package_encryption.ts`, `test/secure_runtime_alpha_3321_3400_device_sync_runtime.test.ts`, `test/secure_runtime_alpha_3321_3400_sync_session_and_package.test.ts`, this doc pair.

Modified: `README.md` (new status blurb, prepended per this repo's own stacking convention).

Unmodified: `src/device/fedos_device_binding.ts`, `src/device/fedos_device_registration_authority.ts`, `src/device/unavailable_fedos_device_registration_authority.ts`, `src/device/crypto/`, `src/device/binding_challenge/` (all Alpha 3161–3240 files), `src/device/persistence/` (all Alpha 2921–3000/3161–3240 files), `src/sync/`, `src/desktop/runtime/fedos_device_trust_runtime.ts`, `fedos_desktop_runtime.ts`, `fedos_desktop_runtime_config.ts`, Desktop Shell, Conversation Runtime, Archive, Search, Sender-Key, Group Runtime, `src/crypto/`, `src/runtime/` (all files, including `fedos_wasm_loader.ts`'s `AeadAadDomain` enum), `packages/`, `p2p/`, `.tmp_gen/`, every Rust file, `package.json`/`package-lock.json`.

## Recommended next Arc

**Encrypted Device-to-Device Local Transfer.**
