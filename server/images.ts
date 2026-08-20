// ---------------------------------------------------------------------------
// Бүтээгдэхүүний зургийг SVG-ээр үүсгэнэ (гадаад файл, интернэт шаардахгүй).
// hue = 0..360, shape = bottle | jar | tube | spray | drop | polish | tool | set
// ---------------------------------------------------------------------------

const esc = (s: unknown): string => String(s).replace(/[<>&"']/g, (c) =>
  ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&#39;' }[c] as string));

type Palette = {
  bgA: string;
  bgB: string;
  deep: string;
  mid: string;
  light: string;
  cap: string;
  capHi: string;
};

function palette(hue: number | string): Palette {
  const h = ((Number(hue) || 300) % 360 + 360) % 360;
  return {
    bgA: `hsl(${h} 46% 95%)`,
    bgB: `hsl(${(h + 24) % 360} 40% 88%)`,
    deep: `hsl(${h} 52% 38%)`,
    mid: `hsl(${h} 58% 52%)`,
    light: `hsl(${h} 62% 68%)`,
    cap: `hsl(${(h + 340) % 360} 26% 26%)`,
    capHi: `hsl(${(h + 340) % 360} 22% 40%)`,
  };
}

function shapeBody(shape: string, c: Palette): string {
  switch (shape) {
    case 'jar':
      return `
        <rect x="168" y="248" width="264" height="184" rx="34" fill="url(#g1)"/>
        <rect x="152" y="196" width="296" height="70" rx="26" fill="${c.cap}"/>
        <rect x="152" y="196" width="296" height="24" rx="12" fill="${c.capHi}" opacity=".55"/>
        <rect x="196" y="286" width="34" height="108" rx="17" fill="#fff" opacity=".26"/>`;

    case 'tube':
      return `
        <path d="M232 214h136l26 208a44 44 0 0 1-43 50H249a44 44 0 0 1-43-50z" fill="url(#g1)"/>
        <rect x="238" y="168" width="124" height="54" rx="14" fill="${c.cap}"/>
        <rect x="238" y="168" width="124" height="18" rx="9" fill="${c.capHi}" opacity=".5"/>
        <rect x="252" y="252" width="26" height="180" rx="13" fill="#fff" opacity=".24"/>`;

    case 'spray':
      return `
        <rect x="204" y="240" width="192" height="232" rx="40" fill="url(#g1)"/>
        <rect x="268" y="182" width="64" height="66" fill="${c.deep}" opacity=".85"/>
        <path d="M256 130h108a16 16 0 0 1 16 16v40H240v-40a16 16 0 0 1 16-16z" fill="${c.cap}"/>
        <rect x="366" y="140" width="52" height="18" rx="9" fill="${c.cap}"/>
        <rect x="234" y="278" width="28" height="150" rx="14" fill="#fff" opacity=".26"/>`;

    case 'drop':
      return `
        <rect x="222" y="252" width="156" height="216" rx="34" fill="url(#g1)"/>
        <rect x="256" y="196" width="88" height="62" rx="10" fill="${c.cap}"/>
        <rect x="284" y="112" width="32" height="92" rx="16" fill="${c.capHi}"/>
        <circle cx="300" cy="106" r="26" fill="${c.cap}"/>
        <rect x="248" y="290" width="24" height="140" rx="12" fill="#fff" opacity=".26"/>`;

    case 'polish':
      return `
        <path d="M226 300h148a26 26 0 0 1 26 26v122a30 30 0 0 1-30 30H230a30 30 0 0 1-30-30V326a26 26 0 0 1 26-26z" fill="url(#g1)"/>
        <rect x="278" y="266" width="44" height="42" fill="${c.deep}" opacity=".9"/>
        <rect x="262" y="128" width="76" height="142" rx="18" fill="${c.cap}"/>
        <rect x="262" y="128" width="76" height="34" rx="17" fill="${c.capHi}" opacity=".65"/>
        <rect x="226" y="330" width="26" height="112" rx="13" fill="#fff" opacity=".28"/>`;

    case 'set':
      return `
        <g transform="translate(-96,26) scale(.72)">
          <path d="M226 300h148a26 26 0 0 1 26 26v122a30 30 0 0 1-30 30H230a30 30 0 0 1-30-30V326a26 26 0 0 1 26-26z" fill="url(#g1)"/>
          <rect x="262" y="150" width="76" height="150" rx="18" fill="${c.cap}"/>
        </g>
        <g transform="translate(96,26) scale(.72)">
          <path d="M226 300h148a26 26 0 0 1 26 26v122a30 30 0 0 1-30 30H230a30 30 0 0 1-30-30V326a26 26 0 0 1 26-26z" fill="url(#g2)"/>
          <rect x="262" y="150" width="76" height="150" rx="18" fill="${c.cap}"/>
        </g>
        <g transform="translate(0,-16) scale(.82)">
          <path d="M226 300h148a26 26 0 0 1 26 26v122a30 30 0 0 1-30 30H230a30 30 0 0 1-30-30V326a26 26 0 0 1 26-26z" fill="url(#g1)"/>
          <rect x="262" y="150" width="76" height="150" rx="18" fill="${c.cap}"/>
          <rect x="248" y="330" width="24" height="104" rx="12" fill="#fff" opacity=".3"/>
        </g>`;

    case 'tool':
      return `
        <rect x="150" y="238" width="220" height="150" rx="46" fill="url(#g1)"/>
        <rect x="352" y="286" width="118" height="54" rx="27" fill="${c.cap}"/>
        <circle cx="466" cy="313" r="34" fill="${c.capHi}"/>
        <path d="M214 384h96l-16 118a30 30 0 0 1-30 26h-4a30 30 0 0 1-30-26z" fill="${c.deep}"/>
        <rect x="186" y="270" width="30" height="86" rx="15" fill="#fff" opacity=".28"/>
        <circle cx="262" cy="313" r="26" fill="#fff" opacity=".22"/>`;

    default: // bottle
      return `
        <path d="M226 232h148a34 34 0 0 1 34 34v182a44 44 0 0 1-44 44H236a44 44 0 0 1-44-44V266a34 34 0 0 1 34-34z" fill="url(#g1)"/>
        <rect x="268" y="176" width="64" height="62" fill="${c.deep}" opacity=".85"/>
        <rect x="252" y="128" width="96" height="56" rx="16" fill="${c.cap}"/>
        <rect x="252" y="128" width="96" height="18" rx="9" fill="${c.capHi}" opacity=".6"/>
        <rect x="224" y="272" width="28" height="164" rx="14" fill="#fff" opacity=".26"/>`;
  }
}

export type ProductSvgOpts = {
  hue?: number | string;
  shape?: string;
  label?: string;
  brand?: string;
};

export function productSvg({ hue = 300, shape = 'bottle', label = '', brand = '' }: ProductSvgOpts = {}): string {
  const c = palette(hue);
  const initials = esc(String(brand).trim().slice(0, 2).toUpperCase());
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 600" width="600" height="600" role="img" aria-label="${esc(label)}">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${c.bgA}"/><stop offset="1" stop-color="${c.bgB}"/>
    </linearGradient>
    <linearGradient id="g1" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${c.light}"/>
      <stop offset=".55" stop-color="${c.mid}"/>
      <stop offset="1" stop-color="${c.deep}"/>
    </linearGradient>
    <linearGradient id="g2" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${c.mid}"/><stop offset="1" stop-color="${c.cap}"/>
    </linearGradient>
    <radialGradient id="glow" cx=".5" cy=".38" r=".62">
      <stop offset="0" stop-color="#fff" stop-opacity=".85"/>
      <stop offset="1" stop-color="#fff" stop-opacity="0"/>
    </radialGradient>
    <filter id="sh" x="-30%" y="-30%" width="160%" height="160%">
      <feDropShadow dx="0" dy="18" stdDeviation="18" flood-color="${c.deep}" flood-opacity=".26"/>
    </filter>
  </defs>
  <rect width="600" height="600" fill="url(#bg)"/>
  <circle cx="300" cy="228" r="230" fill="url(#glow)"/>
  <ellipse cx="300" cy="506" rx="150" ry="24" fill="${c.deep}" opacity=".14"/>
  <g filter="url(#sh)">${shapeBody(shape, c)}</g>
  <text x="300" y="560" text-anchor="middle" font-family="Georgia, serif" font-size="34"
        letter-spacing="6" fill="${c.deep}" opacity=".42">${initials}</text>
</svg>`;
}
