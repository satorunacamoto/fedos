# Secure Runtime Alpha 8121-8200 — Phase P: Final Structural Guards

Each item proven by direct source inspection and/or a real passing test,
not narrative claim alone.

| Guard | Status | Evidence |
|---|---|---|
| No `fedosAcceptance` in ordinary production global scope | **PROVEN** | `secure_runtime_alpha_8121_8200_acceptance_bridge_isolation.test.ts` (real process, `readGlobal` → `"undefined"`); `ACCEPTANCE_MODE_ENABLED = AUTOTEST_MODE === "acceptance"` in both preload and main, strict literal, never truthy |
| No generic IPC | **PROVEN (unchanged)** | Structural guard test 5 (`secure_runtime_alpha_8041_8120_structural_guards.test.ts`): `preloadSource` fails `/ipcRenderer\.invoke\(channel/`; every `fedos-app:*`/`fedos-acceptance:*` channel is named and single-purpose |
| Decision actions carry exact immutable IDs | **PROVEN** | `identityTransitionAccept/Reject/Defer(peerAccountRef, peerDeviceRef, transitionId)`, `deletionRequestApprove/Reject(requestId)` — preload/main/Controller signatures all updated; `secure_runtime_alpha_8121_8200_exact_target_authorization.test.ts` |
| No mutable-selection-only authorization | **PROVEN** | Same test file — the OLD `acceptSelected()`/`approveSelected()` path is retained ONLY for 3 historical callers (unmodified behavior); the NEW `fedos-app:*` IPC path never calls it |
| In-flight action guards exist | **PROVEN** | Controller-level `#actionInFlight` (backend, authoritative) + renderer-level button-disable (UX, real double-click tested) for Identity Transition/Signed Deletion/Device Revoke |
| Lock invalidates content state | **PROVEN** | `clearAllRendererContentState()`; `secure_runtime_alpha_8121_8200_lock_content_invalidation.test.ts` (real 2-party exchange, reveal, lock, re-unlock) |
| No automatic Relay reconnect claim or hidden loop | **PROVEN** | Renderer copy states "lock and unlock again to retry"; `websocket_relay.ts`/`fedos_conversation_relay_set.ts` both confirm "no reconnect/backoff policy of any kind" is unchanged production behavior |
| No npm install/postinstall lifecycle hook | **PROVEN** | `secure_runtime_alpha_3881_3940_electron_build_spike.test.ts` test 28 passes; `package.json` scripts contain `ensure-electron-binary` (a plain named script), never `postinstall`/`install`/`preinstall` |
| WASM tracking guards use Git truth | **PROVEN** | `test/support/fedos_core_rust_git_tracked_paths.ts`, ~40 callers migrated, `secure_runtime_alpha_8121_8200_wasm_git_truth_guard.test.ts` (6 tests: missing/untracked/staged/clean/tracked-fixture/subpath) |
| `.gitattributes` policy exists and does not stage mass unrelated changes | **PROVEN** | `.gitattributes` (`* text=auto eol=lf`) added; `git status --porcelain` after adding it shows only this Arc's own genuine changes, zero renormalization diff |
| Cargo dependency policy is explicit | **PROVEN** | `docs/secure_runtime_alpha_8121_8200_cargo_lock_policy_decision.md` — Option B chosen and reasoned, not silently applied |
| No publication/push/tag | **PROVEN** | No `git push`, `git tag`, or any publish/upload command was run anywhere in this Arc's own session |
| No p2p/.tmp_gen changes | **PROVEN** | `git diff --name-only <base>..HEAD` contains no `p2p/` or `.tmp_gen/` path (structural guard test 11 pattern, re-confirmed) |

## Historical guards remain unweakened

- Electron security literals (`contextIsolation: true`, `sandbox: true`,
  `nodeIntegration: false`) unchanged — confirmed by direct grep of
  `fedos_electron_beta_main.cts`.
- Exactly one `BrowserWindow`/preload/main entry point — unchanged.
- Zero Rust/protocol/Ratchet/Identity/NIP-17/Secure-Memory source change
  by this Arc beyond the two disclosed, additive presentation-layer
  Controller files (Security Finding 3) — confirmed via
  `secure_runtime_alpha_8041_8120_structural_guards.test.ts` test 11's
  own widened (not weakened) assertion.
