export const CSP_MAILA = "default-src 'none'; img-src data: cid:; style-src 'unsafe-inline'; font-src data:"

/**
 * HTML maila do `<iframe sandbox srcdoc>`. Sandbox bez `allow-scripts` i tak
 * nie wykona skryptu, a CSP blokuje zewnętrzne obrazki (piksele śledzące) i
 * czcionki. Czyszczenie to druga warstwa - na wypadek błędu w pierwszej.
 */
export function bezpiecznyHtml(html: string): string {
  const czysty = html
    .replace(/<script\b[^>]*>[\s\S]*?<\/script\s*>/gi, '')
    .replace(/<\/?(script|iframe|object|embed|form|link|meta|base)\b[^>]*>/gi, '')
    .replace(/\son[a-z]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '')
    .replace(/(href|src)\s*=\s*("|')\s*javascript:[^"']*\2/gi, '$1=$2#$2')
  return (
    '<!doctype html><html><head><meta charset="utf-8">' +
    `<meta http-equiv="Content-Security-Policy" content="${CSP_MAILA}">` +
    '<base target="_blank">' +
    '<style>body{font:14px/1.5 system-ui,sans-serif;margin:12px;color:#111;background:#fff;overflow-wrap:anywhere}img{max-width:100%;height:auto}</style>' +
    `</head><body>${czysty}</body></html>`
  )
}
