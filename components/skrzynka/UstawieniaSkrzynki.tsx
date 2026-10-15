'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { X } from 'lucide-react'
import { klientSkrzynki } from '@/lib/skrzynka/klient'
import type { UstawieniaSkrzynki as Ustawienia } from '@/lib/skrzynka/typy'

/**
 * Stopka odpowiedzi, listy „zawsze pomijaj” i „Rozłącz”. Każda zmiana listy
 * zapisuje się od razu - serwer sprawdza adresy i nie przyjmie domeny gmail.com.
 */
export function UstawieniaSkrzynki() {
  const router = useRouter()
  const [u, setU] = useState<Ustawienia | null>(null)
  const [stopka, setStopka] = useState('')
  const [adres, setAdres] = useState('')
  const [domena, setDomena] = useState('')
  const [usunDane, setUsunDane] = useState(false)
  const [blad, setBlad] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)
  const [trwa, setTrwa] = useState(false)

  useEffect(() => {
    let aktywny = true
    klientSkrzynki
      .ustawienia()
      .then((x) => {
        if (!aktywny) return
        setU(x)
        setStopka(x.stopka)
      })
      .catch((e: Error) => {
        if (aktywny) setBlad(e.message)
      })
    return () => {
      aktywny = false
    }
  }, [])

  async function zapisz(z: Partial<Ustawienia>, potem?: () => void) {
    setTrwa(true)
    setBlad(null)
    setInfo(null)
    try {
      const n = await klientSkrzynki.zapiszUstawienia(z)
      setU(n)
      setStopka(n.stopka)
      setInfo('Zapisano.')
      potem?.()
    } catch (e) {
      setBlad((e as Error).message)
    } finally {
      setTrwa(false)
    }
  }

  async function rozlacz() {
    const pytanie = usunDane
      ? 'Rozłączyć skrzynkę i usunąć z D.E.C.K. wszystkie sprawy, kontakty i organizacje? Tego nie da się cofnąć.'
      : 'Rozłączyć skrzynkę? Sprawy zostaną w D.E.C.K., a po ponownym połączeniu import ruszy od nowa.'
    if (!window.confirm(pytanie)) return
    setTrwa(true)
    setBlad(null)
    try {
      await klientSkrzynki.rozlacz(usunDane)
      router.refresh()
    } catch (e) {
      setBlad((e as Error).message)
      setTrwa(false)
    }
  }

  if (!u) {
    return blad ? <p role="alert" className="text-[12.5px] text-deck-danger">{blad}</p> : <p className="font-mono text-[11px] text-deck-muted">Wczytuję ustawienia…</p>
  }

  const naglowek = 'font-mono text-[10px] uppercase tracking-[0.16em] text-deck-muted'
  const przycisk = 'deck-button rounded-md px-3 py-1 text-[11.5px] disabled:opacity-50'

  const lista = (nazwa: string, pole: 'pomijaneAdresy' | 'pomijaneDomeny', wartosci: string[]) => {
    if (!wartosci.length) return <p className="text-deck-muted">Pusto.</p>
    return (
      <ul aria-label={nazwa} className="flex flex-wrap gap-1.5">
        {wartosci.map((w) => (
          <li key={w} className="deck-chip inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11.5px]">
            {w}
            <button type="button" aria-label={`Usuń ${w}`} disabled={trwa} onClick={() => zapisz({ [pole]: wartosci.filter((x) => x !== w) })}>
              <X size={11} aria-hidden="true" />
            </button>
          </li>
        ))}
      </ul>
    )
  }

  return (
    <section aria-label="Ustawienia skrzynki" className="deck-card max-w-[720px] space-y-5 rounded-lg p-5 text-[12.5px]">
      {blad && <p role="alert" className="text-deck-danger">{blad}</p>}
      {info && <p role="status" className="text-deck-muted">{info}</p>}

      <div className="space-y-2">
        <h3 className={naglowek}>Stopka odpowiedzi</h3>
        <textarea aria-label="Stopka" value={stopka} onChange={(e) => setStopka(e.target.value)} rows={4} maxLength={1000} className="deck-input w-full rounded-md px-2.5 py-2" />
        <button type="button" disabled={trwa || stopka === u.stopka} onClick={() => zapisz({ stopka })} className={przycisk}>
          Zapisz stopkę
        </button>
      </div>

      <div className="space-y-2">
        <h3 className={naglowek}>Zawsze pomijaj</h3>
        <p className="text-deck-muted">Nowe wątki od tych nadawców trafiają od razu do Pominiętych. Usunięcie z listy nie przywraca spraw już pominiętych.</p>
        {lista('Pomijane adresy', 'pomijaneAdresy', u.pomijaneAdresy)}
        <form
          onSubmit={(e) => {
            e.preventDefault()
            void zapisz({ pomijaneAdresy: [...u.pomijaneAdresy, adres] }, () => setAdres(''))
          }}
          className="flex gap-1.5"
        >
          <input aria-label="Adres do pomijania" value={adres} onChange={(e) => setAdres(e.target.value)} placeholder="np. newsletter@sklep.pl" className="deck-input min-w-0 flex-1 rounded-md px-2 py-1" />
          <button type="submit" disabled={trwa || !adres.trim()} className={przycisk}>
            Dodaj adres
          </button>
        </form>
        {lista('Pomijane domeny', 'pomijaneDomeny', u.pomijaneDomeny)}
        <form
          onSubmit={(e) => {
            e.preventDefault()
            void zapisz({ pomijaneDomeny: [...u.pomijaneDomeny, domena] }, () => setDomena(''))
          }}
          className="flex gap-1.5"
        >
          <input aria-label="Domena do pomijania" value={domena} onChange={(e) => setDomena(e.target.value)} placeholder="np. reklama.pl" className="deck-input min-w-0 flex-1 rounded-md px-2 py-1" />
          <button type="submit" disabled={trwa || !domena.trim()} className={przycisk}>
            Dodaj domenę
          </button>
        </form>
      </div>

      <div className="space-y-2">
        <h3 className={naglowek}>Rozłączenie</h3>
        <p className="text-deck-muted">Odwołuje dostęp D.E.C.K. do skrzynki kontakt@ w Google. Na koniec kadencji zaznacz też usunięcie danych.</p>
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={usunDane} onChange={(e) => setUsunDane(e.target.checked)} />
          Usuń też sprawy, kontakty i organizacje z D.E.C.K.
        </label>
        <button type="button" disabled={trwa} onClick={rozlacz} className="rounded-md border border-deck-danger-border bg-deck-danger-bg px-3 py-1 text-[11.5px] text-deck-danger disabled:opacity-50">
          Rozłącz skrzynkę
        </button>
      </div>
    </section>
  )
}
