# Review 17 — MLS Comparison

## Restated, not re-derived: MLS remains entirely absent and entirely out of scope

Confirmed unchanged: zero references to MLS, TreeKEM, or RFC 9420
anywhere in `packages/fedos-core-rust/src/` or `src/` (grep for `\bMLS\b`,
case insensitive, zero hits beyond incidental matches). The prior
review's own finding
(`docs/reviews/private_protocol_delivery_group_v1/05_key_distribution.md`
citation, restated) that "a Sender Key or MLS-style implementation
should not be hand-designed by a future FedOS Arc from scratch — it
requires adopting an existing, formally-specified scheme" stands
entirely unchanged.

## Direct comparison against pairwise fanout

| Property | Pairwise Fanout (`04`) | MLS (RFC 9420) |
|---|---|---|
| Forward secrecy | None (`19`) | Yes — TreeKEM provides per-epoch forward secrecy |
| Post-compromise security | None (`19`) | Yes — TreeKEM's own ratcheting provides it |
| Member removal cost | O(1) per future message (no re-encryption, `09`) | O(log N) key updates via TreeKEM, but a real, formal removal-from-future-epochs guarantee fanout cannot offer |
| Scalability | O(N) ciphertexts per message (`16`) | O(1) ciphertext per message once a shared group key/epoch is established |
| Implementation dependency | Zero new primitives (`04`) | A full RFC 9420 implementation (TreeKEM, a formally-specified wire protocol, ratchet-tree state management) — an enormous undertaking relative to anything else compared in this review |
| Standardization | Not standards-track; explicitly an interim, FedOS-internal shape | A ratified IETF standard with interoperability implications this review has not researched |
| Buildable today without further design | **Yes** | **No, by a very large margin** |

## Why MLS is correctly out of scope for this review, restated plainly

This review's own instruction ("do not invent cryptography") already
forecloses hand-rolling anything MLS-shaped; adopting the REAL RFC 9420
would require either a vetted third-party MLS library (a new
dependency this review's own rules also forbid introducing without
explicit instruction) or an enormous, independently-reviewed
implementation effort spanning many Arcs — categorically different in
scale from the additive orchestration layer (`04`) this review
recommends as the next step. MLS remains named as the correct
eventual target for real forward secrecy and post-compromise security
IF this product's own threat model (`19`) someday requires them beyond
what fanout provides — a decision this review names, does not make.

## Explicit refusal to invent

This review does not design any part of an MLS-equivalent scheme
(ratchet tree, epoch derivation, welcome messages) — that would be
inventing cryptography at a scale far beyond this review's own
prohibition.

## See also

- `16_sender_key_comparison.md`, `18_migration_path.md`, `19_threat_model.md`
