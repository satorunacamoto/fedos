# Secure Runtime Alpha 576 — Structural Guards

Stage 16 of the Alpha 561–580 Publish Scheduler Concurrency Safety &
Abandonment Policy Arc.

## Guards added, all code-only (comments/doc-strings stripped, per this repository's own established `codeOnly()` convention)

`test/secure_runtime_alpha_576_structural_guards.test.ts` — 12 cases:

1. `tick()` is single-flight — `#tickInFlight`-shaped guard field
   exists and is read before starting a new pass.
2. The guard releases via `.finally(...)`, not any other path.
3. No `static #...` field and no `*lock*`/`*mutex*`-named module-level
   binding in either `fedos_publish_scheduler.ts` or
   `fedos_host_delivery_controller.ts` — every guard is a private
   INSTANCE field.
4. No Nostr/ActivityPub/AT Protocol/Session import (code, not comment)
   in the Scheduler or the new abandonment policy file.
5. No `p2p` reference anywhere in this Arc's own new/touched files.
6. No `.removeIntent(`/`.deleteIntent(` call — this Arc adds no Outbox
   deletion.
7. No Board-mutation identifier (`putPost`/`registerPost`/
   `previewRegistration`) in the Scheduler, Controller, or policy file.
8. The abandonment policy's own input shape is limited to exactly
   `outboxId`/`completedAttempts`/`latestOutcome`; no
   `NOTICE`/`stack`/`.message` reference anywhere in that file.
9. No new backoff/delay computation (`backoffMs`/`delayMs`/
   `retryAfter`/`Math.pow`/`Math.exp`/`exponential`) in any of this
   Arc's own new/touched files.
10. `FedosBoardOutboxPublisher`'s own interface (retry-policy union,
    `publish()` signature) is unchanged.
11. The abandonment policy file itself imports only sibling files under
    `src/board/outbox/` — the SAME guardrail the Scheduler itself
    already enforces, now also checked on its one new dependency.
12. The abandonment policy ships no default policy INSTANCE — only the
    contract and one explicitly-`maxAttempts`-parameterized example
    factory (see `docs/secure_runtime_alpha_566_abandonment_policy_decision.md`
    for why).

## Why regex-on-code-only, not regex-on-raw-source

An earlier draft of Alpha 575's own "no Nostr import" check regexed the
RAW source (including comments) and failed against this file's own
pre-existing JSDoc, which legitimately NAMES "Nostr" while explaining
what is absent — corrected during this Stage's own development to
mirror Alpha 512's `codeOnly()` precedent exactly, avoiding the same
false-positive class this repository has already worked around once
before.

## See also

- `docs/secure_runtime_alpha_512_security_regression_guards.md` (the `codeOnly()` precedent)
- `docs/secure_runtime_alpha_566_abandonment_policy_decision.md`
