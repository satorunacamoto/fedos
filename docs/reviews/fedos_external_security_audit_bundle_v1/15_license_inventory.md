# License Inventory

## This project's own license

**No `LICENSE`/`LICENSE.md` file exists at the repository root**
(confirmed this pass — `ls` at root shows none). **Neither `package.json`
declares a `"license"` field** (root `nostr-window` package, nor
`packages/fedos-desktop-electron-spike/@nostr-window/fedos-desktop-electron-spike`
package — both greps for `"license"` returned zero matches). This
repository does not currently state under what terms its own code may be
used, modified, or redistributed by anyone outside this project. **This
is a real, concrete gap** — separate from and prior to any third-party
dependency license question below — and should be resolved with an
explicit human decision (which license, if any) before any public
release, since "no license file" defaults, under most jurisdictions'
copyright law, to "all rights reserved" (no permission granted at all),
which likely does not match this project's actual intent for a Beta it
plans to distribute.

## Root npm project (94 resolved packages)

Measured directly from `package-lock.json`'s own `license` field per
package this pass:

| License | Count |
|---|---|
| MIT | 88 |
| Apache-2.0 | 2 |
| ISC | 2 |
| BSD-3-Clause | 1 |
| MIT OR Apache-2.0 | 1 |

**Zero copyleft licenses (GPL/LGPL/AGPL family), zero `UNKNOWN`/missing
license fields.** All 94 are standard, permissive open-source licenses
compatible with proprietary redistribution.

## Electron package npm project (284 resolved packages)

| License | Count |
|---|---|
| MIT | 213 |
| ISC | 36 |
| BSD-3-Clause | 9 |
| BlueOak-1.0.0 | 8 |
| Apache-2.0 | 6 |
| BSD-2-Clause | 6 |
| WTFPL (incl. dual-license forms) | 3 |
| 0BSD | 1 |
| Python-2.0 | 1 |
| (MIT OR CC0-1.0) | 1 |

**Zero copyleft licenses, zero `UNKNOWN`/missing license fields.**

Worth an auditor's specific attention (unusual, not concerning, but
non-standard enough to name explicitly rather than bury in a count):

- **`Python-2.0`** — `argparse@2.0.1` (a CLI-argument-parsing polyfill,
  transitive dependency of `electron-builder`'s own tooling, not
  FedOS-authored code). The Python Software Foundation License 2.0 is
  permissive and OSI-approved; unusual only because it is not a typical
  JS-ecosystem license, not because it imposes copyleft obligations.
- **`WTFPL`** (and its dual-licensed variants `WTFPL OR ISC`,
  `WTFPL OR MIT`) — `sanitize-filename@1.6.4`, `truncate-utf8-bytes@1.0.2`,
  `utf8-byte-length@1.0.5`. WTFPL ("Do What The F*ck You Want To Public
  License") is maximally permissive but is explicitly **not** OSI-approved
  and some corporate legal/compliance policies flag it for that reason
  alone (not because of any actual restriction it imposes — it imposes
  none). Worth a specific legal sign-off if this project's own
  distribution policy requires OSI-approved licenses only.
- **`BlueOak-1.0.0`** (8 packages: `chownr`, `isexe`, `minimatch`,
  `minipass`, `sax`, `tar`, and two nested duplicates) — a modern,
  permissive, increasingly common license in the npm ecosystem (used by
  `isaacs`-maintained packages); OSI-approved-equivalent in practice but
  newer, so some license-scanning tools may not yet recognize it by name.

## Rust crate (`fedos-core-rust`, 11 direct + 82 total resolved, all targets)

Every direct production dependency's license is documented directly in
`Cargo.toml`'s own inline comments (re-verified this pass by reading the
file, not assumed): `chacha20poly1305` (Apache-2.0 OR MIT),
`hkdf` (MIT OR Apache-2.0), `zeroize` (Apache-2.0 OR MIT),
`secrecy` (Apache-2.0 OR MIT), `subtle` (BSD-3-Clause),
`argon2` (MIT OR Apache-2.0), `aes-gcm` (Apache-2.0 OR MIT),
`getrandom` (Apache-2.0 OR MIT), `sha2` (MIT OR Apache-2.0),
`k256` (Apache-2.0 OR MIT), `wasm-bindgen` (MIT OR Apache-2.0).

**Every one is MIT and/or Apache-2.0, or BSD-3-Clause (`subtle` only) —
zero copyleft.** This is consistent with the audit-prep base package's
own §14 finding ("all RustCrypto/dalek-cryptography/rust-random-project
origin"). The full 82-entry transitive graph's own per-crate licenses
were **not** individually re-derived this pass (would require
`cargo-license` or equivalent tooling, not installed) — given every
direct dependency is RustCrypto/dalek/rust-random-project origin
(organizations with a consistent, deliberate MIT/Apache-2.0 dual-license
policy across their entire crate portfolio), a copyleft surprise deep in
the transitive graph is unlikely but **not independently confirmed** —
flagged as an open item for the real audit engagement
([`19_reviewer_checklist.md`](19_reviewer_checklist.md)).

## Overall verdict

No copyleft (GPL/LGPL/AGPL/MPL-with-network-clause) license was found
across either fully-measured npm dependency tree (378 packages measured
directly, zero `UNKNOWN`). The Rust dependency tree's direct
dependencies are confirmed permissively licensed; the full transitive
graph was not individually re-derived. **The one real, actionable gap is
this project's own missing license file/declaration** — not a
third-party dependency risk.
