// ---------------------------------------------------------------------------
// PWA дүрсийг (PNG) кодоор үүсгэнэ — гадаад сан, зургийн файл шаардахгүй.
// zlib нь Node-ийн дотоод модуль тул PNG-г гараар угсарч байна.
// ---------------------------------------------------------------------------

import zlib from 'node:zlib';

// -- CRC32 -------------------------------------------------------------------
const CRC_TABLE = (() => {
  const t = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c;
  }
  return t;
})();

function crc32(buf: Buffer): number {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]!) & 0xff]! ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type: string, data: Buffer): Buffer {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

function encodePng(width: number, height: number, rgba: Buffer): Buffer {
  const raw = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (width * 4 + 1)] = 0; // filter: None
    rgba.copy(raw, y * (width * 4 + 1) + 1, y * width * 4, (y + 1) * width * 4);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;   // bit depth
  ihdr[9] = 6;   // colour type: RGBA
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

// -- Геометр -----------------------------------------------------------------
function distToSegment(px: number, py: number, x1: number, y1: number, x2: number, y2: number): number {
  const dx = x2 - x1, dy = y2 - y1;
  const len2 = dx * dx + dy * dy;
  let t = len2 ? ((px - x1) * dx + (py - y1) * dy) / len2 : 0;
  t = Math.max(0, Math.min(1, t));
  const cx = x1 + t * dx, cy = y1 + t * dy;
  return Math.hypot(px - cx, py - cy);
}

function insideRoundedRect(x: number, y: number, r: number): boolean {
  // x, y ∈ [0,1]; булангийн радиус r
  const cx = Math.min(Math.max(x, r), 1 - r);
  const cy = Math.min(Math.max(y, r), 1 - r);
  return Math.hypot(x - cx, y - cy) <= r;
}

const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;

export type IconOpts = { maskable?: boolean; transparent?: boolean };

// -- Дүрс зурах --------------------------------------------------------------
// maskable = үйлдлийн систем дүрсийг тайрч болзошгүй тул тэмдгийг жижигрүүлнэ
function drawIcon(size: number, { maskable = false, transparent = false }: IconOpts = {}): Buffer {
  const rgba = Buffer.alloc(size * size * 4);
  const SS = 2;                        // supersampling
  const inset = maskable ? 0.18 : 0;   // safe zone
  const radius = maskable ? 0.5 : 0.22;

  // Тэмдгийн "K" — иш + хоёр ташуу зураас
  const scale = maskable ? 0.64 : 1;
  const mid = 0.5;
  const K = {
    stem: { x0: 0.305, x1: 0.40, y0: 0.245, y1: 0.755 },
    up: { x1: 0.40, y1: 0.505, x2: 0.715, y2: 0.245 },
    down: { x1: 0.395, y1: 0.495, x2: 0.735, y2: 0.755 },
    thick: 0.048,
  };
  const sc = (v: number) => mid + (v - mid) * scale;

  for (let py = 0; py < size; py++) {
    for (let px = 0; px < size; px++) {
      let r = 0, g = 0, b = 0, a = 0;

      for (let sy = 0; sy < SS; sy++) {
        for (let sx = 0; sx < SS; sx++) {
          const x = (px + (sx + 0.5) / SS) / size;
          const y = (py + (sy + 0.5) / SS) / size;

          // Дэвсгэр
          const bx = (x - inset) / (1 - inset * 2);
          const by = (y - inset) / (1 - inset * 2);
          const onBg = maskable
            ? true
            : (bx >= 0 && bx <= 1 && by >= 0 && by <= 1 && insideRoundedRect(bx, by, radius));

          if (!onBg) continue;

          // Хазайсан градиент: plum → rose → gold
          const t = Math.min(1, Math.max(0, (x * 0.45 + y * 0.55)));
          let cr: number, cg: number, cb: number;
          if (t < 0.62) {
            const u = t / 0.62;
            cr = lerp(0x7b, 0xc9, u); cg = lerp(0x2e, 0x50, u); cb = lerp(0x52, 0x6e, u);
          } else {
            const u = (t - 0.62) / 0.38;
            cr = lerp(0xc9, 0xe0, u); cg = lerp(0x50, 0xa7, u); cb = lerp(0x6e, 0x5e, u);
          }

          // "K" тэмдэг — цагаанаар
          const inStem = x >= sc(K.stem.x0) && x <= sc(K.stem.x1)
            && y >= sc(K.stem.y0) && y <= sc(K.stem.y1);
          const inUp = distToSegment(x, y, sc(K.up.x1), sc(K.up.y1), sc(K.up.x2), sc(K.up.y2)) <= K.thick * scale;
          const inDown = distToSegment(x, y, sc(K.down.x1), sc(K.down.y1), sc(K.down.x2), sc(K.down.y2)) <= K.thick * scale;

          if (inStem || inUp || inDown) { cr = 255; cg = 255; cb = 255; }

          r += cr; g += cg; b += cb; a += 255;
        }
      }

      const n = SS * SS;
      const i = (py * size + px) * 4;
      if (a === 0) {
        if (!transparent) { rgba[i] = 0xfd; rgba[i + 1] = 0xf8; rgba[i + 2] = 0xf5; rgba[i + 3] = 0; }
        continue;
      }
      const cov = a / (n * 255);
      rgba[i] = Math.round(r / (n * cov));
      rgba[i + 1] = Math.round(g / (n * cov));
      rgba[i + 2] = Math.round(b / (n * cov));
      rgba[i + 3] = Math.round(255 * cov);
    }
  }

  return encodePng(size, size, rgba);
}

// -- Кэш ---------------------------------------------------------------------
const cache = new Map<string, Buffer>();

export function getIcon(size: number, opts: IconOpts = {}): Buffer {
  const key = `${size}:${opts.maskable ? 'm' : 'a'}`;
  if (!cache.has(key)) cache.set(key, drawIcon(size, opts));
  return cache.get(key)!;
}
