'use client'
import { Suspense, type ReactNode } from 'react'
import { usePathname } from 'next/navigation'
import { Filter, ShieldCheck } from 'lucide-react'
import { Sidebar, ZakladkiMobilne, nazwaZakladki } from './Sidebar'
import { FilterBar } from './FilterBar'
import { ExportButton } from './ExportButton'
import { AuthStatus } from './AuthStatus'

/** Powłoka modułów analitycznych. Kokpit i logowanie mają własne układy. */
export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname()
  return (
    <div className="deck-shell flex min-h-screen">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <header className="deck-glow-line sticky top-0 z-20 flex flex-wrap items-center justify-between gap-x-4 gap-y-3 px-4 py-3 bg-deck-bg-deep/62 backdrop-blur-2xl md:px-6 md:py-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.22em] text-deck-muted">
              <ShieldCheck size={13} className="text-deck-accent" />
              SSUEW Analytics
            </div>
            <h1 className="mt-1 text-sm font-medium text-deck-text">{nazwaZakladki(pathname)}</h1>
          </div>
          <div className="flex items-center gap-2">
            <div className="deck-chip hidden xl:flex items-center gap-2 rounded-lg px-2 py-1">
              <Filter size={13} className="text-deck-accent" />
              <Suspense fallback={<div className="text-[11px] text-deck-muted">...</div>}>
                <FilterBar />
              </Suspense>
            </div>
            <ExportButton />
            <AuthStatus />
          </div>
          <ZakladkiMobilne />
        </header>
        <main id="export-root" className="flex-1 w-full max-w-[1320px] mx-auto px-4 py-4 md:px-6 md:py-6">{children}</main>
      </div>
    </div>
  )
}
