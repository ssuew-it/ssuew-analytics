'use client'
import { Suspense, use, useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { LogOut, Radio } from 'lucide-react'
import { AnimatedNumber } from '@/components/ui/AnimatedNumber'
import { LogoMark } from '@/components/ui/LogoMark'
import { useAuth } from '@/lib/auth/useAuth'
import { opiszTrwanie, type StanSesjiWspolnej } from '@/lib/planer/stan'
import { useTeraz } from '@/lib/useTeraz'
import { odmiana, type Fakt, type NajblizszeWydarzenie } from '@/lib/asystent/fakty'
import type { ZapisanaOdprawa } from '@/lib/asystent/odprawa'
import type { Rola } from '@/lib/auth/role'
import { DNI_OKRESU, opisZmiany } from '@/lib/strony/okresy'
import type { PodsumowanieStron } from '@/lib/strony/model'
import { CzatDeck } from './CzatDeck'
import { DeckTile } from './DeckTile'
import { MatrixRain } from './MatrixRain'
import { PanelFaktow } from './PanelFaktow'
import { PanelOdprawy, SzkieletOdprawy } from './PanelOdprawy'
import { PasekStatusu, type DanePaska } from './PasekStatusu'

/** Liczby z arkusza - wolne: Apps Script odpowiada 1-3 s przy pustym cache. */
export interface DaneAnalityki {
  konwersja: number
  retencja: number
  kpiWzrosty: number
  kpiRazem: number
  alerty: number
  /** Czas odpowiedzi arkusza; `null`, gdy żadna zakładka nie odpowiedziała. */
  czasArkuszaMs: number | null
}

/** Stan z Firestore - szybszy, więc nie może czekać na arkusz. */
export interface DanePlanera {
  /** Propozycje zarządu czekające na decyzję. Liczone tylko dla właściciela. */
  propozycje: number
  /** Stan Sesji Operacyjnej bieżącego semestru. */
  sesja: StanSesjiWspolnej
  /** Kilka najbliższych wydarzeń na kafelek. */
  najblizsze: NajblizszeWydarzenie[]
  /** Firestore odpowiedział - do paska statusu. */
  ok: boolean
}

/**
 * Każdy kawałek danych to osobny strumień: nagłówek, kafelki i miejsca na
 * odprawę są od razu, liczby dopływają, gdy są gotowe. Odprawa przychodzi
 * z Firestore - Gemini nigdy nie opóźnia wejścia.
 */
type Props = {
  rola: Rola
  email: string
  /** Wejście kodem - do paska statusu. */
  kodem: boolean
  /** Godzina zebrania danych, czas Warszawy, liczona na serwerze. */
  godzina: string
  analityka: Promise<DaneAnalityki>
  planer: Promise<DanePlanera>
  fakty: Promise<Fakt[]>
  /** Zapisana odprawa asystenta. Zarząd dostaje `null` - asystent jest tylko dla właściciela. */
  odprawa: Promise<ZapisanaOdprawa | null> | null
  /** Podsumowanie Search Console. Zarząd dostaje `null`; wewnętrzne `null` - listy stron nie dało się odczytać. */
  strony: Promise<PodsumowanieStron | null> | null
}

export function DeckHub({ rola, email, kodem, godzina, analityka, planer, fakty, odprawa, strony }: Props) {
  const router = useRouter()
  const { wyloguj } = useAuth()

  async function wyjdz() {
    await wyloguj()
    router.push('/login')
    router.refresh()
  }

  const dzis = new Date().toLocaleDateString('pl-PL', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })

  return (
    <>
      <MatrixRain moc={0.2} />
      <div className="relative z-10 mx-auto flex min-h-screen max-w-[1360px] flex-col gap-6 p-[clamp(16px,2.4vw,34px)]">
        <header className="flex flex-wrap items-end justify-between gap-6 border-b border-white/8 pb-[18px]">
          <div className="flex items-center gap-3.5">
            <LogoMark />
            <div>
              <h1
                className="deck-glitch text-[27px] font-extrabold leading-none tracking-[0.26em] text-deck-text"
                data-tekst="D.E.C.K."
              >
                D.E.C.K.
              </h1>
              <p className="mt-1.5 font-mono text-[10px] uppercase tracking-[0.2em] text-deck-muted/70">
                {'Diagnostic Evaluation of Change & KPIs'}
              </p>
            </div>
          </div>
          <div className="text-right font-mono text-[11.5px] text-deck-muted">
            <div className="flex items-center justify-end gap-2">
              <span className="text-deck-text">{email}</span>
              <span className="rounded-full border border-deck-accent/34 bg-deck-accent/10 px-2 py-0.5 text-[9.5px] uppercase tracking-[0.16em] text-deck-accent">
                {rola}
              </span>
              <button
                type="button"
                onClick={wyjdz}
                title="Wyloguj"
                aria-label="Wyloguj"
                className="grid h-7 w-7 place-items-center rounded-md border border-white/10 text-deck-muted transition hover:border-deck-danger/40 hover:bg-white/[0.06] hover:text-deck-danger"
              >
                <LogOut size={13} />
              </button>
            </div>
            <div className="mt-1.5 text-[10.5px] uppercase tracking-[0.12em] text-deck-muted/70">{dzis}</div>
          </div>
        </header>

        <Suspense fallback={null}>
          <BanerSesji planer={planer} />
        </Suspense>

        {odprawa ? (
          <div className="grid gap-3">
            <Suspense fallback={<SzkieletOdprawy />}>
              <PanelOdprawy odprawa={odprawa} fakty={fakty} />
            </Suspense>
            <CzatDeck />
          </div>
        ) : (
          <PanelFaktow fakty={fakty} />
        )}

        {/* Bez flex-1: rozciągnięta siatka robiła z kafelków puste płachty
            na całą wysokość okna. Stopkę na dół dociąga jej mt-auto. */}
        <main className="grid auto-rows-[minmax(168px,auto)] grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {/* Zanim dane odpowiedzą, kafelki są te same, tylko bez liczb -
              da się w nie kliknąć od pierwszej chwili. */}
          <Suspense fallback={<KafelekAnalytics dane={null} />}>
            <KafelekAnalyticsZDanymi analityka={analityka} />
          </Suspense>

          <Suspense fallback={<KafelekSesji propozycje={null} najblizsze={null} />}>
            <KafelekSesjiZDanymi planer={planer} />
          </Suspense>

          {rola === 'owner' && (
            <DeckTile
              stan="zablokowany"
              href="/orbita"
              etykieta="moduł 03 · zadania"
              tytul="Orbita"
              wkrotce="etap 2"
            >
              <p className="text-[12px] leading-relaxed">Radar zadań - bliżej środka znaczy pilniej.</p>
            </DeckTile>
          )}

          {rola === 'owner' && strony && (
            <Suspense fallback={<KafelekStron dane={undefined} />}>
              <KafelekStronZDanymi strony={strony} />
            </Suspense>
          )}
        </main>

        <footer className="mt-auto">
          <PasekZDanymi kodem={kodem} godzina={godzina} analityka={analityka} planer={planer} />
        </footer>
      </div>
    </>
  )
}

function BanerSesji({ planer }: { planer: Promise<DanePlanera> }) {
  const { sesja } = use(planer)
  const teraz = useTeraz()
  if (!sesja.wlaczony) return null

  return (
    // Sesję wyłącza się ręcznie, więc przypomnienie musi być widać także
    // spoza Planera - zapomniana sesja to bezterminowy zapis dla zarządu.
    <Link
      href="/planer"
      className="flex items-center gap-3 rounded-lg border border-deck-accent/45 bg-deck-accent/10 px-4 py-3 text-[12.5px] transition hover:bg-deck-accent/15"
    >
      <Radio size={15} className="text-deck-accent" />
      <span className="font-semibold text-deck-text">Sesja Operacyjna trwa</span>
      {sesja.od !== null && (
        <span suppressHydrationWarning className="text-deck-muted">
          {opiszTrwanie(sesja.od, teraz)}
        </span>
      )}
      <span className="ml-auto text-deck-accent">Planer →</span>
    </Link>
  )
}

function KafelekAnalyticsZDanymi({ analityka }: { analityka: Promise<DaneAnalityki> }) {
  return <KafelekAnalytics dane={use(analityka)} />
}

function KafelekAnalytics({ dane }: { dane: DaneAnalityki | null }) {
  return (
    <DeckTile
      stan="zywy"
      href="/analytics"
      etykieta="moduł 01 · analityka"
      tytul="SSUEW Analytics"
      odznaka={dane && dane.alerty > 0 ? odmiana(dane.alerty, ['alert', 'alerty', 'alertów']) : undefined}
      span={2}
    >
      <div className="flex h-full flex-col justify-between gap-4">
        <div className="flex items-baseline gap-2.5 tabular-nums">
          {/* AnimatedNumber renderuje własny <span> i nie przyjmuje className - styl idzie na opakowanie. */}
          <span className="text-[clamp(30px,3.4vw,46px)] font-bold leading-none tracking-[-0.035em]">
            {dane ? <AnimatedNumber value={dane.konwersja} decimals={1} /> : <Brak />}
          </span>
          <span className="text-[13px] font-medium text-deck-muted">% konwersji</span>
        </div>
        <div className="grid grid-cols-3 gap-2.5 border-t border-white/8 pt-3.5">
          <Statystyka etykieta="retencja" wartosc={dane?.retencja ?? null} miejsca={2} jednostka="sem." />
          <Statystyka
            etykieta="KPI r/r"
            wartosc={dane?.kpiWzrosty ?? null}
            miejsca={0}
            jednostka={dane ? `/ ${dane.kpiRazem} wzrostów` : 'wzrostów'}
          />
          <Statystyka etykieta="alerty" wartosc={dane?.alerty ?? null} miejsca={0} jednostka="otwarte" />
        </div>
      </div>
    </DeckTile>
  )
}

function KafelekSesjiZDanymi({ planer }: { planer: Promise<DanePlanera> }) {
  const p = use(planer)
  return <KafelekSesji propozycje={p.propozycje} najblizsze={p.najblizsze} />
}

function KafelekSesji({ propozycje, najblizsze }: { propozycje: number | null; najblizsze: NajblizszeWydarzenie[] | null }) {
  return (
    <DeckTile
      stan="zywy"
      href="/planer"
      etykieta="moduł 02 · kalendarz semestru"
      tytul="Sesja Operacyjna"
      odznaka={propozycje ? `${propozycje} do decyzji` : undefined}
    >
      <p className="text-[12px] leading-relaxed text-deck-muted">
        Kalendarz semestru układany razem z zarządem. Ranga kategorii, kolizje osób i sal, propozycje zmian
        oraz eksport do Excela i CRA.
      </p>
      <ul className="mt-3 font-mono text-[11px] text-deck-text">
        {najblizsze === null ? (
          <li className="py-1"><Brak /></li>
        ) : najblizsze.length === 0 ? (
          <li className="py-1 text-deck-muted">Brak zaplanowanych wydarzeń</li>
        ) : (
          najblizsze.map((w) => (
            <li key={w.id} className="border-t border-white/[0.06] py-1.5 first:border-t-0">
              <span className="mr-2 text-[10px] text-deck-muted">{w.kiedy}</span>
              {w.tytul}
            </li>
          ))
        )}
      </ul>
    </DeckTile>
  )
}

function KafelekStronZDanymi({ strony }: { strony: Promise<PodsumowanieStron | null> }) {
  return <KafelekStron dane={use(strony)} />
}

/** `undefined` - dane jeszcze płyną; `null` - listy stron nie dało się odczytać. */
function KafelekStron({ dane }: { dane: PodsumowanieStron | null | undefined }) {
  const z = dane ? opisZmiany('klikniecia', dane.klikniecia, dane.poprzednieKlikniecia) : null
  return (
    <DeckTile
      stan="zywy"
      href="/strony"
      etykieta="moduł 04 · search console"
      tytul="Strony"
      odznaka={dane && dane.alerty > 0 ? odmiana(dane.alerty, ['alert', 'alerty', 'alertów']) : undefined}
    >
      {dane === undefined ? (
        <Brak />
      ) : dane === null ? (
        <p className="text-[12px] leading-relaxed text-deck-muted">Search Console nie odpowiada - szczegóły w panelu.</p>
      ) : dane.stron === 0 ? (
        <p className="text-[12px] leading-relaxed text-deck-muted">Dodaj pierwszą stronę, żeby śledzić ruch z Google.</p>
      ) : (
        <div className="flex h-full flex-col justify-between gap-3">
          <div className="flex items-baseline gap-2 tabular-nums">
            <span className="text-[30px] font-bold leading-none tracking-[-0.03em]">
              <AnimatedNumber value={dane.klikniecia} />
            </span>
            <span className="text-[12px] font-medium text-deck-muted">kliknięć · {DNI_OKRESU} dni</span>
          </div>
          <div className="font-mono text-[11px] text-deck-muted">
            {z && <span className={z.dobra === null ? '' : z.dobra ? 'text-deck-accent' : 'text-deck-danger'}>{z.tekst}</span>}{' '}
            wobec poprzednich {DNI_OKRESU} dni
            {dane.bledy > 0 && (
              <div className="mt-1 text-deck-danger">{odmiana(dane.bledy, ['strona z błędem', 'strony z błędem', 'stron z błędem'])}</div>
            )}
          </div>
        </div>
      )}
    </DeckTile>
  )
}

/**
 * Pasek celowo bez Suspense: podmiana wersji zastępczej na właściwą
 * zamontowałaby go od nowa i segmenty weszłyby drugi raz (stopka by mignęła).
 * Tu zostaje ten sam pasek, a zmieniają się tylko wartości.
 */
function PasekZDanymi({ kodem, godzina, analityka, planer }: {
  kodem: boolean
  godzina: string
  analityka: Promise<DaneAnalityki>
  planer: Promise<DanePlanera>
}) {
  const [dane, setDane] = useState<DanePaska | null>(null)
  useEffect(() => {
    let aktualny = true
    void Promise.all([analityka, planer]).then(([a, p]) => {
      if (aktualny) setDane({ czasArkuszaMs: a.czasArkuszaMs, firestoreOk: p.ok, metryki: a.kpiRazem, alerty: a.alerty })
    })
    return () => {
      aktualny = false
    }
  }, [analityka, planer])
  return <PasekStatusu kodem={kodem} godzina={godzina} dane={dane} />
}

/** Miejsce na liczbę, która jeszcze nie przyszła. */
function Brak() {
  return <span className="animate-pulse text-deck-muted/40">-</span>
}

function Statystyka({
  etykieta,
  wartosc,
  miejsca,
  jednostka,
}: {
  etykieta: string
  wartosc: number | null
  miejsca: number
  jednostka: string
}) {
  return (
    <div>
      <div className="font-mono text-[9.5px] uppercase tracking-[0.16em] text-deck-muted/70">{etykieta}</div>
      <div className="mt-1.5 text-[19px] font-semibold tracking-[-0.02em] tabular-nums text-deck-text">
        {wartosc === null ? <Brak /> : <AnimatedNumber value={wartosc} decimals={miejsca} />}
        <span className="ml-1 text-[11px] font-medium text-deck-muted">{jednostka}</span>
      </div>
    </div>
  )
}
