# Secure Runtime Alpha 698 — BoardRuntime Binding Verification

Stage 18 of Phase A. `FedosBoardRuntime.#assembleAndSubmit()`
(`src/board/runtime/fedos_board_runtime.ts`) becomes `async` and computes
the Nostr binding lazily — at most once per command, only once the first
`"nostr"`-protocol requested target is encountered, and only when the
resolved author's own protocol is already `"nostr"`:

```ts
if (target.protocol === "nostr" && !nostrAuthorBindingComputed) {
  nostrAuthorBindingComputed = true;
  if (this.#nostrAuthorBindingAuthority !== undefined &&
      isResolvedPublicAuthorResolution(authorResolution) &&
      authorResolution.author.protocol === "nostr") {
    nostrAuthorBinding = await this.#nostrAuthorBindingAuthority.verifyBinding({
      author: authorResolution.author,
      accountIndex: this.#nostrAccountIndex,
    });
  }
}
```

Application command tests
(`test/secure_runtime_alpha_698_board_runtime_binding_verification.test.ts`,
6 tests):

1. A matching signing-backed author + Nostr target becomes eligible — the
   post is `"created"` and the Outbox intent is actually `"inserted"`.
2. A mismatched author stays `"ineligible"` (`outbox-partial-failure`),
   but the post itself still durably persists — Alpha 667's own adopted
   Option 2 ("surface partial failure, never silently drop the post") is
   preserved unchanged.
3. Anonymous local-only (no `outboundTargets`) still succeeds,
   unconditionally of any configured Binding Authority.
4. Anonymous author + Nostr target stays ineligible — an anonymous-local
   author can never bind (its protocol is `"fedos"`, not `"nostr"`).
5. No Binding Authority configured preserves the exact pre-Alpha-681
   fail-closed default (identical outcome to
   `test/secure_runtime_alpha_633_outbound_eligibility.test.ts` test 6).
6. No partial persistence: across multiple requested targets, an
   ineligible one never leaves a dangling Outbox intent — confirmed via
   `outboxPersistence.listIntents()`.

All 6 pass; the Alpha 649/665/667 blocker is closed for a real, controlled
identity.
