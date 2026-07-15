# Secure Runtime Alpha 551 — Retry Semantics Audit

Stage 11 of the Alpha 541–560 Publish Runtime Operational Review Arc.
Review only.

## The rule, restated precisely from source

`#attemptIntent()` (`fedos_publish_scheduler.ts:172-197`):

1. Attempt once. If the result is `"delivered"`, stop — mark delivered.
2. If NOT delivered and `retryPolicy === "immediate"`, attempt ONCE
   more, same `tick()` call.
3. If that SECOND attempt is ALSO `"immediate"`, it is downgraded to
   `"later"` before being acted on.
4. If the (possibly downgraded) final result has `retryPolicy === "never"`,
   mark abandoned.
5. Otherwise (`"later"`), the intent simply stays pending for the NEXT
   `tick()` — no delay computed, no backoff, cadence is `intervalMs`
   alone.

## Verified: the guardrail bounding `tick()` to at most two `publish()` calls per intent holds

`test/secure_runtime_alpha_551_...test.ts` §1 exercises a Publisher
that ALWAYS returns `{ outcome: "failed", retryPolicy: "immediate" }`
against a real `tick()` call and confirms `publish()` is called EXACTLY
twice for that one intent within that one `tick()` — never three times,
regardless of how many times `"immediate"` is returned — confirming the
downgrade-after-one-retry rule holds exactly as documented, not merely
as claimed.

## Edge case found: `"immediate"` on a `"delivered"` outcome is silently ignored, correctly, but undocumented as a case

If a Publisher returns `{ outcome: "delivered", retryPolicy: "immediate" }`
— a malformed-but-structurally-valid combination `isValidFedosBoardOutboxPublishResult`
does not reject (the guard checks only that BOTH fields are individually
valid members of their own vocabulary, never that the PAIR is a sensible
combination) — the Scheduler's own `if (result.outcome !== "delivered" && ...)`
check on line 179 means the `retryPolicy` value is simply never consulted
once `outcome === "delivered"`. This is SAFE (no double-attempt on an
already-successful delivery) but relies on outcome being checked FIRST,
a fact confirmed by reading the conditional's own short-circuit order,
not something the type system enforces — a Publisher author could
misread the contract and reasonably (but wrongly) assume any
`retryPolicy` value is meaningful regardless of `outcome`.
`test/secure_runtime_alpha_551_...test.ts` §2 confirms this exact
combination is handled safely today.

## Edge case: a malformed/thrown result maps to a FIXED `{ failed, later }`, never `"never"`

`FAILED_LATER_RESULT` (`fedos_publish_scheduler.ts:91`) is the sole
fallback for a thrown `publish()` call OR a structurally invalid return
value. This means a Publisher that crashes is ALWAYS retried
indefinitely (never abandoned) — there is no "give up after N crashes"
policy anywhere in this Scheduler. Combined with Alpha 547's own
finding (`#delivered`/`#abandoned` never shrink, `#observationLog`
never trims), **a permanently-crashing Publisher for one specific
intent produces unbounded `attempt-started`/`failed` Observation pairs,
one per `tick()`, forever**, for the lifetime of the process — a
concrete instance of the memory-growth pattern Alpha 547 named in the
abstract, now given a specific triggering condition.

## No exponential backoff exists, confirmed, matching design intent

Re-confirmed: no `Date.now() + delay`-shaped computation anywhere in
`fedos_publish_scheduler.ts` — cadence is `intervalMs` alone, per Alpha
474's own explicit design ("no exponential backoff or scheduled-delay
computation anywhere in this file"). This Arc finds no deviation from
that stated design — a genuinely clean spot, restated for completeness
rather than left implicit.

## See also

- `docs/secure_runtime_alpha_474_retry_policy_model.md`
- `docs/secure_runtime_alpha_547_publish_runtime_memory_audit.md`
- `docs/secure_runtime_alpha_549_publish_runtime_thread_safety_audit.md`
