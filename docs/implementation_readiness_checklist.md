# Implementation Readiness Checklist (docs only, no code)

**Status: this document adds no code.** It is Stage 132 of the **Boundary
Phase index + Implementation readiness checklist + Phase transition
roadmap** docs-only batch. It is a checklist of preconditions to satisfy
before Stage 134+ begins the **Implementation Phase** (the first stage that
lands a real, production-reachable primitive instead of a label-only
boundary) — it changes nothing under `src/`, `packages/`, `Cargo.toml`, or
`test/`.

Each item below is marked `[ ]` (not yet satisfied — still a precondition)
or `[x]` (already satisfied by an existing Stage 1–130 boundary/doc, cited).
An `[x]` here means the **precondition** for that concern is in place
(a policy, a safety-rule doc, a label taxonomy) — it does **not** mean the
real implementation exists. See `docs/boundary_phase_index.md` for what
each cited stage actually shipped.

---

## 1. Crypto

- [x] **`randomBytes` candidate dependency adopted.** `getrandom` is in
  `Cargo.toml` (Stage 104), but never called anywhere — prod or test. The
  precondition (an audited CSPRNG crate, reviewed and build-checked) is
  satisfied; the implementation is not. See
  `docs/fedos_core_rust_safety.md` §7 ("CSPRNG adoption is a separate
  Stage").
- [ ] **Nonce generation policy is not yet fixed in writing.** The
  non-reuse rule exists (`docs/fedos_core_rust_safety.md` §7: "No nonce
  reuse... nonce reuse under a key is catastrophic and is forbidden") and
  `docs/vault_crypto_identity.md` §3 names the tradeoff (random nonces
  large enough to make collisions negligible — i.e. XChaCha20's 24-byte
  nonce — versus a counter scheme with strict state management), but no
  document fixes **which** scheme this codebase will use, how a nonce is
  sourced (`getrandom` vs. a counter persisted where), or how reuse is
  prevented across process restarts. **This is the recommended Stage 134
  docs step** — see `docs/implementation_phase_roadmap.md` §1.
- [ ] **`SecretHandle` still holds a placeholder marker, not real bytes.**
  Stage 79's `secret_handle` module proved `zeroize`/`secrecy` compile and
  `.clear()` wipes a fake marker (`docs/fedos_core_architecture_freeze_v1.md`
  §3 row `secret_handle`), but `docs/fedos_core_rust_safety.md` §6 is
  explicit: "Secrets and their zeroization arrive together... never 'add
  secrets now, zeroize later'" — so real-byte `SecretHandle` support must
  land as its own reviewed stage, together with (not before or after) the
  zeroize-on-drop guarantee.
- [ ] **HKDF has no internal (production) implementation.** `hkdf` is
  adopted (Stage 76) and verified against RFC 5869 under `cargo test` only
  (Stage 77/83); `kdf_core`'s `KdfPlaceholderRequest` (Stage 82) is a label
  skeleton with no byte path. No `pub` or `pub(crate)` function derives a
  key today.
- [ ] **AEAD has no internal (production) implementation.** Both
  `chacha20poly1305` (Stage 74/75/81) and `aes-gcm` (Stage 101) are
  verified against their official vectors under `cargo test` only;
  `aead_core`'s `AeadPlaceholderRequest` (Stage 80) is a label skeleton.
  No `pub` or `pub(crate)` function seals or opens a ciphertext today.
- [ ] **Public `encrypt`/`decrypt`/`deriveKey` remain fixed placeholder
  functions.** `fedos_core_status`, `fedos_core_capabilities`,
  `random_bytes_placeholder`, `derive_key_placeholder`,
  `encrypt_placeholder`, `decrypt_placeholder` have been byte-for-byte
  unchanged since Stage 69 (`docs/fedos_core_architecture_freeze_v1.md` §6);
  the label-only design for their eventual real signatures was fixed
  Stage 102–106 (`docs/fedos_core_public_api_design.md`,
  `docs/public_capability_matrix.md`) but no real body exists.

## 2. Storage

- [ ] **"Local-only first" is a naming convention, not an enforced
  order.** `src/storage/types.ts` defines `StorageVisibility` including
  `"local_only"` and lists `local_sqlite_placeholder`/
  `local_mesh_placeholder` as `StorageBackendKind` candidates alongside
  `google_drive_placeholder`, but nothing in `src/storage/policy.ts` or
  `noop_storage.ts` requires a local backend to be selected/implemented
  before a remote one. Fixing "local-only ships first" as a binding
  sequencing rule (not just a type-level option) is an open precondition.
- [ ] **No encrypted packet format exists.** `StoragePacket` (Stage 107)
  carries an opaque `idRef`, a `StorageBackendKind`, and sanitizer-checked
  metadata (Stage 108/109) — no ciphertext field, no AEAD envelope, no
  format version byte. This must follow (never precede) the AEAD
  implementation item in §1, per `docs/fedos_core_rust_safety.md` §5
  ("Adopt per feature, per Stage").
- [x] **No Google Drive direct dependency exists.** `src/storage/policy.ts`
  (`isLikelyUrlOrPathRef`) rejects any `idRef` shaped like
  `drive.google.com`/`docs.google.com` (or any URL/file path) rather than
  an opaque label — confirmed by reading the source directly. No
  `googleapis`/Drive SDK import exists anywhere in `src/` or `package.json`.
  `src/storage/types.ts`'s own header comment fixes `google_drive_placeholder`
  as a candidate label only, replacing "the Python v8.6 host's Google Drive
  coupling," never re-introducing a direct API dependency.

## 3. Federation

- [ ] **No Nostr signing implementation exists in this codebase.** Signing
  is, and after Stage 130 remains, fully delegated to an external NIP-07
  provider (`src/sign/nip07.ts`, Stage 10) — the app has never held,
  generated, or derived a private key. This is a deliberate boundary, not
  a gap to "fix" casually; any future in-app signing (e.g. NIP-06-derived
  keys per `docs/vault_crypto_identity.md` §2) is its own reviewed stage
  that must not weaken the "app never holds a key directly" guardrail.
- [ ] **No relay connection is opened by any code path today.**
  `src/nostr/ws_relay.ts` (read) and `src/nostr/publish.ts` (write, Stage
  12) both require an injected `WebSocketFactory` and are never
  constructed by the Runtime or Worker by default — `NoopFederationProvider`
  (Stage 110) never reaches `connected`.
- [ ] **The outbound publish queue has no retry policy.** Stage 118's
  `outbound_queue.ts` is a pure in-memory FIFO
  (`enqueuePlaceholder`/`dequeuePlaceholder`) with no send, no failure
  path, and therefore no retry/backoff logic; Stage 122's
  `queue_status_preview.ts` only summarizes counts, it does not drive the
  queue. A retry policy (attempt caps, backoff schedule, dead-letter
  handling) has no design doc yet — a precondition for wiring the queue to
  a real relay.
- [ ] **Publish-queue behavior is otherwise undesigned beyond FIFO order.**
  No document yet fixes what happens on relay rejection (NIP-20
  `accepted:false`), partial multi-relay failure, or reordering under
  concurrent publish attempts.

## 4. Creator

- [x] **Listing model exists as a policy-only boundary.**
  `src/marketplace/types.ts`/`noop_marketplace.ts` (Stage 111) and
  `src/commerce/*` (Stage 17) fix `Product`/`DigitalAsset` shapes and
  visibility policy; `NoopMarketplaceProvider` never lists a real item.
  The precondition (a stable shape to build a real listing store against)
  is satisfied.
- [x] **Entitlement model exists as a policy-only boundary.**
  `src/creator/entitlement.ts` (Stage 111) and `PurchaseGrant` (Stage 17)
  fix what a grant record would contain; `NoopEntitlementProvider` never
  grants access. `src/creator/subscription_policy.ts` (Stage 125) is
  structurally conservative — only `public_placeholder` is ever visible,
  regardless of any supplied viewer tier — so entitlement cannot be
  silently bypassed by wiring a naive check.
- [ ] **Payment is explicitly deferred, and no order is fixed for it
  relative to entitlement.** `docs/creator_monetization_flow.md` fixes the
  intended sequencing (listing → purchase → payment → entitlement → chat
  → federation, Stage 112), but no payment provider, Lightning/Stripe
  integration, or invoice/checkout flow exists (`src/payment/*` Stage 44
  is `NoopPaymentProvider`/`PlaceholderPaymentProvider` only). Payment
  implementation is intentionally the LAST creator-domain item — see
  `docs/implementation_phase_roadmap.md` §3 ("must not combine payment +
  entitlement in one stage").

## 5. Security

- [x] **Threat model exists for the highest-risk future surface.**
  `docs/deniable_storage_research.md` (Stage 40) and
  `docs/anti_analysis_shadow_vault_risks.md` (Stage 66) both name leak
  vectors (metadata/timestamp/access-pattern/size, false-positive risk of
  detection heuristics) without claiming any property is solved. A
  narrower crypto-specific threat model (side channels for a real AEAD/KDF
  implementation) does not yet exist and should be written alongside the
  first real AEAD stage (§1).
- [ ] **Secret lifecycle is designed but not implemented.**
  `docs/fedos_core_rust_safety.md` §6 fixes the rule ("Secrets and their
  zeroization arrive together") and Stage 79's `SecretHandle` proves the
  mechanism compiles against a fake marker — but no real secret has a
  lifecycle (creation → use → zeroize-on-drop) anywhere yet. This is the
  same open item as §1's `SecretHandle` real-byte line, restated from the
  security side.
- [x] **Logging ban is fixed in writing and holds today.**
  `docs/fedos_core_rust_safety.md` §6 ("No secret in logs/debug output")
  and `docs/anti_analysis_shadow_vault_risks.md` §5 ("No secret in logs...
  never write keys, seeds, plaintext, ciphertext, passphrases, or tokens
  to logs, crash reports, analytics, or error messages") both bind this
  already; `error_taxonomy` (Stage 95) and `audit_event`/`audit_policy`
  (Stage 96–97) hold no message/payload field to leak through. Holds
  trivially today because no secret exists yet to log.
- [x] **No shadow-vault implementation exists, and it stays prohibited.**
  `docs/deniable_storage_research.md` §2 forbids branch-selected hidden
  vaults; `docs/anti_analysis_shadow_vault_risks.md` §6–§7 forbid a fake-
  activity/decoy generator and any magic-index toggle. Nothing under
  `src/vault/*` implements deniable storage — it remains a Stage 40
  research boundary only.
- [x] **No anti-debug/anti-VM/self-destruct exists, and it stays
  prohibited.** `docs/anti_analysis_shadow_vault_risks.md` §1–§2 is a
  binding prohibition (debugger/VM detection, self-destruct, forced
  process exit) with §5 naming the only acceptable substitutes (app-lock
  on background, explicit user lock, session timeout) — none of which is
  implemented today either, but the prohibition itself is fully in force
  and not contingent on any future stage.

## 6. Testing

- [x] **RFC/NIST test vectors are green today.** RFC 8439
  (`chacha20poly1305`), RFC 5869 (`hkdf`), RFC 9106 (`argon2`), and NIST
  CAVP AES-256-GCM (`aes-gcm`) are all wired to `cargo test` (Stage
  75/77/85/101) and verified against
  `test-vectors/{aead,kdf}/*.json` (Stage 73). This environment currently
  has no `cargo` on `PATH` to re-run them in this session (confirmed
  Stage 131 verification), matching the same limitation multiple recent
  README stage entries already recorded; the last recorded green run was
  Stage 106 (108 Rust tests, unchanged since). **Precondition for Stage
  134+: re-confirm `cargo test` green in an environment with `cargo`
  available before any new AEAD/KDF stage lands.**
- [x] **No secrets in logs is enforced by absence, and by test guard.**
  Every `test/fedos_core_rust_*.test.ts` guard (Stage 79–106) asserts the
  crate's public surface and internal skeletons carry no secret/message
  field; see §5.
- [x] **No runtime auto-call without an explicit flag holds for every
  boundary shipped through Stage 130.** Every `select*` function in
  `src/runtime/create_runtime.ts` defaults to a `Noop*`/in-memory
  implementation absent an explicit env binding or opt-in flag
  (`ENABLE_MESHKV_ASSET_CACHE`, `PROMOTION_ENDPOINT`+injected `fetch`,
  etc.), and every `src/worker.ts` preview route is gated behind an
  explicit `?xPreview=1` query flag with no default-on path. This is
  re-verified per stage by a dedicated Runtime/Worker source-string guard
  test (see `docs/boundary_phase_index.md` §10–§11) and must continue to
  hold as a non-negotiable gate for every Stage 134+ addition.

---

## 7. Snapshot of current baseline (verified 2026-07-04)

- `npm run typecheck` — GREEN.
- `npm test` — **129 test files, 1923 tests, GREEN.** (Note: the Stage
  119–130 README status line cites "132 files" — this checklist reports
  the count verified directly in this session; the test and assertion
  count, 1923, matches.)
- `cargo check` / `cargo test` — not runnable in this session (`cargo` not
  on `PATH`); no Rust file changed since the last recorded green run
  (Stage 106, 108 Rust tests).
- `git status` — clean other than this docs batch and the pre-existing
  untracked `.claude/` directory.

## 8. Conclusion

- Every `[x]` above is a **precondition satisfied**, not an implementation
  shipped — read `docs/boundary_phase_index.md` for the exact stage that
  shipped it and what it explicitly does not do.
- Every `[ ]` above is a **blocker for Stage 134+** in its domain; several
  repeat across sections because they are the same underlying gap viewed
  from a different angle (e.g. `SecretHandle` real bytes appears in both
  §1 Crypto and §5 Security).
- This checklist does not authorize starting any of the `[ ]` items — it
  only records that they are the named preconditions. Sequencing and order
  are fixed separately in `docs/implementation_phase_roadmap.md`.
