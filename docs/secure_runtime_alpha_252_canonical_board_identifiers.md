# Secure Runtime Alpha 252 — Canonical Board Identifiers

**Status: this Stage IMPLEMENTS. It adds exactly one new file,
`src/board/fedos_board_identifiers.ts`.** Stage 2 of the Alpha 251–260
Canonical Board Model Foundation Arc.

## 1. Why now

Alpha 251's own inventory confirmed no branded-string pattern exists
anywhere in this repository (§3.10) and that no canonical board id type
exists at all (§3.1). Every downstream Alpha in this Arc — the author
reference (254), the post model (255), the validator (257) — needs a
fixed identifier vocabulary before it can be written; this Stage fixes it
first.

## 2. Identifier strategy — the three options and the adopted one

This Arc's own instruction named three candidates:

- **Option A — application-generated stable IDs.** FedOS mints its own
  id at ingest time, independent of any protocol-native id.
- **Option B — derived from the source protocol object.** The id IS the
  protocol-native reference (a Nostr event id, an ActivityPub URI, ...).
- **Option C — application IDs plus separate source references.**
  FedOS's own opaque id, PLUS a separate, explicit provenance record
  naming the protocol-native reference.

**Adopted: Option C**, exactly this Arc's own preferred candidate.
Rationale:

- Option B fails the very first cross-protocol requirement this Arc sets:
  "no free interchange between BoardId/ThreadId/PostId" and "no protocol
  parsing inside the branded types" are impossible to honor if the id
  itself IS a Nostr event id in one case and an ActivityPub URI in
  another — the id's own shape would leak protocol identity, and every
  consumer would need protocol-specific parsing to even recognize which
  kind of id it holds.
- Option A alone loses provenance: without a separate reference, a future
  deduplication layer (explicitly out of scope this Arc, but named as a
  future concern in Alpha 253) would have nowhere to record "this FedOS
  id came from Nostr event `abc123...`".
  Option C keeps the application id OPAQUE (Alpha 252, this Stage) while
  `FedosBoardSourceReference` (Alpha 253) carries the protocol-native
  reference SEPARATELY — the two concerns stay decoupled, each free to
  evolve on its own.

## 3. The four identifier types

```ts
export type FedosBoardId =
  string & { readonly __brand: "FedosBoardId" };
export type FedosThreadId =
  string & { readonly __brand: "FedosThreadId" };
export type FedosBoardPostId =
  string & { readonly __brand: "FedosBoardPostId" };
export type FedosExternalReference =
  string & { readonly __brand: "FedosExternalReference" };
```

`FedosExternalReference` is included as the general-purpose branded
"opaque reference into someone else's namespace" type, distinct from all
three application identifiers — it is not used by `FedosBoardPost`
directly (which uses the more specific `FedosBoardSourceReference.reference`
plain string, Alpha 253) but is exported for a future Protocol Adapter
that needs to brand an external URI/id for its own internal bookkeeping
before mapping it into a `FedosBoardSourceReference`.

TypeScript's nominal-brand-via-intersection technique makes
`FedosBoardId`, `FedosThreadId`, `FedosBoardPostId`, and
`FedosExternalReference` four structurally distinct types: assigning one
where another is expected is a compile error, with no runtime branding
check needed to enforce it at the type-system level.

## 4. Construction — no random generation

This Arc's own instruction: "no automatic random generation unless an
existing safe generator exists." Alpha 251's own inventory found none —
no ID-generation utility of any kind exists in `src/` today (the nearest
neighbor, `crypto.getRandomValues` usage under `src/runtime/`, is scoped
to cryptographic key material, not general application ids). Accordingly,
this file exports ONLY brand-casting functions, never a generator:

```ts
export function toFedosBoardId(value: string): FedosBoardId | null;
export function toFedosThreadId(value: string): FedosThreadId | null;
export function toFedosBoardPostId(value: string): FedosBoardPostId | null;
export function toFedosExternalReference(value: string): FedosExternalReference | null;
```

Each accepts an ALREADY-CHOSEN string (supplied by a caller — a Protocol
Adapter, a future local-post-creation flow) and returns the branded value
only if it is a non-empty string, `null` otherwise. None inspects the
string beyond that single check — no protocol parsing, no format
assumption, no secret data of any kind can appear in an id by
construction (an id is never used to carry a value; it only names one).

## 5. What these types intentionally do NOT assume

- No Nostr event-id shape (64 lowercase hex characters) is assumed or
  validated.
- No DID shape is assumed or validated.
- No ActivityPub URI shape is assumed or validated.
- No Session ID shape is assumed or validated.
- No uniqueness guarantee is made by this file — uniqueness is a future
  storage-layer concern, out of scope here.

## 6. See also

- `docs/secure_runtime_alpha_251_existing_board_model_inventory.md`
- `docs/secure_runtime_alpha_253_board_source_provenance.md`
- `docs/secure_runtime_alpha_257_board_validation_boundary.md`
