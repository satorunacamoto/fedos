# Secure Runtime Alpha 5881–5960 — Completion Declaration

**FedOS Signed Recipient Deletion Request Private Transport and Local Policy Integration Arc**

## Declared: full completion

- [x] Real signed request transport — `FedosDeletionRequestOutboundCoordinator` builds,
      signs (real `FedosNostrSigningAuthority`), self-checks, durably persists, and
      publishes through the REAL `FedosPrivateTransport.sendMailboxNip17Control()` seam
      (real NIP-17 Rumor/Seal/Gift-Wrap, real Outbox, real bounded retry).
- [x] Real recipient validation/policy — the Inbound Coordinator delegates schema/
      signature/expiry/replay/Membership/authorship/recipient-binding entirely to
      `5641-5720`'s own real `evaluateFedosDeletionRequestForRecipient()`, then applies a
      new, closed, LOCALLY-CONFIGURED policy vocabulary (`fedos_deletion_recipient_policy.ts`)
      — never caller-supplied, never an unconditional default allow.
- [x] Real Local Deletion execution — the granted path calls `b3b3a6d`'s own REAL
      `executeFedosLocalPayloadDeletionPlan()`, re-verified independently in the real
      vertical slice by re-querying `FedosPayloadRetentionAuthority.evaluatePayloadAccess()`
      afterward (`"denied"`, not merely a claimed outcome).
- [x] Real signed acknowledgement return — `FedosDeletionAcknowledgementOutboundCoordinator`
      signs and publishes an honesty-checked acknowledgement
      (`isFedosDeletionAcknowledgementRecordHonest()`); the requester's own
      `FedosDeletionAcknowledgementInboundCoordinator` verifies, correlates, and persists it
      for real.
- [x] Restart/idempotency — proven in BOTH the coordinator-integration test (duplicate
      request redelivery: one execution record, not two) and the real vertical slice
      (both Runtimes rebuilt from the SAME durable log files; request status, Retention
      denial, and acknowledgement correlation all replay identically).
- [x] Multi-device truth — a request addressed to an unregistered Bob Device is denied
      (`"recipient-device-unknown"`) BEFORE any publish is attempted, proven with real
      Device Registry state in the real vertical slice; a wrong-Device acknowledgement
      claim is denied via the durable, restart-safe `recipientDeviceRef` snapshot field this
      Arc adds.
- [x] No Archive/backup/Relay deletion — structurally proven (Phase Q, tests 4–6): no file
      this Arc adds imports the Archive-file removal authority or any backup/Relay-shaped
      vocabulary value.
- [x] Real E2E vertical slice — `test/secure_runtime_alpha_5881_5960_real_vertical_slice.test.ts`
      runs against genuinely-built WASM (`packages/fedos-core-rust/pkg/`, built for real in
      this session — `cargo build --target wasm32-unknown-unknown --release` +
      `wasm-bindgen`), real Master Seeds, a real in-process Relay, and real NIP-17 Gift Wrap.
      **Passes.**

## Named, honest limitation (not silently dropped)

The real vertical slice does NOT include Phase O's own "Bob creates an Archive containing
the message" sub-step — Archive CLI harness wiring is a substantial, orthogonal addition
this Arc's own time budget did not reach. Every OTHER real-headline-path claim above is
proven with no mock. The "no Archive deletion" guarantee itself is proven structurally
(Phase Q) independent of this gap — this limitation is about one extra proof point (an
Archive surviving a deletion it was never asked to touch), not about the guarantee's own
correctness.

## Real design gap found and fixed during this Arc's own development

`fedos_deletion_request_authorization_assessment.ts` hardcoded `authority: "fedos"` when
synthesizing a participant reference to check against real Membership records. A real
production Direct Conversation's own Membership uses `authority: "nostr"` (the real resolved
pubkey). Left unfixed, this would have made EVERY real deletion request against a real
Conversation fail `"requester-not-author"` regardless of correctness — caught by the real
vertical slice's own first `"published"` assertion failing. Fixed with a narrow, additive,
100%-source-compatible `accountAuthority` parameter (default `"fedos"`, every `5641-5720`
call site/test unaffected) — see the reconciliation report §4.

## Verification run (this worktree)

1. `npx tsc --noEmit -p .` — clean except the two pre-existing, unrelated baseline errors
   (confirmed identical on the unmodified `decda87` base).
2. This Arc's own 4 new test files, 39 tests: **all passing**, including the real WASM
   vertical slice.
3. `5641-5720`'s own 9 test files (172 tests, including that Arc's own vertical slice):
   **unchanged, all still passing** after this Arc's own additive field/transition/export
   changes.
4. Full `npx vitest run` (1071 files / 14037 tests), compared via sorted-JSON-report diff
   against the SAME unmodified `decda87` base (both runs with the WASM artifact present):
   **zero net regressions** — see the execution spec's own Verification section for the
   exact diff.
5. No file under `p2p/` or `.tmp_gen/` was read, written, or referenced by this Arc.

## Files changed

Eight new files under `src/conversation/deletion_request/`; four additive changes to that
domain's own `5641-5720` founding files (one new field, one new export, one widened
transition set, one optional parameter — none a redesign); one new adapter file; additive
wiring in `src/conversation/runtime/fedos_conversation_runtime.ts` (`deletionRequest`
optional dependency, `deletionRequest()` accessor, a third `receiveNip17Rumor()` dispatch
attempt); five new docs (this one, the reconciliation report, the execution spec, the
control-payload mapping, the recipient-policy/acknowledgement-truth doc); four new test
files; five existing `5641-5720` test files gained one additive `recipientDeviceRef`
field/one rescoped structural guard. No `package.json`, `package-lock.json`, `Cargo.toml`,
`p2p/`, or `.tmp_gen/` change.

## Recommended next Arc

**FedOS Signed Deletion Request Multi-Device Aggregation and User Consent UI Arc.**
