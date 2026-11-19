'use client'
import { useState, type FormEvent } from 'react'
import { odmiana } from '@/lib/asystent/fakty'
import { klientDziennika } from '@/lib/dziennik/klient'
import type { Ksiega } from '@/lib/dziennik/typy'
import { POLE, PRZYCISK } from './style'

/** Bez otwartej kadencji nie da się dopisywać - konto jest wspólne, więc autor przedstawia się sam. */
export function RozpocznijKadencje({ ksiega, onGotowe }: { ksiega: Ksiega; onGotowe: () => void }) {
  const [nazwa, setNazwa] = useState('')
  const [autor, setAutor] = useState('')
  const [funkcja, setFunkcja] = useState('')
  const [trwa, setTrwa] = useState(false)
  const [blad, setBlad] = useState<string | null>(null)

  async function wyslij(e: FormEvent) {
    e.preventDefault()
    setTrwa(true)
    setBlad(null)
    try {
      await klientDziennika.rozpocznij({ nazwa, autor, funkcja })
      onGotowe()
    } catch (x) {
      setBlad((x as Error).message)
    } finally {
      setTrwa(false)
    }
  }

  const kadencji = new Set(ksiega.wpisy.map((w) => w.kadencjaId)).size
  return (
    <form aria-label="Rozpocznij kadencję" onSubmit={wyslij} className="deck-chip mb-4 space-y-3 rounded-xl p-4 text-[13px]">
      <h2 className="text-[15px] font-semibold text-deck-text">Rozpocznij kadencję</h2>
      <p className="text-deck-muted">
        Konto kontakt@ jest wspólne, więc przedstaw się - Twoje wpisy dostaną ten podpis.
        {ksiega.wpisy.length > 0 &&
          ` Księga ma ${odmiana(ksiega.wpisy.length, ['wpis', 'wpisy', 'wpisów'])} z ${kadencji} kadencji - przeczytasz je w zakładkach także przed rozpoczęciem.`}
      </p>
      <div className="grid gap-3 sm:grid-cols-3">
        <label className="space-y-1">
          <span className="block text-deck-muted">Nazwa kadencji</span>
          <input className={POLE} value={nazwa} onChange={(e) => setNazwa(e.target.value)} placeholder="2026/27" maxLength={40} required />
        </label>
        <label className="space-y-1">
          <span className="block text-deck-muted">Autor</span>
          <input className={POLE} value={autor} onChange={(e) => setAutor(e.target.value)} placeholder="Imię i nazwisko" maxLength={80} required />
        </label>
        <label className="space-y-1">
          <span className="block text-deck-muted">Funkcja (opcjonalnie)</span>
          <input className={POLE} value={funkcja} onChange={(e) => setFunkcja(e.target.value)} maxLength={80} />
        </label>
      </div>
      {blad && <p role="alert" className="text-deck-danger">{blad}</p>}
      <button type="submit" className={PRZYCISK} disabled={trwa}>{trwa ? 'Zapisuję…' : 'Rozpocznij'}</button>
    </form>
  )
}
