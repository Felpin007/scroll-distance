// Remove o fundo claro conectado às bordas dos PNGs em images/.
// Execute: node transparentize-images.js

const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const PNG_SIG = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

function readPNG(file) {
  const buf = fs.readFileSync(file);
  if (!buf.subarray(0, 8).equals(PNG_SIG)) throw new Error(`${file}: PNG inválido`);

  let off = 8;
  let width = 0;
  let height = 0;
  let bitDepth = 0;
  let colorType = 0;
  const idat = [];

  while (off < buf.length) {
    const len = buf.readUInt32BE(off); off += 4;
    const type = buf.toString('ascii', off, off + 4); off += 4;
    const data = buf.subarray(off, off + len); off += len + 4;

    if (type === 'IHDR') {
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
      bitDepth = data[8];
      colorType = data[9];
      if (data[12] !== 0) throw new Error(`${file}: PNG interlaçado não suportado`);
    } else if (type === 'IDAT') {
      idat.push(data);
    } else if (type === 'IEND') {
      break;
    }
  }

  if (bitDepth !== 8 || (colorType !== 2 && colorType !== 6)) {
    throw new Error(`${file}: esperado RGB/RGBA 8-bit, veio colorType=${colorType}, bitDepth=${bitDepth}`);
  }

  const channels = colorType === 6 ? 4 : 3;
  const stride = width * channels;
  const raw = zlib.inflateSync(Buffer.concat(idat));
  const rgba = Buffer.alloc(width * height * 4);
  let src = 0;
  let prev = Buffer.alloc(stride);

  for (let y = 0; y < height; y++) {
    const filter = raw[src++];
    const row = Buffer.from(raw.subarray(src, src + stride));
    src += stride;
    unfilter(row, prev, channels, filter);

    for (let x = 0; x < width; x++) {
      const si = x * channels;
      const di = (y * width + x) * 4;
      rgba[di] = row[si];
      rgba[di + 1] = row[si + 1];
      rgba[di + 2] = row[si + 2];
      rgba[di + 3] = channels === 4 ? row[si + 3] : 255;
    }
    prev = row;
  }

  return { width, height, rgba };
}

function unfilter(row, prev, bpp, filter) {
  for (let i = 0; i < row.length; i++) {
    const left = i >= bpp ? row[i - bpp] : 0;
    const up = prev[i] || 0;
    const upLeft = i >= bpp ? prev[i - bpp] || 0 : 0;
    if (filter === 1) row[i] = (row[i] + left) & 255;
    else if (filter === 2) row[i] = (row[i] + up) & 255;
    else if (filter === 3) row[i] = (row[i] + Math.floor((left + up) / 2)) & 255;
    else if (filter === 4) row[i] = (row[i] + paeth(left, up, upLeft)) & 255;
    else if (filter !== 0) throw new Error(`Filtro PNG desconhecido: ${filter}`);
  }
}

function paeth(a, b, c) {
  const p = a + b - c;
  const pa = Math.abs(p - a);
  const pb = Math.abs(p - b);
  const pc = Math.abs(p - c);
  return pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
}

function isBackground(rgba, idx) {
  const r = rgba[idx], g = rgba[idx + 1], b = rgba[idx + 2];
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const avg = (r + g + b) / 3;
  return min >= 238 || (avg >= 232 && max - min <= 18);
}

function transparentize(image) {
  const { width, height, rgba } = image;
  const total = width * height;
  const visited = new Uint8Array(total);
  const queue = new Int32Array(total);
  let head = 0;
  let tail = 0;

  const pushIfBackground = (x, y) => {
    const p = y * width + x;
    if (visited[p]) return;
    visited[p] = 1;
    if (isBackground(rgba, p * 4)) queue[tail++] = p;
  };

  for (let x = 0; x < width; x++) {
    pushIfBackground(x, 0);
    pushIfBackground(x, height - 1);
  }
  for (let y = 0; y < height; y++) {
    pushIfBackground(0, y);
    pushIfBackground(width - 1, y);
  }

  while (head < tail) {
    const p = queue[head++];
    rgba[p * 4 + 3] = 0;
    const x = p % width;
    const y = Math.floor(p / width);
    if (x > 0) pushIfBackground(x - 1, y);
    if (x < width - 1) pushIfBackground(x + 1, y);
    if (y > 0) pushIfBackground(x, y - 1);
    if (y < height - 1) pushIfBackground(x, y + 1);
  }

  for (let pass = 0; pass < 2; pass++) {
    const clear = [];
    for (let y = 1; y < height - 1; y++) {
      for (let x = 1; x < width - 1; x++) {
        const p = y * width + x;
        const i = p * 4;
        if (rgba[i + 3] === 0) continue;
        const nearTransparent =
          rgba[(p - 1) * 4 + 3] === 0 ||
          rgba[(p + 1) * 4 + 3] === 0 ||
          rgba[(p - width) * 4 + 3] === 0 ||
          rgba[(p + width) * 4 + 3] === 0;
        if (!nearTransparent) continue;

        const r = rgba[i], g = rgba[i + 1], b = rgba[i + 2];
        const max = Math.max(r, g, b);
        const min = Math.min(r, g, b);
        if (min >= 225 && max - min <= 28) clear.push(i + 3);
      }
    }
    for (const alphaIndex of clear) rgba[alphaIndex] = 0;
  }
}

function writePNG(file, width, height, rgba) {
  const raw = Buffer.alloc(height * (1 + width * 4));
  for (let y = 0; y < height; y++) {
    raw[y * (1 + width * 4)] = 0;
    rgba.copy(raw, y * (1 + width * 4) + 1, y * width * 4, (y + 1) * width * 4);
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;

  fs.writeFileSync(file, Buffer.concat([
    PNG_SIG,
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]));
}

function chunk(type, data) {
  const typeBuf = Buffer.from(type, 'ascii');
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([len, typeBuf, data, crcBuf]);
}

const crcTable = (() => {
  const table = new Int32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
    table[i] = c;
  }
  return table;
})();

function crc32(buf) {
  let c = -1;
  for (let i = 0; i < buf.length; i++) c = crcTable[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return c ^ -1;
}

const dir = path.join(__dirname, 'images');
for (const name of fs.readdirSync(dir).filter((file) => file.toLowerCase().endsWith('.png'))) {
  const file = path.join(dir, name);
  const image = readPNG(file);
  transparentize(image);
  writePNG(file, image.width, image.height, image.rgba);
  console.log(`Fundo transparente: ${name}`);
}
