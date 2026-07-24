# Secure Runtime Alpha 6921–7000 — Packaged Ratchet Acceptance Report

**FedOS Direct Ratchet Cryptographic Session Production Capability Arc,
Phase J.**

## What was investigated

Whether a real, packaged-process, crypto-operational (not merely
"configured") proof of `FedosDirectRatchetCryptographicSession` could be
added through `fedos_electron_beta_main.cts`'s existing AUTOTEST
diagnostic (`unifiedGraphDiagnostics()`,
`directRatchetConfigured: cr.directRatchet() !== null`), which the
post-implementation audit itself flagged as proving only "configured", not
"crypto-operational".

## Finding: not safely constructible within this Arc's own prohibitions

`cr.directRatchet()` returns the `FedosDirectRatchetConversationRuntime`
INSTANCE (`src/conversation/ratchet/fedos_direct_ratchet_conversation_runtime.ts`,
line ~1442), not the raw dependency bag. The `masterSeedAuthority` this
instance was constructed with (`#deps.masterSeedAuthority`) is a PRIVATE
field with no public accessor — confirmed by direct inspection; no
`get masterSeedAuthority` or equivalent exists anywhere on that class.

A packaged, IPC-observable session-establishment probe therefore has
exactly two possible routes, both rejected:

1. **Add a new public accessor exposing the raw production
   `masterSeedAuthority`** from `FedosDirectRatchetConversationRuntime` or
   the Shell, so an AUTOTEST diagnostic could call
   `FedosDirectRatchetCryptographicSession.createAsReceiver()` directly.
   Rejected: this Arc's mission explicitly prohibits exposing a raw Master
   Seed handle, and widening a production class's public surface for a
   diagnostic-only purpose is exactly the kind of surface growth "one
   narrow remediation Arc" exists to avoid.

2. **Drive the ALREADY-PUBLIC `initializeDirectRatchetSession()`** (the
   real production entry point, reachable today only via
   `FedosDesktopApplicationShell.identityTransitionAuthorizeRatchetReset()`,
   which requires an ALREADY-`"accepted"` Identity Transition record) for
   a genuine two-party exchange. This requires real counterparty
   resolution through the Device Registry and a real, reachable NIP-17
   relay/mailbox — full integration scaffolding no prior Arc in this
   repository's history has ever built for a packaged test (confirmed:
   see below), and building it now would itself be a new, much larger
   Arc, not a narrow remediation of the one audited bug.

## Precedent: no prior Arc has ever proven this at the packaged level either

`packages/fedos-desktop-electron-spike/test/secure_runtime_alpha_6761_6840_settings_relay_reachability.test.ts`
— the only existing test in this repository that spawns the real
`fedos_electron_beta_main.cts` subprocess and inspects
`directRatchetConfigured` — asserts only the boolean, never a message
round trip; it has no second peer, no `encrypt`/`decrypt` call anywhere in
the file. The immediately-prior Arc's own completion declaration
(`docs/secure_runtime_alpha_6841_6920_completion_declaration.md`, "Remaining
blockers") independently disclosed the identical gap: "A full live
two-party Direct Ratchet message exchange over a genuinely reachable relay
was not constructed as a new test this session... live network delivery
through an actually-reachable relay was not separately exercised." This
Arc's own scope boundary is therefore consistent with, not a regression
from, the established precedent.

## What this Arc verified instead (in scope, safe, real)

1. `fedos_electron_beta_main.cts` is left byte-for-byte UNCHANGED by this
   Arc (no diff against `4c1f27c`) — the packaged entry point's own
   plumbing into the Conversation Runtime graph is provably unaffected;
   only the crypto-graph layer beneath it changed.
2. Rebuilt `dist/` (`npm run build:beta-runtime && npm run
   build:electron-spike`) and re-ran the existing packaged reachability
   test. Result: 5 real-process tests SKIP in this environment (the
   Electron binary is not present in this worktree's `node_modules` — a
   pre-existing environment limitation, unrelated to this Arc's own
   source changes; the WASM artifact and manifest ARE present). The test
   file's own skip logic correctly declines to fabricate a pass rather
   than run against a missing binary.
3. The DEFINITIVE cryptographic proof this Arc provides is therefore the
   real, no-mock, real-WASM Node-level vertical slice (Phase I,
   `test/secure_runtime_alpha_6921_7000_production_session_vertical_slice.test.ts`),
   which exercises the EXACT SAME classes
   (`FedosProductionMasterSeedAuthority`,
   `FedosDirectRatchetCryptographicSession`) the packaged process
   constructs internally, through the SAME
   `activateFedosProductionProfileMasterSeed()` entry point the packaged
   Coordinator also calls — architecturally identical code paths, not an
   approximation of them.

## Disclosed, not fabricated

The gap between "IPC-observable configured" and "IPC-observable
crypto-operational" is real and remains open at the packaged-diagnostic
layer specifically. Closing it would require either a deliberate,
separately-reviewed new IPC-safe capability (a Master-Seed-handle-adjacent
surface decision this narrow Arc should not make unilaterally) or a full
counterparty/device-registry/NIP-17 integration slice (a materially larger
Arc). This report exists so that gap is explicit, not silently implied
closed by an unchanged "configured" boolean.
