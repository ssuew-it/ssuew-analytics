'use client'
import { useEffect, useState } from 'react'
import { klientDziennika } from '@/lib/dziennik/klient'
import { klientOrbity } from '@/lib/orbita/klient'
import { etapPusty, szkieletDokumentu } from '@/lib/orbita/szkielet'
import { LIMITY, type Etap, type PolaZadania, type Zadanie } from '@/lib/orbita/typy'
import { dopasuj, ileBrakuje } from '@/lib/orbita/zapas'
import { szkicZDziennika } from '@/lib/orbita/zDziennika'
import type { Data } from '@/lib/planer/trwanie'
import { POLE, PRZYCISK, PRZYCISK_CICHY } from '@/components/dziennik/style'
import { EdytorEtapow } from './EdytorEtapow'

type Szkielet = 'dokument' | 'wlasne'
const ETYKIETA = 'block text-[12px] text-deck-muted'

const otwarteDni = (etapy: Etap[]) => etapy.filter((e) => e.zamkniety === null).reduce((s, e) => s + e.dni, 0)

/** Nowe zadanie albo edycja istniejącego (z `zmieniono` - kolizja z drugą kartą to 409). */
export function FormularzZadania({ dzis, zadanie, szkic, onGotowe, onAnuluj }: {
  dzis: Data
  zadanie?: Zadanie
  szkic?: PolaZadania
  onGotowe: () => void
  onAnuluj: () => void
}) {
  const start = zadanie ?? szkic
  const [tytul, setTytul] = useState(start?.tytul ?? '')
  const [kontekst, setKontekst] = useState(start?.kontekst ?? '')
  const [termin, setTermin] = useState(start?.termin ?? '')
  const [etapy, setEtapy] = useState<Etap[]>(start?.etapy ?? [etapPusty()])
  const [szkielet, setSzkielet] = useState<Szkielet>('wlasne')
  const [poDopasowaniu, setPoDopasowaniu] = useState(false)
  const [trwa, setTrwa] = useState(false)
  const [blad, setBlad] = useState<string | null>(null)

  const brakuje = ileBrakuje(etapy, termin || null, dzis)
  const suma = otwarteDni(etapy)

  function zmienEtapy(e: Etap[]) {
    setEtapy(e)
    setPoDopasowaniu(false)
  }

  function wybierzSzkielet(s: Szkielet) {
    setSzkielet(s)
    zmienEtapy(s === 'dokument' ? szkieletDokumentu() : [etapPusty()])
  }

  async function zapisz() {
    setTrwa(true)
    setBlad(null)
    const pola: PolaZadania = { tytul, kontekst, termin: termin || null, zrodlo: start?.zrodlo ?? null, etapy }
    try {
      if (zadanie) await klientOrbity.zmien(zadanie.id, pola, zadanie.zmieniono)
      else await klientOrbity.dodaj(pola)
      onGotowe()
    } catch (e) {
      setBlad((e as Error).message)
      setTrwa(false)
    }
  }

  return (
    <form
      className="deck-chip space-y-3 rounded-xl p-4"
      onSubmit={(e) => {
        e.preventDefault()
        zapisz()
      }}
    >
      <h2 className="text-[14px] font-medium text-deck-text">{zadanie ? 'Popraw zadanie' : 'Nowe zadanie'}</h2>
      <label className={ETYKIETA}>
        Tytuł
        <input aria-label="Tytuł" className={`${POLE} mt-1`} value={tytul} maxLength={LIMITY.tytul} onChange={(e) => setTytul(e.target.value)} />
      </label>
      <label className={ETYKIETA}>
        Kontekst
        <textarea
          aria-label="Kontekst"
          className={`${POLE} mt-1 min-h-16`}
          value={kontekst}
          maxLength={LIMITY.kontekst}
          placeholder="Czego dotyczy, co już wiadomo"
          onChange={(e) => setKontekst(e.target.value)}
        />
        <span className="mt-1 block text-right font-mono text-[10px]">{kontekst.length} / {LIMITY.kontekst}</span>
      </label>
      <label className={`${ETYKIETA} w-48`}>
        Termin
        <input aria-label="Termin" type="date" className={`${POLE} mt-1`} value={termin} onChange={(e) => { setTermin(e.target.value); setPoDopasowaniu(false) }} />
        <span className="mt-1 block text-[10.5px]">puste = kiedyś, bez terminu</span>
      </label>

      {!zadanie && (
        <div role="radiogroup" aria-label="Etapy" className="flex flex-wrap gap-4 text-[12.5px] text-deck-text">
          {([['dokument', 'Dokument normatywny'], ['wlasne', 'Własne etapy']] as const).map(([k, etykieta]) => (
            <label key={k} className="flex items-center gap-1.5">
              <input type="radio" name="szkielet" className="accent-[var(--color-deck-accent)]" checked={szkielet === k} onChange={() => wybierzSzkielet(k)} />
              {etykieta}
            </label>
          ))}
        </div>
      )}

      {brakuje > 0 && (
        <div className="rounded-lg border border-deck-warn/30 bg-deck-warn/5 px-3 py-2 text-[12.5px] text-deck-warn">
          <p>Etapy trwają {suma} dni, do terminu zostało {suma - brakuje}</p>
          {poDopasowaniu ? (
            <p className="mt-1">Nawet po skróceniu brakuje {brakuje} dni - przesuń termin albo skróć konsultacje</p>
          ) : (
            <button
              type="button"
              className={`${PRZYCISK_CICHY} mt-2`}
              onClick={() => {
                setEtapy(dopasuj(etapy, termin, dzis).etapy)
                setPoDopasowaniu(true)
              }}
            >
              Dopasuj
            </button>
          )}
        </div>
      )}

      <EdytorEtapow etapy={etapy} onChange={zmienEtapy} />

      {blad && <p role="alert" className="text-[12.5px] text-deck-danger">{blad}</p>}
      <div className="flex gap-2">
        <button type="submit" className={PRZYCISK} disabled={trwa}>Zapisz</button>
        <button type="button" className={PRZYCISK_CICHY} disabled={trwa} onClick={onAnuluj}>Anuluj</button>
      </div>
    </form>
  )
}

/** Formularz nowego zadania; z `zDziennika` - wypełniony obowiązkiem z kalendarza pracy. */
export function NoweZadanie({ dzis, zDziennika, onGotowe, onAnuluj }: {
  dzis: Data
  zDziennika: string | null
  onGotowe: () => void
  onAnuluj: () => void
}) {
  const [szkic, setSzkic] = useState<PolaZadania | null | 'brak'>(zDziennika ? null : 'brak')
  const [blad, setBlad] = useState<string | null>(null)

  useEffect(() => {
    if (!zDziennika) return
    klientDziennika
      .ksiega()
      .then((k) => {
        const w = k.wpisy.find((x) => x.id === zDziennika)
        if (w?.dzial === 'cykl') setSzkic(szkicZDziennika(w, dzis))
        else {
          setBlad('Nie znaleziono wpisu w Dzienniku')
          setSzkic('brak')
        }
      })
      .catch((e: Error) => {
        setBlad(e.message)
        setSzkic('brak')
      })
  }, [zDziennika, dzis])

  if (szkic === null) return <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-deck-muted">Wczytuję wpis z Dziennika…</p>
  return (
    <>
      {blad && <p role="status" className="mb-2 text-[12.5px] text-deck-danger">{blad}</p>}
      <FormularzZadania dzis={dzis} szkic={szkic === 'brak' ? undefined : szkic} onGotowe={onGotowe} onAnuluj={onAnuluj} />
    </>
  )
}
