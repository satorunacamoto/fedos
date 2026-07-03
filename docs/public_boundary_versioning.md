# FedOS Core — Public Boundary Versioning & Metadata Design (Stage 103)

This document fixes the DESIGN of five descriptor/metadata types added to
the public boundary alongside the operation-boundary types
`docs/public_random_boundary.md` and `docs/public_key_boundary.md`
describe: `FedosCapabilityDescriptor`, `FedosAlgorithmDescriptor`,
`FedosBoundaryVersion`, `FedosBoundaryFeature`, and `FedosBoundaryPolicy`.
Unlike the operation-boundary types (which each report the status of ONE
future operation), these five describe the SHAPE of the boundary itself —
what it can eventually do, what algorithms it names, what version it is,
what design properties it has, and what a policy decision on it would be.
As of Stage 103, all five exist in
`packages/fedos-core-rust/src/lib.rs` as PUBLIC, label-only types.

## 1. Why these are metadata, not operations

`FedosRandomBoundary`/`FedosNonceBoundary`/etc. (Stage 103's
operation-boundary group) and `FedosCryptoBoundaryStatus` (Stage 102) each
answer "is this ONE operation available?" The five types this document
covers instead answer "what does this boundary, as a whole, look like?" —
a caller (or a future test, or a future audit consumer) inspecting the
boundary's shape without invoking any operation. Keeping this distinction
explicit avoids a common design drift where a "status" type slowly grows
unrelated descriptive fields until it is unclear whether calling it
performs an operation or just inspects one.

## 2. `FedosCapabilityDescriptor` — reusing, not replacing, Stage 69's capability list

`FEDOS_CORE_CAPABILITIES`/`fedos_core_capabilities()` (Stage 69) remains
UNCHANGED — a flat `&'static [&'static str]` list, part of this crate's
oldest public surface, and the TypeScript `FedosCoreCapability` union
still mirrors exactly that shape. `FedosCapabilityDescriptor` is a NEW,
additional, typed view over a similar concept (one label per capability,
paired with a state), covering the boundary groups Stage 102/103 added
that the Stage 69 string list was never updated to include. It does not
deprecate or replace the original list; both are expected to coexist
unless a future, explicitly-reviewed stage decides otherwise.

## 3. `FedosAlgorithmDescriptor` — pairing an algorithm with its category

`FedosCryptoAlgorithm` (Stage 102) already fixes the four algorithm
labels this crate names as future candidates. `FedosAlgorithmDescriptor`
adds exactly one piece of structure on top: which broad category (AEAD or
KDF) each belongs to, via `FedosAlgorithmCategory`. This is a direct,
intentional reuse of Stage 102's label vocabulary — not a new algorithm
decision, and not a guess at which candidate will eventually be
implemented.

## 4. `FedosBoundaryVersion` — a version marker for the boundary's shape

`FedosBoundaryVersion` (`major`/`minor`/`patch`, fixed at `1.0.0` this
stage) versions the SHAPE of the public boundary itself — the set of
types and functions Stage 102/103 fixed — not this crate's
`Cargo.toml` package version, not a cryptographic algorithm version, and
not a real negotiation mechanism a caller could use to request a
different shape. Its sole purpose is to give a future consumer (or a
future guard test) a single, fixed value to check that the boundary's
shape has not silently drifted between stages. Bumping it is expected to
be part of any future stage that changes the shape of an existing public
boundary type — this document does not fix a policy for exactly when
each version component increments, only that the marker exists.

## 5. `FedosBoundaryFeature` — flags about the design, not the algorithms

`FedosBoundaryFeature` (`PlaceholderOnly` / `AuditLabelOnly` /
`ErrorTaxonomyFixed` / `VersionedBoundary`) is deliberately NOT another
algorithm or capability list — `FedosCapabilityKind`/`FedosCryptoAlgorithm`
already cover that. Instead each variant restates, as a machine-checkable
label, one design constraint this crate's public API design record
(`docs/fedos_core_public_api_design.md`) already commits to in prose:
that every operation today is placeholder-only, that any future audit
record carries labels only, that any future error surfaces through a
fixed taxonomy, and that the boundary carries an explicit version marker.
A future guard test or consumer can check for one of these flags without
re-deriving the design record's prose meaning.

## 6. `FedosBoundaryPolicy` — a fixed decision, mirroring `audit_policy`

`FedosBoundaryPolicy` pairs a `FedosBoundaryPolicyKind` (which future
boundary — random, nonce, key generation, key import, key export, or the
Stage 102 crypto boundary — the decision concerns) with a fixed
`FedosBoundaryPolicyDecision`. Today the only decision value is
`DenyPlaceholder`, returned unconditionally by
`fedos_boundary_policy_decision(kind)` regardless of `kind` — the same
always-deny pattern the crate-private `audit_policy` skeleton (Stage 97)
already established internally, now surfaced on the public boundary. This
is NOT a real authorization system: no caller identity, no permission
model, and no configurable policy source exists anywhere in this crate.

## 7. What this stage implements

Nothing beyond five label-only types and their accessor functions,
summarized above; no numeric field beyond `FedosBoundaryVersion`'s fixed
`major`/`minor`/`patch` triple (itself a constant, not derived from
anything); no `Vec<u8>`, `String`, or secret byte anywhere; no connection
to the Runtime, the Worker, or a crypto provider.

## 8. Roadmap

1. Treat `FedosBoundaryVersion`'s `1.0.0` as the baseline; any future
   stage that changes an existing public boundary type's shape should
   bump it and record why, in this document or its successor.
2. Extend `FedosCapabilityDescriptor`/`FedosBoundaryFeature` as new
   boundary groups are added, keeping both lists an accurate mirror of
   what actually exists — never a superset advertising unbuilt behavior.
3. If a real authorization design is ever needed for `FedosBoundaryPolicy`
   to return a non-`DenyPlaceholder` decision, that design is its own,
   separately reviewed future stage — this document does not sketch one.
