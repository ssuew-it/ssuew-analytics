import { buildAlerts } from '@/lib/stats'
import { ilorazSerii, ostatniPunkt, serieZWierszy } from '@/lib/kpi/serie'
import { edycje, kondycjaEdycji } from '@/lib/projekty/flagi'
import { dzienTygodnia } from '@/lib/planer/daty'
import { kolizjeWMiesiacu } from '@/lib/planer/kolizje'
import { opisCzasu, opisMiejsca, opisOsob, porownajWydarzenia } from '@/lib/planer/opis'
import { dniWydarzenia, poczatek, porownajDaty, przesunDate, type Data } from '@/lib/planer/trwanie'
import { KATEGORIE, type Miesiac, type Wydarzenie } from '@/lib/planer/typy'
import type { StanSesjiWspolnej } from '@/lib/planer/stan'
import type { StatystykiStrony } from '@/lib/strony/model'
import type { Czlonek, Kohorta, KpiMetric, Projekt, Rekrutacja } from '@/types'

/** Surowe dane całego projektu - to, co serwer i tak umie pobrać. */
export interface DaneProjektu {
  rekrutacje: Rekrutacja[]
  kohorty: Kohorta[]
  punkty: KpiMetric[]
  projekty: Projekt[]
  czlonkowie: Czlonek[]
  semestr: { id: string; nazwa: string }
  wydarzenia: Wydarzenie[]
  sesja: StanSesjiWspolnej
  sklad: string[]
  propozycje: number
  /** Ustalenia zatwierdzone przez właściciela - asystent traktuje je jak fakty. */
  notatki: string[]
  /** Strony z Search Console, które odpowiedziały - błędne pomijamy, asystent nie zgaduje. */
  strony: StatystykiStrony[]
}

/** Ile dni Planera widzi asystent. */
export const DNI_PLANERA = 21

const dwie = (n: number) => String(n).padStart(2, '0')
const naTekst = (d: Data) => `${dwie(d.dzien)}.${dwie(d.miesiac)}.${d.rok}`

function kierunek(iloraz: number): string {
  if (!iloraz) return 'brak danych'
  if (iloraz >= 1.05) return 'wzrost'
  if (iloraz <= 0.95) return 'spadek'
  return 'bez zmian'
}

function miesiaceOkna(od: Data, doDnia: Data): Miesiac[] {
  const wynik: Miesiac[] = []
  let m = { m: od.miesiac, y: od.rok }
  while (m.y < doDnia.rok || (m.y === doDnia.rok && m.m <= doDnia.miesiac)) {
    wynik.push(m)
    m = m.m === 12 ? { m: 1, y: m.y + 1 } : { m: m.m + 1, y: m.y }
  }
  return wynik
}

/**
 * Zwięzły obraz projektu dla modelu. Czysta funkcja: ten sam stan danych daje
 * ten sam obiekt - na tym opiera się ślad, który decyduje o odświeżeniu odprawy.
 */
export function zbudujKontekst(d: DaneProjektu, dzis: Data) {
  const serie = serieZWierszy(d.punkty)
  const kpi = serie.map((s) => {
    const ost = ostatniPunkt(s)
    const q = ilorazSerii(s)
    return {
      kategoria: s.kategoria,
      nazwa: s.nazwa,
      okres: ost?.okres ?? null,
      wartosc: ost?.wartosc ?? null,
      rokDoRoku: q ? Math.round(q * 100) / 100 : null,
      kierunek: kierunek(q),
    }
  })

  const rekrutacje = [...d.rekrutacje]
    // Rok akademicki zaczyna się jesienią: J'25 przed W'26 tego samego `rok`.
    .sort((a, b) => a.rok - b.rok || (a.sezon === b.sezon ? 0 : a.sezon === 'jesien' ? -1 : 1))
    .map((r) => ({
      edycja: r.edycja,
      zgloszenia: r.zgloszenia,
      przyjeci: r.przyjeci,
      konwersjaProc: r.zgloszenia ? Math.round((r.przyjeci / r.zgloszenia) * 1000) / 10 : null,
    }))

  const retencja = d.kohorty.map((k) => ({
    edycja: k.edycja, liczebnosc: k.n_czlonkow, sredniaSemestrow: k.avg_retention_sem, wToku: k.in_progress,
  }))

  const alerty = buildAlerts(d.rekrutacje, d.kohorty, serie).map((a) => ({
    waga: a.severity, tytul: a.title, opis: a.detail,
  }))

  const ostatniaEdycja = edycje(d.projekty)[0]
  const projekty = ostatniaEdycja
    ? {
        edycja: ostatniaEdycja,
        lista: kondycjaEdycji(d.projekty, ostatniaEdycja).map((k) => ({
          projekt: k.projekt.projekt,
          obszar: k.projekt.obszar,
          flagi: k.flagi.map((f) => ({ waga: f.waga, tytul: f.tytul, detal: f.detal })),
        })),
      }
    : null

  const koniecOkna = przesunDate(dzis, DNI_PLANERA - 1)
  const wOknie = (x: Data) => porownajDaty(x, dzis) >= 0 && porownajDaty(x, koniecOkna) <= 0
  const wydarzenia = d.wydarzenia
    .filter((w) => dniWydarzenia(w).some(wOknie))
    .sort((a, b) => porownajDaty(poczatek(a), poczatek(b)) || porownajWydarzenia(a, b))
    .map((w) => {
      const p = poczatek(w)
      return {
        data: naTekst(p),
        dzienTygodnia: dzienTygodnia(p.rok, p.miesiac, p.dzien),
        dni: w.dni,
        tytul: w.tytul,
        kategoria: KATEGORIE[w.kategoria].etykieta,
        czas: opisCzasu(w),
        miejsce: opisMiejsca(w),
        osoby: opisOsob(w.osoby),
      }
    })

  const kolizje = miesiaceOkna(dzis, koniecOkna).flatMap((m) =>
    [...kolizjeWMiesiacu(d.wydarzenia, m)]
      .map(([dzien, k]) => ({ data: { rok: m.y, miesiac: m.m, dzien }, k }))
      .filter((x) => wOknie(x.data))
      .map((x) => ({
        data: naTekst(x.data),
        osoby: x.k.osoby.map((o) => `${o.osoba}${o.twarda ? ' (nakładają się)' : ''}`),
        sale: x.k.sale.map((s) => s.sala),
      })),
  )

  const poKohortach = new Map<string, Record<string, number>>()
  for (const c of d.czlonkowie) {
    const statusy = poKohortach.get(c.kohorta_edycja) ?? {}
    statusy[c.status] = (statusy[c.status] ?? 0) + 1
    poKohortach.set(c.kohorta_edycja, statusy)
  }
  const czlonkowie = [...poKohortach].map(([kohorta, statusy]) => ({ kohorta, statusy }))

  return {
    meta: { data: naTekst(dzis), dzienTygodnia: dzienTygodnia(dzis.rok, dzis.miesiac, dzis.dzien) },
    kpi,
    rekrutacje,
    retencja,
    alerty,
    projekty,
    planer: {
      semestr: d.semestr.nazwa,
      sesjaOperacyjna: d.sesja.wlaczony ? 'trwa' : 'nie trwa',
      propozycjeDoDecyzji: d.propozycje,
      sklad: d.sklad,
      wydarzenia,
      kolizje,
    },
    czlonkowie,
    strony: d.strony.map((s) => ({
      strona: s.nazwa,
      okres: `${s.okres.od} - ${s.okres.do}`,
      klikniecia: s.biezace.klikniecia,
      wyswietlenia: s.biezace.wyswietlenia,
      sredniaPozycja: Math.round(s.biezace.pozycja * 10) / 10,
      zmianaKlikniecProc: s.zmiana.klikniecia === null ? null : Math.round(s.zmiana.klikniecia * 100),
      alertSpadku: s.alert,
      topZapytania: s.zapytania.slice(0, 3).map((z) => z.tekst),
    })),
    notatki: d.notatki,
  }
}

export type KontekstProjektu = ReturnType<typeof zbudujKontekst>
