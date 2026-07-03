# FedOS Core — Public Capability Matrix (Stage 106)

By Stage 106 this crate's public boundary carries seven distinct
label/metadata groups, added across five stages, each answering a
different question about the boundary's future shape. This document is a
map between them — which group answers which question — so a reader (or
a future stage) does not have to re-derive the distinction from the
individual design docs. It records no new design decision of its own;
`docs/fedos_core_public_api_design.md`,
`docs/public_boundary_versioning.md`, `docs/public_key_usage.md`, and
`docs/public_algorithm_policy.md` remain the authoritative records for
each group's own rationale.

## The seven groups

| # | Group | Question it answers | Type(s) | Function(s) | Stage |
| --- | --- | --- | --- | --- | --- |
| 1 | Capability | Which broad capabilities does this boundary enumerate? | `FedosCapabilityKind`, `FedosCapabilityDescriptor` | `fedos_capability_descriptors` | 103 |
| 2 | Feature | What design properties does this boundary itself have? | `FedosBoundaryFeature` | `fedos_boundary_features` | 103 |
| 3 | Policy (boundary) | Is a given boundary operation currently permitted? | `FedosBoundaryPolicyKind`, `FedosBoundaryPolicyDecision`, `FedosBoundaryPolicy` | `fedos_boundary_policy_decision` | 103 |
| 4 | Version | What version is the shape of this boundary at? | `FedosBoundaryVersion` | `fedos_boundary_version` | 103 |
| 5 | Format | What shape is a key? | `FedosKeyFormatLabel`, `FedosKeyFormatState`, `FedosKeyFormatStatus`, `FedosKeyFormatDescriptor` | `fedos_key_format_descriptor_placeholder` | 105 |
| 6 | Usage | What is a key allowed to be used for? | `FedosKeyUsageLabel`, `FedosKeyUsageState`, `FedosKeyUsageStatus`, `FedosKeyUsageDescriptor` | `fedos_key_usage_descriptor_placeholder` | 106 |
| 7 | Algorithm | What does an algorithm need, what can it do, and is it approved? | `FedosAlgorithmDescriptor`/`FedosAlgorithmCategory` (103); `FedosAlgorithmRequirement`, `FedosAlgorithmCapability`, `FedosAlgorithmPolicy` (106) | `fedos_algorithm_descriptors` (103); `fedos_algorithm_requirements`, `fedos_algorithm_capabilities`, `fedos_algorithm_policy_decision` (106) | 103, 106 |

## How to tell them apart

- **Capability vs. Feature** — Capability lists WHAT this boundary can
  eventually do (encrypt, derive a key, generate randomness, ...);
  Feature lists properties of the boundary's own DESIGN (placeholder-only
  today, audit records carry labels only, ...). A capability could in
  principle be removed if a candidate operation were dropped; a feature
  describes an invariant that is expected to hold regardless of which
  operations exist.
- **Policy vs. Version** — Policy is a decision that can change over
  time as real implementation lands (today, always deny); Version is a
  marker for the SHAPE of the types themselves, bumped only when an
  existing public type's shape changes (`docs/public_boundary_versioning.md`
  section 4).
- **Format vs. Usage** — Format is about the BYTES (what shape is this
  key); Usage is about PERMISSION (what is this key for). See
  `docs/public_key_usage.md` section 1 for the full reasoning.
- **Algorithm requirement/capability vs. algorithm policy** — Requirement
  and capability are fixed FACTS about an algorithm (it always needs a
  nonce, it would always perform AEAD encryption); policy is a decision
  this crate currently makes about that algorithm (not yet approved) —
  see `docs/public_algorithm_policy.md` section 1.

## What this document is not

This is not a new design surface, not an implementation, and not an
authorization system. It adds no new Rust type — every type it
references already exists as of Stage 103/105/106. It exists purely to
make the seven-group structure legible in one place before any
implementation stage begins.
