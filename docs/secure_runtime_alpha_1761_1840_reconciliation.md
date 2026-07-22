# Secure Runtime Alpha 1761–1840 — Mid-Arc Reconciliation Report
## NIP-17 Rumor Seal Gift Wrap Standard Delivery Arc

Written mid-session, before continuing implementation, per an explicit
request to reconcile exact state against the original phase list before
touching more production code. This is NOT the completion declaration —
see `docs/secure_runtime_alpha_1761_1840_completion_declaration.md`
(written last, after all remaining work in this session) for the final,
authoritative account.

## 1. Completed phases (vs. the original Alpha 1761–1840 phase list)

- **Phase A (Alpha 1761–1763, Integrated Reality Report)** — the
  RESEARCH is done (verified every claim in the task brief directly:
  read `docs/secure_runtime_alpha_1611_1690_completion_declaration.md`,
  `fedos_private_wire_adapter.ts`, `fedos_private_wire_route.ts`,
  `fedos_nostr_nip17_v1_wire_adapter.ts` (the stub), the full
  `docs/normative/nostr-protocol-nips/{17,59}.md` text, and the Rust
  crypto module inventory in `packages/fedos-core-rust/src/crypto/`).
  The WRITE-UP as its own dedicated doc file is **not yet done** — this
  reconciliation report and the completion declaration absorb that
  content instead of a separate Alpha 1761/1762/1763 doc triad, per this
  session's own time constraints. Key finding beyond the task brief's
  own assumption: `packages/fedos-core-rust/src/crypto/nip44_public_api.rs`
  is a pure LABEL-ONLY skeleton (zero `pub` items reachable outside the
  crate) — there was no existing "narrow additive export" to extend;
  Phase B below built the real bridge from nothing.
- **Phase B (Alpha 1764–1768, narrow Rust/WASM NIP-44 wire export)** —
  **COMPLETE AND VERIFIED.** New `pub(crate)` functions
  `master_root::encrypt_nip44_wire_from_master_seed_internal`/
  `decrypt_nip44_wire_from_master_seed_internal` (packages/fedos-core-rust/src/lib.rs)
  reuse the EXISTING, unmodified, official-vector-verified
  `crypto::nip44_wire_encrypt`/`crypto::nip44_wire_decrypt`/
  `crypto::conversation_key` pipeline — genuine NIP-44 v2 wire strings,
  never this crate's own generic Envelope AEAD. New WASM-facing methods
  `FedosMasterSeedAuthority::encrypt_nip44_wire`/`decrypt_nip44_wire`
  (`#[wasm_bindgen]`). Verified: `cargo check` clean; `cargo test` 547
  passed / 1 pre-existing unrelated failure (the documented
  `secp256k1_dependency_guard` 10-vs-11 count, unrelated — see §"Rust
  bridge status" below); `npm run build:wasm` succeeds, confirmed via
  direct inspection of the generated `.d.ts` that both methods are
  exported with the correct signature; TypeScript-side loader boundary
  (`fedos_wasm_loader.ts`) and `FedosWasmMasterSeedAuthority`/
  `FedosMasterSeedAuthority` (both in `src/runtime/master_seed/`) wired
  and `tsc --noEmit` clean.
- **Phase E (Alpha 1777–1780, ephemeral Gift-Wrap signing authority)** —
  **COMPLETE AND VERIFIED.** New `pub(crate)`
  `master_root::sign_nostr_event_with_fresh_ephemeral_key_internal` (a
  fresh CSPRNG key per call, used once, cleared) plus its WASM export
  `sign_nostr_event_with_fresh_ephemeral_key`. Retry-strategy decision
  (Alpha 1780): Option C ("reuse an ephemeral private key") is
  STRUCTURALLY unreachable — the TypeScript-side authority
  (`fedos_wasm_ephemeral_gift_wrap_signing_authority.ts`) never holds a
  key-shaped value between calls. Option A (persist the signed bytes) or
  Option B (regenerate on retry) are both available to a caller; this
  Arc does not itself pick one at the Transport/Outbox level since that
  wiring is still pending (§ Phase G/Outbox below).
- **Phase F (Alpha 1781–1787, Gift Wrap construction/unwrap)** —
  **COMPLETE AND VERIFIED at the Rust+TypeScript-module level.**
  Superseding the plain ephemeral-signing primitive above for the Gift
  Wrap specifically: NIP-59's own Gift Wrap encrypts via ECDH between
  the ephemeral secret and the recipient's public key, which
  `encrypt_nip44_wire_from_master_seed_internal` cannot express (that
  bridge only derives keys from Master-Seed accounts). New ATOMIC Rust
  function `master_root::build_and_sign_nip17_gift_wrap_internal` (+
  WASM export `build_and_sign_nip17_gift_wrap`) draws the ephemeral key,
  ECDHs it, NIP-44-encrypts, and signs — all in one call, so the
  ephemeral secret never crosses the WASM boundary. Verified with real
  Rust tests: round-trip (build then decrypt via the EXISTING
  `decrypt_nip44_wire_from_master_seed_internal` bridge — decryption is
  symmetric and needs no new Rust function), independent-key-per-call,
  malformed-recipient rejection, wrong-recipient decrypt failure. `cargo
  test`: 547 passed / 1 pre-existing failure (same one). TypeScript
  modules `fedos_nip17_rumor.ts` (Rumor model/builder/validator, kind:14
  only per Alpha 1763's smallest-scope decision), `fedos_nip59_seal.ts`
  (Seal build via the REAL sender signing authority + real NIP-44 wire
  bridge; open/validate, enforcing NIP-17's own pubkey-impersonation
  guard), `fedos_nip59_gift_wrap.ts` (compose Rumor->Seal->Gift-Wrap;
  unwrap Gift-Wrap->Seal->Rumor) are written and `tsc --noEmit` clean.
  **Not yet unit-tested at the TypeScript/vitest level** — no dedicated
  test file exists yet exercising these three modules directly (only
  Rust-level tests cover the underlying crypto correctness so far).
- **Phase D (Alpha 1774, signing authority extension)** — **COMPLETE.**
  `src/nostr/sign/fedos_nostr_signing_authority.ts`'s closed kind
  allowlist additively extended with `FEDOS_NIP59_SEAL_KIND = 13` (Seal
  must be signed by the real account; Gift Wrap never touches this
  authority at all). Verified via `tsc --noEmit`.
- **Phase G (Alpha 1788–1795, adapter wiring)** — **IN PROGRESS, NOT
  COMPLETE.**
  - `fedos_private_wire_adapter.ts` (the frozen interface) — additively
    widened: `build()`/`parse()` are now `async` (documented as a
    reviewed-defect-driven signature change, not a redesign — see that
    file's own new header text for the full justification: a
    synchronous method cannot express NIP-17's genuinely async
    multi-step WASM pipeline, and per the Alpha 1616 header this
    interface has NO existing synchronous caller anywhere in the
    repository to break). New additive outcome variants
    `"built-signed"`/`"parsed-rumor"` (NIP-17's two-signer split cannot
    be expressed as a single `FedosNostrUnsignedEventRequest`; a
    decrypted Rumor is not an opaque ciphertext blob). New optional
    `FedosPrivateWireBuildInput.plaintext` field (the standard route
    cannot be built from `ciphertext` — this crate's own generic
    Envelope AEAD ciphertext is explicitly prohibited from being reused
    as NIP-44 wire ciphertext). Verified via `tsc --noEmit`.
  - `fedos_private_v1_wire_adapter.ts` — updated to `async build()`/
    `async parse()`, bodies byte-for-byte unchanged (trivial Promise
    wrap, zero behavior change). Verified via `tsc --noEmit`.
  - `NostrNip17V1WireAdapter`
    (`fedos_nostr_nip17_v1_wire_adapter.ts`) — **THE REAL
    IMPLEMENTATION WAS WRITTEN IN THIS SESSION BUT THE FILE WRITE DID
    NOT PERSIST** (a tool-level write failure; confirmed via `git
    status --short` — the file is byte-identical to the original stub,
    not even listed as modified). **This is the immediate next step**:
    re-apply the real implementation (isAvailable()->true, real build()
    via `buildFedosNip17GiftWrap`, real parse() via
    `openFedosNip17GiftWrap`), matching the widened interface.
  - `test/secure_runtime_alpha_1611_1690_wire_adapter_and_route.test.ts`
    — **NOT YET UPDATED.** Currently calls `adapter.build()`/
    `adapter.parse()` synchronously (no `await`) and asserts the OLD
    stub behavior (`isAvailable() === false` for the standard route,
    `resolveFedosPrivateWireRoute("nostr-nip17-v1", ...)` resolving to
    `"unsupported"`). Both assumptions are now FALSE once the real
    adapter lands — this file needs mechanical `await` fixes plus
    updated expectations (expected, anticipated ripple, exactly the
    "four existing tests updated to match" precedent the prior Arc's
    own completion declaration already established).
  - `FedosPrivateTransport`'s constructor — **NOT YET TOUCHED.** No
    injected-adapter parameter exists yet. This is real, deliberately
    deferred work — see §6.

## 2. Remaining phases (not started)

- Phase G's own `FedosPrivateTransport` constructor injection (narrow,
  additive — accept an optional adapter, do not yet rewire internal
  dispatch, per this report's own §6 architecture note).
- Phase H (Alpha 1796–1802, inbound integration: subscription
  kind-filtering, bounded account resolution, native dedup, Rumor ->
  local Conversation resolution, unknown-sender handling).
- Phase I (Alpha 1803–1808, real vertical verification: Direct
  round-trip across independent identities with real crypto — the
  acceptance bar; Group; tamper/replay matrices; public isolation
  guard).
- Phase J (Alpha 1809–1839, compatibility notes, honest metadata/
  forward-secrecy claims, hostile-Relay matrix, structural guards,
  O(N) cost note, docs closure) and Alpha 1840 (completion declaration).

## 3. Modified files (matches `git status --short` in this worktree)

```
 M packages/fedos-core-rust/src/lib.rs
 M src/conversation/transport/fedos_private_v1_wire_adapter.ts
 M src/conversation/transport/fedos_private_wire_adapter.ts
 M src/nostr/sign/fedos_nostr_signing_authority.ts
 M src/runtime/fedos_wasm_loader.ts
 M src/runtime/master_seed/fedos_master_seed_authority.ts
 M src/runtime/master_seed/fedos_wasm_master_seed_authority.ts
 M test/secure_runtime_alpha_1561_1580_archive_encrypted_export_import.test.ts
 M test/secure_runtime_alpha_438_typescript_authority_boundary.test.ts
 M test/secure_runtime_alpha_445_typescript_nostr_signing_authority_adapter.test.ts
 M test/secure_runtime_alpha_684_signing_public_identity.test.ts
 M test/secure_runtime_alpha_861_872_encryption_authority.test.ts
 M test/secure_runtime_alpha_862_873_decryption_authority.test.ts
 M test/secure_runtime_alpha_869_resolve_conversation_key_wiring.test.ts
?? src/conversation/delivery/nostr/nip17/fedos_nip17_rumor.ts
?? src/conversation/delivery/nostr/nip17/fedos_nip59_gift_wrap.ts
?? src/conversation/delivery/nostr/nip17/fedos_nip59_seal.ts
?? src/conversation/delivery/nostr/nip17/fedos_wasm_ephemeral_gift_wrap_signing_authority.ts
```

The seven `test/secure_runtime_alpha_{1561_1580,438,445,684,861_872,862_873,869}*.test.ts`
changes are ALL the same mechanical shape: adding
`encryptNip44Wire`/`decryptNip44Wire` (or the loader-boundary
`attemptDevOnlyEncryptNip44WireCall`/`attemptDevOnlyDecryptNip44WireCall`)
stub methods to an existing hand-written mock object, required because
those two methods were added to the `FedosMasterSeedAuthority`/
`FedosMasterSeedWasmLoaderBoundary` interfaces. No test's own scenario
or intent was changed.

## 4. Untouched files (confirmed by absence from `git status`)

`src/conversation/delivery/nostr/nip17/fedos_nostr_nip17_v1_wire_adapter.ts`
(the write attempt did not persist — see §1),
`test/secure_runtime_alpha_1611_1690_wire_adapter_and_route.test.ts`,
`src/conversation/transport/fedos_private_transport.ts`, every Group/
Membership/Direct-conversation-domain file, `p2p/`, `.tmp_gen/`,
`package.json`/`package-lock.json`/`Cargo.toml` (confirmed byte-unchanged
by their own absence from `git status`).

## 5. Rust bridge status

**Complete, tested, passing.** `cargo test --manifest-path
packages/fedos-core-rust/Cargo.toml`: 547 passed / 1 failed. The one
failure is `crypto::secp256k1_dependency_guard::cargo_toml_has_exactly_ten_production_dependencies_after_k256_adoption`
(expects 10 production dependencies, counts 11) — confirmed pre-existing
and unrelated: `Cargo.toml` has zero diff from this Arc (`git status
--short` shows no change to it), and this is the SAME failure the prior
Arc's own completion declaration already documented at the identical
count. `cargo check` is clean. 14 new tests added this session, all
passing: 2 NIP-44-wire-bridge round-trip/tamper/wrong-account/wrong-recipient/no-seed
tests (`master_root::tests`) + 2 mirrored tests at the
`FedosMasterSeedAuthority` WASM-facing level
(`master_seed_authority_tests`) + 2 ephemeral-signing tests + 4
Gift-Wrap-construction tests (round-trip/independent-key/malformed-recipient/wrong-recipient),
matching the 10 (Phase B) + 2 (Phase E) + 4 (Phase F) = wait, exact
count reconciled directly against the last `cargo test` run: 547 total
vs. the documented 531 pre-Arc baseline = **16 new passing tests**, 0
new failures, 0 regressions.

## 6. WASM bridge status

**Complete and verified through an ACTUAL wasm32/wasm-bindgen build**,
not merely native Rust. `npm run build:wasm` (`cargo build --target
wasm32-unknown-unknown --release && wasm-bindgen --target web`) was run
successfully multiple times in this exact worktree session, most
recently after the Gift-Wrap function was added. Direct inspection of
the generated `packages/fedos-core-rust/pkg/fedos_core_rust.d.ts`
confirms all three new exports are present with the correct TypeScript
signature:
```
encrypt_nip44_wire(account_index, counterparty_public_key_hex, plaintext: Uint8Array): string | undefined
decrypt_nip44_wire(account_index, counterparty_public_key_hex, payload): Uint8Array | undefined
sign_nostr_event_with_fresh_ephemeral_key(created_at, kind, tags, content): string | undefined
build_and_sign_nip17_gift_wrap(recipient_public_key_hex, created_at, kind, content_plaintext): string | undefined
```
The `packages/fedos-core-rust/pkg/` build artifact itself is NOT checked
in (gitignored, generated on demand by `npm run build:wasm`, exactly as
before this Arc) — it will need to be regenerated again for the final
verification pass and for the real vertical test to run against real
WASM (this file will confirm that re-run in its own final section).
TypeScript-side: `fedos_wasm_loader.ts` gained matching
`attemptDevOnlyEncryptNip44WireCall`/`attemptDevOnlyDecryptNip44WireCall`/
`attemptDevOnlySignWithFreshEphemeralKeyCall`/`attemptDevOnlyBuildAndSignGiftWrapCall`
methods (mirroring every existing gating discipline in that file
exactly — the same six-condition check, the same `typeof x ===
"function"` runtime probe, the same fail-closed reason vocabulary).
`fedos_master_seed_authority.ts` (interface) and
`fedos_wasm_master_seed_authority.ts` (implementation) gained matching
`encryptNip44Wire`/`decryptNip44Wire` methods. All `tsc --noEmit` clean
as of the last run in this session (only the pre-existing, cross-Arc
`test/secure_runtime_alpha_477_scheduler_lifecycle_model.test.ts`
failure, plus the two known-stale files named in §1, remained).

## 7. Rumor status (`fedos_nip17_rumor.ts`)

Written: `FEDOS_NIP17_CHAT_MESSAGE_KIND = 14` (kind:15 File Message
explicitly out of scope, a distinct kind with its own additional
required tags this codebase has no feature to attach to yet),
`buildFedosNip17ChatMessageRumor`/`isWellFormedFedosNip17Rumor`/
`serializeFedosNip17RumorForEncryption`/`parseFedosNip17RumorFromPlaintext`.
Honest, documented simplification: the Rumor's own `id` field is the
caller's own already-unique local envelope identifier, NOT NIP-01's true
canonical `sha256` hash (computing that would require a new
`nostr_identifier_encoding::FedosNostrPublicKeyHex`-from-arbitrary-hex-string
constructor that does not exist yet in the Rust crate — a narrow,
low-risk, well-scoped follow-up, not attempted this session since no
verification step in this Arc's own scope depends on it: the Rumor is
unsigned and therefore unauthenticatable regardless, per NIP-59's own
text). `tsc --noEmit` clean. **No dedicated vitest file yet** — real
Rust-level correctness is proven for the underlying crypto; this
module's own pure validation/construction logic has not yet been
exercised by a standalone test file (only indirectly, through whichever
higher-level test eventually calls into it).

## 8. Seal status (`fedos_nip59_seal.ts`)

Written: `buildFedosNip59Seal` (Rumor -> NIP-44 encrypt via the real
NIP-44 wire bridge -> sign via the REAL sender
`FedosNostrSigningAuthority`, kind 13, empty tags per NIP-59 §2) and
`openFedosNip59Seal` (structural validation, kind-13/empty-tags check,
NIP-44 decrypt via the local account's own conversation key with the
Seal's own `pubkey`, inner-Rumor validation, and NIP-17's own
pubkey-impersonation guard: `rumor.pubkey === seal.pubkey`). `tsc
--noEmit` clean. **No dedicated vitest file yet**, same caveat as §7.

## 9. Gift Wrap status (`fedos_nip59_gift_wrap.ts`, `fedos_wasm_ephemeral_gift_wrap_signing_authority.ts`)

Written and Rust-level-verified (§6 above covers the WASM/Rust half
directly). `fedos_wasm_ephemeral_gift_wrap_signing_authority.ts` wraps
`build_and_sign_nip17_gift_wrap` — `FEDOS_GIFT_WRAP_KIND = 1059`/
`FEDOS_EPHEMERAL_GIFT_WRAP_KIND = 21059` only, structurally cannot
retain or expose the ephemeral key (Alpha 1779's own single-use
lifecycle, enforced by never holding key-shaped state between calls).
`fedos_nip59_gift_wrap.ts`'s `buildFedosNip17GiftWrap` composes
Seal-then-wrap; `openFedosNip17GiftWrap` composes
unwrap-then-open-Seal, reusing the EXISTING
`decryptNip44Wire`/`FedosMasterSeedAuthority` bridge for the outer
decrypt (decryption is symmetric — no new Rust function was needed for
this direction, only for the encrypt-and-sign direction, per §"Rust
bridge status" reasoning already recorded in this Arc's own source
comments). `tsc --noEmit` clean. **No dedicated vitest file yet** at the
TypeScript module level (only the Rust-level round-trip/tamper/
wrong-recipient tests in `packages/fedos-core-rust/src/lib.rs` exercise
this pipeline's real cryptographic correctness so far).

## 10. Runtime integration status

- `NostrNip17V1WireAdapter`'s stub has **NOT yet been replaced** on
  disk (the write did not persist — see §1). It is the very next
  action this session takes.
- `FedosPrivateTransport` has **NOT been wired** to dispatch through any
  injected adapter yet — its constructor, internal
  `FedosConversationTransportSignedEventSource`, and Publisher dispatch
  are all byte-for-byte unchanged from before this Arc. A genuine,
  reviewed architectural finding from this session's own investigation
  of `fedos_private_transport.ts`/`fedos_conversation_transport_signed_event_source.ts`:
  the Transport's own existing outbound path resolves plaintext-free
  ciphertext (already encrypted via this crate's generic Envelope AEAD,
  via `FedosConversationMessageEnvelope`/`FedosConversationPayloadStorage`,
  which explicitly and by design never carry plaintext) BEFORE any Wire
  Adapter is reached — but the standard NIP-17 route structurally
  REQUIRES the original plaintext (to build a Rumor and NIP-44-encrypt
  it fresh; this crate's own generic Envelope AEAD ciphertext is an
  absolutely prohibited substitute). Full rewiring of
  `FedosPrivateTransport`'s own internal dispatch to source plaintext at
  the right seam is real, non-trivial surgery this session's own time
  budget will likely only partially complete — see the completion
  declaration for the final, honest scope line drawn here. The interface
  widening (`FedosPrivateWireBuildInput.plaintext`, optional) already
  done this session is the PREREQUISITE for that wiring, not the wiring
  itself.

## 11. Remaining verification

- `npm run typecheck` — needs a fresh run after `NostrNip17V1WireAdapter`
  is actually rewritten and
  `test/secure_runtime_alpha_1611_1690_wire_adapter_and_route.test.ts`
  is fixed. Last observed state (before this reconciliation pause): clean
  except those two files plus the one pre-existing unrelated failure.
- Targeted NIP-17/wire-adapter tests — **do not yet exist** at the
  TypeScript level for Rumor/Seal/Gift-Wrap/Adapter directly; only the 7
  mechanically-updated mock-shape test files (§3) and the Rust-level
  tests (§5/§9) currently exercise any of this session's own new code
  paths. Writing these is remaining work.
- Full `npm test` — **not run once in this session yet** as an updated
  baseline; only individual affected files were run
  (`secure_runtime_alpha_{438,445,684,861_872,862_873,869,1561_1580}*.test.ts`,
  all passing, 59/59). A fresh full-suite baseline run in THIS worktree,
  both before finishing remaining changes (to distinguish pre-existing
  noise) and after, is remaining work — per the prior Arc's own
  documented ~196-failing-file CRLF/autocrlf artifact baseline in a
  fresh worktree checkout, expected to reproduce here too and not be
  treated as a regression.
- `cargo test` — up to date as of §5 (547/548, one pre-existing
  failure); no Rust source has changed since that run.
- `wasm32`/`wasm-bindgen` build — up to date as of §6; will be re-run
  once more after `NostrNip17V1WireAdapter` is finalized, since a real
  vertical TypeScript-level test needs the artifact regenerated and
  fresh in this same session.

## 12. Immediate next steps (in order)

1. Re-apply `NostrNip17V1WireAdapter`'s real implementation (the write
   that did not persist).
2. Fix `test/secure_runtime_alpha_1611_1690_wire_adapter_and_route.test.ts`
   (add `await`, update the now-false stub-behavior assertions).
3. Write dedicated Rumor/Seal/Gift-Wrap/Adapter unit tests.
4. `FedosPrivateTransport` narrow constructor injection (accept an
   optional adapter; document honestly how much internal dispatch
   rewiring is/isn't included).
5. Real vertical Direct round-trip test (two independent identities,
   real WASM crypto, real adapter `build()`/`parse()`) — the acceptance
   bar.
6. Decide and document Group's fate (attempt pairwise fanout, or
   honestly defer).
7. Fresh full `npm test` baseline + targeted re-runs + `cargo test` +
   `wasm32` build, one more time, immediately before the commit.
8. Phase J docs + completion declaration.
9. One commit.
