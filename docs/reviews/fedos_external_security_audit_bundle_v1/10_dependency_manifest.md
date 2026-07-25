# Dependency Manifest

Every dependency graph in this repository, measured directly against
`68e7be16` (see [`09_commit_manifest.md`](09_commit_manifest.md)), not
copied from a prior review's own count (the audit-prep base package,
`8e730f25`, correctly warned that a specific prior count "can go stale as
source grows; always re-derive against the actual commit under audit" —
this document follows that discipline). See [`14_sbom.md`](14_sbom.md)
for the same graphs in a structured, per-package machine-readable-shaped
form, and [`15_license_inventory.md`](15_license_inventory.md) for the
license breakdown of everything listed here.

## Root npm project (`nostr-window`, repository root)

`package.json` direct dependencies:

| Package | Declared range |
|---|---|
| `@noble/curves` | `^2.2.0` |
| `@noble/hashes` | `^2.2.0` |

`package.json` direct devDependencies:

| Package | Declared range |
|---|---|
| `@cloudflare/workers-types` | `^4.0.0` |
| `typescript` | `^5.6.0` |
| `vitest` | `^2.1.0` |

**Resolved graph** (`package-lock.json`, tracked/committed to git —
confirmed via `git ls-files`): **94 total resolved package entries**
(measured by counting non-root keys in the lockfile's own `packages`
object).

**This manifest closes an open question the audit-prep base package's
own §14 explicitly left unresolved** ("confirm whether either is also a
PRODUCTION runtime dependency versus test-only; not independently
re-verified this pass"): `grep -rl "@noble/curves\|@noble/hashes" src/`
(excluding test files) returns **20+ real, non-test production source
files**, not merely test doubles. Two concrete, security-relevant
production call sites found this pass:

- `src/conversation/deletion_request/fedos_deletion_request_signing.ts`
  imports `schnorr` from `@noble/curves/secp256k1.js` and `sha256` from
  `@noble/hashes/sha2.js` to sign/verify Signed Deletion Requests — **a
  second, independent, TypeScript-side BIP-340 Schnorr implementation,
  separate from the Rust/WASM `k256::schnorr` path** the crypto inventory
  ([`17_crypto_inventory.md`](17_crypto_inventory.md)) otherwise treats as
  the one production signing primitive. An external auditor should treat
  this as its own, distinct code path requiring its own review, not
  assume the WASM boundary's own KAT-vector testing covers it.
- `src/board/runtime/fedos_board_runtime_id_generator.ts` imports
  `randomBytes`/`bytesToHex` from `@noble/hashes/utils.js` for
  non-secret identifier generation (not key/seed material).

Treat both `@noble/curves` and `@noble/hashes` as real, narrow,
security-relevant production dependencies — not test-only — and add the
Signed-Deletion-Request Schnorr path to any dependency-specific
cryptographic review scope alongside the Rust core.

## Electron package npm project (`packages/fedos-desktop-electron-spike/`)

`package.json` direct devDependencies:

| Package | Declared range |
|---|---|
| `electron` | `^43.1.1` |
| `electron-builder` | `^26.15.3` |

**Resolved graph** (own `package-lock.json`, also tracked/committed):
**284 total resolved package entries** — an order of magnitude larger
than the root project's, entirely attributable to `electron`'s and
`electron-builder`'s own large native-tooling dependency trees (code
signing helpers, archive/compression tools, platform-specific native
addons), not to any FedOS-authored code.

**npm-side reproducibility**: both `package-lock.json` files are real,
committed, version-controlled artifacts — a `npm ci` in either directory
resolves the exact same graph deterministically. This is a materially
stronger reproducibility guarantee than the Rust side (below).

## Rust crate (`packages/fedos-core-rust/`)

`Cargo.toml` direct `[dependencies]` (production, 11 total — unchanged
count from the audit-prep base package's own §5/§14, re-verified by
direct read this pass): `chacha20poly1305` `0.11.0`, `hkdf` `0.13.0`,
`zeroize` `1.9.0`, `secrecy` `0.10.3`, `subtle` `2.6.1`, `argon2`
`0.5.3`, `aes-gcm` `0.10.3`, `getrandom` `0.3` (feature `wasm_js`),
`sha2` `0.11.0`, `k256` `0.13` (features `arithmetic`, `schnorr`),
`wasm-bindgen` `0.2.126`.

`Cargo.toml` `[dev-dependencies]` (test-only, never reachable from the
compiled crate's public API): `hex` `0.4.3`, `serde` `1.0.228` (feature
`derive`), `serde_json` `1.0.150`.

**Resolved transitive graph — measured fresh this pass** (`cargo tree`,
run from `packages/fedos-core-rust/`, real network access confirmed
available in this environment):

- `cargo tree --edges normal --prefix none | sort -u | wc -l` → **66**
  unique crate names reachable via production (`normal`) dependency
  edges only, resolved for this review's own native/host target.
- `cargo tree --prefix none | sort -u | wc -l` → **77** unique crate
  names including dev-dependencies' own transitive graph (`hex`/
  `serde`/`serde_json` and what they pull in).
- The **full, all-platforms resolved lockfile graph** (what `cargo
  generate-lockfile` actually writes, covering every target — native
  AND `wasm32-unknown-unknown` — since a `Cargo.lock` is
  target-independent) contains **82 package@version entries** (including
  `fedos-core-rust` itself) — this is the exact figure and exact
  SHA-256 already pinned by
  `docs/secure_runtime_alpha_8121_8200_cargo_lock_policy_decision.md`,
  and this review **independently reproduced it byte-for-byte**; see
  [`12_hashes.md`](12_hashes.md) for the full verification and the
  complete 82-entry list (not repeated here to avoid drift between two
  copies — that document is now the canonical location).

**A real, non-obvious nuance found this pass, worth an auditor's
attention**: `cargo tree` shows `k256 v0.13.4` pulling in `ecdsa v0.16.9`
as a resolved dependency, even though `Cargo.toml`'s own `k256` line sets
`default-features = false` and `features = ["arithmetic", "schnorr"]` —
explicitly *not* `"ecdsa"`. This is consistent with the audit-prep base
package's own §5 finding that `k256`'s dependency surface includes
`ecdsa` transitively regardless of which top-level feature is selected
(the `schnorr`/`arithmetic` features share underlying elliptic-curve
trait plumbing that the `ecdsa` crate also supplies shared types for) —
**the presence of the `ecdsa` crate name in the resolved graph does not
by itself mean ECDSA signing is reachable from this codebase's
production code.** `grep -rn "::ecdsa\|use ecdsa" packages/fedos-core-rust/src/`
finds zero references — the crate is present in the graph, not called
anywhere. An external auditor should independently confirm this (a
`cargo tree -e features` or a direct read of `k256`'s own `Cargo.toml`
would settle it precisely) rather than relying on this review's grep
alone.

## `Cargo.lock` policy (asymmetric with npm)

Unlike both npm `package-lock.json` files, `packages/fedos-core-rust/Cargo.lock`
is **deliberately gitignored, never committed** — a recorded policy
decision (`docs/secure_runtime_alpha_8121_8200_cargo_lock_policy_decision.md`,
"Option B"), not an oversight. The exact resolved graph is instead pinned
by hash in that document and independently reproduced by this bundle
(see [`12_hashes.md`](12_hashes.md)). **Practical consequence for an
auditor**: a `cargo build`/`cargo test`/`cargo tree` run from a fresh
clone without network-blocked/pinned index state could, in principle,
resolve a *different* graph than the one this bundle and the cited
policy decision both independently confirmed — re-run the reproduction
in [`12_hashes.md`](12_hashes.md) yourself and diff the resulting
`Cargo.lock` hash against `6bbdadb710b65b517ceb8d671f2bdbf37283d7373a73d0ed8debc1d895368155`
before assuming today's graph is what you are actually reviewing.

## Known-vulnerability scanning — NOT performed by this bundle

Neither `cargo audit` nor `npm audit` was run by this bundle or by any
prior review it inlines (the audit-prep base package's own §14 already
named this as a gap and recommended it as part of the external
engagement). **This remains open** — recorded here again explicitly so
it is not lost across the bundle's own reorganization, and listed as an
action item in [`19_reviewer_checklist.md`](19_reviewer_checklist.md).
