# Secure Runtime Alpha 6521–6600 — Reconciliation Report

**FedOS Desktop Beta Production Runtime Configuration Unification Arc.**

## Alpha range coordination

Confirmed recent ranges (per this Arc's own mission): 6201–6280 (`fc48d64`),
6281–6360 (`33f29f2`), 6361–6440 (`76f7fab`), 6441–6520 (`ed5128f`).
Historical 5401–5480 collision remains on record (`be1bc0d9`/`b3b3a6d2`),
untouched. `git log --all --oneline | grep -E "6521|6601"` returns no
genuine Alpha-range commit under either prefix. **6521–6600 and 6601–6680
confirmed free.** This Arc claims **6521–6600**; the concurrently-active
Secure Memory Store Production Wiring Arc reserves 6601–6680 in its own,
separate worktree.

## Ancestry / merge base

Worktree `C:\wt\desktop-runtime-config-unification`, branch
`arc/desktop-production-runtime-configuration-unification`, created
directly from `76f7fab` (primary base). `git merge-base --is-ancestor
fc48d64c HEAD` confirms `fc48d64` is already an ancestor of `76f7fab` (via
that Arc's own earlier reconciliation merge `d23f350`, which itself
already contains the full Identity Replacement UI / Identity Transition /
Signed Deletion / Ratchet / Device Trust lineages this Arc's mission lists
as "relevant ancestors" to inspect). **No reconciliation merge is required
— `76f7fab` already contains every named lineage.** No overlapping-file
conflict exists because nothing is being merged.

## Canonical production entry-point inventory (Phase A items 3–10)

- **`startFedosDesktopRuntime()`** (`src/desktop/runtime/fedos_desktop_runtime.ts`)
  — the ONE production Runtime factory. Confirmed it already threads
  `conversationDeletionRequest` (added by `50f80e8`) straight through to
  `createFedosConversationRuntime()`, but has **no field at all** for
  `directRatchet`/`peerCapability`/`identityTransition` — `FedosDesktopRuntimeConfig`
  itself lacks these three fields (not merely "unused," genuinely absent
  from the type). This is the PRIMARY FINDING's exact root cause,
  confirmed at the type level, not just the call-site level.
- **`FedosProfileInitializationCoordinator`** (`src/desktop/onboarding/fedos_profile_initialization_coordinator.ts`)
  — the canonical profile bootstrap. Its own `#buildRuntimeConfig()`
  wires `deviceTrustEnabled`/`archiveEnabled`/`deviceSyncSchedulerEnabled`
  but has **zero private-transport wiring of any kind** (`grep` for
  `privateTransport`/`conversationTransport` in this file: no matches).
  Since all four missing integrations (`directRatchet`/`peerCapability`/
  `identityTransition`/`deletionRequest`) require `sendMailboxNip17Control`
  (a real Private Transport method), this is a SECOND, prerequisite gap:
  even after `FedosDesktopRuntimeConfig` grows the missing fields, the
  canonical Profile bootstrap could not populate them without first
  gaining private-transport wiring, which it also lacks entirely today.
- **`FedosDesktopBetaApplicationAssembly`** (`src/desktop/beta/fedos_desktop_beta_application_assembly.ts`,
  the "canonical Desktop Beta assembly") — its OWN header already
  discloses, from an earlier Arc: "no existing plumbing from the Settings
  descriptor's `relays`/`defaultRelay`/`archiveDirectory` field" to the
  real Runtime. This is a genuinely PRE-EXISTING, already-disclosed
  boundary (Relay/network endpoint configuration was never threaded from
  Settings into production bootstrap by any prior Arc) — restated here,
  not newly discovered, and explicitly out of THIS Arc's own bounded scope
  (see "Scope decision" below).
- **Search Index ownership** — `FedosDesktopConversationContentAccessor`
  constructs its own `FedosConversationSearchIndex` via
  `conversationRuntime.createSearchIndex()` (a FACTORY method, not a
  singleton accessor) at `fedos_desktop_conversation_content_accessor.ts:84`.
  `FedosConversationDeletionRequestIntegrationDependencies.searchIndex`
  requires a caller-supplied reference — if `startFedosDesktopRuntime()`
  were to naively call `createSearchIndex()` a SECOND time just for
  deletion-request wiring, it would produce a genuinely DIFFERENT search
  index instance than the one `shell.search()` actually queries, meaning
  a granted deletion request's own `reconcilePayloadRetention()` call
  would silently fail to purge the index a real search actually reads —
  a real, if narrow, correctness bug this reconciliation catches BEFORE
  writing any code (not found by trial and error).
- **Device Registry ownership** — `deviceRegistryPersistence`
  (`fedos_desktop_runtime.ts:779`) is constructed as a function-local
  `const` INSIDE the `if (config.deviceTrustEnabled)` block, which itself
  runs AFTER `conversationRuntimeInstance` is already constructed
  (`fedos_desktop_runtime.ts:692`). The three new integrations all
  require a `deviceRegistry: FedosDeviceRegistryPersistence` at
  Conversation-Runtime-construction time — a genuine construction-order
  conflict this reconciliation resolves by HOISTING the (already
  side-effect-free) `deviceRegistryPersistence` construction to before
  line 692, never by constructing a second, divergent instance.

## Conflict classification

| Item | Classification | Resolution |
|---|---|---|
| `FedosDesktopRuntimeConfig` missing 3 integration fields | mechanical additive | add 3 new optional fields + supporting sub-fields, mirroring `conversationDeletionRequest`'s own established shape exactly |
| `deviceRegistryPersistence` construction-order conflict | semantically compatible, resolved by hoisting | hoist declaration only; same single instance, same log path, same behavior — never a second Device Registry |
| Search index single-instance requirement | semantically compatible, resolved by injection | `FedosDesktopConversationContentAccessor` gains one optional, additive constructor field (defaults to its own existing `createSearchIndex()` call when omitted — zero behavior change for every existing caller) |
| `ProfileInitializationCoordinator` missing private-transport wiring | architecture conflict avoided by explicit scope boundary | see "Scope decision" below — not solved this Arc, honestly disclosed, not silently papered over |
| Canonical Desktop Beta assembly's Settings→Relay gap | pre-existing, already disclosed (prior Arc) | restated, not re-solved — genuinely out of this Arc's own bounded scope |

No architecture conflict was found for `FedosDesktopRuntime`, profile
lifecycle, Master Seed authority, Shell, canonical Electron main, Runtime
restart, or Safety Center — each already has exactly one owner, unchanged
by this Arc's own additive work.

## Scope decision (stated before any code was written)

Full closure of "every subsystem is default-enabled out of the box" would
require ALSO threading real Relay/network endpoint configuration from
Settings through the canonical Beta assembly into
`FedosProfileInitializationCoordinator` — a deeper, already-disclosed,
separate gap an EARLIER Arc explicitly named and left open (see
`fedos_desktop_beta_application_assembly.ts`'s own header). Inventing
Relay endpoints would be fabrication (no real network configuration
exists to invent); deferring the FULL Settings-to-Relay plumbing while
still closing the PRIMARY FINDING is the honest, bounded choice this Arc
makes: **`startFedosDesktopRuntime()` becomes genuinely capable of wiring
all four subsystems into one coherent production graph, and
`FedosProfileInitializationCoordinator` gains the SAME optional pass-through
config** (mirroring `archiveEnabled`'s own established pattern) — a real
caller who already has Relay URLs (any Electron main, any test, any future
Beta-assembly Arc that finishes the Settings plumbing) can enable every
subsystem today, through one call, sharing one Device Registry, one
signing identity, one Master Seed authority, one search index. The
remaining "wire real Settings.relays end-to-end automatically" work is
named explicitly as this Arc's own recommended next step.
