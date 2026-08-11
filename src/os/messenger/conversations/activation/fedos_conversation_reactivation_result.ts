/**
 * Secure Runtime Alpha 2041–2120 ("Conversation Identity Restoration and
 * Reactivation Arc") — the closed, coarse result vocabulary for
 * `FedosConversationReactivationCoordinator.reactivateRestoredConversation()`
 * (`./fedos_conversation_reactivation_coordinator.ts`), mirroring
 * `FedosConversationDirectActivationResult`'s own "coarse, closed, stable
 * outcomes only — no raw `Error`, no provider message" discipline (Alpha
 * 1118).
 *
 * A `"direct"` id resolves to exactly one of `"reactivated"` (a Draft
 * and/or Activation fact was newly written this call) or
 * `"already-active"` (both already existed — a pure, non-mutating repeat
 * call, Alpha 1122's own "already-active" precedent reused verbatim). A
 * `"private-group"` id never itself becomes "active" (Alpha 1123's own
 * frozen Private-Group Gate — a Group id is never activated) — its own
 * outcome instead carries a per-child breakdown, one
 * `FedosConversationReactivationChildOutcome` per distinct pairwise child
 * Direct Conversation the Group's restored Paths reference, so a caller can
 * see exactly which children were reactivated versus legitimately skipped
 * (e.g. `"not-member"` for a child the local identity was never a party
 * to) without any single failing child ever aborting the others — mirrors
 * the archive restore's own "every domain's own loop is independent"
 * discipline (`docs/secure_runtime_alpha_1921_1980_completion_declaration.md`
 * §5).
 */

export type FedosConversationReactivationChildOutcome =
  | "reactivated"
  | "already-active"
  | "not-member"
  | "creator-unresolvable"
  | "invalid-restored-state"
  | "persistence-failed"
  | "activation-failed";

export type FedosConversationReactivationResult =
  | { readonly outcome: "reactivated"; readonly mode: "direct" }
  | { readonly outcome: "already-active"; readonly mode: "direct" }
  | {
      readonly outcome: "reactivated";
      readonly mode: "private-group";
      readonly children: ReadonlyMap<string, FedosConversationReactivationChildOutcome>;
    }
  | { readonly outcome: "conversation-not-found" }
  | { readonly outcome: "identity-unavailable" }
  | { readonly outcome: "unauthorized" }
  | { readonly outcome: "creator-unresolvable" }
  | { readonly outcome: "invalid-restored-state" }
  | { readonly outcome: "persistence-failed" }
  | { readonly outcome: "activation-failed"; readonly detail: string };
