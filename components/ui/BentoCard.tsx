import type { ReactNode } from 'react'

type Props = {
  title?: string
  sub?: string
  span?: 1 | 2 | 3 | 4
  tone?: 'default' | 'danger'
  className?: string
  /** Akcja w prawym górnym rogu zamiast kropki (np. link „+ dodaj”). */
  action?: ReactNode
  children: ReactNode
}

const spanClass: Record<NonNullable<Props['span']>, string> = {
  1: '',
  // Szerokość w siatce tylko od lg - niżej siatki mają 1-2 kolumny, a col-span-4
  // w siatce dwukolumnowej dokłada kolumny i rozpycha stronę w bok.
  2: 'lg:col-span-2',
  3: 'lg:col-span-3',
  4: 'lg:col-span-4',
}

export function BentoCard({ title, sub, span = 1, tone = 'default', className = '', action, children }: Props) {
  const toneClass =
    tone === 'danger'
      ? 'border-deck-danger-border bg-deck-danger-bg/70'
      : 'deck-card'
  return (
    <section className={`${spanClass[span]} ${toneClass} rounded-lg p-4 ${className}`.trim()}>
      {title && (
        <div className="relative z-10 mb-3 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="text-sm font-semibold text-deck-text tracking-[0.01em]">{title}</div>
            {sub && <div className="mt-0.5 text-[10px] text-deck-muted">{sub}</div>}
          </div>
          {action ?? <span className="mt-1 h-1.5 w-1.5 rounded-full bg-deck-accent/80 shadow-[0_0_16px_rgba(46,230,166,0.65)]" />}
        </div>
      )}
      <div className="relative z-10">{children}</div>
    </section>
  )
}
