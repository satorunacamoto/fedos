# Secure Runtime Alpha 223 — FedosSubscriptionFilter (Filter
Representation)

**Status: this Stage IMPLEMENTS. It adds exactly one new file,
`src/desktop/fedos_subscription_filter.ts`. This is Stage 3 of the
Alpha 221–230 Nostr Subscription Foundation Arc, following Alpha 222's
own `FedosSubscription` handle.**

## 1. Why now

`buildReqMessage` (Alpha 224) needs a typed filter shape to accept and
serialize before it can exist. This Stage builds that shape first,
matching this Arc's own "type first, behavior in a later Stage"
sequencing already used for `FedosSubscription` → `subscribe()`
(Alpha 222 → 226).

## 2. What was implemented

```ts
export interface FedosSubscriptionFilter {
  readonly ids?: readonly string[];
  readonly authors?: readonly string[];
  readonly kinds?: readonly number[];
  readonly since?: number;
  readonly until?: number;
  readonly limit?: number;
}
```

Six OPTIONAL, `readonly` fields — every field may be omitted, and an
empty `{}` is a structurally valid filter (NIP-01 itself permits a
filter matching everything).

## 3. "Minimum NIP-01 fields only" — the scope decision, explained

This Arc's own Alpha 223 instruction states plainly: "Implement Filter
representation. Support the minimum NIP-01 fields only." NIP-01's own
REQ filter object supports two kinds of field: six SCALAR/ARRAY fields
that every relay implementation understands identically (`ids`,
`authors`, `kinds`, `since`, `until`, `limit`), and an OPEN-ENDED
generic single-letter tag-filter mechanism (`#e`, `#p`, and any other
`#<letter>` a relay chooses to index). The six scalar/array fields are
this Stage's own entire deliverable; the generic tag-filter mechanism
is DELIBERATELY EXCLUDED — it is an extension layered on top of the
six-field core, not part of the "minimum" this Stage's own instruction
names, and it introduces an open-ended key space (`#e`, `#p`, `#t`, ...)
this Stage's own minimal scope has no reason to commit to yet.

This is an ADDITIVE decision, not a permanent one: a future Stage could
add an optional `tags` or index-signature field to
`FedosSubscriptionFilter` without breaking any existing caller — the
SAME "additive, never a reshaping" discipline `FedosRelay` itself has
followed at every prior Stage (Alpha 215, Alpha 216, and this Arc's own
Alpha 226).

`FedosSubscriptionFilter` is a NEW, independent type — it shares no
code and no import with `NostrFilter` (`src/nostr/relay.ts`, Alpha 221
§2, explicitly excluded by this Arc's own instruction list), even
though the two types name an overlapping field subset by NIP-01's own
design, not by any shared code path.

## 4. Structural confirmation (real inspection, this Stage)

- `fedos_subscription_filter.ts` exports exactly one symbol,
  `FedosSubscriptionFilter`.
- `FedosSubscriptionFilter`'s own field count: exactly 6 (`ids`,
  `authors`, `kinds`, `since`, `until`, `limit`), every one `readonly`
  and optional.
- Zero `#e`, `#p`, or generic tag-filter field of any kind.
- Zero import exists in this file — `FedosSubscriptionFilter` depends
  on nothing.
- Zero function, zero class, zero filter-matching logic of any kind —
  this file defines a TYPE ONLY (this Arc never processes an incoming
  event against a filter; see Alpha 224's own "No event processing"
  instruction).

## 5. What this Stage does NOT do

- Does **not** implement `buildReqMessage`/`buildCloseMessage` — Alpha
  224/225's own deliverables.
- Does **not** add filter-matching/evaluation logic of any kind (that
  capability belongs to a relay implementation, never to this
  Desktop-owned type).
- Does **not** add `subscribe()`/`unsubscribe()` to `FedosRelay` — Alpha
  226's own deliverable.
- Does **not** modify `fedos_relay.ts`, `null_relay.ts`,
  `websocket_relay.ts`, `src/nostr/*`, `create_runtime.ts`, `types.ts`,
  `AppRuntime`, `worker.ts`, `src/identity/*`,
  `desktop_application.ts`, Storage, Observation, `Cargo.toml`, or
  `package.json`.

## 6. See also

- `docs/secure_runtime_alpha_222_subscription_interface.md`
- `docs/secure_runtime_alpha_221_subscription_code_review.md`
- `docs/secure_runtime_alpha_211_relay_code_review.md`
