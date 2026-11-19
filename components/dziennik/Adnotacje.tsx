'use client'
import { useState, type FormEvent } from 'react'
import { ETYKIETY_STANU, ETYKIETY_STANU_CELU } from '@/lib/dziennik/etykiety'
import { klientDziennika } from '@/lib/dziennik/klient'
import { STANY_CELU, STANY_WPISU, type Adnotacja, type Ksiega, type StanCelu, type StanWpisu, type Wpis } from '@/lib/dziennik/typy'
import { LIMITY } from '@/lib/dziennik/walidacja'
import { POLE, PRZYCISK, PRZYCISK_CICHY } from './style'

function opis(a: Adnotacja, w: Wpis): string {
  const cel = a.celId && w.dzial === 'strategia' ? w.cele.find((c) => c.id === a.celId) : null
  const co = [a.stan ? ETYKIETY_STANU[a.stan] : null, cel && a.stanCelu ? `cel „${cel.tresc}” ${ETYKIETY_STANU_CELU[a.stanCelu]}` : null]
    .filter(Boolean)
    .join(', ')
  return [co, a.komentarz ? `„${a.komentarz}”` : null].filter(Boolean).join(' - ')
}

/** Komentarze kolejnych kadencji. Dodać może każda kadencja; poprawić i usunąć tylko własne. */
export function Adnotacje({ wpis, ksiega, odswiez }: { wpis: Wpis; ksiega: Ksiega; odswiez: () => void }) {
  const otwarta = ksiega.otwartaKadencjaId
  const nazwy = new Map(ksiega.kadencje.map((k) => [k.id, k.nazwa]))
  const [edytuje, setEdytuje] = useState<Adnotacja | 'nowa' | null>(null)
  const [stan, setStan] = useState<StanWpisu | ''>('')
  const [celId, setCelId] = useState('')
  const [stanCelu, setStanCelu] = useState<StanCelu | ''>('')
  const [komentarz, setKomentarz] = useState('')
  const [trwa, setTrwa] = useState(false)
  const [blad, setBlad] = useState<string | null>(null)
  const cele = wpis.dzial === 'strategia' ? wpis.cele : []

  function otworz(a: Adnotacja | 'nowa') {
    setEdytuje(a)
    setBlad(null)
    setStan(a === 'nowa' ? '' : (a.stan ?? ''))
    setCelId(a === 'nowa' ? '' : (a.celId ?? ''))
    setStanCelu(a === 'nowa' ? '' : (a.stanCelu ?? ''))
    setKomentarz(a === 'nowa' ? '' : a.komentarz)
  }

  async function dzialaj(f: () => Promise<unknown>) {
    setTrwa(true)
    setBlad(null)
    try {
      await f()
      setEdytuje(null)
      odswiez()
    } catch (e) {
      setBlad((e as Error).message)
    } finally {
      setTrwa(false)
    }
  }

  function zapisz(e: FormEvent) {
    e.preventDefault()
    const pola = { stan: stan || null, celId: celId || null, stanCelu: celId ? stanCelu || null : null, komentarz }
    dzialaj(() => (edytuje === 'nowa' || edytuje === null
      ? klientDziennika.dodajAdnotacje(wpis.id, pola)
      : klientDziennika.zmienAdnotacje(wpis.id, edytuje.id, pola)))
  }

  const posortowane = [...wpis.adnotacje].sort((a, b) => a.kiedy - b.kiedy)

  return (
    <div className="mt-3 space-y-2 border-t border-white/8 pt-3 text-[12.5px]">
      {posortowane.length > 0 && (
        <ul aria-label="Komentarze" className="space-y-1.5">
          {posortowane.map((a) => (
            <li key={a.id} className="flex flex-wrap items-baseline gap-x-2 text-deck-muted">
              <span>
                <span className="font-mono text-[11px] text-deck-text">{nazwy.get(a.kadencjaId) ?? '?'}</span>: {opis(a, wpis)}
              </span>
              {otwarta && a.kadencjaId === otwarta && (
                <span className="flex gap-2">
                  <button type="button" className="text-deck-muted underline-offset-2 hover:text-deck-text hover:underline" onClick={() => otworz(a)}>
                    Popraw komentarz
                  </button>
                  <button type="button" className="text-deck-muted underline-offset-2 hover:text-deck-danger hover:underline" disabled={trwa}
                    onClick={() => dzialaj(() => klientDziennika.usunAdnotacje(wpis.id, a.id))}>
                    Usuń komentarz
                  </button>
                </span>
              )}
            </li>
          ))}
        </ul>
      )}

      {otwarta && edytuje === null && (
        <button type="button" className={PRZYCISK_CICHY} onClick={() => otworz('nowa')}>Skomentuj</button>
      )}

      {otwarta && edytuje !== null && (
        <form onSubmit={zapisz} className="space-y-2">
          <div className="grid gap-2 sm:grid-cols-3">
            <label className="space-y-1">
              <span className="block text-deck-muted">Stan wpisu</span>
              <select className={POLE} value={stan} onChange={(e) => setStan(e.target.value as StanWpisu | '')}>
                <option value="">bez zmiany</option>
                {STANY_WPISU.map((s) => <option key={s} value={s}>{ETYKIETY_STANU[s]}</option>)}
              </select>
            </label>
            {cele.length > 0 && (
              <>
                <label className="space-y-1">
                  <span className="block text-deck-muted">Cel</span>
                  <select className={POLE} value={celId} onChange={(e) => setCelId(e.target.value)}>
                    <option value="">żaden</option>
                    {cele.map((c) => <option key={c.id} value={c.id}>{c.tresc}</option>)}
                  </select>
                </label>
                <label className="space-y-1">
                  <span className="block text-deck-muted">Stan celu</span>
                  <select className={POLE} value={stanCelu} disabled={!celId} onChange={(e) => setStanCelu(e.target.value as StanCelu | '')}>
                    <option value="">-</option>
                    {STANY_CELU.map((s) => <option key={s} value={s}>{ETYKIETY_STANU_CELU[s]}</option>)}
                  </select>
                </label>
              </>
            )}
          </div>
          <label className="block space-y-1">
            <span className="block text-deck-muted">Komentarz</span>
            <textarea className={POLE} rows={2} value={komentarz} maxLength={LIMITY.komentarz} onChange={(e) => setKomentarz(e.target.value)} />
          </label>
          {blad && <p role="alert" className="text-deck-danger">{blad}</p>}
          <div className="flex gap-2">
            <button type="submit" className={PRZYCISK} disabled={trwa}>{trwa ? 'Zapisuję…' : 'Zapisz komentarz'}</button>
            <button type="button" className={PRZYCISK_CICHY} disabled={trwa} onClick={() => setEdytuje(null)}>Anuluj</button>
          </div>
        </form>
      )}
      {blad && edytuje === null && <p role="alert" className="text-deck-danger">{blad}</p>}
    </div>
  )
}
