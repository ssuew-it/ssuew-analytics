'use client'
import { useState, type FormEvent } from 'react'
import { ETYKIETY_STATUSU, MIESIACE } from '@/lib/dziennik/etykiety'
import { PODPOWIEDZI_ROZLICZA, STATUSY_STRATEGII, type Cel, type Dzial, type StatusStrategii, type Wpis } from '@/lib/dziennik/typy'
import { LIMITY } from '@/lib/dziennik/walidacja'
import { POLE, PRZYCISK, PRZYCISK_CICHY } from './style'

type Props = {
  dzial: Dzial
  /** Poprawka istniejącego wpisu; bez - nowy wpis. */
  wpis?: Wpis
  onZapisz: (pola: Record<string, unknown>) => Promise<void>
  onAnuluj: () => void
}

const pole = <T,>(w: Wpis | undefined, klucz: string, dom: T): T => ((w as Record<string, unknown> | undefined)?.[klucz] as T) ?? dom

function Etykieta({ tekst, children }: { tekst: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-1">
      <span className="block text-deck-muted">{tekst}</span>
      {children}
    </label>
  )
}

export function FormularzWpisu({ dzial, wpis, onZapisz, onAnuluj }: Props) {
  const [tytul, setTytul] = useState(wpis?.tytul ?? '')
  const [tresc, setTresc] = useState(wpis?.tresc ?? '')
  // kalendarz pracy
  const [miesiac, setMiesiac] = useState(pole(wpis, 'miesiac', new Date().getMonth() + 1))
  const [dzien, setDzien] = useState(String(pole<number | null>(wpis, 'dzien', null) ?? ''))
  const [wyprzedzenie, setWyprzedzenie] = useState(String(pole(wpis, 'wyprzedzenieTygodni', 2)))
  const [obowiazkowe, setObowiazkowe] = useState(pole(wpis, 'obowiazkowe', false))
  const poczatkowe = pole<string[]>(wpis, 'rozlicza', [])
  const [podpowiedzi, setPodpowiedzi] = useState(poczatkowe.filter((r) => PODPOWIEDZI_ROZLICZA.includes(r)))
  const [inni, setInni] = useState(poczatkowe.filter((r) => !PODPOWIEDZI_ROZLICZA.includes(r)).join(', '))
  // luka, wątek
  const [ileCzasu, setIleCzasu] = useState(pole(wpis, 'ileCzasu', ''))
  const [zostalo, setZostalo] = useState(pole(wpis, 'zostalo', ''))
  // strategia
  const rok = new Date().getFullYear()
  const [link, setLink] = useState(pole(wpis, 'link', ''))
  const [okresOd, setOkresOd] = useState(String(pole(wpis, 'okresOd', rok)))
  const [okresDo, setOkresDo] = useState(String(pole(wpis, 'okresDo', rok + 1)))
  const [status, setStatus] = useState<StatusStrategii>(pole(wpis, 'status', 'projekt'))
  const [uchwala, setUchwala] = useState(pole<string | null>(wpis, 'uchwala', null) ?? '')
  const [cele, setCele] = useState<Cel[]>(pole(wpis, 'cele', []))

  const [trwa, setTrwa] = useState(false)
  const [blad, setBlad] = useState<string | null>(null)
  const limit = dzial === 'przemyslenie' ? LIMITY.trescPrzemyslenia : LIMITY.tresc

  function pola(): Record<string, unknown> {
    const wspolne = { dzial, tytul, tresc }
    switch (dzial) {
      case 'cykl':
        return {
          ...wspolne, miesiac: Number(miesiac), dzien: dzien.trim() ? Number(dzien) : null, wyprzedzenieTygodni: Number(wyprzedzenie),
          obowiazkowe, rozlicza: [...podpowiedzi, ...inni.split(',').map((x) => x.trim()).filter(Boolean)],
        }
      case 'luka':
        return { ...wspolne, ileCzasu }
      case 'watek':
        return { ...wspolne, zostalo }
      case 'strategia':
        return { ...wspolne, link, okresOd: Number(okresOd), okresDo: Number(okresDo), status, uchwala: uchwala.trim() || null, cele }
      default:
        return wspolne
    }
  }

  async function wyslij(e: FormEvent) {
    e.preventDefault()
    setTrwa(true)
    setBlad(null)
    try {
      await onZapisz(pola())
    } catch (x) {
      setBlad((x as Error).message)
    } finally {
      setTrwa(false)
    }
  }

  return (
    <form aria-label={wpis ? 'Popraw wpis' : 'Nowy wpis'} onSubmit={wyslij} className="deck-chip space-y-3 rounded-xl p-4 text-[13px]">
      <Etykieta tekst="Tytuł">
        <input className={POLE} value={tytul} onChange={(e) => setTytul(e.target.value)} maxLength={LIMITY.tytul} />
      </Etykieta>

      {dzial === 'cykl' && (
        <div className="grid gap-3 sm:grid-cols-3">
          <Etykieta tekst="Miesiąc">
            <select className={POLE} value={miesiac} onChange={(e) => setMiesiac(Number(e.target.value))}>
              {MIESIACE.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
            </select>
          </Etykieta>
          <Etykieta tekst="Dzień (puste = do końca miesiąca)">
            <input className={POLE} type="number" min={1} max={31} value={dzien} onChange={(e) => setDzien(e.target.value)} />
          </Etykieta>
          <Etykieta tekst="Przygotowania (tygodni wcześniej)">
            <input className={POLE} type="number" min={0} max={12} value={wyprzedzenie} onChange={(e) => setWyprzedzenie(e.target.value)} />
          </Etykieta>
          <fieldset className="space-y-2 sm:col-span-3">
            <label className="flex items-center gap-2 text-deck-text">
              <input type="checkbox" checked={obowiazkowe} onChange={(e) => setObowiazkowe(e.target.checked)} />
              Obowiązkowe
            </label>
            <div className="flex flex-wrap items-center gap-3">
              <span className="text-deck-muted">Rozlicza:</span>
              {PODPOWIEDZI_ROZLICZA.map((p) => (
                <label key={p} className="flex items-center gap-1.5 text-deck-text">
                  <input
                    type="checkbox"
                    checked={podpowiedzi.includes(p)}
                    onChange={(e) => setPodpowiedzi((x) => (e.target.checked ? [...x, p] : x.filter((y) => y !== p)))}
                  />
                  {p}
                </label>
              ))}
            </div>
            <Etykieta tekst="Inni rozliczający (po przecinku)">
              <input className={POLE} value={inni} onChange={(e) => setInni(e.target.value)} />
            </Etykieta>
          </fieldset>
        </div>
      )}

      {dzial === 'luka' && (
        <Etykieta tekst="Ile czasu trzeba">
          <input className={POLE} value={ileCzasu} onChange={(e) => setIleCzasu(e.target.value)} maxLength={LIMITY.ileCzasu} placeholder="semestr, 2 kadencje…" />
        </Etykieta>
      )}

      {dzial === 'strategia' && (
        <div className="grid gap-3 sm:grid-cols-2">
          <Etykieta tekst="Link do dokumentu">
            <input className={POLE} value={link} onChange={(e) => setLink(e.target.value)} placeholder="https://" />
          </Etykieta>
          <Etykieta tekst="Status">
            <select className={POLE} value={status} onChange={(e) => setStatus(e.target.value as StatusStrategii)}>
              {STATUSY_STRATEGII.map((s) => <option key={s} value={s}>{ETYKIETY_STATUSU[s]}</option>)}
            </select>
          </Etykieta>
          <Etykieta tekst="Okres od">
            <input className={POLE} type="number" min={2000} max={2100} value={okresOd} onChange={(e) => setOkresOd(e.target.value)} />
          </Etykieta>
          <Etykieta tekst="Okres do">
            <input className={POLE} type="number" min={2000} max={2100} value={okresDo} onChange={(e) => setOkresDo(e.target.value)} />
          </Etykieta>
          <div className="sm:col-span-2">
            <Etykieta tekst="Uchwała (opcjonalnie)">
              <input className={POLE} value={uchwala} onChange={(e) => setUchwala(e.target.value)} />
            </Etykieta>
          </div>
          <fieldset className="space-y-2 sm:col-span-2">
            <legend className="text-deck-muted">Cele</legend>
            {cele.map((c, i) => (
              <div key={i} className="flex gap-2">
                <input
                  aria-label={`Cel ${i + 1}`}
                  className={POLE}
                  value={c.tresc}
                  maxLength={LIMITY.cel}
                  onChange={(e) => setCele((x) => x.map((y, j) => (j === i ? { ...y, tresc: e.target.value } : y)))}
                />
                <button type="button" className={PRZYCISK_CICHY} onClick={() => setCele((x) => x.filter((_, j) => j !== i))}>Usuń</button>
              </div>
            ))}
            {cele.length < LIMITY.cele && (
              <button type="button" className={PRZYCISK_CICHY} onClick={() => setCele((x) => [...x, { id: '', tresc: '' }])}>Dodaj cel</button>
            )}
          </fieldset>
        </div>
      )}

      <Etykieta tekst="Treść">
        <textarea className={`${POLE} min-h-28`} value={tresc} onChange={(e) => setTresc(e.target.value)} maxLength={limit} rows={dzial === 'przemyslenie' ? 10 : 4} />
      </Etykieta>
      <p className="text-right font-mono text-[10.5px] text-deck-muted">{tresc.length} / {limit}</p>

      {dzial === 'watek' && (
        <Etykieta tekst="Co zostało do zrobienia">
          <textarea className={POLE} value={zostalo} onChange={(e) => setZostalo(e.target.value)} maxLength={LIMITY.tresc} rows={3} />
        </Etykieta>
      )}

      {blad && <p role="alert" className="text-deck-danger">{blad}</p>}
      <div className="flex gap-2">
        <button type="submit" className={PRZYCISK} disabled={trwa}>{trwa ? 'Zapisuję…' : 'Zapisz'}</button>
        <button type="button" className={PRZYCISK_CICHY} disabled={trwa} onClick={onAnuluj}>Anuluj</button>
      </div>
    </form>
  )
}
