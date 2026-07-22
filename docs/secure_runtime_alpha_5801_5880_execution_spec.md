# Secure Runtime Alpha 5801–5880 — Execution Specification

**FedOS Identity Transition Types, Validation, and Durable Evidence
Foundation Arc.**

See [reconciliation report](secure_runtime_alpha_5801_5880_reconciliation_report.md)
for Phase A. See [schema document](secure_runtime_alpha_5801_5880_transition_evidence_schema.md)
for the full type/field reference.

## Scope

A standalone, additive, non-network domain at
`src/conversation/identity_transition/` implementing types, structural
validation, canonical serialization, real-signature evidence
verification, a pure evidence-evaluation decision layer, durable
append-only facts, local acceptance state, and two read-only impact
plans — for a Replacement-model identity transition, per
`docs/reviews/fedos_account_nostr_identity_rotation_v1/20_normative_recommendation.md`.

No live account/Nostr identity is ever replaced by this Arc. No Device
Registry, Conversation Membership, Ratchet session, Archive, or Search
state is mutated.

## Phases implemented

- **B — Closed vocabularies**: `fedos_identity_transition_vocabulary.ts`.
  Transition type (2 values), reason category (6 values, 2 of which are
  "compromise" reasons with special evaluation treatment), evidence kind
  (6 values, including a reserved-but-never-produced
  `"master-seed-authority"`), evidence status (9 values, deliberately not
  a boolean), Device policy (1 value: `"rebind-required"`), Ratchet
  policy (1 value: `"reset-required-no-rebind"`).
- **C — Transition record**: `fedos_identity_transition_record.ts`. Exact
  field set, closed vocab everywhere applicable, `authority === "nostr"`
  required for both identities (the only mapping this repo's architecture
  supports today), `revision === 0 <=> previousTransitionId === null`,
  integer timestamps, bounded identifier length (256 chars),
  bounded revision (1,000,000 ceiling).
- **D — Canonical serialization**: `fedos_identity_transition_canonical.ts`.
  Four domain-separated fixed-order-array preimages (body, new-key proof,
  continuity proof, Device corroboration proof), each binding
  `transitionId` + `revision` + the body's own sha256 `bodyHash` — any
  body-field mutation invalidates every attached proof.
- **E — Transition identity**: `fedos_identity_transition_id.ts`. 128-bit
  CSPRNG id (`@noble/hashes` `randomBytes`), never derived from the
  reason or any other field.
- **F — New-key proof of possession**: `fedos_identity_transition_new_key_proof.ts`.
  Real BIP-340 Schnorr verification (`@noble/curves`), binds old+new
  identity + transitionId + revision + bodyHash. Verifies only; never
  signs.
- **G — Old-identity continuity evidence**: `fedos_identity_transition_continuity_evidence.ts`.
  Returns only `"cryptographically-valid" | "rejected" | "unverifiable"`
  — never an acceptance-flavored status; the compromise-reason limitation
  is enforced exclusively by the evaluator (Phase I), not here.
- **H — Device corroboration**: `fedos_identity_transition_device_corroboration.ts`.
  Requires a real, already-loaded `FedosDeviceBindingV1` bound to the OLD
  account, `"trusted"`, not revoked, with a matching `devicePublicKeyRef`
  — an unknown/untrusted/revoked/wrong-account Device fails closed to
  `"unverifiable"` regardless of signature validity.
- **I — Evidence evaluation**: `fedos_identity_transition_evidence_evaluation.ts`.
  Pure function, 14-value closed outcome. Enforces both hard invariants
  from this Arc's own Absolute Prohibitions (see Verification below).
- **J — Durable transition facts**: `fedos_identity_transition_fact.ts` +
  `fedos_identity_transition_fact_conflict_detection.ts` + `persistence/`
  (in-memory and append-only NDJSON backends). Safe facts only — no raw
  evidence, no signatures, no keys. `conflictState` is always `"none"` on
  a fact this Arc inserts (a conflicting/rollback/cyclic write is
  REJECTED, never inserted with an advisory marker — see schema doc for
  why this differs from a naive reading of "conflict state" as a stored
  field); `supersededByTransitionId` is always `null` on a stored fact —
  supersession is derived at read time by `isFedosIdentityTransitionFactSuperseded()`,
  never backfilled onto an older row (this Arc never rewrites an
  already-inserted fact).
- **K — Peer acceptance state**: `fedos_identity_transition_acceptance_state.ts`.
  A pure projection of the evidence outcome plus at most one explicit
  local decision. `"rejected"|"conflicting"|"stale"|"superseded"|"rollback-detected"`
  are final — no explicit decision can promote them to acceptance.
- **L — Ratchet impact planning**: `fedos_identity_transition_ratchet_impact_plan.ts`.
  Read-only descriptive DTO; `actionable` is `true` only once the
  transition's acceptance state is `"accepted"`. Nothing here imports or
  mutates any live Ratchet/Device/Outbox state.
- **M — Conversation/Archive/Search plan**: `fedos_identity_transition_downstream_plan.ts`.
  Read-only descriptive DTO; imports nothing from `membership/`,
  `archive/`, or `search/`.
- **N — Safe status facade**: `fedos_identity_transition_facade.ts` +
  `fedos_identity_transition_safe_status.ts`. The sole entry point;
  `createTransitionDraft` / `validateTransition` /
  `verifyNewIdentityProof` / `addContinuityEvidence` /
  `addDeviceCorroboration` / `evaluateTransitionEvidence` /
  `persistTransition` / `recordLocalDecision` / `inspectTransition` /
  `planTransitionImpact`. Every method returns `null` (never throws) once
  `stop()` has been called.
- **O — Real vertical slice**:
  `test/secure_runtime_alpha_5801_5880_real_vertical_slice.test.ts`. Two
  real independent Schnorr identities; real new-key proof; real
  old-key continuity signature; real Device corroboration; persisted;
  restarted (new persistence instance, same file); idempotent duplicate
  import; conflicting-duplicate rejection; rollback and broken-predecessor
  rejection; competing-transition conflict detection; read-only Ratchet
  impact plan; explicit local decision promotes evidence to acceptance;
  proof that no private key or `secretKey`/`privateKey` marker ever
  appears in the durable file.
- **P — Failure matrix**: split across
  `..._identity_transition_types.test.ts`,
  `..._identity_transition_evidence.test.ts`,
  `..._identity_transition_persistence.test.ts`, and
  `..._failure_matrix.test.ts` (schema-version/size/unsupported-mapping/
  resource-limit/stopped-facade cases not covered elsewhere).
- **Q — Structural guards**:
  `test/secure_runtime_alpha_5801_5880_structural_guards.test.ts`. Proves
  zero imports from Transport/Archive/Search/Sync-journal/Electron-Desktop
  or any live signing/Master-Seed/Ratchet-mutation authority; no new
  crypto dependency; `node:fs` confined to the one append-only backend;
  no automatic-mutation value in either closed policy vocabulary; no file
  under `p2p/` or `.tmp_gen/`.

## Structural exclusions honored (Phase Q / Absolute Prohibitions)

No in-place account/Nostr key rotation, no Master Seed replacement, no
passphrase rotation, no live profile migration, no private transport
delivery, no NIP event publication, no new NIP kind, no public rotation
event, no automatic peer acceptance, no automatic Device Registry rebind,
no automatic Conversation membership rewrite, no automatic Ratchet reset,
no root/chain key rebinding, no historical event/Archive rewriting, no
Search history merging, no Group identity transition, no multi-Device
quorum, no recovery-code system, no Electron/Shell/UI command, no remote
deletion, no new cryptographic primitive, no `p2p/` or `.tmp_gen/` change.

## Verification performed

`npm run typecheck:core` clean for every new file (2 pre-existing
baseline errors remain, both in unrelated, unmodified test files —
`secure_runtime_alpha_4741_4820_production_master_seed_activation.test.ts`
and `secure_runtime_alpha_477_scheduler_lifecycle_model.test.ts`).

Targeted suites run and passing: account/Nostr signing
(`secure_runtime_alpha_690_nostr_signing_public_author_authority`),
Device Binding/Registry
(`secure_runtime_alpha_2421_2500_device_binding_and_registry`,
`secure_runtime_alpha_2921_3000_device_trust_runtime_integration`),
Ratchet Session Reset
(`fedos_ratchet_device_lifecycle_session_reset_foundation_unit`), Peer
Capability
(`secure_runtime_alpha_5721_5800_capability_and_lifecycle_unit`),
existing structural exclusion guards
(`secure_runtime_alpha_5401_5480_structural_exclusion_guards`,
`secure_runtime_alpha_5721_5800_structural_guards`) — all pass unchanged.

Full `npx vitest run`: 836 files / 13,591 tests passing, 216 files / 301
tests failing — every failure inspected is the documented pre-existing
missing-WASM-artifact class (`test/fedos_core_rust_*`,
`test/runtime_wasm_*`, Cargo.toml/lib.rs raw-import assertions) or one of
the two pre-existing baseline TypeScript errors above; none of this Arc's
own 6 new test files fail. No `pkg/`/`target/`/`Cargo.lock` was ever
generated in this worktree, so no cleanup step was required.

## Next Arc

**FedOS Identity Transition Peer Notification and Ratchet Reset
Integration Arc** — wires an accepted transition's read-only impact plan
into the live Session Reset authority (`f80889d`) and Private Transport
(reusing `d825aa0`'s existing Gift Wrap pipeline, new additive fact
kinds only, no new Nostr kind), and defines the actual peer-notification
delivery this Arc deliberately left unimplemented.
