# FedOS Core — Public Key Provisioning Path Design (Stage 104)

`docs/public_key_boundary.md` (Stage 103) fixed the design of three
future public boundaries around key material — generation, import,
export — and flagged the raw-input-to-opaque-handle provisioning path
(the mechanism behind `FedosKeyImportBoundary`) as needing its own,
separate design record. This document is that record. It remains a
design record, not an implementation: no code in this crate accepts,
converts, or stores a raw key or seed byte, and this stage adds no new
type or function to the public boundary.

## 1. Why provisioning needs its own record

Every other future operation on this crate's public boundary (encrypt,
decrypt, deriveKey, randomBytes, key generation, key export) either
takes no secret input at all or takes an opaque handle. Import is the
sole exception: a caller legitimately possesses a raw key or seed that
does not yet exist inside this crate's boundary, and the ONLY way to
give the boundary anything useful to do with it is to accept those raw
bytes once. That single exception deserves more design care than a
one-line mention, because it is the one place this crate's usual "no raw
secret byte crosses the public API" rule has a deliberate, narrow hole —
and a hole that is not carefully bounded is indistinguishable from no
rule at all.

## 2. The shape of a provisioning call

A future provisioning function is expected to:

- accept exactly one raw secret input per call — never a batch, never a
  list, so each call has exactly one input to reason about and exactly
  one point where that input stops existing as a raw byte;
- accept a fixed, bounded length selected by an algorithm/format label
  (reusing `FedosCryptoAlgorithm` and a future key-format label), never
  an open-ended buffer with no declared shape — an oversized or
  malformed input is rejected before conversion, not truncated or
  silently accepted;
- convert that input into an opaque handle as its ONLY externally
  visible side effect — the function's return value is the handle (or a
  fixed error label), never an echo, transformation, or partial view of
  the input;
- hold the raw input for the shortest possible lifetime internally, with
  no further design commitment made here about the exact mechanism
  (that is an implementation detail for the stage that builds this,
  informed by the `zeroize`/`secrecy` foundation already adopted Stage
  78) — this document fixes the CONTRACT (raw in, handle out, nothing
  else), not the internal lifetime-management technique.

## 3. What provisioning must never do

- Never log, audit-record, or otherwise persist the raw input — the
  audit boundary (`docs/fedos_core_public_api_design.md` section 9)
  records operation/algorithm labels only, and provisioning is no
  exception to that rule even though it is the one operation that
  legitimately sees a raw secret.
- Never return the raw input back to the caller in any form, including
  inside an error — a rejected import fails with a fixed taxonomy label
  (`docs/fedos_core_public_api_design.md` section 8), never a message
  that echoes or fingerprints the rejected bytes.
- Never accept a raw input for any operation OTHER than provisioning
  itself — `encrypt`/`decrypt`/`deriveKey`/`randomBytes`/key
  generation/key export all continue to reject a raw byte parameter, per
  `docs/fedos_core_public_api_design.md` sections 3 and 4, unchanged by
  this document.

## 4. Relationship to `FedosKeyImportBoundary`

`FedosKeyImportBoundary` (Stage 103) remains exactly what it already
is — a label-only status type reporting whether the import boundary is
available, permanently `Unavailable` today. This document does not
change that type's shape, and does not add a request/response type for
provisioning — designing that concrete type is left to the
implementation stage referenced in the roadmap below, once the contract
this document fixes has been reviewed on its own.

## 5. What this stage does NOT do

- No provisioning function, public or private, exists anywhere in this
  crate.
- No raw key/seed byte is accepted, converted, or stored anywhere.
- No new type or function is added to the public boundary by this
  document — `FedosKeyImportBoundary`/`fedos_key_import_boundary_status()`
  (Stage 103) are unchanged.
- No connection to `secret_handle`/`key_material` (the crate-private
  skeletons) is made or implied.

## 6. Roadmap

1. Review this document's contract (section 2–3) on its own, as an
   explicitly-reviewed design decision, before any implementation stage
   begins.
2. ~~Design the concrete key-format label enumeration section 2
   references (e.g. raw symmetric key vs. a future asymmetric format),
   as its own small addition — still no implementation.~~ Done — Stage
   105 fixed `FedosKeyFormatLabel` (`packages/fedos-core-rust/src/lib.rs`)
   as seven FUTURE PLANNING LABELS
   (`RawAeadKeyPlaceholder`/`RawKdfOutputPlaceholder`/
   `NostrSecretKeyPlaceholder`/`NostrPublicKeyPlaceholder`/
   `Nip44ConversationKeyPlaceholder`/`ExternalOpaqueKeyRefPlaceholder`/
   `TestOnlyPlaceholder`), plus `FedosKeyFormatState`/`FedosKeyFormatStatus`/
   `FedosKeyFormatDescriptor` and one fixed accessor,
   `fedos_key_format_descriptor_placeholder()`. Each label is explicitly a
   FUTURE PLANNING LABEL, not a statement of "format support" — no label
   accepts, parses, or validates a real byte layout, and the raw-input
   format decision itself (which of these labels a real provisioning call
   would actually accept, and in what byte shape) remains UNIMPLEMENTED,
   exactly as this document originally left it. See
   `packages/fedos-core-rust/README.md`'s "Public key-format label
   boundary (Stage 105)" section for the full record.
3. Implement the real provisioning function behind
   `FedosKeyImportBoundary`, consuming the CSPRNG-adjacent secret-handling
   foundation (`zeroize`/`secrecy`, Stage 78) for the raw input's
   short-lived internal storage.
4. Only after step 3 is reviewed, consider whether `FedosKeyExportBoundary`
   should ever be implemented at all — `docs/public_key_boundary.md`
   section 4 already flags this as a candidate for permanent
   non-implementation, and this document does not change that.
