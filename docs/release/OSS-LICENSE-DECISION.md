# OSS License Decision — Trust / Offline Monetization Arc

Status: release note for the "FedOS Trust / Offline Monetization + OSS
Release Closure" arc. This document does **not** make a new license
decision — it records that this arc preserves an already-made one
unchanged, and flags one dependency-tracking follow-up this arc's own
work creates.

## The license decision is not this arc's to make — it was already made

This repository's license was decided before this arc started. Per
[`LICENSE_STATUS.md`](../../LICENSE_STATUS.md) (read in full before
writing this document):

> **Decision made: this repository's own original code is licensed under
> the Mozilla Public License, Version 2.0 (MPL-2.0).**

That decision is final, recorded, and out of scope for this arc to
revisit. Specifically, this arc:

- **Does not change the license.** `LICENSE`, root `package.json`
  `"license"`, `packages/fedos-desktop-electron-spike/package.json`
  `"license"`, and `packages/fedos-core-rust/Cargo.toml` `license` all
  remain `MPL-2.0`, unmodified by anything in `src/os/trust/`.
- **Does not re-litigate MPL-2.0 vs. Apache-2.0.** A recommendation to
  pick Apache-2.0 is only meaningful when no license has yet been chosen.
  That is not this repository's situation — `LICENSE_STATUS.md` is
  explicit that an earlier version of that same file "correctly reported
  that no license had been selected," and has since been superseded by
  the MPL-2.0 decision above. Suggesting a license change here would be
  re-opening a closed decision, not filling a gap.
- **Does not add a copyright holder, CLA, or DCO.** Those remain the open
  items `LICENSE_STATUS.md` §6 already tracks, unrelated to this arc.

New source files this arc adds under `src/os/trust/` and
`scripts/fedos_trust_issuer_cli.mjs` are covered by the same repository-wide
MPL-2.0 grant as everything else — no per-arc or per-directory license
carve-out is being introduced.

## Current dependency-compatibility state (as of `LICENSE_STATUS.md`)

Per `LICENSE_STATUS.md` §5 ("Dependency license compatibility"), at the
time that document was last generated:

- `THIRD_PARTY_NOTICES.md` covered **313 npm packages and 82 Rust
  crates**.
- **No forced-copyleft dependency** was found. The one crate mentioning
  LGPL (`r-efi@5.3.0`) is triple-licensed
  `MIT OR Apache-2.0 OR LGPL-2.1-or-later`, so a permissive option is
  available and no LGPL obligation arises.
- Every other dependency across both ecosystems declares a permissive
  license (MIT, Apache-2.0, BSD variants, ISC, 0BSD) or an explicit
  public-domain equivalent (Unlicense, CC0-1.0).
- That document's own words: this is "a preliminary observation, not a
  substitute for legal review of the full dependency tree," and "no
  incompatibility is known" against MPL-2.0 for this project's own code.

This arc's own source changes under `src/os/trust/` (envelope signing,
canonicalization, trust policy, credentials) were written against
dependencies already in the notices at last generation
(`@noble/curves`, `@noble/hashes` — both already used elsewhere in this
repository's production Nostr code) as of the point this document was
written. No new dependency compatibility issue is introduced by that
part of the arc's work.

## Flag: `qrcode` (MIT) needs a re-run of the notice generator after it lands

This same arc is adding a new runtime dependency, **`qrcode`
(MIT-licensed)**, for the Signed QR transport encoding described in
`docs/architecture/TRUST-MODEL.md`. At the time this document was
written, that dependency had not yet been installed in this worktree
(`package.json` did not yet list it) — its installation is other agents'
concurrent work on this same arc, not this document's.

**MIT is permissive and compatible with MPL-2.0** by the same reasoning
`LICENSE_STATUS.md` §5 already applies to this repository's other
permissive dependencies — this is not expected to be a compatibility
problem. But `THIRD_PARTY_NOTICES.md` and `LICENSE_STATUS.md`'s package
count (currently "313 npm packages") are **generated, deterministic**
artifacts, per `LICENSE_STATUS.md` §2: *"The full inventory is
`THIRD_PARTY_NOTICES.md` (generated, deterministic; regenerate with
`node scripts/generate_third_party_notices.mjs`)."* Adding `qrcode`
without regenerating that file leaves it stale and technically inaccurate
about the dependency tree's actual contents.

**Action needed at integration time (not by this document, not by this
arc's docs-only agent):**

1. After `qrcode` (and any of its own transitive dependencies) is
   actually installed and committed, re-run
   `node scripts/generate_third_party_notices.mjs`.
2. Re-check the regenerated `THIRD_PARTY_NOTICES.md` output for any
   surprise (a transitive dependency of `qrcode` with a non-permissive
   license would be worth catching here).
3. Update `LICENSE_STATUS.md` §5's package counts and "no forced-copyleft
   dependency" claim to reflect the new totals, once verified.

This document intentionally does not perform that regeneration itself —
per this arc's own task boundaries, `package.json` and installed
dependencies are other agents' concurrent work, and the coordinator is
expected to run this step once `qrcode` has actually landed.

## What this document is not

- Not a new license decision.
- Not a claim that `qrcode`'s addition has already been reconciled in
  `THIRD_PARTY_NOTICES.md` — it explicitly has not, as of this writing.
- Not legal advice, same disclaimer `LICENSE_STATUS.md` itself carries.
