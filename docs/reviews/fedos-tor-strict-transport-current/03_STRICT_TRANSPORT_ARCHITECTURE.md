# Strict Transport Architecture — Coordinator decision (FROZEN before implementation)

## 1. BUNDLED vs EXTERNAL — decided: EXTERNAL

No Tor binary exists anywhere in this repository (working tree or `.git`
object store on any ref) or on this development machine's known paths.
Bundling one requires either a public download (explicitly forbidden this
arc, §14/§57 of the mandate) or reusing the historical branch's own bundled
payload, which itself does not exist on disk anywhere reachable — the
historical branch only carries the *code* that would verify/spawn a bundled
binary, never the binary itself (checked: no `resources/tor-runtime/` or
similar payload directory in that branch's tree, only the manifest-schema
and verification code that would consume one).

**Decision: FedOS connects to an EXTERNAL, user-supplied local Tor process**
via its SOCKS5 port (default `127.0.0.1:9050`, standard Tor default,
user-configurable). FedOS does not spawn, own, verify, or bundle a Tor
binary in this arc. This is explicitly compatible with the mandate's own
§15 ("Possible [READY] sources: ... successful local SOCKS readiness
check, existing tested mechanism") and avoids §13/§14/§50/§51/§52's entire
process-ownership/binary-provenance/licensing surface, none of which apply
to a connection-only client.

Product-truthfulness consequence (§27/§29 of the mandate): the Security UI
and settings copy must say "Tor SOCKS proxy" / "connects to a local Tor
process you provide," never imply FedOS installs or manages Tor. This is a
real, disclosed prerequisite the user must satisfy themselves — same as
the mandate's own §51 anticipates for the EXTERNAL choice.

## 2. Strict policy states

```
DISABLED       -- strict Tor toggle is off; ordinary direct WebSocket path used (today's behavior, unchanged)
STARTING       -- strict toggle is on; a SOCKS5 readiness probe is in flight, not yet resolved
READY          -- most recent readiness probe succeeded
DEGRADED       -- was READY; a live connection attempt just failed; re-probing before declaring FAILED_CLOSED
FAILED_CLOSED  -- most recent readiness probe (or re-probe) failed; no application network traffic permitted
```

Modeled in `FedosStrictTransportPolicy`
(`packages/fedos-desktop-electron-spike/src/fedos_electron_strict_transport_policy.ts`).
No boolean `torEnabled = true` is ever treated as sufficient — every
connection attempt re-checks live state, not a cached flag (§7/§31 of the
mandate: no persisted false READY).

## 3. READY definition

A SOCKS5 readiness probe = a real TCP connect to the configured SOCKS host
plus a full SOCKS5 greeting/method-negotiation round-trip (no CONNECT sent,
so it opens no application circuit) against the configured SOCKS endpoint,
with a bounded timeout. Success -> READY. Any failure (connection refused,
timeout, malformed method reply) -> FAILED_CLOSED. No fixed `sleep`
anywhere in this path (mandate §15's own prohibition) — the probe is a
real, awaited network round-trip with a timeout, not a delay guess.

## 4. Single routing authority — reuses an ALREADY-CENTRALIZED integration point

`01_CURRENT_NETWORK_SURFACE.md` §3 establishes that exactly one
composition-root binding
(`fedos_electron_beta_main.cts`'s `createNodeWebSocketRelaySocketFactory:
websocketRelaySocketFactory.createNodeWebSocketRelaySocketFactory`) already
feeds every one of the ~13 real relay-construction call sites (Messenger +
every Commerce Nostr transport). This arc changes ONLY the right-hand side
of that one binding to a strict-mode-aware wrapper:

```
createNodeWebSocketRelaySocketFactory: () =>
  strictTransportPolicy.isStrictModeEnabled()
    ? createStrictFedosRelaySocketFactory(strictTransportPolicy)   // SOCKS5-routed, fails closed if not READY
    : websocketRelaySocketFactory.createNodeWebSocketRelaySocketFactory()  // unchanged direct path
```

Zero changes to any of the ~13 downstream call sites. This is the "single
central routing authority" the mandate requires (§8/§9) — no
`if (torEnabled)` branch is ever added at a feature call site.

## 5. DNS safety

The strict factory never resolves the relay hostname locally. It parses
`wss://host:port/...` -> `{host, port}` with a plain string/URL parse (no
`dns.lookup`), then calls the ported SOCKS5 client's `socks5Connect()` with
`targetHost: host` verbatim — the SOCKS5 client's own structural guarantee
(inherited from the historical asset, re-verified: see
`08_IMPLEMENTATION_PLAN.md`) is that `targetHost` is always sent as
`ATYP=0x03` (domain name), never resolved to an IP locally first. `wss://`
(TLS) is layered with `tls.connect({socket: <the SOCKS-negotiated raw
socket>, servername: host})` — `servername` is used only for the TLS SNI/
certificate-hostname check against the ALREADY-CONNECTED socket, never as
an input to any DNS call.

## 6. WebSocket-over-SOCKS client

Node/Electron's spec-global `WebSocket` constructor (used by the existing
direct-path factory) takes only a URL string — no proxy/dispatcher
parameter exists on it (confirmed: WHATWG spec constructor shape, and the
current factory's own code passes nothing else). It cannot be pointed at a
pre-negotiated SOCKS socket. Rather than add a new npm dependency (a SOCKS
HTTP agent package) — avoided per this codebase's own established
zero-new-dependency discipline for narrow internal transport code (the
ported SOCKS5 client itself is the precedent: hand-written, dependency-free)
— this arc adds one small, purpose-built WebSocket client
(`fedos_electron_strict_websocket_client.ts`) that performs the RFC 6455
opening handshake and text-frame framing directly over the SOCKS-negotiated
raw/TLS socket, implementing exactly the `FedosRelaySocket` interface
already defined in `websocket_relay.ts` (`send(data: string)`, `close()`,
`addEventListener("close"|"error"|"message", ...)` — a deliberately minimal
surface, confirmed by reading that interface directly). Scope: text frames
only (Nostr wire protocol is JSON-over-text, confirmed by the existing
direct-path client's own `send(data: string)` signature), automatic
ping/pong reply, close-frame handling. No binary-frame support is added
because no caller needs it.

## 7. Fail-closed invariant

The strict factory's returned function throws/rejects immediately,
BEFORE opening any TCP socket, if `strictTransportPolicy.state() !==
"ready"`. There is no code path in the strict factory that falls through
to a direct (non-SOCKS) connection under any policy state. This is checked
by a negative test (`09_ACCEPTANCE_MATRIX.md` item 5/6).

## 8. Legacy NIP-17 fallback + Direct Ratchet (mandate §20/§21)

Both the Ratchet route and the legacy NIP-17 route ultimately call
`sendMailboxNip17`/`sendMailboxNip17Control`, which both terminate in the
SAME `WebSocketRelayPublisher`/relay-publish path — i.e. the SAME single
factory binding this arc makes strict-aware. There is no route-specific
network exit; "legacy fallback" is a *protocol* choice (which payload
shape/envelope is sent), never a *transport* choice (both go out over the
identical relay-socket factory). Proven directly in
`09_ACCEPTANCE_MATRIX.md` rather than assumed.

Direct Ratchet's own security state (Forward Secrecy axis, this repo's
already-shipped Live-State Durability arc) and Tor's transport state remain
fully independent — no source-level coupling is introduced. Confirmed by
inspection: `FedosDirectRatchetLiveVerificationState` computation
(`fedos_direct_ratchet_conversation_runtime.ts`) reads only session
metadata/counters/cache, never anything network- or Tor-related.

## 9. Default

`STRICT TOR: OFF` by default (mandate §30's own expectation) — no source
change alters the ordinary launch path unless the user explicitly enables
strict mode in Settings. Verified: the new config field defaults to
`false`/unset in `FedosDesktopBetaSettings`' persisted shape.

## 10. Profile scope

Per-process, not shared. `FedosStrictTransportPolicy` and the derived SOCKS
isolation credential are constructed once per `startFedosDesktopRuntime()`-
equivalent process lifetime (mirroring the main process's own
`processSessionSalt`-per-launch pattern from the historical isolation
module) — never persisted across restart, never shared across profiles in
the same process (Electron only ever runs one profile per process in this
product, confirmed by the existing single-profile-per-launch architecture).
