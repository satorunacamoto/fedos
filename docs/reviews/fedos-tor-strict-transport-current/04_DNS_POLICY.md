# DNS Policy

## Current (direct path, strict mode OFF)

Implicit — `new WebSocket(url)` resolves the hostname via the Node/Electron
runtime's own resolver before connecting. No proxy layer exists to defer
to. Documented and unchanged by this arc (§2 of `01_CURRENT_NETWORK_SURFACE.md`).

## Strict mode (ON)

Remote DNS only. The relay hostname is parsed out of the `wss://`/`ws://`
URL as a plain string (`new URL(url).hostname`) — no `dns.lookup`,
`dns.resolve`, `net.isIP`-then-branch, or any other local-resolution call
is ever made on it. It is handed verbatim to `socks5Connect()` as
`targetHost`, which the ported SOCKS5 client sends as SOCKS5 `ATYP=0x03`
(domain name) — resolution happens on the Tor/proxy side, per RFC 1928.

`wss://` TLS is layered via `tls.connect({socket, servername: hostname})`
on top of the already-SOCKS-connected raw socket — `servername` here only
selects the SNI/certificate check on an already-open connection; it never
triggers a DNS call.

## Required negative proof (`09_ACCEPTANCE_MATRIX.md` item 7)

A synthetic non-resolvable hostname (e.g.
`fedos-strict-transport-dns-leak-canary.invalid`) is used as the relay
target in strict mode against a local fake SOCKS server. `node:dns`'s
`lookup`/`resolve`/`resolve4`/`resolve6` are monkey-patched (test-only, via
`vi.spyOn` on the `node:dns` module import) for the duration of the test
and asserted to receive zero calls, while the fake SOCKS server records
receiving the hostname as a domain-name (`ATYP=0x03`) CONNECT target.
