// ---------------------------------------------------------------------------
// QR код үүсгэгч — байт (8-bit) горим, алдаа засах түвшин M, хувилбар 1–20.
// Гадаад сан ашиглаагүй; QPay-ийн qr_text-ийг зурагт хөрвүүлэхэд хэрэглэнэ.
// ---------------------------------------------------------------------------

// [ec codewords/block, group1 blocks, group1 data cw, group2 blocks, group2 data cw]
export const EC_M: Record<number, [number, number, number, number, number]> = {
  1: [10, 1, 16, 0, 0],    2: [16, 1, 28, 0, 0],    3: [26, 1, 44, 0, 0],
  4: [18, 2, 32, 0, 0],    5: [24, 2, 43, 0, 0],    6: [16, 4, 27, 0, 0],
  7: [18, 4, 31, 0, 0],    8: [22, 2, 38, 2, 39],   9: [22, 3, 36, 2, 37],
  10: [26, 4, 43, 1, 44],  11: [30, 1, 50, 4, 51],  12: [22, 6, 36, 2, 37],
  13: [22, 8, 37, 1, 38],  14: [24, 4, 40, 5, 41],  15: [24, 5, 41, 5, 42],
  16: [28, 7, 45, 3, 46],  17: [28, 10, 46, 1, 47], 18: [26, 9, 43, 4, 44],
  19: [26, 3, 44, 11, 45], 20: [26, 3, 41, 13, 42],
};

export const TOTAL_CODEWORDS: Record<number, number> = {
  1: 26, 2: 44, 3: 70, 4: 100, 5: 134, 6: 172, 7: 196, 8: 242, 9: 292, 10: 346,
  11: 404, 12: 466, 13: 532, 14: 581, 15: 655, 16: 733, 17: 815, 18: 901,
  19: 991, 20: 1085,
};

const ALIGN: Record<number, number[]> = {
  1: [], 2: [6, 18], 3: [6, 22], 4: [6, 26], 5: [6, 30], 6: [6, 34],
  7: [6, 22, 38], 8: [6, 24, 42], 9: [6, 26, 46], 10: [6, 28, 50],
  11: [6, 30, 54], 12: [6, 32, 58], 13: [6, 34, 62], 14: [6, 26, 46, 66],
  15: [6, 26, 48, 70], 16: [6, 26, 50, 74], 17: [6, 30, 54, 78],
  18: [6, 30, 56, 82], 19: [6, 30, 58, 86], 20: [6, 34, 62, 90],
};

// --------------------------- Galois талбар (GF(256)) ------------------------
const EXP = new Uint8Array(512);
const LOG = new Uint8Array(256);
(function initGf() {
  let x = 1;
  for (let i = 0; i < 255; i++) {
    EXP[i] = x;
    LOG[x] = i;
    x <<= 1;
    if (x & 0x100) x ^= 0x11d;           // үүсгэгч олон гишүүнт x^8+x^4+x^3+x^2+1
  }
  for (let i = 255; i < 512; i++) EXP[i] = EXP[i - 255];
})();

const gfMul = (a: number, b: number): number => (a === 0 || b === 0 ? 0 : EXP[LOG[a] + LOG[b]]);

function rsGenerator(degree: number): number[] {
  let poly = [1];
  for (let i = 0; i < degree; i++) {
    const next: number[] = new Array(poly.length + 1).fill(0);
    for (let j = 0; j < poly.length; j++) {
      next[j] ^= gfMul(poly[j], EXP[i]);
      next[j + 1] ^= poly[j];
    }
    poly = next;
  }
  return poly;
}

function rsEncode(data: number[], ecLen: number): number[] {
  const gen = rsGenerator(ecLen);
  const res: number[] = new Array(ecLen).fill(0);
  for (const byte of data) {
    const factor = byte ^ res[0];
    res.shift();
    res.push(0);
    for (let i = 0; i < ecLen; i++) res[i] ^= gfMul(gen[i + 1], factor);
  }
  return res;
}

// ------------------------------ Bit буфер -----------------------------------
class BitBuffer {
  bits: number[] = [];
  put(value: number, length: number): void {
    for (let i = length - 1; i >= 0; i--) this.bits.push((value >>> i) & 1);
  }
  get length(): number { return this.bits.length; }
}

// --------------------------- Өгөгдлийг кодлох -------------------------------
function chooseVersion(byteLen: number): number {
  for (let v = 1; v <= 20; v++) {
    const [ec, g1b, g1d, g2b, g2d] = EC_M[v];
    const dataCw = g1b * g1d + g2b * g2d;
    if (dataCw + ec * (g1b + g2b) !== TOTAL_CODEWORDS[v]) {
      throw new Error('QR хүснэгт зөрүүтэй (v' + v + ')');
    }
    // Тэмдэглэгээ 4 бит + урт (v нь 10-аас бага бол 8 бит, эс бөгөөс 16 бит)
    const lenBits = v < 10 ? 8 : 16;
    const needBits = 4 + lenBits + byteLen * 8;
    if (needBits <= dataCw * 8) return v;
  }
  throw new Error('Өгөгдөл хэт урт байна (QR v20-M багтахгүй)');
}

function buildCodewords(bytes: number[], version: number): number[] {
  const [ecLen, g1b, g1d, g2b, g2d] = EC_M[version];
  const dataCw = g1b * g1d + g2b * g2d;
  const buf = new BitBuffer();
  buf.put(0b0100, 4);                                   // байт горим
  buf.put(bytes.length, version < 10 ? 8 : 16);
  for (const b of bytes) buf.put(b, 8);

  // Terminator + 8 битийн зэрэгцүүлэлт
  const capacity = dataCw * 8;
  const term = Math.min(4, capacity - buf.length);
  buf.put(0, term);
  while (buf.length % 8 !== 0) buf.bits.push(0);

  const words: number[] = [];
  for (let i = 0; i < buf.length; i += 8) {
    let byte = 0;
    for (let j = 0; j < 8; j++) byte = (byte << 1) | buf.bits[i + j];
    words.push(byte);
  }
  // Дүүргэгч байтууд
  const PAD = [0xec, 0x11];
  let p = 0;
  while (words.length < dataCw) words.push(PAD[p++ % 2]);

  // Блокчлол
  const blocks: number[][] = [];
  let pos = 0;
  for (let i = 0; i < g1b; i++) { blocks.push(words.slice(pos, pos + g1d)); pos += g1d; }
  for (let i = 0; i < g2b; i++) { blocks.push(words.slice(pos, pos + g2d)); pos += g2d; }
  const ecBlocks = blocks.map((b) => rsEncode(b, ecLen));

  // Хооронд нь сүлжих
  const out: number[] = [];
  const maxData = Math.max(...blocks.map((b) => b.length));
  for (let i = 0; i < maxData; i++) {
    for (const b of blocks) if (i < b.length) out.push(b[i]);
  }
  for (let i = 0; i < ecLen; i++) {
    for (const b of ecBlocks) out.push(b[i]);
  }
  return out;
}

// ------------------------------ Матриц --------------------------------------
type Matrix = (number | null)[][];

type MatrixState = {
  modules: Matrix;
  reserved: boolean[][];
  size: number;
};

export function versionBits(version: number): number {
  let d = version << 12;
  for (let i = 0; i < 6; i++) {
    if (d & (1 << (17 - i))) d ^= 0x1f25 << (5 - i);
  }
  return (version << 12) | d;
}

export function formatBits(maskId: number): number {
  // EC түвшин M = 0b00
  const data = (0b00 << 3) | maskId;
  let d = data << 10;
  for (let i = 0; i < 5; i++) {
    if (d & (1 << (14 - i))) d ^= 0x537 << (4 - i);
  }
  return ((data << 10) | d) ^ 0b101010000010010;
}

export function createMatrix(version: number): MatrixState {
  const size = version * 4 + 17;
  const modules: Matrix = Array.from({ length: size }, () => new Array(size).fill(null));
  const reserved: boolean[][] = Array.from({ length: size }, () => new Array(size).fill(false));

  const setF = (r: number, c: number, v: number): void => { modules[r][c] = v; reserved[r][c] = true; };

  // Хайлтын хэв (finder) + тусгаарлагч
  const finder = (row: number, col: number): void => {
    for (let r = -1; r <= 7; r++) {
      for (let c = -1; c <= 7; c++) {
        const rr = row + r;
        const cc = col + c;
        if (rr < 0 || rr >= size || cc < 0 || cc >= size) continue;
        const on = (r >= 0 && r <= 6 && (c === 0 || c === 6)) ||
                   (c >= 0 && c <= 6 && (r === 0 || r === 6)) ||
                   (r >= 2 && r <= 4 && c >= 2 && c <= 4);
        setF(rr, cc, on ? 1 : 0);
      }
    }
  };
  finder(0, 0);
  finder(0, size - 7);
  finder(size - 7, 0);

  // Цаг тохируулагч (timing)
  for (let i = 8; i < size - 8; i++) {
    setF(6, i, i % 2 === 0 ? 1 : 0);
    setF(i, 6, i % 2 === 0 ? 1 : 0);
  }

  // Зэрэгцүүлэх хэв (alignment)
  const centers = ALIGN[version];
  for (const r of centers) {
    for (const c of centers) {
      if ((r <= 8 && c <= 8) || (r <= 8 && c >= size - 9) || (r >= size - 9 && c <= 8)) continue;
      for (let dr = -2; dr <= 2; dr++) {
        for (let dc = -2; dc <= 2; dc++) {
          const on = Math.max(Math.abs(dr), Math.abs(dc)) !== 1;
          setF(r + dr, c + dc, on ? 1 : 0);
        }
      }
    }
  }

  // Үргэлж бараан модуль
  setF(size - 8, 8, 1);

  // Формат мэдээллийн талбайг нөөцлөнө
  for (let i = 0; i < 9; i++) {
    if (modules[8][i] === null) { modules[8][i] = 0; reserved[8][i] = true; }
    if (modules[i][8] === null) { modules[i][8] = 0; reserved[i][8] = true; }
  }
  for (let i = 0; i < 8; i++) {
    if (modules[8][size - 1 - i] === null) { modules[8][size - 1 - i] = 0; reserved[8][size - 1 - i] = true; }
    if (modules[size - 1 - i][8] === null) { modules[size - 1 - i][8] = 0; reserved[size - 1 - i][8] = true; }
  }

  // Хувилбарын мэдээлэл (v нь 7-оос дээш)
  if (version >= 7) {
    const bits = versionBits(version);
    for (let i = 0; i < 18; i++) {
      const bit = (bits >> i) & 1;
      const r = Math.floor(i / 3);
      const c = size - 11 + (i % 3);
      setF(r, c, bit);
      setF(c, r, bit);
    }
  }

  return { modules, reserved, size };
}

function placeData(state: MatrixState, codewords: number[]): MatrixState {
  const { modules, reserved, size } = state;
  const bits: number[] = [];
  for (const cw of codewords) {
    for (let i = 7; i >= 0; i--) bits.push((cw >> i) & 1);
  }

  let bitIndex = 0;
  let upward = true;
  for (let right = size - 1; right >= 1; right -= 2) {
    if (right === 6) right = 5;                        // цаг тохируулагчийн багана алгасна
    for (let step = 0; step < size; step++) {
      const row = upward ? size - 1 - step : step;
      for (let c = 0; c < 2; c++) {
        const col = right - c;
        if (reserved[row][col]) continue;
        modules[row][col] = bitIndex < bits.length ? bits[bitIndex] : 0;
        bitIndex++;
      }
    }
    upward = !upward;
  }
  return state;
}

export const MASKS: ((r: number, c: number) => boolean)[] = [
  (r, c) => (r + c) % 2 === 0,
  (r) => r % 2 === 0,
  (_r, c) => c % 3 === 0,
  (r, c) => (r + c) % 3 === 0,
  (r, c) => (Math.floor(r / 2) + Math.floor(c / 3)) % 2 === 0,
  (r, c) => ((r * c) % 2) + ((r * c) % 3) === 0,
  (r, c) => (((r * c) % 2) + ((r * c) % 3)) % 2 === 0,
  (r, c) => (((r + c) % 2) + ((r * c) % 3)) % 2 === 0,
];

function applyMask(state: MatrixState, maskId: number): number[][] {
  const { modules, reserved, size } = state;
  const out = modules.map((row) => row.slice()) as number[][];
  const fn = MASKS[maskId];
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      if (reserved[r][c]) continue;
      if (fn(r, c)) out[r][c] ^= 1;
    }
  }
  return out;
}

function writeFormat(matrix: number[][], size: number, maskId: number): void {
  const bits = formatBits(maskId);
  for (let i = 0; i < 15; i++) {
    const bit = (bits >> i) & 1;
    // Зүүн дээд
    if (i < 6) matrix[8][i] = bit;
    else if (i === 6) matrix[8][7] = bit;
    else if (i === 7) matrix[8][8] = bit;
    else if (i === 8) matrix[7][8] = bit;
    else matrix[14 - i][8] = bit;
    // Хуулбар
    if (i < 8) matrix[size - 1 - i][8] = bit;
    else matrix[8][size - 15 + i] = bit;
  }
  matrix[size - 8][8] = 1;
}

function penalty(matrix: number[][], size: number): number {
  let score = 0;
  // Дүрэм 1 — эгнээ/баганад 5 буюу түүнээс олон ижил модуль
  for (let i = 0; i < size; i++) {
    for (const line of [matrix[i], matrix.map((row) => row[i])]) {
      let run = 1;
      for (let j = 1; j < size; j++) {
        if (line[j] === line[j - 1]) run++;
        else { if (run >= 5) score += run - 2; run = 1; }
      }
      if (run >= 5) score += run - 2;
    }
  }
  // Дүрэм 2 — 2x2 ижил блок
  for (let r = 0; r < size - 1; r++) {
    for (let c = 0; c < size - 1; c++) {
      const v = matrix[r][c];
      if (v === matrix[r][c + 1] && v === matrix[r + 1][c] && v === matrix[r + 1][c + 1]) score += 3;
    }
  }
  // Дүрэм 3 — 1:1:3:1:1 хэв
  const P1 = [1, 0, 1, 1, 1, 0, 1, 0, 0, 0, 0];
  const P2 = [0, 0, 0, 0, 1, 0, 1, 1, 1, 0, 1];
  const match = (line: number[], start: number, pat: number[]): boolean =>
    pat.every((v, k) => line[start + k] === v);
  for (let i = 0; i < size; i++) {
    const rows = matrix[i];
    const cols = matrix.map((row) => row[i]);
    for (const line of [rows, cols]) {
      for (let j = 0; j + 11 <= size; j++) {
        if (match(line, j, P1) || match(line, j, P2)) score += 40;
      }
    }
  }
  // Дүрэм 4 — бараан модулийн харьцаа
  let dark = 0;
  for (let r = 0; r < size; r++) for (let c = 0; c < size; c++) dark += matrix[r][c];
  const ratio = (dark * 100) / (size * size);
  score += Math.floor(Math.abs(ratio - 50) / 5) * 10;
  return score;
}

// ------------------------------- Нийтийн API --------------------------------
export type EncodedQr = {
  matrix: number[][];
  size: number;
  version: number;
  mask: number;
  codewords: number[];
};

export function encode(text: string): EncodedQr {
  const bytes = Array.from(Buffer.from(String(text), 'utf8'));
  const version = chooseVersion(bytes.length);
  const codewords = buildCodewords(bytes, version);
  const state = placeData(createMatrix(version), codewords);

  let best: { matrix: number[][]; score: number; mask: number } | null = null;
  for (let mask = 0; mask < 8; mask++) {
    const candidate = applyMask(state, mask);
    writeFormat(candidate, state.size, mask);
    const score = penalty(candidate, state.size);
    if (!best || score < best.score) best = { matrix: candidate, score, mask };
  }
  return { matrix: best!.matrix, size: state.size, version, mask: best!.mask, codewords };
}

export type SvgOpts = {
  quiet?: number;
  scale?: number;
  dark?: string;
  light?: string;
};

export function toSvg(text: string, opts: SvgOpts = {}): string {
  const { matrix, size } = encode(text);
  const quiet = opts.quiet == null ? 4 : opts.quiet;
  const scale = opts.scale == null ? 8 : opts.scale;
  const dim = (size + quiet * 2) * scale;
  const dark = opts.dark || '#12040c';
  const light = opts.light || '#ffffff';

  let path = '';
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      if (matrix[r][c]) {
        path += 'M' + (c + quiet) * scale + ' ' + (r + quiet) * scale +
                'h' + scale + 'v' + scale + 'h-' + scale + 'z';
      }
    }
  }
  return '<svg xmlns="http://www.w3.org/2000/svg" width="' + dim + '" height="' + dim +
    '" viewBox="0 0 ' + dim + ' ' + dim + '" shape-rendering="crispEdges" role="img" aria-label="QPay QR">' +
    '<rect width="' + dim + '" height="' + dim + '" fill="' + light + '"/>' +
    '<path d="' + path + '" fill="' + dark + '"/></svg>';
}
