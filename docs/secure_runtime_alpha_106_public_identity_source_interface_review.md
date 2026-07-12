# Secure Runtime Alpha 106 — Public Identity Source Interface Review

**Status: this Stage is REVIEW ONLY. It makes NO code change of any
kind — no file under `src/` is touched. This document and its own
guard test are the entire deliverable. This is Stage 1 of the Alpha
106–110 Nostr Public Identity Implementation Arc, following the
completed Desktop Shell Foundation (Alpha 096–100) and Public Identity
Source Foundation (Alpha 101–105).**

## 1. Why now

Before adding the first real (non-Null) `FedosNostrPublicIdentitySource`
implementation (Alpha 108) or wiring it anywhere (Alpha 109), this
Stage reviews whether the EXISTING interface — `FedosNostrPublicIdentitySource`
and `FedosNostrPublicIdentitySnapshot`, both fixed at Alpha 039/044 —
is already necessary and sufficient for public identity retrieval, or
whether it needs a minimal addition first.

## 2. Review target

Read directly from `src/identity/fedos_nostr_public_identity_source.ts`
(unchanged since Alpha 044):

```ts
export interface FedosNostrPublicIdentitySnapshot {
  readonly id: string;
  readonly publicIdentifier: string;
  readonly displayName?: string;
  readonly avatar?: string;
}

export interface FedosNostrPublicIdentitySource {
  readPublicIdentity(): Promise<FedosNostrPublicIdentitySnapshot | null>;
}
```

## 3. Sufficiency check against this Arc's own upcoming needs

- **`StaticNostrPublicIdentitySource` (Alpha 108)** will need to return
  exactly `id`, `publicIdentifier`, `displayName`, and `avatar` —
  ALL FOUR already exist on `FedosNostrPublicIdentitySnapshot`, with
  the exact same optionality (`displayName`/`avatar` optional,
  `id`/`publicIdentifier` required). No new field is needed.
- **A Desktop-level public identity configuration (Alpha 107)** needs
  the SAME four fields, in the SAME shape, to describe "which public
  identity to statically configure." Reusing `FedosNostrPublicIdentitySnapshot`
  directly — rather than defining a second, near-duplicate
  configuration type — is both sufficient and the more consistent
  choice: one canonical shape, used identically by the Source
  contract and by Desktop's own configuration surface.
- **`readPublicIdentity()`'s own signature** — no argument, a single
  `Promise<FedosNostrPublicIdentitySnapshot | null>` — already matches
  exactly what a synchronous, in-memory Static Source needs to
  implement: no additional parameter, no synchronous variant, and no
  batching or subscription method is required for this Arc's own
  stated scope (a single, static, pre-configured identity).

## 4. Secret-key check

Confirmed, directly against the interface quoted in §2: no field or
method anywhere on `FedosNostrPublicIdentitySnapshot` or
`FedosNostrPublicIdentitySource` accepts, returns, or references a
secret key, `nsec`, seed, mnemonic, or any other secret material —
consistent with the HARD GUARDRAILS `fedos_nostr_public_identity_source.ts`
already fixed at Alpha 039/044. This Arc introduces no new field of
any kind, so this guarantee is trivially preserved.

## 5. Decision

**No addition to `FedosNostrPublicIdentitySource` or
`FedosNostrPublicIdentitySnapshot` is needed. The existing interface,
unchanged since Alpha 044, is already necessary and sufficient for
this Arc's own entire stated scope — a single, static, publicly-safe
identity snapshot, read synchronously with no argument.**

## 6. What this Stage does NOT do

- Does **not** modify `src/identity/fedos_nostr_public_identity_source.ts`
  or any other `src/identity/*` file.
- Does **not** modify any `src/desktop/*` file.
- Does **not** implement `StaticNostrPublicIdentitySource` — that
  remains Alpha 108's own deliverable.
- Does **not** add any Desktop-level configuration surface — that
  remains Alpha 107's own deliverable.
- Does **not** implement Relay communication, WebSocket connections,
  NIP logic, event retrieval, signing, or DM handling of any kind.
- Does **not** modify `src/runtime/fedos_runtime_identity.ts`,
  `create_runtime.ts`, `types.ts`, `src/worker.ts`, Storage, Rust,
  `Cargo.toml`, or `package.json`.

## 7. See also

- `docs/secure_runtime_alpha_039_nostr_public_identity_source_boundary.md`
- `docs/secure_runtime_alpha_044_nostr_public_identity_snapshot_expansion.md`
- `docs/secure_runtime_alpha_101_public_identity_reader_interface.md`
- `docs/secure_runtime_alpha_103_source_injection.md`
