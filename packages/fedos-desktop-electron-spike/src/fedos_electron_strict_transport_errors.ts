/**
 * Tor Strict-Transport Local Closure arc — shared, closed error
 * vocabulary for the strict SOCKS5 transport path.
 *
 * Pattern ported from the historical, unmerged
 * `feature/commerce-tor-live-final-v1` branch's own `fedos_electron_tor_errors.ts`
 * (see `docs/reviews/fedos-tor-strict-transport-current/02_HISTORICAL_TOR_ASSETS.md`)
 * — same "one closed vocabulary, user-safe message + optional advanced
 * detail, never a raw error/path in ordinary UI" discipline — but a much
 * smaller code set: this arc is EXTERNAL-Tor, connection-only (no bundled
 * binary, no spawn, no bootstrap, no control port, no onion service), so
 * none of the historical vocabulary's process-lifecycle/bundling/
 * onion-service codes apply.
 */

export type StrictTransportErrorCode =
  | "not-ready"
  | "socks-unreachable"
  | "socks-failure"
  | "authentication-failure"
  | "timeout"
  | "handshake-failed";

const USER_MESSAGES: Record<StrictTransportErrorCode, string> = {
  "not-ready": "Strict Tor routing is on, but Tor is not ready yet. Network activity is blocked until it is.",
  "socks-unreachable": "FedOS could not reach the configured Tor SOCKS proxy.",
  "socks-failure": "The connection through Tor failed.",
  "authentication-failure": "FedOS could not authenticate to the Tor SOCKS proxy.",
  "timeout": "The connection through Tor timed out.",
  "handshake-failed": "The connection through Tor could not be completed.",
};

export class StrictTransportError extends Error {
  readonly code: StrictTransportErrorCode;
  /** Raw, potentially-sensitive detail (socket errors, hostnames) — Advanced details only, never the ordinary UI. Never secret key material. */
  readonly advancedDetail: string | undefined;

  constructor(code: StrictTransportErrorCode, advancedDetail?: string) {
    super(`${code}: ${USER_MESSAGES[code]}`);
    this.name = "StrictTransportError";
    this.code = code;
    this.advancedDetail = advancedDetail;
  }

  get userMessage(): string {
    return USER_MESSAGES[this.code];
  }
}

export function isStrictTransportError(value: unknown): value is StrictTransportError {
  return value instanceof StrictTransportError;
}
