/**
 * Commerce E2E Completion arc (Wave B, Agent I) — §10 of the original
 * brief: a SMALL policy abstraction a future real network transport (an
 * IPFS gateway client, a Nostr relay socket, anything reaching outside
 * this process) would consult before it is allowed to reach out at all.
 * This file is pure policy/config: a type, a validation function, and a
 * "what does this profile allow" query function. It contains NO Tor
 * installation, download, process-spawn, or dependency of any kind — no
 * live Tor code exists anywhere in this file or is reachable from it.
 *
 * ============================================================
 * TOR IS TRANSPORT POLICY HERE, NEVER AN ANONYMITY GUARANTEE.
 * ============================================================
 * `"tor-optional"` below means exactly what it says: a future real
 * transport MAY route its traffic through Tor when this profile is
 * selected. It is NOT a promise that doing so makes any operation
 * anonymous, unlinkable, or safe from traffic analysis — Tor is one
 * possible transport-layer routing choice among several, not a privacy
 * property this module (or anything layered on top of it) certifies.
 * Nothing in `src/os/commerce/` computes, checks, or displays an
 * "anonymity" or "privacy level" claim anywhere, and this file does not
 * start doing so. Any future real transport that consults this seam MUST
 * carry the same caveat forward in its own documentation rather than
 * upgrading this policy label into a security claim.
 *
 * Content-addressed references (a `MediaStorePort` `key`, an IPFS CID —
 * see `./ipfs_media_store.ts`) are METADATA, not confidentiality, and
 * ROUTING traffic through Tor changes nothing about that: a CID/hash is
 * still exactly as identifying/linkable over Tor as over any other
 * transport. `./ipfs_media_store.ts`'s own header repeats this same
 * caveat from the storage side; this file repeats it from the transport
 * side, deliberately, so neither file can be read in isolation as making
 * a privacy claim the other one doesn't also carry.
 *
 * SCOPE: nothing in this file talks to a network, a subprocess, or a
 * filesystem. It has no side effects and no state. A future real
 * transport (not built in this pass) would import `evaluateNetworkAccess`/
 * `prefersTorTransport` and consult them before making its own real
 * network call — this file does not make that call itself, and nothing
 * in `src/os/commerce/` currently does either (`STATUS: inert scaffolding,
 * not reachable from the shipped Electron app`, same posture as every
 * other file this arc's brief names).
 */

/**
 * - `"direct"` — a future real transport may reach the network directly
 *   (whatever the ambient network path already is), no Tor involved.
 * - `"local-only"` — a future real transport must NOT reach any network
 *   resource at all; only already-local/pre-seeded data may be used. The
 *   strictest profile: it forbids Tor too, since Tor is itself a network
 *   reach.
 * - `"tor-optional"` — a future real transport is PERMITTED (not
 *   required) to route its network reach through Tor. See this file's own
 *   header for why this is a transport-routing choice, never an anonymity
 *   guarantee.
 */
export type NetworkProfile = "direct" | "local-only" | "tor-optional";

const VALID_NETWORK_PROFILES: readonly NetworkProfile[] = ["direct", "local-only", "tor-optional"];

/** Structural validation only — never a network probe, never async. */
export function isValidNetworkProfile(value: unknown): value is NetworkProfile {
  return typeof value === "string" && (VALID_NETWORK_PROFILES as readonly string[]).includes(value);
}

/** The result of asking "does this profile allow this operation" — mirrors this codebase's own `AccessDecision`/`ProductMediaValidationDecision` shape (`allowed`/`valid` + a human-readable `reason`). */
export interface NetworkProfileDecision {
  readonly allowed: boolean;
  readonly reason: string;
}

/**
 * Whether `profile` permits an operation that `requiresNetwork` (a future
 * real transport's own honest self-report — this function does not and
 * cannot inspect what the caller is actually about to do). `"local-only"`
 * refuses any network-requiring operation; `"direct"` and `"tor-optional"`
 * both permit it (they differ only in ROUTING — see `prefersTorTransport`
 * — never in WHETHER network reach is allowed at all). An operation that
 * does not require the network (`requiresNetwork: false`) is always
 * allowed, under every profile — this function never invents a reason to
 * block purely-local work.
 */
export function evaluateNetworkAccess(profile: NetworkProfile, requiresNetwork: boolean): NetworkProfileDecision {
  if (!requiresNetwork) {
    return { allowed: true, reason: "operation does not require network access" };
  }
  if (profile === "local-only") {
    return { allowed: false, reason: 'network access is forbidden under the "local-only" profile' };
  }
  return { allowed: true, reason: `network access permitted under the "${profile}" profile` };
}

/**
 * Whether a future real transport should PREFER routing through Tor for
 * this profile. Only `"tor-optional"` returns `true`. See this file's own
 * header: this is a routing preference, never an anonymity guarantee, and
 * this function performs no actual Tor connection, install, or process
 * spawn of any kind — it is a pure, synchronous label lookup.
 */
export function prefersTorTransport(profile: NetworkProfile): boolean {
  return profile === "tor-optional";
}
