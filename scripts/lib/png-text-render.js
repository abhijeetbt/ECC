'use strict';

const zlib = require('zlib');
const { GLYPH_ROWS, GLYPH_COLS, glyphBitmap } = require('./png-glyph-font');

const PNG_SIGNATURE = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

function buildChunk(type, data) {
  const typeBuf = Buffer.from(type, 'ascii');
  const lenBuf = Buffer.alloc(4);
  lenBuf.writeUInt32BE(data.length, 0);
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([lenBuf, typeBuf, data, crcBuf]);
}

function wordWrap(text, maxCharsPerLine) {
  const words = text.split(/\s+/).filter(Boolean);
  const lines = [];
  let current = '';
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (candidate.length > maxCharsPerLine && current) {
      lines.push(current);
      current = word;
    } else {
      current = candidate;
    }
  }
  if (current) lines.push(current);
  return lines;
}

/**
 * Render text as a legible grayscale PNG (real glyphs, not raw byte-packed pixels —
 * this one is meant to be visually readable, e.g. by a vision model's OCR).
 *
 * scale: pixels per font-cell pixel. 3-4 is a reasonable stand-in for a small but
 * legible font size; below that, real-world OCR reliability drops off.
 */
function renderTextToPng(text, options = {}) {
  const scale = options.scale || 3;
  const maxCharsPerLine = options.maxCharsPerLine || 60;
  const glyphSpacing = 1; // blank columns between characters (pre-scale)
  const lineSpacing = 2; // blank rows between lines (pre-scale)
  const margin = 2; // blank border (pre-scale)

  const normalized = text.toLowerCase().replace(/[^a-z\s]/g, '');
  const lines = wordWrap(normalized, maxCharsPerLine);

  const cellW = GLYPH_COLS + glyphSpacing;
  const cellH = GLYPH_ROWS + lineSpacing;
  const gridCols = Math.max(...lines.map(l => l.length), 1);
  const gridRows = lines.length;

  const width = (margin * 2 + gridCols * cellW) * scale;
  const height = (margin * 2 + gridRows * cellH) * scale;

  // 1 byte/pixel grayscale, 255 = white background, 0 = black ink
  const pixels = Buffer.alloc(width * height, 255);

  const setPixel = (x, y, value) => {
    if (x < 0 || x >= width || y < 0 || y >= height) return;
    pixels[y * width + x] = value;
  };

  lines.forEach((line, row) => {
    for (let col = 0; col < line.length; col++) {
      const bitmap = glyphBitmap(line[col]);
      const baseX = (margin + col * cellW) * scale;
      const baseY = (margin + row * cellH) * scale;
      for (let gy = 0; gy < GLYPH_ROWS; gy++) {
        for (let gx = 0; gx < GLYPH_COLS; gx++) {
          if (!bitmap[gy][gx]) continue;
          for (let sy = 0; sy < scale; sy++) {
            for (let sx = 0; sx < scale; sx++) {
              setPixel(baseX + gx * scale + sx, baseY + gy * scale + sy, 0);
            }
          }
        }
      }
    }
  });

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 0; // color type: grayscale
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  const scanlines = Buffer.alloc(height * (width + 1));
  for (let y = 0; y < height; y++) {
    scanlines[y * (width + 1)] = 0; // filter type 0 = None
    pixels.copy(scanlines, y * (width + 1) + 1, y * width, y * width + width);
  }
  const idatData = zlib.deflateSync(scanlines);

  const png = Buffer.concat([
    PNG_SIGNATURE,
    buildChunk('IHDR', ihdr),
    buildChunk('IDAT', idatData),
    buildChunk('IEND', Buffer.alloc(0)),
  ]);

  return { png, width, height, renderedText: lines.join(' '), lineCount: lines.length };
}

/**
 * Anthropic's documented image-token estimate: tokens ≈ (width_px * height_px) / 750.
 * See platform.claude.com vision docs. This is an estimate, not a live-measured
 * count_tokens() result — this sandbox has no API credentials to call the real endpoint.
 */
function estimateImageTokens(width, height) {
  return Math.ceil((width * height) / 750);
}

/**
 * Standard rule-of-thumb text-token estimate (~4 chars/token for English).
 * Also not a live BPE count — see caveat above.
 */
function estimateTextTokens(text) {
  return Math.ceil(text.length / 4);
}

module.exports = {
  renderTextToPng,
  estimateImageTokens,
  estimateTextTokens,
  wordWrap,
};
