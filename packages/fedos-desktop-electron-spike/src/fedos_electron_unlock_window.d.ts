/**
 * Secure Runtime Alpha 4821-4900 — window type definitions (global ambient
 * declaration only, mirroring `fedos_electron_badge_window.d.ts`). Describes
 * the ONE value `fedos_electron_unlock_preload.cts` exposes via
 * `contextBridge.exposeInMainWorld` — a closed set of narrow async methods.
 *
 * The passphrase is ONLY ever an ARGUMENT to `create()`/`unlock()`; it is
 * never a return field and never appears in `status()`.
 */

/** The coarse, secret-free status the renderer uses to choose a screen. */
interface FedosProfileStatusResult {
  readonly presence: string;
  readonly lifecycleState: string;
  readonly displayLabel: string | null;
  readonly accountPublicIdentifier: string | null;
  readonly localDeviceId: string | null;
  readonly runtimeRunning: boolean;
}

/** The coarse, secret-free outcome of a create/unlock/lock command. */
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

interface Window {
  readonly fedosProfile: FedosProfileBridge;
}
