# Secure Runtime Alpha 725 — Timeout Authority

Stage 5. Options compared: A (Publisher constructor), B (Runtime
config), C (Scheduler), D (Relay).

## Decision: A — Publisher constructor / injected at Runtime assembly time

`FedosRelayOkCorrelatedNostrBoardPublisher`'s constructor already took
`timeoutMs` as its second, optional parameter (Alpha 711). This Arc adds
explicit validation: a non-positive-integer value now THROWS at
construction time, failing closed rather than silently accepting a
nonsensical timeout.

`FedosPublishScheduler` never sees or configures this value — it has no
knowledge of Relay ACK timing at all, preserving Scheduler protocol
neutrality (Alpha 733).

Requirements met:
- **explicit positive integer** — enforced by the constructor guard
  (`test/secure_runtime_alpha_730_ok_listener_lifecycle.test.ts` test 9).
- **deterministic tests through injected timer/clock where practical** —
  `test/secure_runtime_alpha_730_*` test 5 uses `vi.useFakeTimers()`;
  other tests use short, explicit real timeouts (30–2000ms) since the
  correlation logic itself has no other time-dependent branching to fake.
- **no arbitrary silent default** — the existing, already-reviewed Alpha
  711 default (10 seconds) is retained unchanged, not invented fresh.
- **timeout cleanup** — the `setTimeout` handle is `.unref()`'d when
  available and its pending map entry is always removed on settlement.
- **no timer leak** — verified in
  `test/secure_runtime_alpha_730_ok_listener_lifecycle.test.ts` test 5/6.

`startFedosDesktopRuntime()`'s own config surface needed NO new field —
the timeout is passed directly to the Publisher's own constructor by
whichever caller assembles it (`test/secure_runtime_alpha_733_scheduler_and_runtime_compatibility.test.ts`
test 1, using an explicit `2_000`ms timeout end to end through the real
Local Runtime).
