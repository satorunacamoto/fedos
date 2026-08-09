/**
 * Secure Runtime Alpha 6201-6280 (FedOS Desktop Beta Privacy Controls and
 * Safety Center Arc) — Phase K: navigation state owner, mirroring
 * `FedosIdentityTransitionNavigationState`'s own established shape exactly
 * — plain, in-memory, non-durable. A restart ALWAYS resets to `"overview"`,
 * never resumes a stale section (Phase K's own "restart-safe default
 * section" requirement). This is its own sibling navigation state — no
 * shared, centralized Navigation Registry exists in this codebase to
 * extend, and none is created here.
 *
 * One instance per Boundary/window — since each Desktop window composes its
 * own Boundary (unchanged by this Arc), multiple windows naturally get
 * independent navigation state (Phase K's own "multi-window isolation").
 */
import { isFedosSafetyCenterSection, type FedosSafetyCenterSection } from "./fedos_safety_center_state.js";

/** The one action this whole domain can ever require an explicit confirmation for — mirrors Phase F/G's own "every dangerous action requires explicit confirmation state" requirement. Never a generic execute/mutate descriptor. */
export type FedosSafetyCenterConfirmableAction =
  | { readonly kind: "revoke-device"; readonly deviceId: string; readonly devicePublicKeyHex: string }
  | { readonly kind: "authorize-ratchet-reset"; readonly conversationId: string; readonly remoteDeviceRef: string };

export class FedosSafetyCenterNavigationState {
  #section: FedosSafetyCenterSection = "overview";
  #returnSection: FedosSafetyCenterSection | null = null;
  #pendingConfirmation: FedosSafetyCenterConfirmableAction | null = null;

  get section(): FedosSafetyCenterSection {
    return this.#section;
  }

  get pendingConfirmation(): FedosSafetyCenterConfirmableAction | null {
    return this.#pendingConfirmation;
  }

  /** Fail-closed: an unrecognized section is refused, no state change. */
  goto(section: unknown): boolean {
    if (!isFedosSafetyCenterSection(section)) return false;
    if (section === this.#section) return true;
    this.#returnSection = this.#section;
    this.#section = section;
    return true;
  }

  goBack(): boolean {
    if (this.#returnSection === null) return false;
    const target = this.#returnSection;
    this.#returnSection = null;
    this.#section = target;
    return true;
  }

  /** Opens the Safety Confirmation Dialog for one specific dangerous action — never a generic "confirm anything" descriptor. */
  requestConfirmation(action: FedosSafetyCenterConfirmableAction): void {
    this.#pendingConfirmation = action;
  }

  clearConfirmation(): void {
    this.#pendingConfirmation = null;
  }
}
