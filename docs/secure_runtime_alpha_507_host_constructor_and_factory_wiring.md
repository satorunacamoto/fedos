# Secure Runtime Alpha 507 — Host Constructor and Factory Wiring

Stage 7 of the Alpha 501–520 Durable Delivery Observation Wiring & Host
Delivery Lifecycle Arc.

**Status: this Stage IMPLEMENTS.** Edits exactly two existing files —
`src/desktop/host/fedos_desktop_host.ts` and
`src/desktop/host/create_fedos_desktop_host.ts` — additively.

## 1. `fedos_desktop_host.ts` — verified 100% additive

`git diff -- src/desktop/host/fedos_desktop_host.ts | grep '^-' | grep -v '^---'`
is EMPTY — this Stage's own diff contains zero deleted or modified
lines in this file, only new ones: three new imports, three new
constructor-dependency fields (each OPTIONAL, each defaulted inside the
constructor per Alpha 502/503), three new private fields, three new
constructor-assignment lines, and one new exported type
(`FedosHostDeliveryStatus`). Every EXISTING field, line, and method
body — `start()`, `stop()`, `desktop()`, `board()`, `query()`,
`submitPost()`, `submitPostWithOutbox()` — is byte-for-byte unchanged.

## 2. `create_fedos_desktop_host.ts` — one necessary, behavior-preserving touch

The single `return new FedosDesktopHost({...})` line is reformatted to
pass the three new fields through. This is the ONE line this Stage
cannot avoid touching, since adding new object-literal keys requires
editing that literal's own source text — but the four PRE-EXISTING keys
(`desktopApplication`, `boardPersistence`, `outboxPersistence`, and
their values) are carried over IDENTICALLY; for any caller that omits
`publisher`/`observationRepository`/`deliveryIntervalMs` (i.e. every
call site that exists today), the resulting `FedosDesktopHost` instance
is behaviorally indistinguishable from before this Stage — the three
new keys resolve to `undefined`, and `FedosDesktopHost`'s own
constructor (§1) applies the SAME defaults it always would.

## 3. `DEFAULT_DELIVERY_INTERVAL_MS = 30_000`

A plain, named module constant (30 seconds) — not a magic number
inlined at the call site, not configurable via environment or global
state, overridable per-instance via `deliveryIntervalMs`.

## 4. See also

- `docs/secure_runtime_alpha_502_host_dependency_extension_decision.md`
- `docs/secure_runtime_alpha_503_default_publisher_and_observation_repository_decision.md`
- `docs/secure_runtime_alpha_419_host_submit_outbox_coordination.md`
