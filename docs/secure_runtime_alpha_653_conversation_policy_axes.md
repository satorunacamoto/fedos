# Secure Runtime Alpha 653 — Conversation Policy Axes

Stage 3. `FedosConversationPolicy`
(`src/board/runtime/policy/fedos_conversation_policy.ts`) models six
distinct axes, never collapsed into one enum:

```ts
export interface FedosConversationPolicy {
  readonly mode: FedosConversationMode;
  readonly discoverability: "listed" | "unlisted";
  readonly readAccess: "public";
  readonly writeAccess: "public" | "restricted";
  readonly inviteAuthority: "none";
  readonly federationEligibility: "allowed" | "local-only";
}
```

`writeAccess: "restricted"` exists in the type's own closed vocabulary
(matching the Arc's own candidate shape) but is REJECTED by
`validateFedosConversationPolicy()` — V1 ships no membership
implementation to ever honor a restriction, and accepting the value
without one would silently promise enforcement that does not exist
(Alpha 653's own "do not introduce membership merely to support
restricted" rule). Every V1 policy this Arc's Authorities ever resolve
therefore has `writeAccess: "public"`.
