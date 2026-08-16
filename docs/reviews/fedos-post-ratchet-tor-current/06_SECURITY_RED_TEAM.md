# Tor Integration — Security Red Team

**Status**: Adversarial read-only review. No source file was modified to produce this document, no
process was launched, no network was touched. Repo root `C:/wt/fedos-installed-startup-root-cause`,
branch `arc/fedos-installed-startup-root-cause`. Grounding documents: `03_NETWORK_SURFACE_INVENTORY.md`
and `04_TOR_EXISTING_ASSET_AUDIT.md` (this repository, same directory) — read in full before this
document was written, both facts restated here are taken as established, not re-derived. Stale-branch
source was read via `git show feature/commerce-tor-live-final-v1:<path>` only; that branch was never
checked out as a working tree.

**Two grounding facts carried forward from the prior audits, load-bearing for everything below:**

1. On the CURRENT branch, the one real network exit is `createNodeWebSocketRelaySocketFactory()` →
   the runtime-global `WebSocket` constructor, injected into `WebSocketRelay` /
   `WebSocketRelayAdapter` / `WebSocketRelayPublisher`. No proxy/SOCKS parameter exists anywhere in
   that chain. No Tor code of any kind is reachable from this branch's HEAD beyond an inert
   `NetworkProfile` label and an empty `src/os/messenger/onion/` seam.
2. A substantial, real, once-live-tested Tor implementation exists on the unmerged
   `feature/commerce-tor-*`/`agent/tor-*` branch family (tip inspected here:
   `feature/commerce-tor-live-final-v1`), built against the OLD pre-modularization `src/desktop/`
   layout. It is inert with respect to the current product — nothing on HEAD imports it.

Every section below is analyzed against both **(S) adapt the stale branch** and **(F) build fresh
against the current `src/os/*` layout**, noting where the two diverge.

---

## 1. Tor bypass (silent fallback to a direct connection)

**Does the stale SOCKS5 client have a fail-open mode?** No. Read in full:
`fedos_electron_tor_socks_client.ts` (stale branch). `socks5Connect()` has exactly one control path —
greet, optionally authenticate, send `CONNECT`, read the reply. Every non-`0x00` reply code, every
socket `error`/timeout, and every malformed reply throws a `TorError` and calls `socket.destroy()`
in a `catch` before rethrowing (lines ~137-165 of that file). There is no branch anywhere in the
function that, on SOCKS failure, opens a second, non-SOCKS `net.Socket` to the same target. This is
independently confirmed by a **behavioral** test the stale branch ships:
`fedos_electron_tor_aggregate_network_safety.test.ts` check 10 — a real (fake) SOCKS5 server with an
empty route table is dialed, the call is asserted to `.rejects.toThrow()`, and the test explicitly
frames this as "rejects an unroutable destination **without ever falling back to a direct
connection**." Check 1 of the same file goes further and is a static source scan asserting NONE of
the twelve Tor source files import the Nostr relay transport (`resolveCommerceRelayTransport`) or a
generic HTTP client (`fetch(`, `node:https?`) — i.e. the stale implementation has a standing,
enforced, structural guarantee against exactly this bypass, not just an absence-of-evidence.

**Does the CURRENT WebSocket relay client have retry/reconnect logic that could be naively wired into
this bypass?** No, and this is worth stating precisely because it changes the risk shape: per
`03_NETWORK_SURFACE_INVENTORY.md` §1.4 and confirmed directly here by reading
`websocket_relay.ts:246-267`, `WebSocketRelay.connect()` is one-shot — on the underlying socket's
`"close"`/`"error"` event it only sets `#connected = false` and drops the socket reference; there is
no retry loop, no backoff, no automatic re-`connect()` call anywhere in the class or in
`node_websocket_relay_socket_factory.ts`. **There is currently nothing to "naively wire."** The real
risk is not "existing reconnect logic gets misused" — it is that the *next* arc that adds
retry/reconnect to `WebSocketRelay` (a plausible, even desirable, future change on its own) will be
the first place a "try Tor, fall back to direct on failure" catch-and-retry pattern could be
introduced, and the single-shared-factory design (§1.3 of `03_NETWORK_SURFACE_INVENTORY.md` —
one factory, ~13 real call sites) means getting the fallback behavior wrong there would affect
literally every relay connection in the product at once, not one call site.

- **(S)**: the stale `socks5Connect()` itself is safe to adapt as-is on this axis; the bypass risk is
  entirely in how a *new* integration layer decides what to do when `socks5Connect()` throws — the
  stale code gives that decision nowhere to hide (it just throws), which is the right shape to
  preserve.
- **(F)**: identical risk and identical correct shape — a fresh SOCKS client should copy this
  exact discipline (throw, never silently retry non-SOCKS), and the fresh integration layer sitting
  above `createNodeWebSocketRelaySocketFactory()` is the same place the risk would live.
- **Verdict: no bypass exists today on either branch.** The bypass is a property of code that does not
  yet exist (the strict-mode decision layer, §5). This is the single most important thing this section
  establishes: the danger is not in either Tor implementation, it is in whatever un-written glue code
  decides what "Tor failed" means.

## 2. DNS leak

Per `03_NETWORK_SURFACE_INVENTORY.md` §12, DNS resolution on the current relay path happens
implicitly the moment `new WebSocket(url)` is constructed — inside Node/Electron's own network stack,
before any proxy layer could apply, because no proxy layer exists to defer to.

**What would need to change, concretely?** Node's/Electron's built-in `WebSocket` global (the
`undici`-backed implementation Node 22+/Electron ship) has **no constructor option for a proxy or a
custom dispatcher** — its constructor signature is `(url, protocols?)` only; there is no `agent`,
`dispatcher`, or `fetch`-style `dispatcher` init option exposed on the `WebSocket` class itself (this
is a well-known undici/WHATWG-`WebSocket` API-surface gap, not something specific to this codebase —
`fetch()` in the same runtime accepts a `dispatcher` via `undici`'s `ProxyAgent`, but the global
`WebSocket` constructor does not thread that same option through). **Concrete mechanism required**:
`createNodeWebSocketRelaySocketFactory()` cannot be changed to "pass a proxy option to `new
WebSocket()`" — no such option exists. The only two mechanisms that actually work:
1. **Custom transport, not custom `WebSocket`**: replace the factory's guts with a hand-rolled
   WebSocket-handshake-over-a-raw-socket implementation, where the raw socket is obtained via
   `socks5Connect()` (exactly what the stale branch's `net.Socket`-based approach does for its own
   Commerce-over-Tor TCP path — it never goes through the `WebSocket` global at all, it does the
   framing itself in `fedos_electron_tor_wire_protocol.ts`). For a *WebSocket* relay specifically this
   means either vendoring a WS-handshake-over-socket shim or moving to a WebSocket library that
   accepts a `net.Socket`/`Duplex` it did not create (Node's `undici` `WebSocket` does not expose
   this hook publicly as of the versions in use here).
2. **Global `undici` dispatcher override**: Node's `WebSocket` global is undici-backed, and undici
   exposes `setGlobalDispatcher(new ProxyAgent(...))` — but `ProxyAgent` is an **HTTP(S) CONNECT**
   proxy client, not a SOCKS5 client; there is no built-in `SocksProxyAgent`-equivalent in undici's
   own dispatcher set. Using this mechanism would still require a hand-written SOCKS5-to-dispatcher
   adapter, which is a strictly *harder* surface to get the DNS-never-resolved-locally guarantee right
   on than the stale branch's narrow, purpose-built `socks5Connect()`, since a general dispatcher
   override affects every `fetch`/`WebSocket` call process-wide, not just the relay factory.
- **(S)**: the stale branch never actually solved this for the *relay* case — its SOCKS client is used
  only for the raw, hand-framed Commerce-over-Tor TCP channel (`fedos_electron_tor_wire_protocol.ts`),
  never routed under a `WebSocket`. Adapting the existing SOCKS client is necessary but not
  sufficient — a new "WebSocket relay over Tor" shim (mechanism 1 above) is unbuilt work on either
  branch.
- **(F)**: identical unbuilt work; no advantage either way. This is a genuine gap in **both** the
  stale branch and a from-scratch design — name it as such rather than assuming the stale branch
  already covers the relay's DNS-leak case, because it does not.
- **Conclusion**: DNS-leak-safe Tor routing for the Nostr relay WebSocket is **not fully solved by
  either branch today**. The stale branch supplies a correct, reusable SOCKS5 primitive
  (`socks5Connect()`, with its verified never-resolve-locally discipline) but the WebSocket-specific
  transport shim that would consume it for *this specific* connection type does not exist anywhere in
  this repository's history.

## 3. Direct socket bypass (other code paths)

Re-verified against `03_NETWORK_SURFACE_INVENTORY.md`'s own inventory (§§2-8, §11 summary table): zero
`fetch`, zero `http(s).request`, zero `net.connect`/`tls.connect`, zero `dgram`, zero
`electron.net`/`session.defaultSession`, zero `child_process` spawning a network tool, anywhere in
`src/`/`packages/` on the current branch, beyond the one relay factory.

**Rust/WASM boundary, checked directly for this review**: `packages/fedos-core-rust/src/lib.rs`
(16,537 lines) contains exactly one substring match for `fetch` in the whole file
(`REAL_SECRET_ZEROIZE_CALLS.fetch_add(1, Ordering::SeqCst)` — an atomic counter's `.fetch_add()`
method, unrelated to networking), and zero matches for `http`, `net::`, or `dns::`. `Cargo.toml`'s
dependency list (already recorded in `04_TOR_EXISTING_ASSET_AUDIT.md` §1.6) is
`chacha20poly1305`/`hkdf`/`zeroize`/`secrecy`/`subtle`/`argon2`/`aes-gcm`/`getrandom`/`sha2`/`k256`/
`wasm-bindgen` — no networking crate (no `reqwest`, `hyper`, `tokio` with net features, `socket2`) of
any kind. **Confirmed: the Rust/WASM side does zero networking of its own, on either branch.** This is
architecturally sound for Tor purposes — the WASM boundary is a pure compute module (crypto
primitives), never a second, independent network actor that a Tor-routing layer could be bypassed by.

- **(S)/(F)**: identical — this finding is branch-independent. Whichever way Tor integration is built,
  the Rust/WASM boundary is not a bypass vector and needs no Tor-awareness of its own, now or later.

## 4. Commerce network bypass

Re-verified against `03_NETWORK_SURFACE_INVENTORY.md` §9: every real byte of protected/digital-delivery
content moves over local filesystem (`DurableIpfsTransport`) or in-process memory
(`InMemoryIpfsTransport`), both self-declared `requiresNetwork = false` and gated on that self-report
by `IpfsMediaStore.put()`/`get()`. Commerce catalog/order/media-release *metadata* (not media bytes)
travels over the same `WebSocketRelayPublisher`/`WebSocketRelayAdapter` pair used by messaging, under
the `CommerceNostr` namespace — the SAME factory, not a second one. **On the current branch, Commerce
has no network path independent of the one Nostr relay transport.**

- **(S)**: adapting the stale branch changes this materially. `TorCommerceTransport` (via
  `fedos_electron_tor_commerce_transport.ts`) is a **genuinely separate, point-to-point transport** —
  a direct SOCKS5-through-Tor TCP connection to a merchant's onion service, entirely independent of
  the Nostr relay. This is by design (documented in the stale branch's own
  `docs/commerce/tor/TOR-PRIVACY-LIMITATIONS.md`, referenced in its transport-file header, as a known
  alpha limitation of Tor's own topology: point-to-point, not "any client reaches any recipient via a
  shared relay"). This is not itself a bypass of Tor-routing — it never touches the Nostr relay at
  all in Tor mode — but it means Commerce would gain a **second, independently-built network stack**
  (loopback-only local Commerce TCP service + onion service, verified in aggregate-safety-test checks
  3 and 5) that any future Tor-integration audit must track *separately* from the messenger relay
  path, not assume is covered by whatever gate is built for `WebSocketRelay`. The aggregate test
  suite's own check 6 ("no arbitrary destination proxying... never a renderer-controlled arbitrary
  host/port pair") and check 8 (no renderer access to onion-service private keys) show this was taken
  seriously on the stale branch, but the mode-confusion risk (does the UI ever let a user believe
  they're in "Tor mode" for Commerce while a stale/parallel Nostr-relay-backed Commerce session is
  still live?) is a genuinely new question this integration would raise, not one the stale branch's
  own tests answer today — `TorRuntimeController`/`TorBuyerRuntimeController` each own their own
  `TorUiPhase`, with no cross-check against whatever the ordinary (non-Tor) Commerce session state is
  doing concurrently.
- **(F)**: building fresh against the current `src/os/commerce/*` layout would inherit the SAME
  question (does a from-scratch design also introduce a second transport for Commerce, or keep
  Commerce entirely relay-only and only Tor-wrap the relay?) — this is a design decision the fresh
  path has NOT yet made, whereas the stale branch already committed to "separate onion-service
  transport." Worth flagging as a design choice to make deliberately, not by default: routing Commerce
  through Tor by *wrapping the existing relay path* (keeping one transport, Tor-tunneled) is a smaller
  attack surface than *adding a second, point-to-point transport*, at the cost of losing the stale
  branch's stronger buyer/seller un-linkability properties that the separate onion-service approach
  was built for.

## 5. Fallback-to-clearnet as a policy question

Given the current codebase's "one shared abstraction" transport design (§1.3 of
`03_NETWORK_SURFACE_INVENTORY.md` — one `createNodeWebSocketRelaySocketFactory()` call, ~13 real
construction sites, all downstream of the same function), **the one authoritative place a "route
through Tor or fail closed" decision must live is inside that factory function itself, before a
socket is ever created** — not in any of the ~13 call sites, not in `WebSocketRelay`/
`WebSocketRelayAdapter`/`WebSocketRelayPublisher` (which are transport-injected and must stay ignorant
of *how* their socket was obtained), and not in a UI-layer setting alone (a UI toggle can express
*intent*, but the enforcement point must be the factory, or a toggle that fails to actually gate the
factory is exactly a silent-downgrade bug). Concretely: `createNodeWebSocketRelaySocketFactory()`
would need to become (or be replaced by) something that, given a strict-Tor policy is active, either
successfully returns a SOCKS5-tunneled socket or throws — with **no path in between that returns a
plain, direct socket while a strict-Tor policy is active**. This mirrors exactly why `network_profile.ts`
existing as an inert, zero-caller label today (§1.4 of `04_TOR_EXISTING_ASSET_AUDIT.md`) is not itself
a risk — the risk only begins the moment something starts consulting it, and if that "something" isn't
the socket factory itself, the policy is decorative.

- **(S)**: the stale branch's `TorRuntimeController.start()` already demonstrates the right shape for
  its OWN transport — production (`isPackaged: true`) resolves the bundled Tor binary with "no fallback
  of any kind: a missing or corrupted bundled runtime fails closed right here" (comment at
  `fedos_electron_tor_runtime_controller.ts:200-206`, confirmed by reading the surrounding code: on a
  failed bundle-resolution it sets `#phase = "setup-needed"` and returns, never falls through to
  `locateTorBinary()`'s external search in a packaged build). This discipline needs to be replicated at
  the relay-factory layer specifically, not assumed to transfer automatically from the Commerce-Tor
  controller to a *different* transport (the WebSocket relay) that the stale branch never actually
  touches.
- **(F)**: same requirement, no existing prior art to draw the "fails closed by construction" pattern
  from other than the stale branch's own controller — worth deliberately reusing that shape even if
  building fresh.

## 6. Partial Tor startup — what does the stale client actually consider "ready"?

Read `fedos_electron_tor_runtime.ts` (`TorRuntime.startTor()`/`waitForBootstrap()`) directly: "ready"
is **not** process-spawn success. `startTor()` spawns the process and immediately sets
`#bootstrapStatus = { phase: "bootstrapping", percent: 0 }`; a `handle.onStdoutLine()` listener parses
each line against `BOOTSTRAP_LINE_RE = /Bootstrapped (\d{1,3})%/` and only transitions to
`{ phase: "bootstrapped" }` when a parsed percentage is `>= 100`. `waitForBootstrap(timeoutMs)` polls
this status in a loop and only resolves once `status.phase === "bootstrapped"`; it explicitly throws
if the process exits mid-bootstrap (`status.phase === "exited"`) rather than treating "the process is
still running" as sufficient. The controller (`TorRuntimeController.start()`) additionally requires,
AFTER `waitForBootstrap()` succeeds: `verifyNoExternalListener()` returns true (a structural
loopback-only check on the actually-generated torrc, plus an optional live TCP-refused probe), a
successful Control Port `connect()` + cookie `authenticate()`, and a successful onion-service
`createEphemeral()` call — only then does `#phase` become `"connected"`. **This is real
bootstrap-complete evidence, sourced from Tor's own stdout log line, not an inference from process
liveness.**

- **(S)/(F)**: this is a property worth preserving verbatim in either integration path — parsing
  `Bootstrapped 100%` (or the Control Port's equivalent async `STATUS_CLIENT BOOTSTRAP` event, which
  this client does not currently use but Tor also emits) is the correct signal; "process is running" or
  "SOCKS port accepts a TCP connection" are both insufficient (a freshly-spawned Tor process accepts
  SOCKS connections and simply hangs/fails circuit-building before bootstrap completes). A fresh build
  must not regress to a weaker "ready" signal for convenience.

## 7. Tor death during an active session

**Process-lifecycle monitoring on the stale branch, checked directly**: `TorRuntime.startTor()` does
register `handle.onExit((code, signal) => { this.#bootstrapStatus = { phase: "exited", ... }; })` —
so the *runtime object itself* always has an accurate exit record. But neither
`TorRuntimeController` (seller) nor `TorBuyerRuntimeController` (buyer) ever *polls* or otherwise
reacts to that exit record once `start()`/`connectToStore()` has already succeeded — the seller
controller's `pollTimer` (`setInterval(pollBootstrap, 250)`) is explicitly `clearInterval`'d right
after `waitForBootstrap()` returns, and no equivalent watcher is created for the post-connected
lifetime of the session. Grepped directly: `#phase = "interrupted"` is assigned in exactly one place
in each controller, and in both cases it is the `catch` block of an explicit, caller-initiated
operation (`connectToStore()` failing on the buyer side; there is no equivalent seller-side assignment
of `"interrupted"`/`"reconnecting"` at all — those two `TorUiPhase` enum members are declared in the
seller controller's type but **never assigned anywhere in that file**, confirmed by grep). **Net
finding: detection of a mid-session Tor crash is reactive-only** — the next explicit send/connect
operation surfaces the failure through its own error path; there is no passive/background watchdog on
either side of the stale branch that would proactively flip UI state the instant Tor actually dies.

**Does the current WebSocket relay's reconnect logic need Tor-health gating?** Moot today — per §1,
`WebSocketRelay` has no reconnect logic at all. The moment reconnect logic is added to it (a plausible
future change, independent of Tor), it becomes exactly the second thing (besides the factory itself,
§5) that would need explicit Tor-health awareness: a reconnect attempt must not silently succeed via a
non-Tor path if a strict-Tor policy is active and Tor itself has died, and per the reactive-only
detection finding above, "Tor health" is not something either branch currently exposes as a
continuously-monitored signal a reconnect loop could cheaply check — it would need to be built.

- **(S)/(F)**: identical gap on both — building fresh does not inherit a watchdog that doesn't exist on
  the stale branch either; this is real, unbuilt work regardless of which branch is the starting point.

## 8. Restart with stale Tor state

**Does the stale implementation persist any bootstrap/circuit-state durably?** No. Grepped every Tor
source file on the stale branch for persistence/durability language and file-write calls: the **only**
durably-persisted Tor-related state anywhere is the onion service's own long-term private key, via the
explicit, opt-in `persistServiceKey` callback in `fedos_electron_tor_onion_service.ts`
(`createPersistent()`), used specifically so a merchant's onion address survives a restart (the address
is deterministically derived from the key). That module's own comment is explicit about the general
case: *"a new Tor process has no memory of a previous ephemeral or persistent service, so a persistent
merchant re-registers its onion address... via this path on every restart."* **No bootstrap-status
flag, "last known ready" marker, or circuit-state record is ever written to disk anywhere in this
branch.** Every `TorRuntimeController`/`TorBuyerRuntimeController` instance starts a brand-new
`TorRuntime` (a fresh process, a fresh isolated data directory per `createIsolatedTorDataDirectory()`)
on every `start()` call and always re-runs the full `waitForBootstrap()` real-evidence check (§6) —
there is no code path that reads a previous run's status and skips re-verification.

- **(S)/(F)**: this is a genuinely good property to preserve, not a gap to fix — a fresh
  implementation must be careful NOT to introduce a "trust a cached ready flag on restart"
  optimization that the stale branch correctly never built. Name this explicitly as a thing to avoid
  adding, since it is exactly the kind of convenience shortcut ("skip the 30-60s bootstrap wait if we
  restarted recently") that would be tempting to add later and would reintroduce the risk this section
  asked about.

---

## 9. Consolidated REQUIRED FAIL-CLOSED INVARIANTS

Falsifiable statements. Format mirrors
`docs/reviews/fedos-direct-ratchet-identity-space-final/05_SECURITY_MIGRATION_THREAT_MODEL.md`'s own
INV-N list (different subsystem; format reused for consistency only). None of these exist as enforced
code today — they are requirements for whichever integration path (adapt-stale or build-fresh) is
chosen, not a description of current behavior.

1. **INV-T1 (Single enforcement point)**: the "route through Tor or fail closed" decision MUST be
   enforced inside the socket-factory function itself (`createNodeWebSocketRelaySocketFactory()` or
   its Tor-aware replacement) — never in `WebSocketRelay`/`WebSocketRelayAdapter`/
   `WebSocketRelayPublisher`, never only in a UI-layer setting, never independently duplicated at any
   of the ~13 real construction call sites in `fedos_electron_beta_main.cts`.
2. **INV-T2 (No fail-open on SOCKS failure)**: a SOCKS5 CONNECT failure, timeout, or malformed reply
   MUST terminate the connection attempt (throw) and MUST NOT be caught anywhere in the relay/Commerce
   connection path by logic that falls through to a plain, non-SOCKS `net.connect`/`new WebSocket(url)`
   call to the same or a resolved-equivalent target.
3. **INV-T3 (DNS never resolved outside the tunnel)**: no code path in a strict-Tor mode may call
   `dns.lookup`/`dns.resolve`, branch on `net.isIP()` to pick an ATYP, or otherwise resolve a relay
   hostname or `.onion` address before or outside the SOCKS5 CONNECT request; hostnames MUST always be
   sent as SOCKS5 `ATYP=0x03` domain names.
4. **INV-T4 (Loopback-only local listeners)**: every local port the Tor integration itself creates or
   binds (SOCKS port, Control port, any local Commerce service) MUST bind only `127.0.0.1`, verified
   both structurally (config/torrc content) and, where a live process exists, by an active
   connect-refused probe from a non-loopback interface.
5. **INV-T5 ("Ready" requires real bootstrap evidence)**: a Tor-dependent connection MUST NOT be
   attempted, and the UI MUST NOT report a Tor-backed transport as usable, until Tor's own reported
   bootstrap progress reaches 100% (parsed from Tor's own stdout `Bootstrapped NN%` lines or the
   Control Port's equivalent async status event) — process-spawn success, PID existence, or a SOCKS
   port merely accepting a TCP connection MUST NOT be treated as sufficient.
6. **INV-T6 (No stale "ready" trusted across restart)**: on every process start, the Tor-readiness
   state (bootstrap status, control-port authentication, SOCKS reachability) MUST be freshly
   re-verified from a brand-new Tor process; no previously-persisted "was ready" flag or cached
   bootstrap timestamp may ever substitute for re-running the real bootstrap-completion check in
   INV-T5. (Persisting long-term key material for a stable onion address, per the stale branch's
   opt-in `persistServiceKey` pattern, is explicitly permitted — persisting *readiness/status* is not.)
7. **INV-T7 (Mid-session death is actively detected, not merely reactively surfaced)**: once a
   Tor-backed transport reaches "connected"/"ready," the controller owning it MUST actively monitor
   the underlying Tor process's liveness (at minimum, react to the process's own `exit` event; ideally
   also periodic liveness/health confirmation) and MUST transition UI/session state out of
   "connected" the moment Tor dies — detection MUST NOT depend solely on the next unrelated
   application-level send/connect operation happening to fail first.
8. **INV-T8 (Reconnect logic, if ever added to the relay client, is Tor-health-gated)**: if
   `WebSocketRelay` (or any future relay client) gains automatic reconnect/retry logic, that logic
   MUST, under an active strict-Tor policy, confirm Tor is still bootstrapped and healthy (per INV-T5)
   before attempting any reconnect, and MUST fail closed (surface an error, never silently connect
   directly) if Tor is unavailable at reconnect time.
9. **INV-T9 (No renderer-controlled arbitrary destination)**: no IPC/preload-exposed channel may allow
   the renderer to supply an arbitrary host/port pair for a Tor-routed connection; the only accepted
   input shape is a validated address of the expected kind (a relay URL from Settings, or a validated
   v3 `.onion` address for Commerce), matching the stale branch's own `connectToStore(onionAddressInput:
   string)`-shaped surface, never a generic `connect(host, port)`/`proxyRequest` channel.
10. **INV-T10 (No proxy-environment escape hatch)**: the Tor-routing layer MUST NOT read or honor
    `HTTP_PROXY`/`HTTPS_PROXY`/`ALL_PROXY`/`NO_PROXY` or any other ambient system proxy configuration
    that could redirect a nominally Tor-routed connection through an attacker- or
    environment-controlled proxy instead.
11. **INV-T11 (No private key material crosses the renderer/IPC boundary)**: an onion service's
    private key MUST NEVER be exposed to the renderer process or logged/surfaced in any
    observability event; ephemeral (non-persistent) onion services MUST always be created with the
    Control Port's discard-private-key option set.
12. **INV-T12 (Structural test enforces INV-T1/T2 at the source level)**: a checked-in, CI-enforced
    static source scan (mirroring the stale branch's own
    `fedos_electron_tor_aggregate_network_safety.test.ts` check 1) MUST assert that no Tor-transport
    source file imports the plain relay transport, `fetch`, or `node:http(s)` — this is cheap
    insurance against exactly the "someone added a convenience fallback" regression this whole
    document is worried about, and the stale branch already demonstrates the pattern is practical to
    write and maintain.
13. **INV-T13 (Mode is never ambiguous to the user)**: if Commerce gains a second, Tor-native
    transport independent of the relay (as the stale branch's `TorCommerceTransport` does), the UI
    MUST make unambiguous, at all times, which transport a given Commerce session is actually using —
    a user must never be able to believe they are in "Tor mode" while a parallel, relay-backed,
    non-Tor Commerce session for the same store/order is concurrently live.

---

## 10. Summary of divergence between (S) adapt-stale and (F) build-fresh

The two paths diverge least on the *hard* guarantees (DNS-never-local-resolve discipline, loopback-only
binding, fail-closed bundled-binary resolution, real-bootstrap-evidence readiness, no-persisted-status)
— all five are already correctly built and test-enforced on the stale branch, and would need to be
independently re-invented, with equal care, if built fresh; there is no evidence either path is
structurally safer *at this level*. They diverge most on §2 (DNS-safe *WebSocket* relay tunneling —
genuinely unbuilt on both), §4 (whether Commerce gets a second transport or wraps the existing relay —
a design decision the stale branch already made one way, that a fresh build has not yet made at all),
and §7 (mid-session crash detection — reactive-only on the stale branch, and nothing to build on
either side yet). The stale branch's layout mismatch (old `src/desktop/`/`src/conversation/` shape vs.
current `src/os/messenger/`/`src/os/commerce/` shape, per `04_TOR_EXISTING_ASSET_AUDIT.md` §2.1) is a
real, non-trivial integration cost that this document does not re-litigate — it is an effort question,
separate from the security-grounds comparison this document was scoped to.
