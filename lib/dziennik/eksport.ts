import { dzisWarszawa } from '@/lib/czas'
import type { Data } from '@/lib/planer/trwanie'
import { ETYKIETY_DZIALOW, ETYKIETY_STANU, ETYKIETY_STANU_CELU, ETYKIETY_STATUSU, opisTerminu } from './etykiety'
import { otwarty, stanCelu, stanWpisu } from './stan'
import { DZIALY, type Adnotacja, type Kadencja, type Ksiega, type Wpis } from './typy'

export function escapujHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;')
}

const dwie = (n: number) => String(n).padStart(2, '0')
const naTekst = (d: Data) => `${dwie(d.dzien)}.${dwie(d.miesiac)}.${d.rok}`
const dataMs = (ms: number) => naTekst(dzisWarszawa(new Date(ms)))

/** Akapity z pustych linii; adresy http(s) jako linki. Escapowanie przed linkowaniem - nic z treści nie staje się kodem. */
function tekstNaHtml(s: string): string {
  return s
    .split(/\n\s*\n/)
    .map((a) => a.trim())
    .filter(Boolean)
    .map((a) => `<p>${escapujHtml(a).replace(/https?:\/\/[^\s<]+/g, (u) => `<a href="${u}">${u}</a>`).replace(/\n/g, '<br>')}</p>`)
    .join('\n')
}

function podpisKadencji(k: Kadencja | undefined): string {
  return k ? `${k.nazwa} · ${k.autor}` : 'nieznana kadencja'
}

function adnotacjaNaHtml(a: Adnotacja, kadencje: Map<string, Kadencja>, w: Wpis): string {
  const cel = a.celId && w.dzial === 'strategia' ? w.cele.find((c) => c.id === a.celId) : null
  const co = [
    a.stan ? ETYKIETY_STANU[a.stan] : null,
    cel && a.stanCelu ? `cel „${cel.tresc}” ${ETYKIETY_STANU_CELU[a.stanCelu]}` : null,
  ].filter(Boolean).join(', ')
  const komentarz = a.komentarz ? `„${a.komentarz}”` : ''
  return `<li>${escapujHtml(`${podpisKadencji(kadencje.get(a.kadencjaId))}: ${[co, komentarz].filter(Boolean).join(' - ')}`)}</li>`
}

function polaDzialu(w: Wpis): string[] {
  switch (w.dzial) {
    case 'cykl':
      return [
        `Termin: ${opisTerminu(w)}, przygotowania ${w.wyprzedzenieTygodni} tyg. wcześniej`,
        ...(w.obowiazkowe ? [`OBOWIĄZKOWE${w.rozlicza.length ? ` - rozlicza: ${w.rozlicza.join(' · ')}` : ''}`] : []),
      ]
    case 'luka':
      return w.ileCzasu ? [`Ile czasu: ${w.ileCzasu}`] : []
    case 'watek':
      return w.zostalo ? [`Co zostało: ${w.zostalo}`] : []
    case 'strategia':
      return [`Okres: ${w.okresOd}-${w.okresDo}`, `Status: ${ETYKIETY_STATUSU[w.status]}`, ...(w.uchwala ? [w.uchwala] : [])]
    default:
      return []
  }
}

function wpisNaHtml(w: Wpis, kadencje: Map<string, Kadencja>): string {
  const stan = stanWpisu(w)
  const czesci = [
    `<h3>${escapujHtml(w.tytul)}</h3>`,
    `<p class="meta">${escapujHtml(`${podpisKadencji(kadencje.get(w.kadencjaId))}${stan === 'aktualne' ? '' : ` · ${ETYKIETY_STANU[stan]}`}`)}</p>`,
    ...polaDzialu(w).map((p) => `<p class="pole">${escapujHtml(p)}</p>`),
  ]
  if (w.dzial === 'strategia') {
    if (w.link) czesci.push(`<p><a href="${escapujHtml(w.link)}">${escapujHtml(w.link)}</a></p>`)
    if (w.cele.length) {
      const cele = w.cele.map((c) => {
        const s = stanCelu(w, c.id)
        return `<li>${escapujHtml(`${c.tresc}${s ? ` - ${ETYKIETY_STANU_CELU[s]}` : ''}`)}</li>`
      })
      czesci.push(`<p class="pole">Cele:</p><ul>${cele.join('')}</ul>`)
    }
  }
  czesci.push(tekstNaHtml(w.tresc))
  if (w.adnotacje.length) {
    const po = [...w.adnotacje].sort((a, b) => a.kiedy - b.kiedy)
    czesci.push(`<ul class="adnotacje">${po.map((a) => adnotacjaNaHtml(a, kadencje, w)).join('')}</ul>`)
  }
  return `<article>${czesci.filter(Boolean).join('\n')}</article>`
}

/** Kalendarz pracy wg miesiąca i dnia; reszta: otwarte przed zamkniętymi, nowsze wyżej. */
export function uporzadkuj(wpisy: Wpis[]): Wpis[] {
  return [...wpisy].sort((a, b) => {
    if (a.dzial === 'cykl' && b.dzial === 'cykl') return a.miesiac - b.miesiac || (a.dzien ?? 99) - (b.dzien ?? 99)
    return Number(otwarty(stanWpisu(b))) - Number(otwarty(stanWpisu(a))) || b.utworzono - a.utworzono
  })
}

/** Cała księga jako samodzielny dokument HTML - kopia na Dysk i plik do pobrania. */
export function ksiegaNaHtml(k: Ksiega, dzis: Data): string {
  const tytul = `Dziennik Stratega - stan na ${naTekst(dzis)}`
  const kadencje = new Map(k.kadencje.map((x) => [x.id, x]))
  const listaKadencji = k.kadencje.map((x) => {
    const okres = x.zamknieta === null ? `od ${dataMs(x.otwarta)} (bieżąca)` : `${dataMs(x.otwarta)} - ${dataMs(x.zamknieta)}`
    return `<li>${escapujHtml(`${x.nazwa} · ${x.autor}${x.funkcja ? ` (${x.funkcja})` : ''} · ${okres}`)}</li>`
  })
  const dzialy = DZIALY.map((d) => {
    const wpisy = uporzadkuj(k.wpisy.filter((w) => w.dzial === d))
    const tresc = wpisy.length ? wpisy.map((w) => wpisNaHtml(w, kadencje)).join('\n') : '<p class="meta">Brak wpisów.</p>'
    return `<section>\n<h2>${ETYKIETY_DZIALOW[d]}</h2>\n${tresc}\n</section>`
  })
  return `<!doctype html>
<html lang="pl">
<head>
<meta charset="utf-8">
<title>${escapujHtml(tytul)}</title>
<style>
body { font-family: Arial, sans-serif; max-width: 800px; margin: 24px auto; line-height: 1.5; color: #111; }
h1 { font-size: 22px; } h2 { font-size: 18px; margin-top: 28px; border-bottom: 1px solid #ccc; } h3 { font-size: 15px; margin-bottom: 2px; }
.meta { color: #555; font-size: 12px; margin-top: 0; } .pole { font-size: 13px; margin: 2px 0; } .adnotacje { font-size: 13px; color: #333; }
</style>
</head>
<body>
<h1>${escapujHtml(tytul)}</h1>
<h2>Kadencje</h2>
<ul>${listaKadencji.join('')}</ul>
${dzialy.join('\n')}
</body>
</html>
`
}
