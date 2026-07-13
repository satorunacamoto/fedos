# Secure Runtime Alpha 205 — Event Immutability Review

**Status: this Stage is REVIEW ONLY. It makes NO code change of any
kind — no `src/` file, no `packages/` file, is modified. This is
Stage 5 of the Alpha 201–210 Nostr Event Runtime Exposure Arc,
following Alpha 204's own Event Ownership Review.**

## 1. Why now

This Arc's own Alpha 205 instruction states plainly: "Verify Event
immutability. No mutable Event API." Alpha 204 already confirmed
Desktop's three new files own no cryptographic state; this Stage
confirms the complementary property — that nothing on the new Reader
boundary can CHANGE an Event once observed, mirroring
`FedosNostrEventHandle`'s own immutability guarantee (Alpha 197: "no
`&mut self` method exists anywhere on it") one layer up, at the
TypeScript boundary.

## 2. `FedosEventDescriptor` — every field `readonly`, confirmed by
   direct inspection

All eight fields on `FedosEventDescriptor` (`fedos_event_descriptor.ts`,
Alpha 202) carry the `readonly` modifier:

```ts
export interface FedosEventDescriptor {
  readonly id: string;
  readonly provider: string;
  readonly author: string;
  readonly createdAt: number;
  readonly kind: number;
  readonly tags: readonly (readonly string[])[];
  readonly content: string;
  readonly signature: string;
}
```

`tags`, the one array-shaped field, is doubly `readonly` — the outer
array AND each inner array — so no caller holding a
`FedosEventDescriptor` can push, splice, or otherwise mutate a tag
list through the type system, matching TypeScript's own strictest
available readonly-array shape. No field is optional-then-settable, no
field is `let`-declared, and the interface declares no index signature
that could admit an unnamed, unreadonly field.

## 3. `FedosEventReader` — zero write, update, or delete method

`FedosEventReader` (`fedos_event_reader.ts`, Alpha 202) declares
EXACTLY one method, `readEvents()` — no `writeEvent`, `updateEvent`,
`deleteEvent`, `clearEvents`, or any method whose name or signature
implies a state change of any kind. Its return type,
`Promise<readonly FedosEventDescriptor[]>`, is a `readonly` array of
`readonly`-fielded objects — the STRONGEST array immutability
TypeScript's own type system expresses without a runtime `Object.freeze`
call, which this Stage confirms is unnecessary here precisely because
the type system already forecloses the mutating operations
`Object.freeze` would otherwise need to guard against at runtime.

## 4. `NullEventReader` — no internal mutable state to leak

`NullEventReader` (`null_event_reader.ts`, Alpha 203) holds no field
of any kind (Alpha 203 §2, reconfirmed here) — there is no private
array it appends to, no cache it invalidates, nothing to mutate
internally even if some future caller wanted to. `readEvents()`
returns a fresh `[]` literal on every call, never a shared, mutable
array instance.

## 5. What this Stage does NOT do

- Does **not** modify any `src/` or `packages/` file — zero code
  change of any kind.
- Does **not** add a write, update, delete, or clear method to
  `FedosEventReader`, `FedosEventDescriptor`, or `NullEventReader`.
- Does **not** add `Object.freeze` or any other runtime immutability
  enforcement — this Stage's own finding is that the type-level
  `readonly` discipline already in place is sufficient, not that
  additional enforcement is needed.
- Does **not** modify `create_runtime.ts`, `types.ts`, `AppRuntime`,
  `worker.ts`, `src/identity/*`, `src/desktop/*`, `src/nostr/*`,
  Storage, Observation, `Cargo.toml`, or `package.json`.

## 6. See also

- `docs/secure_runtime_alpha_204_event_ownership_review.md`
- `docs/secure_runtime_alpha_202_desktop_facing_event_reader_abstraction.md`
- `docs/secure_runtime_alpha_197_event_boundary_review.md`
