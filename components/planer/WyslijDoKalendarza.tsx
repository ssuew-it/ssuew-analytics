'use client'
import { useState } from 'react'
import { CalendarCheck, X } from 'lucide-react'
import type { PlanKalendarza } from '@/lib/kalendarz/porownanie'
import type { Termin } from '@/lib/kalendarz/wydarzenie'

const ADRES = '/api/planer/kalendarz'

type Stan =
  | { etap: 'wczytuje' }
  | { etap: 'plan'; plan: PlanKalendarza; wysyla: boolean }
  | { etap: 'wynik'; udane: number; nieudane: { tytul: string; powod: string }[] }
  | { etap: 'blad'; tekst: string; doUstawien: boolean }

/** „21.11” z terminu Google - z daty albo z daty i godziny. */
const dzienMiesiac = (t: Termin) => {
  const iso = 'date' in t ? t.date : t.dateTime
  return `${iso.slice(8, 10)}.${iso.slice(5, 7)}`
}

/** 1 zmianę, 2-4 zmiany, 5+ zmian (12-14 też „zmian”). */
function zmian(n: number): string {
  if (n === 1) return '1 zmianę'
  const d = n % 10
  const s = n % 100
  return `${n} ${d >= 2 && d <= 4 && (s < 12 || s > 14) ? 'zmiany' : 'zmian'}`
}

const wpisow = (n: number) => (n >= 2 && n <= 4 ? `${n} pasujące wpisy` : `${n} pasujących wpisów`)

async function zapytaj(method: 'GET' | 'POST') {
  const res = await fetch(ADRES, { method, cache: 'no-store' })
  const d = await res.json().catch(() => ({}))
  if (!res.ok) return { blad: String(d.error ?? 'Nie udało się połączyć z kalendarzem.'), status: res.status }
  return { dane: d }
}

/**
 * Przycisk Planera: podsumowanie zmian w Kalendarzu Samorządowicza i wysyłka.
 * Nic nie trafia do kalendarza bez obejrzenia podsumowania i kliknięcia „Wyślij”.
 */
export function WyslijDoKalendarza() {
  const [otwarte, setOtwarte] = useState(false)
  const [stan, setStan] = useState<Stan>({ etap: 'wczytuje' })

  async function otworz() {
    setOtwarte(true)
    setStan({ etap: 'wczytuje' })
    const r = await zapytaj('GET')
    if ('blad' in r) setStan({ etap: 'blad', tekst: r.blad!, doUstawien: r.status === 409 })
    else setStan({ etap: 'plan', plan: r.dane.plan as PlanKalendarza, wysyla: false })
  }

  async function wyslij(plan: PlanKalendarza) {
    setStan({ etap: 'plan', plan, wysyla: true })
    const r = await zapytaj('POST')
    if ('blad' in r) setStan({ etap: 'blad', tekst: r.blad!, doUstawien: r.status === 409 })
    else setStan({ etap: 'wynik', udane: r.dane.udane, nieudane: r.dane.nieudane ?? [] })
  }

  return (
    <>
      <button
        type="button"
        onClick={otworz}
        className="deck-chip flex items-center gap-2 rounded-lg px-3 py-2 text-[12px] text-deck-muted transition hover:text-deck-text"
      >
        <CalendarCheck size={14} aria-hidden="true" /> Wyślij do Kalendarza Samorządowicza
      </button>
      {otwarte && (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/60 p-4 pt-[10vh]">
          <div role="dialog" aria-modal="true" aria-label="Wysyłka do Kalendarza Samorządowicza" className="deck-card w-full max-w-[560px] space-y-4 rounded-lg p-5 text-[12.5px]">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-[14px] font-semibold text-deck-text">Kalendarz Samorządowicza</h2>
              <button type="button" aria-label="Zamknij" onClick={() => setOtwarte(false)} className="text-deck-muted hover:text-deck-text">
                <X size={16} aria-hidden="true" />
              </button>
            </div>
            <Tresc stan={stan} onWyslij={wyslij} />
          </div>
        </div>
      )}
    </>
  )
}

function Tresc({ stan, onWyslij }: { stan: Stan; onWyslij: (p: PlanKalendarza) => void }) {
  if (stan.etap === 'wczytuje') return <p className="font-mono text-[11px] text-deck-muted">Porównuję Planer z kalendarzem…</p>

  if (stan.etap === 'blad') {
    return (
      <div className="space-y-2">
        <p role="alert" className="text-deck-danger">{stan.tekst}</p>
        {stan.doUstawien && (
          <a href="/skrzynka?ustawienia=1" className="deck-button inline-flex rounded-md px-3 py-1.5 text-[12px]">Ustawienia skrzynki</a>
        )}
      </div>
    )
  }

  if (stan.etap === 'wynik') {
    return (
      <div className="space-y-2">
        <p role="status" className="text-deck-text">Wysłano: {zmian(stan.udane)}</p>
        {stan.nieudane.length > 0 && (
          <div role="alert" className="space-y-1 text-deck-danger">
            <p>Nie weszło ({stan.nieudane.length}) - kliknij „Wyślij do Kalendarza Samorządowicza” jeszcze raz, D.E.C.K. doda tylko brakujące:</p>
            <ul className="list-disc pl-5">
              {stan.nieudane.map((n, i) => <li key={i}>{n.tytul} - {n.powod}</li>)}
            </ul>
          </div>
        )}
      </div>
    )
  }

  const { plan, wysyla } = stan
  const wiersze = [
    ...plan.przejmij.map((p) => ({ znak: '≈', opis: 'przejmę ręczny wpis', termin: p.wydarzenie.start, tytul: p.wydarzenie.summary })),
    ...plan.dodaj.map((g) => ({ znak: '+', opis: 'dodam', termin: g.start, tytul: g.summary })),
    ...plan.zmien.map((z) => ({ znak: '~', opis: 'zmienię', termin: z.wydarzenie.start, tytul: z.wydarzenie.summary })),
    ...plan.usun.map((w) => ({ znak: '-', opis: 'usunę', termin: w.start, tytul: w.summary })),
  ]
  const liczby = ([['przejmę', plan.przejmij.length], ['dodam', plan.dodaj.length], ['zmienię', plan.zmien.length], ['usunę', plan.usun.length]] as const)
    .filter(([, n]) => n > 0)
    .map(([s, n]) => `${s} ${n}`)
    .join(' · ')

  return (
    <div className="space-y-3">
      {wiersze.length === 0 ? (
        <p className="text-deck-text">Kalendarz jest aktualny</p>
      ) : (
        <>
          <p className="text-deck-text">{liczby.charAt(0).toUpperCase() + liczby.slice(1)}</p>
          <ul aria-label="Zmiany w kalendarzu" className="max-h-[40vh] space-y-1 overflow-y-auto">
            {wiersze.map((w, i) => (
              <li key={i} className="flex gap-2">
                <span aria-label={w.opis} title={w.opis} className="w-3 shrink-0 font-mono text-deck-accent">{w.znak}</span>
                <span className="shrink-0 font-mono text-deck-muted">{dzienMiesiac(w.termin)}</span>
                <span className="text-deck-text">{w.tytul}</span>
              </li>
            ))}
          </ul>
          <p className="text-[11.5px] text-deck-muted">≈ przejmę ręczny wpis · + dodam · ~ zmienię · - usunę. Google nikogo nie powiadomi.</p>
        </>
      )}

      {plan.doSprawdzenia.length > 0 && (
        <section aria-label="Do sprawdzenia ręcznie" className="space-y-1 rounded-md border border-deck-danger-border bg-deck-danger-bg p-3">
          <h3 className="font-mono text-[10px] uppercase tracking-[0.16em] text-deck-danger">Do sprawdzenia ręcznie</h3>
          <p className="text-deck-muted">D.E.C.K. nie zgaduje i nic tu nie dodaje. Usuń albo przemianuj zbędny wpis w kalendarzu i wyślij ponownie; spotkań z gośćmi D.E.C.K. nigdy nie przejmuje.</p>
          <ul className="space-y-0.5">
            {plan.doSprawdzenia.map((d, i) => (
              <li key={i}>
                {dzienMiesiac(d.wydarzenie.start)} {d.wydarzenie.summary} -{' '}
                {d.spotkanie ? 'w kalendarzu jest spotkanie z gośćmi albo zaproszenie o tym tytule' : `${wpisow(d.kandydaci)} w kalendarzu`}
              </li>
            ))}
          </ul>
        </section>
      )}

      {wiersze.length > 0 && (
        <button type="button" disabled={wysyla} onClick={() => onWyslij(plan)} className="deck-button rounded-md px-4 py-1.5 text-[12px] font-semibold disabled:opacity-50">
          {wysyla ? 'Wysyłam…' : 'Wyślij'}
        </button>
      )}
    </div>
  )
}
