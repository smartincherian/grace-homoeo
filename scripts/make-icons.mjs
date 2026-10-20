// Draws the HomoeoDesk mark (same as public/favicon.svg) into the PWA icons.
// No dependencies: PNGs are encoded with node:zlib. Run: npm run icons
import { deflateSync } from "node:zlib";
import { writeFileSync } from "node:fs";

const C1 = [0x2f, 0x6b, 0xff];
const C2 = [0x7d, 0xa2, 0xff];

// Coverage helpers in the 64x64 design space.
const inRRect = (x, y, x0, y0, w, h, r) => {
  const cx = Math.min(Math.max(x, x0 + r), x0 + w - r);
  const cy = Math.min(Math.max(y, y0 + r), y0 + h - r);
  return (x - cx) ** 2 + (y - cy) ** 2 <= r * r;
};

// Returns [r,g,b,a] (0-255, a 0-1) for a point in design space.
function sample(x, y) {
  if (!inRRect(x, y, 0, 0, 64, 64, 14)) return [0, 0, 0, 0];
  // CSS-style 160deg-ish gradient (top to bottom, slight lean).
  const t = Math.min(1, Math.max(0, (x * 0.342 + y * 0.94) / (64 * 1.282)));
  let c = C1.map((v, i) => v + (C2[i] - v) * t);
  const white =
    inRRect(x, y, 27, 14, 10, 36, 4) || inRRect(x, y, 14, 27, 36, 10, 4);
  if (white) c = [255, 255, 255];
  else if ((x - 48) ** 2 + (y - 16) ** 2 <= 16)
    c = c.map((v) => v + (255 - v) * 0.7);
  return [...c, 1];
}

const crcTable = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
const crc32 = (buf) => {
  let c = 0xffffffff;
  for (const b of buf) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};
const chunk = (type, data) => {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
};

function png(size) {
  const SS = 4; // supersampling per axis
  const raw = Buffer.alloc(size * (size * 4 + 1));
  let o = 0;
  for (let py = 0; py < size; py++) {
    raw[o++] = 0; // filter: none
    for (let px = 0; px < size; px++) {
      let r = 0,
        g = 0,
        b = 0,
        a = 0;
      for (let sy = 0; sy < SS; sy++)
        for (let sx = 0; sx < SS; sx++) {
          const [cr, cg, cb, ca] = sample(
            ((px + (sx + 0.5) / SS) / size) * 64,
            ((py + (sy + 0.5) / SS) / size) * 64,
          );
          r += cr * ca;
          g += cg * ca;
          b += cb * ca;
          a += ca;
        }
      const n = SS * SS;
      raw[o++] = a ? Math.round(r / a) : 0;
      raw[o++] = a ? Math.round(g / a) : 0;
      raw[o++] = a ? Math.round(b / a) : 0;
      raw[o++] = Math.round((a / n) * 255);
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw)),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

for (const size of [192, 512]) {
  writeFileSync(
    new URL(`../public/icon-${size}.png`, import.meta.url),
    png(size),
  );
}
console.log("wrote public/icon-192.png and public/icon-512.png");
