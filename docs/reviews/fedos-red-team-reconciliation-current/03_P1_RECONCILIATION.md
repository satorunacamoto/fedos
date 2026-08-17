# P1 (and notable P2) Reconciliation

Classification legend: STALE_FIXED / STALE_SUPERSEDED / CURRENT_CONFIRMED / CURRENT_PARTIAL /
FALSE_POSITIVE / CURRENT_UNKNOWN.

## Messaging / Inbound Validation (Agent M)

| ID | Original | Classification | Reconciled Severity | Evidence |
|---|---|---|---|---|
| P1-1 Inbound Nostr id/sig verification unwired | P1 | CURRENT_CONFIRMED | P1 | `fedos_conversation_inbound_subscription.ts:121-140` — no id/sig check; dedup keyed on attacker-controlled `event.id` (`fedos_relay_event_deduplicator.ts`). `combined_inbound_event_validator.ts` is real/tested but only wired on the sibling Signed-Deletion path (`fedos_deletion_acknowledgement_signing.ts:92`, `fedos_deletion_request_signing.ts:114`). The one wrapper that would enforce it (`validated_subscription_adapter.ts`) has zero callers and lives in the dead `src/desktop/` lineage. |
| Inbound WS message-size cap | new | CURRENT_CONFIRMED | P2 | `websocket_relay.ts:269-277` — `JSON.parse(raw)` with no length cap anywhere in the chain. No existing max-event-size primitive found in this codebase to reuse; a fix would need to pick and document a limit rather than reuse one. |
| Direct Ratchet "active" ≠ "message routed" (Security State panel) | new | **STALE_FIXED** | — | `fedos_conversation_security_state_controller.ts:128-134` now requires `forwardSecrecyLiveConfirmed` (sourced from the Live-State-Durability arc's honest post-restart fact), not just `ratchetStatus === "active"`. |
| P1-6 Default send route still lacks forward secrecy | P1 | CURRENT_CONFIRMED | P1 | `fedos_desktop_runtime.ts:1258-1263` — opt-in only via test-injection env var; `fedos_conversation_direct_messaging_coordinator.ts:172-173` own comment: "NEVER changes which route runs... byte-for-byte as before." Root cause (no cross-account peer-Device discovery) unresolved. Disclosed in SECURITY.md at the stale-audit head; not independently re-verified against current docs this pass. |
| `ws://` accepted with no warning | new | CURRENT_CONFIRMED | P2 | `fedos_electron_beta_renderer.ts:4565-4568,4732` |
| NIP-42 relay AUTH unimplemented | new | CURRENT_CONFIRMED | P2 | Confirmed via wire-parser tests: AUTH is parsed and silently dropped. |

## Identity / Device (Agent I)

| ID | Original | Classification | Reconciled Severity | Evidence |
|---|---|---|---|---|
| P1-7 Device revocation doesn't quarantine live Ratchet sessions | P1 | CURRENT_CONFIRMED | P1 | `applyDeviceRevocationToSessions()` (`fedos_direct_ratchet_conversation_runtime.ts:244-257`) — own docstring: "nothing in this codebase automatically triggers it... a disclosed, honest boundary, not an oversight." Zero production callers; `revokeDevice()` in both `fedos_device_pairing_facade.ts` and `fedos_device_binding_registration_authority.ts` never calls it. |
| Safety-number-comparison is a label, not a capability | P2 | CURRENT_CONFIRMED | P2 | No fingerprint-derivation/display function exists anywhere. |
| Identity Replacement broadcast receive-only | P2 | CURRENT_CONFIRMED | P2 | `publishIdentityTransitionNotification` has zero callers outside its own definition. |
| Ratchet-reset device-sig optional in the common case | P1 | CURRENT_CONFIRMED | P1 | `fedos_direct_ratchet_session_reset_authentication.ts:31-39` — own comment still says device-key binding is null for "the overwhelming majority" of bindings; check is skipped when absent. |
| Account/Nostr "rotation" has no rotation certificate | INFO | CURRENT_CONFIRMED | P2/INFO | Terminology/documentation risk only; Identity Replacement is the only real mechanism. |
| **NEW:** Own-Device Sync transport never wired in production | not in old audit | CURRENT_CONFIRMED | P1 | `fedos_electron_beta_main.cts:5106` — `deviceSyncAttemptFn: eventBridge.wrapAttemptFn()` called with zero arguments; `FedosDeviceRelaySyncOutboundCoordinator` never constructed. Own-Device Sync is enabled by default but silently non-functional end-to-end. |
| **NEW:** Own-Device Sync status truthfulness | not in old audit | **STALE_FIXED** | — | `8712add7` fixed the status derivation to correctly report `"failed"` instead of a false `"running"` when every schedule is permanently stuck. |

## Recovery / First-Run / Backup (Agent R)

| ID | Original | Classification | Reconciled Severity | Evidence |
|---|---|---|---|---|
| P1-5 Backup file-path guidance computed but dropped before UI | P1 | CURRENT_CONFIRMED | **P1 (elevated priority)** | `fedos_electron_beta_main.cts:5263-5273` `readyResult()` forwards only `{displayLabel, accountPublicIdentifier, localDeviceId, deviceTrustState}` — no `recoveryNotice` field anywhere in the packaged app's IPC surface (repo-wide grep, zero hits outside test-only `src/desktop/onboarding/`). The Product Durability Mega-Arc improved the *content* of the notice (added whole-profile-directory guidance) but never fixed this forwarding bug — the improved notice is computed and then silently thrown away, meaning the mega-arc's own fix is currently invisible to real users. |
| No in-app full-profile backup (manual copy only) | implicit | CURRENT_CONFIRMED | P2 | Deliberately deferred per `04_SECURITY_AUDIT_AND_DECISION.md` (documentation-first decision, not an oversight). |
| No lockout/throttle on wrong passphrase | P2 | CURRENT_CONFIRMED | P2 | `unlockProfile()` — no attempt counter, no backoff. Mitigated by Argon2 sealing cost, not eliminated. |

## Release / CI / Install / Docs (Agent O)

| ID | Original | Classification | Reconciled Severity | Evidence |
|---|---|---|---|---|
| P1-2 Install/uninstall/upgrade never empirically tested | P1 | CURRENT_CONFIRMED | P1 | `generate_public_beta_gate.mjs:65-67` — all three attested-evidence flags still default `"accepted-limitation"`; nothing in the repo ever sets them `true`. |
| P1-3 Checksum/install docs name wrong artifact files | P1 | **STALE_FIXED** | — | `docs/pilot/INSTALLATION.md:17-20` now matches `electron_builder.beta.config.json`/`generate_release_checksums.mjs` exactly. |
| P1-4 CI too thin (no cargo/wasm/package/typecheck gate) | P1 | CURRENT_CONFIRMED (remote CI) | **P1, not P0** | `.github/workflows/ci.yml` — gap is real but honestly self-documented in the workflow file; a genuinely strong **local** release pipeline exists and is enforced (`BUILDING.md`'s real 14-step `build_release.mjs`, with the beta gate as a hard-fail step). Classified "thin remote CI + strong local gate," not "both thin" — does not meet the P0 bar. |
| WASM glue JS executed before/without integrity check | P1 (reachability was UNCONFIRMED) | CURRENT_CONFIRMED, **reachability now resolved** | P1 | Confirmed reachable from real `handleCreate`/`handleUnlock` → `buildFreshCoordinator()` → `authorizeAndActivateFedosProductionDesktopMasterSeed()`. Manifest schema still has no `jsGlueSha256Hex` field; glue file still imported/executed before any check. |
| No Cargo.lock / loose semver | P1 | **STALE_FIXED** | — | `Cargo.lock` now exists and is git-tracked; decision documented in `docs/secure_runtime_p0_closure_cargo_lock_policy_supersession.md`. |
| Tor strict-transport packaging P0 (files-allowlist gap) | (was already a fixed bug in history) | **STALE_FIXED, re-verified complete** | — | All 6 Tor source files present in the packaging allowlist; cross-checked against actual imports on the one real packaged window — no similar gap found elsewhere. |
| **NEW:** "No onion routing" doc claims now false-in-the-absence-direction | not in old audit | CURRENT_CONFIRMED | P2 | A real, tested Tor/SOCKS5 strict-transport implementation exists (`fedos_electron_strict_transport_policy.ts`, validated with a real public-Tor two-process proof) but is disabled by default, reachable only via undocumented env vars, with no Settings/renderer UI. `KNOWN_RISKS.md`/`README.md`/`SECURITY.md` still say "no onion routing... outside anything this project has tested" — objectively false as a capability claim, though the practical exposure (an ordinary pilot user can't reach it anyway) is low. |

## Net P1 count

Original audit: 13 P1s (plus ~16 P2/INFO).
Reconciled: **8 CURRENT_CONFIRMED P1s** (P1-1, P1-6, P1-7, ratchet-reset-device-sig-optional,
own-device-sync-transport-unwired, P1-5, P1-2, P1-4, WASM-glue-integrity — actually 9, see
table above for the precise list), **4 STALE_FIXED** (P1-3, Cargo.lock, Tor-packaging-P0,
Direct-Ratchet-security-panel-false-green), remainder reclassified to P2/INFO as tabulated.
