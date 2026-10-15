'use client'
import { useEffect, useState } from 'react'
import { klientSkrzynki } from '@/lib/skrzynka/klient'
import { ETYKIETY_TYPOW } from '@/lib/skrzynka/widok'
import { TYPY_ORGANIZACJI, type KartaOrganizacji, type Organizacja, type TypOrganizacji } from '@/lib/skrzynka/typy'
import { useTeraz } from '@/lib/useTeraz'
import { WierszSprawy } from './WierszSprawy'

/**
 * Zakładka Organizacje: lista z filtrem typu, karta z osobami i sprawami,
 * zmiana nazwy i typu. Synchronizacja nie nadpisuje tego, co tu ustawisz.
 */
export function Organizacje({ wybrana, onWybierz }: { wybrana: string | null; onWybierz: (id: string) => void }) {
  const teraz = useTeraz(60_000)
  const [lista, setLista] = useState<Organizacja[] | null>(null)
  const [filtr, setFiltr] = useState<TypOrganizacji | ''>('')
  const [karta, setKarta] = useState<KartaOrganizacji | null>(null)
  const [nazwa, setNazwa] = useState('')
  const [typ, setTyp] = useState<TypOrganizacji>('inne')
  const [blad, setBlad] = useState<string | null>(null)
  const [trwa, setTrwa] = useState(false)

  useEffect(() => {
    let aktywny = true
    klientSkrzynki
      .organizacje()
      .then((o) => {
        if (aktywny) setLista(o.organizacje)
      })
      .catch((e: Error) => {
        if (aktywny) setBlad(e.message)
      })
    return () => {
      aktywny = false
    }
  }, [])

  async function otworz(domena: string) {
    setTrwa(true)
    setBlad(null)
    try {
      const k = await klientSkrzynki.organizacja(domena)
      setKarta(k)
      setNazwa(k.organizacja.nazwa)
      setTyp(k.organizacja.typ)
    } catch (e) {
      setBlad((e as Error).message)
    } finally {
      setTrwa(false)
    }
  }

  async function zapisz() {
    if (!karta) return
    setTrwa(true)
    setBlad(null)
    try {
      const o = await klientSkrzynki.zmienOrganizacje(karta.organizacja.domena, { nazwa: nazwa.trim(), typ })
      setKarta({ ...karta, organizacja: o })
      setLista((l) => l && l.map((x) => (x.domena === o.domena ? o : x)))
    } catch (e) {
      setBlad((e as Error).message)
    } finally {
      setTrwa(false)
    }
  }

  const alert = blad && <p role="alert" className="text-[12.5px] text-deck-danger">{blad}</p>

  if (karta) {
    const o = karta.organizacja
    const zmieniona = nazwa.trim() !== o.nazwa || typ !== o.typ
    return (
      <section aria-label={`Organizacja: ${o.domena}`} className="space-y-3 text-[12.5px]">
        <button type="button" onClick={() => setKarta(null)} className="text-[11.5px] text-deck-muted hover:underline">
          ← Organizacje
        </button>
        <div className="space-y-1.5">
          <h3 className="text-[14px] font-semibold text-deck-text">{o.nazwa}</h3>
          <p className="text-deck-muted">{o.domena}</p>
          <div className="flex flex-wrap items-center gap-1.5">
            <input
              aria-label="Nazwa organizacji"
              value={nazwa}
              onChange={(e) => setNazwa(e.target.value)}
              maxLength={120}
              className="deck-input min-w-0 flex-1 rounded-md px-2 py-1"
            />
            <select aria-label="Typ organizacji" value={typ} onChange={(e) => setTyp(e.target.value as TypOrganizacji)} className="deck-input rounded-md px-2 py-1">
              {TYPY_ORGANIZACJI.map((t) => (
                <option key={t} value={t}>
                  {ETYKIETY_TYPOW[t]}
                </option>
              ))}
            </select>
            <button type="button" onClick={zapisz} disabled={trwa || !zmieniona || !nazwa.trim()} className="deck-button rounded-md px-3 py-1 text-[11.5px] disabled:opacity-50">
              Zapisz
            </button>
          </div>
        </div>
        {alert}
        <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-deck-muted">Osoby: {karta.kontakty.length}</p>
        <ul aria-label="Osoby organizacji" className="flex flex-wrap gap-1.5">
          {karta.kontakty.map((k) => (
            <li key={k.email} className="deck-chip rounded-md px-2 py-0.5 text-[11.5px]">
              {k.imie ? `${k.imie} · ${k.email}` : k.email}
            </li>
          ))}
        </ul>
        <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-deck-muted">Sprawy: {karta.sprawy.length}</p>
        <ul aria-label="Sprawy organizacji" className="space-y-1.5">
          {karta.sprawy.map((s) => (
            <WierszSprawy key={s.id} s={s} teraz={teraz} wybrana={s.id === wybrana} onWybierz={onWybierz} zStatusem />
          ))}
        </ul>
      </section>
    )
  }

  if (!lista) return alert || <p className="font-mono text-[11px] text-deck-muted">Wczytuję organizacje…</p>
  const widoczne = filtr ? lista.filter((o) => o.typ === filtr) : lista

  return (
    <div className="space-y-2">
      <select aria-label="Filtr typu" value={filtr} onChange={(e) => setFiltr(e.target.value as TypOrganizacji | '')} className="deck-input rounded-md px-2 py-1 text-[12px]">
        <option value="">Wszystkie typy</option>
        {TYPY_ORGANIZACJI.map((t) => (
          <option key={t} value={t}>
            {ETYKIETY_TYPOW[t]}
          </option>
        ))}
      </select>
      {alert}
      {widoczne.length ? (
        <ul aria-label="Organizacje" className="space-y-1">
          {widoczne.map((o) => (
            <li key={o.domena}>
              <button
                type="button"
                disabled={trwa}
                onClick={() => otworz(o.domena)}
                className="w-full rounded-md border border-white/10 bg-white/[0.03] px-3 py-1.5 text-left text-[12px] transition hover:bg-white/[0.06]"
              >
                <span className="text-deck-text">{o.nazwa}</span>
                <span className="text-deck-muted">
                  {o.nazwa !== o.domena && ` · ${o.domena}`} · {ETYKIETY_TYPOW[o.typ]}
                </span>
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-[12.5px] text-deck-muted">Brak organizacji tego typu.</p>
      )}
    </div>
  )
}
