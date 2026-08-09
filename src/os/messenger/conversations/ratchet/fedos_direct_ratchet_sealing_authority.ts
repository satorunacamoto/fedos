/**
 * Secure Runtime Alpha 5401-5480 (FedOS Direct Ratchet State and Sealed
 * Persistence Foundation Arc) — the narrow, additive sealing-authority
 * port this Arc's own persistence layer depends on. Deliberately NOT
 * added to the shared `FedosMasterSeedAuthority` interface
 * (`../../runtime/master_seed/fedos_master_seed_authority.ts`) — that
 * interface is implemented by several unrelated authorities
 * (`DevelopmentFedosMasterSeedAuthority`, `FedosProductionMasterSeedAuthority`)
 * that have no reason to know about ratchet sealing, and widening it
 * would force every implementer and every existing test fixture to grow
 * two new methods for a concern they don't own. `FedosWasmMasterSeedAuthority`
 * (`../../../core/vault/wasm/fedos_wasm_master_seed_authority.ts`)
 * implements this port ADDITIONALLY, alongside its unchanged
 * `FedosMasterSeedAuthority` implementation.
 *
 * Consumers (this Arc's own Runtime facade and sealed-secret port) take
 * `FedosDirectRatchetSealingAuthority | null` — `null` when no real
 * sealing authority is wired up (e.g. `DevelopmentFedosMasterSeedAuthority`),
 * matching this Arc's own "unavailable" lifecycle state rather than a
 * thrown error.
 *
 * Architecture Dependency Closure Arc — this type is now a plain alias of
 * `SealingAuthorityPort` (`src/os/core/ports/sealing_authority_port.ts`).
 * Core PROVIDES this capability (the real secrets authority implements
 * it); Messenger only ever CONSUMES it — so the contract now lives in
 * `os/core/ports/`, the direction Ports-and-Adapters expects, and this
 * file re-exports the SAME shape under its original name so every
 * pre-existing import of `FedosDirectRatchetSealingAuthority` from this
 * path keeps resolving to an identical structural type, unchanged.
 */

export type { SealingAuthorityPort as FedosDirectRatchetSealingAuthority } from "../../../core/ports/sealing_authority_port.js";
