import zlib from 'node:zlib';
import { renderLabeledQrGrayscalePixels } from './qrLabeledPng.js';

const CRC_TABLE = new Uint32Array(256);
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let k = 0; k < 8; k++) {
    c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  }
  CRC_TABLE[n] = c >>> 0;
}

function crc32(buf: Buffer): number {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

function makeChunk(type: string, data: Buffer): Buffer {
  const typeBuf = Buffer.from(type, 'ascii');
  const lenBuf = Buffer.alloc(4);
  lenBuf.writeUInt32BE(data.length, 0);
  const crcInput = Buffer.concat([typeBuf, data]);
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(crcInput), 0);
  return Buffer.concat([lenBuf, typeBuf, data, crcBuf]);
}

/**
 * Gera um Buffer PNG (400x456) em memória contendo o QR Code e a numeração sequencial
 * (ex: `PLK-000057`) gravada na parte inferior da própria imagem.
 */
export function generateLabeledQrPngBuffer(urlPermanente: string, codigoSequencial: string): Buffer {
  const { width, height, pixels } = renderLabeledQrGrayscalePixels(urlPermanente, codigoSequencial);

  const rawData = Buffer.alloc(height * (1 + width));
  for (let y = 0; y < height; y++) {
    const rowOut = y * (1 + width);
    rawData[rowOut] = 0; // Filter type 0 (None)
    const rowIn = y * width;
    for (let x = 0; x < width; x++) {
      rawData[rowOut + 1 + x] = pixels[rowIn + x];
    }
  }

  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // 8-bit grayscale
  ihdr[9] = 0; // color type 0
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  const idatData = zlib.deflateSync(rawData, { level: 6 });
  return Buffer.concat([
    signature,
    makeChunk('IHDR', ihdr),
    makeChunk('IDAT', idatData),
    makeChunk('IEND', Buffer.alloc(0)),
  ]);
}

