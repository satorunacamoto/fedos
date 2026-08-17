# Bypass Threat Model

| Scenario | Required behavior | Mechanism this arc provides |
|---|---|---|
| Tor unavailable (strict ON, never was READY) | fail closed, zero direct connections | policy starts STARTING, probe fails -> FAILED_CLOSED; strict factory throws before any socket opens |
| Tor not yet ready (probe in flight) | fail closed until real proof | STARTING state rejects connections; no optimistic connect |
| Tor dies mid-session | fail closed, no direct fallback | READY->DEGRADED->re-probe->FAILED_CLOSED on next attempt; never falls through to direct `WebSocket` |
| SOCKS refuses / malformed reply | connection failure, no fallback | `socks5Connect()` throws on any non-`0x00` reply / bad version / unacceptable method; strict factory propagates the rejection, never catches-and-falls-back |
| DNS attempted locally | zero local DNS calls | §5 of `03_...ARCHITECTURE.md` — hostname never touches `node:dns` on the strict path |
| WebSocket direct-connect fallback | never happens | strict factory is a hard replacement of the direct factory at the ONE binding site when strict mode is on — no code path in between calls `new WebSocket()` directly |
| legacy NIP-17 fallback | still proxied | same relay-publish path as Ratchet (§8 of `03_...ARCHITECTURE.md`) — proven directly, not assumed, in `09_ACCEPTANCE_MATRIX.md` |
| Direct Ratchet fallback | still proxied | same reasoning — Ratchet's own transport call (`sendMailboxNip17`) is the identical relay-publish path |
| Commerce traffic | covered automatically | Commerce reuses the SAME `WebSocketRelayPublisher`/`WebSocketRelayAdapter` construction sites, all fed by the one binding |
| retry path | stays behind policy | retries re-invoke the same factory, which re-checks policy state every call — no retry short-circuits the check |
| restart | fail closed until re-proven | §"Restart" in `05_TOR_PROCESS_LIFECYCLE.md` |
| stale READY status | never persisted | policy state lives only in in-memory process state, never written to Settings/disk as an authoritative flag |
| malformed proxy response | fail closed | `socks5Connect()`'s reply-parsing rejects unexpected SOCKS version, ATYP, or non-success REP byte |
| wrong proxy (something non-SOCKS listening on the port) | fail closed | greeting/method-negotiation reply is validated (`methodReply[0] !== SOCKS_VERSION` -> throw) before any CONNECT is attempted — a non-SOCKS listener fails at probe time |
| partial bootstrap | not distinguished from FAILED_CLOSED | this arc has no control-port visibility into Tor's own bootstrap percentage (EXTERNAL-Tor decision, §1 of `03_...ARCHITECTURE.md`) — a partially-bootstrapped Tor that isn't yet accepting SOCKS connections is indistinguishable from "not ready" and correctly reported as such, never optimistically treated as usable |

## Security UI wording audit

Existing UI has no Tor-related copy anywhere (confirmed: `network_profile.ts`
has zero UI callers). This arc adds the first such copy; reviewed against
the mandate's forbidden-word list (§27): no "Anonymous", "Hidden",
"Untraceable", or "Private mode" string appears anywhere in the new
`fedos_electron_strict_transport_policy.ts`/settings copy (grep-verified
after implementation, see `09_ACCEPTANCE_MATRIX.md`).
