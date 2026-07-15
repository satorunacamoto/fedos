# Secure Runtime Alpha 445 — TypeScript Nostr Signing Authority Adapter

Phase B, Stage 5. Introduces `FedosNostrSigningAuthority`
(`src/nostr/sign/fedos_nostr_signing_authority.ts`) and its one
implementation, `FedosWasmNostrSigningAuthority`
(`src/nostr/sign/fedos_wasm_nostr_signing_authority.ts`).

```ts
export interface FedosNostrSigningAuthority {
  signEvent(request: FedosNostrUnsignedEventRequest): Promise<FedosNostrWireEvent | null>;
}
```

## Dependency on the Master Seed Authority, without exposing it

`FedosMasterSeedAuthority::sign_nostr_event` (Alpha 444) is a method ON
the SAME WASM authority instance `generate()`/`seal()`/`restore_sealed()`/
`clear()` operate on — Rust never defined a separate signing-only
struct (Alpha 441's own confirmation this remained valid). So
`FedosWasmNostrSigningAuthority` depends on a
`FedosWasmMasterSeedAuthority` instance and reaches its ONE
internal-use-only accessor,
`accessForNostrSigningAuthorityInternalUse()` (added in Alpha 438,
documented there as existing for this sole reviewed purpose) — never
the public `FedosMasterSeedAuthority` interface, which has no such
accessor.

## Responsibilities honored

- **Validate request** — `isWellFormedFedosNostrUnsignedEventRequest()`
  (Alpha 442), checked first, before any WASM call.
- **Call WASM** — `attemptDevOnlyNostrSignEventCall()`
  (`fedos_wasm_loader.ts`, Alpha 438/444's own loader extension),
  mirroring the encrypt/decrypt idiom: six-condition gate, `authority`
  re-validated via `isFedosMasterSeedAuthorityShape()`, `try`/`catch`
  fails closed to `CallFailed`.
- **Normalize result only** — `parseSignedNostrWireEventJson()` (Alpha
  443) turns the returned JSON string into a `FedosNostrWireEvent`.
- **Deep-freeze result** — every field of the returned object is
  frozen, `tags` sub-arrays individually.
- **Never signs in TypeScript** — this file contains no
  cryptographic primitive of any kind.
- **Never selects a Relay, never reads the Outbox, never retries** —
  confirmed by direct inspection: no `Relay`/`Outbox` import, and
  `signEvent()` makes exactly one WASM call per invocation, no loop, no
  backoff.

## Tag flattening lives here, not in the generic loader

`fedos_wasm_loader.ts` stays free of Nostr-specific wire-format
knowledge (matching its own existing `encrypt_aead`/`decrypt_aead`
methods, which likewise receive already-translated arguments) —
`FedosWasmNostrSigningAuthority.signEvent()` itself flattens
`readonly (readonly string[])[]` into the U+0001-joined `string[]`
Alpha 442 defines, using the SAME separator constant Rust's own
`FEDOS_NOSTR_TAG_FIELD_SEPARATOR` uses.
