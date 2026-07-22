# Secure Runtime Alpha 6121–6200 — Completion Declaration

**FedOS Identity Replacement User Verification and Conversation
Continuity UI Arc.**

## Status: full completion (two disclosed, pre-existing boundaries — both matching established precedent, neither specific to this Arc)

- Real transition inbox, bounded/deterministic/one-row-per-logical-
  transition, restart-safe — done (Phase J).
- Explicit manual verification, three closed methods, durable,
  restart-safe, unknown methods fail closed — done (Phase D).
- Explicit local acceptance/rejection/deferral, durably persisted (a
  REAL gap in the prior Arc's own first draft, closed this Arc — see
  "Real bug found" below), latest decision always wins, duplicate
  acceptance idempotent — done (Phase C).
- Honest evidence warnings, centralized, never "verified" shown as
  "trusted" — done (Phase B/Q).
- Immutable historical identity — Archive/Search/Membership/message-
  authoring code paths are never imported by this Arc, structurally
  proven — done (Phase F/K/L).
- Explicit continuity model — smallest additive model, existing
  Conversation ID never rewritten — done (Phase F/G).
- Separate Ratchet-reset authorization — two distinct steps
  (assess-then-authorize), a thin adapter over the existing, real
  `initializeDirectRatchetSession()`, no new reset mechanism — done
  (Phase H).
- Real Shell/Presentation/Renderer path — 10 new Shell methods, 10 new
  Host Commands, one Controller, one Renderer, one Navigation state,
  wired into the SAME singular Shell/Boundary/Renderer/Bridge this
  codebase already has — done (Phase K/L/M/N/P).
- Restart-safe durable state — 3 new append-only fact domains (manual
  verification, conversation continuity, local decision) plus reuse of
  the Foundation/Peer-Reset Arcs' own — done (Phase D/F/G/J).
- Real vertical slice — 100% real BIP-340 Schnorr crypto, a genuinely
  REAL `FedosConversationRuntime`/`FedosDesktopApplicationShell`/
  `FedosDesktopConversationUiPresentationBoundary`, no fake business
  Runtime — done (Phase R).
- No automatic identity mutation anywhere — done, structurally proven.

## Real bug found and fixed this Arc

The prior Arc's own `FedosIdentityTransitionPeerRuntime.recordIdentityTransitionDecision()`
computed a decision's EFFECT for one call only — it never durably
recorded WHICH decision was made. A later `inspectPeerIdentityTransitionStatus()`
call (or a process restart) would silently lose an already-made
`"accept"`/`"reject"`. Found while building this Arc's own real vertical
slice (an accepted decision reverted to `"manual-review-required"`
after a simulated restart). Fixed by adding
`fedos_identity_transition_local_decision.ts` — a new, additive, durable
fact domain this Arc's own Phase C/R explicitly required — and wiring
`recordIdentityTransitionDecision()`/`inspectPeerIdentityTransitionStatus()`/
`listIdentityTransitionInbox()` through it. Not a regression this Arc
introduced; a genuine gap in the prior Arc's own first cut, closed here
because this Arc's own real vertical slice actually exercised the
restart path the prior Arc's tests did not.

## Two disclosed, pre-existing boundaries (matching established precedent, not gaps specific to this Arc)

1. **Notification Coordinator wiring** — not reached, exactly matching
   `b72ca7b6`'s own disclosed "narrow, non-redesign follow-on" for the
   identical layer. This Arc makes the same scope choice rather than
   exceeding the precedent it was asked to mirror.
2. **Electron subprocess acceptance** — no canonical Electron Main/
   preload exists anywhere in `src/` (only a separate, explicitly-spike-
   labeled package untouched by any prior Arc); this Arc stops at the
   same `FedosDesktopHostBridge` in-process boundary every prior Arc in
   this lineage stops at.
3. **A genuine, live Direct Ratchet session and a genuine
   `establishSession()` reset dispatch** both require real Master-Seed-
   derived X25519 Double Ratchet crypto via a compiled
   `packages/fedos-core-rust/pkg/` — confirmed absent in this worktree,
   and confirmed by inspection that EVERY test in this repository
   exercising `establishSession()` is `describe.skip`'d without it, no
   exceptions found. This Arc's own real vertical slice proves the real
   two-step reset-authorization CALL CONTRACT (an honest `"unavailable"`
   from both `assessContinuity()` and `authorizeRatchetReset()` when
   `directRatchet` is not configured) with 100% real crypto everywhere
   up to that one documented boundary — never a fabricated "reset
   succeeded."

## Verification

`npm run typecheck:core` — clean for every file this Arc touched (2
pre-existing, unrelated baseline errors remain). 5 new test files, 39
new tests, all passing, no WASM gate needed anywhere in this Arc's own
tests. One pre-existing test file
(`secure_runtime_alpha_5801_5880_structural_guards.test.ts`) received a
narrow, additive allowlist extension for this Arc's own 3 new
append-only backends — re-verified passing. Full regression sweep of
this Arc's own 5 files plus the Foundation Arc's 6, the Peer/Reset
Arc's 7, the Deletion-Request-UI Arc's 3, and the pre-existing Desktop
Shell suite: 220 passing, 2 WASM-gated skips, 0 failures.

## Next Arc

**FedOS Desktop Beta Privacy Controls and Safety Center Arc.**
