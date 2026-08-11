/**
 * Trust — QR image/matrix rendering.
 *
 * Renders the deterministic text produced by
 * `fedos_trust_qr_text_codec.ts`'s `encodeFedosTrustEnvelopeToQrText()` as an
 * actual QR code (PNG data URL and/or a terminal-friendly string). This file
 * is purely a presentation layer over that text codec — it holds no
 * signing/verification logic of its own (see this directory's header
 * comment in `fedos_trust_qr_text_codec.ts` for the full transport-not-a-
 * security-primitive rationale).
 *
 * Uses the `qrcode` package (MIT, ~40M weekly downloads) — confirmed via
 * `grep -ri "qrcode|jsqr|qr-scanner" package.json packages/*\/package.json`
 * that this repository had no existing QR-capable dependency before this
 * file. `qrcode` is the ONE new runtime dependency this Trust QR module
 * adds. Typed via `@types/qrcode` (a devDependency; confirmed present on
 * the npm registry, so no hand-written ambient `.d.ts` was needed).
 */

import QRCode from "qrcode";
import { FEDOS_TRUST_MAX_CANONICAL_ENVELOPE_LENGTH } from "../fedos_trust_limits.js";

export interface FedosTrustQrImageEncodeResult {
  readonly dataUrl: string;
}

/** The port a caller depends on to turn QR text into a renderable image —
 * kept as an explicit interface (rather than callers importing `qrcode`
 * directly) so a caller can substitute a different renderer, or a stub in
 * tests, without depending on this file's third-party library choice. */
export interface FedosTrustQrImageEncoderPort {
  encode(text: string): Promise<FedosTrustQrImageEncodeResult>;
}

/** Defensive re-check: this module never attempts to render QR text longer
 * than the shared envelope bound could plausibly produce (the text codec
 * itself already fails closed on oversized input before returning a string
 * here at all — this is belt-and-suspenders against a caller who bypasses
 * the codec and hands this function an arbitrary string). Sized generously
 * relative to `FEDOS_TRUST_MAX_CANONICAL_ENVELOPE_LENGTH` to cover the
 * `"fedos:trust:v1:"` prefix and base64url's ~4/3 expansion. */
const FEDOS_TRUST_QR_RENDER_MAX_TEXT_LENGTH = Math.ceil((FEDOS_TRUST_MAX_CANONICAL_ENVELOPE_LENGTH * 2 * 4) / 3) + 64;

function assertRenderableQrText(text: string): void {
  if (typeof text !== "string" || text.length === 0) {
    throw new RangeError("fedos trust qr image: text must be a non-empty string");
  }
  if (text.length > FEDOS_TRUST_QR_RENDER_MAX_TEXT_LENGTH) {
    throw new RangeError("fedos trust qr image: text exceeds max renderable length");
  }
}

/**
 * Renders `text` (normally the output of `encodeFedosTrustEnvelopeToQrText`)
 * as a PNG data URL suitable for `<img src="...">`.
 */
export async function renderFedosTrustQrTextToPngDataUrl(text: string): Promise<string> {
  assertRenderableQrText(text);
  return QRCode.toDataURL(text, { errorCorrectionLevel: "M" });
}

/**
 * Renders `text` as a terminal-friendly QR string (for CLI/offline-issuer
 * tooling that prints a scannable code directly to a console).
 */
export async function renderFedosTrustQrTextToTerminalString(text: string): Promise<string> {
  assertRenderableQrText(text);
  return QRCode.toString(text, { type: "terminal" });
}

/** The default `FedosTrustQrImageEncoderPort` implementation, backed by the
 * `qrcode` package. */
export const fedosTrustQrImageEncoder: FedosTrustQrImageEncoderPort = {
  async encode(text: string): Promise<FedosTrustQrImageEncodeResult> {
    const dataUrl = await renderFedosTrustQrTextToPngDataUrl(text);
    return { dataUrl };
  },
};
