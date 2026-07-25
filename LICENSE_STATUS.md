# FedOS — Project License Status

**No open-source (or other) license has been selected for this
repository's own original code as of this writing.** This is a real,
current gap, not an oversight this document is glossing over — see
`ROADMAP.md`/`KNOWN_LIMITATIONS.md`'s own license-governance entries.

## What was checked, and found

- **No `LICENSE` or `NOTICE` file exists** at the repository root as of
  this writing.
- **No `"license"` field exists** in either `package.json` (root) or
  `packages/fedos-desktop-electron-spike/package.json`.
- **No `license` field exists** in `packages/fedos-core-rust/Cargo.toml`.
- **No document in this repository authoritatively states an intended
  project license** for this repository's own original source code —
  searched directly, not assumed absent.
- **This repository's dependencies' own licenses are real and already
  documented**: see `THIRD_PARTY_NOTICES.md` (generated, deterministic,
  regenerate with `node scripts/generate_third_party_notices.mjs`) for
  the full npm + Cargo dependency license inventory, plus the
  already-thorough per-file attribution already present for committed
  third-party cryptographic test-vector data under `test-vectors/`.

## What this Arc did NOT do

Per this Arc's own explicit governance boundary, **no license was
chosen or added automatically.** No `MIT`, `Apache-2.0`, `GPL`,
proprietary, or `UNLICENSED` marker was written into any `package.json`
or `Cargo.toml` field. Choosing a project license is a real legal/
business decision (it determines what others may do with this code,
interacts with any future funding/employment agreements, and may need
to be compatible with — or deliberately incompatible with — the
licenses of dependencies already in use) that requires a human with the
authority to make it, not an inference from repository content.

## Dependency license compatibility — a preliminary, non-binding scan

`THIRD_PARTY_NOTICES.md` (313 npm packages, 82 Rust crates, at
generation time) contains **no forced-copyleft dependency** — the one
crate mentioning LGPL (`r-efi@5.3.0`) is triple-licensed
`MIT OR Apache-2.0 OR LGPL-2.1-or-later`, meaning the permissive
options can be selected instead, avoiding any LGPL obligation entirely.
Every other dependency across both ecosystems declares a permissive
license (MIT, Apache-2.0, BSD variants, ISC, 0BSD, ...) or explicit
public-domain equivalents (Unlicense, CC0-1.0). This is a preliminary
observation to help whoever makes the license decision, **not** a
substitute for real legal review of the full dependency tree against
whatever license is ultimately chosen.

## What redistribution rights currently look like without a stated license

**Under default copyright law, source code with no explicit license
grant is "all rights reserved" by its author(s) — nobody else has
permission to copy, modify, or redistribute it, even though the
repository itself may be readable.** This has a real, practical
consequence already flagged elsewhere in this Arc's own work: **Public
Beta (a wider release than the current Closed Beta pilot) remains
blocked until redistribution rights are resolved** — either by
selecting and applying an explicit license, or by a human explicitly
deciding to ship without one under some other arrangement (e.g. a
private, contractual distribution to named pilot participants only,
which is closer to what the current Closed Beta pilot already is).

## HUMAN INPUT REQUIRED

The following require a human decision and are not filled in by this
document:

- **Project license** (or explicit confirmation that none will be
  applied, and why).
- **Copyright holder / legal entity name** to appear in a future
  `LICENSE` file's own copyright notice.
- **Whether any dependency's license terms (e.g. a copyleft license, if
  one is found in `THIRD_PARTY_NOTICES.md`) constrain which project
  license is actually viable** — this document does not perform that
  compatibility analysis; a human (ideally with legal review) should
  cross-reference `THIRD_PARTY_NOTICES.md` against whatever project
  license is under consideration before finalizing it.

## What to do once a license is chosen

1. Add a real `LICENSE` file at the repository root with the chosen
   license's own canonical text.
2. Set the `"license"` field in both `package.json` files to the
   chosen SPDX identifier (or `"UNLICENSED"` if deliberately proprietary
   and not open-source).
3. Set the `license` field in `packages/fedos-core-rust/Cargo.toml`.
4. Regenerate `THIRD_PARTY_NOTICES.md` and manually re-verify no
   dependency's license is incompatible with the chosen one.
5. Update this file (`LICENSE_STATUS.md`) to record the decision, the
   date, and who made it — do not simply delete this file, so the
   decision's own history stays traceable.
