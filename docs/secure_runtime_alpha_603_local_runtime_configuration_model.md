# Secure Runtime Alpha 603 — Local Runtime Configuration Model

Stage 3 of the Alpha 601–620 Desktop Local Runtime Entry Point &
Publish Pipeline Ownership Arc.

## Adopted shape

```ts
export interface FedosDesktopRuntimeConfig {
  readonly boardLogPath: string;
  readonly outboxLogPath: string;
  /** Required only when deliveryEnabled is true (Alpha 609/611). */
  readonly observationLogPath?: string;
  readonly deliveryEnabled: boolean;
  readonly deliveryIntervalMs?: number;
  /** Required only when deliveryEnabled is true (Alpha 610). */
  readonly publisher?: FedosBoardOutboxPublisher;
}
```

Adjusted from the candidate this Stage's own instruction named in two
ways, both forced by real source constraints found in Alpha 601/609/610:

1. `observationLogPath` is OPTIONAL, not required — `deliveryEnabled:
   false` needs no Observation backend at all (nothing ever writes to
   it), and requiring an unused path would violate this Arc's own
   "no hidden requirement beyond what is used" discipline.
2. `publisher?: FedosBoardOutboxPublisher` is added — an OBJECT
   dependency, never a primitive config value, matching this
   repository's own established injection discipline (every
   Publisher/Signing/Relay concern is caller-constructed and injected,
   never assembled from strings). See Alpha 610 for why this Arc
   constructs no Publisher of its own.

## Prohibited fields — confirmed absent, by construction

No `secretSeed`/`privateKey`/`token`/`relayUrl`/`env` field exists
anywhere in this type. `desktopApplication` is NOT part of this
config — a caller needing a non-default `DesktopApplication` (a real
signing/identity setup) constructs one themselves and does not go
through this runtime's own config surface at all (this Arc's own
runtime always uses the default, `Null`-identity-sourced
`createDesktopApplication()`, matching Alpha 610's own "no crypto
touched here" decision). No `process.env` is read anywhere in this
config's own type or the assembly function that consumes it
(structurally guarded, Alpha 616/617).

## `deliveryIntervalMs`

Optional — when omitted, `FedosDesktopHost`'s own existing default
(`DEFAULT_DELIVERY_INTERVAL_MS`, unchanged) applies, via the SAME
pass-through this Arc already relies on elsewhere (never duplicated
here).

## See also

- `docs/secure_runtime_alpha_604_filesystem_path_authority.md`
- `docs/secure_runtime_alpha_609_delivery_observation_persistence_decision.md`
- `docs/secure_runtime_alpha_610_publisher_registry_wiring.md`
