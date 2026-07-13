# Secure Runtime Alpha 314 — Board Serialization and Deserialization Boundary

**Status: this Stage IMPLEMENTS. It adds exactly one new file,
`src/board/persistence/fedos_board_post_codec.ts`.** Stage 4 of the
Alpha 311–320 Canonical Board Persistence Boundary Arc.

## 1. Why now

Alpha 313 fixed the persisted wire shape. This Stage fixes the ONLY two
pure functions permitted to convert between it and the runtime
`FedosBoardPost` (Alpha 255).

## 2. The two functions

```ts
export function serializeFedosBoardPost(post: FedosBoardPost): FedosPersistedBoardPostRecordV1

export function deserializeFedosBoardPost(record: unknown): FedosBoardPost | null
```

## 3. `serializeFedosBoardPost` — a straight field copy, no JSON step

A deep, field-by-field copy of `post` into
`FedosPersistedBoardPostRecordV1` (Alpha 313), including the nested
`author`/`source` sub-objects — mirroring the SAME deep-copy discipline
`validateFedosBoardPost` (Alpha 257) already applies. Crucially, this
function returns the PLAIN OBJECT record, never a JSON string: "no JSON
parser hidden inside the model function unless justified" — this Stage
justifies NOT including one by leaving `JSON.stringify` (if a real
backend ever needs a string) to that FUTURE backend's own
implementation (Alpha 320 §5's own recommended next Arc), never to this
codec. `InMemoryFedosBoardPersistence` (Alpha 316) needs no string form
at all.

## 4. `deserializeFedosBoardPost` — fail closed, every check explicit

Returns `null` (never throws) for ANY of the following, checked in
order:

1. `record` is not a non-null object.
2. `schemaVersion !== 1` — **unknown future schema rejected, not
   guessed.** A record whose `schemaVersion` is `2` (or anything else)
   is rejected outright; this codec makes NO attempt to interpret,
   upgrade, or guess at a schema it does not recognize.
3. **Unknown top-level (or nested `author`/`source`) fields** — see §5.
4. Any required field is the wrong TYPE (`typeof` checks only — no
   implicit coercion, no `Number()`/`String()` call anywhere in this
   file) — **missing field rejected** the same way (an absent field is
   `undefined`, which fails every `typeof` check).
5. Once every field passes its own shape check, the assembled candidate
   is handed to `validateFedosBoardPost` (`../fedos_board_post_validator.js`,
   Alpha 257, UNMODIFIED, reused exactly as every Protocol Adapter
   already does) — **reusing `validateFedosBoardPost` on read**, exactly
   as this Arc's own instruction requires, rather than re-implementing
   ANY of that boundary's own checks (self-reply rejection, body length,
   timestamp domain, provenance shape) a second time here.

## 5. Extra-field policy — reject unknown fields, at every object level

This Arc's own instruction: "Ignore only if the repository has an
established forward-compatible convention; otherwise reject unknown
top-level fields for V1." Alpha 311 §3.5 already confirmed NO
forward-compatible convention exists anywhere in this repository — the
default therefore applies: **reject.** This Stage applies the identical
discipline to the NESTED `author`/`source` objects too, not merely the
top level named in the instruction — the same category of risk (a
silently-ignored or malicious extra field) exists at every nesting
level, and there is no principled reason to check strictly at the top
while leaving the two sub-objects open. **Do not silently migrate** —
confirmed: no version-2-or-later interpretation logic of any kind exists
in this file.

## 6. Requirements, confirmed by construction

- **No mutation** — `record`/`post` are only ever READ; nothing is
  assigned onto either parameter.
- **Deep-copy/freeze according to existing Board conventions** —
  `serializeFedosBoardPost` deep-copies (§3); `deserializeFedosBoardPost`'s
  own output inherits `validateFedosBoardPost`'s own `Object.freeze`
  guarantee (Alpha 257) FOR FREE — this file performs no additional
  freeze of its own, since re-freezing an already-frozen object would be
  redundant.
- **Deterministic serialization** — `serializeFedosBoardPost` reads only
  its own argument; no timestamp, random value, or external state is
  consulted.
- **Round-trip equality** — `deserializeFedosBoardPost(serializeFedosBoardPost(post))`
  produces a value `fedosBoardPostsAreStructurallyEqual` (Alpha 302 §5)
  to the original `post` — verified by this Stage's own test, not merely
  asserted.

## 7. See also

- `docs/secure_runtime_alpha_313_persisted_board_record_v1.md`
- `docs/secure_runtime_alpha_257_board_validation_boundary.md`
- `docs/secure_runtime_alpha_302_board_repository_contract.md`
- `docs/secure_runtime_alpha_315_board_persistence_port.md`
