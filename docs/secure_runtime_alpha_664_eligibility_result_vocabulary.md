# Secure Runtime Alpha 664 — Eligibility Result Vocabulary

Stage 4. `FedosOutboundEligibilityResult`, unchanged from the Arc's own
candidate shape:

```ts
export type FedosOutboundEligibilityResult =
  | { readonly outcome: "eligible" }
  | {
      readonly outcome: "ineligible";
      readonly reason:
        | "conversation-local-only"
        | "unsupported-conversation-mode"
        | "anonymous-author"
        | "identity-not-controlled"
        | "unsupported-target"
        | "protocol-mismatch";
    };
```

Six coarse, stable reasons — never an `Error` object or Provider-
supplied text. See Alpha 665/666 for exactly which reason each real
input produces today (every real target: `"ineligible"`, for one of the
last three reasons).
