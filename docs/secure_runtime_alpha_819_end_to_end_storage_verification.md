# Secure Runtime Alpha 819 — End-to-End Storage Verification

Stage 29. `test/secure_runtime_alpha_819_end_to_end_storage_verification.test.ts`
exercises the REAL, durable append-only backends across a genuine
restart cycle, domain-local, using a REAL, unmodified `FedosConversationRecord`
(Alpha 748) as its own fixture.

## Verified

1. Create an existing, real public Conversation Record fixture via
   `validateFedosConversationRecord` (unmodified).
2. Store an opaque payload referencing that Conversation's real id.
3. Read an exact defensive copy — mutating the returned bytes does not
   affect a subsequent read.
4. Restart — fresh backend instances over the same durable paths.
5. Read again — state survived.
6. Tombstone.
7. Normal read denied (`{ outcome: "denied", state: "tombstoned" }`).
8. Remove local payload (the only allowed path: tombstoned →
   payload-removed).
9. Restart again.
10. State preserved — still denied, still `payload-removed`, never
    silently reactivated.

Also verified: a corrupt payload log fails closed at restart (never
silently drops/repairs); 100 payloads round-trip correctly through the
real backend (Alpha 817).

**This does not create a private message** — confirmed structurally,
the test's own final assertion: no file matching `/message|envelope/i`
exists anywhere under `src/conversation/payload_storage/`.
