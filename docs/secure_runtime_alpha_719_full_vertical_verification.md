# Secure Runtime Alpha 719 — Full Vertical Verification

Stage 19 of Phase B.

```
Local Runtime
→ BoardRuntime
→ Public Author Authority
→ Nostr Binding
→ Conversation Policy
→ Outbound Eligibility
→ Host durable write
→ Outbox
→ Scheduler
→ Publisher
→ (real BIP-340) signer
→ (deterministic) Relay
→ Observation
→ Retry recovery
```

- **One successful eligible flow** —
  `test/secure_runtime_alpha_707_real_nostr_outbox_processing.test.ts`
  test 1: real signing, real binding, durable write, durable Outbox,
  Scheduler-driven delivery, real BIP-340-verified signed event, matching
  Relay OK, Observation recording acceptance.
- **Local-only flow** — `test/secure_runtime_alpha_713_failure_matrix_and_safety.test.ts`
  test 4: unaffected by a fully-configured real signing/binding graph and
  running delivery.
- **Mismatched identity fail closed** —
  `test/secure_runtime_alpha_698_board_runtime_binding_verification.test.ts`
  test 2 (Phase A) and
  `test/secure_runtime_alpha_713_failure_matrix_and_safety.test.ts` tests
  2a/2b (Phase B: unavailable/unbindable signer).
- **Restart flow** —
  `test/secure_runtime_alpha_709_restart_delivery_verification.test.ts`:
  three independent `startFedosDesktopRuntime()` calls over the same
  durable paths.
- **No duplicate send** — the same restart test's own final assertion,
  plus `test/secure_runtime_alpha_707_*` test 3.
- **Stop behavior** — every test in this Arc calls `host.stop()`/
  `host.stopDelivery()`/`runtime.stop()` and completes cleanly; no
  hanging timer or socket was observed across the full suite run (Alpha
  716).
- **Exact supported delivery semantics** — honestly stated in Alpha 712:
  `"delivered"` means Relay-accepted when wired with
  `FedosRelayOkCorrelatedNostrBoardPublisher`, transport-sent-only when
  wired with the older `FedosRelayNostrBoardPublisher`; `"rejected"` is
  not yet a distinct outcome (Alpha 711's disclosed limitation).

All of the above passed on real execution, not code inspection alone.
