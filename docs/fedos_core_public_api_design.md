# FedOS Core — Public Crypto API Design (Stage 102)

This document fixes the DESIGN of the future public crypto API
(`encrypt`, `decrypt`, `deriveKey`, `randomBytes`) before any of it is
implemented. It is a design record, not an implementation. As of Stage
102, `packages/fedos-core-rust/src/lib.rs` gains a small, PUBLIC,
label-only placeholder boundary (`FedosCryptoOperation`,
`FedosCryptoAlgorithm`, `FedosCryptoBoundaryState`,
`FedosCryptoBoundaryStatus`, `FedosCryptoRequestDescriptor`,
`FedosCryptoResponseDescriptor`, and `fedos_crypto_boundary_status()`)
that mirrors the shapes described below — nothing more. See
`docs/fedos_core_architecture_freeze_v1.md` for the internal skeleton
group this boundary sits in front of, and `docs/rust_dependency_adoption.md`
for the dependency-adoption history referenced in sections 5 and 6.

## 1. Public API purpose

The public crypto API is the ONLY surface a host (Runtime, Worker, or
any future `CryptoProvider` implementation) is meant to call. Its job is
to hide every internal skeleton module, every dependency, and every byte
of key/seed/plaintext/ciphertext material behind a small, stable,
non-sensitive function and type surface. A host should never need to
import or reason about `secret_handle`, `aead_core`, `kdf_core`, or any
other internal module described in the architecture freeze — only the
public functions this design record fixes.

## 2. Future design of encrypt / decrypt / deriveKey / randomBytes

Each future function is expected to:

- accept a small number of non-sensitive, structured arguments (an
  operation descriptor and an opaque input reference — see section 3),
  never a loose collection of raw parameters;
- return either a non-sensitive result descriptor or a fixed error
  label (see section 8) — never a raw success/failure boolean with no
  structure, and never the caller's own input echoed back unstructured;
- perform exactly one cryptographic operation per call — no batching,
  no implicit chaining of encrypt-then-derive or similar, so each call
  has one clear, auditable operation label attached to it (see section
  9).

`encrypt` and `decrypt` are expected to be the AEAD operations described
in section 5. `deriveKey` is expected to be the KDF operation described
in section 6. `randomBytes` is expected to produce CSPRNG output sized
by a fixed, bounded request — never an unbounded or caller-controlled
allocation — and is treated as its own boundary, distinct from the other
three (see section 7).

## 3. Inputs remain centered on secret handle / opaque reference

Even in the future, fully-implemented design, no function on this public
boundary accepts a real secret directly. Every input that touches key,
seed, or passphrase material is expected to be an opaque handle or
reference — the same shape already fixed, internally, by the
crate-private secret-handle skeleton — never the underlying bytes
themselves. A caller obtains a handle from a separate, dedicated
provisioning path (out of scope for this document) and passes only that
handle to `encrypt`/`decrypt`/`deriveKey`. This keeps every function on
the public boundary itself free of any parameter type capable of holding
raw secret material, so the boundary's own function signatures can be
reviewed for secret-safety without inspecting their bodies.

## 4. Raw key / seed / passphrase must NOT be passed directly

This is a hard constraint, not a preference: no current or future public
function may accept a raw key, seed, or passphrase as a direct
byte-level or string-level parameter. If a future caller genuinely needs
to provision new secret material, that provisioning is expected to be a
SEPARATE, narrowly-scoped function (or a separate boundary entirely)
whose sole job is to turn a raw input into an opaque handle immediately,
without exposing that raw input to `encrypt`/`decrypt`/`deriveKey`
themselves. Nothing in this document authorizes designing such a
provisioning function yet — it is out of scope for Stage 102.

## 5. AEAD candidates

Two AEAD algorithms have production dependencies already adopted and
already verified, under `cargo test`, against their respective official
known-answer vector sets:

- **ChaCha20-Poly1305** — adopted and verified against RFC 8439 vectors.
- **AES-256-GCM** — adopted and verified against NIST CAVP vectors.

The future `encrypt`/`decrypt` design is expected to let the caller pick
between these two by label only (see `FedosCryptoAlgorithm` in the
Stage 102 boundary), never by naming or importing a cipher crate
directly, and never by supplying algorithm-specific parameters (like a
counter mode or block size) that would leak implementation detail across
the boundary.

## 6. KDF candidates

Two KDF algorithms have production dependencies already adopted and
already verified, under `cargo test`, against their respective official
known-answer vector sets:

- **HKDF-SHA256** — adopted and verified against RFC 5869 vectors.
- **Argon2id** — adopted and verified against RFC 9106 vectors.

The future `deriveKey` design is expected to let the caller pick between
these two by the same label mechanism as section 5 — HKDF-SHA256 for
fast, high-entropy-input derivation (e.g. expanding an existing key),
Argon2id for slow, memory-hard derivation from lower-entropy input (e.g.
a passphrase) — never by exposing algorithm-specific tuning parameters
(iteration count, memory cost, lane count) as free-form caller input;
any such tuning is expected to be a fixed, reviewed profile selected by
label, not an open numeric parameter.

## 7. Nonce / random generation is a separate boundary

Random-byte generation — whether exposed directly as `randomBytes` or
used internally to generate a nonce for `encrypt` — is treated as its
own design boundary, not a detail folded into the AEAD design in section
5. This split exists so the CSPRNG source, its failure behavior, and any
platform-specific wiring (see section 10) can be reviewed once, in one
place, rather than once per algorithm that happens to need random
output. No nonce-generation or CSPRNG-wiring decision is made by this
document; Stage 103's candidate list includes fixing a placeholder
boundary for `randomBytes` specifically so this split can be designed
before `encrypt`/`decrypt` need to consume it.

## 8. Errors: fixed taxonomy only

No future public function may return a raw error string, a raw
underlying-library error value, or a stack trace. Every failure is
expected to surface as one label from a small, fixed, reviewed error
taxonomy (analogous in shape to the crate-private error-taxonomy
skeleton already fixed internally) — for example a label distinguishing
"input was rejected" from "operation is unavailable" from "handle was
invalid" — with no free-form message attached that could carry secret
material, a file path, or an internal implementation detail. This
document does not fix the exact taxonomy values; it fixes the
constraint that whatever the values turn out to be, they are a closed,
reviewed set, not open text.

## 9. Audit: no payload

If a future stage wires the public boundary to any audit or logging
mechanism (analogous in shape to the crate-private audit-event skeleton
already fixed internally), that mechanism may record the requested
operation and algorithm labels, and the resulting state label, and
nothing else. No audit record may contain a key, seed, plaintext,
ciphertext, nonce, tag, passphrase, or derived-key byte, nor any raw
error text from section 8. This applies regardless of log level, verbosity
setting, or debug build configuration.

## 10. Runtime / WASM wiring deferred

Connecting this boundary to the Runtime, the Worker, any
`CryptoProvider` implementation, or a WASM binding is explicitly OUT OF
SCOPE for this document and for Stage 102. This document fixes only the
shape of the boundary itself; wiring it into a host is a separate,
future, explicitly-reviewed stage, to be undertaken only after the
boundary's real implementation (not just its placeholder types) exists
and has passed its own review.

## 11. This stage is placeholder API boundary only

Stage 102 implements NONE of the above. The `FedosCryptoOperation`,
`FedosCryptoAlgorithm`, `FedosCryptoBoundaryState`,
`FedosCryptoBoundaryStatus`, `FedosCryptoRequestDescriptor`, and
`FedosCryptoResponseDescriptor` types added to
`packages/fedos-core-rust/src/lib.rs` this stage are non-sensitive
labels only, and the one new function, `fedos_crypto_boundary_status()`,
returns a fixed, permanently `Unavailable` status. No encrypt, decrypt,
key-derivation, or random-byte generation function is added. No raw
key/seed/plaintext/ciphertext/passphrase/nonce byte is accepted,
returned, or stored by anything added this stage. No Runtime, Worker,
`CryptoProvider`, or WASM code is touched.

## 12. Implementation order (roadmap)

The recommended order for future stages to implement behind this
boundary, each as its own explicitly-reviewed stage:

1. Fix a placeholder boundary for `randomBytes` specifically (see
   section 7), separating nonce/random design from the AEAD design.
2. Design and fix the raw-input-to-opaque-handle provisioning path
   referenced in section 4, still without implementing real
   cryptography.
3. Implement the real CSPRNG behind `randomBytes`, reviewed on its own,
   before any function that would consume its output.
4. Implement real `deriveKey`, selecting between the two KDF candidates
   in section 6, consuming only opaque handles per section 3.
5. Implement real `encrypt`/`decrypt`, selecting between the two AEAD
   candidates in section 5, consuming a nonce from the now-implemented
   `randomBytes` boundary and a key from an opaque handle.
6. Only after 1 through 5 are each independently implemented and
   reviewed, wire the boundary into the Runtime/Worker/`CryptoProvider`
   per section 10.
