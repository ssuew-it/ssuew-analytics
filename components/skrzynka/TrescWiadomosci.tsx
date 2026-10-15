import { bezpiecznyHtml } from '@/lib/skrzynka/html'
import type { WiadomoscPelna } from '@/lib/skrzynka/typy'

/**
 * HTML maila w ramce bez skryptów i bez dostępu do strony D.E.C.K. Linki
 * otwierają się w nowej karcie (`allow-popups`), zewnętrzne obrazki blokuje
 * CSP. Wysokość stała z możliwością rozciągnięcia - ramka bez skryptów nie
 * zmierzy sama swojej treści.
 */
export function TrescWiadomosci({ w }: { w: WiadomoscPelna }) {
  if (w.html) {
    return (
      <iframe
        title={`Treść: ${w.temat || 'wiadomość'}`}
        sandbox="allow-popups allow-popups-to-escape-sandbox"
        srcDoc={bezpiecznyHtml(w.html)}
        className="h-[420px] w-full resize-y rounded-md border border-white/10 bg-white"
      />
    )
  }
  return (
    <pre className="whitespace-pre-wrap break-words font-sans text-[12.5px] leading-relaxed text-deck-text">
      {w.tekst ?? '(brak treści)'}
    </pre>
  )
}
