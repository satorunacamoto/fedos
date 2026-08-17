# The Second-Device Gap — Own-Device Sync has zero real transport wiring in production

**This is the central finding of this arc.** A prior arc this session (solo pass) classified
Own-Device Sync as "substantially real — encrypted sync package w/ content-hash binding,
scheduler, conflict handling, real device-replacement coordinator" but explicitly could not
determine at solo-pass depth whether the actual transport path is live. It is not.

## The proof chain, source-verified end to end

1. `FedosDeviceSyncScheduler` (`src/os/messenger/device/sync_scheduler/fedos_device_sync_scheduler.ts`)
   depends on a narrow `FedosDeviceSyncAttemptFn` injected by its caller — it never
   constructs or imports a real transport itself (deliberate design, per its own header:
   "It must not own ... Relay identity truth").
2. `fedos_desktop_runtime.ts:1655`: `attemptFn: config.deviceSyncAttemptFn ?? (async () => ({ outcome: "failed" }))`
   — if the config doesn't supply a real function, every attempt fails, forever, by
   construction.
3. `FedosDeviceSyncEventBridge.wrapAttemptFn(real?: FedosDeviceSyncAttemptFn)` — same
   contract, restated: `const inner = real ?? FAIL_CLOSED_ATTEMPT_FN`.
4. **The real, shipped Electron main entry point**
   (`packages/fedos-desktop-electron-spike/src/fedos_electron_beta_main.cts:5104-5106`):
   ```
   deviceSyncSchedulerEnabled: true,
   deviceSyncAttemptFn: eventBridge.wrapAttemptFn(),
   ```
   `wrapAttemptFn()` is called with **zero arguments**. `real` is `undefined`. The fail-closed
   stub is what actually runs.
5. `FedosDeviceRelaySyncOutboundCoordinator` (`src/os/messenger/device/relay_sync/fedos_device_relay_sync_outbound_coordinator.ts`)
   — the REAL relay-based transport that a working `attemptFn` would need to drive — is
   confirmed via `grep -rln` across `src/` and `packages/` to be referenced ONLY inside its
   own file and one doc-comment cross-reference. It is never constructed, never imported,
   anywhere in production composition-root code.

## What this means concretely

The Own-Device Sync scheduler is **enabled by default** in the shipped Beta binary. It runs
on schedule. Every single attempt returns `{outcome: "failed"}` unconditionally, forever. A
user who pairs a second device today, per this arc's own investigation, gets a real,
cryptographically-authenticated device *pairing* (layer 2, above) — but the device-registry
*sync* that should follow it (layer 3) can never succeed, by construction, in the current
shipped product.

## Is this at least honestly surfaced?

Spot-checked `FedosDesktopDeviceSyncStatusViewModel` — it's a thin, honest wrapper around
`Shell.deviceSyncStatus()` with no fabrication (mirrors the established "action → refresh,
never claims more than the Shell reported" pattern this codebase uses everywhere). The
Scheduler's own real per-tick outcome (`"failed"`) should genuinely propagate to this status
view. Not independently re-verified end-to-end on the installed binary this pass (time
budget) — flagged as the one thing worth confirming before treating this as "fails honestly,
just doesn't work" rather than "fails invisibly."

## Coordinator recommendation (see `07_COORDINATOR_DECISION.md`)

**DEFER, do not wire live this pass.** `FedosDeviceRelaySyncOutboundCoordinator` exists and
is presumably unit-tested in isolation, but it has NEVER been exercised end-to-end against
the real Relay/Device Registry composition in a live, default-enabled scheduler — wiring it
now, solo, under this arc's own remaining time budget, would be exactly the kind of
high-ambiguity, high-blast-radius change the mandate's own §36 says not to force into a solo
implementation pass. This needs its own dedicated arc: wire the real coordinator, add a real
two-device installed proof (mandate §42's own scenario), and only then reclassify Own-Device
Sync as COMPLETE rather than PROTOCOL_GAP-adjacent (more precisely: architecture and local
primitives COMPLETE, end-to-end transport NEVER WIRED — a distinct, narrower gap than a
protocol design gap).
