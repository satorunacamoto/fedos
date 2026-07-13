# Secure Runtime Alpha 245 — Combined Inbound Event Validator

**Status: this Stage IMPLEMENTS. It adds exactly one new file,
`src/desktop/combined_inbound_event_validator.ts`. This is Stage 5 of
the Alpha 241–250 Nostr Inbound Event Validation Arc, following Alpha
243/244's own `verifyNostrEventId`/`verifyNostrEventSignature`.**

## 1. Why now

Alpha 243/244 built the two independent verification steps; this
Stage combines them into the SINGLE entry point every caller in this
repository uses to turn a `FedosNostrWireEvent` into a
`FedosValidatedNostrEvent`.

## 2. What was implemented

```ts
export function validateInboundNostrEvent(
  event: FedosNostrWireEvent,
): FedosValidatedNostrEvent | null
```

Required order, honored exactly:

1. **Structural assumptions already guaranteed by the parser.** This
   function trusts `event`'s own seven fields already satisfy
   `FedosNostrWireEvent`'s own shape — `parseRelayInboundMessage`
   (Alpha 233) already enforced this before this function is ever
   reached; no re-parsing occurs here.
2. **Event ID verification.** `verifyNostrEventId(event)` (Alpha
   243) — an early `return null` if it fails.
3. **Signature verification.** `verifyNostrEventSignature(event)`
   (Alpha 244) — reached ONLY if step 2 succeeded.
4. **Validated immutable output.** A freshly-constructed, deep-frozen
   `FedosValidatedNostrEvent` — reached ONLY if both prior steps
   succeeded.

## 3. Clone/freeze strategy, explicitly decided

The returned object is a FRESH object literal — never `event` itself,
never a widened/cast reference to it — `Object.freeze`d at the top
level. `tags` is DEEP-CLONED: each inner tag array is copied via
spread and individually `Object.freeze`d, then the outer array is
`Object.freeze`d. This Arc's own "output object must not reuse mutable
nested tag arrays by unsafe reference" instruction is honored exactly:
`FedosNostrWireEvent.tags`'s own `readonly` modifier is a TYPE-LEVEL
guarantee only — the underlying JS arrays, produced by
`parseRelayInboundMessage`'s own `Array.isArray` narrowing of an
already-`JSON.parse`d value, are ordinary, runtime-mutable arrays.
Deep-cloning severs any shared reference between the validated output
and the original wire event; `Object.freeze` makes the validated copy
itself runtime-immutable, not merely `readonly` at compile time.

## 4. Failure semantics — no distinction exposed

`null` for EVERY failure. This function's own return value alone can
never tell a caller whether the id or the signature failed — matching
this Arc's own "no distinction exposed between bad id and bad
signature" / "no oracle-like detailed failure reason at the public
listener boundary" instruction. Alpha 247 reviews and extends this
policy across the FULL set of failure causes this Arc's own Goals list
names (malformed pubkey, canonicalization mismatch, verifier
exception, etc.) — all indistinguishable at this SAME boundary.

## 5. Structural confirmation (real inspection, this Stage)

- `validateInboundNostrEvent` is the ONLY export.
- `verifyNostrEventId` is called, and its own result checked, BEFORE
  `verifyNostrEventSignature` is ever called — confirmed by direct
  inspection of this function's own control flow (two sequential `if`
  statements, each an early `return null`).
- `event` (the input parameter) is referenced only for READS — zero
  assignment to any of its own fields, zero in-place array mutation,
  anywhere in this function.
- The returned object's own `tags` field, and every one of its inner
  arrays, is `Object.freeze`d — confirmed by direct inspection.
- This is the ONLY file in the repository containing an object literal
  typed as `FedosValidatedNostrEvent` — confirmed by `grep` across
  every other `src/desktop/*` file.
- Zero reference to Storage, a Registry, or Runtime Identity mutation
  of any kind anywhere in this file.

## 6. What this Stage does NOT do

- Does **not** implement `createValidatedEventListener` or wire this
  function into `WebSocketRelay` in any way — Alpha 246's own
  deliverable.
- Does **not** re-implement id or signature verification inline — both
  are REUSED, unchanged, from Alpha 243/244's own functions.
- Does **not** perform any I/O, storage write, or Runtime/Identity
  mutation of any kind — a pure, synchronous transform.
- Does **not** modify `fedos_nostr_wire_event.ts`,
  `fedos_validated_nostr_event.ts`, `nostr_event_id_verifier.ts`,
  `nostr_signature_verifier.ts`, `fedos_relay.ts`, `null_relay.ts`,
  `websocket_relay.ts`, `src/nostr/*`, `src/sign/*`,
  `create_runtime.ts`, `types.ts`, `AppRuntime`, `worker.ts`,
  `src/identity/*`, `desktop_application.ts`, Storage, Observation,
  `Cargo.toml`, or `package.json`.

## 7. See also

- `docs/secure_runtime_alpha_244_bip340_signature_verification.md`
- `docs/secure_runtime_alpha_243_canonical_event_id_verification.md`
- `docs/secure_runtime_alpha_242_validated_nostr_event_model.md`
- `docs/secure_runtime_alpha_246_validated_subscription_delivery.md`
- `docs/secure_runtime_alpha_247_validation_failure_semantics.md`
