# Secure Runtime Alpha 7881–7960 — Phases H/I: Suppression Production Wiring Ownership Report

## Phase H — where `6a2f274` stops (confirmed by direct source inspection)

- `git grep -c ArchiveSuppression src/desktop/runtime/fedos_desktop_runtime.ts`
  on `6a2f274` returns `0` — the Desktop Runtime constructed no
  `FedosArchiveSuppressionObservationAuthority` of any kind.
- `FedosConversationArchiveRuntime`'s own `suppressionAuthority` field
  (threaded by `6a2f274` itself, per its own `fedos_conversation_archive_runtime.ts`
  diff) was always passed `undefined` in production — confirmed: no
  caller in `fedos_desktop_runtime.ts` ever set it.
- Deeper root cause, found by tracing one level further than `6a2f274`'s
  own disclosure: the entire `FedosDeviceRelaySyncPublisher`/inbound
  dispatch mechanism (Alpha 3641–3720) this domain's own Outbound
  Coordinator/Inbound Handler are BUILT ON has **zero** production
  construction anywhere in `fedos_desktop_runtime.ts`, for ANY consumer —
  confirmed by (a) zero import of either class before this Arc, (b) the
  file's own pre-existing comment on `deviceSyncAttemptFn`: "this runtime
  constructs no real Relay Sync attempt of its own," (c) no
  `deviceSync*Relay*` config field of any kind existed in
  `FedosDesktopRuntimeConfig`. This is a genuinely pre-existing, broader
  structural gap — not unique to suppression, and not something this
  Arc invents by pointing it out.

## Phase I — canonical construction (what this Arc built)

**Inventory of existing pieces reused, unmodified:**
`FedosArchiveSuppressionObservationAuthority` /
`AppendOnlyFedosArchiveSuppressionObservationPersistence` (Alpha
7721–7800), `FedosArchiveSuppressionOutboundCoordinator` /
`FedosArchiveSuppressionInboundHandler` /
`AppendOnlyFedosArchiveSuppressionInboundDedupPersistence` (Alpha
7721–7800), `FedosDeviceRelaySyncPublisher` (Alpha 3641–3720),
`FedosConversationRelaySet` (Alpha 1471–1540), `createAndRecordLocalArchiveSuppressionFact`
(Alpha 7721–7800), the existing `deviceRegistryPersistence` this Runtime
already hoists for four other subsystems.

**One new file**: `src/device/archive_suppression_sync/fedos_archive_suppression_inbound_subscription.ts`
— a small, domain-scoped inbound relay subscription (mirrors
`FedosConversationInboundSubscription`'s own established idiom exactly:
one `relay.subscribe()`/`onSubscriptionMessage()` pair per Relay, no new
Relay implementation, no reconnect logic). This was the one genuinely
missing piece: a real feed of live relay events into the already-built,
already-tested `FedosArchiveSuppressionInboundHandler`.

**Desktop Runtime wiring** (`fedos_desktop_runtime.ts`):
- `conversationArchiveSuppressionAuthority` — constructed **unconditionally
  whenever `config.archiveEnabled` is true** (no separate trigger flag: a
  real Archive restore needs a real, non-fabricated answer regardless of
  whether multi-Device sync is ever configured), over a real durable
  `AppendOnlyFedosArchiveSuppressionObservationPersistence` (or
  `InMemory...` if no log path supplied), threaded as the real
  `suppressionAuthority` into `assembleFedosConversationArchiveRuntime()`.
- When `config.archiveSuppressionSyncEnabled` is ALSO true (requires
  `deviceTrustEnabled` + `conversationTransportRelays` +
  `conversationTransportSigningAuthority`, validated synchronously,
  thrown otherwise): a real `FedosArchiveSuppressionOutboundCoordinator`
  (over the SAME `deviceRegistryPersistence`, a real
  `FedosDeviceRelaySyncPublisher` over a second, stateless
  `FedosConversationRelaySet` wrapping the SAME `FedosRelay[]` — never a
  second Device Registry, never a new transport), a real
  `FedosArchiveSuppressionInboundHandler`, and a real
  `FedosArchiveSuppressionInboundSubscription`, **started** (subscribed
  live) before `startFedosDesktopRuntime()` ever returns.
- Two new public accessors on the Runtime handle:
  `archiveSuppressionAuthority()` (the real, always-live authority
  `conversationArchiveRuntime()`'s own restore path already consults
  automatically) and `recordAndPropagateArchiveSuppression()` (the real
  production entry point a caller composes AFTER a local
  Retention/Deletion decision has already executed — mirrors
  `fedos_archive_suppression_local_bridge.ts`'s own "caller composes,
  after the fact" discipline; records synchronously and durably, then
  fans out in the background, never awaited, matching "Local Deletion
  NEVER waits for this coordinator").
- `stop()` now also stops the Inbound Subscription (unsubscribes;
  deliberately leaves the underlying `FedosRelay` CONNECTIONS themselves
  untouched, since they may be shared with `privateTransportInstance`
  which owns their disconnect lifecycle).

**No new suppression model, no second Device Registry, no second Sync
stack, no new transport protocol, no new NIP, no new crypto** — every
constructor call above passes an ALREADY-EXISTING class its own
already-established dependency shape.

## Real proof

`test/secure_runtime_alpha_7881_7960_suppression_production_wiring_real_vertical_slice.test.ts`
— two real `startFedosDesktopRuntime()` instances, a real local RFC 6455
WebSocket relay, real BIP-340 signing, real durable per-Device Registry
files: Device A's `recordAndPropagateArchiveSuppression()` call converges
Device B's own real, independently-constructed `archiveSuppressionAuthority()`
to `"suppressed"` over a REAL relay round-trip, and the fact survives a
real Device B restart (fresh `startFedosDesktopRuntime()` over the same
durable log). **1/1 passing.**

`test/secure_runtime_alpha_7881_7960_suppression_production_wiring_failure_matrix.test.ts`
— 10 scenarios: missing prerequisite config (4 variants, each a
synchronous throw), `archiveEnabled: false`, missing
`localAccountRef`/`localDeviceId`, stopped Runtime, revoked Device
excluded from fan-out, single-Device profile (no fan-out target, local
suppression still correct), and same-instance threading into the real
Archive Runtime. **10/10 passing.**

## Honest residual scope

- The underlying Device Relay Sync transport gap this Arc found (no
  generic Device Sync relay wiring existed at all before this Arc, for
  ANY consumer) is closed **only for the suppression route** — Ratchet/
  Peer Capability/Identity Transition/Deletion Request still use the
  SEPARATE `sendMailboxNip17Control` NIP-17 control-payload channel
  (unaffected, unmodified by this Arc) or remain limited to whatever a
  caller supplies via `deviceSyncAttemptFn`. Generalizing the new
  `FedosArchiveSuppressionInboundSubscription` idiom into a shared,
  multi-route Device Sync inbound dispatcher is out of this Arc's own
  named scope (a real, disclosed, narrower boundary — not a mock, not a
  silent gap).
- The real packaged Electron app itself has no Settings screen (per the
  Electron E2E review) to actually TOGGLE `archiveSuppressionSyncEnabled`
  from the UI yet — the production Runtime construction is real and
  correct; end-user reachability through the packaged UI is a separate,
  already-disclosed, pre-existing gap this Arc does not claim to close.
