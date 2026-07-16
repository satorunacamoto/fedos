# Secure Runtime Alpha 655 — Public Policy V1

Stage 5. The exact supported V1 public policy
(`FEDOS_CONVERSATION_POLICY_PUBLIC_V1`):

```ts
{
  mode: "public",
  discoverability: "listed",
  readAccess: "public",
  writeAccess: "public",
  inviteAuthority: "none",
  federationEligibility: "allowed",
}
```

Answers required by Alpha 655:

- **May it appear in public queries?** Yes (`discoverability: "listed"`)
  — though no query path in this Arc actually filters by this field yet
  (Alpha 658 — nothing needs hiding in public-only mode).
- **May anyone with Board access read it?** Yes (`readAccess: "public"`).
- **Who may create root posts?** Anyone (`writeAccess: "public"`).
- **Who may reply?** Anyone, same axis.
- **May outbound delivery intents be created?** Only when
  `federationEligibility: "allowed"` (true for V1) AND every Phase C
  Outbound Eligibility check also passes — which, per Alpha 665/666,
  none does today for any real target.
- **Which target protocols are potentially allowed?** Decided
  exclusively by `evaluateFedosOutboundEligibility()` (Phase C), never
  by this policy value alone.

No moderation, rate limit, or membership enforcement is implied by any
field above — none of the three exists anywhere in this codebase.
