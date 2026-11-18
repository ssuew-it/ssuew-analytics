'use client'
import type { ReactNode, PointerEvent } from 'react'
import Link from 'next/link'

export type StanKafelka = 'zywy' | 'zablokowany'

type Props = {
  stan: StanKafelka
  href: string
  etykieta: string
  tytul: string
  odznaka?: string
  /** „uwaga” dla alertów i zaległości - zielona plakietka czytała się jak „wszystko dobrze”. */
  odznakaTon?: 'info' | 'uwaga'
  wkrotce?: string
  span?: 1 | 2
  rows?: 1 | 2
  children: ReactNode
}

// Od `sm` w górę: na telefonie siatka ma jedną kolumnę, a `col-span-2`
// dorabiało drugą, niewidzialną, i ściskało sąsiedni kafelek do paska.
const spanClass = { 1: '', 2: 'sm:col-span-2' } as const
const rowsClass = { 1: '', 2: 'sm:row-span-2' } as const

/**
 * Lekkie przechylenie w stronę kursora - maksymalnie 3°, bo więcej rozmazuje
 * tekst. Idzie przez zmienne CSS, nie przez stan Reacta: ruch myszy nie może
 * przerysowywać drzewa.
 *
 * Rozmyta poświata pod kursorem wylądowała w koszu - zabierała czytelność
 * liczbom, a to one są tu treścią.
 */
function sledzKursor(e: PointerEvent<HTMLElement>) {
  const el = e.currentTarget
  const r = el.getBoundingClientRect()
  const px = (e.clientX - r.left) / r.width - 0.5
  const py = (e.clientY - r.top) / r.height - 0.5
  el.style.setProperty('--tilt-x', `${(-py * 3).toFixed(2)}deg`)
  el.style.setProperty('--tilt-y', `${(px * 3).toFixed(2)}deg`)
}

function odsunKursor(e: PointerEvent<HTMLElement>) {
  e.currentTarget.style.setProperty('--tilt-x', '0deg')
  e.currentTarget.style.setProperty('--tilt-y', '0deg')
}

export function DeckTile({
  stan,
  href,
  etykieta,
  tytul,
  odznaka,
  odznakaTon = 'info',
  wkrotce,
  span = 1,
  rows = 1,
  children,
}: Props) {
  const uklad = `${spanClass[span]} ${rowsClass[rows]}`.trim()

  const naglowek = (
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0">
        <div className="font-mono text-[9.5px] uppercase tracking-[0.2em] text-deck-muted/70">{etykieta}</div>
        <h2 className="mt-1 text-[17px] font-semibold leading-tight tracking-[-0.015em] text-balance">{tytul}</h2>
      </div>
      {odznaka && (
        <span className={`deck-chip flex-none rounded-full px-2 py-0.5 font-mono text-[9.5px] uppercase tracking-[0.1em] ${odznakaTon === 'uwaga' ? 'border-deck-warn/40 text-deck-warn' : 'text-deck-accent'}`}>
          {odznaka}
        </span>
      )}
      {wkrotce && (
        <span className="flex-none font-mono text-[9.5px] uppercase tracking-[0.14em] text-deck-muted/60">
          {wkrotce}
        </span>
      )}
    </div>
  )

  if (stan === 'zablokowany') {
    return (
      <section className={`${uklad} deck-tile-locked flex flex-col gap-3 rounded-lg p-[18px] text-deck-muted/70`}>
        {naglowek}
        <div className="flex-1">{children}</div>
      </section>
    )
  }

  return (
    <Link
      href={href}
      onPointerMove={sledzKursor}
      onPointerLeave={odsunKursor}
      className={`${uklad} deck-card deck-tile flex flex-col gap-3 rounded-lg p-[18px] text-deck-text no-underline`}
    >
      {/* Narożniki celownika - rysują się dopiero przy najechaniu. */}
      <i className="deck-tile__rog deck-tile__rog--lg" aria-hidden="true" />
      <i className="deck-tile__rog deck-tile__rog--pg" aria-hidden="true" />
      <i className="deck-tile__rog deck-tile__rog--ld" aria-hidden="true" />
      <i className="deck-tile__rog deck-tile__rog--pd" aria-hidden="true" />
      <div className="relative z-10 flex flex-1 flex-col gap-3">
        {naglowek}
        <div className="flex-1">{children}</div>
      </div>
    </Link>
  )
}
