/**
 * Secure Runtime Alpha 4741-4820 — Phase F: Capability-Limited WASM Facade.
 *
 * The production Desktop path exposes ONLY the exports needed for the
 * Master Seed capability profile: constructing an opaque
 * `FedosMasterSeedAuthority` WASM handle (whose own methods cover seed
 * generation, sealing, restoration, identity derivation, and the
 * already-approved Conversation-key resolution the Runtime needs). It
 * never returns the raw WASM module / namespace to application code, and
 * never widens access to any other export. The initialized glue module
 * is held PRIVATELY inside this facade instance and reached through this
 * one narrow method only.
 *
 * The opaque handle this facade returns is the SAME shape the existing
 * `FedosWasmMasterSeedAuthority` adapter already consumes
 * (`FedosMasterSeedAuthorityHandle`) — this file adds an adapter, it does
 * not widen every caller.
 */

import type { FedosMasterSeedAuthorityHandle } from "../../runtime/fedos_wasm_loader.js";

/** The single reviewed capability the production Desktop path is granted. */
export interface FedosProductionMasterSeedFacade {
  /**
   * Construct ONE fresh, empty opaque WASM Master Seed authority handle.
   * Returns `null` (never throws) if the constructor is unavailable or
   * the produced value is not structurally a genuine authority handle.
   * Each call yields an INDEPENDENT authority (matching Rust's own
   * per-instance lifecycle) — the caller retains and drives exactly one.
   */
  constructMasterSeedAuthority(): FedosMasterSeedAuthorityHandle | null;
}

/**
 * Structural fail-closed validation of a value returned by
 * `new module.FedosMasterSeedAuthority()`. Never `instanceof` (this file
 * holds no reference to the glue's own class); only a shape check that
 * the reviewed methods are callable. A plain object, `null`, or any
 * other shape resolves `false`.
 */
function isMasterSeedAuthorityHandleShape(value: unknown): value is FedosMasterSeedAuthorityHandle {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.generate === "function" &&
    typeof v.seal === "function" &&
    typeof v.restore_sealed === "function" &&
    typeof v.clear === "function" &&
    typeof v.is_available === "function" &&
    typeof v.is_cleared === "function" &&
    typeof v.public_key_hex_for_account === "function"
  );
}

/**
 * Build a capability-limited facade over an ALREADY-INITIALIZED glue
 * module. The module is captured in a closure and never exposed. Only
 * the `FedosMasterSeedAuthority` constructor is ever read from it.
 */
export function createFedosProductionMasterSeedFacade(
  initializedGlueModule: object,
): FedosProductionMasterSeedFacade {
  const moduleRef = initializedGlueModule as { FedosMasterSeedAuthority?: unknown };
  return Object.freeze({
    constructMasterSeedAuthority(): FedosMasterSeedAuthorityHandle | null {
      const Ctor = moduleRef.FedosMasterSeedAuthority;
      if (typeof Ctor !== "function") return null;
      try {
        const value: unknown = new (Ctor as new () => unknown)();
        return isMasterSeedAuthorityHandleShape(value) ? value : null;
      } catch {
        return null;
      }
    },
  });
}
