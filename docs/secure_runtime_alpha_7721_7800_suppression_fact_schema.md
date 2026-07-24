# Secure Runtime Alpha 7721–7800 — Suppression Fact Schema (Phase C)

## What a `FedosArchiveSuppressionFact` is

The minimum durable, authenticated claim an authorized Device needs in
order to know that a specific payload must not be restored from an older
Archive. It is **never** a claim that any other Device physically erased
anything, and **never** a claim that every Device on the account has
received it. Source: `src/conversation/retention/fedos_archive_suppression_fact.ts`.

```ts
interface FedosArchiveSuppressionFact {
  readonly schemaVersion: 1;
  readonly factId: string;               // deterministic, see below
  readonly accountRef: FedosDeviceBindingAccountRef;
  readonly sourceDeviceId: string;       // the Device that made this decision
  readonly subjectType: "payload";       // V1: only "payload" exists
  readonly subjectRef: FedosConversationPayloadId;
  readonly suppressionMeaning: FedosArchiveSuppressionMeaning;
  readonly revision: number;             // per-(subjectRef, sourceDeviceId) monotonic counter
  readonly decidedAt: number;            // unix seconds, ORIGINATING device's own clock
  readonly nonce: string;                // 128-bit hex, signature-layer replay binding
}
```

Ten fields total. `validateFedosArchiveSuppressionFact()` rejects any
candidate whose key count is not exactly 10 — a field cannot be silently
added or dropped without both the type and the validator changing
together.

## `suppressionMeaning` — closed vocabulary

```
"suppress-payload-restore"    -- the Payload bytes must not be written back.
"suppress-envelope-restore"   -- the Envelope record must not be written back.
"suppress-search-reindex"     -- Search must not re-index this subject.
"preserve-minimal-tombstone"  -- reserved for a future Arc; not consumed anywhere yet.
```

An unrecognized string fails closed to `null` at both construction
(`createFedosArchiveSuppressionFact`) and parse time
(`validateFedosArchiveSuppressionFact`) — there is no "unknown but
tolerated" branch anywhere in this domain.

## Why `subjectType` is `"payload"` only

Envelope suppression is expressed as a *second fact* over the **same**
`subjectRef` (the payload id) with `suppressionMeaning:
"suppress-envelope-restore"`, mirroring how `feff676`'s own restore gate
already keys Envelope permission off `payloadId` rather than a second,
Envelope-specific identifier. This avoids inventing a parallel identifier
scheme for a concept (Envelope) that already borrows its identity from
its Payload in every adjacent domain (Retention, Archive collector).

## `factId` — deterministic identity

```ts
factId = `${accountRef.authority}::${accountRef.publicIdentifier}::${sourceDeviceId}::${subjectRef}::${suppressionMeaning}::${revision}`
```

Two logically identical facts always produce the identical id. Note that
`decidedAt` and `nonce` are **not** part of the id — this is deliberate:
it is what makes the Phase M "conflicting duplicate" scenario
(two different facts sharing one factId) representable and detectable at
all (`FedosArchiveSuppressionObservationAuthority#tryRecord()` returns
`"conflict"` in that case, never a silent overwrite).

## `revision` — the conflict/rollback axis

A per-`(subjectRef, sourceDeviceId)` monotonic counter — the originating
Device's own count of suppression decisions for that subject, **not** a
wall-clock value (Device clocks are not assumed synchronized). This
mirrors Identity Transition's own rollback rule
(`candidate.revision <= maxRevisionSoFar` → rejected) without that
domain's heavier predecessor-chain/cycle-detection machinery, which a
flat suppression fact has no lineage to justify. See
`secure_runtime_alpha_7721_7800_durable_ownership_and_conflict_model.md`
for the full recording semantics.

## Canonical bytes — what a signature covers

`fedosArchiveSuppressionFactCanonicalBytes()` produces fixed-field-order
JSON (`schemaVersion`, `factId`, `accountRef`, `sourceDeviceId`,
`subjectType`, `subjectRef`, `suppressionMeaning`, `revision`,
`decidedAt`, `nonce`) — the exact bytes any Device-evidence signature
(Phase D) is computed over. Field order is frozen; changing it would
silently invalidate every previously-issued Device-evidence signature.
This is a **separate, narrower** signature layer than the outer Nostr
event signature (Phase G) — see the authentication/evidence model doc.

## What this schema deliberately excludes

No message content, ciphertext, sender/recipient display data, Archive
path, Search token, Ratchet/session key, Master Seed, private key,
SecretHandle, or free-form reason string anywhere in this type. Every
field is either a public routing fact or an opaque, non-secret
identifier already exposed by Retention/Archive today.
