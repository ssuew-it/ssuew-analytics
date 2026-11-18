'use client'
import { useFilters } from '@/lib/useFilters'

const seasons = [
  { value: 'all', label: 'Oba' },
  { value: 'jesien', label: 'Jesień' },
  { value: 'wiosna', label: 'Wiosna' },
] as const

export function FilterBar() {
  const { filters, setFilters } = useFilters()
  return (
    <div className="flex items-center gap-2">
      <span className="text-[11px] text-deck-muted">sezon</span>
      <div role="group" aria-label="Sezon" className="flex rounded-md bg-deck-bg-deep/70 p-0.5">
        {seasons.map((season) => {
          const active = filters.sezon === season.value
          return (
            <button
              key={season.value}
              type="button"
              onClick={() => setFilters({ ...filters, sezon: season.value })}
              className={`rounded-md px-2 py-1 text-[10px] transition ${
                active
                  ? 'bg-deck-accent text-deck-bg-deep shadow-[0_0_18px_rgba(46,230,166,0.25)]'
                  : 'text-deck-muted hover:text-deck-text'
              }`}
            >
              {season.label}
            </button>
          )
        })}
      </div>
      <span className="text-[11px] text-deck-muted">lata</span>
      <input
        aria-label="Rok od"
        type="number"
        placeholder="od"
        value={filters.fromYear ?? ''}
        onChange={(event) =>
          setFilters({ ...filters, fromYear: event.target.value ? Number(event.target.value) : null })
        }
        className="deck-input w-16 rounded-md px-2 py-1 text-[11px]"
      />
      <input
        aria-label="Rok do"
        type="number"
        placeholder="do"
        value={filters.toYear ?? ''}
        onChange={(event) =>
          setFilters({ ...filters, toYear: event.target.value ? Number(event.target.value) : null })
        }
        className="deck-input w-16 rounded-md px-2 py-1 text-[11px]"
      />
    </div>
  )
}
