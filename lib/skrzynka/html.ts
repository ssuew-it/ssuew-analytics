export const CSP_MAILA = "default-src 'none'; img-src data: cid:; style-src 'unsafe-inline'; font-src data:"

export interface OpcjeRamki {
  /** Content-ID → adres obrazka wklejonego w treść (załącznik przez D.E.C.K. albo `data:`). */
  obrazki?: Record<string, string>
  /** Adres D.E.C.K. - stąd idą obrazki wklejone w treść; bez niego tylko `data:`. */
  zrodlo?: string
  /** „Pokaż obrazki”: także obrazki z internetu (zdradzają nadawcy, że mail został otwarty). */
  zSieci?: boolean
}

/** Obrazek albo tło z adresu http(s) - to on może być pikselem śledzącym. */
export function zewnetrzneObrazki(html: string): boolean {
  return (
    /<img\b[^>]*\bsrc\s*=\s*["']?\s*https?:/i.test(html) ||
    /url\(\s*["']?\s*https?:/i.test(html) ||
    /\bbackground\s*=\s*["']?\s*https?:/i.test(html)
  )
}

function polityka(o: OpcjeRamki): string {
  if (!o.zrodlo && !o.zSieci) return CSP_MAILA
  const obrazy = ['data:', 'cid:', o.zrodlo, o.zSieci ? 'https: http:' : null].filter(Boolean).join(' ')
  return `default-src 'none'; img-src ${obrazy}; style-src 'unsafe-inline'; font-src data:`
}

/**
 * HTML maila do `<iframe sandbox srcdoc>`. Sandbox bez `allow-scripts` i tak
 * nie wykona skryptu, a CSP blokuje zewnętrzne obrazki (piksele śledzące) i
 * czcionki - chyba że użytkownik kliknie „Pokaż obrazki”. Obrazki wklejone w
 * treść (`cid:`) dostają adres załącznika. Czyszczenie to druga warstwa - na
 * wypadek błędu w pierwszej.
 */
export function bezpiecznyHtml(html: string, o: OpcjeRamki = {}): string {
  const czysty = html
    .replace(/<script\b[^>]*>[\s\S]*?<\/script\s*>/gi, '')
    .replace(/<\/?(script|iframe|object|embed|form|link|meta|base)\b[^>]*>/gi, '')
    .replace(/\son[a-z]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '')
    .replace(/(href|src)\s*=\s*("|')\s*javascript:[^"']*\2/gi, '$1=$2#$2')
    .replace(/\bsrc\s*=\s*("|')cid:([^"']+)\1/gi, (calosc, q: string, cid: string) => {
      const adres = o.obrazki?.[cid]
      return adres ? `src=${q}${adres.replace(/["'<>]/g, '')}${q}` : calosc
    })
  return (
    '<!doctype html><html><head><meta charset="utf-8">' +
    `<meta http-equiv="Content-Security-Policy" content="${polityka(o)}">` +
    '<base target="_blank">' +
    // Klik w link z maila nie zdradza nadawcy adresu D.E.C.K.
    '<meta name="referrer" content="no-referrer">' +
    '<style>body{font:14px/1.5 system-ui,sans-serif;margin:12px;color:#111;background:#fff;overflow-wrap:anywhere}img{max-width:100%;height:auto}</style>' +
    `</head><body>${czysty}</body></html>`
  )
}
