# Secure Runtime Alpha 1261–1320 — Completion Declaration

Production Conversation Crypto Runtime Activation Arc. Same worktree/branch
as Alpha 1111–1260 (`C:\wt\private-direct-messaging`,
`arc/private-conversation-activation-direct-messaging`) — `master` was
unchanged (still `8b65609`), so no additional integration was required.

## 1. Integrations

None needed — no new sibling Arc branch had landed since Alpha 1181–1260's
own commit (`7990ce4`).

## 2. Artifact / build contract (Alpha 1262/1265)

One authoritative layout, matching `npm run build:wasm`'s own existing,
unmodified command exactly:

- Directory: `packages/fedos-core-rust/pkg/`
- Files: `fedos_core_rust.js` (generated glue), `fedos_core_rust_bg.wasm`
  (binary), `.d.ts` declaration files
- Build: `cargo build --target wasm32-unknown-unknown --release` then
  `wasm-bindgen --target web --out-dir packages/fedos-core-rust/pkg ...`

Verified from a clean state in this exact worktree: `cargo test` (native,
531/532 passing — the one failure is a pre-existing, stale dependency-count
guard unrelated to this Arc, confirmed by identical `Cargo.toml` content on
`master`), `npm run build:wasm` (clean, produces the four files above),
`cargo check` (clean). No Rust source was modified; no Cargo dependency was
added, removed, or upgraded.

## 3. Seed lifecycle (Alpha 1266–1270, 1296–1298)

New, additive-only: `src/runtime/master_seed/fedos_sealed_master_seed_envelope_persistence.ts`
(a file-based port for the ALREADY-sealed envelope only — no cryptography,
no passphrase, `writeIfAbsent()` never overwrites, `read()` throws on
structural corruption rather than silently treating it as absent) and
`fedos_passphrase_provider.ts` (a narrow injected boundary — no GUI, no
`process.env` read, `FedosFixedPassphraseProvider`/`UnavailableFedosPassphraseProvider`
are the only two implementations this Arc ships). Verified: correct
passphrase restores; wrong passphrase fails closed (`"seed-restore-failed"`);
a structurally corrupt sealed-seed file fails closed and is never
auto-overwritten; a different seed or a different account index yields a
provably different public identity; the raw seed never crosses into
TypeScript (`FedosWasmMasterSeedAuthority`, unmodified, never exposes one).

## 4. Runtime config wiring (Alpha 1273/1274)

New: `src/conversation/encryption/production/fedos_conversation_production_crypto_authority_factory.ts`
— `assembleFedosConversationProductionCryptoGraph()`, a narrow, async
factory assembling ONE coherent graph (Master Seed Authority, Nostr signing
authority sharing it, real Encryption/Decryption Authorities, real creator
identity, account-index authority, Nostr author-binding authority) entirely
over existing, unmodified classes. `FedosDesktopRuntimeConfig` gained one
new optional field, `conversationProductionCrypto`; `startFedosDesktopRuntime()`
resolves it before Conversation Runtime assembly and, on `"available"`,
supplies its real Authorities in place of the individual
`conversationEncryptionAuthority`/etc. fields — any other outcome falls
back to those fields' own pre-existing defaults unchanged. A new read
accessor, `conversationProductionCryptoCapability()`, surfaces the closed,
non-secret outcome (Alpha 1263's nine-value vocabulary).

**A genuine, load-bearing gap closed during this Arc, discovered by direct
empirical testing, not assumed:** `FedosWasmMasterSeedAuthority`'s own
`#ensureConstructed()` calls `attemptDevOnlyMasterSeedAuthorityConstructCall()`
directly, whose own gate requires `fedos_wasm_loader.ts`'s
`generatedArtifactCheckResult`/`devOnlyGateEvaluation`/`importReadiness`/
`importExecution`/`jsGlueModule`/`wasmInitialization` to already be
populated on the SAME loader instance — which nothing populates
automatically. `attemptDevOnlyRuntimeEncrypt()` (`fedos_runtime_encrypt.ts`,
unmodified) already primes this itself
(`loader.planLoad(); await loader.attemptDevOnlyJsGlueImport(); await loader.attemptDevOnlyWasmInitialization();`)
before its own Rust Boundary reach; `assembleFedosConversationProductionCryptoGraph()`
now performs the IDENTICAL, already-established priming sequence before
constructing the Master Seed Authority — reusing an existing pattern, not
inventing one, and touching no existing file to do it.

## 5. Identity continuity (Alpha 1270–1272)

Verified directly: the same sealed seed + same account index resolves the
identical 64-character hex public identity across independent factory
calls (fresh backend instances, fresh loader, fresh authority object every
time); a different account index against the SAME sealed seed resolves a
provably different identity; the SAME sealed seed with the WRONG passphrase
never resolves at all (fails at restoration). Account index is validated as
a non-negative, `u32`-bounded integer, never inferred from any display
value.

## 6. Real-crypto end-to-end result (Alpha 1279–1288/1305)

`test/secure_runtime_alpha_1261_1320_real_crypto_vertical_slice.test.ts` (6
tests, ALL real — no Fake Authority anywhere in this file) proves, through
the real application path (`createDirectDraft` → invitation → redemption →
`activateDirectConversation` → `sendDirectMessage` → restart →
`readDirectMessage`):

1. Two independently generated/sealed real identities (Alice, Bob) exchange
   one genuinely ChaCha20-Poly1305-AEAD-encrypted message, pairwise-keyed
   via real secp256k1 ECDH; exact plaintext recovered after a full restart
   (fresh backend instances AND a freshly-restored Master Seed Authority
   from the same sealed-seed file).
2. An unrelated third real identity, and the correct sealed-seed file with
   the wrong passphrase, are both denied.
3. A real ciphertext byte flip (decoded from the durable payload log's own
   `bytesBase64` field, flipped, re-encoded) fails closed to `"failed"` —
   never a partial plaintext.
4. Retention denial and (5) revocation denial both hold through the real
   application path.
6. The SAME sealed seed at a DIFFERENT account index yields a different,
   never-admitted identity that is denied.

`test/secure_runtime_alpha_1261_1320_production_gate_semantics.test.ts` (6
tests) additionally proves: omitted config → `"disabled"`, Board/drafts
fully usable; `enabled: true` outside `NODE_ENV=development` →
`"unsupported-runtime"` (the frozen gate, untouched); a structurally
corrupt sealed-seed file → `"seed-restore-failed"`, file left untouched; an
unavailable passphrase provider on first-run → `"seed-unavailable"`, no
prompt loop (there is no prompt — Alpha 1267's own scope limit); `clear()`
denies every subsequent use; `startFedosDesktopRuntime().stop()` clears the
real Master Seed Authority it assembled.

## 7. Production/development gate (Alpha 1264/1289)

**Kept Development-only — Option A from this Arc's own Alpha 1289 menu,
not B.** `fedos_wasm_loader.ts`'s `#evaluateDevOnlyGate()` is untouched: it
already, deliberately, permanently returns `developmentAllowed: false` for
`mode === "Production"` (confirmed by direct source inspection — the
gate's own header states "never Production, never Worker"), with no
config flag, env var, or parameter anywhere that can flip it. This is a
reviewed, intentional security boundary, not an unimplemented feature —
architecture-frozen forbids redesigning it, and this Arc's own Alpha 1289
explicitly permits "keep development-only" as a valid outcome. Real crypto
in this Arc therefore activates ONLY when the caller has explicitly set
`NODE_ENV=development` (confirmed: the Desktop Runtime's own `start:runtime`
script never sets `NODE_ENV` itself — reaching Development mode requires
an explicit, deliberate operator action, never an accident) AND supplied
`conversationProductionCrypto.enabled: true`. Every other combination
denies, coarsely and honestly, through the nine-outcome capability
vocabulary — never a crash, never a silent fallback.

## 8. Subprocess verification (Alpha 1293)

Not run as a real OS subprocess — verified in-process instead, and
documented as such, per Alpha 1293's own explicit escape hatch. This
repository's `start:runtime` CLI entry point accepts no send/read command
of any kind (no GUI, no Worker, per this Arc's own Absolute Prohibitions),
so there is no real subprocess command boundary for this Arc's own new
capability to cross — `startFedosDesktopRuntime()` (exercised directly in
`production_gate_semantics.test.ts`) IS the real production entry point.

## 9. Security boundaries (Alpha 1291/1292/1302)

No raw seed, derived key, or Conversation key is ever returned by anything
this Arc added (`FedosWasmMasterSeedAuthority`, unmodified, is the sole
holder). No passphrase field exists on any Runtime config type — only an
injected `FedosPassphraseProvider` boundary. A repository-wide search of
this Arc's own diff for `nsec`, raw-seed, and hardcoded-passphrase patterns
found none outside test-fixture literals (`"alice-passphrase"` etc., the
same established convention every other passphrase-adjacent test in this
repository already uses). Filesystem honesty: sealed-seed confidentiality
depends on OS file permissions and the passphrase itself; Conversation
IDs, Membership graph shape, Envelope count, payload sizes, timestamps, and
filesystem paths all remain observable metadata — no operator-unlinkability
or secure-physical-deletion claim is made anywhere in this Arc, matching
every prior Arc's own identical disclosure.

## 10. Ripple

New, additive only: `src/runtime/master_seed/fedos_sealed_master_seed_envelope_persistence.ts`,
`fedos_passphrase_provider.ts`, `src/conversation/encryption/production/`
(2 files), 2 new test files. Extended (narrow, additive-only fields/methods,
no existing field renamed or removed): `fedos_desktop_runtime_config.ts`
(+1 optional field), `fedos_desktop_runtime.ts` (+1 read accessor, +the
production-crypto-graph resolution/clear wiring). Mechanical, expected
ripple (Alpha 1304): `secure_runtime_alpha_606_runtime_assembly.test.ts`
and `secure_runtime_alpha_758_local_runtime_ownership.test.ts` — both
assert the EXACT closed set of keys `FedosRunningDesktopRuntime` exposes;
both updated to include the one new, genuinely additive, non-secret
accessor.

## 11. Tests / typecheck / cargo / WASM

`npm run typecheck`: clean (the same one pre-existing, unrelated failure
documented in every prior Arc's own declaration). `cargo check` /
`cargo test`: clean / 531-532 passing (one pre-existing, unrelated, stale
dependency-count guard). `npm run build:wasm`: clean, reproducible.
Targeted Alpha 1261–1320 suite: 12/12 passing (verified WITH the artifact
built and `NODE_ENV=development`). Full `npm test`, precisely diffed by
exact failing file name against the Alpha 1181–1260 baseline: exactly two
genuine, expected ripple fixes applied (§10); the only OTHER delta is this
Arc's own two new test files themselves reporting closed, honest denial
outcomes (never a crash) when run WITHOUT a freshly built WASM artifact —
exactly the same pre-existing behavior every other real-WASM-dependent
test in this repository already has on a stock checkout, since
`packages/fedos-core-rust/pkg/` is gitignored and never committed (§13).
Zero other regressions.

## 12. Dependency status

`package.json`/`Cargo.toml` byte-for-byte unchanged (confirmed via `git
status` — neither file appears in the diff). No new npm or Cargo
dependency; `wasm-bindgen`/`cargo` were already-present, already-adopted
build tooling, merely invoked, not added.

## 13. p2p / artifact cleanup

`p2p/` never referenced. `packages/fedos-core-rust/pkg/`,
`packages/fedos-core-rust/target/`, and `Cargo.lock` were built for
verification and then removed before this commit, matching this
repository's own established policy (gitignored, never committed, always
regenerated locally via `npm run build:wasm`) — **anyone building on this
commit must run `npm run build:wasm` themselves before this Arc's own two
new real-crypto test files (or any real Development-mode crypto path) will
report `"available"` instead of `"artifact-missing"`.** This is stated
plainly per Alpha 1306, not left implicit.

## 14. Production Readiness Statement (Alpha 1306)

- Real crypto works in Development mode: **yes**, proven end to end by
  this Arc's own tests, with the artifact built.
- Real crypto works in a packaged Local Runtime: **yes, identically** —
  `startFedosDesktopRuntime()` is the real production entry point this
  Arc wires `conversationProductionCrypto` through; nothing about
  packaging changes the gate.
- Real crypto works in Production mode (`NODE_ENV=production`): **no,
  deliberately** — the frozen, reviewed "never Production" gate is
  unmodified by this Arc (§7).
- The generated artifact must be manually built: **yes** — `pkg/` is
  gitignored; `npm run build:wasm` is required before every real-crypto
  verification, exactly as it was before this Arc.
- Passphrase interaction remains injected: **yes** — no GUI, no CLI
  plaintext argument, no prompt of any kind exists anywhere in this Arc.
- GUI remains absent: **yes** — untouched, unreferenced.

## 15. Next Arc recommendation

Given production activation (`NODE_ENV=production`) remains, by deliberate
design, out of reach (§7/§14) — the honest, task-menu-consistent
recommendation is **Conversation Crypto Packaging and Runtime Artifact
Arc**: the real, explicitly-reviewed decision of whether/how to extend the
frozen "never Production" gate (or ship a packaged Local Runtime that
always runs under an equivalent-to-Development classification) belongs to
that dedicated, separate Arc — this Arc deliberately does not make that
call itself, per architecture-frozen's own "do not redesign an accepted
security boundary" rule.
