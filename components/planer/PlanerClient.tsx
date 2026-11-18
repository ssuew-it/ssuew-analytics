'use client'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight, Inbox, ListChecks, Plus, Radio, Users } from 'lucide-react'
import { KLUCZE_KATEGORII, type Kategoria, type Semestr, type Wydarzenie } from '@/lib/planer/typy'
import {
  dodajWydarzenie, odrzucPropozycje, przyjmijPropozycje, subskrybujPropozycje,
  dodajKomentarz, subskrybujKomentarze, subskrybujObecnosc,
  subskrybujTrybWspolny, subskrybujWydarzenia, ustawTrybWspolny, usunWydarzenie,
  zapiszObecnosc, zmienWydarzenie,
  type NoweWydarzenie, type StanSesjiWspolnej,
} from '@/lib/planer/zapis'
import {
  dodajPrzezSerwer, przeniesPrzezSerwer, zglosKomentarz, zglosNowe, zglosObecnosc, zglosPrzeniesienie,
  zmienPrzezSerwer,
} from '@/lib/planer/serwer'
import type { Propozycja } from '@/lib/planer/propozycje'
import { poWydarzeniach, type Komentarz } from '@/lib/planer/komentarze'
import type { Znak } from '@/lib/planer/obecnosc'
import { PasekFiltrow, type Widok } from './PasekFiltrow'
import { WidokMiesiaca } from './WidokMiesiaca'
import { WidokSemestru } from './WidokSemestru'
import { PanelWydarzenia } from './PanelWydarzenia'
import { PustySemestr } from './PustySemestr'
import { BanerSesji } from './BanerSesji'
import { Skrzynka } from './Skrzynka'
import { Obecnosc } from './Obecnosc'
import { Watek } from './Watek'
import { dniWMiesiacu } from '@/lib/planer/daty'
import { dzisWarszawa } from '@/lib/czas'
import { terminyCoTydzien } from '@/lib/planer/powtarzanie'
import { nachodziNaMiesiac } from '@/lib/planer/trwanie'
import { SESJA_WYLACZONA } from '@/lib/planer/stan'
import { subskrybujSklad, zapiszSklad } from '@/lib/planer/sklad'
import { Sklad } from './Sklad'
import { PobierzMiesiac } from './PobierzMiesiac'
import { WyslijDoKalendarza } from './WyslijDoKalendarza'
import { PasekEksportuCra } from './PasekEksportuCra'
import type { ObrazPlanera } from '@/lib/planer/obraz'

const NAZWY = [
  'Styczeń', 'Luty', 'Marzec', 'Kwiecień', 'Maj', 'Czerwiec',
  'Lipiec', 'Sierpień', 'Wrzesień', 'Październik', 'Listopad', 'Grudzień',
]

type Props = {
  semestr: Semestr
  /** `owner` pisze wprost do Firestore; `board` przez serwer. */
  rola: 'owner' | 'board'
  /** Adres e-mail albo etykieta kodu - trafia do propozycji jako autor. */
  kto: string
  /** Obraz z serwera dla osób na kodzie; konta z hasłem dostają dane z subskrypcji (`null`). */
  poczatkowy: ObrazPlanera | null
  /** Osoby na kodzie nie mają konta Firebase, więc nie subskrybują Firestore. */
  naZywo: boolean
}

export function PlanerClient({ semestr, rola, kto, poczatkowy, naZywo }: Props) {
  const wlascicielem = rola === 'owner'
  const [wydarzenia, setWydarzenia] = useState<Wydarzenie[]>(poczatkowy?.wydarzenia ?? [])
  // Bez tego przed pierwszą odpowiedzią Firestore widać „semestr jest pusty”.
  const [wczytany, setWczytany] = useState(!naZywo || poczatkowy !== null)
  const [blad, setBlad] = useState<string | null>(null)
  const [widok, setWidok] = useState<Widok>('miesiac')
  // W trakcie semestru zaczynamy od bieżącego miesiąca (Warszawa), nie od pierwszego.
  const [indeksMiesiaca, setIndeksMiesiaca] = useState(() => {
    const dzis = dzisWarszawa(new Date())
    const i = semestr.miesiace.findIndex((x) => x.m === dzis.miesiac && x.y === dzis.rok)
    return i >= 0 ? i : 0
  })
  const [aktywne, setAktywne] = useState<Set<Kategoria>>(new Set(KLUCZE_KATEGORII))
  const [osoba, setOsoba] = useState('')
  const [wybrane, setWybrane] = useState<Wydarzenie | null>(null)
  const [dodaje, setDodaje] = useState(false)
  /** Dzień wskazany przy dodawaniu z kratki - panel startuje z tą datą. */
  const [dzienDodania, setDzienDodania] = useState<number | null>(null)
  const [sesja, setSesja] = useState<StanSesjiWspolnej>(poczatkowy?.sesja ?? SESJA_WYLACZONA)
  const [propozycje, setPropozycje] = useState<Propozycja[]>([])
  const [skrzynkaOtwarta, setSkrzynkaOtwarta] = useState(false)
  const [komentarze, setKomentarze] = useState<Komentarz[]>([])
  const [znaki, setZnaki] = useState<Znak[]>([])
  const [sklad, setSklad] = useState<string[]>(poczatkowy?.sklad ?? [])
  const [skladOtwarty, setSkladOtwarty] = useState(false)
  /** Tryb zaznaczania do eksportu CRA; `null` = wyłączony. */
  const [doCra, setDoCra] = useState<Set<string> | null>(null)

  useEffect(() => {
    if (!naZywo) return
    return subskrybujWydarzenia(
      semestr.id,
      (w) => {
        setWydarzenia(w)
        setWczytany(true)
      },
      (e) => {
        setBlad(`Nie udało się pobrać kalendarza: ${e.message}`)
        setWczytany(true)
      },
    )
  }, [semestr.id, naZywo])

  useEffect(() => {
    if (!naZywo) return
    return subskrybujTrybWspolny(semestr.id, setSesja)
  }, [semestr.id, naZywo])

  useEffect(() => {
    if (!naZywo) return
    return subskrybujSklad(setSklad, (e) => setBlad(`Nie udało się pobrać składu: ${e.message}`))
  }, [naZywo])

  useEffect(() => {
    if (!naZywo || !wlascicielem) return
    return subskrybujPropozycje(semestr.id, setPropozycje, (e) =>
      setBlad(`Nie udało się pobrać skrzynki: ${e.message}`),
    )
  }, [semestr.id, naZywo, wlascicielem])

  /**
   * Pobranie stanu przez serwer - dla osób na kodzie, które nie mają
   * subskrypcji Firestore. `tylkoSesja` czyta jeden dokument zamiast całego
   * kalendarza.
   */
  const odswiez = useCallback(async (tylkoSesja = false) => {
    const r = await fetch(`/api/planer?semestr=${semestr.id}${tylkoSesja ? '&zasob=sesja' : ''}`)
    if (!r.ok) return
    const d = await r.json()
    if (d.sesja) setSesja(d.sesja)
    if (Array.isArray(d.wydarzenia)) setWydarzenia(d.wydarzenia)
    if (Array.isArray(d.sklad)) setSklad(d.sklad)
  }, [semestr.id])

  // Poza sesją co minutę sprawdzamy wyłącznie, czy się zaczęła; w trakcie
  // sesji co 15 sekund pobieramy cały obraz - wtedy opóźnienie naprawdę
  // przeszkadza. Tylko przy widocznej karcie.
  useEffect(() => {
    if (naZywo) return
    const wSesji = sesja.wlaczony
    const krok = () => {
      if (!document.hidden) void odswiez(!wSesji).catch(() => {})
    }
    // Po wykryciu startu sesji nie czekamy 15 sekund na pierwszy pełny obraz.
    if (wSesji) krok()
    const id = setInterval(krok, wSesji ? 15_000 : 60_000)
    return () => clearInterval(id)
  }, [naZywo, sesja.wlaczony, odswiez])

  useEffect(() => {
    if (!naZywo) return
    return subskrybujKomentarze(semestr.id, setKomentarze, (e) =>
      setBlad(`Nie udało się pobrać rozmów: ${e.message}`),
    )
  }, [semestr.id, naZywo])

  useEffect(() => {
    if (!naZywo) return
    // Obecność jest ozdobą - jej awaria nie może zasłaniać kalendarza banerem,
    // ale nie może też przepaść bez śladu, bo właśnie takie ciche padanie
    // utrudniło diagnozę braku reguł Firestore.
    return subskrybujObecnosc(semestr.id, setZnaki, (e) =>
      console.warn('Obecność niedostępna:', e.message),
    )
  }, [semestr.id, naZywo])

  /** Zapis wprost albo propozycja - rozstrzyga rola i stan sesji. */
  const piszeWprost = wlascicielem || sesja.wlaczony

  const miesiac = semestr.miesiace[indeksMiesiaca]

  const osoby = useMemo(() => {
    const zWydarzen = new Set<string>()
    for (const w of wydarzenia) for (const o of w.osoby) if (o !== 'wszyscy') zWydarzen.add(o)
    // Najpierw Skład w jego kolejności, potem osoby spoza Składu ze starszych
    // wpisów - inaczej starych wydarzeń nie dałoby się dalej filtrować.
    const spoza = [...zWydarzen].filter((o) => !sklad.includes(o)).sort((a, b) => a.localeCompare(b, 'pl'))
    return [...sklad, ...spoza]
  }, [wydarzenia, sklad])

  const widoczne = useMemo(
    () =>
      wydarzenia.filter((w) => {
        if (!aktywne.has(w.kategoria)) return false
        // Filtr osoby pokazuje też wydarzenia oznaczone 'wszyscy' - one jej dotyczą.
        if (osoba && !w.osoby.includes(osoba) && !w.osoby.includes('wszyscy')) return false
        return true
      }),
    [wydarzenia, aktywne, osoba],
  )

  // Do miesiąca trafia wszystko, co na niego nachodzi - także wielodniowe
  // ze startem w poprzednim miesiącu.
  const wMiesiacu = useMemo(
    () => widoczne.filter((w) => nachodziNaMiesiac(w, miesiac)),
    [widoczne, miesiac],
  )

  const rozmowy = useMemo(() => poWydarzeniach(komentarze), [komentarze])
  const zRozmowa = useMemo(() => new Set(rozmowy.keys()), [rozmowy])

  const przelacz = useCallback((k: Kategoria) => {
    setAktywne((p) => {
      const n = new Set(p)
      if (n.has(k)) n.delete(k)
      else n.add(k)
      return n
    })
  }, [])

  // Karta w tle nie zapisuje nic: to najdroższy ruch w całym Planerze.
  // `patrzyNa` zmienia się tylko przy otwartym panelu, nie przy najechaniu myszą.
  useEffect(() => {
    const patrzyNa = wybrane?.id ?? null

    async function znak() {
      if (document.hidden) return
      try {
        // Właściciel zapisuje wprost, więc sam nadaje sobie identyfikator.
        // Prefiks odróżnia go od tych, które nadaje serwer.
        if (wlascicielem) await zapiszObecnosc(semestr.id, `konto:${kto}`, kto, patrzyNa)
        else await zglosObecnosc(semestr.id, patrzyNa)
      } catch {
        // Nieudany znak życia nie ma znaczenia - następny pójdzie za minutę.
      }
    }

    void znak()
    const id = setInterval(znak, 60_000)
    return () => clearInterval(id)
  }, [semestr.id, kto, wlascicielem, wybrane?.id])

  async function skomentuj(tresc: string) {
    if (!wybrane) return
    if (wlascicielem) await dodajKomentarz(semestr.id, wybrane.id, tresc, kto)
    else await zglosKomentarz(semestr.id, wybrane.id, tresc)
  }

  async function zapisz(dane: NoweWydarzenie, powtorzenia = 1) {
    try {
      if (!piszeWprost) {
        // Zarząd poza sesją tylko proponuje NOWE wydarzenia; edycja istniejącego
        // jest dla niego zablokowana w panelu, więc tu tylko domykamy furtkę.
        if (wybrane) return
        // Powtarzanie pomijamy celowo: każda kopia byłaby osobną decyzją
        // do rozpatrzenia, a to zasypałoby skrzynkę.
        await zglosNowe(semestr.id, dane)
      } else if (wybrane) {
        if (wlascicielem) await zmienWydarzenie(semestr.id, wybrane.id, dane)
        else await zmienPrzezSerwer(semestr.id, wybrane.id, dane)
      } else {
        // Powtarzanie tworzy osobne wpisy, a nie powiązaną serię - dzięki temu
        // nie ma pytania „edytujesz to jedno czy wszystkie”.
        const terminy = terminyCoTydzien(
          { rok: dane.rok, miesiac: dane.miesiac, dzien: dane.dzien },
          semestr.miesiace,
          powtorzenia,
        )
        for (const t of terminy) {
          // Bezpośredni zapis do Firestore ma wyłącznie właściciel - zarząd
          // w sesji pisze przez serwer, który sam sprawdza, czy sesja trwa.
          if (wlascicielem) await dodajWydarzenie(semestr.id, { ...dane, ...t })
          else await dodajPrzezSerwer(semestr.id, { ...dane, ...t })
        }
      }
      // Osoba na kodzie nie ma subskrypcji - bez tego swoją zmianę zobaczy
      // dopiero przy następnym odpytaniu.
      if (!naZywo && piszeWprost) await odswiez()
      setBlad(null)
      zamknijPanel()
    } catch (e) {
      setBlad(`Nie udało się zapisać: ${(e as Error).message}`)
    }
  }

  async function usun(id: string) {
    // Usunięcia nie da się cofnąć, a kliknięcie kosza jest o milimetr od zapisu.
    if (!window.confirm('Usunąć to wydarzenie? Tego nie da się cofnąć.')) return
    await usunWydarzenie(semestr.id, id)
    setWybrane(null)
  }

  function dodajWDniu(dzien: number) {
    setWybrane(null)
    setDzienDodania(dzien)
    setDodaje(true)
  }

  function dodajZPaska() {
    setWybrane(null)
    setDzienDodania(null)
    setDodaje(true)
  }

  function zamknijPanel() {
    setWybrane(null)
    setDodaje(false)
    setDzienDodania(null)
  }

  async function przenies(id: string, naDzien: number) {
    const w = wydarzenia.find((x) => x.id === id)
    if (!w) return
    try {
      if (wlascicielem) {
        await zmienWydarzenie(semestr.id, id, { dzien: naDzien })
      } else if (sesja.wlaczony) {
        await przeniesPrzezSerwer(semestr.id, id, naDzien)
        if (!naZywo) await odswiez()
      } else {
        await zglosPrzeniesienie(semestr.id, id, w.dzien, naDzien, w.tytul)
      }
      setBlad(null)
    } catch (e) {
      setBlad(`Nie udało się zapisać: ${(e as Error).message}`)
    }
  }

  /** Przesunięcie strzałkami. Poza miesiąc nie wychodzimy - to zmieniłoby widok pod palcami. */
  async function przesun(id: string, oDni: number) {
    const w = wydarzenia.find((x) => x.id === id)
    if (!w) return
    const nowy = w.dzien + oDni
    if (nowy < 1 || nowy > dniWMiesiacu(w.rok, w.miesiac)) return
    // Ta sama droga co przeciągnięcie: zarząd poza sesją zgłasza propozycję,
    // w sesji pisze przez serwer. Wprost do Firestore - tylko właściciel.
    await przenies(id, nowy)
  }

  const panelOtwarty = wybrane !== null || dodaje
  // Pusty jest CAŁY semestr, nie bieżący miesiąc - filtry i przełącznik widoku
  // nie mają wtedy czego filtrować, więc znikają razem z siatką.
  const semestrPusty = wydarzenia.length === 0

  const bladPaska = blad && (
    <div className="rounded-lg border border-deck-danger-border bg-deck-danger-bg/70 px-3 py-2 text-[11px] text-deck-danger">
      {blad}
    </div>
  )

  if (!wczytany) {
    return (
      <div role="status" className="deck-card rounded-lg px-4 py-10 text-center font-mono text-[11px] uppercase tracking-[0.18em] text-deck-muted">
        Wczytuję kalendarz…
      </div>
    )
  }

  if (semestrPusty && !panelOtwarty) {
    return (
      <div className="space-y-3">
        {bladPaska}
        <PustySemestr
          nazwaSemestru={semestr.nazwa}
          mozeEdytowac={wlascicielem}
          onDodaj={dodajZPaska}
        />
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {bladPaska}

      <BanerSesji
        stan={sesja}
        mozeWylaczyc={wlascicielem}
        onWylacz={() => ustawTrybWspolny(semestr.id, false, kto)}
      />

      <Obecnosc znaki={znaki} />

      {wlascicielem && (
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setSkrzynkaOtwarta((o) => !o)}
            className="deck-chip flex items-center gap-2 rounded-lg px-3 py-1.5 text-[11.5px] text-deck-muted transition hover:text-deck-text"
          >
            <Inbox size={13} />
            Skrzynka
            {propozycje.length > 0 && (
              <span className="rounded-full bg-deck-accent px-1.5 text-[10px] font-bold text-deck-bg-deep">
                {propozycje.length}
              </span>
            )}
          </button>
          <button
            type="button"
            onClick={() => setSkladOtwarty((o) => !o)}
            className="deck-chip flex items-center gap-2 rounded-lg px-3 py-1.5 text-[11.5px] text-deck-muted transition hover:text-deck-text"
          >
            <Users size={13} /> Skład
          </button>
          {!sesja.wlaczony && (
            <button
              type="button"
              onClick={() => ustawTrybWspolny(semestr.id, true, kto)}
              className="deck-chip flex items-center gap-2 rounded-lg px-3 py-1.5 text-[11.5px] text-deck-muted transition hover:text-deck-accent"
            >
              <Radio size={13} /> Włącz Sesję Operacyjną
            </button>
          )}
        </div>
      )}

      {wlascicielem && skrzynkaOtwarta && (
        <Skrzynka
          propozycje={propozycje}
          wydarzenia={wydarzenia}
          onPrzyjmij={(p) => przyjmijPropozycje(semestr.id, p)}
          onOdrzuc={(id) => odrzucPropozycje(semestr.id, id)}
        />
      )}

      {wlascicielem && skladOtwarty && (
        <Sklad
          osoby={sklad}
          onZmien={(o) => {
            zapiszSklad(o).catch((e) => setBlad(`Nie udało się zapisać składu: ${(e as Error).message}`))
          }}
          onZamknij={() => setSkladOtwarty(false)}
        />
      )}

      <PasekFiltrow
        aktywne={aktywne}
        onPrzelacz={przelacz}
        osoby={osoby}
        osoba={osoba}
        onOsoba={setOsoba}
        widok={widok}
        onWidok={setWidok}
      />

      {widok === 'miesiac' && (
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            aria-label="Poprzedni miesiąc"
            disabled={indeksMiesiaca === 0}
            onClick={() => setIndeksMiesiaca((i) => i - 1)}
            className="deck-chip grid h-8 w-8 place-items-center rounded-lg text-deck-muted disabled:opacity-40"
          >
            <ChevronLeft size={15} />
          </button>
          <div className="text-sm font-semibold text-deck-text">
            {NAZWY[miesiac.m - 1]} {miesiac.y}
          </div>
          <button
            type="button"
            aria-label="Następny miesiąc"
            disabled={indeksMiesiaca === semestr.miesiace.length - 1}
            onClick={() => setIndeksMiesiaca((i) => i + 1)}
            className="deck-chip grid h-8 w-8 place-items-center rounded-lg text-deck-muted disabled:opacity-40"
          >
            <ChevronRight size={15} />
          </button>
          <div className="flex flex-wrap items-center gap-2 sm:ml-auto">
            <button
              type="button"
              onClick={() => setDoCra((z) => (z ? null : new Set()))}
              aria-pressed={doCra !== null}
              className="deck-chip flex items-center gap-2 rounded-lg px-3 py-2 text-[12px] text-deck-muted transition hover:text-deck-text aria-pressed:text-deck-accent"
            >
              <ListChecks size={14} /> Eksport do CRA
            </button>
            <PobierzMiesiac wydarzenia={wydarzenia} miesiac={miesiac} sklad={sklad} />
            {wlascicielem && <WyslijDoKalendarza />}
          </div>
          <button
            type="button"
            onClick={dodajZPaska}
            className="deck-button flex items-center gap-2 rounded-lg px-3 py-2 text-[12px] font-semibold"
          >
            <Plus size={14} /> {piszeWprost ? 'Dodaj wydarzenie' : 'Zgłoś wydarzenie'}
          </button>
        </div>
      )}

      {widok === 'miesiac' && doCra && (
        <PasekEksportuCra
          wMiesiacu={wMiesiacu}
          wszystkie={wydarzenia}
          zaznaczone={doCra}
          miesiac={miesiac}
          onZmien={setDoCra}
          onZakoncz={() => setDoCra(null)}
        />
      )}

      <div className={panelOtwarty ? 'grid gap-3 lg:grid-cols-[1fr_320px]' : ''}>
        <div>
          {widok === 'miesiac' ? (
            <WidokMiesiaca
              miesiac={miesiac}
              wydarzenia={wMiesiacu}
              onOtworz={(w) => {
                // W trybie eksportu kliknięcie zaznacza, a nie otwiera panelu.
                if (doCra) {
                  const nowe = new Set(doCra)
                  if (nowe.has(w.id)) nowe.delete(w.id)
                  else nowe.add(w.id)
                  setDoCra(nowe)
                  return
                }
                setDodaje(false); setDzienDodania(null); setWybrane(w)
              }}
              onPrzenies={przenies}
              onPrzesun={przesun}
              onDodajWDniu={dodajWDniu}
              zRozmowa={zRozmowa}
              zaznaczone={doCra ?? undefined}
              // Zawsze wlaczone: u zarzadu przeciagniecie tworzy propozycje,
              // wiec musi dzialac takze przy wylaczonej sesji.
              mozeEdytowac
            />
          ) : (
            <WidokSemestru
              miesiace={semestr.miesiace}
              wydarzenia={widoczne}
              onWejdz={(m) => {
                setIndeksMiesiaca(semestr.miesiace.findIndex((x) => x.m === m.m && x.y === m.y))
                setWidok('miesiac')
              }}
            />
          )}
        </div>

        {panelOtwarty && (
          <PanelWydarzenia
            // Zmiana wybranego wydarzenia przemontowuje formularz i resetuje
            // jego pola - zalecany przez Reacta sposób zamiast synchronizacji
            // stanu efektem.
            key={wybrane?.id ?? `nowe-${dzienDodania ?? 0}`}
            wydarzenie={wybrane}
            miesiac={miesiac}
            dzienStartowy={dzienDodania}
            // Zarzad wypelnia tylko formularz nowego wydarzenia (zeby je zglosic);
            // istniejacego nie edytuje - moze jedynie proponowac przeniesienie.
            mozeEdytowac={piszeWprost || wybrane === null}
            mozeUsunac={wlascicielem}
            sklad={sklad}
            onZapisz={zapisz}
            onUsun={usun}
            onZamknij={zamknijPanel}
            watek={
              wybrane ? (
                <Watek komentarze={rozmowy.get(wybrane.id) ?? []} onDodaj={skomentuj} />
              ) : null
            }
          />
        )}
      </div>
    </div>
  )
}
