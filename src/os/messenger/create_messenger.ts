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
 * SCOPE, STATED HONESTLY (per `docs/architecture/FACTORY-PORT-COMPLETION-PLAN.md`,
 * "createMessenger({ transport, storage }) — blocked mainly on transport"):
 * **no `TransportPort` exists, and this factory does not add one.** The
 * real messaging pipeline (`FedosConversationDirectMessagingCoordinator`
 * and everything it composes over) is hard-wired to Nostr-shaped delivery
 * internals — there is no injection seam a second, non-Nostr transport
 * could plug into today, and designing one is real protocol-level design
 * work this pass does not attempt (the plan's own "genuinely new design
 * work, not a refactor" framing).
 *
 * This factory instead takes OPTION (b) from the arc's own instruction:
 * it accepts the THREE widened `os/core/ports/*` Ports
 * (`MessagingPort`/`ConversationPort`/`NotificationPort`) directly, and
 * does none of the internal transport wiring itself. A caller that wants
 * REAL behavior constructs a real Port adapter first (e.g.
 * `FedosMessengerMessagingPortAdapter` wrapping an already-assembled
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
import { NoopConversationPort, NoopMessagingPort, NoopNotificationPort } from "./adapters/noop_messenger_ports.js";

export interface MessengerDependencies {
  /** OPTIONAL — defaults to `NoopMessagingPort` (contacts nothing). */
  readonly messaging?: MessagingPort;
  /** OPTIONAL — defaults to `NoopConversationPort` (contacts nothing). */
  readonly conversations?: ConversationPort;
  /** OPTIONAL — defaults to `NoopNotificationPort` (surfaces nothing). */
  readonly notifications?: NotificationPort;
}

/**
 * The Messenger capability's public composition surface: the three
 * widened core Ports, resolved to either the caller's real adapter or a
 * safe Noop default. Every field is always present — a consumer never
 * needs to null-check.
 */
export interface Messenger {
  readonly messaging: MessagingPort;
  readonly conversations: ConversationPort;
  readonly notifications: NotificationPort;
}

/**
 * Constructs a `Messenger` from already-built Port implementations (or
 * safe Noop defaults for whichever are omitted). Performs no I/O itself —
 * purely an aggregation/default-resolution step. See this file's own
 * header for the `TransportPort`/`storage` scope limitations.
 */
export function createMessenger(deps: MessengerDependencies = {}): Messenger {
  return {
    messaging: deps.messaging ?? new NoopMessagingPort(),
    conversations: deps.conversations ?? new NoopConversationPort(),
    notifications: deps.notifications ?? new NoopNotificationPort(),
  };
}
