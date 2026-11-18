'use client'
import { useMemo, useState } from 'react'
import { AlertTriangle, Plus } from 'lucide-react'
import { dniWMiesiacu, dzienTygodnia } from '@/lib/planer/daty'
import { kolizjeWMiesiacu, type KolizjeDnia } from '@/lib/planer/kolizje'
import { porownajWydarzenia } from '@/lib/planer/opis'
import { odcinkiTygodnia, tygodnieMiesiaca } from '@/lib/planer/pasy'
import { dniMiedzy, dniTrwaniaWMiesiacu, poczatek } from '@/lib/planer/trwanie'
import { KATEGORIE, KLUCZE_KATEGORII, numerRangi, type Miesiac, type Wydarzenie } from '@/lib/planer/typy'
import { KartaWydarzenia } from './KartaWydarzenia'
import { PasekWielodniowy } from './PasekWielodniowy'

/** Od góry kratki do miejsca pod numerem dnia (padding + wiersz z numerem). */
const NAGLOWEK_KRATKI = 24
/** Wiersz jednego paska wielodniowego: pasek 22 px i odstęp. */
const WYSOKOSC_PASA = 24
const NAGLOWKI = ['Pon', 'Wt', 'Śr', 'Czw', 'Pt', 'Sob', 'Nie']
const NAZWA_MIESIACA = [
  'stycznia', 'lutego', 'marca', 'kwietnia', 'maja', 'czerwca',
  'lipca', 'sierpnia', 'września', 'października', 'listopada', 'grudnia',
]

type Props = {
  miesiac: Miesiac
  /** Wydarzenia, które nachodzą na miesiąc - także wielodniowe ze startem obok. */
  wydarzenia: Wydarzenie[]
  onOtworz: (w: Wydarzenie) => void
  onPrzenies: (id: string, naDzien: number) => void
  onPrzesun: (id: string, oDni: number) => void
  onDodajWDniu: (dzien: number) => void
  mozeEdytowac: boolean
  /** Identyfikatory wydarzeń, przy których toczy się rozmowa. */
  zRozmowa?: Set<string>
  /**
   * Tryb zaznaczania do eksportu CRA - identyfikatory wybranych. Gdy podane,
   * edycja jest wyłączona: kliknięcie zaznacza, a nic nie da się przeciągnąć.
   */
  zaznaczone?: Set<string>
}

/** Opis kolizji do dymka - sam trójkąt mówi „coś jest nie tak", ale nie co. */
function opiszKolizje(k: KolizjeDnia): string {
  const czesci = [
    ...k.osoby.map((o) =>
      o.twarda
        ? `${o.osoba}: ${o.ile} wydarzenia nakładają się w czasie`
        : `${o.osoba}: ${o.ile} wydarzenia tego dnia`,
    ),
    ...k.sale.map((s) => `sala ${s.sala}: ${s.godziny.join(', ')}`),
  ]
  return czesci.join('\n')
}

function Legenda() {
  return (
    <div data-legenda className="mb-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-[10.5px] text-deck-muted">
      {KLUCZE_KATEGORII.map((k) => {
        const n = numerRangi(k)
        return (
          <span key={k} className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-sm" style={{ background: KATEGORIE[k].obrys }} />
            {n !== null && <span className="font-mono text-deck-muted/70">{n}</span>}
            {KATEGORIE[k].etykieta}
          </span>
        )
      })}
    </div>
  )
}

export function WidokMiesiaca({
  miesiac, wydarzenia, onOtworz, onPrzenies, onPrzesun, onDodajWDniu, mozeEdytowac,
  zRozmowa, zaznaczone,
}: Props) {
  const wybor = zaznaczone !== undefined
  const edytowalne = mozeEdytowac && !wybor
  const stanWyboru = (id: string) => (wybor ? (zaznaczone?.has(id) ?? false) : undefined)
  const [przeciagany, setPrzeciagany] = useState<string | null>(null)
  const [nadDniem, setNadDniem] = useState<number | null>(null)

  const ile = dniWMiesiacu(miesiac.y, miesiac.m)
  const kolizje = useMemo(() => kolizjeWMiesiacu(wydarzenia, miesiac), [wydarzenia, miesiac])
  const tygodnie = useMemo(() => tygodnieMiesiaca(miesiac), [miesiac])

  /** Wielodniowe są paskami nad kratkami; w kratkach zostają jednodniowe. */
  const wielodniowe = useMemo(
    () => wydarzenia
      .filter((w) => w.dni > 1 && dniTrwaniaWMiesiacu(w, miesiac).length > 0)
      .sort(porownajWydarzenia),
    [wydarzenia, miesiac],
  )

  const poDniach = useMemo(() => {
    const mapa = new Map<number, Wydarzenie[]>()
    for (const w of wydarzenia) {
      if (w.dni > 1 || w.miesiac !== miesiac.m || w.rok !== miesiac.y) continue
      const lista = mapa.get(w.dzien) ?? []
      lista.push(w)
      mapa.set(w.dzien, lista)
    }
    // Najważniejsze na górze, w obrębie rangi w kolejności zegara.
    for (const lista of mapa.values()) lista.sort(porownajWydarzenia)
    return mapa
  }, [wydarzenia, miesiac])

  /** Lista na telefon: każdy dzień z czymkolwiek, wielodniowe z dopiskiem „2/4”. */
  const naLiscie = useMemo(() => {
    const dni: { dzien: number; pozycje: { w: Wydarzenie; dopisek?: string }[] }[] = []
    for (let dzien = 1; dzien <= ile; dzien++) {
      const data = { rok: miesiac.y, miesiac: miesiac.m, dzien }
      const pozycje = [
        ...wielodniowe
          .filter((w) => dniTrwaniaWMiesiacu(w, miesiac).includes(dzien))
          .map((w) => ({ w, dopisek: `${dniMiedzy(poczatek(w), data)}/${w.dni}` })),
        ...(poDniach.get(dzien) ?? []).map((w) => ({ w })),
      ].sort((a, b) => porownajWydarzenia(a.w, b.w))
      if (pozycje.length) dni.push({ dzien, pozycje })
    }
    return dni
  }, [ile, miesiac, wielodniowe, poDniach])

  /**
   * Pasek ze startem w innym miesiącu nie jest przeciągalny: upuszczenie
   * ustawiłoby dzień startu w złym miesiącu. Taki zmienia się w panelu.
   */
  const startujeTutaj = (w: Wydarzenie) => w.miesiac === miesiac.m && w.rok === miesiac.y

  const dzis = new Date()
  const dzisiajWTymMiesiacu =
    dzis.getFullYear() === miesiac.y && dzis.getMonth() + 1 === miesiac.m ? dzis.getDate() : null

  function upusc(dzien: number) {
    const id = przeciagany
    setPrzeciagany(null)
    setNadDniem(null)
    if (id) onPrzenies(id, dzien)
  }

  /** `pasow` - ile pasów wielodniowych leży nad kartami; karty schodzą pod nie. */
  function kratka(dzien: number, kolumna: number, pasow: number) {
    const kol = kolizje.get(dzien)
    const twarda = kol?.osoby.some((o) => o.twarda) || (kol?.sale.length ?? 0) > 0
    const weekend = kolumna >= 5
    const dzisiaj = dzien === dzisiajWTymMiesiacu
    const cel = nadDniem === dzien

    return (
      <div
        key={dzien}
        onDragOver={edytowalne ? (e) => { e.preventDefault(); setNadDniem(dzien) } : undefined}
        onDragLeave={edytowalne ? () => setNadDniem((d) => (d === dzien ? null : d)) : undefined}
        onDrop={edytowalne ? () => upusc(dzien) : undefined}
        style={{ gridColumn: kolumna + 1, gridRow: '1 / -1' }}
        className={`group relative min-h-[92px] rounded-md border p-1.5 transition ${
          cel
            ? 'border-deck-accent bg-deck-accent/10'
            : dzisiaj
              ? 'border-deck-accent/45 bg-deck-accent/[0.06]'
              : weekend
                ? 'border-white/5 bg-white/[0.008]'
                : 'border-white/8 bg-white/[0.02]'
        }`}
      >
        <div className="mb-1 flex items-center justify-between">
          <span
            className={`font-mono text-[10px] ${
              dzisiaj ? 'font-bold text-deck-accent' : weekend ? 'text-deck-muted/45' : 'text-deck-muted'
            }`}
          >
            {dzien}
          </span>
          <div className="flex items-center gap-1">
            {kol && (
              // Dymek na opakowaniu, nie na ikonie - Lucide nie przyjmuje `title`.
              <span
                title={opiszKolizje(kol)}
                aria-label={twarda ? 'kolizja twarda' : 'kolizja miękka'}
                className={`flex ${twarda ? 'text-deck-danger' : 'text-deck-warn'}`}
              >
                <AlertTriangle size={11} />
              </span>
            )}
            {edytowalne && (
              <button
                type="button"
                onClick={() => onDodajWDniu(dzien)}
                aria-label={`Dodaj wydarzenie ${dzien}`}
                title="Dodaj wydarzenie w tym dniu"
                className="grid h-4 w-4 place-items-center rounded text-deck-muted/0 transition group-hover:text-deck-muted hover:!text-deck-accent"
              >
                <Plus size={11} />
              </button>
            )}
          </div>
        </div>

        <div className="space-y-1" style={pasow ? { marginTop: pasow * WYSOKOSC_PASA } : undefined}>
          {(poDniach.get(dzien) ?? []).map((w) => (
            <KartaWydarzenia
              key={w.id}
              wydarzenie={w}
              onOtworz={onOtworz}
              przeciagalne={edytowalne}
              onPrzeciagnij={setPrzeciagany}
              onPrzesun={onPrzesun}
              maRozmowe={zRozmowa?.has(w.id)}
              zaznaczone={stanWyboru(w.id)}
            />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="deck-card rounded-lg p-3">
      <Legenda />

      {/* Siedem kolumn po ~92 px nie mieści się na telefonie. Zamiast ściskać
          siatkę, poniżej 640 px pokazujemy listę dni, które coś mają. */}
      <div data-widok="lista" className="space-y-2 sm:hidden">
        {naLiscie.length === 0 && (
          <p className="py-6 text-center text-[12px] text-deck-muted">
            W tym miesiącu nic nie zaplanowano.
          </p>
        )}
        {naLiscie.map(({ dzien, pozycje }) => {
          const kol = kolizje.get(dzien)
          return (
            <div key={dzien} className="rounded-md border border-white/8 bg-white/[0.02] p-2">
              <div className="mb-1.5 flex items-center gap-2">
                <span className="font-mono text-[11px] text-deck-text">
                  {dzien} {NAZWA_MIESIACA[miesiac.m - 1]}
                </span>
                <span className="font-mono text-[10px] text-deck-muted/70">
                  {dzienTygodnia(miesiac.y, miesiac.m, dzien)}
                </span>
                {kol && (
                  <span className="ml-auto flex items-center gap-1 text-[10px] text-deck-warn">
                    <AlertTriangle size={10} /> kolizja
                  </span>
                )}
              </div>
              <div className="space-y-1">
                {pozycje.map(({ w, dopisek }) => (
                  <KartaWydarzenia
                    key={w.id}
                    wydarzenie={w}
                    onOtworz={onOtworz}
                    przeciagalne={false}
                    maRozmowe={zRozmowa?.has(w.id)}
                    dopisek={dopisek}
                    zaznaczone={stanWyboru(w.id)}
                  />
                ))}
              </div>
              {edytowalne && (
                <button
                  type="button"
                  onClick={() => onDodajWDniu(dzien)}
                  className="mt-1.5 text-[10.5px] text-deck-accent"
                >
                  + dodaj w tym dniu
                </button>
              )}
            </div>
          )
        })}
      </div>

      <div data-widok="siatka" className="hidden sm:block">
        <div className="mb-2 grid grid-cols-7 gap-1.5">
          {NAGLOWKI.map((n, i) => (
            <div
              key={n}
              className={`text-center font-mono text-[10px] uppercase tracking-[0.14em] ${
                i >= 5 ? 'text-deck-muted/40' : 'text-deck-muted/70'
              }`}
            >
              {n}
            </div>
          ))}
        </div>

        <div className="space-y-1.5">
          {tygodnie.map((tydzien, t) => {
            const odcinki = odcinkiTygodnia(tydzien, miesiac, wielodniowe)
            const pasow = odcinki.reduce((n, o) => Math.max(n, o.pas + 1), 0)
            return (
              // Jedna siatka na tydzień: kratki zajmują wszystkie wiersze, a paski leżą
              // w wierszach pod numerami dni - widać, które dni zajmują.
              <div
                key={t}
                className="grid grid-cols-7 gap-x-1.5"
                style={{ gridTemplateRows: `${NAGLOWEK_KRATKI}px repeat(${pasow}, ${WYSOKOSC_PASA}px) minmax(0, 1fr)` }}
              >
                {tydzien.map((dzien, i) =>
                  dzien === null ? (
                    <div key={`pusty-${t}-${i}`} style={{ gridColumn: i + 1, gridRow: '1 / -1' }} />
                  ) : (
                    kratka(dzien, i, pasow)
                  ),
                )}
                {odcinki.map((o) => (
                  <PasekWielodniowy
                    key={o.wydarzenie.id}
                    odcinek={o}
                    wiersz={o.pas + 2}
                    onOtworz={onOtworz}
                    przeciagalne={edytowalne && startujeTutaj(o.wydarzenie)}
                    onPrzeciagnij={setPrzeciagany}
                    onPrzesun={onPrzesun}
                    zaznaczone={stanWyboru(o.wydarzenie.id)}
                  />
                ))}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
