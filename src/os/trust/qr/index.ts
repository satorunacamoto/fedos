/**
 * Trust — `qr/` barrel. Internal to `os/trust`; the capability's own public
 * surface is `src/os/trust/index.ts`, not this file.
 */

export {
  FEDOS_TRUST_QR_TEXT_PREFIX,
  encodeFedosTrustEnvelopeToQrText,
  decodeFedosTrustEnvelopeFromQrText,
  type FedosTrustQrDecodeError,
  type FedosTrustEnvelopeType,
} from "./fedos_trust_qr_text_codec.js";

export {
  renderFedosTrustQrTextToPngDataUrl,
  renderFedosTrustQrTextToTerminalString,
  fedosTrustQrImageEncoder,
  type FedosTrustQrImageEncodeResult,
  type FedosTrustQrImageEncoderPort,
} from "./fedos_trust_qr_image.js";
