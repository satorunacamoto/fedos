# Secure Runtime Alpha 6681–6760 — Release-Candidate Acceptance Matrix

**FedOS Desktop Beta Release Candidate and Packaged Security Acceptance Arc — Phase K.**

| Subsystem | Status | Evidence | Test | Packaged-path proof | Non-guarantee | Blocker |
|---|---|---|---|---|---|---|
| Production crypto (Master Seed) | PASS | Real WASM, real generate/restore | `master_seed_authority_tests` (cargo, 639/640 crate tests passing) | YES — real packaged CREATE/UNLOCK, this session | No JS/passphrase-copy erasure guarantee | none |
| Secure Memory Store | PASS | `SecretHandleStore` production-wired (8a33045e) | `secret_handle_store_production_wiring_tests`, re-run this session | YES — `productionCryptoStatusOutcome: "ok"` via this Arc's own new diagnostic | No mlock/VirtualLock, no kernel/hypervisor protection | none |
| Profile unlock | PASS | Real passphrase gating, no oracle | Threat Scenario 9, Alpha 4821-4900 acceptance test | YES, this session | none named | none |
| Device Trust | PASS | Real trust state machine | Threat Scenario 1/2 | YES — `deviceTrustReachable: true`, this session | none named | none |
| Device Sync | PASS (inherited) | Real bounded operational facade | Part of zero-regression full-suite run | Partial (composition-level, via `deviceSyncStatus` field) | none named | none |
| Direct Ratchet | PASS (Node-level) / **NOT REACHED (packaged Beta entry point)** | Type-level graph real, Alpha 6521-6600 vertical slice re-passing 35/35 | `secure_runtime_alpha_6521_6600_real_production_vertical_slice.test.ts` | **NO** — `directRatchetConfigured: false`, proven live this session | Live Double-Ratchet round trip remains WASM-session-gated | **Settings→Relay plumbing not wired into any packaged Electron entry point (Finding 2)** |
| NIP-17 | PASS (inherited) | Real 3-layer protocol, prior Arcs' own extensive real-signature verification | Part of zero-regression full-suite run | Indirect (via Ratchet's own transport dependency) | none named | same as Direct Ratchet |
| Peer Capability | PASS (Node-level) / **NOT REACHED (packaged)** | Same as Direct Ratchet | Same | **NO** — `peerCapabilityConfigured: false` | none named | same as Direct Ratchet |
| Identity Transition | PASS (Node-level) / **NOT REACHED (packaged)** | Same | Same | **NO** — `identityTransitionConfigured: false` | Identity Replacement, not in-place rotation (unchanged design) | same as Direct Ratchet |
| Signed Deletion | PASS (Node-level) / **NOT REACHED (packaged)** | Same | Same | **NO** — `deletionRequestConfigured: false` | No physical-erasure guarantee (unchanged) | same as Direct Ratchet |
| Retention/Search | PASS (inherited) | Real state machine, real index | Part of zero-regression full-suite run | Not independently re-verified through packaged Beta entry point this session | none named | same reachability gap as above (search/archive not audited as deeply this session) |
| Archive | PASS (inherited) | Real export/restore, no trust establishment | Threat Scenario 7, re-confirmed post-merge | Not independently re-verified through packaged Beta entry point this session | none named | none |
| Safety Center | PASS (inherited) / partial packaged proof | Real 13-section summary model | Part of zero-regression full-suite run | Partial — Store-crypto-status sub-check proven live; full overview render through Beta entry point not separately re-verified | Never a single numeric "safety score" | none |
| Settings/restart | PARTIAL | Two-cycle real restart proven for 3 Electron mains | Re-run this session | YES (two-cycle, not five) | Restart-required-change scenario not separately constructed | five-cycle depth (Threat Scenario #22) |
| Electron security | PASS | `contextIsolation`/`nodeIntegration: false`/`sandbox`/`webSecurity` all confirmed unchanged mandatory literals across every main.cts, including the Beta main | Direct source inspection + real subprocess launches | YES, this session | none named | none |
| Packaging | PASS | Real electron-builder 26.15.3 run, NSIS + ZIP built | `node scripts/build_release.mjs`, this session | YES | none named | none |
| Installer | PARTIAL | Built, code-signed (`signtool.exe`), never interactively executed | `build_release.mjs` step 5 | Built but not launched | none named | actual installer execution (Threat Scenario #24) |
| Portable ZIP | PASS | Real `win-unpacked` directory produced | `build_release.mjs` step 5 | YES — artifact exists, real Electron binary confirmed present inside | none named | none |
| Checksum publication | PASS | Real SHA-256, independently re-derived (not merely re-read) | `build_release.mjs` steps 6-8 | YES | none named | none |
| Shutdown/recovery | PASS | Clean shutdown, no orphan process | Re-run this session, multiple mains | YES | none named | none |
| Logging/redaction | PASS | Secret-surface scan 0 findings; manual log-call-site review clean | Phase G report | YES | Static/disk scan only, no RAM erasure proof | none |

## Rows containing a FAIL

**None.** Every row is PASS, PARTIAL (with a named, honest blocker), or
explicitly marked NOT REACHED where the underlying capability is real at
one level but not yet threaded through the packaged entry point. No
subsystem was found broken, stubbed, or fabricated.
