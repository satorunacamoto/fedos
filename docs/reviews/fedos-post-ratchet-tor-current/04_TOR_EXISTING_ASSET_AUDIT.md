# Existing Tor Asset Audit

**Scope note:** current branch is `arc/fedos-installed-startup-root-cause`,
HEAD `b886a176` at time of writing. All inspection was static/offline via
`git log`/`git ls-tree`/`git show` against local refs already in this
repository's object store — no branch was checked out, no process was
launched, no network was touched.

## 0. Headline finding

**On the current branch's HEAD, no Tor implementation exists.** What
exists on HEAD is: one empty reserved directory, one docs-only design
corpus (multi-hop Gift-Wrap "onion-like routing" research, explicitly
never built), and one small, pure, side-effect-free policy label
(`"tor-optional"`) that a *future* transport could consult but that
nothing in the shipped product currently reads or acts on.

**However, this is not the whole truth about "this repository."** A
repo-wide, unrestricted `git log --all` search (as the task explicitly
requested) surfaces a large, genuinely substantial, real Tor
implementation — a bundled Tor binary with checksum/provenance
verification, a hand-written SOCKS5 client, a Tor control-port client,
onion-service management, stream isolation, and four rounds of
documented **live** Tor-bootstrap test runs with real evidence — living
entirely on an **unmerged sibling branch family**
(`feature/commerce-tor-*`, plus supporting `agent/tor-*` branches). It
diverged from mainline before this branch's own lineage began and was
never reconciled forward. It is real, extensive, and inert with respect
to the current product — nothing on HEAD imports or references any of
it. Both facts are true at once; neither should be read in isolation of
the other.

## 1. What exists on the CURRENT branch (HEAD, `b886a176`)

### 1.1 `src/os/messenger/onion/` — reserved empty seam (PARTIAL, honestly labelled)

`src/os/messenger/onion/README.md` (the directory's only file) states
plainly: *"No Tor/onion-routing implementation exists anywhere in this
repository today... This directory is a deliberately empty, reserved
seam for a future arc... Do not invent code here to make the directory
non-empty."* Classification: **PARTIAL** (a reserved placeholder, no
behavior) — the directory itself is honest about being empty and cites
the same "onion corpus is 6,050 lines of zero code" finding this audit
independently reproduces below.

### 1.2 `docs/fedos_onion_like_routing.md` — design-notes-only, explicitly NOT Tor (DEAD_CODE / non-code, HISTORICAL research)

A long (250+ line) threat-model sketch of nesting Nostr Gift-Wrap layers
for multi-hop delivery. Its own header (`fedos_onion_like_routing.md:1-9`)
states: *"NO cryptography, NO relay client, NO onion-routing
implementation, and NO..."* and §1 (`:21-23`) is titled *"This is NOT a
Tor alternative"* — *"FedOS does not, and this document does not
propose to, replace Tor..."* §12 (`:244`) restates: *"Does not implement
onion routing or any relay-hop client of any kind."* This is research
prose only, zero executable code. Classification: **not an asset** —
included here only because it is the corpus a prior arc already
characterized as "6,050 lines of zero code," and `src/os/messenger/onion/README.md`
cites it directly.

### 1.3 `docs/fedos_transport_modes.md` — design notes referencing the onion-routing research, also non-code

Names three future transport-policy modes (Quiet DM / Public Board /
Legal Content Distribution). Explicitly states (`fedos_transport_modes.md:8-11,158-160`)
that it adds no code and that its "Quiet DM Mode" deliberately does NOT
adopt the onion-like multi-hop idea from §1.2 (more hops without cover
traffic/padding can make timing correlation *worse*, not better, per the
document's own §3 rationale). Not a Tor asset in itself; listed for
completeness since it is one of the ~67 raw grep hits for "tor" and does
meaningfully discuss the topic.

### 1.4 `src/os/commerce/catalog/network_profile.ts` — a pure policy label, PARTIAL, not wired to anything

This is the one genuine *code* artifact on HEAD that mentions Tor by
name. Full file: `network_profile.ts` (103 lines). Key facts:

- Defines `type NetworkProfile = "direct" | "local-only" | "tor-optional"`
  (`network_profile.ts:57`).
- `prefersTorTransport(profile)` (`network_profile.ts:100-102`) is a pure,
  synchronous function: `return profile === "tor-optional";`. It performs
  "no actual Tor connection, install, or process spawn of any kind."
- `evaluateNetworkAccess(profile, requiresNetwork)` (`network_profile.ts:83-91`)
  only decides allow/deny for `"local-only"` vs. the other two profiles —
  it does not distinguish `"direct"` from `"tor-optional"` in terms of
  *whether* network access is allowed, only that a future transport
  *might* route differently under `"tor-optional"`.
- The file's own header (`network_profile.ts:1-43`) is explicit and
  repeated twice for emphasis: *"It contains NO Tor installation,
  download, process-spawn, or dependency of any kind — no live Tor code
  exists anywhere in this file or is reachable from it,"* and *"TOR IS
  TRANSPORT POLICY HERE, NEVER AN ANONYMITY GUARANTEE... nothing in
  `src/os/commerce/` currently does [consult it]"* (`:35-42`, `STATUS:
  inert scaffolding, not reachable from the shipped Electron app`).
- Confirmed no caller of `prefersTorTransport()` exists anywhere in
  `src/os/commerce/` production composition (the file's own claim,
  independently verified: it is imported only by its own test file and
  by `ipfs_media_store.ts`'s doc comments, not by any executable call
  site).

Introduced by commit `8385e5cf` ("MediaStore/IPFS + Tor network profile +
WASM protected-media crypto adapter", 2026-08-11), on the current
branch's own lineage. **Classification: PARTIAL** — a real, tested,
correctly-labelled policy type exists; zero transport implementation
consults it.

### 1.5 No SOCKS/proxy capability wired into the current relay client

`node_websocket_relay_socket_factory.ts` (the one real WebSocket-socket
factory on HEAD — see `03_NETWORK_SURFACE_INVENTORY.md` §1) takes only a
bare `url: string` and calls `new WebSocket(url)` directly
(`node_websocket_relay_socket_factory.ts:43-46`). No proxy parameter, no
SOCKS option, no `agent` override exists anywhere in
`WebSocketFactory`/`FedosRelaySocketFactory`/`WebSocketRelay`/
`WebSocketRelayAdapter`/`WebSocketRelayPublisher`. **Classification:
NOT PRESENT** — there is no generic "connect through a proxy" capability
of any kind on the current branch's relay path, Tor-specific or
otherwise.

### 1.6 `package.json` / `Cargo.toml` — no Tor dependency anywhere

- Root `package.json`, `packages/fedos-core-rust/package.json`,
  `packages/fedos-desktop-electron-spike/package.json`,
  `packages/meshkv/package.json`: no `arti`/`arti-client`/`tor`/`socks`
  npm dependency in any of them (checked directly; the only "tor"-ish
  string in any of these files is the word "electron" or unrelated prose
  in the package description, not a dependency name).
- `packages/fedos-core-rust/Cargo.toml` (the only `Cargo.toml` in the
  repository, confirmed via `find . -name Cargo.toml`): full dependency
  list is `chacha20poly1305`, `hkdf`, `zeroize`, `secrecy`, `subtle`,
  `argon2`, `aes-gcm`, `getrandom`, `sha2`, `k256`, `wasm-bindgen`
  (production) plus `hex`/`serde`/`serde_json` (dev-only). **No
  `arti-client` or any other Tor-related Rust crate.**
- No bundled/vendored Tor binary or reference to one anywhere in
  `src/`/`packages/` on this branch (no `tor.exe`, `tor_binary`, or
  electron-builder `extraResources`/`extraFiles` entry naming Tor).

## 2. What exists ONLY on unmerged sibling branches — NOT reachable from HEAD

A repo-wide `git log --all -i --grep` / `git log --all -- '*tor*'` search
(as the task explicitly instructed) surfaces a branch family that is a
different story entirely from §1. This is git-history/other-refs
content, not part of "the current product," but it is real code sitting
in this same repository's object store and is exactly what Part 2 of
this task asked to be found.

### 2.1 Where it lives, and that it does NOT touch this branch

Branch family (non-exhaustive, found via `git branch -a | grep -i tor`):
`agent/tor-live-execution`, `agent/tor-packaging`,
`agent/tor-release-integrity`, `agent/tor-ui-regression`,
`agent/buyer-tor-prewarm-a`, `feature/commerce-tor-alpha-v1`,
`feature/commerce-tor-bundled-release-v1`,
`feature/commerce-tor-buyer-authenticated-rebind-v1`,
`feature/commerce-tor-live-candidate-v1`,
`feature/commerce-tor-live-evidence-v1`,
**`feature/commerce-tor-live-final-v1`** (inspected as the representative
tip below), `feature/commerce-tor-real-bundle-v1`,
`feature/commerce-tor-real-execution-v1`, plus a design-only
`design/tor-deployment-profile` and a `review/onion-directory-node-trust-v1`.

Verified directly:
```
git merge-base --is-ancestor 8385e5cf HEAD        -> YES (§1.4's commit IS on this branch)
git merge-base --is-ancestor 03d97088 HEAD        -> NO  (a live-Tor-run commit on the Tor branch)
git merge-base --is-ancestor 386eb40d HEAD        -> NO  ("Phase 0: Tor Commerce alpha architecture inventory")
git merge-base feature/commerce-tor-live-final-v1 HEAD
    -> 4b808995 ("Forward Secrecy Phase 1: record verification results and coverage limits", 2026-07-26)
```
So the Tor branch and the current branch share a common ancestor from
2026-07-26, and have developed independently since. The Tor branch's
newest commit is `27e2772f` (2026-08-05); the current branch's HEAD is
dated 2026-08-16 — the Tor work is not stale relative to when it stopped,
but it stopped 11 days before this branch's HEAD and was never merged
forward. `docs/commerce/tor/TOR-BRANCH-RECONCILIATION.md` (on the Tor
branch, not on HEAD) independently documents that this Tor line was
itself rebased once onto an *older* Commerce lineage
(`feature/commerce-mvp-v1`) that predates the "OS Capability
Modularization" restructuring (`bc794204`, on HEAD) — meaning the Tor
branch's source tree is still shaped like the OLD flat `src/desktop/`,
`src/conversation/`, `src/board/` layout, not the current
`src/os/messenger/`, `src/os/commerce/`, `src/os/core/` layout. Merging
it forward today would require non-trivial path-mapping work, not a
plain fast-forward or clean rebase.

**Classification: HISTORICAL / PARALLEL-UNMERGED.** Not superseded (the
`network_profile.ts` scaffolding on HEAD, §1.4, was written 6 days
*after* this Tor branch's last commit but shows no sign of having
consulted or referenced it — it looks like independent reinvention of a
much smaller idea, not a deliberate replacement). Not dead code in the
usual sense (it is reachable, real, and tested on its own branch) —
"reachable from HEAD" is the operative distinction, and it is not.

### 2.2 What the Tor branch actually contains (real source, not just docs)

`git ls-tree -r feature/commerce-tor-live-final-v1` shows real production
TypeScript, not stubs:

- `packages/fedos-desktop-electron-spike/src/fedos_electron_tor_socks_client.ts`
  — a hand-written SOCKS5 client (RFC 1928 + RFC 1929 username/password
  sub-negotiation) for a single `CONNECT` through a local Tor process.
  Its own header states a structural guarantee: *"There is no code path
  anywhere in this file that calls DNS resolution... on `targetHost`
  before constructing the CONNECT request"* — the target hostname
  (including `.onion` addresses) is always sent as SOCKS5 `ATYP=0x03`
  (domain name), never resolved locally
  (`fedos_electron_tor_socks_client.ts:1-19`, `SOCKS_VERSION`/`ATYP_DOMAIN`
  constants at `:26-33`).
- `fedos_electron_tor_bundled_runtime.ts` — a closed manifest schema
  (`BundledTorRuntimeManifestV1`) for FedOS's own packaged Tor payload
  under `resources/tor-runtime/`, with per-file SHA-256 verification,
  disallowed-executable-extension checks, and a five-state license
  vocabulary for upstream provenance — offline verification against
  `process.resourcesPath`, no PATH lookup, no Tor Browser install
  detection, no environment-variable override, no user-entered path
  (`fedos_electron_tor_bundled_runtime.ts:1-20`).
- `fedos_electron_tor_control_port_client.ts`, `fedos_electron_tor_runtime.ts`,
  `fedos_electron_tor_runtime_controller.ts` — Tor process lifecycle
  (spawn the bundled binary) and Tor control-port protocol client.
- `fedos_electron_tor_onion_service.ts` — onion (hidden) service
  lifecycle management.
- `fedos_electron_tor_isolation.ts` — SOCKS5 stream-isolation credentials
  (referenced by the SOCKS client, above).
- `fedos_electron_tor_commerce_transport.ts`,
  `fedos_electron_tor_seller_commerce_channel.ts`,
  `fedos_electron_tor_buyer_runtime_controller.ts`,
  `fedos_electron_tor_local_commerce_service.ts`,
  `fedos_electron_tor_wire_protocol.ts` — a full Commerce-over-Tor
  transport built on top of the above.
- `fedos_electron_tor_errors.ts`, `fedos_electron_tor_startup_observability.ts`,
  `fedos_electron_tor_node_host_adapter.ts`, `fedos_electron_tor_fake_e2e_backend.ts`
  — supporting error taxonomy, startup diagnostics, host adapter, and a
  fake/offline E2E backend for tests.
- `scripts/commerce-tor/live_preflight/inspect_tor_binary.mjs`,
  `scripts/commerce-tor/prepare_live_tor_test_artifacts.mjs`,
  `scripts/commerce-tor/live_preflight/artifact_manifest.mjs` — live
  test-preflight tooling that inspects/prepares the real Tor binary.
- Roughly 25 dedicated test files
  (`packages/fedos-desktop-electron-spike/test/fedos_electron_tor_*.test.ts`)
  covering the SOCKS client, control-port client, isolation, onion
  service, bundled-runtime packaging, aggregate network safety, and a
  DOM-parity check against the Nostr UI.
- A large `docs/commerce/tor/` corpus (30+ files) including
  `TOR-ARCHITECTURE-INVENTORY.md`, `TOR-THREAT-MODEL-V0.md`,
  `TOR-STREAM-ISOLATION.md`, `TOR-PRIVACY-LIMITATIONS.md`,
  `BUNDLED-TOR-*` (license inventory, packaging evidence, release
  integrity, runtime architecture, threat boundary, update policy), and a
  `real-execution/`/`live/` subtree with **four rounds of live-Tor-run
  evidence** — `THIRD-LIVE-RUN-EVIDENCE.md` records a real bootstrap
  failure with root-caused fix, and `FOURTH-LIVE-RUN-EVIDENCE.md`/commit
  `03d97088` ("Fourth live-Tor run: PASS — full 12/12 lifecycle, real Tor
  bootstrap, real onion service, authenticated rebind") records a full
  pass with real, captured stdout/JSON evidence artifacts
  (`docs/commerce/tor/real-execution/fourth-live-run-evidence/*`).

This is not a prototype stub — it is a reviewed, tested, and at least
once **live-executed against the real Tor network** (per its own commit
messages and evidence files) implementation, on a branch that this
repository's current HEAD does not include.

### 2.3 Why this matters for the current audit, stated plainly

- If a future arc wants Tor support, the raw building blocks (SOCKS5
  client with the DNS-never-resolved-locally discipline the current
  audit's Part 3 finding calls for, bundled-binary provenance/checksum
  verification, control-port client, onion service management) already
  exist, are tested, and were once proven against the live Tor network —
  but on a branch built against the *pre-modularization* source layout,
  requiring real integration work, not a fast-forward.
- It should NOT be conflated with anything on HEAD. `network_profile.ts`
  (§1.4) is a small, independent, much later re-scaffold that shows no
  evidence of drawing on this branch's design/threat-model corpus (e.g.
  it does not reference `TOR-THREAT-MODEL-V0.md`'s stream-isolation or
  DNS-leak analysis at all).
- This matches the general pattern this repository already has elsewhere
  (per prior audit history: origin/main and a large RC1/Commerce epic
  diverged and were never reconciled) — this Tor branch family is another
  instance of the same "real work exists, done in a sibling lineage,
  never landed" shape.

## 3. Test-fixture-only Tor references — none found beyond the branch above

No `TEST_ONLY` Tor fixture exists independently of the branch in §2 — the
current branch (`arc/fedos-installed-startup-root-cause`) has no test
file that mocks or fixtures a Tor connection at all (its `network_profile.test.ts`,
if any, would only exercise the pure label functions in §1.4).

## 4. Classification summary

| Item | Location | Classification |
|---|---|---|
| `src/os/messenger/onion/` reserved seam | HEAD | PARTIAL (honest empty placeholder) |
| `docs/fedos_onion_like_routing.md` | HEAD | Not an asset — docs-only research, explicitly "NOT a Tor alternative" |
| `docs/fedos_transport_modes.md` | HEAD | Not an asset — docs-only, references the above |
| `NetworkProfile`/`prefersTorTransport()` | HEAD, `network_profile.ts` | PARTIAL (real, tested, pure label; zero callers) |
| Generic proxy/SOCKS hook on the relay client | HEAD | NOT PRESENT |
| Tor npm/Cargo dependency | HEAD | NOT PRESENT |
| Bundled Tor binary reference | HEAD | NOT PRESENT |
| Full Tor Commerce transport (SOCKS5 client, bundled runtime + provenance, control-port client, onion service, 4 rounds of live-bootstrap evidence) | `feature/commerce-tor-*` branch family (NOT HEAD) | HISTORICAL / PARALLEL-UNMERGED — real, extensive, live-tested, unreachable from current HEAD |

## 5. Answering "does any Tor implementation exist" directly

**On the current product (this branch's HEAD): no.** Nothing beyond a
pure policy-label type and an empty reserved directory, both explicitly
self-documented as non-implementations.

**In this repository as a whole (all refs): yes, a real and substantial
one** — but it sits on an unmerged, architecturally-stale sibling branch
family and is completely inert with respect to what the shipped Electron
app actually does today.
