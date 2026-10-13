import { after } from 'next/server'
import { redirect } from 'next/navigation'
import { ktoNaStronie } from '@/lib/auth/naStronie'
import { computeOverview } from '@/lib/overview'
import { buildAlerts } from '@/lib/stats'
import { serieZWierszy, ilorazSerii } from '@/lib/kpi/serie'
import { DeckHub, type DaneAnalityki, type DanePlanera } from '@/components/deck/DeckHub'
import { biezacySemestr } from '@/lib/planer/semestry'
import { dzisWarszawa, godzinaWarszawa } from '@/lib/czas'
import { faktyKokpitu, najblizszeWydarzenia } from '@/lib/asystent/fakty'
import {
  czytajOdprawe,
  odswiezOdpraweWTle,
  pobierzArkusz,
  pobierzPlaner,
  type DaneArkusza,
} from '@/lib/asystent/dane'
import type { ZapisanaOdprawa } from '@/lib/asystent/odprawa'
import { tresciNotatek } from '@/lib/asystent/pamiecDane'
import { statystykiStron } from '@/lib/strony/dane'
import { podsumujStrony, type PodsumowanieStron, type WynikStrony } from '@/lib/strony/model'

/** Zapas na odprawę generowaną w tle po wysłaniu strony (Gemini do 25 s). */
export const maxDuration = 60

function naAnalityke(a: DaneArkusza): DaneAnalityki {
  const serie = serieZWierszy(a.punkty)
  // Trzeci argument to KpiPeriod[], którego aplikacja nie pobiera - tak samo
  // wywołuje to OverviewClient.
  const m = computeOverview(a.rekrutacje, a.kohorty, [])
  const konwersja =
    m.lastApplications && m.lastApplications > 0 && m.lastAccepted != null
      ? (m.lastAccepted / m.lastApplications) * 100
      : 0
  return {
    konwersja,
    retencja: m.histRetention ?? 0,
    kpiWzrosty: serie.filter((s) => ilorazSerii(s) > 1).length,
    kpiRazem: serie.length,
    alerty: buildAlerts(a.rekrutacje, a.kohorty, serie).length,
    czasArkuszaMs: a.czasMs,
  }
}

export default async function KokpitPage() {
  // Obie drogi wejścia. Sprawdzanie samego hasła odsyłało osoby na kodzie
  // na /login, a stamtąd useAuth odsyłał je z powrotem - pętla.
  const kto = await ktoNaStronie()
  if (!kto) redirect('/login')

  const teraz = new Date()
  const semestr = biezacySemestr(teraz)
  const dzis = dzisWarszawa(teraz)

  // Celowo bez `await`: strona idzie do przeglądarki od razu, a dane
  // dopływają strumieniem. Arkusz i Firestore pytamy równolegle i raz -
  // każdy panel bierze z tych samych dwóch obietnic.
  const arkusz = pobierzArkusz()
  const planer = pobierzPlaner(semestr.id, kto.rola)

  const analityka = arkusz.then(naAnalityke)
  const danePlanera: Promise<DanePlanera> = planer.then((p) => ({
    propozycje: p.propozycje,
    sesja: p.sesja,
    ok: p.ok,
    najblizsze: najblizszeWydarzenia(p.wydarzenia, dzis, 2),
  }))
  const fakty = Promise.all([arkusz, planer]).then(([a, p]) =>
    faktyKokpitu({
      rola: kto.rola,
      wydarzenia: p.wydarzenia,
      propozycje: p.propozycje,
      alerty: buildAlerts(a.rekrutacje, a.kohorty, serieZWierszy(a.punkty)).map((x) => ({ tytul: x.title })),
      dzis,
    }),
  )

  // Asystent i Strony są tylko dla właściciela. Zapisaną odprawę pokazujemy od
  // razu; ewentualną nową liczymy już po wysłaniu strony.
  let odprawa: Promise<ZapisanaOdprawa | null> | null = null
  let strony: Promise<PodsumowanieStron | null> | null = null
  if (kto.rola === 'owner') {
    const zapisana = czytajOdprawe().catch(() => null)
    odprawa = zapisana
    // Jedno pobranie na wejście - kafelek i odprawa biorą z tej samej obietnicy.
    const wynikiStron: Promise<WynikStrony[] | null> = statystykiStron().catch((e) => {
      console.error('[strony] kokpit:', e)
      return null
    })
    strony = wynikiStron.then((w) => (w ? podsumujStrony(w) : null))
    after(() => odswiezOdpraweWTle({
      arkusz, planer, zapisana, notatki: tresciNotatek().catch(() => []), strony: wynikiStron.then((w) => w ?? []),
      semestr: { id: semestr.id, nazwa: semestr.nazwa }, teraz,
    }))
  }

  return (
    <DeckHub
      rola={kto.rola}
      email={kto.email}
      kodem={kto.uid.startsWith('kod:')}
      godzina={godzinaWarszawa(teraz)}
      analityka={analityka}
      planer={danePlanera}
      fakty={fakty}
      odprawa={odprawa}
      strony={strony}
    />
  )
}
