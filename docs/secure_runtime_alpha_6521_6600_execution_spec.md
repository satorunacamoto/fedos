# Secure Runtime Alpha 6521–6600 — Execution Specification

**FedOS Desktop Beta Production Runtime Configuration Unification Arc.**

## Phase B/C — canonical configuration type

`FedosDesktopRuntimeConfig` (`fedos_desktop_runtime_config.ts`) gains four
new, closed, additive subsystem toggles — `directRatchetEnabled`,
`peerCapabilityEnabled`, `identityTransitionEnabled`,
`deletionRequestEnabled` — each an OPTIONAL boolean, each with:

- a small set of supporting OPTIONAL fields (durable log paths, the
  locally-supported-capabilities list, the local recipient/verification
  policy) — never a loose dictionary, every field individually typed;
- an OPTIONAL full manual-override object (`conversationDirectRatchet`,
  `conversationPeerCapability`, `conversationIdentityTransition`,
  mirroring the pre-existing `conversationDeletionRequest`) for
  advanced/test callers who supply every dependency by hand.

Validated synchronously, before any Persistence backend is constructed
(mirroring every pre-existing guard in this file exactly):

- each `*Enabled` flag REQUIRES `deviceTrustEnabled` AND
  `privateTransportEnabled` — thrown, never a silent no-op;
- `peerCapabilityEnabled` REQUIRES `peerCapabilityLocallySupportedCapabilities`
  (unless the manual override is supplied) — never a fabricated capability
  list;
- `deletionRequestEnabled` REQUIRES `deletionRequestResolveLocalPolicy`
  (unless overridden) — never a default recipient policy.

## Phase D — profile bootstrap threading

`FedosProfileInitializationCoordinator` (`fedos_profile_initialization_coordinator.ts`)
gains the SAME four toggles plus `privateTransportEnabled`/
`conversationTransportRelays` (a genuine, real external fact — no
fabricated default Relay), threaded straight into `#buildRuntimeConfig()`.
`conversationTransportSigningAuthority` reuses `accountSigningAuthority`
verbatim — the SAME real account identity, never a second, incoherent
signing authority for the transport layer.

## Phase E — one Conversation Runtime generation

Inside `startFedosDesktopRuntime()`, all four new subsystems' dependency
bundles are constructed BEFORE `createFedosConversationRuntime()` is
called, and passed as its own `directRatchet`/`peerCapability`/
`identityTransition`/`deletionRequest` fields — the SAME single
`FedosConversationRuntime` instance now owns (or reaches) Direct
Messaging, Direct Ratchet, Peer Capability, Identity Transition, Signed
Deletion Request, Retention, and Search, exactly as Phase E's own mission
requires. No second Conversation Runtime instance is ever constructed.

**Real bug found and fixed during this Arc's own implementation** (before
any test ran): the pre-existing `deviceTrustEnabled` block
(`fedos_desktop_runtime.ts`, constructing `FedosDeviceTrustRuntime`/
`FedosDevicePairingFacade`/`FedosDeviceSyncScheduler`) constructed its OWN
local `deviceRegistryPersistence`. This Arc's own four new subsystems ALSO
need a Device Registry, constructed EARLIER (before
`createFedosConversationRuntime()`, which runs before that block). Simply
hoisting a NEW construction would have created a second, divergent Device
Registry instance over the same log path. Fixed by hoisting the
CONSTRUCTION itself (not duplicating it) — the pre-existing block now
references the SAME hoisted instance, never redeclaring its own.

## Phase E (continued) — the search-index single-instance requirement

A second real, pre-existing finding of this Arc's own Phase A: Signed
Deletion Request's own `searchIndex` dependency must be the SAME instance
`FedosDesktopConversationContentAccessor.search()` queries — otherwise a
granted deletion's own `reconcilePayloadRetention()` reconciliation would
silently apply to a search index nobody ever reads. Closed by:

1. A forward-reference proxy (mirrors the pre-existing
   `directMessageDelivery`/`privateTransportInstance` pattern exactly),
   constructed before `conversationRuntimeInstance` exists, resolved
   immediately after it does.
2. One small, additive constructor field on
   `FedosDesktopConversationContentAccessor` (`searchIndex?`), defaulting
   to its own pre-existing `createSearchIndex()` call when omitted — every
   existing caller's behavior is unchanged byte-for-byte.

## Phase F/G/H — Device / Identity Transition / Signed Deletion configuration

All three now share: one Device Registry (Phase F, see above), one
signing authority (`conversationTransportSigningAuthority`, reused
verbatim across all four subsystems), one control-payload transport route
(`sendMailboxNip17Control`, a single forward-referenced closure shared by
all four). No second Device Registry, no second Sync Journal, no second
signing identity, no second transport route.

## Phase I — Safety Center

Unchanged this Arc — `FedosSafetyCenterController` already reads through
`FedosDesktopApplicationShell`'s own already-real accessors
(`directRatchetStatus()`, `peerCapabilityListObserved()`,
`identityTransitionList()`, `deletionRequestListReceived()`, all added by
the prior two Arcs). Since those Shell methods delegate to
`this.#runtime.conversationRuntime().X()`, and `conversationRuntimeInstance`
is now genuinely wired when the new config is enabled, Safety Center
automatically reads the SAME real instances — no Safety Center code change
was needed to close this Arc's own mission item.

## Phase J/K/L/M — Settings, Restart, Electron

Deliberately NOT deepened this Arc — see the reconciliation report's own
"Scope decision." Settings→Relay plumbing and the full 10-step Runtime
generation/rebuild model remain the SAME pre-existing, disclosed
boundaries an earlier Arc named. This Arc's own real vertical slice proves
a genuine lock→relaunch→unlock cycle (a real, if simpler, restart) rather
than the full 10-step model.

## Phase N/O/P

See the real production vertical slice test, the failure matrix test, and
the structural guards test themselves.
