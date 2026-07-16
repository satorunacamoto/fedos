/**
 * Secure Runtime Alpha 652 ("Conversation Mode Model") — Stage 2 of the
 * Alpha 641–680 Public Identity, Conversation Policy & Application
 * Runtime Integration Arc.
 *
 * A future-safe mode vocabulary — `"private-group"`/`"direct"` are
 * named here so a future Arc has a fixed vocabulary to implement
 * against, NOT because either is supported. This Arc's own Application
 * Runtime (`FedosBoardRuntime`, `startFedosDesktopRuntime()`) accepts
 * and constructs `"public"` only — every `FedosConversationPolicyAuthority`
 * this Arc ships resolves `"public"` exclusively, and
 * `validateFedosConversationPolicy()` (`./fedos_conversation_policy.ts`)
 * rejects any other `mode` value, fail-closed.
 *
 * Deliberately NOT modeled as separate axes here (Alpha 652's own
 * required rules):
 *   - no `isPrivate: boolean` — a mode is not a single yes/no toggle.
 *   - "invite-only" is not automatically a mode — it is a
 *     `writeAccess`/`inviteAuthority` axis question, independent of
 *     `mode` (see `./fedos_conversation_policy.ts`).
 *   - "encrypted" is not a mode — encryption is a transport/storage
 *     concern this Arc never implements (Absolute Prohibitions).
 *   - "discoverable" is not a mode — it is the `discoverability` axis.
 */
export type FedosConversationMode = "public" | "private-group" | "direct";

/** The only mode this Arc's Application Runtime ever constructs or accepts. */
export const FEDOS_CONVERSATION_MODE_V1_SUPPORTED: FedosConversationMode = "public";
