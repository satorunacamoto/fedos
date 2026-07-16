# Secure Runtime Alpha 792 — Deletion Meaning Vocabulary

Stage 2. `src/conversation/retention/fedos_payload_retention_state.ts`
names eight distinct meanings "deleted" can honestly carry — never one
generic boolean, matching this Arc's own explicit instruction and the
Security review's own identical 8-meaning framework
(`docs/reviews/private_conversation_security/08_deletion_retention.md`).

| Meaning | V1 enforceable? | Why |
|---|---|---|
| `application-hidden` | **Yes** | `FedosPayloadRetentionAuthority.readPayload()` denies normal reads once tombstoned/removed. |
| `access-revoked` | No | No Membership authority exists anywhere in this codebase to revoke access from. |
| `logically-tombstoned` | **Yes** | A durable `FedosPayloadRetentionDecision` record (Alpha 795). |
| `local-payload-removed` | **Yes, with an honest limit** | An access-state transition, not a guaranteed physical byte removal — see Alpha 799/811. |
| `compacted-from-active-log` | No | This Arc's own Absolute Prohibition forbids automatic compaction. |
| `cryptographically-erased` | No | No encryption/key lifecycle exists in this Arc's scope. |
| `remotely-deleted` | No | No Publisher/Relay delivery of private content exists. |
| `removed-from-backup` | No | No backup system exists anywhere in this codebase. |

Only the three V1-enforceable meanings are implemented; the other five
are named for vocabulary completeness and future traceability only —
no code anywhere in this Arc claims to implement them (verified,
`test/secure_runtime_alpha_795_payload_retention_decision.test.ts`
items 1–3).
