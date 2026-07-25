# FedOS — Project License Status

**Decision made: this repository's own original code is licensed under the
Mozilla Public License, Version 2.0 (MPL-2.0).** The repository owner
selected it; this document is the decision record. It supersedes the
previous version of this file, which correctly reported that no license
had been selected.

The full, unmodified official license text is in
[`LICENSE`](LICENSE) at the repository root.

---

## 1. What was applied

| Location | Field | Value |
| --- | --- | --- |
| `LICENSE` | (full text) | Official MPL-2.0, verbatim |
| `package.json` (root) | `"license"` | `MPL-2.0` |
| `packages/fedos-desktop-electron-spike/package.json` | `"license"` | `MPL-2.0` |
| `packages/fedos-core-rust/Cargo.toml` | `license` | `MPL-2.0` |

All four agree. No other manifest in this repository declares a license:
`git ls-files | grep 'Cargo.toml$'` returns exactly one crate manifest,
and the two `package.json` files above are the only non-`node_modules`
package manifests.

### The `LICENSE` text is official and unmodified

Verified reproducibly at the time this file was written:

```
# Fetched from Mozilla's own canonical publication
curl -sL https://www.mozilla.org/media/MPL/2.0/index.txt -o MPL-2.0.txt
sha256sum MPL-2.0.txt
#   3f3d9e0024b1921b067d6f7f88deb4a60cbe7a78e76c64e3f1d7fc3b779b9d04

# Cross-checked against SPDX's independent canonical copy
curl -sL https://raw.githubusercontent.com/spdx/license-list-data/main/text/MPL-2.0.txt -o MPL-2.0.spdx.txt
diff -wB MPL-2.0.txt MPL-2.0.spdx.txt    # -> no differences

# And against what is committed here
sha256sum LICENSE
#   3f3d9e0024b1921b067d6f7f88deb4a60cbe7a78e76c64e3f1d7fc3b779b9d04
```

Two independent authoritative sources (Mozilla and SPDX) agree, and the
committed file is byte-identical to Mozilla's. The file is LF-only, so
this repository's `.gitattributes` (`* text=auto eol=lf`) does not
rewrite it. **Nothing in the license text was edited, reflowed, or
abridged.**

### No copyright holder was invented

MPL-2.0 is deliberately usable without filling in a copyright holder,
year, or entity name — unlike MIT or BSD, its operative text contains no
such blank. **This repository therefore names no copyright holder**,
because no human has supplied one, and this document will not infer one
from commit metadata.

If the owner later wants an explicit copyright line — optional under
MPL-2.0, and expressly permitted by its own text ("You may add
additional accurate notices of copyright ownership") — that is a human
decision. See §6.

## 2. Project license vs. dependency licenses — these are different things

- **`LICENSE` (MPL-2.0) covers this repository's own original source
  code only.**
- **It does not cover, change, or relicense any dependency.** Every npm
  package and Rust crate this project depends on keeps its own license,
  chosen by its own authors. The full inventory is
  [`THIRD_PARTY_NOTICES.md`](THIRD_PARTY_NOTICES.md) (generated,
  deterministic; regenerate with
  `node scripts/generate_third_party_notices.mjs`).
- **It does not cover the third-party test-vector data under
  `test-vectors/`.** See §4.

Applying MPL-2.0 required no change to any third-party notice, and none
was made. All pre-existing attribution is preserved.

## 3. What MPL-2.0 actually requires, in plain language

A practical summary for contributors and pilot participants. It is not
legal advice, and where this summary and [`LICENSE`](LICENSE) disagree,
**the license text wins**.

- **It is a file-level ("weak") copyleft.** The unit of copyleft is the
  individual *file*, not the whole program. If you modify a file covered
  by MPL-2.0 and distribute the result, you must make that file's source
  available under MPL-2.0. Files you *add* are yours to license as you
  choose.
- **Merely linking or combining does not relicense your code.** MPL-2.0
  explicitly contemplates a "Larger Work": you may combine MPL-covered
  files with files under other licenses — including proprietary ones —
  and distribute the whole, and **your own separate files are not
  automatically relicensed by that combination.** Only the MPL-covered
  files themselves stay under MPL-2.0. This is the main practical
  difference from the GPL family.
- **Source availability is required for the covered files** when you
  distribute them, in source or binary form, under the same license.
- **There is an explicit patent grant** from contributors, which
  terminates for a party that initiates patent litigation over the
  software.
- **There is no warranty.** MPL-2.0 disclaims warranty and liability.
  For this project that disclaimer is not a formality — see
  [`SECURITY.md`](SECURITY.md) and
  [`docs/pilot/KNOWN_RISKS.md`](docs/pilot/KNOWN_RISKS.md): no
  independent security audit has been performed.
- **Per-file headers are optional here.** MPL-2.0's Exhibit A header is
  recommended but not required for the license to apply; its own text
  says that where it is "not possible or desirable to put the notice in
  a particular file," a `LICENSE` file "in a relevant directory" where a
  recipient "would be likely to look" is sufficient. This repository
  relies on the root `LICENSE` file rather than stamping ~3,900 files.
- **Exhibit B was NOT invoked.** This project does *not* declare itself
  "Incompatible With Secondary Licenses," so the MPL-2.0 option allowing
  downstream recipients to redistribute under GPL/LGPL/AGPL terms as
  part of a Larger Work remains available to them.

## 4. Third-party material that MPL-2.0 does NOT cover

### `test-vectors/` — cryptographic known-answer data

None of this data is FedOS's own work, and **the MPL-2.0 grant does not
extend to any of it.** Each file records its own source, revision, and
license inline. Summary:

| File | Origin | Terms as recorded |
| --- | --- | --- |
| `aead/chacha20poly1305-rfc8439.json` | RFC 8439 | IETF Trust Legal Provisions; code components under the Simplified BSD License |
| `aead/aes256gcm-nist.json` | NIST CAVP (SP 800-38D) | U.S. federal government publication |
| `kdf/hkdf-rfc5869.json` | RFC 5869 | IETF Trust Legal Provisions; code components under the Simplified BSD License |
| `kdf/argon2id-rfc9106.json` | RFC 9106 | IETF Trust Legal Provisions; code components under the Simplified BSD License |
| `nip44/nip44-v2.json` | NIP-44 / `paulmillr/nip44` | Previously flagged unresolved; now resolved to **retain** — evidence and residual caveat both below |

### `test-vectors/nip44/nip44-v2.json` — the previously-unresolved case

Earlier revisions of this repository classified this file's provenance as
**unresolved** and recorded, honestly, "treat as unlicensed pending an
explicit upstream grant." That classification was re-examined
specifically for this publication, and the evidence was re-gathered from
primary sources on **2026-07-26**.

**Outcome: RETAIN the file, on verified redistribution evidence, and
exclude it explicitly from the MPL-2.0 grant.**

The evidence chain, each step independently checked:

1. `nostr-protocol/nips`' `README.md` states, without qualification:
   **"All NIPs are public domain."**
2. NIP-44 *is* one of those NIPs — it is `44.md` in that same
   repository.
3. `44.md` itself, under its own **"Tests and code"** heading, says:
   *"We publish extensive test vectors. Instead of having it in the
   document directly, a sha256 checksum of vectors is provided:"*
   followed by
   `269ed0f69e4c192512cc779e78c555090cebc7c785b609e338a62afc3ce25040  nip44.vectors.json`.
   In other words **the public-domain NIP publishes this exact file as
   its own artifact and binds it by checksum**; the file lives in the
   companion `paulmillr/nip44` repository only because it is too large
   to inline, which `44.md` says in as many words.
4. The upstream file, fetched fresh on 2026-07-26, hashes to **exactly**
   that published checksum, and every leaf value in this repository's
   copy is **byte-identical** to it — verified by deep-equality after
   undoing this repository's nesting-shape change. Only the JSON nesting
   differs; never a value.

Reproduce it:

```
curl -sL https://raw.githubusercontent.com/paulmillr/nip44/main/nip44.vectors.json -o v.json
sha256sum v.json    # -> 269ed0f69e4c192512cc779e78c555090cebc7c785b609e338a62afc3ce25040
curl -sL https://raw.githubusercontent.com/nostr-protocol/nips/master/44.md | grep -A2 "We publish extensive test vectors"
curl -sL https://raw.githubusercontent.com/nostr-protocol/nips/master/README.md | grep -i "public domain"
```

**The residual caveat, stated plainly rather than glossed:**
`paulmillr/nip44` still carries **no `LICENSE` file** and still reports
`license: null` through the GitHub API — re-checked 2026-07-26, where
the `/license` endpoint returns HTTP 404. `nostr-protocol/nips` likewise
has no `LICENSE` file; its public-domain dedication is a **README
sentence, not a formal instrument** such as CC0-1.0. This is a
documentary dedication, not a warranty of title.

The judgement made here is that (1)–(4) together are a sufficient basis
to redistribute unmodified, checksum-verified, publicly-published
cryptographic test data. It is **not** a claim that FedOS owns the file,
and it is **not** legal advice. A lawyer may reasonably want to confirm
it — see §6.

**Why not the alternatives:**

- *Replace with independently generated vectors* was rejected as
  **actively harmful**. These vectors' entire value is that a *third
  party* authored them: they prove FedOS's NIP-44 implementation
  interoperates with everyone else's. Vectors generated by FedOS's own
  implementation would validate that implementation against itself —
  circular, and a real loss of cryptographic assurance. It would also
  violate this repository's own standing rule that generated vectors
  must never be silently mixed with official ones
  (`test-vectors/README.md` §5).
- *Remove it while preserving equivalent coverage* was rejected because
  equivalent coverage **does not exist**. These are the only
  authoritative NIP-44 interoperability vectors.
- *Leave it out of the public repository* was rejected because the file
  is consumed via `include_str!` by `#[cfg(test)]` modules in
  `packages/fedos-core-rust/src/crypto/`. Omitting it does not merely
  skip tests — it **breaks the test build outright** for anyone who
  clones the repository, which is precisely the audience a public
  repository exists to serve.

The file is *test-only*: it is compiled into test binaries under
`#[cfg(test)]` and is **not** shipped in any release artifact.

## 5. Dependency license compatibility — preliminary, non-binding

`THIRD_PARTY_NOTICES.md` (313 npm packages, 82 Rust crates at generation
time) contains **no forced-copyleft dependency**. The one crate
mentioning LGPL (`r-efi@5.3.0`) is triple-licensed
`MIT OR Apache-2.0 OR LGPL-2.1-or-later`, so a permissive option can be
taken and no LGPL obligation arises. Every other dependency across both
ecosystems declares a permissive license (MIT, Apache-2.0, BSD variants,
ISC, 0BSD) or an explicit public-domain equivalent (Unlicense, CC0-1.0).

Permissive dependencies impose no constraint on choosing MPL-2.0 for
this project's own code, so **no incompatibility is known**. This remains
a preliminary observation, not a substitute for legal review of the full
dependency tree.

## 6. HUMAN / LEGAL ITEMS STILL OPEN

These are genuinely open. None of them blocks the Closed Pilot; they are
recorded here so they are not lost.

- **Optional copyright notice.** No copyright holder is named anywhere.
  MPL-2.0 does not require one. If the owner wants attribution, supply
  the exact legal name and year to be added.
- **Legal confirmation of the NIP-44 vector judgement in §4.** The
  evidence is documented and reproducible; a lawyer may wish to confirm
  it. If the answer ever came back negative, the remedy is to delete
  `test-vectors/nip44/nip44-v2.json` and the `#[cfg(test)]` modules that
  `include_str!` it — a contained change, and the reason those modules
  are test-only matters here.
- **Upstream clarification (optional, and the cleanest fix).** Asking
  `paulmillr/nip44` to add an explicit `LICENSE` or CC0 dedication would
  remove the residual caveat entirely — for this project and for every
  other downstream consumer.
- **Contributor licensing model.** No CLA or DCO is currently required;
  inbound contributions are taken under MPL-2.0 on the
  inbound=outbound convention. See [`CONTRIBUTING.md`](CONTRIBUTING.md).
