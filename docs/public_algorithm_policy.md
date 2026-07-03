# FedOS Core — Public Algorithm Policy Metadata Design (Stage 106)

`FedosCryptoAlgorithm` (Stage 102) fixed four algorithm candidate labels.
`FedosAlgorithmDescriptor` (Stage 103) paired each with a broad category
(AEAD/KDF). This document fixes three more label-only metadata types that
go one level deeper — what each algorithm would need as input, what it
would be capable of, and whether it is currently approved for real use —
without implementing any of the algorithms themselves. As of Stage 106,
`packages/fedos-core-rust/src/lib.rs` gains `FedosAlgorithmRequirement`,
`FedosAlgorithmCapability`, and `FedosAlgorithmPolicy` (each with a fixed
accessor function) that mirror the shapes described below. This remains
a design record, not an implementation.

## 1. Why three separate metadata dimensions

"What does this algorithm need," "what can this algorithm do," and "is
this algorithm currently allowed" are three different questions a future
implementation stage — or a future policy/audit consumer — might ask
independently. Requirements and capabilities are properties of the
algorithm itself (a `ChaCha20Poly1305` operation always needs a key and a
nonce, regardless of any policy decision); the policy decision is a
separate, mutable fact about what THIS crate currently permits, which is
expected to change over time as algorithms move from "not yet approved"
toward real implementation. Keeping the three separate means changing
the policy decision later never requires touching the requirement/
capability tables, and vice versa.

## 2. `FedosAlgorithmRequirement` — fixed relational table

A fixed list of `(algorithm, requirement)` pairs, reusing Stage 102's
`FedosCryptoAlgorithm` labels directly (an explicit, intentional reuse —
not a guess at a future design, since this table exists specifically to
describe those four algorithms). An algorithm needing more than one kind
of input (e.g. both a key and a nonce) appears as more than one row,
rather than trying to force multiple requirements into a single field.
The requirement labels themselves —
`RequiresKeyPlaceholder`/`RequiresNoncePlaceholder`/
`RequiresSaltPlaceholder`/`RequiresNoAdditionalInputPlaceholder` — name
categories of input, never a concrete byte length or format (that
remains `FedosKeyFormatLabel`'s and a future nonce-design document's
territory, not this one's).

## 3. `FedosAlgorithmCapability` — fixed relational table

A fixed list of `(algorithm, capability)` pairs, same shape as section 2.
The capability labels —
`AeadEncryptPlaceholder`/`AeadDecryptPlaceholder`/`KdfDerivePlaceholder`
— name what OPERATION an algorithm would eventually perform, distinct
from `FedosAlgorithmDescriptor`'s broader AEAD/KDF category (Stage 103):
a category says "this is an AEAD algorithm," while a capability says
"this specific algorithm would perform encryption and decryption" — a
finer-grained statement that stays meaningful even if a future AEAD
candidate only implements one direction.

## 4. `FedosAlgorithmPolicy` — a fixed approval decision

`FedosAlgorithmPolicy` pairs one `FedosCryptoAlgorithm` with a fixed
`FedosAlgorithmPolicyDecision`, returned by
`fedos_algorithm_policy_decision(algorithm)`. Today the only decision
value is `NotYetApprovedPlaceholder`, returned unconditionally regardless
of which algorithm is asked about — the same always-deny pattern Stage
103's `FedosBoundaryPolicy` and the crate-private `audit_policy` skeleton
(Stage 97) already established. This is NOT a real approval system: no
review record, no approver identity, and no configurable policy source
exists anywhere in this crate. When a future stage implements a real
algorithm, this document expects that stage to ALSO introduce a real
`ApprovedPlaceholder`-successor decision value for that specific
algorithm — this document does not pre-approve anything.

## 5. What this stage implements

Nothing beyond three fixed relational label tables and their accessor
functions (`fedos_algorithm_requirements()`,
`fedos_algorithm_capabilities()`, `fedos_algorithm_policy_decision()`).
No function validates a real requirement against real input, grants a
real capability, or approves a real algorithm for use. No raw byte,
owned string, or growable byte collection exists anywhere in this group.

## 6. Roadmap

1. Extend the requirement/capability tables as new algorithm candidates
   are added to `FedosCryptoAlgorithm` in a future stage — keeping both
   tables an accurate mirror of what actually exists, never a superset
   advertising unbuilt behavior (the same principle
   `docs/public_boundary_versioning.md` section 8 already states for
   `FedosBoundaryFeature`).
2. When a real algorithm is implemented, introduce a real approval
   decision value for that specific algorithm as part of THAT
   implementation stage's own review — never pre-approved here.
3. If a real authorization design is ever needed to check requirements
   against real input at call time, that design is its own, separately
   reviewed future stage — this document does not sketch one.
