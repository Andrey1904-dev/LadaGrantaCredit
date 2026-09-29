/**
 * Извлечение альфа-канала из «студийных» рендеров Granta.
 *
 * Генератор изображений не умеет отдавать PNG с прозрачностью, поэтому фон
 * ключится программно: заливка от границы по цвету (flood fill), а не глобальный
 * порог по цвету — иначе тёмный кузов чёрной машины попал бы под нож.
 * Пиксели у края получают частичную прозрачность (feather), чтобы не было
 * тёмного ореола на тёмном фоне интерфейса.
 */
import fs from 'fs';
import zlib from 'zlib';

const BG_TOLERANCE = 12; // пиксель считается фоном
const FEATHER_TOLERANCE = 34; // граница растушёвки

function crc32(buf) {
  let c, table = crc32.table;
  if (!table) {
    table = crc32.table = new Int32Array(256);
    for (let n = 0; n < 256; n++) {
      c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      table[n] = c;
    }
  }
  let crc = -1;
  for (let i = 0; i < buf.length; i++) crc = (crc >>> 8) ^ table[(crc ^ buf[i]) & 0xff];
  return (crc ^ -1) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}

/** Декодер PNG: 8-bit, truecolor (2) или truecolor+alpha (6), без интерлейса. */
function decodePNG(path) {
  const buf = fs.readFileSync(path);
  let off = 8, w = 0, h = 0, ctype = 0;
  const idat = [];
  while (off < buf.length) {
    const len = buf.readUInt32BE(off);
    const type = buf.toString('ascii', off + 4, off + 8);
    const data = buf.subarray(off + 8, off + 8 + len);
    if (type === 'IHDR') {
      w = data.readUInt32BE(0);
      h = data.readUInt32BE(4);
      if (data[8] !== 8) throw new Error('только 8-bit PNG');
      ctype = data[9];
      if (data[12] !== 0) throw new Error('interlace не поддерживается');
    } else if (type === 'IDAT') idat.push(data);
    else if (type === 'IEND') break;
    off += 12 + len;
  }
  const ch = ctype === 6 ? 4 : ctype === 2 ? 3 : null;
  if (!ch) throw new Error('поддерживаются только RGB/RGBA PNG, получено type=' + ctype);
  const raw = zlib.inflateSync(Buffer.concat(idat));
  const stride = w * ch;
  const out = Buffer.alloc(h * stride);
  let p = 0;
  for (let y = 0; y < h; y++) {
    const f = raw[p++];
    const line = raw.subarray(p, p + stride);
    p += stride;
    const cur = out.subarray(y * stride, (y + 1) * stride);
    const prev = y > 0 ? out.subarray((y - 1) * stride, y * stride) : null;
    for (let x = 0; x < stride; x++) {
      const a = x >= ch ? cur[x - ch] : 0;
      const b = prev ? prev[x] : 0;
      const c = prev && x >= ch ? prev[x - ch] : 0;
      let v = line[x];
      if (f === 1) v += a;
      else if (f === 2) v += b;
      else if (f === 3) v += (a + b) >> 1;
      else if (f === 4) {
        const pa = Math.abs(b - c), pb = Math.abs(a - c), pc = Math.abs(a + b - 2 * c);
        v += pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
      }
      cur[x] = v & 0xff;
    }
  }
  return { w, h, ch, data: out };
}

function encodePNG(w, h, rgba) {
  const stride = w * 4;
  const raw = Buffer.alloc(h * (stride + 1));
  for (let y = 0; y < h; y++) {
    raw[y * (stride + 1)] = 0; // filter none
    rgba.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

/** Медиана цвета по рамке изображения — оценка студийного фона. */
function borderMedian(img) {
  const { w, h, ch, data } = img;
  const rs = [], gs = [], bs = [];
  const push = (x, y) => {
    const i = (y * w + x) * ch;
    rs.push(data[i]); gs.push(data[i + 1]); bs.push(data[i + 2]);
  };
  for (let x = 0; x < w; x++) { push(x, 0); push(x, 1); push(x, h - 1); push(x, h - 2); }
  for (let y = 0; y < h; y++) { push(0, y); push(1, y); push(w - 1, y); push(w - 2, y); }
  const med = (a) => { a.sort((m, n) => m - n); return a[a.length >> 1]; };
  return [med(rs), med(gs), med(bs)];
}

function keyOut(src, dst, { maxWidth = 1000, bgTolerance = BG_TOLERANCE, feather = FEATHER_TOLERANCE } = {}) {
  let img = decodePNG(src);
  const { w, h, ch, data } = img;
  const bg = borderMedian(img);

  const dist = (i) => {
    const dr = data[i] - bg[0], dg = data[i + 1] - bg[1], db = data[i + 2] - bg[2];
    return Math.sqrt(dr * dr + dg * dg + db * db);
  };

  // 1. Заливка от границы: непрозрачным становится только фон, связный с краем.
  const bgMask = new Uint8Array(w * h);
  const queue = new Int32Array(w * h);
  let qh = 0, qt = 0;
  const tryPush = (x, y) => {
    const p = y * w + x;
    if (bgMask[p] || dist(p * ch) > bgTolerance) return;
    bgMask[p] = 1;
    queue[qt++] = p;
  };
  for (let x = 0; x < w; x++) { tryPush(x, 0); tryPush(x, h - 1); }
  for (let y = 0; y < h; y++) { tryPush(0, y); tryPush(w - 1, y); }
  while (qh < qt) {
    const p = queue[qh++];
    const x = p % w, y = (p / w) | 0;
    if (x > 0) tryPush(x - 1, y);
    if (x < w - 1) tryPush(x + 1, y);
    if (y > 0) tryPush(x, y - 1);
    if (y < h - 1) tryPush(x, y + 1);
  }

  // 2. Альфа: 0 на фоне, плавный переход к 255 в пограничных пикселях.
  const alpha = new Uint8Array(w * h).fill(255);
  for (let p = 0; p < w * h; p++) if (bgMask[p]) alpha[p] = 0;
  for (let pass = 0; pass < 2; pass++) {
    for (let y = 1; y < h - 1; y++) {
      for (let x = 1; x < w - 1; x++) {
        const p = y * w + x;
        if (alpha[p] !== 255) continue;
        if (alpha[p - 1] !== 255 || alpha[p + 1] !== 255 || alpha[p - w] !== 255 || alpha[p + w] !== 255) {
          const d = dist(p * ch);
          if (d <= feather) {
            const t = (d - bgTolerance) / (feather - bgTolerance);
            alpha[p] = Math.round(255 * Math.max(0, Math.min(1, t)));
          }
        }
      }
    }
  }

  // 3. Уменьшаем до разумной ширины (box filter по альфе, без ореолов).
  let outW = w, outH = h;
  if (w > maxWidth) { outH = Math.round((h * maxWidth) / w); outW = maxWidth; }
  const rgba = Buffer.alloc(outW * outH * 4);
  const sx = w / outW, sy = h / outH;
  for (let y = 0; y < outH; y++) {
    const y0 = Math.floor(y * sy), y1 = Math.max(y0 + 1, Math.floor((y + 1) * sy));
    for (let x = 0; x < outW; x++) {
      const x0 = Math.floor(x * sx), x1 = Math.max(x0 + 1, Math.floor((x + 1) * sx));
      let r = 0, g = 0, b = 0, a = 0, n = 0;
      for (let yy = y0; yy < Math.min(y1, h); yy++) {
        for (let xx = x0; xx < Math.min(x1, w); xx++) {
          const p = yy * w + xx, i = p * ch;
          r += data[i]; g += data[i + 1]; b += data[i + 2]; a += alpha[p]; n++;
        }
      }
      const o = (y * outW + x) * 4;
      rgba[o] = Math.round(r / n);
      rgba[o + 1] = Math.round(g / n);
      rgba[o + 2] = Math.round(b / n);
      rgba[o + 3] = Math.round(a / n);
    }
  }

  fs.writeFileSync(dst, encodePNG(outW, outH, rgba));
  const transparent = alpha.reduce((s, v) => s + (v === 0 ? 1 : 0), 0);
  console.log(
    `${src} -> ${dst}: ${w}x${h} => ${outW}x${outH}, фон=${bg.join(',')}, ` +
    `прозрачных ${((transparent / (w * h)) * 100).toFixed(1)}%, ` +
    `${(fs.statSync(dst).size / 1024).toFixed(0)} KB`,
  );
}

const [src, dst] = process.argv.slice(2);
keyOut(src, dst);
