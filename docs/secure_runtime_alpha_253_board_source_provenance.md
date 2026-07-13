# Secure Runtime Alpha 253 — Board Source Provenance

**Status: this Stage IMPLEMENTS. It adds exactly one new file,
`src/board/fedos_board_source.ts`.** Stage 3 of the Alpha 251–260
Canonical Board Model Foundation Arc.

## 1. Why now

Alpha 252 fixed the application-side identifier ("Option C"'s first
half); this Stage fixes the second half — the explicit, separate
provenance record naming which protocol a post came from and its
native-namespace reference.

## 2. The shape

```ts
export type FedosBoardSourceProtocol =
  | "fedos"
  | "nostr"
  | "activitypub"
  | "atproto"
  | "session";

export interface FedosBoardSourceReference {
  readonly protocol: FedosBoardSourceProtocol;
  readonly reference: string;
}
```

`protocol` is a FIXED union, not the unconstrained `string` that
`FedosIdentityDescriptor.provider`/`FedosEventDescriptor.provider` use
(Alpha 028/202). Those two fields are deliberately open-ended because
they name providers/protocols that may not exist yet at all (a provider
implementation can be added without touching the type). This Arc's own
instruction, by contrast, gives a closed, finite list of exactly the
protocols this Arc itself defines the Canonical Board Model to speak for
— `"fedos" | "nostr" | "activitypub" | "atproto" | "session"` — so the
union stays closed here, catching a typo (`"nosytr"`) at compile time
rather than silently accepting it as a "new provider." Widening this
union remains possible in a future Stage if a new protocol is formally
added to this Arc's own scope; it is not treated as unconstrained by
default.

`"fedos"` is included for content authored directly through FedOS itself
(not yet built — no local-authoring flow exists in this repository — but
named now so `FedosBoardSourceProtocol` need not be widened the moment
one is). Its own `reference` convention is to equal the post's own id.

## 3. What `reference` may hold, by protocol

| `protocol` | `reference` holds |
| --- | --- |
| `nostr` | the Nostr event id (hex) |
| `activitypub` | the ActivityPub object URI |
| `atproto` | the AT URI (see Alpha 259 §3 for the AT-URI/CID policy) |
| `session` | a gateway-assigned reference to a published board message |
| `fedos` | the post's own `FedosBoardPostId`, as a plain string |

`reference` is an OPAQUE `string` to this file — nothing here parses it,
validates its shape, or infers `protocol` from it. `protocol` is always
supplied explicitly by the caller (a Protocol Adapter), never guessed.

## 4. Exclusions (per this Arc's own instruction, verbatim)

None of the following may ever appear on `FedosBoardSourceReference`,
and none does:

- secret token
- access token
- session credential
- HTTP signature
- private relay metadata
- a generic metadata bag (`Record<string, unknown>` or similar) — the
  type has exactly two fields, full stop.

## 5. Duplicate-import identity (decided, not implemented)

This Arc's own instruction: "Decide duplicate-import identity... Do not
implement deduplication yet." Decision: two `FedosBoardSourceReference`
values name the SAME source object if and only if both `protocol` and
`reference` match exactly (case-sensitive, no normalization performed by
this file). A pure helper names this rule without implementing any
deduplication logic:

```ts
export function fedosBoardSourceKey(source: FedosBoardSourceReference): string {
  return `${source.protocol}:${source.reference}`;
}
```

A future deduplication layer (out of scope this Arc) would key a lookup
structure on this function's output; nothing in this repository calls it
for that purpose yet.

## 6. See also

- `docs/secure_runtime_alpha_252_canonical_board_identifiers.md`
- `docs/secure_runtime_alpha_259_protocol_neutrality_verification.md`
