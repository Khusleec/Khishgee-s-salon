'use strict';

// ---------------------------------------------------------------------------
// CSV үүсгэгч
//
// Хоёр анхаарах зүйл:
//  1. Excel нь BOM-гүй UTF-8 файлыг системийн кодоор уншдаг тул кирилл үсэг
//     «Ð¥Ð¸ÑˆÐ³ÑÑ» болж эвдэрдэг. Тиймээс эхэнд UTF-8 BOM тавина.
//  2. "=", "+", "-", "@" тэмдгээр эхэлсэн нүдийг Excel томьёо гэж үзэн
//     ажиллуулдаг (CSV injection). Тийм утгыг цэг таслалаар хамгаална.
// ---------------------------------------------------------------------------

const BOM = '\uFEFF';

function cell(value) {
  if (value == null) return '';
  let s = String(value);

  // Томьёо тарилгаас хамгаална
  if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;

  // Хашилт, таслал, мөр таслалт агуулсан бол хашилтад хийнэ
  if (/[",;\n\r]/.test(s)) s = '"' + s.replace(/"/g, '""') + '"';
  return s;
}

/**
 * @param {string[]} headers  толгой мөр
 * @param {Array<Array>} rows өгөгдлийн мөрүүд
 * @param {string} sep        Excel-ийн монгол/орос локальд ";" илүү тохирдог
 */
function build(headers, rows, sep = ',') {
  const lines = [headers.map(cell).join(sep)];
  for (const row of rows) lines.push(row.map(cell).join(sep));
  // CRLF — Excel-д хамгийн найдвартай
  return BOM + lines.join('\r\n') + '\r\n';
}

function toBuffer(headers, rows, sep) {
  return Buffer.from(build(headers, rows, sep), 'utf8');
}

// Файлын нэрийг header-т аюулгүй байдлаар суулгана
function contentDisposition(filename) {
  const ascii = filename.replace(/[^\x20-\x7e]/g, '_').replace(/["\\]/g, '');
  const encoded = encodeURIComponent(filename);
  return `attachment; filename="${ascii}"; filename*=UTF-8''${encoded}`;
}

module.exports = { build, toBuffer, cell, contentDisposition, BOM };
