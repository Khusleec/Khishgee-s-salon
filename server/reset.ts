// Мэдээллийн санг устгаж, жишээ өгөгдлийг шинээр ачаална.
//   npm run reset

import fs from 'node:fs';
import path from 'node:path';

const DATA_DIR = path.join(import.meta.dirname, '..', 'data');
const files = ['salon.db', 'salon.db-wal', 'salon.db-shm'];

let removed = 0;
for (const f of files) {
  const full = path.join(DATA_DIR, f);
  if (fs.existsSync(full)) { fs.rmSync(full); removed++; }
}
console.log(removed ? `✔ Хуучин сан устлаа (${removed} файл).` : 'Сан олдсонгүй — шинээр үүсгэнэ.');

const { seedDatabase } = await import('./db.ts');
seedDatabase();
console.log('✔ Жишээ өгөгдөл дахин ачааллаа. `npm start` командаар серверээ асаана уу.');
