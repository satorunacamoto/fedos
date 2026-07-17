# Review 09 — Draft vs. Active Conversation

## Option comparison, per this review's own required framing

**Option A — construction fails unless fully ready.** Every one of
`02`'s nine axes (encryption included) must resolve `true`/`"ready"`
before ANY durable write happens. Given `08`'s finding (encryption
readiness is unconditionally `"unavailable"` in this checked-out
tree), Option A means **no `private-group`/`direct` Conversation can
ever be constructed today, full stop** — an honest, verifiable, but
maximally conservative outcome.

**Option B — a durable draft record allowed.** Construction may
produce a Conversation record in an explicit, distinct
`lifecycleState: "draft"` when encryption readiness (axis 6) is the
ONLY failing axis, with every other axis (`identity`, `membership`,
`policy`, `capability`, `storage`, `retention`) genuinely ready. A
draft is durable, has an owner Membership, has a Policy — but is
explicitly NOT presented as message-capable. A later, separate
"activate" operation (out of this review's own construction-only
scope — a distinct future command) re-checks axis 6 and transitions
`draft → active` only when it newly resolves ready.

**Option C — active record with unavailable encryption.** Construct a
normal, `active`-looking Conversation record with no distinct
lifecycle field, despite encryption being unavailable, relying on
callers to separately check encryption status before trusting message
confidentiality. **REJECTED, per this review's own explicit
instruction.** This is precisely the shape that would let a caller
mistake "a Conversation object exists" for "messages sent through it
are protected" — the exact confusion `19`'s security-claims review
exists to prevent, and the exact failure mode `EncryptedPayloadDescriptor`'s
own header already guards against structurally ("NO payload byte...
of any kind exists").

**Option D — lazy activation.** Construction always succeeds
immediately (ignoring axis 6 entirely) and encryption readiness is
checked only at first-message-send time. **REJECTED** — this
defers the SAME Option-C risk to a later, less visible point (a
successfully "created" Conversation sitting in a caller's UI for
days before anyone attempts to send into it and discovers encryption
was never available), and it would make `04`'s/`05`'s own
`"created"` result carry a claim ("this Conversation is ready to use")
that Option D cannot actually back.

## Recommendation: Option B, with explicit, enforceable state semantics

```ts
export type FedosConversationLifecycleState = "draft" | "active";
```

Added as a NEW field this review recommends for a future Conversation
Record schema revision (a production source change, out of this
review's own scope to perform) — `lifecycleState` is set ONCE at
construction (`"active"` if all nine axes including encryption
resolved ready at that instant; `"draft"` if only axis 6 failed and
every other axis was ready) and is NEVER silently re-derived.
Transition `draft → active` requires an explicit, separate,
re-validated call (this review does not name or design that
operation's own command shape — it is future-Arc scope, per `20`) —
never an implicit background poll, matching this codebase's own
"no field without a writer" discipline
(`src/conversation/fedos_conversation_record.ts`'s own header, quoting
its rejection of a mutable `deleted` boolean for the identical
reason).

## No lifecycle state added without enforceable meaning

Per this review's own required constraint, `"draft"` is added ONLY
because it has a concrete, checkable meaning this review can point to
(axis 6 alone failing, verified against `08`'s own six sub-checks) —
not as a speculative placeholder. No third state (`"suspended"`,
`"archived"`, etc.) is proposed here; `16` covers revocation/leave
effects separately, and neither maps onto a NEW Conversation-level
lifecycle value this review can currently justify from real source.

## Consequence for V1

Given `08`'s finding that encryption readiness is unavailable
end-to-end, Option B's practical effect in THIS checked-out tree is
identical to Option B always producing `"draft"` — a private-group or
direct Conversation, if the Record/Policy validator blockers named in
`01`/`07` were also lifted by the next Arc, would today construct only
as a `"draft"`, never `"active"`. This is stated plainly, not
minimized: **this review does not manufacture a path to
`"active"` that does not honestly exist.**
