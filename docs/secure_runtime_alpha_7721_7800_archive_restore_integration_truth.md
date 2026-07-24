# Secure Runtime Alpha 7721–7800 — Archive Restore Integration Truth (Phase H)

## The change, precisely

`src/conversation/archive/fedos_conversation_archive_restore.ts` gains
ONE new, OPTIONAL, additive dependency:

```ts
suppressionAuthority?: Pick<FedosArchiveSuppressionObservationAuthority, "evaluateSuppression">
```

`isPayloadPermittedForRestore()` (the SAME single shared helper both the
Envelope loop and the Payload loop already call — Phase N, structural
guard 6 proves exactly one definition plus two call sites, never a
second, disagreeing predicate) now checks, in order:

1. `feff676`'s own `retentionAuthority` gate — completely UNCHANGED.
2. **Only if `suppressionAuthority` was supplied**,
   `suppressionAuthority.evaluateSuppression(payloadId, "restore" |
   "envelope-restore")` — a SECOND, independent gate.

Either gate denying is sufficient to deny the record; both must permit
for a record to be written.

## Backward compatibility — proven, not assumed

When `suppressionAuthority` is omitted entirely, restore behavior is
**byte-for-byte identical** to `feff676`'s own behavior — proven directly
by `secure_runtime_alpha_7721_7800_archive_restore_integration.test.ts`
test 1 (both the Envelope and the Payload restore exactly as they did
before this Arc existed). Every existing caller of
`restoreFedosConversationArchiveBundle()` that does not pass this new
field is unaffected.

## What the suppression gate can see that Retention cannot

The suppression gate answers correctly even when the **restoring
Device's own local Retention log knows nothing about the deletion** —
proven directly (`archive_restore_integration.test.ts` test 2): an
imported suppression fact denies restore of BOTH the Envelope and the
Payload, even with a permissive stand-in `retentionAuthority` that
would otherwise allow everything. This is the entire point of this Arc:
Retention only knows what THIS Device decided locally; Suppression also
knows what a TRUSTED SIBLING Device decided and successfully propagated.

## What never happens

- **No metadata resurrection contrary to policy** — the suppression
  gate never reads a bundle-carried claim as more trustworthy than the
  restoring Device's own live state; it consults only its own local,
  durable `FedosArchiveSuppressionObservationAuthority`.
- **A `"device-evidence-invalid"` observation never suppresses anything**
  (`archive_restore_integration.test.ts` test 5) — a tampered or
  misattributed fact must never gain restore-suppression power, even
  though it is durably recorded for audit purposes.
- **An unrelated payload's restore is never affected** by a suppression
  fact for a different subject (test 4) — the gate is keyed precisely by
  `payloadId`, never a broader Conversation- or Board-scoped sweep.
- **Idempotent** — repeated restore of the same suppressed bundle stays
  denied, no partial state accumulates across repeated attempts (test 3).

## Restart safety

An imported suppression fact, once durably recorded via the file-backed
`AppendOnlyFedosArchiveSuppressionObservationPersistence`, survives a
literal object-recreation "restart" — proven in the real, no-mocks
Phase K vertical slice: a freshly-constructed
`FedosArchiveSuppressionObservationAuthority` over the SAME on-disk log
file still reports `"suppressed"` for the same payload with zero
hydration code (full `replayLog()` on every call, matching
`AppendOnlyFedosPayloadRetentionPersistence`'s own established
precedent).
