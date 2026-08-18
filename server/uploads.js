'use strict';

// ---------------------------------------------------------------------------
// Файл байршуулах — multipart/form-data задлагч + зургийн шалгалт
//
// Гадаад сан ашиглаагүй тул multipart-ыг гараар задалдаг. Файлын өргөтгөлд
// огт итгэхгүй: эхний байтуудаас (magic bytes) жинхэнэ төрлийг тогтооно.
// ---------------------------------------------------------------------------

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const cfg = require('./config');

const UPLOAD_DIR = cfg.uploads.dir;
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

// --------------------------- multipart задлагч -------------------------------
function getBoundary(contentType = '') {
  const m = /boundary=(?:"([^"]+)"|([^;]+))/i.exec(contentType);
  const b = m && (m[1] || m[2]);
  return b ? b.trim() : null;
}

/**
 * multipart/form-data биеийг задлана.
 * @returns {{fields: object, files: Array}}
 */
function parseMultipart(buffer, contentType) {
  const boundary = getBoundary(contentType);
  if (!boundary) throw new Error('boundary олдсонгүй');

  const delim = Buffer.from('--' + boundary);
  const fields = {};
  const files = [];

  let pos = buffer.indexOf(delim);
  if (pos < 0) throw new Error('multipart хэлбэр буруу');
  pos += delim.length;

  while (pos < buffer.length) {
    // Хаалтын тэмдэг "--"
    if (buffer[pos] === 0x2d && buffer[pos + 1] === 0x2d) break;
    // CRLF алгасна
    if (buffer[pos] === 0x0d && buffer[pos + 1] === 0x0a) pos += 2;

    const headerEnd = buffer.indexOf('\r\n\r\n', pos, 'utf8');
    if (headerEnd < 0) break;
    const rawHeaders = buffer.slice(pos, headerEnd).toString('utf8');
    const bodyStart = headerEnd + 4;

    const next = buffer.indexOf(delim, bodyStart);
    if (next < 0) break;
    // Хэсгийн төгсгөлийн CRLF-ийг хасна
    let bodyEnd = next;
    if (buffer[bodyEnd - 2] === 0x0d && buffer[bodyEnd - 1] === 0x0a) bodyEnd -= 2;
    const body = buffer.slice(bodyStart, bodyEnd);

    const disp = /content-disposition:[^\n]*/i.exec(rawHeaders);
    const dispLine = disp ? disp[0] : '';
    const nameM = /name="([^"]*)"/i.exec(dispLine);
    const fileM = /filename="([^"]*)"/i.exec(dispLine);
    const typeM = /content-type:\s*([^\r\n]+)/i.exec(rawHeaders);
    const name = nameM ? nameM[1] : '';

    if (fileM && fileM[1]) {
      files.push({
        field: name,
        filename: fileM[1],
        mime: typeM ? typeM[1].trim() : 'application/octet-stream',
        data: body,
      });
    } else if (name) {
      fields[name] = body.toString('utf8');
    }

    pos = next + delim.length;
  }

  return { fields, files };
}

// ---------------------------- Зургийн шалгалт --------------------------------
/**
 * Эхний байтуудаас зургийн жинхэнэ төрөл, хэмжээг уншина.
 * Дэмжих: JPEG, PNG, WebP, GIF
 */
function inspectImage(buf) {
  if (!buf || buf.length < 16) return null;

  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (buf[0] === 0x89 && buf.toString('ascii', 1, 4) === 'PNG') {
    // IHDR нь эхний chunk — өргөн/өндөр 16..24 байтад
    return { mime: 'image/png', ext: '.png', width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
  }

  // JPEG: FF D8 FF
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) {
    let i = 2;
    while (i < buf.length - 9) {
      if (buf[i] !== 0xff) { i++; continue; }
      const marker = buf[i + 1];
      // SOF0..SOF15 (SOF4, SOF8, SOF12 нь тайлбар биш)
      if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
        return {
          mime: 'image/jpeg',
          ext: '.jpg',
          height: buf.readUInt16BE(i + 5),
          width: buf.readUInt16BE(i + 7),
        };
      }
      const len = buf.readUInt16BE(i + 2);
      if (len < 2) break;
      i += 2 + len;
    }
    return { mime: 'image/jpeg', ext: '.jpg', width: 0, height: 0 };
  }

  // WebP: "RIFF" .... "WEBP"
  if (buf.toString('ascii', 0, 4) === 'RIFF' && buf.toString('ascii', 8, 12) === 'WEBP') {
    const chunk = buf.toString('ascii', 12, 16);
    let width = 0;
    let height = 0;
    if (chunk === 'VP8X' && buf.length >= 30) {
      width = 1 + (buf[24] | (buf[25] << 8) | (buf[26] << 16));
      height = 1 + (buf[27] | (buf[28] << 8) | (buf[29] << 16));
    } else if (chunk === 'VP8 ' && buf.length >= 30) {
      width = buf.readUInt16LE(26) & 0x3fff;
      height = buf.readUInt16LE(28) & 0x3fff;
    } else if (chunk === 'VP8L' && buf.length >= 25) {
      const bits = buf.readUInt32LE(21);
      width = (bits & 0x3fff) + 1;
      height = ((bits >> 14) & 0x3fff) + 1;
    }
    return { mime: 'image/webp', ext: '.webp', width, height };
  }

  // GIF: "GIF87a" | "GIF89a"
  if (buf.toString('ascii', 0, 3) === 'GIF') {
    return { mime: 'image/gif', ext: '.gif', width: buf.readUInt16LE(6), height: buf.readUInt16LE(8) };
  }

  return null;
}

// ------------------------------- Хадгалах ------------------------------------
function saveImage(file) {
  if (file.data.length > cfg.uploads.maxBytes) {
    const mb = Math.round(cfg.uploads.maxBytes / 1024 / 1024);
    throw new Error(`Зураг ${mb}MB-аас хэтэрч болохгүй`);
  }
  const info = inspectImage(file.data);
  if (!info) throw new Error('Зөвхөн JPG, PNG, WebP, GIF зураг оруулна уу');

  const name = crypto.randomBytes(12).toString('hex') + info.ext;
  fs.writeFileSync(path.join(UPLOAD_DIR, name), file.data);

  return {
    file: name,
    mime: info.mime,
    width: info.width,
    height: info.height,
    bytes: file.data.length,
  };
}

function removeImage(name) {
  // Зам гарахаас хамгаална — зөвхөн файлын нэр зөвшөөрнө
  const safe = path.basename(String(name || ''));
  if (!safe || safe !== name) return false;
  const full = path.join(UPLOAD_DIR, safe);
  if (!full.startsWith(UPLOAD_DIR)) return false;
  try {
    fs.unlinkSync(full);
    return true;
  } catch {
    return false;
  }
}

function readImage(name) {
  const safe = path.basename(String(name || ''));
  if (!safe || safe !== name) return null;
  const full = path.join(UPLOAD_DIR, safe);
  if (!full.startsWith(UPLOAD_DIR)) return null;
  try {
    return fs.readFileSync(full);
  } catch {
    return null;
  }
}

const MIME_BY_EXT = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
};

module.exports = { parseMultipart, inspectImage, saveImage, removeImage, readImage, MIME_BY_EXT, UPLOAD_DIR };
