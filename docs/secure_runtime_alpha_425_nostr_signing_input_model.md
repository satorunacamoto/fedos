# Secure Runtime Alpha 425 — Nostr Signing Input Model

**Status: this Stage is DESIGN / DECISION ONLY. It makes NO code
change of any kind — no `src/` file is added.** Stage 4 of the Alpha
422–430 Arc, Phase A. Specifies the smallest honest input shape for
the Option D authority (Alpha 424). Presented here as a design
artifact only; not shipped as a `.ts` file this Arc, because Phase B
(the only consumer) does not proceed past Alpha 427 (see the Alpha 427
and Alpha 430 docs) — an unconsumed exported type would be dead code,
against this project's own standing discipline of not shipping
half-finished surfaces.

## 1. Candidate shape

```ts
export interface FedosNostrUnsignedEventRequest {
  readonly accountIndex: number;
  readonly createdAt: number;
  readonly kind: number;
  readonly tags: readonly (readonly string[])[];
  readonly content: string;
}
```

Matches the Arc's own candidate exactly — no protocol-native
`FedosBoardPost` embedding (Alpha 424 §3's own rejection of Option C).

## 2. Field-by-field rules

- **`accountIndex`**: `u32` range (`0` to `4294967295` inclusive) —
  matches the existing Rust `derive_nostr_secret_key_internal`
  parameter type exactly (Alpha 422 §2); any value outside that range
  is rejected, fail-closed, before reaching Rust.
- **`createdAt`**: Unix seconds (not milliseconds), a non-negative
  integer — matches every existing NIP-01 `created_at` consumer in
  this repository (`src/nostr/types.ts:NostrEvent`,
  `src/desktop/fedos_nostr_wire_event.ts:FedosNostrWireEvent`).
- **`kind`**: constrained to the Alpha 424 §4 fixed allowlist (`{1}`
  for this Arc's scope) — any other value rejected, fail-closed, before
  reaching Rust. Not caller-extensible.
- **`tags`**: deep-copied on the way in — the request object must never
  let a caller mutate the array a signing call is mid-flight on; a
  `readonly (readonly string[])[]` type alone does not stop `.push()`
  at runtime, so the eventual TS adapter (if Phase B ever proceeds)
  must deep-copy before crossing into WASM, not merely rely on the
  type.
- **`content`**: a plain string; a byte-length policy (matching NIP-01
  relay-side size limits, if any exist in this repository's own Relay
  code) is an explicit open question for whichever future Stage
  actually implements the adapter — not decided here, and not silently
  assumed unbounded.

## 3. Explicitly excluded fields (binding, matches Alpha 424 §4)

No `pubkey`, no `id`, no `sig`, no secret material of any kind, no
Relay destination, no metadata bag, no mutable nested arrays accepted
by reference without copying.

## 4. Malformed-input policy

Fails closed: any request with an out-of-range `accountIndex`, an
unsupported `kind`, a non-integer/negative `createdAt`, or a
non-array/non-string-array `tags` shape must be rejected before any
Rust call is attempted — mirroring every existing fail-closed
boundary in this repository (`createFedosBoardOutboxIntent`,
`deserializeFedosBoardOutboxIntent`, `validateInboundNostrEvent`), none
of which throws on malformed input.

## 5. See also

- `docs/secure_runtime_alpha_424_nostr_signing_authority_scope.md`
- `docs/secure_runtime_alpha_422_nostr_signing_boundary_inventory.md`
