# Acceptance Matrix

Local-only (mandate §3) — real TCP loopback, real SOCKS5 protocol bytes,
real (fake, loopback) WebSocket destination, zero public network contact.

1. Strict mode ON, real fake-SOCKS server up, real fake-WS destination up ->
   connect succeeds, SOCKS server observed the CONNECT with the correct
   target host/port.
2. Same, over a synthetic `wss://` (TLS-over-SOCKS) target -> succeeds with
   a local self-signed cert + `NODE_TLS_REJECT_UNAUTHORIZED`-scoped test
   override, or a plain `ws://` loopback target if TLS test scaffolding is
   disproportionate — decide at implementation time, document the choice.
3. Clearnet trap: SOCKS listener on port A, a SEPARATE "clearnet trap"
   listener on port B: strict mode configured to A, connect to a target
   that (if bypassed) would resolve to B. Required: B receives 0
   connections.
4. Strict mode ON, SOCKS port has NOTHING listening -> connection attempt
   fails closed (readiness probe fails, factory rejects before any socket
   opens). Clearnet trap: 0.
5. Strict mode ON, SOCKS listener present but a NON-SOCKS protocol (e.g.
   plain HTTP) -> method-negotiation reply fails validation -> fail closed.
6. Strict mode ON, SOCKS listener replies with malformed/truncated bytes,
   or times out -> fail closed, no fallback.
7. DNS-leak negative: synthetic non-resolvable hostname, `node:dns` spied,
   zero calls, SOCKS server receives the hostname as ATYP=0x03 domain.
8. Strict mode ON, READY, one successful connection, then the fake SOCKS
   server is killed mid-"session" -> next connection attempt fails closed
   (DEGRADED -> re-probe -> FAILED_CLOSED), no direct fallback observed at
   the clearnet trap.
9. Strict mode OFF (default) -> ordinary direct factory used, unchanged
   behavior (regression check against the EXISTING direct-path tests, not
   a new assertion).
10. Legacy-fallback-still-proxied: force a Ratchet-unavailable send and a
    normal Ratchet-active send, both through strict mode ON with the fake
    SOCKS server up; both observed to route through the SAME fake SOCKS
    server (proves §8 of `03_STRICT_TRANSPORT_ARCHITECTURE.md` directly,
    not by inspection alone).
11. Security UI copy grep: no forbidden word (Anonymous/Hidden/
    Untraceable/Private mode) anywhere in the new source files.
12. Default-off: a fresh Settings load with no prior config has
    `strictTorEnabled === false`.
