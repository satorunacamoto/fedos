# Secure Runtime Alpha 6281–6360 — Execution Specification

**FedOS Secure Memory Secret Buffer and Zeroization Foundation Arc**

See the reconciliation report for the full inventory and rationale behind
this Arc's scope. This document records what was actually built, phase by
phase.

## Phase B — dependency decision

No new `Cargo.toml` dependency. `zeroize 1.9.0`/`secrecy 0.10.3` are already
direct production dependencies (Stage 78), already consumed by the real
`secret_handle` module this Arc extends. See the reconciliation report §6
for the pre-existing (not caused by this Arc) 10-vs-11 dependency-count
guard discrepancy.

## Phase C — Secret Buffer

Not rebuilt. `SecretHandle` (`packages/fedos-core-rust/src/lib.rs`, `mod
secret_handle`) already satisfies this phase's requirements — see the
reconciliation report §3. This Arc extends its classification vocabulary
(two new `SecretHandleKind` variants, Phase D) and adds one new narrow
internal accessor (`expose_bytes_for_internal_nip44_message_key`), matching
the existing "one accessor per consumer" convention exactly.

## Phase D — Secret classification

`SecretHandleKind` (pre-existing, `pub(crate)`) already is this codebase's
closed classification vocabulary. Two new variants added, both
algorithm-agnostic by name (matching `AeadKeyMaterial`'s own "name the
role, not the cipher" convention — see the reconciliation report and the
structural guard test's own item 17 for why "chacha" never appears inside
`mod secret_handle` itself):

- `Nip44StreamKeyMaterial` — the first 32-byte segment of NIP-44's own
  per-message three-way key-schedule expansion (`crypto::nip44_message_keys`
  names the exact byte offsets and algorithm; this label deliberately does
  not).
- `Nip44HmacKeyMaterial` — the third, final 32-byte segment of the same
  expansion.

Unknown classification still fails closed everywhere it already did — this
Arc adds no new fallback/wildcard match arm anywhere `SecretHandleKind` is
matched.

## Phase E — Opaque Handle Store

New: `mod secret_handle_store` (`lib.rs`, inline, beside `secret_handle`).
`SecretHandleStore` — a bounded (`DEFAULT_CAPACITY = 64`), generation-safe,
opaque-`SecretHandleId`-addressed registry wrapping `SecretHandle` values.

| Requirement | How satisfied |
|---|---|
| Handle kind binding | `use_handle()`'s own `expected_kind` parameter, checked against `handle.kind()` |
| Secret classification binding | Same — `SecretHandleKind` is the classification |
| Creation | `insert()` — moves a `SecretHandle` in, returns an opaque `SecretHandleId` |
| Scoped use | `use_handle<R>(id, expected_kind, FnOnce(&SecretHandle) -> R)` — the ONLY read path |
| Consume/destroy | `destroy()` — zeroizes via `SecretHandle::clear()`, frees the slot |
| Use-after-destroy denial | `SecretHandleStoreDenial::Unknown` |
| Wrong-kind denial | `SecretHandleStoreDenial::WrongKind` |
| Stale-generation denial | `SecretHandleStoreDenial::StaleGeneration` |
| Double-destroy idempotent/closed | `SecretHandleStoreDestroyOutcome::{Destroyed, AlreadyDestroyed}` — never panics |
| Bounded live handle count | `capacity()`/`live_count()`; `insert()` returns `CapacityExceeded` at the bound |
| Cleanup at shutdown | `clear_all()`; `Drop` calls it as a backstop |
| No iterator returning secret content | No `iter()`/`handles()`/`Iterator` impl exists — verified by structural guard |
| Safe count/status diagnostics only | `live_count()`/`capacity()` — `usize`, never secret-shaped |

No raw buffer access is ever exposed to TypeScript — the Store itself has
zero `#[wasm_bindgen]` surface (verified by structural guard item 10).

## Phase F — capability-limited operations

Not extended this Arc. The Store is a pure Rust `pub(crate)` primitive with
no WASM operations of its own today — see the completion declaration for
why this is an honest, deliberate scope boundary rather than an oversight.
A `#[cfg(test)]`-only internal inspection capability already exists
implicitly (every Store test calls `use_handle`/`live_count` directly,
`#[cfg(test)]`-gated by the crate's own build configuration) — no separate
test-only hook was needed beyond the Store's own already-narrow public API.

## Phase G — passphrase lifetime audit

Audited, not changed. `FedosMasterSeedAuthority::seal(&self, passphrase:
&[u8])`/`restore_sealed(&mut self, envelope_json: &str, passphrase: &[u8])`
(`lib.rs`) already take bytes, not `String`, over the WASM boundary.
`generate()` already zeroizes its own local CSPRNG-drawn copy immediately
after wrapping it in a handle. Confirmed by the existing, unchanged,
already-passing test suite (`master_seed_authority_tests`):
`restore_sealed_with_the_wrong_passphrase_fails_closed_and_leaves_authority_empty`
proves the wrong-passphrase path fails closed without leaving the authority
half-available. This Arc's own real vertical slice
(`secret_handle_store_vertical_slice_tests::real_master_seed_generate_seal_restore_round_trip_is_unaffected_by_this_arc`)
re-confirms the SAME facts end to end, including a real wrong-passphrase
restore attempt.

**Honest limitation restated**: this Arc's own scope is Rust-only. The
renderer/preload/IPC layer that hands a passphrase INTO Rust is outside
this Arc — a JavaScript string holding a passphrase before it reaches this
boundary may already have immutable copies the V8/JS engine controls, which
no Rust-side code can retroactively zero. This Arc does not claim
otherwise.

## Phase H — initial migration targets

**Migrated**: NIP-44 per-message key material.
`crypto::nip44_message_keys::Nip44MessageKeyDecision` gained a `handle:
Option<SecretHandle>` field, mutually exclusive with its pre-existing
`bytes: Option<Vec<u8>>` field:

- `ChachaKey`/`HmacKey` (both genuinely confidential, both exactly 32
  bytes) — now `handle`-backed, `bytes` always `None`.
- `ChachaNonce` (12 bytes, transmitted on NIP-44's own wire payload, not
  confidential — ChaCha20's security depends on nonce uniqueness, never
  nonce secrecy) — deliberately stays `bytes`-backed, unchanged.

Both live consumers (`crypto::nip44_wire_encrypt`/`crypto::nip44_wire_decrypt`)
were updated: a new narrow `extract_handle_bytes()` helper (mirroring the
pre-existing `extract_fixed_bytes()`) pulls the two secret values out via
one new `SecretHandle` accessor
(`expose_bytes_for_internal_nip44_message_key`), and both functions now
explicitly `.zeroize()` their own local `[u8; 32]` copies once the one-shot
stream-cipher/HMAC call that needed them completes. The decrypt path was
additionally reordered so `chacha_key` is not even read out of its handle
until HMAC verification has already succeeded (narrowing its live window
to exactly the one operation that needs it, and ensuring the
authenticate-then-decrypt ordering this module's own header already
required stays intact).

**Proof, per this Arc's own "for each migrated target" requirement**:

- Fewer raw copies: `chacha_key`/`hmac_key` no longer exist as
  never-zeroized heap `Vec<u8>` values inside `Nip44MessageKeyDecision`.
- No API regression: all 163 pre-existing NIP-44 tests pass unchanged,
  including every RFC/NIP-44 reference vector case
  (`nip44_message_key_vectors`, `nip44_stream_cipher_vectors`,
  `nip44_wire_encrypt_vectors`, `nip44_wire_decrypt_vectors`,
  `nip44_wire_decrypt_invalid_vectors`) — byte-exact against the reference
  fixtures, proving the migration changed ownership, not output.
- Zeroize/drop behavior: local copies explicitly zeroized after use; the
  handles themselves inherit `SecretHandle`'s own proven zeroize-on-clear/
  drop behavior.
- WASM result unchanged: `random_bytes_32`/`FedosMasterSeedAuthority`/
  `FedosDirectRatchetSession`'s own exported surface is byte-identical (no
  `#[wasm_bindgen]` item touched); a real `wasm32-unknown-unknown` release
  build was produced and its generated `.d.ts`/`.js` glue contains zero
  reference to any new type this Arc adds.
- No secret returned to TS: unchanged — NIP-44 key material was never
  WASM-exported before this Arc and still is not.

**Explicitly NOT migrated** (see the reconciliation report §5 for why each
was found already-compliant or genuinely out of scope):

- Master Seed / Identity / Application / Protocol Root hierarchy —
  already `SecretHandle`-backed.
- Direct Ratchet root/chain/ephemeral-private/message keys — already
  `SecretHandle`-backed; no gap found.
- Nostr signing keys (`FedosNostrSecretKeyHandle`) — already
  `SecretHandle`-backed.

## Phase I — zeroization evidence

- Compile-time non-Clone assertion: `SecretHandle`'s own established
  proof (`secrecy::SecretBox<S>` requires `S: CloneableSecret`, never
  implemented) extends unchanged to every new `SecretHandleKind` variant,
  since kind is a label, not a separate type.
- Drop/Zeroize behavior: proven at the `secret_handle` layer already
  (`real_byte_zeroize_is_called_on_explicit_clear`/`..._on_drop_without_explicit_clear`,
  unchanged, still passing); this Arc's own `SecretHandleStore` tests prove
  the STORE's own contract (`destroy` really frees the slot, a later
  `use_handle` by the same id is denied) without re-deriving the
  byte-level zeroize proof a layer below already owns — see the
  reconciliation report §7 on "each layer proves its own contract."
- Error-path cleanup: NIP-44 wire encrypt now zeroizes `chacha_key` on the
  `hmac_key`-extraction-failure early-return path too (not just the
  success path) — see `nip44_wire_encrypt.rs`'s own updated function body.
- Panic/unwind cleanup: unchanged — `SecretHandle`'s own `Drop` remains
  the backstop; this Arc's `SecretHandleStore::drop()` extends the SAME
  backstop one layer out (calls `clear_all()`, which calls `destroy()` on
  every live slot, which calls the inner `SecretHandle::clear()`).
- Handle destruction: `SecretHandleStore::destroy()`, proven idempotent
  and denial-correct by 9 dedicated tests.
- Process-lifecycle cleanup: `clear_all()` / `Drop`, proven by
  `destroy_all_handles_on_shutdown` (vertical slice) and
  `clear_all_destroys_every_live_handle_and_is_a_safe_no_op_when_already_empty`.
- Source structural guards: this Arc's own 20-test TypeScript guard suite
  (`test/secure_runtime_alpha_6281_6360_structural_guards.test.ts`), plus
  the pre-existing 46 `fedos_core_rust_secret_handle*`/`dependency` guard
  tests (re-verified passing, zero regression, one pre-existing false
  positive found and fixed in THIS Arc's own new doc-comment prose — see
  the completion declaration).
- Compiled-WASM string/leak scan: a real `wasm32-unknown-unknown --release`
  build was produced; `strings` over the resulting `.wasm` binary contains
  no reference to this Arc's own test-only fixture bytes/passphrases
  (release builds strip `#[cfg(test)]` code entirely).
- No Debug leakage: `SecretHandleStore` has no `#[derive(Debug)]` and no
  custom `Debug` impl (structural guard item 3); `SecureMemoryFoundationDiagnostics`'s
  fields are all non-secret by construction (structural guard item 14).

**Honestly out of complete assurance** (restated, not weakened, from
`docs/secret_lifecycle_implementation_plan.md` §10 and
`docs/runtime_secure_memory.md` §8): allocator copies, compiler behavior
outside `zeroize`'s own guarantees, WASM linear-memory snapshots, OS swap,
and a hostile process/kernel with debugger or core-dump access all remain
outside what this Arc — or any Arc — can prove closed.

## Phase J — page-locking decision

New: `mod page_locking` (`lib.rs`). `PageLockingCapability` — a closed,
four-variant enum (`Unsupported`/`NotRequested`/`FutureNativeOnly`/`Active`).
`page_locking_capability()` returns `Unsupported` when compiled for
`wasm32` (no OS page-locking primitive exists there at all) and
`NotRequested` otherwise (this crate's native `cargo test`/`cargo check`
target never requests it either). **`Active` is never returned by any code
this Arc adds** — verified by structural guard item 12. No `mlock`/
`VirtualLock`/`libc`/`windows-sys`/`region`/`memsec` call, import, or
`unsafe` block exists anywhere in this module — verified by structural
guard item 11 (the terms appear ONLY as named vocabulary in doc comments,
per this Arc's own mission: "named here only so a future implementation
stage has a fixed vocabulary").

## Phase K — safe diagnostics

New: `mod secure_memory_diagnostics` (`lib.rs`).
`secure_memory_foundation_diagnostics(&SecretHandleStore) ->
SecureMemoryFoundationDiagnostics { live_handle_count: usize,
handle_capacity: usize, handle_limit_reached: bool, page_locking:
PageLockingCapability }`. Every field is a `usize`/`bool`/closed enum —
structurally incapable of holding a secret byte, size-that-narrows-a-secret,
fingerprint, or memory address (structural guard items 14-15). Not
WASM-exported this Arc (see Phase F) — a pure Rust `pub(crate)` diagnostic
surface, ready for a future Arc to wire through once a production
`SecretHandleStore` instance actually exists somewhere in the running
Runtime.

## Phase L — real vertical slice

`secret_handle_store_vertical_slice_tests` (`lib.rs`, `#[cfg(test)]`,
native `cargo test`, no WASM target required — this crate's
`#[wasm_bindgen]` types are plain, directly-callable Rust structs/methods
under the hood):

1. `real_master_seed_generate_seal_restore_round_trip_is_unaffected_by_this_arc`
   — real `FedosMasterSeedAuthority::generate()`/`seal()`/`restore_sealed()`/
   `public_key_hex_for_account()`, a real wrong-passphrase restore attempt
   (fails closed, authority stays unavailable), a real restart simulation
   (fresh authority instance), and a same-public-identity assertion after
   restore — proving this Arc changed nothing about the existing production
   path.
2. `a_real_secret_handle_flows_through_the_new_store_end_to_end` — a real
   32-byte, `MasterSeedMaterial`-kinded handle inserted into the new Store,
   used via its own narrow internal-derivation accessor, kind-mismatch
   rejected, destroyed, use-after-destroy rejected, double-destroy
   confirmed idempotent.
3. `destroy_all_handles_on_shutdown` — five live handles, `clear_all()`,
   every one denied afterward.

Also exercised by the `wasm32-unknown-unknown --release` build (Phase I) —
the SAME Rust source compiles to that target unchanged, and the resulting
`.wasm`/`.d.ts`/`.js` output was scanned for leaked content.

## Phase M — failure matrix

Every listed failure-matrix item this Arc's own scope touches is covered
by an existing, passing test:

| Item | Test |
|---|---|
| Handle-limit exhaustion | `insert_fails_closed_at_capacity` |
| Unknown handle | `use_handle_denies_an_unknown_index` |
| Stale handle | `a_stale_id_is_denied_after_its_slot_is_reused` |
| Wrong kind | `use_handle_denies_the_wrong_kind` |
| Use after destroy | `use_after_destroy_is_denied` |
| Double destroy | `destroy_is_reported_as_destroyed_exactly_once_then_already_destroyed`, `destroying_a_never_inserted_id_is_closed_not_a_panic` |
| Shutdown with live handles | `clear_all_destroys_every_live_handle_and_is_a_safe_no_op_when_already_empty`, `dropping_the_store_without_clear_all_still_frees_every_slot_safely`, `destroy_all_handles_on_shutdown` |
| Empty secret where forbidden | `empty_secret_is_still_a_fixed_32_byte_zero_buffer_never_a_zero_length_allocation` |
| Wrong passphrase | `real_master_seed_generate_seal_restore_round_trip_is_unaffected_by_this_arc`'s own wrong-passphrase branch |
| Debug formatting | Structural guard item 3 (no Debug impl exists to test behaviorally) |
| Serialization attempt | Structural guard item 4 |
| Accidental clone attempt | Structural guard item 2 (compile-fail-equivalent: `SecretHandleStore` derives nothing, and cannot derive `Clone` since `SecretHandle` itself forbids it) |
| WASM boundary raw-export absence | Structural guard item 10, plus the real `.wasm`/`.d.ts` scan |
| Native page-locking unavailable | `native_cargo_test_target_reports_not_requested` |
| Stopped authority/runtime | `destroy_all_handles_on_shutdown`, `dropping_the_store_without_clear_all_still_frees_every_slot_safely` |

**Not applicable, honestly**: "concurrent handle use"/"concurrent
destroy/use" — `SecretHandleStore::insert`/`destroy` require `&mut self`,
which Rust's own borrow checker already prevents from being called
concurrently on the same instance (no two mutable borrows can coexist);
`use_handle` takes `&self` and is safe to call concurrently by
construction (no interior mutability). A genuine multi-thread race test
would prove Rust's own compile-time guarantee, not this Arc's own code —
this Arc does not fabricate one.

## Phase N — structural guards

`test/secure_runtime_alpha_6281_6360_structural_guards.test.ts` — 20 tests,
covering every item in this Arc's own Phase N checklist that applies to
new code. Every pre-existing guard test in
`test/fedos_core_rust_secret_handle*.test.ts`/`fedos_core_rust_dependency.test.ts`
re-verified passing (one false positive found and fixed — see the
completion declaration).

## Verification run (this worktree)

1. `cargo check --tests` / `cargo build --lib` — clean.
2. `cargo test` (native) — 628 passed, 1 failed (pre-existing, confirmed
   identical on the unmodified `b8e9e062` base via `git stash` A/B).
3. `npm run build:wasm` — real `wasm32-unknown-unknown --release` build,
   succeeded; generated `.d.ts` export surface confirmed byte-identical in
   shape (14 `export class`/`export function` items, zero new).
4. `npx vitest run test/secure_runtime_alpha_6281_6360_structural_guards.test.ts`
   — 20/20 passing.
5. `npx vitest run test/fedos_core_rust_secret_handle.test.ts test/fedos_core_rust_secret_handle_real_bytes.test.ts test/fedos_core_rust_dependency.test.ts`
   — re-verified 0 diff against the unmodified base after fixing this
   Arc's own false-positive-triggering prose (JSON-diffed).
6. `npx vitest run test/fedos_core_rust_` (all 812 tests across 51 files)
   — inherent worktree-level flakiness confirmed independent of this Arc's
   own diff (two runs of the unmodified base also differ from each other
   by several tests; matches this repository's own documented "fresh
   worktree raw-import artifact").
7. No `p2p/`/`.tmp_gen/` file read, written, or referenced.
