/**
 * Secure Runtime Alpha 4261-4340 — Phase B: Desktop Notification Boundary,
 * Coordinator.
 *
 * `FedosDesktopNotificationCoordinator` is orchestration ONLY — validates a
 * candidate request against the closed vocabulary (`./fedos_desktop_notification_types.ts`),
 * denies (fails closed) anything sensitive-looking or malformed, resolves
 * the fixed per-kind template, and delegates actual delivery to whatever
 * `FedosDesktopNotificationPort` it was constructed with. It holds no
 * persistence, no crypto, no transport, and no Electron import of any kind.
 *
 * In-memory-only bookkeeping (delivered/denied counters, last outcome) —
 * mirrors `FedosDesktopViewModelState`'s own "local presentation state is
 * never durable" guardrail one layer further out; nothing here is written
 * to any log or file (Phase B/D "No new persistence format").
 */

import {
  fedosDesktopNotificationRequestLooksSensitive,
  fedosDesktopNotificationViewFrom,
  validateFedosDesktopNotificationRequest,
  type FedosDesktopNotificationView,
} from "./fedos_desktop_notification_types.js";
import type { FedosDesktopNotificationPort } from "./fedos_desktop_notification_port.js";

export type FedosDesktopNotificationOutcomeState = "delivered" | "denied" | "unavailable" | "rejected" | "error";

export interface FedosDesktopNotificationOutcome {
  readonly state: FedosDesktopNotificationOutcomeState;
  /** Non-sensitive explanation. Never echoes request content. */
  readonly reason: string;
  /** The resolved view this outcome is about — `null` only for a `"rejected"` (malformed/sensitive) request, which never reaches template resolution. */
  readonly notification: FedosDesktopNotificationView | null;
}

function outcome(state: FedosDesktopNotificationOutcomeState, reason: string, notification: FedosDesktopNotificationView | null): FedosDesktopNotificationOutcome {
  return Object.freeze({ state, reason, notification });
}

export class FedosDesktopNotificationCoordinator {
  readonly #port: FedosDesktopNotificationPort;
  readonly #clock: () => number;
  #deliveredCount = 0;
  #deniedCount = 0;
  #lastOutcome: FedosDesktopNotificationOutcome | null = null;

  constructor(port: FedosDesktopNotificationPort, clock: () => number = () => Math.floor(Date.now() / 1000)) {
    this.#port = port;
    this.#clock = clock;
  }

  get lastOutcome(): FedosDesktopNotificationOutcome | null {
    return this.#lastOutcome;
  }

  get deliveredCount(): number {
    return this.#deliveredCount;
  }

  get deniedCount(): number {
    return this.#deniedCount;
  }

  /** Validates, resolves the fixed template, then attempts delivery through this Coordinator's own Port. Never throws — every branch returns a closed `FedosDesktopNotificationOutcome`. */
  async notify(candidate: unknown): Promise<FedosDesktopNotificationOutcome> {
    const validated = validateFedosDesktopNotificationRequest(candidate);
    if (validated === null) {
      return this.#record(outcome("rejected", "malformed or unrecognized notification request", null));
    }
    if (fedosDesktopNotificationRequestLooksSensitive(validated)) {
      // Fail closed on the WHOLE request -- never silently drops the sensitive field and sends anyway.
      return this.#record(outcome("rejected", "detail field looked sensitive; denied (fail closed)", null));
    }

    const view = fedosDesktopNotificationViewFrom(validated, this.#clock());

    if (this.#port.status() !== "available") {
      return this.#record(outcome("unavailable", "no notification backend is available", view));
    }

    try {
      const result = await this.#port.notify(view);
      return this.#record(outcome(result.delivered ? "delivered" : "denied", result.reason, view));
    } catch {
      // A genuine, unexpected exception from the Port -- never crosses this boundary (mirrors
      // FedosDesktopHostBridge's own "never a raw Error" discipline).
      return this.#record(outcome("error", "notification port failed unexpectedly", view));
    }
  }

  #record(result: FedosDesktopNotificationOutcome): FedosDesktopNotificationOutcome {
    this.#lastOutcome = result;
    if (result.state === "delivered") this.#deliveredCount += 1;
    else this.#deniedCount += 1;
    return result;
  }
}
