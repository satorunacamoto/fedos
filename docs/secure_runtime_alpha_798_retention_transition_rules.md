# Secure Runtime Alpha 798 — Retention Transition Rules

Stage 8. Enforced by `FedosPayloadRetentionAuthority`, never by either
port (a port has no concept of "current state," only of individual
records):

```
active → tombstoned            ALLOWED  (tombstonePayload)
tombstoned → payload-removed   ALLOWED  (removeLocalPayload)

payload-removed → active       FORBIDDEN
payload-removed → tombstoned   FORBIDDEN
tombstoned → active            FORBIDDEN
active → payload-removed       NOT A NAMED TRANSITION (removeLocalPayload requires tombstoned first)
```

Every forbidden or unnamed transition surfaces `{ outcome: "conflict" }`
— reusing the existing outcome (Alpha 797) rather than inventing a
ninth token.

**No restore method exists, of any kind** — confirmed structurally
(`test/secure_runtime_alpha_799_payload_retention_authority.test.ts`
item 10: no `restorePayload`/`untombstonePayload`/anything matching
`/restore|reactivate|undelete/i` anywhere in
`FedosPayloadRetentionAuthority`'s own public surface). This Arc's own
instruction — "Do not implement restore unless there is a reviewed
source of retained bytes" — applies directly: no such reviewed source
exists (no backup system, Alpha 791 finding 7), so no restore path is
built, not even a stub.
