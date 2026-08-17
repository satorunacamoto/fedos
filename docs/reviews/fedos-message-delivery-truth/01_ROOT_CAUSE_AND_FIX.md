# Message Delivery Truth — Root Cause, Fix, and What Remains

Condensed single-pass report against the full mandate's own 8-doc Phase A structure
(`01_CURRENT_SEND_PIPELINE.md` through `08_ACCEPTANCE_MATRIX.md`) — time/scope did not permit
the full document set; this captures the load-bearing facts from each.

## 1. Current send pipeline (traced, not assumed)

`ContentAccessor.sendMessage()` → `ConversationRuntime.sendDirectMessage()` →
`FedosConversationDirectMessagingCoordinator.sendDirectMessage()`:

1. Local encrypt + envelope write (`encryptionCoordinator.encrypt()`) → `outcome: "sent-locally"`.
   This ALWAYS happens first, independent of delivery — matches the codebase's own Alpha 1129
   design ("`sent-locally` never implies network/protocol delivery").
2. If `ratchetDelivery` configured: `sendRatchetMailboxNip17()` → real
   `FedosDirectRatchetSendOutcome` (route: Direct Ratchet).
3. Else if `delivery` configured: `sendMailboxNip17()` → real
   `FedosPrivateWireDeliveryQueueOutcome` (route: legacy NIP-17).
4. Either way, the coordinator attaches the real outcome as `result.delivery` — **this was
   already correct and already awaited**, confirmed via source read, not inferred.

## 2. Real outcome loss point (confirmed, single location)

`FedosDesktopConversationContentAccessor.sendMessage()`, `"direct"` branch, `"sent-locally"`
case: read `result.outcome` only, discarded `result.delivery` entirely, hardcoded
`fanout: "not-applicable"` unconditionally. `fanout: "not-applicable"` is itself honest for a
Direct send (no fan-out concept exists — genuinely a Group-only axis), but there was **no field
at all** carrying the real per-message delivery fact for Direct sends. A real
`crypto-unavailable`/`route-unavailable`/`failed` outcome from step 2/3 above was silently
thrown away, indistinguishable from genuine queuing.

## 3. Ratchet role/send-chain state — hypothesis tested and FALSIFIED

Leading hypothesis carried in from a prior arc: a RECEIVER-role Direct Ratchet session's sending
chain (ready only after its first real decrypt, per Double Ratchet's own design) might not
survive a real seal→clear→restore cycle, explaining "Alice's reply never reaches the relay."

Tested directly against the real WASM Ratchet core (`test/fedos_direct_ratchet_receiver_role_send_chain_restore_repro.test.ts`):
Alice created as receiver, decrypts Bob's first real message (`isReadyToSend()` → `true`), real
seal, real master-seed clear + reactivate, real `FedosDirectRatchetCryptographicSession.restore()`.
Result: `isReadyToSend()` stays `true` after restore, and a real `encrypt()` call succeeds — Bob
genuinely decrypts the restored session's reply. **The crypto layer is not the defect.** This
matches the existing, already-passing `secure_runtime_alpha_7401_7480_ratchet_route_binding_isolation.test.ts`,
which already exercises a full runtime-layer restart+send cycle for both roles successfully.

**The actual root cause of the original real-Tor non-delivery symptom remains unconfirmed** —
ruled out: crypto/ratchet-role readiness. Not yet investigated in this pass, for lack of
remaining time: the async outbox/mailbox flush path (a message can be genuinely, honestly
`"queued"` and still never reach the relay if the background flush mechanism itself has a
liveness bug — a materially different, lower-severity class of defect than a correctness lie,
since the delivery-truth fix below now makes "queued" vs "failed" honestly visible either way).

## 4. Fix delivered

- `FedosContentAccessorDeliveryFact` (new, additive type): `{route: "direct-ratchet" |
  "legacy-nip17", state: "queued" | "route-unavailable" | "unavailable" | "failed", reason?}`.
- `FedosConversationDirectMessageSendResult` gained an additive `route` field (coordinator sets
  it in both delivery branches) — needed because several real outcome strings
  (`crypto-unavailable`/`persistence-failed`/`identity-unavailable`) are structurally identical
  between the Ratchet and legacy outcome unions; only the coordinator itself unambiguously knows
  which branch ran.
- `ContentAccessor.sendMessage()` now propagates `result.delivery`/`result.route` through two
  exhaustive, no-default-case mapper functions into a new, additive `delivery?` field on
  `FedosContentAccessorSendResult` — `fanout` is untouched (still correct for Group sends).
  `undefined` (not fabricated `"queued"`) when no delivery dependency was configured at all.
- Propagated through `FedosMessageSendResultView`/`toShellSendResultView()` — same additive
  pattern, zero change to any existing field.
- Legacy route gets the exact same truthful treatment as the Ratchet route — no asymmetric fix
  (mandate §26).

## 5. What did NOT get done this pass (honest disclosure)

- The actual outbox-flush non-delivery root cause (see §3) — not found, not fixed.
- No installed two-process local/restart proof, no bounded public Tor confirmation this pass.
- No Commerce/Peer-Device/Identity-Transition/Signed-Deletion shared-pipeline regression audit
  beyond the existing Direct Ratchet suite (which passed unchanged, 17/17 real-crypto tests).
- No future-readiness ranking update this pass (unchanged from the prior arc's own findings).
- No full release pipeline re-run (no packaging-relevant files were touched — only pure TS
  logic in already-allowlisted files — so this is a low-risk gap, but genuinely not verified this
  pass).

## 6. Verified this pass

- `npm run typecheck:core`: clean (2 pre-existing, unrelated baseline errors only).
- `npm run test:current`: 191 files / 2811 tests / 0 failures.
- Direct Ratchet regression set (17 tests, real WASM crypto, incl. the new repro test): all pass.
- New `test/fedos_desktop_content_accessor_delivery_truth.test.ts` (6 tests): structural
  no-false-positive/no-false-negative guards per mandate §31-33, exhaustive over every real
  failure outcome both routes can return.
- One pre-existing, unrelated failure confirmed via git-stash A/B
  (`secure_runtime_alpha_3081_3160_content_accessor.test.ts`, Archive export `not-found` vs
  `failed` — reproduces identically with this arc's changes stashed out).
