# Implementation Plan — This Mandate's Scope Only

**Status**: Retrospective record (the work below is already committed by the time this doc was
written) plus the explicit non-plan for what was deliberately deferred. Written against commit
`cb7f0b9d`.

## Implemented this mandate

1. Direct Ratchet Option A composition-root wiring (`f2440e01`) — see
   `docs/reviews/fedos-direct-ratchet-identity-space-final/08_IMPLEMENTATION_PLAN.md` for the
   detailed file-by-file plan this executed.
2. Conversation-activation startup-race fix (`cb7f0b9d`) — eager reactivation of every known
   durable direct-mode conversation before the transport subscription opens, in
   `fedos_desktop_runtime.ts`.
3. Two release-readiness P1 fixes: `packaged_dependency_closure.d.mts` (missing 2 of 8 exported
   function declarations) and a new `verify_release_package_allowlist.d.mts` (previously
   absent entirely), plus the resulting real ripple fix in
   `test/secure_runtime_alpha_5241_5320_packaging.test.ts`.

## Deliberately NOT planned or implemented this mandate (Branch A)

Per `07_COORDINATOR_DECISION.md`: no Tor implementation, no fix for the live-ratchet-state
durability gap, no fix for the downstream Forward-Secrecy status truthfulness risk. These are
next-arc scope, not this mandate's.
