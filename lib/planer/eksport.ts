import { dniWMiesiacu, dzienTygodnia } from './daty'
import { etykietaBudynku, miejsceSpecjalne } from './budynki'
import { opisCzasu, opisMiejsca, opisOsob, porownajWydarzenia } from './opis'
import { tygodnieMiesiaca } from './pasy'
import { dniMiedzy, dniTrwaniaWMiesiacu, poczatek, porownajDaty, type Data } from './trwanie'
import { KATEGORIE, numerRangi, type Kategoria, type Miesiac, type Wydarzenie } from './typy'

export interface LiniaKomorki {
  tekst: string
  /** Kolor do druku z `KATEGORIE[…].druk`, „#rrggbb”. */
  kolor: string
  pogrubiona: boolean
}

export interface KomorkaKalendarza {
  dzien: number | null
  linie: LiniaKomorki[]
}

export interface KomorkaListy {
  tekst: string
  /** Tło „#rrggbb”; `null` - bez tła, wtedy widać pasek wiersza. */
  tlo: string | null
  /** Ile wierszy zajmuje komórka: 1 zwykła, więcej - scalona w dół, 0 - schowana pod scaleniem wyżej. */
  wierszy: number
}

export interface WierszListy {
  dzien: number
  dzienTygodnia: string
  /** Po jednej na kategorię, w kolejności `KOLUMNY_LISTY`. */
  komorki: KomorkaListy[]
  /** „Kogo dotyczy?” - osoby ze wszystkich wydarzeń dnia. */
  kogo: string
}

export interface Eksport {
  nazwaPliku: string
  tytul: string
  kalendarz: KomorkaKalendarza[][]
  /** Karta „Lista”: wiersz na każdy dzień miesiąca, jak arkusz Sesji. */
  lista: WierszListy[]
}

export const NAGLOWKI_KALENDARZA = ['Pn', 'Wt', 'Śr', 'Cz', 'Pt', 'So', 'Nd']

/** Kolumny karty „Lista” - kolejność z arkusza, który zarząd prowadził ręcznie. */
export const KOLUMNY_LISTY: Kategoria[] = ['UE', 'SSUEW', 'PROJEKTY', 'ZEBRANIA', 'KOMISJE', 'INNE', 'APLIKACJE']

export const NAGLOWKI_KOLUMN_LISTY: Record<Kategoria, string> = {
  UE: 'UE', SSUEW: 'SSUEW', PROJEKTY: 'PROJEKTY', ZEBRANIA: 'ZEBRANIA',
  KOMISJE: 'KOMISJE', INNE: 'INNE', APLIKACJE: 'APLIKACJE',
}

/**
 * Kolory z arkusza wzorcowego (paleta Arkuszy Google). Tło komórki bierze się
 * z kolumny; UE, Komisje i Inne nie mają tła. Wyjątki: zebranie zarządu jest
 * ciemniejsze, dzień wolny od zajęć - zielony w każdej kolumnie.
 */
export const KOLORY_LISTY = {
  naglowek: '#d9ead3',
  pasek: '#f3f3f3',
  zarzad: '#ea9999',
  wolny: '#b6d7a8',
  kolumny: {
    UE: { naglowek: '#ead1dc', komorka: null },
    SSUEW: { naglowek: '#9fc5e8', komorka: '#9fc5e8' },
    PROJEKTY: { naglowek: '#c9daf8', komorka: '#c9daf8' },
    ZEBRANIA: { naglowek: '#f4cccc', komorka: '#f4cccc' },
    KOMISJE: { naglowek: '#d9ead3', komorka: null },
    INNE: { naglowek: '#d9ead3', komorka: null },
    APLIKACJE: { naglowek: '#ffe599', komorka: '#fff2cc' },
  } satisfies Record<Kategoria, { naglowek: string; komorka: string | null }>,
}

const KOLKA = ['①', '②', '③', '④']
export const NAZWY_MIESIECY = [
  'Styczeń', 'Luty', 'Marzec', 'Kwiecień', 'Maj', 'Czerwiec',
  'Lipiec', 'Sierpień', 'Wrzesień', 'Październik', 'Listopad', 'Grudzień',
]

const dwie = (n: number) => String(n).padStart(2, '0')

function linia(w: Wydarzenie, dzien: Data): LiniaKomorki {
  const s = KATEGORIE[w.kategoria]
  const n = numerRangi(w.kategoria)
  const czesci = [
    [opisCzasu(w), w.tytul].filter(Boolean).join(' '),
    opisMiejsca(w),
    opisOsob(w.osoby),
  ].filter(Boolean)
  const ktoryDzien = w.dni > 1 ? ` (${dniMiedzy(poczatek(w), dzien)}/${w.dni})` : ''
  return {
    tekst: `${n !== null ? KOLKA[n - 1] : '•'} ${czesci.join(' · ')}${ktoryDzien}`,
    kolor: s.druk,
    pogrubiona: s.ranga === 1,
  }
}

/** Miejsce w Liście: sala i po spacji budynek („110 B/L”), sam budynek albo miejsce spoza uczelni. */
function miejsceListy(w: Wydarzenie): string | null {
  if (miejsceSpecjalne(w.budynek)) return opisMiejsca(w)
  const budynek = w.budynek ? etykietaBudynku(w.budynek) : null
  return [w.sala, budynek].filter(Boolean).join(' ') || null
}

/** „PROMKA - 18:00 - 9J”; cały dzień bez godziny. */
function tekstListy(w: Wydarzenie): string {
  return [w.tytul, w.calyDzien ? null : opisCzasu(w), miejsceListy(w)].filter(Boolean).join(' - ')
}

function tloListy(k: Kategoria, wydarzenia: Wydarzenie[]): string | null {
  if (!wydarzenia.length) return null
  if (wydarzenia.some((w) => w.dzienWolny)) return KOLORY_LISTY.wolny
  if (k === 'ZEBRANIA' && wydarzenia.some((w) => /zarząd/i.test(w.tytul))) return KOLORY_LISTY.zarzad
  return KOLORY_LISTY.kolumny[k].komorka
}

/** Osoby dnia: najpierw w kolejności Składu, potem reszta alfabetycznie. */
function kogoDotyczy(wydarzenia: Wydarzenie[], sklad: string[]): string {
  const osoby = new Set(wydarzenia.flatMap((w) => w.osoby))
  if (osoby.has('wszyscy')) return 'wszyscy'
  const zeSkladu = sklad.filter((o) => osoby.has(o))
  const spoza = [...osoby].filter((o) => !sklad.includes(o)).sort((a, b) => a.localeCompare(b, 'pl'))
  return [...zeSkladu, ...spoza].join(', ')
}

/**
 * Karta „Lista” jak arkusz prowadzony ręcznie na Sesjach: dzień pod dniem,
 * kategoria w kolumnie. Wydarzenie wielodniowe to jedna komórka scalona
 * w pionie - ale tylko gdy przez cały ten czas jest w kolumnie samo; inaczej
 * scalenie przykryłoby drugie wydarzenie.
 */
function budujListe(wMiesiacu: Wydarzenie[], m: Miesiac, sklad: string[]): WierszListy[] {
  const ileDni = dniWMiesiacu(m.y, m.m)
  const tegoDnia = (dzien: number) => wMiesiacu.filter((w) => dniTrwaniaWMiesiacu(w, m).includes(dzien))

  const kolumny = KOLUMNY_LISTY.map((k) => {
    const komorki: KomorkaListy[] = []
    for (let dzien = 1; dzien <= ileDni; dzien++) {
      const tu = tegoDnia(dzien).filter((w) => w.kategoria === k)
      komorki.push({ tekst: tu.map(tekstListy).join('\n'), tlo: tloListy(k, tu), wierszy: 1 })
    }
    for (let i = 0; i < ileDni; i++) {
      const tu = tegoDnia(i + 1).filter((w) => w.kategoria === k)
      if (tu.length !== 1 || tu[0].dni < 2 || komorki[i].wierszy === 0) continue
      let dlugosc = 1
      while (i + dlugosc < ileDni) {
        const dalej = tegoDnia(i + dlugosc + 1).filter((w) => w.kategoria === k)
        if (dalej.length !== 1 || dalej[0].id !== tu[0].id) break
        dlugosc++
      }
      komorki[i].wierszy = dlugosc
      for (let j = 1; j < dlugosc; j++) komorki[i + j] = { ...komorki[i], tekst: '', wierszy: 0 }
    }
    return komorki
  })

  return Array.from({ length: ileDni }, (_, i) => ({
    dzien: i + 1,
    dzienTygodnia: dzienTygodnia(m.y, m.m, i + 1),
    komorki: kolumny.map((k) => k[i]),
    kogo: kogoDotyczy(tegoDnia(i + 1), sklad),
  }))
}

/**
 * Zawartość pliku miesiąca bez zależności od biblioteki arkuszy - dzięki temu
 * da się ją przetestować na zwykłych danych. Zawsze CAŁY miesiąc, niezależnie
 * od filtrów: plik wysłany dalej nie może być po cichu niepełny.
 */
export function budujEksport(wydarzenia: Wydarzenie[], m: Miesiac, sklad: string[] = []): Eksport {
  const wMiesiacu = wydarzenia
    .filter((w) => dniTrwaniaWMiesiacu(w, m).length > 0)
    .sort(porownajWydarzenia)

  const kalendarz = tygodnieMiesiaca(m).map((tydzien) =>
    tydzien.map((dzien): KomorkaKalendarza => {
      if (dzien === null) return { dzien: null, linie: [] }
      const data = { rok: m.y, miesiac: m.m, dzien }
      const tegoDnia = wMiesiacu.filter((w) => dniTrwaniaWMiesiacu(w, m).includes(dzien))
      return { dzien, linie: tegoDnia.map((w) => linia(w, data)) }
    }),
  )

  // W komórce kolejność dnia: wcześniejszy start wyżej, potem ranga i godzina.
  const poDniach = [...wMiesiacu].sort((a, b) => porownajDaty(poczatek(a), poczatek(b)) || porownajWydarzenia(a, b))

  return {
    nazwaPliku: `planer-${m.y}-${dwie(m.m)}.xlsx`,
    tytul: `${NAZWY_MIESIECY[m.m - 1]} ${m.y}`,
    kalendarz,
    lista: budujListe(poDniach, m, sklad),
  }
}
