// 纯 Node 生成 PWA 图标（无第三方依赖）
const fs = require('fs');
const zlib = require('zlib');
const path = require('path');

function crc32(buf) {
  let table = [];
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  let crc = 0xFFFFFFFF;
  for (let i = 0; i < buf.length; i++) crc = table[(crc ^ buf[i]) & 0xFF] ^ (crc >>> 8);
  return (crc ^ 0xFFFFFFFF) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const t = Buffer.from(type, 'ascii');
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([t, data])), 0);
  return Buffer.concat([len, t, data, crc]);
}
function encodePNG(w, h, rgba) {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; ihdr[9] = 6; // 8-bit, RGBA
  const raw = Buffer.alloc((w * 4 + 1) * h);
  for (let y = 0; y < h; y++) {
    raw[y * (w * 4 + 1)] = 0; // filter none
    rgba.copy(raw, y * (w * 4 + 1) + 1, y * w * 4, (y + 1) * w * 4);
  }
  const idat = zlib.deflateSync(raw);
  return Buffer.concat([sig, chunk('IHDR', ihdr), chunk('IDAT', idat), chunk('IEND', Buffer.alloc(0))]);
}

function makeIcon(size, maskable) {
  const buf = Buffer.alloc(size * size * 4); // all zero (transparent)
  const set = (x, y, r, g, b, a) => {
    if (x < 0 || y < 0 || x >= size || y >= size) return;
    const i = (y * size + x) * 4;
    buf[i] = r; buf[i + 1] = g; buf[i + 2] = b; buf[i + 3] = a;
  };
  const top = [124, 108, 240], bot = [33, 199, 168];
  const grad = (y) => {
    const t = y / size;
    return [Math.round(top[0] + (bot[0] - top[0]) * t),
            Math.round(top[1] + (bot[1] - top[1]) * t),
            Math.round(top[2] + (bot[2] - top[2]) * t)];
  };
  // 背景：maskable 铺满整画布，普通版画圆角矩形
  const margin = maskable ? 0 : Math.round(size * 0.10);
  const r = maskable ? 0 : Math.round(size * 0.22);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    if (margin > 0) {
      const dx = Math.min(x, margin + r) - Math.max(x, size - margin - r);
      const dy = Math.min(y, margin + r) - Math.max(y, size - margin - r);
      if (x < margin || x >= size - margin || y < margin || y >= size - margin) {
        if (x < margin + r && y < margin + r) { if (Math.hypot(dx, dy) > r) continue; }
        else if (x >= size - margin - r && y < margin + r) { if (Math.hypot(dx, dy) > r) continue; }
        else if (x < margin + r && y >= size - margin - r) { if (Math.hypot(dx, dy) > r) continue; }
        else if (x >= size - margin - r && y >= size - margin - r) { if (Math.hypot(dx, dy) > r) continue; }
        else continue;
      }
    }
    const c = grad(y);
    set(x, y, c[0], c[1], c[2], 255);
  }
  // 进度环 + 对勾（白色）
  const cx = size / 2, cy = size / 2;
  const scale = maskable ? 0.40 : 0.30;
  const R = size * scale;
  const t = size * (maskable ? 0.05 : 0.07);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const d = Math.hypot(x - cx, y - cy);
    if (Math.abs(d - R) <= t / 2) set(x, y, 255, 255, 255, 255);
  }
  // 对勾两段
  const thick = (x0, y0, x1, y1, wdt) => {
    const steps = Math.ceil(Math.hypot(x1 - x0, y1 - y0));
    for (let s = 0; s <= steps; s++) {
      const px = x0 + (x1 - x0) * s / steps, py = y0 + (y1 - y0) * s / steps;
      for (let oy = -wdt; oy <= wdt; oy++) for (let ox = -wdt; ox <= wdt; ox++)
        if (Math.hypot(ox, oy) <= wdt) set(Math.round(px + ox), Math.round(py + oy), 255, 255, 255, 255);
    }
  };
  const s2 = R * 0.52, wdt = Math.max(2, Math.round(size * 0.045));
  thick(cx - s2, cy - s2 * 0.15, cx - s2 * 0.15, cy + s2 * 0.55, wdt);
  thick(cx - s2 * 0.15, cy + s2 * 0.55, cx + s2, cy - s2 * 0.45, wdt);
  return buf;
}

const out = path.join(__dirname, '..');
fs.writeFileSync(path.join(out, 'icon-192.png'), encodePNG(192, 192, makeIcon(192, false)));
fs.writeFileSync(path.join(out, 'icon-512.png'), encodePNG(512, 512, makeIcon(512, false)));
fs.writeFileSync(path.join(out, 'icon-maskable-512.png'), encodePNG(512, 512, makeIcon(512, true)));
console.log('icons generated: icon-192.png, icon-512.png, icon-maskable-512.png');
