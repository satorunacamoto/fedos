# Secure Runtime Alpha 8121-8200 — Pilot Release Matrix

Statuses: PASS / FAIL / BLOCKED / INTENTIONALLY UNSUPPORTED / PILOT
LIMITATION. Any security-correctness FAIL blocks Full Completion. Public
publication remains blocked regardless of matrix status until explicit
human approval.

| Area | Status | Evidence |
|---|---|---|
| Build reproducibility (WASM) | **PASS** | Byte-identical SHA-256 `10f7fdb2e1...` across 4 independent builds now (2 prior sessions/worktrees + this Arc's own integration worktree build + a genuinely fresh `C:/wt/fedos-desktop-beta-0.1-release` worktree build) |
| WASM prerequisite documentation | **PASS** | `SECURITY.md`, this Arc's own clean-checkout docs; `wasm-bindgen` CLI/crate version match required and stated |
| Profile creation/unlock | **PASS** | Real smoke test in the fresh release worktree: create → "ready" screen |
| Relay Settings | **PASS** | Alpha 8041-8120's own Settings screen; re-verified reachable this Arc |
| Invitations | **PASS** | Alpha 8041-8120's own real vertical slice; automatic accept via real-time delivery (no manual control — disclosed) |
| Chat | **PASS** | Real 2-party message exchange, on-demand reveal, verified this Arc via the lock-content-invalidation test |
| Same-peer isolation | **PASS (carried forward)** | Alpha 7401-7480's own route-binding fix, unmodified this Arc |
| Offline/reconnect | **PASS** | This Arc's own real disconnect/reconnect vertical slice — honest "no automatic reconnect" copy, Lock→Unlock recovers |
| Search | **PASS** | Alpha 8041-8120's own real Search screen; plaintext-token limitation disclosed in-app and in `SECURITY.md` |
| Archive | **PASS** | Alpha 8041-8120/7801-7960's own export/restore; retention-parity limitations disclosed |
| Devices | **PASS** | Device list/revoke real screen; revoke button now double-submit-guarded (this Arc) |
| Identity Replacement | **PASS** | Real screen; exact-id authorization (this Arc, Security Finding 3); double-submit guarded (Security Finding 2) |
| Signed Deletion | **PASS** | Real screen; same two fixes as Identity Replacement |
| Safety Center | **PASS** | Real overview screen, no false numeric security score (structural guard 10, unmodified) |
| Recovery | **PASS (with disclosed gap)** | Prior Arc's own Stage F/G report: wrong-passphrase/corrupt-profile/missing-WASM/unsupported-schema all distinguishable with real actions; Archive-restore-from-Recovery is architecturally impossible (no profile ever identified) — disclosed, not a release blocker |
| Accessibility essentials | **PASS (with disclosed gaps)** | Prior Arc's own Stage F/G report: all essential gates pass; 200%-zoom and automated screen-reader runs remain POLISH/MEDIUM, disclosed |
| Installer | **PASS** | Real NSIS installer built from the fresh release worktree this Arc's own Phase N rebuild produced |
| ZIP | **PASS** | Real portable ZIP built alongside the installer |
| Checksums | **PASS** | Independently re-derived (`sha256sum`), matches the release script's own output |
| Unsigned status | **PASS (honestly disclosed)** | `Get-AuthenticodeSignature`-equivalent verification confirms genuinely unsigned; `SECURITY.md`/release notes state this plainly |
| External-audit status | **PASS (honestly disclosed)** | No independent audit has occurred; `docs/secure_runtime_alpha_8121_8200_external_audit_prep_delta_v1.md` states this explicitly as preparation, not an audit |
| Upgrade/rollback | **PASS (carried forward)** | Prior Arc's own upgrade-compatibility testing against representative older on-disk shapes, unmodified this Arc |
| Secret scan | **PASS** | Release script's own staging-input scan, re-run this Arc, 0 findings |
| Public documentation | **PASS** | README/SECURITY.md/known-limitations/user guides, all reconciled this Arc where stale |
| User guides | **PASS (carried forward)** | Alpha 8041-8120's own 6 guides, unmodified this Arc |
| SECURITY.md | **PASS** | Updated this Arc (Double Ratchet/NIP-17 framing, mlock/VirtualLock, kernel/hypervisor scope) |
| Issue/incident process | **PASS** | New this Arc: `docs/secure_runtime_alpha_8121_8200_closed_pilot_runbook.md` |
| **Acceptance bridge production isolation** | **PASS** | Security Finding 1 — `window.fedosAcceptance` genuinely absent in ordinary launch, present only under `FEDOS_ELECTRON_BETA_AUTOTEST=acceptance`; proven via real spawned-process reads, re-confirmed against the actual release-worktree build |
| **Irreversible-action double-submit protection** | **PASS** | Security Finding 2 — Identity Transition/Signed Deletion/Device Revoke buttons disabled while in flight; real rapid-double-click proof of the underlying mechanism |
| **Exact-target authorization** | **PASS** | Security Finding 3 — Identity Transition/Signed Deletion decisions carry the exact id; real test proves the old selection-based API decides the wrong item under a reorder and the new one does not |
| **Renderer plaintext invalidation on lock** | **PASS** | Security Finding 4 — real 2-party message exchange, reveal, Lock, confirmed empty; re-unlock confirmed no stale reappearance before reload |
| **Line-ending determinism** | **PASS** | Reproducibility Finding 1 — `.gitattributes` added; committed blobs already LF-only; zero renormalization diff |
| **Pre/post-WASM test consistency** | **PASS** | Reproducibility Finding 2 — ~40 tests switched to real `git ls-files` truth; verified against a real on-disk WASM artifact in two separate worktrees now |
| **Clean Electron binary provisioning** | **PASS** | Reproducibility Finding 3 — explicit `ensure-electron-binary` command; re-verified from a genuinely fresh `npm ci` in the release worktree (binary absent after `npm ci` alone, present after the explicit command) |
| **Rust dependency-lock policy** | **PILOT LIMITATION (Option B, documented)** | Reproducibility Finding 4 — `Cargo.lock` remains untracked by deliberate choice; exact resolved graph (82 packages, SHA-256 `6bbdadb7...`) pinned in `docs/secure_runtime_alpha_8121_8200_cargo_lock_policy_decision.md`; not yet structurally enforced |
| **Relay reconnect truth** | **PASS** | Nav-bar copy corrected from a false "retrying" claim to "lock and unlock again to retry"; matches the real, documented "no automatic reconnect" contract throughout the transport layer |

## Overall verdict

**Zero security-correctness FAIL.** One disclosed PILOT LIMITATION
(Rust dependency-lock policy, Option B, not a security-correctness
failure — the WASM artifact this pinned graph produces is proven
byte-identical four times independently). Full Completion criteria met.

**Recommend exactly one next action**: Run a small closed Desktop Beta
pilot and commission an independent security audit before any public
release.
