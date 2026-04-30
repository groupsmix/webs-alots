import { describe, it, expect } from "vitest";
import { stripJpegMetadata, canStripMetadata } from "../strip-exif";

describe("stripJpegMetadata", () => {
  it("returns input unchanged for non-JPEG data", () => {
    const pngHeader = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    const result = stripJpegMetadata(pngHeader);
    expect(result).toBe(pngHeader); // same reference — no copy
  });

  it("returns input unchanged for empty buffer", () => {
    const empty = Buffer.alloc(0);
    const result = stripJpegMetadata(empty);
    expect(result).toBe(empty);
  });

  it("strips APP1 (EXIF) segment from a minimal JPEG", () => {
    // Build a minimal JPEG: SOI + APP1 (EXIF) + DQT + EOI
    const soi = [0xff, 0xd8];
    // APP1 marker with 6-byte payload (length = 8 including length bytes)
    const app1Marker = [0xff, 0xe1];
    const app1Length = [0x00, 0x08]; // 8 bytes total (2 length + 6 data)
    const app1Data = [0x45, 0x78, 0x69, 0x66, 0x00, 0x00]; // "Exif\0\0"
    // DQT marker with 4-byte payload
    const dqt = [0xff, 0xdb, 0x00, 0x04, 0x00, 0x01];
    const eoi = [0xff, 0xd9];

    const input = Buffer.from([
      ...soi, ...app1Marker, ...app1Length, ...app1Data, ...dqt, ...eoi,
    ]);

    const result = stripJpegMetadata(input);

    // APP1 should be gone
    expect(result).not.toContain(0xe1);
    // SOI should be preserved
    expect(result[0]).toBe(0xff);
    expect(result[1]).toBe(0xd8);
    // DQT should be preserved
    expect(result.includes(0xdb)).toBe(true);
    // Result should be shorter (APP1 stripped)
    expect(result.length).toBeLessThan(input.length);
  });

  it("strips APP13 (IPTC) and COM segments", () => {
    const soi = [0xff, 0xd8];
    // APP13 (IPTC)
    const app13 = [0xff, 0xed, 0x00, 0x04, 0x12, 0x34];
    // COM (comment)
    const com = [0xff, 0xfe, 0x00, 0x06, 0x48, 0x65, 0x6c, 0x6c];
    // SOS + minimal data
    const sos = [0xff, 0xda, 0x00, 0x04, 0x00, 0x01];
    const imageData = [0xab, 0xcd, 0xef];
    const eoi = [0xff, 0xd9];

    const input = Buffer.from([
      ...soi, ...app13, ...com, ...sos, ...imageData, ...eoi,
    ]);

    const result = stripJpegMetadata(input);

    // SOI preserved
    expect(result[0]).toBe(0xff);
    expect(result[1]).toBe(0xd8);
    // SOS and image data preserved
    const resultArray = Array.from(result);
    // Should contain SOS marker
    let foundSos = false;
    for (let i = 0; i < resultArray.length - 1; i++) {
      if (resultArray[i] === 0xff && resultArray[i + 1] === 0xda) {
        foundSos = true;
        break;
      }
    }
    expect(foundSos).toBe(true);
    // Should be shorter
    expect(result.length).toBeLessThan(input.length);
  });

  it("preserves non-metadata segments (DQT, DHT, SOF)", () => {
    const soi = [0xff, 0xd8];
    const dqt = [0xff, 0xdb, 0x00, 0x04, 0x00, 0x01]; // DQT
    const dht = [0xff, 0xc4, 0x00, 0x04, 0x00, 0x01]; // DHT
    const sof = [0xff, 0xc0, 0x00, 0x04, 0x00, 0x01]; // SOF0
    const eoi = [0xff, 0xd9];

    const input = Buffer.from([...soi, ...dqt, ...dht, ...sof, ...eoi]);
    const result = stripJpegMetadata(input);

    // No metadata to strip — output should equal input
    expect(result.length).toBe(input.length);
    expect(Buffer.compare(result, input)).toBe(0);
  });
});

describe("canStripMetadata", () => {
  it("returns true for image/jpeg", () => {
    expect(canStripMetadata("image/jpeg")).toBe(true);
  });

  it("returns false for image/png", () => {
    expect(canStripMetadata("image/png")).toBe(false);
  });

  it("returns false for application/pdf", () => {
    expect(canStripMetadata("application/pdf")).toBe(false);
  });
});
