# FedOS — Adding an Adapter

Status: written this arc (Architecture Dependency Closure + Ports/Factories
Completion + OSS Catalog Completion). Pure software architecture, no
legal/compliance content. Practical, README-level guidance for implementing
an existing `os/core/ports/*` Port against a NEW concrete backend (a new
transport, a new notification surface, a new sealing implementation, ...).
For adding a brand-new Port, see `docs/architecture/ADDING-A-CAPABILITY.md`'s
own "Which Port to implement (or add)" section first.

## Where code goes

A Port ADAPTER belongs to the CAPABILITY that owns the concrete backend,
never to `os/core` (which holds only the Port interface itself). The three
real examples in this repo:

```
src/os/messenger/adapters/messaging_port_adapter.ts       <- implements MessagingPort
src/os/messenger/adapters/conversation_port_adapter.ts    <- implements ConversationPort
src/os/messenger/adapters/notification_port_adapter.ts    <- implements NotificationPort
```

A new adapter for a different backend (e.g. a hypothetical
`MatrixMessagingPortAdapter`) would live at
`src/os/messenger/adapters/matrix_messaging_port_adapter.ts` if it belongs
to Messenger, or under a different capability's own `adapters/` directory
if it belongs elsewhere — the Port is capability-neutral, the adapter is
not.

## The three-step pipeline (worked example)

`test/example_fake_transport_adapter.test.ts` (this pass) is a REAL, RUNNING
file demonstrating all three steps below over a `MessagingPort` and a
from-scratch in-memory fake transport (no relay, no socket, no new
external dependency — verified to pass: `npx vitest run
test/example_fake_transport_adapter.test.ts`, 4/4 tests). The excerpts
below are trimmed for readability; read the real file for the complete,
exact, currently-passing code.

### Step 1 — implement the Port

```ts
class FakeTransportMessagingAdapter implements MessagingPort {
  readonly #transport: FakeInMemoryTransport;
  readonly #handlers = new Set<MessageHandler>();

  constructor(transport: FakeInMemoryTransport) {
    this.#transport = transport;
  }

  async send(conversationId: ConversationId, payload: MessagePayload): Promise<SendResult> {
    if (typeof conversationId !== "string" || conversationId.length === 0) {
      return { delivered: false, reason: "invalid-input" };
    }
    // ... delegates to #transport, maps its outcome to a Port-shaped SendResult.
  }

  async read(conversationId: ConversationId, messageId: MessageId): Promise<MessageReadResult> { /* ... */ }
  async list(conversationId: ConversationId): Promise<readonly MessageSummary[]> { /* ... */ }
  onMessage(handler: MessageHandler): Unsubscribe { /* ... */ }
}
```

Rules, all already established by the three real adapters (re-verify
against them, not just this doc):
- The class does the TRANSLATING ONLY. Every real send/read/list/session
  decision belongs to the thing being wrapped (a coordinator, a client, a
  transport) — an adapter is not where new business logic goes.
- Never throw for an expected failure. Map every failure to the Port's own
  discriminated-union result type (`SendResult`'s `delivered: false`
  branch here).
- Validate input defensively at the adapter boundary — a caller of the
  PORT should never be able to crash the concrete backend with a
  malformed `conversationId`/payload.
- If the wrapped backend's failure vocabulary doesn't map cleanly onto the
  Port's closed vocabulary, fall back to the Port's own most generic
  token (`"failed"` for `MessageSendFailureReason`) rather than inventing
  a new one — see `messaging_port_adapter.ts`'s own
  `toSendFailureReason()`/`toReadFailureReason()` helpers for the pattern.

### Step 2 — factory injection

```ts
const transport = new FakeInMemoryTransport();
const adapter = new FakeTransportMessagingAdapter(transport);

const messenger = createMessenger({ messaging: adapter }); // real adapter, not the Noop default
```

Any `createMessenger()`/`createCommerce()`-style factory accepts your
adapter as a plain constructor argument — no registration, no plugin
system, no dynamic lookup. Omitting it falls back to the matching
`Noop*Port` (see `src/os/messenger/adapters/noop_messenger_ports.ts`).

### Step 3 — capability test

```ts
const messenger = createMessenger({ messaging: new FakeTransportMessagingAdapter(transport) });

const sendResult = await messenger.messaging.send("c1", { text: "hello there" });
expect(sendResult.delivered).toBe(true);

const listed = await messenger.messaging.list("c1");
expect(listed).toHaveLength(1);

const read = await messenger.messaging.read("c1", sendResult.messageId);
expect(read.ok).toBe(true);
```

Test THROUGH the factory-constructed `Messenger`/`Commerce`, not just the
adapter in isolation — this proves the injection seam itself works, not
only the adapter's own methods. Also add a Port-shape test mirroring
`test/architecture_boundary_adapter_port_shapes.test.ts` (type-level
`implements` check + a couple of behavior assertions against a minimal
hand-built double for whatever your adapter wraps).

## Boundary rules

- Your adapter file may import the Port it implements
  (`os/core/ports/*.ts`) and the concrete backend it wraps. It must NOT
  be imported BY `os/core` (Ports never depend on their own adapters —
  enforced by `test/architecture_boundary_core.test.ts`).
- An adapter inside `os/messenger` must never import `os/commerce`
  (enforced by `test/architecture_boundary_messenger.test.ts`), and vice
  versa for a commerce-side adapter.
- If your adapter wraps a third-party SDK (a real payment rail, a real
  chat platform), and it lives under `os/commerce`, it MUST live inside
  that SDK's own reserved adapter directory (e.g.
  `os/commerce/payment/adapters/btcpay/`) — `test/architecture_boundary_commerce.test.ts`
  fails the build if that SDK's package name leaks anywhere else under
  `os/commerce`.
- Never import `"electron"` or a third-party Nostr SDK from `src/`
  (enforced by `test/architecture_dependency_rules_electron_nostrsdk_protocol.test.ts`,
  added this pass) — Electron-concrete adapter code belongs in
  `packages/fedos-desktop-electron-spike/`.

## Packaging implications

Writing a real adapter does not make it live in the shipped app — see
`docs/architecture/ADDING-A-CAPABILITY.md`'s own "Packaging implications"
section. A composition root (today `src/desktop/runtime/` /
`os/messenger/desktop/runtime/`) has to actually construct your adapter
and pass it into a factory (or wire it directly into the coordinator it
wraps) before it does anything in the packaged Electron app.
