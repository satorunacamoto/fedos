/**
 * Secure Runtime Alpha 6121–6200 (FedOS Identity Replacement User
 * Verification and Conversation Continuity UI Arc) — Phase N: navigation
 * state owner. Mirrors `FedosDeletionRequestNavigationState`'s own
 * established shape exactly — plain, in-memory, non-durable; a real
 * restart of the process ALWAYS resets to `"inbox"`, never resumes a
 * stale screen. Durable FACTS (which transition is in what state) come
 * entirely from the Runtime's own real persistence; only "which screen
 * is currently shown" lives here.
 *
 * This is its OWN sibling navigation state — there is no shared,
 * centralized Navigation Registry in this codebase to extend (confirmed
 * by inspection of `device_management`/`deletion_request`'s own
 * precedent); a second, shared registry is never created here either.
 */
export type FedosIdentityTransitionScreen =
  | "inbox"
  | "detail"
  | "evidence"
  | "manual-verification"
  | "continuity"
  | "ratchet-reset";

const SCREENS: readonly FedosIdentityTransitionScreen[] = ["inbox", "detail", "evidence", "manual-verification", "continuity", "ratchet-reset"];

export function isFedosIdentityTransitionScreen(value: unknown): value is FedosIdentityTransitionScreen {
  return typeof value === "string" && (SCREENS as readonly string[]).includes(value);
}

export class FedosIdentityTransitionNavigationState {
  #screen: FedosIdentityTransitionScreen = "inbox";
  #returnScreen: FedosIdentityTransitionScreen | null = null;
  /** The canonical transition ID only — never a secret, never a raw payload (Phase N's own requirement). */
  #selectedTransitionId: string | null = null;

  get screen(): FedosIdentityTransitionScreen {
    return this.#screen;
  }

  get selectedTransitionId(): string | null {
    return this.#selectedTransitionId;
  }

  /** Fail-closed: an unrecognized screen is refused, no state change, never a thrown exception. */
  goto(screen: unknown): boolean {
    if (!isFedosIdentityTransitionScreen(screen)) return false;
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

  selectTransition(transitionId: unknown, screen: FedosIdentityTransitionScreen = "detail"): boolean {
    if (typeof transitionId !== "string" || transitionId.trim().length === 0) return false;
    this.#selectedTransitionId = transitionId;
    return this.goto(screen);
  }

  /** A missing/expired/superseded selected transition is handled by the CALLER (the Controller re-checks the Runtime's own current state on every navigation); this method only clears the stale selection so a fresh navigation can begin cleanly — this is "stale transition refresh" (Phase N's own requirement). */
  clearSelection(): void {
    this.#selectedTransitionId = null;
  }
}
