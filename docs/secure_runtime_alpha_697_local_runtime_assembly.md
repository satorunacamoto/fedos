# Secure Runtime Alpha 697 — Local Runtime Assembly

Stage 17 of Phase A. `FedosDesktopRuntimeConfig`
(`src/desktop/runtime/fedos_desktop_runtime_config.ts`) gains two new
optional fields, passed straight through to `createFedosBoardRuntime()` by
`startFedosDesktopRuntime()`
(`src/desktop/runtime/fedos_desktop_runtime.ts`):

- `nostrAuthorBindingAuthority?: FedosNostrAuthorBindingAuthority`
- `nostrAccountIndex?: number`

Neither field carries secret material — both are object/number
dependencies only, matching this file's own established "no raw identity
value, no policy JSON bag" discipline (Alpha 673). Omitted, the Runtime's
`FedosBoardRuntime` consults no Binding Authority at all, preserving the
exact pre-Arc fail-closed default (every `"nostr"` target stays
`"ineligible"`).

A caller wanting real Nostr eligibility constructs one coherent identity
graph explicitly:

```ts
const signingAuthority = createFedosWasmNostrSigningAuthority();
const runtime = await startFedosDesktopRuntime({
  // ...board/outbox/observation paths...
  nostrAuthorBindingAuthority: new FedosSigningAuthorityNostrAuthorBinding(signingAuthority),
  nostrAccountIndex: 0,
  publicAuthorAuthority: new FedosNostrSigningPublicAuthorAuthority(signingAuthority, 0),
});
```

— the same `signingAuthority` instance backs both the resolved author and
its binding check, so the graph is coherent by construction (Alpha 690).
