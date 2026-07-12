# Secure Runtime Alpha 101 — Public Identity Reader Interface

**Status: this Stage IMPLEMENTS. It adds exactly one new file,
`src/desktop/fedos_public_identity_reader.ts`, and nothing else. This
is Stage 1 of the Alpha 101–105 Public Identity Source Foundation
Arc, following the completed Desktop Shell Foundation (Alpha
096–100).**

## 1. Why now

The Desktop Shell Foundation connected Desktop → `FedosRuntimeIdentity`
→ `bootstrapIdentity()` end to end (Alpha 096–100), but that
connection reuses the Identity Layer's own internal Provider/Service
pipeline entirely. Desktop has no boundary of its OWN for reading
public identity information — a distinct, forward-looking concern from
Bootstrap itself. This Stage adds that boundary: a new interface,
deliberately separate from `FedosIdentityProvider`
(`src/identity/fedos_identity_provider.ts`, Alpha 029) and from
`FedosNostrPublicIdentitySource` (Alpha 039), owned by Desktop, not by
the Identity Layer.

## 2. What was implemented

A new file, `src/desktop/fedos_public_identity_reader.ts`, exporting
one new interface:

```ts
export interface FedosPublicIdentityReader {
  readPublicIdentity(): Promise<FedosIdentityDescriptor | null>;
}
```

- Exactly one method, mirroring `FedosIdentityProvider.describeIdentity()`'s
  own shape (`Promise<FedosIdentityDescriptor | null>`) but under a
  deliberately DIFFERENT name and interface — this Stage does not
  reuse or extend `FedosIdentityProvider` itself.
- Returns the SAME, protocol-independent `FedosIdentityDescriptor`
  type the rest of the Identity Layer already uses — not a
  Nostr-specific Snapshot type — consistent with this interface's own
  deliberately protocol-independent name (no "Nostr" in
  `FedosPublicIdentityReader`, unlike `FedosNostrPublicIdentitySource`).
- No implementation of this interface exists yet anywhere in this
  repository — that is Alpha 103's (a concrete, Source-backed reader)
  and Alpha 104's (a Null reader) own deliverable.

## 3. Responsibility boundary

- **公開Identity取得のみ (public identity retrieval only):** the
  interface names exactly one capability, reading public identity —
  nothing else.
- **秘密鍵禁止 (secret key forbidden):** no method accepts, returns, or
  references a secret key, `nsec`, seed, or mnemonic of any kind.
- **署名禁止 (signing forbidden):** no method signs, verifies, or
  otherwise touches a signature of any kind.
- **Relay禁止 (Relay forbidden):** no method opens, reads from, or
  otherwise references a Relay connection of any kind — a conforming
  implementation MAY internally read from a network source, but this
  interface itself grants no such capability and names none.

## 4. What this Stage does NOT do

- Does **not** implement `FedosPublicIdentityReader` — no class
  conforming to it exists anywhere in this repository yet.
- Does **not** modify `src/desktop/desktop_application.ts`,
  `create_desktop_application.ts`, or any other existing `src/desktop/*`
  file.
- Does **not** modify any `src/identity/*` file — this Stage only
  IMPORTS the existing, unchanged `FedosIdentityDescriptor` type.
- Does **not** modify `src/runtime/fedos_runtime_identity.ts`,
  `create_runtime.ts`, `types.ts`, `src/worker.ts`, Storage, Rust,
  `Cargo.toml`, or `package.json`.
- Does **not** open any Relay, WebSocket, or network connection of any
  kind.
- Does **not** implement any GUI or Observation construct of any kind.

## 5. See also

- `docs/secure_runtime_alpha_029_fedos_identity_provider_interface.md`
- `docs/secure_runtime_alpha_039_nostr_public_identity_source_boundary.md`
- `docs/secure_runtime_alpha_096_desktop_shell_skeleton.md`
- `docs/secure_runtime_alpha_100_integration_verification.md`
