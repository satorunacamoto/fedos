/**
 * Tor Strict-Transport Local Closure arc — the ONE central runtime
 * authority over "is it currently safe to make a network connection."
 *
 * See `docs/reviews/fedos-tor-strict-transport-current/03_STRICT_TRANSPORT_ARCHITECTURE.md`
 * §2/§3 for the frozen state model and readiness definition. EXTERNAL Tor
 * only (no bundled binary, no spawn, no control port -- §1 of that same
 * doc): "ready" here means "the configured SOCKS5 endpoint completed a
 * real method-negotiation round-trip just now," nothing more and nothing
 * less. No boolean flag is ever treated as sufficient on its own -- every
 * caller must read `state()` fresh at connection time, and `state()` is
 * never persisted across restart (mandate §31: no persisted false READY).
 */

import { socks5ProbeReadiness } from "./fedos_electron_socks5_client.js";
import { generateStrictProcessSessionSalt, deriveStrictSocksIsolationCredential, type StrictSocksIsolationCredential } from "./fedos_electron_strict_isolation.js";

export type FedosStrictTransportState = "disabled" | "starting" | "ready" | "degraded" | "failed-closed";

export interface FedosStrictTransportConfig {
  readonly socksHost: string;
  readonly socksPort: number;
  readonly probeTimeoutMs: number;
}

const DEFAULT_PROBE_TIMEOUT_MS = 5_000;

export class FedosStrictTransportPolicy {
  #state: FedosStrictTransportState = "disabled";
  #config: FedosStrictTransportConfig | null = null;
  #processSessionSalt: string | null = null;
  #isolation: StrictSocksIsolationCredential | null = null;
  /** Serializes probes so a burst of connection attempts triggers at most one in-flight readiness check. */
  #inFlightProbe: Promise<void> | null = null;

  isStrictModeEnabled(): boolean {
    return this.#state !== "disabled";
  }

  state(): FedosStrictTransportState {
    return this.#state;
  }

  config(): FedosStrictTransportConfig | null {
    return this.#config;
  }

  isolationCredential(): StrictSocksIsolationCredential {
    if (this.#isolation === null) throw new Error("FedosStrictTransportPolicy: isolationCredential() called before enable()");
    return this.#isolation;
  }

  /** Enters STARTING and kicks off (but does not await) the first readiness probe -- callers that need to know the outcome should call `ensureReady()`. */
  enable(config: FedosStrictTransportConfig): void {
    this.#config = config;
    this.#processSessionSalt = generateStrictProcessSessionSalt();
    this.#isolation = deriveStrictSocksIsolationCredential(this.#processSessionSalt);
    this.#state = "starting";
    void this.#probe();
  }

  disable(): void {
    this.#state = "disabled";
    this.#config = null;
    this.#processSessionSalt = null;
    this.#isolation = null;
  }

  /**
   * Called by the strict socket factory before EVERY connection attempt.
   * Returns true only if state is genuinely "ready" right now. Never
   * blocks longer than one probe; never falls back to a cached true.
   */
  async ensureReady(): Promise<boolean> {
    if (this.#state === "disabled") return false;
    if (this.#state === "ready") return true;
    if (this.#state === "starting" || this.#state === "degraded") {
      await this.#probe();
      // `#probe()` may have reassigned `#state` -- TypeScript's control-
      // flow narrowing does not see through the await, so the field is
      // read back through the public, widely-typed getter rather than
      // trusting the (stale) narrowed type at this point.
      return this.state() === "ready";
    }
    // failed-closed: re-probe on demand rather than staying permanently
    // closed for the rest of the process lifetime, since the external
    // Tor process may recover -- but the caller only proceeds if THIS
    // probe succeeds, never on the strength of a prior failure.
    await this.#probe();
    return this.state() === "ready";
  }

  /** Called by the strict socket factory when a live connection attempt fails at the TCP/SOCKS layer -- transitions READY -> DEGRADED immediately so no further connection is optimistically attempted before the next probe. */
  reportConnectionFailure(): void {
    if (this.#state === "ready") this.#state = "degraded";
  }

  async #probe(): Promise<void> {
    if (this.#inFlightProbe !== null) return this.#inFlightProbe;
    const config = this.#config;
    if (config === null) return;
    this.#inFlightProbe = (async () => {
      try {
        await socks5ProbeReadiness(config.socksHost, config.socksPort, config.probeTimeoutMs);
        this.#state = "ready";
      } catch {
        this.#state = "failed-closed";
      } finally {
        this.#inFlightProbe = null;
      }
    })();
    return this.#inFlightProbe;
  }
}

export function defaultFedosStrictTransportConfig(socksHost: string, socksPort: number): FedosStrictTransportConfig {
  return { socksHost, socksPort, probeTimeoutMs: DEFAULT_PROBE_TIMEOUT_MS };
}
