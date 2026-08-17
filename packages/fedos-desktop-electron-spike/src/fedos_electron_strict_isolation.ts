/**
 * Tor Strict-Transport Local Closure arc — SOCKS stream isolation
 * credential derivation.
 *
 * Simplified, single-scope port of the historical, unmerged
 * `feature/commerce-tor-live-final-v1` branch's own
 * `fedos_electron_tor_isolation.ts` (see
 * `docs/reviews/fedos-tor-strict-transport-current/02_HISTORICAL_TOR_ASSETS.md`)
 * — that file derives a distinct credential per Commerce persona/role/
 * order scope; this arc has no such scoping need (one shared Messenger +
 * Commerce Nostr relay transport, per-process, not per-persona), so this
 * module derives exactly ONE credential per process launch.
 *
 * Tor's SOCKS5 implementation treats the RFC 1929 username/password
 * sub-negotiation purely as an isolation-key carrier when
 * `IsolateSOCKSAuth` is set: connections presenting different credentials
 * are kept on separate circuits. `processSessionSalt` is generated fresh
 * once per process launch (never persisted) so this credential changes on
 * every relaunch/restart of strict mode, without this module needing to
 * know anything about time or randomness itself.
 */

import { createHash, randomBytes } from "node:crypto";

export interface StrictSocksIsolationCredential {
  readonly username: string;
  readonly password: string;
}

export function generateStrictProcessSessionSalt(): string {
  return randomBytes(16).toString("hex");
}

/** Same salt always yields the same credential -- deterministic and testable; the entropy lives entirely in `processSessionSalt`. */
export function deriveStrictSocksIsolationCredential(processSessionSalt: string): StrictSocksIsolationCredential {
  const hex = createHash("sha256").update(`fedos-strict-transport-isolation-v1|${processSessionSalt}`, "utf8").digest("hex");
  // RFC 1929 allows up to 255 bytes per field; 32 hex chars (16 bytes) is
  // ample entropy while staying well under that bound.
  return { username: hex.slice(0, 32), password: hex.slice(32, 64) };
}
