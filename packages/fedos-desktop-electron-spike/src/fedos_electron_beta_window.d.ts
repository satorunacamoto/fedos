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

interface Window {
  readonly fedosProfile: FedosProfileBridge;
  readonly fedosBeta: FedosBetaBridge;
}
