// ---------------------------------------------------------------------------
// Тест ажиллуулагч
//
//   npm test            — бүх тест
//   node test/run.ts qr — зөвхөн нэг файл
//
// API/UI тестүүд ЖИНХЭНЭ мэдээллийн санд хүрэхгүй: Next-ийн production
// серверийг тусдаа порт дээр, түр хавтасны шинэ DB-тэй асаагаад, дуусахад
// устгана. (`next build` автоматаар хийгдэнэ.)
// ---------------------------------------------------------------------------

import { spawn, spawnSync } from 'node:child_process';
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';

const ROOT = path.join(import.meta.dirname, '..');
const NEXT_BIN = path.join(ROOT, 'node_modules', 'next', 'dist', 'bin', 'next');
const PORT = 3999;
const only = process.argv[2];

const UNIT = ['qr'];                 // сервер шаардахгүй
const E2E = ['api', 'ui'];           // ажиллаж буй сервер шаардана

function run(file: string, env: Record<string, string> = {}): Promise<number> {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [path.join(import.meta.dirname, `${file}.test.ts`)], {
      stdio: 'inherit',
      env: { ...process.env, ...env },
    });
    child.on('exit', (code) => resolve(code || 0));
  });
}

async function waitFor(url: string, tries = 120): Promise<boolean> {
  for (let i = 0; i < tries; i++) {
    try {
      const r = await fetch(url);
      if (r.ok) return true;
    } catch { /* not up yet */ }
    await new Promise((r) => setTimeout(r, 250));
  }
  return false;
}

let failed = 0;
const pick = (list: string[]): string[] => list.filter((f) => !only || f === only);

for (const f of pick(UNIT)) {
  console.log(`\n━━━ ${f} ━━━`);
  failed += await run(f) ? 1 : 0;
}

const e2e = pick(E2E);
if (e2e.length) {
  // Production build (байхгүй эсвэл хуучирсан бол шинэчилнэ)
  console.log('\n━━━ next build ━━━');
  const build = spawnSync(process.execPath, [NEXT_BIN, 'build'], { cwd: ROOT, stdio: 'inherit' });
  if (build.status) {
    console.error('✘ Build амжилтгүй — e2e тест ажиллуулах боломжгүй');
    process.exit(build.status ?? 1);
  }

  // Түр хавтсанд тусдаа DB
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ks-test-'));
  const server = spawn(process.execPath, [NEXT_BIN, 'start', '-p', String(PORT)], {
    cwd: ROOT,
    env: { ...process.env, KS_DATA_DIR: tmp, RESET_REVEAL_IN_MOCK: 'true' },
    stdio: ['ignore', 'pipe', 'inherit'],
  });
  let serverLog = '';
  server.stdout.on('data', (d) => { serverLog += d; });

  const up = await waitFor(`http://localhost:${PORT}/api/bootstrap`);
  if (!up) {
    console.error('Тест сервер асаагүй:\n' + serverLog);
    server.kill();
    process.exit(2);
  }

  for (const f of e2e) {
    console.log(`\n━━━ ${f} ━━━`);
    failed += await run(f, { KS_TEST_BASE: `http://localhost:${PORT}` }) ? 1 : 0;
  }

  server.kill();
  await new Promise((r) => setTimeout(r, 200));
  try { fs.rmSync(tmp, { recursive: true, force: true }); } catch { /* Windows may hold WAL briefly */ }
}

console.log(failed ? `\n✘ ${failed} тест файл амжилтгүй` : '\n✔ Бүх тест амжилттай');
process.exit(failed ? 1 : 0);
