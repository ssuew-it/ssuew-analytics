import { Suspense } from 'react'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { ktoNaStronie } from '@/lib/auth/naStronie'
import { dzisWarszawa } from '@/lib/czas'
import { statystykiStron } from '@/lib/strony/dane'
import { emailKonta } from '@/lib/strony/google'
import { DNI_OKRESU, dataKrotka, okresy } from '@/lib/strony/okresy'
import { DodajStrone } from '@/components/strony/DodajStrone'
import { PanelStron, SzkieletStron } from '@/components/strony/PanelStron'

export default async function StronyPage() {
  const kto = await ktoNaStronie()
  if (!kto) redirect('/login')
  // Zarząd nie widzi ani kafelka, ani danych - wejście z adresu odsyłamy do kokpitu.
  if (kto.rola !== 'owner') redirect('/')

  const { biezacy } = okresy(dzisWarszawa(new Date()))
  // Bez await: nagłówek idzie od razu, liczby dopływają strumieniem.
  const wyniki = statystykiStron().catch((e) => {
    console.error('[strony] lista:', e)
    return null
  })

  return (
    <main className="mx-auto w-full max-w-[1360px] p-[clamp(16px,2.4vw,34px)]">
      <header className="mb-5 flex flex-wrap items-end justify-between gap-4">
        <div>
          <Link
            href="/"
            className="mb-2 inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.18em] text-deck-muted transition hover:text-deck-text"
          >
            <ArrowLeft size={12} /> DECK
          </Link>
          <h1 className="text-lg font-semibold text-deck-text">Strony</h1>
          <p className="mt-0.5 font-mono text-[10px] uppercase tracking-[0.18em] text-deck-muted/70">
            Google Search Console · {DNI_OKRESU} dni do {dataKrotka(biezacy.do)}
          </p>
        </div>
        <DodajStrone />
      </header>

      <Suspense fallback={<SzkieletStron />}>
        <PanelStron wyniki={wyniki} email={emailKonta()} />
      </Suspense>
    </main>
  )
}
