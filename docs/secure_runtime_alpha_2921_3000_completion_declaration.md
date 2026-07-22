# Secure Runtime Alpha 2921–3000: Device Trust and Multi-Device Runtime Integration — Completion Declaration

## What this Arc proves

- A real, versioned, durable-capable Device Binding (`FedosDeviceBindingV1`) exists, additive beneath the existing account identity, with a closed `pending|trusted|revoked|unavailable` trust vocabulary and validated, terminal-on-`revoked` transitions.
- A durable Device Registry exists: event-sourced codec, in-memory and append-only backends, conflict/idempotency handling, and fail-closed behavior on a corrupt or schema-invalid log record — verified directly (a written malformed line makes `listBindings()` throw; a written conflicting duplicate event returns `"conflict"`).
- Device registration is gated by an injected `FedosDeviceRegistrationAuthority` port, never by matching a caller-supplied account id. The one production adapter this Arc ships, `UnavailableFedosDeviceRegistrationAuthority`, is proven — not merely documented — to be incapable of ever producing a `"trusted"` binding.
- The Desktop Runtime owns exactly one local Device identity, Device Registry, Device Trust Authority, and (via the pre-existing, unmodified `FedosSyncState`) Sync Journal/Cursor, behind one new opt-in config flag and one new narrow accessor (`runtime.deviceTrust()`) with the same fail-closed "not enabled"/"inaccessible after stop" contract every other Runtime accessor already uses.
- A Sync Journal record allowlist exists as a standalone, additive guard: an unknown `recordType` or sensitive-marker metadata never reaches the Journal, proven directly for a `sender-key-secret`-shaped and a `device-private-key`-shaped record type.
- Revocation denies future sync eligibility and rejects any new change originating from the revoked device, without erasing the historical binding record.
- Archive Restore is proven, by direct test, to never register or imply Device trust; a restored Runtime starts with zero trusted devices.

## What this Arc explicitly does NOT claim

- **No cryptographic Device authorization.** `UnavailableFedosDeviceRegistrationAuthority` is the only production adapter. `src/crypto/types.ts` remains an unchanged placeholder seam with no key generation or signature verification of any kind. Every device registered through this Arc's shipped production path is honestly capped at `trustState: "unavailable"` and can never be promoted to `"trusted"`.
- No full cloud/live synchronization — the Sync Journal/Cursor remain the in-memory, single-process structures Alpha 2421–2500 already built; this Arc adds no disk persistence for either.
- No claim that Archive Restore equals synchronization, or that a Relay ACK equals device sync.
- No Sender-Key device rekey, no MLS, no Onion/Tor, no cloud account/server, no push notifications, no new dependency, no Rust change.

## Baseline vs. final

| | Baseline (before this Arc) | Final (this Arc) |
| --- | --- | --- |
| Device identity type | none with a schema (`src/identity/device_*.ts` are disconnected labels) | `FedosDeviceBindingV1`, `schemaVersion: 1`, closed trust vocabulary |
| Device persistence | none | codec + in-memory + append-only backends, event-sourced, fail-closed on corruption |
| Registration authority | none | port + production `UnavailableFedosDeviceRegistrationAuthority` (fail-closed), test-only verified stub |
| Runtime ownership | Sync Foundation had zero Runtime callers | `runtime.deviceTrust()`, one per running Runtime, no singleton |
| Sync Journal record classification | none (generic `contentHash` only) | additive allowlist, six named non-secret kinds, unknown/secret-bearing rejected |
| `npm run typecheck` | clean except pre-existing `alpha_477_scheduler_lifecycle_model.test.ts:121` | unchanged — same one pre-existing failure, nothing new |
| New test file | — | 1 file, 26 tests, covering the full 24-item required matrix (items 21/22 satisfied by re-running the existing Search/Conversation Runtime regression suites below, not duplicated) |

## Verification run (this worktree, `C:\wt\device-trust-runtime`)

1. `npm run typecheck` — clean except the one pre-existing, unrelated `test/secure_runtime_alpha_477_scheduler_lifecycle_model.test.ts:121` failure (confirmed present before any edit in this worktree, already named by every recent completion declaration).
2. Focused Device/Sync Foundation tests (`secure_runtime_alpha_2421_2500_*.test.ts`, 4 files) — 46/46 passed, byte-for-byte unmodified by this Arc.
3. New Device Runtime tests (`secure_runtime_alpha_2921_3000_device_trust_runtime_integration.test.ts`) — 26/26 passed.
4. Archive separation / regression (`secure_runtime_alpha_1581_1600_archive_restore_duplicate_detection.test.ts`, `secure_runtime_alpha_2601_2620_archive_restart_query_race_and_compat.test.ts`) — 19/19 passed.
5. Search regression (`secure_runtime_alpha_2541_2560_search_index_incremental_and_delete.test.ts`, `secure_runtime_alpha_2561_2580_archive_index_and_large_dataset.test.ts`) — 10/10 passed. Satisfies required test-matrix item 21 (Search unaffected) directly: neither file under `src/conversation/search/` was touched.
6. Conversation Runtime regression (`secure_runtime_alpha_1471_1540_runtime_wiring.test.ts`) — 5/5 passed. Satisfies required test-matrix item 22 (Pairwise/Direct messaging unaffected): `src/conversation/transport/` was not touched.
7. `npx vitest run` (full suite) — 12,150 passed / 239 failed across 941 files. Every failure falls into one of two categories, neither a regression from this Arc, both A/B-confirmed:
   - **~189 files**: the pre-existing, previously-documented fresh-worktree `?raw`-import artifact (Vite's `?raw` import of `Cargo.toml`/`lib.rs` returning an empty string in a freshly created linked worktree — this repo's own README history already documents the identical signature back to Alpha 1111–1180). Confirmed directly: `test/secure_runtime_alpha_040_fedos_identity_record.test.ts` fails with `expected +0 to be 11` in this worktree, passes 28/28 clean in the primary (non-worktree) checkout, same commit.
   - **~50 files under `test/reviews/`**: expected-red-until-commit review dirty-tree/scope guards (e.g. `boundary_invariants.test.ts`'s own "git working tree shows NO change" assertion) — these assert a clean `git status` relative to their own historical review commit, and fail during ANY uncommitted work in this repository, this Arc's own included; they resolve once this Arc's changes are committed and the tree returns to clean.
8. Rust/`cargo` — not run; no Rust file was touched by this Arc.
9. Temporary registries/journals/profiles — every test uses `mkdtempSync(os.tmpdir())` with an unconditional `rmSync` in a `finally` block; `git status` after the full run showed zero stray files in the worktree.

## Security guard scan (Phase L)

`grep` across every new/modified file under `src/device/`, `src/sync/fedos_sync_record_allowlist.ts`, `src/desktop/runtime/fedos_device_trust_runtime.ts`, `fedos_desktop_runtime.ts`, `fedos_desktop_runtime_config.ts` for `masterseed`, `privatekey`/`private_key`, `sender-key`+`secret`, `bearer`+`secret`, `passphrase`, `mnemonic`, `Math.random` — every match is prose/comments documenting the guardrail, a marker string inside the allowlist's own denylist array, or test-assertion code checking absence; zero occurrences carry an actual secret-bearing field or value. `package.json`, `package-lock.json`, `Cargo.toml`, `packages/`, `p2p/`, `.tmp_gen/` are all untouched (confirmed via `git status --porcelain` against those paths).

## Files changed

New: `src/device/fedos_device_binding.ts`, `src/device/fedos_device_registration_authority.ts`, `src/device/unavailable_fedos_device_registration_authority.ts`, `src/device/persistence/fedos_persisted_device_binding_event_v1.ts`, `src/device/persistence/fedos_device_binding_codec.ts`, `src/device/persistence/fedos_device_registry_persistence.ts`, `src/device/persistence/in_memory_fedos_device_registry_persistence.ts`, `src/device/persistence/append_only_fedos_device_registry_persistence.ts`, `src/device/persistence/persisted_fedos_device_trust_authority.ts`, `src/sync/fedos_sync_record_allowlist.ts`, `src/desktop/runtime/fedos_device_trust_runtime.ts`, `test/secure_runtime_alpha_2921_3000_device_trust_runtime_integration.test.ts`, `test/support/stub_verified_fedos_device_registration_authority.ts`, this doc pair.

Modified (additive only): `src/desktop/runtime/fedos_desktop_runtime.ts` (+76 lines), `src/desktop/runtime/fedos_desktop_runtime_config.ts` (+22 lines), `README.md` (new status blurb, prepended per this repo's own convention).

Unmodified: `src/sync/` (Alpha 2421–2500), `src/identity/device_registration.ts`/`device_trust.ts`, Conversation Runtime, Archive, Search, `src/crypto/`, `packages/`, `p2p/`, `.tmp_gen/`, every Rust file.

## Recommended next Arc

The originally preferred next Arc, **Device-to-Device Encrypted Sync Transport**, is blocked on the same cryptographic boundary this Arc stopped at. The recommended next Arc is instead:

**Account-to-Device Signature Verification Boundary** — the named prerequisite (Phase E of this Arc) that would let a real `FedosDeviceRegistrationAuthority` implementation exist and honestly return `"verified"`, unblocking `pending -> trusted` in production and, subsequently, real Device-to-Device Encrypted Sync Transport.
