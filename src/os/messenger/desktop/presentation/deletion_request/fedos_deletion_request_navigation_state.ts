/**
 * Secure Runtime Alpha 6041-6120 (FedOS Signed Deletion Request Multi-Device
 * Aggregation and User Consent UI Arc) — Phase J: navigation state owner.
 * Mirrors `FedosDeviceManagementNavigationState`'s own established shape
 * exactly — plain, in-memory, non-durable; a real restart of the process
 * ALWAYS resets to `"sent-list"`, never resumes a stale screen. Durable
 * FACTS (which request is in what state) come entirely from the Runtime's
 * own real persistence; only "which screen is currently shown" lives here.
 */
export type FedosDeletionRequestScreen = "sent-list" | "received-inbox" | "request-detail" | "consent-detail" | "device-status";

const SCREENS: readonly FedosDeletionRequestScreen[] = ["sent-list", "received-inbox", "request-detail", "consent-detail", "device-status"];

export function isFedosDeletionRequestScreen(value: unknown): value is FedosDeletionRequestScreen {
  return typeof value === "string" && (SCREENS as readonly string[]).includes(value);
}

export class FedosDeletionRequestNavigationState {
  #screen: FedosDeletionRequestScreen = "sent-list";
  #returnScreen: FedosDeletionRequestScreen | null = null;
  #selectedRequestId: string | null = null;

  get screen(): FedosDeletionRequestScreen {
    return this.#screen;
  }

  get selectedRequestId(): string | null {
    return this.#selectedRequestId;
  }

  /** Fail-closed: an unrecognized screen is refused, no state change, never a thrown exception. */
  goto(screen: unknown): boolean {
    if (!isFedosDeletionRequestScreen(screen)) return false;
    if (screen === this.#screen) return true;
    this.#returnScreen = this.#screen;
    this.#screen = screen;
    return true;
  }

  goBack(): boolean {
    if (this.#returnScreen === null) return false;
    const target = this.#returnScreen;
    this.#returnScreen = null;
    this.#screen = target;
    return true;
  }

  /** The route parameter is always the canonical, opaque `requestId` — never a secret, never a raw path (Phase J's own requirement). Refused for an empty/non-string id. */
  selectRequest(requestId: unknown, screen: FedosDeletionRequestScreen = "request-detail"): boolean {
    if (typeof requestId !== "string" || requestId.trim().length === 0) return false;
    this.#selectedRequestId = requestId;
    return this.goto(screen);
  }

  /** A missing/expired selected request is handled by the CALLER (the controller checks the Runtime's own current state); this method only clears the stale selection so a fresh navigation can begin cleanly. */
  clearSelection(): void {
    this.#selectedRequestId = null;
  }
}
