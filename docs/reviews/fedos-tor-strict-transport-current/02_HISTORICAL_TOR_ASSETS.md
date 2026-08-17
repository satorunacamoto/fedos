# Historical Tor Asset Archaeology — Tor Strict-Transport arc

Full findings already exist at
`docs/reviews/fedos-post-ratchet-tor-current/04_TOR_EXISTING_ASSET_AUDIT.md`
(written at `b886a176`, still current — no commits between `b886a176` and
this arc's `c817b4ce` starting point touched any `feature/commerce-tor-*`
branch or `network_profile.ts`). Full classification reused verbatim rather
than re-derived; summarized and extended here with this arc's own reuse
decisions.

## 1. On current HEAD: no Tor implementation exists

`src/os/messenger/onion/` (empty reserved seam, honestly labelled),
`docs/fedos_onion_like_routing.md` (design notes, explicitly "NOT a Tor
alternative"), and `network_profile.ts` (`"direct"|"local-only"|"tor-optional"`
label type, zero callers) are the only Tor-adjacent artifacts on HEAD. No
SOCKS/proxy hook exists anywhere in the relay client. No Tor npm/Cargo
dependency. No bundled Tor binary reference anywhere.

## 2. On `feature/commerce-tor-live-final-v1` (unmerged, real, tested)

A substantial, real, once-live-tested Tor implementation exists on this
branch family, architecturally stale (pre-dates the `src/os/messenger/`
modularization — still shaped like the old `src/desktop/` layout), diverged
from mainline 2026-07-26, last touched 2026-08-05. Re-inspected the three
smallest, most self-contained, most reusable files directly (not just cited
from the prior audit) since this arc's own mandate explicitly prefers
porting proven assets over writing new ones:

| File | Lines | Reuse classification (this arc) |
|---|---|---|
| `fedos_electron_tor_socks_client.ts` | 179 | **REUSE_DIRECTLY** — a complete, dependency-free (only `node:net`), RFC 1928/1929-compliant SOCKS5 CONNECT client with a structural DNS-never-resolved-locally guarantee (always sends `ATYP=0x03` domain-name, never branches into an IP-address ATYP based on local resolution). Ported near-verbatim into this arc's own module (see `08_IMPLEMENTATION_PLAN.md`). |
| `fedos_electron_tor_errors.ts` | ~75 | **PATTERN_ONLY** — the closed-error-vocabulary-with-safe-`userMessage`-and-`advancedDetail` pattern is reused; the actual code vocabulary is much smaller for this arc (see below) since this arc does not implement Tor process spawn/bootstrap/onion-service (its codes — `tor-spawn-failed`, `bootstrap-timeout`, `onion-service-*` — do not apply to an EXTERNAL-Tor, SOCKS-only architecture; see `03_STRICT_TRANSPORT_ARCHITECTURE.md` §1 for that decision). |
| `fedos_electron_tor_isolation.ts` | ~65 | **PATTERN_ONLY** — the "derive a per-session SOCKS username/password from a session salt via SHA-256, `IsolateSOCKSAuth`" mechanism is reused in simplified form (this arc needs one isolation credential per process launch, not per-Commerce-persona/order scope — the original's `IsolationScope` union is Commerce-specific and out of this arc's mandate). |
| `fedos_electron_tor_bundled_runtime.ts`, `fedos_electron_tor_runtime.ts`, `fedos_electron_tor_runtime_controller.ts`, `fedos_electron_tor_control_port_client.ts` | — | **SUPERSEDED for this arc's scope** — these implement bundling/spawning/controlling an owned Tor process. This arc's own architecture decision (§1 of `03_STRICT_TRANSPORT_ARCHITECTURE.md`) is EXTERNAL Tor (no bundled binary, no spawn, no control-port), which the mandate's own §15 explicitly permits ("successful local SOCKS readiness check" is a listed valid READY-definition source) and which avoids the real, unresolved blocker these files would otherwise reintroduce: no Tor binary exists anywhere in this repository or on disk, and downloading one is explicitly out of scope (§14/§57 of the mandate). Not reused this pass; the files remain a legitimate future PORT_TO_CURRENT_ARCHITECTURE candidate if a later arc decides to bundle Tor. |
| `fedos_electron_tor_onion_service.ts` | — | **OUT OF SCOPE** — onion (hidden) service hosting is not part of this arc's mandate (strict outbound transport only). |
| `fedos_electron_tor_commerce_transport.ts`, `fedos_electron_tor_seller_commerce_channel.ts`, `fedos_electron_tor_buyer_runtime_controller.ts`, `fedos_electron_tor_local_commerce_service.ts`, `fedos_electron_tor_wire_protocol.ts` | — | **OUT OF SCOPE** — a parallel Commerce-over-Tor wire protocol, not this arc's job. Commerce already reuses the same Nostr relay transport as Messenger (§1 of `01_CURRENT_NETWORK_SURFACE.md`) and is covered automatically once the ONE shared relay-socket factory is made strict-aware. |
| `docs/commerce/tor/*` (30+ files, incl. 4 rounds of live-bootstrap evidence) | — | **UNSAFE_TO_CITE_AS_CURRENT_PROOF** — genuinely real historical evidence that Tor bootstrap/SOCKS/onion-service worked once, on an old source layout, with a real (unspecified) Tor binary the current repository does not possess. Useful as design precedent (cited above), not as proof of anything about the current branch, and not re-run (no bundled Tor binary exists to re-run it against, and downloading one is out of scope here).

## 3. Decision

Port the SOCKS5 client directly (adapted import paths and error type only,
logic unchanged). Reuse the isolation-credential-derivation *pattern* in a
simplified, single-scope form. Do not port the Tor-process-ownership,
control-port, onion-service, or Commerce-specific transport code — none of
it is needed for this arc's EXTERNAL-Tor, single-shared-relay-abstraction
architecture (see `03_STRICT_TRANSPORT_ARCHITECTURE.md`).
