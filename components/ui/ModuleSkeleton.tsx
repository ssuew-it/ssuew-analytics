import type { ReactNode } from 'react'
import { Skeleton } from './Skeleton'

type Variant = 'overview' | 'rekrutacje' | 'retencja' | 'czlonkowie' | 'kpi' | 'lejek' | 'default'

/**
 * Powłoka udająca BentoCard: ta sama obwódka, promień i padding, plus pasek
 * na tytuł i podtytuł. Bez tego ładowanie pokazywało gołe prostokąty, a po
 * chwili wskakiwały karty z nagłówkami - układ podskakiwał i wyglądało to
 * jak dwa różne ekrany.
 */
function Karta({ children, className = '' }: { children?: ReactNode; className?: string }) {
  return (
    <section className={`deck-card rounded-lg p-4 ${className}`.trim()} aria-hidden>
      <div className="mb-3 flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1 space-y-1.5">
          <Skeleton className="h-3.5 w-40" />
          <Skeleton className="h-2 w-56" />
        </div>
        <span className="mt-1 h-1.5 w-1.5 flex-none rounded-full bg-white/15" />
      </div>
      {children}
    </section>
  )
}

/** Wiersz tabeli - tyle kolumn, ile ma prawdziwa tabela w module. */
function Wiersze({ ile = 6, kolumny = 6 }: { ile?: number; kolumny?: number }) {
  return (
    <div className="space-y-1.5">
      {Array.from({ length: ile }).map((_, i) => (
        <div key={i} className="flex gap-2">
          {Array.from({ length: kolumny }).map((__, j) => (
            <Skeleton key={j} className={`h-6 ${j === 0 ? 'w-24 flex-none' : 'flex-1'}`} />
          ))}
        </div>
      ))}
    </div>
  )
}

/** Miejsce na wykres - proporcje zbliżone do tego, co rysuje Recharts. */
function Wykres({ h = 'h-64' }: { h?: string }) {
  return <Skeleton className={`w-full ${h}`} />
}

function Ramka({ children }: { children: ReactNode }) {
  return (
    <div className="space-y-3" aria-label="Ładowanie" aria-busy="true">
      {children}
    </div>
  )
}

export function ModuleSkeleton({ variant = 'default' }: { variant?: Variant }) {
  // Każdy wariant odwzorowuje kolejność i rozpiętość kart z odpowiadającego
  // mu modułu. Gdy tam coś dojdzie albo zniknie, trzeba poprawić i tutaj.
  if (variant === 'overview') {
    return (
      <Ramka>
        <Karta className="p-0">
          <div className="grid min-h-[260px] grid-cols-1 md:grid-cols-[1.15fr_0.85fr] gap-3 p-4">
            <div className="space-y-3">
              <Skeleton className="h-10 w-3/4" />
              <Skeleton className="h-4 w-2/3" />
              <div className="grid max-w-2xl grid-cols-1 sm:grid-cols-3 gap-2 pt-3">
                {Array.from({ length: 3 }).map((_, i) => (
                  <Skeleton key={i} className="h-16" />
                ))}
              </div>
            </div>
            <Skeleton className="h-full min-h-[200px]" />
          </div>
        </Karta>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Karta key={i}>
              <Skeleton className="h-12" />
            </Karta>
          ))}
        </div>

        <Karta>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-24" />
            ))}
          </div>
        </Karta>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <Karta>
            <Wykres h="h-56" />
          </Karta>
          <Karta>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-24" />
              ))}
            </div>
          </Karta>
        </div>
      </Ramka>
    )
  }

  if (variant === 'rekrutacje') {
    return (
      <Ramka>
        <Karta>
          <Wiersze ile={6} kolumny={6} />
          <div className="mt-3 grid grid-cols-2 lg:grid-cols-4 gap-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-9" />
            ))}
          </div>
        </Karta>
        <Karta>
          <Wykres />
        </Karta>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <Karta>
            <Wykres h="h-48" />
          </Karta>
          <Karta>
            <Wykres h="h-48" />
          </Karta>
        </div>
        <Karta>
          <Wykres h="h-56" />
        </Karta>
      </Ramka>
    )
  }

  if (variant === 'retencja') {
    return (
      <Ramka>
        <Karta>
          <Wiersze ile={7} kolumny={7} />
        </Karta>
        <Karta>
          <Wykres h="h-72" />
        </Karta>
        <Karta>
          <div className="space-y-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3">
                <Skeleton className="h-4 w-28 flex-none" />
                <Skeleton className="h-6 flex-1" />
              </div>
            ))}
          </div>
        </Karta>
      </Ramka>
    )
  }

  if (variant === 'czlonkowie') {
    return (
      <Ramka>
        <Karta>
          <div className="mb-3 flex flex-wrap items-center gap-3">
            <Skeleton className="h-8 w-44" />
            <Skeleton className="h-4 w-24" />
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-12" />
            ))}
          </div>
        </Karta>
        <Karta>
          <div className="space-y-1">
            {Array.from({ length: 10 }).map((_, i) => (
              <div key={i} className="grid grid-cols-[180px_repeat(8,1fr)_80px] gap-1">
                {Array.from({ length: 10 }).map((__, j) => (
                  <Skeleton key={j} className="h-7" />
                ))}
              </div>
            ))}
          </div>
        </Karta>
      </Ramka>
    )
  }

  if (variant === 'kpi') {
    return (
      <Ramka>
        <Karta>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-9" />
            ))}
          </div>
        </Karta>
        <Karta>
          <Wykres h="h-44" />
        </Karta>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Karta key={i}>
              <Skeleton className="h-20" />
            </Karta>
          ))}
        </div>
        <Karta>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-20" />
            ))}
          </div>
        </Karta>
        {Array.from({ length: 2 }).map((_, i) => (
          <Karta key={i}>
            <div className="space-y-1.5">
              {Array.from({ length: 5 }).map((__, j) => (
                <Skeleton key={j} className="h-9" />
              ))}
            </div>
          </Karta>
        ))}
      </Ramka>
    )
  }

  if (variant === 'lejek') {
    return (
      <Ramka>
        <Karta>
          <div className="space-y-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3">
                <Skeleton className="h-4 w-28 flex-none" />
                <Skeleton className="h-6 flex-1" />
              </div>
            ))}
          </div>
        </Karta>
      </Ramka>
    )
  }

  return (
    <Ramka>
      <Karta>
        <Wykres h="h-44" />
      </Karta>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <Karta>
          <Skeleton className="h-32" />
        </Karta>
        <Karta>
          <Skeleton className="h-32" />
        </Karta>
      </div>
    </Ramka>
  )
}
