// Мэдээллийн санг устгаж, жишээ өгөгдлийг шинээр ачаална.
//   npm run reset

import fs from 'node:fs';
import path from 'node:path';

const DATA_DIR = process.env.KS_DATA_DIR || path.join(process.cwd(), 'data');
const files = ['salon.db', 'salon.db-wal', 'salon.db-shm'];

let removed = 0;
for (const f of files) {
  const full = path.join(DATA_DIR, f);
  if (fs.existsSync(full)) { fs.rmSync(full); removed++; }
}
console.log(removed ? `✔ Хуучин сан устлаа (${removed} файл).` : 'Сан олдсонгүй — шинээр үүсгэнэ.');

// db.ts импортлогдмогц шинэ сан үүсгэж, өөрөө жишээ өгөгдлөө ачаална
await import('../lib/db.ts');
console.log('✔ Жишээ өгөгдөл дахин ачааллаа. `npm run dev` эсвэл `npm start` командаар серверээ асаана уу.');
