'use strict';

// ---------------------------------------------------------------------------
// Тест ажиллуулагч
//
//   npm test            — бүх тест
//   node test/run.js qr — зөвхөн нэг файл
//
// API/UI тестүүд ЖИНХЭНЭ мэдээллийн санд хүрэхгүй: тусдаа порт дээр,
// түр хавтсанд шинэ DB үүсгэж сервер асаагаад, дуусахад устгана.
// ---------------------------------------------------------------------------

const { spawn } = require('node:child_process');
const path = require('node:path');
const fs = require('node:fs');
const os = require('node:os');

const ROOT = path.join(__dirname, '..');
const PORT = 3999;
const only = process.argv[2];

const UNIT = ['qr'];                 // сервер шаардахгүй
const E2E = ['api', 'ui'];           // ажиллаж буй сервер шаардана

function run(file, env = {}) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [path.join(__dirname, `${file}.test.js`)], {
      stdio: 'inherit',
      env: { ...process.env, ...env },
    });
    child.on('exit', (code) => resolve(code || 0));
  });
}

async function waitFor(url, tries = 40) {
  for (let i = 0; i < tries; i++) {
    try {
      const r = await fetch(url);
      if (r.ok) return true;
    } catch { /* not up yet */ }
    await new Promise((r) => setTimeout(r, 250));
  }
  return false;
}

(async () => {
  let failed = 0;
  const pick = (list) => list.filter((f) => !only || f === only);

  for (const f of pick(UNIT)) {
    console.log(`\n━━━ ${f} ━━━`);
    failed += await run(f) ? 1 : 0;
  }

  const e2e = pick(E2E);
  if (e2e.length) {
    // Түр хавтсанд тусдаа DB
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ks-test-'));
    const server = spawn(process.execPath, [path.join(ROOT, 'server', 'index.js')], {
      env: { ...process.env, PORT: String(PORT), KS_DATA_DIR: tmp, RESET_REVEAL_IN_MOCK: 'true' },
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
})();
