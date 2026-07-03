# FedOS Core — Architecture Freeze v1 (docs only, no code)

**Status: this document adds no code.** It fixes, in writing, the internal
type architecture that Stage 79 through Stage 99 built inside
[`packages/fedos-core-rust`](../packages/fedos-core-rust/README.md) — sixteen
crate-private, label-only "skeleton" modules — into a single design record.
`src/lib.rs`, `Cargo.toml`, and every test file are **UNCHANGED** by this
document. It is a **design record, not a crypto implementation spec, and not
a safety guarantee**.

This complements, and does not replace,
[`fedos_core_rust_safety.md`](fedos_core_rust_safety.md) (the binding safety
contract), [`crypto_test_vectors.md`](crypto_test_vectors.md) (the vector
plan), [`rust_dependency_adoption.md`](rust_dependency_adoption.md) (the
dependency-review record), and
[`verification_infrastructure.md`](verification_infrastructure.md) (the
vector-lifecycle plan). Where this document and any of those disagree, the
safety contract and the per-stage `packages/fedos-core-rust/README.md`
history are authoritative — this document is a snapshot, not a new rule
source.

---

## 1. Purpose

- **Fix the internal skeleton inventory in one place.** Stage 79 through
  Stage 99 added sixteen crate-private modules to
  `packages/fedos-core-rust/src/lib.rs`, one or two per stage, each
  reviewed independently. This document is the first place all sixteen are
  described together, so a reader does not have to reconstruct the picture
  from twenty-one separate stage sections.
- **Record what is deliberately NOT connected, and why.** Every skeleton
  module was built to the same rule: hold labels only, construct nothing,
  connect to nothing, unless a later, explicitly-reviewed stage says
  otherwise. This document states that rule once, at the architecture
  level, instead of repeating it per module.
- **Not a new implementation.** No type is added, renamed, or connected by
  this document. No `Cargo.toml` dependency changes. No public API changes.
- **Not a safety certification.** This document does not claim the crate is
  secure, audited, complete, or production-ready — see §10.

## 2. Current FedOS Core boundary

- `packages/fedos-core-rust` is a Rust crate skeleton (`rlib` only, no
  `cdylib`, no WASM target, no `.wasm` produced).
- Its public API — the ONLY six functions any caller outside this crate can
  reach — is exactly:
  `fedos_core_status`, `fedos_core_capabilities`,
  `random_bytes_placeholder`, `derive_key_placeholder`,
  `encrypt_placeholder`, `decrypt_placeholder`. Every one of them returns an
  `Unavailable`/`Placeholder` `FedosCoreStatus` and touches no key, seed,
  plaintext, or ciphertext byte. This signature set has been UNCHANGED since
  Stage 69 and remains unchanged by this document.
- The TypeScript side (`packages/fedos-core-rust/src/index.ts`,
  `src/types.ts`) mirrors this shape as `FedosCoreCrypto` /
  `PlaceholderFedosCoreCrypto` — the host's only reachable surface for this
  package.
- The host reaches this package ONLY through
  `FedosCoreCryptoProvider` (`src/crypto/fedos_core_adapter.ts`), which the
  Runtime does not select by default — `NoopCryptoProvider` remains the
  default `CryptoProvider`.
- `#![forbid(unsafe_code)]` is crate-wide; there is still zero `unsafe`
  anywhere in `src/lib.rs`.

## 3. Stage 79–99 internal skeleton timeline

| Stage | Module | Adds |
|---|---|---|
| 79 | `secret_handle` | `SecretHandle` — first production use of `zeroize`/`secrecy` (Stage 78), against a fixed placeholder marker only |
| 80 | `aead_core` | `AeadPlaceholderRequest` — algorithm + operation labels only |
| 82 | `kdf_core` | `KdfPlaceholderRequest` — algorithm + operation labels only |
| 87 | `key_material` | `KeyMaterialHandle` — reuses `secret_handle`'s placeholder-marker pattern, plus a `KeyMaterialKind` label |
| 88 | `domain_label` | `DomainLabel` — fixed `&'static str` label per `DomainLabelKind`, no dynamic construction |
| 89 | `operation_context` | `OperationContext` — names a future AEAD/KDF/Argon2/NIP-44/Nostr-key-derivation operation, label only |
| 90 | `request_descriptor` | `RequestDescriptor` — names a future operation REQUEST, non-sensitive metadata only |
| 91 | `response_descriptor` | `ResponseDescriptor` — names a future operation RESULT, plus an `ErrorPlaceholder` state/kind pair |
| 92 | `crypto_pipeline` | `CryptoPipeline` — names a future PIPELINE that would bundle the above, still bundling none |
| 93 | `descriptor_bundle` | `DescriptorBundle` — names a future BUNDLE, deliberately holds no other skeleton's type at all |
| 94 | `execution_plan` | `ExecutionPlan` — names a future processing ORDER, plus a fixed six-step `ExecutionStepKind` sequence and a `step_count()` returning a hardcoded `6` |
| 95 | `error_taxonomy` | `CryptoErrorDescriptor` — classifies a future operation FAILURE, no error message/source/stack field |
| 96 | `audit_event` | `AuditEventLabel` — names a future crypto-internal state change, no payload, no logging |
| 97 | `audit_policy` | `AuditPolicy` — names a future observability decision; `decision_placeholder()` is hardcoded to the safe-default `DenyPlaceholder`; deliberately does not reference `audit_event` by name |
| 98 | `lifecycle_state` | `LifecycleMarker` — names a future coarse lifecycle transition (provider/request/secret/audit/pipeline), four `mark_*_placeholder()` transition methods, no timestamp/counter |
| 99 | `module_registry` | `ModuleRegistry` — ENUMERATES, by fixed label only, all fifteen modules above; `registered_module_count()` is hardcoded to `15`, never computed |

Every module above was placed, in this exact order, between `kdf_core`
(Stage 82) and this crate's first `#[cfg(test)]`-gated vector-verification
module — a deliberate insertion point chosen every stage so that no existing
JS guard test's "first `cfg(test)`" slicing logic ever shifted.

## 4. Sixteen-module role table

| Module | Kind label enum | Core question it answers |
|---|---|---|
| `secret_handle` | — | "Is there a lifecycle for a generic secret value?" |
| `aead_core` | `AeadAlgorithm` / `AeadOperation` | "What AEAD algorithm and operation is intended?" |
| `kdf_core` | `KdfAlgorithm` / `KdfOperation` | "What KDF algorithm and operation is intended?" |
| `key_material` | `KeyMaterialKind` | "What kind of key material is this?" |
| `domain_label` | `DomainLabelKind` | "What fixed domain-separation string applies?" |
| `operation_context` | `OperationKind` | "What cryptographic operation is this?" |
| `request_descriptor` | `RequestDescriptorKind` | "What did the caller ask for?" |
| `response_descriptor` | `ResponseDescriptorKind` | "What kind of result (or error) came back?" |
| `crypto_pipeline` | `CryptoPipelineKind` | "What multi-step pipeline would run this?" |
| `descriptor_bundle` | `DescriptorBundleKind` | "How would several of the above be grouped?" |
| `execution_plan` | `ExecutionPlanKind` / `ExecutionStepKind` | "In what order would steps run?" |
| `error_taxonomy` | `CryptoErrorKind` | "How would a failure be classified?" |
| `audit_event` | `AuditEventKind` | "What internal state change could be observed?" |
| `audit_policy` | `AuditPolicyKind` / `AuditPolicyDecision` | "Would that observation be permitted?" |
| `lifecycle_state` | `LifecycleKind` / `LifecycleState` | "What lifecycle stage is a tracked resource in?" |
| `module_registry` | `ModuleRegistryKind` | "Which of the above skeletons exist today?" |

Every module in this table shares the same shape: a `pub(crate)`-at-most
struct holding only fixed enum labels (never `pub`, never re-exported), a
`new_placeholder(...)` constructor taking no user/environment/config input,
a non-sensitive `*Status` snapshot, and — where the stage called for it — a
handful of state-transition or fixed-return methods (`clear()`,
`mark_*_placeholder()`, `step_count()`, `decision_placeholder()`,
`registered_module_count()`). None holds a `String`, a `Vec`, a
borrowed-byte-slice, a timestamp, or a counter; none writes to any log sink.

## 5. Explicitly unconnected pairs

Per stage, each new skeleton's own doc comment and dedicated guard test
state which other skeletons it does **not** construct, hold, or reference.
This document restates the rule at the architecture level instead of
listing every pair: **no skeleton module added Stage 79–99 constructs,
holds a field of, or otherwise references another skeleton module's type**,
with three narrow exceptions, all label reuse only (never a value
connection):

- `key_material` (Stage 87) reuses `secret_handle`'s (Stage 79)
  placeholder-marker *pattern* — a duplicated, independent implementation,
  not a shared instance or a field reference.
- `response_descriptor` (Stage 91) reuses the same `Placeholder`/`Disabled`
  state shape every later module also reuses, and adds its own
  `ErrorPlaceholder` variant — a shape convention, not a connection.
- `module_registry` (Stage 99) *names* all fifteen other modules via its
  `ModuleRegistryKind` enum — but never constructs, holds, or reads a field
  of any of them. Naming is not connecting.

`audit_policy` (Stage 97) went one step further than every other module: it
does not mention `audit_event` (Stage 96) — its closest conceptual
neighbor — anywhere in its own source, by explicit instruction, since no
real connection between the two exists yet.

## 6. Public API surface — unchanged since Stage 69

```rust
pub fn fedos_core_status() -> FedosCoreStatus
pub fn fedos_core_capabilities() -> &'static [&'static str]
pub fn random_bytes_placeholder() -> FedosCoreStatus
pub fn derive_key_placeholder() -> FedosCoreStatus
pub fn encrypt_placeholder() -> FedosCoreStatus
pub fn decrypt_placeholder() -> FedosCoreStatus
```

No function above constructs, holds, or returns an instance of any of the
sixteen skeleton types in §3/§4. Every JS guard test added Stage 79–99
independently re-asserts this same six-name, six-signature list — see
`test/fedos_core_rust_*.test.ts`.

## 7. Runtime / Worker / `CryptoProvider` — not wired

None of the sixteen modules in §3 is constructed, referenced, or imported
by:

- `src/runtime/create_runtime.ts` (the Runtime),
- `src/worker.ts` (the Worker),
- `src/crypto/fedos_core_adapter.ts` (`FedosCoreCryptoProvider`), or
- any other `CryptoProvider` implementation.

The Runtime still selects `NoopCryptoProvider` by default. This is checked,
per stage, by a Runtime/Worker source-string guard in every one of the
sixteen dedicated test files.

## 8. What IS verified today

Three RustCrypto dependencies are adopted in `Cargo.toml` and checked
against their official known-answer test vectors under `cargo test` — but
none is called from `src/lib.rs`'s production code path (everything before
the file's first `#[cfg(test)]`-gated module):

- **RFC 8439** — `chacha20poly1305` (adopted Stage 74) verified against
  [`test-vectors/aead/chacha20poly1305-rfc8439.json`](../test-vectors/aead/chacha20poly1305-rfc8439.json)
  in the `rfc8439_vectors` module (Stage 75, refactored Stage 81).
- **RFC 5869** — `hkdf` (adopted Stage 76) verified against
  [`test-vectors/kdf/hkdf-rfc5869.json`](../test-vectors/kdf/hkdf-rfc5869.json)
  in the `rfc5869_vectors` module (Stage 77, refactored Stage 83).
- **RFC 9106** — `argon2` (adopted Stage 84) verified against
  [`test-vectors/kdf/argon2id-rfc9106.json`](../test-vectors/kdf/argon2id-rfc9106.json)
  in the `rfc9106_vectors` module (Stage 85, refactored Stage 86).

This proves the three dependencies reproduce their RFCs' known answers
under `cargo test` — it does **not** mean any public function performs
AEAD, KDF, or password hashing. `encrypt_placeholder`, `decrypt_placeholder`,
and `derive_key_placeholder` remain byte-for-byte unchanged from Stage 69.

## 9. What is NOT yet implemented

None of the following exists anywhere in this crate today:

- A public `encrypt`/`decrypt` implementation.
- A public `deriveKey` implementation.
- CSPRNG / random byte generation (`getrandom`, `rand`, or otherwise).
- Real key generation of any kind.
- NIP-44 (encryption or otherwise).
- Nostr key derivation (secret key, public key, or otherwise).
- An AES-GCM dependency, or any AEAD besides the `chacha20poly1305` crate
  currently exercised only under `cfg(test)`.
- A WASM target, a WASM loader connection, or any `.wasm` artifact.
- Any real cryptographic operation reachable from the Runtime or the
  Worker.

## 10. Non-claims

This crate's skeleton architecture — however many stages deep — is **not**
a security guarantee. In particular:

- **No skeleton is described as a safety guarantee.** A `pub(crate)` label
  enum existing is not evidence that the operation it names is safe, tested
  for production use, or close to landing.
- **No "military-grade", "zero-trace", "unbreakable", or similarly
  unfalsifiable marketing language is used anywhere in this crate's docs,
  and none is introduced by this document.** Every description in §3/§4 is
  a statement about what code exists (labels, no bytes, no connections),
  never a claim about what an attacker cannot do.
- **No secret, log, or stack trace exists to leak.** `error_taxonomy`
  (Stage 95) and `audit_event`/`audit_policy` (Stage 96–97) hold no error
  text, no wrapped source error, no stack trace, and emit no log line —
  not because logging was made "safe," but because none of it exists yet.
- This document does not change, weaken, or supersede
  [`fedos_core_rust_safety.md`](fedos_core_rust_safety.md) — that document's
  rules (unsafe policy, dependency policy, secret-handling policy, WASM
  policy) remain fully in force.

## 11. Recommended next-phase order

Now that the internal label architecture is fixed, the recommended path
back toward a real implementation — each still its own explicitly-reviewed
stage, one concern at a time — is:

1. **Adopt the `aes-gcm` dependency** (RustCrypto) — a dependency + build
   check ADOPTION ONLY, exactly like every prior dependency stage
   (`chacha20poly1305` Stage 74, `hkdf` Stage 76, `argon2` Stage 84): no
   code imports or calls it yet.
2. **Wire the AES-256-GCM NIST test vectors** to `cargo test`, the same
   "wired" pattern as RFC 8439/5869/9106 (§8) — verification only, still no
   public API change.
3. **Extract a test-only AES-GCM helper**, mirroring the
   `seal_chacha20poly1305_for_test`/`extract_hkdf_sha256_for_test`/
   `derive_argon2id_for_test` refactor pattern (Stage 81/83/86).
4. **Write internal public-API design docs** — before any public
   `encrypt`/`decrypt`/`deriveKey` implementation lands, fix in writing what
   its signature, error taxonomy, and secret-handling contract would be,
   reusing the label vocabulary this freeze already fixed (§3/§4).
5. **Only then** consider an actual public `encrypt`/`decrypt` skeleton —
   and even then, gated behind the crypto test-vector plan
   ([`crypto_test_vectors.md`](crypto_test_vectors.md)) and the build
   manifest ([`fedos_core_build_manifest.md`](fedos_core_build_manifest.md))
   this crate's existing safety contract already requires.

## 12. Conclusion — Architecture Freeze v1

As of Stage 99 (commit `219c1f9`):

- **The internal type architecture is frozen at the label-only skeleton
  level.** Sixteen crate-private modules exist, each holding fixed enum
  labels and non-sensitive status snapshots only, with the narrow,
  explicitly-stated exceptions in §5.
- **Behavior remains placeholder.** No skeleton method computes, encrypts,
  decrypts, derives, hashes, or observes anything real. Every constructor,
  transition method, and fixed-return method (`step_count()`,
  `decision_placeholder()`, `registered_module_count()`) is a hardcoded
  label operation, not a computation.
- **No production cryptography exists yet.** The public API is still
  exactly the six Stage 69 placeholder functions; three RustCrypto
  dependencies are vector-verified under `cfg(test)` only (§8); nothing is
  wired into the Runtime, the Worker, or `CryptoProvider` (§7).

This freeze is a checkpoint, not an end state — §11 names the next phase.
