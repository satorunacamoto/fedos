# Secure Runtime Alpha 662 — Eligibility Responsibility Decision

Stage 2. Adopted pipeline:

```
Conversation Policy
    -> Public Author Authority
    -> Outbound Eligibility Evaluator
    -> Outbox Intent creation
    -> Publisher
```

Confirmed by source inspection:

- `FedosBoardOutboxPublisher` implementations
  (`src/board/outbox/fedos_board_outbox_publisher.ts`) decide
  privacy/visibility eligibility NOWHERE — neither imports
  `FedosConversationPolicy` nor `FedosOutboundEligibilityResult`.
- `FedosDesktopHost` invents no eligibility — `submitPostWithOutbox()`
  (Alpha 419) accepts already-filtered `targets` from its caller; it
  performs no eligibility computation of its own.
- `FedosBoardOutboxPersistence` (`src/board/outbox/fedos_board_outbox_persistence.ts`)
  validates only structural intent shape (Alpha 417) — never
  application policy.

`FedosBoardRuntime` (Alpha 667) is the ONLY call site that ever invokes
`evaluateFedosOutboundEligibility()` — matching Alpha 633's own
original "runs BEFORE `createFedosBoardOutboxIntent`, inside
`FedosBoardRuntime`'s own command handlers" placement, extended to also
run policy resolution first.
