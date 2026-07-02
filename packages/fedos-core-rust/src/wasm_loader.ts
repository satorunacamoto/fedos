/**
 * Stage 63 — FedOS Core WASM loader boundary (loader SEAM only, disabled by
 * default).
 *
 * Names the shape a FUTURE loader WOULD expose to bring a real RustCrypto-backed
 * WASM module online behind the Stage 59 `FedosCoreCrypto` seam. This stage
 * ships the LOADER SEAM ONLY: the loader states, a request/decision shape, a
 * permanently-`disabled` `NoopFedosCoreWasmLoader`, an inert
 * `PlaceholderFedosCoreWasmLoader`, and pure bridge helpers — WITHOUT loading
 * anything.
 *
 * HARD GUARDRAILS (see `docs/vault_crypto_identity.md`):
 *   - Loads NO real WASM. Calls NO WASM `instantiate`/`compile` engine API,
 *     issues NO network request, performs NO dynamic module import, and resolves
 *     NO module path/URL. `moduleRef`/`integrityRef` are OPAQUE, non-secret labels ONLY —
 *     never a URL, path, subresource-integrity hash, or bytes; the loader
 *     neither resolves nor fetches them.
 *   - Runs NO cryptography: no HKDF/Argon2/KDF, no AEAD, no CSPRNG/random, no
 *     zeroize, no key generation/derivation. When a decision carries a `core`
 *     it is ONLY the permanently-inert `PlaceholderFedosCoreCrypto` (itself
 *     `unavailable`) — never a real core.
 *   - DISABLED BY DEFAULT: without an explicit `source: "placeholder"` nothing
 *     is ever "loaded"; the Noop loader is disabled unconditionally.
 *   - Every method is total and never throws. `unload()` only changes state.
 *   - This loader makes NO security/"safe load"/integrity guarantee and is NOT
 *     wired into the runtime or the Worker. A real loader (actual
 *     WASM instantiation) requires its own separate, explicit stage.
 */

import { PlaceholderFedosCoreCrypto } from "./index.js";
import type { FedosCoreCrypto } from "./types.js";

/**
 * Coarse observable state of a WASM loader. No module bytes, path, URL, or key
 * is exposed at any state.
 *   - "disabled"           — loading is switched off (the Noop default).
 *   - "unloaded"           — ready, but nothing has been loaded.
 *   - "loaded_placeholder" — a PLACEHOLDER "load" succeeded; the core handed
 *                            back is the inert `PlaceholderFedosCoreCrypto`, NOT
 *                            a real WASM core.
 *   - "unavailable"        — no loader is present to serve a request.
 *   - "error"              — a request could not be served; recorded as state,
 *                            never thrown.
 */
export type FedosCoreWasmLoaderState =
  | "disabled"
  | "unloaded"
  | "loaded_placeholder"
  | "unavailable"
  | "error";

/**
 * A non-sensitive snapshot of the loader. `reason` is human-readable and MUST
 * never contain a module URL/path, integrity hash, WASM bytes, or key material.
 */
export interface FedosCoreWasmLoaderStatus {
  readonly state: FedosCoreWasmLoaderState;
  readonly reason: string;
}

/**
 * FUTURE loader surfaces a real implementation MIGHT expose — all PLACEHOLDERS
 * in this stage. Presence of a name is a label of intent, NOT a working,
 * launched, or safe feature. None is implemented, fetched, or instantiated here.
 */
export type FedosCoreWasmLoaderCapability =
  | "wasm_loader_placeholder" // future WASM module loader (nothing loaded)
  | "instantiate_placeholder" // future WASM instantiation (never called)
  | "integrity_check_placeholder" // future SRI/integrity check (never performed)
  | "rust_core_placeholder"; // future Rust/WASM core swap point

/**
 * How a caller ASKS the loader to act. `source` selects the (placeholder)
 * origin: `"disabled"` refuses to load, `"placeholder"` hands back the inert
 * placeholder core; anything absent/omitted stays DISABLED BY DEFAULT.
 * `moduleRef`/`integrityRef` are OPAQUE, non-secret labels (e.g. a UI slot id, a
 * human module name) — NEVER a URL, path, integrity hash, or bytes. The loader
 * resolves and fetches NONE of them.
 */
export interface FedosCoreWasmLoadRequest {
  /** Optional OPAQUE, non-secret module label — NOT a URL/path. */
  readonly moduleRef?: string;
  /** Optional OPAQUE, non-secret integrity label — NOT an SRI hash. */
  readonly integrityRef?: string;
  /** Which placeholder origin to model. Absent ⇒ disabled (nothing loads). */
  readonly source?: "disabled" | "placeholder";
}

/**
 * The result of a load attempt. There is deliberately NO bytes/module/url field
 * — nothing is fetched, compiled, or instantiated. When `allowed` is true and a
 * placeholder "load" occurred, `core` is the inert `PlaceholderFedosCoreCrypto`
 * (permanently `unavailable`); otherwise `core` is omitted.
 */
export interface FedosCoreWasmLoadDecision {
  readonly allowed: boolean;
  /** The loader state AFTER this decision. */
  readonly state: FedosCoreWasmLoaderState;
  /** Non-sensitive explanation. Never echoes the request labels or any bytes. */
  readonly reason: string;
  /** The inert placeholder core, ONLY on a successful placeholder load. */
  readonly core?: FedosCoreCrypto;
}

/**
 * The FedOS Core WASM loader seam. A future loader implements this to bring a
 * real Rust/WASM core online. Implementations MUST NOT issue a network request,
 * dynamically import a module, call a WASM `instantiate`/`compile` engine API,
 * resolve a module path/URL, or run
 * any cryptography. `load`/`unload` never throw — they return a non-sensitive
 * `FedosCoreWasmLoadDecision` and move the state (including to `error`).
 * Constructing an implementation does nothing.
 */
export interface FedosCoreWasmLoader {
  /** Current coarse status (pure read). */
  getStatus(): FedosCoreWasmLoaderStatus;
  /** The PLACEHOLDER capabilities this loader advertises (may be empty). */
  getCapabilities(): readonly FedosCoreWasmLoaderCapability[];
  /**
   * Ask to load a WASM module. Loads NOTHING: issues no network request, no
   * dynamic module import, and no WASM instantiation; resolves no path/URL and
   * reads nothing from the opaque labels. Returns a decision; never throws.
   */
  load(request: FedosCoreWasmLoadRequest): Promise<FedosCoreWasmLoadDecision>;
  /** Unload any placeholder "load". Only changes state; never throws. */
  unload(): FedosCoreWasmLoadDecision;
}

/** Every placeholder loader-capability name (for mapping/documentation helpers). */
export const FEDOS_CORE_WASM_LOADER_CAPABILITIES: readonly FedosCoreWasmLoaderCapability[] = [
  "wasm_loader_placeholder",
  "instantiate_placeholder",
  "integrity_check_placeholder",
  "rust_core_placeholder",
];

/**
 * The permanently-`disabled` default loader. It advertises nothing and every
 * load attempt is denied. It fetches nothing, instantiates nothing, resolves no
 * path, and hands back no core.
 */
export class NoopFedosCoreWasmLoader implements FedosCoreWasmLoader {
  constructor() {
    // Does nothing: loading is switched off, no module contacted.
  }

  getStatus(): FedosCoreWasmLoaderStatus {
    return { state: "disabled", reason: "FedOS Core WASM loading is disabled" };
  }

  getCapabilities(): readonly FedosCoreWasmLoaderCapability[] {
    // Loading disabled -> advertises nothing.
    return [];
  }

  async load(_request: FedosCoreWasmLoadRequest): Promise<FedosCoreWasmLoadDecision> {
    // Reads nothing from the request; fetches/instantiates nothing; loads no core.
    return {
      allowed: false,
      state: "disabled",
      reason: "FedOS Core WASM loading is disabled (nothing loaded)",
    };
  }

  unload(): FedosCoreWasmLoadDecision {
    return { allowed: false, state: "disabled", reason: "FedOS Core WASM loading is disabled" };
  }
}

/**
 * A dev/test loader that models the load/unload state machine WITHOUT loading
 * any WASM. A `source: "placeholder"` request moves it to `loaded_placeholder`
 * and hands back the inert `PlaceholderFedosCoreCrypto` (still `unavailable`) —
 * it fetches nothing, instantiates nothing, resolves no path, and derives no
 * key. Any other request stays DISABLED BY DEFAULT. It retains ONLY a coarse
 * state; it never stores the opaque labels or any bytes.
 */
export class PlaceholderFedosCoreWasmLoader implements FedosCoreWasmLoader {
  #state: FedosCoreWasmLoaderState = "unloaded";

  constructor() {
    // Does nothing: state starts unloaded; no module is contacted.
  }

  getStatus(): FedosCoreWasmLoaderStatus {
    return { state: this.#state, reason: this.#reasonFor(this.#state) };
  }

  getCapabilities(): readonly FedosCoreWasmLoaderCapability[] {
    // Advertises the placeholder surfaces it WOULD offer — none is launched.
    return [
      "wasm_loader_placeholder",
      "instantiate_placeholder",
      "integrity_check_placeholder",
      "rust_core_placeholder",
    ];
  }

  async load(request: FedosCoreWasmLoadRequest): Promise<FedosCoreWasmLoadDecision> {
    // Reads ONLY the coarse `source` label. Derives nothing from moduleRef /
    // integrityRef (never resolved/fetched), issues no network request /
    // dynamic module import / WASM instantiation, and loads no real WASM. On the explicit
    // placeholder source it hands back the inert PlaceholderFedosCoreCrypto.
    if (request.source === "placeholder") {
      this.#state = "loaded_placeholder";
      return {
        allowed: true,
        state: "loaded_placeholder",
        reason:
          "placeholder load (no WASM fetched/instantiated; inert placeholder core, NOT a real crypto core)",
        core: new PlaceholderFedosCoreCrypto(),
      };
    }
    // Disabled by default: no explicit placeholder source ⇒ nothing loads.
    this.#state = "disabled";
    return {
      allowed: false,
      state: "disabled",
      reason: "FedOS Core WASM loading is disabled by default (no placeholder source requested)",
    };
  }

  unload(): FedosCoreWasmLoadDecision {
    // Only changes state; drops any placeholder core reference.
    this.#state = "unloaded";
    return { allowed: false, state: "unloaded", reason: "unloaded (no module was ever loaded)" };
  }

  /** Fixed, non-sensitive reason text for a state. Never echoes request labels. */
  #reasonFor(state: FedosCoreWasmLoaderState): string {
    switch (state) {
      case "loaded_placeholder":
        return "placeholder core loaded (inert; no real WASM present)";
      case "disabled":
        return "FedOS Core WASM loading is disabled by default";
      default:
        return "ready (no module loaded)";
    }
  }
}

/**
 * Pure bridge: pull the `FedosCoreCrypto` a load decision produced, or
 * `undefined` when the load was denied / carried no core. It resolves nothing,
 * constructs nothing, and — because any `core` a loader returns is only the
 * inert `PlaceholderFedosCoreCrypto` — never yields a real crypto core. Total
 * and non-mutating: reads only `allowed`/`core` off the decision.
 */
export function fedosCoreWasmDecisionToCore(
  decision: FedosCoreWasmLoadDecision,
): FedosCoreCrypto | undefined {
  return decision.allowed ? decision.core : undefined;
}

/**
 * Safe wrapper around any `FedosCoreWasmLoader.load`: awaits the loader's
 * decision and, if the loader throws/rejects, reports a non-sensitive `error`
 * decision instead of propagating it. Fetches nothing itself and passes the
 * request straight through, unread and unmutated. The `error` reason is a fixed
 * string — never the request labels or the loader's error text (which could
 * carry path/secret-shaped material from a future loader).
 */
export async function loadFedosCoreWasm(
  loader: FedosCoreWasmLoader,
  request: FedosCoreWasmLoadRequest,
): Promise<FedosCoreWasmLoadDecision> {
  try {
    return await loader.load(request);
  } catch {
    return {
      allowed: false,
      state: "error",
      reason: "FedOS Core WASM loader could not serve the load request",
    };
  }
}
