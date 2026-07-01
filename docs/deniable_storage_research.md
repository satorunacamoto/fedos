# Deniable Storage — Research Boundary (non-binding, docs only)

**Status: research notes only. This document adds NO code, NO cryptography, NO
vault, NO hidden volume, NO storage adapter, and NO IPFS integration.** It exists
so that Shadow Vault / Deniable Storage / Hidden Volume ideas are studied — with
their dangers, constraints, and hard prohibitions written down — *before* anyone
is tempted to implement them. It expands on §5 ("Deniable Vault / Shadow Vault —
RESEARCH boundary only") of
[`vault_crypto_identity.md`](vault_crypto_identity.md).

This is a threat-model sketch, not a specification and not a security guarantee.
Where a section touches security-sensitive ground it lists **risks and open
questions** rather than promising properties. Do not treat any statement here as
"safe", "secure", or "final".

Scope reminder for anyone extending this file: **do not** add wording such as
"completely hidden", "zero-trace", "absolutely safe", "legally safe",
"military-grade", "unbreakable", or "plausible deniability guaranteed". Describe
mechanisms and their **limits** instead.

---

## 1. This document is a research boundary, not an implementation spec

Nothing here is scheduled, designed to completion, or approved for shipping. It
does not define an interface, a file format, a key schedule, or an API. If any of
this is ever prototyped it must land as a **separate, opt-in package** with its
own review, behind an explicit boundary, respecting every Stage 1–39 guardrail,
and it must ship clearly labeled **experimental** with its limits stated. Until
then: **no implementation.**

---

## 2. Forbidden anti-pattern: branch-selected shadow vaults

A "shadow vault" selected by a trivially-enumerable branch — e.g. `finger_id = 5`
unlocks the hidden volume while other fingers unlock the decoy, or any magic
index / secret gesture / alternate PIN that switches which volume is revealed —
is **forbidden**. Such selectors are:

- **Discoverable.** The branch exists in code, config, or observable behavior; a
  forensic examiner or a coercive adversary who knows the tool exists can look
  for exactly this tell.
- **Self-defeating.** The moment the *existence* of a second volume is inferable,
  deniability is gone — and a "why is there an unlock path you didn't show me?"
  question is worse than having no hidden volume at all.
- **Coercion-fragile.** Deniability schemes assume the adversary cannot compel
  more unlocks; real coercion scenarios break that assumption.

Do not implement branch-on-selector hidden volumes. Do not ship a decoy/real
toggle. Do not add an "emergency alternate password" that reveals a different
dataset.

---

## 3. TrueCrypt / VeraCrypt: reference for the threat model, not a blueprint

TrueCrypt/VeraCrypt hidden-volume *ideas* are useful **study material** for
understanding what has been tried and where it fails. They are **not** a design
to copy:

- Their hidden-volume deniability has known, documented weaknesses and has failed
  under real forensic/coercion analysis.
- Reproducing a decades-old container format in a mobile/cloud/JavaScript context
  imports the weaknesses without the desktop assumptions that (partly) justified
  them.
- Cite them as prior art and cautionary tales. Do not treat "VeraCrypt does X" as
  a reason to do X here.

---

## 4. Why hidden volumes are hard — leak vectors to keep front-of-mind

A non-exhaustive list of ways a "hidden" region betrays its own existence. Do
**not** claim to have solved any of these:

- **Fixed-size containers.** A hidden region must not be inferable from container
  size, free-space deltas, or growth over time. Variable-size containers leak the
  presence/extent of hidden data.
- **Padding.** Without disciplined padding, the boundary between decoy and hidden
  data (or between "empty" and "used") becomes statistically visible.
- **Metadata leak.** Filenames, directory entries, sizes, counts, and file-type
  fingerprints reveal content and structure even when bytes are encrypted.
- **Timestamp leak.** mtime/atime/ctime, write ordering, and modification
  patterns expose when a hidden region was touched.
- **Access-pattern / I/O timing leak.** Which blocks are read/written, and when,
  can reveal a second volume through side channels even if its contents are
  opaque.
- **Backup leak.** A single backup snapshot taken while the hidden volume was
  mounted (or diffs across snapshots) can expose it; users rarely control every
  backup path.
- **Cloud sync leak.** Sync clients replicate file sizes, block deltas, versions,
  and timing to a server that logs them — a hidden volume synced anywhere is no
  longer hidden.
- **Mobile OS lifecycle leak.** Backgrounding/suspension snapshots, memory
  pressure, OS-level backups (iCloud/Google), thumbnail caches, spotlight/index
  services, crash logs, and app state restoration can all persist or expose data
  outside the app's control.

The correct posture is to **document these as unsolved**, not to imply the boundary
handles them.

---

## 5. AEAD / KDF / zeroize / memory-lock belong to a future Crypto Core

Any real cryptographic primitive this topic would need — authenticated encryption
(AEAD), key derivation (KDF), secret zeroization, memory locking/`mlock`,
constant-time operations — is **out of scope here** and belongs to the future
**Crypto Core** boundary (a separate Rust crate; see
[`vault_crypto_identity.md`](vault_crypto_identity.md) §3–4 and `src/crypto/`,
which is a *type-only* seam with no real crypto). This document specifies none of
them and must not. Managed-runtime memory (JS/GC) cannot guarantee zeroization;
that limit is documented, not hand-waved.

---

## 6. If content is placed on IPFS — dangers to document, not wish away

IPFS is at most a **public-media** adapter behind the existing `AssetCache`
boundary (gateway/pinning, never an embedded node), and it is **not** a privacy or
deniability layer. If deniable/hidden data ever touched IPFS the risks include:

- **CID size / tree-structure leak.** Content-addressed identifiers, chunk sizes,
  and the DAG/merkle-tree shape leak information about the payload even when the
  bytes are encrypted.
- **Pinning / deletion impossibility.** Once fetched or pinned by others, content
  can be effectively impossible to retract — "delete" is not a guarantee.
- **Gateway traffic analysis.** Gateway requests and CID lookups reveal what a
  user fetches/publishes and when; this is a metadata side channel.
- **Encrypted payload still leaks metadata.** Encryption hides the plaintext, not
  the size, timing, access pattern, or existence of the object.

Conclusion: never place private/paid/secret/DM/payment/deniable data on IPFS. The
existing `canCacheAsset` policy already refuses non-public bytes, and that must
stay true.

---

## 7. Relationship to Nostr — public metadata, no deletion guarantee

- **Events are public metadata.** Nostr events (ids, pubkeys, timestamps, tags,
  kinds, relay of origin) are broadcast and copyable. Treat everything on Nostr as
  permanently public metadata, regardless of `content` encryption.
- **A deletion request is not a deletion guarantee.** NIP-09 "delete" is a
  *request* relays may ignore; copies persist. Do not model deniability on the
  assumption that anything published can be recalled.
- **Relay IP-logging risk.** Relays (and the network path) can log client IPs and
  connection timing, correlating activity to a user. A deniable-storage design
  cannot assume the transport is unobserved.

Nostr is a public event layer, not a hiding place.

---

## 8. UI / UX wording that is forbidden

Regardless of any future mechanism, the product must **never** present claims such
as:

- "completely hidden" / "your data is completely hidden"
- "zero-trace" / "leaves no trace"
- "absolutely safe" / "100% secure" / "unbreakable"
- "legally safe" / "safe from subpoena/coercion"
- "plausible deniability guaranteed" / "military-grade" / "undetectable"

These over-promise properties that hidden-volume schemes provably do not deliver
and can put users in danger. Describe **mechanisms and their limits** only, and
label anything experimental as experimental.

---

## 9. Preconditions if this is EVER implemented (not now)

If — after this research boundary — a deniable/shadow layer were ever built, it
would first require **all** of the following. Absence of any one is a blocker:

- **Rust core.** Cryptography lives in the audited Rust Crypto Core, not in
  TypeScript/JS render/worker code.
- **Audited crypto primitives.** Only reviewed, standard AEAD/KDF primitives — no
  home-grown ciphers, no XOR, no bespoke "obfuscation".
- **Fixed-size container.** Storage containers are fixed-size with disciplined
  padding so a hidden region is not inferable from size/free-space deltas.
- **Deterministic-free nonce discipline.** Nonces/IVs follow a strict
  non-reuse/non-deterministic-misuse discipline; nonce reuse is catastrophic.
- **No direct Apple ID / provider seed derivation.** Identity providers (Apple ID
  / Google / Passkey / WebAuthn) are **unlock triggers only**, never a
  key-derivation source — consistent with the Identity boundary (Stages 36–37).
- **Local-only unlock model.** Unlock happens locally; secrets are not sent to a
  server or provider to be "unlocked" remotely.
- **No cloud backup by default.** The container is excluded from cloud/OS backup
  and sync by default; any opt-in is explicit and its leak implications are stated.

---

## 10. Current conclusion

- **No implementation.** Nothing in this area is built or scheduled.
- **No production guarantee.** This boundary makes no safety, privacy, or
  deniability claim.
- **Docs only.** This file is research/threat-model material, not a spec.
- **Future separate package only.** If ever pursued, it ships as a separate,
  opt-in, experimental package behind its own boundary and review — never folded
  into the current core, the Vault seam, the Crypto seam, or any storage adapter.
