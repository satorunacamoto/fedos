# Secure Runtime Alpha 6521–6600 — Production Configuration Schema and Ownership Document

**FedOS Desktop Beta Production Runtime Configuration Unification Arc.**

## The one canonical configuration boundary

`FedosDesktopRuntimeConfig` (`src/desktop/runtime/fedos_desktop_runtime_config.ts`)
remains the ONE configuration type `startFedosDesktopRuntime()` accepts —
this Arc extends it, never forks or duplicates it. Every field is
individually typed; there is no loose dictionary, no arbitrary
`Record<string, unknown>` escape hatch anywhere in this type.

## Per-subsystem ownership after this Arc

| Subsystem | Owner | Shared resource |
|---|---|---|
| Device Registry | `FedosDeviceTrustRuntime` (pre-existing) | ONE `deviceRegistryPersistence` instance, hoisted, shared with Direct Ratchet/Peer Capability/Identity Transition/Signed Deletion Request |
| Signing identity | `config.conversationTransportSigningAuthority` | Reused verbatim by Private Transport, Peer Capability, Identity Transition, Signed Deletion Request — never a second signing authority |
| Search Index | `FedosConversationSearchIndex` (via `conversationRuntimeInstance.createSearchIndex()`) | ONE instance, constructed once, shared by `FedosDesktopConversationContentAccessor.search()` and Signed Deletion Request's own `reconcilePayloadRetention()` |
| Control-payload transport route | `sendMailboxNip17Control` closure | ONE forward-referenced closure, shared by all four new subsystems |
| Conversation Runtime | `FedosConversationRuntime` (pre-existing, unmodified class) | ONE instance per running Runtime generation — Direct Ratchet/Peer Capability/Identity Transition/Signed Deletion Request are all optional integrations INTO this same instance, never a second Conversation Runtime |
| Master Seed Authority | `productionCryptoGraph.masterSeedAuthority` | Reused by Direct Ratchet's own `sealingAuthority`/`masterSeedAuthority` fields — never a second Master Seed instance, and never the development double in this role |

## Closed states per subsystem

Every new `*Enabled` toggle resolves to exactly one of:

- **required** — the flag is `true` and every REQUIRED supporting field
  (validated synchronously) is present; construction proceeds.
- **explicitly disabled** — the flag is omitted or `false`; the subsystem's
  own accessor (`directRatchet()`, `peerCapability()`, etc.) returns `null`,
  byte-for-byte the same as before this Arc.
- **invalid** — the flag is `true` but a REQUIRED supporting field is
  missing; `startFedosDesktopRuntime()` throws synchronously, before any
  Persistence backend or Host is constructed.
- **unavailable (environment fact, not misconfiguration)** — specific to
  Direct Ratchet only: the flag is `true`, every REQUIRED field is present,
  but `productionCryptoGraph` never resolved (e.g. the compiled WASM
  artifact is absent) — the subsystem's own accessor still honestly
  returns `null`, never a fabricated Master Seed Authority or sealing
  authority.

No subsystem is ever represented as "active" while genuinely incomplete —
matching Phase C's own explicit requirement.

## What is NOT a second source of truth

The four new manual-override fields (`conversationDirectRatchet`,
`conversationPeerCapability`, `conversationIdentityTransition`, and the
pre-existing `conversationDeletionRequest`) are not a parallel
configuration system — they are the SAME
`FedosConversationXIntegrationDependencies` types
`FedosConversationRuntimeDependencies` already defines, reused verbatim.
This file adds no new field to those types, no duplicated shape.

## Secrets

No field on `FedosDesktopRuntimeConfig` accepts a raw private key, a
passphrase, a Master Seed, or a `SecretHandle` value — the new fields
added by this Arc are exclusively: booleans, string log paths, a
capability-entry list, a local policy object, and OBJECT dependency
references (a signing authority, a Relay list) — the same discipline this
file's own header has enforced since Alpha 603.
