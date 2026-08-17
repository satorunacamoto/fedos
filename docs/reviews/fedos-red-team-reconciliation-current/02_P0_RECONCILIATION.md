# P0 Reconciliation

## P0-A — Old-key identity-transition auto-accept

**Original claim:** old-key continuity evidence auto-accepts with zero human interaction,
gating a real Ratchet Reset action, with no safety-number check anywhere.

**CLASSIFICATION: CURRENT_PARTIAL → reclassified P1**

**CURRENT USER CONFIRMATION: PASS (for the sensitive mutation) / FAIL (for the trust record)**
**AUTO ACCEPT: YES (trust record) / NO (Ratchet Reset mutation itself)**

Evidence (worktree `f57812a0`):
- `fedos_identity_transition_evidence_evaluation.ts:79-81` — `autoAcceptOldKeyContinuity: true`
  default is unchanged; zero production overrides exist (grep confirmed).
- `computeFedosIdentityTransitionAcceptanceState` still flips a non-compromise, old-key-signed
  observation to `acceptanceState: "accepted"` with no human interaction — this part of the
  original finding is **still true**.
- **New since the stale audit:** the real state-changing action (Ratchet session reset) is
  gated behind two explicit IPC-wired human confirmations
  (`fedos_electron_beta_main.cts:8729,8733-8734`) — `identityTransitionAccept` then a second
  explicit confirm before `identityTransitionAuthorizeRatchetReset` fires. A "silently
  auto-accepted" detector (`fedos_identity_transition_silent_acceptance_detection.ts`) now
  surfaces a warning in the transition's detail view. `identityTransitionRecordContinuity`
  (which would rewire live conversation routing) still has zero production callers.
- No safety-number/fingerprint derivation capability exists anywhere in the codebase (unchanged).

**Reasoning for downgrade:** the original framing conflated the trust-record auto-accept with
an automatic cryptographic mutation. In the current lineage, the record still auto-accepts
silently, but nothing state-changing fires without an explicit double-confirm from the user,
and a warning is surfaced (on-demand, not proactively) if the user inspects the transition.
The residual risk — a forged trust record with no verification path, and a warning that's
easy to miss — remains real and worth fixing, but no longer meets the P0 bar of "wrong
account/device accepted as trusted" with a live consequence.

---

## P0-B — UI shows "Sent." before real delivery evidence

**Original claim:** the UI shows "Sent." on local-persist success alone; the real delivery
outcome is computed and discarded before reaching the renderer.

**CLASSIFICATION: CURRENT_CONFIRMED — remains P0**

**REAL OUTCOME PROPAGATED: PARTIALLY — YES to the IPC boundary, NO to the renderer's decision logic**
**REJECT SHOWS SENT: YES (bug persists)**
**TRANSPORT DOWN SHOWS SENT: YES (bug persists)**

Evidence (worktree `f57812a0`):
- `fedos_desktop_conversation_content_accessor.ts:406,414` — a real `delivery` fact IS now
  computed (fixed by commit `50ffce50`, part of the Outbox Flush Reliability arc).
- `fedos_desktop_shell_view_models.ts:109-117` — `FedosMessageSendResultView.delivery?` field
  exists and is populated.
- `fedos_electron_beta_main.cts:6065-6069` — the IPC response correctly includes
  `value.delivery`.
- **`fedos_electron_beta_renderer.ts:1445-1467` `onChatSend()`** — checks only
  `result.outcome !== "ok"`; never reads `result.value.delivery`; unconditionally displays
  `"Sent."` on local-write success.

**Reasoning:** the data-plumbing fix that landed since the stale audit closed most of the gap
— delivery truth now flows all the way to the IPC response. But the renderer itself was never
updated to consult it, so the user-visible defect is identical in effect: a message can still
be shown as "Sent." when the relay rejected it or the transport was unavailable. The residual
fix is now narrow and low-risk (one function, `onChatSend()`, needs to branch on
`result.value.delivery` instead of only `result.outcome`).

---

## P0-C — Corrupted profile/sealed-seed produces permanent dead-end

**Original claim:** corruption fails closed correctly, but the recovery screen offers only
Retry/diagnostic-code/Quit with no disclosed repair path; state persists across restarts.

**CLASSIFICATION: STALE_FIXED**

**RECOVERY PATH: PASS**
**BACKUP GUIDANCE: FAIL (see P1-5 below — a related but distinct defect)**
**PERMANENT DEAD END: NO**

Evidence (worktree `f57812a0`):
- `fedos_profile_initialization_coordinator.ts:832` — `resetCorruptReadyProfile()`, a real,
  guarded reset action (refuses to destroy an intact-but-locked profile; only resets genuinely
  corrupt state).
- `fedos_electron_beta_main.cts:5504` (`handleResetCorruptReadyProfile`) + `:8626` (IPC channel
  `fedos-profile:reset-corrupt-ready`); `..._preload.cts:96`; `..._renderer.ts:5016-5018,5088-5112`;
  `..._page.html:210-213` (`#recovery-actions-corrupt` — honest data-loss copy + working
  "Start Over" button).
- `test/secure_runtime_alpha_4661_4740_first_run_onboarding.test.ts:1068-1213` — proves both
  the success path (corrupt seal → reset → fresh profile creation works) and the safety
  refusal (intact-but-locked profile is never destroyed).

**Reasoning:** this was fixed by an earlier, separate arc ("P0 Closure: timing fix,
first-run/unlock recovery, release integrity, peer-device UX, forward-secrecy hardening",
commit `4aef5d1a`) that already landed by the time origin/main's tip was cut — meaning the
stale audit's own product head (`origin/main @ 4e2825cb`) should have shown this fix too.
Re-verification against origin/main is recommended as a follow-up sanity check, but the fix
is unambiguously present and tested on the current lineage.

---

## Summary

| ID | Original | Reconciled | Confidence |
|---|---|---|---|
| P0-A | P0 | **P1** (CURRENT_PARTIAL) | HIGH |
| P0-B | P0 | **P0** (CURRENT_CONFIRMED) | HIGH |
| P0-C | P0 | **STALE_FIXED** | HIGH |

**Original P0 count: 3. Current P0 count: 1 (P0-B).**
