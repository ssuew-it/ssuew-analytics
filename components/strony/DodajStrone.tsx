'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Plus } from 'lucide-react'
import { klientStron } from '@/lib/strony/klient'
import { DLUGOSC_NAZWY, type DostepneWitryny } from '@/lib/strony/model'
import { InstrukcjaDostepu } from './InstrukcjaDostepu'

export function DodajStrone() {
  const router = useRouter()
  const [otwarte, setOtwarte] = useState(false)
  const [dostepne, setDostepne] = useState<DostepneWitryny | null>(null)
  const [wybrana, setWybrana] = useState('')
  const [nazwa, setNazwa] = useState('')
  const [blad, setBlad] = useState<string | null>(null)
  const [trwa, setTrwa] = useState(false)

  async function otworz() {
    setOtwarte(true)
    setBlad(null)
    setDostepne(null)
    try {
      const d = await klientStron.dostepne()
      setDostepne(d)
      setWybrana(d.witryny[0]?.witryna ?? '')
      setNazwa(d.witryny[0]?.nazwa ?? '')
    } catch (e) {
      setBlad((e as Error).message)
    }
  }

  function wybierz(witryna: string) {
    setWybrana(witryna)
    setNazwa(dostepne?.witryny.find((w) => w.witryna === witryna)?.nazwa ?? '')
  }

  async function dodaj(e: React.FormEvent) {
    e.preventDefault()
    if (!wybrana || trwa) return
    setTrwa(true)
    setBlad(null)
    try {
      await klientStron.dodaj(wybrana, nazwa.trim())
      setOtwarte(false)
      router.refresh()
    } catch (er) {
      setBlad((er as Error).message)
    } finally {
      setTrwa(false)
    }
  }

  if (!otwarte) {
    return (
      <button type="button" onClick={otworz} className="deck-button inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-[12px]">
        <Plus size={13} aria-hidden="true" /> Dodaj stronę
      </button>
    )
  }

  return (
    <section aria-label="Dodaj stronę" className="deck-card w-full max-w-[520px] space-y-3 rounded-lg p-4 text-[12.5px]">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold text-deck-text">Dodaj stronę</h2>
        <button type="button" onClick={() => setOtwarte(false)} className="text-[11.5px] text-deck-muted hover:underline">
          Zamknij
        </button>
      </div>
      {blad && <p role="alert" className="text-[11.5px] text-deck-danger">{blad}</p>}
      {dostepne === null && !blad && <p className="font-mono text-[11px] text-deck-muted">Pytam Search Console…</p>}
      {dostepne?.blad && <p role="alert" className="text-[11.5px] text-deck-danger">{dostepne.blad}</p>}
      {dostepne && !dostepne.blad && dostepne.witryny.length === 0 && (
        <>
          <p className="text-deck-muted">Search Console nie pokazuje żadnej nowej witryny. Żeby się pojawiła:</p>
          <InstrukcjaDostepu email={dostepne.email} />
        </>
      )}
      {dostepne && dostepne.witryny.length > 0 && (
        <form onSubmit={dodaj} className="space-y-2.5">
          <label className="block">
            <span className="mb-1 block text-deck-muted">Witryna z Search Console</span>
            <select value={wybrana} onChange={(e) => wybierz(e.target.value)} className="deck-input w-full rounded-md px-2.5 py-1.5">
              {dostepne.witryny.map((w) => (
                <option key={w.witryna} value={w.witryna}>
                  {w.witryna}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="mb-1 block text-deck-muted">Nazwa w panelu</span>
            <input
              value={nazwa}
              onChange={(e) => setNazwa(e.target.value)}
              maxLength={DLUGOSC_NAZWY}
              className="deck-input w-full rounded-md px-2.5 py-1.5"
            />
          </label>
          <button type="submit" disabled={!wybrana || trwa} className="deck-button rounded-md px-3 py-1 text-[11.5px] disabled:opacity-50">
            {trwa ? 'Dodaję…' : 'Dodaj'}
          </button>
        </form>
      )}
    </section>
  )
}
