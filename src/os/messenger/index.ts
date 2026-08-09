/**
 * OS Capability Modularization — Factory/Port Completion pass. Public API
 * barrel for `os/messenger`.
 *
 * Re-exports exactly what an outside consumer (a composition root, or a
 * future `os/commerce` piece reaching through a Port, never directly)
 * needs:
 *   - `createMessenger()`/`Messenger`/`MessengerDependencies` — the public
 *     composition entrypoint added this pass (`./create_messenger.js`;
 *     see that file's own header for its `transport`/`storage` scope
 *     details).
 *   - The four real Port adapters (`FedosMessenger*PortAdapter` plus
 *     `NostrTransportAdapter`, added Compatibility Facade Reduction +
 *     Package Extraction Readiness + Remaining Architecture Debt Closure
 *     arc, Agent P) and their dependency shapes — for a composition root
 *     that wants to wire REAL coordinator/relay-backed behavior into
 *     `createMessenger()` rather than accept the Noop defaults.
 *   - The four `Noop*Port` safe defaults — for a caller that wants to
 *     construct one explicitly (e.g. in a test) rather than relying on
 *     `createMessenger()`'s own default-resolution.
 *
 * DELIBERATELY NOT RE-EXPORTED: everything under `conversations/`,
 * `board/`, `device/`, `desktop/`, `notifications/`, `adapters/nostr/`,
 * `contacts/`, `onion/` — the real coordinators, authorities, and
 * transport/protocol internals those directories hold are implementation
 * detail this barrel does not surface. A composition root that needs to
 * assemble a real coordinator (e.g.
 * `FedosConversationDirectMessagingCoordinator`) to hand to
 * `FedosMessengerMessagingPortAdapter` imports it directly from its own
 * canonical path — this barrel only re-exports the SEAM (the Port
 * adapters and the factory), never the machinery behind it.
 *
 * BOUNDARY CHECK (re-verify after any future edit to this file): `os/messenger`
 * must never import `os/commerce`
 * (`test/architecture_boundary_messenger.test.ts`) — nothing re-exported
 * below originates from `os/commerce`, so this barrel adds no new edge.
 * Re-run `node scripts/architecture_cycle_detector.mjs` after changing
 * this file.
 */

export { createMessenger, type Messenger, type MessengerDependencies } from "./create_messenger.js";

export {
  FedosMessengerMessagingPortAdapter,
} from "./adapters/messaging_port_adapter.js";
export {
  FedosMessengerConversationPortAdapter,
  type FedosMessengerConversationPortAdapterDependencies,
} from "./adapters/conversation_port_adapter.js";
export { FedosMessengerNotificationPortAdapter } from "./adapters/notification_port_adapter.js";
export {
  NostrTransportAdapter,
  type NostrTransportAdapterOptions,
  type NostrTransportEventSource,
} from "./adapters/nostr_transport_adapter.js";

export {
  NoopMessagingPort,
  NoopConversationPort,
  NoopNotificationPort,
  NoopTransportPort,
} from "./adapters/noop_messenger_ports.js";
