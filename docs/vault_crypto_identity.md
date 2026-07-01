# Vault / Crypto / Identity — Design Notes (non-binding)

**Status: design notes only. Nothing here is implemented, and this document adds
no code, no cryptography, and no vault.** These notes capture the Vault / Shadow
/ Crypto / Identity ideas that originate from the *Federation OS v8.6* concept so
they can be revisited later as **separate, opt-in layers** — deliberately kept
OUT of the current Nostr + Cloudflare platform core.

This is a roadmap sketch, not a specification and not a security guarantee. Where
a section touches security-sensitive ground it lists the **risks and open
questions** rather than promising properties. Do not treat any statement here as
"safe", "secure", or "final". When any of these is eventually built, it must ship
behind an explicit boundary (like every other stage), with its own review, and
must not weaken any Stage 1–30 guardrail.

Scope reminder for anyone extending this file: **do not** add wording such as
"military-grade", "completely secure", "unbreakable", or "zero-trace guarantee".
Describe mechanisms and their limits instead.

---

## 0. Guiding principles

- **Separate layer, not core.** Identity/vault/crypto are future boundaries. The
  current platform (ingest, threads, spaces, chat/commerce models, asset cache,
  MeshKV opt-in, runtime DI) must keep working with none of them present.
- **No key custody in the app.** The app already holds/generates/stores no
  private key (signing is delegated to an external NIP-07 signer). Any future
  vault keeps that property: secrets live in a dedicated layer, not in render,
  worker, or cache code.
- **Boundaries first, implementation later.** Each item below is expected to land
  as an interface + mock/no-op first (the pattern used throughout this repo)
  before any real crypto or network is added.
- **State limits, not guarantees.** Every security-relevant note names the leak
  vectors and unknowns; it does not claim the design defeats them.

---

## 1. Apple ID / Passkey are NOT a key-derivation source

- **Do not derive Nostr (or any wallet) keys from an Apple ID JWT, Apple `sub`/
  user id, or a Passkey credential.** Those identifiers are issuer-controlled,
  rotatable, and not secret material; deriving long-lived signing keys from them
  couples key security to a third party and to token formats that can change.
- **Correct role: authentication/unlock only.** Apple ID / Passkey should, at
  most, gate access to a **locally stored master seed** (e.g. authorize
  decrypting a local encrypted seed blob), never *be* the seed and never feed a
  KDF that outputs the seed.
- Passkeys can protect a local secret (as a user-presence/unlock factor) but the
  secret must be generated independently with a proper CSPRNG.
- Open questions: account recovery UX when the device/seed is lost; multi-device
  sync of the encrypted seed (out of scope here); avoiding silent lock-in to one
  platform's attestation.

## 2. Bitcoin / Monero / Nostr key organization (BIP39 / BIP32 / NIP-06)

Organizational sketch only — **not implemented, no derivation code, no test
vectors here.**

- **Master seed:** a single high-entropy seed (BIP39 mnemonic → seed) generated
  by a vetted library, held only inside the future crypto core (Section 4).
- **Bitcoin path:** standard BIP32/BIP44-family derivation (e.g. account/change/
  index) for on-chain keys. Details deferred.
- **Monero path:** Monero uses its own key model (spend/view keys, its own seed
  scheme); it does **not** map cleanly onto BIP32. Treat it as a distinct
  derivation with its own library, not a BIP32 child.
- **Nostr path:** NIP-06 (`m/44'/1237'/…`) style derivation to a secp256k1 key,
  used only through the existing external-signer boundary — the app still never
  holds the key directly.
- Explicitly deferred: exact paths, passphrase (BIP39 25th word) handling,
  account discovery, and any cross-chain linkage. **No derivation is performed
  anywhere in this repo.**

## 3. Cryptography must be AEAD (authenticated encryption)

- **XOR/stream "encryption" without authentication is forbidden.** No hand-rolled
  XOR, no unauthenticated CTR, no home-grown constructions.
- **Candidates:** ChaCha20-Poly1305 (incl. XChaCha20-Poly1305 for larger random
  nonces) or AES-GCM, via a vetted library. Selection deferred to the crypto core
  stage.
- **Tamper detection is mandatory:** every ciphertext carries an authentication
  tag that is verified before use; a failed tag = reject, do not fall back to
  plaintext. Bind associated data (AAD) where it matters (versions, key ids).
- **Nonce discipline:** never reuse a (key, nonce) pair; prefer random nonces
  large enough to make collisions negligible (XChaCha20) or a counter scheme with
  strict state management.
- **Key derivation:** use HKDF (or a password KDF like Argon2 for
  passphrase-derived keys) — never use a raw identifier or hash of a token as a
  key.
- This complements, and does not replace, the app's existing note that any future
  application-level encryption will use a vetted AEAD, never hand-rolled XOR.

## 4. Rust crypto core as a future SEPARATE package

- **Candidate package:** `packages/fedos-core-rust` (name provisional) — a
  standalone Rust crate exposed to the host later (e.g. via WASM/FFI), **not**
  embedded into the TypeScript app now. **No Rust is added in this stage.**
- **Candidate crates to evaluate:** `zeroize` + `secrecy` (wipe/guard secrets),
  `subtle` (constant-time comparisons), `chacha20poly1305` / `aes-gcm` (AEAD),
  `hkdf` (KDF), `argon2` (passphrase KDF), `bip39` (mnemonics), plus the relevant
  secp256k1/Monero libraries. Evaluation only; nothing is pinned.
- **Why Rust / why not Python for the secret path:** managed runtimes (Python,
  JS) cannot reliably **zero** secret memory — immutable `bytes`/`str`, garbage
  collection, interning, and copies mean plaintext keys can linger and be paged/
  dumped. `del`/overwriting a Python object does not guarantee erasure. A crypto
  core with `zeroize`/`secrecy` and constant-time ops narrows (does not eliminate)
  that exposure. This is a limitation to document, not a guarantee to advertise.
- Open questions: WASM's own memory-zeroing and side-channel limits; FFI
  boundary safety; reproducible builds; audit before any real use.

## 5. Deniable Vault / Shadow Vault — RESEARCH boundary only

- **This is a research/threat-model boundary, not a shipped feature, and carries
  NO production safety claim.**
- **Forbidden anti-pattern:** branching on a magic index like `finger_id = 5`
  (or any trivially-enumerable selector) to reveal a hidden volume. Such tells
  are discoverable and defeat the purpose.
- **Prior art is reference only:** TrueCrypt/VeraCrypt hidden-volume *ideas* are
  informative for the threat model, but their known weaknesses (and the fact that
  deniability often fails under real forensic/coercion scenarios) must be
  respected. Cite them as study material, not as a design to copy.
- **Leak vectors to keep front-of-mind** (a non-exhaustive list; do not claim to
  have solved these): fixed-size containers and padding (so a hidden region is
  not inferable from size/free-space deltas), metadata leaks (filenames, sizes,
  counts), timestamp leaks (mtime/atime, write patterns), access-pattern/IO
  timing, and the mere existence of "deniability tooling" being itself
  incriminating in some jurisdictions.
- **Explicitly out of scope of any promise:** this project will not assert that a
  deniable/shadow vault protects a user under coercion or forensic analysis. If
  ever prototyped, it ships clearly labeled experimental with its limits stated.

## 6. IPFS as a FUTURE asset backend candidate

- **Do not embed an IPFS node in the app or Worker.** IPFS, if used, sits behind
  the existing `AssetCache` boundary as one more adapter for **public** media,
  reached via a gateway/pinning service — not an in-process node.
- **Design sketch:** a pinning service (or self-hosted pinner) for persistence, a
  gateway for reads, content-addressed keys mapping onto the asset cache's keying.
  Writes stay gated by `canCacheAsset` (public/unlisted only) exactly like R2/
  MeshKV.
- **Risks to document, not wish away:**
  - *Non-deletability:* content published to IPFS may be impossible to fully
    retract once fetched/pinned by others. Never place private/paid/secret/DM/
    payment data on it (the policy gate already refuses these).
  - *Availability/liveness:* unpinned content can disappear; pinning ≠ permanent.
  - *Traffic analysis:* gateway requests and CID lookups can reveal what a user
    is fetching; consider this before routing anything sensitive (don't).
- IPFS stays a **public-media** option only; it is not a delivery/entitlement or
  privacy layer.

## 7. Push / Telegram / LINE as a Notification Bridge candidate

- **Notifications carry no secrets.** Never put private content, keys, seeds,
  message bodies, DM contents, or payment details in a push payload or a
  Telegram/LINE message. Notifications are pointers ("you have activity"), not
  data transports.
- **APNs / FCM metadata leakage:** the push providers (Apple/Google) see delivery
  metadata (device tokens, timing, app identity, and any payload you send). Treat
  payloads as visible to the provider; keep them contentless and minimal.
- **Telegram / LINE scope:** at most an external-notification channel and
  invite-link surface (e.g. "open this space"), not a place to send or store
  anything confidential. They are third-party platforms with their own logging.
- Any bridge is an outbound, opt-in boundary with its own review; it must not be
  auto-wired into request handling.

## 8. Lightning / Payment as a FUTURE boundary

- **No payment is implemented and none is planned for this stage.** The existing
  commerce model is advisory only (no money moves, nothing is delivered);
  `priceCents` is display metadata.
- **Candidates to investigate later:** Breez SDK, Greenlight, or similar
  non-custodial Lightning stacks — as an *external* payment boundary the app
  talks to, never as embedded custody. LSP/custody trade-offs must be spelled out.
- **Liquidity is the hard problem:** inbound liquidity, channel management, LSP
  dependence, on-chain fees, and failure/refund UX are non-trivial and must be
  designed explicitly. A "just add Lightning" framing is wrong.
- When built, it slots in like the promotion/publish boundaries: an interface +
  mock first, no auto-charging, no custody in app/Worker/cache code.

## 9. Tor / IP privacy

- **Relays see your IP.** A Nostr relay (and any gateway/pinning/push endpoint)
  observes the connecting IP; the current read-only relay path is no exception.
  This is a metadata exposure users should understand.
- **Options to study (not implemented here):** routing relay/gateway traffic over
  Tor via a SOCKS5**h** proxy (so DNS is resolved through Tor, not locally), or a
  user-supplied proxy. Getting `h` right matters — plain SOCKS5 can leak DNS.
- **Mobile constraints:** background sockets, battery/OS restrictions, and app-
  store rules complicate always-on Tor on iOS/Android; a bundled Tor may itself
  raise review flags (see Section 10).
- **This stage implements none of it** and makes no anonymity claim. IP-privacy
  work would be a separate, clearly-scoped boundary.

## 10. App Store / Play Store distribution risks

- **iOS options:** a PWA (no store review, but limited background/push/crypto-
  storage capabilities), TestFlight (review-lite, capped testers, expiring
  builds), or sideloading avenues (e.g. AltStore) — each with capability and
  longevity trade-offs. A privacy/crypto/"vault" app may draw extra App Review
  scrutiny.
- **Android options:** direct APK distribution or F-Droid (which has its own
  reproducibility/no-proprietary-deps requirements), alongside the Play Store.
  More open, but with its own signing/update and trust considerations.
- **Store-review risk to plan for:** apps involving encryption, payments, crypto
  wallets, or "deniable" storage can be rejected, delisted, or forced to weaken
  features; export-compliance declarations may be required. Do not assume any of
  these layers can rely on Play/App Store availability.
- Distribution choice interacts with every layer above (push needs store/provider
  cooperation; Tor/sideloading may conflict with store policy) and should be
  decided per feature, not globally.

---

## Summary — what these notes DO and do NOT do

- **Do:** record intent, name candidate technologies, and enumerate risks so a
  future stage starts from a threat-aware baseline.
- **Do NOT:** implement anything, add cryptography, create a vault, derive keys,
  wire IPFS/Lightning/Tor/notifications, or make security guarantees.

Each item, when picked up, becomes its own boundary stage (interface + mock/no-op
first), with review, respecting all existing guardrails. See the README roadmap's
"future candidate boundaries".
