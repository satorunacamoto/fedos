# License Adoption and Test-Vector Provenance

Companion to [`00_publication_reconciliation.md`](00_publication_reconciliation.md).
The durable decision record is [`../../../LICENSE_STATUS.md`](../../../LICENSE_STATUS.md);
this file records how the conclusions were reached.

---

## 1. MPL-2.0 adoption

The owner selected **MPL-2.0**. Applied to:

| Location | Field | Value |
| --- | --- | --- |
| `LICENSE` | full text | Official MPL-2.0, verbatim |
| `package.json` | `"license"` | `MPL-2.0` |
| `packages/fedos-desktop-electron-spike/package.json` | `"license"` | `MPL-2.0` |
| `packages/fedos-core-rust/Cargo.toml` | `license` | `MPL-2.0` |

All four agree; each manifest was re-parsed after editing to confirm it
is still valid and reports `MPL-2.0`.

### The text is official and unmodified — proven, not asserted

```
curl -sL https://www.mozilla.org/media/MPL/2.0/index.txt -o MPL-2.0.txt
sha256sum MPL-2.0.txt
#   3f3d9e0024b1921b067d6f7f88deb4a60cbe7a78e76c64e3f1d7fc3b779b9d04

curl -sL https://raw.githubusercontent.com/spdx/license-list-data/main/text/MPL-2.0.txt -o MPL-2.0.spdx.txt
diff -wB MPL-2.0.txt MPL-2.0.spdx.txt     # -> no differences

sha256sum LICENSE
#   3f3d9e0024b1921b067d6f7f88deb4a60cbe7a78e76c64e3f1d7fc3b779b9d04
```

Two independent authoritative sources (Mozilla, SPDX) agree, and the
committed file is byte-identical to Mozilla's. The file is **LF-only**
(0 CR bytes, 373 LF), so `.gitattributes`' `eol=lf` normalisation does
not alter it — what was verified is exactly what is committed.

> A note on process: an initial check using `grep -c $'\r'` appeared to
> report 373 CR bytes. That was a false positive — the pattern degraded
> to an empty match and counted every line. Re-checked byte-wise in
> Python: **0 CR**. Worth recording because "the license file has CRLF"
> would have prompted an unnecessary and text-altering normalisation
> commit.

### No copyright holder was invented

MPL-2.0's operative text contains **no copyright-holder blank** — unlike
MIT or BSD, it is complete and usable as-is. No name, entity, or year
was added anywhere, because no human supplied one, and inferring one
from commit metadata would be fabrication. Recorded as an open optional
item in `LICENSE_STATUS.md` §6.

### Exhibit B was deliberately not invoked

The project does **not** declare itself "Incompatible With Secondary
Licenses," leaving downstream recipients the MPL-2.0 option to
redistribute under GPL/LGPL/AGPL terms within a Larger Work. Adding
Exhibit B would remove a right from users and was not requested.

### Per-file headers were not added

MPL-2.0's Exhibit A header is recommended, not required. Its own text
provides for exactly this case: where it is "not possible or desirable
to put the notice in a particular file," a `LICENSE` file where a
recipient "would be likely to look" suffices. Stamping ~3,900 files
would produce an enormous diff for no legal gain.

---

## 2. `test-vectors/nip44/nip44-v2.json` — provenance resolved

### Why it needed resolving

The repository had classified this file's provenance as **unresolved**,
recording honestly: *"treat as unlicensed pending an explicit upstream
grant."* Left alone, adopting MPL-2.0 risked the file **silently
inheriting a license the project has no right to grant.**

### What it is, and who depends on it

- A verbatim copy of upstream `nip44.vectors.json` — the official NIP-44
  v2 interoperability vectors, 8 categories including 3 official
  negative categories.
- Restructured **only** in JSON nesting shape (upstream's nested
  `v2.valid.*` / `v2.invalid.*` → this repo's `vectors[]` array). **No
  leaf value was ever changed.**
- Consumed via `include_str!` by `#[cfg(test)]` modules under
  `packages/fedos-core-rust/src/crypto/` — conversation key, message
  keys, padding, stream cipher, and encrypt/decrypt vector tests.
- **Test-only.** Compiled into test binaries; **not shipped** in any
  release artifact.

### Evidence gathered from primary sources on 2026-07-26

1. **`nostr-protocol/nips`' `README.md`:** *"All NIPs are public
   domain."* — verified by direct fetch.
2. **NIP-44 is one of those NIPs** — it is `44.md` in that repository.
3. **`44.md` itself publishes these vectors.** Under its own "Tests and
   code" heading (lines 297–303 of the current file):

   > We publish extensive test vectors. Instead of having it in the
   > document directly, a sha256 checksum of vectors is provided:
   >
   >     269ed0f69e4c192512cc779e78c555090cebc7c785b609e338a62afc3ce25040  nip44.vectors.json

   The public-domain NIP therefore **claims this exact file as its own
   published artifact and binds it by checksum.** Hosting it in the
   companion `paulmillr/nip44` repository is a size convenience the NIP
   states in as many words — not a separate authorship claim.
4. **The bytes match.** The upstream file fetched today hashes to
   exactly `269ed0f6…`, and a deep-equality check — reconstructing
   upstream's nesting from this repository's `vectors[]` array — found
   **every leaf value byte-identical**. Re-run after editing the file's
   `license` metadata field, confirming the vector data itself was never
   touched.

### The residual caveat, not glossed

- `paulmillr/nip44` has **no `LICENSE` file** and reports
  `license: null` via the GitHub API; its `/license` endpoint returns
  **404**. Re-checked 2026-07-26 — the repository's original finding is
  still accurate.
- `nostr-protocol/nips` **also** has no `LICENSE` file. Its
  public-domain dedication is a **README sentence, not a formal
  instrument** such as CC0-1.0.
- `paulmillr/nip44`'s README does say "Public domain," but in a table
  row scoped to the **TypeScript/JS implementation**, not to the vectors
  file. That was checked directly rather than read charitably.

This is a **documentary dedication, not a warranty of title.**

### Outcome — Option A: retain, with the MPL grant explicitly excluded

Retained on the strength of (1)–(4), **explicitly carved out of
MPL-2.0**, with the caveat recorded rather than buried. Concretely:

- The file's own `license` metadata field now states the full evidence
  chain, the re-verification date, and the residual caveat, and states
  plainly that it is **not** covered by MPL-2.0.
- `LICENSE_STATUS.md` §4 carries the decision record and reproduction
  commands.
- `test-vectors/README.md` gained a §8 stating that **nothing** in that
  directory is covered by the project license.
- `Cargo.toml`'s `license` field carries a comment saying the same.

**No legal claim beyond the evidence is made.** This is not a claim that
FedOS owns the file, and not legal advice. `LICENSE_STATUS.md` §6 lists
legal confirmation as an open item, with a contained remedy if it ever
comes back negative.

### Why B, C, and D were rejected

- **B — generate independent vectors from the public spec:** rejected as
  **actively harmful**. These vectors' value is that a *third party*
  wrote them: they demonstrate interoperability. Vectors generated by
  FedOS's own implementation would test that implementation against
  itself — circular, and a genuine loss of cryptographic assurance. It
  would also breach the repository's own standing rule that generated
  vectors must never be mixed silently with official ones.
- **C — remove, preserving equivalent coverage:** rejected because
  equivalent coverage **does not exist**. These are the only
  authoritative NIP-44 interoperability vectors.
- **D — omit from the public repository:** rejected because the file is
  `include_str!`-ed at compile time. Omitting it does not skip tests —
  it **breaks the test build outright** for everyone who clones, which
  defeats the purpose of publishing.

### The other four vector files

`chacha20poly1305-rfc8439.json`, `hkdf-rfc5869.json`,
`argon2id-rfc9106.json` (IETF Trust Legal Provisions; code components
under the Simplified BSD License) and `aes256gcm-nist.json` (NIST
publication) already carried adequate inline license notes. **Unchanged**,
and now explicitly excluded from the MPL grant by `test-vectors/README.md`
§8.
