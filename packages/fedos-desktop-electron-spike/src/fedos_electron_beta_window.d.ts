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
 * Secure Runtime Alpha 7001-7080 — the closed, ACCEPTANCE-MODE-ONLY
 * command vocabulary (Phase C). Every method rejects with
 * `{outcome:"unavailable"}` unless the packaged process was launched with
 * `FEDOS_ELECTRON_BETA_AUTOTEST` set (`fedos_electron_beta_main.cts`'s own
 * `requireShell()`) — never reachable in ordinary packaged production
 * mode, proven by `secure_runtime_alpha_7001_7080_structural_guards.test.ts`.
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
}

interface Window {
  readonly fedosProfile: FedosProfileBridge;
  readonly fedosBeta: FedosBetaBridge;
  readonly fedosAcceptance: FedosAcceptanceBridge;
}
