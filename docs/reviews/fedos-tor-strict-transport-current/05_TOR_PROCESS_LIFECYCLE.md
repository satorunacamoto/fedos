# Tor Process Lifecycle

Per `03_STRICT_TRANSPORT_ARCHITECTURE.md` §1 (EXTERNAL Tor decision): **FedOS
owns no Tor process.** Sections 13/14/16/18 of the mandate (owned-process
tracking, bundled-binary verification, spawn-ordered startup, bounded
restart/backoff of an owned process) are N/A by architecture, not skipped
by omission — there is no process for FedOS to own, so "never
`taskkill /IM tor.exe` globally" is trivially satisfied (FedOS never calls
`taskkill`/`spawn` on any Tor binary anywhere in this arc's code, confirmed
by grep of the new modules below).

## What IS this arc's responsibility: readiness detection of an EXTERNAL process

`FedosStrictTransportPolicy` treats "Tor" as "whatever is listening on the
configured SOCKS host:port" — it has no opinion on whether that's a real
Tor process, a test double, or anything else. This is the correct honest
framing for an EXTERNAL dependency: FedOS cannot verify Tor's own internal
bootstrap state (no control port is used, by the same EXTERNAL-Tor
decision — a control port would require Tor's control auth, an
additional user-configuration burden and a THIRD prerequisite beyond
"install Tor" and "SOCKS listening", explicitly deferred).

### Startup ordering (§16 of the mandate)

```
strict mode enabled (Settings) or app launch with strict mode already ON
  -> policy enters STARTING
  -> one SOCKS5 readiness probe (bounded timeout, no sleep)
  -> success -> READY;  failure -> FAILED_CLOSED
Before READY: the strict factory rejects every connection attempt (fail-closed).
```

### Mid-session death (§17/§18/§36)

Every real connection attempt through the strict factory that fails at the
TCP or SOCKS layer transitions the policy from READY -> DEGRADED
immediately, then triggers exactly one re-probe; re-probe success returns
to READY, re-probe failure moves to FAILED_CLOSED. No connection is ever
allowed to bypass this and connect directly. No automatic reconnect to the
final *destination* is ever attempted outside this same SOCKS path — the
existing relay layer's own retry/reconnect behavior (already documented as
absent — no auto-reconnect exists in `WebSocketRelay` today, per
`01_CURRENT_NETWORK_SURFACE.md`) is unchanged; whatever retries the
application layer already does simply keep going through the same strict
factory, which keeps re-checking policy state on every attempt (mandate
§19: retries stay behind Tor policy, never bypass it).

### Restart (§39)

Strict-mode setting is read fresh from persisted Settings at every process
launch (never a persisted `torReady` boolean — mandate §31). The policy
always starts a fresh process launch in STARTING, never resumes a prior
READY claim.
