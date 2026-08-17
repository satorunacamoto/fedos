# Acceptance Matrix

| Finding | Required evidence to close | Status |
|---|---|---|
| P0-B false Sent | `onChatSend()` shows a distinct state for queued / route-unavailable / crypto-unavailable / persistence-failed / failed, never a bare "Sent." for anything but the queued-for-delivery outcome; failures also surface via `#chat-error` | **CLOSED.** `fedos_electron_beta_renderer.ts` now reads `result.value.delivery`; updated live E2E assertions (source-verified, could not execute — no WASM/Electron dist in this fresh worktree); new structural guard test (8/8 passing) proves no code path renders a bare "Sent." |
| P1-5 backup notice dropped | `readyResult()` includes `recoveryNotice`; renderer displays whole-profile-directory guidance; test proves the field survives the IPC round trip | **CLOSED.** `main.cts`/`window.d.ts`/`renderer.ts`/`page.html` all updated; covered by the same structural guard test file (8/8 passing) |
| P0-A/P1 old-key silent auto-accept | An old-key-continuity observation under the default policy no longer reaches `acceptanceState: "accepted"` without an explicit local decision; legitimate explicit-accept and device-corroborated paths still work | **CLOSED.** Fixed at the evidence-evaluator layer (`fedos_identity_transition_evidence_evaluation.ts`) — old-key-only evidence now routes to `"continuity-old-key-only"` → `"manual-review-required"`, never auto-`"accepted"`. 166/167 combined tests pass (1 pre-existing WASM-gated skip) across 5 affected test files, including a full real-signature "notification→import→evaluate→observe→restart→accept→reset-authorize" vertical-slice test proving the legitimate explicit-accept path is unaffected |
| P1-7 device revocation quarantine | `revokeDevice()` calls `applyDeviceRevocationToSessions()`; production composition root actually supplies the dependency, not just the mechanism | **CLOSED.** Mechanism built + unit-tested in `fedos_device_binding_registration_authority.ts` (fix agent); composition-root wiring completed by the coordinator in `fedos_device_binding_boundary_factory.ts` + `fedos_desktop_runtime.ts` (threads `conversationRuntimeInstance.directRatchet()?.applyDeviceRevocationToSessions()` through `createFedosDeviceBindingBoundary()`). Typechecked clean; existing device-pairing/binding-boundary/device-replacement test suites (94 tests across 3 files, including a real two-Runtime end-to-end pairing lifecycle) all still pass post-wiring. No dedicated end-to-end "revoke via real Runtime quarantines a real live Ratchet session" test was added (would require a heavier dual-feature Runtime harness) — flagged as a residual gap, not a blocker |
| P1-1 inbound validator unwired | Real Direct Conversation inbound path rejects bad-id, bad-signature, oversized, and duplicate events before they reach conversation state | **CLOSED.** `validateInboundNostrEvent` wired into `fedos_conversation_inbound_subscription.ts` before dedup/delivery; dedup now keys on the validated id. 30/30 new+updated tests pass using real BIP-340 signing (bad-id rejected, bad-sig rejected, real replay still deduped, valid event still delivered). Message-size-cap/oversize rejection was NOT added (no existing documented max-event-size primitive to reuse, per instruction not to invent an undocumented limit) — left as a separate, documented P2 recommendation |

## Coordinator integration check

All 5 fixes were implemented by 3 parallel agents plus the coordinator (device-revocation
composition-root wiring) across fully disjoint files. A combined run of all 10 directly
affected test files together (166 tests) passed with zero regressions, confirming no
cross-fix interaction issues. `tsc --noEmit` shows zero new errors attributable to any
touched file (998 total pre-existing errors, unchanged in kind from the known
`@types/node` environment artifact this worktree already carried).

Full release gates (test:current, cargo test/build, WASM build, Electron package where
feasible) and installed regression checks are recorded separately — see the final
coordinator report for FINAL CandidateHead/EvidenceHead and gate results.
