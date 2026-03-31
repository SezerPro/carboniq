import QRCode from "qrcode";

/**
 * Generate a QR code as a PNG Buffer.
 */
export async function generateQRCodeBuffer(url: string): Promise<Buffer> {
  return QRCode.toBuffer(url, {
    type: "png",
    width: 200,
    margin: 1,
    color: { dark: "#2C2825", light: "#FFFFFF" },
  });
}

/**
 * Generate a QR code as a data URL (base64 PNG) for embedding in PDFs/HTML.
 */
export async function generateQRCodeDataUrl(url: string): Promise<string> {
  return QRCode.toDataURL(url, {
    type: "image/png",
    width: 200,
    margin: 1,
    color: { dark: "#2C2825", light: "#FFFFFF" },
  });
}
