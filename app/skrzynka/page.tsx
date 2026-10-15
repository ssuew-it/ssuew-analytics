import { redirect } from 'next/navigation'
import { after } from 'next/server'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { ktoNaStronie } from '@/lib/auth/naStronie'
import { WERSJA_DANYCH, czytajStan, liczniki, skladZarzadu, uzupelnijKlucze } from '@/lib/skrzynka/dane'
import { synchronizuj } from '@/lib/skrzynka/synchronizacja'
import { PanelSkrzynki } from '@/components/skrzynka/PanelSkrzynki'

export const maxDuration = 60
/** Dociągnięcie przy wejściu tylko wtedy, gdy push dawno nic nie przyniósł - tanie zabezpieczenie przed zgubionym powiadomieniem. */
const DOCIAGNIJ_PO_MS = 15 * 60_000

export default async function SkrzynkaPage({ searchParams }: { searchParams: Promise<{ blad?: string }> }) {
  const kto = await ktoNaStronie()
  if (!kto) redirect('/login')
  // Skrzynka instytucji jest tylko dla właściciela - zarząd wraca do kokpitu.
  if (kto.rola !== 'owner') redirect('/')

  const { blad } = await searchParams
  const teraz = new Date().getTime()
  const [stan, sklad] = await Promise.all([czytajStan().catch(() => null), skladZarzadu().catch(() => [] as string[])])
  // Raz po wdrożeniu 2a: sprawy zapisane wcześniej nie mają klucza listy i nie pojawiłyby się w zakładkach.
  if (stan && stan.wersjaDanych < WERSJA_DANYCH) await uzupelnijKlucze().catch((e) => console.error('[skrzynka] klucze:', e))
  const l = await liczniki(teraz).catch(() => null)
  if (stan?.polaczona && !stan.import.trwa && (stan.ostatniaSynchronizacja ?? 0) < teraz - DOCIAGNIJ_PO_MS) {
    after(() => synchronizuj().catch((e) => console.error('[skrzynka] wejście:', e)))
  }

  return (
    <main className="mx-auto w-full max-w-[1360px] p-[clamp(16px,2.4vw,34px)]">
      <header className="mb-5">
        <Link
          href="/"
          className="mb-2 inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.18em] text-deck-muted transition hover:text-deck-text"
        >
          <ArrowLeft size={12} /> DECK
        </Link>
        <h1 className="text-lg font-semibold text-deck-text">Skrzynka</h1>
        <p className="mt-0.5 font-mono text-[10px] uppercase tracking-[0.18em] text-deck-muted/70">kontakt@samorzad.ue.wroc.pl</p>
      </header>
      {/* Do przeglądarki idą tylko liczby i postęp - nigdy token. */}
      <PanelSkrzynki liczniki={l} postep={stan?.import ?? null} blad={blad ?? null} sklad={sklad} email={stan?.email ?? ''} />
    </main>
  )
}
