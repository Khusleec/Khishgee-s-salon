// Round-trip check: decode qr.ts output back to the original string.
// Verifies data placement, masking, format info, block interleaving.

import * as qr from '../lib/qr.ts';

function readFormat(matrix: number[][], _size: number): { ecLevel: number; maskId: number; raw: number } {
  // read the copy along row 8 / column 8 (primary copy)
  const bits: number[] = [];
  for (let i = 0; i < 15; i++) {
    let bit: number;
    if (i < 6) bit = matrix[8][i];
    else if (i === 6) bit = matrix[8][7];
    else if (i === 7) bit = matrix[8][8];
    else if (i === 8) bit = matrix[7][8];
    else bit = matrix[14 - i][8];
    bits.push(bit);
  }
  let raw = 0;
  for (let i = 0; i < 15; i++) raw |= bits[i] << i;
  const unmasked = raw ^ 0b101010000010010;
  const ecLevel = (unmasked >> 13) & 0b11;
  const maskId = (unmasked >> 10) & 0b111;
  return { ecLevel, maskId, raw };
}

function decode(text: string): { text: string; version: number; mask: number; size: number } {
  const enc = qr.encode(text);
  const { matrix, size, version } = enc;

  // 1. format info
  const fmt = readFormat(matrix, size);
  if (fmt.maskId !== enc.mask) throw new Error(`mask mismatch: format says ${fmt.maskId}, encoder used ${enc.mask}`);
  if (fmt.ecLevel !== 0) throw new Error(`EC level in format info is ${fmt.ecLevel}, expected 0 (=M)`);
  // verify BCH is self-consistent
  if (qr.formatBits(fmt.maskId) !== fmt.raw) throw new Error('format BCH mismatch');

  // 2. unmask (using a fresh reserved map for this version)
  const fresh = qr.createMatrix(version);
  const reserved = fresh.reserved;
  const maskFn = qr.MASKS[fmt.maskId];
  const plain = matrix.map((row) => row.slice());
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      if (reserved[r][c]) continue;
      if (maskFn(r, c)) plain[r][c] ^= 1;
    }
  }

  // 3. read bits in zigzag order
  const bits: number[] = [];
  let upward = true;
  for (let right = size - 1; right >= 1; right -= 2) {
    if (right === 6) right = 5;
    for (let step = 0; step < size; step++) {
      const row = upward ? size - 1 - step : step;
      for (let c = 0; c < 2; c++) {
        const col = right - c;
        if (reserved[row][col]) continue;
        bits.push(plain[row][col]);
      }
    }
    upward = !upward;
  }

  // 4. bits -> codewords, compare against what the encoder produced
  const cw: number[] = [];
  for (let i = 0; i + 8 <= bits.length; i += 8) {
    let b = 0;
    for (let j = 0; j < 8; j++) b = (b << 1) | bits[i + j];
    cw.push(b);
  }
  const expected = enc.codewords;
  for (let i = 0; i < expected.length; i++) {
    if (cw[i] !== expected[i]) {
      throw new Error(`codeword ${i} differs: read ${cw[i]}, encoded ${expected[i]}`);
    }
  }

  // 5. de-interleave -> data blocks -> bitstream -> text
  const [, g1b, g1d, g2b, g2d] = qr.EC_M[version];
  const blockSizes: number[] = [];
  for (let i = 0; i < g1b; i++) blockSizes.push(g1d);
  for (let i = 0; i < g2b; i++) blockSizes.push(g2d);
  const blocks: number[][] = blockSizes.map(() => []);
  const maxLen = Math.max(...blockSizes);
  let idx = 0;
  for (let i = 0; i < maxLen; i++) {
    for (let b = 0; b < blocks.length; b++) {
      if (i < blockSizes[b]) blocks[b].push(cw[idx++]);
    }
  }
  const data = ([] as number[]).concat(...blocks);

  const dbits: number[] = [];
  for (const byte of data) for (let i = 7; i >= 0; i--) dbits.push((byte >> i) & 1);
  let p = 0;
  const take = (n: number): number => { let v = 0; for (let i = 0; i < n; i++) v = (v << 1) | dbits[p++]; return v; };
  const mode = take(4);
  if (mode !== 0b0100) throw new Error(`mode is ${mode.toString(2)}, expected 0100 (byte)`);
  const len = take(version < 10 ? 8 : 16);
  const out: number[] = [];
  for (let i = 0; i < len; i++) out.push(take(8));
  return { text: Buffer.from(out).toString('utf8'), version, mask: fmt.maskId, size };
}

const CASES = [
  'HELLO',
  'https://s.qpay.mn/x/abcdef123456',
  "Khishgee's Salon — захиалга KS10012345",
  'Нууц үг сэргээх код: 483920',
  JSON.stringify({ invoice: 'inv_abc123', amount: 128000, currency: 'MNT' }),
  'x'.repeat(120),
  'у'.repeat(200),
  'z'.repeat(600),
];

let pass = 0;
let fail = 0;
for (const c of CASES) {
  try {
    const r = decode(c);
    if (r.text !== c) throw new Error(`text mismatch:\n  in : ${c.slice(0, 60)}\n  out: ${r.text.slice(0, 60)}`);
    console.log(`  PASS  v${String(r.version).padStart(2)} ${String(r.size).padStart(3)}x${r.size} mask=${r.mask}  bytes=${Buffer.byteLength(c)}  "${c.slice(0, 34)}${c.length > 34 ? '…' : ''}"`);
    pass++;
  } catch (e) {
    console.log(`  FAIL  "${c.slice(0, 34)}" -> ${(e as Error).message}`);
    fail++;
  }
}

try {
  qr.encode('z'.repeat(900));
  console.log('  FAIL  over-capacity input did not throw');
  fail++;
} catch (e) {
  console.log('  PASS  over-capacity input rejected: ' + (e as Error).message);
  pass++;
}

// structural checks on a sample symbol
const { matrix, size } = qr.encode('structure check');
const finderOk = (r0: number, c0: number): boolean => {
  const pat = [
    [1,1,1,1,1,1,1],[1,0,0,0,0,0,1],[1,0,1,1,1,0,1],
    [1,0,1,1,1,0,1],[1,0,1,1,1,0,1],[1,0,0,0,0,0,1],[1,1,1,1,1,1,1],
  ];
  for (let r = 0; r < 7; r++) for (let c = 0; c < 7; c++) {
    if (matrix[r0 + r][c0 + c] !== pat[r][c]) return false;
  }
  return true;
};
console.log('\nstructure:');
console.log('  finder TL/TR/BL:', finderOk(0, 0), finderOk(0, size - 7), finderOk(size - 7, 0));
let timingOk = true;
for (let i = 8; i < size - 8; i++) {
  if (matrix[6][i] !== (i % 2 === 0 ? 1 : 0)) timingOk = false;
  if (matrix[i][6] !== (i % 2 === 0 ? 1 : 0)) timingOk = false;
}
console.log('  timing patterns:', timingOk);
console.log('  dark module:', matrix[size - 8][8] === 1);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
