// Gera ícones PNG minimalistas para a extensão sem dependências externas.
// Usa formato BMP convertido para PNG via zlib nativo do Node.
// Execute: node create-icons.js

const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

function createPNG(size) {
  const pixels = new Uint8Array(size * size * 4);

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const r2 = size * 0.22;
      const i = (y * size + x) * 4;

      // Rounded rect check
      const dx = Math.max(r2 - x, 0, x - (size - 1 - r2));
      const dy = Math.max(r2 - y, 0, y - (size - 1 - r2));
      const inside = Math.sqrt(dx * dx + dy * dy) <= r2;

      if (inside) {
        // Gradient: #6366f1 → #8b5cf6
        const t = (x + y) / (size * 2);
        pixels[i]   = Math.round(0x63 + t * (0x8b - 0x63)); // R
        pixels[i+1] = Math.round(0x66 + t * (0x5c - 0x66)); // G
        pixels[i+2] = Math.round(0xf1 + t * (0xf6 - 0xf1)); // B
        pixels[i+3] = 255;

        // Draw white lines
        const lw = Math.max(1, Math.round(size * 0.07));
        const pad = Math.round(size * 0.20);
        const rows = [
          Math.round(size * 0.35),
          Math.round(size * 0.50),
          Math.round(size * 0.65),
        ];
        const ends = [
          Math.round(size * 0.72),
          Math.round(size * 0.55),
          Math.round(size * 0.65),
        ];

        for (let ri = 0; ri < rows.length; ri++) {
          if (y >= rows[ri] - Math.floor(lw/2) && y <= rows[ri] + Math.floor(lw/2)) {
            if (x >= pad && x <= ends[ri]) {
              pixels[i] = pixels[i+1] = pixels[i+2] = 255;
            }
          }
        }

        // Arrow right side
        const ax = Math.round(size * 0.78);
        const ay = Math.round(size * 0.50);
        const ah = Math.round(size * 0.12);
        if (x >= ax - Math.round(size*0.1) && x <= ax) {
          // upper arm
          const expectedY = ay - Math.round(ah * (ax - x) / Math.round(size*0.1));
          if (Math.abs(y - expectedY) <= Math.ceil(lw/2)) {
            pixels[i] = pixels[i+1] = pixels[i+2] = 255;
          }
          // lower arm
          const expectedY2 = ay + Math.round(ah * (ax - x) / Math.round(size*0.1));
          if (Math.abs(y - expectedY2) <= Math.ceil(lw/2)) {
            pixels[i] = pixels[i+1] = pixels[i+2] = 255;
          }
        }
      } else {
        pixels[i+3] = 0; // transparent
      }
    }
  }

  return encodePNG(size, size, pixels);
}

function encodePNG(width, height, rgba) {
  const SIGNATURE = Buffer.from([137,80,78,71,13,10,26,10]);

  function chunk(type, data) {
    const typeBuf = Buffer.from(type, 'ascii');
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length, 0);
    const crcBuf = Buffer.alloc(4);
    crcBuf.writeInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
    return Buffer.concat([len, typeBuf, data, crcBuf]);
  }

  // IHDR
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;  // bit depth
  ihdr[9] = 6;  // RGBA
  ihdr[10] = ihdr[11] = ihdr[12] = 0;

  // Raw image data (filter byte 0 per row)
  const raw = Buffer.alloc(height * (1 + width * 4));
  for (let y = 0; y < height; y++) {
    raw[y * (1 + width * 4)] = 0; // filter none
    for (let x = 0; x < width; x++) {
      const src = (y * width + x) * 4;
      const dst = y * (1 + width * 4) + 1 + x * 4;
      raw[dst]   = rgba[src];
      raw[dst+1] = rgba[src+1];
      raw[dst+2] = rgba[src+2];
      raw[dst+3] = rgba[src+3];
    }
  }

  const compressed = zlib.deflateSync(raw, { level: 6 });

  return Buffer.concat([
    SIGNATURE,
    chunk('IHDR', ihdr),
    chunk('IDAT', compressed),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

// CRC-32 table
const crcTable = (() => {
  const t = new Int32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
    t[i] = c;
  }
  return t;
})();

function crc32(buf) {
  let c = -1;
  for (let i = 0; i < buf.length; i++) c = crcTable[(c ^ buf[i]) & 0xFF] ^ (c >>> 8);
  return c ^ -1;
}

const outDir = path.join(__dirname, 'icons');
[16, 48, 128].forEach(size => {
  const png = createPNG(size);
  const file = path.join(outDir, `icon${size}.png`);
  fs.writeFileSync(file, png);
  console.log(`Criado: ${file}`);
});

console.log('Ícones gerados com sucesso!');
