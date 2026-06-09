// Type declaration for the `qrcode/lib/browser.js` subpath import.
//
// We import this subpath (instead of the package's main `qrcode` entry) on
// purpose: the main Node entry (`qrcode/lib/server.js`) statically
// `require()`s the PNG renderer, which pulls in `pngjs` (~1 MiB unpacked).
// That dependency was being bundled into the Cloudflare Worker and pushed it
// over the 10 MiB compressed size limit. The browser entry only wires up the
// SVG + canvas renderers (no `pngjs`), and its `toString()` produces an SVG
// string without needing a DOM — perfect for generating a QR data URL on the
// edge. See src/app/api/checkin/qr-generate/route.ts.
declare module "qrcode/lib/browser.js" {
  import type { QRCodeToStringOptions, QRCodeToDataURLOptions, QRCodeSegment } from "qrcode";

  // SVG string output (DOM-free) — used server-side in the qr-generate route.
  export function toString(
    text: string | QRCodeSegment[],
    options?: QRCodeToStringOptions,
  ): Promise<string>;

  // Canvas-based data URL — used client-side (browser) in celebration-page.
  export function toDataURL(
    text: string | QRCodeSegment[],
    options?: QRCodeToDataURLOptions,
  ): Promise<string>;

  const _default: {
    toString: typeof toString;
    toDataURL: typeof toDataURL;
  };
  export default _default;
}
