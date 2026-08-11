/**
 * Secure Runtime Alpha 3401-3480 — Membership Renderer.
 *
 * Consumes `FedosDesktopMembershipViewModel` ONLY -- both of its facets
 * (`.state` for creator/memberships, `.invitations` for issued invitation
 * descriptors) map to their own independent render models, mirroring the
 * ViewModel's own "two separate Shell calls, two separate lifecycles"
 * shape one layer down.
 */

import type { FedosDesktopMembershipViewModel, FedosDesktopMembershipListView } from "../presentation/fedos_desktop_membership_view_model.js";
import type { FedosConversationMembership } from "../../conversations/membership/fedos_conversation_membership.js";
import type { FedosConversationParticipantReference } from "../../conversations/membership/fedos_conversation_participant_reference.js";
import type { FedosIssuedInvitationView } from "../shell/fedos_desktop_shell_view_models.js";
import { fedosRenderModel, fedosRenderList, type FedosDesktopRenderModel, type FedosDesktopRenderList } from "./fedos_desktop_render_model.js";

export interface FedosDesktopMembershipRenderContent {
  readonly creator: FedosConversationParticipantReference;
  readonly members: FedosDesktopRenderList<FedosConversationMembership>;
}

export interface FedosDesktopMembershipRenderModel {
  readonly membership: FedosDesktopRenderModel<FedosDesktopMembershipRenderContent>;
  readonly invitations: FedosDesktopRenderModel<FedosDesktopRenderList<FedosIssuedInvitationView>>;
}

function toMembershipContent(data: FedosDesktopMembershipListView): FedosDesktopMembershipRenderContent {
  return Object.freeze({ creator: data.creator, members: fedosRenderList(data.memberships) });
}

export class FedosDesktopMembershipRenderer {
  readonly #viewModel: FedosDesktopMembershipViewModel;

  constructor(viewModel: FedosDesktopMembershipViewModel) {
    this.#viewModel = viewModel;
  }

  render(): FedosDesktopMembershipRenderModel {
    return Object.freeze({
      membership: fedosRenderModel(this.#viewModel.state, toMembershipContent),
      invitations: fedosRenderModel(this.#viewModel.invitations, (items) => fedosRenderList(items)),
    });
  }
}
