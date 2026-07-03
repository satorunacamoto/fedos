# FedOS Core — Public Key Boundary Design (Stage 103)

This document fixes the DESIGN of three future public boundaries around
key material — generation, import, and export — extending
`docs/fedos_core_public_api_design.md` sections 3 and 4 (input stays
centered on an opaque secret handle; a raw key/seed/passphrase must never
be a direct parameter). As of Stage 103,
`packages/fedos-core-rust/src/lib.rs` gains three small, PUBLIC,
label-only placeholder types —
`FedosKeyGenerationBoundary`/`fedos_key_generation_boundary_status()`,
`FedosKeyImportBoundary`/`fedos_key_import_boundary_status()`, and
`FedosKeyExportBoundary`/`fedos_key_export_boundary_status()` — that
mirror the shape described below. None of the three produces, accepts,
or exposes a key byte.

## 1. Why three boundaries, not one

Generation, import, and export are not the same operation wearing three
names — they have different trust implications. Generation produces a
new key the caller never sees the raw bytes of (the result should be an
opaque handle only). Import accepts a raw key or seed FROM the caller —
the one place in this crate's future design where raw secret bytes
legitimately cross the public boundary once, specifically to be
converted immediately into an opaque handle (see
`docs/fedos_core_public_api_design.md` section 4's provisioning-path
note). Export is the deliberately dangerous inverse — exposing a raw key
byte back to the caller — and is expected to be the most heavily
reviewed and most restricted of the three, if it is ever implemented at
all. Modeling them as three independent placeholder types keeps these
different trust boundaries visible and separately reviewable, rather
than collapsing them into one generic "key operation" boundary that would
obscure which direction bytes are meant to flow.

## 2. Future design of key generation

The future key-generation path is expected to:

- accept no raw byte input of any kind — a caller requests a key by
  algorithm label only (reusing `FedosCryptoAlgorithm` from Stage 102),
  never by supplying seed material;
- return an opaque secret handle (the same shape the crate-private
  `secret_handle` skeleton already fixes internally), never the raw
  generated key bytes;
- draw its entropy from the same CSPRNG source `docs/public_random_boundary.md`
  describes, once that source is adopted and reviewed — no such
  dependency exists in this crate today, and no code anywhere in this
  crate generates a key.

## 3. Future design of key import

The future key-import path is expected to:

- be the ONE place in this crate's design where a raw key or seed
  legitimately crosses the public boundary from the caller — but only to
  be converted immediately into an opaque handle, never stored,
  forwarded, or returned as-is;
- accept a fixed, bounded byte length selected by algorithm/format label,
  never an open-ended buffer with no declared shape;
- return only an opaque secret handle and a non-sensitive result label —
  never an echo of the imported bytes, and never a raw error containing
  any fragment of them (see `docs/fedos_core_public_api_design.md`
  section 8's fixed-error-taxonomy requirement, which applies here with
  particular force).

## 4. Future design of key export

The future key-export path — if it is ever implemented — is expected to:

- require its own, separately reviewed authorization design before any
  implementation stage may begin (out of scope for this document);
- be the most restricted operation on this boundary, precisely because it
  is the one path whose successful result is a raw secret byte leaving
  the crate;
- be considered a candidate for being NEVER implemented, if a real
  design review concludes the risk outweighs any legitimate use case —
  this document does not commit to building it, only to reserving its
  placeholder shape so the design question stays visible.

## 5. What this stage implements

Nothing beyond three label-only placeholder types and three accessor
functions:

- **`FedosKeyGenerationBoundaryState`** (`Unavailable` / `Placeholder`)
  and **`FedosKeyGenerationBoundary`** (carries only the state), returned
  by **`fedos_key_generation_boundary_status()`** — permanently
  `Unavailable`.
- **`FedosKeyImportBoundaryState`** (`Unavailable` / `Placeholder`) and
  **`FedosKeyImportBoundary`** (carries only the state), returned by
  **`fedos_key_import_boundary_status()`** — permanently `Unavailable`.
- **`FedosKeyExportBoundaryState`** (`Unavailable` / `Placeholder`) and
  **`FedosKeyExportBoundary`** (carries only the state), returned by
  **`fedos_key_export_boundary_status()`** — permanently `Unavailable`.

None of the three types accepts a key, seed, or byte parameter of any
kind; none of the three functions reads, computes, generates, imports, or
exports anything. No connection exists between these types and the
crate-private `secret_handle`/`key_material` skeletons, or between the
three of them beyond existing on the same public boundary.

## 6. Roadmap

1. ~~Design and review the raw-input-to-opaque-handle provisioning path
   this document's section 3 describes, as its own stage — still no
   implementation.~~ Done — see `docs/public_key_provisioning.md`
   (Stage 104) for the full provisioning-contract design record.
2. Implement real key generation behind `FedosKeyGenerationBoundary`,
   consuming the CSPRNG from `docs/public_random_boundary.md`'s roadmap
   once adopted.
3. Implement real key import behind `FedosKeyImportBoundary`, consuming
   the provisioning path from step 1.
4. Separately review whether key export should be implemented at all; if
   so, implement it behind `FedosKeyExportBoundary` only after that
   review concludes.
