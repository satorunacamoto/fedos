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

/**
 * Secure Runtime Alpha 6921-7000 — the narrow, closed slice of the real
 * Rust/WASM `FedosDirectRatchetSession` class's own STATIC factory
 * surface (a SIBLING export on the SAME generated glue module
 * `FedosMasterSeedAuthority` is exported from — confirmed by direct
 * source inspection of `fedos_wasm_loader.ts`'s own
 * `#directRatchetSessionModule()`/`attemptDevOnlyDirectRatchetInitializeAs*Call()`).
 * Every instance method (`encrypt`/`decrypt`/counters/seal*) lives on the
 * VALUE these three factories return, never on this interface itself —
 * this facade only ever hands back the three closed constructors, never
 * the module, never a generic invoke.
 */
export interface FedosProductionDirectRatchetSessionModule {
  readonly initialize_as_receiver: (
    masterSeedAuthority: unknown,
    accountIndex: number,
    counterpartyPublicKeyHex: string,
    sessionId: string,
    localDeviceRef: string,
    generation: number,
  ) => unknown;
  readonly initialize_as_sender: (
    masterSeedAuthority: unknown,
    accountIndex: number,
    counterpartyPublicKeyHex: string,
    sessionId: string,
    localDeviceRef: string,
    generation: number,
    remoteRatchetPublicKeyHex: string,
  ) => unknown;
  readonly restore: (...args: readonly unknown[]) => unknown;
}

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

  /**
   * Secure Runtime Alpha 6921-7000 — the SAME already-initialized,
   * manifest-verified glue module this facade already holds privately,
   * narrowed to `FedosDirectRatchetSession`'s own three static
   * constructors only. Returns `null` (never throws) if the export is
   * absent or not structurally the reviewed shape. Never a second
   * `import()`, never a second `initSync`/`WebAssembly.instantiate` —
   * this is a read of an export already present on the module this
   * facade's own closure captured at construction.
   */
  constructDirectRatchetSessionModule(): FedosProductionDirectRatchetSessionModule | null;
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
 * Secure Runtime Alpha 6921-7000 — structural fail-closed validation of
 * `moduleRef.FedosDirectRatchetSession`. Never `instanceof`; only a shape
 * check that the three reviewed static constructors are callable
 * functions. Mirrors `isMasterSeedAuthorityHandleShape()`'s own exact
 * discipline immediately above.
 */
function isDirectRatchetSessionModuleShape(value: unknown): value is FedosProductionDirectRatchetSessionModule {
  if (typeof value !== "object" && typeof value !== "function") return false;
  if (value === null) return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.initialize_as_receiver === "function" &&
    typeof v.initialize_as_sender === "function" &&
    typeof v.restore === "function"
  );
}

/**
 * Build a capability-limited facade over an ALREADY-INITIALIZED glue
 * module. The module is captured in a closure and never exposed. Only
 * the `FedosMasterSeedAuthority` constructor and (as of Secure Runtime
 * Alpha 6921-7000) the `FedosDirectRatchetSession` static constructors
 * are ever read from it — both real exports on the SAME already-verified
 * module, never a second import or a second WASM initialization.
 */
export function createFedosProductionMasterSeedFacade(
  initializedGlueModule: object,
): FedosProductionMasterSeedFacade {
  const moduleRef = initializedGlueModule as { FedosMasterSeedAuthority?: unknown; FedosDirectRatchetSession?: unknown };
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
    constructDirectRatchetSessionModule(): FedosProductionDirectRatchetSessionModule | null {
      const Ctor = moduleRef.FedosDirectRatchetSession;
      return isDirectRatchetSessionModuleShape(Ctor) ? Ctor : null;
    },
  });
}
