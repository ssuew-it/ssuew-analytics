'use client'
import { AlertTriangle } from 'lucide-react'
import { DNI_OKRESU, opisZmiany, type OpisZmiany } from '@/lib/strony/okresy'
import type { StatystykiStrony, WynikStrony } from '@/lib/strony/model'
import { UsunStrone } from './UsunStrone'
import { WykresStrony } from './WykresStrony'

export const liczba = (n: number) => n.toLocaleString('pl-PL')
const jedno = (n: number) => n.toLocaleString('pl-PL', { minimumFractionDigits: 1, maximumFractionDigits: 1 })

export function ZakladkaStrony({ wynik }: { wynik: WynikStrony }) {
  if (!wynik.ok) {
    return (
      <section className="space-y-3">
        <div role="alert" className="rounded-lg border border-deck-danger-border bg-deck-danger-bg px-4 py-3 text-[12.5px] text-deck-danger">
          {wynik.komunikat}
        </div>
        <UsunStrone witryna={wynik.witryna} nazwa={wynik.nazwa} />
      </section>
    )
  }

  const s = wynik.dane
  const spadek = s.zmiana.klikniecia === null ? 0 : Math.round(-s.zmiana.klikniecia * 100)
  return (
    <section className="space-y-4">
      {s.alert && (
        <div role="alert" className="flex items-center gap-2 rounded-lg border border-deck-warn/40 bg-deck-warn/10 px-4 py-3 text-[12.5px] text-deck-text">
          <AlertTriangle size={14} className="flex-none text-deck-warn" aria-hidden="true" />
          Kliknięcia spadły o {spadek}% wobec poprzednich {DNI_OKRESU} dni.
        </div>
      )}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Liczba etykieta="Kliknięcia" wartosc={liczba(s.biezace.klikniecia)} zmiana={opisZmiany('klikniecia', s.biezace.klikniecia, s.poprzednie.klikniecia)} />
        <Liczba etykieta="Wyświetlenia" wartosc={liczba(s.biezace.wyswietlenia)} zmiana={opisZmiany('wyswietlenia', s.biezace.wyswietlenia, s.poprzednie.wyswietlenia)} />
        <Liczba etykieta="CTR" wartosc={`${jedno(s.biezace.ctr * 100)}%`} zmiana={opisZmiany('ctr', s.biezace.ctr, s.poprzednie.ctr)} />
        <Liczba
          etykieta="Średnia pozycja"
          wartosc={s.biezace.pozycja ? jedno(s.biezace.pozycja) : '-'}
          zmiana={opisZmiany('pozycja', s.biezace.pozycja, s.poprzednie.pozycja)}
        />
      </div>
      <div className="deck-card rounded-lg p-4">
        <WykresStrony dzienne={s.dzienne} />
      </div>
      <div className="grid gap-3 lg:grid-cols-2">
        <Tabela tytul="Top zapytania" kolumna="Zapytanie" wiersze={s.zapytania.map((z) => ({ ...z, klucz: z.tekst, pokaz: z.tekst }))} />
        <Tabela
          tytul="Top podstrony"
          kolumna="Podstrona"
          wiersze={s.podstrony.map((p) => ({ ...p, klucz: p.adres, pokaz: p.adres.replace(/^https?:\/\//, '') }))}
        />
      </div>
      <UsunStrone witryna={s.witryna} nazwa={s.nazwa} />
    </section>
  )
}

export function Zmiana({ z }: { z: OpisZmiany }) {
  const kolor = z.dobra === null ? 'text-deck-muted' : z.dobra ? 'text-deck-accent' : 'text-deck-danger'
  const strzalka = z.kierunek === 'gora' ? '▲ ' : z.kierunek === 'dol' ? '▼ ' : ''
  return (
    <span className={`font-mono text-[11px] ${kolor}`}>
      {strzalka && <span aria-hidden="true">{strzalka}</span>}
      {z.tekst}
    </span>
  )
}

export function Liczba({ etykieta, wartosc, zmiana, opis }: { etykieta: string; wartosc: string; zmiana?: OpisZmiany; opis?: string }) {
  return (
    <div className="deck-card rounded-lg p-4">
      <div className="font-mono text-[9.5px] uppercase tracking-[0.16em] text-deck-muted/70">{etykieta}</div>
      <div className="mt-1.5 text-[24px] font-semibold tabular-nums tracking-[-0.02em] text-deck-text">{wartosc}</div>
      <div className="mt-1">
        {zmiana ? <Zmiana z={zmiana} /> : <span className="font-mono text-[11px] text-deck-muted">{opis}</span>}
      </div>
    </div>
  )
}

type Wiersz = Omit<StatystykiStrony['zapytania'][number], 'tekst'> & { klucz: string; pokaz: string }

function Tabela({ tytul, kolumna, wiersze }: { tytul: string; kolumna: string; wiersze: Wiersz[] }) {
  return (
    <section className="deck-card rounded-lg p-4">
      <h3 className="mb-2 text-[13px] font-semibold text-deck-text">{tytul}</h3>
      {wiersze.length === 0 ? (
        <p className="text-[12px] text-deck-muted">Brak danych za ten okres.</p>
      ) : (
        <table className="w-full table-fixed text-[12px]">
          <thead>
            <tr className="text-left font-mono text-[9.5px] uppercase tracking-[0.14em] text-deck-muted/70">
              <th className="py-1 font-normal">{kolumna}</th>
              <th className="w-16 py-1 text-right font-normal">Klik.</th>
              <th className="w-16 py-1 text-right font-normal">Wyśw.</th>
              <th className="w-12 py-1 text-right font-normal">Poz.</th>
            </tr>
          </thead>
          <tbody>
            {wiersze.map((w) => (
              <tr key={w.klucz} className="border-t border-white/[0.06]">
                <td className="truncate py-1.5 pr-2 text-deck-text" title={w.klucz}>{w.pokaz}</td>
                <td className="py-1.5 text-right tabular-nums">{liczba(w.klikniecia)}</td>
                <td className="py-1.5 text-right tabular-nums">{liczba(w.wyswietlenia)}</td>
                <td className="py-1.5 text-right tabular-nums">{jedno(w.pozycja)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  )
}
