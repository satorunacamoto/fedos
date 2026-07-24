# Secure Runtime Alpha 7961-8040 - Stage 10: Final Matrices

## 1. Master Landing Matrix

| Item | Status |
|---|---|
| Canonical tip proven (81b5f0d1) | PASS |
| Staged checkpoint plan derived from real ancestry | PASS |
| 7/7 checkpoints landed, zero new regression | PASS |
| Full verification sequence (typecheck/cargo/WASM/category tests/Electron/full suite) | PASS |
| Real product acceptance (34/35 criteria) | PASS |
| Upgrade/downgrade/rollback compatibility | PASS |
| Real release artifacts built and verified | PASS |
| Documentation/security-claims reconciled | PASS |
| Local master landing gate | PASS |
| Master fast-forwarded (3eb9eadd -> aed0951) | DONE |
| No push, no publish, no remote change | CONFIRMED (never attempted) |

## 2. Desktop Beta Release Matrix

| Item | Status |
|---|---|
| release/fedos-desktop-beta-0.1 created at landed master (aed0951) | DONE |
| Release notes authored | DONE |
| Real NSIS installer built | PASS (101,805,947 bytes) |
| Real portable ZIP built | PASS (368,379,324 bytes) |
| Checksums generated and independently re-verified | PASS |
| Secret scan (752 staging files) | PASS (0 findings) |
| Version consistent (0.1.0-beta.1) across installer/ZIP/manifest | PASS |
| Unsigned disclosure explicit | PASS (manifest `unsigned:true`) |
| No tag created | CONFIRMED (not authorized this Arc) |
| No push/publish performed | CONFIRMED |

## 3. Security Non-Guarantee Matrix

| Non-guarantee | Disclosed where |
|---|---|
| No guaranteed RAM erasure / mlock / VirtualLock | Safety Center standing warning `secure-memory-zeroization-is-best-effort-or-unavailable` |
| No kernel/hypervisor protection | Safety Center standing warning `os-kernel-hypervisor-compromise-is-out-of-scope` |
| No Relay-side deletion | Safety Center standing warnings `relay-ciphertext-may-remain`, `relay-ack-is-not-recipient-delivery` |
| No recipient physical erasure | Safety Center standing warning `deletion-acknowledgement-is-a-claim-not-physical-proof` |
| No universal NIP interoperability claim | Not claimed anywhere (spot-checked, Stage 7) |
| No Group MLS/PQ support claim | Not claimed anywhere (spot-checked, Stage 7); README explicitly disclaims post-quantum cryptography |
| Device revocation does not erase prior copies | Safety Center standing warning `device-revocation-does-not-erase-copies` |
| Archive/backup copies may retain deleted content | Safety Center standing warnings `archives-and-backups-may-retain-copies`, `archive-metadata-may-survive-content-deletion` |
| Suppression sync does not guarantee all Devices informed | Safety Center standing warning `archive-suppression-sync-does-not-guarantee-all-devices-informed` |
| Archive restore does not imply live session continuity | Safety Center standing warning `archive-restore-does-not-imply-live-session-continuity` |

Zero overclaim found (Stage 7's own spot check).

## 4. Upgrade Compatibility Matrix

| Shape | Status |
|---|---|
| Pre-write-index Observation log | PASS (rebuilds correctly) |
| Pre-Direct-Archive-subject-union Archive bundle | PASS (bare-shape restores) |
| Pre-suppression-propagation profile (no log path configured) | PASS (honestly "active") |
| Old suppression observation log (unmodified wire format) | PASS |
| Unknown future Observation schemaVersion | PASS (fails closed at codec layer) |
| Old Settings descriptor | PASS (this Stage's own new test) |
| Unknown future Settings schemaVersion | PASS (fails closed, this Stage's own new test) |
| Old Outbox history log | PASS (this Stage's own new test) |
| Real multi-restart durability (3 consecutive restarts, 240 real messages) | PASS |
| 5 lock/unlock cycles, exactly one live Runtime each | PASS |

## 5. Rollback Matrix

| Item | Rollback method |
|---|---|
| Master ref (3eb9eadd -> aed0951) | Move the `master` ref back to `3eb9eadd9f8873d9c1e3ced6ae241ae7b9b8fa18` (pure ref move, no history destroyed, nothing pushed). |
| Release branch | Delete `release/fedos-desktop-beta-0.1` locally (never pushed). |
| Integration branch | Delete `integration/fedos-secure-runtime-master-landing-rc` locally (never pushed) -- all its real commits are ALSO reachable from `master` now, so nothing is lost by deleting the branch label itself. |
| Release artifacts | `dist-package-beta/`/`release/` under the Electron subpackage are gitignored, already cleaned; re-running `build_release.mjs` regenerates them deterministically from source. |

## 6. Documentation Supersession Matrix

See `docs/secure_runtime_alpha_7961_8040_stage7_documentation_reconciliation_report.md`
for the full 15-row classification table (all CLOSED BY LATER ARC or
HISTORICAL BASELINE ONLY, zero INCORRECT-DUE-TO-STALE-BASE, every
closure independently re-verified live this session). Additionally this
Stage superseded three stale test-level assumptions (Direct Archive,
Safety Center shape, secret-scan false-positive) and one historical
structural-guard allowlist gap -- all listed in the Stage 3 report.

## 7. Artifact Verification Matrix

| Artifact | SHA-256 | Verified |
|---|---|---|
| `FedOS-Desktop-Beta-Setup-0.1.0-beta.1.exe` | `03e308188cfcf7dd70b8b59f4916804dcfc8aa21514b46ecb609fa06725be8f8` | Independently re-derived by the pipeline's own Step 8, matches. |
| `FedOS Desktop Beta-0.1.0-beta.1-win.zip` | `1f27bbdbb3aba0aed1bd3fa1f7ad9753371cc543f90c6bb9c0582258810ba5f4` | Independently re-derived, matches. |
| `release-manifest.v1.json` | `12858790ea677195bb4b3604601f6577eafc9ccc3f3e520791c32355fe1bd2da` | Independently re-derived, matches. |
| Embedded WASM hash (`wasmSha256Hex`) | `10f7fdb2e1f2e656013f68f591e452e49cfdbcf9f5822906054b02619730ff6a` | Matches the real, freshly-built `fedos_wasm_artifact_manifest.v1.json` exactly. |

## Zero security-correctness FAIL anywhere in this Arc's own findings.

Full Completion is warranted.
