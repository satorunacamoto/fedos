/**
 * OS Capability Modularization — Factory/Port Completion pass.
 * `createMessenger()`.
 *
 * Follows `createDesktopApplication()`'s
 * (`./desktop/create_desktop_application.ts`) own naming/scoping
 * discipline — a small, documented factory function, not a class — with
 * ONE structural difference that function's own doc comment does not
 * share: `createDesktopApplication()` constructs its ~20 dependencies
 * internally (or takes an optional data snapshot); `createMessenger()`
 * takes real, already-constructed Port implementations as constructor
 * arguments. This is the first factory in the codebase to do that for the
 * Messenger domain.
 *
 * `transport` ADDED (Compatibility Facade Reduction + Package Extraction
 * Readiness + Remaining Architecture Debt Closure arc, Agent P): a real
 * `TransportPort` (`../core/ports/transport_port.js`) now exists — see
 * that file's own header for the design, and
 * `./adapters/nostr_transport_adapter.js` for a real adapter over it. This
 * is purely ADDITIVE: the parameter is OPTIONAL, defaults to
 * `NoopTransportPort`, and every existing caller of `createMessenger()`
 * (with or without arguments) keeps compiling and behaving identically —
 * nothing about `messaging`/`conversations`/`notifications` changed. The
 * real messaging pipeline
 * (`FedosConversationDirectMessagingCoordinator` and everything it
 * composes over) still does NOT consume this `transport` field — it stays
 * hard-wired to its own Nostr-shaped delivery internals, unchanged by this
 * pass. `transport` exists on `Messenger` as a genuinely usable,
 * independently-composable Port (provable via `send`/`subscribe`
 * directly, per `test/example_fake_transport_adapter.test.ts`), not yet as
 * something the rest of `Messenger`'s own methods delegate to — wiring
 * the real coordinator's delivery path to consume an injected
 * `TransportPort` instead of its own internals is a SEPARATE, larger
 * rewrite this pass does not attempt (mirrors this file's own prior
 * "designing one is real protocol-level design work" framing, now
 * half-resolved: the Port and a real adapter exist; the internal rewiring
 * does not).
 *
 * This factory takes OPTION (b) from the arc's own instruction:
 * it accepts the widened `os/core/ports/*` Ports
 * (`MessagingPort`/`ConversationPort`/`NotificationPort`/`TransportPort`)
 * directly, and does none of the internal transport wiring itself. A
 * caller that wants REAL behavior constructs a real Port adapter first
 * (e.g. `FedosMessengerMessagingPortAdapter` wrapping an already-assembled
 * `FedosConversationDirectMessagingCoordinator` — that assembly is the
 * composition root's job, today `src/desktop/runtime/`, unchanged by this
 * factory) and passes the adapter in here. `createMessenger()` itself
 * never touches a relay, socket, or filesystem.
 *
 * SAFE DEFAULTS ONLY: any Port a caller omits falls back to the
 * corresponding `Noop*Port` (`./adapters/noop_messenger_ports.js`) —
 * every method total, never throws, zero external contact. Calling
 * `createMessenger()` with no arguments at all is always safe and
 * constructs successfully; nothing it returns can reach a network, a
 * relay, or a file by default.
 *
 * `storage` is deliberately NOT a dependency here, unlike the plan's own
 * speculative target snippet. `os/core/storage/types.ts`'s
 * `StorageBackend` is an explicitly reserved, unwired placeholder seam
 * (see `src/os/core/storage/README.md` and
 * `docs/architecture/CORE-SECRETS-OWNERSHIP-PLAN.md`'s own disposition
 * finding) — accepting a `storage` parameter this factory could not do
 * anything real with would misrepresent it as a live dependency. Add it
 * once `os/core/storage` has a real implementation to inject.
 */

import type { ConversationPort } from "../core/ports/conversation_port.js";
import type { MessagingPort } from "../core/ports/messaging_port.js";
import type { NotificationPort } from "../core/ports/notification_port.js";
import type { TransportPort } from "../core/ports/transport_port.js";
import {
  NoopConversationPort,
  NoopMessagingPort,
  NoopNotificationPort,
  NoopTransportPort,
} from "./adapters/noop_messenger_ports.js";

export interface MessengerDependencies {
  /** OPTIONAL — defaults to `NoopMessagingPort` (contacts nothing). */
  readonly messaging?: MessagingPort;
  /** OPTIONAL — defaults to `NoopConversationPort` (contacts nothing). */
  readonly conversations?: ConversationPort;
  /** OPTIONAL — defaults to `NoopNotificationPort` (surfaces nothing). */
  readonly notifications?: NotificationPort;
  /** OPTIONAL — defaults to `NoopTransportPort` (contacts nothing). See this file's own header for what `transport` is (and is not yet) wired to. */
  readonly transport?: TransportPort;
}

/**
 * The Messenger capability's public composition surface: the widened core
 * Ports, resolved to either the caller's real adapter or a safe Noop
 * default. Every field is always present — a consumer never needs to
 * null-check.
 */
export interface Messenger {
  readonly messaging: MessagingPort;
  readonly conversations: ConversationPort;
  readonly notifications: NotificationPort;
  readonly transport: TransportPort;
}

/**
 * Constructs a `Messenger` from already-built Port implementations (or
 * safe Noop defaults for whichever are omitted). Performs no I/O itself —
 * purely an aggregation/default-resolution step. See this file's own
 * header for the `transport`/`storage` scope details.
 */
export function createMessenger(deps: MessengerDependencies = {}): Messenger {
  return {
    messaging: deps.messaging ?? new NoopMessagingPort(),
    conversations: deps.conversations ?? new NoopConversationPort(),
    notifications: deps.notifications ?? new NoopNotificationPort(),
    transport: deps.transport ?? new NoopTransportPort(),
  };
}
