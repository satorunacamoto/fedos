# Secure Runtime Alpha 202 — Desktop-Facing Event Reader Abstraction

**Status: this Stage IMPLEMENTS. It adds exactly two new files,
`src/desktop/fedos_event_descriptor.ts` and
`src/desktop/fedos_event_reader.ts`, and nothing else. This is Stage 2
of the Alpha 201–210 Nostr Event Runtime Exposure Arc, following Alpha
201's own Decision.**

## 1. Why now

Alpha 201 §5 decided this Arc's own boundary is a TypeScript-only
Reader pattern, mirroring the Alpha 101 Public Identity Reader
precedent, rather than a new Rust wasm export. This Stage builds the
first half of that pattern: the public shape (`FedosEventDescriptor`)
and the read interface (`FedosEventReader`) — no implementation yet,
exactly as Alpha 101 itself shipped the interface alone, five Stages
before any concrete Reader existed.

## 2. What was implemented

`src/desktop/fedos_event_descriptor.ts`:

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

`src/desktop/fedos_event_reader.ts`:

```ts
export interface FedosEventReader {
  readEvents(): Promise<readonly FedosEventDescriptor[]>;
}
```

- `FedosEventDescriptor` names every field with protocol-neutral
  vocabulary — `author` (not `pubkey`), `createdAt` (not
  `created_at`), `signature` (not `sig`) — mirroring
  `FedosIdentityDescriptor`'s own `publicIdentifier`/`provider: string`
  discipline (Alpha 028/045), so this shape reads as a general "Event
  Desktop can observe," not a NIP-01 wire-format record.
- `FedosEventReader` names exactly one capability, `readEvents()`,
  returning a `readonly` array of `readonly`-fielded Descriptors —
  Desktop may enumerate what already exists; it cannot add to, remove
  from, or edit the returned collection through this interface.
- Neither file imports or references `FedosNostrEventHandle` or any
  other `packages/fedos-core-rust` symbol — the Rust Event Foundation
  remains exactly as `pub(crate)`-only as Alpha 198/200 left it.
- No implementation of `FedosEventReader` exists yet anywhere in this
  repository — that is Alpha 203's own deliverable.

## 3. Responsibility boundary

- **Read-only Event retrieval only:** the interface names exactly one
  capability, reading zero or more Events — nothing else.
- **No cryptographic state:** neither file accepts, returns, or
  references a secret key, `nsec`, seed, mnemonic, or signing method
  of any kind — `signature` on `FedosEventDescriptor` is a PUBLIC,
  already-computed artifact, not a capability to sign.
- **No Relay/WebSocket/Subscription/Filter vocabulary:** no method or
  field on either type names any such capability — a conforming
  implementation MAY internally read from a network source, but
  nothing here grants or names that capability.
- **No mutation:** every field is `readonly`; the interface exposes no
  write, update, or delete method of any kind.

## 4. What this Stage does NOT do

- Does **not** implement `FedosEventReader` — no class conforming to
  it exists anywhere in this repository yet.
- Does **not** modify `src/desktop/desktop_application.ts` or
  `create_desktop_application.ts`.
- Does **not** modify any `src/identity/*` file.
- Does **not** modify `packages/fedos-core-rust/src/lib.rs`,
  `Cargo.toml`, `create_runtime.ts`, `types.ts`, `src/worker.ts`,
  Storage, or `package.json`.
- Does **not** open any Relay, WebSocket, or network connection of any
  kind.
- Does **not** implement any GUI or Observation construct of any kind.

## 5. See also

- `docs/secure_runtime_alpha_201_event_runtime_exposure_review.md`
- `docs/secure_runtime_alpha_101_public_identity_reader_interface.md`
- `docs/secure_runtime_alpha_028_fedos_identity_descriptor.md`
- `docs/secure_runtime_alpha_045_fedos_identity_descriptor_expansion.md`
- `docs/secure_runtime_alpha_191_nostr_event_model_inventory.md`
