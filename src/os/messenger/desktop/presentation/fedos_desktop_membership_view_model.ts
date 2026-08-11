/**
 * Secure Runtime Alpha 3241-3320 — Membership ViewModel.
 *
 * The Shell has no standalone membership-listing method -- membership data
 * lives on `FedosConversationDetailView` (`getConversation()`) and issued
 * invitation descriptors come from the separate `issuedInvitations()` call.
 * This ViewModel composes exactly those two EXISTING Shell calls into one
 * presentation-ready shape; it adds no new authorization or membership
 * logic (both calls already enforce everything themselves).
 */

import type { FedosDesktopApplicationShell } from "../shell/fedos_desktop_application_shell.js";
import type { FedosConversationParticipantReference } from "../../conversations/membership/fedos_conversation_participant_reference.js";
import type { FedosConversationMembership } from "../../conversations/membership/fedos_conversation_membership.js";
import type { FedosIssuedInvitationView } from "../shell/fedos_desktop_shell_view_models.js";
import {
  fedosViewModelIdle,
  fedosViewModelLoading,
  fedosViewModelFromShellResult,
  type FedosDesktopViewModelState,
} from "./fedos_desktop_view_model_state.js";

export interface FedosDesktopMembershipListView {
  readonly creator: FedosConversationParticipantReference;
  readonly memberships: readonly FedosConversationMembership[];
}

export class FedosDesktopMembershipViewModel {
  readonly #shell: FedosDesktopApplicationShell;
  #state: FedosDesktopViewModelState<FedosDesktopMembershipListView> = fedosViewModelIdle();
  #invitations: FedosDesktopViewModelState<readonly FedosIssuedInvitationView[]> = fedosViewModelIdle();

  constructor(shell: FedosDesktopApplicationShell) {
    this.#shell = shell;
  }

  get state(): FedosDesktopViewModelState<FedosDesktopMembershipListView> {
    return this.#state;
  }

  get invitations(): FedosDesktopViewModelState<readonly FedosIssuedInvitationView[]> {
    return this.#invitations;
  }

  /** Loads creator + full membership list for one conversation, via `getConversation()`. */
  async load(conversationId: string): Promise<FedosDesktopViewModelState<FedosDesktopMembershipListView>> {
    this.#state = fedosViewModelLoading();
    const result = this.#shell.getConversation(conversationId);
    this.#state = fedosViewModelFromShellResult(
      result.outcome === "ok"
        ? { outcome: "ok", value: { creator: result.value.creator, memberships: result.value.memberships } }
        : result,
    );
    return this.#state;
  }

  /** Loads invitations issued by `issuer` for one conversation -- a SEPARATE call, since `issuedInvitations()` is scoped by the caller's own claimed identity (never a caller-supplied override of anyone else's issuance). */
  async loadInvitations(
    conversationId: string,
    issuer: FedosConversationParticipantReference,
  ): Promise<FedosDesktopViewModelState<readonly FedosIssuedInvitationView[]>> {
    this.#invitations = fedosViewModelLoading();
    const result = this.#shell.issuedInvitations(conversationId, issuer);
    this.#invitations = fedosViewModelFromShellResult(result);
    return this.#invitations;
  }
}
