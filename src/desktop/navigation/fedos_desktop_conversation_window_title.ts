/**
 * Secure Runtime Alpha 4181-4260 ("Desktop Conversation Window and
 * Navigation Arc") — Phase B: Window Title Generation.
 *
 * A pure derivation from a `FedosConversationNavigationState`
 * (`./fedos_desktop_conversation_navigation_state.js`) plus, when open, the
 * already-loaded `FedosConversationDetailView` (Shell's own view shape,
 * `../shell/fedos_desktop_shell_view_models.js`) — never a Shell/Runtime
 * call of its own, never a re-derivation of anything the Shell/Content
 * Accessor didn't already compute. No plaintext message body is ever
 * read or referenced here — a title is derived ONLY from
 * membership/participant identifiers and conversation mode, both already
 * public-by-construction (see `FedosConversationParticipantReference`'s
 * own header).
 *
 * A Direct conversation's title is the OTHER active participant's
 * `publicIdentifier` (never the viewer's own — `viewerParticipant` is
 * supplied so this file can exclude it, never guessed). A Group
 * conversation's title is a participant count — no group display name
 * concept exists anywhere in this codebase to use instead.
 */

import type { FedosConversationNavigationState } from "./fedos_desktop_conversation_navigation_state.js";
import type { FedosConversationDetailView } from "../shell/fedos_desktop_shell_view_models.js";
import type { FedosConversationParticipantReference } from "../../conversation/membership/fedos_conversation_participant_reference.js";

const APP_TITLE = "FedOS";

function participantsEqual(a: FedosConversationParticipantReference, b: FedosConversationParticipantReference): boolean {
  return a.authority === b.authority && a.publicIdentifier === b.publicIdentifier;
}

/** The conversation-specific portion of a title, or `null` when this detail carries nothing title-worthy yet (should not normally happen once `"open"`, but this file never assumes — a `null` here means the caller falls back to the app title alone). */
export function fedosConversationTitle(detail: FedosConversationDetailView, viewerParticipant: FedosConversationParticipantReference): string | null {
  const activeOthers = detail.memberships.filter((m) => m.state === "active" && !participantsEqual(m.participant, viewerParticipant));
  if (detail.mode === "direct") {
    const other = activeOthers[0];
    return other === undefined ? null : other.participant.publicIdentifier;
  }
  const totalActive = detail.memberships.filter((m) => m.state === "active").length;
  return `Group (${totalActive} member${totalActive === 1 ? "" : "s"})`;
}

/**
 * The FULL window title for a window currently in `state`. `detail` is
 * required only for `"open"` — pass the `FedosConversationDetailView` the
 * Controller already loaded for that conversation id (never re-fetched
 * here). Every other state kind ("empty"/"opening"/"open-failed") never
 * needs one, and this function never calls Shell/Runtime to get one on
 * its own.
 */
export function fedosDesktopConversationWindowTitle(
  state: FedosConversationNavigationState,
  detail: FedosConversationDetailView | null,
  viewerParticipant: FedosConversationParticipantReference,
): string {
  switch (state.kind) {
    case "empty":
      return APP_TITLE;
    case "opening":
      return `Opening… — ${APP_TITLE}`;
    case "open-failed":
      return `Unavailable — ${APP_TITLE}`;
    case "open": {
      if (detail === null) return APP_TITLE;
      const conversationTitle = fedosConversationTitle(detail, viewerParticipant);
      return conversationTitle === null ? APP_TITLE : `${conversationTitle} — ${APP_TITLE}`;
    }
  }
}
