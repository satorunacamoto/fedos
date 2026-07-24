# Secure Runtime Alpha 7961–8040 — Stage 3: Electron Acceptance Findings (Detailed)

## Reproduction

1. `test/secure_runtime_alpha_6761_6840_settings_relay_reachability.test.ts`
   tests 8/9 (a real relay configured, then create/unlock) failed with
   `FEDOS_ELECTRON_BETA_AUTOTEST_RESULT:runtime-start-failed`,
   `presence:"recovery-required"`, in ~1 second (too fast for a genuine
   crypto-activation failure).
2. Test 7 (single "create" call, relay configured, no restart) ALSO failed
   identically — ruling out a restart/race theory; the defect is in
   profile creation itself whenever a relay is configured.
3. Test 6 (single "create" call, NO relay configured) passed — confirming
   the relay configuration itself is the trigger.
4. A manual reproduction (`node scratch_repro.mjs`, calling
   `FileFedosSealedMasterSeedEnvelopePersistence.read()`/
   `FileFedosLocalProfilePersistence.read()` directly against a fresh temp
   directory) proved BOTH ports correctly return `null` for a fresh
   directory — the persistence layer itself is not the defect.
5. Inspecting the coordinator's own `#startAndBootstrap()` showed
   `startResult.outcome !== "ok"` triggers `markDescriptorState("failed")`
   (profile.json + master-seed.sealed.json ARE both written successfully)
   before the coordinator reports `"runtime-start-failed"` — meaning
   `startFedosDesktopRuntime(config)` itself threw.
6. Temporarily instrumenting the compiled `dist/desktop/onboarding/fedos_profile_initialization_coordinator.js`'s
   own catch block (`console.error("DIAG_STARTRUNTIME_ERROR:", diagErr.stack)`)
   and re-running the exact manual repro captured the real stack:

   ```
   Error: FedosRelay.subscribe() called while not connected.
       at WebSocketRelay.subscribe (.../dist/desktop/websocket_relay.js:299:19)
       at FedosConversationInboundSubscription.start (.../dist/conversation/transport/relay/fedos_conversation_inbound_subscription.js:78:46)
       at FedosPrivateTransport.start (.../dist/conversation/transport/fedos_private_transport.js:366:32)
       at async FedosProfileInitializationCoordinator.startFedosDesktopRuntime (.../dist/desktop/runtime/fedos_desktop_runtime.js:1212:9)
       at async #startAndBootstrap (.../dist/desktop/onboarding/fedos_profile_initialization_coordinator.js:415:23)
   ```

## Root cause

`FedosPrivateTransport.start()` calls `await this.#relaySet.connectAll();`
(never throws, per its own documented per-relay-failure-tolerant contract),
then unconditionally proceeds to construct a `FedosConversationInboundSubscription`
and call `subscription.start(...)`. That method's own loop
(`src/conversation/transport/relay/fedos_conversation_inbound_subscription.ts`)
called `await relay.subscribe([filter])` for EVERY relay in the set with no
connectivity check — and `WebSocketRelay.subscribe()` throws synchronously
when the relay was never actually connected (e.g. a genuinely unreachable
hostname like the test's own deliberate `"wss://relay.invalid.example"`).
One unreachable relay therefore threw out of the entire `start()` call,
crashing `FedosPrivateTransport`, and with it the whole
`startFedosDesktopRuntime()` call, and with THAT the entire profile
creation attempt.

This is a real, user-facing availability defect: a temporarily offline or
misconfigured relay is an ordinary real-world condition a real Desktop
Beta user WILL encounter, not a contrived edge case.

## Fix

Both `fedos_conversation_inbound_subscription.ts` (the original file,
Alpha 1471-1540) and `fedos_archive_suppression_inbound_subscription.ts`
(this session's own prior Arc, 7881-7960, which mirrored the same idiom
and inherited the same defect) now skip a relay whose `isConnected()`
reports `false` before calling `subscribe()` on it — mirroring
`connectAll()`'s/`disconnectAll()`'s own already-established "one relay's
failure never blocks another" resilience discipline. A relay that
connects successfully still gets its subscription opened normally; a
relay that never connects is simply excluded from `#open`, with no error,
no crash, no fabricated success.

## Regression proof

- Manual reproduction against the real compiled Electron subprocess,
  before the fix: `runtime-start-failed` / `recovery-required`.
- Same manual reproduction, after the fix (fresh `dist/` rebuild): `ok`,
  `runtimeReachable:true`, `directRatchetConfigured:true`,
  `peerCapabilityConfigured:true`, `identityTransitionConfigured:true`,
  `deletionRequestConfigured:true`, `productionCryptoStatusOutcome:"ok"`.
- Full Electron acceptance suite, serialized: 149/149 tests pass, zero
  failures beyond honest artifact-gated skips.
- `npx tsc --noEmit -p .`: clean except the 2 confirmed pre-existing,
  unrelated baseline errors.

## Three stale test assumptions also reconciled during this same pass

1. `secure_runtime_alpha_7321_7400_real_packaged_vertical_slice.test.ts`
   asserted Direct Conversation Archive export MUST fail
   (`outcome:"not-found"`) — a genuine, disclosed gap at Alpha 7321-7400's
   own time. Closed by Alpha 7801-7880/7881-7960; the real packaged
   Electron process now genuinely exports a Direct Conversation Archive
   (`outcome:"ok"`, `result.outcome:"exported"`, file confirmed written to
   disk). Test updated to assert the correct, current, passing behavior.
2. `secure_runtime_alpha_4101_4180_electron_host_adapter.test.ts` asserted
   the Safety Center overview response has a top-level `sections` field.
   The real, settled shape (Alpha 6201-6280+) nests it as
   `value.summary.sections`. Test updated to the real shape.
3. The same test's own secret-scan regex
   (`/seed|passphrase|privateKey|signature/`) flagged the word
   "signature" appearing in the Safety Center's own benign standing-warning
   prose ("a valid old-key signature is insufficient proof of continuity
   if the old key was compromised."). A digital signature is a PUBLIC
   verification artifact, never secret material — the word never
   indicated an actual leak. Narrowed to `seed`/`passphrase`/`privateKey`
   only, the three terms that would genuinely indicate a real secret leak.

## Confirmed FLAKE (not a defect)

Running the full Electron suite with default (parallel) test-file
concurrency produced between 4 and 11 failures per run, always in the
SAME small set of tests, always with symptoms consistent with resource
contention (e.g. `ERROR:net\disk_cache\cache_util_win.cc:25 Unable to move
the cache: Access is denied`, `Gpu Cache Creation failed: -2`) from many
real Electron subprocesses launching concurrently in this sandboxed
environment. Every one of those same tests passed reliably, repeatedly,
when re-run in isolation or with the whole suite serialized
(`--pool=forks --poolOptions.forks.singleFork=true`). Recommendation for
CI: run this specific Electron acceptance suite serialized, not with
default parallelism.
