# Network Surface Inventory — Current Product (arc/fedos-installed-startup-root-cause)

**Scope note:** this document covers the code reachable from the current
branch's HEAD only (`b886a176`, `git rev-parse HEAD` at time of writing).
All inspection was static/offline: no process was launched, no network
call was made, no branch was checked out or changed.

## 0. Headline finding

There is **exactly one real network exit** in the shipped product: outbound
WebSocket connections to user-configured Nostr relay URLs, made through a
single Node/Electron global `WebSocket` constructor, and all real callers
reach it through the same two factory functions. Every other apparent
"network" hit found by a broad grep (`fetch(`, `http.get`, IPFS, `child_process`)
resolves, on inspection, to one of: (a) dead/inert prototype code never
wired into the shipped Electron entry point, (b) a purely local-disk or
in-memory implementation that is honestly self-labelled `requiresNetwork:
false`, or (c) a comment/docstring mentioning the word, not a live call.
There is no auto-update mechanism, no telemetry/analytics call, no DNS
call written directly by this codebase, and no `child_process`/`spawn`
invocation of any external network tool anywhere in `src/`/`packages/`
production code.

## 1. The one real network exit: Nostr relay WebSocket

### 1.1 The abstraction

All relay I/O funnels through **one socket-factory function**,
`createNodeWebSocketRelaySocketFactory()`, defined at
`src/os/messenger/desktop/node_websocket_relay_socket_factory.ts:43-57`.
It wraps the real, global `WebSocket` constructor that Node 22+/Electron
already ships (no `ws` npm package, confirmed no such dependency exists —
see §1.4) and resolves only once the socket's own `"open"` event fires
(`node_websocket_relay_socket_factory.ts:44-56`).

`src/desktop/node_websocket_relay_socket_factory.ts` is a **compatibility
shim** (`@deprecated`, `export * from "../os/messenger/desktop/node_websocket_relay_socket_factory.js"`)
kept only so any not-yet-migrated importer still resolves; it re-exports
the same function, it is not a second implementation.

The factory is consumed by two relay classes, both of which are
**transport-injected — neither ever calls `new WebSocket()` itself**:

- `WebSocketRelay` (read+write, connection lifecycle + pub/sub) —
  `src/os/messenger/desktop/websocket_relay.ts:232-357`. Constructor takes
  `(url: string, factory: FedosRelaySocketFactory)`
  (`websocket_relay.ts:241-244`); `connect()` calls `this.#factory(this.url)`
  (`websocket_relay.ts:250`) and never constructs a socket directly — this
  is enforced by an explicit guardrail comment and by a structural test
  (`test/secure_runtime_alpha_214_websocket_relay_connection_only.test.ts:71`,
  `test/secure_runtime_alpha_235_websocket_inbound_wiring.test.ts:74`, both
  assert no `new WebSocket(` literal exists in that file's own code).
- `WebSocketRelayAdapter` (read-only NIP-01 query) and
  `WebSocketRelayPublisher` (write-only publish+OK-wait), both in
  `src/os/messenger/adapters/nostr/protocol/{ws_relay.ts,publish.ts}`.
  Same injected-factory discipline: `ws_relay.ts:44-47` takes a
  `WebSocketFactory` type, never constructs a socket inline
  (`ws_relay.ts:11-14` explicitly documents this — it also supports a
  Cloudflare-Worker-style `fetch(..., {Upgrade})` factory, not used by the
  desktop app).

### 1.2 Production wiring (the only place the factory is actually called from real code)

`packages/fedos-desktop-electron-spike/src/fedos_electron_beta_main.cts`
is the Electron main-process entry point and the **only** place in the
whole repository that calls `createNodeWebSocketRelaySocketFactory()`
with real intent (as opposed to a doc comment or test). Confirmed by
direct grep — every one of the following lines passes the SAME factory
call into either a `WebSocketRelayPublisher` (write) or a
`WebSocketRelayAdapter` (read):

- Publish sites: `fedos_electron_beta_main.cts:3443`, `:3793`, `:4066`,
  `:4345`, `:4632`, `:4655`.
- Subscribe/read sites: `fedos_electron_beta_main.cts:3606`, `:3669`,
  `:4002`, `:4211`, `:4544`, `:4876`, `:4917`.

The relay URL fed into every one of these calls comes from
`activeRelays[0]?.url` (`fedos_electron_beta_main.cts:3442`), i.e. the
user's own configured relay list in Settings — never a hardcoded literal.
`fedos_electron_beta_main.cts:938` records this explicitly: *"the real,
production `FedosRelay` implementation (`WebSocketRelay`, Node 22+'s own
global `WebSocket`, no new dependency) and its one real socket factory.
Never `NullRelay` (test-only, no real network I/O) in this canonical
packaged entry point."*

`NullRelay` (`src/os/messenger/desktop/null_relay.ts`) is the test-only,
zero-I/O stand-in `WebSocketRelay` was designed alongside; it is never
constructed by the real Electron main process.

### 1.3 Classification: ONE shared abstraction, not scattered ad-hoc calls

Every real relay connection in the product — read (subscribe/query) and
write (publish) — passes through the same two constructor points
(`WebSocketRelayAdapter`/`WebSocketRelayPublisher` on the Nostr-protocol
side used by messaging, `WebSocketRelay` used by the Messenger desktop
layer, `WebSocketRelayPublisher`/`WebSocketRelayAdapter` again under the
`CommerceNostr` namespace for Commerce catalog/order/media-release
events) and every one of them is handed the same
`createNodeWebSocketRelaySocketFactory()` result. There is no second,
independent `new WebSocket(url)` call anywhere in production code — the
only other literal `new WebSocket(url)` occurrences in the repository are
inside test files (`test/commerce_nostr_real_relay_two_party_discovery.test.ts:119`,
`test/commerce_nostr_real_relay_private_order_sync.test.ts:108`,
`test/secure_runtime_alpha_7001_7080_relay_server_smoke.test.ts:27`) which
spin up a local, real, in-process relay **server** to test against —
outbound-only sockets to `ws://127.0.0.1:<test-port>`, not the shipped
network surface.

**Verdict: concentrated, not scattered.** A single injected-socket
discipline is enforced by structural tests
(`test/secure_runtime_alpha_214_websocket_relay_connection_only.test.ts`,
`test/secure_runtime_alpha_235_websocket_inbound_wiring.test.ts`), and one
factory function is the sole real implementation of that seam.

### 1.4 No `ws` npm dependency, no relay pool, no auto-reconnect

`node_websocket_relay_socket_factory.ts:9-12` states, and a dependency
check confirms, this relies on the runtime-global `WebSocket` — no `ws`
package is a dependency anywhere (`package.json`/`package-lock.json`
searched, no `"ws"` entry). There is no relay pool and no automatic
reconnect/backoff — `websocket_relay.ts`'s own header states this
explicitly, and `test/secure_runtime_alpha_8041_8120_real_user_facing_vertical_slice.test.ts:385-407`
independently confirms via a live UI test that a disconnected relay does
NOT auto-recover; the user must lock/unlock to force a fresh
`WebSocketRelay`.

## 2. `fetch(` matches — none are real network calls

Grepped `fetch\(` across `src/` and `packages/`: 4 matches in `src/`, 2 in
`packages/` (excluding `node_modules`/`dist-package-beta` build output).

| File | What it is |
|---|---|
| `src/os/messenger/adapters/nostr/protocol/ws_relay.ts:12` | Comment only — documents a *hypothetical* Cloudflare-Worker socket-upgrade factory shape (`fetch(..., {Upgrade})`); not exercised by the desktop app, no literal `fetch(` call in code. |
| `src/os/core/vault/wasm/fedos_wasm_loader.ts:728,2696` | Comments only, describing a browser-only fallback (`fetch(new URL(...), import.meta.url)`) for loading the **local** WASM artifact bytes — never reaches a remote host, and the file's own "HARD GUARDRAILS" section explicitly forbids any `fetch` call in its actual code ("NO ... `fetch` reference of any kind"). |
| `src/os/_legacy_prototype/worker.ts`, `src/os/_legacy_prototype/promotion/edge_rec_adapter.ts` | Under `_legacy_prototype/` — dead code, not part of the ~29 files that actually ship (per prior FedOS Scope Freeze audit); not reachable from the Electron entry point. |
| `packages/meshkv/src/peer_cache.ts:38-41` | `PeerCache.fetch()` — a **method named** `fetch`, not a call to the global `fetch` API. Its body is a hardcoded `return null;` with the comment "no real peer fetch in this stage." Boundary stub only; `connect()` does not start any WebRTC/signaling. |
| `packages/fedos-desktop-electron-spike/dist-package-beta/win-unpacked/resources/fedos-core-rust/pkg/fedos_core_rust.js` | Pre-built `wasm-bindgen` JS glue inside a build artifact directory (`dist-package-beta/`), not source; wasm-bindgen's own generated `fetch()` fallback for loading the `.wasm` binary locally. Not hand-written product code. |

No `node-fetch`, `undici`, or `axios` dependency exists in any
`package.json` in this repository (root, `fedos-core-rust`,
`fedos-desktop-electron-spike`, `meshkv`) — the only matches for those
strings are inside `package-lock.json` transitive-dependency trees and
inside test/doc files that use the words "federation boundary" etc. as
substrings of unrelated identifiers, not an actual import.

## 3. `http.request`/`https.request`/`http.get`/`https.get` — no matches

Zero matches anywhere in `src/`/`packages/` production or test code.

## 4. `net.connect`/`net.createConnection`/`tls.connect` — one real hit, and it is the SOCKS client on an *unmerged* branch, not the current product

Zero matches in the current branch's `src/`/`packages/`. (The one real
`node:net` **socket** consumer in the whole repository —
`fedos_electron_tor_socks_client.ts`'s `net.Socket`/`net.connect`-style
TCP dial to a local SOCKS proxy — lives only on the unmerged
`feature/commerce-tor-*` branch family; see
`04_TOR_EXISTING_ASSET_AUDIT.md` §2. It is not reachable from this
branch's HEAD.)

## 5. `dgram` (UDP) — no matches

Zero matches.

## 6. `dns.lookup`/`dns.resolve` — no explicit DNS call anywhere

Zero direct `node:dns` usage anywhere in `src/`/`packages/`. See Part 3
below for what this implies about where DNS resolution actually happens
(implicitly, inside the runtime's own `WebSocket`/TCP stack).

## 7. Electron `net`/`session` module — no usage

No `electron.net`, `require("electron").net`, or
`session.defaultSession` usage anywhere in production code. (A broad
`session\.defaultSession` grep across the whole repo timed out on repo
size; a targeted grep of the Electron main process
(`fedos_electron_beta_main.cts`) and `src/desktop/` for
`setProxy`/`proxyRules`/`--proxy-server`/`session.defaultSession`
returned zero hits.) Electron's own net stack is never touched directly
— all network I/O goes through the plain `WebSocket` global (§1).

## 8. `child_process`/`spawn`/`exec` invoking an external network tool — none found

A broad grep for `child_process|spawn\(|execFile\(|exec\(` returns 154
files, but this is dominated by the substring `exec(` inside identifier
names and prose ("**exec**ution", "co**exec**ute", test file names) —
confirmed no file in `src/`/`packages/` production code imports
`node:child_process` (`grep require\(.child_process.\)\|from .child_process.`
returns zero results anywhere, including test files). Nothing in this
codebase spawns `curl`, `wget`, `git clone`, or a Tor/other external
binary from the current branch.

(The one real `child_process`-spawning file in the whole repository —
`fedos_electron_tor_runtime.ts`'s controlled `spawn()` of the bundled
`tor.exe` — again lives only on the unmerged `feature/commerce-tor-*`
branch family; see `04_TOR_EXISTING_ASSET_AUDIT.md` §2. Not reachable
from this branch's HEAD.)

## 9. Commerce protected-content delivery — purely local disk, never HTTP

Investigated `src/os/commerce/catalog/`'s media-delivery path in detail:

- `src/os/commerce/catalog/persistence/durable_ipfs_transport.ts` —
  `DurableIpfsTransport` (`durable_ipfs_transport.ts:137-169`). Content-
  addressed (`fake-cid:<sha256>`), written/read via plain synchronous
  `node:fs` calls (`writeFileSync`/`readFileSync`/`linkSync`,
  `durable_ipfs_transport.ts:69`) under a profile-scoped local directory.
  `readonly requiresNetwork = false` is declared explicitly
  (`durable_ipfs_transport.ts:138-139`): *"a local disk directory never
  reaches a network, under any circumstance."*
- `src/os/commerce/catalog/ipfs_media_store.ts` — `InMemoryIpfsTransport`
  (`ipfs_media_store.ts:202-238`) is the OTHER (and, per its own header,
  the ONLY other) `IpfsTransport` implementation that exists; it is a
  bare in-memory `Map`, also `requiresNetwork = false`
  (`ipfs_media_store.ts:207`). `IpfsMediaStore.put()`/`get()`
  (`ipfs_media_store.ts:363-376`) gate on the transport's own honest
  `requiresNetwork` self-report before consulting `NetworkProfile`
  (`network_profile.ts`, see `04_TOR_EXISTING_ASSET_AUDIT.md` §1) —
  fail-closed if a future network-backed transport lied about it.
  `ipfs_media_store.ts:1-19` states plainly: no genuinely network-backed
  `IpfsTransport` implementation is built by this arc, and a CID is
  "metadata, not confidentiality" — fetching over IPFS is never claimed
  to be anonymous.
- Net effect: **every real byte of protected/digital-delivery content in
  the shipped product moves over the local filesystem or in-process
  memory, never over HTTP/IPFS-network, and never over the Nostr relay
  transport either** (the Nostr relay carries only small JSON
  events/metadata, e.g. `MediaAccessGrant` release events — see
  `src/os/commerce/events/commerce_private_media_release_sync.ts` — never
  the media bytes themselves).

## 10. Update/download mechanism — confirmed absent in code, not just docs

`docs/reviews/fedos_beta_distribution_v1/15_automatic_update_decision.md:26-35`
records the explicit verification: no `electron-updater` (or any
auto-update package) dependency anywhere in `package.json`/
`package-lock.json` (root or Electron package), and no update-server
endpoint, update-feed config, or update-check code anywhere in `src/`/
`packages/`. Independently confirmed here: `grep -r "electron-updater\|autoUpdater"`
across the whole repository returns zero matches. The frozen source fact
is `autoUpdateEnabled: false` in `fedos_desktop_beta_release_configuration.ts`.
**Decision A ("no automatic update") is not merely documented — the
codebase currently has zero lines of auto-update code to remove.**

## 11. Summary table

| Exit point | Real in shipped product? | Abstraction | Ad-hoc or centralized? |
|---|---|---|---|
| Nostr relay WebSocket (read+write) | **YES — the only real one** | `createNodeWebSocketRelaySocketFactory()` → global `WebSocket` | Centralized (2 factory call-sites, ~13 real constructor sites, all in `fedos_electron_beta_main.cts`) |
| `fetch()` to any host | No | — | N/A — no live call exists |
| `http(s).request/get` | No | — | N/A |
| `net.connect`/`tls.connect` | No (current branch) | — | N/A |
| `dgram` (UDP) | No | — | N/A |
| Explicit `dns.*` call | No | — | N/A (see Part 3 for implicit resolution) |
| `electron.net`/`session.defaultSession` | No | — | N/A |
| `child_process` spawning a network tool | No (current branch) | — | N/A |
| IPFS / protected-content delivery | No — local disk/memory only | `IpfsTransport` (`requiresNetwork` self-report) | N/A |
| Auto-update | No | — | N/A |

## 12. Part 3 — DNS policy for the relay connection path

The relay connection code identified in §1 (`createNodeWebSocketRelaySocketFactory()`,
`node_websocket_relay_socket_factory.ts:43-57`) constructs `new WebSocket(url)`
directly against the relay URL string (e.g. `wss://relay.example.com`)
supplied by the caller. There is:

- **No proxy option of any kind** on this path — the factory takes only a
  `url: string` and returns a `Promise<FedosRelaySocket>`
  (`node_websocket_relay_socket_factory.ts:43`); there is no
  `agent`/`proxy`/`socksHost` parameter anywhere in `WebSocketFactory`,
  `FedosRelaySocketFactory`, `WebSocketRelay`, `WebSocketRelayAdapter`, or
  `WebSocketRelayPublisher`'s constructors.
- **No explicit `dns.lookup`/`dns.resolve` call anywhere in this path** —
  confirmed by the zero-match grep in §6. Hostname resolution therefore
  happens **implicitly**, inside whatever the runtime-global `WebSocket`
  implementation does internally (Node/Electron's own networking stack —
  ultimately `net.connect`/the OS resolver) the moment `new WebSocket(url)`
  is constructed (`node_websocket_relay_socket_factory.ts:46`).
- **Conclusion: plain Node/Electron DNS resolution happens BEFORE any
  proxy or Tor routing could apply**, because there is no proxy layer to
  defer to in the first place. A relay hostname is resolved by the
  ordinary system/Node resolver, and the resulting TCP connection is made
  directly — the exact opposite of "DNS deferred to the proxy." This is a
  factual, current-state observation only; no proxy-aware connection path
  exists on this branch to compare against (contrast with the injected
  SOCKS5 client on the unmerged Tor branch — `04_TOR_EXISTING_ASSET_AUDIT.md`
  §2 — which explicitly documents, in its own header, that it sends the
  target hostname as a SOCKS5 ATYP=0x03 domain name specifically so DNS is
  NEVER resolved locally: `fedos_electron_tor_socks_client.ts:9-19` on that
  branch. No equivalent guarantee exists anywhere on the current branch).

## 13. See also

`04_TOR_EXISTING_ASSET_AUDIT.md` — the Tor-specific asset inventory,
including a substantial real implementation (bundled Tor binary, SOCKS5
client, control-port client, onion service) that exists only on an
**unmerged sibling branch family** (`feature/commerce-tor-*`), not on
this branch's HEAD, and is therefore excluded from the "current product"
counts above.
