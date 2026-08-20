// ---------------------------------------------------------------------------
// CSV үүсгэгч
//
// Хоёр анхаарах зүйл:
//  1. Excel нь BOM-гүй UTF-8 файлыг системийн кодоор уншдаг тул кирилл үсэг
//     «Ð¥Ð¸ÑˆÐ³ÑÑ» болж эвдэрдэг. Тиймээс эхэнд UTF-8 BOM тавина.
//  2. "=", "+", "-", "@" тэмдгээр эхэлсэн нүдийг Excel томьёо гэж үзэн
//     ажиллуулдаг (CSV injection). Тийм утгыг цэг таслалаар хамгаална.
// ---------------------------------------------------------------------------

export const BOM = '\uFEFF';

export type CsvValue = string | number | null | undefined;

export function cell(value: CsvValue): string {
  if (value == null) return '';
  let s = String(value);

  // Томьёо тарилгаас хамгаална
  if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;

  // Хашилт, таслал, мөр таслалт агуулсан бол хашилтад хийнэ
  if (/[",;\n\r]/.test(s)) s = '"' + s.replace(/"/g, '""') + '"';
  return s;
}

/**
 * @param headers толгой мөр
 * @param rows    өгөгдлийн мөрүүд
 * @param sep     Excel-ийн монгол/орос локальд ";" илүү тохирдог
 */
export function build(headers: string[], rows: CsvValue[][], sep = ','): string {
  const lines = [headers.map(cell).join(sep)];
  for (const row of rows) lines.push(row.map(cell).join(sep));
  // CRLF — Excel-д хамгийн найдвартай
  return BOM + lines.join('\r\n') + '\r\n';
}

export function toBuffer(headers: string[], rows: CsvValue[][], sep?: string): Buffer {
  return Buffer.from(build(headers, rows, sep), 'utf8');
}

// Файлын нэрийг header-т аюулгүй байдлаар суулгана
export function contentDisposition(filename: string): string {
  const ascii = filename.replace(/[^\x20-\x7e]/g, '_').replace(/["\\]/g, '');
  const encoded = encodeURIComponent(filename);
  return `attachment; filename="${ascii}"; filename*=UTF-8''${encoded}`;
}
