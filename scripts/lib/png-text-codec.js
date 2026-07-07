'use strict';

const zlib = require('zlib');

const PNG_SIGNATURE = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
const BYTES_PER_PIXEL = 4; // RGBA — maximizes bytes packed per pixel, minimizing pixel count
const LENGTH_PREFIX_BYTES = 4;
const BIT_DEPTH = 8;
const COLOR_TYPE_RGBA = 6;

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

function readChunks(buffer) {
  let offset = PNG_SIGNATURE.length;
  const chunks = [];
  while (offset + 8 <= buffer.length) {
    const length = buffer.readUInt32BE(offset);
    const type = buffer.toString('ascii', offset + 4, offset + 8);
    const data = buffer.subarray(offset + 8, offset + 8 + length);
    chunks.push({ type, data });
    offset += 12 + length; // length(4) + type(4) + data + crc(4)
    if (type === 'IEND') break;
  }
  return chunks;
}

/**
 * Pack text into pixel bytes: [4-byte compressed-length prefix][deflated text], zero-padded
 * to a whole number of RGBA pixels, laid out as a single scanline (height 1) to avoid
 * per-row filter-byte overhead.
 */
function buildPixelPayload(text) {
  const original = Buffer.from(text, 'utf8');
  const compressed = zlib.deflateRawSync(original);

  const lengthPrefix = Buffer.alloc(LENGTH_PREFIX_BYTES);
  lengthPrefix.writeUInt32BE(compressed.length, 0);

  const payload = Buffer.concat([lengthPrefix, compressed]);
  const pixelCount = Math.max(1, Math.ceil(payload.length / BYTES_PER_PIXEL));
  const pixels = Buffer.alloc(pixelCount * BYTES_PER_PIXEL);
  payload.copy(pixels);

  return { pixels, pixelCount, originalBytes: original.length, compressedBytes: compressed.length };
}

function encodeTextToPng(text) {
  const { pixels, pixelCount } = buildPixelPayload(text);
  const width = pixelCount;
  const height = 1;

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = BIT_DEPTH;
  ihdr[9] = COLOR_TYPE_RGBA;
  ihdr[10] = 0; // compression method (deflate — the only defined value)
  ihdr[11] = 0; // filter method (adaptive — the only defined value)
  ihdr[12] = 0; // interlace method (none)

  const scanline = Buffer.concat([Buffer.from([0]), pixels]); // filter type 0 = None
  const idatData = zlib.deflateSync(scanline);

  return Buffer.concat([
    PNG_SIGNATURE,
    buildChunk('IHDR', ihdr),
    buildChunk('IDAT', idatData),
    buildChunk('IEND', Buffer.alloc(0)),
  ]);
}

function decodePngToText(buffer) {
  if (buffer.length < 8 || !PNG_SIGNATURE.equals(buffer.subarray(0, 8))) {
    throw new Error('Not a PNG file (bad signature)');
  }

  const chunks = readChunks(buffer);
  const ihdrChunk = chunks.find(c => c.type === 'IHDR');
  if (!ihdrChunk) throw new Error('Missing IHDR chunk');

  const width = ihdrChunk.data.readUInt32BE(0);
  const height = ihdrChunk.data.readUInt32BE(4);
  const bitDepth = ihdrChunk.data[8];
  const colorType = ihdrChunk.data[9];

  if (bitDepth !== BIT_DEPTH || colorType !== COLOR_TYPE_RGBA) {
    throw new Error(`Unsupported PNG format: expected ${BIT_DEPTH}-bit RGBA, got bitDepth=${bitDepth} colorType=${colorType}`);
  }

  const idatData = Buffer.concat(chunks.filter(c => c.type === 'IDAT').map(c => c.data));
  const scanlines = zlib.inflateSync(idatData);

  const stride = width * BYTES_PER_PIXEL;
  const rows = [];
  for (let y = 0; y < height; y++) {
    const rowStart = y * (stride + 1);
    const filterType = scanlines[rowStart];
    if (filterType !== 0) throw new Error(`Unsupported PNG filter type ${filterType}`);
    rows.push(scanlines.subarray(rowStart + 1, rowStart + 1 + stride));
  }
  const pixels = Buffer.concat(rows);

  const compressedLength = pixels.readUInt32BE(0);
  const compressed = pixels.subarray(LENGTH_PREFIX_BYTES, LENGTH_PREFIX_BYTES + compressedLength);
  const original = zlib.inflateRawSync(compressed);

  return original.toString('utf8');
}

/**
 * Report the size tradeoff for a given text without writing a file — useful for
 * comparing against plain gzip before committing to the PNG container.
 */
function getEncodingStats(text) {
  const { pixelCount, originalBytes, compressedBytes } = buildPixelPayload(text);
  const png = encodeTextToPng(text);
  const plainGzip = zlib.gzipSync(Buffer.from(text, 'utf8'));

  return {
    originalBytes,
    deflatedBytes: compressedBytes,
    pixelCount,
    width: pixelCount,
    height: 1,
    pngBytes: png.length,
    plainGzipBytes: plainGzip.length,
  };
}

module.exports = {
  encodeTextToPng,
  decodePngToText,
  getEncodingStats,
};
