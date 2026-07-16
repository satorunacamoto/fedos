# Secure Runtime Alpha 672 — Application Runtime Construction

Stage 2. `startFedosDesktopRuntime()` constructs exactly one
`FedosBoardRuntime` per running runtime, via `createFedosBoardRuntime()`
(Alpha 623, unmodified), over the SAME `host` it already constructs and
starts:

```ts
const boardRuntimeInstance = createFedosBoardRuntime({
  host,
  idGenerator: config.idGenerator,
  clock: config.clock,
  publicAuthorAuthority: config.publicAuthorAuthority,
  conversationPolicyAuthority: config.conversationPolicyAuthority,
});
```

All four dependencies are explicitly passed through from `config`
(Alpha 673) — never silently defaulted inside THIS file (defaults, if
omitted, are `FedosBoardRuntime`'s own already-documented ones, Alpha
642/654/625/626 — not duplicated or shadowed here). No singleton — a
second `startFedosDesktopRuntime()` call constructs a fully independent
Host AND a fully independent `FedosBoardRuntime`, exactly mirroring
this function's own pre-existing Alpha 618 "no shared singleton"
guarantee, now extended to the Application Runtime layer.
