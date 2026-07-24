# Secure Runtime Alpha 5801–5880 — Transition/Evidence Schema Reference

All types live under `src/conversation/identity_transition/`.

## Closed vocabularies (`fedos_identity_transition_vocabulary.ts`)

| Vocabulary | Values |
|---|---|
| `FedosIdentityTransitionType` | `identity-replacement`, `continuity-claim` (reserved, unimplemented evaluation path) |
| `FedosIdentityTransitionReasonCategory` | `key-compromise-suspected`, `key-compromise-confirmed`, `identity-lost`, `recovery-unavailable`, `user-initiated-replacement`, `implementation-migration` |
| `FedosIdentityTransitionEvidenceKind` | `old-identity-signature`, `new-identity-proof-of-possession`, `authorized-device-corroboration`, `manual-peer-verification`, `master-seed-authority` (reserved, never produced), `unavailable` |
| `FedosIdentityTransitionEvidenceStatus` | `absent`, `structurally-valid`, `cryptographically-valid`, `corroborated`, `locally-accepted`, `rejected`, `stale`, `conflicting`, `unverifiable` |
| `FedosIdentityTransitionDevicePolicy` | `rebind-required` (only value) |
| `FedosIdentityTransitionRatchetPolicy` | `reset-required-no-rebind` (only value) |

## `FedosIdentityTransitionRecordV1` (`fedos_identity_transition_record.ts`)

The signed-over body. Contains no secret material.

| Field | Type | Notes |
|---|---|---|
| `schemaVersion` | `1` | |
| `transitionId` | `string` | `fedos-identity-transition-<32 hex>`, CSPRNG-generated |
| `transitionType` | `FedosIdentityTransitionType` | |
| `oldAccountIdentity` / `newAccountIdentity` | `FedosDeviceBindingAccountRef` | `authority` MUST be `"nostr"` |
| `oldNostrIdentity` / `newNostrIdentity` | `string` (64 hex) | MUST equal the corresponding account ref's `publicIdentifier` |
| `reasonCategory` | `FedosIdentityTransitionReasonCategory` | |
| `issuedAt` / `expiresAt` | `number` (integer Unix seconds) | `expiresAt > issuedAt` |
| `revision` | `number` (0..1,000,000) | `0 <=> previousTransitionId === null` |
| `previousTransitionId` | `string \| null` | forms the lineage's predecessor chain |
| `devicePolicy` | `"rebind-required"` | fixed by the producer, never caller-suppliable |
| `ratchetPolicy` | `"reset-required-no-rebind"` | fixed by the producer |
| `capabilityVersion` | `1` | |

## Canonical preimages (`fedos_identity_transition_canonical.ts`)

Each is `sha256(JSON.stringify([domainTag, ...fields]))`, fixed field
order, never object-property iteration:

- `fedos:identity-transition:body:v1` → `bodyHash`
- `fedos:identity-transition:new-key-proof:v1` → binds `transitionId`, `revision`, `bodyHash`, old+new Nostr identity, `issuedAt`, `expiresAt`
- `fedos:identity-transition:continuity-proof:v1` → same binding
- `fedos:identity-transition:device-corroboration:v1` → binds `transitionId`, `revision`, `bodyHash`, new Nostr identity, `deviceId`, `issuedAt`, `expiresAt`

## Evidence artifacts

- `FedosIdentityTransitionNewKeyProofV1` (Phase F) — signed by the NEW
  identity's key. `verifyFedosIdentityTransitionNewKeyProof()` → `boolean`.
- `FedosIdentityTransitionContinuityEvidenceV1` (Phase G) — signed by the
  OLD identity's key. `verifyFedosIdentityTransitionContinuityEvidence()`
  → `"cryptographically-valid" | "rejected" | "unverifiable"` only.
- `FedosIdentityTransitionDeviceCorroborationV1` (Phase H) — signed by an
  authorized Device's own signing key, verified against a caller-supplied
  `FedosDeviceBindingV1`. `verifyFedosIdentityTransitionDeviceCorroboration()`
  → `"cryptographically-valid" | "rejected" | "unverifiable"` only.

## `FedosIdentityTransitionEvidenceOutcome` (Phase I, 14 values)

`invalid`, `new-key-unproven`, `continuity-unproven`,
`continuity-old-key-only`, `device-corroborated`,
`manual-verification-required`, `locally-acceptable`, `rejected`, `stale`,
`rollback-detected`, `conflicting`, `superseded`, `unsupported`,
`unavailable`.

Priority order inside `evaluateFedosIdentityTransitionEvidence()`:
structural validity → transitionType support → history-derived facts
(rollback/conflicting/superseded/stale) → timestamp window → new-key
proof → manual-verification override → continuity/Device combination.

## `FedosIdentityTransitionFactV1` (Phase J, `fedos_identity_transition_fact.ts`)

The durable record. Safe facts only.

| Field | Notes |
|---|---|
| `transitionId`, `bodyHash` | |
| `oldAccountIdentity`, `newAccountIdentity`, `oldNostrIdentity`, `newNostrIdentity` | public identities only |
| `revision`, `previousTransitionId` | |
| `evidenceOutcome` | the Phase I result recorded at persist time |
| `conflictState` | `"none" \| "conflicting" \| "rollback-detected"` — **always `"none"` on any fact this Arc actually inserts**; a conflicting/rollback/cyclic write is rejected outright by `putFact()` rather than inserted with an advisory marker. The other two values remain in the closed vocabulary for a future Arc that may want to record an ADVISORY (non-blocking) conflict observation without changing this Arc's own insert-time fail-closed guarantee. |
| `supersededByTransitionId` | **always `null` on a stored fact** — see below |
| `recordedAt` | |

Keyed by `transitionId` alone. One **lineage** = all facts sharing the
same `oldAccountIdentity`
(`fedosIdentityTransitionLineageKey()`/`...Parts()`).

`determineFedosIdentityTransitionFactWriteOutcome()`
(`fedos_identity_transition_fact_conflict_detection.ts`) is the single
pure authority both persistence backends call:

| Write outcome | When |
|---|---|
| `inserted` | fresh, valid, non-conflicting fact |
| `already-present` | same `transitionId`, structurally identical fact (idempotent replay) |
| `conflict` | same `transitionId` with different content; OR two revision-0 facts in one lineage; OR two different facts naming the same `previousTransitionId` |
| `broken-predecessor` | `previousTransitionId` not found in the lineage, or found but its own revision isn't exactly `revision - 1` |
| `rollback-detected` | candidate's `revision` ≤ the lineage's current max revision |
| `cycle-detected` | walking the predecessor chain revisits an already-seen `transitionId` |
| `failed` | I/O failure (append-only backend only) |

`isFedosIdentityTransitionFactSuperseded(fact, lineageFacts)` — pure
query, `true` iff another fact in the same lineage has a strictly higher
revision. Never stored; always recomputed.

## `FedosIdentityTransitionAcceptanceState` (Phase K, 11 values)

`observed`, `structurally-valid`, `proof-verified`, `corroborated`,
`manual-review-required`, `accepted`, `rejected`, `conflicting`, `stale`,
`superseded`, `rollback-detected`. The last five are final — no explicit
local decision can override them.

## Read-only plans (Phase L/M)

`FedosIdentityTransitionRatchetImpactPlanV1` and
`FedosIdentityTransitionDownstreamPlanV1` — pure descriptive DTOs,
`actionable`/consequence booleans plus a human-readable `notes` array.
Neither imports nor mutates any live Ratchet, Device, Conversation,
Archive, or Search state.

## Safe status DTO (Phase N, `fedos_identity_transition_safe_status.ts`)

`FedosIdentityTransitionSafeStatusV1` — `transitionId`, `revision`,
`previousTransitionId`, both public account identities, `evidenceOutcome`,
`acceptanceState`, `superseded`. No raw evidence, signatures, keys, or
filesystem paths.
