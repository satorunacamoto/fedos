# FedOS — Adding a Capability

Status: written this arc (Architecture Dependency Closure + Ports/Factories
Completion + OSS Catalog Completion). Pure software architecture, no
legal/compliance content. Practical, README-level guidance for adding a
NEW capability (a peer of `os/core`/`os/messenger`/`os/commerce`) — not for
adding a feature INSIDE an existing capability (for that, follow the
existing capability's own sub-bucket conventions, e.g.
`os/messenger/conversations/`'s many `Coordinator`/`Authority` files).

Read first: `docs/architecture/OS-CAPABILITY-BOUNDARIES.md`,
`docs/architecture/CAPABILITY-MAP.md`, `docs/architecture/CAPABILITY-CATALOG.md`.

## Where code goes

```
src/os/<new-capability>/
  README.md              <- status (real vs. scaffolding), scope, what it owns
  index.ts                <- public API barrel (see "Public API" below)
  <sub-bucket>/            <- one directory per cohesive sub-concern
    ...
```

Do NOT add a new top-level directory under `src/` (e.g. `src/widget/`) —
every live and reserved capability lives under `src/os/`. The only
exceptions are `src/os/_legacy_prototype/` (dead code, never add to it) and
the handful of still-unmigrated top-level directories (`src/sync/`,
`src/notification/`, `src/runtime/` minus `master_seed/`) that predate this
arc's capability boundary and are not a pattern to repeat.

## Which Port to implement (or add)

1. **Check `src/os/core/ports/*.ts` first.** If your capability needs to
   send/receive a message, create/query a conversation, or surface a
   notification, it should consume one of the FOUR existing Ports
   (`MessagingPort`, `ConversationPort`, `NotificationPort`,
   `SealingAuthorityPort`) rather than reaching into `os/messenger`
   directly. See `docs/architecture/ADDING-AN-ADAPTER.md` if you need to
   IMPLEMENT one of these Ports for a new backend.
2. **If no existing Port fits**, and your capability is meant to be
   genuinely swappable (a real second implementation is plausible, not
   hypothetical), add a new Port to `src/os/core/ports/`:
   - Interface-only file. Must never import from `src/conversation`,
     `src/os/messenger`, `src/commerce`/`src/os/commerce`, or any other
     domain-specific module (every existing Port's own header states this
     — copy the discipline).
   - Prefer several narrow interfaces (interface segregation) over one
     "God" interface — see `messaging_port.ts`'s own
     `MessageSendPort`/`MessageHistoryPort`/`MessageInboundPort` split
     (added this pass) for the pattern: narrow interfaces, composed back
     into one aggregate name for a consumer that wants the whole surface.
   - Every method should be `Promise`-returning (or synchronous and
     total) and NEVER throw for an expected failure — return a
     discriminated-union result instead (see `SendResult`,
     `MessageReadResult`, `MembershipMutationResult` for the pattern).
     Stringly-typed `reason: string` is a code smell here; prefer a
     closed vocabulary mirroring a REAL implementation's own outcome set
     (measure it, don't guess — see `messaging_port.ts`'s own header for
     how `MessageSendFailureReason` was derived from
     `FedosConversationDirectMessagingCoordinator`'s real switch
     statement).
3. **If your capability owns durable state**, decide up front whether that
   state is genuinely portable (worth a `StorageBackend`-shaped seam) or
   capability-internal (hand-roll your own append-only persistence, the
   established pattern across `os/messenger/conversations/**`). Do NOT
   default to `os/core/storage/` — it is an explicitly reserved,
   unimplemented placeholder (see `CORE-SECRETS-OWNERSHIP-PLAN.md`), not a
   ready-made persistence layer.

## The factory

Add `src/os/<new-capability>/create_<new-capability>.ts`, following
`createMessenger()`/`createCommerce()`'s own shape:

```ts
export interface <Capability>Dependencies {
  readonly somePort?: SomePort; // OPTIONAL — safe Noop default when omitted
}

export interface <Capability> {
  readonly somePort: SomePort;  // ALWAYS present on the returned object
}

export function create<Capability>(deps: <Capability>Dependencies = {}): <Capability> {
  return {
    somePort: deps.somePort ?? new NoopSomePort(),
  };
}
```

**SAFE DEFAULTS ONLY** — this is not optional. Every dependency a caller
omits must resolve to a `Noop*`/empty implementation that performs zero
real I/O, contacts zero external service, and never throws. Calling your
factory with no arguments at all must always be safe. See
`src/os/messenger/adapters/noop_messenger_ports.ts` for the pattern.

## Test requirements

At minimum, add:
1. A **boundary test** (`test/architecture_boundary_<capability>.test.ts`),
   mirroring `test/architecture_boundary_commerce.test.ts`'s structure —
   walk every `.ts` file under your capability and fail if any relative
   import resolves into a forbidden sibling capability. Decide your
   capability's own forbidden list from `CAPABILITY-MAP.md`'s dependency
   diagram BEFORE writing code, not after.
2. A **factory composition test**, mirroring
   `test/architecture_factory_composition.test.ts` — your factory
   constructs successfully with zero arguments, every method on the
   default-constructed result is callable without throwing, and explicit
   real dependencies are honored when supplied.
3. If you added a new Port, a **Port-shape test**, mirroring
   `test/architecture_boundary_adapter_port_shapes.test.ts` or
   `test/architecture_boundary_payment_provider_shape.test.ts` — a
   hand-built minimal double checked for type-level assignability, plus
   runtime behavior checks against any real implementation(s).
4. Run `npx vitest run test/architecture_cycle_detector.test.ts` after
   adding your barrel/factory — a new cycle fails this test immediately.

## Boundary rules (the ones every capability must satisfy)

- `os/core` -> `os/messenger` / `os/commerce`: **forbidden**, always.
- `os/messenger` -> `os/commerce`: **forbidden**.
- `os/commerce` -> `os/messenger` (concrete): **forbidden** — only via a
  Port (`os/core/ports/*`), and today no real commerce code even does
  that (see `create_commerce.ts`'s own header).
- Your new capability -> anything above it in
  `docs/architecture/CAPABILITY-MAP.md`'s own dependency diagram:
  **forbidden**. Decide your capability's LAYER before writing the first
  file.
- No capability may import a third-party Nostr SDK or `"electron"`
  directly (`test/architecture_dependency_rules_electron_nostrsdk_protocol.test.ts`,
  added this pass) — Electron-concrete code belongs in
  `packages/fedos-desktop-electron-spike/`, outside `src/` entirely.

## Packaging implications

Adding a capability under `src/os/` does NOT automatically make it
reachable from the shipped Electron app. Check
`packages/fedos-desktop-electron-spike/`'s own tsconfigs
(`tsconfig.runtime.json`, `tsconfig.beta-runtime.json`,
`tsconfig.host-bridge.json`, `tsconfig.settings-host-bridge.json`,
`tsconfig.unlock-runtime.json`) — a capability not referenced from one of
these entry graphs ships as dead code, exactly like most of
`os/commerce` today. If your capability is meant to actually run in the
packaged app, its composition root (today `src/desktop/runtime/` /
`os/messenger/desktop/runtime/`) needs to construct and wire it — a real,
tested factory that nothing calls is still "inert scaffolding" per this
repo's own honesty discipline (see every `os/commerce` file's own "STATUS:
inert scaffolding" header for the convention to follow).
