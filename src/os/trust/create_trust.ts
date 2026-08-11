/**
 * Trust — the capability factory, following `createMessenger()`/
 * `createCommerce()`'s own shape (`docs/architecture/ADDING-A-CAPABILITY.md`).
 *
 * Unlike Messenger/Commerce, Trust has no messaging/storage/notification
 * Port dependency — every domain module (`envelope/`, `entitlement/`,
 * `credentials/`, `possession/`, `capabilities/`, `qr/`, `contracts/`,
 * `issuer/`) is a set of pure functions plus one small opaque signing-key
 * handle. The only genuinely swappable seams are:
 *   - `clock` — for deterministic tests / non-system-time verification,
 *     already the injectable `FedosTrustClock` type (`envelope/fedos_trust_clock.js`).
 *   - `qrImageEncoder` — `FedosTrustQrImageEncoderPort`, in case a host
 *     application wants to substitute a different QR rendering backend.
 *
 * SAFE DEFAULTS ONLY: calling `createTrust()` with zero arguments performs
 * zero I/O, contacts zero external service, and never throws. The default
 * `qrImageEncoder` uses the real `qrcode` package (this arc's own new
 * dependency) purely as a LOCAL, offline rendering library — it makes no
 * network call, matching the same "safe default" bar `NoopPaymentProvider`/
 * `NoopMarketplaceProvider` set for `os/commerce` (rendering an image
 * locally is not an unsafe default the way contacting a real payment rail
 * would be; there is no Noop-vs-real distinction meaningful here since the
 * encoder does no I/O in either case).
 */

import { defaultFedosTrustClock, type FedosTrustClock } from "./envelope/index.js";
import { fedosTrustQrImageEncoder, type FedosTrustQrImageEncoderPort } from "./qr/index.js";

export interface TrustDependencies {
  readonly clock?: FedosTrustClock;
  readonly qrImageEncoder?: FedosTrustQrImageEncoderPort;
}

export interface Trust {
  readonly clock: FedosTrustClock;
  readonly qrImageEncoder: FedosTrustQrImageEncoderPort;
}

export function createTrust(deps: TrustDependencies = {}): Trust {
  return {
    clock: deps.clock ?? defaultFedosTrustClock,
    qrImageEncoder: deps.qrImageEncoder ?? fedosTrustQrImageEncoder,
  };
}
