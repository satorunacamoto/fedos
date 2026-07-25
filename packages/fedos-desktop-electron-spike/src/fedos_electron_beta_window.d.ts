/**
 * Secure Runtime Alpha 5061-5160 — window type definitions (global ambient
 * declaration only). Describes the TWO values `fedos_electron_beta_preload.cts`
 * exposes via `contextBridge.exposeInMainWorld`.
 *
 * `FedosProfileBridge` mirrors `fedos_electron_unlock_window.d.ts` exactly
 * (Phase P reuse — same shape, same channels underneath).
 */

interface FedosProfileStatusResult {
  readonly presence: string;
  readonly lifecycleState: string;
  readonly displayLabel: string | null;
  readonly accountPublicIdentifier: string | null;
  readonly localDeviceId: string | null;
  readonly runtimeRunning: boolean;
}

interface FedosProfileCommandResult {
  readonly outcome: string;
  readonly reason?: string;
  readonly ready?: {
    readonly displayLabel: string;
    readonly accountPublicIdentifier: string;
    readonly localDeviceId: string;
    readonly deviceTrustState: string;
  };
}

interface FedosProfileBridge {
  readonly status: () => Promise<FedosProfileStatusResult>;
  readonly create: (label: string, passphrase: string) => Promise<FedosProfileCommandResult>;
  readonly unlock: (passphrase: string) => Promise<FedosProfileCommandResult>;
  readonly lock: () => Promise<FedosProfileCommandResult>;
  readonly quit: () => Promise<{ readonly ok: boolean }>;
}

/** The Phase H Beta Home status surface — real, non-secret facts only (see `fedos_desktop_beta_*` value objects, `src/desktop/beta/`). */
interface FedosBetaStatusResult {
  readonly profile: FedosProfileStatusResult;
  readonly settingsEffectiveState: unknown;
  readonly capabilities: unknown;
  readonly release: unknown;
  readonly limitations: unknown;
}

interface FedosBetaBridge {
  readonly status: () => Promise<FedosBetaStatusResult>;
  readonly settingsPlan: (candidate: unknown) => Promise<unknown>;
  readonly settingsApply: (candidate: unknown) => Promise<unknown>;
}

/**
 * Secure Runtime Alpha 7001-7080 — the closed `fedos-acceptance:*` command
 * vocabulary (Phase C); EXTENDED by Secure Runtime Alpha 7321-7400 with
 * `createConversationInvitation`/`search`/`archive`/`safetyCenterOverview`.
 * Every method rejects with `{outcome:"unavailable"}` whenever no real
 * profile is currently unlocked (`fedos_electron_beta_main.cts`'s own
 * `requireShell()`/`requireBoundary()`) — the SAME real precondition every
 * other bridge in this file already requires. Genuinely reachable in
 * ordinary packaged production mode once a real profile is unlocked
 * (Secure Runtime Alpha 7321-7400 closed the prior AUTOTEST-only gate —
 * see `secure_runtime_alpha_7321_7400_structural_guards.test.ts`).
 */
interface FedosAcceptanceCommandResult {
  readonly outcome: string;
  readonly reason?: string;
  readonly [key: string]: unknown;
}

interface FedosAcceptanceBridge {
  readonly createDirectConversation: (recipient: { readonly authority: string; readonly publicIdentifier: string }) => Promise<FedosAcceptanceCommandResult>;
  readonly activateDirectConversation: (conversationId: string) => Promise<FedosAcceptanceCommandResult>;
  readonly devicePairingCreate: (deviceId: string, expectedAccountRef: unknown) => Promise<FedosAcceptanceCommandResult>;
  readonly devicePairingInspect: (encodedRequest: string) => Promise<FedosAcceptanceCommandResult>;
  readonly devicePairingApprove: (encodedRequest: string) => Promise<FedosAcceptanceCommandResult>;
  readonly devicePairingComplete: (pairingId: string, encodedApproval: string) => Promise<FedosAcceptanceCommandResult>;
  readonly establishDirectRatchetSession: (conversationId: string, remoteDeviceRef: string) => Promise<FedosAcceptanceCommandResult>;
  readonly sendMessage: (conversationId: string, sender: unknown, body: string) => Promise<FedosAcceptanceCommandResult>;
  readonly listMessages: (conversationId: string) => Promise<FedosAcceptanceCommandResult>;
  readonly readMessage: (conversationId: string, messageId: string) => Promise<FedosAcceptanceCommandResult>;
  readonly directRatchetStatus: (conversationId: string, remoteDeviceRef: string) => Promise<FedosAcceptanceCommandResult>;
  /** Secure Runtime Alpha 7321-7400 — closes Release Readiness Review B-2. */
  readonly createConversationInvitation: (invitee: { readonly authority: string; readonly publicIdentifier: string }, expiresInMs?: number) => Promise<FedosAcceptanceCommandResult>;
  /** Secure Runtime Alpha 7321-7400 — closes Release Readiness Review B-7 (Search). */
  readonly search: (query: string) => Promise<FedosAcceptanceCommandResult>;
  /** Secure Runtime Alpha 7321-7400 — closes Release Readiness Review B-7 (Archive). */
  readonly archive: (command: unknown) => Promise<FedosAcceptanceCommandResult>;
  /** Secure Runtime Alpha 7321-7400 — closes Release Readiness Review B-7 (Safety Center). */
  readonly safetyCenterOverview: () => Promise<FedosAcceptanceCommandResult>;
}

/**
 * Secure Runtime Alpha 8041-8120 (FedOS Desktop Beta User-Facing Product UI
 * Completion Arc) — the ORDINARY, user-facing command vocabulary. Every
 * method is reachable in ordinary packaged production mode once a real
 * profile is unlocked, gated by the SAME `requireShell()`/`requireBoundary()`
 * precondition every other bridge already uses. This is the ONLY bridge
 * `fedos_electron_beta_renderer.ts` may call for Conversations/Search/
 * Archive/Devices/Identity Replacement/Signed Deletion/Safety Center/
 * Settings — `fedosAcceptance` remains reachable only by the pre-existing
 * acceptance-mode test harness.
 */
interface FedosAppCommandResult {
  readonly outcome: string;
  readonly reason?: string;
  readonly [key: string]: unknown;
}

interface FedosAppBridge {
  readonly conversationsList: () => Promise<FedosAppCommandResult>;
  readonly conversationOpen: (conversationId: string) => Promise<FedosAppCommandResult>;
  readonly conversationActivate: (conversationId: string) => Promise<FedosAppCommandResult>;
  readonly messagesList: (conversationId: string) => Promise<FedosAppCommandResult>;
  readonly messageReveal: (messageId: string) => Promise<FedosAppCommandResult>;
  readonly messageSend: (conversationId: string, body: string) => Promise<FedosAppCommandResult>;
  readonly membershipList: (conversationId: string) => Promise<FedosAppCommandResult>;
  readonly invitationsList: (conversationId: string) => Promise<FedosAppCommandResult>;
  readonly createInvitation: (invitee: { readonly authority: string; readonly publicIdentifier: string }, expiresInMs?: number) => Promise<FedosAppCommandResult>;
  readonly search: (query: string) => Promise<FedosAppCommandResult>;
  readonly archiveInspect: (sourcePath: string) => Promise<FedosAppCommandResult>;
  readonly archiveExport: (request: unknown) => Promise<FedosAppCommandResult>;
  readonly archivePreflightRestore: (request: unknown) => Promise<FedosAppCommandResult>;
  readonly archiveRestore: (request: unknown) => Promise<FedosAppCommandResult>;
  readonly archiveWorkflowWarnings: (operation: "inspect" | "preflightRestore" | "export" | "restore") => Promise<FedosAppCommandResult>;
  readonly archiveChooseExportDestination: (conversationId: string) => Promise<{ readonly outcome: string; readonly path?: string }>;
  readonly archiveChooseSource: () => Promise<{ readonly outcome: string; readonly path?: string }>;
  readonly devicesList: () => Promise<FedosAppCommandResult>;
  readonly deviceDetail: (deviceId: string) => Promise<FedosAppCommandResult>;
  readonly deviceRevoke: (deviceId: string, devicePublicKeyHex: string) => Promise<FedosAppCommandResult>;
  readonly deviceSyncStatus: () => Promise<FedosAppCommandResult>;
  readonly devicePairingCreate: (deviceId: string, expectedAccountRef: unknown) => Promise<FedosAppCommandResult>;
  readonly devicePairingInspect: (encodedRequest: string) => Promise<FedosAppCommandResult>;
  readonly devicePairingApprove: (encodedRequest: string) => Promise<FedosAppCommandResult>;
  readonly devicePairingComplete: (pairingId: string, encodedApproval: string) => Promise<FedosAppCommandResult>;
  readonly identityTransitionList: (limit?: number, offset?: number) => Promise<FedosAppCommandResult>;
  readonly identityTransitionOpen: (peerAccountRef: unknown, peerDeviceRef: string, transitionId: string) => Promise<FedosAppCommandResult>;
  readonly identityTransitionAccept: () => Promise<FedosAppCommandResult>;
  readonly identityTransitionReject: () => Promise<FedosAppCommandResult>;
  readonly identityTransitionDefer: () => Promise<FedosAppCommandResult>;
  readonly identityTransitionRecordManualVerification: (method: string, noteCode: string) => Promise<FedosAppCommandResult>;
  readonly deletionRequestListReceived: () => Promise<FedosAppCommandResult>;
  readonly deletionRequestOpen: (requestId: string) => Promise<FedosAppCommandResult>;
  readonly deletionRequestApprove: () => Promise<FedosAppCommandResult>;
  readonly deletionRequestReject: () => Promise<FedosAppCommandResult>;
  readonly safetyCenterOverview: () => Promise<FedosAppCommandResult>;
  readonly settingsLoad: () => Promise<FedosAppCommandResult>;
}

interface Window {
  readonly fedosProfile: FedosProfileBridge;
  readonly fedosBeta: FedosBetaBridge;
  readonly fedosAcceptance: FedosAcceptanceBridge;
  readonly fedosApp: FedosAppBridge;
}
