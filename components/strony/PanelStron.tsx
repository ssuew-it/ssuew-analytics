'use client'
import { use, useState } from 'react'
import { AlertTriangle } from 'lucide-react'
import { podsumujStrony, type WynikStrony } from '@/lib/strony/model'
import { opisZmiany } from '@/lib/strony/okresy'
import { InstrukcjaDostepu } from './InstrukcjaDostepu'
import { Liczba, ZakladkaStrony, liczba } from './ZakladkaStrony'

const witrynaWyniku = (w: WynikStrony) => (w.ok ? w.dane.witryna : w.witryna)
const nazwaWyniku = (w: WynikStrony) => (w.ok ? w.dane.nazwa : w.nazwa)

/** `wyniki` = `null`, gdy nie dało się odczytać samej listy stron. */
export function PanelStron({ wyniki, email }: { wyniki: Promise<WynikStrony[] | null>; email: string | null }) {
  const lista = use(wyniki)
  const [wybrana, setWybrana] = useState<string | null>(null)

  if (lista === null) {
    return (
      <p role="alert" className="rounded-lg border border-deck-danger-border bg-deck-danger-bg px-4 py-3 text-[12.5px] text-deck-danger">
        Nie udało się odczytać listy stron - odśwież stronę za chwilę.
      </p>
    )
  }

  if (lista.length === 0) {
    return (
      <section className="deck-card max-w-[640px] space-y-3 rounded-lg p-5 text-[12.5px]">
        <h2 className="font-semibold text-deck-text">Nie ma jeszcze żadnej strony</h2>
        <p className="text-deck-muted">Panel czyta dane z Google Search Console przez konto serwisowe. Jednorazowo:</p>
        <InstrukcjaDostepu email={email} />
        <p className="text-deck-muted">Potem „Dodaj stronę” u góry.</p>
      </section>
    )
  }

  const p = podsumujStrony(lista)
  // Po usunięciu wybranej strony jej identyfikatora już nie ma - wracamy na pierwszą.
  const wynik = lista.find((w) => witrynaWyniku(w) === wybrana) ?? lista[0]

  return (
    <div className="space-y-5">
      <section aria-label="Podsumowanie wszystkich stron" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Liczba etykieta="Kliknięcia razem" wartosc={liczba(p.klikniecia)} zmiana={opisZmiany('klikniecia', p.klikniecia, p.poprzednieKlikniecia)} />
        <Liczba etykieta="Wyświetlenia razem" wartosc={liczba(p.wyswietlenia)} zmiana={opisZmiany('wyswietlenia', p.wyswietlenia, p.poprzednieWyswietlenia)} />
        <Liczba etykieta="Alerty spadku" wartosc={String(p.alerty)} opis={p.alerty ? 'spadek ≥ 30%' : 'bez spadków'} />
        <Liczba etykieta="Strony" wartosc={String(p.stron)} opis={p.bledy ? `${p.bledy} z błędem` : 'wszystkie odpowiadają'} />
      </section>

      <div>
        <div role="tablist" aria-label="Strony" className="mb-3 flex flex-wrap gap-1.5">
          {lista.map((w) => {
            const id = witrynaWyniku(w)
            const aktywna = id === witrynaWyniku(wynik)
            return (
              <button
                key={id}
                type="button"
                role="tab"
                aria-selected={aktywna}
                onClick={() => setWybrana(id)}
                className={`inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-[12px] transition ${
                  aktywna ? 'border-deck-accent/50 bg-deck-accent/10 text-deck-text' : 'border-white/10 text-deck-muted hover:text-deck-text'
                }`}
              >
                {nazwaWyniku(w)}
                {!w.ok && <span className="text-deck-danger">(błąd)</span>}
                {w.ok && w.dane.alert && <AlertTriangle size={11} className="text-deck-warn" aria-label="spadek" />}
              </button>
            )
          })}
        </div>
        <div role="tabpanel" aria-label={nazwaWyniku(wynik)}>
          <ZakladkaStrony key={witrynaWyniku(wynik)} wynik={wynik} />
        </div>
      </div>
    </div>
  )
}

export function SzkieletStron() {
  return (
    <div aria-busy="true" aria-label="Wczytuję dane Search Console" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {Array.from({ length: 4 }, (_, i) => (
        <div key={i} className="deck-card h-[96px] animate-pulse rounded-lg" />
      ))}
    </div>
  )
}
