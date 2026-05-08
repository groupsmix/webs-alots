/**
 * A52.8: Strip EXIF/metadata from JPEG images before storage.
 *
 * Patient X-rays and clinical photos may contain DICOM-like metadata
 * revealing PII (patient name, date of birth, hospital ID, GPS coordinates).
 * This module removes all EXIF/APP1 segments from JPEG files while
 * preserving the image data intact.
 *
 * Approach: Walk the JPEG marker segments and drop APP1 (EXIF), APP13
 * (IPTC/Photoshop), and APP2 (ICC profile with embedded metadata) markers.
 * The SOI, DQT, DHT, SOF, SOS, and image data markers are preserved.
 *
 * This is a zero-dependency implementation suitable for Cloudflare Workers
 * (no Node.js-specific APIs like sharp or canvas required).
 *
 * For PNG and WebP, metadata stripping would require re-encoding which is
 * beyond the scope of this lightweight stripper. Those formats rarely carry
 * PII metadata in clinical workflows.
 */

/**
 * Check if a buffer is a valid JPEG (starts with SOI marker FF D8).
 */
function isJpeg(buf: Uint8Array): boolean {
  return buf.length >= 2 && buf[0] === 0xff && buf[1] === 0xd8;
}

/**
 * Strip EXIF and other metadata segments from a JPEG buffer.
 *
 * Returns a new Buffer with APP1 (EXIF), APP2 (ICC/FlashPix), APP12,
 * APP13 (IPTC), and COM (comment) segments removed.
 *
 * If the input is not a valid JPEG or is too small to contain metadata,
 * the original buffer is returned unchanged.
 */
export function stripJpegMetadata(input: Buffer<ArrayBuffer>): Buffer<ArrayBuffer> {
  const buf = new Uint8Array(input);

  if (!isJpeg(buf) || buf.length < 4) {
    return input;
  }

  // Markers we want to strip (metadata carriers):
  // APP1  = 0xFFE1 (EXIF, XMP)
  // APP2  = 0xFFE2 (ICC Profile, FlashPix)
  // APP12 = 0xFFEC (Ducky)
  // APP13 = 0xFFED (IPTC/Photoshop IRB)
  // COM   = 0xFFFE (Comment — can contain arbitrary text)
  const STRIP_MARKERS = new Set([0xe1, 0xe2, 0xec, 0xed, 0xfe]);

  const output: number[] = [];

  // Copy SOI marker
  output.push(0xff, 0xd8);

  let offset = 2;
  while (offset < buf.length - 1) {
    // Each marker starts with 0xFF
    if (buf[offset] !== 0xff) {
      // We've hit raw image data (after SOS) — copy the rest as-is
      for (let i = offset; i < buf.length; i++) {
        output.push(buf[i]);
      }
      break;
    }

    const marker = buf[offset + 1];

    // SOS (Start of Scan) — everything after this is image data
    // Copy the SOS marker + its header, then the rest is raw data
    if (marker === 0xda) {
      for (let i = offset; i < buf.length; i++) {
        output.push(buf[i]);
      }
      break;
    }

    // EOI (End of Image) — copy and stop
    if (marker === 0xd9) {
      output.push(0xff, 0xd9);
      break;
    }

    // Standalone markers (no length field): RST0-RST7, SOI, TEM
    if (
      (marker >= 0xd0 && marker <= 0xd7) ||
      marker === 0xd8 ||
      marker === 0x01 ||
      marker === 0x00
    ) {
      output.push(0xff, marker);
      offset += 2;
      continue;
    }

    // All other markers have a 2-byte length field after the marker
    if (offset + 3 >= buf.length) {
      // Truncated — copy remaining bytes and bail
      for (let i = offset; i < buf.length; i++) {
        output.push(buf[i]);
      }
      break;
    }

    const segmentLength = (buf[offset + 2] << 8) | buf[offset + 3];
    const segmentEnd = offset + 2 + segmentLength;

    if (STRIP_MARKERS.has(marker)) {
      // Skip this segment entirely (strip metadata)
      offset = segmentEnd;
      continue;
    }

    // Keep this segment — copy marker + length + data
    const end = Math.min(segmentEnd, buf.length);
    for (let i = offset; i < end; i++) {
      output.push(buf[i]);
    }
    offset = segmentEnd;
  }

  return Buffer.from(new Uint8Array(output)) as Buffer<ArrayBuffer>;
}

/**
 * Returns true if the MIME type is one we can strip metadata from.
 * Currently only JPEG is supported for zero-dependency stripping.
 */
export function canStripMetadata(mimeType: string): boolean {
  return mimeType === "image/jpeg";
}
